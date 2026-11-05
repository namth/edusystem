import { NextResponse } from "next/server";
import { requireRole } from "@/lib/api-auth";
import { queryPg } from "@/lib/db-pg";
import {
  applyExamTeacherEdits,
  applyLessonTeacherEdits,
  GradebookError,
  type TeacherEdit,
} from "@/lib/gradebook";
import {
  assertClassAccess,
  fail,
  loadFinalizeState,
  parseJson,
  parseKind,
  type ClassRow,
} from "@/lib/gradebook-data";
import { notifyExamGraded } from "@/lib/notifications";
import type { ItemKind } from "@/lib/gradebook";

type Ctx = { params: Promise<{ kind: string; attemptId: string }> };

function ts(v: any): number {
  const t = v instanceof Date ? v.getTime() : new Date(v).getTime();
  return Number.isNaN(t) ? 0 : t;
}

async function loadContext(user: { userId: string; role: string }, kindStr: string, attemptId: string) {
  const kind = parseKind(kindStr);
  if (!kind) return { error: fail(400, "kind phải là lesson hoặc exam.") };
  const res =
    kind === "EXAM"
      ? await queryPg(`SELECT s.*, COALESCE(s.submitted_at, s.created_at) AS submitted_at_eff FROM submissions s WHERE s.id = $1 LIMIT 1`, [attemptId])
      : await queryPg(`SELECT a.* FROM lesson_attempts a WHERE a.id = $1 LIMIT 1`, [attemptId]);
  const row = res.rows[0];
  const classId = row ? (kind === "EXAM" ? row.class_ref : row.class_id) : null;
  if (!row || !classId) return { error: fail(404, "Không tìm thấy lượt làm bài trong lớp.") };
  const access = await assertClassAccess(user, classId);
  if (access.error) return { error: access.error };
  const itemId = kind === "EXAM" ? row.exam_id : row.lesson_id;
  const fin = await loadFinalizeState(classId, kind, itemId);
  const submitted = kind === "EXAM" ? row.submitted_at_eff : row.created_at;
  const locked = !!(fin && fin.finalized_at) && ts(submitted) <= ts(fin.finalized_at);
  return { error: null as null, kind, row, cls: access.cls as ClassRow, itemId, locked };
}

function publicAttempt(kind: ItemKind, row: any) {
  if (kind === "EXAM") {
    return {
      id: row.id,
      kind: "exam",
      exam_id: row.exam_id,
      class_id: row.class_ref,
      student_id: row.student_id,
      status: row.status,
      submitted_at: row.submitted_at_eff ?? row.submitted_at ?? null,
      total_score: row.total_score === null || row.total_score === undefined ? null : Number(row.total_score),
      passed: row.passed ?? null,
      section_scores: parseJson(row.section_scores),
      standard_snapshot: parseJson(row.standard_snapshot),
      results: parseJson(row.results) || [],
      teacher_feedback: row.teacher_feedback ?? null,
      reviewed_at: row.reviewed_at ?? null,
      reviewed_by: row.reviewed_by ?? null,
    };
  }
  return {
    id: row.id,
    kind: "lesson",
    lesson_id: row.lesson_id,
    class_id: row.class_id,
    student_id: row.student_id,
    status: row.status,
    submitted_at: row.created_at,
    score_percent: row.score_percent === null || row.score_percent === undefined ? null : Number(row.score_percent),
    objective_earned: Number(row.objective_earned ?? 0),
    objective_max: Number(row.objective_max ?? 0),
    ai_earned: row.ai_earned === null || row.ai_earned === undefined ? null : Number(row.ai_earned),
    ai_max: Number(row.ai_max ?? 0),
    results: parseJson(row.results) || [],
    teacher_feedback: row.teacher_feedback ?? null,
    last_grading_error: row.last_grading_error ?? null,
    reviewed_at: row.reviewed_at ?? null,
    reviewed_by: row.reviewed_by ?? null,
  };
}

// GET /api/teacher/grading/attempts/[kind]/[attemptId] — chi tiết lượt kèm đáp án (người xem là giáo viên).
export async function GET(_req: Request, context: Ctx) {
  const auth = await requireRole(["ADMIN", "TEACHER"]);
  if (auth.error) return auth.error;
  const { kind: kindStr, attemptId } = await context.params;

  try {
    const ctx = await loadContext(auth.user, kindStr, attemptId);
    if (ctx.error) return ctx.error;
    const { kind, row, itemId, locked } = ctx;

    const parent =
      kind === "EXAM"
        ? await queryPg("SELECT question_ids FROM exams WHERE id = $1 LIMIT 1", [itemId])
        : await queryPg("SELECT question_ids FROM lessons WHERE id = $1 LIMIT 1", [itemId]);
    let qids: string[] = [];
    const rawIds = parseJson(parent.rows[0]?.question_ids);
    if (Array.isArray(rawIds)) qids = rawIds.map((x: any) => String(x));
    const answers = parseJson(row.answers) || {};
    const results: any[] = parseJson(row.results) || [];

    const qRes =
      qids.length > 0
        ? await queryPg(
            "SELECT id, skill, category, prompt, content, stimulus_text, stimulus_audio_url FROM questions WHERE id = ANY($1::text[])",
            [qids]
          )
        : { rows: [] as any[] };
    const qMap = new Map<string, any>(qRes.rows.map((q: any) => [q.id, q]));

    const questions = qids
      .filter((id) => qMap.has(id))
      .map((id) => {
        const q = qMap.get(id);
        return {
          id,
          category: q.category,
          skill: q.skill,
          prompt: q.prompt,
          stimulus: { text: q.stimulus_text ?? null, audio_url: q.stimulus_audio_url ?? null },
          content: parseJson(q.content),
          answer: answers[id] ?? null,
          result: results.find((r: any) => r && r.question_id === id) ?? null,
        };
      });

    const st = await queryPg("SELECT id, name FROM users WHERE id = $1 LIMIT 1", [row.student_id]);
    return NextResponse.json({
      attempt: publicAttempt(kind, row),
      student: { id: row.student_id, name: st.rows[0]?.name ?? row.student_id },
      questions,
      locked,
    });
  } catch (err: any) {
    console.error("GET attempts/[kind]/[attemptId] error:", err);
    return fail(500, err.message || "Lỗi tải lượt làm bài.");
  }
}

// PUT /api/teacher/grading/attempts/[kind]/[attemptId] — sửa điểm/nhận xét câu AI, tính lại điểm.
export async function PUT(req: Request, context: Ctx) {
  const auth = await requireRole(["ADMIN", "TEACHER"]);
  if (auth.error) return auth.error;
  const user = auth.user;
  const { kind: kindStr, attemptId } = await context.params;

  try {
    const ctx = await loadContext(user, kindStr, attemptId);
    if (ctx.error) return ctx.error;
    const { kind, row, locked } = ctx;

    let body: any = {};
    try {
      body = await req.json();
    } catch {
      body = {};
    }
    if (!body || typeof body !== "object" || Array.isArray(body)) return fail(400, "Body không hợp lệ.");

    const rawItems = body.items === undefined ? [] : body.items;
    if (!Array.isArray(rawItems)) return fail(400, "items phải là mảng.");
    const edits: TeacherEdit[] = [];
    for (const it of rawItems) {
      if (!it || typeof it.question_id !== "string") return fail(400, "Mỗi mục cần question_id.");
      if (it.teacher_score !== null && it.teacher_score !== undefined && typeof it.teacher_score !== "number") {
        return fail(400, "teacher_score phải là số hoặc null.");
      }
      if (it.teacher_feedback !== undefined && it.teacher_feedback !== null) {
        if (typeof it.teacher_feedback !== "string" || it.teacher_feedback.length > 2000) {
          return fail(400, "Nhận xét tối đa 2000 ký tự.");
        }
      }
      edits.push({
        question_id: it.question_id,
        item_key: it.item_key === undefined || it.item_key === null ? undefined : String(it.item_key),
        teacher_score: it.teacher_score === undefined ? null : it.teacher_score,
        teacher_feedback: it.teacher_feedback ?? undefined,
      });
    }
    if (body.feedback !== undefined && body.feedback !== null) {
      if (typeof body.feedback !== "string" || body.feedback.length > 2000) {
        return fail(400, "Nhận xét chung tối đa 2000 ký tự.");
      }
    }
    const feedback: string | null = typeof body.feedback === "string" ? body.feedback : null;

    if (row.status === "IN_PROGRESS" || row.status === "GRADING") {
      return fail(409, "Lượt đang làm hoặc đang chấm, chưa sửa được.", { code: "ATTEMPT_NOT_READY" });
    }
    if (locked) {
      return fail(409, "Bài đã chốt — mở chốt để sửa.", { code: "GRADEBOOK_FINALIZED" });
    }

    const now = new Date();
    let updated: any;
    let examGraded = false;
    try {
      if (kind === "EXAM") {
        const snapshot = parseJson(row.standard_snapshot) || {};
        const r = applyExamTeacherEdits(parseJson(row.results) || [], snapshot, edits, user.userId, now);
        const becomesGraded = row.status === "NEEDS_REVIEW" && r.allAiScored;
        const res = await queryPg(
          `UPDATE submissions
           SET results = $1, section_scores = $2, total_score = $3, passed = $4,
               teacher_feedback = COALESCE($5, teacher_feedback),
               status = CASE WHEN $6::boolean THEN 'GRADED' ELSE status END,
               graded_at = CASE WHEN $6::boolean THEN NOW() ELSE graded_at END,
               reviewed_at = NOW(), reviewed_by = $7
           WHERE id = $8 RETURNING *`,
          [
            JSON.stringify(r.results),
            JSON.stringify(r.section_scores),
            r.total_score,
            r.passed,
            feedback,
            becomesGraded,
            user.userId,
            attemptId,
          ]
        );
        updated = res.rows[0];
        examGraded = updated.status === "GRADED";
      } else {
        const r = applyLessonTeacherEdits(
          parseJson(row.results) || [],
          {
            objective_earned: Number(row.objective_earned ?? 0),
            objective_max: Number(row.objective_max ?? 0),
            ai_max: Number(row.ai_max ?? 0),
          },
          edits,
          user.userId,
          now
        );
        const becomesGraded = row.status === "NEEDS_REVIEW" && r.allAiScored;
        const res = await queryPg(
          `UPDATE lesson_attempts
           SET results = $1, ai_earned = $2, score_percent = $3,
               teacher_feedback = COALESCE($4, teacher_feedback),
               status = CASE WHEN $5::boolean THEN 'GRADED' ELSE status END,
               graded_at = CASE WHEN $5::boolean THEN NOW() ELSE graded_at END,
               reviewed_at = NOW(), reviewed_by = $6
           WHERE id = $7 RETURNING *`,
          [JSON.stringify(r.results), r.ai_earned, r.score_percent, feedback, becomesGraded, user.userId, attemptId]
        );
        updated = res.rows[0];
      }
    } catch (err) {
      if (err instanceof GradebookError) {
        return fail(err.status, err.message, { code: err.code });
      }
      throw err;
    }

    if (kind === "EXAM" && examGraded) await notifyExamGraded(attemptId);

    return NextResponse.json({ success: true, attempt: publicAttempt(kind, updated) });
  } catch (err: any) {
    console.error("PUT attempts/[kind]/[attemptId] error:", err);
    return fail(500, err.message || "Lỗi lưu điểm lượt làm bài.");
  }
}
