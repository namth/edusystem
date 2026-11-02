-- Migration 010: thông báo trong ứng dụng (DEC-021) — học sinh nhận khi bài thi có điểm,
-- giáo viên nhận khi có bài chờ chấm tay. Một thông báo cho mỗi (người nhận, loại, bài nộp);
-- chấm lại thì cập nhật nội dung và đánh dấu chưa đọc.
-- Chạy được nhiều lần. lib/db-pg.ts ensureSchema() chạy cùng DDL.

CREATE TABLE IF NOT EXISTS notifications (
  id VARCHAR(60) PRIMARY KEY,
  user_id VARCHAR(50) NOT NULL,
  type VARCHAR(40) NOT NULL,          -- EXAM_GRADED | EXAM_NEEDS_REVIEW
  title VARCHAR(255) NOT NULL,
  body TEXT,
  link TEXT,
  ref_id VARCHAR(60) NOT NULL,        -- id bài nộp (submissions.id)
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_notifications_user_type_ref ON notifications (user_id, type, ref_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_created ON notifications (user_id, created_at DESC);
