import { NextResponse } from "next/server";
import { hasValidInternalToken } from "@/lib/api-auth";
import { queryPg } from "@/lib/db-pg";
import { withAiUsageContext } from "@/lib/ai-usage";
import { gradeOpenAnswer } from "@/lib/lesson-ai-grading";
import { computeScorePercent, type GradeResult } from "@/lib/grading";

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
  return 0;
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

            const band = await callGradeWithRetry({
              category: r.category,
              prompt: q?.prompt || "",
              answer: essayAnswer,
              sample_answer: q?.content?.sample_answer || null,
            });

            const clampedBand = Math.max(0, Math.min(9, band));
            const itemEarned = Math.max(0, Math.min(1, clampedBand / 9));
            if (item) {
              item.correct = clampedBand >= 5;
              (item as any).band = clampedBand;
            }
            questionEarned += itemEarned;
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

              const band = await callGradeWithRetry({
                category: r.category,
                prompt: q?.prompt || "",
                answer: subAnswer,
                sample_answer: sub?.sample_answer || null,
              });

              const clampedBand = Math.max(0, Math.min(9, band));
              const itemEarned = Math.max(0, Math.min(1, clampedBand / 9));
              item.correct = clampedBand >= 5;
              (item as any).band = clampedBand;
              questionEarned += itemEarned;
            }
          }

          r.earned = questionEarned;
          totalAiEarned += questionEarned;
        }
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
