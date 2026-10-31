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

    let questions: any[] = [];
    let flashcards: any[] = [];

    if (questionIds.length > 0) {
      const placeholders = questionIds.map((_, i) => `$${i + 1}`).join(", ");
      const qRes = await queryPg(
        `SELECT * FROM questions WHERE id IN (${placeholders});`,
        questionIds
      );

      const qMap = new Map(qRes.rows.map((q: any) => [q.id, q]));
      questions = questionIds.map((qId) => qMap.get(qId)).filter(Boolean);

      const flashcardIdsSet = new Set<string>();
      for (const q of questions) {
        if (q.category && typeof q.category === "string" && q.category.includes("FLASHCARD")) {
          let contentObj = q.content;
          if (typeof contentObj === "string") {
            try {
              contentObj = JSON.parse(contentObj);
            } catch {
              contentObj = null;
            }
          }
          const ids: string[] =
            (q as any).flashcard_ids ||
            contentObj?.flashcard_ids ||
            contentObj?.flashcardIds ||
            [];
          if (Array.isArray(ids)) {
            for (const fcId of ids) {
              if (fcId && typeof fcId === "string") {
                flashcardIdsSet.add(fcId);
              }
            }
          }
        }
      }

      if (flashcardIdsSet.size > 0) {
        const fcIdList = Array.from(flashcardIdsSet);
        const fcPlaceholders = fcIdList.map((_, i) => `$${i + 1}`).join(", ");
        const fcRes = await queryPg(
          `SELECT * FROM flashcards WHERE id IN (${fcPlaceholders});`,
          fcIdList
        );
        flashcards = fcRes.rows;
      }
    }

    return NextResponse.json({
      success: true,
      exam,
      questions,
      flashcards,
    });
  } catch (err: any) {
    console.error(`GET /api/exams/${id}/content error:`, err);
    return NextResponse.json(
      { success: false, error: err.message || "Lỗi tải nội dung đề thi." },
      { status: 500 }
    );
  }
}
