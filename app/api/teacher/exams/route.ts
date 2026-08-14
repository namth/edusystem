import { NextResponse } from "next/server";
import { queryPg } from "@/lib/db-pg";
import { getAuthenticatedUserFromCookie } from "@/lib/auth";

export async function GET() {
  try {
    const authUser = await getAuthenticatedUserFromCookie();

    if (!authUser) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    let sql = `SELECT * FROM exams ORDER BY created_at DESC;`;
    let params: any[] = [];

    if (authUser.role === "TEACHER") {
      sql = `SELECT * FROM exams WHERE created_by = $1 OR created_by IS NULL ORDER BY created_at DESC;`;
      params = [authUser.userId];
    }

    const result = await queryPg(sql, params);
    const exams = result.rows.map((row: any) => ({
      id: row.id,
      title: row.title,
      description: row.description || "",
      created_by: row.created_by,
      created_at: row.created_at,
    }));

    return NextResponse.json({ success: true, exams });
  } catch (err: any) {
    console.error("API /api/teacher/exams GET Error:", err);
    return NextResponse.json({ success: false, error: err.message || "Lỗi nạp danh sách đề thi." }, { status: 500 });
  }
}
