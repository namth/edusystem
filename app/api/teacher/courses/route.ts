import { NextResponse } from "next/server";
import { queryPg } from "@/lib/db-pg";
import { getAuthenticatedUserFromCookie } from "@/lib/auth";
import { runCypherQuery } from "@/lib/neo4j";

export async function GET() {
  try {
    const authUser = await getAuthenticatedUserFromCookie();

    if (!authUser) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    let sql = `SELECT * FROM courses ORDER BY created_at DESC;`;
    let params: any[] = [];

    if (authUser.role === "TEACHER") {
      sql = `SELECT * FROM courses WHERE created_by = $1 OR created_by IS NULL ORDER BY created_at DESC;`;
      params = [authUser.userId];
    }

    const result = await queryPg(sql, params);
    const courses = result.rows.map((row: any) => ({
      id: row.id,
      title: row.title,
      description: row.description || "",
      created_by: row.created_by,
      created_at: row.created_at,
    }));

    return NextResponse.json({ success: true, courses });
  } catch (err: any) {
    console.error("API /api/teacher/courses GET Error:", err);
    return NextResponse.json({ success: false, error: err.message || "Lỗi nạp danh sách khóa học." }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const authUser = await getAuthenticatedUserFromCookie();
    if (!authUser) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { title, description } = body;

    if (!title || !title.trim()) {
      return NextResponse.json({ success: false, error: "Vui lòng nhập tên Khóa học." }, { status: 400 });
    }

    const cleanTitle = title.trim();
    const cleanDesc = (description || "").trim();
    const newCourseId = `crs_${Date.now().toString().slice(-6)}`;

    // 1. Insert into PostgreSQL
    await queryPg(
      `INSERT INTO courses (id, title, description, created_by, created_at) VALUES ($1, $2, $3, $4, NOW());`,
      [newCourseId, cleanTitle, cleanDesc, authUser.userId]
    );

    // 2. Polyglot Sync to Neo4j Graph DB
    try {
      await runCypherQuery(
        `MERGE (c:Course {id: $id}) SET c.title = $title, c.created_by = $createdBy`,
        { id: newCourseId, title: cleanTitle, createdBy: authUser.userId }
      );
    } catch (neoErr) {
      console.warn("Neo4j create course sync warning:", neoErr);
    }

    return NextResponse.json({
      success: true,
      course: {
        id: newCourseId,
        title: cleanTitle,
        description: cleanDesc,
        created_by: authUser.userId,
      },
      message: "Đã tạo Khóa học mới thành công!",
    });
  } catch (err: any) {
    console.error("API /api/teacher/courses POST Error:", err);
    return NextResponse.json({ success: false, error: err.message || "Lỗi hệ thống khi tạo Khóa học." }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const authUser = await getAuthenticatedUserFromCookie();
    if (!authUser) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { id, title, description } = body;

    if (!id) {
      return NextResponse.json({ success: false, error: "Missing course id" }, { status: 400 });
    }

    if (!title || !title.trim()) {
      return NextResponse.json({ success: false, error: "Vui lòng nhập tên Khóa học." }, { status: 400 });
    }

    const cleanId = id.trim();
    const cleanTitle = title.trim();
    const cleanDesc = (description || "").trim();

    // Verify ownership before updating
    let updateSql = `UPDATE courses SET title = $1, description = $2 WHERE id = $3 RETURNING id;`;
    let updateParams: any[] = [cleanTitle, cleanDesc, cleanId];

    if (authUser.role === "TEACHER") {
      updateSql = `UPDATE courses SET title = $1, description = $2 WHERE id = $3 AND created_by = $4 RETURNING id;`;
      updateParams = [cleanTitle, cleanDesc, cleanId, authUser.userId];
    }

    const res = await queryPg(updateSql, updateParams);
    if (res.rowCount === 0) {
      return NextResponse.json({ success: false, error: "Bạn không có quyền chỉnh sửa Khóa học này!" }, { status: 403 });
    }

    // Polyglot Sync to Neo4j
    try {
      await runCypherQuery(
        `MATCH (c:Course {id: $id}) SET c.title = $title`,
        { id: cleanId, title: cleanTitle }
      );
    } catch (neoErr) {
      console.warn("Neo4j update course sync warning:", neoErr);
    }

    return NextResponse.json({ success: true, message: "Đã cập nhật Khóa học thành công!" });
  } catch (err: any) {
    console.error("API /api/teacher/courses PUT Error:", err);
    return NextResponse.json({ success: false, error: err.message || "Lỗi cập nhật Khóa học." }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const authUser = await getAuthenticatedUserFromCookie();
    if (!authUser) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const courseId = searchParams.get("id");

    if (!courseId) {
      return NextResponse.json({ success: false, error: "Missing course id" }, { status: 400 });
    }

    const cleanId = courseId.trim();

    let deleteSql = `DELETE FROM courses WHERE id = $1 RETURNING id;`;
    let deleteParams: any[] = [cleanId];

    if (authUser.role === "TEACHER") {
      deleteSql = `DELETE FROM courses WHERE id = $1 AND created_by = $2 RETURNING id;`;
      deleteParams = [cleanId, authUser.userId];
    }

    const res = await queryPg(deleteSql, deleteParams);

    if (res.rowCount === 0) {
      return NextResponse.json({ success: false, error: "Bạn không có quyền xóa Khóa học này!" }, { status: 403 });
    }

    // Clean curriculum items for this course
    try {
      await queryPg(`DELETE FROM curriculum_items WHERE course_id = $1;`, [cleanId]);
    } catch (e) {}

    // Detach Neo4j node
    try {
      await runCypherQuery(`MATCH (c:Course {id: $id}) DETACH DELETE c`, { id: cleanId });
    } catch (neoErr) {
      console.warn("Neo4j delete course sync warning:", neoErr);
    }

    return NextResponse.json({ success: true, message: "Đã xóa Khóa học thành công!" });
  } catch (err: any) {
    console.error("API /api/teacher/courses DELETE Error:", err);
    return NextResponse.json({ success: false, error: err.message || "Lỗi xóa Khóa học." }, { status: 500 });
  }
}
