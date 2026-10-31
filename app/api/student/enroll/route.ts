import { NextResponse } from "next/server";
import crypto from "crypto";
import { requireRole } from "@/lib/api-auth";
import { queryPg } from "@/lib/db-pg";
import { syncStudentEnrolledInClass } from "@/lib/neo4j";

export async function POST(request: Request) {
  const auth = await requireRole(["STUDENT"]);
  if (auth.error) return auth.error;

  try {
    const body = await request.json().catch(() => ({}));
    const rawCode = typeof body.code === "string" ? body.code.trim() : "";

    if (!rawCode) {
      return NextResponse.json(
        { success: false, error: "Mã lớp không được để trống." },
        { status: 400 }
      );
    }

    const classRes = await queryPg(
      `SELECT * FROM classes WHERE UPPER(code) = UPPER($1) LIMIT 1;`,
      [rawCode]
    );

    if (classRes.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: "Không tìm thấy lớp học với mã này." },
        { status: 404 }
      );
    }

    const targetClass = classRes.rows[0];

    // Kiểm tra đã ghi danh chưa
    const enrolledRes = await queryPg(
      `SELECT 1 FROM enrollments WHERE student_id = $1 AND class_id = $2 LIMIT 1;`,
      [auth.user.userId, targetClass.id]
    );

    if (enrolledRes.rows.length > 0) {
      return NextResponse.json({
        success: true,
        class: targetClass,
        alreadyEnrolled: true,
      });
    }

    // Kiểm tra sĩ số lớp
    const countRes = await queryPg(
      `SELECT COUNT(*) AS n FROM enrollments WHERE class_id = $1;`,
      [targetClass.id]
    );
    const currentCount = Number(countRes.rows[0]?.n || 0);

    if (targetClass.max_slots != null && currentCount >= Number(targetClass.max_slots)) {
      return NextResponse.json(
        { success: false, error: "Lớp học đã đủ chỗ." },
        { status: 409 }
      );
    }

    // Chèn ghi danh mới
    const enrollmentId = "enr_" + crypto.randomUUID();
    await queryPg(
      `INSERT INTO enrollments (id, student_id, class_id)
       VALUES ($1, $2, $3)
       ON CONFLICT (student_id, class_id) DO NOTHING;`,
      [enrollmentId, auth.user.userId, targetClass.id]
    );

    // Đồng bộ Neo4j trong try/catch
    try {
      await syncStudentEnrolledInClass(auth.user.userId, targetClass.id);
    } catch (neoErr) {
      console.warn("Neo4j sync error:", neoErr);
    }

    return NextResponse.json({
      success: true,
      class: targetClass,
      alreadyEnrolled: false,
    });
  } catch (err: any) {
    console.error("POST /api/student/enroll error:", err);
    return NextResponse.json(
      { success: false, error: err.message || "Lỗi ghi danh lớp học." },
      { status: 500 }
    );
  }
}
