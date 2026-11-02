import { NextResponse } from "next/server";
import { requireRole } from "@/lib/api-auth";
import { queryPg } from "@/lib/db-pg";

export async function PUT(
  req: Request,
  context: { params: Promise<{ classId: string }> | { classId: string } }
) {
  const auth = await requireRole(["ADMIN", "TEACHER"]);
  if (auth.error) return auth.error;
  const user = auth.user;

  const { classId } = await context.params;

  const classRes = await queryPg(
    "SELECT id, name, code, teacher_id, course_id, unlock_mode, pass_percent FROM classes WHERE id = $1",
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

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ success: false, error: "Dữ liệu không hợp lệ." }, { status: 400 });
  }

  const updates: string[] = [];
  const params: any[] = [];
  let pIdx = 1;

  if (body.course_id !== undefined) {
    if (body.course_id === null) {
      updates.push(`course_id = $${pIdx++}`);
      params.push(null);
    } else if (typeof body.course_id === "string") {
      const courseRes = await queryPg("SELECT id, created_by FROM courses WHERE id = $1", [
        body.course_id,
      ]);
      if (courseRes.rows.length === 0) {
        return NextResponse.json({ success: false, error: "Khóa học không tồn tại." }, { status: 400 });
      }
      const course = courseRes.rows[0];
      if (user.role === "TEACHER" && course.created_by !== null && course.created_by !== user.userId) {
        return NextResponse.json(
          { success: false, error: "Bạn không có quyền chọn khóa học này." },
          { status: 400 }
        );
      }
      updates.push(`course_id = $${pIdx++}`);
      params.push(body.course_id);
    } else {
      return NextResponse.json({ success: false, error: "course_id không hợp lệ." }, { status: 400 });
    }
  }

  if (body.unlock_mode !== undefined) {
    if (!["MANUAL", "ALL_OPEN", "SEQUENTIAL"].includes(body.unlock_mode)) {
      return NextResponse.json({ success: false, error: "unlock_mode không hợp lệ." }, { status: 400 });
    }
    updates.push(`unlock_mode = $${pIdx++}`);
    params.push(body.unlock_mode);
  }

  if (body.pass_percent !== undefined) {
    if (
      typeof body.pass_percent !== "number" ||
      !Number.isInteger(body.pass_percent) ||
      body.pass_percent < 1 ||
      body.pass_percent > 100
    ) {
      return NextResponse.json(
        { success: false, error: "pass_percent phải là số nguyên từ 1 đến 100." },
        { status: 400 }
      );
    }
    updates.push(`pass_percent = $${pIdx++}`);
    params.push(body.pass_percent);
  }

  let updatedRow = cls;
  if (updates.length > 0) {
    params.push(classId);
    const updateSql = `UPDATE classes SET ${updates.join(", ")} WHERE id = $${pIdx} RETURNING id, name, code, teacher_id, course_id, unlock_mode, pass_percent`;
    const updateRes = await queryPg(updateSql, params);
    updatedRow = updateRes.rows[0];
  }

  return NextResponse.json({
    success: true,
    class: {
      id: updatedRow.id,
      name: updatedRow.name,
      code: updatedRow.code,
      teacher_id: updatedRow.teacher_id,
      course_id: updatedRow.course_id,
      unlock_mode: updatedRow.unlock_mode,
      pass_percent: Number(updatedRow.pass_percent),
    },
  });
}
