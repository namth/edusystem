// FEAT-017 TASK-061 — TC-P17, TC-P18: chuyển dữ liệu cũ sang Phần (DEC-053) và code không còn đọc định dạng cũ.
import { describe, it, expect, beforeEach } from "vitest";
import fs from "fs";
import path from "path";
import { createFakePg } from "./helpers/pg-fake";
import { migrateAllToSections } from "@/lib/section-migration";
import { loadTree, totalNumbered, type Queryable } from "@/lib/exam-structure";
import { gradeQuestion } from "@/lib/grading";

let pg: Awaited<ReturnType<typeof createFakePg>>;
let db: Queryable;
const rows = async (sql: string, p?: unknown[]) => (await pg.db.query<Record<string, unknown>>(sql, p as never)).rows;

const MC2 = '{"sub_questions":[{"id":"a","number":1,"text":"1?","option_a":"x","option_b":"y","correct_answer":"A"},{"id":"b","number":2,"text":"2?","option_a":"x","option_b":"y","correct_answer":"fast","option_c":"fast"}]}';

beforeEach(async () => {
  pg = await createFakePg();
  // đọc / ghi thẳng PGlite (không qua queryPg của helper để không tự gom phần)
  db = { query: async (t, p) => ({ rows: (await pg.db.query<Record<string, unknown>>(t, p as never)).rows }) };
  await pg.db.exec(`
    INSERT INTO questions (id, skill, category, prompt, content, stimulus_text, stimulus_audio_url) VALUES
      ('m1','Reading','READING_MC','Chọn đáp án','${MC2}','<p>Bài đọc</p>',NULL),
      ('f1','Reading','READING_FILL_IN','Điền','{"fill_subtype":"FREE_TYPING"}','He [runs] and [jumps].',NULL),
      ('o1','Reading','READING_ORDERING','Sắp xếp','{"ordering_type":"WORD_ORDERING","correct_text":"a b c"}','<p>Bài đọc</p>',NULL),
      ('l1','Listening','LISTENING_MC','Nghe','{"sub_questions":[{"id":"c","text":"?","option_a":"x","option_b":"y","correct_answer":"B"}]}',NULL,'/a.mp3'),
      ('e1','Writing','WRITING_ESSAY','Viết về gia đình','{"min_words":80}',NULL,NULL),
      ('orphan','Reading','READING_MC','Lẻ','{"sub_questions":[]}',NULL,NULL);
    INSERT INTO exams (id, title, question_ids, stimulus_text, created_by) VALUES
      ('eA','Đề A','["m1","o1","f1","l1","e1","ghost"]','<p>Hướng dẫn chung của đề</p>','t1'),
      ('eB','Đề B dùng lại câu','["m1"]',NULL,'t1');
    INSERT INTO lessons (id, title, question_ids, created_by) VALUES ('lA','Bài A','["e1"]','t1');
  `);
});

describe("TC-P17: script chuyển dữ liệu (DEC-053)", () => {
  it("câu liền nhau cùng ngữ cảnh → một phần; bài đọc của đề → phần đầu chỉ đọc; tổng số câu trước = sau", async () => {
    const { reports } = await migrateAllToSections(db, { split: true });
    const rA = reports.find((r) => r.kind === "exam" && r.id === "eA")!;
    expect(rA.missing).toEqual(["ghost"]);
    const tree = await loadTree(db, "exam", "eA");
    expect(tree.map((s) => [s.skill, s.questions.map((q) => q.category)])).toEqual([
      ["Reading", []],                                                   // bài đọc chung của đề
      ["Reading", ["READING_MC", "READING_MC", "READING_ORDERING"]],      // m1 (2 ý tách) + o1 cùng bài đọc
      ["Reading", ["READING_FILL_IN"]],
      ["Listening", ["LISTENING_MC"]],
      ["Writing", ["WRITING_ESSAY"]],
    ]);
    expect(tree[0].stimulus_text).toBe("<p>Hướng dẫn chung của đề</p>");
    expect(tree[1]).toMatchObject({ stimulus_text: "<p>Bài đọc</p>", instruction: "Chọn đáp án" });
    expect(tree[3]).toMatchObject({ stimulus_type: "AUDIO_ONLY", stimulus_audio_url: "/a.mp3" });
    expect(totalNumbered(tree)).toBe(rA.numberedBefore); // 2 + 1 + 2 ô + 1 + 1 = 7
    expect(rA.numberedBefore).toBe(7);
  });

  it("trắc nghiệm gom nhiều ý → mỗi ý một câu (đáp án chữ cái); điền ô kiểu cũ: đoạn văn từ stimulus_text vào content.passage", async () => {
    const { split, created } = await migrateAllToSections(db, { split: true });
    expect(split).toBeGreaterThanOrEqual(2);
    expect(created).toBeGreaterThanOrEqual(3);
    const tree = await loadTree(db, "exam", "eA");
    const [q1, q2] = tree[1].questions;
    expect(q1.content).toMatchObject({ text: "1?", correct_answer: "A" });
    expect(q2.content).toMatchObject({ text: "2?", correct_answer: "C" }); // "fast" là chữ của phương án C
    expect(q1.content.sub_questions).toBeUndefined();
    expect(gradeQuestion({ id: q2.id!, category: "READING_MC", content: q2.content }, "C").earned).toBe(1);
    const fill = tree[2];
    expect(fill.stimulus_type).toBe("NONE");
    expect(fill.questions[0].content.passage).toBe("He [runs] and [jumps].");
  });

  it("câu dùng chung nhiều đề / bài học được nhân bản cho nơi đến sau, giữ lời dẫn", async () => {
    const { reports } = await migrateAllToSections(db, { split: true });
    expect(reports.reduce((n, r) => n + (r.cloned || 0), 0)).toBeGreaterThanOrEqual(2); // m1 ở eB, e1 ở lA
    const eB = await loadTree(db, "exam", "eB");
    expect(eB[0].instruction).toBe("Chọn đáp án");
    expect(eB[0].questions).toHaveLength(2);
    const lA = await loadTree(db, "lesson", "lA");
    expect(lA[0].questions[0]).toMatchObject({ category: "WRITING_ESSAY", prompt: "Viết về gia đình" });
    expect(lA[0].questions[0].id).not.toBe("e1");
  });

  it("chạy lại không làm gì thêm (idempotent); câu mồ côi vẫn chưa thuộc phần nào để script xoá", async () => {
    await migrateAllToSections(db, { split: true });
    const n1 = (await rows("SELECT COUNT(*)::int n FROM sections"))[0].n;
    const { reports } = await migrateAllToSections(db, { split: true });
    expect(reports.every((r) => r.skipped === "HAS_SECTIONS" || r.sections === 0)).toBe(true);
    expect((await rows("SELECT COUNT(*)::int n FROM sections"))[0].n).toBe(n1);
    expect(await rows("SELECT id FROM questions WHERE section_id IS NULL")).toEqual([{ id: "orphan" }]);
  });

  it("migration 020 bỏ cột cũ, chặn khi còn câu chưa thuộc phần", () => {
    const sql = fs.readFileSync("docs/db-migration-020-drop-question-ids.sql", "utf8");
    for (const c of ["exams DROP COLUMN IF EXISTS question_ids", "lessons DROP COLUMN IF EXISTS question_ids", "questions DROP COLUMN IF EXISTS stimulus_text"]) expect(sql).toContain(c);
    expect(sql).toMatch(/section_id IS NULL[\s\S]*RAISE EXCEPTION/);
    expect(fs.readFileSync("scripts/migrate-sections.ts", "utf8")).toMatch(/DRY = !process\.argv\.includes\("--commit"\)/);
  });
});

describe("TC-P18: code ứng dụng không còn đọc định dạng cũ (DEC-053)", () => {
  const files: string[] = [];
  const walk = (d: string) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) walk(p);
      else if (/\.(ts|tsx)$/.test(e.name)) files.push(p.split(path.sep).join("/"));
    }
  };
  ["app", "lib", "components"].forEach(walk);
  // ngoại lệ có chủ đích: script / thư viện chuyển dữ liệu cũ
  const ALLOW = new Set([
    "lib/section-migration.ts",
    // "question_ids" ở đây là tên trường phản hồi (thẻ đang được câu nào dùng), không phải cột cũ
    "app/api/teacher/flashcards/[id]/route.ts",
    "app/teacher/flashcards/page.tsx",
  ]);

  it("không còn đọc exams.question_ids / lessons.question_ids", () => {
    const bad = files.filter((f) => !ALLOW.has(f) && /\.question_ids\b|question_ids\s*(=|FROM|,\s*created_by)|SELECT[^;]*question_ids/.test(fs.readFileSync(f, "utf8")));
    expect(bad).toEqual([]);
  });

  it("không còn trình soạn cũ và API câu hỏi riêng lẻ", () => {
    expect(fs.existsSync("components/question-builder/QuestionSetEditor.tsx")).toBe(false);
    expect(fs.existsSync("app/api/teacher/questions/route.ts")).toBe(false);
    expect(fs.existsSync("lib/question-editor-mapping.ts")).toBe(false);
  });

  it("câu hỏi không còn ghi stimulus_text / stimulus_audio_url (ngữ cảnh ở phần)", () => {
    const bad = files.filter((f) => !ALLOW.has(f) && /INSERT INTO questions[^;]*stimulus_(text|audio_url)/.test(fs.readFileSync(f, "utf8")));
    expect(bad).toEqual([]);
  });
});
