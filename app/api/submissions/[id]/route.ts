import { NextResponse } from "next/server";
import { requireRole } from "@/lib/api-auth";
import { queryPg } from "@/lib/db-pg";

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await requireRole();
  if (auth.error) return auth.error;

  const { id } = await context.params;

  try {
    const subRes = await queryPg(
      `SELECT * FROM submissions WHERE id = $1 LIMIT 1;`,
      [id]
    );

    if (subRes.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: "Không tìm thấy bài nộp." },
        { status: 404 }
      );
    }

    const submission = subRes.rows[0];

    if (auth.user.role === "STUDENT" && submission.student_id !== auth.user.userId) {
      return NextResponse.json(
        { success: false, error: "Bạn không có quyền xem bài nộp này." },
        { status: 403 }
      );
    }

    if (auth.user.role === "STUDENT" && submission.status === "IN_PROGRESS") {
      return NextResponse.json(
        { success: false, error: "Bài thi đang trong quá trình làm, chưa thể xem kết quả." },
        { status: 409 }
      );
    }

    let exam: any = null;
    let questions: any[] = [];

    if (submission.exam_id) {
      const examRes = await queryPg(
        `SELECT * FROM exams WHERE id = $1 LIMIT 1;`,
        [submission.exam_id]
      );
      if (examRes.rows.length > 0) {
        exam = examRes.rows[0];

        let questionIds: string[] = [];
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

        if (questionIds.length > 0) {
          const placeholders = questionIds.map((_, i) => `$${i + 1}`).join(", ");
          const qRes = await queryPg(
            `SELECT * FROM questions WHERE id IN (${placeholders});`,
            questionIds
          );
          const qMap = new Map(qRes.rows.map((q: any) => [q.id, q]));
          questions = questionIds.map((qId) => qMap.get(qId)).filter(Boolean);
        }
      }
    }

    return NextResponse.json({
      success: true,
      submission,
      exam,
      questions,
    });
  } catch (err: any) {
    console.error(`GET /api/submissions/${id} error:`, err);
    return NextResponse.json(
      { success: false, error: err.message || "Lỗi tải thông tin bài nộp." },
      { status: 500 }
    );
  }
}
