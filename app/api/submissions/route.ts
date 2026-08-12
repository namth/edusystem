import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { evaluateWritingSubmission, evaluateSpeakingWithAudio } from "@/lib/ai-engine";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      student_id = "student_01",
      exam_id = "test_01",
      answers = {},
      writing_essay = "",
      writing_prompt = "",
      time_spent_seconds = 0,
      auto_graded_score = 0,
    } = body;

    const submissionId = `sub_${Date.now()}`;
    let finalAiScore = auto_graded_score;
    let aiFeedbackText = "";

    // Check for speaking audio in answers
    let speakingAudio = body.speaking_audio || "";
    let speakingPrompt = body.speaking_prompt || "Describe an educational technology tool that has helped you improve your skills.";
    
    if (!speakingAudio) {
      for (const [key, val] of Object.entries(answers)) {
        if (typeof val === "string" && (val.startsWith("data:audio") || val.startsWith("http://") || val.startsWith("https://"))) {
          speakingAudio = val;
          break;
        }
      }
    }

    let speakingEvaluation = null;
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

    let writingEvaluation = null;
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
    if (writingEvaluation?.overallScore) scoresToAverage.push(writingEvaluation.overallScore);
    if (speakingEvaluation?.overallScore) scoresToAverage.push(speakingEvaluation.overallScore);

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

    // Insert submission record into Supabase PostgreSQL DB
    const { data, error } = await supabase
      .from("submissions")
      .insert([
        {
          id: submissionId,
          exam_id,
          student_id,
          answers,
          ai_score: finalAiScore,
          ai_feedback: aiFeedbackText,
          final_score: finalAiScore,
          final_feedback: aiFeedbackText,
          status: "AI_GRADED",
        },
      ])
      .select();

    if (error) {
      console.warn("Supabase insert error (falling back to return constructed object):", error.message);
      return NextResponse.json({
        success: true,
        data: {
          id: submissionId,
          exam_id,
          student_id,
          answers,
          ai_score: finalAiScore,
          ai_feedback: aiFeedbackText,
          final_score: finalAiScore,
          status: "AI_GRADED",
          created_at: new Date().toISOString(),
        },
        fallback: true,
      });
    }

    return NextResponse.json({
      success: true,
      data: data?.[0] || {
        id: submissionId,
        exam_id,
        student_id,
        answers,
        ai_score: finalAiScore,
        ai_feedback: aiFeedbackText,
        final_score: finalAiScore,
        status: "AI_GRADED",
      },
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
  try {
    const { searchParams } = new URL(request.url);
    const studentId = searchParams.get("student_id");
    const examId = searchParams.get("exam_id");

    let query = supabase.from("submissions").select("*").order("created_at", { ascending: false });

    if (studentId) query = query.eq("student_id", studentId);
    if (examId) query = query.eq("exam_id", examId);

    const { data, error } = await query;

    if (error) {
      console.warn("Supabase GET submissions error:", error.message);
      return NextResponse.json({ success: true, data: [] });
    }

    return NextResponse.json({ success: true, data: data || [] });
  } catch (error: any) {
    console.error("Error fetching submissions:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to fetch submissions" },
      { status: 500 }
    );
  }
}
