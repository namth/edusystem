import { NextResponse } from "next/server";
import { queryPg } from "@/lib/db-pg";
import { requireRole } from "@/lib/api-auth";

export async function GET(req: Request) {
  const auth = await requireRole(["ADMIN"]);
  if (auth.error) return auth.error;

  try {
    const res = await queryPg(`
      SELECT 
        id, 
        teacher_id, 
        teacher_name, 
        teacher_email, 
        requested_slots, 
        total_cost, 
        status, 
        created_at
      FROM slot_requests
      ORDER BY 
        CASE WHEN status = 'PENDING' THEN 0 ELSE 1 END, 
        created_at DESC;
    `);

    const slot_requests = res.rows.map((row: any) => ({
      id: row.id,
      teacher_id: row.teacher_id,
      teacher_name: row.teacher_name,
      teacher_email: row.teacher_email,
      requested_slots: Number(row.requested_slots),
      total_cost: Number(row.total_cost),
      status: row.status,
      created_at: row.created_at,
    }));

    return NextResponse.json({ slot_requests });
  } catch (err: any) {
    console.error("API /api/admin/requests GET Error:", err);
    return NextResponse.json(
      { success: false, error: err.message || "Lỗi hệ thống khi tải danh sách yêu cầu mua slot." },
      { status: 500 }
    );
  }
}
