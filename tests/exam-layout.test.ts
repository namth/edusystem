// TASK-028 — Bố cục trang làm đề tự chọn theo nội dung (DEC-020). File do trưởng phòng viết, bị khoá.
import { describe, it, expect } from "vitest";
import fs from "fs";
import {
  SPLIT_MIN_CHARS,
  stimulusPlainLength,
  buildScreens,
  navStatus,
  keyToOptionLetter,
  isTypingTarget,
  applyOptionShortcut,
  screenIndexOfQuestion,
  clampScreenIndex,
  formatSavedAt,
  unansweredNumbers,
} from "@/lib/exam-layout";

const LONG = "<p>" + "Reading passage sentence. ".repeat(40) + "</p>"; // > 600 ký tự chữ
const IMG = '<p><img src="/media/ej/a.png" alt="" /></p>';
const mc = (id: string, extra: Record<string, unknown> = {}) => ({
  id,
  skill: "Reading",
  category: "READING_MC",
  content: { sub_questions: [{ id: "sub_1", text: "T", option_a: "True", option_b: "False", option_c: "", option_d: "" }] },
  stimulus_text: null as string | null,
  stimulus_audio_url: null as string | null,
  ...extra,
});

describe("stimulusPlainLength", () => {
  it("đếm chữ sau khi bỏ thẻ và gộp khoảng trắng; ảnh không tính", () => {
    expect(stimulusPlainLength(null)).toBe(0);
    expect(stimulusPlainLength(IMG)).toBe(0);
    expect(stimulusPlainLength("<p>Hello   <b>world</b></p>\n")).toBe("Hello world".length);
    expect(SPLIT_MIN_CHARS).toBe(600);
    expect(stimulusPlainLength(LONG)).toBeGreaterThanOrEqual(600);
  });
});

describe("buildScreens — chia màn và chọn bố cục", () => {
  it("ảnh/ngữ cảnh ngắn → FOCUS, mỗi câu một màn khi ngữ cảnh khác nhau", () => {
    const s = buildScreens([mc("q1", { stimulus_text: IMG }), mc("q2", { stimulus_text: '<p><img src="/media/ej/b.png"></p>' })]);
    expect(s.map((x) => [x.mode, x.questionIds])).toEqual([["FOCUS", ["q1"]], ["FOCUS", ["q2"]]]);
    expect(s[0].key).toBe("q1");
    expect(s[0].stimulus_text).toBe(IMG);
  });

  it("câu liên tiếp cùng ngữ cảnh (bỏ qua khoảng trắng đầu/cuối) gộp thành một màn", () => {
    const s = buildScreens([mc("q1", { stimulus_text: LONG }), mc("q2", { stimulus_text: "  " + LONG + "\n" }), mc("q3", { stimulus_text: IMG })]);
    expect(s.map((x) => x.questionIds)).toEqual([["q1", "q2"], ["q3"]]);
  });

  it("ngữ cảnh dài ≥ 600 ký tự chữ → SPLIT (kể cả chỉ một câu)", () => {
    expect(buildScreens([mc("q1", { stimulus_text: LONG })])[0].mode).toBe("SPLIT");
  });

  it("có audio ngữ cảnh → LISTENING, ưu tiên hơn SPLIT; cùng audio thì gộp", () => {
    const a = { skill: "Listening", category: "LISTENING_MC", stimulus_audio_url: "/media/ej/1.mp3" };
    const s = buildScreens([mc("l1", { ...a, stimulus_text: LONG }), mc("l2", { ...a, stimulus_text: LONG })]);
    expect(s).toHaveLength(1);
    expect(s[0].mode).toBe("LISTENING");
    expect(s[0].stimulus_audio_url).toBe("/media/ej/1.mp3");
  });

  it("câu không có ngữ cảnh: mỗi câu một màn FOCUS, không gộp với nhau", () => {
    const s = buildScreens([mc("q1"), mc("q2")]);
    expect(s.map((x) => [x.mode, x.questionIds])).toEqual([["FOCUS", ["q1"]], ["FOCUS", ["q2"]]]);
  });

  it("thứ tự theo kỹ năng như groupQuestionsBySkill; không gộp khác kỹ năng dù cùng ngữ cảnh", () => {
    const s = buildScreens([
      mc("r1", { stimulus_text: IMG }),
      mc("w1", { skill: "Writing", category: "WRITING_ESSAY", content: {}, stimulus_text: IMG }),
      mc("l1", { skill: "Listening", category: "LISTENING_MC", stimulus_audio_url: "/a.mp3" }),
    ]);
    expect(s.map((x) => [x.skill, x.questionIds[0]])).toEqual([["Listening", "l1"], ["Reading", "r1"], ["Writing", "w1"]]);
  });

  it("mọi câu xuất hiện đúng một lần, không mất câu", () => {
    const qs = Array.from({ length: 12 }, (_, i) => mc(`q${i}`, { stimulus_text: i % 3 === 0 ? LONG : i % 3 === 1 ? LONG : IMG }));
    const ids = buildScreens(qs).flatMap((x) => x.questionIds);
    expect(ids.sort()).toEqual(qs.map((q) => q.id).sort());
    expect(buildScreens([])).toEqual([]);
  });
});

describe("điều hướng và trạng thái câu", () => {
  it("navStatus: đang làm > đánh dấu > đã làm > trống", () => {
    expect(navStatus({ isCurrent: true, isFlagged: true, isAnswered: true })).toBe("current");
    expect(navStatus({ isCurrent: false, isFlagged: true, isAnswered: true })).toBe("flagged");
    expect(navStatus({ isCurrent: false, isFlagged: false, isAnswered: true })).toBe("answered");
    expect(navStatus({ isCurrent: false, isFlagged: false, isAnswered: false })).toBe("empty");
  });

  it("screenIndexOfQuestion / clampScreenIndex", () => {
    const s = buildScreens([mc("q1", { stimulus_text: LONG }), mc("q2", { stimulus_text: LONG }), mc("q3")]);
    expect(screenIndexOfQuestion(s, "q2")).toBe(0);
    expect(screenIndexOfQuestion(s, "q3")).toBe(1);
    expect(screenIndexOfQuestion(s, "nope")).toBe(-1);
    expect(clampScreenIndex(-1, 3)).toBe(0);
    expect(clampScreenIndex(5, 3)).toBe(2);
    expect(clampScreenIndex(1, 3)).toBe(1);
    expect(clampScreenIndex(2, 0)).toBe(0);
  });

  it("unansweredNumbers: số thứ tự (1-based, theo thứ tự màn) của câu chưa làm", () => {
    const qs = [mc("q1"), mc("q2"), mc("q3")];
    expect(unansweredNumbers(qs, { q2: { sub_1: "A" } })).toEqual([1, 3]);
    expect(unansweredNumbers(qs, { q1: { sub_1: "A" }, q2: { sub_1: "B" }, q3: { sub_1: "A" } })).toEqual([]);
  });

  it("formatSavedAt: 'Đã lưu lúc HH:MM' theo giờ máy, có số 0 đầu", () => {
    expect(formatSavedAt(new Date(2026, 10, 1, 9, 5))).toBe("Đã lưu lúc 09:05");
    expect(formatSavedAt(new Date(2026, 10, 1, 21, 42))).toBe("Đã lưu lúc 21:42");
  });
});

describe("phím tắt", () => {
  it("keyToOptionLetter: 1–4 và a–d (không phân biệt hoa thường)", () => {
    expect(["1", "2", "3", "4"].map(keyToOptionLetter)).toEqual(["A", "B", "C", "D"]);
    expect(["a", "B", "c", "D"].map(keyToOptionLetter)).toEqual(["A", "B", "C", "D"]);
    expect(["5", "e", "Enter", "ArrowLeft", ""].map(keyToOptionLetter)).toEqual([null, null, null, null, null]);
  });

  it("isTypingTarget: bỏ qua phím tắt khi đang gõ trong ô nhập", () => {
    expect(isTypingTarget({ tagName: "INPUT" })).toBe(true);
    expect(isTypingTarget({ tagName: "textarea" })).toBe(true);
    expect(isTypingTarget({ tagName: "SELECT" })).toBe(true);
    expect(isTypingTarget({ tagName: "DIV", isContentEditable: true })).toBe(true);
    expect(isTypingTarget({ tagName: "BUTTON" })).toBe(false);
    expect(isTypingTarget(null)).toBe(false);
  });

  it("applyOptionShortcut: chỉ áp cho câu MC một ý, lựa chọn phải tồn tại; giữ định dạng {sub_id: chữ cái}", () => {
    const q = mc("q1");
    expect(applyOptionShortcut(q, undefined, "B")).toEqual({ sub_1: "B" });
    expect(applyOptionShortcut(q, { sub_1: "A" }, "A")).toEqual({ sub_1: "A" });
    expect(applyOptionShortcut(q, undefined, "C")).toBeNull(); // option_c rỗng
    const two = mc("q2", { content: { sub_questions: [{ id: "s1", option_a: "x", option_b: "y" }, { id: "s2", option_a: "x", option_b: "y" }] } });
    expect(applyOptionShortcut(two, undefined, "A")).toBeNull();
    expect(applyOptionShortcut({ ...q, category: "READING_FILL_IN" }, undefined, "A")).toBeNull();
  });
});

const read = (p: string) => fs.readFileSync(p, "utf8");
const PAGE = "app/student/exam/[examId]/page.tsx";
const PLAYER = "components/lesson-player/LessonPlayer.tsx";

describe("Trang làm đề dùng bố cục mới", () => {
  const s = () => read(PAGE);
  it("dựng màn bằng buildScreens và hiển thị 3 bố cục theo mode", () => {
    expect(s()).toContain("@/lib/exam-layout");
    expect(s()).toMatch(/buildScreens\(/);
    for (const m of ['"FOCUS"', '"SPLIT"', '"LISTENING"']) expect(s(), m).toContain(m);
  });
  it("khi làm bài: lớp phủ toàn màn hình che menu học sinh", () => {
    expect(s()).toMatch(/fixed inset-0/);
  });
  it("bảng câu hỏi dùng navStatus, có đánh dấu xem lại và nhảy câu", () => {
    expect(s()).toMatch(/navStatus\(/);
    expect(s()).toMatch(/Đánh dấu/);
    expect(s()).toMatch(/screenIndexOfQuestion\(/);
  });
  it("phím tắt: lắng nghe keydown, bỏ qua khi đang gõ, gỡ khi dọn", () => {
    expect(s()).toMatch(/addEventListener\(\s*["']keydown["']/);
    expect(s()).toMatch(/removeEventListener\(\s*["']keydown["']/);
    expect(s()).toMatch(/isTypingTarget\(/);
    expect(s()).toMatch(/applyOptionShortcut\(/);
    expect(s()).toMatch(/ArrowLeft/);
    expect(s()).toMatch(/ArrowRight/);
  });
  it("cảnh báo rời trang khi đang làm và báo đã lưu nháp", () => {
    expect(s()).toMatch(/addEventListener\(\s*["']beforeunload["']/);
    expect(s()).toMatch(/removeEventListener\(\s*["']beforeunload["']/);
    expect(s()).toMatch(/formatSavedAt\(/);
  });
  it("SPLIT: thanh giữa kéo giãn, đổi cỡ chữ, màn hẹp có 2 thẻ Bài đọc / Câu hỏi", () => {
    expect(s()).toMatch(/onPointerDown/);
    expect(s()).toMatch(/Bài đọc/);
    expect(s()).toMatch(/Câu hỏi/);
    expect(s()).toMatch(/Cỡ chữ|fontSize|text-(sm|base|lg)/);
  });
  it("ngữ cảnh của màn hiển thị một lần qua sanitizeStimulusHtml; nộp bài liệt kê câu chưa làm", () => {
    expect(s()).toMatch(/sanitizeStimulusHtml\(/);
    expect(s()).toMatch(/unansweredNumbers\(/);
  });
});

describe("LessonPlayer hỗ trợ bố cục mới", () => {
  it("prop hideStimulus (ẩn ngữ cảnh khi trang đã hiển thị) và startNumber (đánh số liên tục)", () => {
    const p = read(PLAYER);
    expect(p).toMatch(/hideStimulus/);
    expect(p).toMatch(/startNumber/);
    expect(read(PAGE)).toMatch(/hideStimulus/);
  });
});
