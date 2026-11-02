// TASK-007 — lib/grading.ts: chấm khách quan phía server + ẩn đáp án (FEAT-010 BR-L06…L09, TC-L01/L02).
// File do trưởng phòng viết, bị khoá.
import { describe, it, expect } from "vitest";
import {
  gradeQuestion,
  sanitizeQuestionForStudent,
  sanitizeFlashcardForStudent,
  summarizeResults,
  computeScorePercent,
  type GradableQuestion,
} from "@/lib/grading";

const q = (id: string, category: string, content: any): GradableQuestion => ({ id, category, content, prompt: "P", skill: "Reading" });

const MC = q("q_mc", "READING_MC", {
  sub_questions: [
    { id: "s1", text: "1?", option_a: "a", option_b: "b", option_c: "c", option_d: "d", correct_answer: "B" },
    { id: "s2", text: "2?", option_a: "a", option_b: "b", option_c: "c", option_d: "d", correct_answer: "d" },
    { id: "s3", text: "3?", option_a: "a", option_b: "b", option_c: "c", option_d: "d", correct_answer: "A", audio_url: "x.mp3" },
  ],
});
const FILL_BANK = q("q_fb", "READING_FILL_IN", {
  fill_subtype: "OPTION_BANK",
  passage: "I (am) a student and she (is) a teacher.",
  option_bank: ["is", "am", "are", "be"],
});
const FILL_SELECT = q("q_fs", "LISTENING_FILL_IN", {
  fill_subtype: "INLINE_SELECT",
  passage: "The cat [sat] on the [mat].",
  correct_answers: ["sat", "mat"],
  inline_options_per_gap: [
    { gap_index: 0, options: ["sat", "sit", "sits"] },
    { gap_index: 1, options: ["mat", "hat"] },
  ],
});
const ORDER_WORD = q("q_ow", "READING_ORDERING", { ordering_type: "WORD_ORDERING", correct_text: "She goes to school every day" });
const ORDER_SENT = q("q_os", "LISTENING_ORDERING", { ordering_type: "SENTENCE_ORDERING", correct_text: "Wake up. Brush teeth. Eat breakfast." });
const MATCH = q("q_m", "READING_MATCHING", {
  pairs: [
    { id: "p1", left: "dog", right: "con chó" },
    { id: "p2", left: "cat", right: "con mèo" },
    { id: "p3", left: "bird", right: "con chim" },
  ],
});
const FLASH = q("q_f", "READING_FLASHCARD_SET", { flashcard_ids: ["f1", "f2", "fMissing"] });
const CARDS = {
  f1: { id: "f1", vietnamese_name: "quả táo", correct_english_word: "apple", options: ["banana", "apple", "pear"], image_url: "a.png", audio_url: null },
  f2: { id: "f2", vietnamese_name: "con cá", correct_english_word: "fish", options: ["fish", "fork"], image_url: null, audio_url: "f.mp3" },
};
const FREE = q("q_ft", "WRITING_FREE_TYPING_BLANKS", { passage: "Yesterday I (went) to the (market)." });
const REWRITE = q("q_rw", "WRITING_SENTENCE_REWRITE", {
  original_sentence: "If you don't hurry, you will be late.",
  starting_cue: "",
  correct_answer: "[Unless] you hurry, you will be late.",
});
const ESSAY = q("q_es", "WRITING_ESSAY", { min_words: 150, task_type: "Task 2" });
const SHORT = q("q_sa", "WRITING_SHORT_ANSWER", {
  sub_questions: [
    { id: "a1", text: "Why?", max_words: 20, sample_answer: "Because it is fun." },
    { id: "a2", text: "How?", max_words: 20, sample_answer: "By practising daily." },
  ],
});
const SPEAK = q("q_sp", "SPEAKING_READ_ALOUD", { read_aloud_text: "Hello" });

describe("gradeQuestion — trắc nghiệm (mỗi câu con 1 điểm, không phân biệt hoa thường)", () => {
  it("đúng 2/3", () => {
    const r = gradeQuestion(MC, { s1: "b", s2: "D", s3: "C" });
    expect(r).toMatchObject({ question_id: "q_mc", category: "READING_MC", kind: "OBJECTIVE", earned: 2, max: 3 });
    expect(r.items.map((i) => [i.key, i.correct])).toEqual([["s1", true], ["s2", true], ["s3", false]]);
    expect(r.items[2].expected).toBe("A");
  });
  it("thiếu / sai kiểu câu trả lời → 0 điểm, không ném lỗi", () => {
    expect(gradeQuestion(MC, undefined)).toMatchObject({ earned: 0, max: 3 });
    expect(gradeQuestion(MC, "B")).toMatchObject({ earned: 0, max: 3 });
    expect(gradeQuestion(MC, { s1: 42 })).toMatchObject({ earned: 0, max: 3 });
  });
});

describe("gradeQuestion — điền ô trống (mỗi ô 1 điểm)", () => {
  it("không có correct_answers → lấy đáp án trong ngoặc của đoạn văn", () => {
    const r = gradeQuestion(FILL_BANK, ["AM", " is "]);
    expect(r).toMatchObject({ kind: "OBJECTIVE", earned: 2, max: 2 });
    expect(r.items.map((i) => i.key)).toEqual(["gap_0", "gap_1"]);
  });
  it("có correct_answers + ngoặc vuông; bỏ khoảng trắng thừa", () => {
    expect(gradeQuestion(FILL_SELECT, ["sat", "hat"])).toMatchObject({ earned: 1, max: 2 });
    expect(gradeQuestion(FILL_SELECT, ["  Sat ", "MAT"])).toMatchObject({ earned: 2, max: 2 });
  });
  it("thiếu ô → ô đó sai", () => {
    expect(gradeQuestion(FILL_SELECT, ["sat"])).toMatchObject({ earned: 1, max: 2 });
  });
});

describe("gradeQuestion — sắp xếp (đúng toàn bộ = 1 điểm)", () => {
  it("sắp xếp từ", () => {
    expect(gradeQuestion(ORDER_WORD, ["She", "goes", "to", "school", "every", "day"])).toMatchObject({ earned: 1, max: 1 });
    expect(gradeQuestion(ORDER_WORD, ["goes", "She", "to", "school", "every", "day"])).toMatchObject({ earned: 0, max: 1 });
  });
  it("sắp xếp câu", () => {
    expect(gradeQuestion(ORDER_SENT, ["Wake up.", "Brush teeth.", "Eat breakfast."])).toMatchObject({ earned: 1, max: 1 });
    expect(gradeQuestion(ORDER_SENT, ["Wake up.", "Eat breakfast."])).toMatchObject({ earned: 0, max: 1 });
  });
});

describe("gradeQuestion — nối cặp, flashcard, điền tự do, viết lại câu", () => {
  it("nối cặp: mỗi cặp 1 điểm", () => {
    expect(gradeQuestion(MATCH, { p1: "con chó", p2: "con chim", p3: "con chim" })).toMatchObject({ earned: 2, max: 3 });
  });
  it("flashcard: so với correct_english_word; thẻ không có trong thư viện không tính", () => {
    const r = gradeQuestion(FLASH, { f1: "Apple", f2: "fork" }, CARDS);
    expect(r).toMatchObject({ kind: "OBJECTIVE", earned: 1, max: 2 });
  });
  it("điền tự do: đáp án lấy từ ngoặc trong đoạn văn", () => {
    expect(gradeQuestion(FREE, ["went", "Market"])).toMatchObject({ earned: 2, max: 2 });
    expect(gradeQuestion(FREE, ["go", "market"])).toMatchObject({ earned: 1, max: 2 });
  });
  it("viết lại câu: chấp nhận có/không gõ lại từ gợi ý, bỏ dấu câu cuối", () => {
    expect(gradeQuestion(REWRITE, "you hurry, you will be late")).toMatchObject({ earned: 1, max: 1 });
    expect(gradeQuestion(REWRITE, "Unless you hurry, you will be late.")).toMatchObject({ earned: 1, max: 1 });
    expect(gradeQuestion(REWRITE, "Unless you run, you will be late.")).toMatchObject({ earned: 0, max: 1 });
  });
});

describe("gradeQuestion — tự luận/trả lời ngắn là AI, Speaking không tính", () => {
  it("tự luận: AI, max 1, earned 0", () => {
    expect(gradeQuestion(ESSAY, "My essay ...")).toMatchObject({ kind: "AI", earned: 0, max: 1 });
  });
  it("trả lời ngắn: AI, mỗi câu con 1 điểm tối đa", () => {
    const r = gradeQuestion(SHORT, { a1: "x", a2: "y" });
    expect(r).toMatchObject({ kind: "AI", earned: 0, max: 2 });
    expect(r.items.map((i) => i.key)).toEqual(["a1", "a2"]);
  });
  it("Speaking / dạng lạ: UNSUPPORTED, max 0", () => {
    expect(gradeQuestion(SPEAK, "x")).toMatchObject({ kind: "UNSUPPORTED", earned: 0, max: 0 });
    expect(gradeQuestion(q("z", "WEIRD_TYPE", {}), "x")).toMatchObject({ kind: "UNSUPPORTED", max: 0 });
  });
});

describe("summarizeResults + computeScorePercent (BR-L08)", () => {
  it("tổng hợp điểm khách quan và max AI", () => {
    const rs = [gradeQuestion(MC, { s1: "B", s2: "D", s3: "A" }), gradeQuestion(ESSAY, "x"), gradeQuestion(SHORT, {}), gradeQuestion(SPEAK, "")];
    expect(summarizeResults(rs)).toEqual({ objective_earned: 3, objective_max: 3, ai_max: 3, has_ai: true });
  });
  it("tính % và làm tròn 1 chữ số; tổng max 0 → 100", () => {
    expect(computeScorePercent(2, 3, 0, 0)).toBe(66.7);
    expect(computeScorePercent(3, 3, 1.5, 3)).toBe(75);
    expect(computeScorePercent(0, 0, 0, 0)).toBe(100);
    expect(computeScorePercent(1, 4, null, 0)).toBe(25);
  });
});

// ── Ẩn đáp án (BR-L09, TC-L02) ───────────────────────────────────────────
const SECRETS: Array<[GradableQuestion, string[]]> = [
  [MC, ['"correct_answer"']],
  [FILL_BANK, ["(am)", "(is)", '"correct_answers"']],
  [FILL_SELECT, ["[sat]", "[mat]", '"correct_answers"']],
  [ORDER_WORD, ["She goes to school every day", '"correct_text"']],
  [ORDER_SENT, ["Wake up. Brush teeth. Eat breakfast.", '"correct_text"']],
  [MATCH, ['"pairs"']],
  [FREE, ["(went)", "(market)"]],
  [REWRITE, ['"correct_answer"', "Unless you hurry"]],
  [SHORT, ['"sample_answer"', "Because it is fun."]],
];

describe("sanitizeQuestionForStudent — không lọt đáp án", () => {
  for (const [question, secrets] of SECRETS) {
    it(`${question.category} (${question.id})`, () => {
      const json = JSON.stringify(sanitizeQuestionForStudent(question));
      for (const s of secrets) expect(json, s).not.toContain(s);
    });
  }

  it("không thay đổi câu hỏi gốc", () => {
    const snapshot = JSON.stringify(MC);
    sanitizeQuestionForStudent(MC);
    expect(JSON.stringify(MC)).toBe(snapshot);
  });

  it("MC giữ nội dung câu hỏi và lựa chọn", () => {
    const s = sanitizeQuestionForStudent(MC);
    expect(s.content.sub_questions).toHaveLength(3);
    expect(s.content.sub_questions[2]).toMatchObject({ id: "s3", text: "3?", option_a: "a", audio_url: "x.mp3" });
    expect(s).toMatchObject({ id: "q_mc", category: "READING_MC", prompt: "P", skill: "Reading" });
  });

  it("điền ô: passage_parts có số phần = số ô + 1; option_bank/options mỗi ô sắp theo ABC", () => {
    const fb = sanitizeQuestionForStudent(FILL_BANK).content;
    expect(fb.passage).toBeUndefined();
    expect(fb.passage_parts).toEqual(["I ", " a student and she ", " a teacher."]);
    expect(fb.gap_count).toBe(2);
    expect(fb.option_bank).toEqual(["am", "are", "be", "is"]);
    const fs = sanitizeQuestionForStudent(FILL_SELECT).content;
    expect(fs.passage_parts).toEqual(["The cat ", " on the ", "."]);
    expect(fs.inline_options_per_gap).toEqual([
      { gap_index: 0, options: ["sat", "sit", "sits"] },
      { gap_index: 1, options: ["hat", "mat"] },
    ]);
  });

  it("sắp xếp: trả items (đủ phần tử, sắp theo ABC), không có correct_text", () => {
    const c = sanitizeQuestionForStudent(ORDER_WORD).content;
    expect([...c.items].sort()).toEqual(["She", "day", "every", "goes", "school", "to"].sort());
    expect(c.items).toEqual([...c.items].sort((a: string, b: string) => a.localeCompare(b, "en", { sensitivity: "base" })));
    expect(c.ordering_type).toBe("WORD_ORDERING");
  });

  it("nối cặp: left giữ thứ tự gốc kèm id, right là danh sách sắp theo ABC không kèm id", () => {
    const c = sanitizeQuestionForStudent(MATCH).content;
    expect(c.left).toEqual([{ id: "p1", text: "dog" }, { id: "p2", text: "cat" }, { id: "p3", text: "bird" }]);
    expect(c.right).toEqual(["con chim", "con chó", "con mèo"]);
  });

  it("điền tự do: passage_parts + gap_count", () => {
    const c = sanitizeQuestionForStudent(FREE).content;
    expect(c.passage_parts).toEqual(["Yesterday I ", " to the ", "."]);
    expect(c.gap_count).toBe(2);
  });

  it("viết lại câu: giữ câu gốc, tự điền starting_cue từ [gợi ý] khi trống", () => {
    const c = sanitizeQuestionForStudent(REWRITE).content;
    expect(c.original_sentence).toBe("If you don't hurry, you will be late.");
    expect(c.starting_cue).toBe("Unless");
  });

  it("flashcard: sanitizeFlashcardForStudent bỏ correct_english_word, options sắp ABC", () => {
    const f = sanitizeFlashcardForStudent(CARDS.f1);
    expect(f).toEqual({ id: "f1", vietnamese_name: "quả táo", image_url: "a.png", audio_url: null, options: ["apple", "banana", "pear"] });
    expect(JSON.stringify(sanitizeFlashcardForStudent(CARDS.f2))).not.toContain("correct_english_word");
  });
});
