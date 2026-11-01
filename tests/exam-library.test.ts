// TASK-031 — Gom "Kho Bài Học & Đề Thi" (2 tab) + kho đề: danh sách giàu thông tin, xoá đề an toàn;
// đổi menu "Quản Lý Đề Thi" → "Quản Lý Lộ Trình & Khóa Học". File do trưởng phòng viết, bị khoá.
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

async function loginAs(role: "ADMIN" | "TEACHER" | "STUDENT" | null, userId?: string) {
  h.token = role ? await signJwtToken({ userId: userId!, email: `${userId}@x.vn`, role }) : undefined;
}
const req = (method: string, url: string) => new Request(`http://localhost${url}`, { method });
const ctx = (id: string) => ({ params: Promise.resolve({ id }) });
const rows = async (sql: string) => (await h.pg.db.query(sql)).rows;
const list = async (qs = "") => (await import("@/app/api/teacher/exams/route")).GET(req("GET", `/api/teacher/exams${qs}`));
const del = async (id: string) => (await import("@/app/api/teacher/exams/[id]/route")).DELETE(req("DELETE", `/api/teacher/exams/${id}`), ctx(id));

beforeEach(async () => {
  h.token = undefined;
  h.pg = await createFakePg(["db-migration-004-enrollments-assignments.sql"]);
  await h.pg.db.exec(`
    ALTER TABLE exams ADD COLUMN IF NOT EXISTS description TEXT;
    CREATE TABLE curriculum_items (id VARCHAR(50) PRIMARY KEY, course_id VARCHAR(50) NOT NULL, parent_id VARCHAR(50), title VARCHAR(255) NOT NULL,
      type VARCHAR(20) NOT NULL, exam_id VARCHAR(50), order_index INT DEFAULT 0, created_by VARCHAR(50));
    INSERT INTO exams (id,title,duration_minutes,skills,question_ids,created_by,created_at) VALUES
      ('eA','Starters Reading 1',30,ARRAY['Reading'],'["q1","q2","q3"]','t1', NOW() - INTERVAL '2 day'),
      ('eB','Movers Listening',20,ARRAY['Listening','Reading'],'["q4"]','t1', NOW() - INTERVAL '1 day'),
      ('eC','Đề của GV khác',45,ARRAY['Writing'],'["q5"]','t2', NOW()),
      ('eFree','Đề trống',60,NULL,NULL,'t1', NOW() - INTERVAL '3 day');
    INSERT INTO curriculum_items (id,course_id,title,type,exam_id) VALUES ('ci1','co1','x','EXAM','eA'), ('ci2','co2','y','EXAM','eA');
    INSERT INTO classes (id,name,code,teacher_id) VALUES ('c1','Lớp','AAA','t1');
    INSERT INTO class_assignments (id,class_id,exam_id) VALUES ('as1','c1','eB');
    INSERT INTO submissions (id,exam_id,student_id,answers) VALUES ('sub1','eC','s1','{}');
  `);
});

describe("GET /api/teacher/exams — danh sách cho kho đề", () => {
  it("giữ trường cũ + thêm skills, duration_minutes, question_count, usage_count (số mục lộ trình dùng đề)", async () => {
    await loginAs("TEACHER", "t1");
    const json = await (await list()).json();
    expect(json.success).toBe(true);
    const a = json.exams.find((e: any) => e.id === "eA");
    expect(a).toMatchObject({ id: "eA", title: "Starters Reading 1", created_by: "t1", skills: ["Reading"], duration_minutes: 30, question_count: 3, usage_count: 2 });
    expect(a.created_at).toBeTruthy();
    const f = json.exams.find((e: any) => e.id === "eFree");
    expect(f).toMatchObject({ skills: [], question_count: 0, usage_count: 0 });
    expect(json.exams.map((e: any) => e.id)).not.toContain("eC");
  });

  it("?q= tìm theo tên (không phân biệt hoa thường); ADMIN thấy tất cả", async () => {
    await loginAs("TEACHER", "t1");
    expect((await (await list("?q=movers")).json()).exams.map((e: any) => e.id)).toEqual(["eB"]);
    await loginAs("ADMIN", "a1");
    expect((await (await list()).json()).exams).toHaveLength(4);
  });
});

describe("DELETE /api/teacher/exams/[id]", () => {
  it("chưa đăng nhập 401; STUDENT 403; không có 404; đề của GV khác 403", async () => {
    expect((await del("eFree")).status).toBe(401);
    await loginAs("STUDENT", "s1");
    expect((await del("eFree")).status).toBe(403);
    await loginAs("TEACHER", "t1");
    expect((await del("nope")).status).toBe(404);
    expect((await del("eC")).status).toBe(403);
  });

  it("đề đang dùng trong lộ trình / giao cho lớp / đã có bài nộp → 409 kèm usages, không xoá", async () => {
    await loginAs("TEACHER", "t1");
    const r1 = await del("eA");
    expect(r1.status).toBe(409);
    expect((await r1.json()).usages).toMatchObject({ curriculum: 2 });
    const r2 = await del("eB");
    expect(r2.status).toBe(409);
    expect((await r2.json()).usages).toMatchObject({ assignments: 1 });
    await loginAs("ADMIN", "a1");
    const r3 = await del("eC");
    expect(r3.status).toBe(409);
    expect((await r3.json()).usages).toMatchObject({ submissions: 1 });
    expect((await rows(`SELECT COUNT(*)::int n FROM exams`))[0].n).toBe(4);
  });

  it("đề chưa dùng ở đâu → 200 và xoá khỏi DB", async () => {
    await loginAs("TEACHER", "t1");
    const res = await del("eFree");
    expect(res.status).toBe(200);
    expect((await res.json()).success).toBe(true);
    expect(await rows(`SELECT id FROM exams WHERE id='eFree'`)).toEqual([]);
  });
});

const read = (p: string) => fs.readFileSync(p, "utf8");

describe("Trang Kho Bài Học & Đề Thi — app/teacher/library/page.tsx", () => {
  it("2 tab Bài học / Đề thi, chọn theo ?tab=, dùng 2 panel", () => {
    const s = read("app/teacher/library/page.tsx");
    expect(s).toMatch(/useSearchParams/);
    expect(s).toMatch(/tab/);
    expect(s).toContain("@/components/teacher/LessonLibraryPanel");
    expect(s).toContain("@/components/teacher/ExamLibraryPanel");
    expect(s).toMatch(/Bài học/);
    expect(s).toMatch(/Đề thi/);
    expect(s).toMatch(/Kho Bài Học & Đề Thi/);
  });

  it("ExamLibraryPanel: gọi API, tìm kiếm, tạo/sửa đề, xoá có xử lý 409, trạng thái rỗng/lỗi", () => {
    const s = read("components/teacher/ExamLibraryPanel.tsx");
    expect(s.trimStart().startsWith('"use client"')).toBe(true);
    expect(s).toContain("/api/teacher/exams");
    expect(s).toMatch(/[?&]q=/);
    expect(s).toContain("/teacher/tests/create?editId=");
    expect(s).toContain('"/teacher/tests/create"');
    expect(s).toMatch(/method:\s*"DELETE"/);
    expect(s).toMatch(/409/);
    expect(s).toMatch(/question_count/);
    expect(s).toMatch(/usage_count/);
    expect(s).toMatch(/Chưa có đề thi/);
    expect(s).toMatch(/Thử lại/);
    for (const bad of ['"@/lib/db-pg"', '"@/lib/supabase"', '"@/lib/mock-data"']) expect(s).not.toContain(bad);
  });

  it("LessonLibraryPanel giữ chức năng kho bài học cũ; /teacher/lessons chuyển hướng sang tab bài học", () => {
    const p = read("components/teacher/LessonLibraryPanel.tsx");
    expect(p).toContain("/api/teacher/lessons");
    expect(p).toContain("/teacher/lessons/new");
    expect(read("app/teacher/lessons/page.tsx")).toContain("/teacher/library?tab=lessons");
    expect(read("app/teacher/lessons/[id]/page.tsx")).toContain("/teacher/library?tab=lessons");
  });
});

describe("Menu giáo viên — components/TeacherLayout.tsx", () => {
  const s = () => read("components/TeacherLayout.tsx");
  it("một mục 'Kho Bài Học & Đề Thi' (/teacher/library) và 'Quản Lý Lộ Trình & Khóa Học' (/teacher/tests); bỏ mục tạo đề và kho bài học riêng", () => {
    expect(s()).toMatch(/href:\s*"\/teacher\/library",\s*label:\s*"Kho Bài Học & Đề Thi"/);
    expect(s()).toMatch(/href:\s*"\/teacher\/tests",\s*label:\s*"Quản Lý Lộ Trình & Khóa Học"/);
    expect(s()).not.toMatch(/label:\s*"Soạn & Tạo Đề Thi"/);
    expect(s()).not.toMatch(/label:\s*"Kho Bài Học"\s*[,}]/);
    expect(s()).not.toMatch(/label:\s*"Quản Lý Đề Thi"/);
  });
  it("mục kho sáng khi ở /teacher/library, /teacher/lessons/*, /teacher/tests/create", () => {
    for (const p of ['"/teacher/lessons"', '"/teacher/tests/create"']) expect(s(), p).toContain(p);
  });
  it("tiêu đề trang lộ trình đổi theo menu", () => {
    expect(read("app/teacher/tests/page.tsx")).toContain("Quản Lý Lộ Trình & Khóa Học");
  });
});
