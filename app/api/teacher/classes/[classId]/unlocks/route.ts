import { NextResponse } from "next/server";
import { requireRole } from "@/lib/api-auth";
import { queryPg } from "@/lib/db-pg";

export async function POST(
  req: Request,
  context: { params: Promise<{ classId: string }> | { classId: string } }
) {
  const auth = await requireRole(["ADMIN", "TEACHER"]);
  if (auth.error) return auth.error;
  const user = auth.user;

  const { classId } = await context.params;

  const classRes = await queryPg(
    "SELECT id, teacher_id, course_id FROM classes WHERE id = $1",
    [classId]
  );
  if (classRes.rows.length === 0) {
    return NextResponse.json({ success: false, error: "Lớp học không tồn tại." }, { status: 404 });
  }

  const cls = classRes.rows[0];
  if (user.role === "TEACHER" && cls.teacher_id !== user.userId) {
    return NextResponse.json(
      { success: false, error: "Bạn không có quyền quản lý lớp học này." },
      { status: 403 }
    );
  }

  if (!cls.course_id) {
    return NextResponse.json(
      { success: false, error: "Lớp học chưa được gắn khóa học." },
      { status: 400 }
    );
  }

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ success: false, error: "Dữ liệu không hợp lệ." }, { status: 400 });
  }

  const { curriculum_item_id, student_id, due_date } = body;
  if (!curriculum_item_id || typeof curriculum_item_id !== "string") {
    return NextResponse.json({ success: false, error: "Thiếu curriculum_item_id." }, { status: 400 });
  }

  // Kiểm tra mục thuộc khóa học của lớp
  const itemRes = await queryPg(
    "SELECT id FROM curriculum_items WHERE id = $1 AND course_id = $2",
    [curriculum_item_id, cls.course_id]
  );
  if (itemRes.rows.length === 0) {
    return NextResponse.json(
      { success: false, error: "Mục không thuộc khóa học của lớp." },
      { status: 400 }
    );
  }

  // Kiểm tra học sinh (nếu có) phải thuộc lớp
  let targetStudentId: string | null = null;
  if (student_id !== undefined && student_id !== null && student_id !== "") {
    if (typeof student_id !== "string") {
      return NextResponse.json({ success: false, error: "student_id không hợp lệ." }, { status: 400 });
    }
    const enrollRes = await queryPg(
      "SELECT id FROM enrollments WHERE class_id = $1 AND student_id = $2",
      [classId, student_id]
    );
    if (enrollRes.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: "Học sinh không thuộc lớp học này." },
        { status: 400 }
      );
    }
    targetStudentId = student_id;
  }

  const dueDateVal = due_date ? new Date(due_date).toISOString() : null;

  // Kiểm tra tồn tại (bỏ qua ON CONFLICT vì unique index dùng biểu thức COALESCE)
  const existingRes = await queryPg(
    `SELECT class_id, curriculum_item_id, student_id
     FROM class_unlocks
     WHERE class_id = $1 AND curriculum_item_id = $2
       AND (student_id = $3 OR ($3 IS NULL AND student_id IS NULL))`,
    [classId, curriculum_item_id, targetStudentId]
  );

  let resultRow: any;
  if (existingRes.rows.length > 0) {
    const updateRes = await queryPg(
      `UPDATE class_unlocks
       SET due_date = $1, unlocked_by = $2, unlocked_at = NOW()
       WHERE class_id = $3 AND curriculum_item_id = $4
         AND (student_id = $5 OR ($5 IS NULL AND student_id IS NULL))
       RETURNING class_id, curriculum_item_id, student_id, due_date, unlocked_by, unlocked_at`,
      [dueDateVal, user.userId, classId, curriculum_item_id, targetStudentId]
    );
    resultRow = updateRes.rows[0];
  } else {
    const insertRes = await queryPg(
      `INSERT INTO class_unlocks (class_id, curriculum_item_id, student_id, due_date, unlocked_by, unlocked_at)
       VALUES ($1, $2, $3, $4, $5, NOW())
       RETURNING class_id, curriculum_item_id, student_id, due_date, unlocked_by, unlocked_at`,
      [classId, curriculum_item_id, targetStudentId, dueDateVal, user.userId]
    );
    resultRow = insertRes.rows[0];
  }

  return NextResponse.json(
    {
      success: true,
      unlock: {
        class_id: resultRow.class_id,
        curriculum_item_id: resultRow.curriculum_item_id,
        student_id: resultRow.student_id,
        due_date: resultRow.due_date,
        unlocked_by: resultRow.unlocked_by,
        unlocked_at: resultRow.unlocked_at,
      },
    },
    { status: 201 }
  );
}

export async function DELETE(
  req: Request,
  context: { params: Promise<{ classId: string }> | { classId: string } }
) {
  const auth = await requireRole(["ADMIN", "TEACHER"]);
  if (auth.error) return auth.error;
  const user = auth.user;

  const { classId } = await context.params;

  const classRes = await queryPg(
    "SELECT id, teacher_id FROM classes WHERE id = $1",
    [classId]
  );
  if (classRes.rows.length === 0) {
    return NextResponse.json({ success: false, error: "Lớp học không tồn tại." }, { status: 404 });
  }

  const cls = classRes.rows[0];
  if (user.role === "TEACHER" && cls.teacher_id !== user.userId) {
    return NextResponse.json(
      { success: false, error: "Bạn không có quyền quản lý lớp học này." },
      { status: 403 }
    );
  }

  const { searchParams } = new URL(req.url);
  const curriculum_item_id = searchParams.get("curriculum_item_id");
  const student_id = searchParams.get("student_id");

  if (!curriculum_item_id) {
    return NextResponse.json({ success: false, error: "Thiếu curriculum_item_id." }, { status: 400 });
  }

  let deleteRes: any;
  if (student_id) {
    deleteRes = await queryPg(
      "DELETE FROM class_unlocks WHERE class_id = $1 AND curriculum_item_id = $2 AND student_id = $3",
      [classId, curriculum_item_id, student_id]
    );
  } else {
    deleteRes = await queryPg(
      "DELETE FROM class_unlocks WHERE class_id = $1 AND curriculum_item_id = $2 AND student_id IS NULL",
      [classId, curriculum_item_id]
    );
  }

  return NextResponse.json({
    success: true,
    deleted: Number(deleteRes.rowCount ?? 0),
  });
}
