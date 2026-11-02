import { NextResponse } from "next/server";
import { requireRole } from "@/lib/api-auth";
import { queryPg } from "@/lib/db-pg";
import { checkLessonAccess } from "@/lib/lesson-access";
import {
  sanitizeQuestionForStudent,
  sanitizeFlashcardForStudent,
  type GradableQuestion,
  type FlashcardRow,
} from "@/lib/grading";

export async function GET(
  req: Request,
  props: { params: Promise<{ lessonId: string }> }
) {
  const auth = await requireRole(["STUDENT"]);
  if (auth.error) return auth.error;
  const user = auth.user;

  const { lessonId } = await props.params;
  const { searchParams } = new URL(req.url);
  const classId = searchParams.get("classId") || "";

  const access = await checkLessonAccess(classId, lessonId, user.userId);
  if (!access.ok) {
    return NextResponse.json(
      { success: false, error: access.error },
      { status: access.status }
    );
  }

  const questionIds: string[] = access.lesson.question_ids;
  let questions: any[] = [];
  let flashcards: any[] = [];

  if (questionIds.length > 0) {
    const qRes = await queryPg("SELECT * FROM questions WHERE id = ANY($1)", [questionIds]);
    const qMap = new Map<string, any>(
      qRes.rows.map((r: any) => [
        r.id,
        {
          ...r,
          content: typeof r.content === "string" ? JSON.parse(r.content) : r.content,
        },
      ])
    );

    const orderedRawQuestions: any[] = [];
    for (const qid of questionIds) {
      const q = qMap.get(qid);
      if (q) orderedRawQuestions.push(q);
    }

    const flashcardIdSet = new Set<string>();
    for (const q of orderedRawQuestions) {
      if (typeof q.category === "string" && q.category.includes("FLASHCARD")) {
        const ids = q.content?.flashcard_ids || q.content?.flashcardIds;
        if (Array.isArray(ids)) {
          for (const fid of ids) {
            if (typeof fid === "string" && fid.trim()) {
              flashcardIdSet.add(fid.trim());
            }
          }
        }
      }
    }

    if (flashcardIdSet.size > 0) {
      const fcRes = await queryPg("SELECT * FROM flashcards WHERE id = ANY($1)", [[...flashcardIdSet]]);
      flashcards = fcRes.rows.map((r: any) => {
        const row: FlashcardRow = {
          ...r,
          options: typeof r.options === "string" ? JSON.parse(r.options) : r.options || [],
        };
        return sanitizeFlashcardForStudent(row);
      });
    }

    questions = orderedRawQuestions.map((q) =>
      sanitizeQuestionForStudent(q as GradableQuestion)
    );
  }

  return NextResponse.json({
    success: true,
    lesson: {
      id: access.lesson.id,
      title: access.lesson.title,
      description: access.lesson.description,
    },
    questions,
    flashcards,
  });
}
