// FEAT-015 — chuyển dạng câu trên giấy (ABCD) sang dạng câu hệ thống (DEC-042 → DEC-046, BR-I01 → BR-I14).
// Hàm THUẦN: không gọi mạng, không đọc DB, chạy được ở cả trình duyệt (Review Studio) và server (ai-parse/ai-import).
// Cùng đầu vào → cùng kết quả. Đặc tả: docs/features/chuyen-doi-dang-cau-nhap-de.md §7.
import { parseFillInGaps, splitOrderingItems } from "./question-content-types";
import { sanitizeStimulusHtml, stripHtml } from "./stimulus-html";

export const CONVERTER_VERSION = 2;

export const PAPER_FORMATS = [
  "PRONUNCIATION",
  "STRESS",
  "CLOZE_PASSAGE",
  "SENTENCE_BLANK",
  "SENTENCE_MULTI_BLANK",
  "WORD_BOX",
  "SENTENCE_ARRANGEMENT",
  "WORD_ARRANGEMENT",
  "MATCHING",
  "ERROR_IDENTIFICATION",
  "SYNONYM_ANTONYM",
  "READING_COMPREHENSION",
  "SENTENCE_TRANSFORMATION",
  "SENTENCE_COMBINATION",
  "DIALOGUE_RESPONSE",
  "GENERAL_MC",
  "REWRITE_WITH_CUE",
  "ESSAY",
  "SHORT_ANSWER",
  "UNSUPPORTED",
] as const;
export type PaperFormat = (typeof PAPER_FORMATS)[number];

/** Nhãn tiếng Việt hiển thị ở Review Studio ("Trên giấy: …"). */
export const PAPER_FORMAT_LABELS: Record<PaperFormat, string> = {
  PRONUNCIATION: "Phát âm (phần gạch chân)",
  STRESS: "Trọng âm",
  CLOZE_PASSAGE: "Điền từ vào đoạn văn",
  SENTENCE_BLANK: "Câu có 1 chỗ trống",
  SENTENCE_MULTI_BLANK: "Câu có nhiều chỗ trống",
  WORD_BOX: "Điền từ trong hộp",
  SENTENCE_ARRANGEMENT: "Sắp xếp câu / ý",
  WORD_ARRANGEMENT: "Sắp xếp từ thành câu",
  MATCHING: "Ghép nối",
  ERROR_IDENTIFICATION: "Tìm lỗi sai",
  SYNONYM_ANTONYM: "Từ đồng / trái nghĩa",
  READING_COMPREHENSION: "Đọc hiểu",
  SENTENCE_TRANSFORMATION: "Câu gần nghĩa nhất",
  SENTENCE_COMBINATION: "Nối hai câu",
  DIALOGUE_RESPONSE: "Chọn câu đáp hội thoại",
  GENERAL_MC: "Trắc nghiệm",
  REWRITE_WITH_CUE: "Viết lại câu theo gợi ý",
  ESSAY: "Viết đoạn / bài luận",
  SHORT_ANSWER: "Trả lời ngắn",
  UNSUPPORTED: "Dạng chưa hỗ trợ",
};

export const CATEGORY_LABELS: Record<string, string> = {
  READING_MC: "Trắc nghiệm",
  LISTENING_MC: "Trắc nghiệm (nghe)",
  READING_FILL_IN: "Điền ô trống",
  LISTENING_FILL_IN: "Điền ô trống (nghe)",
  READING_ORDERING: "Sắp xếp",
  LISTENING_ORDERING: "Sắp xếp (nghe)",
  READING_MATCHING: "Ghép nối",
  LISTENING_MATCHING: "Ghép nối (nghe)",
  WRITING_SENTENCE_REWRITE: "Viết lại câu",
  WRITING_ESSAY: "Bài luận",
  WRITING_SHORT_ANSWER: "Trả lời ngắn",
};

export const KNOWN_CATEGORIES = [
  "READING_MC", "LISTENING_MC", "READING_FILL_IN", "LISTENING_FILL_IN", "READING_ORDERING", "LISTENING_ORDERING",
  "READING_MATCHING", "LISTENING_MATCHING", "WRITING_MATCHING", "READING_FLASHCARD_SET", "WRITING_FLASHCARD_SET",
  "WRITING_ESSAY", "WRITING_FREE_TYPING_BLANKS", "WRITING_SHORT_ANSWER", "WRITING_SENTENCE_REWRITE",
  "SPEAKING_TOPIC_PROMPT", "SPEAKING_READ_ALOUD",
];

export type WarningCode =
  | "NO_ANSWER"
  | "AI_SOLVED_ANSWER"
  | "UNSUPPORTED_FORMAT"
  | "GAP_NOT_FOUND"
  | "UNDERLINE_MISSING"
  | "CONVERSION_FAILED"
  | "DISTRACTORS_DROPPED" // chỉ còn ở dữ liệu nhập theo converter v1 (thay bởi BR-I15)
  | "LOW_CONFIDENCE"
  | "AUDIO_MISSING"
  | "PASSAGE_MISSING";

/** Lời dẫn nhắc tới một bài đọc ("Reading Passage 1", "paragraphs A–F"…) — dùng để phát hiện AI làm rơi bài đọc (BR-I17). */
// "Read the following passage…" (đề Việt Nam), "Reading Passage 1" (IELTS), "đoạn văn/bài đọc" — BR-I17
export const PASSAGE_REFERENCE_RE = /\bpassage\b|the (?:following )?text\b|paragraphs?\s+[A-H]\b|đoạn văn|bài đọc/i;
// bài đọc đề THCS/THPT chỉ 400–1000 ký tự; dưới ngưỡng này coi như chưa chép bài
const MIN_PASSAGE_CHARS = 200;

/** Nhóm nhắc tới bài đọc nhưng không có bài đọc chung lẫn đoạn dẫn đủ dài. */
export function groupMissesPassage(g: RawGroup): boolean {
  if (/listen|writ|speak/i.test(g.skill || "")) return false;
  if (!PASSAGE_REFERENCE_RE.test(g.prompt || "")) return false;
  return plain(g.passage_html).length < MIN_PASSAGE_CHARS && plain(g.stimulus_html).length < MIN_PASSAGE_CHARS;
}

export const BLOCKING_WARNINGS: WarningCode[] = ["NO_ANSWER"];

export type AnswerSource = "KEY" | "AI_SOLVED" | "NONE" | "TEACHER";

export interface RawOption {
  key: string;
  text_html: string;
}

export interface RawSubQuestion {
  id: string;
  number: number;
  text_html: string;
  options: RawOption[];
  correct_answer: string | null;
  answer_source: AnswerSource;
  paper_format: PaperFormat;
  unsupported_reason?: string;
  confidence: number;
}

export interface RawGroup {
  tempId: string;
  groupNumber: number;
  skill: string;
  prompt: string;
  stimulus_html?: string | null;
  /** Bài đọc dài dùng chung cho nhiều nhóm (kiểu IELTS: một passage, nhiều dạng câu) — thành stimulus_text của mọi câu trong nhóm. */
  passage_html?: string | null;
  word_box?: string[];
  matching?: { left: { key: string; text: string }[]; right: { key: string; text: string }[] };
  sub_questions: RawSubQuestion[];
}

export interface ConvertWarning {
  code: WarningCode;
  message: string;
  numbers?: number[];
}

export interface ImportMeta {
  source: "AI_IMPORT";
  converter_version: number;
  paper_format: PaperFormat;
  paper_numbers: number[];
  confidence: number;
  answer_source: AnswerSource;
  warnings: ConvertWarning[];
  /** Nhãn phần thi trên giấy do AI đặt ("Phonetics", "Grammar & Vocabulary"…) — chỉ để hiển thị/tra cứu. */
  paper_skill?: string;
}

/** BR-I23: kỹ năng hệ thống luôn suy ra từ tiền tố dạng câu (exam-player xếp màn theo 4 kỹ năng chuẩn). */
export function skillOfCategory(category: string): "Reading" | "Listening" | "Writing" | "Speaking" {
  if (category.startsWith("LISTENING_")) return "Listening";
  if (category.startsWith("WRITING_")) return "Writing";
  if (category.startsWith("SPEAKING_")) return "Speaking";
  return "Reading";
}

export interface ConvertedQuestion {
  tempId: string;
  skill: string;
  category: string;
  prompt: string;
  stimulus_text: string | null;
  content: Record<string, unknown> & { import_meta: ImportMeta };
}

export type NeedsAiReason = "GAP_NOT_FOUND";

export interface GroupConversion {
  tempId: string;
  questions: ConvertedQuestion[];
  warnings: ConvertWarning[];
  /** Có giá trị → server nên gọi AI lượt 2 cho riêng nhóm này (BR-I09). Câu hỏi trả về vẫn dùng được (dạng tạm). */
  needsAi: NeedsAiReason[];
}

// ── Tiện ích chữ ─────────────────────────────────────────────────────────
const plain = (html: string | null | undefined) => stripHtml(html || "");
/** Như plain nhưng giữ xuống dòng (dòng văn bản, <br>, hết đoạn/ô/hàng) — cho danh sách lựa chọn, bảng, ghi chú. */
const plainLines = (html: string | null | undefined) =>
  (html || "")
    .replace(/<br\s*\/?>|<\/(?:p|div|li|tr|h\d)>/gi, "\n")
    .split("\n")
    .map((l) => stripHtml(l))
    .filter(Boolean)
    .join("\n");
const norm = (s: string) => plain(s).toLowerCase().replace(/[.,!?;:"'()]/g, "").replace(/\s+/g, " ").trim();
/** Ngoặc vuông có sẵn trong văn bản gốc → ngoặc tròn, để parseFillInGaps chỉ thấy ô do bộ chuyển đổi chèn (BR-I06). */
const neutralizeBrackets = (s: string) => s.replace(/\[/g, "(").replace(/\]/g, ")");
const BLANK_RE = /_{2,}|…+|\.{3,}/g;
const LETTERS = ["A", "B", "C", "D"];

function isListening(skill: string) {
  return /listen/i.test(skill || "");
}
function cat(skill: string, base: "MC" | "FILL_IN" | "ORDERING" | "MATCHING") {
  return `${isListening(skill) ? "LISTENING" : "READING"}_${base}`;
}

function optionText(sub: RawSubQuestion, key: string | null): string | null {
  if (!key) return null;
  const opt = sub.options.find((o) => o.key.toUpperCase() === key.toUpperCase());
  return opt ? plain(opt.text_html) : null;
}

/** Đáp án dạng chữ trơn: tra theo khoá A–D, nếu không có phương án thì dùng thẳng giá trị đáp án. */
function answerText(sub: RawSubQuestion): string | null {
  if (!sub.correct_answer) return null;
  return optionText(sub, sub.correct_answer) ?? (sub.options.length === 0 ? plain(sub.correct_answer) : null);
}

function minConfidence(subs: RawSubQuestion[]) {
  const vals = subs.map((s) => (Number.isFinite(s.confidence) ? s.confidence : 0));
  return vals.length ? Math.min(...vals) : 0;
}

function answerSourceOf(subs: RawSubQuestion[]): AnswerSource {
  if (subs.some((s) => s.answer_source === "NONE" || !s.correct_answer)) return "NONE";
  if (subs.some((s) => s.answer_source === "AI_SOLVED")) return "AI_SOLVED";
  if (subs.every((s) => s.answer_source === "TEACHER")) return "TEACHER";
  return "KEY";
}

/** Cảnh báo chung theo câu con: thiếu đáp án, AI tự giải, độ tin cậy thấp, Listening thiếu audio. */
function commonWarnings(group: RawGroup, subs: RawSubQuestion[]): ConvertWarning[] {
  const w: ConvertWarning[] = [];
  const noAns = subs.filter((s) => s.answer_source === "NONE" || !s.correct_answer).map((s) => s.number);
  if (noAns.length) w.push({ code: "NO_ANSWER", message: `Câu ${noAns.join(", ")} chưa có đáp án — chọn đáp án trước khi nhập.`, numbers: noAns });
  const aiSolved = subs.filter((s) => s.answer_source === "AI_SOLVED" && s.correct_answer).map((s) => s.number);
  if (aiSolved.length) w.push({ code: "AI_SOLVED_ANSWER", message: `Đáp án câu ${aiSolved.join(", ")} do AI tự giải (đề không có đáp án), cần kiểm lại.`, numbers: aiSolved });
  const low = subs.filter((s) => (Number.isFinite(s.confidence) ? s.confidence : 0) < 0.6).map((s) => s.number);
  if (low.length) w.push({ code: "LOW_CONFIDENCE", message: `AI không chắc dạng câu ${low.join(", ")}, kiểm lại.`, numbers: low });
  if (isListening(group.skill)) w.push({ code: "AUDIO_MISSING", message: "Câu nghe chưa có file audio — tải audio sau khi nhập." });
  return w;
}

function meta(format: PaperFormat, subs: RawSubQuestion[], warnings: ConvertWarning[]): ImportMeta {
  return {
    source: "AI_IMPORT",
    converter_version: CONVERTER_VERSION,
    paper_format: format,
    paper_numbers: subs.map((s) => s.number),
    confidence: minConfidence(subs),
    answer_source: answerSourceOf(subs),
    warnings,
  };
}

// ── Dựng từng dạng ───────────────────────────────────────────────────────
function buildMc(group: RawGroup, subs: RawSubQuestion[], format: PaperFormat, extra: ConvertWarning[], idx: number): ConvertedQuestion {
  const warnings = [...extra, ...commonWarnings(group, subs)];
  const sub_questions = subs.map((s) => {
    const opts: Record<string, string> = {};
    LETTERS.forEach((L, i) => {
      const o = s.options.find((x) => x.key.toUpperCase() === L) ?? s.options[i];
      // chữ trơn: bỏ gạch chân / thẻ HTML khỏi câu và phương án (BR-I25)
      opts[`option_${L.toLowerCase()}`] = o ? plain(o.text_html) : "";
    });
    return {
      id: `${group.tempId}_q${s.number}`,
      number: s.number,
      // để trống được: LessonPlayer hiện số câu đề giấy (BR-I20)
      text: plain(s.text_html),
      ...opts,
      correct_answer: s.correct_answer ? s.correct_answer.toUpperCase() : null,
    };
  });
  return {
    tempId: `${group.tempId}_${idx}`,
    skill: group.skill || "Reading",
    category: cat(group.skill, "MC"),
    prompt: group.prompt,
    stimulus_text: group.stimulus_html ? sanitizeStimulusHtml(group.stimulus_html) : null,
    content: { sub_questions, import_meta: meta(format, subs, warnings) },
  };
}

function fillIn(
  group: RawGroup,
  subs: RawSubQuestion[],
  format: PaperFormat,
  passage: string,
  answers: string[],
  bank: string[] | null,
  perGap: string[][] | null,
  idx: number
): ConvertedQuestion {
  const warnings = commonWarnings(group, subs);
  // bank → kho từ chung; perGap → danh sách chọn từng ô; không có cả hai → học sinh tự gõ (FEAT-015 BR-I16)
  const subtype = bank !== null ? "OPTION_BANK" : perGap !== null ? "INLINE_SELECT" : "FREE_TYPING";
  const content: Record<string, unknown> = {
    fill_subtype: subtype,
    passage,
    correct_answers: answers,
  };
  if (subtype === "OPTION_BANK") content.option_bank = bank;
  if (subtype === "INLINE_SELECT") content.inline_options_per_gap = (perGap || []).map((options, gap_index) => ({ gap_index, options }));
  return {
    tempId: `${group.tempId}_${idx}`,
    skill: group.skill || "Reading",
    category: cat(group.skill, "FILL_IN"),
    prompt: group.prompt,
    stimulus_text: null, // đoạn văn nằm trong content.passage (thay một phần BR-INGEST-04)
    content: { ...content, import_meta: meta(format, subs, warnings) },
  };
}

/** Tìm vị trí ô của câu số n trong đoạn văn (BR-I03). Trả [start, end] hoặc null. */
function findGapMarker(text: string, n: number, from: number): [number, number] | null {
  const N = String(n);
  const patterns = [
    new RegExp(`\\(\\s*${N}\\s*\\)\\s*(?:_{2,}|…+|\\.{3,})`),
    new RegExp(`(?:_{2,}|…+|\\.{3,})\\s*\\(\\s*${N}\\s*\\)(?:\\s*(?:_{2,}|…+|\\.{3,}))?`),
    new RegExp(`_+\\s*${N}\\s*_+`),
    new RegExp(`\\[\\s*${N}\\s*\\]`),
    new RegExp(`\\(\\s*${N}\\s*\\)`),
    new RegExp(`(?<![\\d.,])\\b${N}\\s*[.)]\\s*(?:_{2,}|…+|\\.{3,})`),
  ];
  const tail = text.slice(from);
  for (const re of patterns) {
    const m = re.exec(tail);
    if (m) return [from + m.index, from + m.index + m[0].length];
  }
  return null;
}

/** Thay dấu ô của từng câu (đã sắp theo số) bằng "(n) [đáp án]". Thiếu một ô → null. */
function markGaps(source: string, sorted: RawSubQuestion[], answers: string[]): string | null {
  let text = source;
  if (!text) return null;
  // 1) thay dấu ô bằng chỗ giữ tạm, theo đúng thứ tự xuất hiện
  let cursor = 0;
  const holders: string[] = [];
  for (const s of sorted) {
    const pos = findGapMarker(text, s.number, cursor);
    if (!pos) return null;
    const holder = `\u0000${holders.length}\u0000`;
    text = text.slice(0, pos[0]) + holder + text.slice(pos[1]);
    cursor = pos[0] + holder.length;
    holders.push(holder);
  }
  // 2) ngoặc vuông gốc → ngoặc tròn; 3) chèn "(n) [đáp án]"
  text = neutralizeBrackets(text);
  sorted.forEach((s, i) => {
    text = text.replace(holders[i], `(${s.number}) [${neutralizeBrackets(answers[i]) || "?"}]`);
  });
  return text;
}

/** Câu FILL_IN dựng ô trống ngay trên bài đọc chung → không gắn lại bài đó làm stimulus_text (tránh hiện hai lần). */
const BUILT_ON_SHARED_PASSAGE = new WeakSet<ConvertedQuestion>();

/**
 * Đánh dấu ô trên đoạn dẫn riêng của nhóm; không có thì thử bài đọc chung (AI đôi khi để đoạn điền từ ở
 * "passages" thay vì stimulus_html — BR-I22). Trả văn bản đã đánh dấu và nguồn đã dùng.
 */
function markGapsInGroup(group: RawGroup, sorted: RawSubQuestion[], answers: string[], lines = false): { text: string; shared: boolean } | null {
  const read = (h: string | null | undefined) => (h ? (lines ? plainLines(h) : plain(h)) : "");
  const own = markGaps(read(group.stimulus_html), sorted, answers);
  if (own !== null) return { text: own, shared: false };
  const shared = markGaps(read(group.passage_html), sorted, answers);
  return shared !== null ? { text: shared, shared: true } : null;
}

function convertCloze(group: RawGroup, subs: RawSubQuestion[], idx: number): ConvertedQuestion | "GAP_NOT_FOUND" {
  const sorted = [...subs].sort((a, b) => a.number - b.number);
  const answers = sorted.map((s) => answerText(s) ?? "");
  const marked = markGapsInGroup(group, sorted, answers);
  if (marked === null) return "GAP_NOT_FOUND";
  const perGap = sorted.map((s) => s.options.map((o) => neutralizeBrackets(plain(o.text_html))));
  const q = sorted.length === 1
    ? fillIn(group, sorted, "CLOZE_PASSAGE", marked.text, answers, perGap[0], null, idx)
    : fillIn(group, sorted, "CLOZE_PASSAGE", marked.text, answers, null, perGap, idx);
  if (marked.shared) BUILT_ON_SHARED_PASSAGE.add(q);
  return q;
}

const PAIR_SEPARATORS = [/\s*\/\s*/, /\s+[–—]\s+/, /\s*;\s*/, /\s+-\s+/, /\s*…\s*/, /\s*\.{3}\s*/];

/** Tách phương án dạng cặp: chỉ khi CẢ 4 phương án tách được đúng k phần (BR-I04). */
function splitPairs(sub: RawSubQuestion, k: number): string[][] | null {
  const texts = sub.options.map((o) => plain(o.text_html));
  if (texts.length < 2) return null;
  for (const sep of PAIR_SEPARATORS) {
    const parts = texts.map((t) => t.split(sep).map((x) => x.trim()));
    if (parts.every((p) => p.length === k && p.every(Boolean))) return parts;
  }
  return null;
}

function convertSentenceBlank(group: RawGroup, sub: RawSubQuestion, idx: number): ConvertedQuestion | "GAP_NOT_FOUND" | "KEEP_MC" {
  const text = neutralizeBrackets(plain(sub.text_html));
  const blanks = text.match(BLANK_RE) || [];
  if (blanks.length === 0) return "GAP_NOT_FOUND";
  if (blanks.length === 1) {
    const ans = answerText(sub) ?? "";
    const passage = text.replace(BLANK_RE, `[${neutralizeBrackets(ans) || "?"}]`);
    const bank = sub.options.map((o) => neutralizeBrackets(plain(o.text_html)));
    return fillIn(group, [sub], "SENTENCE_BLANK", passage, [ans], bank, null, idx);
  }
  const k = blanks.length;
  const parts = splitPairs(sub, k);
  if (!parts) return "KEEP_MC";
  const correctIdx = sub.options.findIndex((o) => o.key.toUpperCase() === (sub.correct_answer || "").toUpperCase());
  const answers = correctIdx >= 0 ? parts[correctIdx].map(neutralizeBrackets) : Array(k).fill("");
  const perGap = Array.from({ length: k }, (_, g) => [...new Set(parts.map((p) => neutralizeBrackets(p[g])))]);
  let gi = 0;
  const passage = text.replace(BLANK_RE, () => `[${answers[gi++] || "?"}]`);
  return fillIn(group, [sub], "SENTENCE_MULTI_BLANK", passage, answers, null, perGap, idx);
}

function convertWordBox(group: RawGroup, subs: RawSubQuestion[], idx: number): ConvertedQuestion | "GAP_NOT_FOUND" {
  const bank = (group.word_box || []).map((w) => neutralizeBrackets(plain(w))).filter(Boolean);
  const sorted = [...subs].sort((a, b) => a.number - b.number);
  const answers = sorted.map((s) => answerText(s) ?? "");
  if (group.stimulus_html && plain(group.stimulus_html)) {
    // Hộp từ + đoạn văn có ô đánh số: dùng cách tìm ô của cloze, nhưng kho từ chung
    const asCloze = convertCloze(group, sorted, idx);
    if (typeof asCloze === "string") return asCloze;
    const content = asCloze.content;
    delete content.inline_options_per_gap;
    content.fill_subtype = "OPTION_BANK";
    content.option_bank = bank;
    content.import_meta = meta("WORD_BOX", sorted, content.import_meta.warnings);
    return asCloze;
  }
  // Hộp từ + từng câu có 1 chỗ trống → gộp thành một đoạn, mỗi dòng một câu
  const lines: string[] = [];
  for (let i = 0; i < sorted.length; i++) {
    const t = neutralizeBrackets(plain(sorted[i].text_html));
    if ((t.match(BLANK_RE) || []).length !== 1) return "GAP_NOT_FOUND";
    lines.push(`(${sorted[i].number}) ${t.replace(BLANK_RE, `[${neutralizeBrackets(answers[i]) || "?"}]`)}`);
  }
  return fillIn(group, sorted, "WORD_BOX", lines.join("\n"), answers, bank, null, idx);
}

/** "a. … b. … c. …" → { a: "…", b: "…" } theo thứ tự. */
function parseLabeledItems(text: string): { label: string; text: string }[] {
  const re = /(?:^|\s)([a-eA-E1-5])\s*[.)]\s+/g;
  const marks: { label: string; start: number; end: number }[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) marks.push({ label: m[1].toLowerCase(), start: m.index, end: re.lastIndex });
  const out: { label: string; text: string }[] = [];
  marks.forEach((mk, i) => {
    const t = text.slice(mk.end, i + 1 < marks.length ? marks[i + 1].start : undefined).trim();
    if (t) out.push({ label: mk.label, text: t });
  });
  return out;
}

function convertSentenceArrangement(group: RawGroup, sub: RawSubQuestion, idx: number): ConvertedQuestion | "FAILED" {
  const items = parseLabeledItems(plain(sub.text_html));
  const order = (optionText(sub, sub.correct_answer) || "").toLowerCase().match(/[a-e1-5]/g) || [];
  const labels = items.map((i) => i.label);
  if (items.length < 2 || order.length !== items.length || [...order].sort().join() !== [...labels].sort().join()) return "FAILED";
  const ordered = order.map((l) => items.find((i) => i.label === l)!.text.replace(/\s+/g, " "));
  // mỗi ý phải là đúng một câu để splitOrderingItems tách lại khớp
  const fixed = ordered.map((t) => (/[.!?]$/.test(t) ? t : `${t}.`));
  if (fixed.some((t) => /[.!?]\s+\S/.test(t))) return "FAILED";
  const correct_text = fixed.join(" ");
  if (splitOrderingItems(correct_text, "SENTENCE_ORDERING").length !== items.length) return "FAILED";
  return orderingQuestion(group, sub, "SENTENCE_ARRANGEMENT", "SENTENCE_ORDERING", correct_text, idx);
}

function convertWordArrangement(group: RawGroup, sub: RawSubQuestion, idx: number): ConvertedQuestion | "FAILED" | "KEEP_MC" {
  const correct = optionText(sub, sub.correct_answer);
  if (!correct) return "FAILED";
  const chunks = plain(sub.text_html).split("/").map((c) => c.trim()).filter(Boolean);
  const bag = (s: string) => norm(s).split(" ").filter(Boolean).sort().join(" ");
  if (chunks.length < 2) return "FAILED";
  // BR-I21 (sửa): gợi ý thiếu từ nối ("People / thought / story" → "People thought the story was written…") vẫn
  // thành sắp xếp từ — học sinh xếp toàn bộ từ của câu đúng. Gợi ý và đáp án lệch nhau quá xa (không chung nửa số
  // từ gợi ý) thì giữ trắc nghiệm.
  const answerWords = new Set(bag(correct).split(" "));
  const cueWords = bag(chunks.join(" ")).split(" ").filter(Boolean);
  if (cueWords.filter((w) => answerWords.has(w)).length * 2 < cueWords.length) return sub.options.length >= 2 ? "KEEP_MC" : "FAILED";
  return orderingQuestion(group, sub, "WORD_ARRANGEMENT", "WORD_ORDERING", correct.replace(/\s+/g, " ").trim(), idx);
}

function orderingQuestion(
  group: RawGroup,
  sub: RawSubQuestion,
  format: PaperFormat,
  ordering_type: "SENTENCE_ORDERING" | "WORD_ORDERING",
  correct_text: string,
  idx: number
): ConvertedQuestion {
  const warnings = commonWarnings(group, [sub]);
  return {
    tempId: `${group.tempId}_${idx}`,
    skill: group.skill || "Reading",
    category: cat(group.skill, "ORDERING"),
    prompt: group.prompt,
    stimulus_text: group.stimulus_html ? sanitizeStimulusHtml(group.stimulus_html) : null,
    content: { ordering_type, correct_text, import_meta: meta(format, [sub], warnings) },
  };
}

/** Cột phải của ghép nối: matching.right → phương án của từng câu → danh sách "A …" / "vii …" trong đoạn dẫn. */
function matchingChoices(group: RawGroup, subs: RawSubQuestion[]): { key: string; text: string }[] {
  if (group.matching?.right?.length) return group.matching.right.map((r) => ({ key: r.key, text: plain(r.text) }));
  const fromOpts = new Map<string, string>();
  for (const s of subs) for (const o of s.options) if (!fromOpts.has(o.key.toUpperCase())) fromOpts.set(o.key.toUpperCase(), plain(o.text_html));
  if (fromOpts.size >= 2) return [...fromOpts].map(([key, text]) => ({ key, text }));
  const out: { key: string; text: string }[] = [];
  for (const seg of plainLines(group.stimulus_html).split(/\n|\|/)) {
    const m = seg.trim().match(/^([A-Z]|[ivx]{1,5})[.)]?\s+(\S.*)$/);
    if (m && !out.some((o) => o.key.toLowerCase() === m[1].toLowerCase())) out.push({ key: m[1], text: m[2].trim() });
  }
  return out;
}

/** Nhãn hiển thị của một lựa chọn: "D" + "Paragraph D" → "Paragraph D"; "vii" + "Why …" → "vii. Why …". */
function choiceLabel(c: { key: string; text: string }): string {
  const t = neutralizeBrackets(c.text.trim());
  if (!t) return c.key;
  return new RegExp(`\\b${c.key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`).test(t) ? t : `${c.key}. ${t}`;
}

/**
 * Ghép nối (BR-I08, BR-I15): đúng 1-1 và không có phương án thừa → READING_MATCHING;
 * có phương án nhiễu, đáp án lặp (phân loại) hoặc thiếu đáp án → mỗi mục một danh sách chọn (INLINE_SELECT) giữ đủ lựa chọn.
 */
function convertMatching(group: RawGroup, subs: RawSubQuestion[], idx: number): ConvertedQuestion | "FAILED" {
  const choices = matchingChoices(group, subs);
  if (choices.length < 2 || subs.some((s) => !plain(s.text_html))) return "FAILED";
  const sorted = [...subs].sort((a, b) => a.number - b.number);
  const pick = (s: RawSubQuestion) => choices.find((c) => c.key.toLowerCase() === (s.correct_answer || "").trim().toLowerCase());
  const keys = sorted.map((s) => (s.correct_answer || "").trim().toLowerCase());
  const oneToOne = sorted.length >= 2 && sorted.every((s) => pick(s)) && new Set(keys).size === sorted.length && choices.length === sorted.length;
  const warnings = commonWarnings(group, sorted);
  if (oneToOne) {
    return {
      tempId: `${group.tempId}_${idx}`,
      skill: group.skill || "Reading",
      category: cat(group.skill, "MATCHING"),
      prompt: group.prompt,
      stimulus_text: group.stimulus_html ? sanitizeStimulusHtml(group.stimulus_html) : null,
      content: {
        pairs: sorted.map((s) => ({ id: `${group.tempId}_m${s.number}`, left: plain(s.text_html), right: choiceLabel(pick(s)!) })),
        import_meta: meta("MATCHING", sorted, warnings),
      },
    };
  }
  const labels = choices.map(choiceLabel);
  const answers = sorted.map((s) => {
    const c = pick(s);
    return c ? choiceLabel(c) : "";
  });
  const passage = sorted.map((s, i) => `${s.number}. ${neutralizeBrackets(plain(s.text_html))} [${answers[i] || "?"}]`).join("\n");
  return {
    tempId: `${group.tempId}_${idx}`,
    skill: group.skill || "Reading",
    category: cat(group.skill, "FILL_IN"),
    prompt: group.prompt,
    stimulus_text: null,
    content: {
      fill_subtype: "INLINE_SELECT",
      passage,
      correct_answers: answers,
      inline_options_per_gap: sorted.map((_, gap_index) => ({ gap_index, options: labels })),
      import_meta: meta("MATCHING", sorted, warnings),
    },
  };
}

function convertRewrite(group: RawGroup, sub: RawSubQuestion, idx: number): ConvertedQuestion {
  const t = plain(sub.text_html);
  const m = t.match(/^([\s\S]*?)(?:→|=>|->|⇒)\s*([\s\S]*)$/);
  const original_sentence = (m ? m[1] : t).replace(/^\s*\d+\s*[.)]\s*/, "").trim();
  const starting_cue = (m ? m[2] : "").replace(/[_.…\s]+$/g, "").trim();
  const sample = (sub.correct_answer && (optionText(sub, sub.correct_answer) ?? plain(sub.correct_answer))) || "";
  const correct_answer =
    starting_cue && sample.toLowerCase().startsWith(starting_cue.toLowerCase())
      ? `[${starting_cue}]${sample.slice(starting_cue.length)}`
      : sample;
  const warnings = commonWarnings(group, [sub]);
  return {
    tempId: `${group.tempId}_${idx}`,
    skill: "Writing",
    category: "WRITING_SENTENCE_REWRITE",
    prompt: group.prompt,
    stimulus_text: null,
    content: { original_sentence, starting_cue, correct_answer, import_meta: meta("REWRITE_WITH_CUE", [sub], warnings) },
  };
}

function convertEssay(group: RawGroup, sub: RawSubQuestion, idx: number): ConvertedQuestion {
  const all = `${group.prompt} ${plain(sub.text_html)}`;
  const mw = all.match(/(\d{2,4})\s*(?:-\s*\d{2,4}\s*)?(?:words|từ)/i);
  const warnings = commonWarnings(group, [sub]).filter((w) => w.code !== "NO_ANSWER" && w.code !== "AI_SOLVED_ANSWER");
  return {
    tempId: `${group.tempId}_${idx}`,
    skill: "Writing",
    category: "WRITING_ESSAY",
    prompt: [group.prompt, plain(sub.text_html)].filter(Boolean).join("\n"),
    stimulus_text: group.stimulus_html ? sanitizeStimulusHtml(group.stimulus_html) : null,
    content: {
      min_words: mw ? Number(mw[1]) : 150,
      task_type: "Task 2",
      import_meta: { ...meta("ESSAY", [sub], warnings), answer_source: "KEY" },
    },
  };
}

/**
 * Hoàn thành câu / tóm tắt / bảng / ghi chú (kiểu IELTS "NO MORE THAN TWO WORDS") có đáp án → READING|LISTENING_FILL_IN
 * FREE_TYPING (BR-I16). Ô lấy từ đoạn dẫn đánh số "(8) ____"; không có đoạn dẫn thì mỗi câu một dòng. Không dựng được → null.
 */
function convertTypedCompletion(group: RawGroup, subs: RawSubQuestion[], idx: number): ConvertedQuestion | null {
  const sorted = [...subs].sort((a, b) => a.number - b.number);
  const answers = sorted.map((s) => neutralizeBrackets(plain(s.correct_answer || "")));
  if (answers.some((a) => !a)) return null;
  const marked = markGapsInGroup(group, sorted, answers, true);
  let passage = marked?.text ?? null;
  if (passage === null) {
    const lines: string[] = [];
    for (let i = 0; i < sorted.length; i++) {
      const t = neutralizeBrackets(plain(sorted[i].text_html)).replace(/^\s*\d+\s*[.)]\s*/, "");
      if (!t || /^Câu \d+$/.test(t)) return null;
      const blanks = (t.match(BLANK_RE) || []).length;
      if (blanks > 1) return null;
      lines.push(`${sorted[i].number}. ${blanks === 1 ? t.replace(BLANK_RE, `[${answers[i]}]`) : `${t} [${answers[i]}]`}`);
    }
    passage = lines.join("\n");
  }
  const q = fillIn(group, sorted, "SHORT_ANSWER", passage, answers, null, null, idx);
  if (marked?.shared) BUILT_ON_SHARED_PASSAGE.add(q);
  return q;
}

function convertShortAnswer(group: RawGroup, subs: RawSubQuestion[], idx: number): ConvertedQuestion {
  if (!/writ/i.test(group.skill || "")) {
    const typed = convertTypedCompletion(group, subs, idx);
    if (typed) return typed;
  }
  const warnings = commonWarnings(group, subs).filter((w) => w.code !== "NO_ANSWER");
  return {
    tempId: `${group.tempId}_${idx}`,
    skill: "Writing",
    category: "WRITING_SHORT_ANSWER",
    prompt: group.prompt,
    stimulus_text: group.stimulus_html ? sanitizeStimulusHtml(group.stimulus_html) : null,
    content: {
      sub_questions: subs.map((s) => ({
        id: `${group.tempId}_q${s.number}`,
        text: plain(s.text_html),
        max_words: 20,
        sample_answer: s.correct_answer ? (optionText(s, s.correct_answer) ?? plain(s.correct_answer)) : undefined,
      })),
      import_meta: { ...meta("SHORT_ANSWER", subs, warnings), answer_source: subs.every((s) => s.correct_answer) ? "KEY" : "NONE" },
    },
  };
}

// ── Điểm vào ─────────────────────────────────────────────────────────────
const GROUP_LEVEL: PaperFormat[] = ["CLOZE_PASSAGE", "WORD_BOX", "MATCHING"];

function normalizeFormat(f: unknown): PaperFormat {
  return (PAPER_FORMATS as readonly string[]).includes(String(f)) ? (f as PaperFormat) : "GENERAL_MC";
}

/** Dạng AI hay gắn nhầm cho câu gợi ý từ "People / thought / story / …" (BR-I21). */
const CUE_RELABEL: PaperFormat[] = ["GENERAL_MC", "SENTENCE_TRANSFORMATION", "SENTENCE_COMBINATION", "REWRITE_WITH_CUE"];

/** Câu là dãy ≥ 3 cụm từ ngăn bởi "/" (không có chỗ trống) và có phương án A–D → sắp xếp từ thành câu. */
function looksLikeWordCues(s: RawSubQuestion): boolean {
  if (!CUE_RELABEL.includes(normalizeFormat(s.paper_format))) return false;
  if (!Array.isArray(s.options) || s.options.length < 2) return false;
  const t = plain(s.text_html);
  if ((t.match(BLANK_RE) || []).length > 0) return false;
  const chunks = t.split("/").map((c) => c.trim()).filter(Boolean);
  return chunks.length >= 3 && chunks.every((c) => c.split(/\s+/).length <= 4);
}

/** Chuyển một nhóm câu gốc. `override` = giáo viên chọn "Đổi dạng" (áp cho cả nhóm). */
export function convertGroup(raw: RawGroup, opts: { override?: PaperFormat } = {}): GroupConversion {
  const subs = raw.sub_questions.map((s) => ({
    ...s,
    options: Array.isArray(s.options) ? s.options : [],
    // > 4 phương án (vd "đoạn nào A–G", danh sách heading) không vừa trắc nghiệm A–D → dựng như ghép nối (BR-I15)
    paper_format:
      opts.override ??
      (Array.isArray(s.options) && s.options.length > 4
        ? "MATCHING"
        : looksLikeWordCues(s)
        ? "WORD_ARRANGEMENT"
        : normalizeFormat(s.paper_format)),
  }));
  const questions: ConvertedQuestion[] = [];
  const groupWarnings: ConvertWarning[] = [];
  const needsAi = new Set<NeedsAiReason>();
  let idx = 0;

  const fallbackMc = (block: RawSubQuestion[], format: PaperFormat, w: ConvertWarning) => {
    questions.push(buildMc(raw, block, format, [w], idx++));
  };

  // Tách thành các khối liền nhau cùng dạng (BR-I11)
  const blocks: { format: PaperFormat; subs: RawSubQuestion[] }[] = [];
  for (const s of subs) {
    const last = blocks[blocks.length - 1];
    if (last && last.format === s.paper_format) last.subs.push(s);
    else blocks.push({ format: s.paper_format, subs: [s] });
  }

  for (const { format, subs: block } of blocks) {
    const nums = block.map((s) => s.number);
    if (GROUP_LEVEL.includes(format)) {
      const r = format === "CLOZE_PASSAGE" ? convertCloze(raw, block, idx) : format === "WORD_BOX" ? convertWordBox(raw, block, idx) : convertMatching(raw, block, idx);
      if (typeof r === "string") {
        if (r === "GAP_NOT_FOUND") {
          needsAi.add("GAP_NOT_FOUND");
          fallbackMc(block, format, { code: "GAP_NOT_FOUND", message: `Không tìm thấy vị trí ô trống của câu ${nums.join(", ")} — tạm để trắc nghiệm.`, numbers: nums });
        } else {
          fallbackMc(block, format, { code: "CONVERSION_FAILED", message: `Không chuyển được câu ${nums.join(", ")} sang dạng ${PAPER_FORMAT_LABELS[format].toLowerCase()} — tạm để trắc nghiệm.`, numbers: nums });
        }
      } else {
        questions.push(r);
        idx++;
      }
      continue;
    }

    if (format === "SHORT_ANSWER") {
      questions.push(convertShortAnswer(raw, block, idx++));
      continue;
    }

    // Dạng theo từng câu: dựng riêng từng câu; các câu rơi về trắc nghiệm liền nhau được gộp lại
    let mcRun: RawSubQuestion[] = [];
    let mcRunWarnings: ConvertWarning[] = [];
    const flushMc = () => {
      if (!mcRun.length) return;
      questions.push(buildMc(raw, mcRun, format, mcRunWarnings, idx++));
      mcRun = [];
      mcRunWarnings = [];
    };
    for (const s of block) {
      if (format === "SENTENCE_BLANK" || format === "SENTENCE_MULTI_BLANK") {
        const r = convertSentenceBlank(raw, s, idx);
        if (r === "KEEP_MC") {
          mcRun.push(s);
        } else if (r === "GAP_NOT_FOUND") {
          needsAi.add("GAP_NOT_FOUND");
          mcRun.push(s);
          mcRunWarnings.push({ code: "GAP_NOT_FOUND", message: `Không tìm thấy chỗ trống trong câu ${s.number} — tạm để trắc nghiệm.`, numbers: [s.number] });
        } else {
          flushMc();
          questions.push(r);
          idx++;
        }
      } else if (format === "SENTENCE_ARRANGEMENT" || format === "WORD_ARRANGEMENT") {
        const r = format === "SENTENCE_ARRANGEMENT" ? convertSentenceArrangement(raw, s, idx) : convertWordArrangement(raw, s, idx);
        if (r === "KEEP_MC") {
          mcRun.push(s);
        } else if (r === "FAILED") {
          mcRun.push(s);
          mcRunWarnings.push({ code: "CONVERSION_FAILED", message: `Không chuyển được câu ${s.number} sang dạng sắp xếp — tạm để trắc nghiệm.`, numbers: [s.number] });
        } else {
          flushMc();
          questions.push(r);
          idx++;
        }
      } else if (format === "REWRITE_WITH_CUE") {
        flushMc();
        questions.push(convertRewrite(raw, s, idx++));
      } else if (format === "ESSAY") {
        flushMc();
        questions.push(convertEssay(raw, s, idx++));
      } else {
        mcRun.push(s);
        if (format === "UNSUPPORTED") {
          mcRunWarnings.push({
            code: "UNSUPPORTED_FORMAT",
            message: `Câu ${s.number}: dạng chưa có trên hệ thống${s.unsupported_reason ? ` (${s.unsupported_reason})` : ""} — tạm để trắc nghiệm, admin đã được báo.`,
            numbers: [s.number],
          });
        }
      }
    }
    flushMc();
  }

  const passage = raw.passage_html && plain(raw.passage_html) ? sanitizeStimulusHtml(raw.passage_html) : null;
  if (passage) {
    // BR-I17: bài đọc chung là stimulus_text của mọi câu trong nhóm → các câu liền nhau cùng bài đọc thành một màn chia đôi.
    // Đoạn dẫn riêng của nhóm (danh sách heading, bảng…) chưa được dùng trong content thì nối vào lời dẫn.
    for (const q of questions) {
      if (q.category.startsWith("WRITING_") || BUILT_ON_SHARED_PASSAGE.has(q)) continue;
      if (q.stimulus_text && q.stimulus_text !== passage) {
        const own = stripHtml(q.stimulus_text);
        if (own && !q.prompt.includes(own)) q.prompt = `${q.prompt}\n\n${own}`;
      }
      q.stimulus_text = passage;
    }
  }
  for (const q of questions) {
    q.skill = skillOfCategory(q.category);
    if (raw.skill && raw.skill !== q.skill) q.content.import_meta.paper_skill = raw.skill;
    groupWarnings.push(...q.content.import_meta.warnings);
  }
  if (groupMissesPassage(raw)) {
    groupWarnings.push({ code: "PASSAGE_MISSING", message: "Lời dẫn nhắc tới bài đọc nhưng chưa có nội dung bài đọc — nhập lại file hoặc thêm bài đọc trước khi giao cho học sinh." });
  }
  return { tempId: raw.tempId, questions, warnings: dedupeWarnings(groupWarnings), needsAi: [...needsAi] };
}

function dedupeWarnings(ws: ConvertWarning[]): ConvertWarning[] {
  const seen = new Set<string>();
  return ws.filter((w) => {
    const k = `${w.code}|${w.message}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

/** Số mục chấm của một câu (khớp lib/grading.ts) — để hiện "Tổng điểm: X mục chấm (đề giấy: M câu)". */
export function countScoreItems(q: { category: string; content: Record<string, unknown> }): number {
  const c = q.content || {};
  if (q.category.endsWith("_MC") || q.category === "WRITING_SHORT_ANSWER") return Array.isArray(c.sub_questions) ? c.sub_questions.length : 0;
  if (q.category.endsWith("_FILL_IN")) return parseFillInGaps(String(c.passage || "")).gaps.length;
  if (q.category.endsWith("_MATCHING")) return Array.isArray(c.pairs) ? c.pairs.length : 0;
  return 1;
}

// ── Kiểm content trước khi lưu (ai-import, §6.2) ─────────────────────────
export function validateQuestionContent(category: string, content: unknown): { ok: true } | { ok: false; reason: string } {
  const bad = (reason: string) => ({ ok: false as const, reason });
  if (!KNOWN_CATEGORIES.includes(category)) return bad(`Dạng câu không hợp lệ: ${category}`);
  if (!content || typeof content !== "object" || Array.isArray(content)) return bad("Thiếu nội dung câu hỏi");
  const c = content as Record<string, unknown>;

  if (category.endsWith("_MC")) {
    const subs = c.sub_questions;
    if (!Array.isArray(subs) || subs.length === 0) return bad("Trắc nghiệm không có câu con");
    for (const s of subs as Record<string, unknown>[]) {
      if (!s || typeof s.id !== "string") return bad("Câu con thiếu id");
      if (!String(s.option_a || "").trim() || !String(s.option_b || "").trim()) return bad(`Câu ${s.number ?? s.id} thiếu phương án`);
      if (!LETTERS.includes(String(s.correct_answer || "").toUpperCase())) return bad(`Câu ${s.number ?? s.id} chưa có đáp án`);
    }
    return { ok: true };
  }
  if (category.endsWith("_FILL_IN")) {
    const sub = String(c.fill_subtype || "");
    if (!["OPTION_BANK", "INLINE_SELECT", "FREE_TYPING"].includes(sub)) return bad("Kiểu điền ô không hợp lệ");
    if (typeof c.passage !== "string" || !c.passage.trim()) return bad("Thiếu đoạn văn");
    const gaps = parseFillInGaps(c.passage).gaps;
    const answers = Array.isArray(c.correct_answers) ? (c.correct_answers as unknown[]).map((a) => String(a ?? "").trim()) : [];
    if (gaps.length === 0) return bad("Đoạn văn không có ô trống");
    if (answers.length !== gaps.length) return bad("Số đáp án khác số ô trống");
    if (answers.some((a) => !a || a === "?")) return bad("Có ô trống chưa có đáp án");
    if (sub === "OPTION_BANK") {
      const bank = Array.isArray(c.option_bank) ? (c.option_bank as unknown[]).map((x) => norm(String(x))) : [];
      if (bank.length < 2) return bad("Kho từ quá ít");
      if (answers.some((a) => !bank.includes(norm(a)))) return bad("Đáp án không có trong kho từ");
    }
    if (sub === "INLINE_SELECT") {
      const per = Array.isArray(c.inline_options_per_gap) ? (c.inline_options_per_gap as { gap_index: number; options: unknown[] }[]) : [];
      if (per.length !== gaps.length) return bad("Số danh sách phương án khác số ô trống");
      for (let i = 0; i < gaps.length; i++) {
        const g = per.find((p) => p && p.gap_index === i);
        const opts = g && Array.isArray(g.options) ? g.options.map((x) => norm(String(x))) : [];
        if (opts.length < 2) return bad(`Ô ${i + 1} có quá ít phương án`);
        if (!opts.includes(norm(answers[i]))) return bad(`Đáp án ô ${i + 1} không có trong phương án`);
      }
    }
    return { ok: true };
  }
  if (category.endsWith("_ORDERING")) {
    if (!["WORD_ORDERING", "SENTENCE_ORDERING"].includes(String(c.ordering_type))) return bad("Kiểu sắp xếp không hợp lệ");
    if (splitOrderingItems(String(c.correct_text || ""), c.ordering_type as "WORD_ORDERING" | "SENTENCE_ORDERING").length < 2) return bad("Câu sắp xếp cần ít nhất 2 phần");
    return { ok: true };
  }
  if (category.endsWith("_MATCHING")) {
    const pairs = Array.isArray(c.pairs) ? (c.pairs as Record<string, unknown>[]) : [];
    if (pairs.length < 2 || pairs.some((p) => !String(p?.left || "").trim() || !String(p?.right || "").trim())) return bad("Ghép nối cần ít nhất 2 cặp đủ hai vế");
    return { ok: true };
  }
  if (category === "WRITING_SENTENCE_REWRITE") {
    if (!String(c.original_sentence || "").trim()) return bad("Thiếu câu gốc");
    if (!String(c.correct_answer || "").trim()) return bad("Thiếu đáp án mẫu");
    return { ok: true };
  }
  if (category === "WRITING_ESSAY") {
    if (!(Number(c.min_words) > 0)) return bad("Số từ tối thiểu không hợp lệ");
    return { ok: true };
  }
  if (category === "WRITING_SHORT_ANSWER") {
    if (!Array.isArray(c.sub_questions) || c.sub_questions.length === 0) return bad("Trả lời ngắn không có câu con");
    return { ok: true };
  }
  return { ok: true };
}

/** Dạng giấy hợp lý để giáo viên chọn khi "Đổi dạng" một nhóm. */
export function switchableFormats(raw: RawGroup): PaperFormat[] {
  const out: PaperFormat[] = ["GENERAL_MC"];
  const hasOptions = raw.sub_questions.some((s) => s.options.length >= 2);
  if (raw.stimulus_html) out.push("CLOZE_PASSAGE", "READING_COMPREHENSION");
  if (raw.word_box?.length) out.push("WORD_BOX");
  if (hasOptions) out.push("SENTENCE_BLANK", "SENTENCE_MULTI_BLANK", "SENTENCE_ARRANGEMENT", "WORD_ARRANGEMENT", "PRONUNCIATION", "STRESS", "ERROR_IDENTIFICATION", "SYNONYM_ANTONYM", "SENTENCE_TRANSFORMATION", "DIALOGUE_RESPONSE");
  if (raw.matching || matchingChoices(raw, raw.sub_questions).length >= 2) out.push("MATCHING");
  out.push("REWRITE_WITH_CUE", "ESSAY", "SHORT_ANSWER", "UNSUPPORTED");
  return [...new Set(out)];
}
