import { NextResponse } from "next/server";
import { queryPg } from "@/lib/db-pg";
import { requireRole } from "@/lib/api-auth";
import { runCypherQuery } from "@/lib/neo4j";
import { canUseSubject } from "@/lib/subjects";

export async function GET(req?: Request) {
  const auth = await requireRole(["ADMIN", "TEACHER"]);
  if (auth.error) return auth.error;
  const authUser = auth.user;

  try {
    let subjectId: string | null = null;
    if (req?.url) {
      try {
        subjectId = new URL(req.url).searchParams.get("subject_id");
      } catch {
        subjectId = null;
      }
    }

    const conditions: string[] = [];
    const params: any[] = [];

    if (authUser.role === "TEACHER") {
      conditions.push(`(created_by = $${params.length + 1} OR created_by IS NULL)`);
      params.push(authUser.userId);
    }

    if (subjectId && subjectId.trim()) {
      conditions.push(`subject_id = $${params.length + 1}`);
      params.push(subjectId.trim());
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
    const sql = `SELECT * FROM courses ${whereClause} ORDER BY created_at DESC;`;

    const result = await queryPg(sql, params);
    const courses = result.rows.map((row: any) => ({
      id: row.id,
      title: row.title,
      description: row.description || "",
      default_scoring_standard_id: row.default_scoring_standard_id || null,
      subject_id: row.subject_id || "english",
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
  const auth = await requireRole(["ADMIN", "TEACHER"]);
  if (auth.error) return auth.error;
  const authUser = auth.user;

  try {
    const body = await req.json();
    const { title, description, default_scoring_standard_id, subject_id } = body;

    if (!title || !title.trim()) {
      return NextResponse.json({ success: false, error: "Vui lòng nhập tên Khóa học." }, { status: 400 });
    }

    let cleanDefaultStandardId: string | null = null;
    if (default_scoring_standard_id !== undefined && default_scoring_standard_id !== null) {
      if (typeof default_scoring_standard_id !== "string" || !default_scoring_standard_id.trim()) {
        return NextResponse.json({ success: false, error: "default_scoring_standard_id không hợp lệ." }, { status: 400 });
      }
      cleanDefaultStandardId = default_scoring_standard_id.trim();
      const stdRes = await queryPg("SELECT id FROM scoring_standards WHERE id = $1", [cleanDefaultStandardId]);
      if (stdRes.rows.length === 0) {
        return NextResponse.json({ success: false, error: "Chuẩn chấm điểm không tồn tại." }, { status: 400 });
      }
    }

    let cleanSubjectId = "english";
    let hasExplicitSubjectId = false;
    if (subject_id !== undefined && subject_id !== null) {
      if (typeof subject_id !== "string" || !subject_id.trim()) {
        return NextResponse.json({ success: false, error: "Môn học không hợp lệ" }, { status: 400 });
      }
      cleanSubjectId = subject_id.trim();
      hasExplicitSubjectId = true;
      if (!(await canUseSubject(authUser, cleanSubjectId))) {
        return NextResponse.json({ success: false, error: "Môn học không hợp lệ" }, { status: 400 });
      }
    }

    const cleanTitle = title.trim();
    const cleanDesc = (description || "").trim();
    const newCourseId = `crs_${Date.now().toString().slice(-6)}_${Math.random().toString(36).slice(2, 6)}`;

    // 1. Insert into PostgreSQL
    const cols = ["id", "title", "description", "created_by"];
    const insertParams: any[] = [newCourseId, cleanTitle, cleanDesc, authUser.userId];

    if (cleanDefaultStandardId) {
      cols.push("default_scoring_standard_id");
      insertParams.push(cleanDefaultStandardId);
    }

    if (hasExplicitSubjectId) {
      cols.push("subject_id");
      insertParams.push(cleanSubjectId);
    }

    const placeholders = cols.map((_, idx) => `$${idx + 1}`).join(", ");
    const insertSql = `INSERT INTO courses (${cols.join(", ")}, created_at) VALUES (${placeholders}, NOW());`;

    await queryPg(insertSql, insertParams);

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
        default_scoring_standard_id: cleanDefaultStandardId,
        subject_id: cleanSubjectId,
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
  const auth = await requireRole(["ADMIN", "TEACHER"]);
  if (auth.error) return auth.error;
  const authUser = auth.user;

  try {
    const body = await req.json();
    const { id, title, description, default_scoring_standard_id, subject_id } = body;

    if (!id) {
      return NextResponse.json({ success: false, error: "Missing course id" }, { status: 400 });
    }

    if (!title || !title.trim()) {
      return NextResponse.json({ success: false, error: "Vui lòng nhập tên Khóa học." }, { status: 400 });
    }

    let cleanDefaultStandardId: string | null = null;
    if (default_scoring_standard_id !== undefined) {
      if (default_scoring_standard_id !== null) {
        if (typeof default_scoring_standard_id !== "string" || !default_scoring_standard_id.trim()) {
          return NextResponse.json({ success: false, error: "default_scoring_standard_id không hợp lệ." }, { status: 400 });
        }
        cleanDefaultStandardId = default_scoring_standard_id.trim();
        const stdRes = await queryPg("SELECT id FROM scoring_standards WHERE id = $1", [cleanDefaultStandardId]);
        if (stdRes.rows.length === 0) {
          return NextResponse.json({ success: false, error: "Chuẩn chấm điểm không tồn tại." }, { status: 400 });
        }
      }
    }

    let cleanSubjectId: string | null = null;
    if (subject_id !== undefined) {
      if (typeof subject_id !== "string" || !subject_id.trim()) {
        return NextResponse.json({ success: false, error: "Môn học không hợp lệ" }, { status: 400 });
      }
      cleanSubjectId = subject_id.trim();
      if (!(await canUseSubject(authUser, cleanSubjectId))) {
        return NextResponse.json({ success: false, error: "Môn học không hợp lệ" }, { status: 400 });
      }
    }

    const cleanId = id.trim();
    const cleanTitle = title.trim();
    const cleanDesc = (description || "").trim();

    // Verify ownership before updating
    const sets = ["title = $1", "description = $2"];
    const updateParams: any[] = [cleanTitle, cleanDesc];

    if (default_scoring_standard_id !== undefined) {
      sets.push(`default_scoring_standard_id = $${updateParams.length + 1}`);
      updateParams.push(cleanDefaultStandardId);
    }

    if (cleanSubjectId !== null) {
      sets.push(`subject_id = $${updateParams.length + 1}`);
      updateParams.push(cleanSubjectId);
    }

    updateParams.push(cleanId);
    let whereSql = `id = $${updateParams.length}`;
    if (authUser.role === "TEACHER") {
      updateParams.push(authUser.userId);
      whereSql += ` AND created_by = $${updateParams.length}`;
    }

    const updateSql = `UPDATE courses SET ${sets.join(", ")} WHERE ${whereSql} RETURNING id;`;

    const res = await queryPg(updateSql, updateParams);
    if (res.rowCount === 0) {
      return NextResponse.json({ success: false, error: "Không tìm thấy khóa học hoặc bạn không có quyền." }, { status: 404 });
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
  const auth = await requireRole(["ADMIN", "TEACHER"]);
  if (auth.error) return auth.error;
  const authUser = auth.user;

  try {
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
      return NextResponse.json({ success: false, error: "Không tìm thấy khóa học hoặc bạn không có quyền." }, { status: 404 });
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
