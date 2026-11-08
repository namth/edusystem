// lib/class-billing.ts — Kiểm tra trạng thái khoá lớp & dữ liệu ví slot (FEAT-015, BR-W06, BR-W08, TC-W08)
import { NextResponse } from "next/server";
import { queryPg } from "@/lib/db-pg";
import { getBalance, todayVN, toDateStr } from "@/lib/slot-wallet";
import { getSlotPricing } from "@/lib/slot-orders";

export const CLASS_LOCKED_ERROR =
  "Lớp đang tạm khoá hoặc đã kết thúc, chưa làm bài được. Vui lòng liên hệ giáo viên.";

export function classLockedResponse(): NextResponse {
  return NextResponse.json(
    {
      success: false,
      code: "CLASS_LOCKED",
      error: CLASS_LOCKED_ERROR,
    },
    { status: 403 }
  );
}

export interface AssertClassOpenResult {
  ok: boolean;
  status?: number;
  code?: string;
  error?: string;
  billing_status?: string;
}

/**
 * Kiểm tra trạng thái thanh toán của lớp.
 * - Bài tự do (classId rỗng/null/undefined) -> cho phép (ok: true).
 * - Lớp ACTIVE hoặc GRACE -> cho phép (ok: true).
 * - Lớp LOCKED hoặc ENDED -> chặn 403 CLASS_LOCKED.
 */
export async function assertClassOpen(
  classId: string | null | undefined
): Promise<AssertClassOpenResult> {
  if (!classId || typeof classId !== "string" || !classId.trim()) {
    return { ok: true };
  }

  const res = await queryPg(
    "SELECT billing_status FROM classes WHERE id = $1 LIMIT 1",
    [classId.trim()]
  );

  if (res.rows.length === 0) {
    return { ok: true };
  }

  const billing_status = res.rows[0].billing_status || "ACTIVE";
  if (billing_status === "LOCKED" || billing_status === "ENDED") {
    return {
      ok: false,
      status: 403,
      code: "CLASS_LOCKED",
      error: CLASS_LOCKED_ERROR,
    };
  }

  return { ok: true, billing_status };
}

/**
 * Cộng/trừ ngày dạng YYYY-MM-DD theo UTC.
 */
export function shiftDays(baseDateStr: string, days: number): string {
  const d = new Date(baseDateStr + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/**
 * Lấy dữ liệu ví slot của giáo viên: số dư, đơn giá, danh sách lớp, dự báo và sổ cái ledger.
 */
export async function getTeacherWalletData(
  teacherId: string,
  cursor?: string | null,
  classFilter?: string | null
) {
  const balance = await getBalance(teacherId);
  const { unit_price_vnd } = await getSlotPricing();

  // Danh sách lớp của giáo viên
  const classesRes = await queryPg(
    `SELECT c.id, c.name, c.billing_status, c.start_date, c.next_charge_at, c.grace_until, c.billing_period
     FROM classes c
     WHERE c.teacher_id = $1
     ORDER BY c.created_at DESC, c.id DESC`,
    [teacherId]
  );

  // Sĩ số từng lớp
  const enrollRes = await queryPg(
    `SELECT e.class_id, COUNT(*)::int AS cnt
     FROM enrollments e
     JOIN classes c ON c.id = e.class_id
     WHERE c.teacher_id = $1
     GROUP BY e.class_id`,
    [teacherId]
  );
  const countMap: Record<string, number> = {};
  for (const r of enrollRes.rows) {
    countMap[r.class_id] = Number(r.cnt || 0);
  }

  const todayStr = todayVN();
  const next31Str = shiftDays(todayStr, 31);
  let totalNextNeeded = 0;

  const classes = classesRes.rows.map((c: any) => {
    const studentCount = countMap[c.id] || 0;
    const enoughForNext = balance >= studentCount;
    const nextChargeAtStr = c.next_charge_at ? toDateStr(c.next_charge_at) : null;

    if (
      c.billing_status !== "ENDED" &&
      nextChargeAtStr &&
      nextChargeAtStr <= next31Str
    ) {
      totalNextNeeded += studentCount;
    }

    return {
      id: c.id,
      name: c.name,
      billing_status: c.billing_status,
      start_date: c.start_date ? toDateStr(c.start_date) : null,
      next_charge_at: nextChargeAtStr,
      grace_until: c.grace_until ? new Date(c.grace_until).toISOString() : null,
      student_count: studentCount,
      enough_for_next: enoughForNext,
    };
  });

  // Truy vấn ledger
  let sql = `
    SELECT l.id, l.delta, l.balance_after, l.reason, l.class_id, l.period,
           l.student_count, l.note, l.created_at, c.name AS class_name
    FROM slot_ledger l
    LEFT JOIN classes c ON c.id = l.class_id
    WHERE l.teacher_id = $1
  `;
  const params: any[] = [teacherId];
  let paramIdx = 2;

  if (classFilter && classFilter.trim()) {
    sql += ` AND l.class_id = $${paramIdx++}`;
    params.push(classFilter.trim());
  }

  if (cursor) {
    try {
      const decoded = JSON.parse(Buffer.from(cursor, "base64").toString("utf8"));
      if (decoded.created_at && decoded.id) {
        sql += ` AND (l.created_at < $${paramIdx++} OR (l.created_at = $${paramIdx++} AND l.id < $${paramIdx++}))`;
        params.push(decoded.created_at, decoded.created_at, decoded.id);
      }
    } catch {
      // Bỏ qua nếu cursor không hợp lệ
    }
  }

  sql += ` ORDER BY l.created_at DESC, l.id DESC LIMIT 21`;

  const ledgerRes = await queryPg(sql, params);
  const rows = ledgerRes.rows;
  let nextCursor: string | null = null;
  let items = rows;

  if (rows.length > 20) {
    items = rows.slice(0, 20);
    const lastItem = items[items.length - 1];
    const cursorObj = {
      created_at:
        lastItem.created_at instanceof Date
          ? lastItem.created_at.toISOString()
          : String(lastItem.created_at),
      id: lastItem.id,
    };
    nextCursor = Buffer.from(JSON.stringify(cursorObj)).toString("base64");
  }

  const ledger = items.map((r: any) => ({
    id: r.id,
    delta: Number(r.delta),
    balance_after: Number(r.balance_after),
    reason: r.reason,
    class_id: r.class_id || null,
    class_name: r.class_name || null,
    period: r.period !== null && r.period !== undefined ? Number(r.period) : null,
    student_count:
      r.student_count !== null && r.student_count !== undefined
        ? Number(r.student_count)
        : null,
    note: r.note || null,
    created_at:
      r.created_at instanceof Date ? r.created_at.toISOString() : String(r.created_at),
  }));

  return {
    balance,
    unit_price_vnd,
    total_next_needed: totalNextNeeded,
    classes,
    ledger,
    next_cursor: nextCursor,
  };
}
