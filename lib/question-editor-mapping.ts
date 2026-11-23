// Chuyển qua lại giữa content JSONB của câu hỏi (docs/06) và state của trình sửa QuestionSetEditor (BR-I24).
// Hàm THUẦN — dùng chung cho câu tạo tay và câu AI nhập đề (FEAT-015), để mở "Sửa" luôn thấy đủ trường.
import { mcAnswerLetter, parseFillInGaps, parseSentenceRewriteCue } from "./question-content-types";

/** Câu hỏi / content dạng JSON lỏng (dữ liệu DB, state cũ của trình sửa). */
export type Rec = Record<string, unknown>;
const recs = (v: unknown): Rec[] => (Array.isArray(v) ? (v.filter((x) => x && typeof x === "object") as Rec[]) : []);
const firstArray = (...vs: unknown[]): unknown[] | null => vs.find((v) => Array.isArray(v)) as unknown[] | null ?? null;

/** HTML → chữ trơn (trình sửa dùng ô nhập chữ thường, không hiện thẻ). */
export function plainText(s: unknown): string {
  return String(s ?? "")
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/[ \t]+/g, " ")
    .trim();
}

export interface EditorMcSub {
  id: string;
  /** Số câu trên đề giấy (câu nhập AI) — giữ lại để màn thi hiện đúng số. */
  number?: number;
  subQuestionText: string;
  audioSource?: "TTS" | "UPLOAD" | "NONE";
  audioText?: string;
  audioVoice?: string;
  audioUrl?: string;
  optA: string;
  optB: string;
  optC: string;
  optD: string;
  correctAnswer: "A" | "B" | "C" | "D";
}

/** sub_questions (DB) hoặc subQuestions (state cũ) → câu con trình sửa. */
export function editorMcSubs(raw: unknown): EditorMcSub[] {
  if (!Array.isArray(raw)) return [];
  return recs(raw).map((sq, i) => {
    const letter = (mcAnswerLetter(sq) || "A") as EditorMcSub["correctAnswer"];
    const audioUrl = String(sq.audioUrl || sq.audio_url || "");
    const out: EditorMcSub = {
      id: String(sq.id || `subq_${Date.now()}_${i}`),
      subQuestionText: plainText(sq.subQuestionText ?? sq.text),
      optA: plainText(sq.optA ?? sq.option_a),
      optB: plainText(sq.optB ?? sq.option_b),
      optC: plainText(sq.optC ?? sq.option_c),
      optD: plainText(sq.optD ?? sq.option_d),
      correctAnswer: letter,
      audioSource: (sq.audioSource as EditorMcSub["audioSource"]) || (audioUrl ? "UPLOAD" : "NONE"),
      audioText: typeof sq.audioText === "string" ? sq.audioText : undefined,
      audioVoice: typeof sq.audioVoice === "string" ? sq.audioVoice : undefined,
      audioUrl: audioUrl || undefined,
    };
    if (Number(sq.number) > 0) out.number = Number(sq.number);
    return out;
  });
}

/** Câu con trình sửa → sub_questions chuẩn (đáp án chữ cái A–D). */
export function mcSubsToContent(subs: EditorMcSub[]) {
  return subs.map((sq) => ({
    id: sq.id,
    ...(sq.number ? { number: sq.number } : {}),
    text: sq.subQuestionText,
    option_a: sq.optA,
    option_b: sq.optB,
    option_c: sq.optC,
    option_d: sq.optD,
    correct_answer: sq.correctAnswer,
    audio_url: sq.audioUrl || null,
  }));
}

export type EditorFillSubtype = "OPTION_BANK" | "INLINE_SELECT" | "FREE_TYPING";

export interface EditorFillIn {
  passage: string;
  subtype: EditorFillSubtype;
  bank: string[];
  /** Từ nhiễu từng ô (chuỗi cách nhau dấu phẩy), theo chỉ số ô. */
  distractors: Record<number, string>;
}

/** content câu điền ô → state trình sửa. Đọc cả inline_options_per_gap (chuẩn) lẫn option_banks (trình sửa cũ). */
export function editorFillIn(q: Rec): EditorFillIn {
  const passage = String(q.passage ?? q.parenthesesRawText ?? "");
  const raw = String(q.fill_subtype || q.fillInSubtype || "OPTION_BANK");
  const subtype: EditorFillSubtype = raw === "INLINE_SELECT" || raw === "FREE_TYPING" ? raw : "OPTION_BANK";
  const bank = firstArray(q.option_bank, q.optionBank) || [];
  const per = recs(firstArray(q.inline_options_per_gap, q.option_banks, q.optionBanks));
  const gaps = parseFillInGaps(passage).gaps;
  const distractors: Record<number, string> = {};
  for (const g of per) {
    const idx = Number(g?.gap_index);
    if (!Number.isInteger(idx) || idx < 0) continue;
    const correct = String(gaps[idx] ?? "").trim().toLowerCase();
    const opts: string[] = Array.isArray(g.options) ? g.options.map((o: unknown) => String(o ?? "").trim()).filter(Boolean) : [];
    distractors[idx] = opts.filter((o) => o.toLowerCase() !== correct).join(", ");
  }
  return { passage, subtype, bank: bank.map((w) => String(w)), distractors };
}

const splitList = (s: string) =>
  String(s || "")
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);

/** Đoạn văn + từ nhiễu từng ô → inline_options_per_gap (đáp án đúng luôn có trong danh sách). */
export function inlineOptionsFromEditor(passage: string, distractors: Record<number, string>) {
  return parseFillInGaps(passage).gaps.map((correct, gap_index) => {
    const seen = new Set<string>();
    const options = [correct, ...splitList(distractors[gap_index] || "")].filter((o) => {
      const k = o.toLowerCase();
      if (!o || seen.has(k)) return false;
      seen.add(k);
      return true;
    });
    return { gap_index, options };
  });
}

/** content câu sắp xếp → state trình sửa. */
export function editorOrdering(q: Rec): { type: "SENTENCE_ORDERING" | "WORD_ORDERING"; text: string } {
  const type = (q.ordering_type || q.orderingType) === "WORD_ORDERING" ? "WORD_ORDERING" : "SENTENCE_ORDERING";
  const items = (firstArray(q.items) || []).map((x) => String(x));
  const text = String(q.correct_text || q.correctText || items.join(" ") || "");
  return { type, text };
}

export interface EditorRewriteSub {
  id: string;
  originalSentence: string;
  correctAnswer: string;
}

/** Viết lại câu: content phẳng (chuẩn) hoặc sub_questions (trình sửa cũ) → danh sách câu con. Gợi ý đặt trong [..]. */
export function editorRewriteSubs(q: Rec): EditorRewriteSub[] {
  const rawSub = recs(firstArray(q.subQuestions, q.sub_questions));
  if (rawSub.length > 0) {
    return rawSub.map((sr, i) => ({
      id: String(sr.id || `sr_${Date.now()}_${i}`),
      originalSentence: String(sr.original_sentence ?? sr.originalSentence ?? ""),
      correctAnswer: String(sr.correct_answer ?? sr.correctAnswer ?? ""),
    }));
  }
  const orig = String(q.original_sentence ?? q.originalSentence ?? "");
  if (!orig) return [];
  const cue = String(q.starting_cue ?? q.startingCue ?? "").replace(/\.+$/, "").trim();
  let ans = String(q.correct_answer ?? q.correctAnswer ?? "");
  if (cue && !parseSentenceRewriteCue(ans).cue) {
    ans = ans.toLowerCase().startsWith(cue.toLowerCase()) ? `[${ans.slice(0, cue.length)}]${ans.slice(cue.length)}` : `[${cue}] ${ans}`;
  }
  return [{ id: `sr_${Date.now()}`, originalSentence: orig, correctAnswer: ans }];
}

export interface EditorShortAnswer {
  id: string;
  questionText: string;
  maxWords: number;
  sampleAnswer?: string;
}

export function editorShortAnswers(q: Rec): EditorShortAnswer[] {
  return recs(firstArray(q.subQuestions, q.sub_questions)).map((sa, i) => ({
    id: String(sa.id || `sa_${Date.now()}_${i}`),
    questionText: plainText(sa.questionText ?? sa.text ?? sa.question_text),
    maxWords: Number(sa.maxWords ?? sa.max_words) || 50,
    sampleAnswer: typeof (sa.sampleAnswer ?? sa.sample_answer) === "string" ? String(sa.sampleAnswer ?? sa.sample_answer) : undefined,
  }));
}
