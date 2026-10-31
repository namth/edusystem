import { NextResponse } from "next/server";
import { requireRole } from "@/lib/api-auth";
import { queryPg } from "@/lib/db-pg";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireRole();
  if (auth.error) return auth.error;

  const { id } = await params;

  try {
    const result = await queryPg(
      `SELECT * FROM exams WHERE id = $1 LIMIT 1;`,
      [id]
    );

    if (result.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: "Không tìm thấy đề thi." },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      exam: result.rows[0],
    });
  } catch (err: any) {
    console.error(`GET /api/exams/${id} error:`, err);
    return NextResponse.json(
      { success: false, error: err.message || "Lỗi tải thông tin đề thi." },
      { status: 500 }
    );
  }
}
