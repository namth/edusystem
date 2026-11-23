import { NextResponse } from "next/server";
import { requireRole } from "@/lib/api-auth";
import { queryPg } from "@/lib/db-pg";
import { loadParentQuestions, flashcardIdsOf } from "@/lib/sections-db";
import { serverError } from "@/lib/api-errors";

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await requireRole();
  if (auth.error) return auth.error;

  const { id } = await context.params;

  try {
    const examRes = await queryPg(
      `SELECT * FROM exams WHERE id = $1 LIMIT 1;`,
      [id]
    );

    if (examRes.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: "Không tìm thấy đề thi." },
        { status: 404 }
      );
    }

    const exam = examRes.rows[0];

    const canView =
      auth.user.role === "ADMIN" ||
      (auth.user.role === "TEACHER" &&
        (exam.created_by === auth.user.userId || exam.created_by == null));

    if (!canView) {
      return NextResponse.json(
        { success: false, error: "Bạn không có quyền xem nội dung đề thi này." },
        { status: 403 }
      );
    }

    // FEAT-017: câu theo phần (giáo viên / admin, còn đáp án)
    const { sections, questions } = await loadParentQuestions("exam", String(exam.id));
    let flashcards: unknown[] = [];
    const fcIdList = flashcardIdsOf(questions);
    if (fcIdList.length > 0) {
      const fcRes = await queryPg("SELECT * FROM flashcards WHERE id = ANY($1)", [fcIdList]);
      flashcards = fcRes.rows;
    }

    return NextResponse.json({
      success: true,
      exam,
      sections,
      questions,
      flashcards,
    });
  } catch (err: any) {
    return serverError(err, { route: "/api/exams/[id]/content", method: "GET", message: err.message || "Lỗi tải nội dung đề thi." });
  }
}
