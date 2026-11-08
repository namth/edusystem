// TASK-052 — Lõi ví slot học sinh-tháng: migration 018, lib/slot-wallet, cron, ghi danh trừ ví
// File do kỹ sư kiểm thử chéo viết, dùng làm hợp đồng nghiệm thu — người code không sửa file này.
/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from "vitest";
import fs from "fs";
import path from "path";
import { createFakePg } from "./helpers/pg-fake";

const h = vi.hoisted(() => {
  process.env.JWT_SECRET = "test_secret_for_vitest_only_0123456789abcdef";
  process.env.CRON_SECRET = "test_cron_secret_1234567890abcdef";
  return { token: undefined as string | undefined, pg: null as any };
});

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (n: string) => (n === "auth_token" && h.token ? { value: h.token } : undefined),
    set: () => {},
  }),
  headers: async () => new Headers(),
}));

let poolLock = Promise.resolve();
vi.mock("@/lib/db-pg", () => ({
  queryPg: (sql: string, params?: unknown[]) => h.pg.queryPg(sql, params),
  getPgPool: () => ({
    connect: async () => {
      let releaseLock: () => void;
      const nextLock = new Promise<void>((r) => (releaseLock = r));
      const prevLock = poolLock;
      poolLock = prevLock.then(() => nextLock);
      await prevLock;
      return {
        query: (s: string, p?: unknown[]) => h.pg.queryPg(s, p),
        release: () => {
          releaseLock();
        },
      };
    },
  }),
  ensureSchema: async () => {},
}));

vi.mock("@/lib/neo4j", () => ({
  syncStudentEnrolledInClass: async () => {},
  syncTeacherManagesClass: async () => {},
  syncCourseExam: async () => {},
  runCypherQuery: async () => [],
}));

vi.mock("@/lib/redis-queue", () => ({
  pushRedisStreamEvent: async () => {},
  pushGradingEvent: async () => {},
}));

vi.mock("@/lib/mailer", () => ({
  appBaseUrl: () => "http://localhost:3000",
  isMailerConfigured: () => true,
  sendEmail: async () => ({ success: true }),
}));

import { signJwtToken } from "@/lib/jwt";

async function loginAs(role: "ADMIN" | "TEACHER" | "STUDENT" | null, userId?: string) {
  h.token = role ? await signJwtToken({ userId: userId!, email: `${userId}@x.vn`, role }) : undefined;
}

const req = (method: string, url: string, body?: unknown, headers: Record<string, string> = {}) =>
  new Request(`http://localhost${url}`, {
    method,
    headers: { "Content-Type": "application/json", ...headers },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

const ctx = <T extends Record<string, string>>(p: T) => ({ params: Promise.resolve(p) });
const rows = async (sql: string, p: unknown[] = []) => (await h.pg.db.query(sql, p)).rows as any[];

// Dynamic loaders to avoid tsc module-resolution failure before code is written
async function loadSlotWallet() {
  // @ts-ignore
  return await import("@/lib/slot-wallet");
}

async function loadCronRoute() {
  // @ts-ignore
  return await import("@/app/api/cron/slot-billing/route");
}

async function loadTeacherVerifyRoute() {
  // @ts-ignore
  return await import("@/app/api/admin/teachers/[id]/verify/route");
}

async function loadClassesRoute() {
  // @ts-ignore
  return await import("@/app/api/teacher/classes/route");
}

async function loadClassStudentsRoute() {
  // @ts-ignore
  return await import("@/app/api/teacher/classes/[classId]/students/route");
}

async function loadSlotOrders() {
  // @ts-ignore
  return await import("@/lib/slot-orders");
}

async function loadStudentSlots() {
  // @ts-ignore
  return await import("@/lib/student-slots");
}

beforeEach(async () => {
  h.token = undefined;
  process.env.CRON_SECRET = "test_cron_secret_1234567890abcdef";
  delete process.env.SLOT_UNIT_PRICE_VND;

  h.pg = await createFakePg([
    "db-migration-004-enrollments-assignments.sql",
    "db-migration-005-system-settings.sql",
    "db-migration-010-notifications.sql",
    "db-migration-013-onboarding.sql",
  ]);

  await h.pg.db.exec(`
    ALTER TABLE users ADD COLUMN IF NOT EXISTS slot_limit INT DEFAULT 250;
    CREATE TABLE IF NOT EXISTS slot_requests (
      id VARCHAR(50) PRIMARY KEY,
      teacher_id VARCHAR(50) NOT NULL,
      teacher_name VARCHAR(100) NOT NULL,
      teacher_email VARCHAR(100) NOT NULL,
      requested_slots INTEGER NOT NULL,
      total_cost NUMERIC(12,2) NOT NULL,
      status VARCHAR(20) DEFAULT 'PENDING',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);
  await h.pg.db.exec(fs.readFileSync(path.resolve(__dirname, "../docs/db-migration-016-slot-orders.sql"), "utf8"));

  const mig018Path = path.resolve(__dirname, "../docs/db-migration-018-slot-wallet.sql");
  if (fs.existsSync(mig018Path)) {
    await h.pg.db.exec(fs.readFileSync(mig018Path, "utf8"));
  } else {
    await h.pg.db.exec(`
      ALTER TABLE users   ADD COLUMN IF NOT EXISTS slot_balance INT NOT NULL DEFAULT 0;
      ALTER TABLE classes ADD COLUMN IF NOT EXISTS start_date DATE;
      ALTER TABLE classes ADD COLUMN IF NOT EXISTS ended_at TIMESTAMPTZ;
      ALTER TABLE classes ADD COLUMN IF NOT EXISTS billing_status VARCHAR(10) NOT NULL DEFAULT 'ACTIVE';
      ALTER TABLE classes ADD COLUMN IF NOT EXISTS grace_until TIMESTAMPTZ;
      ALTER TABLE classes ADD COLUMN IF NOT EXISTS next_charge_at DATE;
      ALTER TABLE classes ADD COLUMN IF NOT EXISTS billing_period INT NOT NULL DEFAULT 0;

      CREATE TABLE IF NOT EXISTS slot_ledger (
        id VARCHAR(50) PRIMARY KEY,
        teacher_id VARCHAR(50) NOT NULL,
        delta INT NOT NULL,
        balance_after INT NOT NULL,
        reason VARCHAR(20) NOT NULL,
        class_id VARCHAR(50), student_id VARCHAR(50), order_id VARCHAR(50),
        period INT,
        student_count INT,
        student_ids TEXT[],
        note TEXT, created_by VARCHAR(50),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_slot_ledger_teacher ON slot_ledger (teacher_id, created_at DESC);
      CREATE UNIQUE INDEX IF NOT EXISTS uq_slot_ledger_cycle  ON slot_ledger (class_id, period) WHERE reason = 'CYCLE';
      CREATE UNIQUE INDEX IF NOT EXISTS uq_slot_ledger_enroll ON slot_ledger (class_id, student_id, period) WHERE reason = 'ENROLL';
      CREATE UNIQUE INDEX IF NOT EXISTS uq_slot_ledger_order  ON slot_ledger (order_id) WHERE reason = 'PURCHASE';
    `);
  }

  await h.pg.db.exec(`
    INSERT INTO users (id, name, email, role, teacher_status, slot_balance) VALUES
      ('admin1', 'Admin', 'admin@x.vn', 'ADMIN', NULL, 0),
      ('t1', 'Cô Lan', 't1@x.vn', 'TEACHER', 'VERIFIED', 0),
      ('t2', 'Thầy Minh', 't2@x.vn', 'TEACHER', 'VERIFIED', 0),
      ('t_trial', 'GV Thử', 'trial@x.vn', 'TEACHER', 'TRIAL', 0),
      ('t_rej', 'GV Từ Chối', 'rej@x.vn', 'TEACHER', 'REJECTED', 0),
      ('s1', 'Học sinh 1', 's1@x.vn', 'STUDENT', NULL, 0),
      ('s2', 'Học sinh 2', 's2@x.vn', 'STUDENT', NULL, 0),
      ('s3', 'Học sinh 3', 's3@x.vn', 'STUDENT', NULL, 0),
      ('s4', 'Học sinh 4', 's4@x.vn', 'STUDENT', NULL, 0),
      ('s5', 'Học sinh 5', 's5@x.vn', 'STUDENT', NULL, 0);

    UPDATE system_settings SET value='{"unit_price_vnd":12000}'::jsonb WHERE key='slot_pricing';
  `);
});

// ─────────────────────────────────────────────────────────────────────────────
// 1. Tiện ích ngày tháng, chu kỳ & múi giờ
// ─────────────────────────────────────────────────────────────────────────────
describe("lib/slot-wallet.ts — tiện ích thời gian", () => {
  it("TC-W06: addMonths xử lý đúng ngày cuối tháng, năm nhuận, qua năm", async () => {
    const { addMonths } = await loadSlotWallet();

    // Khai giảng 31/01/2026 (năm thường) -> kỳ tới 28/02/2026, rồi 31/03/2026
    expect(addMonths("2026-01-31", 1)).toBe("2026-02-28");
    expect(addMonths("2026-01-31", 2)).toBe("2026-03-31");

    // Khai giảng 31/01/2024 (năm nhuận) -> 29/02/2024
    expect(addMonths("2024-01-31", 1)).toBe("2024-02-29");

    // Tháng 31 ngày sang tháng 30 ngày
    expect(addMonths("2026-03-31", 1)).toBe("2026-04-30");
    expect(addMonths("2026-05-31", 1)).toBe("2026-06-30");
    expect(addMonths("2026-08-31", 1)).toBe("2026-09-30");
    expect(addMonths("2026-10-31", 1)).toBe("2026-11-30");

    // Chuyển năm
    expect(addMonths("2026-12-31", 1)).toBe("2027-01-31");

    // Ngày giữa tháng bình thường
    expect(addMonths("2026-04-15", 1)).toBe("2026-05-15");
  });

  it("todayVN trả về ngày YYYY-MM-DD theo múi giờ Asia/Ho_Chi_Minh (UTC+7)", async () => {
    const { todayVN } = await loadSlotWallet();

    // 2026-10-31 16:59:59 UTC = 2026-10-31 23:59:59 VN -> 2026-10-31
    expect(todayVN(new Date("2026-10-31T16:59:59.000Z"))).toBe("2026-10-31");

    // 2026-10-31 17:00:00 UTC = 2026-11-01 00:00:00 VN -> 2026-11-01
    expect(todayVN(new Date("2026-10-31T17:00:00.000Z"))).toBe("2026-11-01");

    // Ban ngày VN
    expect(todayVN(new Date("2026-11-15T03:00:00.000Z"))).toBe("2026-11-15");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. getBalance & applyDelta (Lõi cập nhật số dư & ghi sổ)
// ─────────────────────────────────────────────────────────────────────────────
describe("lib/slot-wallet.ts — getBalance & applyDelta (BR-W03)", () => {
  it("getBalance đọc đúng slot_balance của người dùng", async () => {
    const { getBalance } = await loadSlotWallet();
    expect(await getBalance("t1")).toBe(0);

    await h.pg.db.query("UPDATE users SET slot_balance = 15 WHERE id = 't1'");
    expect(await getBalance("t1")).toBe(15);

    expect(await getBalance("non_existent")).toBe(0);
  });

  it("applyDelta cộng số dư (PURCHASE), ghi đúng balance_after và dòng ledger", async () => {
    const { applyDelta, getBalance } = await loadSlotWallet();

    const res = await applyDelta(null, {
      teacherId: "t1",
      delta: 10,
      reason: "PURCHASE",
      orderId: "ord_101",
    });

    expect(res).toEqual({ ok: true, balance: 10 });
    expect(await getBalance("t1")).toBe(10);

    const ledger = await rows("SELECT * FROM slot_ledger WHERE teacher_id = 't1'");
    expect(ledger).toHaveLength(1);
    expect(ledger[0].delta).toBe(10);
    expect(ledger[0].balance_after).toBe(10);
    expect(ledger[0].reason).toBe("PURCHASE");
    expect(ledger[0].order_id).toBe("ord_101");
  });

  it("applyDelta trừ số dư thành công và balance_after khớp users.slot_balance", async () => {
    const { applyDelta } = await loadSlotWallet();
    await h.pg.db.query("UPDATE users SET slot_balance = 8 WHERE id = 't1'");

    const res = await applyDelta(null, {
      teacherId: "t1",
      delta: -3,
      reason: "ENROLL",
      classId: "c1",
      studentId: "s1",
      period: 0,
    });

    expect(res).toEqual({ ok: true, balance: 5 });

    const user = (await rows("SELECT slot_balance FROM users WHERE id = 't1'"))[0];
    expect(user.slot_balance).toBe(5);

    const ledger = await rows("SELECT * FROM slot_ledger WHERE teacher_id = 't1'");
    expect(ledger).toHaveLength(1);
    expect(ledger[0].delta).toBe(-3);
    expect(ledger[0].balance_after).toBe(user.slot_balance);
  });

  it("applyDelta trừ quá số dư -> trả về INSUFFICIENT, không ghi ledger, không âm số dư", async () => {
    const { applyDelta } = await loadSlotWallet();
    await h.pg.db.query("UPDATE users SET slot_balance = 2 WHERE id = 't1'");

    const res = await applyDelta(null, {
      teacherId: "t1",
      delta: -5,
      reason: "ENROLL",
      classId: "c1",
      studentId: "s1",
      period: 0,
    });

    expect(res).toEqual({ ok: false, code: "INSUFFICIENT" });

    const user = (await rows("SELECT slot_balance FROM users WHERE id = 't1'"))[0];
    expect(user.slot_balance).toBe(2);

    const ledger = await rows("SELECT * FROM slot_ledger WHERE teacher_id = 't1'");
    expect(ledger).toHaveLength(0);
  });

  it("applyDelta bắt lỗi unique constraint (23505) và trả về code DUPLICATE mà không ném", async () => {
    const { applyDelta } = await loadSlotWallet();
    await h.pg.db.query("UPDATE users SET slot_balance = 20 WHERE id = 't1'");

    // 1. CYCLE unique (class_id, period)
    const c1 = await applyDelta(null, {
      teacherId: "t1",
      delta: -2,
      reason: "CYCLE",
      classId: "c1",
      period: 1,
      studentCount: 2,
    });
    expect(c1.ok).toBe(true);

    const c1Dup = await applyDelta(null, {
      teacherId: "t1",
      delta: -2,
      reason: "CYCLE",
      classId: "c1",
      period: 1,
      studentCount: 2,
    });
    expect(c1Dup).toEqual({ ok: false, code: "DUPLICATE" });

    // 2. ENROLL unique (class_id, student_id, period)
    const e1 = await applyDelta(null, {
      teacherId: "t1",
      delta: -1,
      reason: "ENROLL",
      classId: "c1",
      studentId: "s1",
      period: 0,
    });
    expect(e1.ok).toBe(true);

    const e1Dup = await applyDelta(null, {
      teacherId: "t1",
      delta: -1,
      reason: "ENROLL",
      classId: "c1",
      studentId: "s1",
      period: 0,
    });
    expect(e1Dup).toEqual({ ok: false, code: "DUPLICATE" });

    // 3. PURCHASE unique (order_id)
    const p1 = await applyDelta(null, {
      teacherId: "t1",
      delta: 5,
      reason: "PURCHASE",
      orderId: "ord_dup_1",
    });
    expect(p1.ok).toBe(true);

    const p1Dup = await applyDelta(null, {
      teacherId: "t1",
      delta: 5,
      reason: "PURCHASE",
      orderId: "ord_dup_1",
    });
    expect(p1Dup).toEqual({ ok: false, code: "DUPLICATE" });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. chargeEnrollment & Ghi danh trừ ví
// ─────────────────────────────────────────────────────────────────────────────
describe("lib/slot-wallet.ts — chargeEnrollment (BR-W01, BR-W02, BR-W06, BR-W08..10)", () => {
  beforeEach(async () => {
    await h.pg.db.exec(`
      INSERT INTO classes (id, name, code, teacher_id, max_slots, start_date, billing_status, billing_period)
      VALUES
        ('c1', 'Lớp 1', 'C11111', 't1', 30, '2026-02-01', 'ACTIVE', 0),
        ('c2', 'Lớp 2', 'C22222', 't1', 30, '2026-02-01', 'ACTIVE', 0),
        ('cA', 'Lớp Admin', 'CADM01', 'admin1', 30, '2026-02-01', 'ACTIVE', 0),
        ('c_trial', 'Lớp Trial', 'CTRI01', 't_trial', 3, '2026-02-01', 'ACTIVE', 0),
        ('c_locked', 'Lớp Khóa', 'CLOCK1', 't1', 30, '2026-02-01', 'LOCKED', 0),
        ('c_ended', 'Lớp Kết Thúc', 'CEND01', 't1', 30, '2026-02-01', 'ENDED', 0);
    `);
  });

  it("TC-W01: Thêm HS khi số dư 1 -> trừ 1, charged=true; số dư 0 -> 409 NO_SLOT, không ghi ledger", async () => {
    const { chargeEnrollment, getBalance } = await loadSlotWallet();
    await h.pg.db.query("UPDATE users SET slot_balance = 1 WHERE id = 't1'");

    // Thêm HS s1 -> thành công, trừ 1 slot
    const r1 = await chargeEnrollment(null, { classId: "c1", studentId: "s1" });
    expect(r1).toEqual({ ok: true, charged: true });
    expect(await getBalance("t1")).toBe(0);

    const ledger1 = await rows("SELECT * FROM slot_ledger WHERE teacher_id = 't1'");
    expect(ledger1).toHaveLength(1);
    expect(ledger1[0].reason).toBe("ENROLL");
    expect(ledger1[0].delta).toBe(-1);
    expect(ledger1[0].balance_after).toBe(0);
    expect(ledger1[0].student_id).toBe("s1");
    expect(ledger1[0].class_id).toBe("c1");

    // Thêm HS s2 khi số dư 0 -> 409 NO_SLOT
    const r2 = await chargeEnrollment(null, { classId: "c1", studentId: "s2" });
    expect(r2.ok).toBe(false);
    if (!r2.ok) {
      expect(r2.status).toBe(409);
      expect(r2.code).toBe("NO_SLOT");
      expect(r2.error).toMatch(/không đủ slot/i);
    }
    expect(await getBalance("t1")).toBe(0);

    const ledger2 = await rows("SELECT * FROM slot_ledger WHERE teacher_id = 't1'");
    expect(ledger2).toHaveLength(1); // không có dòng mới
  });

  it("TC-W02: Rời rồi vào lại cùng lớp trong cùng kỳ -> không trừ lại; kỳ sau vào lại -> trừ", async () => {
    const { chargeEnrollment, getBalance } = await loadSlotWallet();
    await h.pg.db.query("UPDATE users SET slot_balance = 5 WHERE id = 't1'");

    // Kỳ 0: Ghi danh s1 lần đầu -> charged = true
    const r1 = await chargeEnrollment(null, { classId: "c1", studentId: "s1" });
    expect(r1).toEqual({ ok: true, charged: true });
    expect(await getBalance("t1")).toBe(4);

    // Kỳ 0: Rời rồi vào lại cùng lớp -> charged = false (không trừ lại)
    const r2 = await chargeEnrollment(null, { classId: "c1", studentId: "s1" });
    expect(r2).toEqual({ ok: true, charged: false });
    expect(await getBalance("t1")).toBe(4);

    // Kỳ 1: Lớp sang kỳ mới
    await h.pg.db.query("UPDATE classes SET billing_period = 1 WHERE id = 'c1'");

    // Vào lại ở kỳ 1 -> bị trừ slot cho kỳ 1
    const r3 = await chargeEnrollment(null, { classId: "c1", studentId: "s1" });
    expect(r3).toEqual({ ok: true, charged: true });
    expect(await getBalance("t1")).toBe(3);

    // Kiểm tra ca học sinh đã trả qua dòng CYCLE kỳ 1 (có trong student_ids)
    await h.pg.db.exec(`
      INSERT INTO slot_ledger (id, teacher_id, delta, balance_after, reason, class_id, period, student_count, student_ids)
      VALUES ('led_cyc_1', 't1', -2, 1, 'CYCLE', 'c1', 1, 2, ARRAY['s2', 's3'])
    `);

    // s2 đã được tính trong CYCLE kỳ 1 -> vào lớp không bị trừ lại
    const r4 = await chargeEnrollment(null, { classId: "c1", studentId: "s2" });
    expect(r4).toEqual({ ok: true, charged: false });
    expect(await getBalance("t1")).toBe(3);
  });

  it("TC-W03: HS học 2 lớp của cùng một GV -> tốn 2 slot (mỗi lớp 1 slot)", async () => {
    const { chargeEnrollment, getBalance } = await loadSlotWallet();
    await h.pg.db.query("UPDATE users SET slot_balance = 5 WHERE id = 't1'");

    const r1 = await chargeEnrollment(null, { classId: "c1", studentId: "s1" });
    expect(r1).toEqual({ ok: true, charged: true });
    expect(await getBalance("t1")).toBe(4);

    const r2 = await chargeEnrollment(null, { classId: "c2", studentId: "s1" });
    expect(r2).toEqual({ ok: true, charged: true });
    expect(await getBalance("t1")).toBe(3);

    const ledger = await rows("SELECT * FROM slot_ledger WHERE teacher_id = 't1' ORDER BY created_at");
    expect(ledger).toHaveLength(2);
    expect(ledger[0].class_id).toBe("c1");
    expect(ledger[1].class_id).toBe("c2");
  });

  it("TC-W04: Hai request ghi danh đồng thời khi số dư 1 -> đúng 1 thành công, số dư về 0", async () => {
    const { chargeEnrollment, getBalance } = await loadSlotWallet();
    await h.pg.db.query("UPDATE users SET slot_balance = 1 WHERE id = 't1'");

    const [resA, resB] = await Promise.all([
      chargeEnrollment(null, { classId: "c1", studentId: "s1" }),
      chargeEnrollment(null, { classId: "c1", studentId: "s2" }),
    ]);

    const successes = [resA, resB].filter((r) => r.ok && (r as any).charged === true);
    const failures = [resA, resB].filter((r) => !r.ok && (r as any).code === "NO_SLOT");

    expect(successes).toHaveLength(1);
    expect(failures).toHaveLength(1);
    expect(await getBalance("t1")).toBe(0);

    const ledger = await rows("SELECT * FROM slot_ledger WHERE teacher_id = 't1'");
    expect(ledger).toHaveLength(1);
  });

  it("TC-W17: Lớp có chủ là ADMIN không tính phí ghi danh", async () => {
    const { chargeEnrollment, getBalance } = await loadSlotWallet();
    expect(await getBalance("admin1")).toBe(0);

    const res = await chargeEnrollment(null, { classId: "cA", studentId: "s1" });
    expect(res).toEqual({ ok: true, charged: false });
    expect(await getBalance("admin1")).toBe(0);

    const ledger = await rows("SELECT * FROM slot_ledger WHERE teacher_id = 'admin1'");
    expect(ledger).toHaveLength(0);
  });

  it("Lớp của giáo viên TRIAL hoặc REJECTED không tính phí ghi danh", async () => {
    const { chargeEnrollment, getBalance } = await loadSlotWallet();
    expect(await getBalance("t_trial")).toBe(0);

    const resTrial = await chargeEnrollment(null, { classId: "c_trial", studentId: "s1" });
    expect(resTrial).toEqual({ ok: true, charged: false });
    expect(await getBalance("t_trial")).toBe(0);

    await h.pg.db.query("UPDATE users SET teacher_status = 'REJECTED' WHERE id = 't_trial'");
    const resRej = await chargeEnrollment(null, { classId: "c_trial", studentId: "s2" });
    expect(resRej).toEqual({ ok: true, charged: false });
  });

  it("Lớp LOCKED trả về 409 CLASS_LOCKED, lớp ENDED trả về 409 CLASS_ENDED", async () => {
    const { chargeEnrollment } = await loadSlotWallet();
    await h.pg.db.query("UPDATE users SET slot_balance = 10 WHERE id = 't1'");

    const resLocked = await chargeEnrollment(null, { classId: "c_locked", studentId: "s1" });
    expect(resLocked.ok).toBe(false);
    if (!resLocked.ok) {
      expect(resLocked.status).toBe(409);
      expect(resLocked.code).toBe("CLASS_LOCKED");
    }

    const resEnded = await chargeEnrollment(null, { classId: "c_ended", studentId: "s1" });
    expect(resEnded.ok).toBe(false);
    if (!resEnded.ok) {
      expect(resEnded.status).toBe(409);
      expect(resEnded.code).toBe("CLASS_ENDED");
    }
  });

  it("Ghi danh lỗi giữa chừng (lớp đủ max_slots) -> rollback: số dư không đổi, không có ledger", async () => {
    const { getBalance } = await loadSlotWallet();
    const { POST: addStudentPost } = await loadClassStudentsRoute();
    await loginAs("TEACHER", "t1");

    await h.pg.db.query("UPDATE users SET slot_balance = 5 WHERE id = 't1'");
    await h.pg.db.query("UPDATE classes SET max_slots = 1 WHERE id = 'c1'");
    await h.pg.db.query("INSERT INTO enrollments (id, student_id, class_id) VALUES ('enr_s1', 's1', 'c1')");

    // Thêm học sinh s2 qua API route khi lớp đã đạt max_slots (1/1)
    const res = await addStudentPost(
      req("POST", "/api/teacher/classes/c1/students", { name: "Học sinh 2", email: "s2@x.vn" }),
      ctx({ classId: "c1" })
    );

    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.success).toBe(false);

    // Số dư phải giữ nguyên 5, không có dòng ledger nào
    expect(await getBalance("t1")).toBe(5);
    const ledger = await rows("SELECT * FROM slot_ledger WHERE teacher_id = 't1'");
    expect(ledger).toHaveLength(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. runBillingCycle & Cron định kỳ
// ─────────────────────────────────────────────────────────────────────────────
describe("lib/slot-wallet.ts — runBillingCycle (BR-W04, BR-W05, BR-W12)", () => {
  beforeEach(async () => {
    await h.pg.db.exec(`
      INSERT INTO classes (id, name, code, teacher_id, max_slots, start_date, next_charge_at, billing_period, billing_status)
      VALUES
        ('c_act', 'Lớp Đủ Tiền', 'CACT01', 't1', 30, '2026-01-15', '2026-02-15', 0, 'ACTIVE'),
        ('c_empty', 'Lớp Rỗng', 'CEMP01', 't1', 30, '2026-01-15', '2026-02-15', 0, 'ACTIVE'),
        ('c_lack', 'Lớp Thiếu Tiền', 'CLAK01', 't2', 30, '2026-01-15', '2026-02-15', 0, 'ACTIVE'),
        ('c_admin', 'Lớp Admin', 'CADM02', 'admin1', 30, '2026-01-15', '2026-02-15', 0, 'ACTIVE'),
        ('c_trial', 'Lớp Trial', 'CTRI02', 't_trial', 3, '2026-01-15', NULL, 0, 'ACTIVE'),
        ('c_end', 'Lớp Đã Kết Thúc', 'CEND02', 't1', 30, '2026-01-15', '2026-02-15', 0, 'ENDED');

      INSERT INTO enrollments (id, student_id, class_id) VALUES
        ('e_act_1', 's1', 'c_act'),
        ('e_act_2', 's2', 'c_act'),
        ('e_act_3', 's3', 'c_act'),
        ('e_lack_1', 's1', 'c_lack'),
        ('e_lack_2', 's2', 'c_lack'),
        ('e_lack_3', 's3', 'c_lack');
    `);
  });

  it("CYCLE không trừ lại học sinh đã trả ENROLL cho đúng kỳ đó (không trừ 2 lần), student_ids vẫn đủ sĩ số", async () => {
    const { runBillingCycle, getBalance } = await loadSlotWallet();
    await h.pg.db.query("UPDATE users SET slot_balance = 10 WHERE id = 't1'");
    await h.pg.db.query(
      `INSERT INTO slot_ledger (id, teacher_id, delta, balance_after, reason, class_id, student_id, period)
       VALUES ('led_pre', 't1', -1, 10, 'ENROLL', 'c_act', 's1', 1)`
    );
    await runBillingCycle(new Date("2026-02-15T08:00:00+07:00"));
    expect(await getBalance("t1")).toBe(8); // chỉ trừ s2, s3
    const cyc = await rows("SELECT * FROM slot_ledger WHERE class_id = 'c_act' AND reason = 'CYCLE'");
    expect(cyc).toHaveLength(1);
    expect(cyc[0].delta).toBe(-2);
    expect(cyc[0].student_ids).toEqual(expect.arrayContaining(["s1", "s2", "s3"]));
  });

  it("TC-W05: Đến kỳ, đủ slot -> 1 dòng CYCLE, billing_period +1, next_charge_at +1 tháng; chạy lại cùng ngày -> không trừ thêm", async () => {
    const { runBillingCycle, getBalance } = await loadSlotWallet();
    await h.pg.db.query("UPDATE users SET slot_balance = 10 WHERE id = 't1'");
    await h.pg.db.query("UPDATE users SET slot_balance = 10 WHERE id = 't2'");

    const simNow = new Date("2026-02-15T08:00:00+07:00");
    const r1 = await runBillingCycle(simNow);

    expect(r1.charged).toBeGreaterThanOrEqual(1);

    // t1 có c_act (3 HS): 10 - 3 = 7 slot
    expect(await getBalance("t1")).toBe(7);

    const cAct = (await rows("SELECT id, teacher_id, billing_status, billing_period, grace_until, ended_at, start_date::text AS start_date, next_charge_at::text AS next_charge_at FROM classes WHERE id = 'c_act'"))[0];
    expect(cAct.billing_period).toBe(1);
    expect(cAct.next_charge_at).toBe("2026-03-15");
    expect(cAct.billing_status).toBe("ACTIVE");
    expect(cAct.grace_until).toBeNull();

    // Dòng ledger CYCLE
    const ledger = await rows("SELECT * FROM slot_ledger WHERE class_id = 'c_act' AND reason = 'CYCLE'");
    expect(ledger).toHaveLength(1);
    expect(ledger[0].delta).toBe(-3);
    expect(ledger[0].student_count).toBe(3);
    expect(ledger[0].period).toBe(1);
    expect(ledger[0].balance_after).toBe(7);
    expect(ledger[0].student_ids).toEqual(expect.arrayContaining(["s1", "s2", "s3"]));

    // Thông báo SLOT_CHARGED
    const notifs = await rows("SELECT * FROM notifications WHERE user_id = 't1' AND type = 'SLOT_CHARGED'");
    expect(notifs).toHaveLength(1);
    expect(notifs[0].ref_id).toBe("c_act:1");

    // Chạy lại cùng ngày -> Idempotent: không trừ thêm slot
    const r2 = await runBillingCycle(simNow);
    expect(await getBalance("t1")).toBe(7);

    const ledgerAfter = await rows("SELECT * FROM slot_ledger WHERE class_id = 'c_act' AND reason = 'CYCLE'");
    expect(ledgerAfter).toHaveLength(1);
  });

  it("Sĩ số 0 khi đến kỳ -> không trừ slot nhưng vẫn sang kỳ mới (billing_period +1, next_charge_at +1 tháng)", async () => {
    const { runBillingCycle, getBalance } = await loadSlotWallet();
    await h.pg.db.query("UPDATE users SET slot_balance = 5 WHERE id = 't1'");

    const simNow = new Date("2026-02-15T08:00:00+07:00");
    await runBillingCycle(simNow);

    expect(await getBalance("t1")).toBe(5 - 3); // chỉ bị trừ 3 bởi c_act, c_empty không trừ

    const cEmpty = (await rows("SELECT id, teacher_id, billing_status, billing_period, grace_until, ended_at, start_date::text AS start_date, next_charge_at::text AS next_charge_at FROM classes WHERE id = 'c_empty'"))[0];
    expect(cEmpty.billing_period).toBe(1);
    expect(cEmpty.next_charge_at).toBe("2026-03-15");
    expect(cEmpty.billing_status).toBe("ACTIVE");

    const ledgerEmpty = await rows("SELECT * FROM slot_ledger WHERE class_id = 'c_empty'");
    expect(ledgerEmpty).toHaveLength(0);
  });

  it("TC-W07: Thiếu slot -> GRACE + 7 ngày + báo SLOT_GRACE; quá hạn ngày 8 -> LOCKED + báo CLASS_LOCKED", async () => {
    const { runBillingCycle, getBalance } = await loadSlotWallet();
    // t2 chỉ có 1 slot, c_lack cần 3 slot
    await h.pg.db.query("UPDATE users SET slot_balance = 1 WHERE id = 't2'");

    // 1. Ngày đến kỳ (15/02): Thiếu slot -> GRACE
    const day1 = new Date("2026-02-15T08:00:00+07:00");
    const r1 = await runBillingCycle(day1);
    expect(r1.grace).toBeGreaterThanOrEqual(1);

    expect(await getBalance("t2")).toBe(1); // không bị trừ

    const cGrace = (await rows("SELECT id, teacher_id, billing_status, billing_period, grace_until, ended_at, start_date::text AS start_date, next_charge_at::text AS next_charge_at FROM classes WHERE id = 'c_lack'"))[0];
    expect(cGrace.billing_status).toBe("GRACE");
    expect(cGrace.grace_until).not.toBeNull();

    const notifGrace = await rows("SELECT * FROM notifications WHERE user_id = 't2' AND type = 'SLOT_GRACE'");
    expect(notifGrace).toHaveLength(1);
    expect(notifGrace[0].ref_id).toBe("c_lack:1");

    // 2. Ngày thứ 3 trong ân hạn (18/02): Vẫn thiếu -> vẫn ở GRACE
    const day3 = new Date("2026-02-18T08:00:00+07:00");
    await runBillingCycle(day3);
    const cGraceStill = (await rows("SELECT id, teacher_id, billing_status, billing_period, grace_until, ended_at, start_date::text AS start_date, next_charge_at::text AS next_charge_at FROM classes WHERE id = 'c_lack'"))[0];
    expect(cGraceStill.billing_status).toBe("GRACE");

    // 3. Ngày thứ 8 (23/02 > grace_until): Vẫn thiếu -> chuyển sang LOCKED
    const day8 = new Date("2026-02-23T09:00:00+07:00");
    const r3 = await runBillingCycle(day8);
    expect(r3.locked).toBeGreaterThanOrEqual(1);

    const cLocked = (await rows("SELECT id, teacher_id, billing_status, billing_period, grace_until, ended_at, start_date::text AS start_date, next_charge_at::text AS next_charge_at FROM classes WHERE id = 'c_lack'"))[0];
    expect(cLocked.billing_status).toBe("LOCKED");

    const notifLocked = await rows("SELECT * FROM notifications WHERE user_id = 't2' AND type = 'CLASS_LOCKED'");
    expect(notifLocked).toHaveLength(1);
    expect(notifLocked[0].ref_id).toBe("c_lack:1");
  });

  it("Không trừ trong cron cho lớp TRIAL, lớp ADMIN, hoặc lớp đã ENDED", async () => {
    const { runBillingCycle } = await loadSlotWallet();
    const simNow = new Date("2026-02-15T08:00:00+07:00");
    await runBillingCycle(simNow);

    const ledgerTrial = await rows("SELECT * FROM slot_ledger WHERE class_id = 'c_trial'");
    expect(ledgerTrial).toHaveLength(0);

    const ledgerAdmin = await rows("SELECT * FROM slot_ledger WHERE class_id = 'c_admin'");
    expect(ledgerAdmin).toHaveLength(0);

    const ledgerEnd = await rows("SELECT * FROM slot_ledger WHERE class_id = 'c_end'");
    expect(ledgerEnd).toHaveLength(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 5. Duyệt đơn mua slot & Mở lại lớp quá hạn (TC-W09, BR-W07)
// ─────────────────────────────────────────────────────────────────────────────
describe("lib/slot-orders.ts & retryOverdueClasses (TC-W09, BR-W07)", () => {
  beforeEach(async () => {
    await h.pg.db.exec(`
      INSERT INTO classes (id, name, code, teacher_id, max_slots, start_date, next_charge_at, billing_period, billing_status)
      VALUES
        ('c_lock_1', 'Lớp Khóa Cũ', 'CLK001', 't1', 30, '2026-01-01', '2026-02-01', 0, 'LOCKED'),
        ('c_lock_2', 'Lớp Khóa Mới', 'CLK002', 't1', 30, '2026-01-15', '2026-02-15', 0, 'LOCKED');

      INSERT INTO enrollments (id, student_id, class_id) VALUES
        ('e_l1_1', 's1', 'c_lock_1'),
        ('e_l1_2', 's2', 'c_lock_1'),
        ('e_l2_1', 's1', 'c_lock_2'),
        ('e_l2_2', 's2', 'c_lock_2'),
        ('e_l2_3', 's3', 'c_lock_2');

      INSERT INTO slot_requests (id, teacher_id, teacher_name, teacher_email, requested_slots, total_cost, status, code)
      VALUES
        ('ord_pending', 't1', 'Cô Lan', 't1@x.vn', 10, 120000, 'PENDING', 'KKORD00001');
    `);
  });

  it("TC-W09: Admin duyệt đơn -> PURCHASE + số dư tăng; lớp LOCKED đủ slot -> ACTIVE ngay; duyệt lần 2 -> 409", async () => {
    const { approveOrder } = await loadSlotOrders();
    const { getBalance } = await loadSlotWallet();

    expect(await getBalance("t1")).toBe(0);

    // Duyệt đơn 10 slot:
    // +10 slot PURCHASE, sau đó retryOverdueClasses trừ 2 slot cho c_lock_1 và 3 slot cho c_lock_2 (tổng 5 slot)
    // -> số dư còn lại là 10 - 5 = 5.
    const res = await approveOrder("ord_pending", "admin1");
    expect(res.ok).toBe(true);

    const ord = (await rows("SELECT * FROM slot_requests WHERE id = 'ord_pending'"))[0];
    expect(ord.status).toBe("APPROVED");

    // Cả 2 lớp nợ được mở lại thành ACTIVE
    const c1 = (await rows("SELECT id, teacher_id, billing_status, billing_period, grace_until, ended_at, start_date::text AS start_date, next_charge_at::text AS next_charge_at FROM classes WHERE id = 'c_lock_1'"))[0];
    expect(c1.billing_status).toBe("ACTIVE");
    expect(c1.billing_period).toBe(1);

    const c2 = (await rows("SELECT id, teacher_id, billing_status, billing_period, grace_until, ended_at, start_date::text AS start_date, next_charge_at::text AS next_charge_at FROM classes WHERE id = 'c_lock_2'"))[0];
    expect(c2.billing_status).toBe("ACTIVE");
    expect(c2.billing_period).toBe(1);

    // Số dư cuối: 10 - 2 (c1) - 3 (c2) = 5
    expect(await getBalance("t1")).toBe(5);

    // Dòng ledger PURCHASE
    const purchaseLedger = await rows("SELECT * FROM slot_ledger WHERE order_id = 'ord_pending' AND reason = 'PURCHASE'");
    expect(purchaseLedger).toHaveLength(1);
    expect(purchaseLedger[0].delta).toBe(10);

    // Duyệt lần 2 trên cùng đơn hàng -> 409, không cộng thêm
    const res2 = await approveOrder("ord_pending", "admin1");
    expect(res2.ok).toBe(false);
    expect((res2 as any).status).toBe(409);
    expect(await getBalance("t1")).toBe(5);
  });

  it("retryOverdueClasses mở lại theo thứ tự next_charge_at cũ nhất trước khi số dư chỉ đủ 1 lớp", async () => {
    const { retryOverdueClasses, getBalance } = await loadSlotWallet();

    // t1 có 2 lớp LOCKED: c_lock_1 cần 2 slot (hạn 01/02), c_lock_2 cần 3 slot (hạn 15/02).
    // Cho t1 3 slot: chỉ đủ trả c_lock_1 cũ hơn, không đủ trả c_lock_2
    await h.pg.db.query("UPDATE users SET slot_balance = 3 WHERE id = 't1'");

    const reopenedCount = await retryOverdueClasses("t1");
    expect(reopenedCount).toBe(1);

    // c_lock_1 cũ hơn được mở lại
    const c1 = (await rows("SELECT id, teacher_id, billing_status, billing_period, grace_until, ended_at, start_date::text AS start_date, next_charge_at::text AS next_charge_at FROM classes WHERE id = 'c_lock_1'"))[0];
    expect(c1.billing_status).toBe("ACTIVE");
    expect(c1.billing_period).toBe(1);

    // c_lock_2 vẫn LOCKED
    const c2 = (await rows("SELECT id, teacher_id, billing_status, billing_period, grace_until, ended_at, start_date::text AS start_date, next_charge_at::text AS next_charge_at FROM classes WHERE id = 'c_lock_2'"))[0];
    expect(c2.billing_status).toBe("LOCKED");

    // Số dư: 3 - 2 = 1
    expect(await getBalance("t1")).toBe(1);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 6. adjustBalance (TC-W12)
// ─────────────────────────────────────────────────────────────────────────────
describe("lib/slot-wallet.ts — adjustBalance (TC-W12)", () => {
  it("TC-W12: Trừ tay làm số dư âm -> 409; thiếu note -> 400; delta=0 -> 400; cộng thì tăng và gọi retry", async () => {
    const { adjustBalance, getBalance } = await loadSlotWallet();
    await h.pg.db.query("UPDATE users SET slot_balance = 5 WHERE id = 't1'");

    // 1. Trừ quá số dư (delta = -10, hiện có 5) -> không cho phép
    const r1 = await adjustBalance({ teacherId: "t1", delta: -10, note: "Trừ phạt", createdBy: "admin1" });
    expect(r1.ok).toBe(false);
    expect(await getBalance("t1")).toBe(5);

    // 2. Thiếu note -> 400
    const r2 = await adjustBalance({ teacherId: "t1", delta: 2, note: "", createdBy: "admin1" });
    expect(r2.ok).toBe(false);

    // 3. Delta = 0 -> 400
    const r3 = await adjustBalance({ teacherId: "t1", delta: 0, note: "Hợp lệ", createdBy: "admin1" });
    expect(r3.ok).toBe(false);

    // 4. Cộng hợp lệ -> thành công, ghi ADMIN_ADJUST
    const r4 = await adjustBalance({ teacherId: "t1", delta: 10, note: "Tặng sự kiện", createdBy: "admin1" });
    expect(r4.ok).toBe(true);
    expect(await getBalance("t1")).toBe(15);

    const ledger = await rows("SELECT * FROM slot_ledger WHERE teacher_id = 't1' AND reason = 'ADMIN_ADJUST'");
    expect(ledger).toHaveLength(1);
    expect(ledger[0].delta).toBe(10);
    expect(ledger[0].balance_after).toBe(15);
    expect(ledger[0].note).toBe("Tặng sự kiện");
    expect(ledger[0].created_by).toBe("admin1");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 7. Route POST /api/cron/slot-billing (TC-W14)
// ─────────────────────────────────────────────────────────────────────────────
describe("app/api/cron/slot-billing/route.ts (TC-W14)", () => {
  it("TC-W14: Không có secret hoặc sai secret -> 401; đúng Bearer secret -> 200 JSON", async () => {
    const { POST: cronPost } = await loadCronRoute();

    // 1. Không có header Authorization -> 401
    const rNoAuth = await cronPost(req("POST", "/api/cron/slot-billing"));
    expect(rNoAuth.status).toBe(401);

    // 2. Sai Bearer secret -> 401
    const rWrong = await cronPost(
      req("POST", "/api/cron/slot-billing", undefined, { Authorization: "Bearer wrong_secret" })
    );
    expect(rWrong.status).toBe(401);

    // 3. Đúng secret -> 200, trả về JSON { charged, grace, locked, skipped }
    const rOk = await cronPost(
      req("POST", "/api/cron/slot-billing", undefined, { Authorization: `Bearer ${process.env.CRON_SECRET}` })
    );
    expect(rOk.status).toBe(200);
    const body = await rOk.json();
    expect(body).toHaveProperty("charged");
    expect(body).toHaveProperty("grace");
    expect(body).toHaveProperty("locked");
    expect(body).toHaveProperty("skipped");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 8. Tạo lớp & Xác minh giáo viên (TC-W11, BR-W09)
// ─────────────────────────────────────────────────────────────────────────────
describe("Tạo lớp & Xác minh giáo viên (TC-W11, BR-W09)", () => {
  it("Tạo lớp mới: start_date=todayVN, billing_period=0, next_charge_at=addMonths(1); TRIAL -> next_charge_at=NULL", async () => {
    const { POST: createClassPost } = await loadClassesRoute();

    // 1. Giáo viên VERIFIED tạo lớp
    await loginAs("TEACHER", "t1");
    const r1 = await createClassPost(req("POST", "/api/teacher/classes", { name: "Lớp Cô Lan Mới" }));
    expect(r1.status).toBe(201);
    const b1 = await r1.json();
    const cls1 = (await rows("SELECT id, teacher_id, billing_status, billing_period, grace_until, ended_at, start_date::text AS start_date, next_charge_at::text AS next_charge_at FROM classes WHERE id = $1", [b1.class.id]))[0];

    const { todayVN, addMonths } = await loadSlotWallet();
    const today = todayVN(new Date());
    expect(cls1.start_date).toBe(today);
    expect(cls1.billing_period).toBe(0);
    expect(cls1.next_charge_at).toBe(addMonths(today, 1));
    expect(cls1.billing_status).toBe("ACTIVE");

    // 2. Giáo viên TRIAL tạo lớp -> next_charge_at = NULL
    await loginAs("TEACHER", "t_trial");
    const r2 = await createClassPost(req("POST", "/api/teacher/classes", { name: "Lớp Dùng Thử" }));
    expect(r2.status).toBe(201);
    const b2 = await r2.json();
    const cls2 = (await rows("SELECT id, teacher_id, billing_status, billing_period, grace_until, ended_at, start_date::text AS start_date, next_charge_at::text AS next_charge_at FROM classes WHERE id = $1", [b2.class.id]))[0];

    expect(cls2.start_date).toBe(today);
    expect(cls2.billing_period).toBe(0);
    expect(cls2.next_charge_at).toBeNull();
  });

  it("TC-W11: Xác minh giáo viên (VERIFIED): không tặng 250 slot; lớp hiện có start_date=today, next_charge_at=start_date (cron trừ kỳ 0)", async () => {
    const { POST: verifyTeacherPost } = await loadTeacherVerifyRoute();
    const { runBillingCycle, getBalance } = await loadSlotWallet();
    await loginAs("ADMIN", "admin1");

    // t_trial có 1 lớp c_tri với 2 học sinh
    await h.pg.db.exec(`
      INSERT INTO classes (id, name, code, teacher_id, max_slots, start_date, next_charge_at, billing_period, billing_status)
      VALUES ('c_tri', 'Lớp Xác Minh', 'CTRI88', 't_trial', 30, '2026-01-01', NULL, 0, 'ACTIVE');
      INSERT INTO enrollments (id, student_id, class_id) VALUES ('e_t1', 's1', 'c_tri'), ('e_t2', 's2', 'c_tri');
      UPDATE users SET slot_balance = 0 WHERE id = 't_trial';
    `);

    // Admin xác minh
    const res = await verifyTeacherPost(
      req("POST", "/api/admin/teachers/t_trial/verify", { decision: "VERIFIED", note: "Đủ điều kiện" }),
      ctx({ id: "t_trial" })
    );
    expect(res.status).toBe(200);

    const teacher = (await rows("SELECT * FROM users WHERE id = 't_trial'"))[0];
    expect(teacher.teacher_status).toBe("VERIFIED");
    // KHÔNG tặng 250 slot vào ví!
    expect(teacher.slot_balance).toBe(0);

    const cls = (await rows("SELECT id, teacher_id, billing_status, billing_period, grace_until, ended_at, start_date::text AS start_date, next_charge_at::text AS next_charge_at FROM classes WHERE id = 'c_tri'"))[0];
    const { todayVN } = await loadSlotWallet();
    const today = todayVN(new Date());
    expect(cls.start_date).toBe(today);
    expect(cls.billing_period).toBe(0);
    expect(cls.next_charge_at).toBe(today); // để cron trừ ngay kỳ 0

    // Khi cron chạy: do next_charge_at = today, cron sẽ quét và trừ kỳ 0 theo sĩ số 2 HS
    // Vì slot_balance = 0 nên lớp sẽ vào GRACE
    await runBillingCycle(new Date());
    const clsAfter = (await rows("SELECT id, teacher_id, billing_status, billing_period, grace_until, ended_at, start_date::text AS start_date, next_charge_at::text AS next_charge_at FROM classes WHERE id = 'c_tri'"))[0];
    expect(clsAfter.billing_status).toBe("GRACE");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 9. Migration 018b (TC-W15, DEC-047)
// ─────────────────────────────────────────────────────────────────────────────
describe("Migration 018b — docs/db-migration-018b-slot-wallet-data.sql (TC-W15)", () => {
  it("TC-W15: Chuyển dữ liệu: slot_balance = tổng đơn APPROVED, bỏ 250; lớp cũ next_charge_at=hôm nay; chạy lại không cộng trùng", async () => {
    const mig018bFile = path.resolve(__dirname, "../docs/db-migration-018b-slot-wallet-data.sql");
    expect(fs.existsSync(mig018bFile), "docs/db-migration-018b-slot-wallet-data.sql phải tồn tại").toBe(true);

    const sql = fs.readFileSync(mig018bFile, "utf8");
    expect(sql.trim().length).toBeGreaterThan(0);

    // Chuẩn bị dữ liệu trước migration:
    // t1 (VERIFIED): có 2 đơn APPROVED (10 + 20 = 30 slot), 1 đơn PENDING (5 slot). slot_balance là cột mới = 0
    // (slot_limit 250 cũ không chuyển sang). Lớp cũ đã có start_date = created_at do migration 018 điền sẵn.
    // t2 (VERIFIED): 0 đơn APPROVED
    // t_trial (TRIAL): 0 đơn
    await h.pg.db.exec(`
      UPDATE users SET slot_balance = 0, slot_limit = 250 WHERE id IN ('t1', 't2');
      INSERT INTO slot_requests (id, teacher_id, teacher_name, teacher_email, requested_slots, total_cost, status) VALUES
        ('m_ord_1', 't1', 'Cô Lan', 't1@x.vn', 10, 100000, 'APPROVED'),
        ('m_ord_2', 't1', 'Cô Lan', 't1@x.vn', 20, 200000, 'APPROVED'),
        ('m_ord_3', 't1', 'Cô Lan', 't1@x.vn', 5, 50000, 'PENDING');

      INSERT INTO classes (id, name, code, teacher_id, max_slots, created_at, start_date, next_charge_at, billing_period)
      VALUES
        ('c_m_t1', 'Lớp Cũ t1', 'CMT101', 't1', 30, '2026-01-01', '2026-01-01', NULL, 0),
        ('c_m_tri', 'Lớp Cũ Trial', 'CMTR01', 't_trial', 3, '2026-01-01', '2026-01-01', NULL, 0);
    `);

    // Chạy migration 018b lần 1
    await h.pg.db.exec(sql);

    // Kiểm tra t1: slot_balance = 30 (chỉ đơn APPROVED, bỏ 250 tặng)
    const t1 = (await rows("SELECT slot_balance FROM users WHERE id = 't1'"))[0];
    expect(t1.slot_balance).toBe(30);

    // Dòng ledger MIGRATION của t1
    const ledgerT1 = await rows("SELECT * FROM slot_ledger WHERE teacher_id = 't1' AND reason = 'MIGRATION'");
    expect(ledgerT1).toHaveLength(1);
    expect(ledgerT1[0].delta).toBe(30);
    expect(ledgerT1[0].balance_after).toBe(30);

    // Kiểm tra t2: không có đơn APPROVED -> slot_balance = 0
    const t2 = (await rows("SELECT slot_balance FROM users WHERE id = 't2'"))[0];
    expect(t2.slot_balance).toBe(0);

    // Lớp cũ của t1: start_date = hôm nay, billing_period = 0, next_charge_at = start_date
    const clsT1 = (await rows("SELECT id, teacher_id, billing_status, billing_period, grace_until, ended_at, start_date::text AS start_date, next_charge_at::text AS next_charge_at FROM classes WHERE id = 'c_m_t1'"))[0];
    expect(clsT1.start_date).not.toBe("2026-01-01"); // khai giảng = ngày chạy migration
    expect(clsT1.billing_period).toBe(0);
    expect(clsT1.next_charge_at).toBe(clsT1.start_date);

    // Lớp cũ của t_trial: next_charge_at = NULL
    const clsTrial = (await rows("SELECT id, teacher_id, billing_status, billing_period, grace_until, ended_at, start_date::text AS start_date, next_charge_at::text AS next_charge_at FROM classes WHERE id = 'c_m_tri'"))[0];
    expect(clsTrial.next_charge_at).toBeNull();

    // Sau deploy đã có giao dịch (t1 tiêu 5 slot), rồi lỡ chạy migration 018b LẦN 2
    await h.pg.db.exec("UPDATE users SET slot_balance = 25 WHERE id = 't1'");
    await h.pg.db.exec(sql);

    // Không cộng trùng, không ghi đè về 30
    const t1Again = (await rows("SELECT slot_balance FROM users WHERE id = 't1'"))[0];
    expect(t1Again.slot_balance).toBe(25);

    const ledgerT1Again = await rows("SELECT * FROM slot_ledger WHERE teacher_id = 't1' AND reason = 'MIGRATION'");
    expect(ledgerT1Again).toHaveLength(1);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 10. getStudentSlotUsage (Hỗ trợ tương thích ngược DEC-042)
// ─────────────────────────────────────────────────────────────────────────────
describe("lib/student-slots.ts — getStudentSlotUsage", () => {
  it("getStudentSlotUsage trả về used là sĩ số hiện tại và limit là slot_balance", async () => {
    const { getStudentSlotUsage } = await loadStudentSlots();

    await h.pg.db.query("UPDATE users SET slot_balance = 25 WHERE id = 't1'");
    await h.pg.db.exec(`
      INSERT INTO classes (id, name, code, teacher_id, max_slots) VALUES
        ('c_u1', 'Lớp U1', 'CU0001', 't1', 30),
        ('c_u2', 'Lớp U2', 'CU0002', 't1', 30);
      INSERT INTO enrollments (id, student_id, class_id) VALUES
        ('e_u1', 's1', 'c_u1'),
        ('e_u2', 's2', 'c_u1'),
        ('e_u3', 's3', 'c_u2');
    `);

    const usage = await getStudentSlotUsage("t1");
    expect(usage.used).toBe(3);
    expect(usage.limit).toBe(25);
  });
});
