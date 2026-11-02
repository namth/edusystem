import { NextResponse } from "next/server";
import { queryPg } from "@/lib/db-pg";
import { requireRole } from "@/lib/api-auth";

export async function GET(req: Request) {
  const auth = await requireRole(["ADMIN"]);
  if (auth.error) return auth.error;

  try {
    const { searchParams } = new URL(req.url);
    const roleParam = searchParams.get("role");
    const qParam = searchParams.get("q");
    const teacherStatusParam = searchParams.get("teacherStatus");

    const role = roleParam?.trim() || "";
    const q = qParam?.trim() || "";
    const teacherStatus = teacherStatusParam?.trim() || "";

    if (role && !["ADMIN", "TEACHER", "STUDENT"].includes(role)) {
      return NextResponse.json(
        { success: false, error: "Vai trò không hợp lệ." },
        { status: 400 }
      );
    }

    if (teacherStatus && !["TRIAL", "VERIFIED", "REJECTED"].includes(teacherStatus)) {
      return NextResponse.json(
        { success: false, error: "Trạng thái giáo viên không hợp lệ." },
        { status: 400 }
      );
    }

    const conditions: string[] = ["1=1"];
    const params: unknown[] = [];
    let paramIndex = 1;

    if (role) {
      conditions.push(`u.role = $${paramIndex++}`);
      params.push(role);
    }

    if (teacherStatus) {
      conditions.push(`u.teacher_status = $${paramIndex++}`);
      params.push(teacherStatus);
    }

    if (q) {
      conditions.push(`(u.name ILIKE $${paramIndex} OR u.email ILIKE $${paramIndex})`);
      params.push(`%${q}%`);
      paramIndex++;
    }

    const sql = `
      SELECT 
        u.id,
        u.name,
        u.email,
        u.role,
        u.phone,
        u.target_band,
        u.status,
        u.teacher_status,
        u.slot_limit,
        u.created_at,
        COALESCE(
          (SELECT json_agg(e.class_id) FROM enrollments e WHERE e.student_id = u.id),
          '[]'::json
        ) AS class_ids,
        COALESCE(
          (SELECT COUNT(*)::int FROM submissions s WHERE s.student_id = u.id),
          0
        ) AS submission_count,
        (
          SELECT s.final_score
          FROM submissions s
          WHERE s.student_id = u.id
          ORDER BY s.created_at DESC
          LIMIT 1
        ) AS latest_score
      FROM users u
      WHERE ${conditions.join(" AND ")}
      ORDER BY u.created_at DESC;
    `;

    const res = await queryPg(sql, params);

    const users = res.rows.map((row: any) => {
      let classIds: string[] = [];
      if (Array.isArray(row.class_ids)) {
        classIds = row.class_ids;
      } else if (typeof row.class_ids === "string") {
        try {
          const parsed = JSON.parse(row.class_ids);
          if (Array.isArray(parsed)) classIds = parsed;
        } catch {
          classIds = [];
        }
      }

      return {
        id: row.id,
        name: row.name,
        email: row.email,
        role: row.role,
        phone: row.phone,
        target_band: row.target_band,
        status: row.status,
        teacher_status: row.teacher_status ?? null,
        slot_limit:
          row.slot_limit !== null && row.slot_limit !== undefined
            ? Number(row.slot_limit)
            : 250,
        created_at: row.created_at,
        class_ids: classIds,
        submission_count: Number(row.submission_count) || 0,
        latest_score:
          row.latest_score !== null && row.latest_score !== undefined
            ? Number(row.latest_score)
            : null,
      };
    });

    return NextResponse.json({ users });
  } catch (err: any) {
    console.error("API /api/admin/users GET Error:", err);
    return NextResponse.json(
      { success: false, error: err.message || "Lỗi hệ thống khi tải danh sách người dùng." },
      { status: 500 }
    );
  }
}
