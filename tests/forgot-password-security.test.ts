// Vá lỗ hổng quên mật khẩu (docs/11 §4, BR-A): API không được lộ link/token đặt lại,
// phản hồi giống hệt nhau dù email có tồn tại hay không, không log token ra console.
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import fs from "fs";
import { createFakePg } from "./helpers/pg-fake";

const h = vi.hoisted(() => {
  process.env.JWT_SECRET = "test_secret_for_vitest_only_0123456789abcdef";
  return { pg: null as unknown as Awaited<ReturnType<typeof createFakePg>> };
});

vi.mock("@/lib/db-pg", () => ({
  queryPg: (sql: string, params?: unknown[]) => h.pg.queryPg(sql, params),
  ensureSchema: async () => {},
}));

const forgot = async (email: string) =>
  (await import("@/app/api/auth/forgot-password/route")).POST(
    new Request("http://localhost/api/auth/forgot-password", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-forwarded-for": "9.9.9.9" },
      body: JSON.stringify({ email }),
    })
  );
const tokenOf = async (email: string) =>
  (await h.pg.db.query(`SELECT reset_token FROM users WHERE email = $1`, [email])).rows[0]?.reset_token;

beforeEach(async () => {
  (await import("@/lib/rate-limit")).resetRateLimits();
  vi.unstubAllEnvs();
  h.pg = await createFakePg();
  await h.pg.db.exec(`
    ALTER TABLE users ADD COLUMN reset_token TEXT;
    ALTER TABLE users ADD COLUMN reset_token_expires TIMESTAMPTZ;
    INSERT INTO users (id,name,email,role,password) VALUES
      ('a1','Admin','admin@x.vn','ADMIN','x'),
      ('t1','GV','gv@x.vn','TEACHER','x');
  `);
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("POST /api/auth/forgot-password — không lộ token", () => {
  it("email tồn tại: tạo token trong DB nhưng response không chứa token / resetUrl", async () => {
    const res = await forgot("admin@x.vn");
    expect(res.status).toBe(200);
    const body = await res.json();
    const token = await tokenOf("admin@x.vn");
    expect(token).toBeTruthy();
    const text = JSON.stringify(body);
    expect(body.resetUrl).toBeUndefined();
    expect(text).not.toContain(token);
    expect(text).not.toContain("reset-password");
  });

  it("phản hồi giống hệt nhau giữa email có và không tồn tại (chống dò tài khoản)", async () => {
    const r1 = await forgot("gv@x.vn");
    const r2 = await forgot("khong.ton.tai@x.vn");
    expect(r1.status).toBe(r2.status);
    expect(await r1.json()).toEqual(await r2.json());
  });

  it("không log token hay link ra console", async () => {
    const spies = (["log", "info", "warn", "error", "debug"] as const).map((m) =>
      vi.spyOn(console, m).mockImplementation(() => {})
    );
    await forgot("admin@x.vn");
    const token = await tokenOf("admin@x.vn");
    const logged = spies.flatMap((s) => s.mock.calls.flat().map(String)).join("\n");
    expect(logged).not.toContain(token);
    expect(logged).not.toContain("reset-password?token");
  });

  it("ALLOW_DEV_RESET_LINK=1 ngoài production thì trả resetUrl đúng token (phục vụ dev/e2e)", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("ALLOW_DEV_RESET_LINK", "1");
    const body = await (await forgot("gv@x.vn")).json();
    const token = await tokenOf("gv@x.vn");
    expect(body.resetUrl).toBe(`/reset-password?token=${token}&email=${encodeURIComponent("gv@x.vn")}`);
  });

  it("production: kể cả bật ALLOW_DEV_RESET_LINK=1 cũng không trả resetUrl", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("ALLOW_DEV_RESET_LINK", "1");
    const body = await (await forgot("admin@x.vn")).json();
    expect(body.resetUrl).toBeUndefined();
    expect(JSON.stringify(body)).not.toContain(await tokenOf("admin@x.vn"));
  });

  it("không bật cờ (mặc định) thì dev cũng không trả resetUrl", async () => {
    vi.stubEnv("NODE_ENV", "development");
    const body = await (await forgot("admin@x.vn")).json();
    expect(body.resetUrl).toBeUndefined();
  });
});

describe("Trang /forgot-password", () => {
  it("hiển thị liên hệ hỗ trợ từ BRAND, không còn nói 'đã tạo liên kết'", () => {
    const s = fs.readFileSync("app/forgot-password/page.tsx", "utf8");
    expect(s).toContain("BRAND.company.hotline");
    expect(s).toContain("BRAND.company.contactEmail");
    expect(s).not.toMatch(/Đã tạo liên kết/);
  });
});
