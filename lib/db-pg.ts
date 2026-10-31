import { Pool, QueryResult, QueryResultRow } from "pg";

const connectionString = process.env.DATABASE_URL;

let pool: Pool | null = null;
let schemaInitialized = false;

export function getPgPool(): Pool {
  const connStr = process.env.DATABASE_URL || connectionString;
  if (!connStr) {
    throw new Error("DATABASE_URL chưa được cấu hình.");
  }
  if (!pool) {
    pool = new Pool({
      connectionString: connStr,
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
    });

    pool.on("error", (err) => {
      console.error("Unexpected error on idle PostgreSQL client:", err);
    });
  }
  return pool;
}

export async function ensureSchema() {
  if (schemaInitialized) return;
  try {
    const p = getPgPool();
    await p.query(`
      CREATE TABLE IF NOT EXISTS users (
        id VARCHAR(50) PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        email VARCHAR(100) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL DEFAULT '123456',
        role VARCHAR(20) NOT NULL DEFAULT 'STUDENT',
        phone VARCHAR(50),
        target_band VARCHAR(100),
        slot_limit INT DEFAULT 250,
        status VARCHAR(20) DEFAULT 'ACTIVE',
        must_change_password BOOLEAN DEFAULT FALSE,
        reset_token VARCHAR(255),
        reset_token_expires TIMESTAMP,
        last_login_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      ALTER TABLE users ADD COLUMN IF NOT EXISTS password VARCHAR(255) DEFAULT '123456';
      ALTER TABLE users ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN DEFAULT FALSE;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_token VARCHAR(255);
      ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_token_expires TIMESTAMP;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS slot_limit INT DEFAULT 250;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'ACTIVE';
      ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMP;

      -- Expand column capacity
      ALTER TABLE users ALTER COLUMN target_band TYPE VARCHAR(100);
      ALTER TABLE users ALTER COLUMN phone TYPE VARCHAR(50);
      ALTER TABLE users ALTER COLUMN password TYPE VARCHAR(255);

      -- Dynamic Courses Table with Ownership
      CREATE TABLE IF NOT EXISTS courses (
        id VARCHAR(50) PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        description TEXT,
        created_by VARCHAR(50),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      ALTER TABLE courses ADD COLUMN IF NOT EXISTS created_by VARCHAR(50);

      -- Exam & Lesson Teacher Ownership Columns
      CREATE TABLE IF NOT EXISTS exams (
        id VARCHAR(50) PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        description TEXT,
        created_by VARCHAR(50),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS curriculum_items (
        id VARCHAR(50) PRIMARY KEY,
        course_id VARCHAR(50) NOT NULL,
        parent_id VARCHAR(50),
        title VARCHAR(255) NOT NULL,
        type VARCHAR(20) NOT NULL,
        exam_id VARCHAR(50),
        order_index INT DEFAULT 0,
        created_by VARCHAR(50),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      ALTER TABLE exams ADD COLUMN IF NOT EXISTS created_by VARCHAR(50);
      ALTER TABLE curriculum_items ADD COLUMN IF NOT EXISTS created_by VARCHAR(50);

      -- Auto-seed initial default courses for usr_teacher_01 if table is empty
      INSERT INTO courses (id, title, description, created_by, created_at)
      VALUES 
        ('crs_01', 'IELTS Academic Master 7.5', 'Khóa luyện thi IELTS Academic nâng cao mục tiêu 7.5+', 'usr_teacher_01', NOW()),
        ('crs_02', 'IELTS General Training 6.5', 'Khóa luyện thi IELTS General mục tiêu định cư 6.5', 'usr_teacher_01', NOW())
      ON CONFLICT (id) DO NOTHING;

      -- Default migration for legacy exams without owner
      UPDATE exams SET created_by = 'usr_teacher_01' WHERE created_by IS NULL OR created_by = '';
      UPDATE curriculum_items SET created_by = 'usr_teacher_01' WHERE created_by IS NULL OR created_by = '';
      UPDATE courses SET created_by = 'usr_teacher_01' WHERE created_by IS NULL OR created_by = '';

      -- Migration 004: bảng ghi danh lớp & giao bài cho lớp
      CREATE TABLE IF NOT EXISTS enrollments (
        id VARCHAR(50) PRIMARY KEY,
        student_id VARCHAR(50) NOT NULL,
        class_id VARCHAR(50) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE (student_id, class_id)
      );
      CREATE INDEX IF NOT EXISTS idx_enrollments_class ON enrollments (class_id);

      CREATE TABLE IF NOT EXISTS class_assignments (
        id VARCHAR(50) PRIMARY KEY,
        class_id VARCHAR(50) NOT NULL,
        exam_id VARCHAR(50) NOT NULL,
        due_date TIMESTAMPTZ,
        max_attempts INTEGER NOT NULL DEFAULT 1,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE (class_id, exam_id)
      );
      CREATE INDEX IF NOT EXISTS idx_class_assignments_class ON class_assignments (class_id);

      -- Migration 005: cấu hình hệ thống (mô hình AI bóc tách đề)
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

      -- Migration 006: Kho bài học & học theo lộ trình lớp (FEAT-010, DEC-002/007/010/012)
      CREATE TABLE IF NOT EXISTS lessons (
        id VARCHAR(50) PRIMARY KEY,                 -- "lsn_" + uuid
        title VARCHAR(255) NOT NULL,
        description TEXT,
        skills TEXT[] NOT NULL DEFAULT '{}',
        question_ids JSONB NOT NULL DEFAULT '[]',   -- thứ tự khối, trỏ bảng questions dùng chung
        created_by VARCHAR(50) NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_lessons_created_by ON lessons (created_by);

      ALTER TABLE curriculum_items ADD COLUMN IF NOT EXISTS lesson_id VARCHAR(50);
      DELETE FROM curriculum_items WHERE type = 'LESSON' AND lesson_id IS NULL;   -- DEC-012

      ALTER TABLE classes ADD COLUMN IF NOT EXISTS course_id TEXT;
      ALTER TABLE classes ADD COLUMN IF NOT EXISTS unlock_mode VARCHAR(20) NOT NULL DEFAULT 'MANUAL';
      ALTER TABLE classes ADD COLUMN IF NOT EXISTS pass_percent INTEGER NOT NULL DEFAULT 70;

      CREATE TABLE IF NOT EXISTS class_unlocks (
        class_id VARCHAR(50) NOT NULL,
        curriculum_item_id VARCHAR(50) NOT NULL,     -- unit hoặc bài/đề; mở unit = mở mọi mục con
        student_id VARCHAR(50),                      -- NULL = cả lớp; có giá trị = mở riêng cho HS bị kẹt (DEC-008)
        due_date TIMESTAMPTZ,
        unlocked_by VARCHAR(50) NOT NULL,
        unlocked_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE UNIQUE INDEX IF NOT EXISTS uq_class_unlocks
        ON class_unlocks (class_id, curriculum_item_id, COALESCE(student_id, ''));

      CREATE TABLE IF NOT EXISTS lesson_attempts (
        id VARCHAR(50) PRIMARY KEY,                  -- "att_" + uuid
        lesson_id VARCHAR(50) NOT NULL,
        class_id VARCHAR(50) NOT NULL,
        student_id VARCHAR(50) NOT NULL,
        answers JSONB NOT NULL DEFAULT '{}',
        results JSONB NOT NULL DEFAULT '[]',         -- kết quả từng câu (GradeResult[])
        objective_earned NUMERIC NOT NULL DEFAULT 0,
        objective_max NUMERIC NOT NULL DEFAULT 0,
        ai_earned NUMERIC,                           -- NULL khi chưa chấm AI
        ai_max NUMERIC NOT NULL DEFAULT 0,
        score_percent NUMERIC,                       -- NULL khi còn GRADING
        status VARCHAR(20) NOT NULL DEFAULT 'GRADED',-- GRADING | GRADED | AI_SKIPPED
        created_at TIMESTAMPTZ DEFAULT NOW(),
        graded_at TIMESTAMPTZ
      );
      CREATE INDEX IF NOT EXISTS idx_lesson_attempts_lookup ON lesson_attempts (class_id, student_id, lesson_id);

      ALTER TABLE questions ADD COLUMN IF NOT EXISTS created_by VARCHAR(50);
      CREATE INDEX IF NOT EXISTS idx_questions_created_by ON questions (created_by);
    `);
    schemaInitialized = true;
  } catch (err) {
    console.warn("Schema initialization warning:", err);
  }
}

export async function queryPg<T extends QueryResultRow = any>(
  text: string,
  params?: any[]
): Promise<QueryResult<T>> {
  await ensureSchema();
  const p = getPgPool();
  return await p.query<T>(text, params);
}
