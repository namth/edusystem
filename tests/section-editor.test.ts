// FEAT-017 TASK-058 / TASK-059 — logic thuần của trình soạn theo Phần, màn học sinh theo phần và kéo thả.
// TC-P14, TC-P19, TC-P20, TC-P21 (docs/features/phan-bai-hoc-de-thi.md §8).
import { describe, it, expect } from "vitest";
import fs from "fs";
import {
  ADD_TYPES, bankDistractors, changeSkill, fromTree, inlineDistractors, moveQuestionTo, newQuestion, newSection, numbering,
  orderingPieces, questionProblem, toPayload, withBankDistractors, withInlineDistractors, withSentenceList, acceptedForms,
  type EdSection,
} from "@/lib/section-editor";
import { validateTree } from "@/lib/exam-structure";
import { buildSectionScreens, questionNumberLabel, applyOptionShortcut } from "@/lib/exam-layout";
import { dropOnGap, dropOnBank, dropOnLine, dropOffLine, pickBankWord, emptyAnswerFor } from "@/lib/lesson-player";
import { gradeQuestion } from "@/lib/grading";
import { splitOrderingItems } from "@/lib/question-content-types";

const reading = (qs = [newQuestion("READING_MC")]): EdSection => ({ ...newSection("Reading"), questions: qs });

describe("TC-P19: trình soạn theo Phần (BR-P04, DEC-054)", () => {
  it("nút thêm câu chỉ gồm dạng của kỹ năng phần; Reading và Writing có Bộ flashcard", () => {
    expect(ADD_TYPES.Reading.map((t) => t.label)).toEqual(["Trắc nghiệm", "Điền ô trống", "Sắp xếp", "Nối cặp", "Bộ flashcard"]);
    expect(ADD_TYPES.Writing.map((t) => t.category)).toContain("WRITING_FLASHCARD_SET");
    expect(ADD_TYPES.Listening.every((t) => t.category.startsWith("LISTENING_"))).toBe(true);
    expect(ADD_TYPES.Speaking.map((t) => t.label)).toEqual(["Nói theo chủ đề", "Đọc to"]);
  });

  it("kéo câu sang phần khác kỹ năng bị từ chối; cùng kỹ năng thì chuyển và số câu tính lại", () => {
    const a = reading([newQuestion("READING_MC"), newQuestion("READING_MC")]);
    const b = reading([]);
    const w = { ...newSection("Writing"), questions: [] };
    const q = a.questions[0];
    expect(moveQuestionTo([a, b, w], q.key, w.key)).toBeNull();
    const moved = moveQuestionTo([a, b, w], q.key, b.key)!;
    expect(moved[0].questions).toHaveLength(1);
    expect(moved[1].questions.map((x) => x.key)).toEqual([q.key]);
    const n = numbering(moved);
    expect(n.map((s) => [s.start, s.end])).toEqual([[1, 1], [2, 2], [0, 0]]);
  });

  it("đổi kỹ năng phần khi có câu không hợp → báo lỗi, không đổi", () => {
    const r = changeSkill(reading(), "Writing");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/Trắc nghiệm không thuộc Writing/);
    expect(changeSkill(reading([]), "Writing").ok).toBe(true);
  });

  it("toPayload / fromTree giữ id và thứ tự; ngữ cảnh không chọn thì không gửi; dữ liệu mở thẻ khác không mất", () => {
    const s = reading([{ ...newQuestion("READING_MC"), content: { text: "Q", option_a: "x", option_b: "y", correct_answer: "B" } }]);
    s.stimulus_type = "NONE";
    s.stimulus_text = "<p>còn sót</p>";
    const p = toPayload([s]);
    expect(p[0].stimulus_text).toBeNull();
    expect(p[0].questions[0].content).toMatchObject({ text: "Q", correct_answer: "B" });
    const back = fromTree([{ ...p[0], id: "sec_1", questions: [{ ...p[0].questions[0], id: "q_1" }] }]);
    expect(back[0]).toMatchObject({ id: "sec_1", key: "sec_1" });
    expect(back[0].questions[0]).toMatchObject({ id: "q_1", content: { text: "Q" } });
  });

  it("cây trình soạn đi qua validateTree của server: phần trống báo lỗi, phần chỉ có lời dẫn hợp lệ", () => {
    const empty = newSection("Reading");
    const readOnly = { ...newSection("Reading"), instruction: "Part 2 — đọc hướng dẫn" };
    expect(validateTree("exam", toPayload([reading(), empty])).map((i) => i.message)).toContain("Phần 2 trống: thêm lời dẫn, ngữ cảnh hoặc câu hỏi.");
    expect(validateTree("exam", toPayload([reading(), readOnly]))).toEqual([]);
  });

  it("kho từ: đáp án luôn trong kho, từ nhiễu sửa riêng; chọn trong từng ô: từ nhiễu riêng mỗi ô", () => {
    let c: Record<string, unknown> = { fill_subtype: "OPTION_BANK", passage: "He [runs] and [jumps]." };
    c = withBankDistractors(c, ["walks", "runs"]);
    expect(c.option_bank).toEqual(["runs", "jumps", "walks"]);
    expect(bankDistractors(c)).toEqual(["walks"]);
    let d: Record<string, unknown> = { fill_subtype: "INLINE_SELECT", passage: "I [am] here and [you] too." };
    d = withInlineDistractors(d, 0, ["is", "are"]);
    d = withInlineDistractors(d, 1, ["me"]);
    expect(d.inline_options_per_gap).toEqual([{ gap_index: 0, options: ["am", "is", "are"] }, { gap_index: 1, options: ["you", "me"] }]);
    expect(inlineDistractors(d, 0)).toEqual(["is", "are"]);
  });

  it("tự gõ: hiện các đáp án được chấp nhận như cách chấm (DEC-049)", () => {
    expect(acceptedForms("trainers / sports shoes")).toEqual({ forms: ["trainers", "sports shoes"], optional: null });
    expect(acceptedForms("(the) town park")).toEqual({ forms: ["town park"], optional: "the" });
  });

  it("sắp xếp từ giữ cụm khi ngăn bằng ' / '; 'and/or' không bị tách; sắp xếp câu từ danh sách ô", () => {
    expect(orderingPieces({ ordering_type: "WORD_ORDERING", correct_text: "People thought / the story / was written." })).toEqual(["People thought", "the story", "was written."]);
    expect(splitOrderingItems("tea and/or coffee", "WORD_ORDERING")).toEqual(["tea", "and/or", "coffee"]);
    const c = withSentenceList({ ordering_type: "SENTENCE_ORDERING" }, ["First, wash", "Then cook it.", ""]);
    expect(c.correct_text).toBe("First, wash. Then cook it.");
    expect(orderingPieces(c)).toEqual(["First, wash.", "Then cook it."]);
  });

  it("thẻ câu báo chỗ thiếu trước khi lưu", () => {
    expect(questionProblem({ ...newQuestion("READING_MC"), content: { option_a: "x", option_b: "", correct_answer: "A" } })).toMatch(/2 phương án/);
    expect(questionProblem({ ...newQuestion("READING_MC"), content: { option_a: "x", option_b: "y", correct_answer: "C" } })).toMatch(/phương án trống/);
    expect(questionProblem({ ...newQuestion("READING_FILL_IN"), content: { passage: "không có ô" } })).toMatch(/ô \[đáp án\]/);
    expect(questionProblem({ ...newQuestion("READING_FLASHCARD_SET") })).toMatch(/chưa có thẻ/);
    expect(questionProblem({ ...newQuestion("WRITING_ESSAY"), prompt: "Viết" })).toBeNull();
  });

  it("trang soạn đề / bài học dùng SectionEditor; component có nút Lưu ở cả thanh trên và cuối vùng soạn", () => {
    const s = fs.readFileSync("components/section-builder/SectionEditor.tsx", "utf8");
    expect((s.match(/onClick=\{doSave\}/g) || []).length).toBe(2);
    expect(fs.readFileSync("app/teacher/tests/create/page.tsx", "utf8")).toContain("SectionEditor");
    expect(fs.readFileSync("app/teacher/lessons/[id]/page.tsx", "utf8")).toContain("SectionEditor");
  });
});

describe("TC-P14 / TC-P20: màn học sinh theo phần (BR-P11)", () => {
  const sections = [
    { id: "s1", skill: "Reading", instruction: "Pronunciation", questions: [{ id: "a", number_start: 1, number_count: 1 }, { id: "b", number_start: 2, number_count: 1 }] },
    { id: "s2", skill: "Listening", instruction: "Part 2 — đọc hướng dẫn", questions: [] },
    { id: "s3", skill: "Listening", stimulus_audio_url: "/x.mp3", questions: [{ id: "c", number_start: 3, number_count: 10 }] },
    { id: "s4", skill: "Reading", stimulus_text: "<p>" + "x".repeat(700) + "</p>", questions: [{ id: "d", number_start: 13, number_count: 1 }] },
  ];

  it("mỗi phần một màn theo thứ tự (không gom theo kỹ năng); phần 0 câu là màn chỉ đọc", () => {
    const sc = buildSectionScreens(sections);
    expect(sc.map((s) => s.key)).toEqual(["s1", "s2", "s3", "s4"]);
    expect(sc.map((s) => s.readOnly)).toEqual([false, true, false, false]);
    expect(sc.map((s) => s.mode)).toEqual(["FOCUS", "FOCUS", "LISTENING", "SPLIT"]);
    expect(sc[0]).toMatchObject({ instruction: "Pronunciation", numberStart: 1, numberEnd: 2 });
    expect(sc[1]).toMatchObject({ numberStart: null, numberEnd: null, questionIds: [] });
    expect(sc[2]).toMatchObject({ numberStart: 3, numberEnd: 12 });
  });

  it("nhãn số câu trên bảng điều hướng: câu chiếm nhiều số hiện khoảng", () => {
    expect(questionNumberLabel({ number_start: 3, number_count: 10 }, 99)).toBe("3–12");
    expect(questionNumberLabel({ number_start: 13, number_count: 1 }, 99)).toBe("13");
    expect(questionNumberLabel({}, 4)).toBe("4");
  });

  it("trắc nghiệm một ý: đáp án rỗng ban đầu là chuỗi; phím tắt A–D trả chữ cái; chấm được", () => {
    const q = { id: "q", category: "READING_MC", content: { text: "?", option_a: "x", option_b: "y", option_c: "", correct_answer: "B" } };
    expect(emptyAnswerFor(q)).toBe("");
    expect(applyOptionShortcut(q, "", "B")).toBe("B");
    expect(applyOptionShortcut(q, "", "C")).toBeNull();
    expect(gradeQuestion(q, applyOptionShortcut(q, "", "B")).earned).toBe(1);
  });
});

describe("TC-P21: kéo thả cho cùng đáp án như bấm (BR-P15)", () => {
  it("kho từ: thả vào ô, đổi chỗ hai ô, thả về kho thì bỏ", () => {
    let a = dropOnGap(["", "", ""], 3, { from: "bank", word: "runs" }, 1);
    expect(a).toEqual(["", "runs", ""]);
    a = dropOnGap(a, 3, { from: "bank", word: "jumps" }, 0);
    a = dropOnGap(a, 3, { from: "gap", index: 0 }, 2);
    expect(a).toEqual(["", "runs", "jumps"]);
    expect(dropOnBank(a, 3, { from: "gap", index: 1 })).toEqual(["", "", "jumps"]);
    // giống hệt khi chọn ô rồi bấm từ
    const tap = pickBankWord(pickBankWord(["", "", ""], 3, 1, "runs").answers, 3, 2, "jumps").answers;
    expect(tap).toEqual(["", "runs", "jumps"]);
  });

  it("sắp xếp: thả lên vị trí 0 → chèn đầu; kéo trong dòng đổi thứ tự; kéo ra ngoài bỏ mảnh", () => {
    let o = dropOnLine([], { from: "pool", item: "thought" }, 0);
    o = dropOnLine(o, { from: "pool", item: "People" }, 0);
    o = dropOnLine(o, { from: "pool", item: "story" }, o.length);
    expect(o).toEqual(["People", "thought", "story"]);
    o = dropOnLine(o, { from: "line", index: 2 }, 1);
    expect(o).toEqual(["People", "story", "thought"]);
    o = dropOnLine(o, { from: "line", index: 0 }, 3);
    expect(o).toEqual(["story", "thought", "People"]);
    expect(dropOffLine(o, { from: "line", index: 1 })).toEqual(["story", "People"]);
    const q = { id: "o", category: "READING_ORDERING", content: { ordering_type: "WORD_ORDERING", correct_text: "People thought story" } };
    expect(gradeQuestion(q, dropOnLine(dropOnLine(dropOnLine([], { from: "pool", item: "story" }, 0), { from: "pool", item: "thought" }, 0), { from: "pool", item: "People" }, 0)).earned).toBe(1);
  });

  it("LessonPlayer gắn kéo thả bằng Pointer Events (chạy cảm ứng) và vẫn giữ bấm để chọn", () => {
    const s = fs.readFileSync("components/lesson-player/LessonPlayer.tsx", "utf8");
    const hook = fs.readFileSync("components/lesson-player/usePointerDrag.tsx", "utf8");
    expect(hook).toContain("pointermove");
    expect(hook).toContain("touchAction");
    expect(s).toContain("data-drop={`gap|");
    expect(s).toContain("data-drop={`line|");
    expect(s).toContain("pickBankWord(");
  });
});
