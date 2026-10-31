import { NextResponse } from "next/server";
import { queryPg } from "@/lib/db-pg";
import { requireRole } from "@/lib/api-auth";

export async function GET(req: Request) {
  const auth = await requireRole(["ADMIN"]);
  if (auth.error) return auth.error;

  try {
    const res = await queryPg(`
      SELECT 
        c.id,
        c.name,
        c.code,
        c.teacher_id,
        COALESCE(u.name, '') AS teacher_name,
        COALESCE(
          (SELECT COUNT(*)::int FROM enrollments e WHERE e.class_id = c.id),
          0
        ) AS student_count,
        c.course_id
      FROM classes c
      LEFT JOIN users u ON u.id = c.teacher_id
      ORDER BY c.created_at DESC;
    `);

    const classes = res.rows.map((row: any) => ({
      id: row.id,
      name: row.name,
      code: row.code,
      teacher_id: row.teacher_id,
      teacher_name: row.teacher_name || "",
      student_count: Number(row.student_count) || 0,
      course_id: row.course_id ?? null,
    }));

    return NextResponse.json({ classes });
  } catch (err: any) {
    console.error("API /api/admin/classes GET Error:", err);
    return NextResponse.json(
      { success: false, error: err.message || "Lỗi hệ thống khi tải danh sách lớp học." },
      { status: 500 }
    );
  }
}
