import { NextResponse } from "next/server";
import { requireRole } from "@/lib/api-auth";
import { queryPg } from "@/lib/db-pg";

export async function GET(_request?: Request) {
  const auth = await requireRole();
  if (auth.error) return auth.error;

  try {
    const result = await queryPg(
      `SELECT id, title, duration_minutes, skills, created_at FROM exams ORDER BY created_at DESC;`
    );

    return NextResponse.json({ success: true, exams: result.rows });
  } catch (err: any) {
    console.error("GET /api/exams error:", err);
    return NextResponse.json(
      { success: false, error: err.message || "Lỗi tải danh sách đề thi." },
      { status: 500 }
    );
  }
}
