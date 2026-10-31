import {
  parseFillInGaps,
  splitOrderingItems,
  parseSentenceRewriteCue,
  normalizeSentenceRewriteAnswer,
} from "./question-content-types";

export type GradeKind = "OBJECTIVE" | "AI" | "UNSUPPORTED";

export interface GradableQuestion {
  id: string;
  category: string;
  content: any;
  prompt?: string;
  skill?: string;
  [k: string]: unknown;
}

export interface GradeItem {
  key: string;
  correct: boolean;
  given: unknown;
  expected: unknown;
}

export interface GradeResult {
  question_id: string;
  category: string;
  kind: GradeKind;
  earned: number;
  max: number;
  items: GradeItem[];
}

export interface FlashcardRow {
  id: string;
  vietnamese_name?: string;
  correct_english_word: string;
  options?: string[];
  image_url?: string | null;
  audio_url?: string | null;
}

function normalizeString(val: unknown): string {
  return String(val ?? "").trim().replace(/\s+/g, " ").toLowerCase();
}

function sortStrings(arr: string[]): string[] {
  return [...arr].sort((a, b) => a.localeCompare(b, "en", { sensitivity: "base" }));
}

export interface GradeQuestionOptions {
  speaking?: "AI" | "UNSUPPORTED";
}

export function gradeQuestion(
  q: GradableQuestion,
  answer: unknown,
  flashcards?: Record<string, FlashcardRow>,
  options?: { speaking?: "AI" | "UNSUPPORTED" }
): GradeResult {
  const category = q.category || "";
  const content = q.content || {};

  if (options?.speaking === "AI" && category.startsWith("SPEAKING_")) {
    return {
      question_id: q.id,
      category: q.category,
      kind: "AI",
      earned: 0,
      max: 1,
      items: [
        {
          key: "speaking",
          correct: false,
          given: answer,
          expected: null,
        },
      ],
    };
  }

  // 1. *_MC
  if (category.endsWith("_MC")) {
    const subQuestions: any[] = Array.isArray(content.sub_questions) ? content.sub_questions : [];
    const answerObj =
      typeof answer === "object" && answer !== null && !Array.isArray(answer)
        ? (answer as Record<string, unknown>)
        : null;

    const items: GradeItem[] = subQuestions.map((sub) => {
      const key = String(sub.id);
      const expected = sub.correct_answer ? String(sub.correct_answer).toUpperCase() : "";
      const given = answerObj ? answerObj[key] : undefined;
      const correct = typeof given === "string" && normalizeString(given) === normalizeString(expected);

      return {
        key,
        correct,
        given,
        expected,
      };
    });

    const earned = items.filter((i) => i.correct).length;
    return {
      question_id: q.id,
      category: q.category,
      kind: "OBJECTIVE",
      earned,
      max: subQuestions.length,
      items,
    };
  }

  // 2. *_FILL_IN
  if (category.endsWith("_FILL_IN")) {
    const expectedGaps: string[] =
      Array.isArray(content.correct_answers) && content.correct_answers.length > 0
        ? content.correct_answers
        : parseFillInGaps(content.passage || "").gaps;

    const items: GradeItem[] = expectedGaps.map((expected, idx) => {
      const key = `gap_${idx}`;
      const given = Array.isArray(answer) && idx < answer.length ? answer[idx] : undefined;
      const correct = typeof given === "string" && normalizeString(given) === normalizeString(expected);

      return {
        key,
        correct,
        given,
        expected,
      };
    });

    const earned = items.filter((i) => i.correct).length;
    return {
      question_id: q.id,
      category: q.category,
      kind: "OBJECTIVE",
      earned,
      max: expectedGaps.length,
      items,
    };
  }

  // 3. *_ORDERING
  if (category.endsWith("_ORDERING")) {
    const expectedItems = splitOrderingItems(content.correct_text || "", content.ordering_type);
    const isGivenArray = Array.isArray(answer);
    const correct =
      isGivenArray &&
      answer.length === expectedItems.length &&
      answer.every(
        (val, i) => typeof val === "string" && normalizeString(val) === normalizeString(expectedItems[i])
      );

    const items: GradeItem[] = [
      {
        key: "order",
        correct,
        given: answer,
        expected: expectedItems,
      },
    ];

    return {
      question_id: q.id,
      category: q.category,
      kind: "OBJECTIVE",
      earned: correct ? 1 : 0,
      max: 1,
      items,
    };
  }

  // 4. *_MATCHING
  if (category.endsWith("_MATCHING")) {
    const pairs: Array<{ id: string; left: string; right: string }> = Array.isArray(content.pairs)
      ? content.pairs
      : [];
    const answerObj =
      typeof answer === "object" && answer !== null && !Array.isArray(answer)
        ? (answer as Record<string, unknown>)
        : null;

    const items: GradeItem[] = pairs.map((pair) => {
      const key = String(pair.id);
      const expected = pair.right;
      const given = answerObj ? answerObj[key] : undefined;
      const correct = typeof given === "string" && normalizeString(given) === normalizeString(expected);

      return {
        key,
        correct,
        given,
        expected,
      };
    });

    const earned = items.filter((i) => i.correct).length;
    return {
      question_id: q.id,
      category: q.category,
      kind: "OBJECTIVE",
      earned,
      max: pairs.length,
      items,
    };
  }

  // 5. *_FLASHCARD_SET
  if (category.endsWith("_FLASHCARD_SET")) {
    const flashcardIds: string[] = Array.isArray(content.flashcard_ids) ? content.flashcard_ids : [];
    const answerObj =
      typeof answer === "object" && answer !== null && !Array.isArray(answer)
        ? (answer as Record<string, unknown>)
        : null;

    const items: GradeItem[] = [];
    for (const fcId of flashcardIds) {
      const card = flashcards ? flashcards[fcId] : undefined;
      if (!card) continue;

      const expected = card.correct_english_word;
      const given = answerObj ? answerObj[fcId] : undefined;
      const correct = typeof given === "string" && normalizeString(given) === normalizeString(expected);

      items.push({
        key: fcId,
        correct,
        given,
        expected,
      });
    }

    const earned = items.filter((i) => i.correct).length;
    return {
      question_id: q.id,
      category: q.category,
      kind: "OBJECTIVE",
      earned,
      max: items.length,
      items,
    };
  }

  // 6. WRITING_FREE_TYPING_BLANKS
  if (category === "WRITING_FREE_TYPING_BLANKS") {
    const gaps = parseFillInGaps(content.passage || "").gaps;
    const items: GradeItem[] = gaps.map((expected, idx) => {
      const key = `gap_${idx}`;
      const given = Array.isArray(answer) && idx < answer.length ? answer[idx] : undefined;
      const correct = typeof given === "string" && normalizeString(given) === normalizeString(expected);

      return {
        key,
        correct,
        given,
        expected,
      };
    });

    const earned = items.filter((i) => i.correct).length;
    return {
      question_id: q.id,
      category: q.category,
      kind: "OBJECTIVE",
      earned,
      max: gaps.length,
      items,
    };
  }

  // 7. WRITING_SENTENCE_REWRITE
  if (category === "WRITING_SENTENCE_REWRITE") {
    const correctAnswer = content.correct_answer || "";
    const studentInput = typeof answer === "string" ? answer : "";
    const evalResult = normalizeSentenceRewriteAnswer(studentInput, correctAnswer);
    const { cleanAnswer } = parseSentenceRewriteCue(correctAnswer);
    const correct = typeof answer === "string" && evalResult.isCorrect;

    const items: GradeItem[] = [
      {
        key: "rewrite",
        correct,
        given: answer,
        expected: cleanAnswer,
      },
    ];

    return {
      question_id: q.id,
      category: q.category,
      kind: "OBJECTIVE",
      earned: correct ? 1 : 0,
      max: 1,
      items,
    };
  }

  // 8. WRITING_ESSAY
  if (category === "WRITING_ESSAY") {
    const items: GradeItem[] = [
      {
        key: "essay",
        correct: false,
        given: answer,
        expected: null,
      },
    ];

    return {
      question_id: q.id,
      category: q.category,
      kind: "AI",
      earned: 0,
      max: 1,
      items,
    };
  }

  // 9. WRITING_SHORT_ANSWER
  if (category === "WRITING_SHORT_ANSWER") {
    const subQuestions: any[] = Array.isArray(content.sub_questions) ? content.sub_questions : [];
    const answerObj =
      typeof answer === "object" && answer !== null && !Array.isArray(answer)
        ? (answer as Record<string, unknown>)
        : null;

    const items: GradeItem[] = subQuestions.map((sub) => ({
      key: String(sub.id),
      correct: false,
      given: answerObj ? answerObj[sub.id] : undefined,
      expected: null,
    }));

    return {
      question_id: q.id,
      category: q.category,
      kind: "AI",
      earned: 0,
      max: subQuestions.length,
      items,
    };
  }

  // 10. SPEAKING_* / other unsupported categories
  return {
    question_id: q.id,
    category: q.category,
    kind: "UNSUPPORTED",
    earned: 0,
    max: 0,
    items: [],
  };
}

function sanitizeByCategory(q: GradableQuestion): GradableQuestion {
  const cloned: GradableQuestion = { ...q };
  if (!q.content) return cloned;

  const category = q.category || "";

  if (category.endsWith("_MC")) {
    const content = { ...q.content };
    if (Array.isArray(content.sub_questions)) {
      content.sub_questions = content.sub_questions.map((sub: any) => {
        const { correct_answer, ...rest } = sub;
        return rest;
      });
    }
    cloned.content = content;
    return cloned;
  }

  if (category.endsWith("_FILL_IN")) {
    const content = { ...q.content };
    const passage = content.passage || "";
    const { parts, gaps } = parseFillInGaps(passage);
    delete content.correct_answers;
    delete content.passage;
    content.passage_parts = parts;
    content.gap_count = gaps.length;

    if (Array.isArray(content.option_bank)) {
      content.option_bank = sortStrings(content.option_bank);
    }
    if (Array.isArray(content.inline_options_per_gap)) {
      content.inline_options_per_gap = content.inline_options_per_gap.map((item: any) => ({
        ...item,
        options: Array.isArray(item.options) ? sortStrings(item.options) : [],
      }));
    }
    cloned.content = content;
    return cloned;
  }

  if (category.endsWith("_ORDERING")) {
    const content = { ...q.content };
    const correctText = content.correct_text || "";
    const orderingType = content.ordering_type;
    const items = splitOrderingItems(correctText, orderingType);
    delete content.correct_text;
    content.items = sortStrings(items);
    cloned.content = content;
    return cloned;
  }

  if (category.endsWith("_MATCHING")) {
    const content = { ...q.content };
    const pairs: any[] = Array.isArray(content.pairs) ? content.pairs : [];
    delete content.pairs;
    content.left = pairs.map((p: any) => ({ id: p.id, text: p.left }));
    content.right = sortStrings(pairs.map((p: any) => p.right));
    cloned.content = content;
    return cloned;
  }

  if (category === "WRITING_FREE_TYPING_BLANKS") {
    const content = { ...q.content };
    const passage = content.passage || "";
    const { parts, gaps } = parseFillInGaps(passage);
    delete content.passage;
    content.passage_parts = parts;
    content.gap_count = gaps.length;
    cloned.content = content;
    return cloned;
  }

  if (category === "WRITING_SENTENCE_REWRITE") {
    const content = { ...q.content };
    const correctAnswer = content.correct_answer || "";
    const { cue } = parseSentenceRewriteCue(correctAnswer);
    if (!content.starting_cue || !content.starting_cue.trim()) {
      content.starting_cue = cue;
    }
    delete content.correct_answer;
    cloned.content = content;
    return cloned;
  }

  if (category === "WRITING_SHORT_ANSWER") {
    const content = { ...q.content };
    if (Array.isArray(content.sub_questions)) {
      content.sub_questions = content.sub_questions.map((sub: any) => {
        const { sample_answer, ...rest } = sub;
        return rest;
      });
    }
    cloned.content = content;
    return cloned;
  }

  cloned.content = { ...q.content };
  return cloned;
}

export function sanitizeFlashcardForStudent(card: FlashcardRow): {
  id: string;
  vietnamese_name?: string;
  image_url?: string | null;
  audio_url?: string | null;
  options: string[];
} {
  const options = Array.isArray(card.options) ? sortStrings(card.options) : [];
  return {
    id: card.id,
    vietnamese_name: card.vietnamese_name,
    image_url: card.image_url,
    audio_url: card.audio_url,
    options,
  };
}

export function summarizeResults(results: GradeResult[]): {
  objective_earned: number;
  objective_max: number;
  ai_max: number;
  has_ai: boolean;
} {
  let objective_earned = 0;
  let objective_max = 0;
  let ai_max = 0;

  for (const r of results) {
    if (r.kind === "OBJECTIVE") {
      objective_earned += r.earned;
      objective_max += r.max;
    } else if (r.kind === "AI") {
      ai_max += r.max;
    }
  }

  return {
    objective_earned,
    objective_max,
    ai_max,
    has_ai: ai_max > 0,
  };
}

export function computeScorePercent(
  objEarned: number,
  objMax: number,
  aiEarned: number | null,
  aiMax: number
): number {
  const totalMax = objMax + aiMax;
  if (totalMax <= 0) return 100;
  const totalEarned = objEarned + (aiEarned ?? 0);
  const percent = (totalEarned / totalMax) * 100;
  return Math.round(percent * 10) / 10;
}

// Tên trường đáp án (kể cả kiểu cũ/camelCase) không bao giờ được gửi cho học sinh — áp cho mọi dạng câu
const ANSWER_KEYS = [
  "correct_answer", "correctAnswer", "correct_answers", "correctAnswers", "correct_text", "correctText",
  "answer", "answers", "sample_answer", "sampleAnswer",
];

function stripAnswerKeys(obj: Record<string, any>): Record<string, any> {
  const out: Record<string, any> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (!ANSWER_KEYS.includes(k)) out[k] = v;
  }
  return out;
}

export function sanitizeQuestionForStudent(q: GradableQuestion): GradableQuestion {
  const result = sanitizeByCategory(q);

  if (result.content && typeof result.content === "object") {
    const content = stripAnswerKeys(result.content);
    if (Array.isArray(content.sub_questions)) {
      content.sub_questions = content.sub_questions.map((sub: any) =>
        sub && typeof sub === "object" ? stripAnswerKeys(sub) : sub
      );
    }
    result.content = content;
  }

  // AI Import lưu đoạn văn điền ô (kèm đáp án trong ngoặc) vào cả cột stimulus_text
  const category = q.category || "";
  if ((category.endsWith("_FILL_IN") || category === "WRITING_FREE_TYPING_BLANKS") && typeof q.stimulus_text === "string") {
    const { parts, gaps } = parseFillInGaps(q.stimulus_text);
    if (gaps.length > 0) result.stimulus_text = parts.join("____");
  }

  return result;
}
