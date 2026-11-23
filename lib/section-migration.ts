// FEAT-017 TASK-061 (DEC-053) — chuyển dữ liệu cũ (question_ids + stimulus_* ở câu / đề, sub_questions) sang phần.
// Chạy một lần bằng scripts/migrate-sections.ts; hàm idempotent (đề / bài học đã có phần thì bỏ qua).
import { mcAnswerLetter, parseFillInGaps } from "./question-content-types";
import { skillOfCategory } from "./question-conversion";
import { numberedCount, type ParentKind, type Queryable } from "./exam-structure";

type Rec = Record<string, unknown>;
const str = (v: unknown) => (typeof v === "string" ? v : v == null ? "" : String(v));
const ids = (raw: unknown): string[] => {
  let v = raw;
  if (typeof v === "string") { try { v = JSON.parse(v); } catch { v = []; } }
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string" && !!x.trim()).map((x) => x.trim()) : [];
};
const content = (v: unknown): Rec => {
  if (v && typeof v === "object") return { ...(v as Rec) };
  try { return JSON.parse(str(v) || "{}") as Rec; } catch { return {}; }
};
const stimType = (text: string, audio: string) => (text && audio ? "COMBINED" : audio ? "AUDIO_ONLY" : text ? "TEXT_ONLY" : "NONE");
/** Dạng chấm khách quan: lời dẫn chung chuyển lên phần. Dạng chấm AI giữ `prompt` ở câu (đề bài của câu). */
const isObjective = (cat: string) => !cat.startsWith("WRITING_ESSAY") && !cat.startsWith("WRITING_SHORT") && !cat.startsWith("SPEAKING_") && cat !== "WRITING_SENTENCE_REWRITE";

export interface SectionizeReport {
  kind: ParentKind;
  id: string;
  skipped?: "HAS_SECTIONS" | "NOT_FOUND";
  sections: number;
  questions: number;
  missing: string[];
  numberedBefore: number;
  /** Số câu phải nhân bản vì đang dùng chung với đề / bài học khác. */
  cloned?: number;
}

/** Gom `question_ids` của một đề / bài học thành các phần (câu liền nhau cùng ngữ cảnh → một phần). */
export async function sectionizeParent(db: Queryable, kind: ParentKind, id: string): Promise<SectionizeReport> {
  const table = kind === "exam" ? "exams" : "lessons";
  const col = kind === "exam" ? "exam_id" : "lesson_id";
  const report: SectionizeReport = { kind, id, sections: 0, questions: 0, missing: [], numberedBefore: 0 };
  const pRes = await db.query(`SELECT * FROM ${table} WHERE id = $1`, [id]);
  if (!pRes.rows.length) return { ...report, skipped: "NOT_FOUND" };
  const parent = pRes.rows[0];
  const has = await db.query(`SELECT 1 FROM sections WHERE ${col} = $1 LIMIT 1`, [id]);
  if (has.rows.length) return { ...report, skipped: "HAS_SECTIONS" };

  const qIds = ids(parent.question_ids);
  const qRes = qIds.length ? await db.query("SELECT * FROM questions WHERE id = ANY($1)", [qIds]) : { rows: [] as Rec[] };
  const byId = new Map(qRes.rows.map((r) => [str(r.id), r]));

  type Sec = { skill: string; instruction: string | null; text: string; audio: string; questions: { row: Rec; prompt: string | null; content: Rec }[] };
  const secs: Sec[] = [];
  const pText = str(parent.stimulus_text).trim();
  const pAudio = str(parent.stimulus_audio_url).trim();
  if (kind === "exam" && (pText || pAudio)) secs.push({ skill: "Reading", instruction: null, text: pText, audio: pAudio, questions: [] });

  let cur: Sec | null = null;
  const usedHere = new Set<string>();
  for (const qid of qIds) {
    let row = byId.get(qid);
    if (!row) { report.missing.push(qid); continue; }
    // Câu dùng chung nhiều đề / bài học (dữ liệu cũ): mỗi câu chỉ thuộc một phần (DEC-051) → nhân bản cho nơi đến sau
    if (row.section_id != null || usedHere.has(qid)) {
      const cloneId = `${qid.slice(0, 40)}_c${Math.random().toString(36).slice(2, 7)}`;
      await db.query(
        `INSERT INTO questions (id, skill, category, prompt, content, stimulus_text, stimulus_audio_url, created_by, created_at)
         SELECT $2, skill, category, prompt, content, stimulus_text, stimulus_audio_url, created_by, NOW() FROM questions WHERE id = $1`,
        [qid, cloneId]
      );
      // nơi đầu tiên đã chuyển lời dẫn của câu lên phần (prompt = NULL) → lấy lại từ phần đó cho bản nhân
      let prompt = row.prompt;
      if (prompt == null && row.section_id != null) {
        const s = await db.query("SELECT instruction FROM sections WHERE id = $1", [row.section_id]);
        prompt = s.rows[0]?.instruction ?? null;
      }
      row = { ...row, id: cloneId, section_id: null, prompt };
      report.cloned = (report.cloned || 0) + 1;
    }
    usedHere.add(qid);
    const cat = str(row.category);
    const skill = skillOfCategory(cat);
    const c = content(row.content);
    let text = str(row.stimulus_text).trim();
    const audio = str(row.stimulus_audio_url).trim();
    // Câu điền ô kiểu cũ: đoạn văn nằm ở stimulus_text → chuyển vào content.passage (BR-P12, bỏ nhánh grading cũ)
    // (AI nhập đề bản cũ chép đoạn văn có đáp án vào cả stimulus_text lẫn content.passage → bỏ bản ở stimulus, không lộ đáp án)
    if ((cat.endsWith("_FILL_IN") || cat === "WRITING_FREE_TYPING_BLANKS") && !c.import_meta && text && parseFillInGaps(text).gaps.length) {
      if (!str(c.passage).trim()) c.passage = text;
      text = "";
    }
    // số ý chấm điểm (sau khi đưa đoạn văn điền ô về content — đúng như bộ chấm đang chấm)
    report.numberedBefore += numberedCount({ category: cat, content: c });
    const prompt = str(row.prompt).trim() || null;
    const grouped = cur !== null && (text || audio) && cur.text === text && cur.audio === audio && cur.skill === skill;
    if (!grouped) {
      cur = { skill, instruction: isObjective(cat) ? prompt : null, text, audio, questions: [] };
      secs.push(cur);
    }
    const target = cur as Sec;
    const keepPrompt = !isObjective(cat) || (grouped && prompt !== target.instruction) ? prompt : null;
    target.questions.push({ row, prompt: keepPrompt, content: c });
  }
  // phần cha (bài đọc chung của đề) đứng riêng phía trước; kỹ năng theo phần sau nó nếu có
  if (secs.length > 1 && secs[0].questions.length === 0 && kind === "exam" && (pText || pAudio)) secs[0].skill = secs[1].skill;

  for (let si = 0; si < secs.length; si++) {
    const s = secs[si];
    const secId = `sec_${globalThis.crypto.randomUUID()}`;
    await db.query(
      `INSERT INTO sections (id, ${col}, position, skill, instruction, stimulus_type, stimulus_text, stimulus_audio_url)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [secId, id, si, s.skill, s.instruction, stimType(s.text, s.audio), s.text || null, s.audio || null]
    );
    for (let qi = 0; qi < s.questions.length; qi++) {
      const q = s.questions[qi];
      await db.query(
        `UPDATE questions SET section_id = $2, position = $3, skill = $4, prompt = $5, content = $6::jsonb WHERE id = $1`,
        [str(q.row.id), secId, qi, s.skill, q.prompt, JSON.stringify(q.content)]
      );
      report.questions++;
    }
    report.sections++;
  }
  return report;
}

/** Tách câu gom nhiều ý (`sub_questions` của trắc nghiệm / trả lời ngắn) thành mỗi ý một câu (BR-P12). */
export async function splitLegacySubQuestions(db: Queryable, sectionId: string): Promise<{ split: number; created: number }> {
  const qRes = await db.query("SELECT * FROM questions WHERE section_id = $1 ORDER BY position ASC, created_at ASC", [sectionId]);
  let split = 0;
  let created = 0;
  const order: { id: string }[] = [];
  for (const row of qRes.rows) {
    const cat = str(row.category);
    const c = content(row.content);
    const subs = Array.isArray(c.sub_questions) ? (c.sub_questions as Rec[]) : null;
    if (!subs || !(cat.endsWith("_MC") || cat === "WRITING_SHORT_ANSWER")) { order.push({ id: str(row.id) }); continue; }
    split++;
    const extra: Rec = {};
    if (c.import_meta) extra.import_meta = c.import_meta;
    for (let i = 0; i < subs.length; i++) {
      const sq = subs[i] || {};
      const newId = `${str(row.id)}_${i + 1}`.slice(0, 50);
      const flat: Rec = cat === "WRITING_SHORT_ANSWER"
        ? { text: str(sq.text ?? sq.questionText), max_words: Number(sq.max_words ?? sq.maxWords) || 50, ...(sq.sample_answer ? { sample_answer: sq.sample_answer } : {}), ...extra }
        : {
            text: str(sq.text), option_a: str(sq.option_a), option_b: str(sq.option_b), option_c: str(sq.option_c), option_d: str(sq.option_d),
            correct_answer: mcAnswerLetter(sq), audio_url: sq.audio_url || null, ...extra,
          };
      await db.query(
        `INSERT INTO questions (id, section_id, position, skill, category, prompt, content, created_by, created_at)
         VALUES ($1, $2, 0, $3, $4, NULL, $5::jsonb, $6, NOW())`,
        [newId, sectionId, row.skill, cat, JSON.stringify(flat), row.created_by ?? null]
      );
      order.push({ id: newId });
      created++;
    }
    await db.query("DELETE FROM questions WHERE id = $1", [str(row.id)]);
  }
  for (let i = 0; i < order.length; i++) await db.query("UPDATE questions SET position = $2 WHERE id = $1", [order[i].id, i]);
  return { split, created };
}

/** Chạy cho mọi đề và bài học; trả báo cáo. `split` = false chỉ gom phần (dùng trong test dữ liệu cũ). */
export async function migrateAllToSections(db: Queryable, opts: { split?: boolean } = {}) {
  const reports: SectionizeReport[] = [];
  for (const [kind, table] of [["exam", "exams"], ["lesson", "lessons"]] as const) {
    const rows = (await db.query(`SELECT id FROM ${table} ORDER BY id`)).rows;
    for (const r of rows) reports.push(await sectionizeParent(db, kind, str(r.id)));
  }
  let split = 0;
  let created = 0;
  if (opts.split !== false) {
    const secs = (await db.query("SELECT id FROM sections")).rows;
    for (const s of secs) {
      const r = await splitLegacySubQuestions(db, str(s.id));
      split += r.split;
      created += r.created;
    }
  }
  return { reports, split, created };
}
