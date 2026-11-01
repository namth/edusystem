import { NextResponse } from "next/server";
import { requireRole } from "@/lib/api-auth";
import { queryPg } from "@/lib/db-pg";
import {
  type ScoringStandard,
  aggregateTotal,
} from "@/lib/exam-scoring";
import {
  gradeQuestion,
  type GradableQuestion,
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
    "SELECT id, question_ids, created_by FROM exams WHERE id = $1 LIMIT 1",
    [sub.exam_id]
  );
  if (examRes.rows.length === 0) {
    return NextResponse.json(
      { success: false, error: "Đề thi không tồn tại." },
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
  const flashcardsMap: Record<string, FlashcardRow> = {};

  if (questionIds.length > 0) {
    const placeholders = questionIds.map((_, i) => `$${i + 1}`).join(", ");
    const qRes = await queryPg(
      `SELECT * FROM questions WHERE id IN (${placeholders});`,
      questionIds
    );
    const qMap = new Map<string, any>(qRes.rows.map((q: any) => [q.id, q]));
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
            if (fcId && typeof fcId === "string") flashcardIdsSet.add(fcId);
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
      for (const fc of fcRes.rows) {
        flashcardsMap[fc.id] = fc;
      }
    }
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

  // Có mục AI: xác định giáo viên để trừ slot
  let teacherId: string | null = null;
  if (sub.class_ref) {
    const classRes = await queryPg(
      "SELECT teacher_id FROM classes WHERE id = $1 LIMIT 1",
      [sub.class_ref]
    );
    teacherId = classRes.rows[0]?.teacher_id || null;
  }
  teacherId = teacherId || exam.created_by || null;

  let hasSlot = false;
  if (teacherId) {
    const slotRes = await queryPg(
      "UPDATE users SET slot_limit = slot_limit - 1 WHERE id = $1 AND slot_limit > 0 RETURNING slot_limit",
      [teacherId]
    );
    if (slotRes.rows.length > 0) {
      hasSlot = true;
    }
  }

  const nextStatus = hasSlot ? "GRADING" : "NEEDS_REVIEW";

  let updateRes = await queryPg(
    `UPDATE submissions
     SET status = $1,
         submitted_at = NOW(),
         answers = $2,
         results = $3,
         section_scores = $4,
         total_score = NULL,
         passed = NULL,
         is_late = $5
     WHERE id = $6
     RETURNING *;`,
    [
      nextStatus,
      JSON.stringify(answers),
      JSON.stringify(results),
      JSON.stringify(sectionScores),
      is_late,
      id,
    ]
  );

  if (hasSlot) {
    try {
      await pushGradingEvent(id, sub.exam_id, studentId);
    } catch (err) {
      console.error("pushGradingEvent error:", err);
      updateRes = await queryPg(
        `UPDATE submissions SET status = 'NEEDS_REVIEW' WHERE id = $1 RETURNING *;`,
        [id]
      );
      if (teacherId) {
        await queryPg(
          "UPDATE users SET slot_limit = slot_limit + 1 WHERE id = $1",
          [teacherId]
        );
      }
      await notifyNeedsReview(id);
    }
  } else {
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
