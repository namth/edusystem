// FEAT-009 AI Exam Ingestion (khôi phục 31/10/2026) — phân quyền, kiểm tra file, giao dịch import.
import { describe, it, expect, vi, beforeEach } from "vitest";
import { createFakePg } from "./helpers/pg-fake";

const h = vi.hoisted(() => {
  process.env.JWT_SECRET = "test_secret_for_vitest_only_0123456789abcdef";
  return {
    token: undefined as string | undefined,
    pg: null as null | Awaited<ReturnType<typeof import("./helpers/pg-fake").createFakePg>>,
    parseCalls: 0,
    parsedQuestions: [] as any[],
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
  // PGlite là một kết nối duy nhất → BEGIN/COMMIT/SAVEPOINT chạy đúng như pg thật
  getPgPool: () => ({
    connect: async () => ({
      query: (sql: string, params?: unknown[]) => h.pg!.queryPg(sql, params),
      release: () => {},
    }),
  }),
  ensureSchema: async () => {},
}));
vi.mock("@/lib/neo4j", () => ({ syncCourseExam: async () => {} }));
vi.mock("@/lib/document-parser", () => ({
  parseDocumentFile: async () => {
    h.parseCalls++;
    return { engineUsed: "mammoth", structuredData: { questions: h.parsedQuestions } };
  },
}));

import { signJwtToken } from "@/lib/jwt";

type Role = "ADMIN" | "TEACHER" | "STUDENT";
async function loginAs(role: Role | null, userId?: string) {
  h.token = role ? await signJwtToken({ userId: userId!, email: `${userId}@x.vn`, role }) : undefined;
}
const json = (method: string, url: string, body?: unknown) =>
  new Request(`http://localhost${url}`, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
function upload(file?: File) {
  const fd = new FormData();
  if (file) fd.append("file", file);
  fd.append("targetSkill", "Auto");
  return new Request("http://localhost/api/teacher/exams/ai-parse", { method: "POST", body: fd });
}

beforeEach(async () => {
  h.token = undefined;
  h.parseCalls = 0;
  h.parsedQuestions = [{ skill: "Reading", category: "READING_MULTIPLE_CHOICE", prompt: "Q", sub_questions: [{ id: "a" }, { id: "b" }] }];
  h.pg = await createFakePg(["db-migration-005-system-settings.sql"]);
  await h.pg.db.exec(`
    CREATE TABLE courses (id VARCHAR(50) PRIMARY KEY, title VARCHAR(255), curriculum JSONB, created_by VARCHAR(50));
    INSERT INTO courses VALUES
      ('co1','Khóa của t1','[{"id":"u1","type":"UNIT","title":"Unit 1","children":[]}]','t1'),
      ('co2','Khóa của t2','[]','t2');
  `);
});

describe("POST /api/teacher/exams/ai-parse", () => {
  const post = async (file?: File) => (await import("@/app/api/teacher/exams/ai-parse/route")).POST(upload(file));
  const docx = (size = 10) => new File([new Uint8Array(size)], "de-thi.docx", { type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" });

  it("chưa đăng nhập → 401; STUDENT → 403; không gọi AI", async () => {
    expect((await post(docx())).status).toBe(401);
    await loginAs("STUDENT", "s1");
    expect((await post(docx())).status).toBe(403);
    expect(h.parseCalls).toBe(0);
  });

  it("thiếu file → 400; đuôi không hỗ trợ → 400; quá 15MB → 400", async () => {
    await loginAs("TEACHER", "t1");
    expect((await post()).status).toBe(400);
    expect((await post(new File(["x"], "virus.exe"))).status).toBe(400);
    expect((await post(docx(15 * 1024 * 1024 + 1))).status).toBe(400);
    expect(h.parseCalls).toBe(0);
  });

  it("file hợp lệ → trả dữ liệu bóc tách và số câu (tính cả câu con)", async () => {
    await loginAs("TEACHER", "t1");
    const res = await post(docx());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({ success: true, fileType: "docx", engineUsed: "mammoth", groupsCount: 1, questionsCount: 2 });
  });

  it("cắt còn tối đa 50 nhóm câu hỏi", async () => {
    h.parsedQuestions = Array.from({ length: 60 }, (_, i) => ({ prompt: `Q${i}` }));
    await loginAs("ADMIN", "a1");
    const body = await (await post(docx())).json();
    expect(body.groupsCount).toBe(50);
  });
});

describe("POST /api/teacher/exams/ai-import", () => {
  const post = async (body: unknown) =>
    (await import("@/app/api/teacher/exams/ai-import/route")).POST(json("POST", "/api/teacher/exams/ai-import", body));
  const count = async (t: string) => Number((await h.pg!.db.query<any>(`SELECT COUNT(*) n FROM ${t}`)).rows[0].n);
  const questions = [
    { skill: "Reading", category: "READING_MULTIPLE_CHOICE", prompt: "Câu 1", stimulus_text: "Bài đọc", options: [{ key: "A", text: "x" }], content: { correct_answer: "a" } },
    { skill: "Listening", category: "LISTENING_MULTIPLE_CHOICE", prompt: "Câu 2", sub_questions: [{ number: 1, text: "s1", options: [{ key: "B", text: "y" }], correct_answer: "b" }] },
  ];

  it("chưa đăng nhập → 401; STUDENT → 403; không ghi DB", async () => {
    expect((await post({ examTitle: "Đề", questions })).status).toBe(401);
    await loginAs("STUDENT", "s1");
    expect((await post({ examTitle: "Đề", questions })).status).toBe(403);
    expect(await count("exams")).toBe(0);
  });

  it("thiếu tiêu đề hoặc danh sách câu rỗng → 400", async () => {
    await loginAs("TEACHER", "t1");
    expect((await post({ examTitle: "", questions })).status).toBe(400);
    expect((await post({ examTitle: "Đề", questions: [] })).status).toBe(400);
  });

  it("vào Kho Đề: tạo câu hỏi + đề, question_ids đúng thứ tự, created_by = người gọi", async () => {
    await loginAs("TEACHER", "t1");
    const res = await post({ examTitle: "Đề AI", durationMinutes: 45, destination: { type: "STANDALONE" }, questions });
    expect(res.status).toBe(201);
    const body = await res.json();
    const exam = (await h.pg!.db.query<any>(`SELECT * FROM exams WHERE id = $1`, [body.examId])).rows[0];
    expect(exam).toMatchObject({ title: "Đề AI", duration_minutes: 45, created_by: "t1" });
    expect(exam.skills.sort()).toEqual(["Listening", "Reading"]);
    const qs = (await h.pg!.db.query<any>(`SELECT id, prompt, content FROM questions`)).rows;
    const byId = Object.fromEntries(qs.map((q: any) => [q.id, q]));
    expect(exam.question_ids.map((id: string) => byId[id].prompt)).toEqual(["Câu 1", "Câu 2"]);
    expect(byId[exam.question_ids[0]].content.sub_questions[0].correct_answer).toBe("A");
  });

  it("bảng ai_usage_logs không tồn tại → đề vẫn được lưu (lỗi log không huỷ giao dịch)", async () => {
    await loginAs("TEACHER", "t1");
    const res = await post({ examTitle: "Đề", questions });
    expect(res.status).toBe(201);
    expect(await count("exams")).toBe(1);
    expect(await count("questions")).toBe(2);
  });

  it("gắn vào khóa học của mình → thêm nút EXAM vào unit chỉ định", async () => {
    await loginAs("TEACHER", "t1");
    const res = await post({ examTitle: "Đề Unit", questions, destination: { type: "COURSE_CURRICULUM", courseId: "co1", unitId: "u1" } });
    expect(res.status).toBe(201);
    const { examId } = await res.json();
    const cur = (await h.pg!.db.query<any>(`SELECT curriculum FROM courses WHERE id='co1'`)).rows[0].curriculum;
    expect(cur[0].children).toEqual([expect.objectContaining({ type: "EXAM", exam_id: examId, title: "Đề Unit" })]);
  });

  it("TEACHER gắn vào khóa học của người khác → 403, không ghi gì", async () => {
    await loginAs("TEACHER", "t1");
    const res = await post({ examTitle: "Đề", questions, destination: { type: "COURSE_CURRICULUM", courseId: "co2" } });
    expect(res.status).toBe(403);
    expect(await count("exams")).toBe(0);
    expect(await count("questions")).toBe(0);
  });

  it("ADMIN gắn được vào mọi khóa học; khóa học không tồn tại → 404", async () => {
    await loginAs("ADMIN", "a1");
    expect((await post({ examTitle: "Đề", questions, destination: { type: "COURSE_CURRICULUM", courseId: "co2" } })).status).toBe(201);
    expect((await post({ examTitle: "Đề", questions, destination: { type: "COURSE_CURRICULUM", courseId: "coX" } })).status).toBe(404);
  });
});

describe("/api/admin/settings/ai-model — chỉ ADMIN", () => {
  const load = () => import("@/app/api/admin/settings/ai-model/route");

  it("GET: chưa đăng nhập 401, TEACHER 403, ADMIN thấy cấu hình mặc định", async () => {
    const { GET } = await load();
    expect((await GET()).status).toBe(401);
    await loginAs("TEACHER", "t1");
    expect((await GET()).status).toBe(403);
    await loginAs("ADMIN", "a1");
    const body = await (await GET()).json();
    expect(body.success).toBe(true);
    expect(body.config).toMatchObject({ provider: "google", model: expect.any(String) });
  });

  it("PUT: TEACHER 403; ADMIN cập nhật được và lưu vào system_settings", async () => {
    const { PUT } = await load();
    await loginAs("TEACHER", "t1");
    expect((await PUT(json("PUT", "/api/admin/settings/ai-model", { model: "gpt-4o" }))).status).toBe(403);
    await loginAs("ADMIN", "a1");
    const res = await PUT(json("PUT", "/api/admin/settings/ai-model", { model: "gpt-4o", provider: "openai" }));
    expect(res.status).toBe(200);
    const row = (await h.pg!.db.query<any>(`SELECT value, updated_by FROM system_settings WHERE key='ai_exam_ingestion_model'`)).rows[0];
    expect(row.value).toMatchObject({ model: "gpt-4o", provider: "openai" });
    expect(row.updated_by).toBe("a1");
  });
});
