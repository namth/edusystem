export type Skill = "Reading" | "Listening" | "Writing" | "Speaking";

export interface StandardSection {
  skill: Skill | string;
  min: number;
  max: number;
  step: number;
  conversion: "LINEAR" | "TABLE";
  table_question_count?: number;
  table?: { min_correct: number; score: number }[];
  rubric_id?: string;
}

export interface StandardAggregation {
  method: "AVERAGE" | "SUM" | "WEIGHTED";
  round_step: number;
  weights?: Record<string, number>;
  pass_score?: number;
  section_min?: Record<string, number>;
}

export interface ScoringStandard {
  id: string;
  name: string;
  framework?: string;
  description?: string;
  sections: StandardSection[];
  aggregation: StandardAggregation;
  is_system?: boolean;
  created_by?: string;
  created_at?: string;
  updated_at?: string;
}

export interface SectionTally {
  objective_earned: number;
  objective_max: number;
  ai_earned: number;
  ai_max: number;
}

/**
 * Làm tròn nửa lên tới bội của step tính từ 0: Math.floor(value / step + 0.5) * step
 * Khử sai số dấu phẩy động, rồi kẹp trong [min, max]
 */
export function roundToStep(value: number, step: number, min: number, max: number): number {
  if (step <= 0) {
    const clamped = Math.min(max, Math.max(min, value));
    return Math.round(clamped * 1e6) / 1e6;
  }
  const scaled = Math.round((value / step) * 1e9) / 1e9;
  const raw = Math.floor(scaled + 0.5) * step;
  const rounded = Math.round(raw * 1e6) / 1e6;
  return Math.min(max, Math.max(min, rounded));
}

/**
 * Tính điểm cho một phần thi theo chuẩn (BR-E02)
 * - objective_max + ai_max = 0 -> null
 * - TABLE và ai_max = 0 và có table:
 *     n = Math.round(objective_earned / objective_max * (table_question_count ?? objective_max))
 *     điểm = score của dòng có min_correct lớn nhất <= n (không có dòng nào -> min)
 * - LINEAR (hoặc TABLE nhưng có AI):
 *     ratio = (objective_earned + ai_earned) / (objective_max + ai_max)
 *     điểm = roundToStep(min + ratio * (max - min), step, min, max)
 */
export function scoreSection(section: StandardSection, tally: SectionTally): number | null {
  const totalMax = (tally.objective_max ?? 0) + (tally.ai_max ?? 0);
  if (totalMax <= 0) {
    return null;
  }

  if (
    section.conversion === "TABLE" &&
    tally.ai_max === 0 &&
    section.table &&
    section.table.length > 0 &&
    tally.objective_max > 0
  ) {
    const tableQuestionCount = section.table_question_count ?? tally.objective_max;
    const n = Math.round((tally.objective_earned / tally.objective_max) * tableQuestionCount);

    const eligible = section.table.filter((row) => row.min_correct <= n);
    if (eligible.length === 0) {
      return section.min;
    }
    const best = eligible.reduce((prev, curr) => (curr.min_correct > prev.min_correct ? curr : prev));
    return best.score;
  }

  const ratio = ((tally.objective_earned ?? 0) + (tally.ai_earned ?? 0)) / totalMax;
  const raw = section.min + ratio * (section.max - section.min);
  return roundToStep(raw, section.step, section.min, section.max);
}

/**
 * Tính điểm tổng và trạng thái đạt theo chuẩn (BR-E06)
 * - Chỉ xét skill có điểm là số (bỏ null/undefined)
 * - Không có phần nào có điểm -> { total: null, passed: null }
 * - AVERAGE = trung bình; SUM = tổng; WEIGHTED = Σ(w·s)/Σw với w = weights[skill] ?? 1
 * - total = roundToStep(x, round_step, -Infinity, Infinity)
 * - passed: không có pass_score -> null; có -> total >= pass_score và với mọi section_min[skill] mà skill có điểm thì điểm >= mức sàn
 */
export function aggregateTotal(
  standard: ScoringStandard,
  scores: Record<string, number | null | undefined>
): { total: number | null; passed: boolean | null } {
  const validScores: { skill: string; score: number }[] = [];

  for (const [skill, val] of Object.entries(scores)) {
    if (typeof val === "number" && !isNaN(val)) {
      validScores.push({ skill, score: val });
    }
  }

  if (validScores.length === 0) {
    return { total: null, passed: null };
  }

  const method = standard.aggregation?.method || "AVERAGE";
  let rawTotal = 0;

  if (method === "SUM") {
    rawTotal = validScores.reduce((acc, curr) => acc + curr.score, 0);
  } else if (method === "WEIGHTED") {
    const weights = standard.aggregation?.weights || {};
    let sumWeighted = 0;
    let sumWeights = 0;
    for (const item of validScores) {
      const w = weights[item.skill] ?? 1;
      sumWeighted += w * item.score;
      sumWeights += w;
    }
    rawTotal = sumWeights > 0 ? sumWeighted / sumWeights : 0;
  } else {
    // AVERAGE
    const sum = validScores.reduce((acc, curr) => acc + curr.score, 0);
    rawTotal = sum / validScores.length;
  }

  const roundStep = standard.aggregation?.round_step ?? 0.5;
  const total = roundToStep(rawTotal, roundStep, -Infinity, Infinity);

  let passed: boolean | null = null;
  if (typeof standard.aggregation?.pass_score === "number") {
    passed = total >= standard.aggregation.pass_score;
    const sectionMin = standard.aggregation.section_min;
    if (sectionMin && passed) {
      for (const item of validScores) {
        const minReq = sectionMin[item.skill];
        if (typeof minReq === "number" && item.score < minReq) {
          passed = false;
          break;
        }
      }
    }
  }

  return { total, passed };
}
