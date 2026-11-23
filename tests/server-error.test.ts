// TASK-048 · FEAT-016 §6.1 — serverError và onRequestError đều báo admin.
/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from "vitest";

const h = vi.hoisted(() => ({ calls: [] as any[] }));
vi.mock("@/lib/admin-alerts", async (orig) => {
  const real = await orig<typeof import("@/lib/admin-alerts")>();
  return { ...real, reportAlert: async (a: unknown) => { h.calls.push(a); } };
});

import { serverError, DEFAULT_SERVER_ERROR } from "@/lib/api-errors";

beforeEach(() => {
  h.calls = [];
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("serverError", () => {
  it("TC-W08: trả 500 { success:false, error } và báo admin; fingerprint không chứa thông điệp lỗi", async () => {
    const err = Object.assign(new TypeError("Cannot read id of sub_123"), { code: "E42" });
    const res = serverError(err, { route: "/api/exam/submit", method: "POST", userId: "u1", role: "STUDENT", message: "Lỗi nộp bài." });
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ success: false, error: "Lỗi nộp bài." });
    expect(h.calls).toHaveLength(1);
    expect(h.calls[0]).toMatchObject({
      level: "ERROR",
      source: "API",
      fingerprint: "API:POST /api/exam/submit:TypeError:E42",
      detail: { route: "/api/exam/submit", method: "POST", userId: "u1", role: "STUDENT", message: "Cannot read id of sub_123" },
    });
    expect(h.calls[0].fingerprint).not.toContain("sub_123");
  });

  it("không có message → thông điệp chung; lỗi không phải Error vẫn chạy", async () => {
    const res = serverError("boom", { route: "/api/x", method: "GET" });
    expect(await res.json()).toEqual({ success: false, error: DEFAULT_SERVER_ERROR });
    expect(h.calls[0].fingerprint).toBe("API:GET /api/x:string");
  });
});

describe("onRequestError (instrumentation.ts)", () => {
  it("TC-W12: lỗi chưa bắt → reportAlert nguồn SERVER", async () => {
    process.env.NEXT_RUNTIME = "nodejs";
    const { onRequestError } = await import("@/instrumentation");
    await onRequestError(new RangeError("bad"), { path: "/teacher/x", method: "GET" }, { routePath: "/teacher/[id]", routeType: "render" });
    expect(h.calls[0]).toMatchObject({ level: "ERROR", source: "SERVER", fingerprint: "SERVER:/teacher/[id]:RangeError" });
    delete process.env.NEXT_RUNTIME;
  });
});
