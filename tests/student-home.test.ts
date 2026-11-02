// TASK-025 — Trang chủ học sinh: bỏ bán khóa học (DEC-019), dùng API pg; gỡ Supabase trình duyệt cuối cùng.
// File do trưởng phòng viết, bị khoá.
import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

const PAGE = "app/student/page.tsx";
const read = (p: string) => fs.readFileSync(p, "utf8");

describe("app/student/page.tsx", () => {
  it("dùng /api/student/classes (lớp của tôi) và /api/student/enroll (tham gia bằng mã)", () => {
    const s = read(PAGE);
    expect(s).toContain("/api/student/classes");
    expect(s).toContain("/api/student/enroll");
    expect(s).toContain("/student/class/");
  });
  it("không còn bán khóa học: không đơn mua, không QR, không giá, không dữ liệu giả", () => {
    const s = read(PAGE);
    for (const bad of ['"@/lib/supabase"', "supabase.", "@/lib/mock-data", "INITIAL_", "orders", "vietqr", "transfer", "price"]) {
      expect(s.toLowerCase(), bad).not.toContain(bad.toLowerCase());
    }
  });
  it("đủ trạng thái: lỗi + Thử lại, rỗng (chưa tham gia lớp nào), xử lý 404/409 khi nhập mã", () => {
    const s = read(PAGE);
    expect(s).toMatch(/Thử lại/);
    expect(s).toMatch(/chưa tham gia lớp/i);
    expect(s).toMatch(/404/);
    expect(s).toMatch(/409/);
  });
});

describe("Không còn trang/component nào dùng Supabase client phía trình duyệt", () => {
  it("không file nào trong app/ và components/ import @/lib/supabase", () => {
    const hits: string[] = [];
    const walk = (d: string) => {
      for (const e of fs.readdirSync(d, { withFileTypes: true })) {
        const p = path.join(d, e.name);
        if (e.isDirectory()) walk(p);
        else if (/\.(tsx?|jsx?)$/.test(e.name) && read(p).includes('"@/lib/supabase"')) hits.push(p);
      }
    };
    walk("app");
    walk("components");
    expect(hits).toEqual([]);
  });
});
