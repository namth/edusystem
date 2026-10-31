import { NextResponse } from "next/server";
import { hasValidInternalToken, requireRole } from "@/lib/api-auth";
import { queryPg } from "@/lib/db-pg";
import {
  type ScoringStandard,
  aggregateTotal,
} from "@/lib/exam-scoring";
import { gradeExamOpenAnswer } from "@/lib/exam-ai-grading";
import { tallyAndScoreSections } from "@/lib/exam-attempts";

export async function POST(req: Request) {
  if (!hasValidInternalToken(req)) {
    const auth = await requireRole(["ADMIN", "TEACHER"]);
    if (auth.error) return auth.error;
  }

  const body = await req.json().catch(() => ({}));
  const submissionId = body?.submissionId;
  if (!submissionId) {
    return NextResponse.json(
      { success: false, error: "Missing submissionId" },
      { status: 400 }
    );
  }

  const subRes = await queryPg(
    "SELECT * FROM submissions WHERE id = $1 LIMIT 1",
    [submissionId]
  );
  if (subRes.rows.length === 0) {
    return NextResponse.json(
      { success: false, error: "Submission not found" },
      { status: 404 }
    );
  }

  const sub = subRes.rows[0];
  if (sub.status !== "GRADING") {
    return NextResponse.json(
      { success: true, skipped: true },
      { status: 200 }
    );
  }

  const snapshot: ScoringStandard =
    typeof sub.standard_snapshot === "string"
      ? JSON.parse(sub.standard_snapshot)
      : sub.standard_snapshot || {};
  const results: any[] =
    typeof sub.results === "string"
      ? JSON.parse(sub.results)
      : sub.results || [];
  const answers: Record<string, any> =
    typeof sub.answers === "string"
      ? JSON.parse(sub.answers)
      : sub.answers || {};

  const aiResults = results.filter((r) => r.kind === "AI");
  let totalGradingAttempts = Number(sub.grading_attempts || 0);
  let finalGradingError: string | null = null;

  if (aiResults.length > 0) {
    const aiQIds = Array.from(new Set(aiResults.map((r) => r.question_id)));
    const placeholders = aiQIds.map((_, i) => `$${i + 1}`).join(", ");
    const qRes = await queryPg(
      `SELECT id, skill, category, prompt, stimulus_text FROM questions WHERE id IN (${placeholders});`,
      aiQIds
    );
    const qMap = new Map<string, any>(qRes.rows.map((q: any) => [q.id, q]));

    for (const r of aiResults) {
      const q = qMap.get(r.question_id);
      const skillName = q?.skill || r.skill;
      const section = (snapshot.sections || []).find((s) => s.skill === skillName) || {
        min: 0,
        max: 9,
        step: 0.5,
      };

      const prompt = q?.prompt || q?.stimulus_text || q?.category || "";
      const studentAns = answers[r.question_id] || "";
      const rubricId = (section as any).rubric_id;

      let attempts = 0;
      let lastErr: any = null;
      let score = section.min;

      while (attempts < 3) {
        attempts++;
        try {
          score = await gradeExamOpenAnswer({
            category: q?.category || r.category,
            prompt,
            answer: studentAns,
            section: {
              min: Number(section.min),
              max: Number(section.max),
              step: Number(section.step),
            },
            rubric_id: rubricId,
            exam_id: sub.exam_id,
          });
          lastErr = null;
          break;
        } catch (err: any) {
          lastErr = err;
        }
      }

      totalGradingAttempts += attempts;

      if (lastErr) {
        console.error("AI grading failed after 3 attempts:", lastErr);
        score = section.min;
        finalGradingError = lastErr.message || String(lastErr);
      }

      r.score = score;
    }
  }

  // Recalculate section_scores & aggregateTotal
  const sectionScores = tallyAndScoreSections(snapshot, results, sub.section_scores);
  const scoreMap: Record<string, number | null> = {};
  for (const [skill, entry] of Object.entries(sectionScores)) {
    scoreMap[skill] = entry.score;
  }
  const { total, passed } = aggregateTotal(snapshot, scoreMap);

  await queryPg(
    `UPDATE submissions
     SET status = 'GRADED',
         graded_at = NOW(),
         results = $1,
         section_scores = $2,
         total_score = $3,
         passed = $4,
         grading_attempts = $5,
         last_grading_error = $6
     WHERE id = $7`,
    [
      JSON.stringify(results),
      JSON.stringify(sectionScores),
      total,
      passed,
      totalGradingAttempts,
      finalGradingError,
      submissionId,
    ]
  );

  return NextResponse.json({
    success: true,
    submissionId,
    status: "GRADED",
    total_score: total,
    passed,
  });
}
