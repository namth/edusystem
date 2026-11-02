// TASK-008 — API câu hỏi dùng chung + Kho bài học + lộ trình nhận lesson_id (FEAT-010, TC-L03/L04).
// File do trưởng phòng viết, bị khoá.
import { describe, it, expect, vi, beforeEach } from "vitest";
import { createFakePg } from "./helpers/pg-fake";

const h = vi.hoisted(() => {
  process.env.JWT_SECRET = "test_secret_for_vitest_only_0123456789abcdef";
  return {
    token: undefined as string | undefined,
    pg: null as null | Awaited<ReturnType<typeof import("./helpers/pg-fake").createFakePg>>,
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
  h.pg = await createFakePg(["db-migration-007-question-owner.sql"]);
  await h.pg.db.exec(`
    CREATE TABLE courses (id VARCHAR(50) PRIMARY KEY, title VARCHAR(255), created_by VARCHAR(50));
    CREATE TABLE curriculum_items (
      id VARCHAR(50) PRIMARY KEY, course_id VARCHAR(50) NOT NULL, parent_id VARCHAR(50), title VARCHAR(255) NOT NULL,
      type VARCHAR(20) NOT NULL, exam_id VARCHAR(50), order_index INT DEFAULT 0, created_by VARCHAR(50),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);
  // migration 006 cần bảng classes (có sẵn trong pg-fake) + curriculum_items vừa tạo
  await h.pg.db.exec((await import("fs")).readFileSync("docs/db-migration-006-lessons.sql", "utf8"));
  await h.pg.db.exec(`
    INSERT INTO courses VALUES ('co1','Khóa t1','t1'), ('co2','Khóa t2','t2');
    INSERT INTO questions (id,skill,category,prompt,content,created_by) VALUES
      ('q1','Reading','READING_MC','Câu 1','{"sub_questions":[{"id":"s1","text":"?","option_a":"a","option_b":"b","option_c":"c","option_d":"d","correct_answer":"A"}]}','t1'),
      ('q2','Listening','LISTENING_FILL_IN','Câu 2','{"fill_subtype":"OPTION_BANK","passage":"I (am) ok"}','t1'),
      ('q3','Writing','WRITING_ESSAY','Câu 3','{"min_words":150,"task_type":"Task 2"}','t2'),
      ('qLegacy','Reading','READING_MC','Cũ','{"sub_questions":[]}',NULL),
      ('qFc','Reading','READING_FLASHCARD_SET','Thẻ','{"flashcard_ids":["f1"]}','t1');
    INSERT INTO flashcards (id,vietnamese_name,correct_english_word,options) VALUES ('f1','táo','apple','["apple","pear"]');
    INSERT INTO exams (id,title,question_ids,created_by) VALUES ('eT1','Đề t1','["qLegacy"]','t1');
    INSERT INTO lessons (id,title,question_ids,skills,created_by) VALUES
      ('lsn_a','Bài A','["q1","q2"]',ARRAY['Reading','Listening'],'t1'),
      ('lsn_empty','Bài trống','[]','{}','t1'),
      ('lsn_t2','Bài t2','["q3"]',ARRAY['Writing'],'t2');
    INSERT INTO curriculum_items (id,course_id,parent_id,title,type,order_index,created_by,lesson_id) VALUES
      ('U1','co1',NULL,'Unit 1','UNIT',1,'t1',NULL),
      ('N1','co1','U1','Bài A trong lộ trình','LESSON',1,'t1','lsn_a');
  `);
});

// ─────────────────────────────────────────────────────────────────────────────
describe("POST/PUT /api/teacher/questions", () => {
  const post = async (body: unknown) => (await import("@/app/api/teacher/questions/route")).POST(req("POST", "/api/teacher/questions", body));
  const put = async (id: string, body: unknown) =>
    (await import("@/app/api/teacher/questions/[id]/route")).PUT(req("PUT", `/api/teacher/questions/${id}`, body), ctx(id));
  const valid = { skill: "Reading", category: "READING_MC", prompt: "Mới", content: { sub_questions: [{ id: "s1", text: "?", option_a: "a", option_b: "b", option_c: "c", option_d: "d", correct_answer: "C" }] } };

  it("chưa đăng nhập 401; STUDENT 403", async () => {
    expect((await post(valid)).status).toBe(401);
    await loginAs("STUDENT", "s1");
    expect((await post(valid)).status).toBe(403);
  });

  it("tạo câu hỏi: 201, id 'q_' + uuid, created_by = người gọi, content đã chuẩn hoá vẫn giữ đáp án", async () => {
    await loginAs("TEACHER", "t1");
    const res = await post(valid);
    expect(res.status).toBe(201);
    const { question } = await res.json();
    expect(question.id).toMatch(/^q_[0-9a-f-]{36}$/);
    expect(question).toMatchObject({ skill: "Reading", category: "READING_MC", prompt: "Mới", created_by: "t1" });
    const db = (await rows(`SELECT content, created_by FROM questions WHERE id='${question.id}'`))[0];
    expect(db.created_by).toBe("t1");
    expect(db.content.sub_questions[0].correct_answer).toBe("C");
  });

  it("dạng câu không hợp lệ / thiếu skill → 400", async () => {
    await loginAs("TEACHER", "t1");
    expect((await post({ ...valid, category: "QUIZ_X" })).status).toBe(400);
    expect((await post({ ...valid, skill: "" })).status).toBe(400);
    expect((await post({ ...valid, content: "abc" })).status).toBe(400);
  });

  it("sửa câu hỏi của mình → 200; của giáo viên khác → 403; không có → 404", async () => {
    await loginAs("TEACHER", "t1");
    const res = await put("q1", { prompt: "Câu 1 sửa" });
    expect(res.status).toBe(200);
    expect((await res.json()).question.prompt).toBe("Câu 1 sửa");
    expect((await put("q3", { prompt: "x" })).status).toBe(403);
    expect((await put("qX", { prompt: "x" })).status).toBe(404);
  });

  it("câu hỏi cũ (created_by NULL): sửa được nếu nằm trong đề/bài học của mình, ngược lại 403; ADMIN sửa mọi câu", async () => {
    await loginAs("TEACHER", "t1");
    expect((await put("qLegacy", { prompt: "ok" })).status).toBe(200);
    await loginAs("TEACHER", "t2");
    expect((await put("qLegacy", { prompt: "no" })).status).toBe(403);
    await loginAs("ADMIN", "a1");
    expect((await put("q3", { prompt: "admin" })).status).toBe(200);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe("/api/teacher/lessons — danh sách & tạo", () => {
  const api = () => import("@/app/api/teacher/lessons/route");

  it("chưa đăng nhập 401; STUDENT 403", async () => {
    const { GET, POST } = await api();
    expect((await GET(req("GET", "/api/teacher/lessons"))).status).toBe(401);
    await loginAs("STUDENT", "s1");
    expect((await GET(req("GET", "/api/teacher/lessons"))).status).toBe(403);
    expect((await POST(req("POST", "/api/teacher/lessons", { title: "x" }))).status).toBe(403);
  });

  it("TEACHER chỉ thấy bài của mình, có block_count và usage_count", async () => {
    await loginAs("TEACHER", "t1");
    const { lessons } = await (await (await api()).GET(req("GET", "/api/teacher/lessons"))).json();
    expect(lessons.map((l: any) => l.id).sort()).toEqual(["lsn_a", "lsn_empty"]);
    const a = lessons.find((l: any) => l.id === "lsn_a");
    expect(a).toMatchObject({ title: "Bài A", block_count: 2, usage_count: 1, skills: ["Reading", "Listening"] });
    expect(lessons.find((l: any) => l.id === "lsn_empty")).toMatchObject({ block_count: 0, usage_count: 0 });
  });

  it("ADMIN thấy tất cả; lọc q (không phân biệt hoa thường) và skill", async () => {
    await loginAs("ADMIN", "a1");
    const { GET } = await api();
    expect((await (await GET(req("GET", "/api/teacher/lessons"))).json()).lessons).toHaveLength(3);
    expect((await (await GET(req("GET", "/api/teacher/lessons?q=bài%20a"))).json()).lessons.map((l: any) => l.id)).toEqual(["lsn_a"]);
    expect((await (await GET(req("GET", "/api/teacher/lessons?skill=Writing"))).json()).lessons.map((l: any) => l.id)).toEqual(["lsn_t2"]);
  });

  it("tạo bài học: 201, id 'lsn_' + uuid, trim tiêu đề, created_by = người gọi; tiêu đề rỗng/quá dài → 400", async () => {
    await loginAs("TEACHER", "t1");
    const { POST } = await api();
    const res = await POST(req("POST", "/api/teacher/lessons", { title: "  Bài mới ", description: "Mô tả" }));
    expect(res.status).toBe(201);
    const { lesson } = await res.json();
    expect(lesson.id).toMatch(/^lsn_[0-9a-f-]{36}$/);
    expect(lesson).toMatchObject({ title: "Bài mới", description: "Mô tả", created_by: "t1", question_ids: [], skills: [] });
    expect((await POST(req("POST", "/api/teacher/lessons", { title: "  " }))).status).toBe(400);
    expect((await POST(req("POST", "/api/teacher/lessons", { title: "x".repeat(256) }))).status).toBe(400);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe("/api/teacher/lessons/[id] — xem, sửa, xoá", () => {
  const api = () => import("@/app/api/teacher/lessons/[id]/route");

  it("GET bài của mình: lesson + câu hỏi đúng thứ tự (kèm đáp án cho giáo viên) + flashcard", async () => {
    await h.pg!.db.exec(`UPDATE lessons SET question_ids='["q2","qFc","q1"]' WHERE id='lsn_a'`);
    await loginAs("TEACHER", "t1");
    const res = await (await api()).GET(req("GET", "/api/teacher/lessons/lsn_a"), ctx("lsn_a"));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.lesson).toMatchObject({ id: "lsn_a", title: "Bài A" });
    expect(json.questions.map((q: any) => q.id)).toEqual(["q2", "qFc", "q1"]);
    expect(json.questions[2].content.sub_questions[0].correct_answer).toBe("A");
    expect(json.flashcards.map((f: any) => f.id)).toEqual(["f1"]);
  });

  it("bài của giáo viên khác → 403 (GET/PUT/DELETE); không có → 404; ADMIN xem được", async () => {
    await loginAs("TEACHER", "t1");
    const { GET, PUT, DELETE } = await api();
    expect((await GET(req("GET", "/x"), ctx("lsn_t2"))).status).toBe(403);
    expect((await PUT(req("PUT", "/x", { title: "y" }), ctx("lsn_t2"))).status).toBe(403);
    expect((await DELETE(req("DELETE", "/x"), ctx("lsn_t2"))).status).toBe(403);
    expect((await GET(req("GET", "/x"), ctx("lsn_X"))).status).toBe(404);
    await loginAs("ADMIN", "a1");
    expect((await GET(req("GET", "/x"), ctx("lsn_t2"))).status).toBe(200);
  });

  it("PUT question_ids: lưu thứ tự, tự tính skills theo thứ tự xuất hiện, cập nhật updated_at", async () => {
    await loginAs("TEACHER", "t1");
    const before = (await rows(`SELECT updated_at FROM lessons WHERE id='lsn_empty'`))[0].updated_at;
    const res = await (await api()).PUT(req("PUT", "/x", { title: "Đổi tên", question_ids: ["q2", "q1", "qFc"] }), ctx("lsn_empty"));
    expect(res.status).toBe(200);
    const { lesson } = await res.json();
    expect(lesson).toMatchObject({ title: "Đổi tên", question_ids: ["q2", "q1", "qFc"], skills: ["Listening", "Reading"] });
    const after = (await rows(`SELECT updated_at FROM lessons WHERE id='lsn_empty'`))[0].updated_at;
    expect(new Date(after).getTime()).toBeGreaterThanOrEqual(new Date(before).getTime());
  });

  it("PUT question_ids chứa câu không tồn tại hoặc của giáo viên khác → 400, không ghi", async () => {
    await loginAs("TEACHER", "t1");
    const { PUT } = await api();
    expect((await PUT(req("PUT", "/x", { question_ids: ["q1", "qX"] }), ctx("lsn_empty"))).status).toBe(400);
    expect((await PUT(req("PUT", "/x", { question_ids: ["q3"] }), ctx("lsn_empty"))).status).toBe(400);
    expect((await PUT(req("PUT", "/x", { question_ids: "q1" }), ctx("lsn_empty"))).status).toBe(400);
    expect((await rows(`SELECT question_ids FROM lessons WHERE id='lsn_empty'`))[0].question_ids).toEqual([]);
  });

  it("DELETE bài đang được gắn trong lộ trình → 409 kèm usages, không xoá (DEC-005)", async () => {
    await loginAs("TEACHER", "t1");
    const res = await (await api()).DELETE(req("DELETE", "/x"), ctx("lsn_a"));
    expect(res.status).toBe(409);
    const json = await res.json();
    expect(json.success).toBe(false);
    expect(json.usages).toEqual([{ course_id: "co1", course_title: "Khóa t1", curriculum_item_id: "N1" }]);
    expect(await rows(`SELECT id FROM lessons WHERE id='lsn_a'`)).toHaveLength(1);
  });

  it("DELETE bài không dùng → 200 và xoá; câu hỏi dùng chung không bị xoá", async () => {
    await h.pg!.db.exec(`UPDATE lessons SET question_ids='["q1"]' WHERE id='lsn_empty'`);
    await loginAs("TEACHER", "t1");
    expect((await (await api()).DELETE(req("DELETE", "/x"), ctx("lsn_empty"))).status).toBe(200);
    expect(await rows(`SELECT id FROM lessons WHERE id='lsn_empty'`)).toHaveLength(0);
    expect(await rows(`SELECT id FROM questions WHERE id='q1'`)).toHaveLength(1);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe("/api/teacher/curriculum — nút LESSON trỏ lesson_id (DEC-002, DEC-012, BR-L03)", () => {
  const api = () => import("@/app/api/teacher/curriculum/route");
  const post = async (body: unknown) => (await api()).POST(req("POST", "/api/teacher/curriculum", body));

  it("tạo LESSON với bài học của mình (có ≥ 1 khối) → 201, item có lesson_id", async () => {
    await loginAs("TEACHER", "t1");
    const res = await post({ course_id: "co1", parent_id: "U1", title: "Bài A lần 2", type: "LESSON", lesson_id: "lsn_a" });
    expect(res.status).toBe(201);
    expect((await res.json()).item).toMatchObject({ type: "LESSON", lesson_id: "lsn_a" });
  });

  it("LESSON thiếu lesson_id / bài không tồn tại / bài trống / bài của người khác → 400", async () => {
    await loginAs("TEACHER", "t1");
    for (const lesson_id of [undefined, "lsn_X", "lsn_empty", "lsn_t2"]) {
      expect((await post({ course_id: "co1", parent_id: "U1", title: "x", type: "LESSON", lesson_id })).status, String(lesson_id)).toBe(400);
    }
  });

  it("GET trả lesson_id; PUT đổi lesson_id của nút LESSON được kiểm tra như POST", async () => {
    await loginAs("TEACHER", "t1");
    const { GET, PUT } = await api();
    const { items } = await (await GET(req("GET", "/api/teacher/curriculum?courseId=co1"))).json();
    expect(items.find((i: any) => i.id === "N1").lesson_id).toBe("lsn_a");
    expect((await PUT(req("PUT", "/api/teacher/curriculum", { items: [{ id: "N1", lesson_id: "lsn_empty" }] }))).status).toBe(400);
    await h.pg!.db.exec(`UPDATE lessons SET question_ids='["q1"]' WHERE id='lsn_empty'`);
    const res = await PUT(req("PUT", "/api/teacher/curriculum", { items: [{ id: "N1", lesson_id: "lsn_empty" }] }));
    expect(res.status).toBe(200);
    expect((await res.json()).items[0].lesson_id).toBe("lsn_empty");
  });
});
