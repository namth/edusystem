// Kiểm tra biến môi trường lúc khởi động — production thiếu biến bắt buộc thì dừng.
import { describe, it, expect, vi } from "vitest";
import { findEnvProblems, validateEnvironmentVars } from "@/lib/env-check";

const OK = {
  DATABASE_URL: "postgres://x", JWT_SECRET: "x".repeat(32), INTERNAL_API_TOKEN: "t", REDIS_URL: "redis://r",
  PORTKEY_API_KEY: "k", GOOGLE_API_KEY: "g", NEXT_PUBLIC_SUPABASE_URL: "u", SUPABASE_SERVICE_ROLE_KEY: "s", NEO4J_URI: "n",
};

describe("lib/env-check", () => {
  it("đủ biến → không lỗi, không cảnh báo", () => {
    expect(findEnvProblems(OK)).toEqual({ errors: [], warnings: [] });
  });

  it("thiếu biến bắt buộc / JWT_SECRET ngắn → lỗi", () => {
    const { errors } = findEnvProblems({ ...OK, INTERNAL_API_TOKEN: "", JWT_SECRET: "ngan" });
    expect(errors).toEqual(["Thiếu INTERNAL_API_TOKEN", "JWT_SECRET ngắn hơn 32 ký tự"]);
  });

  it("production thiếu biến bắt buộc → ném lỗi; dev chỉ cảnh báo", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(() => validateEnvironmentVars({ ...OK, REDIS_URL: undefined, NODE_ENV: "production" })).toThrow(/REDIS_URL/);
    expect(() => validateEnvironmentVars({ ...OK, REDIS_URL: undefined, NODE_ENV: "development" })).not.toThrow();
    warn.mockRestore();
  });

  it("thiếu biến khuyến nghị → chỉ cảnh báo kể cả production", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(() => validateEnvironmentVars({ ...OK, PORTKEY_API_KEY: "", NODE_ENV: "production" })).not.toThrow();
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });
});
