// TASK-027 — Hiển thị điểm bài nộp theo chuẩn chấm (total_score/section_scores) với fallback trường cũ.
// File do trưởng phòng viết, bị khoá.
import { describe, it, expect } from "vitest";
import fs from "fs";
import { submissionScore, submissionSkillScores, formatScore } from "@/lib/score-display";

const ielts = {
  id: "std_ielts", name: "IELTS",
  sections: [
    { skill: "Listening", min: 0, max: 9, step: 0.5 }, { skill: "Reading", min: 0, max: 9, step: 0.5 },
    { skill: "Writing", min: 0, max: 9, step: 0.5 }, { skill: "Speaking", min: 0, max: 9, step: 0.5 },
  ],
  aggregation: { method: "AVERAGE", round_step: 0.5 },
};
const toeic = {
  id: "std_toeic_lr", name: "TOEIC L&R",
  sections: [{ skill: "Listening", min: 5, max: 495, step: 5 }, { skill: "Reading", min: 5, max: 495, step: 5 }],
  aggregation: { method: "SUM", round_step: 5 },
};

describe("submissionScore", () => {
  it("chuẩn AVERAGE: thang tổng = thang phần (IELTS 0–9)", () => {
    expect(submissionScore({ total_score: "7.5", status: "GRADED", standard_snapshot: ielts })).toMatchObject({ value: 7.5, min: 0, max: 9, standard_name: "IELTS", percent: 83.3 });
  });
  it("chuẩn SUM: thang tổng = cộng các phần có điểm (TOEIC 10–990)", () => {
    const r = submissionScore({ total_score: 750, status: "GRADED", standard_snapshot: toeic,
      section_scores: { Listening: { score: 400 }, Reading: { score: 350 } } });
    expect(r).toMatchObject({ value: 750, min: 10, max: 990 });
    expect(r.percent).toBeCloseTo(75.5, 1);
  });
  it("chưa có tổng (GRADING / NEEDS_REVIEW) → value null, giữ trạng thái", () => {
    expect(submissionScore({ total_score: null, status: "GRADING", standard_snapshot: ielts })).toMatchObject({ value: null, status: "GRADING" });
  });
  it("bài cũ không có chuẩn: dùng final_score rồi ai_score, thang 0–9", () => {
    expect(submissionScore({ final_score: "6.5", ai_score: 5 })).toMatchObject({ value: 6.5, min: 0, max: 9, standard_name: null });
    expect(submissionScore({ ai_score: 5 })).toMatchObject({ value: 5, max: 9 });
    expect(submissionScore({})).toMatchObject({ value: null });
  });
});

describe("submissionSkillScores", () => {
  it("từ section_scores + thang của chuẩn; kỹ năng không có điểm → null", () => {
    const r = submissionSkillScores({ standard_snapshot: ielts, section_scores: { Reading: { score: 7 }, Writing: { score: "6" } } });
    expect(r.Reading).toEqual({ score: 7, min: 0, max: 9 });
    expect(r.Writing).toEqual({ score: 6, min: 0, max: 9 });
    expect(r.Listening).toEqual({ score: null, min: 0, max: 9 });
  });
  it("bài cũ: dùng cột reading_score… thang 0–9", () => {
    const r = submissionSkillScores({ reading_score: "6.5", listening_score: null });
    expect(r.Reading).toEqual({ score: 6.5, min: 0, max: 9 });
    expect(r.Listening).toEqual({ score: null, min: 0, max: 9 });
  });
});

describe("formatScore", () => {
  it("hiện số + thang; null → —", () => {
    expect(formatScore({ value: 7.5, max: 9 })).toBe("7.5/9");
    expect(formatScore({ value: 750, max: 990 })).toBe("750/990");
    expect(formatScore({ value: null, max: 9 })).toBe("—");
  });
});

describe("Các trang dùng lib/score-display (không tự đọc final_score/ai_score)", () => {
  for (const p of ["app/student/analytics/page.tsx", "app/student/dashboard/page.tsx", "app/student/class/[classId]/page.tsx", "app/admin/students/[id]/page.tsx"]) {
    it(p, () => {
      const s = fs.readFileSync(p, "utf8");
      expect(s).toContain("@/lib/score-display");
      expect(s).not.toMatch(/\.(final_score|ai_score)\b/);
    });
  }
});
