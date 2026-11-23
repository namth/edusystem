// TASK-048 · FEAT-016 §7 (BR-W01 → BR-W09) — lõi kênh cảnh báo admin: gộp, chống spam, làm sạch, DB lỗi.
/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createFakePg } from "./helpers/pg-fake";

const h = vi.hoisted(() => ({
  pg: null as null | Awaited<ReturnType<typeof import("./helpers/pg-fake").createFakePg>>,
  dbDown: false,
}));

vi.mock("@/lib/db-pg", () => ({
  queryPg: (sql: string, params?: unknown[]) => {
    if (h.dbDown) throw new Error("connect ECONNREFUSED");
    return h.pg!.queryPg(sql, params);
  },
}));

import { reportAlert, redactSensitive, __resetAlertStateForTests, NOTIFY_INTERVAL_MS, RETENTION_MS } from "@/lib/admin-alerts";

const T0 = new Date("2026-11-23T03:00:00Z").getTime();
let fetchMock: ReturnType<typeof vi.fn>;
const sentTexts = () => fetchMock.mock.calls.map((c) => JSON.parse((c[1] as RequestInit).body as string).text as string);
const rows = async () => (await h.pg!.db.query<any>(`SELECT * FROM admin_alerts ORDER BY first_seen_at, id`)).rows;
const alert = (fp: string, extra: Partial<Parameters<typeof reportAlert>[0]> = {}) =>
  reportAlert({ level: "ERROR", source: "API", title: `Lỗi ${fp}`, fingerprint: fp, ...extra });

beforeEach(async () => {
  h.dbDown = false;
  h.pg = await createFakePg(["db-migration-018-admin-alerts.sql"]);
  __resetAlertStateForTests();
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(T0);
  process.env.TELEGRAM_BOT_TOKEN = "123:SECRETTOKEN";
  process.env.TELEGRAM_ALERT_CHAT_ID = "-1001";
  fetchMock = vi.fn(async () => new Response(JSON.stringify({ ok: true }), { status: 200 }));
  vi.stubGlobal("fetch", fetchMock);
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("reportAlert — gộp & chống spam", () => {
  it("TC-W01: cùng fingerprint 3 lần trong 1 phút → 1 dòng, occurrences 3, gửi đúng 1 tin", async () => {
    await alert("fp1");
    vi.setSystemTime(T0 + 20_000);
    await alert("fp1");
    vi.setSystemTime(T0 + 40_000);
    await alert("fp1");
    const r = await rows();
    expect(r).toHaveLength(1);
    expect(r[0]).toMatchObject({ occurrences: 3, unsent_count: 2, status: "NEW", level: "ERROR", source: "API" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0][0])).toContain("/sendMessage");
    expect(JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string)).toMatchObject({ chat_id: "-1001", parse_mode: "HTML" });
  });

  it("TC-W02: sau 15 phút xảy ra lại → gửi lần 2 kèm số lần lặp", async () => {
    await alert("fp1");
    vi.setSystemTime(T0 + 60_000);
    await alert("fp1");
    vi.setSystemTime(T0 + NOTIFY_INTERVAL_MS + 1000);
    await alert("fp1");
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(sentTexts()[1]).toContain("Lần: 3");
    expect(sentTexts()[1]).toContain("lặp lại 2 lần từ tin trước");
    expect((await rows())[0].unsent_count).toBe(0);
  });

  it("TC-W03: dòng RESOLVED tái phát → NEW và gửi ngay dù chưa đủ 15 phút", async () => {
    await alert("fp1");
    await h.pg!.db.query(`UPDATE admin_alerts SET status='RESOLVED', resolved_at=NOW(), resolved_by='a1'`);
    vi.setSystemTime(T0 + 60_000);
    await alert("fp1");
    const r = (await rows())[0];
    expect(r).toMatchObject({ status: "NEW", resolved_at: null, resolved_by: null, occurrences: 2 });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("mức cao hơn được giữ: WARN rồi ERROR → ERROR; ERROR rồi INFO → vẫn ERROR", async () => {
    await alert("fp1", { level: "WARN" });
    await alert("fp1", { level: "ERROR" });
    await alert("fp1", { level: "INFO" });
    expect((await rows())[0].level).toBe("ERROR");
  });

  it("TC-W04: 25 fingerprint trong 1 giờ → 20 tin + 1 tin chạm trần; DB đủ 25 dòng", async () => {
    for (let i = 0; i < 25; i++) {
      vi.setSystemTime(T0 + i * 60_000);
      await alert(`fp${i}`);
    }
    expect(await rows()).toHaveLength(25);
    expect(fetchMock).toHaveBeenCalledTimes(21);
    expect(sentTexts()[20]).toMatch(/chạm trần/);
    // hết cửa sổ 60 phút kể từ tin đầu → gửi lại được
    vi.setSystemTime(T0 + 61 * 60_000);
    await alert("fp-moi");
    expect(fetchMock).toHaveBeenCalledTimes(22);
    expect(sentTexts()[21]).toContain("Lỗi fp-moi");
  });

  it("Telegram lỗi → không đặt last_notified_at, lần sau (trong 15 phút) thử lại", async () => {
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ ok: false, description: "Bad Request: chat not found" }), { status: 400 }));
    await alert("fp1");
    expect((await rows())[0].last_notified_at).toBeNull();
    vi.setSystemTime(T0 + 30_000);
    await alert("fp1");
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect((await rows())[0].last_notified_at).not.toBeNull();
  });
});

describe("reportAlert — an toàn", () => {
  it("TC-W05: DB lỗi → không ném, vẫn gửi Telegram (chống spam trong bộ nhớ); Telegram cũng lỗi → vẫn không ném", async () => {
    h.dbDown = true;
    await expect(alert("fp1")).resolves.toBeUndefined();
    await expect(alert("fp1")).resolves.toBeUndefined();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(sentTexts()[0]).toContain("Chưa lưu được vào DB");
    fetchMock.mockRejectedValue(new Error("network down"));
    await expect(alert("fp2")).resolves.toBeUndefined();
  });

  it("TC-W06: email, SĐT, JWT, password=, Bearer, khoá dài bị làm sạch trong DB và trong tin", async () => {
    const dirty =
      'duplicate key (email)=(hs.an@gmail.com) phone 0912345678 / +84 912 345 678 ' +
      "token eyJhbGciOiJIUzI1NiJ9.eyJ1c2VySWQiOiJ1MSJ9.abcDEF123 password=Matkhau123 Authorization: Bearer abc.def.ghi " +
      "key sk1234567890abcdef1234567890abcdef12";
    await alert("fp1", { title: `Lỗi ${dirty}`, detail: { message: dirty, stack: `Error: ${dirty}\n at x` } });
    const stored = JSON.stringify(await rows());
    const sent = sentTexts().join("\n");
    for (const out of [stored, sent]) {
      expect(out).not.toContain("hs.an@gmail.com");
      expect(out).not.toContain("0912345678");
      expect(out).not.toContain("912 345 678");
      expect(out).not.toContain("eyJhbGciOiJIUzI1NiJ9");
      expect(out).not.toContain("Matkhau123");
      expect(out).not.toContain("abc.def.ghi");
      expect(out).not.toContain("sk1234567890abcdef1234567890abcdef12");
    }
    expect(stored).toContain("[email]");
    expect(stored).toContain("[phone]");
    expect(String(fetchMock.mock.calls[0][0])).toContain("SECRETTOKEN"); // URL có token, nhưng text thì không
    expect(sent).not.toContain("SECRETTOKEN");
  });

  it("redactSensitive giữ nguyên id ngắn, uuid, đường dẫn route", () => {
    const s = "usr_ab12 sub_550e8400-e29b-41d4-a716-446655440000 /api/teacher/exams/ai-parse";
    expect(redactSensitive(s)).toBe(s);
  });

  it("TC-W07: thiếu biến Telegram → chỉ ghi DB, không gọi fetch", async () => {
    delete process.env.TELEGRAM_BOT_TOKEN;
    await alert("fp1");
    expect(await rows()).toHaveLength(1);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("chi tiết dài bị cắt: title ≤ 200, message ≤ 1500, stack ≤ 10 dòng", async () => {
    const stack = Array.from({ length: 30 }, (_, i) => `at fn${i}`).join("\n");
    await alert("fp1", { title: "x".repeat(500), detail: { message: "y ".repeat(2000), stack } });
    const r = (await rows())[0];
    expect(r.title.length).toBeLessThanOrEqual(200);
    expect(r.detail.message.length).toBeLessThanOrEqual(1500);
    expect(r.detail.stack.split("\n")).toHaveLength(10);
  });

  it("TC-W14: dọn dòng RESOLVED cũ hơn 90 ngày, giữ dòng NEW cũ", async () => {
    const old = new Date(T0 - RETENTION_MS - 86_400_000).toISOString();
    await h.pg!.db.query(
      `INSERT INTO admin_alerts (id, fingerprint, level, source, title, status, first_seen_at, last_seen_at) VALUES
       ('a','old-resolved','ERROR','API','t','RESOLVED',$1,$1), ('b','old-new','ERROR','API','t','NEW',$1,$1)`,
      [old]
    );
    await alert("fp1");
    expect((await rows()).map((r) => r.fingerprint).sort()).toEqual(["fp1", "old-new"]);
  });
});
