import { Pool, QueryResult, QueryResultRow } from "pg";

const connectionString =
  process.env.DATABASE_URL ||
  "postgresql://postgres:qereQScNVoecP8Kd@db.owlvfznycutvkrvgbiot.supabase.co:5432/postgres";

let pool: Pool | null = null;
let schemaInitialized = false;

export function getPgPool(): Pool {
  if (!pool) {
    pool = new Pool({
      connectionString,
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
