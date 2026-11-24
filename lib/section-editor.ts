// FEAT-017 TASK-058 — logic thuần của trình soạn theo Phần (SectionEditor). Không gọi API, không React.
// Câu hỏi được sửa thẳng ở dạng content JSONB của DB (docs/06), không qua lớp state riêng từng dạng.
import { parseFillInGaps, splitOrderingItems, type OrderingType } from "./question-content-types";
import { skillOfCategory } from "./question-conversion";
import { numberQuestions, type Skill, type TreeQuestion, type TreeSection } from "./exam-structure";

type Rec = Record<string, unknown>;

export interface EdQuestion {
  key: string;
  id?: string;
  category: string;
  prompt: string;
  content: Rec;
}
export interface EdSection {
  key: string;
  id?: string;
  skill: Skill;
  instruction: string;
  stimulus_type: "NONE" | "TEXT_ONLY" | "AUDIO_ONLY" | "COMBINED";
  stimulus_text: string;
  stimulus_audio_url: string;
  stimulus_audio_text: string;
  stimulus_audio_gender: "Female" | "Male";
  questions: EdQuestion[];
}

let seq = 0;
export const newKey = (p: string) => `${p}_${Date.now().toString(36)}_${(seq++).toString(36)}`;

/** Nút thêm câu theo kỹ năng của phần (BR-P04, FEAT-017 §4.1). */
export const ADD_TYPES: Record<Skill, { category: string; label: string }[]> = {
  Reading: [
    { category: "READING_MC", label: "Trắc nghiệm" },
    { category: "READING_FILL_IN", label: "Điền ô trống" },
    { category: "READING_ORDERING", label: "Sắp xếp" },
    { category: "READING_MATCHING", label: "Nối cặp" },
    { category: "READING_FLASHCARD_SET", label: "Bộ flashcard" },
  ],
  Listening: [
    { category: "LISTENING_MC", label: "Trắc nghiệm" },
    { category: "LISTENING_FILL_IN", label: "Điền ô trống" },
    { category: "LISTENING_ORDERING", label: "Sắp xếp" },
    { category: "LISTENING_MATCHING", label: "Nối cặp" },
  ],
  Writing: [
    { category: "WRITING_ESSAY", label: "Bài luận" },
    { category: "WRITING_SHORT_ANSWER", label: "Trả lời ngắn" },
    { category: "WRITING_SENTENCE_REWRITE", label: "Viết lại câu" },
    { category: "WRITING_FREE_TYPING_BLANKS", label: "Điền ô (tự gõ)" },
    { category: "WRITING_MATCHING", label: "Nối cặp" },
    { category: "WRITING_FLASHCARD_SET", label: "Bộ flashcard" },
  ],
  Speaking: [
    { category: "SPEAKING_TOPIC_PROMPT", label: "Nói theo chủ đề" },
    { category: "SPEAKING_READ_ALOUD", label: "Đọc to" },
  ],
};

export function categoryLabel(cat: string): string {
  for (const list of Object.values(ADD_TYPES)) {
    const hit = list.find((t) => t.category === cat);
    if (hit) return hit.label;
  }
  return cat;
}

/** Nội dung mặc định khi bấm thêm một dạng câu. */
export function newQuestion(category: string): EdQuestion {
  const base: EdQuestion = { key: newKey("q"), category, prompt: "", content: {} };
  if (category.endsWith("_MC")) base.content = { text: "", option_a: "", option_b: "", option_c: "", option_d: "", correct_answer: "A" };
  else if (category.endsWith("_FILL_IN")) base.content = { fill_subtype: "OPTION_BANK", passage: "", option_bank: [] };
  else if (category === "WRITING_FREE_TYPING_BLANKS") base.content = { passage: "" };
  else if (category.endsWith("_ORDERING")) base.content = { ordering_type: "WORD_ORDERING", correct_text: "" };
  else if (category.endsWith("_MATCHING")) base.content = { pairs: [{ id: newKey("mp"), left: "", right: "" }, { id: newKey("mp"), left: "", right: "" }] };
  else if (category.endsWith("_FLASHCARD_SET")) base.content = { flashcard_ids: [] };
  else if (category === "WRITING_ESSAY") base.content = { task_type: "Task 2", min_words: 150 };
  else if (category === "WRITING_SHORT_ANSWER") base.content = { text: "", max_words: 30 };
  else if (category === "WRITING_SENTENCE_REWRITE") base.content = { original_sentence: "", correct_answer: "" };
  else if (category === "SPEAKING_READ_ALOUD") base.content = { passage: "" };
  else if (category === "SPEAKING_TOPIC_PROMPT") base.content = { prep_time_seconds: 60, record_time_seconds: 120 };
  return base;
}

export function newSection(skill: Skill = "Reading"): EdSection {
  return {
    key: newKey("s"), skill, instruction: "", stimulus_type: skill === "Listening" ? "AUDIO_ONLY" : "NONE",
    stimulus_text: "", stimulus_audio_url: "", stimulus_audio_text: "", stimulus_audio_gender: "Female", questions: [],
  };
}

const str = (v: unknown) => (typeof v === "string" ? v : v == null ? "" : String(v));

/** Cây từ API → state trình soạn. */
export function fromTree(tree: TreeSection[]): EdSection[] {
  return tree.map((s) => ({
    key: s.id || newKey("s"),
    id: s.id,
    skill: (["Reading", "Listening", "Writing", "Speaking"].includes(s.skill) ? s.skill : "Reading") as Skill,
    instruction: str(s.instruction),
    stimulus_type: (["NONE", "TEXT_ONLY", "AUDIO_ONLY", "COMBINED"].includes(str(s.stimulus_type)) ? s.stimulus_type : "NONE") as EdSection["stimulus_type"],
    stimulus_text: str(s.stimulus_text),
    stimulus_audio_url: str(s.stimulus_audio_url),
    stimulus_audio_text: str(s.stimulus_audio_text),
    stimulus_audio_gender: s.stimulus_audio_gender === "Male" ? "Male" : "Female",
    questions: s.questions.filter((q) => !q.deleted_at).map((q) => ({
      key: q.id || newKey("q"), id: q.id, category: q.category, prompt: str(q.prompt), content: { ...(q.content || {}) },
    })),
  }));
}

/** State trình soạn → payload PUT (thứ tự mảng = position, BR-P07). */
export function toPayload(sections: EdSection[]): TreeSection[] {
  return sections.map((s) => ({
    ...(s.id ? { id: s.id } : {}),
    skill: s.skill,
    instruction: s.instruction.trim() || null,
    stimulus_type: s.stimulus_type,
    stimulus_text: s.stimulus_type === "TEXT_ONLY" || s.stimulus_type === "COMBINED" ? s.stimulus_text : null,
    stimulus_audio_url: s.stimulus_type === "AUDIO_ONLY" || s.stimulus_type === "COMBINED" ? s.stimulus_audio_url || null : null,
    stimulus_audio_text: s.stimulus_type === "AUDIO_ONLY" || s.stimulus_type === "COMBINED" ? s.stimulus_audio_text || null : null,
    stimulus_audio_gender: s.stimulus_audio_gender,
    questions: s.questions.map((q): TreeQuestion => ({
      ...(q.id ? { id: q.id } : {}),
      category: q.category,
      prompt: q.prompt.trim() || null,
      content: q.content,
    })),
  }));
}

/** Đánh số để hiển thị (BR-P06) — dùng chung hàm của server. */
export function numbering(sections: EdSection[]) {
  const n = numberQuestions(toPayload(sections));
  return sections.map((s, si) => {
    const qs = n[si].questions.map((q) => ({ start: q.number_start || 0, count: q.number_count || 0 }));
    const start = qs.length ? qs[0].start : 0;
    const end = qs.length ? qs[qs.length - 1].start + qs[qs.length - 1].count - 1 : 0;
    return { start, end, questions: qs };
  });
}
export const rangeLabel = (a: number, b: number) => (a === b ? `Câu ${a}` : `Câu ${a}–${b}`);

export function moveItem<T>(arr: T[], from: number, to: number): T[] {
  if (from === to || from < 0 || from >= arr.length || to < 0 || to >= arr.length) return arr;
  const a = arr.slice();
  const [x] = a.splice(from, 1);
  a.splice(to, 0, x);
  return a;
}

/** Câu chỉ chuyển được sang phần cùng kỹ năng (BR-P04). */
export const canHost = (section: Pick<EdSection, "skill">, category: string) => skillOfCategory(category) === section.skill;

/** Chuyển câu sang phần khác (thêm cuối phần đích). Khác kỹ năng → null. */
export function moveQuestionTo(sections: EdSection[], qKey: string, toSectionKey: string): EdSection[] | null {
  const from = sections.find((s) => s.questions.some((q) => q.key === qKey));
  const to = sections.find((s) => s.key === toSectionKey);
  if (!from || !to || from.key === to.key) return null;
  const q = from.questions.find((x) => x.key === qKey)!;
  if (!canHost(to, q.category)) return null;
  return sections.map((s) =>
    s.key === from.key ? { ...s, questions: s.questions.filter((x) => x.key !== qKey) } : s.key === to.key ? { ...s, questions: [...s.questions, q] } : s
  );
}

/** Đổi kỹ năng của phần; có câu không hợp thì trả lỗi (BR-P04). */
export function changeSkill(section: EdSection, skill: Skill): { ok: true; section: EdSection } | { ok: false; error: string } {
  const bad = section.questions.find((q) => !canHost({ skill }, q.category));
  if (bad) return { ok: false, error: `${categoryLabel(bad.category)} không thuộc ${skill} — xoá hoặc chuyển câu đó sang phần khác trước.` };
  return { ok: true, section: { ...section, skill } };
}

const plain = (html: string) => html.replace(/<img\b[^>]*>/gi, " ảnh ").replace(/<[^>]*>/g, " ").replace(/&nbsp;/gi, " ").replace(/\s+/g, " ").trim();

/** Tóm tắt một phần cho cột Cấu trúc bài. */
export function sectionSummary(s: EdSection, max = 46): string {
  const t = s.instruction.trim() || plain(s.stimulus_text) || (s.stimulus_audio_url || s.stimulus_audio_text ? "Audio" : "") || "(chưa có nội dung)";
  return t.length > max ? t.slice(0, max) + "…" : t;
}

/** Tóm tắt một câu cho thẻ thu gọn. */
export function questionSummary(q: EdQuestion, max = 90): string {
  const c = q.content;
  let t = "";
  if (q.category.endsWith("_MC")) t = str(c.text) || ["a", "b", "c", "d"].map((k) => str(c[`option_${k}`])).filter(Boolean).join(" · ");
  else if (q.category.endsWith("_FILL_IN") || q.category === "WRITING_FREE_TYPING_BLANKS") t = str(c.passage).replace(/\[([^\]]+)\]/g, "___");
  else if (q.category.endsWith("_ORDERING")) t = q.prompt || str(c.correct_text);
  else if (q.category.endsWith("_MATCHING")) t = (Array.isArray(c.pairs) ? (c.pairs as Rec[]) : []).map((p) => `${str(p.left)} ↔ ${str(p.right)}`).join(", ");
  else if (q.category.endsWith("_FLASHCARD_SET")) t = `${q.prompt || "Bộ thẻ"} · ${(Array.isArray(c.flashcard_ids) ? c.flashcard_ids.length : 0)} thẻ`;
  else if (q.category === "WRITING_SHORT_ANSWER") t = str(c.text);
  else if (q.category === "WRITING_SENTENCE_REWRITE") t = str(c.original_sentence);
  else if (q.category === "SPEAKING_READ_ALOUD") t = str(c.passage);
  else t = q.prompt;
  t = plain(t);
  return t.length > max ? t.slice(0, max) + "…" : t;
}

// ───────── điền ô ─────────
const norm = (s: string) => s.trim().toLowerCase();
export const gapsOf = (passage: unknown) => parseFillInGaps(str(passage)).gaps;

/** Từ nhiễu của kho từ chung = option_bank trừ đáp án. */
export function bankDistractors(content: Rec): string[] {
  const ans = new Set(gapsOf(content.passage).map(norm));
  return (Array.isArray(content.option_bank) ? content.option_bank.map(str) : []).filter((w) => w.trim() && !ans.has(norm(w)));
}
export function withBankDistractors(content: Rec, distractors: string[]): Rec {
  const seen = new Set<string>();
  const bank = [...gapsOf(content.passage), ...distractors].filter((w) => w.trim() && !seen.has(norm(w)) && !!seen.add(norm(w)));
  return { ...content, option_bank: bank };
}

/** Từ nhiễu riêng của ô `gi` (chọn trong từng ô). */
export function inlineDistractors(content: Rec, gi: number): string[] {
  const correct = norm(gapsOf(content.passage)[gi] || "");
  const per = Array.isArray(content.inline_options_per_gap) ? (content.inline_options_per_gap as Rec[]) : [];
  const g = per.find((x) => Number(x?.gap_index) === gi);
  return (g && Array.isArray(g.options) ? g.options.map(str) : []).filter((w) => w.trim() && norm(w) !== correct);
}
export function withInlineDistractors(content: Rec, gi: number, distractors: string[]): Rec {
  const gaps = gapsOf(content.passage);
  const per = gaps.map((correct, idx) => {
    const list = idx === gi ? distractors : inlineDistractors(content, idx);
    const seen = new Set<string>();
    return { gap_index: idx, options: [correct, ...list].filter((w) => w.trim() && !seen.has(norm(w)) && !!seen.add(norm(w))) };
  });
  return { ...content, inline_options_per_gap: per };
}

/** Các cách viết được chấp nhận của một ô tự gõ (giống grading.acceptedAnswers): "[a / b]", "(the) park". */
export function acceptedForms(gap: string): { forms: string[]; optional: string | null } {
  const forms = gap.split(/\s+\/\s+/).map((x) => x.replace(/\(([^)]*)\)\s*/g, "").trim()).filter(Boolean);
  const m = gap.match(/\(([^)]+)\)/);
  return { forms, optional: m ? m[1] : null };
}

// ───────── sắp xếp ─────────
export function orderingPieces(content: Rec): string[] {
  const type = (content.ordering_type === "SENTENCE_ORDERING" ? "SENTENCE_ORDERING" : "WORD_ORDERING") as OrderingType;
  return splitOrderingItems(str(content.correct_text), type);
}
/** Sắp xếp câu: mỗi câu một ô → correct_text nối bằng khoảng trắng (tách lại theo dấu câu khi chấm). */
export function sentenceList(content: Rec): string[] {
  return orderingPieces({ ...content, ordering_type: "SENTENCE_ORDERING" });
}
export function withSentenceList(content: Rec, list: string[]): Rec {
  const clean = list.map((s) => {
    const t = s.trim();
    return t && !/[.!?]$/.test(t) ? t + "." : t;
  });
  return { ...content, correct_text: clean.filter(Boolean).join(" "), _sentences: list };
}

/** Xem trước các mảnh đã xáo (thứ tự cố định để không nhảy khi gõ). */
export function previewShuffle<T>(arr: T[]): T[] {
  return arr.map((x, i) => ({ x, k: ((i * 7 + 3) % (arr.length || 1)) + i / 1000 })).sort((a, b) => a.k - b.k).map((o) => o.x);
}

// ───────── viết lại câu ─────────
export function rewriteCue(answer: unknown): string {
  const m = str(answer).match(/^\s*\[([^\]]+)\]/);
  return m ? m[1] : "";
}

/** Câu có đủ dữ liệu để lưu chưa (hiện chấm đỏ ở thẻ). */
export function questionProblem(q: EdQuestion): string | null {
  const c = q.content;
  if (q.category.endsWith("_MC")) {
    const opts = ["a", "b", "c", "d"].map((k) => str(c[`option_${k}`]).trim());
    if (opts.filter(Boolean).length < 2) return "Cần ít nhất 2 phương án.";
    const idx = "ABCD".indexOf(str(c.correct_answer).toUpperCase());
    if (idx < 0 || !opts[idx]) return "Đáp án đúng đang trỏ vào phương án trống.";
  }
  if ((q.category.endsWith("_FILL_IN") || q.category === "WRITING_FREE_TYPING_BLANKS") && gapsOf(c.passage).length === 0) return "Đoạn văn chưa có ô [đáp án] nào.";
  if (q.category.endsWith("_ORDERING") && orderingPieces(c).length < 2) return "Cần ít nhất 2 mảnh để sắp xếp.";
  if (q.category.endsWith("_MATCHING")) {
    const pairs = Array.isArray(c.pairs) ? (c.pairs as Rec[]) : [];
    if (pairs.filter((p) => str(p.left).trim() && str(p.right).trim()).length < 2) return "Cần ít nhất 2 cặp đủ hai vế.";
  }
  if (q.category.endsWith("_FLASHCARD_SET") && !(Array.isArray(c.flashcard_ids) && c.flashcard_ids.length)) return "Bộ thẻ chưa có thẻ nào.";
  if ((q.category === "WRITING_ESSAY" || q.category === "SPEAKING_TOPIC_PROMPT") && !q.prompt.trim()) return "Chưa có đề bài.";
  if (q.category === "WRITING_SHORT_ANSWER" && !str(c.text).trim()) return "Chưa có câu hỏi.";
  if (q.category === "WRITING_SENTENCE_REWRITE" && (!str(c.original_sentence).trim() || !str(c.correct_answer).trim())) return "Cần câu gốc và câu viết lại.";
  if (q.category === "SPEAKING_READ_ALOUD" && !str(c.passage).trim()) return "Chưa có đoạn đọc.";
  return null;
}
