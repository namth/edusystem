import { NextResponse } from "next/server";
import { requireRole } from "@/lib/api-auth";
import { queryPg } from "@/lib/db-pg";
import { loadParentQuestions } from "@/lib/sections-db";
import type { TreeSection } from "@/lib/exam-structure";
import { serverError } from "@/lib/api-errors";

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
    let sections: TreeSection[] = [];

    if (submission.exam_id) {
      const examRes = await queryPg(
        `SELECT * FROM exams WHERE id = $1 LIMIT 1;`,
        [submission.exam_id]
      );
      if (examRes.rows.length > 0) {
        exam = examRes.rows[0];

        // FEAT-017 (BR-P10): xem lại bài thấy cả câu đã xoá mềm nếu câu đó có trong bài nộp
        const rawResults = typeof submission.results === "string" ? JSON.parse(submission.results || "[]") : submission.results;
        const answeredIds: string[] = Array.isArray(rawResults) ? rawResults.map((r: { question_id?: unknown }) => String(r?.question_id ?? "")).filter(Boolean) : [];
        const loaded = await loadParentQuestions("exam", String(submission.exam_id), { includeDeletedIds: answeredIds });
        questions = loaded.questions;
        sections = loaded.sections;
      }
    }

    return NextResponse.json({
      success: true,
      submission,
      exam,
      sections,
      questions,
    });
  } catch (err: any) {
    return serverError(err, { route: "/api/submissions/[id]", method: "GET", message: err.message || "Lỗi tải thông tin bài nộp." });
  }
}
