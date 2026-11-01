import { NextResponse } from "next/server";
import { requireRole } from "@/lib/api-auth";
import { queryPg } from "@/lib/db-pg";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireRole();
  if (auth.error) return auth.error;

  const { id } = await params;

  try {
    const result = await queryPg(
      `SELECT * FROM exams WHERE id = $1 LIMIT 1;`,
      [id]
    );

    if (result.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: "Không tìm thấy đề thi." },
        { status: 404 }
      );
    }

    const exam = result.rows[0];

    if (auth.user.role === "STUDENT") {
      let questionIds: unknown[] = [];
      if (Array.isArray(exam.question_ids)) {
        questionIds = exam.question_ids;
      } else if (typeof exam.question_ids === "string") {
        try {
          const parsed = JSON.parse(exam.question_ids);
          if (Array.isArray(parsed)) {
            questionIds = parsed;
          }
        } catch {
          questionIds = [];
        }
      }

      return NextResponse.json({
        success: true,
        exam: {
          id: exam.id,
          title: exam.title,
          description: exam.description ?? null,
          duration_minutes: exam.duration_minutes,
          skills: exam.skills,
          passing_score: exam.passing_score ?? null,
          question_count: questionIds.length,
        },
      });
    }

    const canView =
      auth.user.role === "ADMIN" ||
      (auth.user.role === "TEACHER" &&
        (exam.created_by === auth.user.userId || exam.created_by == null));

    if (!canView) {
      return NextResponse.json(
        { success: false, error: "Bạn không có quyền xem đề thi này." },
        { status: 403 }
      );
    }

    return NextResponse.json({
      success: true,
      exam,
    });
  } catch (err: any) {
    console.error(`GET /api/exams/${id} error:`, err);
    return NextResponse.json(
      { success: false, error: err.message || "Lỗi tải thông tin đề thi." },
      { status: 500 }
    );
  }
}
