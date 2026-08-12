import { NextResponse } from "next/server";
import { getServerSupabaseClient } from "@/lib/supabase-server";

export async function GET() {
  try {
    const supabase = getServerSupabaseClient();
    const { data, error } = await supabase
      .from("exam_categories")
      .select("*")
      .order("display_order", { ascending: true });

    if (error) {
      // Fallback categories if table is not yet seeded
      return NextResponse.json({
        success: true,
        categories: [
          { id: "cat_placement", name: "Bài Thi Đầu Vào (Placement Test)", code: "PLACEMENT_TEST" },
          { id: "cat_lesson_quiz", name: "Bài Kiểm Tra Theo Bài Học (Lesson Quiz)", code: "LESSON_QUIZ" },
          { id: "cat_unit_test", name: "Bài Kiểm Tra Theo Chương (Unit Test)", code: "UNIT_TEST" },
          { id: "cat_mid_term", name: "Bài Thi Giữa Kỳ (Mid-Term Exam)", code: "MID_TERM" },
          { id: "cat_final_exam", name: "Bài Thi Cuối Khóa (Final Exam)", code: "FINAL_EXAM" },
          { id: "cat_full_mock", name: "Đề Thi Thử Chuẩn (Full Mock Exam)", code: "MOCK_EXAM" },
        ],
      });
    }

    return NextResponse.json({ success: true, categories: data || [] });
  } catch (err: any) {
    console.error("Fetch exam categories error:", err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
