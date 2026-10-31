// TASK-027: Hiển thị điểm theo chuẩn chấm (IELTS, TOEIC, HSK...) và tương thích ngược bài cũ

export interface SubmissionScoreResult {
  value: number | null;
  min: number | null;
  max: number | null;
  percent: number | null;
  standard_name: string | null;
  status: string | null;
}

export type SkillName = "Listening" | "Reading" | "Writing" | "Speaking";

export interface SkillScoreItem {
  score: number | null;
  min: number;
  max: number;
}

function parseNum(val: unknown): number | null {
  if (val === null || val === undefined || val === "") return null;
  const n = Number(val);
  return Number.isNaN(n) ? null : n;
}

function getSectionScore(sectionScores: any, skill: string): number | null {
  if (!sectionScores || typeof sectionScores !== "object") return null;
  const entry = sectionScores[skill];
  if (entry === null || entry === undefined) return null;
  if (typeof entry === "object") {
    return parseNum(entry.score);
  }
  return parseNum(entry);
}

export function submissionScore(sub: any): SubmissionScoreResult {
  if (!sub || typeof sub !== "object") {
    return {
      value: null,
      min: null,
      max: null,
      percent: null,
      standard_name: null,
      status: null,
    };
  }

  const status = sub.status != null ? String(sub.status) : null;
  const snapshot = sub.standard_snapshot;

  if (snapshot && typeof snapshot === "object") {
    const standard_name = snapshot.name != null ? String(snapshot.name) : null;
    const value = parseNum(sub.total_score);

    const sections: any[] = Array.isArray(snapshot.sections) ? snapshot.sections : [];
    const aggregationMethod = snapshot.aggregation?.method;

    let min: number | null = null;
    let max: number | null = null;

    if (aggregationMethod === "SUM") {
      const scoredSections = sections.filter(
        (sec) => getSectionScore(sub.section_scores, sec.skill) !== null
      );
      const targetSections = scoredSections.length > 0 ? scoredSections : sections;
      if (targetSections.length > 0) {
        min = targetSections.reduce((acc, s) => acc + (parseNum(s.min) ?? 0), 0);
        max = targetSections.reduce((acc, s) => acc + (parseNum(s.max) ?? 0), 0);
      } else {
        min = 0;
        max = 0;
      }
    } else {
      const firstSec = sections[0];
      if (firstSec) {
        min = firstSec.min != null ? Number(firstSec.min) : 0;
        max = firstSec.max != null ? Number(firstSec.max) : 9;
      } else {
        min = 0;
        max = 9;
      }
    }

    let percent: number | null = null;
    if (value !== null && min !== null && max !== null && max !== min) {
      percent = Math.round(((value - min) / (max - min)) * 1000) / 10;
    }

    return {
      value,
      min,
      max,
      percent,
      standard_name,
      status,
    };
  }

  // Không có chuẩn (bài cũ): value = final_score ?? ai_score, min 0, max 9, standard_name null.
  const finalVal = parseNum(sub.final_score);
  const aiVal = parseNum(sub.ai_score);
  const value = finalVal ?? aiVal;
  const min = 0;
  const max = 9;

  let percent: number | null = null;
  if (value !== null) {
    percent = Math.round(((value - min) / (max - min)) * 1000) / 10;
  }

  return {
    value,
    min,
    max,
    percent,
    standard_name: null,
    status,
  };
}

export function submissionSkillScores(
  sub: any
): Record<SkillName, SkillScoreItem> {
  const result: Record<SkillName, SkillScoreItem> = {
    Listening: { score: null, min: 0, max: 9 },
    Reading: { score: null, min: 0, max: 9 },
    Writing: { score: null, min: 0, max: 9 },
    Speaking: { score: null, min: 0, max: 9 },
  };

  if (!sub || typeof sub !== "object") return result;

  const snapshot = sub.standard_snapshot;
  const skills: SkillName[] = ["Listening", "Reading", "Writing", "Speaking"];

  if (snapshot && typeof snapshot === "object") {
    const sections: any[] = Array.isArray(snapshot.sections) ? snapshot.sections : [];
    for (const skill of skills) {
      const sec = sections.find((s: any) => s.skill === skill);
      const min = sec && sec.min != null ? Number(sec.min) : 0;
      const max = sec && sec.max != null ? Number(sec.max) : 9;
      const score = getSectionScore(sub.section_scores, skill);
      result[skill] = { score, min, max };
    }
    return result;
  }

  // Không chuẩn: cột reading_score, listening_score, writing_score, speaking_score, thang 0–9
  result.Listening = { score: parseNum(sub.listening_score), min: 0, max: 9 };
  result.Reading = { score: parseNum(sub.reading_score), min: 0, max: 9 };
  result.Writing = { score: parseNum(sub.writing_score), min: 0, max: 9 };
  result.Speaking = { score: parseNum(sub.speaking_score), min: 0, max: 9 };

  return result;
}

export function formatScore(s: { value: number | null; max: number | null }): string {
  if (!s || s.value === null || s.value === undefined) {
    return "—";
  }
  return `${s.value}/${s.max}`;
}
