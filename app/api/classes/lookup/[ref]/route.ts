import { NextResponse } from "next/server";
import { getAuthenticatedUserFromCookie } from "@/lib/auth";
import { queryPg } from "@/lib/db-pg";

export async function GET(
  request: Request,
  context: { params: Promise<{ ref: string }> }
) {
  const { ref } = await context.params;

  try {
    const classRes = await queryPg(
      `SELECT c.id, c.name, c.code, c.schedule, c.max_slots, u.name AS teacher_name
       FROM classes c
       LEFT JOIN users u ON u.id = c.teacher_id
       WHERE c.id = $1 OR UPPER(c.code) = UPPER($1)
       LIMIT 1;`,
      [ref]
    );

    if (classRes.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: "Không tìm thấy lớp học." },
        { status: 404 }
      );
    }

    const row = classRes.rows[0];

    const countRes = await queryPg(
      `SELECT COUNT(*) AS count FROM enrollments WHERE class_id = $1;`,
      [row.id]
    );
    const enrolled_count = Number(countRes.rows[0]?.count || 0);

    let is_enrolled = false;
    const user = await getAuthenticatedUserFromCookie();
    if (user && user.role === "STUDENT") {
      const enrRes = await queryPg(
        `SELECT 1 FROM enrollments WHERE class_id = $1 AND student_id = $2 LIMIT 1;`,
        [row.id, user.userId]
      );
      is_enrolled = enrRes.rows.length > 0;
    }

    const classData = {
      id: row.id,
      name: row.name,
      code: row.code,
      schedule: row.schedule,
      max_slots: row.max_slots != null ? Number(row.max_slots) : null,
      teacher_name: row.teacher_name || null,
      enrolled_count,
      is_enrolled,
    };

    return NextResponse.json({
      success: true,
      class: classData,
    });
  } catch (err: any) {
    console.error(`GET /api/classes/lookup/${ref} error:`, err);
    return NextResponse.json(
      { success: false, error: err.message || "Lỗi tra cứu lớp học." },
      { status: 500 }
    );
  }
}
