// TASK-035 — Chuyển qua lại bài học ↔ đề thi (chọn nhiều) và nhân bản bài học / đề thi có đặt tên mới.
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
const req = (url: string, body?: unknown) =>
  new Request(`http://localhost${url}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
const ctx = (id: string) => ({ params: Promise.resolve({ id }) });
const rows = async (sql: string, p?: unknown[]) => (await h.pg.db.query(sql, p)).rows;

const convert = async (body: unknown) => (await import("@/app/api/teacher/library/convert/route")).POST(req("/api/teacher/library/convert", body));
const dupLesson = async (id: string, body: unknown) =>
  (await import("@/app/api/teacher/lessons/[id]/duplicate/route")).POST(req(`/api/teacher/lessons/${id}/duplicate`, body), ctx(id));
const dupExam = async (id: string, body: unknown) =>
  (await import("@/app/api/teacher/exams/[id]/duplicate/route")).POST(req(`/api/teacher/exams/${id}/duplicate`, body), ctx(id));

beforeEach(async () => {
  h.token = undefined;
  h.pg = await createFakePg(["db-migration-004-enrollments-assignments.sql"]);
  await h.pg.db.exec(`
    ALTER TABLE exams ADD COLUMN IF NOT EXISTS description TEXT;
    ALTER TABLE exams ADD COLUMN IF NOT EXISTS scoring_standard_id VARCHAR(50);
    CREATE TABLE courses (id VARCHAR(50) PRIMARY KEY, title VARCHAR(255) NOT NULL, description TEXT, created_by VARCHAR(50),
      default_scoring_standard_id VARCHAR(50), created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP);
    CREATE TABLE curriculum_items (id VARCHAR(50) PRIMARY KEY, course_id VARCHAR(50) NOT NULL, parent_id VARCHAR(50), title VARCHAR(255) NOT NULL,
      type VARCHAR(20) NOT NULL, exam_id VARCHAR(50), order_index INT DEFAULT 0, created_by VARCHAR(50), created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP);
  `);
  for (const m of ["db-migration-006-lessons.sql", "db-migration-007-question-owner.sql", "db-migration-012-subjects.sql"]) {
    await h.pg.db.exec(fs.readFileSync(`docs/${m}`, "utf8"));
  }
  await h.pg.db.exec(`
    INSERT INTO subjects (id,code,name,mode,owner_id) VALUES ('subj_toan','toan','Toán','SIMPLE','t1');
    INSERT INTO questions (id,skill,category,prompt,content,created_by) VALUES
      ('qa','Reading','READING_MC','Câu A','{"sub_questions":[{"id":"1","text":"?","correct_answer":"A"}]}','t1'),
      ('qb','Writing','WRITING_ESSAY','Câu B','{"min_words":50}','t1'),
      ('qc','Reading','READING_MC','Câu C','{"sub_questions":[]}','t2');
    INSERT INTO lessons (id,title,description,skills,question_ids,created_by,subject_id) VALUES
      ('lFree','Bài nhập nhầm','mô tả bài',ARRAY['Reading','Writing'],'["qa","qb"]','t1','subj_toan'),
      ('lUsed','Bài đang trong lộ trình','',ARRAY['Reading'],'["qa"]','t1','english'),
      ('lTried','Bài đã có lượt làm','',ARRAY['Reading'],'["qa"]','t1','english'),
      ('lOther','Bài của GV khác','',ARRAY['Reading'],'["qc"]','t2','english');
    INSERT INTO exams (id,title,description,duration_minutes,skills,question_ids,created_by,passing_score,scoring_standard_id,stimulus_type,stimulus_text,subject_id) VALUES
      ('eFree','Đề nhập nhầm','mô tả đề',45,ARRAY['Reading','Writing'],'["qb","qa"]','t1',6.5,'std_x','TEXT_ONLY',NULL,'subj_toan'),
      ('eStim','Đề có bài đọc chung','',30,ARRAY['Reading'],'["qa"]','t1',NULL,NULL,'TEXT_ONLY','Đoạn văn dùng chung cho cả đề','english'),
      ('eUsed','Đề đã giao lớp','',30,ARRAY['Reading'],'["qa"]','t1',NULL,NULL,'TEXT_ONLY',NULL,'english'),
      ('eOther','Đề của GV khác','',30,ARRAY['Reading'],'["qc"]','t2',NULL,NULL,'TEXT_ONLY',NULL,'english');
    INSERT INTO courses (id,title,created_by) VALUES ('co1','Khoá','t1');
    INSERT INTO curriculum_items (id,course_id,title,type,lesson_id) VALUES ('ci1','co1','x','LESSON','lUsed');
    INSERT INTO classes (id,name,code,teacher_id) VALUES ('c1','Lớp','AAA','t1');
    INSERT INTO class_assignments (id,class_id,exam_id) VALUES ('as1','c1','eUsed');
  `);
  await h.pg.db.exec(`INSERT INTO lesson_attempts (id,lesson_id,class_id,student_id) VALUES ('la1','lTried','c1','s1')`);
});

describe("POST /api/teacher/library/convert — phân quyền & kiểm tra đầu vào", () => {
  it("chưa đăng nhập 401; STUDENT 403; không chạm DB", async () => {
    expect((await convert({ from: "lesson", ids: ["lFree"] })).status).toBe(401);
    await loginAs("STUDENT", "s1");
    expect((await convert({ from: "lesson", ids: ["lFree"] })).status).toBe(403);
    expect((await rows(`SELECT id FROM lessons WHERE id='lFree'`)).length).toBe(1);
  });

  it("from lạ / ids rỗng / quá 50 / không phải chuỗi / duration_minutes sai → 400", async () => {
    await loginAs("TEACHER", "t1");
    expect((await convert({ from: "video", ids: ["lFree"] })).status).toBe(400);
    expect((await convert({ from: "lesson", ids: [] })).status).toBe(400);
    expect((await convert({ from: "lesson", ids: Array.from({ length: 51 }, (_, i) => `x${i}`) })).status).toBe(400);
    expect((await convert({ from: "lesson", ids: [1, 2] })).status).toBe(400);
    expect((await convert({ from: "lesson", ids: ["lFree"], duration_minutes: 0 })).status).toBe(400);
    expect((await convert({ from: "lesson", ids: ["lFree"], duration_minutes: 2.5 })).status).toBe(400);
  });
});

describe("Chuyển bài học → đề thi", () => {
  it("bài học tự do → tạo đề cùng tiêu đề / mô tả / kỹ năng / câu hỏi (giữ thứ tự) / môn / người tạo, rồi xoá bài học", async () => {
    await loginAs("TEACHER", "t1");
    const res = await convert({ from: "lesson", ids: ["lFree"], duration_minutes: 40 });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.results).toHaveLength(1);
    const r = json.results[0];
    expect(r).toMatchObject({ id: "lFree", ok: true });
    expect(typeof r.new_id).toBe("string");
    const [exam] = await rows(`SELECT * FROM exams WHERE id=$1`, [r.new_id]);
    expect(exam).toMatchObject({ title: "Bài nhập nhầm", description: "mô tả bài", duration_minutes: 40, created_by: "t1", subject_id: "subj_toan" });
    expect(exam.skills).toEqual(["Reading", "Writing"]);
    expect(exam.question_ids).toEqual(["qa", "qb"]);
    expect(await rows(`SELECT id FROM lessons WHERE id='lFree'`)).toEqual([]);
    // câu hỏi không bị nhân bản / xoá khi chuyển
    expect((await rows(`SELECT COUNT(*)::int n FROM questions`))[0].n).toBe(3);
  });

  it("không gửi duration_minutes → đề mặc định 30 phút", async () => {
    await loginAs("TEACHER", "t1");
    const json = await (await convert({ from: "lesson", ids: ["lFree"] })).json();
    expect((await rows(`SELECT duration_minutes FROM exams WHERE id=$1`, [json.results[0].new_id]))[0].duration_minutes).toBe(30);
  });

  it("chọn nhiều: mục hợp lệ được chuyển, mục bị chặn trả lý do và giữ nguyên", async () => {
    await loginAs("TEACHER", "t1");
    const json = await (await convert({ from: "lesson", ids: ["lFree", "lUsed", "lTried", "lOther", "nope"] })).json();
    const by = Object.fromEntries(json.results.map((r: any) => [r.id, r]));
    expect(by.lFree.ok).toBe(true);
    expect(by.lUsed).toMatchObject({ ok: false, reason: "IN_USE" });
    expect(by.lUsed.usages).toMatchObject({ curriculum: 1 });
    expect(by.lTried).toMatchObject({ ok: false, reason: "IN_USE" });
    expect(by.lTried.usages).toMatchObject({ attempts: 1 });
    expect(by.lOther).toMatchObject({ ok: false, reason: "FORBIDDEN" });
    expect(by.nope).toMatchObject({ ok: false, reason: "NOT_FOUND" });
    expect((await rows(`SELECT id FROM lessons ORDER BY id`)).map((r: any) => r.id)).toEqual(["lOther", "lTried", "lUsed"]);
  });

  it("ADMIN chuyển được bài của giáo viên bất kỳ; đề mới giữ người tạo gốc", async () => {
    await loginAs("ADMIN", "a1");
    const json = await (await convert({ from: "lesson", ids: ["lOther"] })).json();
    expect(json.results[0].ok).toBe(true);
    expect((await rows(`SELECT created_by FROM exams WHERE id=$1`, [json.results[0].new_id]))[0].created_by).toBe("t2");
  });
});

describe("Chuyển đề thi → bài học", () => {
  it("đề tự do → tạo bài học cùng tiêu đề / mô tả / kỹ năng / câu hỏi / môn / người tạo, rồi xoá đề", async () => {
    await loginAs("TEACHER", "t1");
    const json = await (await convert({ from: "exam", ids: ["eFree"] })).json();
    const r = json.results[0];
    expect(r).toMatchObject({ id: "eFree", ok: true });
    const [lesson] = await rows(`SELECT * FROM lessons WHERE id=$1`, [r.new_id]);
    expect(lesson).toMatchObject({ title: "Đề nhập nhầm", description: "mô tả đề", created_by: "t1", subject_id: "subj_toan" });
    expect(lesson.skills).toEqual(["Reading", "Writing"]);
    expect(lesson.question_ids).toEqual(["qb", "qa"]);
    expect(String(r.new_id).startsWith("lsn_")).toBe(true);
    expect(await rows(`SELECT id FROM exams WHERE id='eFree'`)).toEqual([]);
  });

  it("đề đã giao lớp / có bài đọc chung / của GV khác → bị chặn đúng lý do, giữ nguyên", async () => {
    await loginAs("TEACHER", "t1");
    const json = await (await convert({ from: "exam", ids: ["eUsed", "eStim", "eOther"] })).json();
    const by = Object.fromEntries(json.results.map((r: any) => [r.id, r]));
    expect(by.eUsed).toMatchObject({ ok: false, reason: "IN_USE" });
    expect(by.eUsed.usages).toMatchObject({ assignments: 1 });
    expect(by.eStim).toMatchObject({ ok: false, reason: "HAS_STIMULUS" });
    expect(by.eOther).toMatchObject({ ok: false, reason: "FORBIDDEN" });
    expect((await rows(`SELECT COUNT(*)::int n FROM exams`))[0].n).toBe(4);
    expect((await rows(`SELECT COUNT(*)::int n FROM lessons`))[0].n).toBe(4);
  });

  it("đề đã có bài nộp → IN_USE (usages.submissions)", async () => {
    await h.pg.db.exec(`INSERT INTO submissions (id,exam_id,student_id,answers) VALUES ('sb1','eFree','s1','{}')`);
    await loginAs("TEACHER", "t1");
    const r = (await (await convert({ from: "exam", ids: ["eFree"] })).json()).results[0];
    expect(r).toMatchObject({ ok: false, reason: "IN_USE" });
    expect(r.usages).toMatchObject({ submissions: 1 });
  });
});

describe("Nhân bản bài học", () => {
  it("chưa đăng nhập 401; STUDENT 403; không có 404; bài của GV khác 403; tên rỗng / > 255 → 400", async () => {
    expect((await dupLesson("lFree", { title: "X" })).status).toBe(401);
    await loginAs("STUDENT", "s1");
    expect((await dupLesson("lFree", { title: "X" })).status).toBe(403);
    await loginAs("TEACHER", "t1");
    expect((await dupLesson("nope", { title: "X" })).status).toBe(404);
    expect((await dupLesson("lOther", { title: "X" })).status).toBe(403);
    expect((await dupLesson("lFree", { title: "   " })).status).toBe(400);
    expect((await dupLesson("lFree", {})).status).toBe(400);
    expect((await dupLesson("lFree", { title: "x".repeat(256) })).status).toBe(400);
  });

  it("tạo bài mới với tên mới, sao chép SÂU câu hỏi (id mới, cùng nội dung, giữ thứ tự); bản gốc không đổi", async () => {
    await loginAs("TEACHER", "t1");
    const res = await dupLesson("lFree", { title: "  Bài nhập nhầm — lớp 5B  " });
    expect(res.status).toBe(201);
    const { lesson } = await res.json();
    expect(lesson.id).not.toBe("lFree");
    expect(lesson.title).toBe("Bài nhập nhầm — lớp 5B");
    const [copy] = await rows(`SELECT * FROM lessons WHERE id=$1`, [lesson.id]);
    expect(copy).toMatchObject({ description: "mô tả bài", created_by: "t1", subject_id: "subj_toan" });
    expect(copy.skills).toEqual(["Reading", "Writing"]);
    expect(copy.question_ids).toHaveLength(2);
    expect(copy.question_ids).not.toContain("qa");
    expect(copy.question_ids).not.toContain("qb");
    const copied = await rows(`SELECT id, skill, category, prompt, content, created_by FROM questions WHERE id = ANY($1)`, [copy.question_ids]);
    const byId = Object.fromEntries(copied.map((q: any) => [q.id, q]));
    expect(byId[copy.question_ids[0]]).toMatchObject({ skill: "Reading", category: "READING_MC", prompt: "Câu A", created_by: "t1" });
    expect(byId[copy.question_ids[1]]).toMatchObject({ skill: "Writing", category: "WRITING_ESSAY", prompt: "Câu B" });
    expect(byId[copy.question_ids[0]].content).toEqual({ sub_questions: [{ id: "1", text: "?", correct_answer: "A" }] });
    const [orig] = await rows(`SELECT title, question_ids FROM lessons WHERE id='lFree'`);
    expect(orig).toEqual({ title: "Bài nhập nhầm", question_ids: ["qa", "qb"] });
    expect((await rows(`SELECT COUNT(*)::int n FROM questions`))[0].n).toBe(5);
  });

  it("bài đang trong lộ trình vẫn nhân bản được; bản sao không nằm trong lộ trình", async () => {
    await loginAs("TEACHER", "t1");
    const { lesson } = await (await dupLesson("lUsed", { title: "Bản sao" })).json();
    expect(await rows(`SELECT id FROM curriculum_items WHERE lesson_id=$1`, [lesson.id])).toEqual([]);
  });

  it("ADMIN nhân bản bài của giáo viên khác → bản sao thuộc ADMIN", async () => {
    await loginAs("ADMIN", "a1");
    const { lesson } = await (await dupLesson("lOther", { title: "Bản của admin" })).json();
    expect((await rows(`SELECT created_by FROM lessons WHERE id=$1`, [lesson.id]))[0].created_by).toBe("a1");
  });
});

describe("Nhân bản đề thi", () => {
  it("phân quyền / kiểm tra tên như bài học", async () => {
    expect((await dupExam("eFree", { title: "X" })).status).toBe(401);
    await loginAs("STUDENT", "s1");
    expect((await dupExam("eFree", { title: "X" })).status).toBe(403);
    await loginAs("TEACHER", "t1");
    expect((await dupExam("nope", { title: "X" })).status).toBe(404);
    expect((await dupExam("eOther", { title: "X" })).status).toBe(403);
    expect((await dupExam("eFree", { title: "" })).status).toBe(400);
  });

  it("sao chép đủ thuộc tính đề (thời gian, điểm đạt, chuẩn chấm, ngữ cảnh, môn) + câu hỏi sâu; không mang theo giao lớp / bài nộp", async () => {
    await loginAs("TEACHER", "t1");
    const res = await dupExam("eFree", { title: "Đề nhập nhầm (bản sao)" });
    expect(res.status).toBe(201);
    const { exam } = await res.json();
    const [copy] = await rows(`SELECT * FROM exams WHERE id=$1`, [exam.id]);
    expect(copy).toMatchObject({
      title: "Đề nhập nhầm (bản sao)", description: "mô tả đề", duration_minutes: 45, created_by: "t1",
      scoring_standard_id: "std_x", stimulus_type: "TEXT_ONLY", subject_id: "subj_toan",
    });
    expect(Number(copy.passing_score)).toBe(6.5);
    expect(copy.question_ids).toHaveLength(2);
    expect(copy.question_ids).not.toContain("qa");
    const prompts = await rows(`SELECT prompt FROM questions WHERE id = ANY($1)`, [copy.question_ids]);
    expect(prompts.map((p: any) => p.prompt).sort()).toEqual(["Câu A", "Câu B"]);
    expect(await rows(`SELECT id FROM class_assignments WHERE exam_id=$1`, [exam.id])).toEqual([]);
  });

  it("đề có bài đọc chung → bản sao giữ nguyên stimulus_text", async () => {
    await loginAs("TEACHER", "t1");
    const { exam } = await (await dupExam("eStim", { title: "Bản sao bài đọc" })).json();
    expect((await rows(`SELECT stimulus_text FROM exams WHERE id=$1`, [exam.id]))[0].stimulus_text).toBe("Đoạn văn dùng chung cho cả đề");
  });
});

describe("Giao diện Kho Bài Học & Đề Thi", () => {
  const read = (p: string) => fs.readFileSync(p, "utf8");

  it("ExamLibraryPanel: chọn nhiều, chuyển sang bài học, nhân bản có popup đặt tên", () => {
    const s = read("components/teacher/ExamLibraryPanel.tsx");
    expect(s).toContain("/api/teacher/library/convert");
    expect(s).toMatch(/from:\s*"exam"/);
    expect(s).toMatch(/type="checkbox"/);
    expect(s).toMatch(/Chuyển sang Bài học/);
    expect(s).toMatch(/\/duplicate/);
    expect(s).toMatch(/Nhân bản/);
    expect(s).toMatch(/\(bản sao\)/);
    expect(s).toMatch(/HAS_STIMULUS|bài đọc chung/);
  });

  it("LessonLibraryPanel: chọn nhiều, chuyển sang đề thi, nhân bản có popup đặt tên", () => {
    const s = read("components/teacher/LessonLibraryPanel.tsx");
    expect(s).toContain("/api/teacher/library/convert");
    expect(s).toMatch(/from:\s*"lesson"/);
    expect(s).toMatch(/type="checkbox"/);
    expect(s).toMatch(/Chuyển sang Đề thi/);
    expect(s).toMatch(/\/duplicate/);
    expect(s).toMatch(/Nhân bản/);
    expect(s).toMatch(/\(bản sao\)/);
  });

  it("popup nhân bản dùng chung một component client, không import module server", () => {
    const s = read("components/teacher/DuplicateDialog.tsx");
    expect(s.trimStart().startsWith('"use client"')).toBe(true);
    for (const bad of ['"@/lib/db-pg"', '"@/lib/auth"']) expect(s).not.toContain(bad);
    expect(read("components/teacher/ExamLibraryPanel.tsx")).toContain("DuplicateDialog");
    expect(read("components/teacher/LessonLibraryPanel.tsx")).toContain("DuplicateDialog");
  });
});
