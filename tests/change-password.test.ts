// Đổi mật khẩu lần đầu / tự đổi — lỗi 01/11/2026: hàm updatePasswordAndProfile là stub nên mật khẩu
// không bao giờ được lưu; API cho người chưa đăng nhập đổi mật khẩu bất kỳ ai qua body.userId.
import { describe, it, expect, vi, beforeEach } from "vitest";
import fs from "fs";
import { createFakePg } from "./helpers/pg-fake";

const h = vi.hoisted(() => {
  process.env.JWT_SECRET = "test_secret_for_vitest_only_0123456789abcdef";
  return { token: undefined as string | undefined, pg: null as any };
});

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (n: string) => (n === "auth_token" && h.token ? { value: h.token } : undefined),
    set: (n: string, v: string) => { if (n === "auth_token") h.token = v; },
    delete: () => { h.token = undefined; },
  }),
}));
vi.mock("@/lib/db-pg", () => ({
  queryPg: (sql: string, params?: unknown[]) => h.pg.queryPg(sql, params),
  ensureSchema: async () => {},
}));

import { hashPassword } from "@/lib/auth";

const req = (url: string, body: unknown) =>
  new Request(`http://localhost${url}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
const login = async (identifier: string, password: string) =>
  (await import("@/app/api/auth/login/route")).POST(req("/api/auth/login", { identifier, password }));
const change = async (body: unknown) => (await import("@/app/api/auth/change-password/route")).POST(req("/api/auth/change-password", body));
const rows = async (sql: string, p?: unknown[]) => (await h.pg.db.query(sql, p)).rows;

beforeEach(async () => {
  h.token = undefined;
  h.pg = await createFakePg();
  await h.pg.db.exec(`ALTER TABLE users ADD COLUMN must_change_password BOOLEAN DEFAULT FALSE; ALTER TABLE users ADD COLUMN last_login_at TIMESTAMPTZ;`);
  await h.pg.db.query(
    `INSERT INTO users (id,name,email,role,password,must_change_password) VALUES
     ('t1','GV','gv@x.vn','TEACHER',$1,TRUE), ('s1','HS','hs@x.vn','STUDENT',$2,FALSE)`,
    [hashPassword("TamThoi@123"), hashPassword("DangDung@123")]
  );
});

describe("POST /api/auth/change-password", () => {
  it("chưa đăng nhập → 401 kể cả khi gửi userId trong body; mật khẩu không đổi", async () => {
    const res = await change({ userId: "s1", newPassword: "HackMoi@123" });
    expect(res.status).toBe(401);
    expect((await login("hs@x.vn", "DangDung@123")).status).toBe(200);
  });

  it("lần đầu (must_change_password): đổi được không cần mật khẩu cũ; đăng xuất → đăng nhập bằng mật khẩu MỚI, không còn bị bắt đổi", async () => {
    const l1 = await login("gv@x.vn", "TamThoi@123");
    expect((await l1.json()).user.mustChangePassword).toBe(true);
    const res = await change({ newPassword: "MoiCuaToi@456" });
    expect(res.status).toBe(200);

    h.token = undefined; // đăng xuất
    expect((await login("gv@x.vn", "TamThoi@123")).status).toBe(401);
    const l2 = await login("gv@x.vn", "MoiCuaToi@456");
    expect(l2.status).toBe(200);
    expect((await l2.json()).user.mustChangePassword).toBe(false);
    expect((await rows(`SELECT must_change_password FROM users WHERE id='t1'`))[0].must_change_password).toBe(false);
  });

  it("tự đổi về sau: thiếu hoặc sai mật khẩu hiện tại → 403; đúng → 200", async () => {
    await login("hs@x.vn", "DangDung@123");
    expect((await change({ newPassword: "KhacHan@789" })).status).toBe(403);
    expect((await change({ currentPassword: "Sai@123", newPassword: "KhacHan@789" })).status).toBe(403);
    expect((await change({ currentPassword: "DangDung@123", newPassword: "KhacHan@789" })).status).toBe(200);
    h.token = undefined;
    expect((await login("hs@x.vn", "KhacHan@789")).status).toBe(200);
  });

  it("mật khẩu yếu hoặc trùng mật khẩu cũ → 400", async () => {
    await login("gv@x.vn", "TamThoi@123");
    expect((await change({ newPassword: "123" })).status).toBe(400);
    expect((await change({ newPassword: "TamThoi@123" })).status).toBe(400);
  });
});

describe("Trang đổi mật khẩu lần đầu gọi API thật", () => {
  it("AuthContext.updatePasswordAndProfile gọi /api/auth/change-password và /api/profile, trả lỗi về trang", () => {
    const ctx = fs.readFileSync("context/AuthContext.tsx", "utf8");
    const fn = ctx.slice(ctx.indexOf("const updatePasswordAndProfile"), ctx.indexOf("const resetPasswordForEmail"));
    expect(fn).toContain("/api/auth/change-password");
    expect(fn).toContain("/api/profile");
    expect(fs.readFileSync("app/change-password/page.tsx", "utf8")).toMatch(/result\.error/);
  });
  it("trang hồ sơ gửi mật khẩu hiện tại khi tự đổi", () => {
    expect(fs.readFileSync("app/profile/page.tsx", "utf8")).toMatch(/currentPassword,\s*\n\s*newPassword/);
  });
});
