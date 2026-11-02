// Postgres thật chạy trong bộ nhớ (PGlite) để test API route dùng queryPg.
// Schema nền mô phỏng các bảng của DB thật (31/10/2026) + migration trong docs/.
import fs from "fs";
import path from "path";
import { PGlite } from "@electric-sql/pglite";

const BASE_SCHEMA = `
CREATE TABLE users (
  id VARCHAR(50) PRIMARY KEY, name VARCHAR(100) NOT NULL, email VARCHAR(100) UNIQUE NOT NULL,
  role VARCHAR(20) NOT NULL DEFAULT 'STUDENT', phone VARCHAR(50), target_band VARCHAR(100),
  password VARCHAR(255), status VARCHAR(20) DEFAULT 'ACTIVE', created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  -- FEAT-012 (migration 013, ensureSchema thêm trên DB thật)
  username VARCHAR(30), email_is_placeholder BOOLEAN NOT NULL DEFAULT FALSE, teacher_status VARCHAR(20)
);
CREATE TABLE classes (
  id VARCHAR(50) PRIMARY KEY, name VARCHAR(150) NOT NULL, code VARCHAR(20) UNIQUE NOT NULL,
  teacher_id VARCHAR(50) NOT NULL, max_slots INTEGER DEFAULT 30, schedule VARCHAR(100),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, status TEXT, course_id TEXT, unlocked_progress JSONB
);
CREATE TABLE exams (
  id VARCHAR(50) PRIMARY KEY, title VARCHAR(255) NOT NULL, duration_minutes INTEGER DEFAULT 60,
  skills TEXT[], created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, stimulus_type VARCHAR(50),
  stimulus_text TEXT, stimulus_audio_url TEXT, passing_score NUMERIC, question_ids JSONB, created_by VARCHAR(50)
);
CREATE TABLE submissions (
  id VARCHAR(50) PRIMARY KEY, exam_id VARCHAR(50) NOT NULL, student_id VARCHAR(50) NOT NULL,
  answers JSONB NOT NULL, ai_score NUMERIC(3,1), ai_feedback TEXT, final_score NUMERIC(3,1),
  final_feedback TEXT, status VARCHAR(30) DEFAULT 'AI_GRADED', created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  grading_attempts INTEGER, last_grading_error TEXT, teacher_review JSONB, class_id UUID,
  submitted_at TIMESTAMPTZ, graded_at TIMESTAMPTZ
);
CREATE TABLE questions (
  id VARCHAR(50) PRIMARY KEY, skill VARCHAR(50), category VARCHAR(80), prompt TEXT, content JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(), stimulus_text TEXT, stimulus_audio_url TEXT
);
CREATE TABLE flashcards (
  id VARCHAR(50) PRIMARY KEY, vietnamese_name VARCHAR(255), correct_english_word VARCHAR(255),
  options JSONB, image_url TEXT, audio_url TEXT, created_at TIMESTAMPTZ DEFAULT NOW()
);
`;

export async function createFakePg(migrations: string[] = []) {
  const db = new PGlite();
  await db.exec(BASE_SCHEMA);
  for (const m of migrations) {
    await db.exec(fs.readFileSync(path.resolve(__dirname, "../../docs", m), "utf8"));
  }
  const calls: { sql: string; params: unknown[] }[] = [];
  async function queryPg(sql: string, params: unknown[] = []) {
    calls.push({ sql, params });
    const res = await db.query(sql, params as any[]);
    return { rows: res.rows as any[], rowCount: res.affectedRows ?? res.rows.length };
  }
  return { db, queryPg, calls };
}
