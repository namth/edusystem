import { NextResponse } from "next/server";
import { requireRole } from "@/lib/api-auth";
import { queryPg } from "@/lib/db-pg";
import {
  gradeQuestion,
  summarizeResults,
  computeScorePercent,
  sanitizeQuestionForStudent,
  sanitizeFlashcardForStudent,
  type GradableQuestion,
  type FlashcardRow,
  type GradeResult,
} from "@/lib/grading";

export async function GET(
  req: Request,
  props: { params: Promise<{ id: string }> }
) {
  const auth = await requireRole(["ADMIN", "TEACHER"]);
  if (auth.error) return auth.error;
  const authUser = auth.user;

  const { id } = await props.params;

  const lRes = await queryPg("SELECT * FROM lessons WHERE id = $1", [id]);
  if (lRes.rows.length === 0) {
    return NextResponse.json(
      { success: false, error: "Bài học không tồn tại." },
      { status: 404 }
    );
  }

  const lessonRow = lRes.rows[0];
  if (authUser.role === "TEACHER" && lessonRow.created_by !== authUser.userId) {
    return NextResponse.json(
      { success: false, error: "Bạn không có quyền truy cập bài học này." },
      { status: 403 }
    );
  }

  const questionIds: string[] = Array.isArray(lessonRow.question_ids)
    ? lessonRow.question_ids
    : typeof lessonRow.question_ids === "string"
    ? JSON.parse(lessonRow.question_ids)
    : [];

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
      const fcRes = await queryPg("SELECT * FROM flashcards WHERE id = ANY($1)", [
        [...flashcardIdSet],
      ]);
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

  return NextResponse.json(
    {
      success: true,
      lesson: {
        id: lessonRow.id,
        title: lessonRow.title,
        description: lessonRow.description,
      },
      questions,
      flashcards,
    },
    { status: 200 }
  );
}

export async function POST(
  req: Request,
  props: { params: Promise<{ id: string }> }
) {
  const auth = await requireRole(["ADMIN", "TEACHER"]);
  if (auth.error) return auth.error;
  const authUser = auth.user;

  const { id } = await props.params;

  const lRes = await queryPg("SELECT * FROM lessons WHERE id = $1", [id]);
  if (lRes.rows.length === 0) {
    return NextResponse.json(
      { success: false, error: "Bài học không tồn tại." },
      { status: 404 }
    );
  }

  const lessonRow = lRes.rows[0];
  if (authUser.role === "TEACHER" && lessonRow.created_by !== authUser.userId) {
    return NextResponse.json(
      { success: false, error: "Bạn không có quyền truy cập bài học này." },
      { status: 403 }
    );
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { success: false, error: "Dữ liệu JSON không hợp lệ." },
      { status: 400 }
    );
  }

  const answers = body?.answers;
  if (typeof answers !== "object" || answers === null || Array.isArray(answers)) {
    return NextResponse.json(
      { success: false, error: "answers phải là đối tượng." },
      { status: 400 }
    );
  }

  const questionIds: string[] = Array.isArray(lessonRow.question_ids)
    ? lessonRow.question_ids
    : typeof lessonRow.question_ids === "string"
    ? JSON.parse(lessonRow.question_ids)
    : [];

  let orderedQuestions: GradableQuestion[] = [];
  const flashcardsMap: Record<string, FlashcardRow> = {};

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

    for (const qid of questionIds) {
      const q = qMap.get(qid);
      if (q) orderedQuestions.push(q);
    }

    const flashcardIdSet = new Set<string>();
    for (const q of orderedQuestions) {
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
      const fcRes = await queryPg("SELECT * FROM flashcards WHERE id = ANY($1)", [
        [...flashcardIdSet],
      ]);
      for (const r of fcRes.rows) {
        flashcardsMap[r.id] = {
          ...r,
          options: typeof r.options === "string" ? JSON.parse(r.options) : r.options || [],
        };
      }
    }
  }

  const results: GradeResult[] = orderedQuestions.map((q) =>
    gradeQuestion(q, answers[q.id], flashcardsMap)
  );
  const summary = summarizeResults(results);
  const { objective_earned, objective_max, ai_max } = summary;
  const score_percent = computeScorePercent(objective_earned, objective_max, 0, 0);

  return NextResponse.json(
    {
      success: true,
      results,
      objective_earned,
      objective_max,
      ai_max,
      score_percent,
    },
    { status: 200 }
  );
}
