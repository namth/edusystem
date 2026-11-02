import { NextResponse } from "next/server";
import { requireRole } from "@/lib/api-auth";
import { queryPg } from "@/lib/db-pg";
import { isPlaceholderEmail } from "@/lib/onboarding";

export async function GET(req?: Request) {
  const auth = await requireRole();
  if (auth.error) return auth.error;

  const res = await queryPg(
    `SELECT id, name, email, username, email_is_placeholder, role, phone, target_band, slot_limit
     FROM users
     WHERE id = $1`,
    [auth.user.userId]
  );

  if (res.rows.length === 0) {
    return NextResponse.json(
      { success: false, error: "Người dùng không tồn tại." },
      { status: 404 }
    );
  }

  return NextResponse.json({
    success: true,
    user: res.rows[0],
  });
}

export async function PUT(req: Request) {
  const auth = await requireRole();
  if (auth.error) return auth.error;

  const body = await req.json().catch(() => ({}));
  const { name, phone, target_band, email } = body;

  if (name !== undefined) {
    if (typeof name !== "string" || name.trim() === "") {
      return NextResponse.json(
        { success: false, error: "Họ và tên không được để trống." },
        { status: 400 }
      );
    }
  }

  const userRes = await queryPg(
    `SELECT id, name, email, username, email_is_placeholder, role, phone, target_band, slot_limit
     FROM users
     WHERE id = $1`,
    [auth.user.userId]
  );

  if (userRes.rows.length === 0) {
    return NextResponse.json(
      { success: false, error: "Người dùng không tồn tại." },
      { status: 404 }
    );
  }

  const current = userRes.rows[0];

  let newEmail = current.email;
  let newEmailIsPlaceholder = Boolean(current.email_is_placeholder);

  if (email !== undefined && (current.email_is_placeholder === true || isPlaceholderEmail(current.email))) {
    if (typeof email !== "string" || !email.trim()) {
      return NextResponse.json(
        { success: false, error: "Địa chỉ email không hợp lệ." },
        { status: 400 }
      );
    }
    const cleanEmail = email.trim().toLowerCase();
    if (cleanEmail.length > 100 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      return NextResponse.json(
        { success: false, error: "Địa chỉ email không đúng định dạng." },
        { status: 400 }
      );
    }
    if (isPlaceholderEmail(cleanEmail)) {
      return NextResponse.json(
        { success: false, error: "Vui lòng nhập địa chỉ email thật của bạn." },
        { status: 400 }
      );
    }

    const dupRes = await queryPg(
      `SELECT 1 FROM users WHERE LOWER(email) = $1 AND id <> $2 LIMIT 1;`,
      [cleanEmail, auth.user.userId]
    );
    if (dupRes.rows.length > 0) {
      return NextResponse.json(
        { success: false, error: "Email này đã được sử dụng bởi tài khoản khác." },
        { status: 400 }
      );
    }

    newEmail = cleanEmail;
    newEmailIsPlaceholder = false;
  }

  const newName = name !== undefined ? name.trim() : current.name;
  const newPhone =
    phone !== undefined
      ? typeof phone === "string"
        ? phone.trim()
        : phone
      : current.phone;
  const newTargetBand =
    target_band !== undefined
      ? typeof target_band === "string"
        ? target_band.trim()
        : target_band
      : current.target_band;

  const updateRes = await queryPg(
    `UPDATE users
     SET name = $1, phone = $2, target_band = $3, email = $4, email_is_placeholder = $5
     WHERE id = $6
     RETURNING id, name, email, username, email_is_placeholder, role, phone, target_band, slot_limit;`,
    [newName, newPhone, newTargetBand, newEmail, newEmailIsPlaceholder, auth.user.userId]
  );

  return NextResponse.json({
    success: true,
    user: updateRes.rows[0],
  });
}
