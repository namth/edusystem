export function emptyAnswerFor(q: { category: string; content: any; [k: string]: unknown }): unknown {
  const category = q?.category || "";
  if (
    category.endsWith("_MC") ||
    category.endsWith("_MATCHING") ||
    category.endsWith("_FLASHCARD_SET") ||
    category === "WRITING_SHORT_ANSWER"
  ) {
    return {};
  }
  if (category.endsWith("_FILL_IN") || category === "WRITING_FREE_TYPING_BLANKS") {
    const gapCount = Number(q?.content?.gap_count) || 0;
    return Array.from({ length: gapCount }, () => "");
  }
  if (category.endsWith("_ORDERING")) {
    return [];
  }
  if (category === "WRITING_SENTENCE_REWRITE" || category === "WRITING_ESSAY") {
    return "";
  }
  return null;
}

export function setAnswerPart<T>(answer: T, key: string | number, value: unknown): T {
  if (Array.isArray(answer)) {
    const copy = [...answer];
    copy[Number(key)] = value;
    return copy as unknown as T;
  }
  if (typeof answer === "object" && answer !== null) {
    return {
      ...answer,
      [key]: value,
    } as T;
  }
  return {
    [key]: value,
  } as unknown as T;
}

export function countAnswered(
  questions: { id: string; category: string; content: any; [k: string]: unknown }[],
  answers: Record<string, unknown>
): number {
  if (!Array.isArray(questions) || !answers) return 0;
  let count = 0;
  for (const q of questions) {
    if (!q || !q.id) continue;
    const a = answers[q.id];
    if (a == null) continue;
    if (typeof a === "string") {
      if (a.trim().length > 0) count++;
    } else if (Array.isArray(a)) {
      if (
        a.length > 0 &&
        a.some((val) =>
          typeof val === "string" ? val.trim().length > 0 : val != null && val !== ""
        )
      ) {
        count++;
      }
    } else if (typeof a === "object") {
      const values = Object.values(a as Record<string, unknown>);
      if (
        values.length > 0 &&
        values.some((val) =>
          typeof val === "string" ? val.trim().length > 0 : val != null && val !== ""
        )
      ) {
        count++;
      }
    }
  }
  return count;
}
