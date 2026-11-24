// Postgres thật chạy trong bộ nhớ (PGlite) để test API route dùng queryPg.
// Schema nền mô phỏng các bảng của DB thật (31/10/2026) + migration trong docs/.
import fs from "fs";
import path from "path";
import { PGlite } from "@electric-sql/pglite";
import { sectionizeParent } from "@/lib/section-migration";

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
  const origQuery = db.query.bind(db);
  const origExec = db.exec.bind(db);
  db.query = (async (sql: any, params?: any) => {
    if (typeof sql === "string" && sql.includes("lesson_attempts") && sql.includes("submitted_at")) {
      try {
        await origQuery("ALTER TABLE lesson_attempts ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMPTZ");
      } catch {}
    }
    return origQuery(sql, params);
  }) as any;
  db.exec = (async (sql: any) => {
    const res = await origExec(sql);
    try {
      await origQuery("ALTER TABLE lesson_attempts ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMPTZ");
    } catch {}
    return res;
  }) as any;

  await db.exec(BASE_SCHEMA);
  for (const m of migrations) {
    await db.exec(fs.readFileSync(path.resolve(__dirname, "../../docs", m), "utf8"));
  }
  const calls: { sql: string; params: unknown[] }[] = [];
  // FEAT-017: dữ liệu test cũ seed bằng question_ids + stimulus ở câu → tự gom thành phần (migration 019 + script
  // TASK-061, không tách sub_questions) trước mỗi truy vấn của code ứng dụng. Đề / bài học đã có phần thì bỏ qua.
  // Bảng lessons tối thiểu (đủ cột của migration 006 + 012) để migration 019 tạo được khoá ngoại ngay từ đầu.
  await origExec(`CREATE TABLE IF NOT EXISTS lessons (id VARCHAR(50) PRIMARY KEY, title VARCHAR(255), description TEXT,
    skills TEXT[] NOT NULL DEFAULT '{}', question_ids JSONB NOT NULL DEFAULT '[]', created_by VARCHAR(50),
    subject_id VARCHAR(50), created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW())`);
  await origExec(fs.readFileSync(path.resolve(__dirname, "../../docs/db-migration-019-sections.sql"), "utf8"));
  const raw = { query: async (q: string, p?: unknown[]) => ({ rows: (await origQuery(q, p as Parameters<typeof origQuery>[1])).rows as Record<string, unknown>[] }) };
  // Dấu vân tay dữ liệu cũ của từng đề / bài học: seed đổi (thêm câu, đổi ngữ cảnh) thì gom lại các phần tự sinh.
  const autoSig = new Map<string, string>();
  const autoIds = new Set<string>();
  async function autoSections() {
    for (const [kind, table, col] of [["exam", "exams", "exam_id"], ["lesson", "lessons", "lesson_id"]] as const) {
      const parents = (await raw.query(`SELECT * FROM ${table}`)).rows;
      for (const p of parents) {
        let qids: string[] = [];
        if (Array.isArray(p.question_ids)) qids = p.question_ids as string[];
        else if (typeof p.question_ids === "string") { try { qids = JSON.parse(p.question_ids); } catch { qids = []; } }
        const sigOf = async () => {
          const qs = qids.length ? (await raw.query("SELECT id, category, prompt, content, stimulus_text, stimulus_audio_url FROM questions WHERE id = ANY($1) ORDER BY id", [qids])).rows : [];
          return JSON.stringify([qids, qs, p.stimulus_text ?? null, p.stimulus_audio_url ?? null]);
        };
        const sig = await sigOf();
        const key = `${kind}:${p.id}`;
        const secs = (await raw.query(`SELECT id FROM sections WHERE ${col} = $1`, [p.id])).rows;
        if (secs.length) {
          // chỉ gom lại khi mọi phần hiện có đều do helper tự sinh và seed đã đổi; phần do API lưu thì không đụng
          if (!autoSig.has(key) || autoSig.get(key) === sig || !secs.every((s) => autoIds.has(String(s.id)))) continue;
          const ids = secs.map((s) => s.id);
          await raw.query("UPDATE questions SET section_id = NULL WHERE section_id = ANY($1)", [ids]);
          await raw.query("DELETE FROM sections WHERE id = ANY($1)", [ids]);
        }
        if (!qids.length && !p.stimulus_text && !p.stimulus_audio_url) continue;
        await sectionizeParent(raw, kind, String(p.id));
        for (const s of (await raw.query(`SELECT id FROM sections WHERE ${col} = $1`, [p.id])).rows) autoIds.add(String(s.id));
        autoSig.set(key, await sigOf());
      }
    }
  }
  async function queryPg(sql: string, params: unknown[] = []) {
    if (!/^\s*(BEGIN|COMMIT|ROLLBACK)\b/i.test(sql)) await autoSections();
    calls.push({ sql, params });
    const res = await db.query(sql, params as any[]);
    return { rows: res.rows as any[], rowCount: res.affectedRows ?? res.rows.length };
  }
  return { db, queryPg, calls };
}
