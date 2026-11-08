// Gửi email giao dịch qua Resend (dùng fetch, không thêm gói npm).
// Thiếu cấu hình thì bỏ qua êm: hệ thống chạy như cũ. Không bao giờ ném lỗi, không log nội dung email.
import { BRAND } from "@/lib/brand";

const RESEND_URL = "https://api.resend.com/emails";
const SEND_TIMEOUT_MS = 10_000;
const PLACEHOLDER_SUFFIX = "@kito.io.vn";

export type SendEmailResult = { ok: boolean; skipped?: boolean; error?: string };

export function isMailerConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY?.trim() && process.env.MAIL_FROM?.trim());
}

export function isPlaceholderEmail(email: string): boolean {
  return email.trim().toLowerCase().endsWith(PLACEHOLDER_SUFFIX);
}

/** Gốc URL tuyệt đối của ứng dụng (APP_BASE_URL, bỏ "/" cuối; thiếu thì dùng website công ty). */
export function appBaseUrl(): string {
  const raw = process.env.APP_BASE_URL?.trim() || BRAND.company.website;
  return raw.replace(/\/+$/, "");
}

export async function sendEmail(m: {
  to: string;
  subject: string;
  html: string;
  text: string;
}): Promise<SendEmailResult> {
  if (!isMailerConfigured() || isPlaceholderEmail(m.to)) return { ok: false, skipped: true };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), SEND_TIMEOUT_MS);
  try {
    const res = await fetch(RESEND_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY!.trim()}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: process.env.MAIL_FROM!.trim(),
        to: [m.to],
        subject: m.subject,
        html: m.html,
        text: m.text,
      }),
      signal: controller.signal,
    });
    if (!res.ok) {
      console.warn(`sendEmail: Resend trả HTTP ${res.status}`);
      return { ok: false, error: `HTTP ${res.status}` };
    }
    return { ok: true };
  } catch (err: any) {
    const reason = err?.name === "AbortError" ? "timeout" : "network error";
    console.warn(`sendEmail: gửi thất bại (${reason})`);
    return { ok: false, error: reason };
  } finally {
    clearTimeout(timer);
  }
}
