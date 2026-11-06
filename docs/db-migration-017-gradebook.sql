-- Migration 017: Chấm & Bảng điểm theo lớp (FEAT-014, DEC-037 → DEC-041)
-- Chạy được nhiều lần. lib/db-pg.ts ensureSchema() chạy cùng DDL.

ALTER TABLE submissions ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ;
ALTER TABLE submissions ADD COLUMN IF NOT EXISTS reviewed_by VARCHAR(50);

ALTER TABLE lesson_attempts ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ;
ALTER TABLE lesson_attempts ADD COLUMN IF NOT EXISTS reviewed_by VARCHAR(50);
ALTER TABLE lesson_attempts ADD COLUMN IF NOT EXISTS teacher_feedback TEXT;
ALTER TABLE lesson_attempts ADD COLUMN IF NOT EXISTS last_grading_error TEXT;
-- lesson_attempts.status có thêm giá trị NEEDS_REVIEW (cột VARCHAR, không có CHECK).

CREATE TABLE IF NOT EXISTS class_grade_items (
  id VARCHAR(50) PRIMARY KEY,                 -- "cgi_" + uuid
  class_id VARCHAR(50) NOT NULL,
  item_kind VARCHAR(10) NOT NULL,             -- LESSON | EXAM
  item_id VARCHAR(50) NOT NULL,               -- lessons.id | exams.id
  finalized_at TIMESTAMPTZ,                   -- NULL = đang mở
  finalized_by VARCHAR(50),
  reopened_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (class_id, item_kind, item_id)
);

CREATE TABLE IF NOT EXISTS class_grades (
  id VARCHAR(50) PRIMARY KEY,                 -- "cgr_" + uuid
  class_id VARCHAR(50) NOT NULL,
  item_kind VARCHAR(10) NOT NULL,
  item_id VARCHAR(50) NOT NULL,
  student_id VARCHAR(50) NOT NULL,
  chosen_attempt_id VARCHAR(50),              -- NULL = tự lấy lượt cao nhất (BR-B03)
  manual_score10 NUMERIC,                     -- giáo viên nhập tay, ưu tiên hơn lượt
  note TEXT,
  attempt_id VARCHAR(50),                     -- ảnh chụp lúc chốt (BR-B08)
  raw_score NUMERIC,
  raw_max NUMERIC,
  score10 NUMERIC,
  passed BOOLEAN,
  finalized_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (class_id, item_kind, item_id, student_id)
);
CREATE INDEX IF NOT EXISTS idx_class_grades_student ON class_grades (student_id, class_id);
