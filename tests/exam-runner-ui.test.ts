// TASK-022 — Trang làm đề mới (SCR-E4) + xem lại (SCR-E5): dùng LessonPlayer + ghi âm Speaking, giờ theo server.
// File do trưởng phòng viết, bị khoá.
import { describe, it, expect } from "vitest";
import fs from "fs";
import { emptyExamAnswerFor, groupQuestionsBySkill, formatRemaining } from "@/lib/exam-player";
import { gradeQuestion } from "@/lib/grading";

describe("lib/exam-player.ts", () => {
  it("emptyExamAnswerFor: Speaking → chuỗi rỗng (URL audio); dạng khác như emptyAnswerFor", () => {
    expect(emptyExamAnswerFor({ id: "s", category: "SPEAKING_TOPIC_PROMPT", content: {} })).toBe("");
    expect(emptyExamAnswerFor({ id: "s", category: "SPEAKING_READ_ALOUD", content: {} })).toBe("");
    expect(emptyExamAnswerFor({ id: "m", category: "READING_MC", content: { sub_questions: [] } })).toEqual({});
    expect(emptyExamAnswerFor({ id: "f", category: "LISTENING_FILL_IN", content: { gap_count: 2 } })).toEqual(["", ""]);
  });

  it("câu trả lời Speaking (URL) được chấm là mục AI khi bật speaking AI", () => {
    const r = gradeQuestion({ id: "s", category: "SPEAKING_TOPIC_PROMPT", content: {} }, "https://cdn/x.webm", undefined, { speaking: "AI" });
    expect(r).toMatchObject({ kind: "AI", max: 1 });
  });

  it("groupQuestionsBySkill: thứ tự Listening → Reading → Writing → Speaking → khác; giữ thứ tự câu trong phần", () => {
    const qs = [
      { id: "w", skill: "Writing" }, { id: "r1", skill: "Reading" }, { id: "l", skill: "Listening" },
      { id: "r2", skill: "Reading" }, { id: "x", skill: "Grammar" }, { id: "s", skill: "Speaking" },
    ];
    expect(groupQuestionsBySkill(qs).map((g) => [g.skill, g.questions.map((q: any) => q.id)])).toEqual([
      ["Listening", ["l"]], ["Reading", ["r1", "r2"]], ["Writing", ["w"]], ["Speaking", ["s"]], ["Grammar", ["x"]],
    ]);
  });

  it("formatRemaining: mm:ss, có giờ thì h:mm:ss, âm → 00:00", () => {
    expect(formatRemaining(65_000)).toBe("01:05");
    expect(formatRemaining(3_725_000)).toBe("1:02:05");
    expect(formatRemaining(-5)).toBe("00:00");
  });
});

const read = (p: string) => fs.readFileSync(p, "utf8");
const PAGE = "app/student/exam/[examId]/page.tsx";
const REVIEW = "app/student/exam/review/[submissionId]/page.tsx";
const PLAYER = "components/lesson-player/LessonPlayer.tsx";
const REC = "components/lesson-player/SpeakingRecorder.tsx";

describe("Trang làm đề SCR-E4", () => {
  const s = () => read(PAGE);
  it("dùng luồng lượt thi mới: bắt đầu, nội dung, lưu tạm, nộp", () => {
    for (const ep of ["/api/student/exams/", "/attempts", "/content", "/api/student/exam-attempts/", "/answers", "/submit"]) expect(s(), ep).toContain(ep);
  });
  it("đồng hồ theo deadline_at của server, tự nộp khi hết giờ, dọn timer", () => {
    expect(s()).toContain("deadline_at");
    expect(s()).toContain("formatRemaining");
    expect(s()).toMatch(/clearInterval|clearTimeout/);
    expect(s()).toMatch(/tự động nộp|auto-?submit|autoSubmit/i);
  });
  it("dùng LessonPlayer (bật Speaking) và chia phần theo kỹ năng", () => {
    expect(s()).toContain("@/components/lesson-player/LessonPlayer");
    expect(s()).toMatch(/allowSpeaking/);
    expect(s()).toContain("groupQuestionsBySkill");
  });
  it("kết quả: điểm từng phần, tổng, đạt/không đạt, đang chấm, chờ giáo viên, nộp trễ", () => {
    for (const k of ["section_scores", "total_score", "passed", "GRADING", "NEEDS_REVIEW", "is_late"]) expect(s(), k).toContain(k);
  });
  it("xử lý 403 / 409 (hết lượt) và lỗi tải", () => {
    expect(s()).toMatch(/403/);
    expect(s()).toMatch(/409/);
    expect(s()).toMatch(/Thử lại/);
  });
  it("không còn tự chấm ở trình duyệt / Supabase / mock; < 700 dòng", () => {
    for (const bad of ["auto_graded_score", "correct_answer", "correctAnswer", '"@/lib/supabase"', "supabase.", "@/lib/audio-storage", "@/lib/mock-data"]) {
      expect(s(), bad).not.toContain(bad);
    }
    expect(s().split("\n").length).toBeLessThan(700);
  });
});

describe("Ghi âm Speaking", () => {
  it("SpeakingRecorder dùng MediaRecorder và upload qua /api/uploads loại speaking", () => {
    const r = read(REC);
    expect(r.trimStart().startsWith('"use client"')).toBe(true);
    expect(r).toContain("MediaRecorder");
    expect(r).toContain("/api/uploads");
    expect(r).toMatch(/["']speaking["']/);
  });
  it("LessonPlayer có prop allowSpeaking và render SpeakingRecorder cho SPEAKING_*", () => {
    const p = read(PLAYER);
    expect(p).toContain("allowSpeaking");
    expect(p).toContain("SpeakingRecorder");
    expect(p).toContain("SPEAKING_");
  });
});

describe("Trang xem lại SCR-E5", () => {
  it("hiện điểm từng phần, tổng, đạt/không, trạng thái; kết quả từng câu qua LessonPlayer", () => {
    const r = read(REVIEW);
    for (const k of ["section_scores", "total_score", "passed", "is_late", "LessonPlayer", "sanitizeQuestionForStudent"]) expect(r, k).toContain(k);
    expect(r).not.toContain('"@/lib/supabase"');
  });
});
