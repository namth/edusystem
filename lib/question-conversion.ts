// FEAT-015 — chuyển dạng câu trên giấy (ABCD) sang dạng câu hệ thống (DEC-042 → DEC-046, BR-I01 → BR-I14).
// Hàm THUẦN: không gọi mạng, không đọc DB, chạy được ở cả trình duyệt (Review Studio) và server (ai-parse/ai-import).
// Cùng đầu vào → cùng kết quả. Đặc tả: docs/features/chuyen-doi-dang-cau-nhap-de.md §7.
import { parseFillInGaps, splitOrderingItems } from "./question-content-types";
import { sanitizeInlineHtml, sanitizeStimulusHtml, stripHtml } from "./stimulus-html";

export const CONVERTER_VERSION = 1;

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
  | "DISTRACTORS_DROPPED"
  | "LOW_CONFIDENCE"
  | "AUDIO_MISSING";

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
}

export interface ConvertedQuestion {
  tempId: string;
  skill: string;
  category: string;
  prompt: string;
  stimulus_text: string | null;
  content: Record<string, unknown> & { import_meta: ImportMeta };
}

export type NeedsAiReason = "GAP_NOT_FOUND" | "UNDERLINE_MISSING";

export interface GroupConversion {
  tempId: string;
  questions: ConvertedQuestion[];
  warnings: ConvertWarning[];
  /** Có giá trị → server nên gọi AI lượt 2 cho riêng nhóm này (BR-I09). Câu hỏi trả về vẫn dùng được (dạng tạm). */
  needsAi: NeedsAiReason[];
}

// ── Tiện ích chữ ─────────────────────────────────────────────────────────
const plain = (html: string | null | undefined) => stripHtml(html || "");
const norm = (s: string) => plain(s).toLowerCase().replace(/[.,!?;:"'()]/g, "").replace(/\s+/g, " ").trim();
const hasUnderline = (html: string | null | undefined) => /<u\b[^>]*>/i.test(html || "");
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
      opts[`option_${L.toLowerCase()}`] = o ? sanitizeInlineHtml(o.text_html) : "";
    });
    return {
      id: `${group.tempId}_q${s.number}`,
      number: s.number,
      text: sanitizeInlineHtml(s.text_html) || `Câu ${s.number}`,
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
  const useBank = bank !== null;
  const content: Record<string, unknown> = {
    fill_subtype: useBank ? "OPTION_BANK" : "INLINE_SELECT",
    passage,
    correct_answers: answers,
  };
  if (useBank) content.option_bank = bank;
  else content.inline_options_per_gap = (perGap || []).map((options, gap_index) => ({ gap_index, options }));
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

function convertCloze(group: RawGroup, subs: RawSubQuestion[], idx: number): ConvertedQuestion | "GAP_NOT_FOUND" {
  let text = plain(group.stimulus_html || "");
  if (!text) return "GAP_NOT_FOUND";
  const sorted = [...subs].sort((a, b) => a.number - b.number);
  // 1) thay dấu ô bằng chỗ giữ tạm, theo đúng thứ tự xuất hiện
  let cursor = 0;
  const holders: string[] = [];
  for (const s of sorted) {
    const pos = findGapMarker(text, s.number, cursor);
    if (!pos) return "GAP_NOT_FOUND";
    const holder = `\u0000${holders.length}\u0000`;
    text = text.slice(0, pos[0]) + holder + text.slice(pos[1]);
    cursor = pos[0] + holder.length;
    holders.push(holder);
  }
  // 2) ngoặc vuông gốc → ngoặc tròn; 3) chèn "(n) [đáp án]"
  text = neutralizeBrackets(text);
  const answers = sorted.map((s) => answerText(s) ?? "");
  sorted.forEach((s, i) => {
    text = text.replace(holders[i], `(${s.number}) [${neutralizeBrackets(answers[i]) || "?"}]`);
  });
  const perGap = sorted.map((s) => s.options.map((o) => neutralizeBrackets(plain(o.text_html))));
  if (sorted.length === 1) return fillIn(group, sorted, "CLOZE_PASSAGE", text, answers, perGap[0], null, idx);
  return fillIn(group, sorted, "CLOZE_PASSAGE", text, answers, null, perGap, idx);
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

function convertWordArrangement(group: RawGroup, sub: RawSubQuestion, idx: number): ConvertedQuestion | "FAILED" {
  const correct = optionText(sub, sub.correct_answer);
  if (!correct) return "FAILED";
  const chunks = plain(sub.text_html).split("/").map((c) => c.trim()).filter(Boolean);
  const bag = (s: string) => norm(s).split(" ").filter(Boolean).sort().join(" ");
  if (chunks.length < 2 || bag(chunks.join(" ")) !== bag(correct)) return "FAILED";
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

function convertMatching(group: RawGroup, subs: RawSubQuestion[], idx: number): ConvertedQuestion | "FAILED" {
  const right = group.matching?.right || [];
  const pairs = subs.map((s) => {
    const r = right.find((x) => x.key.toLowerCase() === (s.correct_answer || "").toLowerCase());
    return { id: `${group.tempId}_m${s.number}`, left: plain(s.text_html), right: r ? plain(r.text) : "" };
  });
  if (pairs.length < 2 || pairs.some((p) => !p.left || !p.right)) return "FAILED";
  const used = new Set(subs.map((s) => (s.correct_answer || "").toLowerCase()));
  const extra = right.filter((r) => !used.has(r.key.toLowerCase())).length;
  const warnings = commonWarnings(group, subs);
  if (extra > 0) warnings.unshift({ code: "DISTRACTORS_DROPPED", message: `Bỏ ${extra} phương án nhiễu ở cột phải (dạng ghép nối chưa hỗ trợ phương án thừa).` });
  return {
    tempId: `${group.tempId}_${idx}`,
    skill: group.skill || "Reading",
    category: cat(group.skill, "MATCHING"),
    prompt: group.prompt,
    stimulus_text: group.stimulus_html ? sanitizeStimulusHtml(group.stimulus_html) : null,
    content: { pairs, import_meta: meta("MATCHING", subs, warnings) },
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

function convertShortAnswer(group: RawGroup, subs: RawSubQuestion[], idx: number): ConvertedQuestion {
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
const UNDERLINE_FORMATS: PaperFormat[] = ["PRONUNCIATION", "ERROR_IDENTIFICATION", "SYNONYM_ANTONYM"];
const GROUP_LEVEL: PaperFormat[] = ["CLOZE_PASSAGE", "WORD_BOX", "MATCHING"];

function normalizeFormat(f: unknown): PaperFormat {
  return (PAPER_FORMATS as readonly string[]).includes(String(f)) ? (f as PaperFormat) : "GENERAL_MC";
}

/** Chuyển một nhóm câu gốc. `override` = giáo viên chọn "Đổi dạng" (áp cho cả nhóm). */
export function convertGroup(raw: RawGroup, opts: { override?: PaperFormat } = {}): GroupConversion {
  const subs = raw.sub_questions.map((s) => ({
    ...s,
    options: Array.isArray(s.options) ? s.options : [],
    paper_format: opts.override ?? normalizeFormat(s.paper_format),
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
        if (r === "FAILED") {
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
        } else if (UNDERLINE_FORMATS.includes(format)) {
          const ok = format === "PRONUNCIATION" ? s.options.some((o) => hasUnderline(o.text_html)) : hasUnderline(s.text_html) || s.options.some((o) => hasUnderline(o.text_html));
          if (!ok) {
            needsAi.add("UNDERLINE_MISSING");
            mcRunWarnings.push({ code: "UNDERLINE_MISSING", message: `Câu ${s.number} cần chữ gạch chân nhưng file không giữ được — kiểm lại.`, numbers: [s.number] });
          }
        }
      }
    }
    flushMc();
  }

  for (const q of questions) groupWarnings.push(...q.content.import_meta.warnings);
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
  if (raw.matching) out.push("MATCHING");
  out.push("REWRITE_WITH_CUE", "ESSAY", "SHORT_ANSWER", "UNSUPPORTED");
  return [...new Set(out)];
}
