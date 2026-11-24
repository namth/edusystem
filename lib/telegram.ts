// Gửi tin Telegram cho kênh cảnh báo admin (FEAT-016, DEC-048).
// Không bao giờ ném lỗi; token chỉ đọc từ biến môi trường và không bao giờ xuất hiện trong thông điệp lỗi.

const SEND_TIMEOUT_MS = 5000;
export const TELEGRAM_MAX_TEXT = 3500;

export function telegramConfigured(env: Record<string, string | undefined> = process.env): boolean {
  return Boolean(env.TELEGRAM_BOT_TOKEN?.trim() && env.TELEGRAM_ALERT_CHAT_ID?.trim());
}

export function escapeTelegramHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** Gửi `text` (HTML đã escape) tới nhóm admin. Trả `{ ok, error }`, không ném. */
export async function sendTelegram(text: string): Promise<{ ok: boolean; error?: string }> {
  const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
  const chatId = process.env.TELEGRAM_ALERT_CHAT_ID?.trim();
  if (!token || !chatId) return { ok: false, error: "Chưa cấu hình Telegram." };

  const hide = (msg: string) => msg.split(token).join("[token]");
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), SEND_TIMEOUT_MS);
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: text.length > TELEGRAM_MAX_TEXT ? text.slice(0, TELEGRAM_MAX_TEXT - 1) + "…" : text,
        parse_mode: "HTML",
        disable_web_page_preview: true,
      }),
      signal: controller.signal,
    });
    if (res.ok) return { ok: true };
    const body = (await res.json().catch(() => ({}))) as { description?: string };
    return { ok: false, error: hide(String(body?.description || `Telegram trả mã ${res.status}`)) };
  } catch (err) {
    const e = err as { name?: string; message?: string };
    const msg = e?.name === "AbortError" ? "Telegram không phản hồi sau 5 giây" : String(e?.message || err);
    return { ok: false, error: hide(msg) };
  } finally {
    clearTimeout(timer);
  }
}
