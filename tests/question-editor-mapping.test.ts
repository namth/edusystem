// BR-I24 → BR-I26: câu nhập AI mở "Sửa" phải thấy đủ trường như câu tạo trực tiếp; lưu lại không mất dữ liệu.
import { describe, it, expect } from "vitest";
import {
  editorMcSubs,
  mcSubsToContent,
  editorFillIn,
  inlineOptionsFromEditor,
  editorOrdering,
  editorRewriteSubs,
  editorShortAnswers,
  plainText,
} from "@/lib/question-editor-mapping";
import { buildStandardQuestionContent, mcAnswerLetter, standardFillIn } from "@/lib/question-content-types";
import { bankUsage, nextEmptyGap, pickBankWord } from "@/lib/lesson-player";
import { gradeQuestion } from "@/lib/grading";

describe("TC-I30: trắc nghiệm nhập AI → trình sửa (BR-I24)", () => {
  const imported = [
    { id: "g1_q1", number: 1, text: "", option_a: "<u>e</u>ndangered", option_b: "g<u>e</u>neration", option_c: "<u>e</u>mbroider", option_d: "", correct_answer: "B" },
    { id: "g1_q5", number: 5, text: "She <b>is</b> ___ than me.", option_a: "tall", option_b: "taller", option_c: "tallest", option_d: "most tall", correct_answer: "b" },
  ];

  it("đọc đủ lời dẫn, 3–4 phương án (chữ trơn, không thẻ HTML), đáp án chữ cái và số câu đề giấy", () => {
    const subs = editorMcSubs(imported);
    expect(subs[0]).toMatchObject({ id: "g1_q1", number: 1, subQuestionText: "", optA: "endangered", optB: "generation", optC: "embroider", optD: "", correctAnswer: "B" });
    expect(subs[1]).toMatchObject({ number: 5, subQuestionText: "She is ___ than me.", correctAnswer: "B" });
  });

  it("câu tạo bằng trình sửa cũ lưu đáp án là chữ của phương án → vẫn ra đúng chữ cái", () => {
    expect(mcAnswerLetter({ option_a: "slowly", option_b: "fast", correct_answer: "fast" })).toBe("B");
    expect(editorMcSubs([{ id: "x", text: "Q", option_a: "slowly", option_b: "fast", correct_answer: "fast" }])[0].correctAnswer).toBe("B");
  });

  it("lưu lại: giữ số câu, đáp án chữ cái, không tự điền 'Option D'; chấm đúng với đáp án màn thi gửi (A–D)", () => {
    const content = buildStandardQuestionContent({ category: "READING_MC", subQuestions: editorMcSubs(imported), sub_questions: mcSubsToContent(editorMcSubs(imported)) });
    expect(content.sub_questions[0]).toMatchObject({ number: 1, option_d: "", correct_answer: "B" });
    const r = gradeQuestion({ id: "q", category: "READING_MC", content }, { g1_q1: "B", g1_q5: "A" });
    expect(r.earned).toBe(1);
  });

  it("chuẩn hoá chạy hai lần (trình sửa rồi API) cho cùng kết quả", () => {
    const once = buildStandardQuestionContent({ category: "READING_MC", sub_questions: mcSubsToContent(editorMcSubs(imported)) });
    const twice = buildStandardQuestionContent({ category: "READING_MC", ...once });
    expect(twice).toEqual(once);
  });
});

describe("TC-I31: điền ô nhập AI → trình sửa và lưu lại (BR-I24)", () => {
  const inline = {
    fill_subtype: "INLINE_SELECT",
    passage: "I have a daughter (25) [named] Nicole. She (26) [is] three.",
    correct_answers: ["named", "is"],
    inline_options_per_gap: [
      { gap_index: 0, options: ["naming", "named", "who name", "is named"] },
      { gap_index: 1, options: ["are", "is", "be"] },
    ],
  };

  it("inline select: hiện đủ từ nhiễu từng ô (đọc inline_options_per_gap)", () => {
    const f = editorFillIn(inline);
    expect(f.subtype).toBe("INLINE_SELECT");
    expect(f.distractors).toEqual({ 0: "naming, who name, is named", 1: "are, be" });
  });

  it("dữ liệu trình sửa cũ (option_banks) cũng đọc được", () => {
    const f = editorFillIn({ fill_subtype: "INLINE_SELECT", passage: "A [x] b", option_banks: [{ gap_index: 0, options: ["x", "y"] }] });
    expect(f.distractors).toEqual({ 0: "y" });
  });

  it("lưu inline select → inline_options_per_gap (màn thi đọc trường này) + correct_answers suy từ đoạn văn", () => {
    const f = editorFillIn(inline);
    const per = inlineOptionsFromEditor(f.passage, f.distractors);
    const c = buildStandardQuestionContent({ category: "READING_FILL_IN", passage: f.passage, fill_subtype: "INLINE_SELECT", inline_options_per_gap: per });
    expect(c.inline_options_per_gap).toEqual([
      { gap_index: 0, options: ["named", "naming", "who name", "is named"] },
      { gap_index: 1, options: ["is", "are", "be"] },
    ]);
    expect(c.correct_answers).toEqual(["named", "is"]);
    expect(c.option_banks).toBeUndefined();
  });

  it("option bank: kho từ luôn chứa đáp án; sửa đáp án trong đoạn văn thì correct_answers đổi theo", () => {
    const c = standardFillIn({ fill_subtype: "OPTION_BANK", passage: "He [runs] and [jumps].", option_bank: ["runs", "walks"], correct_answers: ["old"] });
    expect(c.option_bank).toEqual(["runs", "walks", "jumps"]);
    expect(c.correct_answers).toEqual(["runs", "jumps"]);
  });

  it("free typing nhập AI giữ nguyên kiểu tự gõ", () => {
    expect(editorFillIn({ fill_subtype: "FREE_TYPING", passage: "(8) [river]" }).subtype).toBe("FREE_TYPING");
    expect(standardFillIn({ fill_subtype: "FREE_TYPING", passage: "(8) [river]" })).toEqual({ passage: "(8) [river]", fill_subtype: "FREE_TYPING", correct_answers: ["river"] });
  });
});

describe("TC-I32: sắp xếp, viết lại câu, trả lời ngắn nhập AI → trình sửa (BR-I24)", () => {
  it("sắp xếp từ: giữ kiểu WORD_ORDERING và câu đúng", () => {
    expect(editorOrdering({ ordering_type: "WORD_ORDERING", correct_text: "People thought the story was written by the princess herself." })).toEqual({
      type: "WORD_ORDERING",
      text: "People thought the story was written by the princess herself.",
    });
  });

  it("viết lại câu nhập AI (trường phẳng + gợi ý) → một câu con có [gợi ý]", () => {
    const subs = editorRewriteSubs({ original_sentence: "I last saw him in 2010.", starting_cue: "I haven't", correct_answer: "[I haven't] seen him since 2010." });
    expect(subs).toHaveLength(1);
    expect(subs[0]).toMatchObject({ originalSentence: "I last saw him in 2010.", correctAnswer: "[I haven't] seen him since 2010." });
    const noBracket = editorRewriteSubs({ original_sentence: "x", starting_cue: "It is", correct_answer: "It is fun." });
    expect(noBracket[0].correctAnswer).toBe("[It is] fun.");
  });

  it("viết lại câu từ trình sửa (sub_questions) → content phẳng mà grading chấm được", () => {
    const c = buildStandardQuestionContent({ category: "WRITING_SENTENCE_REWRITE", sub_questions: [{ original_sentence: "A", correct_answer: "[Unless] you go, ..." }] });
    expect(c).toMatchObject({ original_sentence: "A", correct_answer: "[Unless] you go, ...", starting_cue: "Unless" });
  });

  it("trả lời ngắn giữ đáp án mẫu khi lưu lại", () => {
    const subs = editorShortAnswers({ sub_questions: [{ id: "s1", text: "Why?", max_words: 20, sample_answer: "Because." }] });
    expect(subs[0]).toMatchObject({ questionText: "Why?", maxWords: 20, sampleAnswer: "Because." });
    const c = buildStandardQuestionContent({ category: "WRITING_SHORT_ANSWER", subQuestions: subs });
    expect(c.sub_questions[0]).toMatchObject({ text: "Why?", max_words: 20, sample_answer: "Because." });
  });

  it("giữ import_meta và min_words khi giáo viên sửa câu nhập AI", () => {
    const c = buildStandardQuestionContent({ category: "WRITING_ESSAY", min_words: 150, task_type: "Task 2", import_meta: { source: "AI_IMPORT" } });
    expect(c).toMatchObject({ min_words: 150, task_type: "Task 2", import_meta: { source: "AI_IMPORT" } });
  });

  it("plainText bỏ thẻ và giải mã thực thể", () => {
    expect(plainText("h<u>a</u>t &amp; <b>c</b>at")).toBe("hat & cat");
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
    // hết ô trống, không chọn ô nào → giữ nguyên
    expect(pickBankWord(r.answers, 3, null, "x").answers).toEqual(["runs", "walks", "jumps"]);
  });

  it("thẻ đã dùng bị mờ; kho lặp từ thì mỗi lần dùng chiếm một thẻ", () => {
    expect(bankUsage(["a", "b", "a"], ["a", "", ""])).toEqual([true, false, false]);
    expect(bankUsage(["a", "b", "a"], ["a", "A", "b"])).toEqual([true, true, true]);
    expect(nextEmptyGap(["x", "", "y"], 3, 2)).toBe(1);
  });
});
