import { NextResponse } from "next/server";
import { requireRole } from "@/lib/api-auth";
import { queryPg } from "@/lib/db-pg";

export async function GET(
  _req: Request,
  context: { params: Promise<{ classId: string }> | { classId: string } }
) {
  const auth = await requireRole(["ADMIN", "TEACHER"]);
  if (auth.error) return auth.error;
  const user = auth.user;

  const { classId } = await context.params;

  const classRes = await queryPg("SELECT id, teacher_id FROM classes WHERE id = $1", [classId]);
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

  try {
    // 1. Danh sách học sinh ghi danh trong lớp
    const studentsRes = await queryPg(
      `
      SELECT 
        u.id, u.name, u.email, u.phone, u.status,
        (SELECT COUNT(*)::int FROM submissions s WHERE s.student_id = u.id AND s.class_ref = e.class_id) AS submission_count
      FROM enrollments e
      JOIN users u ON u.id = e.student_id
      WHERE e.class_id = $1
      ORDER BY e.created_at ASC
      `,
      [classId]
    );

    // Điểm bài nộp mới nhất: latest_total = total_score ?? final_score của bài nộp mới nhất, hoặc null
    const studentIds = studentsRes.rows.map((s: any) => s.id);
    const latestTotalMap: Record<string, number | null> = {};

    if (studentIds.length > 0) {
      const subRes = await queryPg(
        `SELECT s.* FROM submissions s WHERE s.student_id = ANY($1::text[]) AND s.class_ref = $2 ORDER BY s.created_at DESC`,
        [studentIds, classId]
      );
      for (const row of subRes.rows) {
        if (latestTotalMap[row.student_id] === undefined) {
          const val = row.total_score ?? row.final_score ?? null;
          latestTotalMap[row.student_id] = val !== null ? Number(val) : null;
        }
      }
    }

    const students = studentsRes.rows.map((row: any) => ({
      id: row.id,
      name: row.name,
      email: row.email,
      phone: row.phone ?? null,
      status: row.status ?? "ACTIVE",
      submission_count: Number(row.submission_count ?? 0),
      latest_total: latestTotalMap[row.id] ?? null,
    }));

    // 2. Danh sách bài tập đã giao
    const assignmentsRes = await queryPg(
      `
      SELECT 
        ca.id, ca.exam_id, ex.title AS exam_title, ca.due_date, ca.max_attempts, ca.created_at
      FROM class_assignments ca
      LEFT JOIN exams ex ON ex.id = ca.exam_id
      WHERE ca.class_id = $1
      ORDER BY ca.created_at DESC
      `,
      [classId]
    );

    const assignments = assignmentsRes.rows.map((row: any) => ({
      id: row.id,
      exam_id: row.exam_id,
      exam_title: row.exam_title ?? "",
      due_date: row.due_date ?? null,
      max_attempts: Number(row.max_attempts ?? 1),
      created_at: row.created_at,
    }));

    return NextResponse.json({ students, assignments });
  } catch (err: any) {
    console.error("GET /api/teacher/classes/[classId]/members error:", err);
    return NextResponse.json(
      { success: false, error: err.message || "Lỗi tải danh sách thành viên." },
      { status: 500 }
    );
  }
}
