import { NextResponse } from "next/server";
import { requireRole } from "@/lib/api-auth";
import { queryPg } from "@/lib/db-pg";
import { loadParentQuestions } from "@/lib/sections-db";
import { totalNumbered } from "@/lib/exam-structure";
import { serverError } from "@/lib/api-errors";

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
      // FEAT-017: số câu = tổng số ý theo phần (BR-P06)
      const { sections } = await loadParentQuestions("exam", String(exam.id));
      const questionCount = totalNumbered(sections);

      return NextResponse.json({
        success: true,
        exam: {
          id: exam.id,
          title: exam.title,
          description: exam.description ?? null,
          duration_minutes: exam.duration_minutes,
          skills: exam.skills,
          passing_score: exam.passing_score ?? null,
          question_count: questionCount,
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
    return serverError(err, { route: "/api/exams/[id]", method: "GET", message: err.message || "Lỗi tải thông tin đề thi." });
  }
}
