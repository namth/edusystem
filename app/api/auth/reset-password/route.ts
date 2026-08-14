import { NextResponse } from "next/server";
import { queryPg } from "@/lib/db-pg";
import { hashPassword } from "@/lib/auth";
import { validatePasswordStrength } from "@/lib/password-validator";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { token, email, newPassword } = body;

    if (!token || !token.trim()) {
      return NextResponse.json({ success: false, error: "Mã token khôi phục mật khẩu không hợp lệ." }, { status: 400 });
    }

    if (!email || !email.trim()) {
      return NextResponse.json({ success: false, error: "Thiếu thông tin Email xác thực." }, { status: 400 });
    }

    const cleanEmail = email.trim().toLowerCase();
    const cleanToken = token.trim();

    // 1. Enforce OWASP Password Strength Policy
    const validation = validatePasswordStrength(newPassword);
    if (!validation.isValid) {
      return NextResponse.json(
        { success: false, error: validation.errors[0] || "Mật khẩu chưa đạt tiêu chuẩn an toàn." },
        { status: 400 }
      );
    }

    // 2. Query user and verify token + expiration
    const result = await queryPg(
      `SELECT id, reset_token, reset_token_expires FROM users WHERE LOWER(email) = $1 AND reset_token = $2 LIMIT 1;`,
      [cleanEmail, cleanToken]
    );

    if (result.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: "Mã token khôi phục không chính xác hoặc đã được sử dụng." },
        { status: 400 }
      );
    }

    const userRow = result.rows[0];

    // Check expiration timestamp
    if (userRow.reset_token_expires && new Date(userRow.reset_token_expires).getTime() < Date.now()) {
      return NextResponse.json(
        { success: false, error: "Mã token khôi phục mật khẩu đã hết hạn (quá 15 phút). Vui lòng gửi yêu cầu mới." },
        { status: 400 }
      );
    }

    // 3. Hash new password with scrypt and clear reset token
    const newHashedPassword = hashPassword(newPassword.trim());

    await queryPg(
      `UPDATE users SET password = $1, reset_token = NULL, reset_token_expires = NULL, must_change_password = FALSE WHERE id = $2;`,
      [newHashedPassword, userRow.id]
    );

    return NextResponse.json({
      success: true,
      message: "Đặt lại mật khẩu thành công! Mật khẩu của bạn đã được bảo vệ bằng mã hóa scrypt.",
    });
  } catch (err: any) {
    console.error("API /api/auth/reset-password Exception:", err);
    return NextResponse.json(
      { success: false, error: err.message || "Lỗi hệ thống khi đặt lại mật khẩu." },
      { status: 500 }
    );
  }
}
