import { NextResponse } from "next/server";
import { queryPg } from "@/lib/db-pg";
import { getAuthenticatedUserFromCookie } from "@/lib/auth";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const courseId = searchParams.get("courseId") || "crs_01";
    const authUser = await getAuthenticatedUserFromCookie();

    if (!authUser) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    let sql = `SELECT * FROM curriculum_items WHERE course_id = $1 ORDER BY order_index ASC;`;
    let params: any[] = [courseId];

    if (authUser.role === "TEACHER") {
      sql = `SELECT * FROM curriculum_items WHERE course_id = $1 AND (created_by = $2 OR created_by IS NULL) ORDER BY order_index ASC;`;
      params = [courseId, authUser.userId];
    }

    const result = await queryPg(sql, params);
    const items = result.rows.map((r: any) => ({
      id: r.id,
      course_id: r.course_id,
      parent_id: r.parent_id,
      title: r.title,
      type: r.type,
      exam_id: r.exam_id,
      order_index: r.order_index || 0,
      created_by: r.created_by,
    }));

    return NextResponse.json({ success: true, items });
  } catch (err: any) {
    console.error("API /api/teacher/curriculum GET Error:", err);
    return NextResponse.json({ success: false, error: err.message || "Lỗi nạp chương trình học." }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const authUser = await getAuthenticatedUserFromCookie();
    if (!authUser) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { courseId, parentId, title, type, examId, orderIndex } = body;

    if (!title?.trim()) {
      return NextResponse.json({ success: false, error: "Vui lòng nhập tên bài học/đề thi/chương." }, { status: 400 });
    }

    const newItemId = `curr_${type.toLowerCase()}_${Date.now().toString().slice(-6)}`;

    await queryPg(
      `INSERT INTO curriculum_items (id, course_id, parent_id, title, type, exam_id, order_index, created_by, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW());`,
      [newItemId, courseId || "crs_01", parentId || null, title.trim(), type, examId || null, orderIndex || 0, authUser.userId]
    );

    return NextResponse.json({ success: true, itemId: newItemId, message: "Đã khởi tạo bài học/đề thi thành công với quyền sở hữu cá nhân!" });
  } catch (err: any) {
    console.error("API /api/teacher/curriculum POST Error:", err);
    return NextResponse.json({ success: false, error: err.message || "Lỗi tạo bài học/đề thi." }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const authUser = await getAuthenticatedUserFromCookie();
    if (!authUser) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const itemId = searchParams.get("id");

    if (!itemId) {
      return NextResponse.json({ success: false, error: "Missing itemId" }, { status: 400 });
    }

    // Verify ownership before deleting
    let deleteSql = `DELETE FROM curriculum_items WHERE id = $1;`;
    let deleteParams: any[] = [itemId];

    if (authUser.role === "TEACHER") {
      deleteSql = `DELETE FROM curriculum_items WHERE id = $1 AND created_by = $2;`;
      deleteParams = [itemId, authUser.userId];
    }

    const res = await queryPg(deleteSql, deleteParams);

    if (res.rowCount === 0) {
      return NextResponse.json({ success: false, error: "Bạn không có quyền xóa bài học/đề thi này!" }, { status: 403 });
    }

    return NextResponse.json({ success: true, message: "Đã xóa bài học/đề thi khỏi chương trình!" });
  } catch (err: any) {
    console.error("API /api/teacher/curriculum DELETE Error:", err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
