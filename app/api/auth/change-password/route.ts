import { NextResponse } from "next/server";
import { queryPg } from "@/lib/db-pg";
import { getAuthenticatedUserFromCookie, hashPassword } from "@/lib/auth";
import { validatePasswordStrength } from "@/lib/password-validator";

export async function POST(req: Request) {
  try {
    const authenticatedUser = await getAuthenticatedUserFromCookie();

    const body = await req.json();
    const { userId: bodyUserId, newPassword } = body;

    let targetUserId: string | null = authenticatedUser?.userId || null;

    if (!targetUserId && bodyUserId) {
      targetUserId = bodyUserId.trim();
    }

    if (!targetUserId) {
      return NextResponse.json(
        { success: false, error: "Không tìm thấy thông tin phiên đăng nhập." },
        { status: 401 }
      );
    }

    // Enforce OWASP Password Strength Policy
    const validation = validatePasswordStrength(newPassword);
    if (!validation.isValid) {
      return NextResponse.json(
        { success: false, error: validation.errors[0] || "Mật khẩu chưa đạt tiêu chuẩn an toàn." },
        { status: 400 }
      );
    }

    const cleanPass = newPassword.trim();
    const hashedPassword = hashPassword(cleanPass);

    // Update password hash & clear must_change_password flag in PostgreSQL
    const result = await queryPg(
      `UPDATE users SET password = $1, must_change_password = FALSE WHERE id = $2 RETURNING id;`,
      [hashedPassword, targetUserId]
    );

    if (result.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: "Không tìm thấy tài khoản để cập nhật mật khẩu." },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Đổi mật khẩu thành công! Tài khoản của bạn đã được bảo vệ bằng mã hóa scrypt.",
    });
  } catch (err: any) {
    console.error("API /api/auth/change-password Exception:", err);
    return NextResponse.json(
      { success: false, error: err.message || "Lỗi hệ thống khi đổi mật khẩu." },
      { status: 500 }
    );
  }
}
