import { NextResponse } from "next/server";
import { queryPg } from "@/lib/db-pg";
import { comparePassword, setAuthCookie } from "@/lib/auth";
import {
  checkRateLimit,
  recordRateLimitHit,
  clearRateLimit,
} from "@/lib/rate-limit";

const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const LOGIN_MAX_FAILURES = 10;

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { identifier, password } = body;

    if (!identifier?.trim()) {
      return NextResponse.json({ success: false, error: "Vui lòng nhập Email hoặc Mã tài khoản." }, { status: 400 });
    }

    if (!password || !password.trim()) {
      return NextResponse.json({ success: false, error: "Vui lòng nhập mật khẩu." }, { status: 400 });
    }

    const cleanId = identifier.trim().toLowerCase();
    const cleanPass = password.trim();
    const rateKey = `login:${cleanId}`;

    const rl = checkRateLimit(rateKey, LOGIN_MAX_FAILURES, LOGIN_WINDOW_MS);
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

    // Generic error message to prevent Account Enumeration attacks
    const INVALID_CREDENTIALS_MSG = "Email hoặc mật khẩu không chính xác.";

    // Query user directly from PostgreSQL public.users table
    const result = await queryPg(
      `SELECT * FROM users WHERE LOWER(email) = $1 OR LOWER(username) = $1 OR id = $1 LIMIT 1;`,
      [cleanId]
    );

    if (result.rows.length === 0) {
      recordRateLimitHit(rateKey, LOGIN_WINDOW_MS);
      return NextResponse.json({ success: false, error: INVALID_CREDENTIALS_MSG }, { status: 401 });
    }

    const userRow = result.rows[0];
    const storedHash = userRow.password || "";

    const isPasswordCorrect = comparePassword(cleanPass, storedHash);

    if (!isPasswordCorrect) {
      recordRateLimitHit(rateKey, LOGIN_WINDOW_MS);
      return NextResponse.json({ success: false, error: INVALID_CREDENTIALS_MSG }, { status: 401 });
    }

    clearRateLimit(rateKey);

    // Update last login timestamp
    try {
      await queryPg(`UPDATE users SET last_login_at = NOW() WHERE id = $1;`, [userRow.id]);
    } catch (e) {
      // Ignore timestamp update error
    }

    const authenticatedUser = {
      id: userRow.id,
      name: userRow.name || cleanId.split("@")[0],
      email: userRow.email || cleanId,
      username: userRow.username || userRow.id,
      role: userRow.role || "STUDENT",
      phone: userRow.phone || "",
      targetBand: userRow.target_band || "IELTS 6.5",
      assignedClasses: userRow.role === "TEACHER" ? ["cls_101", "cls_102"] : ["cls_101"],
      mustChangePassword: userRow.must_change_password === true,
      teacherStatus: userRow.teacher_status ?? null,
      emailIsPlaceholder: !!userRow.email_is_placeholder,
    };

    // Set Cryptographically Signed HS256 JWT HTTP-Only Auth Cookie
    await setAuthCookie({
      userId: userRow.id,
      email: userRow.email,
      role: userRow.role || "STUDENT",
      ...(userRow.must_change_password === true ? { mcp: true } : {}),
    });

    return NextResponse.json({
      success: true,
      user: authenticatedUser,
    });
  } catch (err: any) {
    console.error("API /api/auth/login Exception:", err);
    return NextResponse.json({ success: false, error: "Đã xảy ra lỗi hệ thống trong quá trình xác thực." }, { status: 500 });
  }
}
