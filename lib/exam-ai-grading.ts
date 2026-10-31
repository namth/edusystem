import { queryPg } from "@/lib/db-pg";
import { roundToStep } from "@/lib/exam-scoring";
import {
  evaluateSpeakingWithAudio,
  evaluateWritingWithRubric,
  type ScoringRubric,
} from "@/lib/ai-engine";
import {
  ALL_OFFICIAL_STANDARDS_RUBRICS,
  resolveRubricForExam,
} from "@/lib/rubric-resolver";

export interface GradeExamOpenAnswerParams {
  category: string;
  prompt: string;
  answer: string;
  section: {
    min: number;
    max: number;
    step: number;
  };
  rubric_id?: string;
  exam_id?: string;
}

export async function gradeExamOpenAnswer(
  params: GradeExamOpenAnswerParams
): Promise<number> {
  const { category, prompt, answer, section, rubric_id, exam_id } = params;

  if (!answer || answer.trim() === "") {
    return section.min;
  }

  let rubric: ScoringRubric | null = null;

  if (rubric_id) {
    try {
      const res = await queryPg(
        "SELECT id, name, framework, language, scale_min, scale_max, scale_step, criteria, output_language FROM scoring_rubrics WHERE id = $1 LIMIT 1",
        [rubric_id]
      );
      if (res.rows.length > 0) {
        const row = res.rows[0];
        rubric = {
          id: row.id,
          name: row.name,
          framework: row.framework || "IELTS",
          language: row.language || "EN",
          scale: {
            min: Number(row.scale_min ?? section.min),
            max: Number(row.scale_max ?? section.max),
            step: Number(row.scale_step ?? section.step),
          },
          criteria: typeof row.criteria === "string" ? JSON.parse(row.criteria) : (row.criteria || []),
          outputLanguage: row.output_language || "vi",
        };
      }
    } catch {
      // Ignore DB query errors and fallback
    }

    if (!rubric) {
      const predefined = ALL_OFFICIAL_STANDARDS_RUBRICS.find((r) => r.id === rubric_id);
      if (predefined) {
        rubric = { ...predefined };
      }
    }
  }

  if (!rubric) {
    rubric = await resolveRubricForExam(exam_id, category);
  }

  // Ép scale = section
  rubric = {
    ...rubric,
    scale: {
      min: section.min,
      max: section.max,
      step: section.step,
    },
  };

  let rawScore: number = section.min;
  if (category.startsWith("SPEAKING")) {
    const evalRes = await evaluateSpeakingWithAudio(answer, prompt, rubric);
    const scoreVal = evalRes?.overallScore ?? (evalRes as any)?.overallBand;
    if (typeof scoreVal === "number" && !isNaN(scoreVal)) {
      rawScore = scoreVal;
    }
  } else {
    const evalRes = await evaluateWritingWithRubric(answer, prompt, rubric);
    const scoreVal = evalRes?.overallScore ?? (evalRes as any)?.overallBand;
    if (typeof scoreVal === "number" && !isNaN(scoreVal)) {
      rawScore = scoreVal;
    }
  }

  return roundToStep(rawScore, section.step, section.min, section.max);
}
