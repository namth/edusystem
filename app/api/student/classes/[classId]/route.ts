import { NextResponse } from "next/server";
import { requireRole } from "@/lib/api-auth";
import { queryPg } from "@/lib/db-pg";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ classId: string }> }
) {
  // Kiểm quyền trước khi await params
  const auth = await requireRole();
  if (auth.error) return auth.error;

  const { classId } = await params;

  try {
    const classRes = await queryPg(
      `SELECT * FROM classes WHERE id = $1 LIMIT 1;`,
      [classId]
    );

    if (classRes.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: "Không tìm thấy lớp học." },
        { status: 404 }
      );
    }

    const classData = classRes.rows[0];

    // Phân quyền theo vai trò
    if (auth.user.role === "STUDENT") {
      const enrollRes = await queryPg(
        `SELECT 1 FROM enrollments WHERE student_id = $1 AND class_id = $2 LIMIT 1;`,
        [auth.user.userId, classId]
      );
      if (enrollRes.rows.length === 0) {
        return NextResponse.json(
          { success: false, error: "Bạn chưa ghi danh vào lớp học này." },
          { status: 403 }
        );
      }
    } else if (auth.user.role === "TEACHER") {
      if (classData.teacher_id !== auth.user.userId) {
        return NextResponse.json(
          { success: false, error: "Bạn không phụ trách lớp học này." },
          { status: 403 }
        );
      }
    }
    // ADMIN xem mọi lớp

    // Lấy danh sách bài giao của lớp kèm thông tin đề (LEFT JOIN)
    const assignmentsRes = await queryPg(
      `SELECT 
        ca.id,
        ca.class_id,
        ca.exam_id,
        ca.due_date,
        ca.max_attempts,
        ca.created_at,
        e.id AS exam_id_val,
        e.title AS exam_title,
        e.duration_minutes AS exam_duration_minutes,
        e.skills AS exam_skills
       FROM class_assignments ca
       LEFT JOIN exams e ON ca.exam_id = e.id
       WHERE ca.class_id = $1
       ORDER BY ca.created_at ASC;`,
      [classId]
    );

    const assignments = assignmentsRes.rows.map((row) => ({
      id: row.id,
      class_id: row.class_id,
      exam_id: row.exam_id,
      due_date: row.due_date,
      max_attempts: row.max_attempts,
      created_at: row.created_at,
      exam: row.exam_id_val
        ? {
            id: row.exam_id_val,
            title: row.exam_title,
            duration_minutes: row.exam_duration_minutes,
            skills: row.exam_skills,
          }
        : null,
    }));

    // Lấy danh sách bài nộp
    let submissions: any[] = [];
    if (auth.user.role === "STUDENT") {
      const submissionsRes = await queryPg(
        `SELECT s.*
         FROM submissions s
         WHERE s.student_id = $1
           AND s.exam_id IN (
             SELECT ca.exam_id FROM class_assignments ca WHERE ca.class_id = $2
           )
         ORDER BY s.created_at DESC;`,
        [auth.user.userId, classId]
      );
      submissions = submissionsRes.rows;
    }

    return NextResponse.json({
      success: true,
      class: classData,
      assignments,
      submissions,
    });
  } catch (err: any) {
    console.error(`GET /api/student/classes/${classId} error:`, err);
    return NextResponse.json(
      { success: false, error: err.message || "Lỗi tải thông tin chi tiết lớp học." },
      { status: 500 }
    );
  }
}
