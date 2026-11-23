-- Migration 019: Bài học & đề thi theo Phần (FEAT-017, DEC-051 → DEC-054)
-- Chạy được nhiều lần. lib/db-pg.ts ensureSchema() chạy cùng DDL.
-- Cột cũ (question_ids, stimulus_*) bỏ ở migration 020, sau khi script chuyển dữ liệu chạy xong.

CREATE TABLE IF NOT EXISTS sections (
  id VARCHAR(50) PRIMARY KEY,                      -- "sec_" + uuid
  exam_id VARCHAR(50) REFERENCES exams(id) ON DELETE CASCADE,
  lesson_id VARCHAR(50) REFERENCES lessons(id) ON DELETE CASCADE,
  position INTEGER NOT NULL DEFAULT 0,
  skill VARCHAR(20) NOT NULL DEFAULT 'Reading',    -- Reading | Listening | Writing | Speaking
  instruction TEXT,                                -- lời dẫn
  stimulus_type VARCHAR(20) NOT NULL DEFAULT 'NONE' CHECK (stimulus_type IN ('NONE','TEXT_ONLY','AUDIO_ONLY','COMBINED')),
  stimulus_text TEXT,                              -- HTML, ảnh nhúng trong HTML
  stimulus_audio_url TEXT,
  stimulus_audio_text TEXT,                        -- nội dung đọc bằng TTS
  stimulus_audio_gender VARCHAR(10),
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT sections_one_parent CHECK ((exam_id IS NULL) <> (lesson_id IS NULL))
);
CREATE INDEX IF NOT EXISTS idx_sections_exam ON sections (exam_id, position) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_sections_lesson ON sections (lesson_id, position) WHERE deleted_at IS NULL;

ALTER TABLE questions ADD COLUMN IF NOT EXISTS section_id VARCHAR(50) REFERENCES sections(id) ON DELETE CASCADE;
ALTER TABLE questions ADD COLUMN IF NOT EXISTS position INTEGER;
ALTER TABLE questions ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE questions ADD COLUMN IF NOT EXISTS created_by VARCHAR(50);
CREATE INDEX IF NOT EXISTS idx_questions_section ON questions (section_id, position) WHERE deleted_at IS NULL;

ALTER TABLE exams ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE lessons ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
