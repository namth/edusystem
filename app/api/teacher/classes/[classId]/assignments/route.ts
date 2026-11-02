import { NextResponse } from "next/server";
import crypto from "crypto";
import { requireRole } from "@/lib/api-auth";
import { queryPg } from "@/lib/db-pg";
import { isTrialClass } from "@/lib/teacher-trial";

export async function POST(
  req: Request,
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

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json(
      { success: false, error: "Dữ liệu không hợp lệ." },
      { status: 400 }
    );
  }

  const { exam_id, due_date, max_attempts } = body;
  if (!exam_id || typeof exam_id !== "string") {
    return NextResponse.json(
      { success: false, error: "Thiếu mã đề thi." },
      { status: 400 }
    );
  }

  // Đề phải tồn tại và (ADMIN hoặc created_by = userId hoặc created_by IS NULL), sai → 400
  const examRes = await queryPg("SELECT id, created_by FROM exams WHERE id = $1", [exam_id]);
  if (examRes.rows.length === 0) {
    return NextResponse.json(
      { success: false, error: "Đề thi không tồn tại." },
      { status: 400 }
    );
  }

  const exam = examRes.rows[0];
  if (user.role !== "ADMIN") {
    if (exam.created_by !== null && exam.created_by !== "" && exam.created_by !== user.userId) {
      return NextResponse.json(
        { success: false, error: "Bạn không có quyền giao đề thi này." },
        { status: 400 }
      );
    }
  }

  // Đã giao (UNIQUE(class_id, exam_id)) → 409
  const existRes = await queryPg(
    "SELECT id FROM class_assignments WHERE class_id = $1 AND exam_id = $2",
    [classId, exam_id]
  );
  if (existRes.rows.length > 0) {
    return NextResponse.json(
      { success: false, error: "Đề thi đã được giao cho lớp này." },
      { status: 409 }
    );
  }

  let parsedMaxAttempts = 1;
  if (max_attempts !== undefined) {
    if (
      typeof max_attempts !== "number" ||
      !Number.isInteger(max_attempts) ||
      max_attempts < 1
    ) {
      return NextResponse.json(
        { success: false, error: "Số lần làm tối đa phải là số nguyên ≥ 1." },
        { status: 400 }
      );
    }
    parsedMaxAttempts = max_attempts;
  }

  if (await isTrialClass(classId)) {
    parsedMaxAttempts = 1;
  }

  const assignmentId = "asg_" + crypto.randomUUID();
  const insertSql = `
    INSERT INTO class_assignments (id, class_id, exam_id, due_date, max_attempts)
    VALUES ($1, $2, $3, $4, $5)
    RETURNING *
  `;
  const insertRes = await queryPg(insertSql, [
    assignmentId,
    classId,
    exam_id,
    due_date ?? null,
    parsedMaxAttempts,
  ]);
  const row = insertRes.rows[0];

  return NextResponse.json(
    {
      success: true,
      assignment: {
        id: row.id,
        class_id: row.class_id,
        exam_id: row.exam_id,
        due_date: row.due_date ?? null,
        max_attempts: Number(row.max_attempts),
        created_at: row.created_at,
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

  const url = new URL(req.url);
  const id = url.searchParams.get("id");
  if (!id) {
    return NextResponse.json(
      { success: false, error: "Thiếu id bài giao." },
      { status: 400 }
    );
  }

  const delRes = await queryPg(
    "DELETE FROM class_assignments WHERE id = $1 AND class_id = $2 RETURNING id",
    [id, classId]
  );
  if (delRes.rowCount === 0) {
    return NextResponse.json(
      { success: false, error: "Bài giao không tồn tại trong lớp." },
      { status: 404 }
    );
  }

  return NextResponse.json(
    { success: true, message: "Đã hủy giao bài thi thành công." },
    { status: 200 }
  );
}
