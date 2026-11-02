import crypto from "crypto";
import { queryPg } from "@/lib/db-pg";
import { syncStudentEnrolledInClass } from "@/lib/neo4j";
import { assertTrialAllows } from "@/lib/teacher-trial";
import { assertStudentSlotAvailable } from "@/lib/student-slots";

export type EnrollByCodeResult =
  | { ok: true; class: any; alreadyEnrolled: boolean }
  | { ok: false; status: 400 | 404 | 409; error: string };

export async function enrollStudentByCode(
  studentId: string,
  code: string
): Promise<EnrollByCodeResult> {
  const rawCode = typeof code === "string" ? code.trim() : "";

  if (!rawCode) {
    return {
      ok: false,
      status: 400,
      error: "Mã lớp không được để trống.",
    };
  }

  const classRes = await queryPg(
    `SELECT * FROM classes WHERE UPPER(code) = UPPER($1) LIMIT 1;`,
    [rawCode]
  );

  if (classRes.rows.length === 0) {
    return {
      ok: false,
      status: 404,
      error: "Không tìm thấy lớp học với mã này.",
    };
  }

  const targetClass = classRes.rows[0];

  // Kiểm tra đã ghi danh chưa
  const enrolledRes = await queryPg(
    `SELECT 1 FROM enrollments WHERE student_id = $1 AND class_id = $2 LIMIT 1;`,
    [studentId, targetClass.id]
  );

  if (enrolledRes.rows.length > 0) {
    return {
      ok: true,
      class: targetClass,
      alreadyEnrolled: true,
    };
  }

  // Kiểm tra giới hạn học sinh của giáo viên dùng thử
  if (targetClass.teacher_id) {
    const existingWithTeacher = await queryPg(
      `SELECT 1 FROM enrollments e JOIN classes c ON c.id = e.class_id WHERE c.teacher_id = $1 AND e.student_id = $2 LIMIT 1;`,
      [targetClass.teacher_id, studentId]
    );
    const adding = existingWithTeacher.rows.length > 0 ? 0 : 1;
    const trial = await assertTrialAllows(targetClass.teacher_id, "students", adding);
    if (!trial.ok) {
      return {
        ok: false,
        status: 409,
        error: trial.error,
      };
    }

    const slotCheck = await assertStudentSlotAvailable(targetClass.teacher_id, studentId);
    if (!slotCheck.ok) {
      return {
        ok: false,
        status: 409,
        error: slotCheck.error,
      };
    }
  }

  // Kiểm tra sĩ số lớp
  const countRes = await queryPg(
    `SELECT COUNT(*) AS n FROM enrollments WHERE class_id = $1;`,
    [targetClass.id]
  );
  const currentCount = Number(countRes.rows[0]?.n || 0);

  if (targetClass.max_slots != null && currentCount >= Number(targetClass.max_slots)) {
    return {
      ok: false,
      status: 409,
      error: "Lớp học đã đủ chỗ.",
    };
  }

  // Chèn ghi danh mới
  const enrollmentId = "enr_" + crypto.randomUUID();
  await queryPg(
    `INSERT INTO enrollments (id, student_id, class_id)
     VALUES ($1, $2, $3)
     ON CONFLICT (student_id, class_id) DO NOTHING;`,
    [enrollmentId, studentId, targetClass.id]
  );

  // Đồng bộ Neo4j trong try/catch
  try {
    await syncStudentEnrolledInClass(studentId, targetClass.id);
  } catch (neoErr) {
    console.warn("Neo4j sync error:", neoErr);
  }

  return {
    ok: true,
    class: targetClass,
    alreadyEnrolled: false,
  };
}
