// TASK-011 — API học sinh: lộ trình lớp, nội dung bài (ẩn đáp án), nộp bài, chấm AI nền (FEAT-010 BR-L04…L12, TC-L06/L07/L08/L10).
// File do trưởng phòng viết, bị khoá.
import { describe, it, expect, vi, beforeEach } from "vitest";
import fs from "fs";
import { createFakePg } from "./helpers/pg-fake";

const h = vi.hoisted(() => {
  process.env.JWT_SECRET = "test_secret_for_vitest_only_0123456789abcdef";
  process.env.INTERNAL_API_TOKEN = "internal_test_token_xyz";
  return {
    token: undefined as string | undefined,
    pg: null as null | Awaited<ReturnType<typeof import("./helpers/pg-fake").createFakePg>>,
    events: [] as any[],
    aiCalls: [] as any[],
    aiBand: 6.3 as number | Error,
  };
});

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (n: string) => (n === "auth_token" && h.token ? { value: h.token } : undefined),
    set: () => {},
  }),
}));
vi.mock("@/lib/db-pg", () => ({
  queryPg: (sql: string, params?: unknown[]) => h.pg!.queryPg(sql, params),
  getPgPool: () => ({
    connect: async () => ({ query: (sql: string, params?: unknown[]) => h.pg!.queryPg(sql, params), release: () => {} }),
  }),
  ensureSchema: async () => {},
}));
vi.mock("@/lib/redis-queue", () => ({
  pushRedisStreamEvent: async (...a: any[]) => { h.events.push(a); },
  pushGradingEvent: async () => {},
}));
vi.mock("@/lib/lesson-ai-grading", () => ({
  gradeOpenAnswer: async (input: any) => {
    h.aiCalls.push(input);
    if (h.aiBand instanceof Error) throw h.aiBand;
    return h.aiBand;
  },
}));

import { signJwtToken } from "@/lib/jwt";

type Role = "ADMIN" | "TEACHER" | "STUDENT";
async function loginAs(role: Role | null, userId?: string) {
  h.token = role ? await signJwtToken({ userId: userId!, email: `${userId}@x.vn`, role }) : undefined;
}
const req = (method: string, url: string, body?: unknown, headers: Record<string, string> = {}) =>
  new Request(`http://localhost${url}`, {
    method,
    headers: { "Content-Type": "application/json", ...headers },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
const ctx = <T extends object>(p: T) => ({ params: Promise.resolve(p) });
const rows = async (sql: string) => (await h.pg!.db.query<any>(sql)).rows;

beforeEach(async () => {
  h.token = undefined;
  h.events.length = 0;
  h.aiCalls.length = 0;
  h.aiBand = 6.3;
  h.pg = await createFakePg(["db-migration-004-enrollments-assignments.sql"]);
  await h.pg.db.exec(`
    ALTER TABLE users ADD COLUMN slot_limit INT DEFAULT 250;
    CREATE TABLE courses (id VARCHAR(50) PRIMARY KEY, title VARCHAR(255), created_by VARCHAR(50));
    CREATE TABLE curriculum_items (
      id VARCHAR(50) PRIMARY KEY, course_id VARCHAR(50) NOT NULL, parent_id VARCHAR(50), title VARCHAR(255) NOT NULL,
      type VARCHAR(20) NOT NULL, exam_id VARCHAR(50), order_index INT DEFAULT 0, created_by VARCHAR(50),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);
  await h.pg.db.exec(fs.readFileSync("docs/db-migration-006-lessons.sql", "utf8"));
  await h.pg.db.exec(fs.readFileSync("docs/db-migration-017-gradebook.sql", "utf8")); // FEAT-014
  await h.pg.db.exec(`
    INSERT INTO users (id,name,email,role,slot_limit) VALUES
      ('t1','GV','t1@x.vn','TEACHER',5), ('s1','HS1','s1@x.vn','STUDENT',0), ('s2','HS2','s2@x.vn','STUDENT',0), ('s9','Ngoài','s9@x.vn','STUDENT',0);
    INSERT INTO courses VALUES ('co1','Khóa','t1'), ('co2','Khóa khác','t1');
    INSERT INTO classes (id,name,code,teacher_id,course_id,unlock_mode,pass_percent) VALUES
      ('c1','Lớp A','AAA111','t1','co1','SEQUENTIAL',70),
      ('cNoCourse','Lớp trống','EMPTY1','t1',NULL,'ALL_OPEN',70);
    INSERT INTO enrollments (id,student_id,class_id) VALUES ('en1','s1','c1'), ('en2','s2','c1'), ('en3','s1','cNoCourse');
    INSERT INTO questions (id,skill,category,prompt,content,stimulus_text) VALUES
      ('qMC','Reading','READING_MC','Chọn đáp án','{"sub_questions":[{"id":"s1","text":"1?","option_a":"a","option_b":"b","option_c":"c","option_d":"d","correct_answer":"B"},{"id":"s2","text":"2?","option_a":"a","option_b":"b","option_c":"c","option_d":"d","correct_answer":"C"}]}',NULL),
      ('qFill','Reading','READING_FILL_IN','Điền','{"fill_subtype":"OPTION_BANK","passage":"I (am) here.","option_bank":["is","am"]}','I (am) here.'),
      ('qEssay','Writing','WRITING_ESSAY','Viết về gia đình','{"min_words":50,"task_type":"Task 2"}',NULL),
      ('qShort','Writing','WRITING_SHORT_ANSWER','Trả lời','{"sub_questions":[{"id":"a1","text":"Why?","max_words":20,"sample_answer":"Because."}]}',NULL);
    INSERT INTO lessons (id,title,description,question_ids,created_by) VALUES
      ('lObj','Bài khách quan','Mô tả','["qMC","qFill"]','t1'),
      ('lAI','Bài tự luận',NULL,'["qMC","qEssay","qShort"]','t1'),
      ('lOther','Bài ngoài khóa',NULL,'["qMC"]','t1');
    INSERT INTO curriculum_items (id,course_id,parent_id,title,type,lesson_id,order_index) VALUES
      ('U1','co1',NULL,'Unit 1','UNIT',NULL,1),
      ('A','co1','U1','Bài 1','LESSON','lObj',1),
      ('B','co1','U1','Bài 2','LESSON','lAI',2),
      ('Z','co2',NULL,'Ngoài','LESSON','lOther',1);
  `);
});

// ─────────────────────────────────────────────────────────────────────────────
describe("GET /api/student/classes/[classId]/roadmap", () => {
  const get = async (classId: string) =>
    (await import("@/app/api/student/classes/[classId]/roadmap/route")).GET(req("GET", "/x"), ctx({ classId }));

  it("chưa đăng nhập 401; TEACHER 403; học sinh không thuộc lớp 403; lớp không có 404", async () => {
    expect((await get("c1")).status).toBe(401);
    await loginAs("TEACHER", "t1");
    expect((await get("c1")).status).toBe(403);
    await loginAs("STUDENT", "s9");
    expect((await get("c1")).status).toBe(403);
    expect((await get("cX")).status).toBe(404);
  });

  it("SEQUENTIAL: bài đầu OPEN, bài sau LOCKED; progress 0; có thông tin lớp", async () => {
    await loginAs("STUDENT", "s1");
    const json = await (await get("c1")).json();
    expect(json.class).toEqual({ id: "c1", name: "Lớp A", unlock_mode: "SEQUENTIAL", pass_percent: 70 });
    expect(json.items.map((i: any) => [i.id, i.state])).toEqual([["U1", "LOCKED"], ["A", "OPEN"], ["B", "LOCKED"]].map(([id, s]) => [id, id === "U1" ? "OPEN" : s]));
    expect(json.items.find((i: any) => i.id === "A")).toMatchObject({ type: "LESSON", lesson_id: "lObj", best_percent: null, due_date: null });
    expect(json.progress_percent).toBe(0);
  });

  it("đạt ngưỡng ở bài 1 → bài 1 COMPLETED, bài 2 OPEN, best_percent là điểm cao nhất", async () => {
    await h.pg!.db.exec(`INSERT INTO lesson_attempts (id,lesson_id,class_id,student_id,score_percent,status) VALUES
      ('a1','lObj','c1','s1',50,'GRADED'), ('a2','lObj','c1','s1',80,'GRADED')`);
    await loginAs("STUDENT", "s1");
    const json = await (await get("c1")).json();
    expect(json.items.find((i: any) => i.id === "A")).toMatchObject({ state: "COMPLETED", best_percent: 80 });
    expect(json.items.find((i: any) => i.id === "B").state).toBe("OPEN");
    expect(json.progress_percent).toBe(50);
  });

  it("lớp chưa gắn khóa → items rỗng, progress 0", async () => {
    await loginAs("STUDENT", "s1");
    expect(await (await get("cNoCourse")).json()).toMatchObject({ success: true, items: [], progress_percent: 0 });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe("GET /api/student/lessons/[lessonId]?classId= — nội dung bài đã ẩn đáp án", () => {
  const get = async (lessonId: string, classId = "c1") =>
    (await import("@/app/api/student/lessons/[lessonId]/route")).GET(req("GET", `/x?classId=${classId}`), ctx({ lessonId }));

  it("bài đang mở: câu hỏi đúng thứ tự, KHÔNG có đáp án ở bất kỳ đâu (TC-L10)", async () => {
    await loginAs("STUDENT", "s1");
    const res = await get("lObj");
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.lesson).toEqual({ id: "lObj", title: "Bài khách quan", description: "Mô tả" });
    expect(json.questions.map((q: any) => q.id)).toEqual(["qMC", "qFill"]);
    const text = JSON.stringify(json);
    for (const secret of ["correct_answer", '"B"', "(am)", "correct_answers"]) expect(text, secret).not.toContain(secret);
    expect(json.questions[1].content.passage_parts).toEqual(["I ", " here."]);
  });

  it("bài đang khoá → 403; bài không thuộc khóa của lớp → 403; thiếu classId → 400; không ghi danh → 403; bài không tồn tại → 404", async () => {
    await loginAs("STUDENT", "s1");
    expect((await get("lAI")).status).toBe(403);
    expect((await get("lOther")).status).toBe(403);
    expect((await get("lObj", "")).status).toBe(400);
    expect((await get("lNope")).status).toBe(404);
    await loginAs("STUDENT", "s9");
    expect((await get("lObj")).status).toBe(403);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe("POST /api/student/lessons/[lessonId]/attempts — nộp & chấm", () => {
  const post = async (lessonId: string, body: unknown) =>
    (await import("@/app/api/student/lessons/[lessonId]/attempts/route")).POST(req("POST", "/x", body), ctx({ lessonId }));

  it("chỉ khách quan: chấm ngay, GRADED, kết quả từng câu kèm đáp án sau khi nộp, không trừ slot", async () => {
    await loginAs("STUDENT", "s1");
    const res = await post("lObj", { classId: "c1", answers: { qMC: { s1: "b", s2: "A" }, qFill: ["am"] } });
    expect(res.status).toBe(201);
    const { attempt } = await res.json();
    expect(attempt).toMatchObject({ lesson_id: "lObj", class_id: "c1", student_id: "s1", status: "GRADED", objective_earned: 2, objective_max: 3, ai_max: 0, score_percent: 66.7 });
    expect(attempt.id).toMatch(/^att_[0-9a-f-]{36}$/);
    const mc = attempt.results.find((r: any) => r.question_id === "qMC");
    expect(mc.items[1]).toMatchObject({ key: "s2", correct: false, expected: "C" });
    expect((await rows(`SELECT slot_limit FROM users WHERE id='t1'`))[0].slot_limit).toBe(5);
    expect(h.events).toEqual([]);
  });

  it("student_id trong body bị bỏ qua — luôn lấy từ token", async () => {
    await loginAs("STUDENT", "s1");
    const { attempt } = await (await post("lObj", { classId: "c1", student_id: "s2", answers: {} })).json();
    expect(attempt.student_id).toBe("s1");
  });

  it("có tự luận: GRADING, score_percent null, KHÔNG trừ slot GV (DEC-031), đẩy sự kiện LESSON_GRADING_REQUESTED", async () => {
    await h.pg!.db.exec(`UPDATE classes SET unlock_mode='ALL_OPEN' WHERE id='c1'`);
    await loginAs("STUDENT", "s1");
    const { attempt } = await (await post("lAI", { classId: "c1", answers: { qMC: { s1: "B", s2: "C" }, qEssay: "My family...", qShort: { a1: "x" } } })).json();
    expect(attempt).toMatchObject({ status: "GRADING", objective_earned: 2, objective_max: 2, ai_max: 2, ai_earned: null, score_percent: null });
    expect((await rows(`SELECT slot_limit FROM users WHERE id='t1'`))[0].slot_limit).toBe(5);
    expect(h.events).toEqual([["stream:learning:grading", "LESSON_GRADING_REQUESTED", { attemptId: attempt.id }]]);
  });

  it("có tự luận + GV slot_limit = 0: vẫn GRADING và đẩy sự kiện chấm, slot không đổi (DEC-031 thay BR-L11)", async () => {
    await h.pg!.db.exec(`UPDATE classes SET unlock_mode='ALL_OPEN' WHERE id='c1'; UPDATE users SET slot_limit=0 WHERE id='t1';`);
    await loginAs("STUDENT", "s1");
    const { attempt } = await (await post("lAI", { classId: "c1", answers: { qMC: { s1: "B", s2: "C" } } })).json();
    expect(attempt).toMatchObject({ status: "GRADING", ai_earned: null, score_percent: null });
    expect((await rows(`SELECT slot_limit FROM users WHERE id='t1'`))[0].slot_limit).toBe(0);
    expect(h.events).toEqual([["stream:learning:grading", "LESSON_GRADING_REQUESTED", { attemptId: attempt.id }]]);
  });

  it("bài khoá / ngoài khóa / không ghi danh → 403 và không lưu (TC-L06)", async () => {
    await loginAs("STUDENT", "s1");
    expect((await post("lAI", { classId: "c1", answers: {} })).status).toBe(403);
    expect((await post("lOther", { classId: "c1", answers: {} })).status).toBe(403);
    await loginAs("STUDENT", "s9");
    expect((await post("lObj", { classId: "c1", answers: {} })).status).toBe(403);
    expect(await rows(`SELECT id FROM lesson_attempts`)).toEqual([]);
  });

  it("thiếu classId hoặc answers không phải object → 400; TEACHER → 403", async () => {
    await loginAs("STUDENT", "s1");
    expect((await post("lObj", { answers: {} })).status).toBe(400);
    expect((await post("lObj", { classId: "c1", answers: "x" })).status).toBe(400);
    await loginAs("TEACHER", "t1");
    expect((await post("lObj", { classId: "c1", answers: {} })).status).toBe(403);
  });

  it("làm lại nhiều lần được lưu đủ; GET danh sách mới nhất trước, chỉ của mình", async () => {
    await loginAs("STUDENT", "s1");
    await post("lObj", { classId: "c1", answers: {} });
    await post("lObj", { classId: "c1", answers: { qFill: ["am"] } });
    await loginAs("STUDENT", "s2");
    await post("lObj", { classId: "c1", answers: {} });
    await loginAs("STUDENT", "s1");
    const { GET } = await import("@/app/api/student/lessons/[lessonId]/attempts/route");
    const json = await (await GET(req("GET", "/x?classId=c1"), ctx({ lessonId: "lObj" }))).json();
    expect(json.attempts).toHaveLength(2);
    expect(json.attempts.every((a: any) => a.student_id === "s1")).toBe(true);
    expect(Number(json.attempts[0].objective_earned)).toBe(1);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe("GET /api/student/attempts/[id]", () => {
  it("của mình → 200; của người khác → 403; không có → 404", async () => {
    await h.pg!.db.exec(`INSERT INTO lesson_attempts (id,lesson_id,class_id,student_id,status) VALUES ('att_x','lObj','c1','s1','GRADED')`);
    const { GET } = await import("@/app/api/student/attempts/[id]/route");
    await loginAs("STUDENT", "s1");
    expect((await GET(req("GET", "/x"), ctx({ id: "att_x" }))).status).toBe(200);
    expect((await GET(req("GET", "/x"), ctx({ id: "att_nope" }))).status).toBe(404);
    await loginAs("STUDENT", "s2");
    expect((await GET(req("GET", "/x"), ctx({ id: "att_x" }))).status).toBe(403);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe("POST /api/lessons/grade-async — worker chấm AI (TC-L07)", () => {
  const grade = async (body: unknown, token = "internal_test_token_xyz") =>
    (await import("@/app/api/lessons/grade-async/route")).POST(req("POST", "/x", body, token ? { "x-internal-token": token } : {}));

  async function submitAI() {
    await h.pg!.db.exec(`UPDATE classes SET unlock_mode='ALL_OPEN' WHERE id='c1'`);
    await loginAs("STUDENT", "s1");
    const { POST } = await import("@/app/api/student/lessons/[lessonId]/attempts/route");
    const { attempt } = await (await POST(req("POST", "/x", { classId: "c1", answers: { qMC: { s1: "B", s2: "C" }, qEssay: "Essay", qShort: { a1: "Because" } } }), ctx({ lessonId: "lAI" }))).json();
    h.token = undefined;
    return attempt;
  }

  it("không có / sai token nội bộ → 401 (kể cả khi có cookie giáo viên)", async () => {
    await loginAs("TEACHER", "t1");
    expect((await grade({ attemptId: "x" }, "")).status).toBe(401);
    expect((await grade({ attemptId: "x" }, "sai")).status).toBe(401);
  });

  it("chấm AI: mỗi mục band/9, cập nhật ai_earned, score_percent, GRADED, graded_at; gửi đúng đề bài + câu trả lời", async () => {
    const attempt = await submitAI();
    const res = await grade({ attemptId: attempt.id });
    expect(res.status).toBe(200);
    const row = (await rows(`SELECT * FROM lesson_attempts WHERE id='${attempt.id}'`))[0];
    expect(row.status).toBe("GRADED");
    expect(Number(row.ai_earned)).toBeCloseTo(1.4, 1);          // 6.3/9 × 2 mục
    expect(Number(row.score_percent)).toBe(85);                  // (2 + 1.4) / 4
    expect(row.graded_at).not.toBeNull();
    expect(h.aiCalls).toEqual(expect.arrayContaining([
      expect.objectContaining({ category: "WRITING_ESSAY", prompt: "Viết về gia đình", answer: "Essay" }),
      expect.objectContaining({ category: "WRITING_SHORT_ANSWER", answer: "Because", sample_answer: "Because." }),
    ]));
  });

  it("gọi lại khi đã GRADED → 200 bỏ qua, không gọi AI lần nữa (idempotent)", async () => {
    const attempt = await submitAI();
    await grade({ attemptId: attempt.id });
    const calls = h.aiCalls.length;
    const res = await grade({ attemptId: attempt.id });
    expect(res.status).toBe(200);
    expect(h.aiCalls.length).toBe(calls);
  });

  // DEC-041 / BR-B12 (FEAT-014): AI lỗi không còn cho 0 điểm mà chuyển NEEDS_REVIEW
  it("AI lỗi liên tục → thử tối đa 3 lần mỗi mục rồi NEEDS_REVIEW, không cho 0 điểm", async () => {
    const attempt = await submitAI();
    h.aiBand = new Error("AI down");
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
    await grade({ attemptId: attempt.id });
    const row = (await rows(`SELECT status, ai_earned, score_percent, last_grading_error FROM lesson_attempts WHERE id='${attempt.id}'`))[0];
    expect(row.status).toBe("NEEDS_REVIEW");
    expect(row.ai_earned).toBeNull();
    expect(row.score_percent).toBeNull();
    expect(String(row.last_grading_error || "")).not.toBe("");
    expect(h.aiCalls.length).toBe(6);                            // 2 mục × 3 lần
  });

  it("attempt không tồn tại → 404", async () => {
    expect((await grade({ attemptId: "att_none" })).status).toBe(404);
  });
});

describe("worker/grading-worker.js xử lý sự kiện bài học", () => {
  it("gọi /api/lessons/grade-async kèm x-internal-token khi nhận LESSON_GRADING_REQUESTED", () => {
    const src = fs.readFileSync("worker/grading-worker.js", "utf8");
    expect(src).toContain("LESSON_GRADING_REQUESTED");
    expect(src).toContain("/api/lessons/grade-async");
    expect(src).toMatch(/attemptId/);
  });
});
