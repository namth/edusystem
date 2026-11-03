import { queryPg } from "@/lib/db-pg";

export async function getStudentSlotUsage(
  teacherId: string
): Promise<{ used: number; limit: number }> {
  const userRes = await queryPg(
    `SELECT COALESCE(slot_limit, 0) AS slot_limit FROM users WHERE id = $1;`,
    [teacherId]
  );
  const limit = userRes.rows.length > 0 ? Number(userRes.rows[0].slot_limit) : 0;

  const countRes = await queryPg(
    `SELECT COUNT(DISTINCT e.student_id)::int AS used
     FROM enrollments e
     JOIN classes c ON e.class_id = c.id
     WHERE c.teacher_id = $1;`,
    [teacherId]
  );
  const used = countRes.rows.length > 0 ? Number(countRes.rows[0].used) : 0;

  return { used, limit };
}

export async function assertStudentSlotAvailable(
  teacherId: string,
  studentId?: string
): Promise<{ ok: true } | { ok: false; status: 409; error: string }> {
  const userRes = await queryPg(
    `SELECT role, COALESCE(slot_limit, 0) AS slot_limit FROM users WHERE id = $1;`,
    [teacherId]
  );

  if (userRes.rows.length === 0 || userRes.rows[0].role === "ADMIN") {
    return { ok: true };
  }

  if (studentId) {
    const existingRes = await queryPg(
      `SELECT 1
       FROM enrollments e
       JOIN classes c ON e.class_id = c.id
       WHERE c.teacher_id = $1 AND e.student_id = $2
       LIMIT 1;`,
      [teacherId, studentId]
    );
    if (existingRes.rows.length > 0) {
      return { ok: true };
    }
  }

  const { used, limit } = await getStudentSlotUsage(teacherId);

  if (used >= limit) {
    return {
      ok: false,
      status: 409,
      error: "Thầy cô đã dùng hết slot học sinh. Vui lòng mua thêm slot.",
    };
  }

  return { ok: true };
}
