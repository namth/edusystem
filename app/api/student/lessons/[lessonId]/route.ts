import { NextResponse } from "next/server";
import { requireRole } from "@/lib/api-auth";
import { queryPg } from "@/lib/db-pg";
import { loadParentQuestions, sectionsForStudent, flashcardIdsOf } from "@/lib/sections-db";
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

  // FEAT-017: bài học → phần → câu (BR-P10, BR-L09)
  const { sections: tree, questions: rawQuestions } = await loadParentQuestions("lesson", lessonId);
  const questions = rawQuestions.map((q) => sanitizeQuestionForStudent(q as GradableQuestion));
  const sections = sectionsForStudent(tree);
  let flashcards: ReturnType<typeof sanitizeFlashcardForStudent>[] = [];
  const fcIds = flashcardIdsOf(rawQuestions);
  if (fcIds.length > 0) {
    const fcRes = await queryPg("SELECT * FROM flashcards WHERE id = ANY($1)", [fcIds]);
    flashcards = fcRes.rows.map((r) => {
      const row = {
        ...r,
        options: typeof r.options === "string" ? JSON.parse(r.options) : r.options || [],
      } as FlashcardRow;
      return sanitizeFlashcardForStudent(row);
    });
  }

  return NextResponse.json({
    success: true,
    lesson: {
      id: access.lesson.id,
      title: access.lesson.title,
      description: access.lesson.description,
    },
    sections,
    questions,
    flashcards,
  });
}
