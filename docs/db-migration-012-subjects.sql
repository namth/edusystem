-- Migration 012: Nền tảng đa môn — bảng subjects + subject_id cho courses, exams, lessons
-- Chạy được nhiều lần. lib/db-pg.ts ensureSchema() chạy cùng DDL.

CREATE TABLE IF NOT EXISTS subjects (
  id VARCHAR(50) PRIMARY KEY,
  code VARCHAR(60) NOT NULL,
  name VARCHAR(100) NOT NULL,
  icon VARCHAR(40),
  color VARCHAR(20),
  mode VARCHAR(20) NOT NULL DEFAULT 'SIMPLE' CHECK (mode IN ('LANGUAGE', 'SIMPLE')),
  owner_id VARCHAR(50) NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  order_index INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_subjects_owner_code
  ON subjects (COALESCE(owner_id, ''), LOWER(code));

INSERT INTO subjects (id, code, name, icon, color, mode, owner_id, is_active, order_index)
VALUES ('english', 'english', 'Tiếng Anh', 'languages', '#1453e0', 'LANGUAGE', NULL, TRUE, 0)
ON CONFLICT (id) DO NOTHING;

ALTER TABLE courses ADD COLUMN IF NOT EXISTS subject_id VARCHAR(50) DEFAULT 'english';
UPDATE courses SET subject_id = 'english' WHERE subject_id IS NULL;
CREATE INDEX IF NOT EXISTS idx_courses_subject_id ON courses (subject_id);

ALTER TABLE exams ADD COLUMN IF NOT EXISTS subject_id VARCHAR(50) DEFAULT 'english';
UPDATE exams SET subject_id = 'english' WHERE subject_id IS NULL;
CREATE INDEX IF NOT EXISTS idx_exams_subject_id ON exams (subject_id);

ALTER TABLE lessons ADD COLUMN IF NOT EXISTS subject_id VARCHAR(50) DEFAULT 'english';
UPDATE lessons SET subject_id = 'english' WHERE subject_id IS NULL;
CREATE INDEX IF NOT EXISTS idx_lessons_subject_id ON lessons (subject_id);
