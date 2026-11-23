// Kênh cảnh báo admin (FEAT-016, DEC-047, DEC-048; BR-W01 → BR-W11).
// reportAlert() KHÔNG BAO GIỜ ném lỗi: lỗi bên trong chỉ được console.error, không gọi lại reportAlert/serverError.
import crypto from "crypto";
import { queryPg } from "@/lib/db-pg";
import { escapeTelegramHtml, sendTelegram, telegramConfigured } from "@/lib/telegram";

export type AlertLevel = "ERROR" | "WARN" | "INFO";
export type AlertSource = "API" | "SERVER" | "AI" | "WORKER" | "EXAM_IMPORT";
export const ALERT_LEVELS: AlertLevel[] = ["ERROR", "WARN", "INFO"];
export const ALERT_SOURCES: AlertSource[] = ["API", "SERVER", "AI", "WORKER", "EXAM_IMPORT"];

export interface AlertDetail {
  message?: string;
  route?: string;
  method?: string;
  userId?: string;
  role?: string;
  stack?: string;
  extra?: Record<string, unknown>;
}

export interface AlertInput {
  level: AlertLevel;
  source: AlertSource;
  title: string;
  fingerprint: string;
  detail?: AlertDetail;
}

export const NOTIFY_INTERVAL_MS = 15 * 60 * 1000; // BR-W03
export const GLOBAL_CAP = 20; // BR-W04
export const GLOBAL_WINDOW_MS = 60 * 60 * 1000;
export const RETENTION_MS = 90 * 24 * 60 * 60 * 1000; // BR-W09
const CLEANUP_EVERY_MS = 24 * 60 * 60 * 1000;
const MAX_TITLE = 200;
const MAX_TEXT = 1500;
const MAX_STACK_LINES = 10;

// ── Làm sạch thông tin nhạy cảm (BR-W06) ────────────────────────────────
export function redactSensitive(input: string): string {
  if (!input) return input;
  return input
    .replace(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, "[jwt]")
    .replace(/Bearer\s+[A-Za-z0-9._~+/=-]+/gi, "Bearer [token]")
    .replace(/\b(api[_-]?key|access[_-]?token|token|secret|password|passwd|pwd|authorization)\b(\s*[:=]\s*)["']?[^\s"'&,;)]+/gi, "$1$2[redacted]")
    .replace(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, "[email]")
    .replace(/(?<![\w])(?:\+?84|0)(?:[\s.-]?\d){9,10}(?!\d)/g, "[phone]")
    .replace(/\b(?=[A-Za-z0-9+_]*\d)(?=[A-Za-z0-9+_]*[A-Za-z])[A-Za-z0-9+_]{32,}={0,2}/g, "[redacted]");
}

function clip(s: string, max: number): string {
  return s.length > max ? s.slice(0, max - 1) + "…" : s;
}

function cleanText(v: unknown, max = MAX_TEXT): string | undefined {
  if (v === undefined || v === null) return undefined;
  return clip(redactSensitive(String(v)), max);
}

function cleanValue(v: unknown, depth = 0): unknown {
  if (v === null || v === undefined) return v;
  if (typeof v === "string") return cleanText(v);
  if (typeof v === "number" || typeof v === "boolean") return v;
  if (depth >= 3) return cleanText(JSON.stringify(v));
  if (Array.isArray(v)) return v.slice(0, 20).map((x) => cleanValue(x, depth + 1));
  if (typeof v === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, val] of Object.entries(v as Record<string, unknown>).slice(0, 30)) out[k] = cleanValue(val, depth + 1);
    return out;
  }
  return cleanText(String(v));
}

export function sanitizeAlertDetail(d: AlertDetail = {}): AlertDetail {
  const out: AlertDetail = {};
  if (d.message !== undefined) out.message = cleanText(d.message);
  if (d.route !== undefined) out.route = cleanText(d.route, 300);
  if (d.method !== undefined) out.method = cleanText(d.method, 10);
  if (d.userId !== undefined) out.userId = clip(String(d.userId), 80);
  if (d.role !== undefined) out.role = clip(String(d.role), 20);
  if (d.stack !== undefined) out.stack = cleanText(String(d.stack).split("\n").slice(0, MAX_STACK_LINES).join("\n"));
  if (d.extra !== undefined) out.extra = cleanValue(d.extra) as Record<string, unknown>;
  return out;
}

// ── Trạng thái trong tiến trình (BR-W04, BR-W05, BR-W09) ────────────────
let sentAt: number[] = [];
let capNoticeSent = false;
const memoryLastSent = new Map<string, number>();
let lastCleanupAt = 0;

export function __resetAlertStateForTests() {
  sentAt = [];
  capNoticeSent = false;
  memoryLastSent.clear();
  lastCleanupAt = 0;
}

/** "send" = gửi tin này; "cap" = gửi tin báo chạm trần thay tin này; "drop" = im. */
function takeGlobalSlot(now: number): "send" | "cap" | "drop" {
  sentAt = sentAt.filter((t) => now - t < GLOBAL_WINDOW_MS);
  if (sentAt.length < GLOBAL_CAP) {
    sentAt.push(now);
    capNoticeSent = false;
    return "send";
  }
  if (!capNoticeSent) {
    capNoticeSent = true;
    return "cap";
  }
  return "drop";
}

const LEVEL_ICON: Record<AlertLevel, string> = { ERROR: "🔴", WARN: "🟠", INFO: "🔵" };

function vnTime(d: Date): string {
  return new Intl.DateTimeFormat("vi-VN", {
    timeZone: "Asia/Ho_Chi_Minh",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(d);
}

export function buildAlertMessage(a: {
  level: AlertLevel;
  source: AlertSource;
  title: string;
  detail: AlertDetail;
  occurrences: number;
  repeatedSinceLast: number;
  at: Date;
  note?: string;
}): string {
  const lines = [
    `${LEVEL_ICON[a.level]} <b>${a.level} · ${a.source}</b>`,
    `<b>${escapeTelegramHtml(a.title)}</b>`,
    `Lần: ${a.occurrences}${a.repeatedSinceLast > 0 ? ` · lặp lại ${a.repeatedSinceLast} lần từ tin trước` : ""}`,
    `Lúc: ${vnTime(a.at)} (giờ VN)`,
  ];
  if (a.detail.message) lines.push(escapeTelegramHtml(clip(a.detail.message, 800)));
  if (a.detail.userId) lines.push(`user: ${escapeTelegramHtml(a.detail.userId)}${a.detail.role ? ` (${escapeTelegramHtml(a.detail.role)})` : ""}`);
  if (a.note) lines.push(`<i>${escapeTelegramHtml(a.note)}</i>`);
  lines.push("→ Xem: /admin/alerts");
  return lines.join("\n");
}

async function notify(text: string, now: number): Promise<boolean> {
  const slot = takeGlobalSlot(now);
  if (slot === "drop") return false;
  if (slot === "cap") {
    await sendTelegram(`⚠️ Đã chạm trần ${GLOBAL_CAP} tin cảnh báo/giờ. Các cảnh báo tiếp theo vẫn được lưu, xem /admin/alerts.`);
    return false;
  }
  const r = await sendTelegram(text);
  if (!r.ok) console.error("[admin-alerts] gửi Telegram lỗi:", r.error);
  return r.ok;
}

async function maybeCleanup(now: number) {
  if (now - lastCleanupAt < CLEANUP_EVERY_MS) return;
  lastCleanupAt = now;
  try {
    await queryPg(`DELETE FROM admin_alerts WHERE status = 'RESOLVED' AND last_seen_at < $1`, [new Date(now - RETENTION_MS)]);
  } catch (err) {
    console.error("[admin-alerts] dọn dữ liệu cũ lỗi:", err);
  }
}

/** Ghi một sự kiện cho admin. Không bao giờ ném lỗi (BR-W01). */
export async function reportAlert(input: AlertInput): Promise<void> {
  try {
    const now = Date.now();
    const at = new Date(now);
    const level: AlertLevel = ALERT_LEVELS.includes(input.level) ? input.level : "ERROR";
    const source: AlertSource = ALERT_SOURCES.includes(input.source) ? input.source : "SERVER";
    const title = clip(redactSensitive(String(input.title || "Sự kiện không tên")), MAX_TITLE);
    const fingerprint = clip(String(input.fingerprint || `${source}:${title}`), 300);
    const detail = sanitizeAlertDetail(input.detail);

    let row:
      | { id: string; level: AlertLevel; occurrences: number; unsent_count: number; last_notified_at: string | Date | null; prev_status: string | null }
      | undefined;
    try {
      await maybeCleanup(now);
      const res = await queryPg(
        `WITH prev AS (SELECT status FROM admin_alerts WHERE fingerprint = $2)
         INSERT INTO admin_alerts (id, fingerprint, level, source, title, detail, occurrences, unsent_count, status, first_seen_at, last_seen_at)
         VALUES ($1, $2, $3, $4, $5, $6, 1, 1, 'NEW', $7, $7)
         ON CONFLICT (fingerprint) DO UPDATE SET
           occurrences = admin_alerts.occurrences + 1,
           unsent_count = admin_alerts.unsent_count + 1,
           last_seen_at = EXCLUDED.last_seen_at,
           title = EXCLUDED.title,
           detail = EXCLUDED.detail,
           level = CASE
             WHEN admin_alerts.level = 'ERROR' OR EXCLUDED.level = 'ERROR' THEN 'ERROR'
             WHEN admin_alerts.level = 'WARN' OR EXCLUDED.level = 'WARN' THEN 'WARN'
             ELSE 'INFO' END,
           status = 'NEW',
           resolved_at = NULL,
           resolved_by = NULL
         RETURNING id, level, occurrences, unsent_count, last_notified_at, (SELECT status FROM prev) AS prev_status`,
        ["alr_" + crypto.randomUUID(), fingerprint, level, source, title, JSON.stringify(detail), at]
      );
      row = res.rows[0];
    } catch (dbErr) {
      console.error("[admin-alerts] ghi DB lỗi, gửi thẳng Telegram:", dbErr);
      if (!telegramConfigured()) return;
      const last = memoryLastSent.get(fingerprint);
      if (last !== undefined && now - last < NOTIFY_INTERVAL_MS) return;
      const ok = await notify(
        buildAlertMessage({ level, source, title, detail, occurrences: 1, repeatedSinceLast: 0, at, note: "Chưa lưu được vào DB" }),
        now
      );
      if (ok) memoryLastSent.set(fingerprint, now);
      return;
    }

    if (!row || !telegramConfigured()) return;
    const inserted = row.prev_status === null || row.prev_status === undefined;
    const reopened = row.prev_status === "RESOLVED";
    const lastNotified = row.last_notified_at ? new Date(row.last_notified_at).getTime() : null;
    const due = inserted || reopened || lastNotified === null || now - lastNotified >= NOTIFY_INTERVAL_MS;
    if (!due) return;

    const unsent = Number(row.unsent_count) || 1;
    const ok = await notify(
      buildAlertMessage({
        level: row.level,
        source,
        title,
        detail,
        occurrences: Number(row.occurrences) || 1,
        repeatedSinceLast: lastNotified === null || reopened ? 0 : unsent,
        at,
        note: reopened ? "Tái phát sau khi đã đánh dấu xử lý" : undefined,
      }),
      now
    );
    if (ok) {
      await queryPg(`UPDATE admin_alerts SET last_notified_at = $2, unsent_count = 0 WHERE id = $1`, [row.id, at]);
    }
  } catch (err) {
    console.error("[admin-alerts] reportAlert lỗi:", err);
  }
}

/** Fingerprint cho lỗi: không chứa thông điệp (thông điệp có id thay đổi). */
export function errorSignature(err: unknown): string {
  const e = (err && typeof err === "object" ? err : {}) as { name?: string; code?: string | number };
  const name = e.name || typeof err;
  const code = e.code ? `:${e.code}` : "";
  return `${name}${code}`;
}
