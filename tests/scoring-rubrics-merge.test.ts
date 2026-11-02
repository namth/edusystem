// TASK-040 — FEAT-013 §4, DEC-030: gộp "Bộ tiêu chí AI" vào trang Chuẩn chấm điểm (2 tab).
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
    usePathname: () => "/admin/scoring-standards",
  };
});

const read = (f: string) => fs.readFileSync(f, "utf8");
const RM = "components/admin/RubricManager.tsx";
const SS = "app/admin/scoring-standards/page.tsx";

beforeEach(() => { h.redirects.length = 0; });

describe("/admin/rubrics chuyển hướng sang tab rubrics", () => {
  it("trang là server component, gọi (permanent)redirect tới /admin/scoring-standards?tab=rubrics", async () => {
    const src = read("app/admin/rubrics/page.tsx");
    expect(src).not.toMatch(/^\s*["']use client["']/);
    expect(src.split("\n").length).toBeLessThan(30);
    const mod = await import("@/app/admin/rubrics/page");
    try { await (mod.default as any)({ searchParams: Promise.resolve({}) }); } catch { /* NEXT_REDIRECT */ }
    expect(h.redirects).toEqual(["/admin/scoring-standards?tab=rubrics"]);
  });

  it("giữ ?rubric=<id> khi chuyển hướng (link cũ trỏ tiêu chí cụ thể)", async () => {
    const mod = await import("@/app/admin/rubrics/page");
    try { await (mod.default as any)({ searchParams: Promise.resolve({ rubric: "rubric_ielts_writing" }) }); } catch { /* NEXT_REDIRECT */ }
    expect(h.redirects).toEqual(["/admin/scoring-standards?tab=rubrics&rubric=rubric_ielts_writing"]);
  });
});

describe("components/admin/RubricManager.tsx — nội dung trang tiêu chí cũ", () => {
  it("là client component, không tự bọc AdminLayout, nhận initialRubricId", () => {
    const s = read(RM);
    expect(s.trimStart().startsWith('"use client"')).toBe(true);
    expect(s).not.toMatch(/AdminLayout/);
    expect(s).toMatch(/export default function RubricManager/);
    expect(s).toMatch(/initialRubricId/);
  });

  it("giữ đủ CRUD qua /api/exam/rubrics (GET, POST, PUT, DELETE) và các trường tiêu chí", () => {
    const s = read(RM);
    expect(s).toContain('"/api/exam/rubrics"');
    expect(s).toMatch(/method:\s*["']DELETE["']/);
    expect(s).toMatch(/method:\s*(editingRubric\s*\?\s*["']PUT["']\s*:\s*["']POST["']|["']POST["'])/);
    for (const k of ["criteria", "scale_min", "scale_max", "scale_step", "output_language", "framework"]) expect(s, k).toContain(k);
    expect(s.split("\n").length).toBeGreaterThan(300);           // không cắt bớt chức năng khi chuyển
  });

  it("có ô tìm kiếm riêng (thanh tìm kiếm của AdminLayout không còn dùng cho tab này)", () => {
    expect(read(RM)).toMatch(/<input[^>]*placeholder="[^"]*[Tt]ìm/);
  });
});

describe("Trang /admin/scoring-standards có 2 tab đồng bộ ?tab=", () => {
  it("dùng useSearchParams, bọc Suspense, đọc tab=rubrics, cập nhật URL khi đổi tab", () => {
    const s = read(SS);
    expect(s.trimStart().startsWith('"use client"')).toBe(true);
    expect(s).toMatch(/useSearchParams/);
    expect(s).toMatch(/<Suspense/);
    expect(s).toMatch(/["']rubrics["']/);
    expect(s).toMatch(/["']standards["']/);
    expect(s).toMatch(/router\.(replace|push)\([^)]*tab=/);
  });

  it("hiển thị nhãn 2 tab và nhúng <RubricManager initialRubricId=…>", () => {
    const s = read(SS);
    expect(s).toContain("Chuẩn chấm");
    expect(s).toContain("Bộ tiêu chí AI");
    expect(s).toMatch(/import RubricManager from ["']@\/components\/admin\/RubricManager["']/);
    expect(s).toMatch(/<RubricManager[^>]*initialRubricId=/);
  });

  it("cạnh ô chọn tiêu chí trong form chuẩn có link 'Sửa tiêu chí này' mở tab rubrics đúng tiêu chí", () => {
    const s = read(SS);
    expect(s).toContain("Sửa tiêu chí này");
    expect(s).toMatch(/tab=rubrics&rubric=\$\{/);
  });
});

describe("Menu admin", () => {
  it("không còn mục /admin/rubrics; còn 'Chuẩn Chấm Điểm'", () => {
    const s = read("components/AdminLayout.tsx");
    expect(s).not.toContain('"/admin/rubrics"');
    expect(s).not.toMatch(/Quản Lý Tiêu Chí Chấm Điểm/);
    expect(s).toContain("/admin/scoring-standards");
  });

  it("không còn link nào trong app/ & components/ trỏ thẳng /admin/rubrics (trừ trang chuyển hướng)", () => {
    const walk = (d: string, out: string[] = []): string[] => {
      for (const e of fs.readdirSync(d, { withFileTypes: true })) {
        const p = `${d}/${e.name}`;
        if (e.isDirectory()) walk(p, out); else if (/\.tsx?$/.test(e.name)) out.push(p);
      }
      return out;
    };
    const bad = [...walk("app"), ...walk("components")]
      .filter((f) => f !== "app/admin/rubrics/page.tsx")
      .filter((f) => /["'`]\/admin\/rubrics/.test(read(f)));
    expect(bad).toEqual([]);
  });
});
