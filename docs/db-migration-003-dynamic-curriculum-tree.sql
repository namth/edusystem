-- ======================================================
-- MIGRATION 003: DYNAMIC CURRICULUM TREE & LESSON/EXAM HIERARCHY
-- ======================================================

-- 0. Ensure courses table exists and has seed data
CREATE TABLE IF NOT EXISTS courses (
  id           TEXT PRIMARY KEY,
  title        TEXT NOT NULL,
  description  TEXT,
  level        TEXT DEFAULT 'Intermediate',
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO courses (id, title, description, level)
VALUES
  ('crs_01', 'IELTS Intensive 7.5+ Masterclass', 'Lộ trình luyện thi IELTS 7.5 toàn diện 4 kỹ năng', 'Advanced'),
  ('crs_02', 'English Academic Writing & Speaking Booster', 'Khóa học nâng cao kỹ năng Viết & Nói Học Thuật', 'Intermediate'),
  ('crs_03', 'General English 4 Skills for Working Professionals', 'Tiếng Anh Giao Tiếp & Công Việc Tổng Hợp', 'Beginner')
ON CONFLICT (id) DO NOTHING;

-- 1. Create curriculum_items table for hierarchical syllabus trees
CREATE TABLE IF NOT EXISTS curriculum_items (
  id          TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  course_id   TEXT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  teacher_id  TEXT,
  parent_id   TEXT REFERENCES curriculum_items(id) ON DELETE CASCADE,
  title       TEXT NOT NULL,
  type        TEXT NOT NULL CHECK (type IN ('UNIT', 'LESSON', 'EXAM')),
  exam_id     TEXT REFERENCES exams(id) ON DELETE SET NULL,
  order_index INT DEFAULT 0,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Seed initial curriculum tree for seed courses if empty
INSERT INTO curriculum_items (id, course_id, parent_id, title, type, exam_id, order_index)
VALUES
  ('curr_unit_01', 'crs_01', NULL, 'Unit 1: IELTS Reading & Listening Mastery', 'UNIT', NULL, 1),
  ('curr_less_1_1', 'crs_01', 'curr_unit_01', 'Lesson 1.1: Academic Passage Skimming & Scanning', 'LESSON', 'test_01', 1),
  ('curr_less_1_2', 'crs_01', 'curr_unit_01', 'Lesson 1.2: Multiple Choice & Sentence Completion', 'LESSON', 'test_01', 2),
  ('curr_exam_mid', 'crs_01', NULL, 'Bài Thi Giữa Kỳ (Mid-Term Exam 60 Mins)', 'EXAM', 'test_01', 2),
  ('curr_unit_02', 'crs_01', NULL, 'Unit 2: Academic Writing Task 2 & Speaking Part 2', 'UNIT', NULL, 3),
  ('curr_less_2_1', 'crs_01', 'curr_unit_02', 'Lesson 2.1: Opinion Essay Structures', 'LESSON', 'test_01', 1),
  ('curr_less_2_2', 'crs_02', NULL, 'Lesson 1.1: Academic Paragraph Cohesion', 'LESSON', 'test_01', 1)
ON CONFLICT (id) DO NOTHING;
