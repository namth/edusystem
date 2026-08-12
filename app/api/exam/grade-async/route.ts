import { NextResponse } from "next/server";
import { getServerSupabaseClient } from "@/lib/supabase-server";
import { evaluateSpeakingWithAudio, evaluateWritingWithRubric } from "@/lib/ai-engine";
import { resolveRubricForExam } from "@/lib/rubric-resolver";
import { parseFillInGaps } from "@/lib/question-content-types";

export async function POST(req: Request) {
  const supabase = getServerSupabaseClient();
  let subIdForError: string | null = null;

  try {
    const { submissionId } = await req.json();
    if (!submissionId) {
      return NextResponse.json({ error: "Missing submissionId" }, { status: 400 });
    }
    subIdForError = submissionId;

    // 1. Fetch submission record
    const { data: sub, error: subError } = await supabase
      .from("submissions")
      .select("*")
      .eq("id", submissionId)
      .maybeSingle();

    if (subError || !sub) {
      return NextResponse.json({ error: "Submission not found" }, { status: 404 });
    }

    // If already graded or reviewed, return existing
    if ((sub.status === "GRADED" || sub.status === "TEACHER_REVIEWED") && sub.final_evaluation_details) {
      return NextResponse.json({ success: true, submission: sub });
    }

    const currentAttempts = (sub.grading_attempts || 0) + 1;

    // Update status to IN_PROGRESS & increment attempts
    await supabase
      .from("submissions")
      .update({
        status: "AI_GRADING_IN_PROGRESS",
        grading_attempts: currentAttempts,
      })
      .eq("id", submissionId);

    const studentAnswers = sub.answers || {};
    const examId = sub.exam_id;

    // 2. Fetch Exam & Questions
    const { data: exam } = await supabase
      .from("exams")
      .select("*")
      .eq("id", examId)
      .maybeSingle();

    let questionIds: string[] = [];
    if (exam && Array.isArray(exam.question_ids)) {
      questionIds = exam.question_ids;
    }

    let questions: any[] = [];
    if (questionIds.length > 0) {
      const { data: qData } = await supabase
        .from("questions")
        .select("*")
        .in("id", questionIds);
      if (qData) questions = qData;
    } else {
      const { data: qData } = await supabase.from("questions").select("*");
      if (qData) questions = qData;
    }

    // 3. Process Non-AI Auto-Grading & AI Tasks with Dynamic Rubric
    let correctNonAiCount = 0;
    let totalNonAiCount = 0;
    const nonAiDetails: Record<string, any> = {};
    const aiEvaluationDetails: Record<string, any> = {};

    const aiCategories = [
      "WRITING_ESSAY",
      "WRITING_SHORT_ANSWER",
      "WRITING_SENTENCE_REWRITE",
      "SPEAKING_TOPIC_PROMPT",
      "SPEAKING_READ_ALOUD",
    ];

    for (const q of questions) {
      const cat = q.category;
      const isAiTask = aiCategories.includes(cat);

      if (isAiTask) {
        const studentAns = studentAnswers[q.id] || "";
        const promptText = q.prompt || q.stimulus_text || cat;
        const rubric = await resolveRubricForExam(examId, cat);

        let evalRes;
        if (cat.startsWith("SPEAKING")) {
          // Gemini Multimodal Audio Grading
          evalRes = await evaluateSpeakingWithAudio(studentAns, promptText, rubric);
        } else {
          // Writing Rubric Evaluation
          evalRes = await evaluateWritingWithRubric(studentAns, promptText, rubric);
        }

        aiEvaluationDetails[q.id] = {
          questionId: q.id,
          category: cat,
          prompt: promptText,
          studentAnswer: studentAns,
          evaluation: evalRes,
        };
      } else {
        // Non-AI Auto Grading
        if (cat === "READING_MC" || cat === "LISTENING_MC") {
          const subQs: any[] = q.content?.sub_questions || [];
          const isSingle = subQs.length === 1;

          subQs.forEach((sub: any, idx: number) => {
            totalNonAiCount++;
            const subKey = isSingle ? q.id : `${q.id}_sub_${idx}`;
            const studentChoice = (studentAnswers[subKey] || "").trim();
            const correctTarget = (sub.correct_answer || "").trim();

            const isCorrect =
              !!studentChoice &&
              !!correctTarget &&
              studentChoice.toLowerCase() === correctTarget.toLowerCase();

            if (isCorrect) correctNonAiCount++;

            nonAiDetails[subKey] = {
              questionId: q.id,
              subIndex: idx,
              studentChoice,
              correctAnswer: correctTarget,
              isCorrect,
            };
          });
        } else if (cat === "READING_FILL_IN" || cat === "LISTENING_FILL_IN" || cat === "WRITING_FREE_TYPING_BLANKS") {
          const passageText = q.content?.passage || q.prompt || "";
          const { gaps } = parseFillInGaps(passageText);
          const gapList = gaps.length > 0 ? gaps : [""];

          gapList.forEach((gapTarget: string, idx: number) => {
            totalNonAiCount++;
            const gapKey = gaps.length > 0 ? `${q.id}_gap_${idx}` : q.id;
            const studentInput = (studentAnswers[gapKey] || "").trim();
            const targetWord = (gapTarget || "").trim();

            const isCorrect =
              !!studentInput &&
              !!targetWord &&
              studentInput.toLowerCase() === targetWord.toLowerCase();

            if (isCorrect) correctNonAiCount++;

            nonAiDetails[gapKey] = {
              questionId: q.id,
              gapIndex: idx,
              studentInput,
              correctWord: targetWord,
              isCorrect,
            };
          });
        } else if (cat === "READING_MATCHING" || cat === "LISTENING_MATCHING") {
          const pairs: any[] = q.content?.pairs || [];
          pairs.forEach((pair: any, idx: number) => {
            totalNonAiCount++;
            const pairKey = `${q.id}_pair_${idx}`;
            const studentMatch = (studentAnswers[pairKey] || "").trim();
            const correctRight = (pair.right || "").trim();

            const isCorrect =
              !!studentMatch &&
              !!correctRight &&
              studentMatch.toLowerCase() === correctRight.toLowerCase();

            if (isCorrect) correctNonAiCount++;

            nonAiDetails[pairKey] = {
              questionId: q.id,
              leftText: pair.left,
              studentMatch,
              correctRight,
              isCorrect,
            };
          });
        } else if (cat === "READING_ORDERING" || cat === "LISTENING_ORDERING") {
          totalNonAiCount++;
          const studentOrder = (studentAnswers[q.id] || "").trim();
          const targetOrder = (q.content?.correct_text || "").trim();

          const isCorrect =
            !!studentOrder &&
            !!targetOrder &&
            studentOrder.toLowerCase() === targetOrder.toLowerCase();

          if (isCorrect) correctNonAiCount++;

          nonAiDetails[q.id] = {
            questionId: q.id,
            studentOrder,
            correctOrder: targetOrder,
            isCorrect,
          };
        } else {
          totalNonAiCount++;
          const studentInput = (studentAnswers[q.id] || "").trim();
          const targetAnswer = (q.content?.correct_answer || q.content?.answer || "").trim();

          const isCorrect =
            !!studentInput &&
            !!targetAnswer &&
            studentInput.toLowerCase() === targetAnswer.toLowerCase();

          if (isCorrect) correctNonAiCount++;

          nonAiDetails[q.id] = {
            questionId: q.id,
            studentInput,
            targetAnswer,
            isCorrect,
          };
        }
      }
    }

    const rawScoreFormatted = `${correctNonAiCount}/${Math.max(totalNonAiCount, 1)}`;
    const finalScoreVal = Math.round((correctNonAiCount / Math.max(totalNonAiCount, 1)) * 10 * 10) / 10;

    const evaluationSummary = {
      rawScore: rawScoreFormatted,
      correctNonAiCount,
      totalNonAiCount,
      nonAiDetails,
      aiTasks: aiEvaluationDetails,
    };

    // 4. Update Submission Record
    const { error: updateError } = await supabase
      .from("submissions")
      .update({
        status: "GRADED",
        score: finalScoreVal,
        final_score: rawScoreFormatted,
        ai_score: finalScoreVal,
        ai_feedback: `Hoàn thành chấm bài! Điểm trắc nghiệm & điền từ: ${rawScoreFormatted} câu đúng. Phản hồi AI chi tiết bên dưới.`,
        ai_evaluation_details: evaluationSummary,
        final_evaluation_details: evaluationSummary,
      })
      .eq("id", submissionId);

    if (updateError) {
      console.error("Submission update error in grade-async:", updateError);
    }

    // 5. Send Notification
    if (sub.student_id) {
      try {
        await supabase.from("notifications").insert([
          {
            user_id: sub.student_id,
            title: `Kết quả bài thi ${exam?.title || "Mới"} đã sẵn sàng!`,
            message: `Bài thi của bạn đạt ${rawScoreFormatted} điểm trắc nghiệm. Nhấp để xem nhận xét AI & tiêu chí chi tiết.`,
            link: `/student/exam/review/${submissionId}`,
            created_at: new Date().toISOString(),
            read: false,
          },
        ]);
      } catch (notifErr) {
        console.warn("Notification insert warning:", notifErr);
      }
    }

    return NextResponse.json({
      success: true,
      submissionId,
      rawScore: rawScoreFormatted,
      status: "GRADED",
    });
  } catch (err: any) {
    console.error("Async grading route error:", err);

    if (subIdForError) {
      const supabase = getServerSupabaseClient();
      const { data: currentSub } = await supabase
        .from("submissions")
        .select("grading_attempts")
        .eq("id", subIdForError)
        .maybeSingle();

      const attempts = (currentSub?.grading_attempts || 1);
      const nextStatus = attempts >= 3 ? "GRADED_WITH_FALLBACK" : "AI_GRADING_FAILED";

      await supabase
        .from("submissions")
        .update({
          status: nextStatus,
          last_grading_error: err?.message || "Internal grading error",
        })
        .eq("id", subIdForError);
    }

    return NextResponse.json({ error: err?.message || "Internal error" }, { status: 500 });
  }
}
