import { NextResponse } from "next/server";
import { queryPg } from "@/lib/db-pg";
import { requireRole } from "@/lib/api-auth";
import { formatOrder } from "@/lib/slot-orders";
import { serverError } from "@/lib/api-errors";

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
    return serverError(err, { route: "/api/admin/requests", method: "GET", message: err.message || "Lỗi hệ thống khi tải danh sách yêu cầu mua slot." });
  }
}
