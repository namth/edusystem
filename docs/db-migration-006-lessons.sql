-- Migration 006: Kho bài học & học theo lộ trình lớp (FEAT-010, DEC-002/007/010/012)
-- Chạy được nhiều lần. lib/db-pg.ts ensureSchema() chạy cùng DDL.

CREATE TABLE IF NOT EXISTS lessons (
  id VARCHAR(50) PRIMARY KEY,                 -- "lsn_" + uuid
  title VARCHAR(255) NOT NULL,
  description TEXT,
  skills TEXT[] NOT NULL DEFAULT '{}',
  question_ids JSONB NOT NULL DEFAULT '[]',   -- thứ tự khối, trỏ bảng questions dùng chung
  created_by VARCHAR(50) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_lessons_created_by ON lessons (created_by);

ALTER TABLE curriculum_items ADD COLUMN IF NOT EXISTS lesson_id VARCHAR(50);
DELETE FROM curriculum_items WHERE type = 'LESSON' AND lesson_id IS NULL;   -- DEC-012

ALTER TABLE classes ADD COLUMN IF NOT EXISTS course_id TEXT;
ALTER TABLE classes ADD COLUMN IF NOT EXISTS unlock_mode VARCHAR(20) NOT NULL DEFAULT 'MANUAL';
ALTER TABLE classes ADD COLUMN IF NOT EXISTS pass_percent INTEGER NOT NULL DEFAULT 70;

CREATE TABLE IF NOT EXISTS class_unlocks (
  class_id VARCHAR(50) NOT NULL,
  curriculum_item_id VARCHAR(50) NOT NULL,     -- unit hoặc bài/đề; mở unit = mở mọi mục con
  student_id VARCHAR(50),                      -- NULL = cả lớp; có giá trị = mở riêng cho HS bị kẹt (DEC-008)
  due_date TIMESTAMPTZ,
  unlocked_by VARCHAR(50) NOT NULL,
  unlocked_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_class_unlocks
  ON class_unlocks (class_id, curriculum_item_id, COALESCE(student_id, ''));

CREATE TABLE IF NOT EXISTS lesson_attempts (
  id VARCHAR(50) PRIMARY KEY,                  -- "att_" + uuid
  lesson_id VARCHAR(50) NOT NULL,
  class_id VARCHAR(50) NOT NULL,
  student_id VARCHAR(50) NOT NULL,
  answers JSONB NOT NULL DEFAULT '{}',
  results JSONB NOT NULL DEFAULT '[]',         -- kết quả từng câu (GradeResult[])
  objective_earned NUMERIC NOT NULL DEFAULT 0,
  objective_max NUMERIC NOT NULL DEFAULT 0,
  ai_earned NUMERIC,                           -- NULL khi chưa chấm AI
  ai_max NUMERIC NOT NULL DEFAULT 0,
  score_percent NUMERIC,                       -- NULL khi còn GRADING
  status VARCHAR(20) NOT NULL DEFAULT 'GRADED',-- GRADING | GRADED | AI_SKIPPED
  created_at TIMESTAMPTZ DEFAULT NOW(),
  graded_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_lesson_attempts_lookup ON lesson_attempts (class_id, student_id, lesson_id);
