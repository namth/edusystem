// FEAT-017 TASK-056 — lõi cây đề / bài học theo Phần: đánh số, kiểm cây, đọc / ghi trong transaction.
// TC-P01 → TC-P09 (docs/features/phan-bai-hoc-de-thi.md §8).
import { describe, it, expect, beforeEach } from "vitest";
import fs from "fs";
import { createFakePg } from "./helpers/pg-fake";
import {
  numberedCount, numberQuestions, totalNumbered, validateTree, loadTree, saveTreeInTx, withTx, getVersion,
  TreeError, type TreeSection, type Queryable,
} from "@/lib/exam-structure";
import { buildStandardQuestionContent } from "@/lib/question-content-types";
import { gradeQuestion, sanitizeQuestionForStudent } from "@/lib/grading";

const mc = (text: string, ans = "A") => ({ category: "READING_MC", content: { text, option_a: "a", option_b: "b", option_c: "c", option_d: "d", correct_answer: ans } });
const fill = (passage: string) => ({ category: "READING_FILL_IN", content: { fill_subtype: "FREE_TYPING", passage } });

describe("TC-P01/P02: numberedCount và đánh số liên tục (BR-P06)", () => {
  it("trắc nghiệm 1, điền 10 ô → 10, nối 5 cặp → 5, bài luận 1", () => {
    expect(numberedCount(mc("x"))).toBe(1);
    expect(numberedCount(fill(Array.from({ length: 10 }, (_, i) => `w${i} [a${i}]`).join(" ")))).toBe(10);
    expect(numberedCount({ category: "READING_MATCHING", content: { pairs: [1, 2, 3, 4, 5].map((i) => ({ id: `p${i}`, left: "l", right: "r" })) } })).toBe(5);
    expect(numberedCount({ category: "WRITING_ESSAY", content: { min_words: 150 } })).toBe(1);
    expect(numberedCount({ category: "LISTENING_FILL_IN", content: { correct_answers: ["a", "b"] } })).toBe(2);
  });

  it("số câu liên tục qua 3 phần (1–4, 5–14, 15); phần 0 câu không chiếm số; câu xoá mềm không chiếm số", () => {
    const sections: TreeSection[] = [
      { skill: "Reading", questions: [mc("1"), mc("2"), mc("3"), mc("4")] },
      { skill: "Reading", instruction: "Chỉ đọc", questions: [] },
      { skill: "Reading", questions: [{ ...mc("bỏ"), deleted_at: "2026-11-24T00:00:00Z" }, fill(Array.from({ length: 10 }, (_, i) => `[a${i}]`).join(" "))] },
      { skill: "Writing", questions: [{ category: "WRITING_ESSAY", content: {} }] },
    ];
    const n = numberQuestions(sections);
    expect(n[0].questions.map((q) => q.number_start)).toEqual([1, 2, 3, 4]);
    expect(n[2].questions[0].number_start).toBeUndefined();
    expect(n[2].questions[1]).toMatchObject({ number_start: 5, number_count: 10 });
    expect(n[3].questions[0]).toMatchObject({ number_start: 15, number_count: 1 });
    expect(totalNumbered(sections)).toBe(15);
  });
});

describe("TC-P03 → TC-P06: validateTree (BR-P02 → BR-P05)", () => {
  it("đề 0 phần → lỗi; đề toàn phần 0 câu → lỗi; bài học toàn phần đọc → hợp lệ", () => {
    expect(validateTree("exam", [])[0].message).toMatch(/ít nhất 1 phần/);
    const readOnly: TreeSection[] = [{ skill: "Reading", instruction: "Đọc hướng dẫn", questions: [] }];
    expect(validateTree("exam", readOnly).map((i) => i.message)).toContain("Đề thi phải có ít nhất 1 câu hỏi.");
    expect(validateTree("lesson", readOnly)).toEqual([]);
  });

  it("phần trống hoàn toàn → 'Phần N trống'; chỉ có lời dẫn → hợp lệ", () => {
    const issues = validateTree("exam", [{ skill: "Reading", questions: [mc("x")] }, { skill: "Reading", instruction: "  ", questions: [] }]);
    expect(issues).toEqual([{ section_index: 1, message: "Phần 2 trống: thêm lời dẫn, ngữ cảnh hoặc câu hỏi." }]);
    expect(validateTree("exam", [{ skill: "Reading", questions: [mc("x")] }, { skill: "Reading", instruction: "Part 2", questions: [] }])).toEqual([]);
  });

  it("dạng câu phải thuộc kỹ năng của phần", () => {
    const issues = validateTree("exam", [{ skill: "Reading", questions: [{ category: "LISTENING_MC", content: {} }] }]);
    expect(issues[0]).toMatchObject({ section_index: 0, question_index: 0 });
    expect(issues[0].message).toMatch(/không thuộc kỹ năng Reading/);
  });

  it("AUDIO_ONLY thiếu audio → lỗi; Listening có câu mà không có audio nào → lỗi; câu MC có audio riêng → hợp lệ", () => {
    const lmc = (audio?: string) => ({ category: "LISTENING_MC", content: { text: "?", correct_answer: "A", audio_url: audio } });
    expect(validateTree("exam", [{ skill: "Listening", stimulus_type: "AUDIO_ONLY", questions: [lmc()] }]).map((i) => i.message))
      .toEqual(["Phần 1: chọn ngữ cảnh audio nhưng chưa có audio.", "Phần 1: phần Listening có câu hỏi phải có audio."]);
    expect(validateTree("exam", [{ skill: "Listening", stimulus_type: "NONE", questions: [lmc("/a.mp3"), lmc("/b.mp3")] }])).toEqual([]);
    expect(validateTree("exam", [{ skill: "Listening", stimulus_type: "AUDIO_ONLY", stimulus_audio_text: "Hello", questions: [lmc()] }])).toEqual([]);
  });
});

describe("Trắc nghiệm / trả lời ngắn một ý một bản ghi (BR-P12)", () => {
  it("chuẩn hoá: đáp án chữ cái, không có sub_questions; chấm answers[qid] = 'B'; học sinh không thấy đáp án", () => {
    const c = buildStandardQuestionContent({ category: "READING_MC", text: "Q?", option_a: "slow", option_b: "fast", correct_answer: "fast" });
    expect(c).toMatchObject({ text: "Q?", option_a: "slow", option_b: "fast", correct_answer: "B" });
    expect(c.sub_questions).toBeUndefined();
    const q = { id: "q1", category: "READING_MC", content: c };
    expect(gradeQuestion(q, "B")).toMatchObject({ earned: 1, max: 1 });
    expect(gradeQuestion(q, "A")).toMatchObject({ earned: 0, max: 1 });
    expect(sanitizeQuestionForStudent(q).content.correct_answer).toBeUndefined();
  });

  it("trả lời ngắn phẳng: AI chấm 1 mục, học sinh không thấy đáp án mẫu", () => {
    const c = buildStandardQuestionContent({ category: "WRITING_SHORT_ANSWER", text: "Why?", max_words: 20, sample_answer: "Because." });
    expect(c).toMatchObject({ text: "Why?", max_words: 20, sample_answer: "Because." });
    const q = { id: "s1", category: "WRITING_SHORT_ANSWER", content: c };
    expect(gradeQuestion(q, "Because I like it")).toMatchObject({ kind: "AI", max: 1 });
    expect(sanitizeQuestionForStudent(q).content.sample_answer).toBeUndefined();
  });
});

// ───────────── DB ─────────────
let pg: Awaited<ReturnType<typeof createFakePg>>;
let db: Queryable;
const rows = async (sql: string) => (await pg.db.query<Record<string, unknown>>(sql)).rows;

beforeEach(async () => {
  pg = await createFakePg(["db-migration-007-question-owner.sql"]);
  await pg.db.exec(`
    CREATE TABLE courses (id VARCHAR(50) PRIMARY KEY, title VARCHAR(255), created_by VARCHAR(50));
    CREATE TABLE curriculum_items (
      id VARCHAR(50) PRIMARY KEY, course_id VARCHAR(50) NOT NULL, parent_id VARCHAR(50), title VARCHAR(255) NOT NULL,
      type VARCHAR(20) NOT NULL, exam_id VARCHAR(50), order_index INT DEFAULT 0, created_by VARCHAR(50),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);
  await pg.db.exec(fs.readFileSync("docs/db-migration-006-lessons.sql", "utf8"));
  await pg.db.exec(fs.readFileSync("docs/db-migration-019-sections.sql", "utf8"));
  await pg.db.exec(`INSERT INTO exams (id, title, created_by) VALUES ('e1', 'Đề 1', 't1'), ('e2', 'Đề 2', 't1');
                    INSERT INTO lessons (id, title, created_by) VALUES ('l1', 'Bài 1', 't1');`);
  db = { query: (sql, params) => pg.queryPg(sql, params as unknown[]) };
});

const base = (): TreeSection[] => [
  { skill: "Reading", instruction: "Pronunciation", questions: [mc("a", "A"), mc("b", "B")] },
  { skill: "Reading", stimulus_type: "TEXT_ONLY", stimulus_text: "<p>Passage</p>", questions: [fill("He [runs] and [jumps].")] },
];
const save = (sections: TreeSection[], expectedVersion?: string | null, id = "e1") =>
  withTx(db, (d) => saveTreeInTx(d, { kind: "exam", id, userId: "t1", expectedVersion, sections }));

describe("TC-P07 → TC-P09: ghi cả cây (BR-P07 → BR-P09)", () => {
  it("TC-P07: tạo, rồi đổi thứ tự phần, chuyển câu sang phần khác, thêm và bỏ câu → đúng position / section_id; câu bỏ bị xoá hẳn", async () => {
    await save(base());
    let tree = await loadTree(db, "exam", "e1");
    expect(tree.map((s) => s.questions.length)).toEqual([2, 1]);
    expect(tree[1].questions[0].number_start).toBe(3);
    const [s1, s2] = tree;
    const moved = s1.questions[1];
    const removed = s1.questions[0];
    const next: TreeSection[] = [
      { ...s2, questions: [moved, ...s2.questions, mc("mới", "C")] },
      { ...s1, questions: [] },
    ];
    void removed;
    await save(next, await getVersion(db, "exam", "e1"));
    tree = await loadTree(db, "exam", "e1");
    expect(tree.map((s) => s.id)).toEqual([s2.id, s1.id]);
    expect(tree[0].questions.map((q) => q.id?.startsWith("q_"))).toEqual([true, true, true]);
    expect(tree[0].questions[0].id).toBe(moved.id);
    expect(tree[0].questions.map((q) => q.position)).toEqual([0, 1, 2]);
    expect(tree[1].questions).toEqual([]);
    expect(await rows(`SELECT id FROM questions WHERE id = '${removed.id}'`)).toEqual([]);
    expect(tree[0].questions.map((q) => q.number_start)).toEqual([1, 2, 4]);
    expect((await rows("SELECT skills FROM exams WHERE id = 'e1'"))[0].skills).toEqual(["Reading"]);
  });

  it("questions.skill luôn bằng sections.skill; content được chuẩn hoá (đáp án chữ cái)", async () => {
    await save([{ skill: "Reading", questions: [{ category: "READING_MC", content: { text: "?", option_a: "x", option_b: "y", correct_answer: "y" } }] }]);
    const r = await rows("SELECT skill, content FROM questions");
    expect(r[0].skill).toBe("Reading");
    expect((r[0].content as Record<string, unknown>).correct_answer).toBe("B");
  });

  it("TC-P08: lỗi giữa chừng trong transaction → không ghi gì", async () => {
    await expect(withTx(db, async (d) => {
      await saveTreeInTx(d, { kind: "exam", id: "e1", userId: "t1", sections: base() });
      throw new Error("boom");
    })).rejects.toThrow("boom");
    expect(await rows("SELECT id FROM sections")).toEqual([]);
    expect(await rows("SELECT id FROM questions")).toEqual([]);
  });

  it("cây không hợp lệ → TreeError 400 kèm vị trí, không ghi gì", async () => {
    const bad = base();
    bad[1].questions.push({ category: "LISTENING_MC", content: {} });
    await expect(save(bad)).rejects.toMatchObject({ status: 400, errors: [{ section_index: 1, question_index: 1 }] });
    expect(await rows("SELECT id FROM sections")).toEqual([]);
  });

  it("TC-P09: updated_at cũ → 409, DB không đổi", async () => {
    await save(base());
    const v1 = await getVersion(db, "exam", "e1");
    const tree = await loadTree(db, "exam", "e1");
    await save(tree, v1); // tab A lưu
    const err = await save([{ ...tree[0], instruction: "tab B" }, tree[1]], v1).catch((e) => e); // tab B còn bản cũ
    expect(err).toBeInstanceOf(TreeError);
    expect(err.status).toBe(409);
    expect((await rows("SELECT instruction FROM sections ORDER BY position"))[0].instruction).toBe("Pronunciation");
  });

  it("id phần / câu của đề khác → 400", async () => {
    await save(base(), null, "e2");
    const other = await loadTree(db, "exam", "e2");
    await expect(save([{ skill: "Reading", questions: [other[0].questions[0]] }])).rejects.toMatchObject({ status: 400 });
    await expect(save([other[0]])).rejects.toMatchObject({ status: 400 });
  });

  it("đề đã có bài nộp: bỏ câu / phần → xoá mềm; đọc bình thường không thấy, includeDeletedIds thì thấy", async () => {
    await save(base());
    await pg.db.exec(`INSERT INTO submissions (id, exam_id, student_id, answers) VALUES ('sub1', 'e1', 'st1', '{}')`);
    const tree = await loadTree(db, "exam", "e1");
    const gone = tree[0].questions[0];
    await save([{ ...tree[0], questions: [tree[0].questions[1]] }], await getVersion(db, "exam", "e1"));
    expect((await rows(`SELECT deleted_at FROM questions WHERE id = '${gone.id}'`))[0].deleted_at).not.toBeNull();
    const now = await loadTree(db, "exam", "e1");
    expect(now).toHaveLength(1);
    expect(now[0].questions.map((q) => q.id)).toEqual([tree[0].questions[1].id]);
    expect(now[0].questions[0].number_start).toBe(1);
    const review = await loadTree(db, "exam", "e1", { includeDeletedIds: [gone.id!, tree[1].questions[0].id!] });
    expect(review.map((s) => s.questions.length)).toEqual([2, 1]);
    expect(review[0].questions.find((q) => q.id === gone.id)?.deleted_at).not.toBeNull();
    expect(review[0].questions.find((q) => q.id === gone.id)?.number_start).toBeUndefined();
  });

  it("bài học: phần chỉ đọc lưu được; parent sai → 404", async () => {
    await withTx(db, (d) => saveTreeInTx(d, { kind: "lesson", id: "l1", userId: "t1", sections: [{ skill: "Reading", instruction: "Đọc", questions: [] }] }));
    expect((await loadTree(db, "lesson", "l1"))[0].instruction).toBe("Đọc");
    await expect(withTx(db, (d) => saveTreeInTx(d, { kind: "lesson", id: "nope", userId: "t1", sections: [] }))).rejects.toMatchObject({ status: 404 });
  });
});
