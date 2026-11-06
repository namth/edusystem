// Truy vấn DB cho bảng điểm theo lớp (FEAT-014, TASK-045). Hàm thuần nằm ở lib/gradebook.ts.
import crypto from "crypto";
import { NextResponse } from "next/server";
import { getPgPool, queryPg } from "@/lib/db-pg";
import { flattenRoadmap, type RoadmapItem } from "@/lib/roadmap";
import { submissionScore } from "@/lib/score-display";
import { notifyGradebookFinalized } from "@/lib/notifications";
import {
  mergeClassItems,
  pickCountedAttempt,
  examScore10,
  lessonScore10,
  checkFinalize,
  isPendingReview,
  average10,
  type AttemptLite,
  type ItemKind,
} from "@/lib/gradebook";

export type KindParam = "lesson" | "exam";

export function parseKind(s: string): ItemKind | null {
  if (s === "lesson") return "LESSON";
  if (s === "exam") return "EXAM";
  return null;
}

export function kindParam(k: ItemKind): KindParam {
  return k === "LESSON" ? "lesson" : "exam";
}

export function fail(status: number, error: string, extra: Record<string, unknown> = {}) {
  return NextResponse.json({ success: false, error, ...extra }, { status });
}

export function parseJson(v: unknown): any {
  if (typeof v === "string") {
    try {
      return JSON.parse(v);
    } catch {
      return null;
    }
  }
  return v ?? null;
}

function num(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isNaN(n) ? null : n;
}

export interface ClassRow {
  id: string;
  name: string;
  teacher_id: string;
  course_id: string | null;
}

export interface ClassItem {
  kind: ItemKind;
  id: string;
  title: string;
  source: "ROADMAP" | "ASSIGNMENT";
}

export async function ensureGradebookSchema(): Promise<void> {
  const stmts = [
    "ALTER TABLE submissions ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ",
    "ALTER TABLE submissions ADD COLUMN IF NOT EXISTS reviewed_by VARCHAR(50)",
    "ALTER TABLE submissions ADD COLUMN IF NOT EXISTS teacher_feedback TEXT",
    "ALTER TABLE lesson_attempts ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ",
    "ALTER TABLE lesson_attempts ADD COLUMN IF NOT EXISTS reviewed_by VARCHAR(50)",
    "ALTER TABLE lesson_attempts ADD COLUMN IF NOT EXISTS teacher_feedback TEXT",
    "ALTER TABLE lesson_attempts ADD COLUMN IF NOT EXISTS last_grading_error TEXT",
    `CREATE TABLE IF NOT EXISTS class_grade_items (
      id VARCHAR(50) PRIMARY KEY,
      class_id VARCHAR(50) NOT NULL,
      item_kind VARCHAR(10) NOT NULL,
      item_id VARCHAR(50) NOT NULL,
      finalized_at TIMESTAMPTZ,
      finalized_by VARCHAR(50),
      reopened_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE (class_id, item_kind, item_id)
    )`,
    `CREATE TABLE IF NOT EXISTS class_grades (
      id VARCHAR(50) PRIMARY KEY,
      class_id VARCHAR(50) NOT NULL,
      item_kind VARCHAR(10) NOT NULL,
      item_id VARCHAR(50) NOT NULL,
      student_id VARCHAR(50) NOT NULL,
      chosen_attempt_id VARCHAR(50),
      manual_score10 NUMERIC,
      note TEXT,
      attempt_id VARCHAR(50),
      raw_score NUMERIC,
      raw_max NUMERIC,
      score10 NUMERIC,
      passed BOOLEAN,
      finalized_at TIMESTAMPTZ,
      updated_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE (class_id, item_kind, item_id, student_id)
    )`,
  ];
  for (const s of stmts) {
    try {
      await queryPg(s);
    } catch {
      // bỏ qua từng lệnh nếu bảng phụ thuộc chưa tồn tại
    }
  }
}

/** Guard dùng chung: lớp không có → 404; TEACHER không phải chủ lớp → 403; ADMIN mọi lớp. */
export async function assertClassAccess(
  user: { userId: string; role: string },
  classId: string
): Promise<{ cls: ClassRow; error: null } | { cls: null; error: NextResponse }> {
  await ensureGradebookSchema();
  const res = await queryPg("SELECT id, name, teacher_id, course_id FROM classes WHERE id = $1 LIMIT 1", [classId]);
  const cls = res.rows[0];
  if (!cls) return { cls: null, error: fail(404, "Lớp học không tồn tại.") };
  if (user.role === "TEACHER" && cls.teacher_id !== user.userId) {
    return { cls: null, error: fail(403, "Bạn không có quyền với lớp học này.") };
  }
  return { cls: cls as ClassRow, error: null };
}

/** BR-B01: bài của lớp = lộ trình ∪ đề giao. */
export async function loadClassItems(cls: ClassRow): Promise<ClassItem[]> {
  const roadmap: { kind: ItemKind; id: string; title: string }[] = [];
  if (cls.course_id) {
    const res = await queryPg(
      `SELECT ci.id, ci.parent_id, ci.type, ci.order_index, ci.lesson_id, ci.exam_id, ci.title,
              l.title AS lesson_title, e.title AS exam_title
       FROM curriculum_items ci
       LEFT JOIN lessons l ON l.id = ci.lesson_id
       LEFT JOIN exams e ON e.id = ci.exam_id
       WHERE ci.course_id = $1`,
      [cls.course_id]
    );
    const flat = flattenRoadmap(res.rows as RoadmapItem[]);
    for (const r of flat as any[]) {
      if (r.type === "LESSON" && r.lesson_id) {
        roadmap.push({ kind: "LESSON", id: r.lesson_id, title: r.lesson_title || r.title || r.lesson_id });
      } else if (r.type === "EXAM" && r.exam_id) {
        roadmap.push({ kind: "EXAM", id: r.exam_id, title: r.exam_title || r.title || r.exam_id });
      }
    }
  }
  const asg = await queryPg(
    `SELECT ca.exam_id, e.title FROM class_assignments ca
     LEFT JOIN exams e ON e.id = ca.exam_id
     WHERE ca.class_id = $1 ORDER BY ca.created_at ASC, ca.id ASC`,
    [cls.id]
  );
  return mergeClassItems(
    roadmap,
    asg.rows.map((r: any) => ({ exam_id: r.exam_id, title: r.title || r.exam_id }))
  );
}

export async function findClassItem(cls: ClassRow, kind: ItemKind, itemId: string): Promise<ClassItem | null> {
  const items = await loadClassItems(cls);
  return items.find((i) => i.kind === kind && i.id === itemId) || null;
}

export interface Student {
  id: string;
  name: string;
}

export async function loadStudents(classId: string): Promise<Student[]> {
  const res = await queryPg(
    `SELECT DISTINCT u.id, u.name FROM enrollments e JOIN users u ON u.id = e.student_id
     WHERE e.class_id = $1 ORDER BY u.name ASC, u.id ASC`,
    [classId]
  );
  return res.rows.map((r: any) => ({ id: r.id, name: r.name }));
}

export interface AttemptRec {
  lite: AttemptLite;
  student_id: string;
  item_id: string;
  kind: ItemKind;
  row: any;
}

function hasAi(results: any): boolean {
  const arr = parseJson(results);
  return Array.isArray(arr) && arr.some((r: any) => r && r.kind === "AI");
}

export function toAttemptRec(kind: ItemKind, row: any): AttemptRec {
  const results = parseJson(row.results);
  const isExam = kind === "EXAM";
  const submitted = isExam ? row.submitted_at_eff ?? row.submitted_at ?? row.created_at : row.created_at;
  return {
    kind,
    student_id: row.student_id,
    item_id: isExam ? row.exam_id : row.lesson_id,
    row,
    lite: {
      id: row.id,
      status: row.status,
      score: isExam ? num(row.total_score) : num(row.score_percent),
      submitted_at: submitted,
      has_ai: hasAi(results),
      reviewed_at: row.reviewed_at ?? null,
    },
  };
}

/** BR-B02: lượt thuộc bài trong lớp. */
export async function loadAttempts(classId: string, kind: ItemKind, itemIds: string[]): Promise<AttemptRec[]> {
  if (itemIds.length === 0) return [];
  if (kind === "EXAM") {
    const res = await queryPg(
      `SELECT s.*, COALESCE(s.submitted_at, s.created_at) AS submitted_at_eff
       FROM submissions s
       WHERE s.class_ref = $1 AND s.exam_id = ANY($2::text[]) AND s.status <> 'IN_PROGRESS'`,
      [classId, itemIds]
    );
    return res.rows.map((r: any) => toAttemptRec("EXAM", r));
  }
  const res = await queryPg(
    `SELECT a.* FROM lesson_attempts a WHERE a.class_id = $1 AND a.lesson_id = ANY($2::text[])`,
    [classId, itemIds]
  );
  return res.rows.map((r: any) => toAttemptRec("LESSON", r));
}

export async function loadFinalizeState(classId: string, kind: ItemKind, itemId: string) {
  try {
    const res = await queryPg(
      `SELECT id, finalized_at, finalized_by, reopened_at FROM class_grade_items
       WHERE class_id = $1 AND item_kind = $2 AND item_id = $3 LIMIT 1`,
      [classId, kind, itemId]
    );
    return res.rows[0] || null;
  } catch {
    return null;
  }
}

export interface Cell {
  attempt_id: string | null;
  source: string;
  state: string;
  raw_score: number | null;
  raw_max: number | null;
  score10: number | null;
  passed: boolean | null;
  sections?: any;
}

function liveCell(kind: ItemKind, picked: ReturnType<typeof pickCountedAttempt>, rec: AttemptRec | undefined, manual: number | null): Cell {
  if (picked.source === "MANUAL") {
    return { attempt_id: null, source: "MANUAL", state: "GRADED", raw_score: manual, raw_max: 10, score10: manual, passed: null };
  }
  if (picked.attempt && rec) {
    const row = rec.row;
    if (kind === "EXAM") {
      const sub = { ...row, standard_snapshot: parseJson(row.standard_snapshot), section_scores: parseJson(row.section_scores) };
      const sc = submissionScore(sub);
      return {
        attempt_id: row.id,
        source: picked.source,
        state: "GRADED",
        raw_score: num(row.total_score),
        raw_max: sc.max,
        score10: examScore10(sub),
        passed: typeof row.passed === "boolean" ? row.passed : null,
        sections: sub.section_scores,
      };
    }
    const pct = num(row.score_percent);
    return {
      attempt_id: row.id,
      source: picked.source,
      state: "GRADED",
      raw_score: pct,
      raw_max: pct === null ? null : 100,
      score10: lessonScore10(pct),
      passed: null,
    };
  }
  return { attempt_id: null, source: picked.source, state: picked.state, raw_score: null, raw_max: null, score10: null, passed: null };
}

export interface InternalRow {
  student: Student;
  recs: AttemptRec[];
  picked: ReturnType<typeof pickCountedAttempt>;
  cell: Cell;
  grade: any | null;
}

export async function loadGrades(classId: string, kind: ItemKind, itemIds: string[]): Promise<any[]> {
  if (itemIds.length === 0) return [];
  try {
    const res = await queryPg(
      `SELECT * FROM class_grades WHERE class_id = $1 AND item_kind = $2 AND item_id = ANY($3::text[])`,
      [classId, kind, itemIds]
    );
    return res.rows;
  } catch {
    return [];
  }
}

export function computeRows(
  kind: ItemKind,
  students: Student[],
  recs: AttemptRec[],
  grades: any[],
  finalizedAt: Date | string | null
): InternalRow[] {
  return students.map((student) => {
    const mine = recs.filter((r) => r.student_id === student.id);
    const grade = grades.find((g) => g.student_id === student.id) || null;
    const manual = grade ? num(grade.manual_score10) : null;
    const picked = pickCountedAttempt(
      mine.map((r) => r.lite),
      { chosenAttemptId: grade?.chosen_attempt_id ?? null, manualScore10: manual }
    );
    let cell: Cell;
    if (finalizedAt) {
      const hasSnap = grade && (grade.attempt_id || num(grade.score10) !== null);
      const snapRec = grade?.attempt_id ? mine.find((r) => r.lite.id === grade.attempt_id) : undefined;
      cell = {
        attempt_id: grade?.attempt_id ?? null,
        source: grade?.attempt_id ? "SNAPSHOT" : hasSnap ? "MANUAL" : "NONE",
        state: hasSnap ? "GRADED" : "NOT_SUBMITTED",
        raw_score: grade ? num(grade.raw_score) : null,
        raw_max: grade ? num(grade.raw_max) : null,
        score10: grade ? num(grade.score10) : null,
        passed: grade && typeof grade.passed === "boolean" ? grade.passed : null,
        sections: snapRec ? parseJson(snapRec.row.section_scores) : undefined,
      };
    } else {
      const rec = picked.attempt ? mine.find((r) => r.lite.id === picked.attempt!.id) : undefined;
      cell = liveCell(kind, picked, rec, manual);
    }
    return { student, recs: mine, picked, cell, grade };
  });
}

function ts(v: any): number {
  const t = v instanceof Date ? v.getTime() : new Date(v).getTime();
  return Number.isNaN(t) ? 0 : t;
}

export function toApiRow(r: InternalRow, finalizedAt: Date | string | null) {
  const fin = finalizedAt ? ts(finalizedAt) : null;
  return {
    student: r.student,
    attempts: r.recs.map((a) => ({
      id: a.lite.id,
      status: a.lite.status,
      score: a.lite.score,
      score10:
        a.kind === "EXAM"
          ? examScore10({ ...a.row, standard_snapshot: parseJson(a.row.standard_snapshot) })
          : lessonScore10(a.lite.score),
      submitted_at: a.lite.submitted_at,
      has_ai: a.lite.has_ai,
      reviewed_at: a.lite.reviewed_at,
      after_finalize: fin !== null && ts(a.lite.submitted_at) > fin,
    })),
    counted_attempt_id: r.cell.attempt_id,
    chosen_attempt_id: r.grade?.chosen_attempt_id ?? null,
    manual_score10: r.grade ? num(r.grade.manual_score10) : null,
    note: r.grade?.note ?? null,
    cell: r.cell,
  };
}

export async function loadItemData(cls: ClassRow, kind: ItemKind, itemId: string) {
  const [students, recs, grades, fin] = await Promise.all([
    loadStudents(cls.id),
    loadAttempts(cls.id, kind, [itemId]),
    loadGrades(cls.id, kind, [itemId]),
    loadFinalizeState(cls.id, kind, itemId),
  ]);
  const finalizedAt = fin?.finalized_at ?? null;
  const rows = computeRows(kind, students, recs, grades, finalizedAt);
  return { students, recs, grades, fin, finalizedAt, rows };
}

export async function upsertStudentCell(
  cls: ClassRow,
  kind: ItemKind,
  itemId: string,
  studentId: string,
  v: { chosen_attempt_id: string | null; manual_score10: number | null; note: string | null }
) {
  await queryPg(
    `INSERT INTO class_grades (id, class_id, item_kind, item_id, student_id, chosen_attempt_id, manual_score10, note, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
     ON CONFLICT (class_id, item_kind, item_id, student_id)
     DO UPDATE SET chosen_attempt_id = EXCLUDED.chosen_attempt_id, manual_score10 = EXCLUDED.manual_score10,
                   note = EXCLUDED.note, updated_at = NOW()`,
    ["cgr_" + crypto.randomUUID(), cls.id, kind, itemId, studentId, v.chosen_attempt_id, v.manual_score10, v.note]
  );
}

/** BR-B08: chốt bài, ảnh chụp trong một giao dịch, thông báo sau COMMIT. */
export async function finalizeItem(
  cls: ClassRow,
  kind: ItemKind,
  itemId: string,
  userId: string,
  confirmUnreviewed: boolean
): Promise<{ status: number; body: any }> {
  const data = await loadItemData(cls, kind, itemId);
  if (data.finalizedAt) {
    return { status: 409, body: { success: false, code: "ALREADY_FINALIZED", error: "Bài đã được chốt." } };
  }
  const check = checkFinalize(
    data.rows.map((r) => ({
      student_id: r.student.id,
      attempts: r.recs.map((a) => a.lite),
      counted: r.picked.attempt,
    })),
    confirmUnreviewed
  );
  if (!check.ok) {
    if (check.code === "GRADING_PENDING") {
      return {
        status: 409,
        body: { success: false, code: check.code, students: check.students, error: "Còn lượt đang chấm hoặc cần chấm tay." },
      };
    }
    return {
      status: 409,
      body: { success: false, code: check.code, count: check.count, error: "Còn bài AI chưa được duyệt." },
    };
  }

  const client = await getPgPool().connect();
  let gradeItemId = "";
  let finalizedAt: any = null;
  try {
    await client.query("BEGIN");
    const item = await client.query(
      `INSERT INTO class_grade_items (id, class_id, item_kind, item_id, finalized_at, finalized_by)
       VALUES ($1, $2, $3, $4, NOW(), $5)
       ON CONFLICT (class_id, item_kind, item_id)
       DO UPDATE SET finalized_at = NOW(), finalized_by = EXCLUDED.finalized_by
       RETURNING id, finalized_at`,
      ["cgi_" + crypto.randomUUID(), cls.id, kind, itemId, userId]
    );
    gradeItemId = item.rows[0].id;
    finalizedAt = item.rows[0].finalized_at;

    for (const r of data.rows) {
      const c = r.cell;
      await client.query(
        `INSERT INTO class_grades (id, class_id, item_kind, item_id, student_id, attempt_id, raw_score, raw_max, score10, passed, finalized_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW(), NOW())
         ON CONFLICT (class_id, item_kind, item_id, student_id)
         DO UPDATE SET attempt_id = EXCLUDED.attempt_id, raw_score = EXCLUDED.raw_score, raw_max = EXCLUDED.raw_max,
                       score10 = EXCLUDED.score10, passed = EXCLUDED.passed, finalized_at = NOW(), updated_at = NOW()`,
        ["cgr_" + crypto.randomUUID(), cls.id, kind, itemId, r.student.id, c.attempt_id, c.raw_score, c.raw_max, c.score10, c.passed]
      );
    }

    if (check.markReviewedIds.length > 0) {
      const table = kind === "EXAM" ? "submissions" : "lesson_attempts";
      await client.query(
        `UPDATE ${table} SET reviewed_at = NOW(), reviewed_by = $1 WHERE id = ANY($2::text[])`,
        [userId, check.markReviewedIds]
      );
    }
    await client.query("COMMIT");
  } catch (err) {
    try {
      await client.query("ROLLBACK");
    } catch {
      // bỏ qua lỗi rollback
    }
    throw err;
  } finally {
    client.release();
  }

  const notified = await notifyGradebookFinalized(gradeItemId);
  return { status: 200, body: { success: true, finalized_at: finalizedAt, notified } };
}

export { average10, isPendingReview };

/** Guard chung cho route theo bài: kind 400 → lớp 404/403 → bài không thuộc lớp 404. */
export async function resolveItem(
  user: { userId: string; role: string },
  classId: string,
  kindStr: string,
  itemId: string
): Promise<
  | { error: NextResponse; cls?: undefined; kind?: undefined; item?: undefined }
  | { error: null; cls: ClassRow; kind: ItemKind; item: ClassItem }
> {
  const kind = parseKind(kindStr);
  if (!kind) return { error: fail(400, "kind phải là lesson hoặc exam.") };
  const access = await assertClassAccess(user, classId);
  if (access.error) return { error: access.error };
  const item = await findClassItem(access.cls, kind, itemId);
  if (!item) return { error: fail(404, "Không tìm thấy bài trong lớp.") };
  return { error: null, cls: access.cls, kind, item };
}
