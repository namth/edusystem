-- Migration 020: bỏ cột cũ sau khi chuyển sang Phần (FEAT-017, DEC-051, DEC-053)
-- CHẠY TAY MỘT LẦN, sau khi scripts/migrate-sections.ts chạy thật thành công (docs/15 §3).
-- Không nằm trong ensureSchema. Sao lưu bảng exams, lessons, questions trước khi chạy.

BEGIN;

-- an toàn: không còn câu nào chưa thuộc phần
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM questions WHERE section_id IS NULL) THEN
    RAISE EXCEPTION 'Còn câu hỏi chưa thuộc phần nào — chạy scripts/migrate-sections.ts trước';
  END IF;
END $$;

ALTER TABLE exams DROP COLUMN IF EXISTS question_ids;
ALTER TABLE exams DROP COLUMN IF EXISTS stimulus_type;
ALTER TABLE exams DROP COLUMN IF EXISTS stimulus_text;
ALTER TABLE exams DROP COLUMN IF EXISTS stimulus_audio_url;
ALTER TABLE lessons DROP COLUMN IF EXISTS question_ids;
ALTER TABLE questions DROP COLUMN IF EXISTS stimulus_text;
ALTER TABLE questions DROP COLUMN IF EXISTS stimulus_audio_url;

UPDATE questions SET position = 0 WHERE position IS NULL;
ALTER TABLE questions ALTER COLUMN section_id SET NOT NULL;
ALTER TABLE questions ALTER COLUMN position SET NOT NULL;

COMMIT;
