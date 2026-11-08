// TASK-051 — Trang bảng giá công khai /pricing (SCR-53, FEAT-015 §4, BR-W01, BR-W13, TC-W16).
// Hợp đồng nghiệm thu do tài khoản kiểm chéo viết; người code KHÔNG được sửa file này.
/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from "vitest";
import fs from "fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

const h = vi.hoisted(() => ({
  price: 25000,
  // Ghi đè giá trị khởi tạo của ô "Số học sinh" (mô phỏng người dùng gõ vào ô) — null = không ghi đè
  students: null as string | null,
  months: null as string | null,
  fetchCalls: 0,
}));

vi.mock("@/lib/slot-orders", () => ({
  getSlotPricing: async () => ({ unit_price_vnd: h.price }),
}));
vi.mock("@/lib/db-pg", () => ({
  queryPg: async () => ({ rows: [] }),
  getPgPool: () => ({}),
  ensureSchema: async () => {},
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: () => {}, replace: () => {} }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => "/pricing",
  redirect: () => {},
}));
// Mô phỏng nhập liệu: ô nào khởi tạo bằng 30 (học sinh) / 3 (tháng) sẽ được thay bằng giá trị test,
// giữ đúng kiểu (chuỗi hoặc số) mà component dùng; "abc" ở ô số → NaN.
vi.mock("react", async (orig) => {
  const actual: any = await orig();
  const conv = (init: any, override: string) => (typeof init === "number" ? Number(override) : override);
  const useState = (init: any) => {
    const v = typeof init === "function" ? init() : init;
    if (h.students !== null && (v === 30 || v === "30")) return actual.useState(conv(v, h.students));
    if (h.months !== null && (v === 3 || v === "3")) return actual.useState(conv(v, h.months));
    return actual.useState(init);
  };
  return { ...actual, useState, default: { ...actual.default, useState } };
});

const read = (p: string) => (fs.existsSync(p) ? fs.readFileSync(p, "utf8") : "");
const exists = (p: string) => fs.existsSync(p);
const PAGE = "app/pricing/page.tsx";
const CALC = "components/pricing/PricingCalculator.tsx";
const HEADER = "components/landing/LandingHeader.tsx";
const FOOTER = "components/landing/LandingFooter.tsx";

async function renderPage(price: number): Promise<string> {
  h.price = price;
  const Page = (await import("@/app/pricing/page")).default as any;
  return renderToStaticMarkup(await Page());
}
async function renderCalc(price: number, students: string | null = null, months: string | null = null) {
  h.students = students;
  h.months = months;
  const Calc = (await import("@/components/pricing/PricingCalculator")).default as any;
  return renderToStaticMarkup(createElement(Calc, { unitPriceVnd: price, unit_price_vnd: price }));
}
const text = (html: string) => html.replace(/<[^>]*>/g, " ").replace(/&nbsp;|\u00a0/g, " ").replace(/\s+/g, " ");

beforeEach(async () => {
  h.price = 25000;
  h.students = null;
  h.months = null;
  (globalThis as any).React = await import("react"); // esbuild của vitest dùng JSX kiểu cổ điển
  vi.stubGlobal("fetch", async () => { h.fetchCalls++; throw new Error("không được gọi API từ client"); });
  h.fetchCalls = 0;
});

describe("1. Cấu trúc file & ràng buộc tĩnh", () => {
  it("có page.tsx (Server Component, metadata.title, force-dynamic) và PricingCalculator (Client Component)", () => {
    expect(exists(PAGE), `${PAGE} chưa có`).toBe(true);
    expect(exists(CALC), `${CALC} chưa có`).toBe(true);
    const p = read(PAGE);
    expect(p.trimStart().startsWith('"use client"')).toBe(false);
    expect(p).toMatch(/export const metadata/);
    expect(p).toMatch(/export const dynamic\s*=\s*["']force-dynamic["']/);
    expect(p).toContain("getSlotPricing");
    expect(read(CALC).trimStart().startsWith('"use client"')).toBe(true);
  });

  it("không hard-code giá, không gọi API từ client, không thêm thư viện", () => {
    for (const f of [PAGE, CALC]) {
      const s = read(f);
      expect(s, f).toBeTruthy();
      expect(s, `${f} hard-code giá`).not.toMatch(/25\.?000/);
      expect(s, `${f} hard-code giá`).not.toMatch(/unit_?price\w*\s*[:=]\s*[1-9]\d{3,}/i);
    }
    const c = read(CALC);
    expect(c).not.toMatch(/\bfetch\s*\(/);
    expect(c).not.toContain("/api/");
    expect(c).not.toMatch(/from ["']@\/lib\/(slot-orders|db-pg)["']/);
  });

  it("theo token màu (không hex trong class) và nhãn nút không có dấu '+' (DEC-022, DEC-035)", () => {
    for (const f of [PAGE, CALC]) {
      const s = read(f);
      expect(s, f).toBeTruthy();
      expect(s, f).not.toMatch(/-\[#[0-9a-fA-F]{3,8}\]/);
      expect(s, f).not.toMatch(/(<span>|["'`{>])\+\s+[A-ZĐÀ-Ỹ]/);
    }
  });
});

describe("2. Trang /pricing khi có đơn giá (TC-W16)", () => {
  it("giá 25000 → chứa '25.000', '1 slot = 1 học sinh', tiêu đề và đơn vị / slot", async () => {
    const html = await renderPage(25000);
    const t = text(html);
    expect(html).toContain("25.000");
    expect(t).toContain("1 slot = 1 học sinh");
    expect(t).toContain("Bảng giá KitoKit");
    expect(t).toContain("Trả theo số học sinh và số tháng học thật");
    expect(t).toMatch(/25\.000\s*đ\s*\/\s*slot/);
    expect(t).not.toContain("Liên hệ để nhận báo giá");
  });

  it("chống hard-code: giá 40000 → '40.000', không còn '25.000'", async () => {
    const html = await renderPage(40000);
    expect(html).toContain("40.000");
    expect(html).not.toContain("25.000");
    expect(text(html)).toMatch(/40\.000\s*đ\s*\/\s*slot/);
  });

  it("có máy tính mặc định 30 học sinh × 3 tháng = 90 slot, 2.250.000 đ", async () => {
    const t = text(await renderPage(25000));
    expect(t).toContain("90");
    expect(t).toContain("2.250.000");
  });

  it("có mục 'Cách tính' với đủ các quy tắc", async () => {
    const html = await renderPage(25000);
    expect(html).toMatch(/<li/);
    const t = text(html);
    expect(t).toContain("Cách tính");
    expect(t).toMatch(/7 ngày/);
    expect(t).toMatch(/ân hạn/i);
    expect(t).toMatch(/tạm khoá|tạm khóa/i);
    expect(t).toMatch(/không hoàn/i);
    expect(t).toMatch(/2 lớp/);
    expect(t).toMatch(/2 slot/);
    expect(t).toMatch(/dùng thử/i);
    expect(t).toMatch(/1 lớp/);
    expect(t).toMatch(/3 học sinh/);
  });

  it("nút 'Đăng ký giáo viên' → /register/teacher và link 'Chính sách thanh toán' → /payment-policy", async () => {
    const html = await renderPage(25000);
    expect(html).toMatch(/<a[^>]*href="\/register\/teacher"[^>]*>[\s\S]*?Đăng ký giáo viên/);
    expect(html).toMatch(/<a[^>]*href="\/payment-policy"[^>]*>[\s\S]*?Chính sách thanh toán/);
  });

  it("không hiện lỗi hay nút có dấu '+' ở nhãn", async () => {
    const t = text(await renderPage(25000));
    expect(t).not.toMatch(/(^|\s)\+\s+[A-ZĐÀ-Ỹ]/);
  });
});

describe("3. Trang /pricing khi chưa cấu hình giá (BR-W13)", () => {
  it("giá 0 → 'Liên hệ để nhận báo giá', hotline (tel:) và email; không có '0 đ / slot'", async () => {
    const { BRAND } = await import("@/lib/brand");
    const html = await renderPage(0);
    const t = text(html);
    expect(t).toContain("Liên hệ để nhận báo giá");
    expect(t).toContain(BRAND.company.hotline);
    expect(html).toMatch(new RegExp(`href="tel:[^"]*${BRAND.company.hotlineRaw}[^"]*"|href="tel:[^"]*${BRAND.company.hotline.replace(/\s+/g, "\\s*")}[^"]*"`));
    expect(html).toContain(BRAND.company.email);
    expect(t).not.toMatch(/0\s*đ\s*\/\s*slot/);
    expect(t).toContain("1 slot = 1 học sinh");
  });

  it("giá 0 → ẩn dòng chi phí ước tính nhưng vẫn có nút đăng ký giáo viên", async () => {
    const html = await renderPage(0);
    expect(text(html)).not.toContain("Chi phí ước tính");
    expect(html).toContain('href="/register/teacher"');
  });

  it("giá âm → coi như chưa cấu hình", async () => {
    const t = text(await renderPage(-5));
    expect(t).toContain("Liên hệ để nhận báo giá");
    expect(t).not.toMatch(/-5/);
  });
});

describe("4. PricingCalculator", () => {
  it("30 học sinh × 3 tháng, giá 25000 → 90 slot và '2.250.000'", async () => {
    const t = text(await renderCalc(25000));
    expect(t).toContain("Số học sinh");
    expect(t).toContain("Số tháng");
    expect(t).toMatch(/Số slot cần[^0-9]*90\b/);
    expect(t).toMatch(/Chi phí ước tính[^0-9]*2\.250\.000\s*đ/);
  });

  it("chống hard-code: giá 40000 → 90 slot và '3.600.000'; giá 1000 → '90.000'", async () => {
    const t = text(await renderCalc(40000));
    expect(t).toMatch(/Số slot cần[^0-9]*90\b/);
    expect(t).toContain("3.600.000");
    expect(t).not.toContain("2.250.000");
    expect(text(await renderCalc(1000))).toContain("90.000");
  });

  it("có hai ô nhập số nguyên với giới hạn 1–1000 và 1–24, mặc định 30 và 3", async () => {
    const html = await renderCalc(25000);
    const inputs = [...html.matchAll(/<input[^>]*>/g)].map((m) => m[0]);
    expect(inputs.length).toBeGreaterThanOrEqual(2);
    expect(inputs.some((i) => /value="30"/.test(i))).toBe(true);
    expect(inputs.some((i) => /value="3"/.test(i))).toBe(true);
    expect(html).toMatch(/max="1000"/);
    expect(html).toMatch(/max="24"/);
  });

  it("giá 0 → ẩn dòng chi phí", async () => {
    const t = text(await renderCalc(0));
    expect(t).not.toContain("Chi phí ước tính");
    expect(t).not.toMatch(/0\s*đ\s*\/\s*slot/);
  });

  for (const bad of ["0", "1001", "abc", "-5", "2.5", ""]) {
    it(`Số học sinh = '${bad}' → hiện lỗi dưới ô, không hiện chi phí`, async () => {
      const html = await renderCalc(25000, bad);
      const t = text(html);
      expect(t, "phải có thông báo lỗi").toMatch(/1\s*(–|-|đến)\s*1000|không hợp lệ|số nguyên/i);
      expect(t).not.toContain("Chi phí ước tính");
      expect(t).not.toContain("2.250.000");
      expect(t).not.toContain("75.075.000");
    });
  }

  it("Số tháng = 25 hoặc 0 → hiện lỗi, không hiện chi phí", async () => {
    for (const bad of ["25", "0", "abc"]) {
      const t = text(await renderCalc(25000, null, bad));
      expect(t, bad).toMatch(/1\s*(–|-|đến)\s*24|không hợp lệ|số nguyên/i);
      expect(t, bad).not.toContain("Chi phí ước tính");
    }
  });

  it("biên hợp lệ: 1000 học sinh × 24 tháng → 24.000 slot, 600.000.000 đ; 1 × 1 → 1 slot, 25.000 đ", async () => {
    const t1 = text(await renderCalc(25000, "1000", "24"));
    expect(t1).toMatch(/Số slot cần[^0-9]*24\.000\b/);
    expect(t1).toContain("600.000.000");
    const t2 = text(await renderCalc(25000, "1", "1"));
    expect(t2).toMatch(/Số slot cần[^0-9]*1\b/);
    expect(t2).toMatch(/Chi phí ước tính[^0-9]*25\.000\s*đ/);
    expect(t2).not.toMatch(/không hợp lệ/i);
  });

  it("không gọi API từ client khi render", async () => {
    await renderCalc(25000);
    expect(h.fetchCalls).toBe(0);
  });
});

describe("5. Link 'Bảng giá' ở header và footer landing", () => {
  it("LandingHeader render có link /pricing với nhãn 'Bảng giá'", async () => {
    const Header = (await import("@/components/landing/LandingHeader")).default as any;
    const html = renderToStaticMarkup(createElement(Header));
    expect(html).toMatch(/<a[^>]*href="\/pricing"[^>]*>\s*Bảng giá\s*</);
  });

  it("LandingFooter render có link /pricing với nhãn 'Bảng giá'", async () => {
    const Footer = (await import("@/components/landing/LandingFooter")).default as any;
    const html = renderToStaticMarkup(createElement(Footer));
    expect(html).toMatch(/<a[^>]*href="\/pricing"[^>]*>\s*Bảng giá\s*</);
  });

  it("giữ nguyên các link cũ của header/footer", () => {
    expect(read(HEADER)).toContain("#tinh-nang");
    expect(read(HEADER)).toContain('"/login"');
    expect(read(FOOTER)).toContain("/payment-policy");
    expect(read(FOOTER)).toContain("https://inova.io.vn");
  });
});

describe("6. Metadata", () => {
  it("export metadata.title tiếng Việt có chữ 'giá'", async () => {
    const mod: any = await import("@/app/pricing/page");
    const title = typeof mod.metadata?.title === "string" ? mod.metadata.title : mod.metadata?.title?.absolute ?? mod.metadata?.title?.default;
    expect(typeof title).toBe("string");
    expect(title).toMatch(/giá/i);
    expect(mod.dynamic).toBe("force-dynamic");
  });
});
