// TASK-042 — FEAT-013 §3.1–3.3, §4: giao diện đơn hàng mua slot + trang thanh toán VietQR.
// File do trưởng phòng viết, bị khoá.
/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from "vitest";
import fs from "fs";

const h = vi.hoisted(() => ({ redirects: [] as string[] }));
vi.mock("next/navigation", () => {
  const go = (url: string) => { h.redirects.push(url); throw new Error("NEXT_REDIRECT"); };
  return {
    redirect: go,
    permanentRedirect: go,
    useRouter: () => ({ push: () => {}, replace: () => {} }),
    useSearchParams: () => new URLSearchParams(),
    usePathname: () => "/",
    useParams: () => ({}),
  };
});

const read = (f: string) => fs.readFileSync(f, "utf8");
const exists = (f: string) => fs.existsSync(f);
const PANEL = "components/orders/PaymentPanel.tsx";
const ADMIN_LIST = "app/admin/orders/page.tsx";
const ADMIN_DETAIL = "app/admin/orders/[id]/page.tsx";
const TEACHER_DETAIL = "app/teacher/orders/[id]/page.tsx";
const SLOTS = "app/teacher/slots/page.tsx";

beforeEach(() => { h.redirects.length = 0; });

// ─────────────────────────────────────────────────────────────────────────────
describe("lib/vietqr-banks.ts — danh sách ngân hàng VietQR (thuần)", () => {
  it("có các ngân hàng phổ biến với BIN đúng, BIN là 6 chữ số, không trùng", async () => {
    const { VIETQR_BANKS, findBankByBin } = await import("@/lib/vietqr-banks");
    expect(VIETQR_BANKS.length).toBeGreaterThanOrEqual(15);
    for (const b of VIETQR_BANKS) {
      expect(b.bin).toMatch(/^\d{6}$/);
      expect(b.short_name.length).toBeGreaterThan(1);
    }
    expect(new Set(VIETQR_BANKS.map((b: any) => b.bin)).size).toBe(VIETQR_BANKS.length);
    const known: Record<string, string> = { "970436": "Vietcombank", "970415": "VietinBank", "970418": "BIDV", "970405": "Agribank", "970422": "MB", "970407": "Techcombank", "970416": "ACB", "970432": "VPBank", "970423": "TPBank", "970403": "Sacombank" };
    for (const [bin, name] of Object.entries(known)) expect(findBankByBin(bin)?.short_name, bin).toMatch(new RegExp(name, "i"));
    expect(findBankByBin("000000")).toBeNull();
  });
});

describe("Gói qrcode vẽ được payload VietQR (máy chủ & trình duyệt dùng cùng thư viện)", () => {
  it("toDataURL trả ảnh PNG", async () => {
    const { buildVietQrPayload } = await import("@/lib/vietqr");
    const QRCode = (await import("qrcode")).default;
    const url = await QRCode.toDataURL(buildVietQrPayload({ bankBin: "970436", accountNo: "1012345678", amount: 600000, addInfo: "KKABCD2345" }));
    expect(url.startsWith("data:image/png;base64,")).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe("components/orders/PaymentPanel.tsx", () => {
  it("client component, nhận order + payment, vẽ QR từ qr_payload bằng gói qrcode (không ảnh ngoài)", () => {
    const s = read(PANEL);
    expect(s.trimStart().startsWith('"use client"')).toBe(true);
    expect(s).toMatch(/from ["']qrcode["']/);
    expect(s).toMatch(/qr_payload/);
    expect(s).not.toMatch(/img\.vietqr\.io|api\.vietqr|https?:\/\/[^"'`]*qr/i);
    expect(s).toMatch(/export default function PaymentPanel/);
  });

  it("hiển thị đủ dòng chuyển khoản có nút sao chép; báo khi chưa cấu hình tài khoản", () => {
    const s = read(PANEL);
    for (const k of ["account_no", "account_name", "add_info", "amount", "bank_name"]) expect(s, k).toContain(k);
    expect(s).toMatch(/navigator\.clipboard\.writeText/);
    expect(s).toMatch(/configured/);
    expect(s).toContain("chưa cấu hình tài khoản nhận tiền");
  });

  it("huy hiệu đủ 4 trạng thái bằng tiếng Việt; số tiền định dạng vi-VN", () => {
    const s = read(PANEL);
    for (const k of ["Chờ thanh toán", "Đã báo chuyển khoản", "Đã duyệt", "Từ chối", "Đã huỷ"]) expect(s, k).toContain(k);
    expect(s).toMatch(/toLocaleString\(["']vi-VN["']\)/);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe("Trang giáo viên", () => {
  it("/teacher/orders/[id]: gọi /api/orders/<id>, dùng PaymentPanel, nút 'Tôi đã chuyển khoản' và 'Huỷ đơn'", () => {
    const s = read(TEACHER_DETAIL);
    expect(s).toMatch(/\/api\/orders\/\$\{/);
    expect(s).toMatch(/report-paid/);
    expect(s).toMatch(/\/cancel/);
    expect(s).toMatch(/<PaymentPanel/);
    expect(s).toContain("Tôi đã chuyển khoản");
    expect(s).toMatch(/TeacherLayout/);
  });

  it("/teacher/slots: hiện usage thật, tạo đơn rồi chuyển sang /teacher/orders/<id>, danh sách đơn có link", () => {
    const s = read(SLOTS);
    expect(s).toMatch(/usage/);
    expect(s).toMatch(/\/api\/teacher\/slot-requests/);
    expect(s).toMatch(/router\.push\(`\/teacher\/orders\/\$\{/);
    expect(s).toMatch(/href=\{`\/teacher\/orders\/\$\{/);
    expect(s).toMatch(/code/);
    expect(s).not.toMatch(/useState\(218\)|useState\(250\)/);
  });

  it("menu giáo viên đổi nhãn thành 'Slot học sinh & đơn hàng'", () => {
    const s = read("components/TeacherLayout.tsx");
    expect(s).toMatch(/href:\s*"\/teacher\/slots",\s*label:\s*"Slot học sinh & đơn hàng"/);
    expect(s).not.toContain("Mua Slot Tài Khoản");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe("Trang admin", () => {
  it("/admin/orders: gọi /api/admin/orders với status/source/q, đọc ?q và ?status trên URL", () => {
    const s = read(ADMIN_LIST);
    expect(s.trimStart().startsWith('"use client"')).toBe(true);
    expect(s).toMatch(/\/api\/admin\/orders/);
    expect(s).toMatch(/useSearchParams/);
    expect(s).toMatch(/<Suspense/);
    for (const k of ["status", "source", "q"]) expect(s, k).toMatch(new RegExp(`["'\`]${k}["'\`]|${k}=`));
    expect(s).toMatch(/counts/);
  });

  it("/admin/orders: thao tác duyệt / từ chối (bắt buộc lý do) / huỷ / xem trang thanh toán", () => {
    const s = read(ADMIN_LIST);
    expect(s).toMatch(/\/approve/);
    expect(s).toMatch(/\/reject/);
    expect(s).toMatch(/reason/);
    expect(s).toMatch(/\/cancel/);
    expect(s).toMatch(/\/admin\/orders\/\$\{/);
    expect(s).toMatch(/payment_reported_at/);
  });

  it("/admin/orders có tab 'Cấu hình thanh toán' gọi /api/admin/settings/payment, chọn ngân hàng từ VIETQR_BANKS", () => {
    const s = read(ADMIN_LIST);
    expect(s).toContain("Cấu hình thanh toán");
    expect(s).toMatch(/\/api\/admin\/settings\/payment/);
    expect(s).toMatch(/VIETQR_BANKS/);
    expect(s).toMatch(/unit_price_vnd/);
  });

  it("/admin/orders/[id]: PaymentPanel + nút duyệt/từ chối", () => {
    const s = read(ADMIN_DETAIL);
    expect(s).toMatch(/\/api\/orders\/\$\{/);
    expect(s).toMatch(/<PaymentPanel/);
    expect(s).toMatch(/\/approve/);
    expect(s).toMatch(/\/reject/);
    expect(s).toMatch(/AdminLayout/);
  });

  it("/admin/teachers/[id]: nút 'Tạo đơn mua slot' gửi POST /api/admin/orders (teacher_id, requested_slots, total_cost, note)", () => {
    const s = read("app/admin/teachers/[id]/page.tsx");
    expect(s).toContain("Tạo đơn mua slot");
    expect(s).toMatch(/\/api\/admin\/orders/);
    for (const k of ["requested_slots", "total_cost", "note", "teacher_id"]) expect(s, k).toContain(k);
  });

  it("/admin/requests là server component chuyển hướng 308 sang /admin/orders", async () => {
    const src = read("app/admin/requests/page.tsx");
    expect(src).not.toMatch(/^\s*["']use client["']/);
    expect(src.split("\n").length).toBeLessThan(15);
    const mod = await import("@/app/admin/requests/page");
    try { await (mod.default as any)(); } catch { /* NEXT_REDIRECT */ }
    expect(h.redirects).toEqual(["/admin/orders"]);
  });
});

describe("Không gọi DB / thư viện server từ trang client", () => {
  it("các trang đơn hàng không import db-pg, slot-orders, notifications", () => {
    for (const f of [PANEL, ADMIN_LIST, ADMIN_DETAIL, TEACHER_DETAIL, SLOTS]) {
      expect(exists(f), f).toBe(true);
      expect(read(f), f).not.toMatch(/@\/lib\/(db-pg|slot-orders|notifications|ai-usage)/);
    }
  });
});
