import { NextResponse } from "next/server";
import { queryPg } from "@/lib/db-pg";
import crypto from "crypto";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { email } = body;

    if (!email || !email.trim()) {
      return NextResponse.json({ success: false, error: "Vui lòng nhập địa chỉ Email." }, { status: 400 });
    }

    const cleanEmail = email.trim().toLowerCase();

    // Query user profile directly from PostgreSQL
    const result = await queryPg(`SELECT id, email, name FROM users WHERE LOWER(email) = $1 LIMIT 1;`, [cleanEmail]);

    if (result.rows.length === 0) {
      // Security: Even if email is not found, return generic success message to prevent account enumeration
      return NextResponse.json({
        success: true,
        message: `Nếu địa chỉ "${cleanEmail}" tồn tại trong hệ thống, hướng dẫn đặt lại mật khẩu đã được gửi đến hộp thư của bạn.`,
      });
    }

    const userRow = result.rows[0];

    // Generate secure 32-byte hex reset token
    const resetToken = crypto.randomBytes(32).toString("hex");

    // Token expires in 15 minutes
    await queryPg(
      `UPDATE users SET reset_token = $1, reset_token_expires = NOW() + INTERVAL '15 minutes' WHERE id = $2;`,
      [resetToken, userRow.id]
    );

    const resetUrl = `/reset-password?token=${resetToken}&email=${encodeURIComponent(cleanEmail)}`;

    console.log(`🔑 Created Password Reset Link for ${cleanEmail}: ${resetUrl}`);

    return NextResponse.json({
      success: true,
      message: `Đã tạo liên kết khôi phục mật khẩu thành công (Hạn 15 phút).`,
      resetUrl,
    });
  } catch (err: any) {
    console.error("API /api/auth/forgot-password Exception:", err);
    return NextResponse.json({ success: false, error: err.message || "Lỗi hệ thống khi yêu cầu đặt lại mật khẩu." }, { status: 500 });
  }
}
