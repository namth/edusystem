// FEAT-017 — Bài học & đề thi theo Phần (sections). DEC-051 → DEC-054, BR-P01 → BR-P15.
// Đọc / kiểm / ghi cây: đề | bài học → phần → câu. Hàm kiểm và đánh số là hàm thuần (dùng cả ở client).
import { buildStandardQuestionContent, parseFillInGaps } from "./question-content-types";
import { skillOfCategory } from "./question-conversion";

export type Skill = "Reading" | "Listening" | "Writing" | "Speaking";
export type StimulusType = "NONE" | "TEXT_ONLY" | "AUDIO_ONLY" | "COMBINED";
export type ParentKind = "exam" | "lesson";

export const SKILLS: Skill[] = ["Reading", "Listening", "Writing", "Speaking"];
export const STIMULUS_TYPES: StimulusType[] = ["NONE", "TEXT_ONLY", "AUDIO_ONLY", "COMBINED"];
export const CATEGORIES = [
  "READING_MC", "LISTENING_MC", "READING_FILL_IN", "LISTENING_FILL_IN", "READING_ORDERING", "LISTENING_ORDERING",
  "READING_MATCHING", "LISTENING_MATCHING", "WRITING_MATCHING", "READING_FLASHCARD_SET", "WRITING_FLASHCARD_SET",
  "WRITING_ESSAY", "WRITING_FREE_TYPING_BLANKS", "WRITING_SHORT_ANSWER", "WRITING_SENTENCE_REWRITE",
  "SPEAKING_TOPIC_PROMPT", "SPEAKING_READ_ALOUD",
] as const;

type Rec = Record<string, unknown>;

export interface TreeQuestion {
  id?: string;
  category: string;
  prompt?: string | null;
  content: Rec;
  skill?: string;
  position?: number;
  deleted_at?: string | null;
  /** Số câu đầu và số số câu câu này chiếm (BR-P06) — tính khi đọc, không lưu. */
  number_start?: number;
  number_count?: number;
}

export interface TreeSection {
  id?: string;
  skill: string;
  instruction?: string | null;
  stimulus_type?: string;
  stimulus_text?: string | null;
  stimulus_audio_url?: string | null;
  stimulus_audio_text?: string | null;
  stimulus_audio_gender?: string | null;
  position?: number;
  deleted_at?: string | null;
  questions: TreeQuestion[];
}

export interface TreeIssue {
  section_index: number;
  question_index?: number;
  message: string;
}

export class TreeError extends Error {
  constructor(public status: 400 | 403 | 404 | 409, message: string, public errors: TreeIssue[] = []) {
    super(message);
  }
}

/** Đủ cho cả `pg` PoolClient lẫn PGlite trong test. */
export interface Queryable {
  query(text: string, params?: unknown[]): Promise<{ rows: Rec[] }>;
}

const str = (v: unknown) => (typeof v === "string" ? v : v == null ? "" : String(v));
const plain = (html: unknown) => str(html).replace(/<img\b[^>]*>/gi, " [ảnh] ").replace(/<[^>]*>/g, " ").replace(/&nbsp;/gi, " ").trim();

// ───────────────────────────── đánh số (BR-P06) ─────────────────────────────

/** Số số câu một câu chiếm: điền ô = số ô, nối = số cặp, còn lại 1. */
export function numberedCount(q: { category: string; content?: Rec | null }): number {
  const c = (q.content || {}) as Rec;
  const cat = q.category || "";
  if (cat.endsWith("_FILL_IN") || cat === "WRITING_FREE_TYPING_BLANKS") {
    const fromPassage = parseFillInGaps(str(c.passage)).gaps.length;
    const fromAnswers = Array.isArray(c.correct_answers) ? c.correct_answers.length : 0;
    return Math.max(1, fromPassage || fromAnswers);
  }
  if (cat.endsWith("_MATCHING")) return Math.max(1, Array.isArray(c.pairs) ? c.pairs.length : 0);
  // dữ liệu cũ chưa chuyển (TASK-061): câu gom nhiều ý
  if ((cat.endsWith("_MC") || cat === "WRITING_SHORT_ANSWER") && Array.isArray(c.sub_questions)) {
    return Math.max(1, c.sub_questions.length);
  }
  return 1;
}

/** Gắn `number_start` / `number_count` cho mọi câu chưa xoá, liên tục qua các phần. */
export function numberQuestions<S extends TreeSection>(sections: S[]): S[] {
  let n = 1;
  return sections.map((s) => ({
    ...s,
    questions: s.questions.map((q) => {
      if (q.deleted_at) return { ...q, number_start: undefined, number_count: 0 };
      const count = numberedCount(q);
      const out = { ...q, number_start: n, number_count: count };
      n += count;
      return out;
    }),
  }));
}

export function totalNumbered(sections: TreeSection[]): number {
  return sections.reduce((a, s) => a + s.questions.filter((q) => !q.deleted_at).reduce((b, q) => b + numberedCount(q), 0), 0);
}

// ───────────────────────────── kiểm cây (BR-P02 → BR-P05) ─────────────────────────────

function stimulusType(s: TreeSection): StimulusType {
  return (STIMULUS_TYPES as string[]).includes(str(s.stimulus_type)) ? (s.stimulus_type as StimulusType) : "NONE";
}
const hasAudio = (s: TreeSection) => !!(str(s.stimulus_audio_url).trim() || str(s.stimulus_audio_text).trim());
const hasText = (s: TreeSection) => !!plain(s.stimulus_text);

const CATEGORY_LABEL: Record<string, string> = {
  MC: "Trắc nghiệm", FILL_IN: "Điền ô trống", ORDERING: "Sắp xếp", MATCHING: "Nối cặp", FLASHCARD_SET: "Bộ flashcard",
  ESSAY: "Bài luận", FREE_TYPING_BLANKS: "Điền ô (tự gõ)", SHORT_ANSWER: "Trả lời ngắn", SENTENCE_REWRITE: "Viết lại câu",
  TOPIC_PROMPT: "Nói theo chủ đề", READ_ALOUD: "Đọc to",
};
export const categoryLabel = (cat: string) => CATEGORY_LABEL[cat.replace(/^(READING|LISTENING|WRITING|SPEAKING)_/, "")] || cat;

export function validateTree(kind: ParentKind, sections: TreeSection[], opts: { allowMissingAudio?: boolean } = {}): TreeIssue[] {
  const issues: TreeIssue[] = [];
  const live = sections.filter((s) => !s.deleted_at);
  if (live.length === 0) {
    issues.push({ section_index: -1, message: kind === "exam" ? "Đề thi phải có ít nhất 1 phần." : "Bài học phải có ít nhất 1 phần." });
    return issues;
  }
  let questionCount = 0;
  sections.forEach((s, si) => {
    if (s.deleted_at) return;
    const label = `Phần ${si + 1}`;
    const qs = (s.questions || []).filter((q) => !q.deleted_at);
    questionCount += qs.length;
    if (!(SKILLS as string[]).includes(s.skill)) {
      issues.push({ section_index: si, message: `${label}: kỹ năng không hợp lệ.` });
      return;
    }
    const st = stimulusType(s);
    if (!plain(s.instruction) && !hasText(s) && !hasAudio(s) && qs.length === 0) {
      issues.push({ section_index: si, message: `${label} trống: thêm lời dẫn, ngữ cảnh hoặc câu hỏi.` });
    }
    if ((st === "AUDIO_ONLY" || st === "COMBINED") && !hasAudio(s) && !opts.allowMissingAudio) {
      issues.push({ section_index: si, message: `${label}: chọn ngữ cảnh audio nhưng chưa có audio.` });
    }
    if ((st === "TEXT_ONLY" || st === "COMBINED") && !hasText(s)) {
      issues.push({ section_index: si, message: `${label}: chọn ngữ cảnh chữ nhưng chưa có nội dung.` });
    }
    if (s.skill === "Listening" && qs.length > 0 && !hasAudio(s) && !opts.allowMissingAudio) {
      const allOwnAudio = qs.every((q) => q.category === "LISTENING_MC" && str((q.content || {}).audio_url).trim());
      if (!allOwnAudio) issues.push({ section_index: si, message: `${label}: phần Listening có câu hỏi phải có audio.` });
    }
    (s.questions || []).forEach((q, qi) => {
      if (q.deleted_at) return;
      if (!(CATEGORIES as readonly string[]).includes(q.category)) {
        issues.push({ section_index: si, question_index: qi, message: `${label}, câu ${qi + 1}: dạng câu không hợp lệ.` });
      } else if (skillOfCategory(q.category) !== s.skill) {
        issues.push({ section_index: si, question_index: qi, message: `${label}, câu ${qi + 1}: ${categoryLabel(q.category)} không thuộc kỹ năng ${s.skill}.` });
      }
    });
  });
  if (kind === "exam" && questionCount === 0) issues.push({ section_index: -1, message: "Đề thi phải có ít nhất 1 câu hỏi." });
  return issues;
}

/** Chuẩn hoá content từng câu như API câu hỏi cũ (đáp án chữ cái, inline_options_per_gap…). */
export function normalizeQuestionContent(q: TreeQuestion): Rec {
  const c = buildStandardQuestionContent({ category: q.category, ...(q.content || {}) }) as Rec;
  delete c.stimulus_type;
  return c;
}

// ───────────────────────────── đọc cây ─────────────────────────────

const parentCol = (kind: ParentKind) => (kind === "exam" ? "exam_id" : "lesson_id");
const parentTable = (kind: ParentKind) => (kind === "exam" ? "exams" : "lessons");
const iso = (v: unknown) => (v instanceof Date ? v.toISOString() : v == null ? null : str(v));
const asContent = (v: unknown): Rec => {
  if (v && typeof v === "object") return v as Rec;
  try { return JSON.parse(str(v) || "{}") as Rec; } catch { return {}; }
};

export interface LoadOptions {
  /** Câu đã xoá mềm vẫn trả về (trang xem lại bài nộp, BR-P10). */
  includeDeletedIds?: string[];
  /** Trả mọi phần / câu, kể cả đã xoá mềm. */
  includeAllDeleted?: boolean;
}

export async function loadTree(db: Queryable, kind: ParentKind, id: string, opts: LoadOptions = {}): Promise<TreeSection[]> {
  const sRes = await db.query(
    `SELECT * FROM sections WHERE ${parentCol(kind)} = $1 ORDER BY position ASC, created_at ASC`,
    [id]
  );
  const ids = sRes.rows.map((r) => str(r.id));
  const qRes = ids.length
    ? await db.query(`SELECT * FROM questions WHERE section_id = ANY($1) ORDER BY position ASC, created_at ASC`, [ids])
    : { rows: [] as Rec[] };
  const keep = new Set(opts.includeDeletedIds || []);
  const bySection = new Map<string, TreeQuestion[]>();
  for (const r of qRes.rows) {
    const deleted = r.deleted_at != null;
    if (deleted && !opts.includeAllDeleted && !keep.has(str(r.id))) continue;
    const list = bySection.get(str(r.section_id)) || [];
    list.push({
      id: str(r.id),
      category: str(r.category),
      prompt: r.prompt == null ? null : str(r.prompt),
      content: asContent(r.content),
      skill: str(r.skill),
      position: Number(r.position) || 0,
      deleted_at: iso(r.deleted_at),
    });
    bySection.set(str(r.section_id), list);
  }
  const out: TreeSection[] = [];
  for (const r of sRes.rows) {
    const questions = bySection.get(str(r.id)) || [];
    if (r.deleted_at != null && !opts.includeAllDeleted && questions.length === 0) continue;
    out.push({
      id: str(r.id),
      skill: str(r.skill),
      instruction: r.instruction == null ? null : str(r.instruction),
      stimulus_type: str(r.stimulus_type) || "NONE",
      stimulus_text: r.stimulus_text == null ? null : str(r.stimulus_text),
      stimulus_audio_url: r.stimulus_audio_url == null ? null : str(r.stimulus_audio_url),
      stimulus_audio_text: r.stimulus_audio_text == null ? null : str(r.stimulus_audio_text),
      stimulus_audio_gender: r.stimulus_audio_gender == null ? null : str(r.stimulus_audio_gender),
      position: Number(r.position) || 0,
      deleted_at: iso(r.deleted_at),
      questions,
    });
  }
  return numberQuestions(out);
}

/** Danh sách câu phẳng theo thứ tự hiển thị (cho chấm điểm, đếm). */
export function flattenQuestions(sections: TreeSection[]): (TreeQuestion & { section_id?: string })[] {
  return sections.flatMap((s) => s.questions.map((q) => ({ ...q, section_id: s.id })));
}

/** Phiên bản để kiểm xung đột (BR-P08): mili-giây của `updated_at`, dạng ISO. */
export async function getVersion(db: Queryable, kind: ParentKind, id: string): Promise<string | null> {
  const r = await db.query(`SELECT floor(extract(epoch FROM updated_at) * 1000)::bigint AS v FROM ${parentTable(kind)} WHERE id = $1`, [id]);
  if (!r.rows.length || r.rows[0].v == null) return null;
  return new Date(Number(r.rows[0].v)).toISOString();
}

export async function hasAttempts(db: Queryable, kind: ParentKind, id: string): Promise<number> {
  const sql = kind === "exam"
    ? "SELECT COUNT(*)::int AS n FROM submissions WHERE exam_id = $1"
    : "SELECT COUNT(*)::int AS n FROM lesson_attempts WHERE lesson_id = $1";
  try {
    const r = await db.query(sql, [id]);
    return Number(r.rows[0]?.n) || 0;
  } catch {
    return 0;
  }
}

// ───────────────────────────── ghi cây (BR-P07 → BR-P09) ─────────────────────────────

export interface SaveTreeInput {
  kind: ParentKind;
  id: string;
  userId: string;
  /** `updated_at` client đã đọc (ISO). Bỏ trống = không kiểm (tạo mới). */
  expectedVersion?: string | null;
  sections: TreeSection[];
  /** AI nhập đề: phần Listening được lưu khi chưa có audio (giáo viên tải sau, cảnh báo AUDIO_MISSING). */
  allowMissingAudio?: boolean;
}

/**
 * Ghi cả cây. Gọi trong transaction do người gọi mở (BEGIN … COMMIT) để cập nhật bản ghi cha cùng lúc.
 * Ném TreeError(400 | 404 | 409).
 */
export async function saveTreeInTx(db: Queryable, input: SaveTreeInput): Promise<{ version: string; attempts: number }> {
  const { kind, id } = input;
  const table = parentTable(kind);
  const col = parentCol(kind);

  const lock = await db.query(`SELECT floor(extract(epoch FROM updated_at) * 1000)::bigint AS v FROM ${table} WHERE id = $1 FOR UPDATE`, [id]);
  if (!lock.rows.length) throw new TreeError(404, kind === "exam" ? "Không tìm thấy đề thi." : "Không tìm thấy bài học.");
  if (input.expectedVersion) {
    const expected = Date.parse(input.expectedVersion);
    if (!Number.isFinite(expected) || Number(lock.rows[0].v) !== expected) {
      throw new TreeError(409, kind === "exam" ? "Đề đã được sửa ở nơi khác, tải lại để tiếp tục." : "Bài học đã được sửa ở nơi khác, tải lại để tiếp tục.");
    }
  }

  const sections: TreeSection[] = (Array.isArray(input.sections) ? input.sections : []).map((s) => ({
    ...s,
    skill: str(s.skill),
    stimulus_type: stimulusType(s),
    questions: (Array.isArray(s.questions) ? s.questions : []).map((q) => ({ ...q, category: str(q.category), content: normalizeQuestionContent(q) })),
  }));

  const issues = validateTree(kind, sections, { allowMissingAudio: input.allowMissingAudio });
  if (issues.length) throw new TreeError(400, issues[0].message, issues);

  const existingSec = await db.query(`SELECT id, deleted_at FROM sections WHERE ${col} = $1`, [id]);
  const secIds = new Set(existingSec.rows.map((r) => str(r.id)));
  const existingQ = secIds.size
    ? await db.query(`SELECT id, deleted_at FROM questions WHERE section_id = ANY($1)`, [[...secIds]])
    : { rows: [] as Rec[] };
  const qIds = new Set(existingQ.rows.map((r) => str(r.id)));

  const seenS = new Set<string>();
  const seenQ = new Set<string>();
  sections.forEach((s, si) => {
    if (s.id) {
      if (!secIds.has(s.id) || seenS.has(s.id)) throw new TreeError(400, "Phần / câu không thuộc đề này.", [{ section_index: si, message: "Phần không thuộc đề này." }]);
      seenS.add(s.id);
    }
    s.questions.forEach((q, qi) => {
      if (!q.id) return;
      if (!qIds.has(q.id) || seenQ.has(q.id)) throw new TreeError(400, "Phần / câu không thuộc đề này.", [{ section_index: si, question_index: qi, message: "Câu không thuộc đề này." }]);
      seenQ.add(q.id);
    });
  });

  const attempts = await hasAttempts(db, kind, id);

  for (let si = 0; si < sections.length; si++) {
    const s = sections[si];
    const vals = [
      si, s.skill, str(s.instruction) || null, s.stimulus_type, str(s.stimulus_text) || null,
      str(s.stimulus_audio_url) || null, str(s.stimulus_audio_text) || null, str(s.stimulus_audio_gender) || null,
    ];
    let sectionId = s.id;
    if (sectionId) {
      await db.query(
        `UPDATE sections SET position = $2, skill = $3, instruction = $4, stimulus_type = $5, stimulus_text = $6,
           stimulus_audio_url = $7, stimulus_audio_text = $8, stimulus_audio_gender = $9, deleted_at = NULL, updated_at = NOW()
         WHERE id = $1`,
        [sectionId, ...vals]
      );
    } else {
      sectionId = "sec_" + globalThis.crypto.randomUUID();
      await db.query(
        `INSERT INTO sections (id, ${col}, position, skill, instruction, stimulus_type, stimulus_text,
           stimulus_audio_url, stimulus_audio_text, stimulus_audio_gender)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [sectionId, id, ...vals]
      );
    }
    for (let qi = 0; qi < s.questions.length; qi++) {
      const q = s.questions[qi];
      const prompt = str(q.prompt) || null;
      const content = JSON.stringify(q.content);
      if (q.id) {
        await db.query(
          `UPDATE questions SET section_id = $2, position = $3, skill = $4, category = $5, prompt = $6, content = $7::jsonb, deleted_at = NULL
           WHERE id = $1`,
          [q.id, sectionId, qi, s.skill, q.category, prompt, content]
        );
      } else {
        await db.query(
          `INSERT INTO questions (id, section_id, position, skill, category, prompt, content, created_by)
           VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8)`,
          ["q_" + globalThis.crypto.randomUUID(), sectionId, qi, s.skill, q.category, prompt, content, input.userId]
        );
      }
    }
  }

  const goneQ = existingQ.rows.filter((r) => r.deleted_at == null && !seenQ.has(str(r.id))).map((r) => str(r.id));
  const goneS = existingSec.rows.filter((r) => r.deleted_at == null && !seenS.has(str(r.id))).map((r) => str(r.id));
  if (attempts > 0) {
    if (goneQ.length) await db.query("UPDATE questions SET deleted_at = NOW() WHERE id = ANY($1)", [goneQ]);
    if (goneS.length) await db.query("UPDATE sections SET deleted_at = NOW() WHERE id = ANY($1)", [goneS]);
  } else {
    if (goneQ.length) await db.query("DELETE FROM questions WHERE id = ANY($1)", [goneQ]);
    if (goneS.length) await db.query("DELETE FROM sections WHERE id = ANY($1)", [goneS]);
  }

  const skills = [...new Set(sections.map((s) => s.skill))];
  const upd = await db.query(
    `UPDATE ${table} SET skills = $2, updated_at = date_trunc('milliseconds', NOW())
     WHERE id = $1 RETURNING floor(extract(epoch FROM updated_at) * 1000)::bigint AS v`,
    [id, skills]
  );
  return { version: new Date(Number(upd.rows[0]?.v)).toISOString(), attempts };
}

/** Bọc BEGIN / COMMIT / ROLLBACK quanh một hàm dùng client. */
export async function withTx<T>(db: Queryable, fn: (db: Queryable) => Promise<T>): Promise<T> {
  await db.query("BEGIN");
  try {
    const r = await fn(db);
    await db.query("COMMIT");
    return r;
  } catch (e) {
    await db.query("ROLLBACK").catch(() => undefined);
    throw e;
  }
}

// ───────────────────────────── nhập đề AI → phần (BR-P14) ─────────────────────────────

/** Dạng chấm khách quan: lời dẫn chung lên phần; dạng chấm AI giữ `prompt` ở câu (đề bài của câu). */
export const isObjectiveCategory = (cat: string) =>
  !(cat === "WRITING_ESSAY" || cat === "WRITING_SHORT_ANSWER" || cat === "WRITING_SENTENCE_REWRITE" || cat.startsWith("SPEAKING_"));

/** Câu gom nhiều ý (trắc nghiệm / trả lời ngắn có sub_questions) → mỗi ý một câu (BR-P12). */
export function splitSubQuestions(q: TreeQuestion): TreeQuestion[] {
  const c = (q.content || {}) as Rec;
  const subs = Array.isArray(c.sub_questions) ? (c.sub_questions as Rec[]) : null;
  if (!subs || !(q.category.endsWith("_MC") || q.category === "WRITING_SHORT_ANSWER")) return [q];
  const meta = c.import_meta ? { import_meta: c.import_meta } : {};
  return subs.map((sq) => {
    if (q.category === "WRITING_SHORT_ANSWER") {
      return { category: q.category, prompt: q.prompt ?? null, content: { text: str(sq.text), max_words: Number(sq.max_words) || 50, ...(sq.sample_answer ? { sample_answer: sq.sample_answer } : {}), ...meta } };
    }
    return {
      category: q.category,
      prompt: null,
      content: {
        text: str(sq.text), option_a: str(sq.option_a), option_b: str(sq.option_b), option_c: str(sq.option_c), option_d: str(sq.option_d),
        correct_answer: str(sq.correct_answer), audio_url: sq.audio_url || null,
        ...(Number(sq.number) > 0 ? { paper_number: Number(sq.number) } : {}), ...meta,
      },
    };
  });
}

export interface ImportedQuestion {
  /** Khoá nhóm đề giấy (tempId của nhóm). */
  group: string;
  skill: string;
  category: string;
  prompt: string;
  stimulus_text: string | null;
  content: Rec;
}

/**
 * BR-P14: mỗi nhóm đề giấy → một phần (lời dẫn nhóm = lời dẫn phần, bài đọc nhóm = ngữ cảnh phần);
 * nhóm liền nhau dùng chung một bài đọc (DEC-049) và cùng kỹ năng → chung một phần.
 */
export function importToSections(questions: ImportedQuestion[]): TreeSection[] {
  const out: TreeSection[] = [];
  let lastGroup: string | null = null;
  for (const q of questions) {
    const text = (q.stimulus_text || "").trim();
    const cur = out[out.length - 1];
    const sameGroup = cur && q.group === lastGroup && cur.skill === q.skill;
    const sharedPassage = cur && !!text && (cur.stimulus_text || "").trim() === text && cur.skill === q.skill;
    let target = cur;
    if (!(sameGroup || sharedPassage)) {
      target = {
        skill: q.skill,
        instruction: q.prompt || null,
        stimulus_type: text ? "TEXT_ONLY" : "NONE",
        stimulus_text: text || null,
        questions: [],
      };
      out.push(target);
    } else if (q.group !== lastGroup && q.prompt && target.instruction !== q.prompt) {
      // nhóm mới dùng chung bài đọc nhưng có lời dẫn riêng → nối lời dẫn
      target.instruction = [target.instruction, q.prompt].filter(Boolean).join("\n");
    }
    lastGroup = q.group;
    const keepPrompt = isObjectiveCategory(q.category) ? null : q.prompt || null;
    target.questions.push(...splitSubQuestions({ category: q.category, prompt: keepPrompt, content: q.content }));
  }
  return out;
}
