// TASK-018 — lib/exam-scoring.ts (điểm phần + tổng theo chuẩn chấm), migration 009, chấm Speaking (FEAT-011 BR-E02/E06, TC-E01/E02).
// File do trưởng phòng viết, bị khoá.
import { describe, it, expect, vi } from "vitest";
import fs from "fs";
import { PGlite } from "@electric-sql/pglite";
import { roundToStep, scoreSection, aggregateTotal, type StandardSection, type ScoringStandard } from "@/lib/exam-scoring";
import { gradeQuestion } from "@/lib/grading";

const ielts: ScoringStandard = {
  id: "std_ielts", name: "IELTS",
  sections: [
    { skill: "Listening", min: 0, max: 9, step: 0.5, conversion: "TABLE", table_question_count: 40,
      table: [{ min_correct: 0, score: 0 }, { min_correct: 10, score: 4 }, { min_correct: 23, score: 6 }, { min_correct: 30, score: 7 }, { min_correct: 39, score: 9 }] },
    { skill: "Reading", min: 0, max: 9, step: 0.5, conversion: "LINEAR" },
    { skill: "Writing", min: 0, max: 9, step: 0.5, conversion: "LINEAR", rubric_id: "rubric_ielts_writing" },
    { skill: "Speaking", min: 0, max: 9, step: 0.5, conversion: "LINEAR" },
  ],
  aggregation: { method: "AVERAGE", round_step: 0.5 },
};
const sec = (skill: string) => ielts.sections.find((s) => s.skill === skill) as StandardSection;

describe("roundToStep — làm tròn nửa lên theo bước, kẹp trong [min,max]", () => {
  it("bước 0.5 và 0.25", () => {
    expect(roundToStep(6.25, 0.5, 0, 9)).toBe(6.5);
    expect(roundToStep(6.24, 0.5, 0, 9)).toBe(6);
    expect(roundToStep(6.75, 0.5, 0, 9)).toBe(7);
    expect(roundToStep(7.124, 0.25, 0, 10)).toBe(7);
    expect(roundToStep(7.125, 0.25, 0, 10)).toBe(7.25);
  });
  it("bước 5 và min khác 0; kẹp biên", () => {
    expect(roundToStep(252.4, 5, 5, 495)).toBe(250);
    expect(roundToStep(2, 5, 5, 495)).toBe(5);
    expect(roundToStep(9.4, 0.5, 0, 9)).toBe(9);
  });
});

describe("scoreSection (BR-E02)", () => {
  it("tuyến tính: min + tỉ lệ × (max − min)", () => {
    expect(scoreSection(sec("Reading"), { objective_earned: 15, objective_max: 20, ai_earned: 0, ai_max: 0 })).toBe(7);
    const toeic: StandardSection = { skill: "Listening", min: 5, max: 495, step: 5, conversion: "LINEAR" };
    expect(scoreSection(toeic, { objective_earned: 50, objective_max: 100, ai_earned: 0, ai_max: 0 })).toBe(250);
  });
  it("bảng tra: đề 40 câu tra thẳng", () => {
    expect(scoreSection(sec("Listening"), { objective_earned: 30, objective_max: 40, ai_earned: 0, ai_max: 0 })).toBe(7);
    expect(scoreSection(sec("Listening"), { objective_earned: 29, objective_max: 40, ai_earned: 0, ai_max: 0 })).toBe(6);
    expect(scoreSection(sec("Listening"), { objective_earned: 40, objective_max: 40, ai_earned: 0, ai_max: 0 })).toBe(9);
  });
  it("bảng tra: đề ngắn quy tỉ lệ về số câu chuẩn rồi tra (15/20 → 30/40 → 7)", () => {
    expect(scoreSection(sec("Listening"), { objective_earned: 15, objective_max: 20, ai_earned: 0, ai_max: 0 })).toBe(7);
  });
  it("phần có mục AI dùng tuyến tính dù cấu hình bảng tra", () => {
    expect(scoreSection(sec("Listening"), { objective_earned: 1, objective_max: 2, ai_earned: 1, ai_max: 2 })).toBe(4.5);
  });
  it("Writing: trộn khách quan + AI (ai_earned đã quy 0–1 mỗi mục)", () => {
    // (2 + 0.5) / (4 + 1) = 0.5 → 4.5
    expect(scoreSection(sec("Writing"), { objective_earned: 2, objective_max: 4, ai_earned: 0.5, ai_max: 1 })).toBe(4.5);
  });
  it("phần không có câu nào → null", () => {
    expect(scoreSection(sec("Speaking"), { objective_earned: 0, objective_max: 0, ai_earned: 0, ai_max: 0 })).toBeNull();
  });
});

describe("aggregateTotal (BR-E06)", () => {
  it("AVERAGE chỉ trên các phần có điểm, làm tròn 0.5", () => {
    expect(aggregateTotal(ielts, { Reading: 6.5, Writing: 6, Speaking: 7, Listening: null })).toEqual({ total: 6.5, passed: null });
    expect(aggregateTotal(ielts, { Reading: 6.5, Writing: 6 })).toEqual({ total: 6.5, passed: null }); // 6.25 → 6.5
  });
  it("SUM + điểm đạt + điểm sàn từng phần", () => {
    const hsk: ScoringStandard = { id: "h", name: "HSK", sections: [], aggregation: { method: "SUM", round_step: 1, pass_score: 120, section_min: { Reading: 50 } } };
    expect(aggregateTotal(hsk, { Listening: 80, Reading: 50 })).toEqual({ total: 130, passed: true });
    expect(aggregateTotal(hsk, { Listening: 90, Reading: 40 })).toEqual({ total: 130, passed: false });
    expect(aggregateTotal(hsk, { Listening: 60, Reading: 55 })).toEqual({ total: 115, passed: false });
  });
  it("WEIGHTED: Σ(w·s)/Σw trên các phần có điểm", () => {
    const w: ScoringStandard = { id: "w", name: "W", sections: [], aggregation: { method: "WEIGHTED", round_step: 0.25, weights: { Reading: 2, Writing: 1, Speaking: 1 } } };
    expect(aggregateTotal(w, { Reading: 8, Writing: 6, Speaking: null })).toEqual({ total: 7.25, passed: null }); // (16+6)/3 = 7.33
  });
  it("không phần nào có điểm → total null", () => {
    expect(aggregateTotal(ielts, {})).toEqual({ total: null, passed: null });
  });
});

describe("gradeQuestion — tuỳ chọn chấm Speaking bằng AI cho đề thi", () => {
  const sp = { id: "sp", category: "SPEAKING_TOPIC_PROMPT", content: { prep_time_seconds: 30, speaking_time_seconds: 60 } };
  it("mặc định (bài học) vẫn UNSUPPORTED max 0", () => {
    expect(gradeQuestion(sp, "https://x/a.webm")).toMatchObject({ kind: "UNSUPPORTED", max: 0 });
  });
  it("{ speaking: 'AI' } → kind AI, max 1, mục key 'speaking'", () => {
    const r = gradeQuestion(sp, "https://x/a.webm", undefined, { speaking: "AI" });
    expect(r).toMatchObject({ kind: "AI", max: 1, earned: 0 });
    expect(r.items[0]).toMatchObject({ key: "speaking", given: "https://x/a.webm" });
    expect(gradeQuestion({ ...sp, category: "SPEAKING_READ_ALOUD" }, "u", undefined, { speaking: "AI" }).kind).toBe("AI");
  });
});

describe("lib/lesson-ai-grading — Speaking dùng evaluateSpeakingWithAudio", () => {
  it("category SPEAKING_* gọi chấm nói với URL audio; WRITING_* vẫn chấm viết", async () => {
    vi.resetModules();
    const calls: string[] = [];
    vi.doMock("@/lib/ai-engine", () => ({
      evaluateWritingSubmission: async () => { calls.push("writing"); return { overallScore: 6 }; },
      evaluateSpeakingWithAudio: async (audio: string) => { calls.push("speaking:" + audio); return { overallScore: 7 }; },
    }));
    const { gradeOpenAnswer } = await import("@/lib/lesson-ai-grading");
    expect(await gradeOpenAnswer({ category: "SPEAKING_TOPIC_PROMPT", prompt: "Nói", answer: "https://x/a.webm" })).toBe(7);
    expect(await gradeOpenAnswer({ category: "WRITING_ESSAY", prompt: "Viết", answer: "text" })).toBe(6);
    expect(calls).toEqual(["speaking:https://x/a.webm", "writing"]);
    vi.doUnmock("@/lib/ai-engine");
  });
});

describe("docs/db-migration-009-scoring-standards.sql", () => {
  const MIG = fs.readFileSync("docs/db-migration-009-scoring-standards.sql", "utf8");
  async function setup() {
    const db = new PGlite();
    await db.exec(`
      CREATE TABLE exams (id VARCHAR(50) PRIMARY KEY, title TEXT);
      CREATE TABLE courses (id VARCHAR(50) PRIMARY KEY, title TEXT);
      CREATE TABLE submissions (id VARCHAR(50) PRIMARY KEY, exam_id VARCHAR(50), student_id VARCHAR(50), answers JSONB,
        final_score NUMERIC(3,1), status VARCHAR(30), class_id UUID, started_at TIMESTAMPTZ, submitted_at TIMESTAMPTZ, graded_at TIMESTAMPTZ);
    `);
    return db;
  }
  it("chạy được 2 lần; seed đủ 4 chuẩn hệ thống với sections/aggregation hợp lệ", async () => {
    const db = await setup();
    await db.exec(MIG);
    await db.exec(MIG);
    const rows = (await db.query<any>(`SELECT id, sections, aggregation, is_system FROM scoring_standards ORDER BY id`)).rows;
    expect(rows.map((r) => r.id)).toEqual(["std_hsk1", "std_ielts", "std_internal_10", "std_toeic_lr"]);
    for (const r of rows) {
      expect(r.is_system).toBe(true);
      expect(Array.isArray(r.sections) && r.sections.length > 0).toBe(true);
      expect(["AVERAGE", "SUM", "WEIGHTED"]).toContain(r.aggregation.method);
    }
    const ieltsL = rows.find((r) => r.id === "std_ielts").sections.find((s: any) => s.skill === "Listening");
    expect(ieltsL).toMatchObject({ conversion: "TABLE", table_question_count: 40 });
  });
  it("thêm cột cho exams, courses, submissions (total_score không giới hạn độ lớn)", async () => {
    const db = await setup();
    await db.exec(MIG);
    const cols = async (t: string) => (await db.query<any>(`SELECT column_name FROM information_schema.columns WHERE table_name=$1`, [t])).rows.map((r) => r.column_name);
    expect(await cols("exams")).toContain("scoring_standard_id");
    expect(await cols("courses")).toContain("default_scoring_standard_id");
    expect(await cols("submissions")).toEqual(expect.arrayContaining(["class_ref", "deadline_at", "is_late", "results", "section_scores", "total_score", "passed", "standard_snapshot"]));
    await db.exec(`INSERT INTO submissions (id, exam_id, student_id, answers, total_score) VALUES ('s', 'e', 'u', '{}', 990)`);
  });
  it("lib/db-pg.ts ensureSchema chạy cùng DDL", () => {
    const src = fs.readFileSync("lib/db-pg.ts", "utf8");
    expect(src).toMatch(/CREATE TABLE IF NOT EXISTS scoring_standards/);
    expect(src).toMatch(/ADD COLUMN IF NOT EXISTS scoring_standard_id/);
    expect(src).toMatch(/ADD COLUMN IF NOT EXISTS total_score/);
    expect(src).toContain("std_ielts");
  });
});
