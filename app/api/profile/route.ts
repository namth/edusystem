import { NextResponse } from "next/server";
import { requireRole } from "@/lib/api-auth";
import { queryPg } from "@/lib/db-pg";

export async function GET(req?: Request) {
  const auth = await requireRole();
  if (auth.error) return auth.error;

  const res = await queryPg(
    `SELECT id, name, email, role, phone, target_band, slot_limit
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
  const { name, phone, target_band } = body;

  if (name !== undefined) {
    if (typeof name !== "string" || name.trim() === "") {
      return NextResponse.json(
        { success: false, error: "Họ và tên không được để trống." },
        { status: 400 }
      );
    }
  }

  const userRes = await queryPg(
    `SELECT id, name, email, role, phone, target_band, slot_limit
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
     SET name = $1, phone = $2, target_band = $3
     WHERE id = $4
     RETURNING id, name, email, role, phone, target_band, slot_limit;`,
    [newName, newPhone, newTargetBand, auth.user.userId]
  );

  return NextResponse.json({
    success: true,
    user: updateRes.rows[0],
  });
}
