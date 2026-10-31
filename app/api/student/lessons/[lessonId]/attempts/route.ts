import crypto from "crypto";
import { NextResponse } from "next/server";
import { requireRole } from "@/lib/api-auth";
import { queryPg } from "@/lib/db-pg";
import { checkLessonAccess } from "@/lib/lesson-access";
import {
  gradeQuestion,
  summarizeResults,
  computeScorePercent,
  type GradeResult,
  type FlashcardRow,
  type GradableQuestion,
} from "@/lib/grading";
import { pushRedisStreamEvent } from "@/lib/redis-queue";

export async function POST(
  req: Request,
  props: { params: Promise<{ lessonId: string }> }
) {
  const auth = await requireRole(["STUDENT"]);
  if (auth.error) return auth.error;
  const user = auth.user;

  const { lessonId } = await props.params;

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { success: false, error: "Dữ liệu JSON không hợp lệ." },
      { status: 400 }
    );
  }

  const classId = body?.classId;
  const answers = body?.answers;

  if (!classId || typeof classId !== "string" || !classId.trim()) {
    return NextResponse.json(
      { success: false, error: "Thiếu mã lớp học (classId)." },
      { status: 400 }
    );
  }

  if (typeof answers !== "object" || answers === null || Array.isArray(answers)) {
    return NextResponse.json(
      { success: false, error: "answers phải là đối tượng." },
      { status: 400 }
    );
  }

  const access = await checkLessonAccess(classId, lessonId, user.userId);
  if (!access.ok) {
    return NextResponse.json(
      { success: false, error: access.error },
      { status: access.status }
    );
  }

  const questionIds: string[] = access.lesson.question_ids;
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
  const { objective_earned, objective_max, ai_max, has_ai } = summary;

  let status: "GRADED" | "GRADING" | "AI_SKIPPED" = "GRADED";
  let ai_earned: number | null = 0;
  let score_percent: number | null = null;
  let graded_at: Date | null = new Date();
  let shouldPushEvent = false;

  if (!has_ai) {
    status = "GRADED";
    ai_earned = 0;
    score_percent = computeScorePercent(objective_earned, objective_max, 0, 0);
    graded_at = new Date();
  } else {
    const teacherId = access.klass.teacher_id;
    const slotRes = await queryPg(
      "UPDATE users SET slot_limit = slot_limit - 1 WHERE id = $1 AND slot_limit > 0 RETURNING slot_limit",
      [teacherId]
    );

    if (slotRes.rows.length > 0) {
      status = "GRADING";
      ai_earned = null;
      score_percent = null;
      graded_at = null;
      shouldPushEvent = true;
    } else {
      status = "AI_SKIPPED";
      ai_earned = 0;
      score_percent = computeScorePercent(objective_earned, objective_max, 0, ai_max);
      graded_at = new Date();
    }
  }

  const attemptId = "att_" + crypto.randomUUID();
  const insertRes = await queryPg(
    `INSERT INTO lesson_attempts (
      id, lesson_id, class_id, student_id, answers, results,
      objective_earned, objective_max, ai_earned, ai_max, score_percent, status,
      created_at, graded_at
    ) VALUES (
      $1, $2, $3, $4, $5, $6,
      $7, $8, $9, $10, $11, $12,
      NOW(), $13
    ) RETURNING *`,
    [
      attemptId,
      lessonId,
      classId,
      user.userId,
      JSON.stringify(answers),
      JSON.stringify(results),
      objective_earned,
      objective_max,
      ai_earned,
      ai_max,
      score_percent,
      status,
      graded_at,
    ]
  );

  if (shouldPushEvent) {
    try {
      await pushRedisStreamEvent("stream:learning:grading", "LESSON_GRADING_REQUESTED", {
        attemptId,
      });
    } catch (err) {
      console.error("Failed to push LESSON_GRADING_REQUESTED event:", err);
    }
  }

  const row = insertRes.rows[0];
  const attempt = {
    ...row,
    answers: typeof row.answers === "string" ? JSON.parse(row.answers) : row.answers,
    results: typeof row.results === "string" ? JSON.parse(row.results) : row.results,
    objective_earned: Number(row.objective_earned),
    objective_max: Number(row.objective_max),
    ai_max: Number(row.ai_max),
    ai_earned: row.ai_earned != null ? Number(row.ai_earned) : null,
    score_percent: row.score_percent != null ? Number(row.score_percent) : null,
  };

  return NextResponse.json({ success: true, attempt }, { status: 201 });
}

export async function GET(
  req: Request,
  props: { params: Promise<{ lessonId: string }> }
) {
  const auth = await requireRole(["STUDENT"]);
  if (auth.error) return auth.error;
  const user = auth.user;

  const { lessonId } = await props.params;
  const { searchParams } = new URL(req.url);
  const classId = searchParams.get("classId");

  if (!classId || typeof classId !== "string" || !classId.trim()) {
    return NextResponse.json(
      { success: false, error: "Thiếu mã lớp học (classId)." },
      { status: 400 }
    );
  }

  const enrollRes = await queryPg(
    "SELECT 1 FROM enrollments WHERE class_id = $1 AND student_id = $2",
    [classId, user.userId]
  );
  if (enrollRes.rows.length === 0) {
    return NextResponse.json(
      { success: false, error: "Học sinh chưa ghi danh vào lớp học này." },
      { status: 403 }
    );
  }

  const attemptsRes = await queryPg(
    `SELECT * FROM lesson_attempts
     WHERE class_id = $1 AND student_id = $2 AND lesson_id = $3
     ORDER BY created_at DESC`,
    [classId, user.userId, lessonId]
  );

  const attempts = attemptsRes.rows.map((row: any) => ({
    ...row,
    answers: typeof row.answers === "string" ? JSON.parse(row.answers) : row.answers,
    results: typeof row.results === "string" ? JSON.parse(row.results) : row.results,
    objective_earned: Number(row.objective_earned),
    objective_max: Number(row.objective_max),
    ai_max: Number(row.ai_max),
    ai_earned: row.ai_earned != null ? Number(row.ai_earned) : null,
    score_percent: row.score_percent != null ? Number(row.score_percent) : null,
  }));

  return NextResponse.json({ success: true, attempts });
}
