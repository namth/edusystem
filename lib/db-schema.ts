// ======================================================
// PURE ENTITY SCHEMAS & INTERFACES (POSTGRESQL STORE)
// ======================================================

export interface DBCourse {
  id: string;
  title: string;
  description?: string;
  level?: "Beginner" | "Intermediate" | "Advanced";
  thumbnail?: string;
  created_at?: string;
}

export interface DBLesson {
  id: string;
  title: string;
  description?: string;
  created_at?: string;
}

export interface DBFlashcard {
  id: string;
  vietnamese_name: string;
  correct_english_word: string;
  options: string[];
  image_url?: string;
  audio_url?: string;
  created_at?: string;
}

export interface DBQuestion {
  id: string;
  skill: "Reading" | "Listening" | "Writing" | "Speaking";
  category: string;
  prompt?: string;
  content: Record<string, any>;
  flashcard_ids?: string[];
  created_at?: string;
}

export interface DBExamCategory {
  id: string;
  name: string;
  code: string;
  description?: string;
  display_order?: number;
  created_at?: string;
}

export interface DBExam {
  id: string;
  title: string;
  exam_type?: "EXAM" | "ASSIGNMENT" | "PRACTICE";
  category_id?: string;
  target_level?: string;
  is_template?: boolean;
  duration_minutes?: number;
  skills: string[];
  stimulus_type?: "TEXT_ONLY" | "AUDIO_ONLY" | "COMBINED";
  stimulus_text?: string;
  stimulus_audio_url?: string;
  passing_score?: number;
  created_at?: string;
}

export interface DBLessonExam {
  id: string;
  lesson_id: string;
  exam_id: string;
  order_index?: number;
  is_required?: boolean;
  weight?: number;
  created_at?: string;
}

export interface DBCourseExam {
  id: string;
  course_id: string;
  exam_id: string;
  exam_scope?: "ENTRY_TEST" | "MID_TERM" | "FINAL_EXAM";
  created_at?: string;
}

export interface DBCurriculumItem {
  id: string;
  course_id: string;
  teacher_id?: string;
  parent_id?: string | null;
  title: string;
  type: "UNIT" | "LESSON" | "EXAM";
  exam_id?: string | null;
  order_index?: number;
  created_at?: string;
}

export interface DBClass {
  id: string;
  name: string;
  code: string;
  schedule?: string;
  teacher_id?: string;
  max_slots?: number;
  status?: "ACTIVE" | "COMPLETED" | "UPCOMING";
  current_lesson_id?: string;
  created_at?: string;
}

export interface DBClassAssignment {
  id: string;
  class_id: string;
  exam_id: string;
  due_date?: string;
  available_at?: string;
  max_attempts?: number;
  created_at?: string;
}

export interface DBSubmission {
  id: string;
  answers: Record<string, any>;
  score: number;
  skill_scores?: Record<string, number>;
  ai_feedback?: Record<string, any>;
  status?: "SUBMITTED" | "GRADED" | "NEEDS_REVIEW";
  created_at?: string;
}

export interface DBScoringRubric {
  id: string;
  name: string;
  description?: string;
  skill: "Writing" | "Speaking";
  framework: "IELTS" | "TOEIC" | "TOEFL" | "CEFR" | "HSK" | "JLPT" | "INTERNAL";
  language: "EN" | "ZH" | "JA" | "FR" | "VI";
  scale_min: number;
  scale_max: number;
  scale_step: number;
  criteria: Array<{
    key: string;
    label: string;
    weight: number;
    descriptor: string;
  }>;
  output_language?: string;
  created_at?: string;
}
