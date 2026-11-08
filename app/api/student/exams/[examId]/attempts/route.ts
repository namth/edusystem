import { NextResponse } from "next/server";
import crypto from "crypto";
import { requireRole } from "@/lib/api-auth";
import { queryPg } from "@/lib/db-pg";
import { assertClassOpen, classLockedResponse } from "@/lib/class-billing";
import {
  checkExamAccess,
  resolveStandardForExam,
  ensureAttemptsSchema,
} from "@/lib/exam-attempts";

export async function POST(
  req: Request,
  context: { params: Promise<{ examId: string }> }
) {
  const auth = await requireRole(["STUDENT"]);
  if (auth.error) return auth.error;

  const { examId } = await context.params;
  const studentId = auth.user.userId;

  await ensureAttemptsSchema();

  const examRes = await queryPg(
    "SELECT id, title, duration_minutes, created_by FROM exams WHERE id = $1 LIMIT 1",
    [examId]
  );
  if (examRes.rows.length === 0) {
    return NextResponse.json(
      { success: false, error: "Đề thi không tồn tại." },
      { status: 404 }
    );
  }
  const exam = examRes.rows[0];

  const body = await req.json().catch(() => ({}));
  const classId =
    typeof body.classId === "string" && body.classId.trim() !== ""
      ? body.classId.trim()
      : null;

  if (classId) {
    const classCheck = await assertClassOpen(classId);
    if (!classCheck.ok) {
      return classLockedResponse();
    }
  }

  const access = await checkExamAccess(examId, studentId, classId);
  if (!access.allowed) {
    return NextResponse.json(
      { success: false, error: access.error || "Không có quyền làm đề thi này." },
      { status: access.status || 403 }
    );
  }

  // Kiểm tra lượt IN_PROGRESS cùng class_ref
  const existingRes = classId
    ? await queryPg(
        "SELECT * FROM submissions WHERE student_id = $1 AND exam_id = $2 AND class_ref = $3 AND status = 'IN_PROGRESS' ORDER BY created_at DESC LIMIT 1",
        [studentId, examId, classId]
      )
    : await queryPg(
        "SELECT * FROM submissions WHERE student_id = $1 AND exam_id = $2 AND class_ref IS NULL AND status = 'IN_PROGRESS' ORDER BY created_at DESC LIMIT 1",
        [studentId, examId]
      );

  const remainingAttempts =
    access.limit != null ? Math.max(0, access.limit - access.used) : null;

  if (existingRes.rows.length > 0) {
    const existing = existingRes.rows[0];
    const answers =
      typeof existing.answers === "string"
        ? JSON.parse(existing.answers)
        : existing.answers || {};

    return NextResponse.json(
      {
        success: true,
        attempt: {
          id: existing.id,
          exam_id: existing.exam_id,
          status: existing.status,
          started_at: existing.started_at,
          deadline_at: existing.deadline_at,
          answers,
        },
        remaining_attempts: remainingAttempts,
      },
      { status: 200 }
    );
  }

  if (access.limit != null && access.used >= access.limit) {
    return NextResponse.json(
      { success: false, error: "Đã vượt quá số lượt làm bài cho phép." },
      { status: 409 }
    );
  }

  const durationMinutes = Number(exam.duration_minutes || 60);
  const standardSnapshot = await resolveStandardForExam(examId);
  const newId = "sub_" + crypto.randomUUID();

  const insertRes = await queryPg(
    `INSERT INTO submissions (
       id, exam_id, student_id, answers, status,
       started_at, deadline_at, class_ref, standard_snapshot
     ) VALUES (
       $1, $2, $3, $4, 'IN_PROGRESS',
       NOW(), NOW() + ($5 * INTERVAL '1 minute'), $6, $7
     ) RETURNING id, exam_id, status, started_at, deadline_at, answers;`,
    [
      newId,
      examId,
      studentId,
      JSON.stringify({}),
      durationMinutes,
      classId,
      JSON.stringify(standardSnapshot),
    ]
  );

  const row = insertRes.rows[0];
  const answers =
    typeof row.answers === "string" ? JSON.parse(row.answers) : row.answers || {};

  return NextResponse.json(
    {
      success: true,
      attempt: {
        id: row.id,
        exam_id: row.exam_id,
        status: row.status,
        started_at: row.started_at,
        deadline_at: row.deadline_at,
        answers,
      },
      remaining_attempts: remainingAttempts,
    },
    { status: 201 }
  );
}
