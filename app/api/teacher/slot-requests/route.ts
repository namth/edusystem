import crypto from "crypto";
import { NextResponse } from "next/server";
import { requireRole } from "@/lib/api-auth";
import { queryPg } from "@/lib/db-pg";
import { isTrialTeacher, trialLimitResponse } from "@/lib/teacher-trial";

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

  if (
    typeof requested_slots !== "number" ||
    !Number.isInteger(requested_slots) ||
    requested_slots < 1 ||
    requested_slots > 10000
  ) {
    return NextResponse.json(
      {
        success: false,
        error: "Số lượng slot phải là số nguyên từ 1 đến 10.000.",
      },
      { status: 400 }
    );
  }

  const userRes = await queryPg(
    `SELECT name, email FROM users WHERE id = $1`,
    [auth.user.userId]
  );
  const teacherName = userRes.rows[0]?.name || auth.user.email;
  const teacherEmail = userRes.rows[0]?.email || auth.user.email;

  const unitPrice = Number(process.env.SLOT_UNIT_PRICE_VND || 0);
  const totalCost = requested_slots * unitPrice;
  const id = "slr_" + crypto.randomUUID();
  const status = "PENDING";

  const insertRes = await queryPg(
    `INSERT INTO slot_requests (id, teacher_id, teacher_name, teacher_email, requested_slots, total_cost, status)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING id, teacher_id, teacher_name, teacher_email, requested_slots, total_cost, status, created_at`,
    [id, auth.user.userId, teacherName, teacherEmail, requested_slots, totalCost, status]
  );

  const row = insertRes.rows[0];
  const slot_request = {
    ...row,
    requested_slots: Number(row.requested_slots),
    total_cost: Number(row.total_cost),
  };

  return NextResponse.json(
    {
      success: true,
      slot_request,
    },
    { status: 201 }
  );
}
