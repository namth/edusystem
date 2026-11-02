import { NextResponse } from "next/server";
import { queryPg } from "@/lib/db-pg";
import { requireRole } from "@/lib/api-auth";

export async function PUT(
  req: Request,
  props: { params: Promise<{ id: string }> }
) {
  const auth = await requireRole(["ADMIN", "TEACHER"]);
  if (auth.error) return auth.error;
  const user = auth.user;

  const { id } = await props.params;

  try {
    const existingRes = await queryPg("SELECT * FROM subjects WHERE id = $1", [id]);
    if (existingRes.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: "Môn học không tồn tại." },
        { status: 404 }
      );
    }

    const current = existingRes.rows[0];
    if (user.role === "TEACHER" && current.owner_id !== user.userId) {
      return NextResponse.json(
        { success: false, error: "Bạn không có quyền chỉnh sửa môn học này." },
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

    const sets: string[] = [];
    const params: unknown[] = [];
    let pIdx = 1;

    if (body.name !== undefined) {
      const cleanName = typeof body.name === "string" ? body.name.trim() : "";
      if (!cleanName || cleanName.length > 100) {
        return NextResponse.json(
          { success: false, error: "Tên môn học phải từ 1 đến 100 ký tự." },
          { status: 400 }
        );
      }
      sets.push(`name = $${pIdx++}`);
      params.push(cleanName);
    }

    if (body.icon !== undefined) {
      const cleanIcon =
        body.icon === null
          ? null
          : typeof body.icon === "string" && body.icon.trim()
          ? body.icon.trim().slice(0, 40)
          : null;
      sets.push(`icon = $${pIdx++}`);
      params.push(cleanIcon);
    }

    if (body.color !== undefined) {
      const cleanColor =
        body.color === null
          ? null
          : typeof body.color === "string" && body.color.trim()
          ? body.color.trim().slice(0, 20)
          : null;
      sets.push(`color = $${pIdx++}`);
      params.push(cleanColor);
    }

    if (body.is_active !== undefined) {
      if (typeof body.is_active !== "boolean") {
        return NextResponse.json(
          { success: false, error: "Trạng thái kích hoạt không hợp lệ." },
          { status: 400 }
        );
      }
      sets.push(`is_active = $${pIdx++}`);
      params.push(body.is_active);
    }

    if (body.order_index !== undefined) {
      if (typeof body.order_index !== "number" || !Number.isInteger(body.order_index)) {
        return NextResponse.json(
          { success: false, error: "Thứ tự hiển thị không hợp lệ." },
          { status: 400 }
        );
      }
      sets.push(`order_index = $${pIdx++}`);
      params.push(body.order_index);
    }

    if (user.role === "ADMIN" && body.mode !== undefined) {
      if (body.mode !== "LANGUAGE" && body.mode !== "SIMPLE") {
        return NextResponse.json(
          { success: false, error: "Chế độ môn học không hợp lệ." },
          { status: 400 }
        );
      }
      sets.push(`mode = $${pIdx++}`);
      params.push(body.mode);
    }

    let updated = current;
    if (sets.length > 0) {
      params.push(id);
      const updRes = await queryPg(
        `UPDATE subjects SET ${sets.join(", ")} WHERE id = $${pIdx} RETURNING *;`,
        params
      );
      updated = updRes.rows[0];
    }

    const subject = {
      id: updated.id,
      code: updated.code,
      name: updated.name,
      icon: updated.icon ?? null,
      color: updated.color ?? null,
      mode: updated.mode,
      owner_id: updated.owner_id ?? null,
      is_active: Boolean(updated.is_active),
      order_index: Number(updated.order_index || 0),
    };

    return NextResponse.json({ success: true, subject }, { status: 200 });
  } catch (err: any) {
    console.error("API /api/subjects/[id] PUT Error:", err);
    return NextResponse.json(
      { success: false, error: err.message || "Lỗi cập nhật môn học." },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: Request,
  props: { params: Promise<{ id: string }> }
) {
  const auth = await requireRole(["ADMIN", "TEACHER"]);
  if (auth.error) return auth.error;
  const user = auth.user;

  const { id } = await props.params;

  try {
    const existingRes = await queryPg("SELECT * FROM subjects WHERE id = $1", [id]);
    if (existingRes.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: "Môn học không tồn tại." },
        { status: 404 }
      );
    }

    const current = existingRes.rows[0];
    if (user.role === "TEACHER" && current.owner_id !== user.userId) {
      return NextResponse.json(
        { success: false, error: "Bạn không có quyền xóa môn học này." },
        { status: 403 }
      );
    }

    if (id === "english") {
      return NextResponse.json(
        { success: false, error: "Không thể xóa môn Tiếng Anh mặc định của hệ thống." },
        { status: 409 }
      );
    }

    const usageRes = await queryPg(
      `SELECT
        (SELECT COUNT(*)::int FROM courses WHERE subject_id = $1) AS courses,
        (SELECT COUNT(*)::int FROM exams WHERE subject_id = $1) AS exams,
        (SELECT COUNT(*)::int FROM lessons WHERE subject_id = $1) AS lessons;`,
      [id]
    );

    const uRow = usageRes.rows[0] || {};
    const usages = {
      courses: Number(uRow.courses || 0),
      exams: Number(uRow.exams || 0),
      lessons: Number(uRow.lessons || 0),
    };

    if (usages.courses > 0 || usages.exams > 0 || usages.lessons > 0) {
      return NextResponse.json(
        {
          success: false,
          error: `Môn đang được dùng: ${usages.courses} khoá, ${usages.exams} đề, ${usages.lessons} bài học`,
          usages,
        },
        { status: 409 }
      );
    }

    await queryPg("DELETE FROM subjects WHERE id = $1;", [id]);

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (err: any) {
    console.error("API /api/subjects/[id] DELETE Error:", err);
    return NextResponse.json(
      { success: false, error: err.message || "Lỗi xóa môn học." },
      { status: 500 }
    );
  }
}
