// TASK-010 — API ghi đề thi + trang tạo đề dùng QuestionSetEditor qua API (FEAT-010 TC-L09).
// File do trưởng phòng viết, bị khoá.
import { describe, it, expect, vi, beforeEach } from "vitest";
import fs from "fs";
import { createFakePg } from "./helpers/pg-fake";

const h = vi.hoisted(() => {
  process.env.JWT_SECRET = "test_secret_for_vitest_only_0123456789abcdef";
  return {
    token: undefined as string | undefined,
    pg: null as null | Awaited<ReturnType<typeof import("./helpers/pg-fake").createFakePg>>,
    neo: [] as any[],
    events: [] as any[],
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
vi.mock("@/lib/neo4j", () => ({
  getNeo4jDriver: () => null,
  runCypherQuery: async (q: string, p: any) => { h.neo.push(["cypher", q, p]); return []; },
  syncCourseExam: async (...a: any[]) => { h.neo.push(["sync", ...a]); },
  getExamCourseMapping: async () => [{ examId: "eOld", courseId: "co1" }],
  syncTeacherManagesClass: async () => {},
  syncStudentEnrolledInClass: async () => {},
  recordStudentSkillScore: async () => {},
}));
vi.mock("@/lib/redis-queue", () => ({
  pushRedisStreamEvent: async (...a: any[]) => { h.events.push(a); },
  pushGradingEvent: async () => {},
}));

import { signJwtToken } from "@/lib/jwt";

type Role = "ADMIN" | "TEACHER" | "STUDENT";
async function loginAs(role: Role | null, userId?: string) {
  h.token = role ? await signJwtToken({ userId: userId!, email: `${userId}@x.vn`, role }) : undefined;
}
const req = (method: string, url: string, body?: unknown) =>
  new Request(`http://localhost${url}`, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
const ctx = (id: string) => ({ params: Promise.resolve({ id }) });
const rows = async (sql: string) => (await h.pg!.db.query<any>(sql)).rows;

beforeEach(async () => {
  h.token = undefined;
  h.neo.length = 0;
  h.events.length = 0;
  h.pg = await createFakePg(["db-migration-007-question-owner.sql"]);
  await h.pg.db.exec(`
    ALTER TABLE exams ADD COLUMN IF NOT EXISTS description TEXT;
    CREATE TABLE courses (id VARCHAR(50) PRIMARY KEY, title VARCHAR(255), created_by VARCHAR(50));
    CREATE TABLE lessons (id VARCHAR(50) PRIMARY KEY, title VARCHAR(255), question_ids JSONB DEFAULT '[]', created_by VARCHAR(50));
    INSERT INTO courses VALUES ('co1','Khóa t1','t1'), ('co2','Khóa t2','t2'), ('coSys','Khóa chung',NULL);
    INSERT INTO questions (id,skill,category,prompt,content,created_by) VALUES
      ('q1','Reading','READING_MC','Câu 1','{"sub_questions":[{"id":"s1","text":"?","option_a":"a","option_b":"b","option_c":"c","option_d":"d","correct_answer":"A"}]}','t1'),
      ('q2','Writing','WRITING_ESSAY','Câu 2','{"min_words":150}','t1'),
      ('q3','Listening','LISTENING_MC','Câu 3','{"sub_questions":[]}','t2'),
      ('qFc','Reading','READING_FLASHCARD_SET','Thẻ','{"flashcard_ids":["f1"]}','t1');
    INSERT INTO flashcards (id,vietnamese_name,correct_english_word,options) VALUES ('f1','táo','apple','["apple"]');
    INSERT INTO exams (id,title,duration_minutes,skills,question_ids,created_by,description) VALUES
      ('eOld','Đề cũ',45,ARRAY['Reading'],'["qFc","q1"]','t1','Mô tả cũ'),
      ('eT2','Đề t2',30,ARRAY['Listening'],'["q3"]','t2',NULL);
  `);
});

describe("POST /api/teacher/exams — tạo đề", () => {
  const post = async (body: unknown) => (await import("@/app/api/teacher/exams/route")).POST(req("POST", "/api/teacher/exams", body));
  const valid = { title: "  Đề mới ", description: "HD", duration_minutes: 50, question_ids: ["q2", "q1"], course_id: "co1" };

  it("chưa đăng nhập 401; STUDENT 403", async () => {
    expect((await post(valid)).status).toBe(401);
    await loginAs("STUDENT", "s1");
    expect((await post(valid)).status).toBe(403);
  });

  it("201: id 'exam_' + uuid, created_by = người gọi, skills theo thứ tự câu, đồng bộ Neo4j + phát sự kiện EXAM_CREATED", async () => {
    await loginAs("TEACHER", "t1");
    const res = await post(valid);
    expect(res.status).toBe(201);
    const { exam } = await res.json();
    expect(exam.id).toMatch(/^exam_[0-9a-f-]{36}$/);
    expect(exam).toMatchObject({ title: "Đề mới", description: "HD", duration_minutes: 50, question_ids: ["q2", "q1"], skills: ["Writing", "Reading"], created_by: "t1" });
    expect(h.neo).toContainEqual(["sync", "co1", "Khóa t1", exam.id, "Đề mới"]);
    expect(h.events.some((e) => e[1] === "EXAM_CREATED")).toBe(true);
  });

  it("không gắn khóa → không gọi syncCourseExam; duration mặc định 60", async () => {
    await loginAs("TEACHER", "t1");
    const { exam } = await (await post({ title: "Đề", question_ids: ["q1"] })).json();
    expect(exam.duration_minutes).toBe(60);
    expect(h.neo.filter((n) => n[0] === "sync")).toEqual([]);
  });

  it("dữ liệu sai → 400, không ghi: thiếu tiêu đề, question_ids rỗng/không phải mảng, câu không tồn tại, câu của GV khác, khóa của GV khác, duration ≤ 0", async () => {
    await loginAs("TEACHER", "t1");
    for (const body of [
      { ...valid, title: " " }, { ...valid, question_ids: [] }, { ...valid, question_ids: "q1" },
      { ...valid, question_ids: ["qX"] }, { ...valid, question_ids: ["q3"] }, { ...valid, course_id: "co2" },
      { ...valid, duration_minutes: 0 },
    ]) expect((await post(body)).status, JSON.stringify(body)).toBe(400);
    expect((await rows(`SELECT COUNT(*)::int n FROM exams`))[0].n).toBe(2);
  });

  it("lỗi Neo4j không làm hỏng việc tạo đề", async () => {
    const neo = await import("@/lib/neo4j");
    const spy = vi.spyOn(neo, "syncCourseExam").mockRejectedValueOnce(new Error("down"));
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
    await loginAs("TEACHER", "t1");
    expect((await post(valid)).status).toBe(201);
    spy.mockRestore();
  });
});

describe("GET/PUT /api/teacher/exams/[id]", () => {
  const api = () => import("@/app/api/teacher/exams/[id]/route");

  it("GET đề của mình: exam + câu hỏi đúng thứ tự (kèm đáp án) + flashcard + course_id từ Neo4j", async () => {
    await loginAs("TEACHER", "t1");
    const res = await (await api()).GET(req("GET", "/x"), ctx("eOld"));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.exam).toMatchObject({ id: "eOld", title: "Đề cũ", description: "Mô tả cũ", duration_minutes: 45 });
    expect(json.questions.map((q: any) => q.id)).toEqual(["qFc", "q1"]);
    expect(json.questions[1].content.sub_questions[0].correct_answer).toBe("A");
    expect(json.flashcards.map((f: any) => f.id)).toEqual(["f1"]);
    expect(json.course_id).toBe("co1");
  });

  it("đề của GV khác → 403 (GET, PUT); không có → 404; ADMIN được", async () => {
    await loginAs("TEACHER", "t1");
    const { GET, PUT } = await api();
    expect((await GET(req("GET", "/x"), ctx("eT2"))).status).toBe(403);
    expect((await PUT(req("PUT", "/x", { title: "x" }), ctx("eT2"))).status).toBe(403);
    expect((await GET(req("GET", "/x"), ctx("eX"))).status).toBe(404);
    await loginAs("ADMIN", "a1");
    expect((await GET(req("GET", "/x"), ctx("eT2"))).status).toBe(200);
  });

  it("PUT chỉ cập nhật trường gửi lên; đổi question_ids tính lại skills; đổi course_id gỡ quan hệ cũ rồi gắn mới", async () => {
    await loginAs("TEACHER", "t1");
    const res = await (await api()).PUT(req("PUT", "/x", { question_ids: ["q2"], course_id: "coSys" }), ctx("eOld"));
    expect(res.status).toBe(200);
    const { exam } = await res.json();
    expect(exam).toMatchObject({ title: "Đề cũ", duration_minutes: 45, question_ids: ["q2"], skills: ["Writing"] });
    expect(h.neo.some((n) => n[0] === "cypher" && /DELETE/i.test(n[1]) && n[2]?.examId === "eOld")).toBe(true);
    expect(h.neo).toContainEqual(["sync", "coSys", "Khóa chung", "eOld", "Đề cũ"]);
  });

  it("PUT dữ liệu sai → 400 không ghi", async () => {
    await loginAs("TEACHER", "t1");
    const { PUT } = await api();
    expect((await PUT(req("PUT", "/x", { question_ids: ["q3"] }), ctx("eOld"))).status).toBe(400);
    expect((await PUT(req("PUT", "/x", { title: "" }), ctx("eOld"))).status).toBe(400);
    expect((await rows(`SELECT question_ids FROM exams WHERE id='eOld'`))[0].question_ids).toEqual(["qFc", "q1"]);
  });
});

// ── Trang tạo đề & component dùng chung ───────────────────────────────────
const COMP = "components/question-builder/QuestionSetEditor.tsx";
const PAGE = "app/teacher/tests/create/page.tsx";
const read = (p: string) => fs.readFileSync(p, "utf8");

describe("QuestionSetEditor tách khỏi trang tạo đề", () => {
  it("component tồn tại, là client component, có export default và hỗ trợ mode EXAM/LESSON", () => {
    const src = read(COMP);
    expect(src.trimStart().startsWith('"use client"')).toBe(true);
    expect(src).toMatch(/export default function QuestionSetEditor/);
    expect(src).toMatch(/"EXAM"\s*\|\s*"LESSON"|"LESSON"\s*\|\s*"EXAM"/);
    expect(src).toMatch(/onSave/);
  });

  it("component lưu câu hỏi qua /api/teacher/questions, lấy khóa học qua /api/teacher/courses", () => {
    const src = read(COMP);
    expect(src).toContain("/api/teacher/questions");
    expect(src).toContain("/api/teacher/courses");
  });

  it("trang tạo đề mỏng: dùng QuestionSetEditor, gọi /api/teacher/exams, < 400 dòng", () => {
    const src = read(PAGE);
    expect(src).toContain("QuestionSetEditor");
    expect(src).toContain("/api/teacher/exams");
    expect(src.split("\n").length).toBeLessThan(400);
  });

  it("không còn ghi đề/câu hỏi trực tiếp qua Supabase, không import Neo4j/mock-data ở trình duyệt, không id cứng", () => {
    for (const file of [COMP, PAGE]) {
      const src = read(file);
      for (const bad of ['from("questions")', 'from("exams")', "@/lib/neo4j", "@/lib/mock-data", "INITIAL_COURSES", "usr_teacher_01"]) {
        expect(src, `${file}: ${bad}`).not.toContain(bad);
      }
    }
  });

  it("chế độ LESSON ẩn thời gian làm bài, chọn khóa học và tab AI Import", () => {
    const src = read(COMP);
    expect(src).toMatch(/mode\s*===\s*"EXAM"|mode\s*!==\s*"LESSON"|isExamMode/);
  });
});
