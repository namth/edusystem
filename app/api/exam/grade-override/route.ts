import { NextResponse } from "next/server";
import { getServerSupabaseClient } from "@/lib/supabase-server";

export async function PUT(req: Request) {
  const supabase = getServerSupabaseClient();

  try {
    const body = await req.json();
    const { submissionId, questionId, overriddenScore, teacherNote, teacherId } = body;

    if (!submissionId || !questionId || !overriddenScore) {
      return NextResponse.json(
        { error: "Missing required fields: submissionId, questionId, overriddenScore" },
        { status: 400 }
      );
    }

    // Load existing submission
    const { data: sub, error: subError } = await supabase
      .from("submissions")
      .select("*")
      .eq("id", submissionId)
      .maybeSingle();

    if (subError || !sub) {
      return NextResponse.json({ error: "Submission not found" }, { status: 404 });
    }

    const existingReview = sub.teacher_review || {
      overridden_scores: {},
      teacher_note: "",
      reviewed_by: teacherId || "teacher_01",
      reviewed_at: new Date().toISOString(),
    };

    existingReview.overridden_scores = {
      ...existingReview.overridden_scores,
      [questionId]: overriddenScore,
    };
    if (teacherNote !== undefined) existingReview.teacher_note = teacherNote;
    existingReview.reviewed_by = teacherId || existingReview.reviewed_by || "teacher_01";
    existingReview.reviewed_at = new Date().toISOString();

    // Prepare updated final_evaluation_details with teacher overrides merged
    const aiDetails = sub.ai_evaluation_details || {};
    const finalDetails = sub.final_evaluation_details || { ...aiDetails };

    if (!finalDetails.aiTasks) finalDetails.aiTasks = {};
    if (!finalDetails.aiTasks[questionId]) {
      finalDetails.aiTasks[questionId] = { questionId, evaluation: overriddenScore };
    } else {
      finalDetails.aiTasks[questionId].evaluation = {
        ...finalDetails.aiTasks[questionId].evaluation,
        ...overriddenScore,
        _source: "teacher",
      };
    }

    // Save to database
    const { error: updateError } = await supabase
      .from("submissions")
      .update({
        status: "TEACHER_REVIEWED",
        teacher_review: existingReview,
        final_evaluation_details: finalDetails,
      })
      .eq("id", submissionId);

    if (updateError) {
      console.error("Failed to update teacher review:", updateError);
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      submissionId,
      status: "TEACHER_REVIEWED",
      teacherReview: existingReview,
    });
  } catch (err: any) {
    console.error("Grade override route error:", err);
    return NextResponse.json({ error: err?.message || "Internal server error" }, { status: 500 });
  }
}
