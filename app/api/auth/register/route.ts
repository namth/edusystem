import { NextResponse } from "next/server";
import { queryPg } from "@/lib/db-pg";
import { hashPassword } from "@/lib/auth";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { name, email, password, phone } = body;

    if (!email?.trim()) {
      return NextResponse.json({ success: false, error: "Vui lòng nhập Email hợp lệ." }, { status: 400 });
    }

    if (!password || password.trim().length < 6) {
      return NextResponse.json({ success: false, error: "Mật khẩu tối thiểu phải từ 6 ký tự trở lên." }, { status: 400 });
    }

    const emailToUse = email.trim().toLowerCase();
    const passwordToUse = password.trim();
    const hashedPassword = hashPassword(passwordToUse);
    const nameToUse = name?.trim() || emailToUse.split("@")[0];
    const newUserId = `usr_student_${Date.now().toString().slice(-6)}_${Math.random().toString(36).slice(2, 7)}`;

    try {
      await queryPg(
        `INSERT INTO users (id, name, email, password, role, phone, target_band, created_at)
         VALUES ($1, $2, $3, $4, 'STUDENT', $5, 'IELTS 6.5', NOW());`,
        [newUserId, nameToUse, emailToUse, hashedPassword, phone?.trim() || "0912345678"]
      );
    } catch (dbErr: any) {
      if (dbErr.code === "23505" || dbErr.message?.includes("unique constraint")) {
        return NextResponse.json(
          { success: false, error: `Email "${emailToUse}" đã được đăng ký tài khoản trước đó.` },
          { status: 400 }
        );
      }
      return NextResponse.json({ success: false, error: `Lỗi CSDL PostgreSQL: ${dbErr.message}` }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: "Đăng ký tài khoản Học viên thành công!",
      userId: newUserId,
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message || "Lỗi hệ thống khi đăng ký." }, { status: 500 });
  }
}
