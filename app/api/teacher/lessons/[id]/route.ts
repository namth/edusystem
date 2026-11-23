import { NextResponse } from "next/server";
import { queryPg } from "@/lib/db-pg";
import { requireRole } from "@/lib/api-auth";
import { canUseSubject } from "@/lib/subjects";
import { serverError } from "@/lib/api-errors";
import { pgDb, inPgTx, flatQuestions, flashcardIdsOf, sectionsFromBody, treeErrorResponse } from "@/lib/sections-db";
import { loadTree, saveTreeInTx, getVersion, hasAttempts } from "@/lib/exam-structure";

export async function GET(
  req: Request,
  props: { params: Promise<{ id: string }> }
) {
  const auth = await requireRole(["ADMIN", "TEACHER"]);
  if (auth.error) return auth.error;
  const authUser = auth.user;

  const { id } = await props.params;

  try {
    const lRes = await queryPg("SELECT * FROM lessons WHERE id = $1", [id]);
    if (lRes.rows.length === 0) {
      return NextResponse.json({ success: false, error: "Bài học không tồn tại." }, { status: 404 });
    }

    const lessonRow = lRes.rows[0];
    if (authUser.role === "TEACHER" && lessonRow.created_by !== authUser.userId) {
      return NextResponse.json({ success: false, error: "Bạn không có quyền truy cập bài học này." }, { status: 403 });
    }

    // FEAT-017: bài học → phần → câu
    const sections = await loadTree(pgDb, "lesson", id);
    const questions = flatQuestions(sections);
    const flashcardIdSet = new Set<string>(flashcardIdsOf(questions));

    let flashcards: any[] = [];
    if (flashcardIdSet.size > 0) {
      const fcRes = await queryPg("SELECT * FROM flashcards WHERE id = ANY($1)", [[...flashcardIdSet]]);
      flashcards = fcRes.rows.map((r: any) => ({
        ...r,
        options: typeof r.options === "string" ? JSON.parse(r.options) : (r.options || []),
      }));
    }

    const lesson = {
      id: lessonRow.id,
      title: lessonRow.title,
      description: lessonRow.description,
      skills: Array.isArray(lessonRow.skills) ? lessonRow.skills : [],
      subject_id: lessonRow.subject_id || "english",
      created_by: lessonRow.created_by,
      created_at: lessonRow.created_at,
      updated_at: await getVersion(pgDb, "lesson", id),
      attempt_count: await hasAttempts(pgDb, "lesson", id),
    };

    return NextResponse.json({ success: true, lesson, sections, questions, flashcards }, { status: 200 });
  } catch (err: any) {
    return serverError(err, { route: "/api/teacher/lessons/[id]", method: "GET", message: err.message || "Lỗi nạp bài học." });
  }
}

export async function PUT(
  req: Request,
  props: { params: Promise<{ id: string }> }
) {
  const auth = await requireRole(["ADMIN", "TEACHER"]);
  if (auth.error) return auth.error;
  const authUser = auth.user;

  const { id } = await props.params;

  try {
    const lRes = await queryPg("SELECT * FROM lessons WHERE id = $1", [id]);
    if (lRes.rows.length === 0) {
      return NextResponse.json({ success: false, error: "Bài học không tồn tại." }, { status: 404 });
    }

    const lessonRow = lRes.rows[0];
    if (authUser.role === "TEACHER" && lessonRow.created_by !== authUser.userId) {
      return NextResponse.json({ success: false, error: "Bạn không có quyền sửa bài học này." }, { status: 403 });
    }

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return NextResponse.json({ success: false, error: "Dữ liệu không hợp lệ." }, { status: 400 });
    }

    // FEAT-017: nhận { lesson: {...}, sections: [...] }; vẫn đọc trường phẳng ở gốc body
    const meta = body.lesson && typeof body.lesson === "object" ? body.lesson : body;
    const { title, description, subject_id } = meta;
    const sections = sectionsFromBody(body);
    const expectedVersion = typeof meta.updated_at === "string" ? meta.updated_at : null;

    const sets: string[] = [];
    const params: any[] = [];
    let pIdx = 1;

    if (subject_id !== undefined) {
      if (typeof subject_id !== "string" || !subject_id.trim()) {
        return NextResponse.json({ success: false, error: "Môn học không hợp lệ" }, { status: 400 });
      }
      const cleanSubjectId = subject_id.trim();
      if (!(await canUseSubject(authUser, cleanSubjectId))) {
        return NextResponse.json({ success: false, error: "Môn học không hợp lệ" }, { status: 400 });
      }
      sets.push(`subject_id = $${pIdx++}`);
      params.push(cleanSubjectId);
    }

    if (title !== undefined) {
      const cleanTitle = typeof title === "string" ? title.trim() : "";
      if (!cleanTitle || cleanTitle.length > 255) {
        return NextResponse.json(
          { success: false, error: "Tiêu đề bài học phải từ 1 đến 255 ký tự." },
          { status: 400 }
        );
      }
      sets.push(`title = $${pIdx++}`);
      params.push(cleanTitle);
    }

    if (description !== undefined) {
      sets.push(`description = $${pIdx++}`);
      params.push(description !== null ? String(description) : null);
    }

    let updated: any;
    try {
      updated = await inPgTx(async (db) => {
        if (sections) {
          await saveTreeInTx(db, { kind: "lesson", id, userId: authUser.userId, expectedVersion, sections });
        }
        sets.push(`updated_at = date_trunc('milliseconds', NOW())`);
        params.push(id);
        const updateRes = await db.query(
          `UPDATE lessons SET ${sets.join(", ")} WHERE id = $${pIdx} RETURNING *;`,
          params
        );
        return updateRes.rows[0];
      });
    } catch (e) {
      const res = treeErrorResponse(e);
      if (res) return res;
      throw e;
    }

    const lesson = {
      id: updated.id,
      title: updated.title,
      description: updated.description,
      skills: Array.isArray(updated.skills) ? updated.skills : [],
      subject_id: updated.subject_id || "english",
      created_by: updated.created_by,
      created_at: updated.created_at,
      updated_at: await getVersion(pgDb, "lesson", id),
    };

    return NextResponse.json({ success: true, lesson, sections: await loadTree(pgDb, "lesson", id) }, { status: 200 });
  } catch (err: any) {
    return serverError(err, { route: "/api/teacher/lessons/[id]", method: "PUT", message: err.message || "Lỗi cập nhật bài học." });
  }
}

export async function DELETE(
  req: Request,
  props: { params: Promise<{ id: string }> }
) {
  const auth = await requireRole(["ADMIN", "TEACHER"]);
  if (auth.error) return auth.error;
  const authUser = auth.user;

  const { id } = await props.params;

  try {
    const lRes = await queryPg("SELECT * FROM lessons WHERE id = $1", [id]);
    if (lRes.rows.length === 0) {
      return NextResponse.json({ success: false, error: "Bài học không tồn tại." }, { status: 404 });
    }

    const lessonRow = lRes.rows[0];
    if (authUser.role === "TEACHER" && lessonRow.created_by !== authUser.userId) {
      return NextResponse.json({ success: false, error: "Bạn không có quyền xóa bài học này." }, { status: 403 });
    }

    const usagesRes = await queryPg(
      `SELECT ci.id AS curriculum_item_id, ci.course_id, c.title AS course_title
       FROM curriculum_items ci
       LEFT JOIN courses c ON c.id = ci.course_id
       WHERE ci.lesson_id = $1;`,
      [id]
    );

    if (usagesRes.rows.length > 0) {
      return NextResponse.json(
        {
          success: false,
          error: "Bài học đang được gắn trong lộ trình, không thể xóa.",
          usages: usagesRes.rows.map((r: any) => ({
            course_id: r.course_id,
            course_title: r.course_title,
            curriculum_item_id: r.curriculum_item_id,
          })),
        },
        { status: 409 }
      );
    }

    await queryPg("DELETE FROM lessons WHERE id = $1;", [id]);

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (err: any) {
    return serverError(err, { route: "/api/teacher/lessons/[id]", method: "DELETE", message: err.message || "Lỗi xóa bài học." });
  }
}
