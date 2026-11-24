import { NextResponse } from "next/server";
import { requireRole } from "@/lib/api-auth";
import { queryPg } from "@/lib/db-pg";
import { loadParentQuestions, sectionsForStudent, flashcardIdsOf } from "@/lib/sections-db";
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
    "SELECT id, title, duration_minutes, skills FROM exams WHERE id = $1 LIMIT 1",
    [examId]
  );
  if (examRes.rows.length === 0) {
    return NextResponse.json(
      { success: false, error: "Không tìm thấy đề thi." },
      { status: 404 }
    );
  }
  const exam = examRes.rows[0];

  // FEAT-017: đề → phần → câu; học sinh không nhận phần / câu xoá mềm (BR-P10) và không nhận đáp án (BR-E08)
  const { sections: tree, questions: rawQuestions } = await loadParentQuestions("exam", examId);
  const questions: GradableQuestion[] = rawQuestions.map((q) => sanitizeQuestionForStudent(q));
  const sections = sectionsForStudent(tree);

  let flashcards: ReturnType<typeof sanitizeFlashcardForStudent>[] = [];
  const fcIdList = flashcardIdsOf(rawQuestions);
  if (fcIdList.length > 0) {
    const fcRes = await queryPg("SELECT * FROM flashcards WHERE id = ANY($1)", [fcIdList]);
    flashcards = fcRes.rows.map((fc) => sanitizeFlashcardForStudent(fc as FlashcardRow));
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
    sections,
    questions,
    flashcards,
  });
}
