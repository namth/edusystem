import { NextResponse } from "next/server";
import { requireRole } from "@/lib/api-auth";
import { queryPg } from "@/lib/db-pg";
import {
  sanitizeQuestionForStudent,
  sanitizeFlashcardForStudent,
  type GradableQuestion,
  type FlashcardRow,
} from "@/lib/grading";

export async function GET(
  req: Request,
  context: { params: Promise<{ examId: string }> }
) {
  const auth = await requireRole(["STUDENT"]);
  if (auth.error) return auth.error;

  const { examId } = await context.params;
  const studentId = auth.user.userId;

  // Chỉ khi học sinh có lượt IN_PROGRESS cho đề
  const subRes = await queryPg(
    "SELECT id, standard_snapshot FROM submissions WHERE student_id = $1 AND exam_id = $2 AND status = 'IN_PROGRESS' ORDER BY created_at DESC LIMIT 1",
    [studentId, examId]
  );
  if (subRes.rows.length === 0) {
    return NextResponse.json(
      { success: false, error: "Bạn chưa có lượt làm bài nào đang diễn ra cho đề thi này." },
      { status: 403 }
    );
  }

  const sub = subRes.rows[0];
  const snapshot =
    typeof sub.standard_snapshot === "string"
      ? JSON.parse(sub.standard_snapshot)
      : sub.standard_snapshot || {};

  const examRes = await queryPg(
    "SELECT id, title, duration_minutes, skills, question_ids FROM exams WHERE id = $1 LIMIT 1",
    [examId]
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
      if (Array.isArray(parsed)) questionIds = parsed;
    } catch {
      questionIds = [];
    }
  }

  let questions: GradableQuestion[] = [];
  let flashcards: any[] = [];

  if (questionIds.length > 0) {
    const placeholders = questionIds.map((_, i) => `$${i + 1}`).join(", ");
    const qRes = await queryPg(
      `SELECT * FROM questions WHERE id IN (${placeholders});`,
      questionIds
    );

    const qMap = new Map<string, any>(qRes.rows.map((q: any) => [q.id, q]));
    const rawQuestions = questionIds.map((qId) => qMap.get(qId)).filter(Boolean);

    // Sanitize questions
    questions = rawQuestions.map((q) => sanitizeQuestionForStudent(q));

    // Flashcards
    const flashcardIdsSet = new Set<string>();
    for (const q of rawQuestions) {
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
      flashcards = fcRes.rows.map((fc: any) => sanitizeFlashcardForStudent(fc));
    }
  }

  return NextResponse.json({
    success: true,
    exam: {
      id: exam.id,
      title: exam.title,
      duration_minutes: exam.duration_minutes != null ? Number(exam.duration_minutes) : 60,
      skills: Array.isArray(exam.skills) ? exam.skills : [],
    },
    standard: {
      id: snapshot.id,
      name: snapshot.name,
      sections: Array.isArray(snapshot.sections)
        ? snapshot.sections.map((s: any) => ({
            skill: s.skill,
            min: s.min,
            max: s.max,
          }))
        : [],
    },
    questions,
    flashcards,
  });
}
