-- Migration 004: bảng ghi danh lớp & giao bài cho lớp
-- DB thật (31/10/2026) chưa có hai bảng này dù giao diện đã dùng.
-- Chạy được nhiều lần (IF NOT EXISTS). lib/db-pg.ts ensureSchema() chạy cùng DDL.

CREATE TABLE IF NOT EXISTS enrollments (
  id VARCHAR(50) PRIMARY KEY,
  student_id VARCHAR(50) NOT NULL,
  class_id VARCHAR(50) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (student_id, class_id)
);
CREATE INDEX IF NOT EXISTS idx_enrollments_class ON enrollments (class_id);

CREATE TABLE IF NOT EXISTS class_assignments (
  id VARCHAR(50) PRIMARY KEY,
  class_id VARCHAR(50) NOT NULL,
  exam_id VARCHAR(50) NOT NULL,
  due_date TIMESTAMPTZ,
  max_attempts INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (class_id, exam_id)
);
CREATE INDEX IF NOT EXISTS idx_class_assignments_class ON class_assignments (class_id);
