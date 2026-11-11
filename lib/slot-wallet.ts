// lib/slot-wallet.ts — Lõi ví slot học sinh-tháng & lịch sử ledger (FEAT-015, DEC-042 -> DEC-047)
import crypto from "crypto";
import { PoolClient } from "pg";
import { queryPg, getPgPool } from "@/lib/db-pg";
import { createNotification } from "@/lib/notifications";

export type LedgerReason = "PURCHASE" | "ADMIN_ADJUST" | "ENROLL" | "CYCLE" | "MIGRATION";

export interface ApplyDeltaParams {
  teacherId: string;
  delta: number;
  reason: LedgerReason;
  classId?: string;
  studentId?: string;
  orderId?: string;
  period?: number;
  studentCount?: number;
  studentIds?: string[];
  note?: string;
  createdBy?: string;
}

/**
 * Lấy ngày hôm nay theo múi giờ Asia/Ho_Chi_Minh (UTC+7), định dạng YYYY-MM-DD.
 */
export function todayVN(now: Date = new Date()): string {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return formatter.format(now);
}

/**
 * Chuẩn hóa giá trị cột DATE (Date object hoặc chuỗi) về chuỗi YYYY-MM-DD.
 */
export function toDateStr(v: Date | string | null | undefined): string {
  if (!v) return todayVN();
  if (v instanceof Date) {
    const y = v.getUTCFullYear();
    const m = String(v.getUTCMonth() + 1).padStart(2, "0");
    const d = String(v.getUTCDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }
  return String(v).slice(0, 10);
}

/**
 * Cộng thêm n tháng vào một ngày YYYY-MM-DD (giữ ngày cuối tháng khi tháng sau ngắn hơn).
 * Vd: 31/01/2026 + 1 -> 28/02/2026; 31/01/2024 + 1 -> 29/02/2024.
 */
export function addMonths(d: string | Date, n: number): string {
  const dStr = toDateStr(d);
  const [yearStr, monthStr, dayStr] = dStr.split("-");
  const year = Number(yearStr);
  const month = Number(monthStr);
  const day = Number(dayStr);

  const totalMonths = year * 12 + (month - 1) + n;
  const targetYear = Math.floor(totalMonths / 12);
  const targetMonth = (totalMonths % 12) + 1;

  const maxDays = new Date(Date.UTC(targetYear, targetMonth, 0)).getUTCDate();
  const targetDay = Math.min(day, maxDays);

  return `${String(targetYear).padStart(4, "0")}-${String(targetMonth).padStart(2, "0")}-${String(targetDay).padStart(2, "0")}`;
}

/**
 * Tính số tháng giữa 2 ngày (dạng YYYY-MM-DD hoặc Date).
 */
export function monthsBetween(startDate: string | Date, nextChargeAt: string | Date): number {
  const sStr = toDateStr(startDate);
  const nStr = toDateStr(nextChargeAt);
  const [y1, m1] = sStr.split("-").map(Number);
  const [y2, m2] = nStr.split("-").map(Number);
  return (y2 - y1) * 12 + (m2 - m1);
}

/**
 * Đọc số dư ví slot_balance của giáo viên từ bảng users.
 */
export async function getBalance(teacherId: string): Promise<number> {
  const res = await queryPg("SELECT slot_balance FROM users WHERE id = $1 LIMIT 1", [teacherId]);
  if (res.rows.length === 0) return 0;
  return Number(res.rows[0].slot_balance || 0);
}

/**
 * Khoá dòng users FOR UPDATE, kiểm tra không âm, cập nhật slot_balance và ghi dòng slot_ledger.
 * Hỗ trợ nhận client tuỳ chọn (trong giao dịch của người gọi) hoặc tự mở giao dịch.
 */
export async function applyDelta(
  client: PoolClient | null,
  e: ApplyDeltaParams
): Promise<{ ok: true; balance: number } | { ok: false; code: "INSUFFICIENT" | "DUPLICATE" }> {
  const ownsClient = !client;
  const dbClient = client || (await getPgPool().connect());

  try {
    if (ownsClient) {
      await dbClient.query("BEGIN");
    } else {
      await dbClient.query("SAVEPOINT apply_delta_sp");
    }

    const userRes = await dbClient.query(
      "SELECT slot_balance FROM users WHERE id = $1 FOR UPDATE",
      [e.teacherId]
    );

    if (userRes.rows.length === 0) {
      if (ownsClient) await dbClient.query("ROLLBACK");
      else await dbClient.query("ROLLBACK TO SAVEPOINT apply_delta_sp");
      return { ok: false, code: "INSUFFICIENT" };
    }

    const currentBalance = Number(userRes.rows[0].slot_balance || 0);
    const newBalance = currentBalance + e.delta;

    if (newBalance < 0) {
      if (ownsClient) await dbClient.query("ROLLBACK");
      else await dbClient.query("ROLLBACK TO SAVEPOINT apply_delta_sp");
      return { ok: false, code: "INSUFFICIENT" };
    }

    await dbClient.query("UPDATE users SET slot_balance = $1 WHERE id = $2", [
      newBalance,
      e.teacherId,
    ]);

    const ledgerId = "led_" + crypto.randomUUID();
    try {
      await dbClient.query(
        `INSERT INTO slot_ledger (
          id, teacher_id, delta, balance_after, reason,
          class_id, student_id, order_id, period,
          student_count, student_ids, note, created_by, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, NOW())`,
        [
          ledgerId,
          e.teacherId,
          e.delta,
          newBalance,
          e.reason,
          e.classId ?? null,
          e.studentId ?? null,
          e.orderId ?? null,
          e.period !== undefined ? e.period : null,
          e.studentCount !== undefined ? e.studentCount : null,
          e.studentIds ?? null,
          e.note ?? null,
          e.createdBy ?? null,
        ]
      );
    } catch (insertErr: any) {
      if (
        insertErr.code === "23505" ||
        insertErr.message?.includes("unique constraint") ||
        insertErr.message?.includes("duplicate")
      ) {
        if (ownsClient) await dbClient.query("ROLLBACK");
        else await dbClient.query("ROLLBACK TO SAVEPOINT apply_delta_sp");
        return { ok: false, code: "DUPLICATE" };
      }
      throw insertErr;
    }

    if (ownsClient) {
      await dbClient.query("COMMIT");
    } else {
      await dbClient.query("RELEASE SAVEPOINT apply_delta_sp");
    }

    return { ok: true, balance: newBalance };
  } catch (err) {
    if (ownsClient) {
      await dbClient.query("ROLLBACK").catch(() => {});
    } else {
      await dbClient.query("ROLLBACK TO SAVEPOINT apply_delta_sp").catch(() => {});
    }
    throw err;
  } finally {
    if (ownsClient) {
      dbClient.release();
    }
  }
}

/**
 * Trừ slot khi ghi danh học sinh vào lớp (BR-W02, W06, W09, W10).
 */
export async function chargeEnrollment(
  client: PoolClient | null,
  a: { classId: string; studentId: string }
): Promise<
  | { ok: true; charged: boolean }
  | { ok: false; status: 409; error: string; code: "NO_SLOT" | "CLASS_LOCKED" | "CLASS_ENDED" }
> {
  const ownsClient = !client;
  const dbClient = client || (await getPgPool().connect());

  try {
    if (ownsClient) {
      await dbClient.query("BEGIN");
    }

    const classRes = await dbClient.query(
      `SELECT c.id, c.teacher_id, c.billing_status, c.billing_period, u.role AS teacher_role, u.teacher_status
       FROM classes c
       LEFT JOIN users u ON u.id = c.teacher_id
       WHERE c.id = $1
       FOR UPDATE OF c`,
      [a.classId]
    );

    if (classRes.rows.length === 0) {
      if (ownsClient) await dbClient.query("ROLLBACK");
      return { ok: false, status: 409, code: "CLASS_ENDED", error: "Lớp học không tồn tại." };
    }

    const cls = classRes.rows[0];

    // Lớp đã kết thúc
    if (cls.billing_status === "ENDED") {
      if (ownsClient) await dbClient.query("ROLLBACK");
      return { ok: false, status: 409, code: "CLASS_ENDED", error: "Lớp học đã kết thúc." };
    }

    // Lớp đang tạm khoá
    if (cls.billing_status === "LOCKED") {
      if (ownsClient) await dbClient.query("ROLLBACK");
      return { ok: false, status: 409, code: "CLASS_LOCKED", error: "Lớp học đang tạm khoá." };
    }

    // Chủ lớp là ADMIN -> miễn phí
    if (!cls.teacher_id || cls.teacher_role === "ADMIN") {
      if (ownsClient) await dbClient.query("COMMIT");
      return { ok: true, charged: false };
    }

    // Giáo viên TRIAL / REJECTED -> không tính phí
    if (cls.teacher_status === "TRIAL" || cls.teacher_status === "REJECTED") {
      if (ownsClient) await dbClient.query("COMMIT");
      return { ok: true, charged: false };
    }

    const currentPeriod = Number(cls.billing_period || 0);

    // Kiểm tra học sinh đã được trả kỳ hiện tại chưa
    const paidRes = await dbClient.query(
      `SELECT 1 FROM slot_ledger
       WHERE class_id = $1
         AND (
           (reason = 'ENROLL' AND student_id = $2 AND period = $3)
           OR
           (reason = 'CYCLE' AND period = $3 AND $2 = ANY(student_ids))
         )
       LIMIT 1`,
      [a.classId, a.studentId, currentPeriod]
    );

    if (paidRes.rows.length > 0) {
      if (ownsClient) await dbClient.query("COMMIT");
      return { ok: true, charged: false };
    }

    // Trừ 1 slot cho kỳ hiện tại
    const deltaRes = await applyDelta(dbClient, {
      teacherId: cls.teacher_id,
      delta: -1,
      reason: "ENROLL",
      classId: a.classId,
      studentId: a.studentId,
      period: currentPeriod,
    });

    if (!deltaRes.ok) {
      if (deltaRes.code === "INSUFFICIENT") {
        if (ownsClient) await dbClient.query("ROLLBACK");
        return {
          ok: false,
          status: 409,
          code: "NO_SLOT",
          error: "Thầy cô không đủ slot để thêm học sinh. Vui lòng mua thêm slot.",
        };
      }
      if (deltaRes.code === "DUPLICATE") {
        if (ownsClient) await dbClient.query("COMMIT");
        return { ok: true, charged: false };
      }
    }

    if (ownsClient) {
      await dbClient.query("COMMIT");
    }

    return { ok: true, charged: true };
  } catch (err) {
    if (ownsClient) {
      await dbClient.query("ROLLBACK").catch(() => {});
    }
    throw err;
  } finally {
    if (ownsClient) {
      dbClient.release();
    }
  }
}

/**
 * Chạy chu kỳ tính phí cho các lớp đến hạn (BR-W04, W05, W12).
 */
export async function runBillingCycle(
  now: Date = new Date()
): Promise<{ charged: number; grace: number; locked: number; skipped: number }> {
  const todayStr = todayVN(now);

  const candidatesRes = await queryPg(
    `SELECT c.id, c.name, c.teacher_id, c.start_date, c.next_charge_at, c.billing_period, c.billing_status, c.grace_until
     FROM classes c
     JOIN users u ON u.id = c.teacher_id
     WHERE c.billing_status IN ('ACTIVE', 'GRACE', 'LOCKED')
       AND c.next_charge_at IS NOT NULL
       AND c.next_charge_at <= $1
       AND u.role = 'TEACHER'
       AND (u.teacher_status = 'VERIFIED' OR u.teacher_status IS NULL)
     ORDER BY c.next_charge_at ASC, c.id ASC`,
    [todayStr]
  );

  let charged = 0;
  let grace = 0;
  let locked = 0;
  let skipped = 0;

  for (const c of candidatesRes.rows) {
    const client = await getPgPool().connect();
    let notifToSend: {
      userId: string;
      type: "SLOT_CHARGED" | "SLOT_GRACE" | "CLASS_LOCKED";
      title: string;
      body: string;
      link: string;
      refId: string;
    } | null = null;

    try {
      await client.query("BEGIN");

      const lockRes = await client.query(
        `SELECT c.id, c.name, c.teacher_id, c.start_date, c.next_charge_at, c.billing_period, c.billing_status, c.grace_until, u.role, u.teacher_status
         FROM classes c
         JOIN users u ON u.id = c.teacher_id
         WHERE c.id = $1
         FOR UPDATE OF c`,
        [c.id]
      );

      if (lockRes.rows.length === 0) {
        await client.query("ROLLBACK");
        skipped++;
        continue;
      }

      const cls = lockRes.rows[0];
      const nextChargeAtStr = toDateStr(cls.next_charge_at);

      if (
        !cls.billing_status ||
        !["ACTIVE", "GRACE", "LOCKED"].includes(cls.billing_status) ||
        !cls.next_charge_at ||
        nextChargeAtStr > todayStr ||
        cls.role !== "TEACHER" ||
        (cls.teacher_status !== "VERIFIED" && cls.teacher_status !== null)
      ) {
        await client.query("ROLLBACK");
        skipped++;
        continue;
      }

      const startDate = toDateStr(cls.start_date || todayStr);
      const nextChargeAt = nextChargeAtStr;
      const period = monthsBetween(startDate, nextChargeAt);

      const stuRes = await client.query(
        "SELECT student_id FROM enrollments WHERE class_id = $1 ORDER BY student_id ASC",
        [cls.id]
      );
      const studentIds = stuRes.rows.map((r: any) => r.student_id);
      // Học sinh đã trả kỳ này qua ENROLL (vd vào lớp sau khi xác minh/chuyển dữ liệu nhưng trước lần
      // cron đầu) không bị trừ lần nữa. student_ids vẫn lưu đủ sĩ số để nhận diện "đã trả kỳ" (BR-W02).
      const paidRes = await client.query(
        `SELECT student_id FROM slot_ledger WHERE class_id = $1 AND reason = 'ENROLL' AND period = $2`,
        [cls.id, period]
      );
      const paid = new Set(paidRes.rows.map((r: any) => r.student_id));
      const studentCount = studentIds.filter((id: string) => !paid.has(id)).length;

      if (studentCount === 0) {
        const nextNext = addMonths(startDate, period + 1);
        await client.query(
          `UPDATE classes
           SET billing_period = $1,
               next_charge_at = $2,
               billing_status = 'ACTIVE',
               grace_until = NULL
           WHERE id = $3`,
          [period, nextNext, cls.id]
        );
        await client.query("COMMIT");
        charged++;
        continue;
      }

      const deltaRes = await applyDelta(client, {
        teacherId: cls.teacher_id,
        delta: -studentCount,
        reason: "CYCLE",
        classId: cls.id,
        period,
        studentCount,
        studentIds,
      });

      if (deltaRes.ok) {
        const nextNext = addMonths(startDate, period + 1);
        await client.query(
          `UPDATE classes
           SET billing_period = $1,
               next_charge_at = $2,
               billing_status = 'ACTIVE',
               grace_until = NULL
           WHERE id = $3`,
          [period, nextNext, cls.id]
        );
        await client.query("COMMIT");
        charged++;

        notifToSend = {
          userId: cls.teacher_id,
          type: "SLOT_CHARGED",
          title: "Đã trừ slot kỳ mới",
          body: `Đã trừ ${studentCount} slot cho lớp ${cls.name} (kỳ ${period}).`,
          link: "/teacher/slots",
          refId: `${cls.id}:${period}`,
        };
      } else if (deltaRes.code === "DUPLICATE") {
        await client.query("ROLLBACK");
        skipped++;
      } else if (deltaRes.code === "INSUFFICIENT") {
        if (cls.billing_status === "ACTIVE") {
          const graceUntil = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
          await client.query(
            `UPDATE classes SET billing_status = 'GRACE', grace_until = $1 WHERE id = $2`,
            [graceUntil, cls.id]
          );
          await client.query("COMMIT");
          grace++;

          notifToSend = {
            userId: cls.teacher_id,
            type: "SLOT_GRACE",
            title: "Lớp vào thời gian ân hạn",
            body: `Lớp ${cls.name} không đủ slot và đã được chuyển sang trạng thái ân hạn 7 ngày.`,
            link: "/teacher/slots",
            refId: `${cls.id}:${period}`,
          };
        } else if (cls.billing_status === "GRACE") {
          const graceUntilTime = cls.grace_until ? new Date(cls.grace_until).getTime() : 0;
          if (now.getTime() > graceUntilTime) {
            await client.query(
              `UPDATE classes SET billing_status = 'LOCKED' WHERE id = $1`,
              [cls.id]
            );
            await client.query("COMMIT");
            locked++;

            notifToSend = {
              userId: cls.teacher_id,
              type: "CLASS_LOCKED",
              title: "Lớp học đã bị tạm khoá",
              body: `Lớp ${cls.name} đã hết thời gian ân hạn và bị tạm khoá do không đủ slot.`,
              link: "/teacher/slots",
              refId: `${cls.id}:${period}`,
            };
          } else {
            await client.query("ROLLBACK");
            skipped++;
          }
        } else {
          await client.query("ROLLBACK");
          skipped++;
        }
      }
    } catch (cycleErr) {
      await client.query("ROLLBACK").catch(() => {});
      console.error(`runBillingCycle error on class ${c.id}:`, cycleErr);
      skipped++;
    } finally {
      client.release();
    }

    if (notifToSend) {
      await createNotification(notifToSend).catch((err) => {
        console.warn("runBillingCycle notification error:", err);
      });
    }
  }

  return { charged, grace, locked, skipped };
}

/**
 * Thử trừ và mở lại các lớp đang GRACE hoặc LOCKED của giáo viên khi ví được cộng slot (BR-W07).
 */
export async function retryOverdueClasses(teacherId: string): Promise<number> {
  const classesRes = await queryPg(
    `SELECT id, name, teacher_id, start_date, next_charge_at, billing_period, billing_status, grace_until
     FROM classes
     WHERE teacher_id = $1
       AND billing_status IN ('GRACE', 'LOCKED')
     ORDER BY next_charge_at ASC, created_at ASC`,
    [teacherId]
  );

  let reopenedCount = 0;

  for (const c of classesRes.rows) {
    const client = await getPgPool().connect();
    let notifToSend: {
      userId: string;
      type: "SLOT_CHARGED";
      title: string;
      body: string;
      link: string;
      refId: string;
    } | null = null;

    try {
      await client.query("BEGIN");

      const lockRes = await client.query(
        "SELECT id, name, teacher_id, start_date, next_charge_at, billing_period, billing_status, grace_until FROM classes WHERE id = $1 FOR UPDATE OF classes",
        [c.id]
      );

      if (lockRes.rows.length === 0) {
        await client.query("ROLLBACK");
        continue;
      }

      const cls = lockRes.rows[0];
      if (cls.billing_status !== "GRACE" && cls.billing_status !== "LOCKED") {
        await client.query("ROLLBACK");
        continue;
      }

      const startDate = toDateStr(cls.start_date || todayVN(new Date()));
      const nextChargeAt = toDateStr(cls.next_charge_at || startDate);
      const period = monthsBetween(startDate, nextChargeAt);

      const stuRes = await client.query(
        "SELECT student_id FROM enrollments WHERE class_id = $1 ORDER BY student_id ASC",
        [cls.id]
      );
      const studentIds = stuRes.rows.map((r: any) => r.student_id);
      // Học sinh đã trả kỳ này qua ENROLL (vd vào lớp sau khi xác minh/chuyển dữ liệu nhưng trước lần
      // cron đầu) không bị trừ lần nữa. student_ids vẫn lưu đủ sĩ số để nhận diện "đã trả kỳ" (BR-W02).
      const paidRes = await client.query(
        `SELECT student_id FROM slot_ledger WHERE class_id = $1 AND reason = 'ENROLL' AND period = $2`,
        [cls.id, period]
      );
      const paid = new Set(paidRes.rows.map((r: any) => r.student_id));
      const studentCount = studentIds.filter((id: string) => !paid.has(id)).length;

      if (studentCount === 0) {
        const nextNext = addMonths(startDate, period + 1);
        await client.query(
          `UPDATE classes
           SET billing_status = 'ACTIVE',
               billing_period = $1,
               next_charge_at = $2,
               grace_until = NULL
           WHERE id = $3`,
          [period, nextNext, cls.id]
        );
        await client.query("COMMIT");
        reopenedCount++;
        continue;
      }

      const deltaRes = await applyDelta(client, {
        teacherId,
        delta: -studentCount,
        reason: "CYCLE",
        classId: cls.id,
        period,
        studentCount,
        studentIds,
      });

      if (deltaRes.ok) {
        const nextNext = addMonths(startDate, period + 1);
        await client.query(
          `UPDATE classes
           SET billing_status = 'ACTIVE',
               billing_period = $1,
               next_charge_at = $2,
               grace_until = NULL
           WHERE id = $3`,
          [period, nextNext, cls.id]
        );
        await client.query("COMMIT");
        reopenedCount++;

        notifToSend = {
          userId: teacherId,
          type: "SLOT_CHARGED",
          title: "Đã trừ slot kỳ mới",
          body: `Đã trừ ${studentCount} slot cho lớp ${cls.name} (kỳ ${period}). Lớp đã hoạt động bình thường trở lại.`,
          link: "/teacher/slots",
          refId: `${cls.id}:${period}`,
        };
      } else {
        await client.query("ROLLBACK");
      }
    } catch (err) {
      await client.query("ROLLBACK").catch(() => {});
      console.error(`retryOverdueClasses error on class ${c.id}:`, err);
    } finally {
      client.release();
    }

    if (notifToSend) {
      await createNotification(notifToSend).catch(() => {});
    }
  }

  return reopenedCount;
}

/**
 * Admin điều chỉnh thủ công số dư ví của giáo viên (ADMIN_ADJUST).
 */
export async function adjustBalance(a: {
  teacherId: string;
  delta: number;
  note: string;
  createdBy: string;
}): Promise<
  | { ok: true; balance: number }
  | { ok: false; status: 400 | 409; error: string; code?: string }
> {
  const cleanNote = typeof a.note === "string" ? a.note.trim() : "";
  if (!cleanNote || cleanNote.length > 500) {
    return {
      ok: false,
      status: 400,
      error: "Lý do điều chỉnh không được để trống và không quá 500 ký tự.",
    };
  }

  if (
    typeof a.delta !== "number" ||
    !Number.isInteger(a.delta) ||
    a.delta === 0 ||
    Math.abs(a.delta) > 100000
  ) {
    return {
      ok: false,
      status: 400,
      error: "Số lượng slot phải là số nguyên khác 0 và không quá 100.000.",
    };
  }

  const pool = getPgPool();
  const client = await pool.connect();
  let newBal: number | null = null;
  let failResult: { ok: false; status: 400 | 409; error: string } | null = null;

  try {
    await client.query("BEGIN");

    const deltaRes = await applyDelta(client, {
      teacherId: a.teacherId,
      delta: a.delta,
      reason: "ADMIN_ADJUST",
      note: cleanNote,
      createdBy: a.createdBy,
    });

    if (!deltaRes.ok) {
      await client.query("ROLLBACK");
      if (deltaRes.code === "INSUFFICIENT") {
        failResult = {
          ok: false,
          status: 409,
          error: "Số dư ví không đủ để thực hiện thao tác trừ.",
        };
      } else {
        failResult = { ok: false, status: 400, error: "Không thể điều chỉnh số dư." };
      }
    } else {
      await client.query("COMMIT");
      newBal = deltaRes.balance;
    }
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    throw err;
  } finally {
    client.release();
  }

  if (failResult) {
    return failResult;
  }

  // Sau khi ĐÃ release client:
  if (a.delta > 0) {
    await retryOverdueClasses(a.teacherId).catch((err) => {
      console.warn("retryOverdueClasses error after adjustBalance:", err);
    });
  }

  return { ok: true, balance: newBal! };
}
