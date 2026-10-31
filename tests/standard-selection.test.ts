// TASK-021 — Chọn chuẩn chấm cho đề (SCR-E2) và chuẩn mặc định của khóa (SCR-E3) (FEAT-011 DEC-014).
// File do trưởng phòng viết, bị khoá.
import { describe, it, expect, vi, beforeEach } from "vitest";
import fs from "fs";
import { createFakePg } from "./helpers/pg-fake";

const h = vi.hoisted(() => {
  process.env.JWT_SECRET = "test_secret_for_vitest_only_0123456789abcdef";
  return { token: undefined as string | undefined, pg: null as any };
});
vi.mock("next/headers", () => ({
  cookies: async () => ({ get: (n: string) => (n === "auth_token" && h.token ? { value: h.token } : undefined), set: () => {} }),
}));
vi.mock("@/lib/db-pg", () => ({
  queryPg: (sql: string, params?: unknown[]) => h.pg.queryPg(sql, params),
  getPgPool: () => ({ connect: async () => ({ query: (s: string, p?: unknown[]) => h.pg.queryPg(s, p), release: () => {} }) }),
  ensureSchema: async () => {},
}));
vi.mock("@/lib/neo4j", () => ({ runCypherQuery: async () => [], syncCourseExam: async () => {}, getExamCourseMapping: async () => [] }));
vi.mock("@/lib/redis-queue", () => ({ pushRedisStreamEvent: async () => {}, pushGradingEvent: async () => {} }));

import { signJwtToken } from "@/lib/jwt";
async function loginAs(role: "ADMIN" | "TEACHER" | null, userId?: string) {
  h.token = role ? await signJwtToken({ userId: userId!, email: `${userId}@x.vn`, role }) : undefined;
}
const req = (method: string, body?: unknown) =>
  new Request("http://localhost/x", { method, headers: { "Content-Type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) });
const rows = async (sql: string) => (await h.pg.db.query(sql)).rows;

beforeEach(async () => {
  h.token = undefined;
  h.pg = await createFakePg(["db-migration-007-question-owner.sql"]);
  await h.pg.db.exec(`
    ALTER TABLE exams ADD COLUMN IF NOT EXISTS description TEXT;
    CREATE TABLE courses (id VARCHAR(50) PRIMARY KEY, title VARCHAR(255), description TEXT, created_by VARCHAR(50), created_at TIMESTAMPTZ DEFAULT NOW());
    CREATE TABLE lessons (id VARCHAR(50) PRIMARY KEY, question_ids JSONB DEFAULT '[]', created_by VARCHAR(50));
    CREATE TABLE curriculum_items (id VARCHAR(50) PRIMARY KEY, course_id VARCHAR(50), exam_id VARCHAR(50));
  `);
  await h.pg.db.exec(fs.readFileSync("docs/db-migration-009-scoring-standards.sql", "utf8"));
  await h.pg.db.exec(`
    INSERT INTO courses (id,title,created_by) VALUES ('co1','Khóa t1','t1');
    INSERT INTO questions (id,skill,category,prompt,content,created_by) VALUES ('q1','Reading','READING_MC','P','{"sub_questions":[]}','t1');
    INSERT INTO exams (id,title,question_ids,created_by) VALUES ('e1','Đề','["q1"]','t1');
  `);
});

describe("API đề thi nhận scoring_standard_id", () => {
  it("POST với chuẩn hợp lệ → lưu; chuẩn không tồn tại → 400", async () => {
    await loginAs("TEACHER", "t1");
    const { POST } = await import("@/app/api/teacher/exams/route");
    const res = await POST(req("POST", { title: "Đề IELTS", question_ids: ["q1"], scoring_standard_id: "std_ielts" }));
    expect(res.status).toBe(201);
    expect((await res.json()).exam.scoring_standard_id).toBe("std_ielts");
    expect((await POST(req("POST", { title: "x", question_ids: ["q1"], scoring_standard_id: "std_none" }))).status).toBe(400);
  });
  it("PUT đổi chuẩn và bỏ chuẩn (null); GET trả scoring_standard_id", async () => {
    await loginAs("TEACHER", "t1");
    const api = await import("@/app/api/teacher/exams/[id]/route");
    const ctx = { params: Promise.resolve({ id: "e1" }) };
    expect((await api.PUT(req("PUT", { scoring_standard_id: "std_hsk1" }), ctx)).status).toBe(200);
    expect((await rows(`SELECT scoring_standard_id FROM exams WHERE id='e1'`))[0].scoring_standard_id).toBe("std_hsk1");
    expect((await (await api.GET(req("GET"), ctx)).json()).exam.scoring_standard_id).toBe("std_hsk1");
    await api.PUT(req("PUT", { scoring_standard_id: null }), ctx);
    expect((await rows(`SELECT scoring_standard_id FROM exams WHERE id='e1'`))[0].scoring_standard_id).toBeNull();
    expect((await api.PUT(req("PUT", { scoring_standard_id: "std_none" }), ctx)).status).toBe(400);
  });
});

describe("API khóa học nhận default_scoring_standard_id", () => {
  it("POST/PUT lưu chuẩn mặc định; chuẩn không tồn tại → 400; GET trả trường", async () => {
    await loginAs("TEACHER", "t1");
    const api = await import("@/app/api/teacher/courses/route");
    const created = await api.POST(req("POST", { title: "Khóa HSK", default_scoring_standard_id: "std_hsk1" }));
    expect([200, 201]).toContain(created.status);
    expect((await rows(`SELECT default_scoring_standard_id FROM courses WHERE title='Khóa HSK'`))[0].default_scoring_standard_id).toBe("std_hsk1");
    expect((await api.POST(req("POST", { title: "x", default_scoring_standard_id: "std_none" }))).status).toBe(400);
    expect((await api.PUT(req("PUT", { id: "co1", title: "Khóa t1", default_scoring_standard_id: "std_ielts" }))).status).toBe(200);
    expect((await rows(`SELECT default_scoring_standard_id FROM courses WHERE id='co1'`))[0].default_scoring_standard_id).toBe("std_ielts");
    const list = await (await api.GET(req("GET"))).json();
    expect(JSON.stringify(list)).toContain("default_scoring_standard_id");
  });
});

describe("Giao diện chọn chuẩn", () => {
  it("QuestionSetEditor (mode EXAM) có select chuẩn chấm từ /api/scoring-standards và gửi scoring_standard_id", () => {
    const s = fs.readFileSync("components/question-builder/QuestionSetEditor.tsx", "utf8");
    expect(s).toContain("/api/scoring-standards");
    expect(s).toContain("scoring_standard_id");
  });
  it("trang tạo đề truyền scoring_standard_id khi lưu/tải", () => {
    expect(fs.readFileSync("app/teacher/tests/create/page.tsx", "utf8")).toContain("scoring_standard_id");
  });
  it("modal khóa học ở /teacher/tests có chuẩn mặc định", () => {
    const s = fs.readFileSync("app/teacher/tests/page.tsx", "utf8");
    expect(s).toContain("/api/scoring-standards");
    expect(s).toContain("default_scoring_standard_id");
  });
});
