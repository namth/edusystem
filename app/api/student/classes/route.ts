import { NextResponse } from "next/server";
import { requireRole } from "@/lib/api-auth";
import { queryPg } from "@/lib/db-pg";
import { serverError } from "@/lib/api-errors";

export async function GET(_request?: Request) {
  const auth = await requireRole();
  if (auth.error) return auth.error;

  try {
    const result = await queryPg(
      `SELECT c.*
       FROM classes c
       INNER JOIN enrollments e ON c.id = e.class_id
       WHERE e.student_id = $1
       ORDER BY e.created_at DESC;`,
      [auth.user.userId]
    );

    return NextResponse.json({ success: true, classes: result.rows });
  } catch (err: any) {
    return serverError(err, { route: "/api/student/classes", method: "GET", message: err.message || "Lỗi tải danh sách lớp học." });
  }
}
