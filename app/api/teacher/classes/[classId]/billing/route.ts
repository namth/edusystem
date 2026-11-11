// app/api/teacher/classes/[classId]/billing/route.ts — Đặt ngày khai giảng của lớp học (FEAT-015 §6, BR-W11, TC-W13)
import { NextResponse } from "next/server";
import { requireRole } from "@/lib/api-auth";
import { queryPg } from "@/lib/db-pg";
import { todayVN, addMonths } from "@/lib/slot-wallet";
import { shiftDays } from "@/lib/class-billing";

export async function PUT(
  req: Request,
  props: { params: Promise<{ classId: string }> }
) {
  const auth = await requireRole(["TEACHER", "ADMIN"]);
  if (auth.error) return auth.error;

  const { classId } = await props.params;

  const classRes = await queryPg(
    "SELECT id, teacher_id, billing_period, billing_status FROM classes WHERE id = $1 LIMIT 1",
    [classId]
  );
  if (classRes.rows.length === 0) {
    return NextResponse.json(
      { success: false, error: "Lớp học không tồn tại." },
      { status: 404 }
    );
  }

  const cls = classRes.rows[0];
  if (auth.user.role === "TEACHER" && cls.teacher_id !== auth.user.userId) {
    return NextResponse.json(
      { success: false, error: "Lớp học không tồn tại." },
      { status: 404 }
    );
  }

  const body = await req.json().catch(() => ({}));
  const startDate = body?.start_date;

  if (!startDate || typeof startDate !== "string") {
    return NextResponse.json(
      { success: false, error: "Thiếu ngày khai giảng (start_date)." },
      { status: 400 }
    );
  }

  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRegex.test(startDate)) {
    return NextResponse.json(
      { success: false, error: "Định dạng ngày khai giảng không hợp lệ (YYYY-MM-DD)." },
      { status: 400 }
    );
  }

  const [y, m, d] = startDate.split("-").map(Number);
  const dateObj = new Date(Date.UTC(y, m - 1, d));
  if (
    isNaN(dateObj.getTime()) ||
    dateObj.getUTCFullYear() !== y ||
    dateObj.getUTCMonth() + 1 !== m ||
    dateObj.getUTCDate() !== d
  ) {
    return NextResponse.json(
      { success: false, error: "Ngày khai giảng không hợp lệ." },
      { status: 400 }
    );
  }

  const todayStr = todayVN();
  const minDate = shiftDays(todayStr, -30);
  const maxDate = shiftDays(todayStr, 90);

  if (startDate < minDate || startDate > maxDate) {
    return NextResponse.json(
      {
        success: false,
        error:
          "Ngày khai giảng không được quá 30 ngày trong quá khứ hoặc quá 90 ngày trong tương lai.",
      },
      { status: 400 }
    );
  }

  // Kiểm tra nếu lớp đã có dòng CYCLE
  const cycleRes = await queryPg(
    "SELECT 1 FROM slot_ledger WHERE class_id = $1 AND reason = 'CYCLE' LIMIT 1",
    [classId]
  );
  if (cycleRes.rows.length > 0) {
    return NextResponse.json(
      {
        success: false,
        error:
          "Lớp học đã bắt đầu chu kỳ tính phí, không thể thay đổi ngày khai giảng.",
      },
      { status: 409 }
    );
  }

  const billingPeriod = Number(cls.billing_period || 0);
  const nextChargeAt = addMonths(startDate, billingPeriod + 1);

  await queryPg(
    `UPDATE classes
     SET start_date = $1, next_charge_at = $2
     WHERE id = $3`,
    [startDate, nextChargeAt, classId]
  );

  return NextResponse.json({
    success: true,
    start_date: startDate,
    next_charge_at: nextChargeAt,
  });
}
