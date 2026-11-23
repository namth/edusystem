// ======================================================
// QUESTION CONTENT TYPES — Chuẩn hóa schema v2
// Tất cả các loại content JSONB trong bảng questions
// ======================================================

// ── Shared ─────────────────────────────────────────────
/** Câu hỏi con của MC (READING_MC / LISTENING_MC) */
export interface SubQuestion {
  id: string;
  text: string;
  option_a: string;
  option_b: string;
  option_c: string;
  option_d: string;
  /** Dùng để chấm điểm server-side. KHÔNG gửi xuống client khi đang thi. */
  correct_answer?: string;
  /** Link file âm thanh câu hỏi con (cho LISTENING_MC) */
  audio_url?: string | null;
}

/** Cặp ghép nối cho MATCHING */
export interface MatchingPair {
  id: string;
  left: string;
  right: string;
}

/** Options per gap cho INLINE_SELECT */
export interface InlineGapOptions {
  gap_index: number;
  options: string[];
}

// ── 1. READING_MC / LISTENING_MC ───────────────────────
export interface ContentMC {
  /** Chỉ có ở LISTENING — đoạn audio TTS */
  stimulus_audio_text?: string | null;
  stimulus_audio_gender?: "Male" | "Female" | null;
  /** Luôn dùng mảng, kể cả câu hỏi đơn (1 phần tử) */
  sub_questions: SubQuestion[];
}

// ── 2. READING_FILL_IN / LISTENING_FILL_IN ─────────────
export type FillInSubtype = "OPTION_BANK" | "INLINE_SELECT" | "FREE_TYPING";

export interface ContentFillIn {
  stimulus_audio_text?: string | null;
  stimulus_audio_gender?: "Male" | "Female" | null;
  fill_subtype: FillInSubtype;
  /** Đoạn văn với "(n) ..." đánh dấu gap */
  passage: string;
  /** Server-side — đáp án đúng theo thứ tự gap */
  correct_answers?: string[];
  /** Dùng khi fill_subtype = OPTION_BANK */
  option_bank?: string[];
  /** Dùng khi fill_subtype = INLINE_SELECT */
  inline_options_per_gap?: InlineGapOptions[];
}

// ── 3. READING_ORDERING / LISTENING_ORDERING ───────────
export type OrderingType = "WORD_ORDERING" | "SENTENCE_ORDERING";

export interface ContentOrdering {
  stimulus_audio_text?: string | null;
  stimulus_audio_gender?: "Male" | "Female" | null;
  ordering_type: OrderingType;
  /**
   * Chuỗi đáp án đúng.
   * WORD_ORDERING → split theo khoảng trắng.
   * SENTENCE_ORDERING → split theo [.!?].
   * Hệ thống tự xáo trộn khi vào bài thi.
   */
  correct_text: string;
}

// ── 4. READING_MATCHING / LISTENING_MATCHING / WRITING_MATCHING ──
export interface ContentMatching {
  stimulus_audio_text?: string | null;
  stimulus_audio_gender?: "Male" | "Female" | null;
  pairs: MatchingPair[];
}

// ── 5. READING_FLASHCARD_SET / WRITING_FLASHCARD_SET ───
export interface ContentFlashcardSet {
  stimulus_audio_text?: string | null;
  stimulus_audio_gender?: "Male" | "Female" | null;
  /** ID tham chiếu sang bảng flashcards */
  flashcard_ids: string[];
}

// ── 6. WRITING_ESSAY ───────────────────────────────────
export interface ContentWritingEssay {
  min_words: number;
  task_type: "Task 1" | "Task 2";
}

// ── 7. WRITING_FREE_TYPING_BLANKS ──────────────────────
export interface ContentFreeTypingBlanks {
  /** Đoạn văn chứa từ trong ngoặc "(từ_đáp_án)" để học sinh tự gõ */
  passage: string;
}

export interface ShortAnswerSubQuestion {
  id: string;
  text: string;
  max_words: number;
  sample_answer?: string;
}

// ── 8. WRITING_SHORT_ANSWER ────────────────────────────
export interface ContentShortAnswer {
  sub_questions: ShortAnswerSubQuestion[];
}

// ── 9. WRITING_SENTENCE_REWRITE ────────────────────────
export interface ContentSentenceRewrite {
  original_sentence: string;
  starting_cue: string;
  /** Dùng để chấm điểm */
  correct_answer?: string;
}

// ── 10. SPEAKING_TOPIC_PROMPT ──────────────────────────
export interface ContentSpeakingTopicPrompt {
  prep_time_seconds: number;
  speaking_time_seconds: number;
  topic_hints?: string[];
}

// ── 11. SPEAKING_READ_ALOUD ────────────────────────────
export interface ContentSpeakingReadAloud {
  read_aloud_text: string;
}

// ── Union type & category map ──────────────────────────

export type QuestionCategory =
  | "READING_MC"
  | "LISTENING_MC"
  | "READING_FILL_IN"
  | "LISTENING_FILL_IN"
  | "READING_ORDERING"
  | "LISTENING_ORDERING"
  | "READING_MATCHING"
  | "LISTENING_MATCHING"
  | "WRITING_MATCHING"
  | "READING_FLASHCARD_SET"
  | "WRITING_FLASHCARD_SET"
  | "WRITING_ESSAY"
  | "WRITING_FREE_TYPING_BLANKS"
  | "WRITING_SHORT_ANSWER"
  | "WRITING_SENTENCE_REWRITE"
  | "SPEAKING_TOPIC_PROMPT"
  | "SPEAKING_READ_ALOUD";

/** Union của tất cả content types */
export type QuestionContent =
  | ContentMC
  | ContentFillIn
  | ContentOrdering
  | ContentMatching
  | ContentFlashcardSet
  | ContentWritingEssay
  | ContentFreeTypingBlanks
  | ContentShortAnswer
  | ContentSentenceRewrite
  | ContentSpeakingTopicPrompt
  | ContentSpeakingReadAloud;

/** Map category → content type */
export interface CategoryContentMap {
  READING_MC: ContentMC;
  LISTENING_MC: ContentMC;
  READING_FILL_IN: ContentFillIn;
  LISTENING_FILL_IN: ContentFillIn;
  READING_ORDERING: ContentOrdering;
  LISTENING_ORDERING: ContentOrdering;
  READING_MATCHING: ContentMatching;
  LISTENING_MATCHING: ContentMatching;
  WRITING_MATCHING: ContentMatching;
  READING_FLASHCARD_SET: ContentFlashcardSet;
  WRITING_FLASHCARD_SET: ContentFlashcardSet;
  WRITING_ESSAY: ContentWritingEssay;
  WRITING_FREE_TYPING_BLANKS: ContentFreeTypingBlanks;
  WRITING_SHORT_ANSWER: ContentShortAnswer;
  WRITING_SENTENCE_REWRITE: ContentSentenceRewrite;
  SPEAKING_TOPIC_PROMPT: ContentSpeakingTopicPrompt;
  SPEAKING_READ_ALOUD: ContentSpeakingReadAloud;
}

/** DBQuestion với content typed theo category */
export interface DBQuestion<C extends QuestionCategory = QuestionCategory> {
  id: string;
  skill: "Reading" | "Listening" | "Writing" | "Speaking";
  category: C;
  prompt?: string;
  content: CategoryContentMap[C];
  number?: number;
  created_at?: string;
}

// ── Runtime helpers ────────────────────────────────────

/**
 * Parse passage text "(answer) ..." thành parts và gaps.
 * Gap format: (text) — text bên trong là đáp án gốc.
 */
export function parseFillInPassage(passage: string): {
  parts: string[];
  gaps: string[];
} {
  const parts: string[] = [];
  const gaps: string[] = [];
  const regex = /\(([^)]+)\)/g;
  let lastIdx = 0;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(passage)) !== null) {
    parts.push(passage.slice(lastIdx, match.index));
    gaps.push(match[1]);
    lastIdx = match.index + match[0].length;
  }
  parts.push(passage.slice(lastIdx));
  return { parts, gaps };
}

/**
 * Break correct_text thành mảng items xáo trộn theo ordering_type.
 * WORD_ORDERING → split by whitespace.
 * SENTENCE_ORDERING → split by sentence boundary [.!?].
 */
export function splitOrderingItems(
  correctText: string,
  orderingType: OrderingType
): string[] {
  if (orderingType === "WORD_ORDERING") {
    // FEAT-017: "People thought / the story / was written" → giữ cụm từ (dấu / có khoảng trắng; "and/or" không tách)
    if (/\s\/|\/\s/.test(correctText)) {
      return correctText.split(/\s+\/\s*|\s*\/\s+/).map((s) => s.trim()).filter(Boolean);
    }
    return correctText.split(/\s+/).filter(Boolean);
  }
  return correctText
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * Shuffle array (Fisher-Yates).
 */
export function shuffleArray<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * Detect YouTube video links vs direct Audio URLs.
 */
export function getMediaStimulusInfo(url?: string | null): {
  type: "NONE" | "YOUTUBE" | "AUDIO";
  embedUrl?: string;
  rawUrl?: string;
} {
  if (!url || !url.trim()) return { type: "NONE" };
  const trimmed = url.trim();

  const ytMatch = trimmed.match(/(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?|shorts)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/i);
  if (ytMatch && ytMatch[1]) {
    return {
      type: "YOUTUBE",
      embedUrl: `https://www.youtube.com/embed/${ytMatch[1]}`,
      rawUrl: trimmed,
    };
  }

  return {
    type: "AUDIO",
    rawUrl: trimmed,
  };
}

/**
 * Extracts starting cue word from bracket notation e.g. "[Unless] you collaborate..."
 */
export function parseSentenceRewriteCue(correctAnswer?: string | null): {
  cue: string;
  cleanAnswer: string;
} {
  if (!correctAnswer || !correctAnswer.trim()) return { cue: "", cleanAnswer: "" };

  const trimmed = correctAnswer.trim();
  const match = trimmed.match(/\[(.*?)\]/);
  if (match && match[1]) {
    const cue = match[1].trim();
    const cleanAnswer = trimmed.replace(/\[(.*?)\]/, "$1").trim();
    return { cue, cleanAnswer };
  }

  return { cue: "", cleanAnswer: trimmed };
}

/**
 * Normalize and evaluate Sentence Rewrite answer with bracket cue handling.
 */
export function normalizeSentenceRewriteAnswer(
  studentInput: string,
  correctAnswer: string = ""
): {
  normalizedStudent: string;
  isCorrect: boolean;
} {
  const cleanInput = (studentInput || "").trim();
  const { cue, cleanAnswer } = parseSentenceRewriteCue(correctAnswer);

  if (!cleanInput) {
    return { normalizedStudent: "", isCorrect: false };
  }

  let fullStudent = cleanInput;
  if (cue && !cleanInput.toLowerCase().startsWith(cue.toLowerCase())) {
    fullStudent = `${cue} ${cleanInput}`;
  }

  const normFullStudent = fullStudent.toLowerCase().replace(/\s+/g, " ").replace(/[.,!?]+$/, "");
  const normCleanAnswer = cleanAnswer.toLowerCase().replace(/\s+/g, " ").replace(/[.,!?]+$/, "");

  const isCorrect = normFullStudent === normCleanAnswer;
  return { normalizedStudent: fullStudent, isCorrect };
}

/**
 * Parses passage text containing [gap_word] or (gap_word) markers into text parts and gap answers.
 * Example: "AI is [slowly] transforming..." -> parts: ["AI is ", " transforming..."], gaps: ["slowly"]
 */
export function parseFillInGaps(rawText: string): { parts: string[]; gaps: string[] } {
  if (!rawText) return { parts: [""], gaps: [] };

  const hasBrackets = /\[(.*?)\]/.test(rawText);
  const regex = hasBrackets ? /\[(.*?)\]/g : /\((.*?)\)/g;
  const parts: string[] = [];
  const gaps: string[] = [];

  let lastIndex = 0;
  let match;

  while ((match = regex.exec(rawText)) !== null) {
    parts.push(rawText.substring(lastIndex, match.index));
    gaps.push(match[1].trim());
    lastIndex = regex.lastIndex;
  }

  parts.push(rawText.substring(lastIndex));
  return { parts, gaps };
}

export function parseParentheses(rawText: string): { parsedText: string; answers: string[] } {
  const { parts, gaps } = parseFillInGaps(rawText);
  const parsedText = parts.reduce((acc, part, idx) => {
    if (idx < gaps.length) {
      return acc + part + `[${gaps[idx]}]`;
    }
    return acc + part;
  }, "");
  return { parsedText, answers: gaps };
}

/**
 * Standardizes question content JSONB object per docs/archive/SYSTEM_ARCHITECTURE.md (tài liệu cũ; chuẩn hiện tại: docs/06)
 */
export function buildStandardQuestionContent(q: any): any {
  const category = q.category;
  const sAudio = q.stimulus_audio_url || q.stimulusAudioUrl;
  const sText = q.stimulus_text || q.stimulusText;
  const explicitType = q.stimulus_type || q.stimulusType;

  let stimulus_type = "TEXT_ONLY";
  if (explicitType === "AUDIO_ONLY" || explicitType === "COMBINED" || explicitType === "TEXT_ONLY") {
    stimulus_type = explicitType;
  } else if (sAudio && sText) {
    stimulus_type = "COMBINED";
  } else if (sAudio) {
    stimulus_type = "AUDIO_ONLY";
  }

  let result: any = { stimulus_type };

  switch (category) {
    case "READING_MC":
    case "LISTENING_MC": {
      // FEAT-017 (BR-P12): một ý một bản ghi — content phẳng { text, option_a…d, correct_answer }
      if (!Array.isArray(q.sub_questions) && !Array.isArray(q.subQuestions)) {
        result.text = q.text ?? q.subQuestionText ?? "";
        result.option_a = q.option_a ?? q.optA ?? "";
        result.option_b = q.option_b ?? q.optB ?? "";
        result.option_c = q.option_c ?? q.optC ?? "";
        result.option_d = q.option_d ?? q.optD ?? "";
        result.correct_answer = mcAnswerLetter(q);
        result.audio_url = q.audio_url || q.audioUrl || null;
        break;
      }
      const rawSub = q.sub_questions || q.subQuestions || [];
      const subQuestions = rawSub.map((sq: any, i: number) => {
        const out: any = {
          id: sq.id || `sub_${Date.now()}_${i}`,
          text: sq.text ?? sq.subQuestionText ?? "",
          option_a: sq.option_a ?? sq.optA ?? "",
          option_b: sq.option_b ?? sq.optB ?? "",
          option_c: sq.option_c ?? sq.optC ?? "",
          option_d: sq.option_d ?? sq.optD ?? "",
          // Màn thi gửi chữ cái A–D → đáp án luôn lưu dạng chữ cái (BR-I24)
          correct_answer: mcAnswerLetter(sq),
          audio_url: sq.audio_url || sq.audioUrl || null,
        };
        if (Number(sq.number) > 0) out.number = Number(sq.number);
        return out;
      });

      result.sub_questions = subQuestions;
      break;
    }

    case "READING_FILL_IN":
    case "LISTENING_FILL_IN": {
      Object.assign(result, standardFillIn(q));
      break;
    }

    case "READING_ORDERING":
    case "LISTENING_ORDERING": {
      const correctText = q.correct_text || (Array.isArray(q.items) ? q.items.join(". ") : q.items) || "";
      result.ordering_type = q.ordering_type || q.orderingType || "SENTENCE_ORDERING";
      result.correct_text = correctText;
      break;
    }

    case "READING_MATCHING":
    case "LISTENING_MATCHING":
    case "WRITING_MATCHING": {
      result.pairs = (q.pairs || []).map((p: any) => ({
        id: p.id || `mp_${Date.now()}`,
        left: p.left || "",
        right: p.right || "",
      }));
      break;
    }

    case "READING_FLASHCARD_SET":
    case "WRITING_FLASHCARD_SET": {
      const flashcardIds = q.flashcard_ids || q.flashcardIds || (q.flashcards ? q.flashcards.map((fc: any) => fc.id) : []);
      result.flashcard_ids = flashcardIds;
      break;
    }

    case "WRITING_SHORT_ANSWER": {
      // FEAT-017 (BR-P12): một ý một bản ghi — { text, max_words, sample_answer? }
      if (!Array.isArray(q.sub_questions) && !Array.isArray(q.subQuestions)) {
        result.text = q.text ?? q.questionText ?? "";
        result.max_words = Number(q.max_words || q.maxWords) || 50;
        const sample = q.sample_answer ?? q.sampleAnswer;
        if (sample) result.sample_answer = sample;
        break;
      }
      const rawSub = q.sub_questions || q.subQuestions || [];
      const subQuestions = rawSub.map((sa: any) => ({
        id: sa.id || `sa_${Date.now()}`,
        text: sa.text || sa.questionText || "",
        max_words: Number(sa.max_words || sa.maxWords) || 50,
        ...((sa.sample_answer ?? sa.sampleAnswer) ? { sample_answer: sa.sample_answer ?? sa.sampleAnswer } : {}),
      }));
      result.sub_questions = subQuestions;
      break;
    }

    case "WRITING_ESSAY": {
      result.min_words = Number(q.min_words || q.minWords) || 250;
      if (q.task_type || q.taskType) result.task_type = q.task_type || q.taskType;
      result.rubric = q.rubric || "Task Achievement (25%), Coherence & Cohesion (25%), Lexical Resource (25%), Grammatical Range (25%)";
      break;
    }

    case "WRITING_FREE_TYPING_BLANKS": {
      result.passage = q.passage || q.parenthesesRawText || "";
      break;
    }

    case "WRITING_SENTENCE_REWRITE": {
      // Một câu = một mục chấm (grading đọc trường phẳng); trình sửa cũ gửi sub_questions → lấy câu đầu
      const first = (Array.isArray(q.sub_questions) ? q.sub_questions : Array.isArray(q.subQuestions) ? q.subQuestions : [])[0] || {};
      result.original_sentence = q.original_sentence || q.originalSentence || first.original_sentence || first.originalSentence || "";
      result.correct_answer = q.correct_answer || q.correctAnswer || first.correct_answer || first.correctAnswer || "";
      result.starting_cue = q.starting_cue || q.startingCue || parseSentenceRewriteCue(result.correct_answer).cue || "";
      break;
    }

    case "SPEAKING_TOPIC_PROMPT": {
      result.prep_time_seconds = Number(q.prep_time_seconds || q.prepTimeSeconds) || 60;
      result.record_time_seconds = Number(q.record_time_seconds || q.recordTimeSeconds) || 120;
      break;
    }

    case "SPEAKING_READ_ALOUD": {
      result.passage = q.passage || q.readAloudPassage || "";
      break;
    }

    default:
      result = { ...result, ...(q.content || {}) };
      break;
  }

  // Giữ dấu vết nhập đề AI (FEAT-015) khi giáo viên sửa câu
  if (q.import_meta && typeof q.import_meta === "object") result.import_meta = q.import_meta;
  return result;
}

const normOpt = (s: unknown) =>
  String(s ?? "").replace(/<[^>]*>/g, "").replace(/&nbsp;/gi, " ").toLowerCase().replace(/\s+/g, " ").trim();

/** Đáp án câu con trắc nghiệm → chữ cái A–D. Chấp nhận chữ cái, hoặc nội dung phương án (dữ liệu trình sửa cũ). */
export function mcAnswerLetter(sq: any): string | null {
  const opts: Record<string, unknown> = {
    A: sq.option_a ?? sq.optA,
    B: sq.option_b ?? sq.optB,
    C: sq.option_c ?? sq.optC,
    D: sq.option_d ?? sq.optD,
  };
  for (const v of [sq.correctAnswer, sq.correct_answer]) {
    const t = String(v ?? "").trim();
    if (!t) continue;
    if (/^[A-D]$/i.test(t)) return t.toUpperCase();
    const hit = Object.keys(opts).find((k) => normOpt(opts[k]) && normOpt(opts[k]) === normOpt(t));
    if (hit) return hit;
  }
  return null;
}

/**
 * Chuẩn hoá câu điền ô (BR-I24): đoạn văn là nguồn đáp án duy nhất (correct_answers suy từ [..]);
 * INLINE_SELECT luôn lưu inline_options_per_gap (trình sửa cũ lưu option_banks — màn thi không đọc);
 * mỗi ô/kho từ luôn chứa đáp án đúng.
 */
export function standardFillIn(q: any): Record<string, unknown> {
  const passage: string = q.passage || q.parenthesesRawText || "";
  const answers = parseFillInGaps(passage).gaps;
  const subtypeRaw = String(q.fill_subtype || q.fillInSubtype || "OPTION_BANK");
  const fill_subtype = ["OPTION_BANK", "INLINE_SELECT", "FREE_TYPING"].includes(subtypeRaw) ? subtypeRaw : "OPTION_BANK";
  const out: Record<string, unknown> = { passage, fill_subtype, correct_answers: answers };
  const uniq = (xs: string[]) => {
    const seen = new Set<string>();
    return xs.map((x) => String(x ?? "").trim()).filter((x) => x && !seen.has(normOpt(x)) && seen.add(normOpt(x)));
  };
  if (fill_subtype === "OPTION_BANK") {
    const bank: string[] = Array.isArray(q.option_bank) ? q.option_bank : Array.isArray(q.optionBank) ? q.optionBank : [];
    out.option_bank = uniq([...bank, ...answers]);
  } else if (fill_subtype === "INLINE_SELECT") {
    const per: any[] = Array.isArray(q.inline_options_per_gap)
      ? q.inline_options_per_gap
      : Array.isArray(q.option_banks)
      ? q.option_banks
      : Array.isArray(q.optionBanks)
      ? q.optionBanks
      : [];
    out.inline_options_per_gap = answers.map((ans, gap_index) => {
      const g = per.find((p) => p && Number(p.gap_index) === gap_index);
      return { gap_index, options: uniq([...(g && Array.isArray(g.options) ? g.options : []), ans]) };
    });
  }
  return out;
}


