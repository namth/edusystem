// lib/slot-orders.ts — Nghiệp vụ đơn hàng mua slot & VietQR (FEAT-013 §3.3, §5, §7, DEC-032, DEC-033)
import crypto from "crypto";
import { queryPg, getPgPool } from "@/lib/db-pg";
import { createNotification } from "@/lib/notifications";

const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export interface Order {
  id: string;
  code: string;
  teacher_id: string;
  teacher_name: string;
  teacher_email: string;
  requested_slots: number;
  unit_price: number;
  total_cost: number;
  status: "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED";
  source: "TEACHER" | "ADMIN";
  created_by: string | null;
  note: string | null;
  payment_reported_at: string | null;
  decided_by: string | null;
  decided_at: string | null;
  reject_reason: string | null;
  payment_ref: string | null;
  created_at: string;
}

export type Result<T> =
  | { ok: true; order: T }
  | { ok: false; status: 400 | 403 | 404 | 409; error: string };

export function formatOrder(row: any): Order {
  return {
    id: row.id,
    code: row.code,
    teacher_id: row.teacher_id,
    teacher_name: row.teacher_name,
    teacher_email: row.teacher_email,
    requested_slots: Number(row.requested_slots),
    unit_price: row.unit_price !== null && row.unit_price !== undefined ? Number(row.unit_price) : 0,
    total_cost: Number(row.total_cost),
    status: row.status,
    source: row.source,
    created_by: row.created_by ?? null,
    note: row.note ?? null,
    payment_reported_at: row.payment_reported_at ? new Date(row.payment_reported_at).toISOString() : null,
    decided_by: row.decided_by ?? null,
    decided_at: row.decided_at ? new Date(row.decided_at).toISOString() : null,
    reject_reason: row.reject_reason ?? null,
    payment_ref: row.payment_ref ?? null,
    created_at: row.created_at ? new Date(row.created_at).toISOString() : row.created_at,
  };
}

/**
 * Sinh mã đơn hàng: "KK" + 8 ký tự từ bảng "ABCDEFGHJKLMNPQRSTUVWXYZ23456789" (bỏ 0, O, 1, I).
 */
export function generateOrderCode(): string {
  let result = "KK";
  for (let i = 0; i < 8; i++) {
    const idx = crypto.randomInt(0, CODE_CHARS.length);
    result += CODE_CHARS[idx];
  }
  return result;
}

/**
 * Lấy đơn giá slot từ system_settings; nếu thiếu dòng thì dùng Number(SLOT_UNIT_PRICE_VND) || 0.
 */
export async function getSlotPricing(): Promise<{ unit_price_vnd: number }> {
  try {
    const res = await queryPg(`SELECT value FROM system_settings WHERE key = 'slot_pricing' LIMIT 1`);
    if (res.rows.length > 0 && res.rows[0].value) {
      const val = res.rows[0].value;
      if (typeof val === "object" && val.unit_price_vnd !== undefined) {
        return { unit_price_vnd: Number(val.unit_price_vnd) };
      }
    }
  } catch (err) {
    // Không có bảng system_settings
  }
  return { unit_price_vnd: Number(process.env.SLOT_UNIT_PRICE_VND) || 0 };
}

/**
 * Lấy thông tin tài khoản ngân hàng nhận tiền từ system_settings.
 */
export async function getPaymentAccount(): Promise<{
  bank_bin: string;
  bank_name: string;
  account_no: string;
  account_name: string;
  configured: boolean;
}> {
  const defaultAcc = {
    bank_bin: "",
    bank_name: "",
    account_no: "",
    account_name: "",
    configured: false,
  };

  try {
    const res = await queryPg(`SELECT value FROM system_settings WHERE key = 'payment_account' LIMIT 1`);
    if (res.rows.length > 0 && res.rows[0].value) {
      const val = res.rows[0].value;
      const bank_bin = typeof val.bank_bin === "string" ? val.bank_bin.trim() : "";
      const bank_name = typeof val.bank_name === "string" ? val.bank_name.trim() : "";
      const account_no = typeof val.account_no === "string" ? val.account_no.trim() : "";
      const account_name = typeof val.account_name === "string" ? val.account_name.trim() : "";
      const configured = Boolean(bank_bin && account_no && account_name);
      return {
        bank_bin,
        bank_name,
        account_no,
        account_name,
        configured,
      };
    }
  } catch (err) {
    // Không có bảng system_settings
  }

  return defaultAcc;
}

/**
 * Tạo đơn hàng mua slot:
 * - Giáo viên tự tạo (source: "TEACHER") hoặc Admin tạo hộ (source: "ADMIN").
 */
export async function createOrder(i: {
  teacherId: string;
  requestedSlots: number;
  totalCost?: number;
  note?: string;
  source: "TEACHER" | "ADMIN";
  createdBy: string;
}): Promise<Result<Order>> {
  if (
    typeof i.requestedSlots !== "number" ||
    !Number.isInteger(i.requestedSlots) ||
    i.requestedSlots < 1 ||
    i.requestedSlots > 10000
  ) {
    return { ok: false, status: 400, error: "Số lượng slot phải là số nguyên từ 1 đến 10.000." };
  }

  const teacherRes = await queryPg(
    `SELECT id, name, email, role FROM users WHERE id = $1 LIMIT 1`,
    [i.teacherId]
  );
  if (teacherRes.rows.length === 0 || teacherRes.rows[0].role !== "TEACHER") {
    return { ok: false, status: 404, error: "Giáo viên không tồn tại." };
  }
  const teacher = teacherRes.rows[0];

  const { unit_price_vnd } = await getSlotPricing();
  let totalCost: number;
  const cleanNote = typeof i.note === "string" && i.note.trim() ? i.note.trim() : null;

  if (i.source === "TEACHER") {
    totalCost = i.requestedSlots * unit_price_vnd;
  } else {
    // source: "ADMIN"
    if (i.totalCost === undefined) {
      totalCost = i.requestedSlots * unit_price_vnd;
    } else {
      if (
        typeof i.totalCost !== "number" ||
        !Number.isInteger(i.totalCost) ||
        i.totalCost < 0 ||
        i.totalCost > 1000000000
      ) {
        return { ok: false, status: 400, error: "Giá không hợp lệ (0 - 1.000.000.000)." };
      }
      totalCost = i.totalCost;
      if (totalCost !== i.requestedSlots * unit_price_vnd && !cleanNote) {
        return { ok: false, status: 400, error: "Giá khác giá chuẩn bắt buộc có ghi chú." };
      }
    }
  }

  const id = "slr_" + crypto.randomUUID();
  let insertRes;
  // Vòng lặp thử tạo mã đơn không trùng
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = generateOrderCode();
    try {
      insertRes = await queryPg(
        `INSERT INTO slot_requests (
          id, code, teacher_id, teacher_name, teacher_email,
          requested_slots, unit_price, total_cost, status,
          source, created_by, note, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'PENDING', $9, $10, $11, NOW())
        RETURNING *`,
        [
          id,
          code,
          teacher.id,
          teacher.name || teacher.email,
          teacher.email,
          i.requestedSlots,
          unit_price_vnd,
          totalCost,
          i.source,
          i.createdBy,
          cleanNote,
        ]
      );
      break;
    } catch (err: any) {
      if (err.code === "23505" && attempt < 4) {
        continue;
      }
      throw err;
    }
  }

  if (!insertRes || insertRes.rows.length === 0) {
    throw new Error("Không thể tạo đơn hàng.");
  }

  const newOrder = formatOrder(insertRes.rows[0]);

  if (i.source === "ADMIN") {
    await createNotification({
      userId: teacher.id,
      type: "ORDER_CREATED",
      title: "Đơn mua slot mới",
      body: `Admin đã tạo đơn mua ${i.requestedSlots} slot cho bạn.`,
      link: `/teacher/orders/${newOrder.id}`,
      refId: newOrder.id,
    }).catch(() => {});
  }

  return { ok: true, order: newOrder };
}

/**
 * Duyệt đơn hàng:
 * Chạy trong transaction pool connect:
 * UPDATE slot_requests SET status = 'APPROVED', decided_by, decided_at = NOW(), payment_ref WHERE id = $1 AND status = 'PENDING' RETURNING *;
 * Có dòng trả về thì UPDATE users SET slot_limit = COALESCE(slot_limit,0) + requested_slots, rồi COMMIT.
 */
export async function approveOrder(
  id: string,
  decidedBy: string,
  paymentRef?: string
): Promise<Result<Order>> {
  const pool = getPgPool();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const updateRes = await client.query(
      `UPDATE slot_requests
       SET status = 'APPROVED',
           decided_by = $2,
           decided_at = NOW(),
           payment_ref = $3
       WHERE id = $1 AND status = 'PENDING'
       RETURNING *;`,
      [id, decidedBy, paymentRef ?? null]
    );

    if (updateRes.rowCount === 0) {
      await client.query("ROLLBACK");
      const checkRes = await queryPg(`SELECT id, status FROM slot_requests WHERE id = $1`, [id]);
      if (checkRes.rows.length === 0) {
        return { ok: false, status: 404, error: "Đơn hàng không tồn tại." };
      }
      return { ok: false, status: 409, error: "Đơn hàng không ở trạng thái chờ duyệt." };
    }

    const updated = updateRes.rows[0];
    await client.query(
      `UPDATE users SET slot_limit = COALESCE(slot_limit, 0) + $1 WHERE id = $2;`,
      [Number(updated.requested_slots), updated.teacher_id]
    );

    await client.query("COMMIT");

    // Sau COMMIT mới gửi thông báo
    await createNotification({
      userId: updated.teacher_id,
      type: "ORDER_APPROVED",
      title: "Đơn mua slot đã được duyệt",
      body: `Đơn mua ${updated.requested_slots} slot của bạn đã được duyệt.`,
      link: `/teacher/orders/${updated.id}`,
      refId: updated.id,
    }).catch(() => {});

    return { ok: true, order: formatOrder(updated) };
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Từ chối đơn hàng:
 * reason sau khi trim phải từ 1 đến 500 ký tự.
 */
export async function rejectOrder(
  id: string,
  decidedBy: string,
  reason: string
): Promise<Result<Order>> {
  const trimmed = typeof reason === "string" ? reason.trim() : "";
  if (!trimmed || trimmed.length > 500) {
    return { ok: false, status: 400, error: "Lý do từ chối không được để trống và không quá 500 ký tự." };
  }

  const updateRes = await queryPg(
    `UPDATE slot_requests
     SET status = 'REJECTED',
         decided_by = $2,
         decided_at = NOW(),
         reject_reason = $3
     WHERE id = $1 AND status = 'PENDING'
     RETURNING *;`,
    [id, decidedBy, trimmed]
  );

  if (updateRes.rowCount === 0) {
    const checkRes = await queryPg(`SELECT id, status FROM slot_requests WHERE id = $1`, [id]);
    if (checkRes.rows.length === 0) {
      return { ok: false, status: 404, error: "Đơn hàng không tồn tại." };
    }
    return { ok: false, status: 409, error: "Đơn hàng không ở trạng thái chờ duyệt." };
  }

  const updated = updateRes.rows[0];

  await createNotification({
    userId: updated.teacher_id,
    type: "ORDER_REJECTED",
    title: "Đơn mua slot bị từ chối",
    body: trimmed,
    link: `/teacher/orders/${updated.id}`,
    refId: updated.id,
  }).catch(() => {});

  return { ok: true, order: formatOrder(updated) };
}

/**
 * Huỷ đơn hàng:
 * Giáo viên chỉ huỷ đơn của mình; Admin huỷ được mọi đơn PENDING.
 */
export async function cancelOrder(
  id: string,
  by: { userId: string; role: string }
): Promise<Result<Order>> {
  const checkRes = await queryPg(`SELECT * FROM slot_requests WHERE id = $1`, [id]);
  if (checkRes.rows.length === 0) {
    return { ok: false, status: 404, error: "Đơn hàng không tồn tại." };
  }
  const current = checkRes.rows[0];

  if (by.role !== "ADMIN" && current.teacher_id !== by.userId) {
    return { ok: false, status: 404, error: "Đơn hàng không tồn tại." };
  }

  if (current.status !== "PENDING") {
    return { ok: false, status: 409, error: "Đơn hàng không ở trạng thái chờ xử lý." };
  }

  const updateRes = await queryPg(
    `UPDATE slot_requests
     SET status = 'CANCELLED'
     WHERE id = $1 AND status = 'PENDING'
     RETURNING *;`,
    [id]
  );

  if (updateRes.rowCount === 0) {
    return { ok: false, status: 409, error: "Đơn hàng không ở trạng thái chờ xử lý." };
  }

  return { ok: true, order: formatOrder(updateRes.rows[0]) };
}

/**
 * Báo đã chuyển khoản (idempotent):
 * - Nếu đã có payment_reported_at thì trả ok và không báo lại.
 * - Lần đầu thì ghi nhận thời điểm và báo ORDER_PAID_REPORTED cho MỌI ADMIN.
 */
export async function reportPaid(
  id: string,
  by: { userId: string; role: string }
): Promise<Result<Order>> {
  const checkRes = await queryPg(`SELECT * FROM slot_requests WHERE id = $1`, [id]);
  if (checkRes.rows.length === 0) {
    return { ok: false, status: 404, error: "Đơn hàng không tồn tại." };
  }
  const current = checkRes.rows[0];

  if (by.role !== "ADMIN" && current.teacher_id !== by.userId) {
    return { ok: false, status: 404, error: "Đơn hàng không tồn tại." };
  }

  if (current.status !== "PENDING") {
    return { ok: false, status: 409, error: "Đơn hàng không ở trạng thái chờ xử lý." };
  }

  if (current.payment_reported_at) {
    return { ok: true, order: formatOrder(current) };
  }

  const updateRes = await queryPg(
    `UPDATE slot_requests
     SET payment_reported_at = NOW()
     WHERE id = $1 AND status = 'PENDING'
     RETURNING *;`,
    [id]
  );

  if (updateRes.rowCount === 0) {
    return { ok: false, status: 409, error: "Đơn hàng không ở trạng thái chờ xử lý." };
  }

  const updated = updateRes.rows[0];

  const adminRes = await queryPg(`SELECT id FROM users WHERE role = 'ADMIN'`);
  for (const admin of adminRes.rows) {
    await createNotification({
      userId: admin.id,
      type: "ORDER_PAID_REPORTED",
      title: "Đơn hàng đã báo chuyển khoản",
      body: `Giáo viên ${updated.teacher_name} đã báo chuyển khoản cho đơn ${updated.code}.`,
      link: `/admin/orders?q=${updated.code}`,
      refId: updated.id,
    }).catch(() => {});
  }

  return { ok: true, order: formatOrder(updated) };
}
