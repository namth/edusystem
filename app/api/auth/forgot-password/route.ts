import { NextResponse } from "next/server";
import { queryPg } from "@/lib/db-pg";
import { checkRateLimit, recordRateLimitHit } from "@/lib/rate-limit";
import crypto from "crypto";
import { appBaseUrl, sendEmail } from "@/lib/mailer";
import { resetPasswordEmail } from "@/lib/email-templates";

const FORGOT_WINDOW_MS = 15 * 60 * 1000;
const FORGOT_MAX_REQUESTS = 5;

const GENERIC_MESSAGE =
  "Nếu email này đã đăng ký, yêu cầu đặt lại mật khẩu đã được ghi nhận. Chưa nhận được hướng dẫn, vui lòng liên hệ bộ phận hỗ trợ KitoKit để được cấp lại mật khẩu.";

function devResetLinkAllowed(): boolean {
  return process.env.NODE_ENV !== "production" && process.env.ALLOW_DEV_RESET_LINK === "1";
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { email } = body;

    if (!email || !email.trim()) {
      return NextResponse.json({ success: false, error: "Vui lòng nhập địa chỉ Email." }, { status: 400 });
    }

    const cleanEmail = email.trim().toLowerCase();
    const rateKey = `forgot:${cleanEmail}`;

    const rl = checkRateLimit(rateKey, FORGOT_MAX_REQUESTS, FORGOT_WINDOW_MS);
    if (!rl.allowed) {
      const minutes = Math.max(1, Math.ceil(rl.retryAfterSeconds / 60));
      return NextResponse.json(
        {
          success: false,
          error: `Bạn đã thử sai quá nhiều lần. Vui lòng thử lại sau ${minutes} phút.`,
        },
        {
          status: 429,
          headers: { "Retry-After": String(rl.retryAfterSeconds) },
        }
      );
    }

    recordRateLimitHit(rateKey, FORGOT_WINDOW_MS);

    // Query user profile directly from PostgreSQL
    const result = await queryPg(
      `SELECT id, email, name, email_is_placeholder FROM users WHERE LOWER(email) = $1 LIMIT 1;`,
      [cleanEmail]
    );

    // Phản hồi luôn giống nhau dù email có tồn tại hay không (chống dò tài khoản).
    // KHÔNG BAO GIỜ trả link/token đặt lại trong response hay log ra console.
    const genericResponse = (devResetUrl?: string) =>
      NextResponse.json({
        success: true,
        message: GENERIC_MESSAGE,
        ...(devResetUrl ? { resetUrl: devResetUrl } : {}),
      });

    if (result.rows.length === 0 || result.rows[0].email_is_placeholder === true) {
      return genericResponse();
    }

    const userRow = result.rows[0];

    // Generate secure 32-byte hex reset token
    const resetToken = crypto.randomBytes(32).toString("hex");

    // Token expires in 15 minutes
    await queryPg(
      `UPDATE users SET reset_token = $1, reset_token_expires = NOW() + INTERVAL '15 minutes' WHERE id = $2;`,
      [resetToken, userRow.id]
    );

    // Gửi email link đặt lại (nếu đã cấu hình Resend). Gửi nền, KHÔNG await: nếu chờ thì thời gian
    // phản hồi lộ ra email có tồn tại hay không (BR-A06). sendEmail không ném lỗi, không log token/link.
    const url = `${appBaseUrl()}/reset-password?token=${resetToken}&email=${encodeURIComponent(cleanEmail)}`;
    void sendEmail({ to: userRow.email, ...resetPasswordEmail({ name: userRow.name, url }) }).catch(() => {});

    // Chỉ môi trường dev/e2e, bật rõ bằng ALLOW_DEV_RESET_LINK=1, mới nhận link trong response.
    if (devResetLinkAllowed()) {
      return genericResponse(
        `/reset-password?token=${resetToken}&email=${encodeURIComponent(cleanEmail)}`
      );
    }

    return genericResponse();
  } catch (err: any) {
    console.error("API /api/auth/forgot-password Exception:", err);
    return NextResponse.json({ success: false, error: "Lỗi hệ thống khi yêu cầu đặt lại mật khẩu." }, { status: 500 });
  }
}
