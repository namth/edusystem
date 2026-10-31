-- Migration 007: người tạo câu hỏi (FEAT-010, DEC-004) — để API kiểm quyền sửa câu hỏi dùng chung đề & bài học.
-- Câu hỏi cũ có created_by = NULL; quyền sửa của chúng suy ra từ đề/bài học chứa câu hỏi (xem brief TASK-008).
-- Chạy được nhiều lần. lib/db-pg.ts ensureSchema() chạy cùng DDL.

ALTER TABLE questions ADD COLUMN IF NOT EXISTS created_by VARCHAR(50);
CREATE INDEX IF NOT EXISTS idx_questions_created_by ON questions (created_by);
