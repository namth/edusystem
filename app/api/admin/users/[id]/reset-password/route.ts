import { NextResponse } from "next/server";
import { queryPg } from "@/lib/db-pg";
import { requireRole } from "@/lib/api-auth";
import { checkRateLimit, recordRateLimitHit } from "@/lib/rate-limit";
import { issueTempPassword } from "@/lib/password-reset";

const RATE_LIMIT_MAX = 20;
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000; // 1 hour

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireRole(["ADMIN"]);
  if (auth.error) {
    auth.error.headers.set("Cache-Control", "no-store");
    return auth.error;
  }

  const { id } = await params;
  const cleanId = id?.trim();
  if (!cleanId) {
    return NextResponse.json(
      { success: false, error: "Thiếu ID người dùng." },
      { status: 400, headers: { "Cache-Control": "no-store" } }
    );
  }

  if (cleanId === auth.user.userId) {
    return NextResponse.json(
      { success: false, error: "Dùng chức năng đổi mật khẩu cho tài khoản của bạn." },
      { status: 400, headers: { "Cache-Control": "no-store" } }
    );
  }

  const rateKey = `reset-password:${auth.user.userId}`;
  const rl = checkRateLimit(rateKey, RATE_LIMIT_MAX, RATE_LIMIT_WINDOW_MS);
  if (!rl.allowed) {
    return NextResponse.json(
      {
        success: false,
        error: "Bạn đã vượt quá giới hạn cấp lại mật khẩu (20 lần/giờ). Vui lòng thử lại sau.",
      },
      {
        status: 429,
        headers: {
          "Cache-Control": "no-store",
          "Retry-After": String(rl.retryAfterSeconds),
        },
      }
    );
  }
  recordRateLimitHit(rateKey, RATE_LIMIT_WINDOW_MS);

  const userRes = await queryPg("SELECT id FROM users WHERE id = $1 LIMIT 1", [cleanId]);
  if (userRes.rows.length === 0) {
    return NextResponse.json(
      { success: false, error: "Người dùng không tồn tại." },
      { status: 404, headers: { "Cache-Control": "no-store" } }
    );
  }

  const temp_password = await issueTempPassword(cleanId);

  return NextResponse.json(
    { success: true, temp_password },
    { status: 200, headers: { "Cache-Control": "no-store" } }
  );
}
