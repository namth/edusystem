import { NextResponse } from "next/server";
import { requireRole } from "@/lib/api-auth";
import { queryPg } from "@/lib/db-pg";
import {
  type ScoringStandard,
  aggregateTotal,
} from "@/lib/exam-scoring";
import {
  ensureAttemptsSchema,
  formatAttemptResponse,
} from "@/lib/exam-attempts";
import { notifyExamGraded } from "@/lib/notifications";

export async function PUT(req: Request) {
  const auth = await requireRole(["ADMIN", "TEACHER"]);
  if (auth.error) return auth.error;

  const body = await req.json().catch(() => ({}));
  const { submissionId, section_scores, feedback } = body;

  if (!submissionId) {
    return NextResponse.json(
      { success: false, error: "Missing submissionId" },
      { status: 400 }
    );
  }

  await ensureAttemptsSchema();

  const subRes = await queryPg(
    `SELECT s.*, e.created_by AS exam_created_by, c.teacher_id AS class_teacher_id
     FROM submissions s
     LEFT JOIN exams e ON e.id = s.exam_id
     LEFT JOIN classes c ON c.id = s.class_ref
     WHERE s.id = $1 LIMIT 1`,
    [submissionId]
  );

  if (subRes.rows.length === 0) {
    return NextResponse.json(
      { success: false, error: "Submission not found" },
      { status: 404 }
    );
  }

  const sub = subRes.rows[0];

  // TEACHER phải là người tạo đề hoặc giáo viên của lớp class_ref
  if (auth.user.role === "TEACHER") {
    const isOwner = sub.exam_created_by === auth.user.userId;
    const isClassTeacher = sub.class_teacher_id === auth.user.userId;
    if (!isOwner && !isClassTeacher) {
      return NextResponse.json(
        { success: false, error: "Bạn không có quyền sửa điểm bài thi này." },
        { status: 403 }
      );
    }
  }

  if (
    !section_scores ||
    typeof section_scores !== "object" ||
    Array.isArray(section_scores)
  ) {
    return NextResponse.json(
      { success: false, error: "section_scores phải là object." },
      { status: 400 }
    );
  }

  const snapshot: ScoringStandard =
    typeof sub.standard_snapshot === "string"
      ? JSON.parse(sub.standard_snapshot)
      : sub.standard_snapshot || {};
  const sections = snapshot.sections || [];

  for (const [skill, score] of Object.entries(section_scores)) {
    const sec = sections.find((s) => s.skill === skill);
    if (!sec) {
      return NextResponse.json(
        { success: false, error: `Kỹ năng ${skill} không có trong chuẩn chấm.` },
        { status: 400 }
      );
    }

    if (
      typeof score !== "number" ||
      isNaN(score) ||
      score < sec.min ||
      score > sec.max
    ) {
      return NextResponse.json(
        {
          success: false,
          error: `Điểm phần ${skill} phải là số trong khoảng [${sec.min}, ${sec.max}].`,
        },
        { status: 400 }
      );
    }
  }

  const oldSectionScores =
    typeof sub.section_scores === "string"
      ? JSON.parse(sub.section_scores)
      : sub.section_scores || {};
  const updatedSectionScores = { ...oldSectionScores };

  for (const [skill, score] of Object.entries(section_scores)) {
    const oldEntry = updatedSectionScores[skill] || { earned: 0, max: 0 };
    updatedSectionScores[skill] = {
      ...oldEntry,
      score,
      override: true,
    };
  }

  const scoreMap: Record<string, number | null> = {};
  for (const [skill, entry] of Object.entries(updatedSectionScores)) {
    scoreMap[skill] = (entry as any).score;
  }
  const { total, passed } = aggregateTotal(snapshot, scoreMap);

  const teacherFeedback =
    feedback !== undefined ? feedback : sub.teacher_feedback || null;

  const updateRes = await queryPg(
    `UPDATE submissions
     SET status = 'GRADED',
         graded_at = NOW(),
         section_scores = $1,
         total_score = $2,
         passed = $3,
         teacher_feedback = $4
     WHERE id = $5
     RETURNING *;`,
    [
      JSON.stringify(updatedSectionScores),
      total,
      passed,
      teacherFeedback,
      submissionId,
    ]
  );

  await notifyExamGraded(submissionId);

  return NextResponse.json({
    success: true,
    attempt: formatAttemptResponse(updateRes.rows[0]),
  });
}
