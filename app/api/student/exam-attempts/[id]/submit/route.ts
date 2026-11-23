import { NextResponse } from "next/server";
import { requireRole } from "@/lib/api-auth";
import { queryPg } from "@/lib/db-pg";
import { loadParentQuestions, flashcardIdsOf } from "@/lib/sections-db";
import {
  type ScoringStandard,
  aggregateTotal,
} from "@/lib/exam-scoring";
import {
  gradeQuestion,
  type FlashcardRow,
} from "@/lib/grading";
import { pushGradingEvent } from "@/lib/redis-queue";
import { notifyNeedsReview } from "@/lib/notifications";
import {
  tallyAndScoreSections,
  formatAttemptResponse,
  type ExamQuestionResult,
} from "@/lib/exam-attempts";

export async function POST(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await requireRole(["STUDENT"]);
  if (auth.error) return auth.error;

  const { id } = await context.params;
  const studentId = auth.user.userId;

  const body = await req.json().catch(() => ({}));
  const answers = body?.answers && typeof body.answers === "object" ? body.answers : {};

  const subRes = await queryPg(
    "SELECT * FROM submissions WHERE id = $1 LIMIT 1",
    [id]
  );
  if (subRes.rows.length === 0) {
    return NextResponse.json(
      { success: false, error: "Lượt thi không tồn tại." },
      { status: 404 }
    );
  }

  const sub = subRes.rows[0];
  if (sub.student_id !== studentId) {
    return NextResponse.json(
      { success: false, error: "Bạn không có quyền nộp lượt thi này." },
      { status: 403 }
    );
  }

  if (sub.status !== "IN_PROGRESS") {
    return NextResponse.json(
      { success: false, error: "Lượt thi không ở trạng thái đang làm." },
      { status: 409 }
    );
  }

  const deadlineTime = sub.deadline_at ? new Date(sub.deadline_at).getTime() : Date.now();
  const is_late = Date.now() > deadlineTime + 2 * 60 * 1000;

  const examRes = await queryPg(
    "SELECT id, created_by FROM exams WHERE id = $1 LIMIT 1",
    [sub.exam_id]
  );
  if (examRes.rows.length === 0) {
    return NextResponse.json(
      { success: false, error: "Đề thi không tồn tại." },
      { status: 404 }
    );
  }
  // FEAT-017: chấm các câu đang có trong đề (câu xoá mềm không chấm, BR-P10)
  const { questions } = await loadParentQuestions("exam", String(sub.exam_id));
  const flashcardsMap: Record<string, FlashcardRow> = {};
  const fcIdList = flashcardIdsOf(questions);
  if (fcIdList.length > 0) {
    const fcRes = await queryPg("SELECT * FROM flashcards WHERE id = ANY($1)", [fcIdList]);
    for (const fc of fcRes.rows) flashcardsMap[fc.id] = fc as FlashcardRow;
  }

  // Chấm từng câu
  const results: ExamQuestionResult[] = questions.map((q) => {
    const res = gradeQuestion(q, answers[q.id], flashcardsMap, { speaking: "AI" });
    return {
      ...res,
      skill: q.skill,
    };
  });

  const snapshot: ScoringStandard =
    typeof sub.standard_snapshot === "string"
      ? JSON.parse(sub.standard_snapshot)
      : sub.standard_snapshot;

  const sectionScores = tallyAndScoreSections(snapshot, results);
  const hasAi = results.some((r) => r.kind === "AI");

  if (!hasAi) {
    const scoreMap: Record<string, number | null> = {};
    for (const [skill, entry] of Object.entries(sectionScores)) {
      scoreMap[skill] = entry.score;
    }
    const { total, passed } = aggregateTotal(snapshot, scoreMap);

    const updateRes = await queryPg(
      `UPDATE submissions
       SET status = 'GRADED',
           submitted_at = NOW(),
           graded_at = NOW(),
           answers = $1,
           results = $2,
           section_scores = $3,
           total_score = $4,
           passed = $5,
           is_late = $6
       WHERE id = $7
       RETURNING *;`,
      [
        JSON.stringify(answers),
        JSON.stringify(results),
        JSON.stringify(sectionScores),
        total,
        passed,
        is_late,
        id,
      ]
    );

    return NextResponse.json(
      {
        success: true,
        attempt: formatAttemptResponse(updateRes.rows[0]),
      },
      { status: 200 }
    );
  }

  let updateRes = await queryPg(
    `UPDATE submissions
     SET status = 'GRADING',
         submitted_at = NOW(),
         answers = $1,
         results = $2,
         section_scores = $3,
         total_score = NULL,
         passed = NULL,
         is_late = $4
     WHERE id = $5
     RETURNING *;`,
    [
      JSON.stringify(answers),
      JSON.stringify(results),
      JSON.stringify(sectionScores),
      is_late,
      id,
    ]
  );

  try {
    await pushGradingEvent(id, sub.exam_id, studentId);
  } catch (err) {
    console.error("pushGradingEvent error:", err);
    updateRes = await queryPg(
      `UPDATE submissions SET status = 'NEEDS_REVIEW' WHERE id = $1 RETURNING *;`,
      [id]
    );
    await notifyNeedsReview(id);
  }

  return NextResponse.json(
    {
      success: true,
      attempt: formatAttemptResponse(updateRes.rows[0]),
    },
    { status: 200 }
  );
}
