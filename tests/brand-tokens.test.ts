// Thương hiệu KitoKit: màu đi qua token (app/globals.css @theme), không viết cứng mã hex, không còn tên cũ.
import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

function walk(dir: string, out: string[] = []): string[] {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (/\.(tsx|ts)$/.test(e.name)) out.push(p);
  }
  return out;
}
const FILES = [...walk("app"), ...walk("components")];

describe("Token màu thương hiệu", () => {
  it("globals.css khai báo @theme với brand/accent/ink/line/surface", () => {
    const css = fs.readFileSync("app/globals.css", "utf8");
    for (const t of ["--color-brand-600", "--color-accent-400", "--color-ink", "--color-line", "--color-surface-alt"]) expect(css).toContain(t);
  });

  it("không còn class màu hex tuỳ ý kiểu bg-[#...] trong app/ và components/", () => {
    const offenders = FILES.filter((f) => /-\[#[0-9a-fA-F]{3,8}\]/.test(fs.readFileSync(f, "utf8")));
    expect(offenders).toEqual([]);
  });

  it("không còn tên thương hiệu cũ", () => {
    const offenders = FILES.filter((f) => /EduTest|AURA English|English 4-Skills/.test(fs.readFileSync(f, "utf8")));
    expect(offenders).toEqual([]);
  });
});
