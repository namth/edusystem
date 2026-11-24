-- Migration 018: Kênh cảnh báo admin (FEAT-016, DEC-047, DEC-048)
-- Chạy được nhiều lần. lib/db-pg.ts ensureSchema() chạy cùng DDL.

CREATE TABLE IF NOT EXISTS admin_alerts (
  id TEXT PRIMARY KEY,                         -- "alr_" + uuid
  fingerprint TEXT NOT NULL UNIQUE,
  level TEXT NOT NULL CHECK (level IN ('ERROR','WARN','INFO')),
  source TEXT NOT NULL CHECK (source IN ('API','SERVER','AI','WORKER','EXAM_IMPORT')),
  title TEXT NOT NULL,
  detail JSONB NOT NULL DEFAULT '{}'::jsonb,   -- mẫu gần nhất, đã làm sạch PII
  occurrences INTEGER NOT NULL DEFAULT 1,
  unsent_count INTEGER NOT NULL DEFAULT 0,     -- số lần xảy ra từ tin Telegram gần nhất
  status TEXT NOT NULL DEFAULT 'NEW' CHECK (status IN ('NEW','RESOLVED')),
  first_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_notified_at TIMESTAMPTZ,
  resolved_at TIMESTAMPTZ,
  resolved_by TEXT
);
CREATE INDEX IF NOT EXISTS idx_admin_alerts_status_last ON admin_alerts (status, last_seen_at DESC);
