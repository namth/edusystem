// Quy tắc design system (DEC-022): gradient chỉ trong một dải màu, không pha xanh (brand) với cam (accent).
// File do trưởng phòng viết, bị khoá.
import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

function walk(dir: string, out: string[] = []): string[] {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (/\.tsx?$/.test(e.name)) out.push(p);
  }
  return out;
}

const FILES = [...walk("app"), ...walk("components")];
const GRADIENT_STOP = /\b(?:from|via|to)-(brand|accent)-\d{2,3}\b/g;

describe("Gradient không pha xanh với cam", () => {
  it("mỗi chuỗi class có gradient chỉ dùng một dải màu", () => {
    const bad: string[] = [];
    for (const f of FILES) {
      const src = fs.readFileSync(f, "utf8");
      for (const m of src.matchAll(/["'`]([^"'`]*bg-gradient-[^"'`]*)["'`]/g)) {
        const families = new Set([...m[1].matchAll(GRADIENT_STOP)].map((x) => x[1]));
        if (families.size > 1) bad.push(`${f}: ${m[1].slice(0, 120)}`);
      }
    }
    expect(bad).toEqual([]);
  });

  it("thanh tiến độ phỏng vấn đi từ xanh đậm sang xanh nhạt", () => {
    const s = fs.readFileSync("components/onboarding/InterviewShell.tsx", "utf8");
    expect(s).toMatch(/from-brand-(6|7|8)00[^"]*to-brand-(2|3|4)00/);
    expect(s).not.toMatch(/to-accent/);
  });
});

describe("Đăng xuất bỏ hẳn phiên cũ", () => {
  it("logout chờ server rồi tải lại /login (không dùng router.push ngay sau logout)", () => {
    const ctx = fs.readFileSync("context/AuthContext.tsx", "utf8");
    const body = ctx.slice(ctx.indexOf("const logout = async"), ctx.indexOf("const logout = async") + 900);
    expect(body).toMatch(/await fetch\("\/api\/auth\/logout"/);
    expect(body).toMatch(/window\.location\.replace\("\/login"\)/);
    for (const f of ["components/AdminLayout.tsx", "components/TeacherLayout.tsx", "components/StudentLayout.tsx"]) {
      expect(fs.readFileSync(f, "utf8"), f).not.toMatch(/logout\(\);\s*\n\s*router\.push/);
    }
  });
});
