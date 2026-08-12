-- ======================================================
-- MIGRATION 002: EXAM TAXONOMY & HIERARCHICAL BINDING
-- ======================================================

-- 1. Create exam_categories table
CREATE TABLE IF NOT EXISTS exam_categories (
  id           TEXT PRIMARY KEY,
  name         TEXT NOT NULL,
  code         TEXT UNIQUE NOT NULL,
  description  TEXT,
  display_order INT DEFAULT 0,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Add category & taxonomy columns to exams table
ALTER TABLE exams 
  ADD COLUMN IF NOT EXISTS category_id TEXT REFERENCES exam_categories(id),
  ADD COLUMN IF NOT EXISTS target_level TEXT DEFAULT 'Intermediate',
  ADD COLUMN IF NOT EXISTS is_template BOOLEAN DEFAULT FALSE;

-- 3. Create lesson_exams junction table (binding exams to specific lessons)
CREATE TABLE IF NOT EXISTS lesson_exams (
  id           TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  lesson_id    TEXT NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
  exam_id      TEXT NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
  order_index  INT DEFAULT 1,
  is_required  BOOLEAN DEFAULT TRUE,
  weight       NUMERIC(3,2) DEFAULT 1.00,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(lesson_id, exam_id)
);

-- 4. Create course_exams junction table (binding mock/final exams to courses)
CREATE TABLE IF NOT EXISTS course_exams (
  id           TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  course_id    TEXT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  exam_id      TEXT NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
  exam_scope   TEXT DEFAULT 'FINAL_EXAM', -- 'ENTRY_TEST', 'MID_TERM', 'FINAL_EXAM'
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(course_id, exam_id)
);

-- 5. Seed default exam categories
INSERT INTO exam_categories (id, name, code, description, display_order)
VALUES
  ('cat_placement', 'Bài Thi Đầu Vào (Placement Test)', 'PLACEMENT_TEST', 'Đánh giá trình độ học sinh khi nhập học', 1),
  ('cat_lesson_quiz', 'Bài Kiểm Tra Theo Bài Học (Lesson Quiz)', 'LESSON_QUIZ', 'Bài kiểm tra ngắn 10-15 phút sau mỗi bài học', 2),
  ('cat_unit_test', 'Bài Kiểm Tra Theo Chương (Unit Test)', 'UNIT_TEST', 'Kiểm tra tổng hợp cuối mỗi chủ đề/chương', 3),
  ('cat_mid_term', 'Bài Thi Giữa Kỳ (Mid-Term Exam)', 'MID_TERM', 'Đánh giá tiến độ giữa khóa học', 4),
  ('cat_final_exam', 'Bài Thi Cuối Khóa (Final Exam)', 'FINAL_EXAM', 'Đánh giá tổng kết kết quả khóa học', 5),
  ('cat_full_mock', 'Đề Thi Thử Chuẩn (Full Mock Exam)', 'MOCK_EXAM', 'Bộ đề mô phỏng cấu trúc thi thật (IELTS/TOEIC)', 6)
ON CONFLICT (id) DO NOTHING;
