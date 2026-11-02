import { NextResponse } from "next/server";
import crypto from "crypto";
import { requireRole } from "@/lib/api-auth";
import { queryPg } from "@/lib/db-pg";
import { hashPassword } from "@/lib/auth";
import { syncStudentEnrolledInClass } from "@/lib/neo4j";
import { assertTrialAllows, trialLimitResponse } from "@/lib/teacher-trial";

export async function POST(
  req: Request,
  context: { params: Promise<{ classId: string }> | { classId: string } }
) {
  const auth = await requireRole(["ADMIN", "TEACHER"]);
  if (auth.error) return auth.error;
  const user = auth.user;

  const { classId } = await context.params;

  const classRes = await queryPg("SELECT id, teacher_id, max_slots FROM classes WHERE id = $1", [classId]);
  if (classRes.rows.length === 0) {
    return NextResponse.json(
      { success: false, error: "Lớp học không tồn tại." },
      { status: 404 }
    );
  }

  const cls = classRes.rows[0];
  if (user.role === "TEACHER" && cls.teacher_id !== user.userId) {
    return NextResponse.json(
      { success: false, error: "Bạn không có quyền quản lý lớp học này." },
      { status: 403 }
    );
  }

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json(
      { success: false, error: "Dữ liệu không hợp lệ." },
      { status: 400 }
    );
  }

  const { name, email, phone } = body;
  if (!name || typeof name !== "string" || name.trim().length === 0) {
    return NextResponse.json(
      { success: false, error: "Tên học sinh không được để trống." },
      { status: 400 }
    );
  }

  if (!email || typeof email !== "string") {
    return NextResponse.json(
      { success: false, error: "Email không hợp lệ." },
      { status: 400 }
    );
  }

  const trimmedEmail = email.trim().toLowerCase();
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(trimmedEmail)) {
    return NextResponse.json(
      { success: false, error: "Email không hợp lệ." },
      { status: 400 }
    );
  }

  const maxSlots = Number(cls.max_slots ?? 30);

  // Kiểm tra email đã có chưa
  const userRes = await queryPg(
    "SELECT id, name, email, role, phone, status FROM users WHERE email = $1",
    [trimmedEmail]
  );

  if (userRes.rows.length > 0) {
    const existing = userRes.rows[0];
    if (existing.role !== "STUDENT") {
      return NextResponse.json(
        { success: false, error: "Email này thuộc về tài khoản không phải học sinh." },
        { status: 409 }
      );
    }

    // Kiểm tra đã ghi danh chưa
    const enrRes = await queryPg(
      "SELECT id FROM enrollments WHERE class_id = $1 AND student_id = $2",
      [classId, existing.id]
    );

    if (enrRes.rows.length === 0) {
      if (user.role !== "ADMIN") {
        const existingWithTeacher = await queryPg(
          "SELECT 1 FROM enrollments e JOIN classes c ON c.id = e.class_id WHERE c.teacher_id = $1 AND e.student_id = $2 LIMIT 1",
          [cls.teacher_id, existing.id]
        );
        const adding = existingWithTeacher.rows.length > 0 ? 0 : 1;
        const trial = await assertTrialAllows(cls.teacher_id, "students", adding);
        if (!trial.ok) {
          return trialLimitResponse("students", trial.error);
        }
      }

      // Kiểm tra lớp đầy
      const countRes = await queryPg(
        "SELECT COUNT(*)::int AS count FROM enrollments WHERE class_id = $1",
        [classId]
      );
      const currentCount = Number(countRes.rows[0]?.count ?? 0);
      if (currentCount >= maxSlots) {
        return NextResponse.json(
          { success: false, error: "Lớp học đã đủ số lượng học viên tối đa." },
          { status: 409 }
        );
      }

      const enrId = "enr_" + crypto.randomUUID();
      await queryPg(
        "INSERT INTO enrollments (id, student_id, class_id) VALUES ($1, $2, $3)",
        [enrId, existing.id, classId]
      );

      try {
        await syncStudentEnrolledInClass(existing.id, classId);
      } catch (err) {
        console.warn("syncStudentEnrolledInClass warning:", err);
      }
    }

    return NextResponse.json(
      {
        success: true,
        already_existed: true,
        student: {
          id: existing.id,
          name: existing.name,
          email: existing.email,
          phone: existing.phone ?? null,
          status: existing.status ?? "ACTIVE",
        },
      },
      { status: 200 }
    );
  }

  // Chưa có tài khoản: kiểm tra giới hạn dùng thử trước khi kiểm tra lớp đầy
  if (user.role !== "ADMIN") {
    const trial = await assertTrialAllows(cls.teacher_id, "students", 1);
    if (!trial.ok) {
      return trialLimitResponse("students", trial.error);
    }
  }

  const countRes = await queryPg(
    "SELECT COUNT(*)::int AS count FROM enrollments WHERE class_id = $1",
    [classId]
  );
  const currentCount = Number(countRes.rows[0]?.count ?? 0);
  if (currentCount >= maxSlots) {
    return NextResponse.json(
      { success: false, error: "Lớp học đã đủ số lượng học viên tối đa." },
      { status: 409 }
    );
  }

  // Tạo user id = "usr_" + crypto.randomUUID(), role = 'STUDENT', password = hashPassword(temp) với temp ≥ 8 ký tự
  const newUserId = "usr_" + crypto.randomUUID();
  const tempPassword = crypto.randomBytes(6).toString("hex"); // 12 ký tự hex (>= 8 ký tự)
  const hashed = hashPassword(tempPassword);
  const cleanPhone = phone ? String(phone).trim() : null;

  const insertUserSql = `
    INSERT INTO users (id, name, email, role, password, must_change_password, phone, status)
    VALUES ($1, $2, $3, 'STUDENT', $4, true, $5, 'ACTIVE')
    RETURNING id, name, email, role, phone, status
  `;
  const insertUserRes = await queryPg(insertUserSql, [
    newUserId,
    name.trim(),
    trimmedEmail,
    hashed,
    cleanPhone,
  ]);
  const newUser = insertUserRes.rows[0];

  const enrollmentId = "enr_" + crypto.randomUUID();
  await queryPg(
    "INSERT INTO enrollments (id, student_id, class_id) VALUES ($1, $2, $3)",
    [enrollmentId, newUserId, classId]
  );

  try {
    await syncStudentEnrolledInClass(newUserId, classId);
  } catch (err) {
    console.warn("syncStudentEnrolledInClass warning:", err);
  }

  return NextResponse.json(
    {
      success: true,
      already_existed: false,
      student: {
        id: newUser.id,
        name: newUser.name,
        email: newUser.email,
        phone: newUser.phone ?? null,
        status: newUser.status ?? "ACTIVE",
      },
      temp_password: tempPassword,
    },
    { status: 201 }
  );
}
