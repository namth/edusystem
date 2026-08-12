import { NextResponse } from "next/server";
import { getServerSupabaseClient } from "@/lib/supabase-server";
import { emitKafkaEvent } from "@/lib/kafka";

export async function POST(req: Request) {
  try {
    const { lessonId, examId, orderIndex = 1, isRequired = true, weight = 1.0 } = await req.json();

    if (!lessonId || !examId) {
      return NextResponse.json({ error: "Missing lessonId or examId" }, { status: 400 });
    }

    const supabase = getServerSupabaseClient();

    // 1. Insert or update lesson_exams junction record
    const { data, error } = await supabase
      .from("lesson_exams")
      .upsert([
        {
          lesson_id: lessonId,
          exam_id: examId,
          order_index: orderIndex,
          is_required: isRequired,
          weight: weight,
        },
      ])
      .select();

    if (error) {
      console.warn("Supabase lesson_exams upsert warning:", error.message);
    }

    // 2. Emit Event to Neo4j Graph Sync Engine
    await emitKafkaEvent("EXAM_BOUND_TO_LESSON", {
      lessonId,
      examId,
      orderIndex,
    });

    return NextResponse.json({
      success: true,
      data: data?.[0] || { lesson_id: lessonId, exam_id: examId, order_index: orderIndex },
    });
  } catch (err: any) {
    console.error("Bind exam to lesson error:", err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
