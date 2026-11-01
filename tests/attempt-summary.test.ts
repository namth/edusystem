// TASK-029 — Màn kết quả theo DEC-021 + worker chấm bền vững. File do trưởng phòng viết, bị khoá.
import { describe, it, expect } from "vitest";
import fs from "fs";
import { summarizeAttemptResult } from "@/lib/attempt-summary";

const SNAP = {
  name: "IELTS Academic",
  sections: [
    { skill: "Listening", min: 0, max: 9 },
    { skill: "Reading", min: 0, max: 9 },
    { skill: "Writing", min: 0, max: 9 },
    { skill: "Speaking", min: 0, max: 9 },
  ],
};

describe("summarizeAttemptResult", () => {
  it("GRADED → FINAL, đủ phần theo thứ tự chuẩn chấm, tổng là số (kể cả DB trả chuỗi)", () => {
    const r = summarizeAttemptResult({
      status: "GRADED",
      total_score: "7.0",
      passed: true,
      standard_snapshot: SNAP,
      section_scores: { Writing: { score: 6, earned: 0.67, max: 1 }, Reading: { score: 9, earned: 2, max: 2 } },
    });
    expect(r.state).toBe("FINAL");
    expect(r.graded.map((g) => g.skill)).toEqual(["Reading", "Writing"]);
    expect(r.graded[0]).toMatchObject({ skill: "Reading", score: 9, earned: 2, max: 2 });
    expect(r.pending).toEqual([]);
    expect(r.total).toBe(7);
    expect(r.passed).toBe(true);
  });

  it("GRADING có phần đã chấm → PARTIAL: phần khách quan báo trước, phần AI vào pending (không hiện earned/max của phần chờ)", () => {
    const r = summarizeAttemptResult({
      status: "GRADING",
      total_score: null,
      passed: null,
      standard_snapshot: SNAP,
      section_scores: { Reading: { score: 9, earned: 2, max: 2 }, Writing: { score: null, earned: 0, max: 1 }, Speaking: { score: null, earned: 0, max: 1 } },
    });
    expect(r.state).toBe("PARTIAL");
    expect(r.graded.map((g) => g.skill)).toEqual(["Reading"]);
    expect(r.pending).toEqual(["Writing", "Speaking"]);
    expect(r.total).toBeNull();
    expect(r.passed).toBeNull();
  });

  it("GRADING chưa phần nào có điểm → WAITING_AI", () => {
    const r = summarizeAttemptResult({ status: "GRADING", standard_snapshot: SNAP, section_scores: { Writing: { score: null, earned: 0, max: 1 } } });
    expect(r.state).toBe("WAITING_AI");
    expect(r.pending).toEqual(["Writing"]);
  });

  it("NEEDS_REVIEW → WAITING_TEACHER, vẫn liệt kê phần đã chấm", () => {
    const r = summarizeAttemptResult({ status: "NEEDS_REVIEW", standard_snapshot: SNAP, section_scores: { Reading: { score: 5, earned: 1, max: 2 }, Writing: { score: null } } });
    expect(r.state).toBe("WAITING_TEACHER");
    expect(r.graded.map((g) => g.skill)).toEqual(["Reading"]);
    expect(r.pending).toEqual(["Writing"]);
  });

  it("không có chuẩn chấm: giữ thứ tự khoá của section_scores; dữ liệu thiếu không lỗi", () => {
    const r = summarizeAttemptResult({ status: "GRADED", total_score: 8, section_scores: { B: { score: 1 }, A: { score: 2 } } });
    expect(r.graded.map((g) => g.skill)).toEqual(["B", "A"]);
    expect(summarizeAttemptResult(null as any).state).toBe("IN_PROGRESS");
    expect(summarizeAttemptResult({ status: "IN_PROGRESS" }).graded).toEqual([]);
  });
});

const read = (p: string) => fs.readFileSync(p, "utf8");

describe("Màn kết quả sau khi nộp — app/student/exam/[examId]/page.tsx", () => {
  const s = () => read("app/student/exam/[examId]/page.tsx");
  it("dùng summarizeAttemptResult và hiển thị đủ 4 trạng thái", () => {
    expect(s()).toContain("@/lib/attempt-summary");
    expect(s()).toMatch(/summarizeAttemptResult\(/);
    for (const st of ['"FINAL"', '"PARTIAL"', '"WAITING_AI"', '"WAITING_TEACHER"']) expect(s(), st).toContain(st);
  });
  it("không còn câu cố định 'Đang chấm Writing/Speaking'; nhắc học sinh xem ở mục Thông báo", () => {
    expect(s()).not.toMatch(/Đang chấm Writing\/Speaking/);
    expect(s()).toMatch(/Thông báo/);
  });
  it("vẫn tự cập nhật khi đang chấm (polling /api/submissions/) và dọn interval", () => {
    expect(s()).toContain("/api/submissions/");
    expect(s()).toMatch(/clearInterval/);
  });
});

describe("Trang xem lại — hiện nhận xét AI và trạng thái từng phần", () => {
  const s = () => read("app/student/exam/review/[submissionId]/page.tsx");
  it("dùng summarizeAttemptResult và hiển thị feedback của mục AI", () => {
    expect(s()).toMatch(/summarizeAttemptResult\(/);
    expect(s()).toMatch(/\.feedback/);
  });
});

describe("Worker chấm — worker/grading-worker.js", () => {
  const s = () => read("worker/grading-worker.js");
  it("chỉ xác nhận (XACK) khi gọi API thành công; nhận lại tin treo bằng XAUTOCLAIM; giới hạn số lần giao", () => {
    expect(s()).toMatch(/xautoclaim/i);
    expect(s()).toMatch(/res\.ok/);
    expect(s()).toMatch(/MAX_DELIVER|maxDeliver|MAX_ATTEMPTS/i);
  });
});
