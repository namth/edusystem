// FEAT-009 AI Exam Ingestion (khôi phục 31/10/2026) — phân quyền, kiểm tra file, giao dịch import.
// FEAT-015 (TASK-052): ai-parse trả conversion, AI lượt 2, báo admin; ai-import nhận câu đã chuyển dạng + kiểm content.
/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { createFakePg } from "./helpers/pg-fake";

const h = vi.hoisted(() => {
  process.env.JWT_SECRET = "test_secret_for_vitest_only_0123456789abcdef";
  return {
    token: undefined as string | undefined,
    pg: null as null | Awaited<ReturnType<typeof import("./helpers/pg-fake").createFakePg>>,
    parseCalls: 0,
    parsedQuestions: [] as any[],
    refineCalls: [] as any[],
    refineResult: null as any,
    alerts: [] as any[],
    throwAi: false,
    throwTooLong: false,
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
vi.mock("@/lib/document-parser", async () => {
  class AiUnavailableError extends Error {
    code = "AI_UNAVAILABLE";
  }
  class DocumentTooLongError extends Error {
    code = "DOCUMENT_TOO_LONG";
  }
  return {
    AiUnavailableError,
    DocumentTooLongError,
    parseDocumentFile: async () => {
      h.parseCalls++;
      if (h.throwAi) throw new AiUnavailableError("AI đang bận, vui lòng thử lại sau ít phút.");
      if (h.throwTooLong) throw new DocumentTooLongError("File scan có 158 trang, vượt giới hạn 40 trang mỗi lần nhập.");
      const { normalizeGroup } = await vi.importActual<typeof import("@/lib/document-parser")>("@/lib/document-parser");
      return { engineUsed: "mammoth", structuredData: { examTitle: "Đề", suggestedDurationMinutes: 45, groups: h.parsedQuestions.map((g, i) => normalizeGroup(g, i)) } };
    },
    refineGroupWithAi: async (group: any, reasons: any) => {
      h.refineCalls.push({ tempId: group.tempId, reasons });
      return h.refineResult ? h.refineResult(group) : null;
    },
  };
});
vi.mock("@/lib/admin-alerts", async (orig) => ({
  ...(await orig<any>()),
  reportAlert: async (a: any) => {
    h.alerts.push(a);
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
  h.refineCalls = [];
  h.refineResult = null;
  h.alerts = [];
  h.throwAi = false;
  h.throwTooLong = false;
  h.parsedQuestions = [
    { skill: "Reading", prompt: "Q", sub_questions: [
      { number: 1, text_html: "a", options: ["x", "y", "z", "t"], correct_answer: "A", answer_source: "KEY", paper_format: "GENERAL_MC", confidence: 0.9 },
      { number: 2, text_html: "b", options: ["x", "y", "z", "t"], correct_answer: "B", answer_source: "KEY", paper_format: "GENERAL_MC", confidence: 0.9 },
    ] },
  ];
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
    expect(body.extractedData.groups[0].sub_questions[1]).toMatchObject({ number: 2, paper_format: "GENERAL_MC" });
    expect(body.conversion).toMatchObject({ converterVersion: 2, scoreItems: 2, paperQuestions: 2, warningsCount: 0 });
    expect(body.conversion.groups[0].questions[0]).toMatchObject({ category: "READING_MC" });
  });

  it("TC-I10: dạng chưa hỗ trợ → READING_MC + cảnh báo + đúng một reportAlert WARN, không lộ tên file", async () => {
    h.parsedQuestions = [{ skill: "Reading", prompt: "Look at the sign", sub_questions: [
      { number: 3, text_html: "[HÌNH ẢNH] What does the sign say?", options: ["a", "b", "c", "d"], correct_answer: "C", answer_source: "KEY", paper_format: "UNSUPPORTED", unsupported_reason: "NEEDS_IMAGE", confidence: 0.8 },
    ] }];
    await loginAs("TEACHER", "t1");
    const body = await (await post(docx())).json();
    expect(body.conversion.groups[0].questions[0].category).toBe("READING_MC");
    expect(body.conversion.groups[0].warnings.map((w: any) => w.code)).toContain("UNSUPPORTED_FORMAT");
    const unsupported = h.alerts.filter((a) => a.fingerprint === "EXAM_IMPORT:UNSUPPORTED:NEEDS_IMAGE");
    expect(unsupported).toHaveLength(1);
    expect(unsupported[0]).toMatchObject({ level: "WARN", source: "EXAM_IMPORT", detail: { userId: "t1", extra: { fileExt: "docx" } } });
    expect(JSON.stringify(h.alerts)).not.toContain("de-thi.docx");
    expect(unsupported[0].detail.extra.sample).toContain("What does the sign say?");
  });

  it("TC-I11: không tìm thấy ô → gọi AI lượt 2 đúng một lần cho nhóm đó; lượt 2 sửa được → INLINE_SELECT; lỗi → READING_MC + GAP_NOT_FOUND + báo admin", async () => {
    const cloze = {
      skill: "Reading", prompt: "Cloze", stimulus_html: "People rely on machines, which have changed lives.",
      sub_questions: [
        { number: 25, text_html: "Câu 25", options: ["increasingly", "b", "c", "d"], correct_answer: "A", answer_source: "KEY", paper_format: "CLOZE_PASSAGE", confidence: 0.9 },
        { number: 26, text_html: "Câu 26", options: ["have", "has", "c", "d"], correct_answer: "B", answer_source: "KEY", paper_format: "CLOZE_PASSAGE", confidence: 0.9 },
      ],
    };
    h.parsedQuestions = [cloze, h.parsedQuestions[0]];
    await loginAs("TEACHER", "t1");
    let body = await (await post(docx())).json();
    expect(h.refineCalls).toEqual([{ tempId: "group_1", reasons: ["GAP_NOT_FOUND"] }]);
    expect(body.conversion.groups[0].questions[0].category).toBe("READING_MC");
    expect(body.conversion.groups[0].warnings.map((w: any) => w.code)).toContain("GAP_NOT_FOUND");
    expect(h.alerts.some((a) => a.fingerprint.startsWith("EXAM_IMPORT:CONVERSION_FAILED:"))).toBe(true);

    h.refineCalls = [];
    h.alerts = [];
    h.refineResult = (g: any) => ({ ...g, stimulus_html: "People (25) ____ rely on machines, which (26) ____ changed lives." });
    body = await (await post(docx())).json();
    expect(h.refineCalls).toHaveLength(1);
    expect(body.conversion.groups[0].questions[0].content).toMatchObject({ fill_subtype: "INLINE_SELECT", correct_answers: ["increasingly", "has"] });
    expect(body.extractedData.groups[0].stimulus_html).toContain("(25) ____");
    expect(h.alerts.some((a) => a.fingerprint.startsWith("EXAM_IMPORT:CONVERSION_FAILED:"))).toBe(false);
  });

  it("mọi nhà cung cấp AI lỗi → 503 + reportAlert ERROR nguồn AI", async () => {
    h.throwAi = true;
    await loginAs("TEACHER", "t1");
    const res = await post(docx());
    expect(res.status).toBe(503);
    expect(h.alerts).toEqual([expect.objectContaining({ level: "ERROR", source: "AI", fingerprint: "AI:EXAM_IMPORT:ALL_PROVIDERS_FAILED" })]);
  });

  it("BR-I18: file quá dài → 400 DOCUMENT_TOO_LONG kèm hướng dẫn tách file, không báo admin", async () => {
    h.throwTooLong = true;
    await loginAs("TEACHER", "t1");
    const res = await post(docx());
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ success: false, code: "DOCUMENT_TOO_LONG", error: expect.stringContaining("40 trang") });
    expect(h.alerts).toEqual([]);
  });

  it("cắt còn tối đa 50 nhóm câu hỏi", async () => {
    h.parsedQuestions = Array.from({ length: 60 }, (_, i) => ({ prompt: `Q${i}`, sub_questions: [{ number: i + 1, text_html: "x", options: ["a", "b"], correct_answer: "A", paper_format: "GENERAL_MC" }] }));
    await loginAs("ADMIN", "a1");
    const body = await (await post(docx())).json();
    expect(body.groupsCount).toBe(50);
  });
});

describe("POST /api/teacher/exams/ai-import", () => {
  const post = async (body: unknown) =>
    (await import("@/app/api/teacher/exams/ai-import/route")).POST(json("POST", "/api/teacher/exams/ai-import", body));
  const count = async (t: string) => Number((await h.pg!.db.query<any>(`SELECT COUNT(*) n FROM ${t}`)).rows[0].n);
  const mc = (id: string, ans: string) => ({ id, number: 1, text: "s", option_a: "x", option_b: "y", option_c: "z", option_d: "t", correct_answer: ans });
  const questions = [
    { tempId: "g1_0", skill: "Reading", category: "READING_MC", prompt: "Câu 1", stimulus_text: "Bài đọc", content: { sub_questions: [mc("a", "A")], import_meta: { paper_format: "READING_COMPREHENSION" } } },
    { tempId: "g2_0", skill: "Listening", category: "LISTENING_MC", prompt: "Câu 2", stimulus_text: null, content: { sub_questions: [mc("b", "B")] } },
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
    expect(byId[exam.question_ids[0]].content.import_meta).toMatchObject({ source: "AI_IMPORT", paper_format: "READING_COMPREHENSION" });
  });

  it("FEAT-015: lưu nguyên câu điền ô đã chuyển dạng, stimulus_text = NULL, chấm được", async () => {
    await loginAs("TEACHER", "t1");
    const fill = {
      tempId: "g3_0", skill: "Reading", category: "READING_FILL_IN", prompt: "Cloze", stimulus_text: null,
      content: { fill_subtype: "INLINE_SELECT", passage: "A (25) [has] b (26) [in] c", correct_answers: ["has", "in"],
        inline_options_per_gap: [{ gap_index: 0, options: ["have", "has"] }, { gap_index: 1, options: ["in", "on"] }] },
    };
    const res = await post({ examTitle: "Đề", questions: [fill] });
    expect(res.status).toBe(201);
    const q = (await h.pg!.db.query<any>(`SELECT * FROM questions`)).rows[0];
    expect(q).toMatchObject({ category: "READING_FILL_IN", stimulus_text: null });
    expect(q.content).toMatchObject({ fill_subtype: "INLINE_SELECT", correct_answers: ["has", "in"] });
    const { gradeQuestion } = await import("@/lib/grading");
    expect(gradeQuestion({ id: q.id, category: q.category, content: q.content }, ["has", "in"])).toMatchObject({ earned: 2, max: 2 });
  });

  it("TC-I14 + TC-I09: content sai schema / thiếu đáp án → 400 INVALID_CONTENT kèm invalid[], không ghi DB", async () => {
    await loginAs("TEACHER", "t1");
    const bad = [
      questions[0],
      { tempId: "x1", skill: "Reading", category: "READING_FILL_IN", prompt: "p", content: { fill_subtype: "OPTION_BANK", passage: "a [b] c [d]", correct_answers: ["b"], option_bank: ["b", "d"] } },
      { tempId: "x2", skill: "Reading", category: "READING_MC", prompt: "p", content: { sub_questions: [mc("c", "")] } },
      { tempId: "x3", skill: "Reading", category: "READING_MULTIPLE_CHOICE", prompt: "p", content: {} },
    ];
    const res = await post({ examTitle: "Đề", questions: bad });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.code).toBe("INVALID_CONTENT");
    expect(body.invalid.map((x: any) => x.tempId)).toEqual(["x1", "x2", "x3"]);
    expect(await count("questions")).toBe(0);
    expect(await count("exams")).toBe(0);
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
