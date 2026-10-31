// TASK-007 — Migration 006 (FEAT-010): chạy được trên Postgres thật, chạy lặp được, xoá nút LESSON cũ.
// File do trưởng phòng viết, bị khoá.
import { describe, it, expect } from "vitest";
import fs from "fs";
import { PGlite } from "@electric-sql/pglite";

const MIGRATION = fs.readFileSync("docs/db-migration-006-lessons.sql", "utf8");

async function setup() {
  const db = new PGlite();
  await db.exec(`
    CREATE TABLE classes (id VARCHAR(50) PRIMARY KEY, name VARCHAR(150), code VARCHAR(20), teacher_id VARCHAR(50), max_slots INT DEFAULT 30);
    CREATE TABLE curriculum_items (
      id VARCHAR(50) PRIMARY KEY, course_id VARCHAR(50) NOT NULL, parent_id VARCHAR(50), title VARCHAR(255) NOT NULL,
      type VARCHAR(20) NOT NULL, exam_id VARCHAR(50), order_index INT DEFAULT 0, created_by VARCHAR(50)
    );
    INSERT INTO classes (id,name,code,teacher_id) VALUES ('c1','Lớp','ABC','t1');
    INSERT INTO curriculum_items (id,course_id,parent_id,title,type,exam_id) VALUES
      ('U1','co1',NULL,'Unit','UNIT',NULL), ('L1','co1','U1','Bài cũ','LESSON',NULL), ('E1','co1','U1','Đề','EXAM','e1');
  `);
  return db;
}
const cols = async (db: PGlite, table: string) =>
  (await db.query<{ column_name: string }>(`SELECT column_name FROM information_schema.columns WHERE table_name = $1`, [table])).rows.map((r) => r.column_name);

describe("docs/db-migration-006-lessons.sql", () => {
  it("chạy thành công và chạy lại lần 2 không lỗi", async () => {
    const db = await setup();
    await db.exec(MIGRATION);
    await db.exec(MIGRATION);
  });

  it("tạo bảng lessons, class_unlocks, lesson_attempts và cột mới", async () => {
    const db = await setup();
    await db.exec(MIGRATION);
    expect(await cols(db, "lessons")).toEqual(expect.arrayContaining(["id", "title", "description", "skills", "question_ids", "created_by", "created_at", "updated_at"]));
    expect(await cols(db, "class_unlocks")).toEqual(expect.arrayContaining(["class_id", "curriculum_item_id", "student_id", "due_date", "unlocked_by", "unlocked_at"]));
    expect(await cols(db, "lesson_attempts")).toEqual(expect.arrayContaining([
      "id", "lesson_id", "class_id", "student_id", "answers", "results", "objective_earned", "objective_max",
      "ai_earned", "ai_max", "score_percent", "status", "created_at", "graded_at",
    ]));
    expect(await cols(db, "curriculum_items")).toContain("lesson_id");
    expect(await cols(db, "classes")).toEqual(expect.arrayContaining(["course_id", "unlock_mode", "pass_percent"]));
  });

  it("lớp cũ nhận mặc định unlock_mode = MANUAL, pass_percent = 70", async () => {
    const db = await setup();
    await db.exec(MIGRATION);
    const row = (await db.query<any>(`SELECT unlock_mode, pass_percent FROM classes WHERE id='c1'`)).rows[0];
    expect(row).toEqual({ unlock_mode: "MANUAL", pass_percent: 70 });
  });

  it("xoá nút LESSON chưa có lesson_id, giữ UNIT và EXAM (DEC-012)", async () => {
    const db = await setup();
    await db.exec(MIGRATION);
    const ids = (await db.query<any>(`SELECT id FROM curriculum_items ORDER BY id`)).rows.map((r) => r.id);
    expect(ids).toEqual(["E1", "U1"]);
  });

  it("class_unlocks: không trùng (lớp, mục) cho cả lớp, nhưng cho phép thêm dòng mở riêng từng học sinh", async () => {
    const db = await setup();
    await db.exec(MIGRATION);
    await db.exec(`INSERT INTO class_unlocks (class_id, curriculum_item_id, unlocked_by) VALUES ('c1','U1','t1')`);
    await expect(db.exec(`INSERT INTO class_unlocks (class_id, curriculum_item_id, unlocked_by) VALUES ('c1','U1','t1')`)).rejects.toThrow();
    await db.exec(`INSERT INTO class_unlocks (class_id, curriculum_item_id, student_id, unlocked_by) VALUES ('c1','U1','s1','t1')`);
    await expect(db.exec(`INSERT INTO class_unlocks (class_id, curriculum_item_id, student_id, unlocked_by) VALUES ('c1','U1','s1','t1')`)).rejects.toThrow();
  });

  it("lessons.question_ids và skills có mặc định rỗng; lesson_attempts.status mặc định GRADED", async () => {
    const db = await setup();
    await db.exec(MIGRATION);
    await db.exec(`INSERT INTO lessons (id, title, created_by) VALUES ('lsn_1','Bài','t1')`);
    expect((await db.query<any>(`SELECT question_ids, skills FROM lessons`)).rows[0]).toEqual({ question_ids: [], skills: [] });
    await db.exec(`INSERT INTO lesson_attempts (id, lesson_id, class_id, student_id) VALUES ('att_1','lsn_1','c1','s1')`);
    expect((await db.query<any>(`SELECT status FROM lesson_attempts`)).rows[0].status).toBe("GRADED");
  });
});

describe("lib/db-pg.ts ensureSchema chạy cùng DDL migration 006", () => {
  const src = fs.readFileSync("lib/db-pg.ts", "utf8");
  for (const needle of [
    /CREATE TABLE IF NOT EXISTS lessons/i,
    /CREATE TABLE IF NOT EXISTS class_unlocks/i,
    /CREATE TABLE IF NOT EXISTS lesson_attempts/i,
    /ALTER TABLE curriculum_items ADD COLUMN IF NOT EXISTS lesson_id/i,
    /ALTER TABLE classes ADD COLUMN IF NOT EXISTS unlock_mode/i,
    /ALTER TABLE classes ADD COLUMN IF NOT EXISTS pass_percent/i,
    /DELETE FROM curriculum_items WHERE type = 'LESSON' AND lesson_id IS NULL/i,
  ]) {
    it(String(needle), () => expect(src).toMatch(needle));
  }
});
