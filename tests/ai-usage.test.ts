// TASK-038 — FEAT-013 §6, §7 (BR 9), DEC-034: ghi nhận token & chi phí AI theo model.
// File do trưởng phòng viết, bị khoá.
/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import fs from "fs";
import path from "path";
import { createFakePg } from "./helpers/pg-fake";

const h = vi.hoisted(() => {
  process.env.JWT_SECRET = "test_secret_for_vitest_only_0123456789abcdef";
  process.env.INTERNAL_API_TOKEN = "internal_test_token_xyz";
  return {
    token: undefined as string | undefined,
    pg: null as any,
    portkey: null as null | ((args: any) => any),
    openai: null as null | ((args: any) => any),
    events: [] as any[],
  };
});

vi.mock("next/headers", () => ({
  cookies: async () => ({ get: (n: string) => (n === "auth_token" && h.token ? { value: h.token } : undefined), set: () => {} }),
  headers: async () => new Headers(),
}));
vi.mock("@/lib/db-pg", () => ({
  queryPg: (sql: string, params?: unknown[]) => h.pg.queryPg(sql, params),
  getPgPool: () => ({ connect: async () => ({ query: (s: string, p?: unknown[]) => h.pg.queryPg(s, p), release: () => {} }) }),
  ensureSchema: async () => {},
}));
vi.mock("portkey-ai", () => ({
  Portkey: class {
    chat = { completions: { create: async (args: any) => { if (!h.portkey) throw new Error("portkey chưa cấu hình trong test"); return h.portkey(args); } } };
  },
}));
vi.mock("openai", () => ({
  default: class {
    chat = { completions: { create: async (args: any) => { if (!h.openai) throw new Error("openai chưa cấu hình trong test"); return h.openai(args); } } };
  },
}));
vi.mock("@/lib/redis-queue", () => ({
  pushRedisStreamEvent: async (...a: any[]) => { h.events.push(a); },
  pushGradingEvent: async (...a: any[]) => { h.events.push(["grading", ...a]); },
}));
vi.mock("@/lib/neo4j", () => ({
  syncStudentEnrolledInClass: async () => {},
  syncTeacherManagesClass: async () => {},
  syncCourseExam: async () => {},
  runCypherQuery: async () => [],
}));
// Hàm chấm/bóc tách giả gọi recordAiUsage THẬT, không truyền id → kiểm route đã đặt ngữ cảnh đúng.
vi.mock("@/lib/exam-ai-grading", () => ({
  gradeExamOpenAnswer: async () => {
    const { recordAiUsage } = await import("@/lib/ai-usage");
    await recordAiUsage({ provider: "portkey", model: "gemini-2.5-flash", promptTokens: 100, completionTokens: 20 });
    return { score: 6, feedback: "ok" };
  },
}));
vi.mock("@/lib/lesson-ai-grading", () => ({
  gradeOpenAnswer: async () => {
    const { recordAiUsage } = await import("@/lib/ai-usage");
    await recordAiUsage({ provider: "portkey", model: "gemini-2.5-flash", promptTokens: 70, completionTokens: 10 });
    return 6;
  },
}));
vi.mock("@/lib/document-parser", async (orig) => ({
  ...(await orig<any>()),
  parseDocumentFile: async () => {
    const { recordAiUsage } = await import("@/lib/ai-usage");
    await recordAiUsage({ provider: "google", model: "gemini-flash-lite-latest", promptTokens: 5000, completionTokens: 900 });
    return { success: true, rawText: "x", structuredData: { examTitle: "Đề", suggestedDurationMinutes: 30, questions: [] }, warnings: [] };
  },
}));

import { signJwtToken } from "@/lib/jwt";

async function loginAs(role: "ADMIN" | "TEACHER" | "STUDENT" | null, userId?: string) {
  h.token = role ? await signJwtToken({ userId: userId!, email: `${userId}@x.vn`, role }) : undefined;
}
const req = (method: string, url: string, body?: unknown, headers: Record<string, string> = {}) =>
  new Request(`http://localhost${url}`, { method, headers: { "Content-Type": "application/json", ...headers }, body: body === undefined ? undefined : JSON.stringify(body) });
const rows = async (sql: string, p: unknown[] = []) => (await h.pg.db.query(sql, p)).rows as any[];
const logs = () => rows(`SELECT * FROM ai_usage_logs ORDER BY created_at, id`);
const read = (f: string) => fs.readFileSync(f, "utf8");

const PRICING = { usd_vnd_rate: 25000, models: { "gemini-2.5-flash": { input_per_1m: 0.3, output_per_1m: 2.5 }, "gpt-4o-mini": { input_per_1m: 0.15, output_per_1m: 0.6 } } };

beforeEach(async () => {
  h.token = undefined;
  h.portkey = null;
  h.openai = null;
  h.events.length = 0;
  process.env.PORTKEY_API_KEY = "pk_test";
  process.env.PORTKEY_MODEL = "gemini-2.5-flash";
  delete process.env.OPENAI_API_KEY;
  delete process.env.GOOGLE_API_KEY;
  h.pg = await createFakePg(["db-migration-004-enrollments-assignments.sql", "db-migration-005-system-settings.sql"]);
  await h.pg.db.exec(`
    ALTER TABLE users ADD COLUMN slot_limit INT DEFAULT 250;
    CREATE TABLE courses (id VARCHAR(50) PRIMARY KEY, title VARCHAR(255), created_by VARCHAR(50));
    CREATE TABLE curriculum_items (id VARCHAR(50) PRIMARY KEY, course_id VARCHAR(50) NOT NULL, parent_id VARCHAR(50), title VARCHAR(255) NOT NULL,
      type VARCHAR(20) NOT NULL, exam_id VARCHAR(50), order_index INT DEFAULT 0, created_by VARCHAR(50), created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP);
  `);
  for (const m of ["006-lessons", "009-scoring-standards", "010-notifications", "014-ai-usage"]) {
    await h.pg.db.exec(read(`docs/db-migration-${m}.sql`));
  }
  await h.pg.db.query(`UPDATE system_settings SET value = $1::jsonb WHERE key = 'ai_pricing'`, [JSON.stringify(PRICING)]);
  await h.pg.db.exec(`
    INSERT INTO users (id,name,email,role) VALUES ('a1','Admin','a1@x.vn','ADMIN'), ('t1','GV','t1@x.vn','TEACHER'), ('s1','HS1','s1@x.vn','STUDENT');
    INSERT INTO classes (id,name,code,teacher_id,unlock_mode) VALUES ('c1','Lớp','AAA','t1','ALL_OPEN');
    INSERT INTO enrollments (id,student_id,class_id) VALUES ('en1','s1','c1');
  `);
});
afterEach(() => vi.unstubAllGlobals());

// ─────────────────────────────────────────────────────────────────────────────
describe("lib/ai-pricing.ts (thuần)", () => {
  it("costUsd = input×giá_in/1e6 + output×giá_out/1e6, model khớp chính xác hoặc phần sau dấu '/' cuối", async () => {
    const { costUsd, findModelPrice } = await import("@/lib/ai-pricing");
    expect(costUsd("gemini-2.5-flash", 1000, 200, PRICING)).toBeCloseTo(0.0008, 10);
    expect(costUsd("gpt-4o-mini", 1_000_000, 1_000_000, PRICING)).toBeCloseTo(0.75, 10);
    expect(costUsd("@nam-tran/gemini-2.5-flash", 1000, 200, PRICING)).toBeCloseTo(0.0008, 10);
    expect(costUsd("GEMINI-2.5-FLASH", 1000, 200, PRICING)).toBeCloseTo(0.0008, 10);
    expect(findModelPrice("gpt-4o-mini", PRICING)).toEqual({ input_per_1m: 0.15, output_per_1m: 0.6 });
  });

  it("model chưa có giá → 0 và findModelPrice → null; token âm/không phải số coi như 0", async () => {
    const { costUsd, findModelPrice } = await import("@/lib/ai-pricing");
    expect(costUsd("claude-x", 5000, 5000, PRICING)).toBe(0);
    expect(findModelPrice("claude-x", PRICING)).toBeNull();
    expect(costUsd("gemini-2.5-flash", -10, NaN as any, PRICING)).toBe(0);
  });

  it("usdToVnd làm tròn số nguyên VND", async () => {
    const { usdToVnd } = await import("@/lib/ai-pricing");
    expect(usdToVnd(0.0008, 25000)).toBe(20);
    expect(usdToVnd(1.23456, 26000)).toBe(32099);
    expect(Number.isInteger(usdToVnd(0.333333, 25123))).toBe(true);
  });

  it("validateAiPricing: chấp nhận cấu hình đúng, từ chối tỷ giá ≤ 0, giá âm, tên model rỗng, models không phải object", async () => {
    const { validateAiPricing } = await import("@/lib/ai-pricing");
    expect(validateAiPricing(PRICING)).toEqual({ ok: true, value: PRICING });
    const bad = [
      { ...PRICING, usd_vnd_rate: 0 },
      { ...PRICING, usd_vnd_rate: "25000" },
      { usd_vnd_rate: 25000, models: { "gpt-4o": { input_per_1m: -1, output_per_1m: 1 } } },
      { usd_vnd_rate: 25000, models: { "": { input_per_1m: 1, output_per_1m: 1 } } },
      { usd_vnd_rate: 25000, models: { "gpt-4o": { input_per_1m: 1 } } },
      { usd_vnd_rate: 25000, models: [] },
      null,
    ];
    for (const b of bad) {
      const r = validateAiPricing(b as any);
      expect(r.ok, JSON.stringify(b)).toBe(false);
      if (!r.ok) expect(r.error.length).toBeGreaterThan(5);
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe("lib/ai-usage.ts — recordAiUsage + withAiUsageContext", () => {
  it("ghi 1 dòng: token thật, total = in + out, cost_usd theo bảng giá trong system_settings, gộp ngữ cảnh", async () => {
    const { recordAiUsage, withAiUsageContext } = await import("@/lib/ai-usage");
    await withAiUsageContext({ purpose: "EXAM_GRADING", teacherId: "t1", studentId: "s1", submissionId: "sub_1" }, async () => {
      await recordAiUsage({ provider: "portkey", model: "gemini-2.5-flash", promptTokens: 1000, completionTokens: 200 });
    });
    const l = await logs();
    expect(l).toHaveLength(1);
    expect(l[0]).toMatchObject({
      purpose: "EXAM_GRADING", provider: "portkey", model: "gemini-2.5-flash",
      teacher_id: "t1", student_id: "s1", submission_id: "sub_1", lesson_attempt_id: null,
      prompt_tokens: 1000, completion_tokens: 200, total_tokens: 1200,
    });
    expect(Number(l[0].cost_usd)).toBeCloseTo(0.0008, 6);
  });

  it("ngoài ngữ cảnh → purpose OTHER; tham số truyền thẳng thắng ngữ cảnh; ngữ cảnh không rò sang lời gọi sau", async () => {
    const { recordAiUsage, withAiUsageContext, getAiUsageContext } = await import("@/lib/ai-usage");
    await recordAiUsage({ provider: "openai", model: "gpt-4o-mini", promptTokens: 10, completionTokens: 5 });
    await withAiUsageContext({ purpose: "LESSON_GRADING", lessonAttemptId: "att_1" }, async () => {
      expect(getAiUsageContext()?.lessonAttemptId).toBe("att_1");
      await recordAiUsage({ provider: "openai", model: "gpt-4o-mini", promptTokens: 1, completionTokens: 1, teacherId: "t9" });
    });
    expect(getAiUsageContext()).toBeUndefined();
    const l = await logs();
    expect(l.map((x) => [x.purpose, x.lesson_attempt_id, x.teacher_id])).toEqual([["OTHER", null, null], ["LESSON_GRADING", "att_1", "t9"]]);
  });

  it("ngữ cảnh đi qua await lồng nhau và Promise.all (AsyncLocalStorage), hai ngữ cảnh song song không lẫn", async () => {
    const { recordAiUsage, withAiUsageContext } = await import("@/lib/ai-usage");
    const job = (id: string) => withAiUsageContext({ purpose: "EXAM_GRADING", submissionId: id }, async () => {
      await new Promise((r) => setTimeout(r, 5));
      await Promise.all([1, 2].map(() => recordAiUsage({ provider: "p", model: "gemini-2.5-flash", promptTokens: 1, completionTokens: 1 })));
    });
    await Promise.all([job("A"), job("B")]);
    const l = await logs();
    expect(l.filter((x) => x.submission_id === "A")).toHaveLength(2);
    expect(l.filter((x) => x.submission_id === "B")).toHaveLength(2);
  });

  it("model chưa có giá → cost 0 nhưng vẫn ghi token; chưa có dòng ai_pricing → dùng mặc định, không lỗi", async () => {
    const { recordAiUsage } = await import("@/lib/ai-usage");
    await h.pg.db.exec(`DELETE FROM system_settings WHERE key='ai_pricing'`);
    await recordAiUsage({ provider: "x", model: "model-la", promptTokens: 300, completionTokens: 30 });
    const l = await logs();
    expect(l[0]).toMatchObject({ model: "model-la", total_tokens: 330 });
    expect(Number(l[0].cost_usd)).toBe(0);
  });

  it("lỗi DB khi ghi log → không ném lỗi ra ngoài (không làm hỏng việc chấm)", async () => {
    const { recordAiUsage } = await import("@/lib/ai-usage");
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
    await h.pg.db.exec(`DROP TABLE ai_usage_logs`);
    await expect(recordAiUsage({ provider: "x", model: "gemini-2.5-flash", promptTokens: 1, completionTokens: 1 })).resolves.toBeUndefined();
  });

  it("getAiPricing đọc system_settings, trả mặc định khi thiếu", async () => {
    const { getAiPricing } = await import("@/lib/ai-usage");
    expect(await getAiPricing()).toEqual(PRICING);
    await h.pg.db.exec(`DELETE FROM system_settings WHERE key='ai_pricing'`);
    const d = await getAiPricing();
    expect(d.usd_vnd_rate).toBeGreaterThan(0);
    expect(d.models).toEqual(expect.any(Object));
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe("lib/ai-engine.ts ghi token THẬT cho mọi lần gọi model", () => {
  const essay = "My family has four people. ".repeat(10);
  const evalJson = JSON.stringify({ overallScore: 6.5, criteriaScores: {}, feedback: "Ổn", errorsDetected: [], improvements: [] });

  it("Writing qua Portkey: 1 dòng với usage của response, model = response.model nếu có", async () => {
    h.portkey = async () => ({ model: "gpt-4o-mini", choices: [{ message: { content: evalJson } }], usage: { prompt_tokens: 812, completion_tokens: 97, total_tokens: 909 } });
    const { evaluateWritingWithRubric } = await import("@/lib/ai-engine");
    const { withAiUsageContext } = await import("@/lib/ai-usage");
    const r = await withAiUsageContext({ purpose: "EXAM_GRADING", submissionId: "sub_w" }, () => evaluateWritingWithRubric(essay, "Viết về gia đình"));
    expect(r.overallScore).toBe(6.5);
    const l = await logs();
    expect(l).toHaveLength(1);
    expect(l[0]).toMatchObject({ purpose: "EXAM_GRADING", submission_id: "sub_w", model: "gpt-4o-mini", prompt_tokens: 812, completion_tokens: 97, total_tokens: 909 });
    expect(Number(l[0].cost_usd)).toBeCloseTo((812 * 0.15 + 97 * 0.6) / 1e6, 6);
  });

  it("response không có model → ghi model đã gọi (PORTKEY_MODEL); không có usage → ghi 0 token, không bịa số", async () => {
    h.portkey = async () => ({ choices: [{ message: { content: evalJson } }] });
    const { evaluateWritingWithRubric } = await import("@/lib/ai-engine");
    await evaluateWritingWithRubric(essay, "P");
    const l = await logs();
    expect(l).toHaveLength(1);
    expect(l[0]).toMatchObject({ model: "gemini-2.5-flash", prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 });
  });

  it("Speaking (audio base64) qua Portkey cũng ghi 1 dòng", async () => {
    h.portkey = async () => ({ choices: [{ message: { content: evalJson } }], usage: { prompt_tokens: 3000, completion_tokens: 150, total_tokens: 3150 } });
    const { evaluateSpeakingWithAudio } = await import("@/lib/ai-engine");
    const { withAiUsageContext } = await import("@/lib/ai-usage");
    await withAiUsageContext({ purpose: "LESSON_GRADING", lessonAttemptId: "att_sp" }, () => evaluateSpeakingWithAudio("data:audio/webm;base64,AAAA", "Nói về gia đình"));
    const l = await logs();
    expect(l).toHaveLength(1);
    expect(l[0]).toMatchObject({ purpose: "LESSON_GRADING", lesson_attempt_id: "att_sp", prompt_tokens: 3000, completion_tokens: 150 });
  });

  it("Portkey lỗi → không ghi dòng cho lần lỗi; OpenAI dự phòng thành công → ghi 1 dòng provider openai", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    h.portkey = async () => { throw new Error("gateway down"); };
    process.env.OPENAI_API_KEY = "sk_test";
    h.openai = async () => ({ model: "gpt-4o-mini", choices: [{ message: { content: evalJson } }], usage: { prompt_tokens: 500, completion_tokens: 60, total_tokens: 560 } });
    const { evaluateWritingWithRubric } = await import("@/lib/ai-engine");
    await evaluateWritingWithRubric(essay, "P");
    const l = await logs();
    expect(l).toHaveLength(1);
    expect(l[0]).toMatchObject({ provider: "openai", model: "gpt-4o-mini", prompt_tokens: 500 });
  });

  it("mọi lời gọi đều lỗi → không có dòng nào (dùng kết quả dự phòng)", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    h.portkey = async () => { throw new Error("down"); };
    const { evaluateWritingWithRubric } = await import("@/lib/ai-engine");
    await evaluateWritingWithRubric(essay, "P");
    expect(await logs()).toHaveLength(0);
  });
});

describe("lib/document-parser.ts ghi token Gemini (usageMetadata)", () => {
  it("structureExamQuestionsWithAi qua Gemini REST → 1 dòng provider google, model đã gọi, token từ usageMetadata", async () => {
    process.env.GOOGLE_API_KEY = "g_test";
    const calls: string[] = [];
    vi.stubGlobal("fetch", async (url: string) => {
      calls.push(String(url));
      return new Response(JSON.stringify({
        candidates: [{ content: { parts: [{ text: JSON.stringify({ examTitle: "Đề", suggestedDurationMinutes: 30, questions: [] }) }] } }],
        usageMetadata: { promptTokenCount: 4100, candidatesTokenCount: 820, totalTokenCount: 4920 },
      }), { status: 200, headers: { "Content-Type": "application/json" } });
    });
    const { structureExamQuestionsWithAi } = await import("@/lib/document-parser");
    const { withAiUsageContext } = await import("@/lib/ai-usage");
    await withAiUsageContext({ purpose: "EXAM_IMPORT", teacherId: "t1" }, () =>
      structureExamQuestionsWithAi("Câu 1. ...", undefined, { provider: "google", model: "gemini-flash-lite-latest", temperature: 0.1, max_tokens: 1000 } as any));
    expect(calls.length).toBe(1);
    const l = await logs();
    expect(l).toHaveLength(1);
    expect(l[0]).toMatchObject({ purpose: "EXAM_IMPORT", teacher_id: "t1", provider: "google", model: "gemini-flash-lite-latest", prompt_tokens: 4100, completion_tokens: 820, total_tokens: 4920 });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe("Route đặt ngữ cảnh ghi log đúng", () => {
  it("POST /api/exam/grade-async → log purpose EXAM_GRADING kèm submission_id, student_id, teacher_id (GV lớp)", async () => {
    await h.pg.db.exec(`
      INSERT INTO questions (id,skill,category,prompt,content) VALUES ('w1','Writing','WRITING_ESSAY','Viết đoạn văn','{"min_words":5}');
      INSERT INTO exams (id,title,duration_minutes,question_ids,created_by,scoring_standard_id) VALUES ('eAI','Đề viết',30,'["w1"]','t1','std_ielts');
      INSERT INTO class_assignments (id,class_id,exam_id,max_attempts) VALUES ('as1','c1','eAI',3);
    `);
    await loginAs("STUDENT", "s1");
    const start = (await import("@/app/api/student/exams/[examId]/attempts/route")).POST;
    const submit = (await import("@/app/api/student/exam-attempts/[id]/submit/route")).POST;
    const a = (await (await start(req("POST", "/x", { classId: "c1" }), { params: Promise.resolve({ examId: "eAI" }) })).json()).attempt;
    await submit(req("POST", "/x", { answers: { w1: "My family is big and happy." } }), { params: Promise.resolve({ id: a.id }) });
    expect((await rows(`SELECT status FROM submissions WHERE id=$1`, [a.id]))[0].status).toBe("GRADING");
    h.token = undefined;
    const grade = (await import("@/app/api/exam/grade-async/route")).POST;
    expect((await grade(req("POST", "/x", { submissionId: a.id }, { "x-internal-token": "internal_test_token_xyz" }))).status).toBe(200);
    const l = await logs();
    expect(l.length).toBeGreaterThanOrEqual(1);
    for (const x of l) expect(x).toMatchObject({ purpose: "EXAM_GRADING", submission_id: a.id, student_id: "s1", teacher_id: "t1", prompt_tokens: 100 });
  });

  it("POST /api/lessons/grade-async → log purpose LESSON_GRADING kèm lesson_attempt_id, student_id, teacher_id", async () => {
    await h.pg.db.exec(`
      INSERT INTO questions (id,skill,category,prompt,content) VALUES ('qE','Writing','WRITING_ESSAY','Viết','{}');
      INSERT INTO lessons (id,title,question_ids,created_by) VALUES ('lAI','Bài viết','["qE"]','t1');
      INSERT INTO lesson_attempts (id,lesson_id,class_id,student_id,answers,results,status,objective_earned,objective_max,ai_max)
        VALUES ('att_1','lAI','c1','s1','{"qE":"My family..."}','[{"question_id":"qE","kind":"AI","category":"WRITING_ESSAY","items":[{"key":"0","correct":null}],"earned":0,"max":1}]','GRADING',0,0,1);
    `);
    const grade = (await import("@/app/api/lessons/grade-async/route")).POST;
    expect((await grade(req("POST", "/x", { attemptId: "att_1" }, { "x-internal-token": "internal_test_token_xyz" }))).status).toBe(200);
    const l = await logs();
    expect(l.length).toBeGreaterThanOrEqual(1);
    for (const x of l) expect(x).toMatchObject({ purpose: "LESSON_GRADING", lesson_attempt_id: "att_1", student_id: "s1", teacher_id: "t1" });
  });

  it("POST /api/teacher/exams/ai-parse → log purpose EXAM_IMPORT với teacher_id người gọi", async () => {
    await loginAs("TEACHER", "t1");
    const fd = new FormData();
    fd.append("file", new File(["%PDF-1.4 Câu 1. Choose A"], "de.pdf", { type: "application/pdf" }));
    fd.append("targetSkill", "Auto");
    const parse = (await import("@/app/api/teacher/exams/ai-parse/route")).POST;
    await parse(new Request("http://localhost/api/teacher/exams/ai-parse", { method: "POST", body: fd }));
    const l = await logs();
    expect(l).toHaveLength(1);
    expect(l[0]).toMatchObject({ purpose: "EXAM_IMPORT", teacher_id: "t1", prompt_tokens: 5000 });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe("GET/PUT /api/admin/settings/ai-pricing", () => {
  const api = () => import("@/app/api/admin/settings/ai-pricing/route");

  it("chưa đăng nhập 401; TEACHER 403 (cả GET và PUT)", async () => {
    const { GET, PUT } = await api();
    expect((await GET(req("GET", "/x"))).status).toBe(401);
    await loginAs("TEACHER", "t1");
    expect((await GET(req("GET", "/x"))).status).toBe(403);
    expect((await PUT(req("PUT", "/x", PRICING))).status).toBe(403);
  });

  it("ADMIN GET → pricing + unpriced_models (model đã gọi trong log mà chưa có giá)", async () => {
    await h.pg.db.exec(`INSERT INTO ai_usage_logs (id, model, prompt_tokens, completion_tokens, total_tokens) VALUES ('l1','gemini-2.5-flash',1,1,2), ('l2','model-moi',1,1,2), ('l3','model-moi',1,1,2)`);
    await loginAs("ADMIN", "a1");
    const res = await (await api()).GET(req("GET", "/x"));
    expect(res.status).toBe(200);
    const j = await res.json();
    expect(j).toMatchObject({ success: true, pricing: PRICING });
    expect(j.unpriced_models).toEqual(["model-moi"]);
  });

  it("ADMIN PUT hợp lệ → lưu, GET lại thấy giá mới, recordAiUsage sau đó dùng giá mới", async () => {
    await loginAs("ADMIN", "a1");
    const next = { usd_vnd_rate: 26000, models: { "gemini-2.5-flash": { input_per_1m: 1, output_per_1m: 1 } } };
    const res = await (await api()).PUT(req("PUT", "/x", next));
    expect(res.status).toBe(200);
    expect((await (await (await api()).GET(req("GET", "/x"))).json()).pricing).toEqual(next);
    const { recordAiUsage } = await import("@/lib/ai-usage");
    await recordAiUsage({ provider: "p", model: "gemini-2.5-flash", promptTokens: 1_000_000, completionTokens: 0 });
    expect(Number((await logs())[0].cost_usd)).toBeCloseTo(1, 6);
  });

  it("ADMIN PUT sai → 400 { success:false, error } và không đổi dữ liệu", async () => {
    await loginAs("ADMIN", "a1");
    const res = await (await api()).PUT(req("PUT", "/x", { usd_vnd_rate: -5, models: {} }));
    expect(res.status).toBe(400);
    const j = await res.json();
    expect(j.success).toBe(false);
    expect(typeof j.error).toBe("string");
    expect((await rows(`SELECT value FROM system_settings WHERE key='ai_pricing'`))[0].value).toEqual(PRICING);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe("Migration 014 + dọn số liệu bịa", () => {
  it("chạy được trên bảng ai_usage_logs cũ (do portkey.ts tạo), chạy lặp không lỗi, giữ dữ liệu cũ, có ai_pricing", async () => {
    const pg = await createFakePg(["db-migration-005-system-settings.sql"]);
    await pg.db.exec(`CREATE TABLE ai_usage_logs (id VARCHAR(50) PRIMARY KEY, teacher_id VARCHAR(50), student_id VARCHAR(50), submission_id VARCHAR(50),
      model VARCHAR(100), prompt_tokens INT DEFAULT 0, completion_tokens INT DEFAULT 0, total_tokens INT DEFAULT 0, cost_usd NUMERIC(10,6) DEFAULT 0, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP);
      INSERT INTO ai_usage_logs (id, model, total_tokens) VALUES ('old', 'gpt', 99);`);
    const sql = read("docs/db-migration-014-ai-usage.sql");
    await pg.db.exec(sql);
    await pg.db.exec(sql);
    const cols = (await pg.db.query(`SELECT column_name FROM information_schema.columns WHERE table_name='ai_usage_logs'`)).rows.map((r: any) => r.column_name);
    expect(cols).toEqual(expect.arrayContaining(["purpose", "provider", "lesson_attempt_id"]));
    expect((await pg.db.query(`SELECT total_tokens FROM ai_usage_logs WHERE id='old'`)).rows).toEqual([{ total_tokens: 99 }]);
    const v = (await pg.db.query(`SELECT value FROM system_settings WHERE key='ai_pricing'`)).rows[0] as any;
    expect(v.value.usd_vnd_rate).toBeGreaterThan(0);
    expect(typeof v.value.models).toBe("object");
  });

  it("ensureSchema có DDL của migration 014", () => {
    const s = read("lib/db-pg.ts");
    expect(s).toMatch(/ai_usage_logs/);
    expect(s).toMatch(/ADD COLUMN IF NOT EXISTS purpose/);
    expect(s).toMatch(/'ai_pricing'/);
  });

  it("chỉ lib/ai-usage.ts được INSERT vào ai_usage_logs; không còn token/chi phí bịa", () => {
    const walk = (d: string, out: string[] = []): string[] => {
      for (const e of fs.readdirSync(d, { withFileTypes: true })) {
        const p = path.join(d, e.name);
        if (e.isDirectory()) walk(p, out); else if (/\.(ts|tsx|js)$/.test(e.name)) out.push(p);
      }
      return out;
    };
    const files = [...walk("app"), ...walk("lib"), ...walk("worker")];
    const inserters = files.filter((f) => /INSERT INTO ai_usage_logs/i.test(read(f))).map((f) => f.split(path.sep).join("/"));
    expect(inserters).toEqual(["lib/ai-usage.ts"]);
    const portkey = read("lib/portkey.ts");
    expect(portkey).not.toMatch(/\b850\b|\b320\b|0\.002\b/);
    expect(portkey).toMatch(/recordAiUsage/);
    const imp = read("app/api/teacher/exams/ai-import/route.ts");
    expect(imp).not.toMatch(/\*\s*150\b|\b1200\b|0\.005\b/);
  });

  it("trang Cấu hình admin có mục bảng giá model và tỷ giá, gọi API ai-pricing", () => {
    const s = read("app/admin/settings/page.tsx");
    expect(s).toMatch(/\/api\/admin\/settings\/ai-pricing/);
    expect(s).toMatch(/Tỷ giá/);
    expect(s).toMatch(/Bảng giá model/i);
  });
});
