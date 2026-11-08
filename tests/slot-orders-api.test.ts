// TASK-041 — FEAT-013 §3.1–3.3, §5–7, DEC-032/033: đơn hàng mua slot + VietQR (phần server).
// File do trưởng phòng viết, bị khoá.
/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from "vitest";
import fs from "fs";
import { createFakePg } from "./helpers/pg-fake";

const h = vi.hoisted(() => {
  process.env.JWT_SECRET = "test_secret_for_vitest_only_0123456789abcdef";
  return { token: undefined as string | undefined, pg: null as any };
});
vi.mock("next/headers", () => ({
  cookies: async () => ({ get: (n: string) => (n === "auth_token" && h.token ? { value: h.token } : undefined), set: () => {} }),
  headers: async () => new Headers(),
}));
vi.mock("@/lib/db-pg", () => ({
  queryPg: (sql: string, params?: unknown[]) => h.pg.queryPg(sql, params),
  getPgPool: () => ({ connect: async () => ({ query: (s: string, p?: unknown[]) => h.pg.queryPg(s, p), release: () => {} }) }),
  ensureSchema: async () => {},
}));

import { signJwtToken } from "@/lib/jwt";
async function loginAs(role: "ADMIN" | "TEACHER" | "STUDENT" | null, userId?: string) {
  h.token = role ? await signJwtToken({ userId: userId!, email: `${userId}@x.vn`, role }) : undefined;
}
const req = (method: string, url: string, body?: unknown) =>
  new Request(`http://localhost${url}`, { method, headers: { "Content-Type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) });
const ctx = (id: string) => ({ params: Promise.resolve({ id }) });
const rows = async (sql: string, p: unknown[] = []) => (await h.pg.db.query(sql, p)).rows as any[];
const order = async (id: string) => (await rows(`SELECT * FROM slot_requests WHERE id=$1`, [id]))[0];
const slot = async (id: string) => (await rows(`SELECT slot_balance FROM users WHERE id=$1`, [id]))[0].slot_balance; // FEAT-015: thay DEC-031 — số dư ví
const notes = (userId: string, type: string) => rows(`SELECT ref_id, link FROM notifications WHERE user_id=$1 AND type=$2`, [userId, type]);
const read = (f: string) => fs.readFileSync(f, "utf8");

const ACCOUNT = { bank_bin: "970436", bank_name: "Vietcombank", account_no: "1012345678", account_name: "CONG TY KITOKIT" };

// ── Bộ đọc TLV + CRC16-CCITT (0x1021, init 0xFFFF) độc lập để kiểm payload ───────────────────────
function parseTlv(s: string): Record<string, string> {
  const out: Record<string, string> = {};
  let i = 0;
  while (i < s.length) {
    const tag = s.slice(i, i + 2);
    const len = Number(s.slice(i + 2, i + 4));
    if (!/^\d{2}$/.test(tag) || !Number.isInteger(len)) throw new Error("TLV hỏng tại " + i);
    out[tag] = s.slice(i + 4, i + 4 + len);
    i += 4 + len;
  }
  return out;
}
function crc16(s: string): string {
  let crc = 0xffff;
  for (const b of Buffer.from(s, "utf8")) {
    crc ^= b << 8;
    for (let k = 0; k < 8; k++) crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}

beforeEach(async () => {
  h.token = undefined;
  delete process.env.SLOT_UNIT_PRICE_VND;
  h.pg = await createFakePg(["db-migration-004-enrollments-assignments.sql", "db-migration-005-system-settings.sql", "db-migration-010-notifications.sql"]);
  await h.pg.db.exec(`
    ALTER TABLE users ADD COLUMN slot_limit INT DEFAULT 250;
    CREATE TABLE slot_requests (id VARCHAR(50) PRIMARY KEY, teacher_id VARCHAR(50) NOT NULL, teacher_name VARCHAR(100) NOT NULL, teacher_email VARCHAR(100) NOT NULL,
      requested_slots INTEGER NOT NULL, total_cost NUMERIC(12,2) NOT NULL, status VARCHAR(20) DEFAULT 'PENDING', created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP);
    INSERT INTO users (id,name,email,role,teacher_status,slot_limit) VALUES
      ('a1','Admin 1','a1@x.vn','ADMIN',NULL,0), ('a2','Admin 2','a2@x.vn','ADMIN',NULL,0),
      ('t1','Cô Lan','t1@x.vn','TEACHER','VERIFIED',250), ('t2','Thầy Minh','t2@x.vn','TEACHER','VERIFIED',250),
      ('tT','GV thử','tt@x.vn','TEACHER','TRIAL',9), ('s1','HS','s1@x.vn','STUDENT',NULL,0);
    UPDATE users SET slot_balance=250 WHERE role='TEACHER';
    INSERT INTO slot_requests (id,teacher_id,teacher_name,teacher_email,requested_slots,total_cost,status) VALUES
      ('old1','t1','Cô Lan','t1@x.vn',10,100000,'APPROVED'), ('old2','t2','Thầy Minh','t2@x.vn',20,200000,'PENDING');
  `);
  await h.pg.db.exec(read("docs/db-migration-016-slot-orders.sql"));
  await h.pg.db.query(`UPDATE system_settings SET value=$1::jsonb WHERE key='payment_account'`, [JSON.stringify(ACCOUNT)]);
  await h.pg.db.query(`UPDATE system_settings SET value='{"unit_price_vnd":12000}'::jsonb WHERE key='slot_pricing'`);
});

// ─────────────────────────────────────────────────────────────────────────────
describe("lib/vietqr.ts — buildVietQrPayload (EMVCo / NAPAS 247)", () => {
  it("đúng cấu trúc tag và CRC", async () => {
    const { buildVietQrPayload } = await import("@/lib/vietqr");
    const p = buildVietQrPayload({ bankBin: "970436", accountNo: "1012345678", amount: 600000, addInfo: "KKABCD2345" });
    const t = parseTlv(p);
    expect(t["00"]).toBe("01");
    expect(t["01"]).toBe("12");                                   // QR động (có số tiền)
    const m = parseTlv(t["38"]);
    expect(m["00"]).toBe("A000000727");
    expect(parseTlv(m["01"])).toEqual({ "00": "970436", "01": "1012345678" });
    expect(m["02"]).toBe("QRIBFTTA");
    expect(t["53"]).toBe("704");
    expect(t["54"]).toBe("600000");
    expect(t["58"]).toBe("VN");
    expect(parseTlv(t["62"])["08"]).toBe("KKABCD2345");
    expect(p.slice(-8, -4)).toBe("6304");
    expect(t["63"]).toBe(crc16(p.slice(0, -4)));
  });

  it("nội dung CK chỉ còn chữ in hoa không dấu, số, khoảng trắng; số tiền 0 → bỏ tag 54", async () => {
    const { buildVietQrPayload } = await import("@/lib/vietqr");
    const t = parseTlv(buildVietQrPayload({ bankBin: "970436", accountNo: "1012345678", amount: 0, addInfo: "kk-đơn #12" }));
    expect(t["54"]).toBeUndefined();
    expect(parseTlv(t["62"])["08"]).toBe("KK DON 12");
  });

  it("đầu vào sai → ném lỗi (BIN không đủ 6 số, STK không phải số, tiền âm/lẻ)", async () => {
    const { buildVietQrPayload } = await import("@/lib/vietqr");
    const ok = { bankBin: "970436", accountNo: "1012345678", amount: 1000, addInfo: "KK" };
    for (const bad of [{ ...ok, bankBin: "97043" }, { ...ok, accountNo: "12ab" }, { ...ok, amount: -1 }, { ...ok, amount: 10.5 }]) {
      expect(() => buildVietQrPayload(bad), JSON.stringify(bad)).toThrow();
    }
  });
});

describe("lib/slot-orders.ts — generateOrderCode", () => {
  it("dạng KK + 8 ký tự [A-Z2-9] bỏ O/I/0/1, không trùng trong 300 lần", async () => {
    const { generateOrderCode } = await import("@/lib/slot-orders");
    const codes = new Set<string>();
    for (let i = 0; i < 300; i++) {
      const c = generateOrderCode();
      expect(c).toMatch(/^KK[A-HJ-NP-Z2-9]{8}$/);
      codes.add(c);
    }
    expect(codes.size).toBe(300);
  });
});

describe("Migration 016", () => {
  it("thêm cột, điền mã cho đơn cũ (duy nhất), seed payment_account + slot_pricing; chạy lặp không lỗi", async () => {
    await h.pg.db.exec(read("docs/db-migration-016-slot-orders.sql"));
    const o = await rows(`SELECT id, code, source, status FROM slot_requests ORDER BY id`);
    expect(o.map((r) => r.source)).toEqual(["TEACHER", "TEACHER"]);
    expect(o.every((r) => /^KK[0-9A-Z]{8}$/.test(r.code))).toBe(true);
    expect(new Set(o.map((r) => r.code)).size).toBe(2);
    const cols = (await rows(`SELECT column_name FROM information_schema.columns WHERE table_name='slot_requests'`)).map((r) => r.column_name);
    expect(cols).toEqual(expect.arrayContaining(["code", "unit_price", "source", "created_by", "note", "payment_reported_at", "decided_by", "decided_at", "reject_reason", "payment_ref"]));
    expect((await rows(`SELECT key FROM system_settings WHERE key IN ('payment_account','slot_pricing') ORDER BY key`)).length).toBe(2);
  });

  it("ensureSchema có DDL của migration 016", () => {
    const s = read("lib/db-pg.ts");
    expect(s).toMatch(/ADD COLUMN IF NOT EXISTS payment_reported_at/);
    expect(s).toMatch(/'payment_account'/);
    expect(s).toMatch(/'slot_pricing'/);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe("POST /api/teacher/slot-requests — giáo viên tự tạo đơn", () => {
  const post = async (body: unknown) => (await import("@/app/api/teacher/slot-requests/route")).POST(req("POST", "/x", body));

  it("giá theo slot_pricing (không theo biến môi trường), bỏ qua total_cost client gửi, có mã đơn, source TEACHER", async () => {
    process.env.SLOT_UNIT_PRICE_VND = "99999";
    await loginAs("TEACHER", "t1");
    const res = await post({ requested_slots: 50, total_cost: 1, unit_price: 1 });
    expect(res.status).toBe(201);
    const { slot_request: o } = await res.json();
    expect(o).toMatchObject({ requested_slots: 50, total_cost: 600000, unit_price: 12000, status: "PENDING", source: "TEACHER" });
    expect(o.code).toMatch(/^KK[A-HJ-NP-Z2-9]{8}$/);
    expect((await order(o.id)).created_by).toBe("t1");
  });

  it("chưa có dòng slot_pricing → dùng SLOT_UNIT_PRICE_VND làm giá khởi tạo, không có thì 0", async () => {
    await h.pg.db.exec(`DELETE FROM system_settings WHERE key='slot_pricing'`);
    process.env.SLOT_UNIT_PRICE_VND = "15000";
    await loginAs("TEACHER", "t1");
    expect((await (await post({ requested_slots: 2 })).json()).slot_request.total_cost).toBe(30000);
  });

  it("BR-O10: đơn giá 0 hoặc chưa có tài khoản nhận tiền → GV tạo đơn bị 409, không sinh đơn; admin tạo hộ vẫn được", async () => {
    const count = async () => Number((await h.pg.db.query(`SELECT COUNT(*)::int AS n FROM slot_requests WHERE teacher_id='t1'`)).rows[0].n);
    const before = await count();
    await loginAs("TEACHER", "t1");
    await h.pg.db.exec(`UPDATE system_settings SET value='{"unit_price_vnd":0}'::jsonb WHERE key='slot_pricing'`);
    expect((await post({ requested_slots: 5 })).status).toBe(409);
    await h.pg.db.exec(`UPDATE system_settings SET value='{"unit_price_vnd":12000}'::jsonb WHERE key='slot_pricing'`);
    await h.pg.db.exec(`UPDATE system_settings SET value='{"bank_bin":"","bank_name":"","account_no":"","account_name":""}'::jsonb WHERE key='payment_account'`);
    expect((await post({ requested_slots: 5 })).status).toBe(409);
    expect(await count()).toBe(before);
    const { createOrder } = await import("@/lib/slot-orders");
    const r = await createOrder({ teacherId: "t1", requestedSlots: 5, totalCost: 0, note: "Tặng", source: "ADMIN", createdBy: "a1" });
    expect(r.ok).toBe(true);
  });

  it("giáo viên dùng thử → 403 TRIAL_LIMIT (giữ DEC-027); số slot sai → 400", async () => {
    await loginAs("TEACHER", "tT");
    expect((await post({ requested_slots: 5 })).status).toBe(403);
    await loginAs("TEACHER", "t1");
    for (const n of [0, 10001, 2.5, "5"]) expect((await post({ requested_slots: n })).status).toBe(400);
  });
});

describe("POST /api/admin/orders — admin tạo đơn cho giáo viên", () => {
  const post = async (body: unknown) => (await import("@/app/api/admin/orders/route")).POST(req("POST", "/x", body));

  it("401 / 403 cho khách, TEACHER", async () => {
    expect((await post({ teacher_id: "t1", requested_slots: 5 })).status).toBe(401);
    await loginAs("TEACHER", "t1");
    expect((await post({ teacher_id: "t1", requested_slots: 5 })).status).toBe(403);
  });

  it("mặc định giá chuẩn; source ADMIN, created_by admin; báo giáo viên ORDER_CREATED kèm link trang thanh toán", async () => {
    await loginAs("ADMIN", "a1");
    const res = await post({ teacher_id: "t1", requested_slots: 10 });
    expect(res.status).toBe(201);
    const { order: o } = await res.json();
    expect(o).toMatchObject({ teacher_id: "t1", teacher_name: "Cô Lan", requested_slots: 10, total_cost: 120000, source: "ADMIN", status: "PENDING" });
    expect((await order(o.id)).created_by).toBe("a1");
    expect(await notes("t1", "ORDER_CREATED")).toEqual([{ ref_id: o.id, link: `/teacher/orders/${o.id}` }]);
  });

  it("giá khác giá chuẩn bắt buộc có ghi chú; 0 đồng (tặng) hợp lệ khi có ghi chú; giá âm/lẻ → 400", async () => {
    await loginAs("ADMIN", "a1");
    expect((await post({ teacher_id: "t1", requested_slots: 10, total_cost: 50000 })).status).toBe(400);
    expect((await post({ teacher_id: "t1", requested_slots: 10, total_cost: 50000, note: "   " })).status).toBe(400);
    const r = await post({ teacher_id: "t1", requested_slots: 10, total_cost: 0, note: "Tặng khai trương" });
    expect(r.status).toBe(201);
    expect((await r.json()).order).toMatchObject({ total_cost: 0, note: "Tặng khai trương" });
    expect((await post({ teacher_id: "t1", requested_slots: 10, total_cost: -1, note: "x" })).status).toBe(400);
    expect((await post({ teacher_id: "t1", requested_slots: 10, total_cost: 10.5, note: "x" })).status).toBe(400);
  });

  it("teacher_id không phải giáo viên → 404; thiếu/sai requested_slots → 400", async () => {
    await loginAs("ADMIN", "a1");
    expect((await post({ teacher_id: "s1", requested_slots: 10 })).status).toBe(404);
    expect((await post({ teacher_id: "nobody", requested_slots: 10 })).status).toBe(404);
    expect((await post({ teacher_id: "t1" })).status).toBe(400);
  });
});

describe("GET /api/admin/orders — danh sách & lọc", () => {
  const list = async (qs = "") => (await import("@/app/api/admin/orders/route")).GET(req("GET", `/api/admin/orders${qs}`));

  it("mặc định mọi trạng thái; PENDING đã báo chuyển khoản lên đầu, rồi PENDING khác, rồi còn lại", async () => {
    await h.pg.db.exec(`INSERT INTO slot_requests (id,teacher_id,teacher_name,teacher_email,requested_slots,total_cost,status,code,payment_reported_at)
      VALUES ('p3','t1','Cô Lan','t1@x.vn',5,60000,'PENDING','KKPAID2345',NOW())`);
    await loginAs("ADMIN", "a1");
    const j = await (await list()).json();
    expect(j.success).toBe(true);
    expect(j.orders.map((o: any) => o.id)).toEqual(["p3", "old2", "old1"]);
    expect(j.orders[0]).toMatchObject({ code: "KKPAID2345", requested_slots: 5, total_cost: 60000 });
    expect(j.counts).toMatchObject({ PENDING: 2, APPROVED: 1 });
  });

  it("lọc status, source, q (mã đơn / tên / email, không phân biệt hoa thường); status lạ → 400", async () => {
    await loginAs("ADMIN", "a1");
    expect((await (await list("?status=APPROVED")).json()).orders.map((o: any) => o.id)).toEqual(["old1"]);
    expect((await (await list("?source=ADMIN")).json()).orders).toEqual([]);
    expect((await (await list("?q=minh")).json()).orders.map((o: any) => o.id)).toEqual(["old2"]);
    const code = (await order("old1")).code;
    expect((await (await list(`?q=${code.toLowerCase()}`)).json()).orders.map((o: any) => o.id)).toEqual(["old1"]);
    expect((await list("?status=PAID")).status).toBe(400);
  });

  it("TEACHER → 403", async () => {
    await loginAs("TEACHER", "t1");
    expect((await list()).status).toBe(403);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe("GET /api/orders/[id] — trang thanh toán", () => {
  const get = async (id: string) => (await import("@/app/api/orders/[id]/route")).GET(req("GET", "/x"), ctx(id));

  it("chủ đơn xem được: thông tin chuyển khoản + qr_payload khớp số tiền & mã đơn", async () => {
    await loginAs("TEACHER", "t2");
    const res = await get("old2");
    expect(res.status).toBe(200);
    const j = await res.json();
    const code = (await order("old2")).code;
    expect(j.order).toMatchObject({ id: "old2", code, requested_slots: 20, total_cost: 200000, status: "PENDING" });
    expect(j.payment).toMatchObject({ configured: true, ...ACCOUNT, amount: 200000, add_info: code });
    const t = parseTlv(j.payment.qr_payload);
    expect(t["54"]).toBe("200000");
    expect(parseTlv(t["62"])["08"]).toBe(code);
  });

  it("đơn của giáo viên khác → 404; STUDENT → 403; ADMIN xem mọi đơn; không có → 404", async () => {
    await loginAs("TEACHER", "t1");
    expect((await get("old2")).status).toBe(404);
    await loginAs("STUDENT", "s1");
    expect((await get("old2")).status).toBe(403);
    await loginAs("ADMIN", "a1");
    expect((await get("old2")).status).toBe(200);
    expect((await get("nope")).status).toBe(404);
  });

  it("chưa cấu hình tài khoản nhận tiền → payment.configured = false, qr_payload null (không lỗi)", async () => {
    await h.pg.db.exec(`UPDATE system_settings SET value='{"bank_bin":"","bank_name":"","account_no":"","account_name":""}'::jsonb WHERE key='payment_account'`);
    await loginAs("TEACHER", "t2");
    const j = await (await get("old2")).json();
    expect(j.payment).toMatchObject({ configured: false, qr_payload: null });
  });

  it("đơn không còn PENDING → không trả qr_payload", async () => {
    await loginAs("TEACHER", "t1");
    expect((await (await get("old1")).json()).payment.qr_payload).toBeNull();
  });
});

describe("POST /api/orders/[id]/report-paid & /cancel", () => {
  const report = async (id: string) => (await import("@/app/api/orders/[id]/report-paid/route")).POST(req("POST", "/x"), ctx(id));
  const cancel = async (id: string) => (await import("@/app/api/orders/[id]/cancel/route")).POST(req("POST", "/x"), ctx(id));

  it("báo đã chuyển khoản: ghi thời điểm, báo MỌI admin; gọi lại giữ nguyên thời điểm, không báo thêm", async () => {
    await loginAs("TEACHER", "t2");
    expect((await report("old2")).status).toBe(200);
    const first = (await order("old2")).payment_reported_at;
    expect(first).toBeTruthy();
    expect((await report("old2")).status).toBe(200);
    expect((await order("old2")).payment_reported_at).toEqual(first);
    expect((await order("old2")).status).toBe("PENDING");
    expect(await notes("a1", "ORDER_PAID_REPORTED")).toHaveLength(1);
    expect(await notes("a2", "ORDER_PAID_REPORTED")).toHaveLength(1);
  });

  it("đơn người khác → 404; đơn đã duyệt → 409", async () => {
    await loginAs("TEACHER", "t1");
    expect((await report("old2")).status).toBe(404);
    expect((await report("old1")).status).toBe(409);
  });

  it("huỷ: chủ đơn huỷ được khi PENDING; đã duyệt → 409; đơn người khác → 404; admin huỷ được", async () => {
    await loginAs("TEACHER", "t1");
    expect((await cancel("old1")).status).toBe(409);
    expect((await cancel("old2")).status).toBe(404);
    await loginAs("TEACHER", "t2");
    expect((await cancel("old2")).status).toBe(200);
    expect((await order("old2")).status).toBe("CANCELLED");
    expect((await cancel("old2")).status).toBe(409);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe("Duyệt / từ chối — /api/admin/orders/[id]/approve | reject", () => {
  const approve = async (id: string, body: unknown = {}) => (await import("@/app/api/admin/orders/[id]/approve/route")).POST(req("POST", "/x", body), ctx(id));
  const reject = async (id: string, body: unknown) => (await import("@/app/api/admin/orders/[id]/reject/route")).POST(req("POST", "/x", body), ctx(id));

  it("duyệt: APPROVED, cộng slot đúng 1 lần, ghi người duyệt + thời điểm, báo giáo viên ORDER_APPROVED; duyệt lại → 409", async () => {
    await loginAs("ADMIN", "a1");
    expect((await approve("old2")).status).toBe(200);
    expect(await slot("t2")).toBe(270);
    expect(await h.pg.db.query(`SELECT delta FROM slot_ledger WHERE teacher_id='t2' AND reason='PURCHASE'`).then((r: any) => r.rows)).toEqual([{ delta: 20 }]);
    expect((await rows(`SELECT slot_limit FROM users WHERE id='t2'`))[0].slot_limit).toBe(250); // slot_limit không đổi
    expect(await order("old2")).toMatchObject({ status: "APPROVED", decided_by: "a1" });
    expect((await order("old2")).decided_at).toBeTruthy();
    expect(await notes("t2", "ORDER_APPROVED")).toEqual([{ ref_id: "old2", link: "/teacher/orders/old2" }]);
    expect((await approve("old2")).status).toBe(409);
    expect(await slot("t2")).toBe(270);
  });

  it("đơn đã huỷ / từ chối → 409, không cộng slot; TEACHER → 403; không có → 404", async () => {
    await h.pg.db.exec(`UPDATE slot_requests SET status='CANCELLED' WHERE id='old2'`);
    await loginAs("TEACHER", "t2");
    expect((await approve("old2")).status).toBe(403);
    await loginAs("ADMIN", "a1");
    expect((await approve("old2")).status).toBe(409);
    expect((await approve("nope")).status).toBe(404);
    expect(await slot("t2")).toBe(250);
  });

  it("approveOrder dùng chung cho webhook: decided_by 'WEBHOOK', lưu payment_ref", async () => {
    const { approveOrder } = await import("@/lib/slot-orders");
    const r = await approveOrder("old2", "WEBHOOK", "FT26306123456");
    expect(r.ok).toBe(true);
    expect(await order("old2")).toMatchObject({ status: "APPROVED", decided_by: "WEBHOOK", payment_ref: "FT26306123456" });
    expect((await approveOrder("old2", "WEBHOOK")).ok).toBe(false);
    expect(await slot("t2")).toBe(270);
  });

  it("từ chối bắt buộc lý do; lưu reject_reason, báo giáo viên ORDER_REJECTED; không cộng slot", async () => {
    await loginAs("ADMIN", "a1");
    expect((await reject("old2", {})).status).toBe(400);
    expect((await reject("old2", { reason: "  " })).status).toBe(400);
    expect((await reject("old2", { reason: "Chưa nhận được tiền" })).status).toBe(200);
    expect(await order("old2")).toMatchObject({ status: "REJECTED", reject_reason: "Chưa nhận được tiền", decided_by: "a1" });
    expect(await notes("t2", "ORDER_REJECTED")).toHaveLength(1);
    expect(await slot("t2")).toBe(250);
  });

  it("câu lệnh duyệt có điều kiện status = 'PENDING' (chống duyệt đôi khi chạy song song)", () => {
    expect(read("lib/slot-orders.ts")).toMatch(/UPDATE slot_requests[\s\S]{0,200}status\s*=\s*'PENDING'/);
  });

  it("route cũ PUT /api/admin/requests/[id] đi qua lib/slot-orders (không còn tự UPDATE slot_limit)", () => {
    const s = read("app/api/admin/requests/[id]/route.ts");
    expect(s).toMatch(/@\/lib\/slot-orders/);
    expect(s).not.toMatch(/UPDATE users SET slot_limit/);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe("GET/PUT /api/admin/settings/payment", () => {
  const api = () => import("@/app/api/admin/settings/payment/route");

  it("chỉ ADMIN", async () => {
    expect((await (await api()).GET(req("GET", "/x"))).status).toBe(401);
    await loginAs("TEACHER", "t1");
    expect((await (await api()).GET(req("GET", "/x"))).status).toBe(403);
  });

  it("GET trả payment_account + slot_pricing; PUT hợp lệ lưu lại, tên chủ TK chuẩn hoá in hoa không dấu", async () => {
    await loginAs("ADMIN", "a1");
    expect(await (await (await api()).GET(req("GET", "/x"))).json()).toMatchObject({ success: true, payment_account: ACCOUNT, slot_pricing: { unit_price_vnd: 12000 } });
    const res = await (await api()).PUT(req("PUT", "/x", {
      payment_account: { bank_bin: "970422", bank_name: "MB Bank", account_no: "0123456789", account_name: "Công ty KitoKit" },
      slot_pricing: { unit_price_vnd: 15000 },
    }));
    expect(res.status).toBe(200);
    const j = await (await (await api()).GET(req("GET", "/x"))).json();
    expect(j.payment_account).toEqual({ bank_bin: "970422", bank_name: "MB Bank", account_no: "0123456789", account_name: "CONG TY KITOKIT" });
    expect(j.slot_pricing).toEqual({ unit_price_vnd: 15000 });
  });

  it("PUT sai → 400 (BIN không 6 số, STK không phải số / quá 19 ký tự, đơn giá âm hoặc lẻ)", async () => {
    await loginAs("ADMIN", "a1");
    const base = { payment_account: ACCOUNT, slot_pricing: { unit_price_vnd: 12000 } };
    const bads = [
      { ...base, payment_account: { ...ACCOUNT, bank_bin: "97042" } },
      { ...base, payment_account: { ...ACCOUNT, account_no: "12-34" } },
      { ...base, payment_account: { ...ACCOUNT, account_no: "1".repeat(20) } },
      { ...base, slot_pricing: { unit_price_vnd: -1 } },
      { ...base, slot_pricing: { unit_price_vnd: 100.5 } },
    ];
    for (const b of bads) expect((await (await api()).PUT(req("PUT", "/x", b))).status, JSON.stringify(b)).toBe(400);
  });
});
