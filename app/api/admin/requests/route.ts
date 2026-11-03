import { NextResponse } from "next/server";
import { queryPg } from "@/lib/db-pg";
import { requireRole } from "@/lib/api-auth";
import { formatOrder } from "@/lib/slot-orders";

export async function GET(req: Request) {
  const auth = await requireRole(["ADMIN"]);
  if (auth.error) return auth.error;

  try {
    const res = await queryPg(`
      SELECT *
      FROM slot_requests
      ORDER BY 
        CASE WHEN status = 'PENDING' THEN 0 ELSE 1 END, 
        created_at DESC;
    `);

    const slot_requests = res.rows.map(formatOrder);

    return NextResponse.json({ slot_requests });
  } catch (err: any) {
    console.error("API /api/admin/requests GET Error:", err);
    return NextResponse.json(
      { success: false, error: err.message || "Lỗi hệ thống khi tải danh sách yêu cầu mua slot." },
      { status: 500 }
    );
  }
}
