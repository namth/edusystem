// TASK-014 — Trang làm bài học (SCR-L7). Định dạng câu trả lời của trình làm bài phải khớp lib/grading.ts.
// File do trưởng phòng viết, bị khoá.
import { describe, it, expect } from "vitest";
import fs from "fs";
import { gradeQuestion, sanitizeQuestionForStudent, sanitizeFlashcardForStudent, type GradableQuestion } from "@/lib/grading";
import { emptyAnswerFor, countAnswered, setAnswerPart } from "@/lib/lesson-player";

const Q: Record<string, GradableQuestion> = {
  mc: { id: "mc", category: "LISTENING_MC", content: { sub_questions: [
    { id: "s1", text: "1", option_a: "a", option_b: "b", option_c: "c", option_d: "d", correct_answer: "B" },
    { id: "s2", text: "2", option_a: "a", option_b: "b", option_c: "c", option_d: "d", correct_answer: "D" },
  ] } },
  fill: { id: "fill", category: "READING_FILL_IN", content: { fill_subtype: "INLINE_SELECT", passage: "A (x) B (y) C",
    inline_options_per_gap: [{ gap_index: 0, options: ["x", "z"] }, { gap_index: 1, options: ["y", "w"] }] } },
  order: { id: "order", category: "READING_ORDERING", content: { ordering_type: "WORD_ORDERING", correct_text: "I like cats" } },
  match: { id: "match", category: "WRITING_MATCHING", content: { pairs: [{ id: "p1", left: "dog", right: "chó" }, { id: "p2", left: "cat", right: "mèo" }] } },
  flash: { id: "flash", category: "WRITING_FLASHCARD_SET", content: { flashcard_ids: ["f1", "f2"] } },
  free: { id: "free", category: "WRITING_FREE_TYPING_BLANKS", content: { passage: "I (went) home (yesterday)." } },
  rewrite: { id: "rewrite", category: "WRITING_SENTENCE_REWRITE", content: { original_sentence: "x", starting_cue: "", correct_answer: "[Unless] you go." } },
  essay: { id: "essay", category: "WRITING_ESSAY", content: { min_words: 50 } },
  short: { id: "short", category: "WRITING_SHORT_ANSWER", content: { sub_questions: [{ id: "a1", text: "?", max_words: 10, sample_answer: "x" }, { id: "a2", text: "?", max_words: 10 }] } },
};
const CARDS = { f1: { id: "f1", correct_english_word: "apple" }, f2: { id: "f2", correct_english_word: "fish" } };
const S = (k: string) => sanitizeQuestionForStudent(Q[k]);

describe("emptyAnswerFor(câu đã ẩn đáp án) — đúng hình dạng mà lib/grading.ts chấm", () => {
  it("MC / nối cặp / flashcard / trả lời ngắn → object rỗng", () => {
    for (const k of ["mc", "match", "flash", "short"]) expect(emptyAnswerFor(S(k)), k).toEqual({});
  });
  it("điền ô (theo gap_count) / điền tự do → mảng chuỗi rỗng đúng số ô", () => {
    expect(emptyAnswerFor(S("fill"))).toEqual(["", ""]);
    expect(emptyAnswerFor(S("free"))).toEqual(["", ""]);
  });
  it("sắp xếp → mảng rỗng (học sinh chọn dần các mảnh)", () => {
    expect(emptyAnswerFor(S("order"))).toEqual([]);
  });
  it("viết lại câu / tự luận → chuỗi rỗng", () => {
    expect(emptyAnswerFor(S("rewrite"))).toBe("");
    expect(emptyAnswerFor(S("essay"))).toBe("");
  });
  it("dạng không hỗ trợ → null", () => {
    expect(emptyAnswerFor({ id: "z", category: "SPEAKING_READ_ALOUD", content: {} })).toBeNull();
  });
});

describe("setAnswerPart — cập nhật bất biến (không sửa object cũ)", () => {
  it("object theo key", () => {
    const a = {};
    const b = setAnswerPart(a, "s1", "B");
    expect(b).toEqual({ s1: "B" });
    expect(a).toEqual({});
  });
  it("mảng theo chỉ số", () => {
    const a = ["", ""];
    const b = setAnswerPart(a, 1, "y");
    expect(b).toEqual(["", "y"]);
    expect(a).toEqual(["", ""]);
  });
});

describe("Khứ hồi: câu trả lời dựng theo định dạng trình làm bài được chấm đúng", () => {
  it("MC theo id câu con", () => {
    let a: any = emptyAnswerFor(S("mc"));
    a = setAnswerPart(setAnswerPart(a, "s1", "B"), "s2", "A");
    expect(gradeQuestion(Q.mc, a)).toMatchObject({ earned: 1, max: 2 });
  });
  it("điền ô theo chỉ số ô", () => {
    let a: any = emptyAnswerFor(S("fill"));
    a = setAnswerPart(setAnswerPart(a, 0, "x"), 1, "y");
    expect(gradeQuestion(Q.fill, a)).toMatchObject({ earned: 2, max: 2 });
  });
  it("sắp xếp: chọn các mảnh từ items theo thứ tự đúng", () => {
    const items: string[] = S("order").content.items;
    expect([...items].sort()).toEqual(["I", "cats", "like"].sort());
    expect(gradeQuestion(Q.order, ["I", "like", "cats"])).toMatchObject({ earned: 1 });
  });
  it("nối cặp: key là id ở cột trái (left[].id), giá trị là chuỗi ở cột phải (right[])", () => {
    const s = S("match").content;
    let a: any = emptyAnswerFor(S("match"));
    a = setAnswerPart(a, s.left[0].id, "chó");
    a = setAnswerPart(a, s.left[1].id, "chó");
    expect(gradeQuestion(Q.match, a)).toMatchObject({ earned: 1, max: 2 });
  });
  it("flashcard: key là id thẻ (sanitizeFlashcardForStudent giữ id)", () => {
    const card = sanitizeFlashcardForStudent({ id: "f1", correct_english_word: "apple", options: ["apple", "pear"] });
    let a: any = emptyAnswerFor(S("flash"));
    a = setAnswerPart(a, card.id, "Apple");
    expect(gradeQuestion(Q.flash, a, CARDS as any)).toMatchObject({ earned: 1, max: 2 });
  });
  it("trả lời ngắn theo id câu con là mục AI", () => {
    const a = setAnswerPart(emptyAnswerFor(S("short")), "a1", "text");
    expect(gradeQuestion(Q.short, a)).toMatchObject({ kind: "AI", max: 2 });
  });
});

describe("countAnswered — đếm câu đã trả lời (để hiện tiến độ / cảnh báo trước khi nộp)", () => {
  it("câu trống không tính; câu có ít nhất một phần đã điền thì tính", () => {
    const qs = [S("mc"), S("fill"), S("order"), S("essay"), S("rewrite")];
    const answers: Record<string, unknown> = {
      mc: { s1: "B" },
      fill: ["", ""],
      order: [],
      essay: "  ",
      rewrite: "you go",
    };
    expect(countAnswered(qs, answers)).toBe(2);
    expect(countAnswered(qs, {})).toBe(0);
  });
});

// ── Kiểm tra tĩnh trang & component ────────────────────────────────────────
const read = (p: string) => fs.readFileSync(p, "utf8");
const PLAYER = "components/lesson-player/LessonPlayer.tsx";
const PAGE = "app/student/lesson/[lessonId]/page.tsx";
const FORBIDDEN = ['"@/lib/supabase"', '"@/lib/neo4j"', '"@/lib/db-pg"', '"@/lib/mock-data"', "supabase."];

describe("LessonPlayer + trang /student/lesson/[lessonId]", () => {
  it("LessonPlayer là client component dùng lib/lesson-player, hỗ trợ đủ nhóm dạng câu", () => {
    const s = read(PLAYER);
    expect(s.trimStart().startsWith('"use client"')).toBe(true);
    expect(s).toContain("@/lib/lesson-player");
    for (const k of ["_MC", "_FILL_IN", "_ORDERING", "_MATCHING", "_FLASHCARD_SET", "WRITING_FREE_TYPING_BLANKS", "WRITING_SENTENCE_REWRITE", "WRITING_ESSAY", "WRITING_SHORT_ANSWER"]) {
      expect(s, k).toContain(k);
    }
    expect(s).toContain("passage_parts");
    expect(s).toContain("stimulus_audio_url");
  });

  it("trang gọi nội dung bài, lịch sử, nộp bài, hỏi lại khi GRADING", () => {
    const s = read(PAGE);
    expect(s).toContain("/api/student/lessons/");
    expect(s).toContain("/attempts");
    expect(s).toContain("/api/student/attempts/");
    expect(s).toMatch(/method:\s*"POST"/);
    expect(s).toContain("GRADING");
    expect(s).toMatch(/setInterval|setTimeout/);
    expect(s).toMatch(/clearInterval|clearTimeout/);
    expect(s).toContain("classId");
  });

  it("kết quả hiện đúng/sai + đáp án (expected), trạng thái AI_SKIPPED, nút Làm lại", () => {
    const s = read(PAGE) + read(PLAYER);
    expect(s).toContain("expected");
    expect(s).toContain("AI_SKIPPED");
    expect(s).toMatch(/Làm lại/);
  });

  it("xử lý 403 (bài chưa mở / không thuộc lớp) và lỗi tải", () => {
    const s = read(PAGE);
    expect(s).toMatch(/403/);
    expect(s).toMatch(/Thử lại/);
  });

  it("không truy cập DB trực tiếp", () => {
    for (const f of [PLAYER, PAGE]) for (const bad of FORBIDDEN) expect(read(f), `${f} ${bad}`).not.toContain(bad);
  });
});
