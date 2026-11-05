import { NextResponse } from "next/server";
import { hasValidInternalToken } from "@/lib/api-auth";
import { queryPg } from "@/lib/db-pg";
import { withAiUsageContext } from "@/lib/ai-usage";
import { gradeOpenAnswer } from "@/lib/lesson-ai-grading";
import { computeScorePercent, type GradeResult } from "@/lib/grading";
import { notifyLessonNeedsReview } from "@/lib/notifications";

async function callGradeWithRetry(input: {
  category: string;
  prompt: string;
  answer: string;
  sample_answer?: string | null;
}): Promise<number> {
  let lastError: any = null;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      return await gradeOpenAnswer(input);
    } catch (err) {
      lastError = err;
      if (attempt === 3) {
        console.error(`AI grading failed after 3 attempts for ${input.category}:`, lastError);
      }
    }
  }
  throw lastError instanceof Error ? lastError : new Error(String(lastError ?? "AI grading failed"));
}

export async function POST(req: Request) {
  if (!hasValidInternalToken(req)) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ success: false, error: "Invalid JSON" }, { status: 400 });
  }

  const { attemptId } = body || {};
  if (!attemptId || typeof attemptId !== "string") {
    return NextResponse.json({ success: false, error: "Thiếu attemptId." }, { status: 400 });
  }

  const attemptRes = await queryPg("SELECT * FROM lesson_attempts WHERE id = $1", [attemptId]);
  if (attemptRes.rows.length === 0) {
    return NextResponse.json({ success: false, error: "Không tìm thấy attempt." }, { status: 404 });
  }

  const attempt = attemptRes.rows[0];
  if (attempt.status !== "GRADING") {
    return NextResponse.json({ success: true, skipped: true });
  }

  // Worker đã giao quá số lần cho phép mà vẫn lỗi → chuyển giáo viên chấm tay (chỉ một lần)
  if (body?.giveUp === true && hasValidInternalToken(req)) {
    const moved = await queryPg(
      `UPDATE lesson_attempts
       SET status = 'NEEDS_REVIEW', ai_earned = NULL, score_percent = NULL,
           last_grading_error = COALESCE(last_grading_error, $2)
       WHERE id = $1 AND status = 'GRADING'
       RETURNING id`,
      [attempt.id, "Worker chấm AI thất bại sau nhiều lần thử"]
    );
    if (moved.rows.length > 0) await notifyLessonNeedsReview(attempt.id);
    return NextResponse.json({ success: true, attemptId: attempt.id, status: "NEEDS_REVIEW", gaveUp: true });
  }

  let teacherId: string | null = null;
  if (attempt.class_id) {
    const classRes = await queryPg("SELECT teacher_id FROM classes WHERE id = $1 LIMIT 1", [
      attempt.class_id,
    ]);
    teacherId = classRes.rows[0]?.teacher_id || null;
  }

  return await withAiUsageContext(
    {
      purpose: "LESSON_GRADING",
      lessonAttemptId: attempt.id,
      studentId: attempt.student_id,
      teacherId,
    },
    async () => {
      const answers =
        typeof attempt.answers === "string" ? JSON.parse(attempt.answers) : attempt.answers || {};
      const results: GradeResult[] =
        typeof attempt.results === "string" ? JSON.parse(attempt.results) : attempt.results || [];

      const lessonRes = await queryPg("SELECT question_ids FROM lessons WHERE id = $1", [
        attempt.lesson_id,
      ]);
      if (lessonRes.rows.length === 0) {
        return NextResponse.json({ success: false, error: "Không tìm thấy bài học." }, { status: 404 });
      }

      const questionIds: string[] = Array.isArray(lessonRes.rows[0].question_ids)
        ? lessonRes.rows[0].question_ids
        : typeof lessonRes.rows[0].question_ids === "string"
        ? JSON.parse(lessonRes.rows[0].question_ids)
        : [];

      const qMap = new Map<string, any>();
      if (questionIds.length > 0) {
        const qRes = await queryPg("SELECT * FROM questions WHERE id = ANY($1)", [questionIds]);
        for (const row of qRes.rows) {
          qMap.set(row.id, {
            ...row,
            content: typeof row.content === "string" ? JSON.parse(row.content) : row.content,
          });
        }
      }

      let totalAiEarned = 0;
      let gradingError: string | null = null;

      // Ghi điểm AI một mục; giữ bản gốc ai_score nếu đã có (DEC-039)
      const setItemBand = (item: any, band: number) => {
        const clampedBand = Math.max(0, Math.min(9, band));
        item.correct = clampedBand >= 5;
        item.band = clampedBand;
        if (item.ai_score === undefined || item.ai_score === null) item.ai_score = clampedBand;
        return Math.max(0, Math.min(1, clampedBand / 9));
      };
      // Mục lỗi: bỏ trống band/ai_score, không cho 0 điểm (DEC-041)
      const clearItemBand = (item: any) => {
        delete item.band;
        delete item.ai_score;
        delete item.correct;
      };

      for (const r of results) {
        if (r.kind === "AI") {
          const q = qMap.get(r.question_id);
          let questionEarned = 0;

          if (r.category === "WRITING_ESSAY") {
            const item = r.items[0];
            const essayAnswer =
              typeof answers?.[r.question_id] === "string"
                ? answers[r.question_id]
                : answers?.[r.question_id]
                ? String(answers[r.question_id])
                : "";

            try {
              const band = await callGradeWithRetry({
                category: r.category,
                prompt: q?.prompt || "",
                answer: essayAnswer,
                sample_answer: q?.content?.sample_answer || null,
              });
              if (item) questionEarned += setItemBand(item, band);
              else questionEarned += Math.max(0, Math.min(1, Math.max(0, Math.min(9, band)) / 9));
            } catch (err: any) {
              gradingError = err?.message || String(err);
              if (item) clearItemBand(item);
            }
          } else if (r.category === "WRITING_SHORT_ANSWER") {
            const subQuestions: any[] = Array.isArray(q?.content?.sub_questions)
              ? q.content.sub_questions
              : [];
            const subMap = new Map(subQuestions.map((s: any) => [String(s.id), s]));

            for (const item of r.items) {
              const subId = String(item.key);
              const sub = subMap.get(subId);
              const subAnswer =
                typeof answers?.[r.question_id]?.[subId] === "string"
                  ? answers[r.question_id][subId]
                  : answers?.[r.question_id]?.[subId]
                  ? String(answers[r.question_id][subId])
                  : "";

              try {
                const band = await callGradeWithRetry({
                  category: r.category,
                  prompt: q?.prompt || "",
                  answer: subAnswer,
                  sample_answer: sub?.sample_answer || null,
                });
                questionEarned += setItemBand(item, band);
              } catch (err: any) {
                gradingError = err?.message || String(err);
                clearItemBand(item);
              }
            }
          }

          r.earned = questionEarned;
          totalAiEarned += questionEarned;
        }
      }

      if (gradingError) {
        await queryPg(
          `UPDATE lesson_attempts
           SET results = $1,
               ai_earned = NULL,
               score_percent = NULL,
               status = 'NEEDS_REVIEW',
               last_grading_error = $2
           WHERE id = $3`,
          [JSON.stringify(results), gradingError, attempt.id]
        );
        await notifyLessonNeedsReview(attempt.id);
        return NextResponse.json({ success: true, status: "NEEDS_REVIEW" });
      }

      const objEarned = Number(attempt.objective_earned);
      const objMax = Number(attempt.objective_max);
      const aiMax = Number(attempt.ai_max);
      const score_percent = computeScorePercent(objEarned, objMax, totalAiEarned, aiMax);

      await queryPg(
        `UPDATE lesson_attempts
         SET results = $1,
             ai_earned = $2,
             score_percent = $3,
             status = 'GRADED',
             graded_at = NOW()
         WHERE id = $4`,
        [JSON.stringify(results), totalAiEarned, score_percent, attempt.id]
      );

      return NextResponse.json({ success: true });
    }
  );
}
