// TASK-016 — Xem trước bài học như học sinh (SCR-L3): nội dung đã ẩn đáp án + chấm thử không lưu.
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
  ensureSchema: async () => {},
}));

import { signJwtToken } from "@/lib/jwt";

async function loginAs(role: "ADMIN" | "TEACHER" | "STUDENT" | null, userId?: string) {
  h.token = role ? await signJwtToken({ userId: userId!, email: `${userId}@x.vn`, role }) : undefined;
}
const req = (method: string, body?: unknown) =>
  new Request("http://localhost/x", { method, headers: { "Content-Type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) });
const ctx = (id: string) => ({ params: Promise.resolve({ id }) });
const api = () => import("@/app/api/teacher/lessons/[id]/preview/route");

beforeEach(async () => {
  h.token = undefined;
  h.pg = await createFakePg();
  await h.pg.db.exec(`
    CREATE TABLE lessons (id VARCHAR(50) PRIMARY KEY, title VARCHAR(255), description TEXT, skills TEXT[] DEFAULT '{}', question_ids JSONB DEFAULT '[]', created_by VARCHAR(50));
    CREATE TABLE lesson_attempts (id VARCHAR(50) PRIMARY KEY);
    INSERT INTO questions (id,skill,category,prompt,content) VALUES
      ('qMC','Reading','READING_MC','P','{"sub_questions":[{"id":"s1","text":"?","option_a":"a","option_b":"b","option_c":"c","option_d":"d","correct_answer":"B"}]}'),
      ('qE','Writing','WRITING_ESSAY','Viết','{"min_words":10}'),
      ('qF','Reading','READING_FLASHCARD_SET','Thẻ','{"flashcard_ids":["f1"]}');
    INSERT INTO flashcards (id,vietnamese_name,correct_english_word,options) VALUES ('f1','táo','apple','["pear","apple"]');
    INSERT INTO lessons (id,title,description,question_ids,created_by) VALUES
      ('l1','Bài 1','Mô tả','["qMC","qE","qF"]','t1'), ('l2','Bài t2',NULL,'["qMC"]','t2');
  `);
});

describe("GET /api/teacher/lessons/[id]/preview — nội dung giống học sinh thấy", () => {
  it("chưa đăng nhập 401; STUDENT 403; bài của GV khác 403; không có 404", async () => {
    const { GET } = await api();
    expect((await GET(req("GET"), ctx("l1"))).status).toBe(401);
    await loginAs("STUDENT", "s1");
    expect((await GET(req("GET"), ctx("l1"))).status).toBe(403);
    await loginAs("TEACHER", "t1");
    expect((await GET(req("GET"), ctx("l2"))).status).toBe(403);
    expect((await GET(req("GET"), ctx("lX"))).status).toBe(404);
  });

  it("câu hỏi đúng thứ tự, đã ẩn đáp án; flashcard đã ẩn từ đúng", async () => {
    await loginAs("TEACHER", "t1");
    const json = await (await (await api()).GET(req("GET"), ctx("l1"))).json();
    expect(json.lesson).toEqual({ id: "l1", title: "Bài 1", description: "Mô tả" });
    expect(json.questions.map((q: any) => q.id)).toEqual(["qMC", "qE", "qF"]);
    const text = JSON.stringify(json);
    expect(text).not.toContain("correct_answer");
    expect(text).not.toContain("correct_english_word");
    expect(json.flashcards[0].options).toEqual(["apple", "pear"]);
  });
});

describe("POST /api/teacher/lessons/[id]/preview — chấm thử, KHÔNG lưu", () => {
  it("trả kết quả từng câu kèm đáp án + điểm khách quan; câu AI chỉ đánh dấu; không ghi lesson_attempts", async () => {
    await loginAs("TEACHER", "t1");
    const res = await (await api()).POST(req("POST", { answers: { qMC: { s1: "b" }, qE: "essay", qF: { f1: "pear" } } }), ctx("l1"));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.objective_earned).toBe(1);
    expect(json.objective_max).toBe(2);
    expect(json.ai_max).toBe(1);
    expect(json.score_percent).toBe(50);
    expect(json.results.find((r: any) => r.question_id === "qF").items[0]).toMatchObject({ correct: false, expected: "apple" });
    expect(json.results.find((r: any) => r.question_id === "qE").kind).toBe("AI");
    expect((await h.pg.db.query("SELECT COUNT(*)::int n FROM lesson_attempts")).rows[0].n).toBe(0);
  });

  it("answers không phải object → 400; bài của GV khác → 403", async () => {
    await loginAs("TEACHER", "t1");
    const { POST } = await api();
    expect((await POST(req("POST", { answers: [] }), ctx("l1"))).status).toBe(400);
    expect((await POST(req("POST", { answers: {} }), ctx("l2"))).status).toBe(403);
  });
});

describe("Nút Xem trước trong trang soạn bài", () => {
  it("app/teacher/lessons/[id]/page.tsx dùng LessonPlayer và gọi /preview", () => {
    // Modal tách thành component dùng chung (bài học + đề thi): components/teacher/StudentPreviewModal.tsx
    const s = fs.readFileSync("app/teacher/lessons/[id]/page.tsx", "utf8");
    expect(s).toContain("@/components/teacher/StudentPreviewModal");
    const m = fs.readFileSync("components/teacher/StudentPreviewModal.tsx", "utf8");
    expect(m).toContain("@/components/lesson-player/LessonPlayer");
    expect(m).toContain("/preview");
    expect(m).toMatch(/Xem trước/);
  });
});
