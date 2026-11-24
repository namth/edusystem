// TASK-049 · FEAT-016 BR-W08 — mọi nhánh 500 của app/api/** phải đi qua serverError (để admin được báo).
import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

function routes(dir: string, out: string[] = []): string[] {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) routes(p, out);
    else if (e.name === "route.ts") out.push(p);
  }
  return out;
}

describe("BR-W08: không route nào tự trả 500", () => {
  it("TC-W09: không file app/api/**/route.ts nào còn `status: 500`", () => {
    const bad = routes("app/api").filter((f) => /status:\s*500/.test(fs.readFileSync(f, "utf8")));
    expect(bad).toEqual([]);
  });

  it("route có dùng serverError thì import từ @/lib/api-errors", () => {
    const bad = routes("app/api").filter((f) => {
      const s = fs.readFileSync(f, "utf8");
      return s.includes("serverError(") && !s.includes('from "@/lib/api-errors"');
    });
    expect(bad).toEqual([]);
  });

  it("worker báo admin khi bỏ cuộc và khi mất Redis (BR-W10)", () => {
    const src = fs.readFileSync("worker/grading-worker.js", "utf8");
    expect(src).toContain("/api/internal/alerts");
    expect(src).toContain("WORKER:GIVE_UP:");
    expect(src).toContain("WORKER:REDIS_DOWN");
  });
});
