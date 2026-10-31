import { NextResponse } from "next/server";
import { requireRole } from "@/lib/api-auth";
import { queryPg, getPgPool } from "@/lib/db-pg";

export async function GET(
  _req: Request,
  context: { params: Promise<{ classId: string }> | { classId: string } }
) {
  const auth = await requireRole(["ADMIN", "TEACHER"]);
  if (auth.error) return auth.error;
  const user = auth.user;

  const { classId } = await context.params;

  const classRes = await queryPg("SELECT * FROM classes WHERE id = $1", [classId]);
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

  return NextResponse.json({
    success: true,
    class: {
      id: cls.id,
      name: cls.name,
      code: cls.code,
      teacher_id: cls.teacher_id,
      schedule: cls.schedule ?? null,
      max_slots: Number(cls.max_slots ?? 30),
      course_id: cls.course_id ?? null,
      unlock_mode: cls.unlock_mode ?? "MANUAL",
      pass_percent: Number(cls.pass_percent ?? 70),
      created_at: cls.created_at,
    },
  });
}

export async function PUT(
  req: Request,
  context: { params: Promise<{ classId: string }> | { classId: string } }
) {
  const auth = await requireRole(["ADMIN", "TEACHER"]);
  if (auth.error) return auth.error;
  const user = auth.user;

  const { classId } = await context.params;

  const classRes = await queryPg("SELECT * FROM classes WHERE id = $1", [classId]);
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

  const updates: string[] = [];
  const params: unknown[] = [];
  let pIdx = 1;

  if (body.name !== undefined) {
    if (
      typeof body.name !== "string" ||
      body.name.trim().length < 1 ||
      body.name.trim().length > 150
    ) {
      return NextResponse.json(
        { success: false, error: "Tên lớp phải từ 1 đến 150 ký tự." },
        { status: 400 }
      );
    }
    updates.push(`name = $${pIdx++}`);
    params.push(body.name.trim());
  }

  if (body.max_slots !== undefined) {
    if (
      typeof body.max_slots !== "number" ||
      !Number.isInteger(body.max_slots) ||
      body.max_slots < 1 ||
      body.max_slots > 500
    ) {
      return NextResponse.json(
        { success: false, error: "Sĩ số tối đa phải là số nguyên từ 1 đến 500." },
        { status: 400 }
      );
    }
    updates.push(`max_slots = $${pIdx++}`);
    params.push(body.max_slots);
  }

  if (body.schedule !== undefined) {
    if (body.schedule !== null && typeof body.schedule !== "string") {
      return NextResponse.json(
        { success: false, error: "Lịch học không hợp lệ." },
        { status: 400 }
      );
    }
    updates.push(`schedule = $${pIdx++}`);
    params.push(body.schedule ? body.schedule.trim() : null);
  }

  let updatedRow = cls;
  if (updates.length > 0) {
    params.push(classId);
    const updateSql = `UPDATE classes SET ${updates.join(", ")} WHERE id = $${pIdx} RETURNING *`;
    const updateRes = await queryPg(updateSql, params);
    updatedRow = updateRes.rows[0];
  }

  return NextResponse.json(
    {
      success: true,
      class: {
        id: updatedRow.id,
        name: updatedRow.name,
        code: updatedRow.code,
        teacher_id: updatedRow.teacher_id,
        schedule: updatedRow.schedule ?? null,
        max_slots: Number(updatedRow.max_slots),
        course_id: updatedRow.course_id ?? null,
        unlock_mode: updatedRow.unlock_mode ?? "MANUAL",
        pass_percent: Number(updatedRow.pass_percent ?? 70),
        created_at: updatedRow.created_at,
      },
    },
    { status: 200 }
  );
}

export async function DELETE(
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

  const pool = getPgPool();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("DELETE FROM enrollments WHERE class_id = $1", [classId]);
    await client.query("DELETE FROM class_assignments WHERE class_id = $1", [classId]);
    await client.query("DELETE FROM class_unlocks WHERE class_id = $1", [classId]);
    await client.query("DELETE FROM classes WHERE id = $1", [classId]);
    await client.query("COMMIT");

    return NextResponse.json(
      { success: true, message: "Đã xóa lớp học thành công." },
      { status: 200 }
    );
  } catch (err: any) {
    await client.query("ROLLBACK");
    console.error("DELETE /api/teacher/classes/[classId] error:", err);
    return NextResponse.json(
      { success: false, error: err.message || "Lỗi xóa lớp học." },
      { status: 500 }
    );
  } finally {
    client.release();
  }
}
