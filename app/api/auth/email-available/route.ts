import { NextResponse } from "next/server";
import { queryPg } from "@/lib/db-pg";
import { checkRateLimit, recordRateLimitHit } from "@/lib/rate-limit";
import { isPlaceholderEmail, PLACEHOLDER_EMAIL_DOMAIN } from "@/lib/onboarding";

// Kiểm tra email còn dùng được khi đăng ký (báo trùng ngay khi gõ, như tên đăng nhập).
// Giới hạn theo IP để không bị dùng dò danh sách email.
const WINDOW_MS = 60 * 1000;
const MAX_CHECKS = 30;

export async function GET(req: Request) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const rateKey = `email-available:${ip}`;

  const rl = checkRateLimit(rateKey, MAX_CHECKS, WINDOW_MS);
  if (!rl.allowed) {
    return NextResponse.json(
      { success: false, error: "Bạn đã kiểm tra quá nhiều lần. Vui lòng thử lại sau ít giây." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSeconds) } }
    );
  }
  recordRateLimitHit(rateKey, WINDOW_MS);

  const { searchParams } = new URL(req.url);
  const email = (searchParams.get("e") || "").trim().toLowerCase();

  if (!email || email.length > 100 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ success: true, available: false, error: "Địa chỉ email chưa đúng định dạng." });
  }
  if (isPlaceholderEmail(email)) {
    return NextResponse.json({
      success: true,
      available: false,
      error: `Vui lòng dùng email thật (không dùng đuôi @${PLACEHOLDER_EMAIL_DOMAIN}).`,
    });
  }

  const existing = await queryPg(`SELECT 1 FROM users WHERE LOWER(email) = $1 LIMIT 1;`, [email]);
  if (existing.rows.length > 0) {
    return NextResponse.json({
      success: true,
      available: false,
      error: "Email này đã được dùng để đăng ký. Nếu là tài khoản của bạn, hãy đăng nhập.",
    });
  }
  return NextResponse.json({ success: true, available: true });
}
