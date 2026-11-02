import { NextResponse } from "next/server";
import { requireRole } from "@/lib/api-auth";
import { queryPg } from "@/lib/db-pg";
import { createOrder, formatOrder } from "@/lib/slot-orders";

const VALID_STATUSES = new Set(["PENDING", "APPROVED", "REJECTED", "CANCELLED"]);
const VALID_SOURCES = new Set(["TEACHER", "ADMIN"]);

export async function GET(req: Request) {
  const auth = await requireRole(["ADMIN"]);
  if (auth.error) return auth.error;

  const url = new URL(req.url);
  const statusParam = url.searchParams.get("status")?.trim();
  const sourceParam = url.searchParams.get("source")?.trim();
  const qParam = url.searchParams.get("q")?.trim();

  if (statusParam && !VALID_STATUSES.has(statusParam)) {
    return NextResponse.json(
      { success: false, error: "Trạng thái không hợp lệ." },
      { status: 400 }
    );
  }

  if (sourceParam && !VALID_SOURCES.has(sourceParam)) {
    return NextResponse.json(
      { success: false, error: "Nguồn đơn không hợp lệ." },
      { status: 400 }
    );
  }

  try {
    // 1. Tính counts cho từng trạng thái
    const countRes = await queryPg(
      `SELECT status, COUNT(*)::int AS count FROM slot_requests GROUP BY status`
    );
    const counts: Record<string, number> = {
      PENDING: 0,
      APPROVED: 0,
      REJECTED: 0,
      CANCELLED: 0,
    };
    for (const r of countRes.rows) {
      if (r.status) counts[r.status] = Number(r.count);
    }

    // 2. Truy vấn danh sách orders có lọc
    const conditions: string[] = [];
    const params: any[] = [];

    if (statusParam) {
      params.push(statusParam);
      conditions.push(`status = $${params.length}`);
    }

    if (sourceParam) {
      params.push(sourceParam);
      conditions.push(`source = $${params.length}`);
    }

    if (qParam) {
      params.push(`%${qParam}%`);
      const idx = params.length;
      conditions.push(`(code ILIKE $${idx} OR teacher_name ILIKE $${idx} OR teacher_email ILIKE $${idx})`);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    const sql = `
      SELECT *
      FROM slot_requests
      ${whereClause}
      ORDER BY
        CASE
          WHEN status = 'PENDING' AND payment_reported_at IS NOT NULL THEN 0
          WHEN status = 'PENDING' THEN 1
          ELSE 2
        END ASC,
        payment_reported_at DESC NULLS LAST,
        created_at DESC
    `;

    const ordersRes = await queryPg(sql, params);
    const orders = ordersRes.rows.map(formatOrder);

    return NextResponse.json({
      success: true,
      orders,
      counts,
    });
  } catch (err: any) {
    console.error("GET /api/admin/orders error:", err);
    return NextResponse.json(
      { success: false, error: err.message || "Lỗi hệ thống khi lấy danh sách đơn hàng." },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  const auth = await requireRole(["ADMIN"]);
  if (auth.error) return auth.error;

  const body = await req.json().catch(() => ({}));
  const { teacher_id, requested_slots, total_cost, note } = body;

  if (typeof requested_slots === "undefined") {
    return NextResponse.json(
      { success: false, error: "Thiếu số lượng slot." },
      { status: 400 }
    );
  }

  const result = await createOrder({
    teacherId: teacher_id,
    requestedSlots: requested_slots,
    totalCost: total_cost,
    note,
    source: "ADMIN",
    createdBy: auth.user.userId,
  });

  if (!result.ok) {
    return NextResponse.json(
      { success: false, error: result.error },
      { status: result.status }
    );
  }

  return NextResponse.json(
    {
      success: true,
      order: result.order,
    },
    { status: 201 }
  );
}
