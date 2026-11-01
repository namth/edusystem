// TASK-020 — Lượt thi học sinh do server quản lý + chấm khi nộp + grade-async/grade-override bằng pg (FEAT-011 TC-E03…E09).
// File do trưởng phòng viết, bị khoá.
import { describe, it, expect, vi, beforeEach } from "vitest";
import fs from "fs";
import { createFakePg } from "./helpers/pg-fake";

const h = vi.hoisted(() => {
  process.env.JWT_SECRET = "test_secret_for_vitest_only_0123456789abcdef";
  process.env.INTERNAL_API_TOKEN = "internal_test_token_xyz";
  return { token: undefined as string | undefined, pg: null as any, events: [] as any[], aiCalls: [] as any[], aiScore: 6 as number | Error, pushFail: false };
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
vi.mock("@/lib/redis-queue", () => ({
  pushRedisStreamEvent: async (...a: any[]) => { h.events.push(a); },
  // Ghi lại trạng thái bài ở thời điểm đẩy sự kiện (TASK-029: phải là GRADING, không còn IN_PROGRESS)
  pushGradingEvent: async (...a: any[]) => {
    const st = (await h.pg.db.query("SELECT status FROM submissions WHERE id=$1", [a[0]])).rows[0]?.status;
    h.events.push(["grading", ...a, st]);
    if (h.pushFail) throw new Error("redis down");
  },
}));
vi.mock("@/lib/exam-ai-grading", () => ({
  gradeExamOpenAnswer: async (input: any) => {
    h.aiCalls.push(input);
    if (h.aiScore instanceof Error) throw h.aiScore;
    return { score: h.aiScore, feedback: `Nhận xét ${input.category}` };
  },
}));
vi.mock("@/lib/supabase", () => ({ supabase: new Proxy({}, { get() { throw new Error("không dùng Supabase client"); } }) }));
vi.mock("@/lib/supabase-server", () => ({
  createClient: () => { throw new Error("dùng queryPg"); },
  getServerSupabaseClient: () => { throw new Error("dùng queryPg"); },
}));

import { signJwtToken } from "@/lib/jwt";

async function loginAs(role: "ADMIN" | "TEACHER" | "STUDENT" | null, userId?: string) {
  h.token = role ? await signJwtToken({ userId: userId!, email: `${userId}@x.vn`, role }) : undefined;
}
const req = (method: string, url: string, body?: unknown, headers: Record<string, string> = {}) =>
  new Request(`http://localhost${url}`, { method, headers: { "Content-Type": "application/json", ...headers }, body: body === undefined ? undefined : JSON.stringify(body) });
const rows = async (sql: string, p?: unknown[]) => (await h.pg.db.query(sql, p)).rows;
const start = async (examId: string, body: unknown = {}) =>
  (await import("@/app/api/student/exams/[examId]/attempts/route")).POST(req("POST", "/x", body), { params: Promise.resolve({ examId }) });
const content = async (examId: string) =>
  (await import("@/app/api/student/exams/[examId]/content/route")).GET(req("GET", "/x"), { params: Promise.resolve({ examId }) });
const saveAnswers = async (id: string, answers: unknown) =>
  (await import("@/app/api/student/exam-attempts/[id]/answers/route")).PUT(req("PUT", "/x", { answers }), { params: Promise.resolve({ id }) });
const submit = async (id: string, answers: unknown) =>
  (await import("@/app/api/student/exam-attempts/[id]/submit/route")).POST(req("POST", "/x", { answers }), { params: Promise.resolve({ id }) });

beforeEach(async () => {
  h.token = undefined;
  h.events.length = 0;
  h.aiCalls.length = 0;
  h.aiScore = 6;
  h.pushFail = false;
  h.pg = await createFakePg(["db-migration-004-enrollments-assignments.sql"]);
  await h.pg.db.exec(`
    ALTER TABLE users ADD COLUMN slot_limit INT DEFAULT 0;
    CREATE TABLE courses (id VARCHAR(50) PRIMARY KEY, title VARCHAR(255), created_by VARCHAR(50));
    CREATE TABLE curriculum_items (id VARCHAR(50) PRIMARY KEY, course_id VARCHAR(50) NOT NULL, parent_id VARCHAR(50), title VARCHAR(255) NOT NULL,
      type VARCHAR(20) NOT NULL, exam_id VARCHAR(50), order_index INT DEFAULT 0, created_by VARCHAR(50), created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP);
  `);
  await h.pg.db.exec(fs.readFileSync("docs/db-migration-006-lessons.sql", "utf8"));
  await h.pg.db.exec(fs.readFileSync("docs/db-migration-009-scoring-standards.sql", "utf8"));
  await h.pg.db.exec(fs.readFileSync("docs/db-migration-010-notifications.sql", "utf8"));
  await h.pg.db.exec(`
    INSERT INTO users (id,name,email,role,slot_limit) VALUES ('t1','GV','t1@x.vn','TEACHER',3), ('t2','GV2','t2@x.vn','TEACHER',0),
      ('s1','HS1','s1@x.vn','STUDENT',0), ('s2','HS2','s2@x.vn','STUDENT',0);
    INSERT INTO courses (id,title,created_by,default_scoring_standard_id) VALUES ('coH','Khóa HSK','t1','std_hsk1');
    INSERT INTO classes (id,name,code,teacher_id,course_id,unlock_mode) VALUES ('c1','Lớp','AAA','t1','coH','ALL_OPEN');
    INSERT INTO enrollments (id,student_id,class_id) VALUES ('en1','s1','c1');
    INSERT INTO questions (id,skill,category,prompt,content) VALUES
      ('r1','Reading','READING_MC','R','{"sub_questions":[{"id":"a","text":"?","option_a":"a","option_b":"b","option_c":"c","option_d":"d","correct_answer":"A"},{"id":"b","text":"?","option_a":"a","option_b":"b","option_c":"c","option_d":"d","correct_answer":"B"}]}'),
      ('l1','Listening','LISTENING_FILL_IN','L','{"fill_subtype":"FREE_TYPING","passage":"I (am) ok and (you) too."}'),
      ('w1','Writing','WRITING_ESSAY','Viết đoạn văn','{"min_words":50}'),
      ('sp1','Speaking','SPEAKING_TOPIC_PROMPT','Nói về gia đình','{"prep_time_seconds":30,"speaking_time_seconds":60}');
    INSERT INTO exams (id,title,duration_minutes,question_ids,created_by,scoring_standard_id) VALUES
      ('eObj','Đề khách quan',30,'["r1","l1"]','t1','std_ielts'),
      ('eAI','Đề có tự luận',60,'["r1","w1","sp1"]','t1','std_ielts'),
      ('eHsk','Đề trong khóa HSK',20,'["r1","l1"]','t1',NULL),
      ('ePlain','Đề không chuẩn',20,'["r1"]','t2',NULL),
      ('eFree','Đề AI luyện tập',20,'["w1"]','t2','std_ielts');
    INSERT INTO class_assignments (id,class_id,exam_id,max_attempts) VALUES ('as1','c1','eObj',2), ('as2','c1','eAI',1);
    INSERT INTO curriculum_items (id,course_id,parent_id,title,type,exam_id,order_index) VALUES ('X','coH',NULL,'Đề HSK','EXAM','eHsk',1);
  `);
});

// ─────────────────────────────────────────────────────────────────────────────
describe("POST /api/student/exams/[examId]/attempts — bắt đầu lượt thi", () => {
  it("chưa đăng nhập 401; TEACHER 403; đề không có 404", async () => {
    expect((await start("eObj")).status).toBe(401);
    await loginAs("TEACHER", "t1");
    expect((await start("eObj")).status).toBe(403);
    await loginAs("STUDENT", "s1");
    expect((await start("eX")).status).toBe(404);
  });

  it("luyện tập (không classId): 201, IN_PROGRESS, deadline = started + duration, chụp chuẩn; không giới hạn", async () => {
    await loginAs("STUDENT", "s1");
    const res = await start("eObj");
    expect(res.status).toBe(201);
    const { attempt, remaining_attempts } = await res.json();
    expect(attempt.id).toMatch(/^sub_[0-9a-f-]{36}$/);
    expect(attempt.status).toBe("IN_PROGRESS");
    expect(new Date(attempt.deadline_at).getTime() - new Date(attempt.started_at).getTime()).toBe(30 * 60 * 1000);
    expect(remaining_attempts).toBeNull();
    const row = (await rows(`SELECT standard_snapshot, class_ref FROM submissions WHERE id=$1`, [attempt.id]))[0];
    expect(row.standard_snapshot.id).toBe("std_ielts");
    expect(row.class_ref).toBeNull();
  });

  it("gọi lại khi đang có lượt IN_PROGRESS → trả lượt cũ, KHÔNG đặt lại giờ (TC-E04)", async () => {
    await loginAs("STUDENT", "s1");
    const a = (await (await start("eObj")).json()).attempt;
    const res2 = await start("eObj");
    expect(res2.status).toBe(200);
    const b = (await res2.json()).attempt;
    expect(b.id).toBe(a.id);
    expect(b.started_at).toBe(a.started_at);
  });

  it("chọn chuẩn: đề → chuẩn mặc định của khóa chứa đề → std_internal_10 (BR-E01, TC-E03)", async () => {
    await loginAs("STUDENT", "s1");
    const a = (await (await start("eHsk")).json()).attempt;
    expect((await rows(`SELECT standard_snapshot FROM submissions WHERE id=$1`, [a.id]))[0].standard_snapshot.id).toBe("std_hsk1");
    const b = (await (await start("ePlain")).json()).attempt;
    expect((await rows(`SELECT standard_snapshot FROM submissions WHERE id=$1`, [b.id]))[0].standard_snapshot.id).toBe("std_internal_10");
  });

  it("theo lớp: chưa ghi danh 403; đề không giao/không trong lộ trình lớp 403; ghi class_ref (BR-E03)", async () => {
    await loginAs("STUDENT", "s2");
    expect((await start("eObj", { classId: "c1" })).status).toBe(403);
    await loginAs("STUDENT", "s1");
    expect((await start("ePlain", { classId: "c1" })).status).toBe(403);
    const r = await start("eHsk", { classId: "c1" });
    expect(r.status).toBe(201);
    expect((await r.json()).remaining_attempts).toBe(1);
  });

  it("vượt số lần theo lớp → 409; lượt đã nộp mới tính (TC-E05)", async () => {
    await h.pg.db.exec(`INSERT INTO submissions (id,exam_id,student_id,answers,status,class_ref) VALUES
      ('old1','eObj','s1','{}','GRADED','c1'), ('old2','eObj','s1','{}','GRADED','c1')`);
    await loginAs("STUDENT", "s1");
    expect((await start("eObj", { classId: "c1" })).status).toBe(409);
    expect((await start("eObj")).status).toBe(201);  // luyện tập vẫn được
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe("Nội dung đề & lưu tạm", () => {
  it("chưa bắt đầu → 403; đã bắt đầu → câu hỏi đã ẩn đáp án + tóm tắt chuẩn (TC-E06)", async () => {
    await loginAs("STUDENT", "s1");
    expect((await content("eObj")).status).toBe(403);
    await start("eObj");
    const json = await (await content("eObj")).json();
    expect(json.exam).toMatchObject({ id: "eObj", duration_minutes: 30 });
    expect(json.standard).toMatchObject({ id: "std_ielts" });
    expect(json.questions.map((q: any) => q.id)).toEqual(["r1", "l1"]);
    const text = JSON.stringify(json);
    expect(text).not.toContain("correct_answer");
    expect(text).not.toContain("(am)");
  });

  it("/api/exams/[id]/content với STUDENT cũng trả bản đã ẩn đáp án", async () => {
    await loginAs("STUDENT", "s1");
    const { GET } = await import("@/app/api/exams/[id]/content/route");
    const text = JSON.stringify(await (await GET(req("GET", "/x"), { params: Promise.resolve({ id: "eObj" }) })).json());
    expect(text).not.toContain("correct_answer");
  });

  it("lưu tạm: lượt của mình → 200; của người khác → 403; quá hạn + 2 phút → 409", async () => {
    await loginAs("STUDENT", "s1");
    const a = (await (await start("eObj")).json()).attempt;
    expect((await saveAnswers(a.id, { r1: { a: "A" } })).status).toBe(200);
    expect((await rows(`SELECT answers FROM submissions WHERE id=$1`, [a.id]))[0].answers).toEqual({ r1: { a: "A" } });
    await loginAs("STUDENT", "s2");
    expect((await saveAnswers(a.id, {})).status).toBe(403);
    await h.pg.db.query(`UPDATE submissions SET deadline_at = NOW() - INTERVAL '3 minutes' WHERE id=$1`, [a.id]);
    await loginAs("STUDENT", "s1");
    expect((await saveAnswers(a.id, {})).status).toBe(409);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe("POST submit — chấm trên server theo chuẩn", () => {
  it("đề khách quan IELTS: điểm phần (Reading tuyến tính... Listening bảng tra) + tổng, GRADED", async () => {
    await loginAs("STUDENT", "s1");
    const a = (await (await start("eObj")).json()).attempt;
    const res = await submit(a.id, { r1: { a: "A", b: "C" }, l1: ["am", "you"] });
    expect(res.status).toBe(200);
    const { attempt } = await res.json();
    expect(attempt.status).toBe("GRADED");
    // Reading IELTS: TABLE 1/2 → 20/40 → 5.5 ; Listening: 2/2 → 40/40 → 9 ; tổng trung bình 7.25 → 7.5
    expect(attempt.section_scores.Reading).toMatchObject({ score: 5.5, earned: 1, max: 2 });
    expect(attempt.section_scores.Listening).toMatchObject({ score: 9, earned: 2, max: 2 });
    expect(Number(attempt.total_score)).toBe(7.5);
    expect(attempt.is_late).toBe(false);
    expect(attempt.results.find((r: any) => r.question_id === "r1").items[1]).toMatchObject({ correct: false, expected: "B" });
  });

  it("HSK (SUM + điểm đạt): passed được tính", async () => {
    await loginAs("STUDENT", "s1");
    const a = (await (await start("eHsk")).json()).attempt;
    const { attempt } = await (await submit(a.id, { r1: { a: "A", b: "B" }, l1: ["am", "x"] })).json();
    expect(attempt.section_scores.Reading.score).toBe(100);
    expect(attempt.section_scores.Listening.score).toBe(50);
    expect(Number(attempt.total_score)).toBe(150);
    expect(attempt.passed).toBe(true);
  });

  it("nộp quá hạn + 2 phút → vẫn chấm, is_late = true; nộp lại lượt đã nộp → 409", async () => {
    await loginAs("STUDENT", "s1");
    const a = (await (await start("eObj")).json()).attempt;
    await h.pg.db.query(`UPDATE submissions SET deadline_at = NOW() - INTERVAL '5 minutes' WHERE id=$1`, [a.id]);
    const { attempt } = await (await submit(a.id, {})).json();
    expect(attempt.is_late).toBe(true);
    expect(attempt.status).toBe("GRADED");
    expect((await submit(a.id, {})).status).toBe(409);
  });

  it("có Writing/Speaking + GV lớp còn slot → GRADING, trừ 1 slot GV lớp, đẩy GRADING_REQUESTED (TC-E07)", async () => {
    await loginAs("STUDENT", "s1");
    const a = (await (await start("eAI", { classId: "c1" })).json()).attempt;
    const { attempt } = await (await submit(a.id, { r1: { a: "A", b: "B" }, w1: "Essay text", sp1: "https://cdn/x.webm" })).json();
    expect(attempt.status).toBe("GRADING");
    expect(attempt.section_scores.Reading.score).toBe(9);
    expect(attempt.total_score).toBeNull();
    expect((await rows(`SELECT slot_limit FROM users WHERE id='t1'`))[0].slot_limit).toBe(2);
    expect(JSON.stringify(h.events)).toContain(a.id);
  });

  it("đẩy sự kiện chấm SAU khi đã lưu trạng thái GRADING (tránh worker bỏ qua) (TASK-029)", async () => {
    await loginAs("STUDENT", "s1");
    const a = (await (await start("eAI", { classId: "c1" })).json()).attempt;
    await submit(a.id, { r1: { a: "A", b: "B" }, w1: "Essay", sp1: "u" });
    const ev = h.events.find((e) => e[0] === "grading");
    expect(ev).toBeTruthy();
    expect(ev[ev.length - 1]).toBe("GRADING");
  });

  it("đẩy sự kiện lỗi → NEEDS_REVIEW, hoàn slot, báo GV; vẫn trả 200 cho học sinh", async () => {
    h.pushFail = true;
    vi.spyOn(console, "error").mockImplementation(() => {});
    await loginAs("STUDENT", "s1");
    const a = (await (await start("eAI", { classId: "c1" })).json()).attempt;
    const res = await submit(a.id, { r1: { a: "A", b: "B" }, w1: "Essay", sp1: "u" });
    expect(res.status).toBe(200);
    expect((await res.json()).attempt.status).toBe("NEEDS_REVIEW");
    expect((await rows(`SELECT slot_limit FROM users WHERE id='t1'`))[0].slot_limit).toBe(3);
    expect(await rows(`SELECT user_id FROM notifications WHERE ref_id=$1 AND type='EXAM_NEEDS_REVIEW'`, [a.id])).toEqual([{ user_id: "t1" }]);
  });

  it("hết slot → NEEDS_REVIEW cũng báo giáo viên", async () => {
    await loginAs("STUDENT", "s1");
    const a = (await (await start("eFree")).json()).attempt;
    await submit(a.id, { w1: "Essay" });
    expect(await rows(`SELECT user_id FROM notifications WHERE ref_id=$1 AND type='EXAM_NEEDS_REVIEW'`, [a.id])).toEqual([{ user_id: "t2" }]);
  });

  it("bài toàn khách quan chấm ngay: KHÔNG tạo thông báo (học sinh đã thấy điểm tại chỗ)", async () => {
    await loginAs("STUDENT", "s1");
    const a = (await (await start("eObj")).json()).attempt;
    await submit(a.id, { r1: { a: "A", b: "B" } });
    expect(await rows(`SELECT * FROM notifications`)).toEqual([]);
  });

  it("đề luyện tập có AI, người tạo đề hết slot → NEEDS_REVIEW, không đẩy sự kiện", async () => {
    await loginAs("STUDENT", "s1");
    const a = (await (await start("eFree")).json()).attempt;
    const { attempt } = await (await submit(a.id, { w1: "Essay" })).json();
    expect(attempt.status).toBe("NEEDS_REVIEW");
    expect(h.events).toEqual([]);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe("POST /api/exam/grade-async — worker chấm AI theo thang phần", () => {
  const grade = async (body: unknown, token = "internal_test_token_xyz") =>
    (await import("@/app/api/exam/grade-async/route")).POST(req("POST", "/x", body, token ? { "x-internal-token": token } : {}));

  async function gradingAttempt() {
    await loginAs("STUDENT", "s1");
    const a = (await (await start("eAI", { classId: "c1" })).json()).attempt;
    await submit(a.id, { r1: { a: "A", b: "B" }, w1: "Essay text", sp1: "https://cdn/x.webm" });
    h.token = undefined;
    return a.id as string;
  }

  it("không token nội bộ → 401", async () => {
    expect((await grade({ submissionId: "x" }, "")).status).toBe(401);
  });

  it("chấm Writing + Speaking theo thang IELTS (0–9), tính tổng, GRADED; gửi đúng phần & rubric", async () => {
    const id = await gradingAttempt();
    h.aiScore = 6;
    expect((await grade({ submissionId: id })).status).toBe(200);
    const row = (await rows(`SELECT status, section_scores, total_score FROM submissions WHERE id=$1`, [id]))[0];
    expect(row.status).toBe("GRADED");
    expect(row.section_scores.Writing.score).toBe(6);
    expect(row.section_scores.Speaking.score).toBe(6);
    expect(Number(row.total_score)).toBe(7);                 // (9 + 6 + 6) / 3 = 7
    expect(h.aiCalls.map((c) => c.category).sort()).toEqual(["SPEAKING_TOPIC_PROMPT", "WRITING_ESSAY"]);
    expect(h.aiCalls[0]).toMatchObject({ section: expect.objectContaining({ min: 0, max: 9 }) });
    expect(h.aiCalls.find((c) => c.category === "WRITING_ESSAY")).toMatchObject({ answer: "Essay text", rubric_id: "rubric_ielts_writing" });
  });

  it("AI lỗi 3 lần → NEEDS_REVIEW (không cho điểm min), hoàn slot, giữ điểm phần đã chấm, báo GV (DEC-021)", async () => {
    const id = await gradingAttempt();
    expect((await rows(`SELECT slot_limit FROM users WHERE id='t1'`))[0].slot_limit).toBe(2);
    h.aiScore = new Error("AI down");
    vi.spyOn(console, "error").mockImplementation(() => {});
    await grade({ submissionId: id });
    const row = (await rows(`SELECT status, section_scores, total_score, last_grading_error FROM submissions WHERE id=$1`, [id]))[0];
    expect(row.status).toBe("NEEDS_REVIEW");
    expect(row.section_scores.Reading.score).toBe(9);
    expect(row.section_scores.Writing.score).toBeNull();
    expect(row.total_score).toBeNull();
    expect(row.last_grading_error).toBeTruthy();
    expect(h.aiCalls.length).toBe(6);
    expect((await rows(`SELECT slot_limit FROM users WHERE id='t1'`))[0].slot_limit).toBe(3);
    expect(await rows(`SELECT user_id, type FROM notifications WHERE ref_id=$1`, [id])).toEqual([{ user_id: "t1", type: "EXAM_NEEDS_REVIEW" }]);
  });

  it("chấm xong → lưu nhận xét AI vào results và tạo thông báo EXAM_GRADED cho học sinh", async () => {
    const id = await gradingAttempt();
    await grade({ submissionId: id });
    const row = (await rows(`SELECT results FROM submissions WHERE id=$1`, [id]))[0];
    const w = row.results.find((r: any) => r.question_id === "w1");
    expect(w.score).toBe(6);
    expect(w.feedback).toBe("Nhận xét WRITING_ESSAY");
    const n = await rows(`SELECT user_id, type, link FROM notifications WHERE ref_id=$1`, [id]);
    expect(n).toEqual([{ user_id: "s1", type: "EXAM_GRADED", link: `/student/exam/review/${id}` }]);
  });

  it("lượt không ở GRADING → 200 bỏ qua; không có → 404", async () => {
    await loginAs("STUDENT", "s1");
    const a = (await (await start("eObj")).json()).attempt;
    await submit(a.id, {});
    expect((await (await grade({ submissionId: a.id })).json()).skipped).toBe(true);
    expect((await grade({ submissionId: "none" })).status).toBe(404);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe("PUT /api/exam/grade-override — giáo viên chấm/sửa điểm phần (TC-E08)", () => {
  const override = async (body: unknown) => (await import("@/app/api/exam/grade-override/route")).PUT(req("PUT", "/x", body));

  it("GV lớp chấm Writing/Speaking cho lượt NEEDS_REVIEW → tính lại tổng, GRADED", async () => {
    await h.pg.db.exec(`UPDATE users SET slot_limit=0 WHERE id='t1'`);
    await loginAs("STUDENT", "s1");
    const a = (await (await start("eAI", { classId: "c1" })).json()).attempt;
    await submit(a.id, { r1: { a: "A", b: "B" }, w1: "Essay", sp1: "u" });
    await loginAs("TEACHER", "t1");
    const res = await override({ submissionId: a.id, section_scores: { Writing: 7, Speaking: 8 }, feedback: "Tốt" });
    expect(res.status).toBe(200);
    const row = (await rows(`SELECT status, total_score, teacher_feedback FROM submissions WHERE id=$1`, [a.id]))[0];
    expect(row.status).toBe("GRADED");
    expect(Number(row.total_score)).toBe(8);                 // (9 + 7 + 8) / 3
    expect(row.teacher_feedback).toBe("Tốt");
  });

  it("điểm ngoài thang → 400; GV không liên quan → 403; STUDENT → 403", async () => {
    await loginAs("STUDENT", "s1");
    const a = (await (await start("eObj")).json()).attempt;
    await submit(a.id, {});
    await loginAs("TEACHER", "t1");
    expect((await override({ submissionId: a.id, section_scores: { Reading: 12 } })).status).toBe(400);
    await loginAs("TEACHER", "t2");
    expect((await override({ submissionId: a.id, section_scores: { Reading: 5 } })).status).toBe(403);
    await loginAs("STUDENT", "s1");
    expect((await override({ submissionId: a.id, section_scores: { Reading: 5 } })).status).toBe(403);
  });
});

describe("GET /api/submissions/[id] — không lộ đáp án khi đang làm (DEC-018, TASK-029)", () => {
  const getSub = async (id: string) =>
    (await import("@/app/api/submissions/[id]/route")).GET(req("GET", "/x"), { params: Promise.resolve({ id }) });

  it("học sinh gọi khi lượt còn IN_PROGRESS → 409, thân trả về không chứa đáp án", async () => {
    await loginAs("STUDENT", "s1");
    const a = (await (await start("eObj")).json()).attempt;
    const res = await getSub(a.id);
    expect(res.status).toBe(409);
    const text = await res.text();
    expect(text).not.toContain("correct_answer");
    expect(text).not.toContain('"questions"');
  });

  it("sau khi nộp: học sinh xem được bài của mình (kèm câu hỏi để xem lại); bài người khác 403", async () => {
    await loginAs("STUDENT", "s1");
    const a = (await (await start("eObj")).json()).attempt;
    await submit(a.id, { r1: { a: "A", b: "B" } });
    const res = await getSub(a.id);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.submission.status).toBe("GRADED");
    expect(json.questions.length).toBe(2);
    await loginAs("STUDENT", "s2");
    expect((await getSub(a.id)).status).toBe(403);
  });

  it("giáo viên xem được cả lượt đang làm (theo dõi lớp)", async () => {
    await loginAs("STUDENT", "s1");
    const a = (await (await start("eObj")).json()).attempt;
    await loginAs("TEACHER", "t1");
    expect((await getSub(a.id)).status).toBe(200);
  });
});

describe("Đường nộp cũ bị khoá", () => {
  it("POST /api/submissions → 410 (TC-E09)", async () => {
    await loginAs("STUDENT", "s1");
    const { POST } = await import("@/app/api/submissions/route");
    expect((await POST(req("POST", "/x", { exam_id: "eObj", auto_graded_score: 9 }))).status).toBe(410);
    expect((await POST(req("POST", "/x", { exam_id: "eObj", answers: {}, writing_essay: "x".repeat(50) }))).status).toBe(410);
    expect((await POST(req("POST", "/x", {}))).status).toBe(410);
  });
});

describe("Worker bỏ cuộc sau nhiều lần giao (giveUp) — không để bài kẹt GRADING", () => {
  const grade = async (body: unknown, token = "internal_test_token_xyz") =>
    (await import("@/app/api/exam/grade-async/route")).POST(req("POST", "/x", body, token ? { "x-internal-token": token } : {}));

  it("giveUp với token nội bộ → NEEDS_REVIEW, hoàn slot một lần, báo GV; gọi lại không hoàn thêm", async () => {
    await loginAs("STUDENT", "s1");
    const a = (await (await start("eAI", { classId: "c1" })).json()).attempt;
    await submit(a.id, { r1: { a: "A", b: "B" }, w1: "Essay", sp1: "u" });
    h.token = undefined;
    expect((await rows(`SELECT slot_limit FROM users WHERE id='t1'`))[0].slot_limit).toBe(2);

    expect((await grade({ submissionId: a.id, giveUp: true })).status).toBe(200);
    const row = (await rows(`SELECT status, last_grading_error, total_score FROM submissions WHERE id=$1`, [a.id]))[0];
    expect(row.status).toBe("NEEDS_REVIEW");
    expect(row.last_grading_error).toBeTruthy();
    expect(row.total_score).toBeNull();
    expect((await rows(`SELECT slot_limit FROM users WHERE id='t1'`))[0].slot_limit).toBe(3);
    expect(await rows(`SELECT user_id FROM notifications WHERE ref_id=$1 AND type='EXAM_NEEDS_REVIEW'`, [a.id])).toEqual([{ user_id: "t1" }]);

    await grade({ submissionId: a.id, giveUp: true });
    expect((await rows(`SELECT slot_limit FROM users WHERE id='t1'`))[0].slot_limit).toBe(3);
    expect(h.aiCalls).toEqual([]);
  });
});
