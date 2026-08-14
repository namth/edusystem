import { NextResponse } from "next/server";
import { queryPg } from "@/lib/db-pg";
import { hashPassword } from "@/lib/auth";
import { syncStudentEnrolledInClass, syncTeacherManagesClass } from "@/lib/neo4j";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const {
      email,
      password,
      name,
      phone,
      targetBand,
      role: targetRole,
      classIds,
    } = body;

    if (!email?.trim()) {
      return NextResponse.json(
        { success: false, error: "Vui lòng nhập Email hợp lệ." },
        { status: 400 }
      );
    }

    if (!password || password.trim().length < 6) {
      return NextResponse.json(
        { success: false, error: "Mật khẩu khởi tạo tối thiểu phải từ 6 ký tự trở lên." },
        { status: 400 }
      );
    }

    const emailToUse = email.trim().toLowerCase();
    const passwordToUse = password.trim();
    const hashedPassword = hashPassword(passwordToUse);

    const nameToUse = name?.trim() || emailToUse.split("@")[0];
    const roleToUse = targetRole?.toUpperCase() || "STUDENT";
    const phoneToUse = (phone?.trim() || (roleToUse === "TEACHER" ? "0912345679" : "0912345678")).slice(0, 50);
    const targetBandToUse = (targetBand?.trim() || (roleToUse === "TEACHER" ? "M.A TESOL" : "IELTS 6.5")).slice(0, 100);

    const newUserId = `usr_${roleToUse.toLowerCase()}_${Date.now().toString().slice(-6)}_${Math.random().toString(36).slice(2, 7)}`;

    // 1. Direct PostgreSQL Insert into public.users table with salted scrypt password hash
    try {
      const insertSql = `
        INSERT INTO users (id, name, email, password, role, phone, target_band, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
        RETURNING id, name, email, role, phone, target_band, created_at;
      `;

      await queryPg(insertSql, [
        newUserId,
        nameToUse,
        emailToUse,
        hashedPassword,
        roleToUse,
        phoneToUse,
        targetBandToUse,
      ]);
    } catch (dbErr: any) {
      console.error("PostgreSQL Insert Error:", dbErr);
      if (dbErr.code === "23505" || dbErr.message?.includes("unique constraint") || dbErr.message?.includes("already exists")) {
        return NextResponse.json(
          { success: false, error: `Email "${emailToUse}" đã được sử dụng cho một tài khoản khác trong CSDL.` },
          { status: 400 }
        );
      }
      return NextResponse.json(
        { success: false, error: `Lỗi CSDL PostgreSQL: ${dbErr.message}` },
        { status: 500 }
      );
    }

    // 2. Insert Enrollments if classIds provided
    if (Array.isArray(classIds) && classIds.length > 0) {
      for (const cId of classIds) {
        const enrId = `enr_${Date.now().toString().slice(-4)}_${Math.floor(Math.random() * 1000)}`;
        await queryPg(
          `INSERT INTO enrollments (id, student_id, class_id) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING;`,
          [enrId, newUserId, cId]
        );
        // Sync Polyglot Neo4j Graph DB
        try {
          await syncStudentEnrolledInClass(newUserId, cId);
        } catch (graphErr) {
          console.warn("Neo4j Sync Warning:", graphErr);
        }
      }
    }

    return NextResponse.json({
      success: true,
      user: {
        id: newUserId,
        email: emailToUse,
        name: nameToUse,
        role: roleToUse,
        phone: phoneToUse,
        targetBand: targetBandToUse,
      },
    });
  } catch (err: any) {
    console.error("API /api/admin/create-user Exception:", err);
    return NextResponse.json(
      { success: false, error: err.message || "Lỗi hệ thống khi tạo tài khoản." },
      { status: 500 }
    );
  }
}
