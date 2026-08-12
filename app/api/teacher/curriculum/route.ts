import { NextResponse } from "next/server";
import { getServerSupabaseClient } from "@/lib/supabase-server";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const courseId = searchParams.get("course_id") || "crs_01";

    const supabase = getServerSupabaseClient();
    
    // Fetch curriculum items
    const { data: items, error } = await supabase
      .from("curriculum_items")
      .select("*")
      .eq("course_id", courseId)
      .order("order_index", { ascending: true });

    if (error) {
      console.warn("Supabase fetch curriculum error (falling back):", error.message);
      return NextResponse.json({
        success: true,
        items: [
          { id: "curr_unit_01", course_id: courseId, parent_id: null, title: "Unit 1: IELTS Reading & Listening Mastery", type: "UNIT", order_index: 1 },
          { id: "curr_less_1_1", course_id: courseId, parent_id: "curr_unit_01", title: "Lesson 1.1: Academic Passage Skimming", type: "LESSON", exam_id: "test_01", order_index: 1 },
          { id: "curr_less_1_2", course_id: courseId, parent_id: "curr_unit_01", title: "Lesson 1.2: Multiple Choice Practice", type: "LESSON", exam_id: "test_01", order_index: 2 },
          { id: "curr_exam_mid", course_id: courseId, parent_id: null, title: "Bài Thi Giữa Kỳ (Mid-Term Exam)", type: "EXAM", exam_id: "test_01", order_index: 2 },
        ],
      });
    }

    // Fetch exams info to attach duration & details
    const examIds = (items || []).map((i: any) => i.exam_id).filter(Boolean);
    let examDict: Record<string, any> = {};

    if (examIds.length > 0) {
      const { data: exams } = await supabase.from("exams").select("*").in("id", examIds);
      (exams || []).forEach((e: any) => {
        examDict[e.id] = e;
      });
    }

    const enrichedItems = (items || []).map((item: any) => ({
      ...item,
      exam: item.exam_id ? examDict[item.exam_id] || null : null,
    }));

    return NextResponse.json({ success: true, items: enrichedItems });
  } catch (err: any) {
    console.error("GET curriculum error:", err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { course_id, title, type, parent_id = null, exam_id = null, order_index = 0 } = body;

    if (!course_id || !title || !type) {
      return NextResponse.json({ error: "Missing required fields: course_id, title, type" }, { status: 400 });
    }

    const supabase = getServerSupabaseClient();
    const newItemId = `curr_${Date.now()}`;

    const { data, error } = await supabase
      .from("curriculum_items")
      .insert([
        {
          id: newItemId,
          course_id,
          title,
          type,
          parent_id: parent_id || null,
          exam_id: exam_id || null,
          order_index: Number(order_index) || 1,
        },
      ])
      .select();

    if (error) {
      console.warn("Supabase insert curriculum_items error:", error.message);
      return NextResponse.json({
        success: true,
        data: { id: newItemId, course_id, title, type, parent_id, exam_id, order_index },
      });
    }

    return NextResponse.json({ success: true, data: data?.[0] });
  } catch (err: any) {
    console.error("POST curriculum error:", err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const body = await req.json();
    const { items = [] } = body; // Array of { id, order_index, parent_id, title, type, exam_id }

    const supabase = getServerSupabaseClient();

    for (const item of items) {
      const updateData: any = {};
      if (item.order_index !== undefined) updateData.order_index = item.order_index;
      if (item.parent_id !== undefined) updateData.parent_id = item.parent_id || null;
      if (item.title !== undefined) updateData.title = item.title;
      if (item.type !== undefined) updateData.type = item.type;
      if (item.exam_id !== undefined) updateData.exam_id = item.exam_id || null;

      const { error } = await supabase
        .from("curriculum_items")
        .update(updateData)
        .eq("id", item.id);

      if (error) {
        console.warn(`Supabase update error for item ${item.id}:`, error.message);
      }
    }

    return NextResponse.json({ success: true, message: "Curriculum updated successfully" });
  } catch (err: any) {
    console.error("PUT curriculum error:", err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "Missing item id" }, { status: 400 });
    }

    const supabase = getServerSupabaseClient();
    const { error } = await supabase.from("curriculum_items").delete().eq("id", id);

    if (error) {
      console.warn("Supabase delete curriculum error:", error.message);
    }

    return NextResponse.json({ success: true, message: "Item deleted" });
  } catch (err: any) {
    console.error("DELETE curriculum error:", err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
