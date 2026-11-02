import { NextResponse } from "next/server";
import { requireRole } from "@/lib/api-auth";
import { queryPg } from "@/lib/db-pg";

// DEC-018 / TC-E09: đường nộp cũ (trình duyệt tự chấm, gọi AI đồng bộ) đã ngừng hoàn toàn
export async function POST(request: Request) {
  const auth = await requireRole();
  if (auth.error) return auth.error;
  return NextResponse.json(
    { success: false, error: "Đường nộp bài cũ đã ngừng — dùng /api/student/exam-attempts/{id}/submit" },
    { status: 410 }
  );
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
