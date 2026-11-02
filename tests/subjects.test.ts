// TASK-034 — Nền tảng đa môn: bảng subjects, subject_id cho khoá học / đề / bài học, API + trang quản lý môn.
// File do trưởng phòng viết, bị khoá.
import { describe, it, expect, vi, beforeEach } from "vitest";
import fs from "fs";
import { createFakePg } from "./helpers/pg-fake";

const h = vi.hoisted(() => {
  process.env.JWT_SECRET = "test_secret_for_vitest_only_0123456789abcdef";
  return { token: undefined as string | undefined, pg: null as any };
});

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (n: string) => (n === "auth_token" && h.token ? { value: h.token } : undefined),
    set: () => {},
  }),
}));
vi.mock("@/lib/db-pg", () => ({
  queryPg: (sql: string, params?: unknown[]) => h.pg.queryPg(sql, params),
  getPgPool: () => ({ connect: async () => ({ query: (s: string, p?: unknown[]) => h.pg.queryPg(s, p), release: () => {} }) }),
  ensureSchema: async () => {},
}));
vi.mock("@/lib/neo4j", () => ({
  getNeo4jDriver: () => null,
  runCypherQuery: async () => [],
  syncCourseExam: async () => {},
  getExamCourseMapping: async () => [],
  syncTeacherManagesClass: async () => {},
  syncStudentEnrolledInClass: async () => {},
  recordStudentSkillScore: async () => {},
}));
vi.mock("@/lib/redis-queue", () => ({ pushRedisStreamEvent: async () => {}, pushGradingEvent: async () => {} }));

import { signJwtToken } from "@/lib/jwt";

type Role = "ADMIN" | "TEACHER" | "STUDENT";
async function loginAs(role: Role | null, userId = "u") {
  h.token = role ? await signJwtToken({ userId, email: `${userId}@x.vn`, role }) : undefined;
}
const req = (method: string, url: string, body?: unknown) =>
  new Request(`http://localhost${url}`, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
const ctx = (id: string) => ({ params: Promise.resolve({ id }) });
const rows = async (sql: string) => (await h.pg.db.query(sql)).rows;

const subjects = () => import("@/app/api/subjects/route");
const subject = () => import("@/app/api/subjects/[id]/route");
const listSubjects = async (qs = "") => (await subjects()).GET(req("GET", `/api/subjects${qs}`));
const createSubject = async (body: unknown) => (await subjects()).POST(req("POST", "/api/subjects", body));
const updateSubject = async (id: string, body: unknown) => (await subject()).PUT(req("PUT", `/api/subjects/${id}`, body), ctx(id));
const deleteSubject = async (id: string) => (await subject()).DELETE(req("DELETE", `/api/subjects/${id}`), ctx(id));

beforeEach(async () => {
  h.token = undefined;
  h.pg = await createFakePg();
  await h.pg.db.exec(`
    ALTER TABLE exams ADD COLUMN IF NOT EXISTS description TEXT;
    ALTER TABLE exams ADD COLUMN IF NOT EXISTS scoring_standard_id VARCHAR(50);
    CREATE TABLE courses (id VARCHAR(50) PRIMARY KEY, title VARCHAR(255) NOT NULL, description TEXT, created_by VARCHAR(50),
      default_scoring_standard_id VARCHAR(50), created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP);
    CREATE TABLE curriculum_items (id VARCHAR(50) PRIMARY KEY, course_id VARCHAR(50) NOT NULL, parent_id VARCHAR(50), title VARCHAR(255) NOT NULL,
      type VARCHAR(20) NOT NULL, exam_id VARCHAR(50), order_index INT DEFAULT 0, created_by VARCHAR(50), created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP);
    INSERT INTO courses (id,title,created_by) VALUES ('coOld','Khoá cũ','t1');
    INSERT INTO exams (id,title,skills,question_ids,created_by) VALUES ('eOld','Đề cũ',ARRAY['Reading'],'["q1"]','t1');
    INSERT INTO questions (id,skill,category,content) VALUES ('q1','Reading','READING_MC','{}');
  `);
  await h.pg.db.exec(fs.readFileSync("docs/db-migration-006-lessons.sql", "utf8"));
  await h.pg.db.exec(`INSERT INTO lessons (id,title,created_by) VALUES ('lOld','Bài cũ','t1');`);
  await h.pg.db.exec(fs.readFileSync("docs/db-migration-012-subjects.sql", "utf8"));
});

describe("Migration 012", () => {
  it("tạo môn hệ thống 'english' (LANGUAGE) và gán toàn bộ dữ liệu cũ vào tiếng Anh", async () => {
    expect(await rows(`SELECT id, code, mode, owner_id FROM subjects WHERE id='english'`)).toEqual([
      { id: "english", code: "english", mode: "LANGUAGE", owner_id: null },
    ]);
    for (const t of ["courses", "exams", "lessons"]) {
      expect((await rows(`SELECT subject_id FROM ${t}`)).map((r: any) => r.subject_id), t).toEqual(["english"]);
    }
  });

  it("chạy lại nhiều lần không lỗi, không nhân đôi môn english", async () => {
    await h.pg.db.exec(fs.readFileSync("docs/db-migration-012-subjects.sql", "utf8"));
    expect((await rows(`SELECT COUNT(*)::int n FROM subjects WHERE id='english'`))[0].n).toBe(1);
  });
});

describe("API /api/subjects", () => {
  it("chưa đăng nhập 401; STUDENT GET chỉ thấy môn hệ thống đang bật, không tạo được (403)", async () => {
    expect((await listSubjects()).status).toBe(401);
    await loginAs("TEACHER", "t1");
    await createSubject({ name: "Toán lớp 5" });
    await loginAs("STUDENT", "s1");
    const json = await (await listSubjects()).json();
    expect(json.subjects.map((s: any) => s.id)).toEqual(["english"]);
    expect((await createSubject({ name: "X" })).status).toBe(403);
  });

  it("TEACHER tạo môn của mình (mode luôn SIMPLE, code tự sinh không dấu); thấy môn hệ thống + môn của mình, không thấy môn GV khác", async () => {
    await loginAs("TEACHER", "t1");
    const res = await createSubject({ name: "Toán Lớp 5", mode: "LANGUAGE", icon: "calculator", color: "#2563eb" });
    expect(res.status).toBe(201);
    const { subject: s } = await res.json();
    expect(s).toMatchObject({ name: "Toán Lớp 5", code: "toan-lop-5", mode: "SIMPLE", owner_id: "t1", is_active: true });
    await loginAs("TEACHER", "t2");
    await createSubject({ name: "Vật lý" });
    await loginAs("TEACHER", "t1");
    const ids = (await (await listSubjects()).json()).subjects.map((x: any) => x.code);
    expect(ids).toContain("english");
    expect(ids).toContain("toan-lop-5");
    expect(ids).not.toContain("vat-ly");
  });

  it("ADMIN tạo môn hệ thống (owner_id NULL), được chọn mode; ADMIN thấy tất cả", async () => {
    await loginAs("TEACHER", "t1");
    await createSubject({ name: "Hoá học" });
    await loginAs("ADMIN", "a1");
    const res = await createSubject({ name: "Tiếng Nhật", mode: "LANGUAGE" });
    expect(res.status).toBe(201);
    expect((await res.json()).subject).toMatchObject({ owner_id: null, mode: "LANGUAGE", code: "tieng-nhat" });
    const codes = (await (await listSubjects()).json()).subjects.map((x: any) => x.code);
    expect(codes).toEqual(expect.arrayContaining(["english", "hoa-hoc", "tieng-nhat"]));
  });

  it("tên rỗng / > 100 ký tự / mode lạ → 400; trùng code trong cùng phạm vi → 409", async () => {
    await loginAs("TEACHER", "t1");
    expect((await createSubject({ name: "  " })).status).toBe(400);
    expect((await createSubject({ name: "x".repeat(101) })).status).toBe(400);
    expect((await createSubject({ name: "Toán" })).status).toBe(201);
    expect((await createSubject({ name: "toán" })).status).toBe(409);
    await loginAs("TEACHER", "t2");
    expect((await createSubject({ name: "Toán" })).status).toBe(201);
    await loginAs("ADMIN", "a1");
    expect((await createSubject({ name: "Môn", mode: "ABC" })).status).toBe(400);
  });

  it("môn tắt (is_active=false) vẫn hiện với chủ, ẩn với STUDENT; ?active=1 chỉ lấy môn bật", async () => {
    await loginAs("ADMIN", "a1");
    const { subject: s } = await (await createSubject({ name: "Tin học" })).json();
    expect((await updateSubject(s.id, { is_active: false })).status).toBe(200);
    expect((await (await listSubjects()).json()).subjects.map((x: any) => x.id)).toContain(s.id);
    expect((await (await listSubjects("?active=1")).json()).subjects.map((x: any) => x.id)).not.toContain(s.id);
    await loginAs("STUDENT", "s1");
    expect((await (await listSubjects()).json()).subjects.map((x: any) => x.id)).not.toContain(s.id);
  });
});

describe("API /api/subjects/[id]", () => {
  it("TEACHER sửa môn của mình 200; môn GV khác / môn hệ thống 403; không có 404; TEACHER không đổi được mode", async () => {
    await loginAs("TEACHER", "t1");
    const { subject: mine } = await (await createSubject({ name: "Sinh học" })).json();
    expect((await updateSubject(mine.id, { name: "Sinh học 9", color: "#16a34a", order_index: 3, mode: "LANGUAGE" })).status).toBe(200);
    expect((await rows(`SELECT name, color, order_index, mode FROM subjects WHERE id='${mine.id}'`))[0]).toEqual({
      name: "Sinh học 9", color: "#16a34a", order_index: 3, mode: "SIMPLE",
    });
    expect((await updateSubject("english", { name: "Anh" })).status).toBe(403);
    expect((await updateSubject("nope", { name: "A" })).status).toBe(404);
    await loginAs("TEACHER", "t2");
    expect((await updateSubject(mine.id, { name: "Cướp" })).status).toBe(403);
    expect((await deleteSubject(mine.id)).status).toBe(403);
  });

  it("DELETE: môn english không xoá được (409); môn đang dùng → 409 kèm usages; môn trống → 200", async () => {
    await loginAs("ADMIN", "a1");
    expect((await deleteSubject("english")).status).toBe(409);
    await loginAs("TEACHER", "t1");
    const { subject: s } = await (await createSubject({ name: "Địa lý" })).json();
    await h.pg.db.query(`UPDATE courses SET subject_id=$1 WHERE id='coOld'`, [s.id]);
    const r = await deleteSubject(s.id);
    expect(r.status).toBe(409);
    expect((await r.json()).usages).toMatchObject({ courses: 1, exams: 0, lessons: 0 });
    await h.pg.db.query(`UPDATE courses SET subject_id='english' WHERE id='coOld'`);
    expect((await deleteSubject(s.id)).status).toBe(200);
    expect(await rows(`SELECT id FROM subjects WHERE id='${s.id}'`)).toEqual([]);
  });

  it("GET /api/subjects trả usage_count (số khoá + đề + bài học dùng môn)", async () => {
    await loginAs("ADMIN", "a1");
    const eng = (await (await listSubjects()).json()).subjects.find((x: any) => x.id === "english");
    expect(eng.usage_count).toBe(3);
  });
});

describe("subject_id trên khoá học / đề / bài học", () => {
  let toanId = "";
  let otherId = "";
  beforeEach(async () => {
    await loginAs("TEACHER", "t2");
    otherId = (await (await createSubject({ name: "Môn của t2" })).json()).subject.id;
    await loginAs("TEACHER", "t1");
    toanId = (await (await createSubject({ name: "Toán" })).json()).subject.id;
  });

  it("courses: POST nhận subject_id (thiếu → english), GET trả subject_id và lọc ?subject_id=; môn không được phép → 400", async () => {
    const C = await import("@/app/api/teacher/courses/route");
    expect((await C.POST(req("POST", "/api/teacher/courses", { title: "Toán 5", subject_id: toanId }))).status).toBe(200);
    expect((await C.POST(req("POST", "/api/teacher/courses", { title: "Anh 5" }))).status).toBe(200);
    expect((await C.POST(req("POST", "/api/teacher/courses", { title: "Lén", subject_id: otherId }))).status).toBe(400);
    expect((await C.POST(req("POST", "/api/teacher/courses", { title: "Ma", subject_id: "khong-co" }))).status).toBe(400);
    const all = (await (await C.GET(req("GET", "/api/teacher/courses"))).json()).courses;
    expect(all.find((c: any) => c.title === "Toán 5").subject_id).toBe(toanId);
    expect(all.find((c: any) => c.title === "Anh 5").subject_id).toBe("english");
    const only = (await (await C.GET(req("GET", `/api/teacher/courses?subject_id=${toanId}`))).json()).courses;
    expect(only.map((c: any) => c.title)).toEqual(["Toán 5"]);
  });

  it("courses: PUT đổi subject_id", async () => {
    const C = await import("@/app/api/teacher/courses/route");
    expect((await C.PUT(req("PUT", "/api/teacher/courses", { id: "coOld", title: "Khoá cũ", subject_id: toanId }))).status).toBe(200);
    expect((await rows(`SELECT subject_id FROM courses WHERE id='coOld'`))[0].subject_id).toBe(toanId);
    expect((await C.PUT(req("PUT", "/api/teacher/courses", { id: "coOld", title: "Khoá cũ", subject_id: otherId }))).status).toBe(400);
  });

  it("exams: POST nhận subject_id, GET trả + lọc; PUT đổi được", async () => {
    const E = await import("@/app/api/teacher/exams/route");
    const res = await E.POST(req("POST", "/api/teacher/exams", { title: "Đề Toán", duration_minutes: 20, question_ids: ["q1"], subject_id: toanId }));
    expect(res.status).toBeLessThan(300);
    const list = (await (await E.GET(req("GET", `/api/teacher/exams?subject_id=${toanId}`))).json()).exams;
    expect(list.map((e: any) => e.title)).toEqual(["Đề Toán"]);
    expect(list[0].subject_id).toBe(toanId);
    const all = (await (await E.GET(req("GET", "/api/teacher/exams"))).json()).exams;
    expect(all.find((e: any) => e.id === "eOld").subject_id).toBe("english");
    expect((await E.POST(req("POST", "/api/teacher/exams", { title: "Lén", duration_minutes: 20, question_ids: ["q1"], subject_id: otherId }))).status).toBe(400);
    const X = await import("@/app/api/teacher/exams/[id]/route");
    const put = await X.PUT(req("PUT", "/api/teacher/exams/eOld", { title: "Đề cũ", duration_minutes: 30, question_ids: ["q1"], subject_id: toanId }), ctx("eOld"));
    expect(put.status).toBe(200);
    expect((await rows(`SELECT subject_id FROM exams WHERE id='eOld'`))[0].subject_id).toBe(toanId);
  });

  it("lessons: POST nhận subject_id (thiếu → english), GET trả + lọc; PUT đổi được", async () => {
    const L = await import("@/app/api/teacher/lessons/route");
    const r1 = await L.POST(req("POST", "/api/teacher/lessons", { title: "Bài Toán 1", subject_id: toanId }));
    expect(r1.status).toBeLessThan(300);
    expect((await L.POST(req("POST", "/api/teacher/lessons", { title: "Lén", subject_id: otherId }))).status).toBe(400);
    const list = (await (await L.GET(req("GET", `/api/teacher/lessons?subject_id=${toanId}`))).json()).lessons;
    expect(list.map((l: any) => l.title)).toEqual(["Bài Toán 1"]);
    expect(list[0].subject_id).toBe(toanId);
    const LX = await import("@/app/api/teacher/lessons/[id]/route");
    expect((await LX.PUT(req("PUT", "/api/teacher/lessons/lOld", { subject_id: toanId }), ctx("lOld"))).status).toBe(200);
    expect((await rows(`SELECT subject_id FROM lessons WHERE id='lOld'`))[0].subject_id).toBe(toanId);
  });
});

describe("Giao diện", () => {
  const read = (p: string) => fs.readFileSync(p, "utf8");

  it("trang /teacher/subjects (client): gọi API, tạo / sửa / bật-tắt / xoá có xử lý 409, đủ trạng thái", () => {
    const s = read("app/teacher/subjects/page.tsx");
    expect(s.trimStart().startsWith('"use client"')).toBe(true);
    expect(s).toContain("/api/subjects");
    for (const m of ['"POST"', '"PUT"', '"DELETE"']) expect(s, m).toContain(m);
    expect(s).toMatch(/409/);
    expect(s).toMatch(/Chưa có môn học/);
    expect(s).toMatch(/Thử lại/);
    for (const bad of ['"@/lib/db-pg"', '"@/lib/subjects"']) expect(s).not.toContain(bad);
  });

  it("menu giáo viên có mục Môn Học; trang lộ trình chọn môn khi tạo/sửa khoá; kho đề/bài học lọc theo môn", () => {
    expect(read("components/TeacherLayout.tsx")).toMatch(/href:\s*"\/teacher\/subjects",\s*label:\s*"Môn Học"/);
    const tests = read("app/teacher/tests/page.tsx");
    expect(tests).toContain("/api/subjects");
    expect(tests).toContain("subject_id");
    for (const p of ["components/teacher/ExamLibraryPanel.tsx", "components/teacher/LessonLibraryPanel.tsx"]) {
      const s = read(p);
      expect(s, p).toContain("/api/subjects");
      expect(s, p).toMatch(/subject_id=/);
    }
  });
});
