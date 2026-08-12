-- Migration 001: Schema setup for AI Scoring System v2.0
-- Reference: ADR-001 & SCORING.md

-- 1. Create scoring_rubrics table
CREATE TABLE IF NOT EXISTS scoring_rubrics (
  id              TEXT PRIMARY KEY,
  name            TEXT NOT NULL,
  description     TEXT,
  scale_min       NUMERIC NOT NULL DEFAULT 0,
  scale_max       NUMERIC NOT NULL DEFAULT 9,
  scale_step      NUMERIC NOT NULL DEFAULT 0.5,
  criteria        JSONB NOT NULL,
  output_language TEXT NOT NULL DEFAULT 'vi',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Seed Default Rubrics
INSERT INTO scoring_rubrics (id, name, description, scale_min, scale_max, scale_step, criteria) VALUES
('ielts_speaking', 'IELTS Speaking Band Score', 'Chấm theo tiêu chí IELTS Speaking chính thức', 0, 9, 0.5, '[
  {"key":"fluency_coherence","label":"Trôi Chảy & Mạch Lạc","weight":0.25,"descriptor":"Assess fluency, coherence, hesitation frequency and repair"},
  {"key":"lexical_resource","label":"Vốn Từ Vựng","weight":0.25,"descriptor":"Assess range, accuracy and appropriacy of vocabulary"},
  {"key":"grammatical_range","label":"Ngữ Pháp & Độ Chính Xác","weight":0.25,"descriptor":"Assess range and accuracy of grammatical forms"},
  {"key":"pronunciation","label":"Phát Âm","weight":0.25,"descriptor":"Assess phonemic accuracy, word stress, sentence stress, intonation and rhythm"}
]'::jsonb)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  criteria = EXCLUDED.criteria;

INSERT INTO scoring_rubrics (id, name, description, scale_min, scale_max, scale_step, criteria) VALUES
('ielts_writing_task2', 'IELTS Writing Task 2 Band Score', 'Chấm theo tiêu chí IELTS Academic Writing Task 2', 0, 9, 0.5, '[
  {"key":"task_achievement","label":"Task Achievement","weight":0.25,"descriptor":"Assess how fully the student addresses all parts of the task"},
  {"key":"coherence_cohesion","label":"Coherence & Cohesion","weight":0.25,"descriptor":"Assess logical organization and use of cohesive devices"},
  {"key":"lexical_resource","label":"Vốn Từ Vựng","weight":0.25,"descriptor":"Assess range and accuracy of vocabulary"},
  {"key":"grammatical_range","label":"Ngữ Pháp & Độ Chính Xác","weight":0.25,"descriptor":"Assess range and accuracy of grammatical structures"}
]'::jsonb)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  criteria = EXCLUDED.criteria;

INSERT INTO scoring_rubrics (id, name, description, scale_min, scale_max, scale_step, criteria) VALUES
('internal_10', 'Thang Điểm Nội Bộ 10', 'Thang điểm nội bộ cho đánh giá tổng quát', 0, 10, 0.5, '[
  {"key":"vocabulary","label":"Từ Vựng","weight":0.33},
  {"key":"grammar","label":"Ngữ Pháp","weight":0.33},
  {"key":"fluency_coherence","label":"Trôi Chảy & Mạch Lạc","weight":0.34}
]'::jsonb)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  criteria = EXCLUDED.criteria;

-- 3. Add columns to exams table
ALTER TABLE exams ADD COLUMN IF NOT EXISTS scoring_rubric_id TEXT REFERENCES scoring_rubrics(id);
ALTER TABLE exams ADD COLUMN IF NOT EXISTS scoring_rubric_override JSONB;

-- 4. Add columns to submissions table
ALTER TABLE submissions ADD COLUMN IF NOT EXISTS grading_attempts INTEGER NOT NULL DEFAULT 0;
ALTER TABLE submissions ADD COLUMN IF NOT EXISTS last_grading_error TEXT;
ALTER TABLE submissions ADD COLUMN IF NOT EXISTS teacher_review JSONB;
ALTER TABLE submissions ADD COLUMN IF NOT EXISTS final_evaluation_details JSONB;
