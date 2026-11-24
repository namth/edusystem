// TASK-049/050 · FEAT-016 §6.2 — API cảnh báo admin + route nội bộ cho worker.
/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createFakePg } from "./helpers/pg-fake";

const h = vi.hoisted(() => {
  process.env.JWT_SECRET = "test_secret_for_vitest_only_0123456789abcdef";
  return { token: undefined as string | undefined, pg: null as any };
});
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (n: string) => (n === "auth_token" && h.token ? { value: h.token } : undefined),
    set: () => {},
  }),
}));
vi.mock("@/lib/db-pg", () => ({ queryPg: (sql: string, params?: unknown[]) => h.pg.queryPg(sql, params) }));

import { signJwtToken } from "@/lib/jwt";
import { __resetAlertStateForTests } from "@/lib/admin-alerts";

async function loginAs(role: "ADMIN" | "TEACHER" | "STUDENT" | null, userId = "u1") {
  h.token = role ? await signJwtToken({ userId, email: `${userId}@x.vn`, role }) : undefined;
}
const req = (method: string, url: string, body?: unknown, headers: Record<string, string> = {}) =>
  new Request(`http://localhost${url}`, {
    method,
    headers: { "Content-Type": "application/json", ...headers },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
const ctx = (id: string) => ({ params: Promise.resolve({ id }) });
let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(async () => {
  h.token = undefined;
  h.pg = await createFakePg(["db-migration-018-admin-alerts.sql"]);
  __resetAlertStateForTests();
  await h.pg.db.exec(`
    INSERT INTO admin_alerts (id, fingerprint, level, source, title, status, occurrences, last_seen_at) VALUES
      ('a1','f1','ERROR','API','Lỗi API','NEW',3, NOW() - interval '1 minute'),
      ('a2','f2','WARN','EXAM_IMPORT','Dạng chưa hỗ trợ','NEW',1, NOW()),
      ('a3','f3','ERROR','AI','AI lỗi','RESOLVED',2, NOW() - interval '1 hour');
  `);
  process.env.INTERNAL_API_TOKEN = "internal-secret";
  delete process.env.TELEGRAM_BOT_TOKEN;
  delete process.env.TELEGRAM_ALERT_CHAT_ID;
  fetchMock = vi.fn(async () => new Response(JSON.stringify({ ok: true }), { status: 200 }));
  vi.stubGlobal("fetch", fetchMock);
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("GET /api/admin/alerts", () => {
  const get = async (q = "") => (await import("@/app/api/admin/alerts/route")).GET(req("GET", `/api/admin/alerts${q}`));

  it("TC-W10: không phiên 401, TEACHER/STUDENT 403", async () => {
    expect((await get()).status).toBe(401);
    await loginAs("TEACHER");
    expect((await get()).status).toBe(403);
    await loginAs("STUDENT");
    expect((await get()).status).toBe(403);
  });

  it("mặc định NEW, sắp lần cuối mới nhất trước; counts.NEW; telegram.configured", async () => {
    await loginAs("ADMIN");
    const body = await (await get()).json();
    expect(body.items.map((i: any) => i.id)).toEqual(["a2", "a1"]);
    expect(body).toMatchObject({ total: 2, page: 1, counts: { NEW: 2 }, telegram: { configured: false } });
    process.env.TELEGRAM_BOT_TOKEN = "t";
    process.env.TELEGRAM_ALERT_CHAT_ID = "c";
    expect((await (await get()).json()).telegram.configured).toBe(true);
  });

  it("lọc status/level/source; tham số sai → 400", async () => {
    await loginAs("ADMIN");
    expect((await (await get("?status=ALL")).json()).total).toBe(3);
    expect((await (await get("?status=RESOLVED")).json()).items.map((i: any) => i.id)).toEqual(["a3"]);
    expect((await (await get("?status=ALL&level=ERROR&source=AI")).json()).items.map((i: any) => i.id)).toEqual(["a3"]);
    expect((await get("?status=XX")).status).toBe(400);
    expect((await get("?level=FATAL")).status).toBe(400);
    expect((await get("?page=0")).status).toBe(400);
  });
});

describe("PATCH /api/admin/alerts/[id]", () => {
  const patch = async (id: string, body: unknown) =>
    (await import("@/app/api/admin/alerts/[id]/route")).PATCH(req("PATCH", `/api/admin/alerts/${id}`, body), ctx(id));

  it("TEACHER 403; ADMIN đánh dấu RESOLVED ghi resolved_by; mở lại xoá resolved_*", async () => {
    await loginAs("TEACHER");
    expect((await patch("a1", { status: "RESOLVED" })).status).toBe(403);
    await loginAs("ADMIN", "admin9");
    const r1 = await (await patch("a1", { status: "RESOLVED" })).json();
    expect(r1.alert).toMatchObject({ status: "RESOLVED", resolved_by: "admin9" });
    const r2 = await (await patch("a1", { status: "NEW" })).json();
    expect(r2.alert).toMatchObject({ status: "NEW", resolved_by: null, resolved_at: null });
  });

  it("id lạ → 404; status sai → 400", async () => {
    await loginAs("ADMIN");
    expect((await patch("zzz", { status: "RESOLVED" })).status).toBe(404);
    expect((await patch("a1", { status: "DONE" })).status).toBe(400);
  });
});

describe("POST /api/admin/alerts/test", () => {
  const post = async () => (await import("@/app/api/admin/alerts/test/route")).POST();

  it("chưa cấu hình → 400; Telegram từ chối → 502 không lộ token; OK → 200 và không tạo dòng cảnh báo", async () => {
    await loginAs("TEACHER");
    expect((await post()).status).toBe(403);
    await loginAs("ADMIN");
    expect((await post()).status).toBe(400);
    process.env.TELEGRAM_BOT_TOKEN = "999:TOPSECRET";
    process.env.TELEGRAM_ALERT_CHAT_ID = "-1";
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ description: "Unauthorized" }), { status: 401 }));
    const bad = await post();
    expect(bad.status).toBe(502);
    expect(JSON.stringify(await bad.json())).not.toContain("TOPSECRET");
    for (let i = 0; i < 3; i++) expect((await post()).status).toBe(200);
    expect(Number((await h.pg.db.query(`SELECT COUNT(*) n FROM admin_alerts`)).rows[0].n)).toBe(3);
  });
});

describe("POST /api/internal/alerts (worker)", () => {
  const post = async (body: unknown, token?: string) =>
    (await import("@/app/api/internal/alerts/route")).POST(
      req("POST", "/api/internal/alerts", body, token ? { "x-internal-token": token } : {})
    );

  it("TC-W11: thiếu/sai token → 401; thiếu title → 400; nguồn luôn WORKER, fingerprint có tiền tố WORKER:", async () => {
    expect((await post({ title: "x" })).status).toBe(401);
    expect((await post({ title: "x" }, "sai")).status).toBe(401);
    expect((await post({ level: "ERROR" }, "internal-secret")).status).toBe(400);
    expect((await post({ title: "x", level: "FATAL" }, "internal-secret")).status).toBe(400);
    const ok = await post({ title: "Worker mất Redis", level: "ERROR", fingerprint: "REDIS_DOWN", source: "API" }, "internal-secret");
    expect(ok.status).toBe(200);
    const row = (await h.pg.db.query(`SELECT * FROM admin_alerts WHERE title = 'Worker mất Redis'`)).rows[0];
    expect(row).toMatchObject({ source: "WORKER", fingerprint: "WORKER:REDIS_DOWN", level: "ERROR" });
  });
});
