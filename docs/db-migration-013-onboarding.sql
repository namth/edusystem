-- Migration 013: Đăng ký kiểu phỏng vấn, tên đăng nhập & giáo viên dùng thử (FEAT-012, DEC-026…028)
ALTER TABLE users ADD COLUMN IF NOT EXISTS username VARCHAR(30);
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username ON users (LOWER(username));
ALTER TABLE users ADD COLUMN IF NOT EXISTS email_is_placeholder BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS grade_level VARCHAR(30);
ALTER TABLE users ADD COLUMN IF NOT EXISTS learning_goals JSONB;
-- NULL với STUDENT/ADMIN; giáo viên: TRIAL | VERIFIED | REJECTED
ALTER TABLE users ADD COLUMN IF NOT EXISTS teacher_status VARCHAR(20);
UPDATE users SET teacher_status = 'VERIFIED' WHERE role = 'TEACHER' AND teacher_status IS NULL;
CREATE INDEX IF NOT EXISTS idx_users_teacher_status ON users (teacher_status);

CREATE TABLE IF NOT EXISTS teacher_profiles (
  user_id VARCHAR(50) PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  answers JSONB NOT NULL,
  reviewed_by VARCHAR(50),
  reviewed_at TIMESTAMPTZ,
  review_note TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
