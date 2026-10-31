-- Migration 009: Chuẩn chấm theo loại đề + chấm đề thi phía server (FEAT-011, DEC-014…018)
-- Chạy được nhiều lần. lib/db-pg.ts ensureSchema() chạy cùng DDL.

CREATE TABLE IF NOT EXISTS scoring_standards (
  id VARCHAR(50) PRIMARY KEY,
  name VARCHAR(150) NOT NULL,
  framework VARCHAR(50),                       -- IELTS | TOEIC | HSK | INTERNAL | … (chỉ để hiển thị/lọc)
  description TEXT,
  sections JSONB NOT NULL DEFAULT '[]',        -- [{ skill, min, max, step, conversion, table_question_count?, table?, rubric_id? }]
  aggregation JSONB NOT NULL DEFAULT '{}',     -- { method, round_step, weights?, pass_score?, section_min? }
  is_system BOOLEAN NOT NULL DEFAULT FALSE,
  created_by VARCHAR(50),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE exams ADD COLUMN IF NOT EXISTS scoring_standard_id VARCHAR(50);
ALTER TABLE courses ADD COLUMN IF NOT EXISTS default_scoring_standard_id VARCHAR(50);

-- Lượt thi = một dòng submissions (status IN_PROGRESS → GRADING / NEEDS_REVIEW → GRADED)
ALTER TABLE submissions ADD COLUMN IF NOT EXISTS class_ref VARCHAR(50);          -- submissions.class_id cũ là UUID, không chứa được id lớp dạng chuỗi
ALTER TABLE submissions ADD COLUMN IF NOT EXISTS started_at TIMESTAMPTZ;
ALTER TABLE submissions ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMPTZ;
ALTER TABLE submissions ADD COLUMN IF NOT EXISTS graded_at TIMESTAMPTZ;
ALTER TABLE submissions ADD COLUMN IF NOT EXISTS deadline_at TIMESTAMPTZ;
ALTER TABLE submissions ADD COLUMN IF NOT EXISTS is_late BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE submissions ADD COLUMN IF NOT EXISTS results JSONB;
ALTER TABLE submissions ADD COLUMN IF NOT EXISTS section_scores JSONB;           -- { Reading: { score, earned, max }, … }
ALTER TABLE submissions ADD COLUMN IF NOT EXISTS total_score NUMERIC;           -- final_score cũ là NUMERIC(3,1), không chứa được 990/200
ALTER TABLE submissions ADD COLUMN IF NOT EXISTS passed BOOLEAN;
ALTER TABLE submissions ADD COLUMN IF NOT EXISTS standard_snapshot JSONB;        -- chuẩn chấm tại thời điểm bắt đầu thi
CREATE INDEX IF NOT EXISTS idx_submissions_exam_student ON submissions (exam_id, student_id);

-- Chuẩn hệ thống (bảng tra IELTS là bảng tham khảo phổ biến — admin chỉnh được)
INSERT INTO scoring_standards (id, name, framework, description, sections, aggregation, is_system) VALUES
('std_internal_10', 'Thang điểm 10', 'INTERNAL', 'Mỗi kỹ năng 0–10, điểm tổng là trung bình.',
 '[{"skill":"Reading","min":0,"max":10,"step":0.25,"conversion":"LINEAR"},
   {"skill":"Listening","min":0,"max":10,"step":0.25,"conversion":"LINEAR"},
   {"skill":"Writing","min":0,"max":10,"step":0.25,"conversion":"LINEAR","rubric_id":"rubric_internal_10"},
   {"skill":"Speaking","min":0,"max":10,"step":0.25,"conversion":"LINEAR","rubric_id":"rubric_internal_10"}]',
 '{"method":"AVERAGE","round_step":0.25}', TRUE),
('std_ielts', 'IELTS Academic', 'IELTS', 'Band 0–9 từng kỹ năng; Overall = trung bình làm tròn 0.5. Reading/Listening tra bảng /40.',
 '[{"skill":"Listening","min":0,"max":9,"step":0.5,"conversion":"TABLE","table_question_count":40,
    "table":[{"min_correct":0,"score":0},{"min_correct":2,"score":2},{"min_correct":4,"score":2.5},{"min_correct":6,"score":3},{"min_correct":8,"score":3.5},{"min_correct":10,"score":4},{"min_correct":13,"score":4.5},{"min_correct":16,"score":5},{"min_correct":18,"score":5.5},{"min_correct":23,"score":6},{"min_correct":26,"score":6.5},{"min_correct":30,"score":7},{"min_correct":32,"score":7.5},{"min_correct":35,"score":8},{"min_correct":37,"score":8.5},{"min_correct":39,"score":9}]},
   {"skill":"Reading","min":0,"max":9,"step":0.5,"conversion":"TABLE","table_question_count":40,
    "table":[{"min_correct":0,"score":0},{"min_correct":2,"score":2},{"min_correct":4,"score":2.5},{"min_correct":6,"score":3},{"min_correct":8,"score":3.5},{"min_correct":10,"score":4},{"min_correct":13,"score":4.5},{"min_correct":15,"score":5},{"min_correct":19,"score":5.5},{"min_correct":23,"score":6},{"min_correct":27,"score":6.5},{"min_correct":30,"score":7},{"min_correct":33,"score":7.5},{"min_correct":35,"score":8},{"min_correct":37,"score":8.5},{"min_correct":39,"score":9}]},
   {"skill":"Writing","min":0,"max":9,"step":0.5,"conversion":"LINEAR","rubric_id":"rubric_ielts_writing"},
   {"skill":"Speaking","min":0,"max":9,"step":0.5,"conversion":"LINEAR","rubric_id":"rubric_ielts_speaking"}]',
 '{"method":"AVERAGE","round_step":0.5}', TRUE),
('std_toeic_lr', 'TOEIC Listening & Reading', 'TOEIC', 'Listening 5–495, Reading 5–495; tổng = cộng (10–990).',
 '[{"skill":"Listening","min":5,"max":495,"step":5,"conversion":"LINEAR"},
   {"skill":"Reading","min":5,"max":495,"step":5,"conversion":"LINEAR"}]',
 '{"method":"SUM","round_step":5}', TRUE),
('std_hsk1', 'HSK 1', 'HSK', 'Nghe 0–100, Đọc 0–100; tổng = cộng (200), đạt khi ≥ 120.',
 '[{"skill":"Listening","min":0,"max":100,"step":1,"conversion":"LINEAR"},
   {"skill":"Reading","min":0,"max":100,"step":1,"conversion":"LINEAR"}]',
 '{"method":"SUM","round_step":1,"pass_score":120}', TRUE)
ON CONFLICT (id) DO NOTHING;
