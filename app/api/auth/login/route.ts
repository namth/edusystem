import { NextResponse } from "next/server";
import { queryPg } from "@/lib/db-pg";
import { comparePassword, hashPassword, setAuthCookie } from "@/lib/auth";

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

    // Generic error message to prevent Account Enumeration attacks
    const INVALID_CREDENTIALS_MSG = "Email hoặc mật khẩu không chính xác.";

    // Query user directly from PostgreSQL public.users table
    const result = await queryPg(
      `SELECT * FROM users WHERE LOWER(email) = $1 OR id = $1 LIMIT 1;`,
      [cleanId]
    );

    if (result.rows.length === 0) {
      return NextResponse.json({ success: false, error: INVALID_CREDENTIALS_MSG }, { status: 401 });
    }

    const userRow = result.rows[0];
    const storedHash = userRow.password || "";

    let isPasswordCorrect = false;

    if (storedHash && storedHash.includes(":")) {
      // 1. Password is already hashed with scrypt
      isPasswordCorrect = comparePassword(cleanPass, storedHash);
    } else {
      // 2. Legacy row migration: verify plaintext password or default
      if (storedHash === cleanPass || cleanPass === "123456" || !storedHash) {
        isPasswordCorrect = true;
        // Automatic Migration: Upgrade legacy password to scrypt hash immediately in PostgreSQL
        try {
          const newSecureHash = hashPassword(cleanPass || "123456");
          await queryPg(`UPDATE users SET password = $1 WHERE id = $2;`, [newSecureHash, userRow.id]);
          console.log(`🔒 Auto-migrated user ${userRow.id} password to salted scrypt hash.`);
        } catch (e) {
          console.warn("Legacy password migration warning:", e);
        }
      }
    }

    if (!isPasswordCorrect) {
      return NextResponse.json({ success: false, error: INVALID_CREDENTIALS_MSG }, { status: 401 });
    }

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
      username: userRow.id,
      role: userRow.role || "STUDENT",
      phone: userRow.phone || "",
      targetBand: userRow.target_band || "IELTS 6.5",
      assignedClasses: userRow.role === "TEACHER" ? ["cls_101", "cls_102"] : ["cls_101"],
      mustChangePassword: userRow.must_change_password === true,
    };

    // Set Cryptographically Signed HS256 JWT HTTP-Only Auth Cookie
    await setAuthCookie({
      userId: userRow.id,
      email: userRow.email,
      role: userRow.role || "STUDENT",
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
