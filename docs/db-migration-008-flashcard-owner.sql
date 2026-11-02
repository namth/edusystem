-- Migration 008: người tạo flashcard (DEC-003 thư viện dùng chung) — mọi giáo viên đọc được,
-- chỉ người tạo (hoặc ADMIN) sửa/xoá; thẻ cũ created_by = NULL thuộc thư viện chung, giáo viên nào cũng sửa được.
-- Chạy được nhiều lần. lib/db-pg.ts ensureSchema() chạy cùng DDL.

ALTER TABLE flashcards ADD COLUMN IF NOT EXISTS created_by VARCHAR(50);
CREATE INDEX IF NOT EXISTS idx_flashcards_created_by ON flashcards (created_by);
