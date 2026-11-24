// TASK-050 · FEAT-016 §4 (TC-W13) — trang /admin/alerts và mục menu (kiểm mã nguồn).
import { describe, it, expect } from "vitest";
import fs from "fs";

const PAGE = "app/admin/alerts/page.tsx";
const LAYOUT = "components/AdminLayout.tsx";
const read = (f: string) => fs.readFileSync(f, "utf8");

describe("SCR-52 /admin/alerts", () => {
  it("gọi đúng 3 API: danh sách có lọc, PATCH trạng thái, gửi tin thử", () => {
    const s = read(PAGE);
    expect(s).toContain("/api/admin/alerts?");
    expect(s).toMatch(/\/api\/admin\/alerts\/\$\{encodeURIComponent\(item\.id\)\}/);
    expect(s).toContain('method: "PATCH"');
    expect(s).toContain("/api/admin/alerts/test");
  });

  it("đủ 4 trạng thái: đang tải (skeleton), lỗi + Thử lại, rỗng (2 kiểu) + Xoá lọc, có dữ liệu", () => {
    const s = read(PAGE);
    expect(s).toContain("animate-pulse");
    expect(s).toContain("Thử lại");
    expect(s).toContain("Chưa có cảnh báo nào. Hệ thống đang chạy ổn.");
    expect(s).toContain("Không có cảnh báo khớp bộ lọc");
    expect(s).toContain("Xoá lọc");
    expect(s).toContain("<table");
  });

  it("lọc theo trạng thái / mức / nguồn; ngăn chi tiết có Đánh dấu đã xử lý và Mở lại; trạng thái Telegram + Gửi tin thử", () => {
    const s = read(PAGE);
    for (const t of ["Đã xử lý", "Tất cả", "Mọi mức", "Mọi nguồn", "Đánh dấu đã xử lý", "Mở lại", "Gửi tin thử", "TELEGRAM_BOT_TOKEN"]) {
      expect(s).toContain(t);
    }
  });

  it("menu admin có Cảnh Báo Hệ Thống ngay sau Tổng quan, kèm huy hiệu số cảnh báo NEW", () => {
    const s = read(LAYOUT);
    const iOverview = s.indexOf('label: "Tổng quan"');
    const iAlerts = s.indexOf('label: "Cảnh Báo Hệ Thống"');
    const iOrders = s.indexOf('label: "Đơn hàng"');
    expect(iOverview).toBeGreaterThan(-1);
    expect(iAlerts).toBeGreaterThan(iOverview);
    expect(iAlerts).toBeLessThan(iOrders);
    expect(s).toContain("/api/admin/alerts?status=NEW");
    expect(s).toContain("newAlertsCount");
  });

  it("không có mã màu hex trong class, nút không có dấu + ở đầu (DEC-022, DEC-035)", () => {
    const s = read(PAGE);
    expect(s).not.toMatch(/(?:bg|text|border)-\[#/);
    expect(s).not.toMatch(/>\s*\+\s*[A-Za-zÀ-ỹ]/);
  });
});
