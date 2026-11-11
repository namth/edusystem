// Mẫu email (hàm thuần). Mọi giá trị người dùng nhập đều được escape HTML.
import { BRAND } from "@/lib/brand";

export interface EmailContent {
  subject: string;
  html: string;
  text: string;
}

export function escapeHtml(v: unknown): string {
  return String(v ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function footerHtml(): string {
  const c = BRAND.company;
  return `<hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0" />
<p style="color:#6b7280;font-size:12px;line-height:1.5;margin:0">${escapeHtml(c.fullName)}<br/>Hotline: ${escapeHtml(c.hotline)}</p>`;
}

function footerText(): string {
  return `--\n${BRAND.company.fullName}\nHotline: ${BRAND.company.hotline}`;
}

function layout(inner: string): string {
  return `<div style="font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:0 auto;padding:16px;color:#111827">
${inner}
${footerHtml()}
</div>`;
}

function button(url: string, label: string): string {
  // URL trong thuộc tính/nội dung: chặn ký tự phá HTML; giữ nguyên "&" để link query copy được nguyên vẹn.
  const u = String(url).replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return `<p style="margin:20px 0"><a href="${u}" style="background:#2563eb;color:#fff;padding:10px 18px;border-radius:6px;text-decoration:none;display:inline-block">${escapeHtml(label)}</a></p>
<p style="font-size:12px;color:#6b7280;word-break:break-all">Nếu nút không hoạt động, hãy sao chép liên kết sau vào trình duyệt:<br/>${u}</p>`;
}

export function resetPasswordEmail(opts: { name?: string | null; url: string }): EmailContent {
  const name = opts.name?.trim() || "bạn";
  const subject = `[${BRAND.name}] Đặt lại mật khẩu`;
  const html = layout(
    `<h2 style="margin:0 0 12px">Đặt lại mật khẩu</h2>
<p>Xin chào ${escapeHtml(name)},</p>
<p>Chúng tôi nhận được yêu cầu đặt lại mật khẩu cho tài khoản ${escapeHtml(BRAND.name)} của bạn. Liên kết dưới đây có hiệu lực trong <strong>15 phút</strong>.</p>
${button(opts.url, "Đặt lại mật khẩu")}
<p>Nếu không phải bạn yêu cầu, hãy bỏ qua email này — mật khẩu của bạn sẽ không thay đổi.</p>`
  );
  const text = [
    `Xin chào ${name},`,
    "",
    `Chúng tôi nhận được yêu cầu đặt lại mật khẩu cho tài khoản ${BRAND.name} của bạn. Liên kết dưới đây có hiệu lực trong 15 phút:`,
    opts.url,
    "",
    "Nếu không phải bạn yêu cầu, hãy bỏ qua email này — mật khẩu của bạn sẽ không thay đổi.",
    "",
    footerText(),
  ].join("\n");
  return { subject, html, text };
}

export function notificationEmail(opts: {
  title: string;
  body?: string | null;
  url?: string | null;
}): EmailContent {
  const subject = `[${BRAND.name}] ${opts.title}`;
  const body = opts.body?.trim() || "";
  const html = layout(
    `<h2 style="margin:0 0 12px">${escapeHtml(opts.title)}</h2>
${body ? `<p style="white-space:pre-line">${escapeHtml(body)}</p>` : ""}
${opts.url ? button(opts.url, "Xem chi tiết") : ""}`
  );
  const parts = [opts.title];
  if (body) parts.push("", body);
  if (opts.url) parts.push("", opts.url);
  parts.push("", footerText());
  return { subject, html, text: parts.join("\n") };
}
