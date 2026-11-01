export type AttemptSummaryState =
  | "IN_PROGRESS"
  | "FINAL"
  | "PARTIAL"
  | "WAITING_AI"
  | "WAITING_TEACHER";

export interface GradedSectionItem {
  skill: string;
  score: number;
  earned?: number;
  max?: number;
}

export interface AttemptResultSummary {
  state: AttemptSummaryState;
  graded: GradedSectionItem[];
  pending: string[];
  total: number | null;
  passed: boolean | null;
}

function parseJsonObject<T>(val: unknown, fallback: T): T {
  if (val == null) return fallback;
  if (typeof val === "string") {
    try {
      return JSON.parse(val) as T;
    } catch {
      return fallback;
    }
  }
  if (typeof val === "object") {
    return val as T;
  }
  return fallback;
}

export function summarizeAttemptResult(attempt: any): AttemptResultSummary {
  if (!attempt || typeof attempt !== "object" || attempt.status === "IN_PROGRESS") {
    return {
      state: "IN_PROGRESS",
      graded: [],
      pending: [],
      total: null,
      passed: null,
    };
  }

  const snapshot = parseJsonObject<{ sections?: Array<{ skill: string }> } | null>(
    attempt.standard_snapshot,
    null
  );
  const sectionScores = parseJsonObject<Record<string, any>>(attempt.section_scores, {});

  const orderedSkills: string[] = [];
  const seen = new Set<string>();

  if (snapshot && Array.isArray(snapshot.sections)) {
    for (const sec of snapshot.sections) {
      const skill = sec?.skill ? String(sec.skill) : "";
      if (
        skill &&
        !seen.has(skill) &&
        Object.prototype.hasOwnProperty.call(sectionScores, skill)
      ) {
        seen.add(skill);
        orderedSkills.push(skill);
      }
    }
  }

  for (const skill of Object.keys(sectionScores)) {
    if (!seen.has(skill)) {
      seen.add(skill);
      orderedSkills.push(skill);
    }
  }

  const graded: GradedSectionItem[] = [];
  const pending: string[] = [];

  for (const skill of orderedSkills) {
    const entry = sectionScores[skill];
    const hasNumericScore =
      entry != null &&
      entry.score !== null &&
      entry.score !== undefined &&
      entry.score !== "" &&
      !Number.isNaN(Number(entry.score));

    if (hasNumericScore) {
      const item: GradedSectionItem = {
        skill,
        score: Number(entry.score),
      };
      if (typeof entry.earned === "number") item.earned = entry.earned;
      if (typeof entry.max === "number") item.max = entry.max;
      graded.push(item);
    } else {
      pending.push(skill);
    }
  }

  let state: AttemptSummaryState = "IN_PROGRESS";
  if (attempt.status === "GRADED") {
    state = "FINAL";
  } else if (attempt.status === "NEEDS_REVIEW") {
    state = "WAITING_TEACHER";
  } else if (
    attempt.status === "GRADING" ||
    attempt.status === "PENDING_GRADING" ||
    attempt.status === "AI_GRADING_IN_PROGRESS"
  ) {
    state = graded.length > 0 ? "PARTIAL" : "WAITING_AI";
  }

  const hasTotal =
    attempt.total_score !== null &&
    attempt.total_score !== undefined &&
    attempt.total_score !== "" &&
    !Number.isNaN(Number(attempt.total_score));

  const total = hasTotal ? Number(attempt.total_score) : null;
  const passed = typeof attempt.passed === "boolean" ? attempt.passed : null;

  return {
    state,
    graded,
    pending,
    total,
    passed,
  };
}
