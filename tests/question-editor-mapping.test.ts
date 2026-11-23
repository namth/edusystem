// BR-I24 → BR-I26 (FEAT-015): chuẩn hoá content câu nhập AI / tạo tay để lưu lại không mất dữ liệu.
// FEAT-017: trình soạn QuestionSetEditor + lib/question-editor-mapping.ts đã thay bằng SectionEditor (sửa thẳng content),
// phần kiểm trình soạn chuyển sang tests/section-editor.test.ts; ở đây giữ phần chuẩn hoá và kho từ bấm-điền.
import { describe, it, expect } from "vitest";
import { buildStandardQuestionContent, mcAnswerLetter, standardFillIn } from "@/lib/question-content-types";
import { bankUsage, nextEmptyGap, pickBankWord } from "@/lib/lesson-player";
import { gradeQuestion } from "@/lib/grading";

describe("TC-I30: đáp án trắc nghiệm luôn là chữ cái (BR-I24)", () => {
  it("câu tạo bằng trình sửa cũ lưu đáp án là chữ của phương án → vẫn ra đúng chữ cái", () => {
    expect(mcAnswerLetter({ option_a: "slowly", option_b: "fast", correct_answer: "fast" })).toBe("B");
    expect(mcAnswerLetter({ option_a: "x", option_b: "y", correct_answer: "b" })).toBe("B");
  });

  it("chuẩn hoá chạy hai lần (trình soạn rồi API) cho cùng kết quả; chấm đúng đáp án màn thi gửi", () => {
    const once = buildStandardQuestionContent({ category: "READING_MC", text: "She is ___ than me.", option_a: "tall", option_b: "taller", option_c: "tallest", option_d: "", correct_answer: "taller" });
    const twice = buildStandardQuestionContent({ category: "READING_MC", ...once });
    expect(twice).toEqual(once);
    expect(once).toMatchObject({ option_d: "", correct_answer: "B" });
    expect(gradeQuestion({ id: "q", category: "READING_MC", content: once }, "B").earned).toBe(1);
  });
});

describe("TC-I31: điền ô lưu lại (BR-I24)", () => {
  it("inline select → inline_options_per_gap (đọc cả option_banks cũ) + correct_answers suy từ đoạn văn", () => {
    const c = buildStandardQuestionContent({
      category: "READING_FILL_IN", passage: "I have a daughter (25) [named] Nicole. She (26) [is] three.", fill_subtype: "INLINE_SELECT",
      option_banks: [{ gap_index: 0, options: ["naming", "who name"] }, { gap_index: 1, options: ["are", "be"] }],
    });
    expect(c.inline_options_per_gap).toEqual([
      { gap_index: 0, options: ["naming", "who name", "named"] },
      { gap_index: 1, options: ["are", "be", "is"] },
    ]);
    expect(c.correct_answers).toEqual(["named", "is"]);
    expect(c.option_banks).toBeUndefined();
  });

  it("option bank: kho từ luôn chứa đáp án; sửa đáp án trong đoạn văn thì correct_answers đổi theo", () => {
    const c = standardFillIn({ fill_subtype: "OPTION_BANK", passage: "He [runs] and [jumps].", option_bank: ["runs", "walks"], correct_answers: ["old"] });
    expect(c.option_bank).toEqual(["runs", "walks", "jumps"]);
    expect(c.correct_answers).toEqual(["runs", "jumps"]);
  });

  it("free typing giữ nguyên kiểu tự gõ", () => {
    expect(standardFillIn({ fill_subtype: "FREE_TYPING", passage: "(8) [river]" })).toEqual({ passage: "(8) [river]", fill_subtype: "FREE_TYPING", correct_answers: ["river"] });
  });
});

describe("TC-I32: viết lại câu, bài luận giữ đủ trường (BR-I24)", () => {
  it("viết lại câu từ sub_questions cũ → content phẳng mà grading chấm được", () => {
    const c = buildStandardQuestionContent({ category: "WRITING_SENTENCE_REWRITE", sub_questions: [{ original_sentence: "A", correct_answer: "[Unless] you go, ..." }] });
    expect(c).toMatchObject({ original_sentence: "A", correct_answer: "[Unless] you go, ...", starting_cue: "Unless" });
  });

  it("giữ import_meta, min_words, task_type khi giáo viên sửa câu nhập AI", () => {
    const c = buildStandardQuestionContent({ category: "WRITING_ESSAY", min_words: 150, task_type: "Task 2", import_meta: { source: "AI_IMPORT" } });
    expect(c).toMatchObject({ min_words: 150, task_type: "Task 2", import_meta: { source: "AI_IMPORT" } });
  });
});

describe("TC-I33: kho từ OPTION_BANK bấm để điền (BR-I26)", () => {
  it("bấm từ → điền ô đang chọn hoặc ô trống đầu tiên, rồi chuyển sang ô trống kế", () => {
    let r = pickBankWord(["", "", ""], 3, null, "runs");
    expect(r).toEqual({ answers: ["runs", "", ""], active: 1 });
    r = pickBankWord(r.answers, 3, 2, "jumps");
    expect(r).toEqual({ answers: ["runs", "", "jumps"], active: 1 });
    r = pickBankWord(r.answers, 3, r.active, "walks");
    expect(r).toEqual({ answers: ["runs", "walks", "jumps"], active: null });
    expect(pickBankWord(r.answers, 3, null, "x").answers).toEqual(["runs", "walks", "jumps"]);
  });

  it("thẻ đã dùng bị mờ; kho lặp từ thì mỗi lần dùng chiếm một thẻ", () => {
    expect(bankUsage(["a", "b", "a"], ["a", "", ""])).toEqual([true, false, false]);
    expect(bankUsage(["a", "b", "a"], ["a", "A", "b"])).toEqual([true, true, true]);
    expect(nextEmptyGap(["x", "", "y"], 3, 2)).toBe(1);
  });
});
