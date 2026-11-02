import { NextResponse } from "next/server";
import { requireRole } from "@/lib/api-auth";
import { queryPg } from "@/lib/db-pg";
import { isTrialTeacher, trialLimitResponse } from "@/lib/teacher-trial";
import { createOrder } from "@/lib/slot-orders";

export async function GET(req?: Request) {
  const auth = await requireRole(["ADMIN", "TEACHER"]);
  if (auth.error) return auth.error;

  const res = await queryPg(
    `SELECT id, teacher_id, teacher_name, teacher_email, requested_slots, total_cost, status, created_at
     FROM slot_requests
     WHERE teacher_id = $1
     ORDER BY created_at DESC`,
    [auth.user.userId]
  );

  const slot_requests = res.rows.map((row) => ({
    ...row,
    requested_slots: Number(row.requested_slots),
    total_cost: Number(row.total_cost),
  }));

  return NextResponse.json({
    success: true,
    slot_requests,
  });
}

export async function POST(req: Request) {
  const auth = await requireRole(["ADMIN", "TEACHER"]);
  if (auth.error) return auth.error;

  if (await isTrialTeacher(auth.user.userId)) {
    return trialLimitResponse(
      "slots",
      "Tài khoản dùng thử chưa thể gửi yêu cầu mua thêm slot. Vui lòng chờ KitoKit xác minh tài khoản."
    );
  }

  const body = await req.json().catch(() => ({}));
  const { requested_slots } = body;

  const result = await createOrder({
    teacherId: auth.user.userId,
    requestedSlots: requested_slots,
    source: "TEACHER",
    createdBy: auth.user.userId,
  });

  if (!result.ok) {
    return NextResponse.json(
      {
        success: false,
        error: result.error,
      },
      { status: result.status }
    );
  }

  return NextResponse.json(
    {
      success: true,
      slot_request: result.order,
    },
    { status: 201 }
  );
}
