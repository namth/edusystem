import { NextResponse } from "next/server";
import { queryPg } from "@/lib/db-pg";
import { getAuthenticatedUserFromCookie, hashPassword, comparePassword, setAuthCookie } from "@/lib/auth";
import { validatePasswordStrength } from "@/lib/password-validator";

// Đổi mật khẩu của chính người đang đăng nhập (bất biến 1, 3: danh tính chỉ lấy từ token).
// - Lần đầu (must_change_password = TRUE): phiên đăng nhập bằng mật khẩu tạm là đủ.
// - Tự đổi về sau: bắt buộc nhập đúng mật khẩu hiện tại.
export async function POST(req: Request) {
  try {
    const authenticatedUser = await getAuthenticatedUserFromCookie();
    if (!authenticatedUser?.userId) {
      return NextResponse.json(
        { success: false, error: "Bạn cần đăng nhập để đổi mật khẩu." },
        { status: 401 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const newPassword = typeof body?.newPassword === "string" ? body.newPassword : "";
    const currentPassword = typeof body?.currentPassword === "string" ? body.currentPassword : "";

    const validation = validatePasswordStrength(newPassword);
    if (!validation.isValid) {
      return NextResponse.json(
        { success: false, error: validation.errors[0] || "Mật khẩu chưa đạt tiêu chuẩn an toàn." },
        { status: 400 }
      );
    }

    const userRes = await queryPg(
      `SELECT id, password, must_change_password FROM users WHERE id = $1 LIMIT 1;`,
      [authenticatedUser.userId]
    );
    const userRow = userRes.rows[0];
    if (!userRow) {
      return NextResponse.json(
        { success: false, error: "Không tìm thấy tài khoản để cập nhật mật khẩu." },
        { status: 404 }
      );
    }

    if (userRow.must_change_password !== true) {
      if (!currentPassword || !comparePassword(currentPassword.trim(), userRow.password || "")) {
        return NextResponse.json(
          { success: false, error: "Mật khẩu hiện tại không đúng." },
          { status: 403 }
        );
      }
    }

    const cleanPass = newPassword.trim();
    if (comparePassword(cleanPass, userRow.password || "")) {
      return NextResponse.json(
        { success: false, error: "Mật khẩu mới phải khác mật khẩu hiện tại." },
        { status: 400 }
      );
    }

    await queryPg(
      `UPDATE users SET password = $1, must_change_password = FALSE WHERE id = $2;`,
      [hashPassword(cleanPass), userRow.id]
    );

    // Cấp lại cookie không còn cờ mcp để middleware mở các trang
    await setAuthCookie({
      userId: authenticatedUser.userId,
      email: authenticatedUser.email,
      role: authenticatedUser.role,
    });

    return NextResponse.json({ success: true, message: "Đổi mật khẩu thành công." });
  } catch (err: any) {
    console.error("API /api/auth/change-password Exception:", err);
    return NextResponse.json(
      { success: false, error: "Lỗi hệ thống khi đổi mật khẩu." },
      { status: 500 }
    );
  }
}
