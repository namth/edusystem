import { supabase } from "@/lib/supabase";
import { ScoringRubric } from "@/types/scoring";

// 🇬🇧 1. IELTS Standard Rubrics
export const DEFAULT_IELTS_SPEAKING_RUBRIC: ScoringRubric = {
  id: "rubric_ielts_speaking",
  name: "IELTS Speaking Band Score (Official)",
  description: "Tiêu chí chấm bài nói IELTS Speaking Band 0-9.0 chuẩn British Council / IDP",
  framework: "IELTS",
  language: "EN",
  scale: { min: 0, max: 9, step: 0.5 },
  criteria: [
    { key: "fluency_coherence", label: "Trôi Chảy & Mạch Lạc (Fluency)", weight: 0.25, descriptor: "Assess fluency, speech rate, coherence, hesitation frequency and self-repair" },
    { key: "lexical_resource", label: "Vốn Từ Vựng (Lexical Resource)", weight: 0.25, descriptor: "Assess range, precision, idiomatic vocabulary and collocations" },
    { key: "grammatical_range", label: "Ngữ Pháp & Độ Chính Xác", weight: 0.25, descriptor: "Assess range and accuracy of complex grammatical structures" },
    { key: "pronunciation", label: "Phát Âm (Pronunciation)", weight: 0.25, descriptor: "Assess phonemic accuracy, stress, intonation and clarity" },
  ],
  outputLanguage: "vi",
};

export const DEFAULT_IELTS_WRITING_RUBRIC: ScoringRubric = {
  id: "rubric_ielts_writing",
  name: "IELTS Writing Task 2 Band Score (Official)",
  description: "Tiêu chí chấm bài luận IELTS Writing Task 2 Band 0-9.0",
  framework: "IELTS",
  language: "EN",
  scale: { min: 0, max: 9, step: 0.5 },
  criteria: [
    { key: "task_achievement", label: "Task Achievement / Response", weight: 0.25, descriptor: "Assess how fully and clearly the essay addresses all parts of the prompt" },
    { key: "coherence_cohesion", label: "Coherence & Cohesion", weight: 0.25, descriptor: "Assess logical paragraphing, topic sentences, and cohesive devices" },
    { key: "lexical_resource", label: "Vốn Từ Vựng (Lexical Resource)", weight: 0.25, descriptor: "Assess academic vocabulary, collocations, and spelling" },
    { key: "grammatical_range", label: "Ngữ Pháp & Độ Chính Xác", weight: 0.25, descriptor: "Assess sentence structure variety, punctuation, and grammatical accuracy" },
  ],
  outputLanguage: "vi",
};

// 🇬🇧 2. TOEIC Standard Rubrics
export const DEFAULT_TOEIC_WRITING_RUBRIC: ScoringRubric = {
  id: "rubric_toeic_writing",
  name: "TOEIC Writing Test Score (Scale 0-200)",
  description: "Tiêu chí chấm điểm bài viết TOEIC Writing chuẩn ETS (0 - 200 điểm)",
  framework: "TOEIC",
  language: "EN",
  scale: { min: 0, max: 200, step: 10 },
  criteria: [
    { key: "grammar_syntax", label: "Ngữ Pháp & Cấu Trúc Câu", weight: 0.35, descriptor: "Evaluate grammatical correctness, sentence structure variety in business context" },
    { key: "lexical_relevance", label: "Từ Vựng & Độ Phù Hợp", weight: 0.35, descriptor: "Evaluate appropriate business vocabulary and task relevance" },
    { key: "organization_support", label: "Tổ Chức & Luận Điểm", weight: 0.30, descriptor: "Evaluate logical progression, reasons, and supporting details" },
  ],
  outputLanguage: "vi",
};

export const DEFAULT_TOEIC_SPEAKING_RUBRIC: ScoringRubric = {
  id: "rubric_toeic_speaking",
  name: "TOEIC Speaking Test Score (Scale 0-200)",
  description: "Tiêu chí chấm bài nói TOEIC Speaking chuẩn ETS (0 - 200 điểm)",
  framework: "TOEIC",
  language: "EN",
  scale: { min: 0, max: 200, step: 10 },
  criteria: [
    { key: "pronunciation", label: "Phát Âm (Pronunciation)", weight: 0.30, descriptor: "Evaluate clarity of vowels, consonants, and word stress" },
    { key: "intonation_stress", label: "Ngữ Điệu & Trọng Âm", weight: 0.30, descriptor: "Evaluate natural intonation, rhythm, and sentence stress" },
    { key: "grammar_vocabulary", label: "Ngữ Pháp & Từ Vựng Giao Tiếp", weight: 0.40, descriptor: "Evaluate accuracy of grammar and vocabulary appropriateness" },
  ],
  outputLanguage: "vi",
};

// 🇺🇸 3. TOEFL iBT Standard Rubrics
export const DEFAULT_TOEFL_WRITING_RUBRIC: ScoringRubric = {
  id: "rubric_toefl_writing",
  name: "TOEFL iBT Writing Score (Scale 0-30)",
  description: "Tiêu chí chấm bài luận TOEFL iBT Academic Writing (0 - 30 điểm)",
  framework: "TOEFL",
  language: "EN",
  scale: { min: 0, max: 30, step: 1 },
  criteria: [
    { key: "development_unity", label: "Phát Triển Luận Điểm (Development)", weight: 0.35, descriptor: "Evaluate clear thesis statement, explanations and supporting evidence" },
    { key: "structure_cohesion", label: "Cấu Trúc & Liên Kết", weight: 0.35, descriptor: "Evaluate organization, paragraph transitions and coherence" },
    { key: "language_use", label: "Sử Dụng Ngôn Ngữ (Language Use)", weight: 0.30, descriptor: "Evaluate syntactic variety, word choice and grammatical accuracy" },
  ],
  outputLanguage: "vi",
};

export const DEFAULT_TOEFL_SPEAKING_RUBRIC: ScoringRubric = {
  id: "rubric_toefl_speaking",
  name: "TOEFL iBT Speaking Score (Scale 0-30)",
  description: "Tiêu chí chấm bài nói TOEFL iBT Academic Speaking (0 - 30 điểm)",
  framework: "TOEFL",
  language: "EN",
  scale: { min: 0, max: 30, step: 1 },
  criteria: [
    { key: "delivery", label: "Diễn Đạt & Phát Âm (Delivery)", weight: 0.33, descriptor: "Evaluate fluid speech, clear articulation, pace and intonation" },
    { key: "language_use", label: "Sử Dụng Ngữ Pháp & Từ Vựng", weight: 0.33, descriptor: "Evaluate effective use of grammar and precision of vocabulary" },
    { key: "topic_development", label: "Phát Triển Chủ Đề (Topic Dev)", weight: 0.34, descriptor: "Evaluate completeness, logical flow and response depth" },
  ],
  outputLanguage: "vi",
};

// 🇪🇺 4. CEFR European Framework Rubric
export const DEFAULT_CEFR_RUBRIC: ScoringRubric = {
  id: "rubric_cefr_standard",
  name: "Khung Tham Chiếu Châu Âu CEFR (A1 - C2)",
  description: "Tiêu chí đánh giá năng lực ngôn ngữ theo khung CEFR Châu Âu",
  framework: "CEFR",
  language: "EN",
  scale: { min: 1, max: 6, step: 1 },
  criteria: [
    { key: "linguistic_range", label: "Phạm Vi Ngôn Ngữ (Range)", weight: 0.25, descriptor: "Evaluate richness of expressions from A1 to C2 mastery level" },
    { key: "accuracy", label: "Độ Chính Xác Ngôn Ngữ", weight: 0.25, descriptor: "Evaluate grammatical control and error frequency" },
    { key: "coherence", label: "Tính Mạch Lạc (Coherence)", weight: 0.25, descriptor: "Evaluate logical flow and connection of ideas" },
    { key: "appropriateness", label: "Độ Phù Hợp Bối Cảnh", weight: 0.25, descriptor: "Evaluate register, tone and socio-linguistic appropriateness" },
  ],
  outputLanguage: "vi",
};

// 🇨🇳 5. HSK / HSKK Chinese Standard Rubric
export const DEFAULT_HSK_WRITING_RUBRIC: ScoringRubric = {
  id: "rubric_hsk_writing",
  name: "Tiêu Chí Chấm Điểm HSK / HSKK Tiếng Trung (0 - 100đ)",
  description: "Tiêu chí đánh giá bài thi Hán tự, ngữ pháp & bài nói HSKK Tiếng Trung",
  framework: "HSK",
  language: "ZH",
  scale: { min: 0, max: 100, step: 5 },
  criteria: [
    { key: "chinese_characters", label: "Chữ Hán & Từ Vựng (汉字与词汇)", weight: 0.35, descriptor: "Evaluate Chinese character accuracy, stroke order and vocabulary richness" },
    { key: "grammar_syntax", label: "Ngữ Pháp & Cấu Trúc (语法与句型)", weight: 0.35, descriptor: "Evaluate Chinese sentence patterns, word order and grammatical correctness" },
    { key: "fluency_logic", label: "Mạch Lạc & Diễn Đạt (流畅与逻辑)", weight: 0.30, descriptor: "Evaluate text flow, coherence and tone accuracy" },
  ],
  outputLanguage: "vi",
};

// 🇯🇵 6. JLPT Japanese Standard Rubric
export const DEFAULT_JLPT_RUBRIC: ScoringRubric = {
  id: "rubric_jlpt_expression",
  name: "Tiêu Chí Đánh Giá Tiếng Nhật JLPT (Thang 0 - 60đ)",
  description: "Tiêu chí đánh giá diễn đạt, từ vựng & kính ngữ JLPT (N5 - N1)",
  framework: "JLPT",
  language: "JA",
  scale: { min: 0, max: 60, step: 2 },
  criteria: [
    { key: "vocabulary_keigo", label: "Từ Vựng & Kính Ngữ (语汇与敬语)", weight: 0.40, descriptor: "Evaluate Japanese vocabulary choice, Kanji usage, and honorific Keigo accuracy" },
    { key: "grammar_patterns", label: "Cấu Trúc Ngữ Pháp (文法)", weight: 0.40, descriptor: "Evaluate Japanese grammar particles, conjugations, and clause structures" },
    { key: "natural_expression", label: "Diễn Đạt Tự Nhiên (自然表达)", weight: 0.20, descriptor: "Evaluate natural phrasing and contextual nuance" },
  ],
  outputLanguage: "vi",
};

// 🇻🇳 7. Internal Standard Rubric (Thang 10)
export const DEFAULT_INTERNAL_RUBRIC: ScoringRubric = {
  id: "rubric_internal_10",
  name: "Thang Điểm 10 Nội Bộ (Standard 10-Point)",
  description: "Thang điểm 10 truyền thống cho các lớp học giao tiếp & ngữ pháp",
  framework: "INTERNAL",
  language: "VI",
  scale: { min: 0, max: 10, step: 0.5 },
  criteria: [
    { key: "vocabulary", label: "Từ Vựng & Phong Phú", weight: 0.33, descriptor: "Đánh giá sự đa dạng và chính xác của từ vựng" },
    { key: "grammar", label: "Ngữ Pháp & Cấu Trúc", weight: 0.33, descriptor: "Đánh giá độ chính xác và đa dạng của cấu trúc câu" },
    { key: "fluency_coherence", label: "Trôi Chảy & Mạch Lạc", weight: 0.34, descriptor: "Đánh giá tính liên kết và sự mạch lạc trong diễn đạt" },
  ],
  outputLanguage: "vi",
};

// Master list of all official international standard rubrics
export const ALL_OFFICIAL_STANDARDS_RUBRICS: ScoringRubric[] = [
  DEFAULT_IELTS_WRITING_RUBRIC,
  DEFAULT_IELTS_SPEAKING_RUBRIC,
  DEFAULT_TOEIC_WRITING_RUBRIC,
  DEFAULT_TOEIC_SPEAKING_RUBRIC,
  DEFAULT_TOEFL_WRITING_RUBRIC,
  DEFAULT_TOEFL_SPEAKING_RUBRIC,
  DEFAULT_CEFR_RUBRIC,
  DEFAULT_HSK_WRITING_RUBRIC,
  DEFAULT_JLPT_RUBRIC,
  DEFAULT_INTERNAL_RUBRIC,
];

/**
 * Resolves the active scoring rubric for a given exam by ID,
 * applying any custom rubric overrides specified in the exam record.
 */
export async function resolveRubricForExam(
  examId?: string,
  skillCategory?: string
): Promise<ScoringRubric> {
  let baseRubric = skillCategory?.includes("SPEAKING")
    ? DEFAULT_IELTS_SPEAKING_RUBRIC
    : skillCategory?.includes("WRITING")
    ? DEFAULT_IELTS_WRITING_RUBRIC
    : DEFAULT_INTERNAL_RUBRIC;

  if (!examId) return baseRubric;

  try {
    const { data: exam } = await supabase
      .from("exams")
      .select("scoring_rubric_id, scoring_rubric_override")
      .eq("id", examId)
      .maybeSingle();

    if (exam?.scoring_rubric_id) {
      const { data: rubricRow } = await supabase
        .from("scoring_rubrics")
        .select("*")
        .eq("id", exam.scoring_rubric_id)
        .maybeSingle();

      if (rubricRow) {
        baseRubric = {
          id: rubricRow.id,
          name: rubricRow.name,
          description: rubricRow.description,
          framework: rubricRow.framework || "IELTS",
          language: rubricRow.language || "EN",
          scale: {
            min: Number(rubricRow.scale_min ?? 0),
            max: Number(rubricRow.scale_max ?? 9),
            step: Number(rubricRow.scale_step ?? 0.5),
          },
          criteria: Array.isArray(rubricRow.criteria) ? rubricRow.criteria : baseRubric.criteria,
          outputLanguage: rubricRow.output_language || "vi",
        };
      }
    }

    // Apply exam-level override if specified
    if (exam?.scoring_rubric_override && typeof exam.scoring_rubric_override === "object") {
      const override = exam.scoring_rubric_override;
      baseRubric = {
        ...baseRubric,
        ...override,
        scale: {
          ...baseRubric.scale,
          ...(override.scale || {}),
        },
      };
    }
  } catch (err) {
    console.warn("Failed to resolve rubric from DB, using default fallback:", err);
  }

  return baseRubric;
}
