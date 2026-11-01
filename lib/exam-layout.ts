import { groupQuestionsBySkill } from "@/lib/exam-player";
import { countAnswered } from "@/lib/lesson-player";

export const SPLIT_MIN_CHARS = 600;

export type ExamLayoutMode = "FOCUS" | "SPLIT" | "LISTENING";

export interface ExamScreen {
  key: string;
  skill: string;
  mode: ExamLayoutMode;
  stimulus_text: string | null;
  stimulus_audio_url: string | null;
  questionIds: string[];
}

export type QuestionNavStatus = "current" | "flagged" | "answered" | "empty";

/**
 * Đếm số ký tự văn bản thuần sau khi bỏ thẻ HTML, gộp khoảng trắng và cắt đầu cuối.
 */
export function stimulusPlainLength(html: string | null | undefined): number {
  if (!html || typeof html !== "string") return 0;
  return html
    .replace(/<[^>]*>/g, "")
    .replace(/\s+/g, " ")
    .trim().length;
}

function finalizeScreen(item: {
  key: string;
  skill: string;
  stimulus_text: string | null;
  stimulus_audio_url: string | null;
  normText: string;
  normAudio: string;
  questionIds: string[];
}): ExamScreen {
  let mode: ExamLayoutMode = "FOCUS";
  if (item.normAudio.length > 0) {
    mode = "LISTENING";
  } else if (stimulusPlainLength(item.stimulus_text) >= SPLIT_MIN_CHARS) {
    mode = "SPLIT";
  }
  return {
    key: item.key,
    skill: item.skill,
    mode,
    stimulus_text: item.stimulus_text,
    stimulus_audio_url: item.stimulus_audio_url,
    questionIds: item.questionIds,
  };
}

/**
 * Chia danh sách câu hỏi thành các màn theo kỹ năng và ngữ cảnh dùng chung.
 */
export function buildScreens(questions: any[]): ExamScreen[] {
  if (!Array.isArray(questions) || questions.length === 0) return [];
  const grouped = groupQuestionsBySkill(questions);
  const screens: ExamScreen[] = [];

  for (const group of grouped) {
    let current: {
      key: string;
      skill: string;
      stimulus_text: string | null;
      stimulus_audio_url: string | null;
      normText: string;
      normAudio: string;
      questionIds: string[];
    } | null = null;

    for (const q of group.questions) {
      if (!q || !q.id) continue;
      const rawText = typeof q.stimulus_text === "string" ? q.stimulus_text : null;
      const rawAudio = typeof q.stimulus_audio_url === "string" ? q.stimulus_audio_url : null;
      const normText = (rawText || "").trim();
      const normAudio = (rawAudio || "").trim();
      const hasStimulus = normText.length > 0 || normAudio.length > 0;

      if (
        current &&
        hasStimulus &&
        current.normText === normText &&
        current.normAudio === normAudio
      ) {
        current.questionIds.push(String(q.id));
      } else {
        if (current) {
          screens.push(finalizeScreen(current));
        }
        current = {
          key: String(q.id),
          skill: group.skill,
          stimulus_text: rawText,
          stimulus_audio_url: rawAudio,
          normText,
          normAudio,
          questionIds: [String(q.id)],
        };
      }
    }

    if (current) {
      screens.push(finalizeScreen(current));
    }
  }

  return screens;
}

/**
 * Trạng thái ưu tiên hiển thị trên bảng câu hỏi: đang làm > đánh dấu > đã làm > trống.
 */
export function navStatus(opts: {
  isCurrent?: boolean;
  isFlagged?: boolean;
  isAnswered?: boolean;
}): QuestionNavStatus {
  if (opts.isCurrent) return "current";
  if (opts.isFlagged) return "flagged";
  if (opts.isAnswered) return "answered";
  return "empty";
}

/**
 * Tìm chỉ số màn chứa câu hỏi có questionId.
 */
export function screenIndexOfQuestion(screens: ExamScreen[], questionId: string): number {
  if (!Array.isArray(screens) || !questionId) return -1;
  return screens.findIndex(
    (s) => Array.isArray(s.questionIds) && s.questionIds.includes(questionId)
  );
}

/**
 * Giới hạn chỉ số màn hợp lệ trong khoảng [0, totalScreens - 1].
 */
export function clampScreenIndex(index: number, totalScreens: number): number {
  if (!Number.isFinite(totalScreens) || totalScreens <= 0) return 0;
  if (!Number.isFinite(index)) return 0;
  return Math.max(0, Math.min(totalScreens - 1, Math.trunc(index)));
}

/**
 * Danh sách số thứ tự câu (1-based, theo thứ tự màn) chưa trả lời.
 */
export function unansweredNumbers(
  questions: any[],
  answers: Record<string, unknown>
): number[] {
  if (!Array.isArray(questions) || questions.length === 0) return [];
  const ordered = groupQuestionsBySkill(questions).flatMap((g) => g.questions);
  const safeAnswers = answers || {};
  const nums: number[] = [];
  ordered.forEach((q, idx) => {
    if (countAnswered([q], safeAnswers) === 0) {
      nums.push(idx + 1);
    }
  });
  return nums;
}

/**
 * Định dạng thời gian lưu nháp: "Đã lưu lúc HH:MM".
 */
export function formatSavedAt(date: Date): string {
  const hh = String(date.getHours()).padStart(2, "0");
  const mm = String(date.getMinutes()).padStart(2, "0");
  return `Đã lưu lúc ${hh}:${mm}`;
}

/**
 * Quy đổi phím 1–4 hoặc a–d/A–D sang chữ cái đáp án A–D.
 */
export function keyToOptionLetter(key: string): "A" | "B" | "C" | "D" | null {
  if (typeof key !== "string" || key.length !== 1) return null;
  switch (key) {
    case "1":
    case "a":
    case "A":
      return "A";
    case "2":
    case "b":
    case "B":
      return "B";
    case "3":
    case "c":
    case "C":
      return "C";
    case "4":
    case "d":
    case "D":
      return "D";
    default:
      return null;
  }
}

/**
 * Kiểm tra sự kiện bàn phím có đang diễn ra trong ô nhập liệu hay không.
 */
export function isTypingTarget(target: unknown): boolean {
  if (!target || typeof target !== "object") return false;
  const t = target as { tagName?: unknown; isContentEditable?: unknown };
  if (t.isContentEditable === true) return true;
  if (typeof t.tagName === "string") {
    const tag = t.tagName.toUpperCase();
    if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
  }
  return false;
}

/**
 * Áp dụng phím tắt chọn đáp án cho câu hỏi trắc nghiệm 1 ý.
 */
export function applyOptionShortcut(
  question: any,
  currentAnswer: unknown,
  letter: "A" | "B" | "C" | "D"
): Record<string, string> | null {
  if (!question || typeof question !== "object") return null;
  const category = typeof question.category === "string" ? question.category : "";
  if (!category.endsWith("_MC")) return null;
  const subs = question.content?.sub_questions;
  if (!Array.isArray(subs) || subs.length !== 1) return null;
  const sub = subs[0];
  if (!sub || sub.id === undefined || sub.id === null) return null;
  const optKey = `option_${letter.toLowerCase()}`;
  const optVal = sub[optKey];
  if (typeof optVal !== "string" || optVal.trim() === "") return null;
  const base =
    typeof currentAnswer === "object" &&
    currentAnswer !== null &&
    !Array.isArray(currentAnswer)
      ? (currentAnswer as Record<string, string>)
      : {};
  return {
    ...base,
    [String(sub.id)]: letter,
  };
}
