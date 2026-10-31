-- Migration 005: cấu hình hệ thống dạng key/value (mô hình AI bóc tách đề — FEAT-009)
-- DB thật (31/10/2026) đã có bảng này; chạy được nhiều lần. lib/db-pg.ts ensureSchema() chạy cùng DDL.

CREATE TABLE IF NOT EXISTS system_settings (
  key VARCHAR(100) PRIMARY KEY,
  value JSONB NOT NULL,
  description TEXT,
  updated_by VARCHAR(255),
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO system_settings (key, value, description)
VALUES (
  'ai_exam_ingestion_model',
  '{"provider": "google", "model": "gemini-flash-lite-latest", "temperature": 0.1, "max_tokens": 8192}'::jsonb,
  'Mô hình AI sử dụng để bóc tách câu hỏi từ file DOCX/PDF/Ảnh'
) ON CONFLICT (key) DO NOTHING;
