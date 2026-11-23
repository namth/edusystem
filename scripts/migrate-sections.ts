// FEAT-017 TASK-061 (DEC-053) — chuyển dữ liệu cũ sang Phần, chạy MỘT LẦN cùng đợt deploy code FEAT-017.
//
//   npx vite-node --config vitest.config.ts scripts/migrate-sections.ts -- --dry-run   # chạy thử, ROLLBACK, in báo cáo
//   npx vite-node --config vitest.config.ts scripts/migrate-sections.ts                # chạy thật, COMMIT
//
// Việc làm (trong MỘT transaction):
//   1. Chạy DDL migration 019 (idempotent).
//   2. Mỗi đề / bài học: câu liền nhau cùng ngữ cảnh → một phần; câu dùng chung nhiều nơi → nhân bản; bài đọc của đề → phần đầu.
//   3. Tách câu gom nhiều ý (sub_questions của trắc nghiệm / trả lời ngắn) → mỗi ý một câu.
//   4. Xoá câu mồ côi (không thuộc phần nào); xoá bài nộp / lượt học thử và bảng điểm phụ thuộc (DEC-053).
//   5. Kiểm: tổng số câu (numberedCount) của mỗi đề / bài học trước = sau; lệch thì dừng (ROLLBACK), không ghi gì.
// Sau khi chạy thật xong: psql "$DATABASE_URL" -f docs/db-migration-020-drop-question-ids.sql (docs/15 §3).
import fs from "fs";
import path from "path";
import { Client } from "pg";
import { migrateAllToSections } from "../lib/section-migration";
import { loadTree, totalNumbered, type Queryable } from "../lib/exam-structure";

const DRY = process.argv.includes("--dry-run");
const KEEP_ATTEMPTS = process.argv.includes("--keep-attempts");

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("Thiếu DATABASE_URL");
  const client = new Client({ connectionString: url, ssl: /localhost|127\.0\.0\.1/.test(url) ? undefined : { rejectUnauthorized: false } });
  await client.connect();
  const db: Queryable = { query: async (t, p) => ({ rows: (await client.query(t, p as unknown[])).rows }) };
  const count = async (sql: string) => Number((await db.query(sql)).rows[0]?.n) || 0;

  await client.query("BEGIN");
  try {
    await client.query(fs.readFileSync(path.resolve(__dirname, "../docs/db-migration-019-sections.sql"), "utf8"));
    const before = {
      exams: await count("SELECT COUNT(*)::int n FROM exams"),
      lessons: await count("SELECT COUNT(*)::int n FROM lessons"),
      questions: await count("SELECT COUNT(*)::int n FROM questions"),
      submissions: await count("SELECT COUNT(*)::int n FROM submissions"),
      lesson_attempts: await count("SELECT COUNT(*)::int n FROM lesson_attempts"),
    };

    const { reports, split, created } = await migrateAllToSections(db, { split: true });

    // câu mồ côi: không đề / bài học nào tham chiếu (DEC-053)
    const orphans = await count("SELECT COUNT(*)::int n FROM questions WHERE section_id IS NULL");
    await db.query("DELETE FROM questions WHERE section_id IS NULL");

    let wiped = { submissions: 0, lesson_attempts: 0 };
    if (!KEEP_ATTEMPTS) {
      for (const t of ["class_grades", "class_grade_items"]) {
        const ok = (await db.query(`SELECT to_regclass('public.${t}')::text AS t`)).rows[0]?.t;
        if (ok) await db.query(`DELETE FROM ${t}`);
      }
      wiped = { submissions: before.submissions, lesson_attempts: before.lesson_attempts };
      await db.query("DELETE FROM submissions");
      await db.query("DELETE FROM lesson_attempts");
    }

    // kiểm tổng số câu trước = sau
    const mismatches: { kind: string; id: string; before: number; after: number }[] = [];
    for (const r of reports) {
      if (r.skipped) continue;
      const after = totalNumbered(await loadTree(db, r.kind, r.id));
      if (after !== r.numberedBefore) mismatches.push({ kind: r.kind, id: r.id, before: r.numberedBefore, after });
    }

    const after = {
      sections: await count("SELECT COUNT(*)::int n FROM sections"),
      questions: await count("SELECT COUNT(*)::int n FROM questions"),
      readOnlySections: await count("SELECT COUNT(*)::int n FROM sections s WHERE NOT EXISTS (SELECT 1 FROM questions q WHERE q.section_id = s.id)"),
    };
    const report = {
      mode: DRY ? "DRY-RUN (ROLLBACK)" : "THẬT (COMMIT)",
      before,
      after,
      parents: reports.length,
      skippedHasSections: reports.filter((r) => r.skipped === "HAS_SECTIONS").length,
      clonedShared: reports.reduce((n, r) => n + (r.cloned || 0), 0),
      missingQuestionIds: reports.reduce((n, r) => n + r.missing.length, 0),
      splitLegacy: { questions: split, created },
      orphansDeleted: orphans,
      wiped,
      mismatches,
      emptyParents: reports.filter((r) => !r.skipped && r.sections === 0).map((r) => `${r.kind}:${r.id}`),
    };
    console.log(JSON.stringify(report, null, 2));

    if (mismatches.length) {
      await client.query("ROLLBACK");
      console.error(`Dừng: ${mismatches.length} đề / bài học lệch số câu — không ghi gì.`);
      process.exitCode = 2;
    } else if (DRY) {
      await client.query("ROLLBACK");
      console.log("Chạy thử xong — đã ROLLBACK, DB không đổi.");
    } else {
      await client.query("COMMIT");
      console.log("Đã COMMIT. Bước tiếp: chạy docs/db-migration-020-drop-question-ids.sql.");
    }
  } catch (e) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw e;
  } finally {
    await client.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
