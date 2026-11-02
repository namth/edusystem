-- Migration 014: Nhật ký gọi AI & bảng giá model AI (FEAT-013, DEC-034)
-- Chạy lặp được. lib/db-pg.ts ensureSchema() chạy cùng DDL.

CREATE TABLE IF NOT EXISTS ai_usage_logs (
  id VARCHAR(50) PRIMARY KEY,
  teacher_id VARCHAR(50),
  student_id VARCHAR(50),
  submission_id VARCHAR(50),
  model VARCHAR(100),
  prompt_tokens INT DEFAULT 0,
  completion_tokens INT DEFAULT 0,
  total_tokens INT DEFAULT 0,
  cost_usd NUMERIC(10,6) DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE ai_usage_logs ADD COLUMN IF NOT EXISTS purpose VARCHAR(30);
ALTER TABLE ai_usage_logs ADD COLUMN IF NOT EXISTS lesson_attempt_id VARCHAR(50);
ALTER TABLE ai_usage_logs ADD COLUMN IF NOT EXISTS provider VARCHAR(30);

CREATE INDEX IF NOT EXISTS idx_ai_usage_logs_created ON ai_usage_logs (created_at);
CREATE INDEX IF NOT EXISTS idx_ai_usage_logs_teacher ON ai_usage_logs (teacher_id, created_at);

INSERT INTO system_settings (key, value, description) VALUES
  ('ai_pricing', '{"usd_vnd_rate":26000,"models":{}}', 'Giá model AI USD / 1 triệu token input-output, tỷ giá USD→VND')
ON CONFLICT (key) DO NOTHING;
