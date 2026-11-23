import crypto from "crypto";
import { ensureSchema, getPgPool } from "@/lib/db-pg";

export interface QueryableClient {
  query: (sql: string, params?: any[]) => Promise<{ rows: any[]; rowCount?: number | null }>;
  release?: () => void;
}

export interface LessonUsages {
  curriculum: number;
  attempts: number;
}

export interface ExamUsages {
  curriculum: number;
  assignments: number;
  submissions: number;
}

export type ConvertFailReason = "NOT_FOUND" | "FORBIDDEN" | "IN_USE" | "HAS_STIMULUS";

export type ConvertItemResult =
  | { id: string; ok: true; new_id: string }
  | { id: string; ok: false; reason: ConvertFailReason; usages?: LessonUsages | ExamUsages };

export function parseQuestionIds(raw: unknown): string[] {
  if (Array.isArray(raw)) {
    return raw.filter((x): x is string => typeof x === "string" && x.trim().length > 0).map((x) => x.trim());
  }
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed.filter((x): x is string => typeof x === "string" && x.trim().length > 0).map((x) => x.trim());
      }
    } catch {
      return [];
    }
  }
  return [];
}

export async function getLessonUsages(client: QueryableClient, lessonId: string): Promise<LessonUsages> {
  const res = await client.query(
    `SELECT
      (SELECT COUNT(*)::int FROM curriculum_items WHERE lesson_id = $1) AS curriculum,
      (SELECT COUNT(*)::int FROM lesson_attempts WHERE lesson_id = $1) AS attempts;`,
    [lessonId]
  );
  const row = res.rows[0] || {};
  return {
    curriculum: Number(row.curriculum || 0),
    attempts: Number(row.attempts || 0),
  };
}

export async function getExamUsages(client: QueryableClient, examId: string): Promise<ExamUsages> {
  const res = await client.query(
    `SELECT
      (SELECT COUNT(*)::int FROM curriculum_items WHERE exam_id = $1) AS curriculum,
      (SELECT COUNT(*)::int FROM class_assignments WHERE exam_id = $1) AS assignments,
      (SELECT COUNT(*)::int FROM submissions WHERE exam_id = $1) AS submissions;`,
    [examId]
  );
  const row = res.rows[0] || {};
  return {
    curriculum: Number(row.curriculum || 0),
    assignments: Number(row.assignments || 0),
    submissions: Number(row.submissions || 0),
  };
}

/**
 * FEAT-017 (BR-P13): chép sâu các phần + câu (chưa xoá) từ đề / bài học này sang đề / bài học khác, id mới.
 */
export async function copySections(
  client: QueryableClient,
  from: { kind: "exam" | "lesson"; id: string },
  to: { kind: "exam" | "lesson"; id: string },
  createdBy: string
): Promise<number> {
  const fromCol = from.kind === "exam" ? "exam_id" : "lesson_id";
  const toCol = to.kind === "exam" ? "exam_id" : "lesson_id";
  const sRes = await client.query(
    `SELECT * FROM sections WHERE ${fromCol} = $1 AND deleted_at IS NULL ORDER BY position ASC, created_at ASC`,
    [from.id]
  );
  let count = 0;
  for (let si = 0; si < sRes.rows.length; si++) {
    const sec = sRes.rows[si];
    const newSecId = "sec_" + crypto.randomUUID();
    await client.query(
      `INSERT INTO sections (id, ${toCol}, position, skill, instruction, stimulus_type, stimulus_text,
         stimulus_audio_url, stimulus_audio_text, stimulus_audio_gender)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [newSecId, to.id, si, sec.skill, sec.instruction ?? null, sec.stimulus_type || "NONE", sec.stimulus_text ?? null,
        sec.stimulus_audio_url ?? null, sec.stimulus_audio_text ?? null, sec.stimulus_audio_gender ?? null]
    );
    const qRes = await client.query(
      `SELECT * FROM questions WHERE section_id = $1 AND deleted_at IS NULL ORDER BY position ASC, created_at ASC`,
      [sec.id]
    );
    for (let qi = 0; qi < qRes.rows.length; qi++) {
      const q = qRes.rows[qi];
      const contentJson = typeof q.content === "string" ? q.content : JSON.stringify(q.content ?? {});
      await client.query(
        `INSERT INTO questions (id, section_id, position, skill, category, prompt, content, created_by, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8, NOW())`,
        ["q_" + crypto.randomUUID(), newSecId, qi, q.skill ?? sec.skill, q.category, q.prompt ?? null, contentJson, createdBy]
      );
      count++;
    }
  }
  return count;
}

export async function convertLessonToExamItem(
  lessonId: string,
  authUser: { userId: string; role: string },
  durationMinutes: number
): Promise<ConvertItemResult> {
  await ensureSchema();
  const client = await getPgPool().connect();
  try {
    await client.query("BEGIN");

    const lRes = await client.query("SELECT * FROM lessons WHERE id = $1", [lessonId]);
    if (lRes.rows.length === 0) {
      await client.query("ROLLBACK");
      return { id: lessonId, ok: false, reason: "NOT_FOUND" };
    }

    const lesson = lRes.rows[0];
    if (authUser.role === "TEACHER" && lesson.created_by !== authUser.userId) {
      await client.query("ROLLBACK");
      return { id: lessonId, ok: false, reason: "FORBIDDEN" };
    }

    const usages = await getLessonUsages(client, lessonId);
    if (usages.curriculum > 0 || usages.attempts > 0) {
      await client.query("ROLLBACK");
      return { id: lessonId, ok: false, reason: "IN_USE", usages };
    }

    const newExamId = "exam_" + crypto.randomUUID();
    const skills: string[] = Array.isArray(lesson.skills) ? lesson.skills : [];
    const subjectId = lesson.subject_id || "english";

    await client.query(
      `INSERT INTO exams (id, title, description, duration_minutes, skills, created_by, subject_id, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, NOW());`,
      [newExamId, lesson.title, lesson.description ?? null, durationMinutes, skills, lesson.created_by, subjectId]
    );
    // FEAT-017 (BR-P13): chuyển loại = đổi cha của các phần, giữ nguyên id phần / câu
    await client.query("UPDATE sections SET lesson_id = NULL, exam_id = $1 WHERE lesson_id = $2", [newExamId, lessonId]);

    await client.query("DELETE FROM lessons WHERE id = $1", [lessonId]);
    await client.query("COMMIT");

    return { id: lessonId, ok: true, new_id: newExamId };
  } catch (err) {
    try {
      await client.query("ROLLBACK");
    } catch {
      // ignore rollback error
    }
    throw err;
  } finally {
    client.release?.();
  }
}

export async function convertExamToLessonItem(
  examId: string,
  authUser: { userId: string; role: string }
): Promise<ConvertItemResult> {
  await ensureSchema();
  const client = await getPgPool().connect();
  try {
    await client.query("BEGIN");

    const eRes = await client.query("SELECT * FROM exams WHERE id = $1", [examId]);
    if (eRes.rows.length === 0) {
      await client.query("ROLLBACK");
      return { id: examId, ok: false, reason: "NOT_FOUND" };
    }

    const exam = eRes.rows[0];
    if (authUser.role === "TEACHER" && exam.created_by !== authUser.userId) {
      await client.query("ROLLBACK");
      return { id: examId, ok: false, reason: "FORBIDDEN" };
    }

    const usages = await getExamUsages(client, examId);
    if (usages.curriculum > 0 || usages.assignments > 0 || usages.submissions > 0) {
      await client.query("ROLLBACK");
      return { id: examId, ok: false, reason: "IN_USE", usages };
    }

    const newLessonId = "lsn_" + crypto.randomUUID();
    const skills: string[] = Array.isArray(exam.skills) ? exam.skills : [];
    const subjectId = exam.subject_id || "english";

    await client.query(
      `INSERT INTO lessons (id, title, description, skills, created_by, subject_id, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW());`,
      [newLessonId, exam.title, exam.description ?? null, skills, exam.created_by, subjectId]
    );
    await client.query("UPDATE sections SET exam_id = NULL, lesson_id = $1 WHERE exam_id = $2", [newLessonId, examId]);

    await client.query("DELETE FROM exams WHERE id = $1", [examId]);
    await client.query("COMMIT");

    return { id: examId, ok: true, new_id: newLessonId };
  } catch (err) {
    try {
      await client.query("ROLLBACK");
    } catch {
      // ignore rollback error
    }
    throw err;
  } finally {
    client.release?.();
  }
}

export async function duplicateLessonInTx(
  lessonId: string,
  newTitle: string,
  authUser: { userId: string; role: string }
): Promise<{ status: 201; lesson: any } | { status: 403 | 404; error: string }> {
  await ensureSchema();
  const client = await getPgPool().connect();
  try {
    await client.query("BEGIN");

    const lRes = await client.query("SELECT * FROM lessons WHERE id = $1", [lessonId]);
    if (lRes.rows.length === 0) {
      await client.query("ROLLBACK");
      return { status: 404, error: "Bài học không tồn tại." };
    }

    const orig = lRes.rows[0];
    if (authUser.role === "TEACHER" && orig.created_by !== authUser.userId) {
      await client.query("ROLLBACK");
      return { status: 403, error: "Bạn không có quyền nhân bản bài học này." };
    }

    const newId = "lsn_" + crypto.randomUUID();
    const skills: string[] = Array.isArray(orig.skills) ? orig.skills : [];
    const subjectId = orig.subject_id || "english";

    const insRes = await client.query(
      `INSERT INTO lessons (id, title, description, skills, created_by, subject_id, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
       RETURNING *;`,
      [newId, newTitle, orig.description ?? null, skills, authUser.userId, subjectId]
    );
    await copySections(client, { kind: "lesson", id: lessonId }, { kind: "lesson", id: newId }, authUser.userId);

    await client.query("COMMIT");

    const row = insRes.rows[0];
    const lesson = {
      id: row.id,
      title: row.title,
      description: row.description,
      skills: Array.isArray(row.skills) ? row.skills : [],
      subject_id: row.subject_id || subjectId,
      created_by: row.created_by,
      created_at: row.created_at,
      updated_at: row.updated_at,
    };

    return { status: 201, lesson };
  } catch (err) {
    try {
      await client.query("ROLLBACK");
    } catch {
      // ignore rollback error
    }
    throw err;
  } finally {
    client.release?.();
  }
}

export async function duplicateExamInTx(
  examId: string,
  newTitle: string,
  authUser: { userId: string; role: string }
): Promise<{ status: 201; exam: any } | { status: 403 | 404; error: string }> {
  await ensureSchema();
  const client = await getPgPool().connect();
  try {
    await client.query("BEGIN");

    const eRes = await client.query("SELECT * FROM exams WHERE id = $1", [examId]);
    if (eRes.rows.length === 0) {
      await client.query("ROLLBACK");
      return { status: 404, error: "Đề thi không tồn tại." };
    }

    const orig = eRes.rows[0];
    if (authUser.role === "TEACHER" && orig.created_by !== authUser.userId) {
      await client.query("ROLLBACK");
      return { status: 403, error: "Bạn không có quyền nhân bản đề thi này." };
    }

    const newId = "exam_" + crypto.randomUUID();
    const skills: string[] = Array.isArray(orig.skills) ? orig.skills : [];
    const subjectId = orig.subject_id || "english";
    const durationMinutes = orig.duration_minutes ?? 60;

    const insRes = await client.query(
      `INSERT INTO exams (id, title, description, duration_minutes, skills, created_by, passing_score,
         scoring_standard_id, subject_id, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
       RETURNING *;`,
      [newId, newTitle, orig.description ?? null, durationMinutes, skills, authUser.userId,
        orig.passing_score ?? null, orig.scoring_standard_id ?? null, subjectId]
    );
    await copySections(client, { kind: "exam", id: examId }, { kind: "exam", id: newId }, authUser.userId);

    await client.query("COMMIT");

    const row = insRes.rows[0];
    const exam = {
      ...row,
      skills: Array.isArray(row.skills) ? row.skills : [],
      subject_id: row.subject_id || subjectId,
    };

    return { status: 201, exam };
  } catch (err) {
    try {
      await client.query("ROLLBACK");
    } catch {
      // ignore rollback error
    }
    throw err;
  } finally {
    client.release?.();
  }
}
