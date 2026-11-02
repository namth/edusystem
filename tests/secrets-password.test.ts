// TASK-002 — Gỡ bí mật viết cứng & luồng mật khẩu plaintext.
// File này do trưởng phòng viết và bị khoá (tests.lock).
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import fs from "fs";
import path from "path";

const GOOD_SECRET = "test_secret_for_vitest_only_0123456789abcdef";

const h = vi.hoisted(() => {
  process.env.JWT_SECRET = "test_secret_for_vitest_only_0123456789abcdef";
  return {
    rows: [] as any[],
    queries: [] as { sql: string; params: unknown[] }[],
    cookiesSet: [] as string[],
  };
});

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: () => undefined,
    set: (name: string) => h.cookiesSet.push(name),
  }),
}));
vi.mock("@/lib/db-pg", () => ({
  queryPg: async (sql: string, params: unknown[] = []) => {
    h.queries.push({ sql, params });
    if (/^\s*SELECT/i.test(sql)) return { rows: h.rows, rowCount: h.rows.length };
    return { rows: [], rowCount: 1 };
  },
}));

import { signJwtToken, verifyJwtToken } from "@/lib/jwt";
import { hashPassword, comparePassword } from "@/lib/auth";

beforeEach(() => {
  process.env.JWT_SECRET = GOOD_SECRET;
  h.rows = [];
  h.queries.length = 0;
  h.cookiesSet.length = 0;
});
afterEach(() => {
  process.env.JWT_SECRET = GOOD_SECRET;
});

const payload = { userId: "usr_1", email: "a@b.vn", role: "ADMIN" };

describe("JWT_SECRET bắt buộc, đọc từ môi trường lúc gọi", () => {
  it("thiếu JWT_SECRET → signJwtToken ném lỗi nêu tên biến", async () => {
    delete process.env.JWT_SECRET;
    await expect(signJwtToken(payload)).rejects.toThrow(/JWT_SECRET/);
  });

  it("JWT_SECRET ngắn hơn 32 ký tự → signJwtToken ném lỗi", async () => {
    process.env.JWT_SECRET = "short_secret";
    await expect(signJwtToken(payload)).rejects.toThrow(/JWT_SECRET/);
  });

  it("thiếu JWT_SECRET → verifyJwtToken trả null (không ném)", async () => {
    const token = await signJwtToken(payload);
    delete process.env.JWT_SECRET;
    await expect(verifyJwtToken(token)).resolves.toBeNull();
  });

  it("token ký bằng secret A không hợp lệ khi đổi sang secret B", async () => {
    const token = await signJwtToken(payload);
    expect(await verifyJwtToken(token)).toMatchObject({ userId: "usr_1", role: "ADMIN" });
    process.env.JWT_SECRET = "another_secret_value_that_is_long_enough_42";
    expect(await verifyJwtToken(token)).toBeNull();
  });
});

describe("comparePassword không chấp nhận plaintext", () => {
  it("hash scrypt đúng → true, sai → false", () => {
    const stored = hashPassword("Matkhau@123");
    expect(comparePassword("Matkhau@123", stored)).toBe(true);
    expect(comparePassword("sai", stored)).toBe(false);
  });

  it("giá trị lưu là plaintext trùng khớp → vẫn false", () => {
    expect(comparePassword("123456", "123456")).toBe(false);
    expect(comparePassword("Matkhau@123", "Matkhau@123")).toBe(false);
  });

  it("giá trị lưu rỗng → false", () => {
    expect(comparePassword("", "")).toBe(false);
    expect(comparePassword("bat_ky", "")).toBe(false);
  });
});

describe("login: tài khoản chưa có hash scrypt không đăng nhập được", () => {
  async function login(identifier: string, password: string) {
    const { POST } = await import("@/app/api/auth/login/route");
    return POST(
      new Request("http://localhost/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier, password }),
      })
    );
  }
  const user = (password: string | null) => ({ id: "usr_legacy", email: "legacy@x.vn", name: "L", role: "ADMIN", password });

  it("mật khẩu lưu plaintext, nhập đúng → 401, không cấp cookie, không ghi đè mật khẩu", async () => {
    h.rows = [user("Matkhau@123")];
    const res = await login("legacy@x.vn", "Matkhau@123");
    expect(res.status).toBe(401);
    expect(h.cookiesSet).toEqual([]);
    expect(h.queries.some((q) => /UPDATE\s+users\s+SET\s+password/i.test(q.sql))).toBe(false);
  });

  it("mật khẩu lưu plaintext, nhập '123456' → 401", async () => {
    h.rows = [user("khac_hoan_toan")];
    const res = await login("legacy@x.vn", "123456");
    expect(res.status).toBe(401);
    expect(h.cookiesSet).toEqual([]);
  });

  it("mật khẩu lưu rỗng/null, nhập bất kỳ → 401", async () => {
    for (const stored of ["", null]) {
      h.rows = [user(stored)];
      h.cookiesSet.length = 0;
      const res = await login("legacy@x.vn", "gi_cung_duoc");
      expect(res.status).toBe(401);
      expect(h.cookiesSet).toEqual([]);
    }
  });

  it("hash scrypt hợp lệ, nhập đúng → 200 và cấp cookie auth_token (không hồi quy)", async () => {
    h.rows = [user(hashPassword("Matkhau@123"))];
    const res = await login("legacy@x.vn", "Matkhau@123");
    expect(res.status).toBe(200);
    expect(h.cookiesSet).toContain("auth_token");
  });
});

describe("register: không gán số điện thoại mặc định", () => {
  async function register(body: Record<string, unknown>) {
    const { POST } = await import("@/app/api/auth/register/route");
    return POST(
      new Request("http://localhost/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
    );
  }
  const insertParams = () => h.queries.find((q) => /INSERT\s+INTO\s+users/i.test(q.sql))?.params ?? [];

  it("không gửi phone → không lưu '0912345678'", async () => {
    const res = await register({ email: "moi@x.vn", password: "Matkhau@123", name: "Mới" });
    expect(res.status).toBeLessThan(300);
    expect(insertParams()).not.toContain("0912345678");
  });

  it("có gửi phone → lưu đúng giá trị đó", async () => {
    await register({ email: "moi2@x.vn", password: "Matkhau@123", name: "Mới", phone: "0987000111" });
    expect(insertParams()).toContain("0987000111");
  });
});

describe("Không còn bí mật / hạ tầng viết cứng trong mã nguồn", () => {
  const ROOT = path.resolve(__dirname, "..");
  const SKIP = new Set(["node_modules", ".next", ".git", "tests", "handoff", "stitch_english_mock_exam_portal", "public", ".agents", "scripts"]);
  const EXT = /\.(ts|tsx|js|jsx|cjs|mjs|yml|yaml)$/;
  const FORBIDDEN = [
    "edutest_pro_super_secret",
    "qereQScNVoecP8Kd",
    "owlvfznycutvkrvgbiot",
    "sb_publishable_8X7i9iuqijcB9IspKxOugA",
  ];

  function walk(dir: string, out: string[] = []) {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      if (SKIP.has(e.name)) continue;
      const p = path.join(dir, e.name);
      if (e.isDirectory()) walk(p, out);
      else if (EXT.test(e.name)) out.push(p);
    }
    return out;
  }

  it("không file mã nguồn nào chứa chuỗi bí mật đã lộ", () => {
    const hits: string[] = [];
    for (const f of walk(ROOT)) {
      const src = fs.readFileSync(f, "utf8");
      for (const s of FORBIDDEN) if (src.includes(s)) hits.push(`${path.relative(ROOT, f)}: ${s}`);
    }
    expect(hits).toEqual([]);
  });

  it("docker-compose truyền JWT_SECRET cho service nextjs", () => {
    const yml = fs.readFileSync(path.join(ROOT, "docker-compose.yml"), "utf8");
    expect(yml).toMatch(/JWT_SECRET=\$\{JWT_SECRET\}/);
  });

  it("validateEnvironmentVars cảnh báo thiếu JWT_SECRET và DATABASE_URL", async () => {
    const { validateEnvironmentVars } = await import("@/lib/env-check");
    const saved = { j: process.env.JWT_SECRET, d: process.env.DATABASE_URL };
    delete process.env.JWT_SECRET;
    delete process.env.DATABASE_URL;
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      try {
        validateEnvironmentVars();
      } catch {
        // cho phép ném lỗi trong production
      }
      const out = [...warn.mock.calls, ...error.mock.calls].flat().join(" ");
      expect(out).toContain("JWT_SECRET");
      expect(out).toContain("DATABASE_URL");
    } finally {
      warn.mockRestore();
      error.mockRestore();
      process.env.JWT_SECRET = saved.j;
      if (saved.d !== undefined) process.env.DATABASE_URL = saved.d;
    }
  });
});
