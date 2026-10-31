import { NextResponse } from "next/server";
import crypto from "crypto";
import { evaluateWritingSubmission, evaluateSpeakingWithAudio } from "@/lib/ai-engine";
import { requireRole } from "@/lib/api-auth";
import { queryPg } from "@/lib/db-pg";

export async function POST(request: Request) {
  const auth = await requireRole();
  if (auth.error) return auth.error;

  try {
    const body = await request.json().catch(() => ({}));
    const exam_id = typeof body.exam_id === "string" ? body.exam_id.trim() : "";
    if (!exam_id) {
      return NextResponse.json(
        { success: false, error: "Thiếu exam_id." },
        { status: 400 }
      );
    }

    let student_id = "";
    if (auth.user.role === "STUDENT") {
      student_id = auth.user.userId;
    } else {
      student_id = typeof body.student_id === "string" ? body.student_id.trim() : "";
      if (!student_id) {
        return NextResponse.json(
          { success: false, error: "Thiếu student_id." },
          { status: 400 }
        );
      }
    }

    const {
      answers = {},
      writing_essay = "",
      writing_prompt = "",
      time_spent_seconds = 0,
      auto_graded_score = 0,
    } = body;

    const submissionId = "sub_" + crypto.randomUUID();
    let finalAiScore = auto_graded_score;
    let aiFeedbackText = "";

    // Check for speaking audio in answers
    let speakingAudio = body.speaking_audio || "";
    let speakingPrompt =
      body.speaking_prompt ||
      "Describe an educational technology tool that has helped you improve your skills.";

    if (!speakingAudio && answers && typeof answers === "object") {
      for (const [key, val] of Object.entries(answers)) {
        if (
          typeof val === "string" &&
          (val.startsWith("data:audio") ||
            val.startsWith("http://") ||
            val.startsWith("https://"))
        ) {
          speakingAudio = val;
          break;
        }
      }
    }

    let speakingEvaluation: any = null;
    if (speakingAudio) {
      try {
        speakingEvaluation = await evaluateSpeakingWithAudio(
          speakingAudio,
          speakingPrompt
        );
      } catch (err) {
        console.error("AI Speaking Evaluation error:", err);
      }
    }

    let writingEvaluation: any = null;
    // If student provided a writing essay, evaluate it with AI Engine
    if (writing_essay && writing_essay.trim().length > 10) {
      try {
        const promptToEvaluate =
          writing_prompt ||
          "Some people believe that studying online is more effective than traditional classroom learning. To what extent do you agree or disagree?";

        writingEvaluation = await evaluateWritingSubmission(
          writing_essay,
          promptToEvaluate
        );
      } catch (err) {
        console.error("AI Writing Evaluation error:", err);
      }
    }

    // Calculate combined score
    const scoresToAverage: number[] = [];
    if (auto_graded_score > 0) scoresToAverage.push(auto_graded_score);

    const writingScore =
      writingEvaluation?.overallScore ?? writingEvaluation?.overallBand;
    if (typeof writingScore === "number" && !isNaN(writingScore)) {
      scoresToAverage.push(writingScore);
    }

    const speakingScore =
      speakingEvaluation?.overallScore ?? speakingEvaluation?.overallBand;
    if (typeof speakingScore === "number" && !isNaN(speakingScore)) {
      scoresToAverage.push(speakingScore);
    }

    if (scoresToAverage.length > 0) {
      const sum = scoresToAverage.reduce((a, b) => a + b, 0);
      finalAiScore = Math.round((sum / scoresToAverage.length) * 2) / 2;
    }

    aiFeedbackText = JSON.stringify({
      writing: writingEvaluation,
      speaking: speakingEvaluation,
      autoGradedScore: auto_graded_score,
      timeSpentSec: time_spent_seconds,
    });

    const result = await queryPg(
      `INSERT INTO submissions (id, exam_id, student_id, answers, ai_score, ai_feedback, final_score, final_feedback, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'AI_GRADED')
       RETURNING *;`,
      [
        submissionId,
        exam_id,
        student_id,
        JSON.stringify(answers || {}),
        finalAiScore,
        aiFeedbackText,
        finalAiScore,
        aiFeedbackText,
      ]
    );

    return NextResponse.json({
      success: true,
      data: result.rows[0],
    });
  } catch (error: any) {
    console.error("Error creating submission:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to record submission" },
      { status: 500 }
    );
  }
}

export async function GET(request: Request) {
  const auth = await requireRole();
  if (auth.error) return auth.error;

  try {
    const { searchParams } = new URL(request.url);
    const queryStudentId = searchParams.get("student_id");
    const examId = searchParams.get("exam_id");

    const conditions: string[] = [];
    const params: any[] = [];

    if (auth.user.role === "STUDENT") {
      params.push(auth.user.userId);
      conditions.push(`student_id = $${params.length}`);
    } else if (queryStudentId && queryStudentId.trim() !== "") {
      params.push(queryStudentId.trim());
      conditions.push(`student_id = $${params.length}`);
    }

    if (examId && examId.trim() !== "") {
      params.push(examId.trim());
      conditions.push(`exam_id = $${params.length}`);
    }

    let sql = `SELECT * FROM submissions`;
    if (conditions.length > 0) {
      sql += ` WHERE ` + conditions.join(" AND ");
    }
    sql += ` ORDER BY created_at DESC;`;

    const result = await queryPg(sql, params);
    return NextResponse.json({ success: true, data: result.rows });
  } catch (error: any) {
    console.error("Error fetching submissions:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to fetch submissions" },
      { status: 500 }
    );
  }
}
