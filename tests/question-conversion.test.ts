// TASK-051 · FEAT-015 §7–8 — bộ chuyển đổi dạng câu giấy → dạng hệ thống (hàm thuần).
/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect } from "vitest";
import {
  convertGroup,
  validateQuestionContent,
  countScoreItems,
  type RawGroup,
  type RawSubQuestion,
  type PaperFormat,
} from "@/lib/question-conversion";
import { parseFillInGaps, splitOrderingItems } from "@/lib/question-content-types";
import { gradeQuestion, sanitizeQuestionForStudent } from "@/lib/grading";

const opts = (...t: string[]) => t.map((text_html, i) => ({ key: "ABCD"[i], text_html }));
function sub(number: number, format: PaperFormat, o: Partial<RawSubQuestion> = {}): RawSubQuestion {
  return {
    id: `s${number}`,
    number,
    text_html: `Câu ${number}`,
    options: opts("w", "x", "y", "z"),
    correct_answer: "A",
    answer_source: "KEY",
    paper_format: format,
    confidence: 0.9,
    ...o,
  };
}
const group = (subs: RawSubQuestion[], o: Partial<RawGroup> = {}): RawGroup => ({
  tempId: "g1",
  groupNumber: 1,
  skill: "Reading",
  prompt: "Read the passage and choose the correct answer.",
  sub_questions: subs,
  ...o,
});
const asGradable = (q: any, id = "q1") => ({ id, category: q.category, content: q.content, skill: q.skill });
const codes = (r: ReturnType<typeof convertGroup>) => r.warnings.map((w) => w.code);

const CLOZE_HTML =
  "<p>Many people (25) ______ rely on machines. This (26) _____ changed our lives. " +
  "Machines are ____ (27) ____ everywhere, [note] from homes … to offices (28) ..... and schools __29__ and (30) _____ beyond.</p>";
const clozeSubs = () => [
  sub(25, "CLOZE_PASSAGE", { options: opts("increasingly", "increase", "increased", "increasing"), correct_answer: "A" }),
  sub(26, "CLOZE_PASSAGE", { options: opts("have", "has", "having", "had"), correct_answer: "B" }),
  sub(27, "CLOZE_PASSAGE", { options: opts("use", "used", "using", "uses"), correct_answer: "B" }),
  sub(28, "CLOZE_PASSAGE", { options: opts("in", "on", "at", "by"), correct_answer: "A" }),
  sub(29, "CLOZE_PASSAGE", { options: opts("even", "ever", "every", "else"), correct_answer: "A" }),
  sub(30, "CLOZE_PASSAGE", { options: opts("far", "further", "farther", "farthest"), correct_answer: "A" }),
];

describe("Cloze & ô trống (BR-I02 → BR-I06)", () => {
  it("BR-I22: đoạn điền từ chỉ nằm ở bài đọc chung (passage_html) → vẫn dựng INLINE_SELECT trên bài đó, không gắn lại làm stimulus, không cần AI", () => {
    const r = convertGroup(group(clozeSubs(), { stimulus_html: null, passage_html: CLOZE_HTML }));
    expect(r.needsAi).toEqual([]);
    expect(r.questions[0]).toMatchObject({ category: "READING_FILL_IN", stimulus_text: null });
    expect(parseFillInGaps(String(r.questions[0].content.passage)).gaps).toEqual(["increasingly", "has", "used", "in", "even", "far"]);
  });

  it("TC-I01: cloze 6 ô nhiều kiểu dấu → INLINE_SELECT, 6 danh sách phương án, đáp án đúng chữ, không còn '25' làm đáp án", () => {
    const r = convertGroup(group(clozeSubs(), { stimulus_html: CLOZE_HTML }));
    expect(r.needsAi).toEqual([]);
    expect(r.questions).toHaveLength(1);
    const q = r.questions[0];
    expect(q.category).toBe("READING_FILL_IN");
    expect(q.stimulus_text).toBeNull();
    expect(q.content.fill_subtype).toBe("INLINE_SELECT");
    expect(q.content.correct_answers).toEqual(["increasingly", "has", "used", "in", "even", "far"]);
    expect((q.content.inline_options_per_gap as any[]).map((g) => g.gap_index)).toEqual([0, 1, 2, 3, 4, 5]);
    expect((q.content.inline_options_per_gap as any[])[1].options).toEqual(["have", "has", "having", "had"]);
    const gaps = parseFillInGaps(String(q.content.passage)).gaps;
    expect(gaps).toEqual(["increasingly", "has", "used", "in", "even", "far"]);
    expect(String(q.content.passage)).toContain("(25) [increasingly]");
    expect(validateQuestionContent(q.category, q.content)).toEqual({ ok: true });
    expect(q.content.import_meta).toMatchObject({ source: "AI_IMPORT", paper_format: "CLOZE_PASSAGE", paper_numbers: [25, 26, 27, 28, 29, 30] });
  });

  it("TC-I02: đi vòng chuyển đổi → ẩn đáp án → chấm: đúng hết = 6/6, sai một ô = 5/6", () => {
    const q = convertGroup(group(clozeSubs(), { stimulus_html: CLOZE_HTML })).questions[0];
    const student = sanitizeQuestionForStudent(asGradable(q));
    expect(JSON.stringify(student)).not.toContain("increasingly]");
    expect(student.content.correct_answers).toBeUndefined();
    const right = ["increasingly", "has", "used", "in", "even", "far"];
    expect(gradeQuestion(asGradable(q), right)).toMatchObject({ earned: 6, max: 6 });
    expect(gradeQuestion(asGradable(q), ["increasingly", "have", "used", "in", "even", "far"])).toMatchObject({ earned: 5, max: 6 });
  });

  it("cloze chỉ 1 ô → OPTION_BANK", () => {
    const r = convertGroup(group([sub(1, "CLOZE_PASSAGE", { options: opts("a", "an", "the", "no"), correct_answer: "C" })], { stimulus_html: "I saw (1) ____ moon." }));
    expect(r.questions[0].content).toMatchObject({ fill_subtype: "OPTION_BANK", option_bank: ["a", "an", "the", "no"], correct_answers: ["the"] });
  });

  it("TC-I03: câu 1 ô + ABCD → OPTION_BANK 4 phương án, mỗi câu một bản ghi", () => {
    const r = convertGroup(
      group([
        sub(12, "SENTENCE_BLANK", { text_html: "She ______ to school every day.", options: opts("goes", "go", "going", "gone"), correct_answer: "A" }),
        sub(13, "SENTENCE_BLANK", { text_html: "They … football now.", options: opts("play", "are playing", "played", "plays"), correct_answer: "B" }),
      ])
    );
    expect(r.questions).toHaveLength(2);
    expect(r.questions[0].content).toMatchObject({ fill_subtype: "OPTION_BANK", option_bank: ["goes", "go", "going", "gone"], correct_answers: ["goes"] });
    expect(r.questions[0].content.passage).toBe("She [goes] to school every day.");
    expect(r.questions[1].content.correct_answers).toEqual(["are playing"]);
    for (const q of r.questions) expect(validateQuestionContent(q.category, q.content)).toEqual({ ok: true });
    expect(gradeQuestion(asGradable(r.questions[0]), ["goes"])).toMatchObject({ earned: 1, max: 1 });
  });

  it("TC-I04: câu 2 ô, phương án 'who / which' ×4 → 2 ô INLINE_SELECT, 2 mục chấm; một phương án không tách được → giữ READING_MC", () => {
    const pairSub = sub(14, "SENTENCE_MULTI_BLANK", {
      text_html: "She is the girl ____ I met at the party ____ you held.",
      options: opts("who / which", "that / where", "whom / that", "which / who"),
      correct_answer: "C",
    });
    const r = convertGroup(group([pairSub]));
    const q = r.questions[0];
    expect(q.content.fill_subtype).toBe("INLINE_SELECT");
    expect(q.content.correct_answers).toEqual(["whom", "that"]);
    expect((q.content.inline_options_per_gap as any[])[0].options).toEqual(["who", "that", "whom", "which"]);
    expect((q.content.inline_options_per_gap as any[])[1].options).toEqual(["which", "where", "that", "who"]);
    expect(countScoreItems(q)).toBe(2);
    expect(validateQuestionContent(q.category, q.content)).toEqual({ ok: true });

    const mixed = convertGroup(group([{ ...pairSub, options: opts("who / which", "1/2 of / the", "whom", "which / who") }]));
    expect(mixed.questions[0].category).toBe("READING_MC");
    expect(codes(mixed)).not.toContain("CONVERSION_FAILED");
  });

  it("TC-I05: hộp từ chung + từng câu 1 chỗ trống → một OPTION_BANK chung, đáp án theo chữ", () => {
    const r = convertGroup(
      group(
        [
          sub(1, "WORD_BOX", { text_html: "I like ____ apples.", options: [], correct_answer: "red" }),
          sub(2, "WORD_BOX", { text_html: "The sky is ____.", options: [], correct_answer: "blue" }),
        ],
        { word_box: ["red", "blue", "green"] }
      )
    );
    const q = r.questions[0];
    expect(r.questions).toHaveLength(1);
    expect(q.content).toMatchObject({ fill_subtype: "OPTION_BANK", option_bank: ["red", "blue", "green"], correct_answers: ["red", "blue"] });
    expect(parseFillInGaps(String(q.content.passage)).gaps).toEqual(["red", "blue"]);
    expect(validateQuestionContent(q.category, q.content)).toEqual({ ok: true });
  });

  it("TC-I08: ngoặc vuông có sẵn trong đoạn văn bị đổi thành ngoặc tròn, số ô không đổi", () => {
    const q = convertGroup(group(clozeSubs(), { stimulus_html: CLOZE_HTML })).questions[0];
    expect(String(q.content.passage)).toContain("(note)");
    expect(parseFillInGaps(String(q.content.passage)).gaps).toHaveLength(6);
  });

  it("không tìm thấy ô → giữ READING_MC (đoạn văn ở stimulus) + GAP_NOT_FOUND + needsAi", () => {
    const r = convertGroup(group(clozeSubs(), { stimulus_html: "<p>Đoạn văn không đánh số ô.</p>" }));
    expect(r.questions[0].category).toBe("READING_MC");
    expect(r.questions[0].stimulus_text).toContain("Đoạn văn");
    expect(codes(r)).toContain("GAP_NOT_FOUND");
    expect(r.needsAi).toEqual(["GAP_NOT_FOUND"]);
  });
});

describe("Sắp xếp, ghép nối, tự luận", () => {
  it("TC-I06: sắp xếp câu a–e, đáp án 'C. b-d-a-e-c' → SENTENCE_ORDERING đúng thứ tự", () => {
    const s = sub(40, "SENTENCE_ARRANGEMENT", {
      text_html: "a. Then we had lunch. b. I woke up early. c. Finally I went to bed. d. I had breakfast. e. In the evening I read",
      options: opts("a-b-c-d-e", "b-a-d-c-e", "b-d-a-e-c", "d-b-a-e-c"),
      correct_answer: "C",
    });
    const q = convertGroup(group([s])).questions[0];
    expect(q.category).toBe("READING_ORDERING");
    expect(q.content.ordering_type).toBe("SENTENCE_ORDERING");
    expect(splitOrderingItems(String(q.content.correct_text), "SENTENCE_ORDERING")).toEqual([
      "I woke up early.",
      "I had breakfast.",
      "Then we had lunch.",
      "In the evening I read.",
      "Finally I went to bed.",
    ]);
    expect(validateQuestionContent(q.category, q.content)).toEqual({ ok: true });
  });

  it("TC-I07: sắp xếp từ → WORD_ORDERING, kể cả gợi ý thiếu từ nối (học sinh xếp toàn bộ từ của câu đúng, BR-I21); lệch quá xa → MC; không có đáp án → CONVERSION_FAILED", () => {
    const ok = convertGroup(group([sub(41, "WORD_ARRANGEMENT", { text_html: "school / go / I / to", options: opts("I go to school.", "Go I school to.", "To school I go.", "I to go school."), correct_answer: "A" })]));
    expect(ok.questions[0]).toMatchObject({ category: "READING_ORDERING", content: { ordering_type: "WORD_ORDERING", correct_text: "I go to school." } });
    // đề Việt Nam: "People / thought / story / written…" — đáp án thêm "the", "was", "by"
    const cue = convertGroup(group([sub(39, "WORD_ARRANGEMENT", { text_html: "People / thought / story / written / the / princess / herself.", options: opts("People thought the book written by the princess herself.", "People thought the story was written by the princess herself.", "y", "z"), correct_answer: "B" })]));
    expect(cue.questions[0]).toMatchObject({ category: "READING_ORDERING", content: { ordering_type: "WORD_ORDERING", correct_text: "People thought the story was written by the princess herself." } });
    expect(codes(cue)).not.toContain("CONVERSION_FAILED");
    const far = convertGroup(group([sub(41, "WORD_ARRANGEMENT", { text_html: "apple / banana / cherry", options: opts("I go to school.", "x", "y", "z"), correct_answer: "A" })]));
    expect(far.questions[0].category).toBe("READING_MC");
    expect(codes(far)).not.toContain("CONVERSION_FAILED");
    const none = convertGroup(group([sub(41, "WORD_ARRANGEMENT", { text_html: "school / go / I", options: [], correct_answer: null })]));
    expect(codes(none)).toContain("CONVERSION_FAILED");
  });

  it("TC-I29: AI gắn nhầm GENERAL_MC cho câu gợi ý từ có dấu \"/\" → vẫn thành sắp xếp từ (BR-I21)", () => {
    const r = convertGroup(group([sub(39, "GENERAL_MC", { text_html: "People / thought / story / written / the / princess / herself.", options: opts("People thought the book written by the princess herself.", "People thought the story was written by the princess herself.", "y", "z"), correct_answer: "B" })]));
    expect(r.questions[0]).toMatchObject({ category: "READING_ORDERING", content: { ordering_type: "WORD_ORDERING" } });
    // câu có chỗ trống hoặc phương án dạng "at / on" ở phần lựa chọn → không đổi
    const blank = convertGroup(group([sub(5, "GENERAL_MC", { text_html: "He / ____ / to school / yesterday", options: opts("go", "went", "goes", "going"), correct_answer: "B" })]));
    expect(blank.questions[0].category).toBe("READING_MC");
  });

  it("ghép nối đúng 1-1, không phương án thừa → READING_MATCHING", () => {
    const r = convertGroup(
      group(
        [sub(1, "MATCHING", { text_html: "Doctor", options: [], correct_answer: "b" }), sub(2, "MATCHING", { text_html: "Teacher", options: [], correct_answer: "a" })],
        { matching: { left: [], right: [{ key: "a", text: "school" }, { key: "b", text: "hospital" }] } }
      )
    );
    const q = r.questions[0];
    expect(q.category).toBe("READING_MATCHING");
    expect((q.content.pairs as any[]).map((p) => [p.left, p.right])).toEqual([["Doctor", "b. hospital"], ["Teacher", "a. school"]]);
    expect(codes(r)).not.toContain("CONVERSION_FAILED");
  });

  it("BR-I15: ghép nối có phương án nhiễu → mỗi mục một danh sách chọn giữ đủ lựa chọn; chấm đúng", () => {
    const r = convertGroup(
      group(
        [sub(1, "MATCHING", { text_html: "Doctor", options: [], correct_answer: "b" }), sub(2, "MATCHING", { text_html: "Teacher", options: [], correct_answer: "a" })],
        { matching: { left: [], right: [{ key: "a", text: "school" }, { key: "b", text: "hospital" }, { key: "c", text: "farm" }] } }
      )
    );
    const q = r.questions[0];
    expect(q).toMatchObject({ category: "READING_FILL_IN", content: { fill_subtype: "INLINE_SELECT", correct_answers: ["b. hospital", "a. school"] } });
    expect((q.content.inline_options_per_gap as any[])[0].options).toEqual(["a. school", "b. hospital", "c. farm"]);
    expect(q.content.passage).toBe("1. Doctor [b. hospital]\n2. Teacher [a. school]");
    expect(validateQuestionContent(q.category, q.content)).toEqual({ ok: true });
    expect(gradeQuestion(asGradable(q), ["b. hospital", "c. farm"])).toMatchObject({ earned: 1, max: 2 });
  });

  it("BR-I15: phân loại (đáp án lặp) và heading số La Mã lấy từ phương án từng câu; nhãn 'Paragraph D' không lặp khoá", () => {
    const romans = ["i", "ii", "iii"].map((k, i) => ({ key: k.toUpperCase(), text_html: ["Causes", "Effects", "Solutions"][i] }));
    const h = convertGroup(group([sub(30, "MATCHING", { text_html: "Paragraph B", options: romans, correct_answer: "ii" }), sub(31, "MATCHING", { text_html: "Paragraph C", options: romans, correct_answer: "ii" })])).questions[0];
    expect(h.category).toBe("READING_FILL_IN");
    expect(h.content.correct_answers).toEqual(["II. Effects", "II. Effects"]);
    const paras = ["A", "B"].map((k) => ({ key: k, text_html: `Paragraph ${k}` }));
    const p = convertGroup(group([sub(13, "MATCHING", { text_html: "a rocket", options: paras, correct_answer: "B" })])).questions[0];
    expect(p.content.correct_answers).toEqual(["Paragraph B"]);
  });

  it("BR-I15: câu đọc hiểu có > 4 phương án (đoạn A–F) → danh sách chọn, không cắt còn A–D", () => {
    const six = ["A", "B", "C", "D", "E", "F"].map((k) => ({ key: k, text_html: `Paragraph ${k}` }));
    const q = convertGroup(group([sub(13, "READING_COMPREHENSION", { text_html: "a rocket", options: six, correct_answer: "F" })])).questions[0];
    expect(q.category).toBe("READING_FILL_IN");
    expect(q.content.correct_answers).toEqual(["Paragraph F"]);
    expect((q.content.inline_options_per_gap as any[])[0].options).toHaveLength(6);
  });

  it("BR-I15: lựa chọn chỉ có trong bảng đoạn dẫn ('| E came with water…') vẫn dựng được", () => {
    const stim = "Animal | Reason\n4 mitten crab | A was a predator\n5 rabbit | B escaped as a pet\n| E came with water";
    const q = convertGroup(group([sub(4, "MATCHING", { text_html: "mitten crab", options: [], correct_answer: "E" }), sub(5, "MATCHING", { text_html: "rabbit", options: [], correct_answer: "B" })], { stimulus_html: stim })).questions[0];
    expect(q.content.correct_answers).toEqual(["E. came with water", "B. escaped as a pet"]);
    expect((q.content.inline_options_per_gap as any[])[0].options).toHaveLength(3);
  });

  it("BR-I16: hoàn thành tóm tắt (Reading, có đáp án) → FILL_IN FREE_TYPING; chấm nhận ' / ' và từ tuỳ chọn trong ngoặc", () => {
    const stim = "<p>Rabbits led to the loss of (10) ________.</p><p>The space (11) ________ began in 1957.</p>";
    const q = convertGroup(
      group([sub(10, "SHORT_ANSWER", { options: [], correct_answer: "land / soil" }), sub(11, "SHORT_ANSWER", { options: [], correct_answer: "[space] race" })], { stimulus_html: stim })
    ).questions[0];
    expect(q).toMatchObject({ skill: "Reading", category: "READING_FILL_IN", content: { fill_subtype: "FREE_TYPING" } });
    expect(q.content.passage).toBe("Rabbits led to the loss of (10) [land / soil].\nThe space (11) [(space) race] began in 1957.");
    expect(validateQuestionContent(q.category, q.content)).toEqual({ ok: true });
    expect(gradeQuestion(asGradable(q), ["Soil", "race"])).toMatchObject({ earned: 2, max: 2 });
    expect(gradeQuestion(asGradable(q), ["land", "space race"])).toMatchObject({ earned: 2 });
    expect(gradeQuestion(asGradable(q), ["sand", "space"])).toMatchObject({ earned: 0 });
  });

  it("BR-I16: câu hỏi ngắn không có đoạn dẫn → mỗi câu một dòng; Writing hoặc thiếu đáp án → giữ WRITING_SHORT_ANSWER", () => {
    const q = convertGroup(group([sub(5, "SHORT_ANSWER", { text_html: "Which month is the deadline?", options: [], correct_answer: "August" })], { skill: "Listening" })).questions[0];
    expect(q).toMatchObject({ category: "LISTENING_FILL_IN", content: { passage: "5. Which month is the deadline? [August]" } });
    const w = convertGroup(group([sub(6, "SHORT_ANSWER", { text_html: "Why?", options: [], correct_answer: null, answer_source: "NONE" })])).questions[0];
    expect(w.category).toBe("WRITING_SHORT_ANSWER");
  });

  it("BR-I17: lời dẫn nhắc 'Reading Passage' mà không có bài đọc → cảnh báo PASSAGE_MISSING (không chặn); Listening thì không", () => {
    const g = (o: Partial<RawGroup>) => group([sub(1, "READING_COMPREHENSION", { options: opts("TRUE", "FALSE", "NOT GIVEN") })], { prompt: "Do the following statements agree with Reading Passage 1?", ...o });
    expect(codes(convertGroup(g({})))).toContain("PASSAGE_MISSING");
    expect(codes(convertGroup(g({ passage_html: "x ".repeat(400) })))).not.toContain("PASSAGE_MISSING");
    expect(codes(convertGroup(g({ skill: "Listening" })))).not.toContain("PASSAGE_MISSING");
    // đề Việt Nam: "Read the following passage…", bài đọc ngắn (~300 ký tự) vẫn tính là có bài
    const vn = (o: Partial<RawGroup>) => group([sub(31, "READING_COMPREHENSION")], { prompt: "Read the following passage and mark the letter A, B, C, or D to indicate the correct answer to each of the questions.", ...o });
    expect(codes(convertGroup(vn({})))).toContain("PASSAGE_MISSING");
    expect(codes(convertGroup(vn({ passage_html: "Every year people in many countries learn English. ".repeat(6) })))).not.toContain("PASSAGE_MISSING");
    expect(codes(convertGroup(group([sub(9, "SENTENCE_BLANK")], { prompt: "Mark the letter A, B, C, or D to indicate the correct answer." })))).not.toContain("PASSAGE_MISSING");
  });

  it("BR-I17: bài đọc chung → stimulus_text của mọi câu; đoạn dẫn riêng nối vào lời dẫn; ngoặc tròn trong bài không bị ẩn thành ô", () => {
    const passage = "<p>The mitten crab (Eriocheir sinensis) spread fast.</p>";
    const r = convertGroup(
      group([sub(1, "READING_COMPREHENSION", { options: opts("TRUE", "FALSE", "NOT GIVEN"), correct_answer: "B" })], { passage_html: passage, stimulus_html: "Statements about crabs" })
    );
    const q = r.questions[0];
    expect(q.stimulus_text).toContain("(Eriocheir sinensis)");
    expect(q.prompt).toContain("Statements about crabs");
    const t = convertGroup(group([sub(8, "SHORT_ANSWER", { options: [], correct_answer: "competition" })], { passage_html: passage, stimulus_html: "They compete: (8) ____." })).questions[0];
    expect(t.stimulus_text).toContain("(Eriocheir sinensis)");
    const safe = sanitizeQuestionForStudent({ id: "x", category: t.category, content: t.content, stimulus_text: t.stimulus_text } as any);
    expect(safe.stimulus_text).toContain("(Eriocheir sinensis)");
    expect(JSON.stringify(safe)).not.toContain("competition");
  });

  it("viết lại câu có gợi ý → WRITING_SENTENCE_REWRITE, đáp án kèm cue trong ngoặc vuông", () => {
    const q = convertGroup(
      group([sub(50, "REWRITE_WITH_CUE", { text_html: "He started learning English 5 years ago. → He has ______", options: [], correct_answer: "He has learnt English for 5 years." })])
    ).questions[0];
    expect(q).toMatchObject({ category: "WRITING_SENTENCE_REWRITE", skill: "Writing" });
    expect(q.content).toMatchObject({ original_sentence: "He started learning English 5 years ago.", starting_cue: "He has", correct_answer: "[He has] learnt English for 5 years." });
    expect(gradeQuestion(asGradable(q), "learnt English for 5 years")).toMatchObject({ earned: 1 });
  });

  it("bài luận lấy min_words từ đề", () => {
    const q = convertGroup(group([sub(60, "ESSAY", { text_html: "Write a paragraph (about 120 words) about your hobby.", options: [], correct_answer: null, answer_source: "NONE" })])).questions[0];
    expect(q).toMatchObject({ category: "WRITING_ESSAY", content: { min_words: 120 } });
    expect(q.content.import_meta.warnings.map((w) => w.code)).not.toContain("NO_ANSWER");
  });
});

describe("Đáp án, dạng chưa hỗ trợ, gạch chân, Listening", () => {
  it("TC-I09: không có đáp án → null + NO_ANSWER, không bao giờ thành 'A'; validate từ chối", () => {
    const r = convertGroup(group([sub(5, "GENERAL_MC", { correct_answer: null, answer_source: "NONE" })]));
    const s = (r.questions[0].content.sub_questions as any[])[0];
    expect(s.correct_answer).toBeNull();
    expect(codes(r)).toContain("NO_ANSWER");
    expect(validateQuestionContent(r.questions[0].category, r.questions[0].content)).toMatchObject({ ok: false });
    const cloze = convertGroup(group([...clozeSubs().slice(0, 5), sub(30, "CLOZE_PASSAGE", { correct_answer: null, answer_source: "NONE" })], { stimulus_html: CLOZE_HTML }));
    expect(validateQuestionContent(cloze.questions[0].category, cloze.questions[0].content)).toMatchObject({ ok: false });
  });

  it("đáp án AI tự giải → AI_SOLVED_ANSWER; confidence thấp → LOW_CONFIDENCE", () => {
    const r = convertGroup(group([sub(5, "GENERAL_MC", { answer_source: "AI_SOLVED", confidence: 0.4 })]));
    expect(codes(r)).toEqual(expect.arrayContaining(["AI_SOLVED_ANSWER", "LOW_CONFIDENCE"]));
    expect(r.questions[0].content.import_meta.answer_source).toBe("AI_SOLVED");
  });

  it("UNSUPPORTED → READING_MC với phương án như giấy + UNSUPPORTED_FORMAT", () => {
    const r = convertGroup(group([sub(7, "UNSUPPORTED", { unsupported_reason: "NEEDS_IMAGE" })]));
    expect(r.questions[0].category).toBe("READING_MC");
    expect((r.questions[0].content.sub_questions as any[])[0]).toMatchObject({ option_a: "w", option_d: "z", correct_answer: "A" });
    expect(codes(r)).toContain("UNSUPPORTED_FORMAT");
  });

  it("TC-I28: phát âm / tìm lỗi sai → chữ trơn, bỏ gạch chân và thẻ HTML; không cảnh báo, không gọi AI lượt 2 (BR-I25)", () => {
    const r = convertGroup(group([sub(1, "PRONUNCIATION", { text_html: "Choose <b>the</b> word", options: opts("h<u>a</u>t", "c<u>a</u>t", "n<u>a</u>me", "b<u>a</u>d<script>x</script>") })]));
    const s = (r.questions[0].content.sub_questions as any[])[0];
    expect(s).toMatchObject({ text: "Choose the word", option_a: "hat", option_c: "name" });
    expect(s.option_d).not.toMatch(/[<>]|script/);
    expect(r.needsAi).toEqual([]);
    const noU = convertGroup(group([sub(1, "ERROR_IDENTIFICATION", { options: opts("hat", "cat", "name", "bad") })]));
    expect(noU.needsAi).toEqual([]);
    expect(codes(noU)).not.toContain("UNDERLINE_MISSING");
  });

  it("TC-I15: Listening → tiền tố LISTENING_ + AUDIO_MISSING", () => {
    const r = convertGroup(group(clozeSubs(), { skill: "Listening", stimulus_html: CLOZE_HTML }));
    expect(r.questions[0].category).toBe("LISTENING_FILL_IN");
    expect(codes(r)).toContain("AUDIO_MISSING");
    const mc = convertGroup(group([sub(1, "GENERAL_MC")], { skill: "Listening" }));
    expect(mc.questions[0].category).toBe("LISTENING_MC");
  });

  it("nhóm lẫn dạng → tách khối liền nhau, giữ chung prompt (BR-I11); dạng lạ → GENERAL_MC", () => {
    const r = convertGroup(
      group([
        sub(1, "STRESS"),
        sub(2, "STRESS"),
        sub(3, "SENTENCE_BLANK", { text_html: "I ___ here.", options: opts("am", "is", "are", "be") }),
        sub(4, "KHONG_CO" as PaperFormat),
      ])
    );
    expect(r.questions.map((q) => q.category)).toEqual(["READING_MC", "READING_FILL_IN", "READING_MC"]);
    expect(new Set(r.questions.map((q) => q.prompt)).size).toBe(1);
    expect(r.questions[2].content.import_meta.paper_format).toBe("GENERAL_MC");
  });

  it("override (giáo viên Đổi dạng) chuyển lại từ dữ liệu gốc, không chồng kết quả cũ", () => {
    const raw = group(clozeSubs(), { stimulus_html: CLOZE_HTML });
    const asMc = convertGroup(raw, { override: "READING_COMPREHENSION" });
    expect(asMc.questions[0].category).toBe("READING_MC");
    const back = convertGroup(raw, { override: "CLOZE_PASSAGE" });
    expect(back).toEqual(convertGroup(raw));
  });

  it("TC-I13: học sinh không nhận import_meta", () => {
    const q = convertGroup(group([sub(1, "GENERAL_MC")])).questions[0];
    const student = sanitizeQuestionForStudent(asGradable(q));
    expect(student.content.import_meta).toBeUndefined();
    expect(q.content.import_meta).toBeDefined(); // không làm hỏng bản gốc
  });
});

describe("Kỹ năng hệ thống (BR-I23)", () => {
  it("skill suy từ dạng câu, nhãn AI ('Phonetics', 'Communication') giữ ở import_meta.paper_skill", () => {
    const r = convertGroup(group([sub(1, "PRONUNCIATION", { options: opts("<u>e</u>nd", "g<u>e</u>t", "x", "y") })], { skill: "Phonetics", prompt: "Choose the word." }));
    expect(r.questions[0]).toMatchObject({ category: "READING_MC", skill: "Reading" });
    expect(r.questions[0].content.import_meta.paper_skill).toBe("Phonetics");
    const w = convertGroup(group([sub(35, "SENTENCE_TRANSFORMATION")], { skill: "Writing", prompt: "Choose the sentence closest in meaning." }));
    expect(w.questions[0]).toMatchObject({ category: "READING_MC", skill: "Reading" });
    const l = convertGroup(group([sub(1, "GENERAL_MC")], { skill: "Listening" }));
    expect(l.questions[0].skill).toBe("Listening");
    expect(l.questions[0].content.import_meta.paper_skill).toBeUndefined();
  });
});

describe("validateQuestionContent", () => {
  it("từ chối category lạ, thiếu passage, số ô ≠ số đáp án, INLINE thiếu danh sách", () => {
    expect(validateQuestionContent("READING_MULTIPLE_CHOICE", {})).toMatchObject({ ok: false });
    expect(validateQuestionContent("READING_FILL_IN", { fill_subtype: "OPTION_BANK", option_bank: ["a", "b"] })).toMatchObject({ ok: false });
    expect(validateQuestionContent("READING_FILL_IN", { fill_subtype: "OPTION_BANK", passage: "x [a] y [b]", correct_answers: ["a"], option_bank: ["a", "b"] })).toMatchObject({ ok: false });
    expect(validateQuestionContent("READING_FILL_IN", { fill_subtype: "INLINE_SELECT", passage: "x [a]", correct_answers: ["a"] })).toMatchObject({ ok: false });
    expect(validateQuestionContent("READING_FILL_IN", { fill_subtype: "OPTION_BANK", passage: "x [c]", correct_answers: ["c"], option_bank: ["a", "b"] })).toMatchObject({ ok: false });
    expect(validateQuestionContent("READING_MC", { sub_questions: [{ id: "1", option_a: "x", option_b: "y", correct_answer: "E" }] })).toMatchObject({ ok: false });
  });
});
