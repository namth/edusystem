export interface RubricCriteria {
  key: string;
  label: string;
  weight: number;
  descriptor?: string;
}

export interface ScoringRubric {
  id: string;
  name: string;
  description?: string;
  framework?: string;
  language?: string;
  scale: {
    min: number;
    max: number;
    step: number;
  };
  criteria: RubricCriteria[];
  outputLanguage?: string;
}

export interface EvaluationResult {
  rubricId: string;
  overallScore: number;
  bandDescriptor?: string;
  criteriaScores: Record<string, number>;
  feedback: string;
  errorsDetected: string[];
  improvements: string[];
  _source?: 'ai' | 'teacher';
}

export interface TeacherReview {
  overridden_scores: Record<string, EvaluationResult>;
  teacher_note?: string;
  reviewed_by: string;
  reviewed_at: string;
}

export type SubmissionStatus =
  | 'PENDING_GRADING'
  | 'AI_GRADING_IN_PROGRESS'
  | 'GRADED'
  | 'AI_GRADING_FAILED'
  | 'GRADED_WITH_FALLBACK'
  | 'TEACHER_REVIEWED';
