import { NextResponse } from "next/server";
import { queryPg } from "@/lib/db-pg";
import { requireRole } from "@/lib/api-auth";
import { runCypherQuery, syncCourseExam, getExamCourseMapping } from "@/lib/neo4j";
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
    const eRes = await queryPg("SELECT * FROM exams WHERE id = $1", [id]);
    if (eRes.rows.length === 0) {
      return NextResponse.json({ success: false, error: "Đề thi không tồn tại." }, { status: 404 });
    }

    const examRow = eRes.rows[0];
    if (authUser.role === "TEACHER" && examRow.created_by !== authUser.userId) {
      return NextResponse.json({ success: false, error: "Bạn không có quyền truy cập đề thi này." }, { status: 403 });
    }

    // FEAT-017: đề → phần → câu (giáo viên thấy cả đáp án)
    const sections = await loadTree(pgDb, "exam", id);
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

    let course_id: string | null = null;
    try {
      const mappings = await getExamCourseMapping();
      const mapObj = Array.isArray(mappings) ? mappings.find((m: any) => m.examId === id) : null;
      if (mapObj && mapObj.courseId) {
        course_id = mapObj.courseId;
      }
    } catch (err) {
      console.warn("getExamCourseMapping warning:", err);
    }

    const exam = {
      ...examRow,
      skills: Array.isArray(examRow.skills) ? examRow.skills : [],
      updated_at: await getVersion(pgDb, "exam", id),
      attempt_count: await hasAttempts(pgDb, "exam", id),
    };

    return NextResponse.json({
      success: true,
      exam,
      sections,
      questions,
      flashcards,
      course_id,
    }, { status: 200 });
  } catch (err: any) {
    return serverError(err, { route: "/api/teacher/exams/[id]", method: "GET", message: err.message || "Lỗi nạp thông tin đề thi." });
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
    const eRes = await queryPg("SELECT * FROM exams WHERE id = $1", [id]);
    if (eRes.rows.length === 0) {
      return NextResponse.json({ success: false, error: "Đề thi không tồn tại." }, { status: 404 });
    }

    const examRow = eRes.rows[0];
    if (authUser.role === "TEACHER" && examRow.created_by !== authUser.userId) {
      return NextResponse.json({ success: false, error: "Bạn không có quyền sửa đề thi này." }, { status: 403 });
    }

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return NextResponse.json({ success: false, error: "Dữ liệu không hợp lệ." }, { status: 400 });
    }

    // FEAT-017: nhận { exam: {...}, sections: [...] }; vẫn đọc trường phẳng ở gốc body
    const meta = body.exam && typeof body.exam === "object" ? body.exam : body;
    const { title, description, duration_minutes, course_id, scoring_standard_id, subject_id } = meta;
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

    let cleanTitle: string | null = null;
    if (title !== undefined) {
      cleanTitle = typeof title === "string" ? title.trim() : "";
      if (!cleanTitle || cleanTitle.length > 255) {
        return NextResponse.json({ success: false, error: "Tiêu đề không hợp lệ." }, { status: 400 });
      }
      sets.push(`title = $${pIdx++}`);
      params.push(cleanTitle);
    }

    if (description !== undefined) {
      sets.push(`description = $${pIdx++}`);
      params.push(description !== null ? String(description) : null);
    }

    if (duration_minutes !== undefined) {
      if (typeof duration_minutes !== "number" || !Number.isInteger(duration_minutes) || duration_minutes < 1) {
        return NextResponse.json({ success: false, error: "Thời gian làm bài phải là số nguyên ≥ 1." }, { status: 400 });
      }
      sets.push(`duration_minutes = $${pIdx++}`);
      params.push(duration_minutes);
    }

    if (scoring_standard_id !== undefined) {
      if (scoring_standard_id === null) {
        sets.push(`scoring_standard_id = $${pIdx++}`);
        params.push(null);
      } else {
        if (typeof scoring_standard_id !== "string" || !scoring_standard_id.trim()) {
          return NextResponse.json({ success: false, error: "scoring_standard_id không hợp lệ." }, { status: 400 });
        }
        const cleanStdId = scoring_standard_id.trim();
        const stdRes = await queryPg("SELECT id FROM scoring_standards WHERE id = $1", [cleanStdId]);
        if (stdRes.rows.length === 0) {
          return NextResponse.json({ success: false, error: "Chuẩn chấm điểm không tồn tại." }, { status: 400 });
        }
        sets.push(`scoring_standard_id = $${pIdx++}`);
        params.push(cleanStdId);
      }
    }

    let courseTitle: string | null = null;
    let cleanCourseId: string | null = null;
    if (course_id !== undefined && course_id !== null) {
      if (typeof course_id !== "string" || !course_id.trim()) {
        return NextResponse.json({ success: false, error: "course_id không hợp lệ." }, { status: 400 });
      }
      cleanCourseId = course_id.trim();
      const cRes = await queryPg("SELECT id, title, created_by FROM courses WHERE id = $1", [cleanCourseId]);
      if (cRes.rows.length === 0) {
        return NextResponse.json({ success: false, error: "Khóa học không tồn tại." }, { status: 400 });
      }
      const cRow = cRes.rows[0];
      if (
        authUser.role === "TEACHER" &&
        cRow.created_by !== authUser.userId &&
        cRow.created_by !== null &&
        cRow.created_by !== undefined
      ) {
        return NextResponse.json({ success: false, error: "Bạn không có quyền truy cập khóa học này." }, { status: 400 });
      }
      courseTitle = cRow.title;
    }

    let updatedExamRow = examRow;
    try {
      updatedExamRow = await inPgTx(async (db) => {
        if (sections) {
          await saveTreeInTx(db, { kind: "exam", id, userId: authUser.userId, expectedVersion, sections });
        }
        if (sets.length > 0) {
          params.push(id);
          const updateRes = await db.query(
            `UPDATE exams SET ${sets.join(", ")}, updated_at = date_trunc('milliseconds', NOW()) WHERE id = $${pIdx} RETURNING *;`,
            params
          );
          return updateRes.rows[0];
        }
        return (await db.query("SELECT * FROM exams WHERE id = $1", [id])).rows[0];
      });
    } catch (e) {
      const res = treeErrorResponse(e);
      if (res) return res;
      throw e;
    }

    if (course_id !== undefined) {
      try {
        await runCypherQuery(
          "MATCH (c:Course)-[r:HAS_EXAM]->(e:Exam {id: $examId}) DELETE r",
          { examId: id }
        );
        if (course_id !== null && cleanCourseId && courseTitle) {
          await syncCourseExam(cleanCourseId, courseTitle, id, updatedExamRow.title);
        }
      } catch (neoErr) {
        console.warn("Neo4j course sync warning:", neoErr);
      }
    }

    const exam = {
      ...updatedExamRow,
      skills: Array.isArray(updatedExamRow.skills) ? updatedExamRow.skills : [],
      subject_id: updatedExamRow.subject_id || "english",
      updated_at: await getVersion(pgDb, "exam", id),
    };

    return NextResponse.json({ success: true, exam, sections: await loadTree(pgDb, "exam", id) }, { status: 200 });
  } catch (err: any) {
    return serverError(err, { route: "/api/teacher/exams/[id]", method: "PUT", message: err.message || "Lỗi cập nhật đề thi." });
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
    const eRes = await queryPg("SELECT id, created_by FROM exams WHERE id = $1", [id]);
    if (eRes.rows.length === 0) {
      return NextResponse.json({ success: false, error: "Đề thi không tồn tại." }, { status: 404 });
    }

    const examRow = eRes.rows[0];
    if (authUser.role === "TEACHER" && examRow.created_by !== authUser.userId) {
      return NextResponse.json({ success: false, error: "Bạn không có quyền xóa đề thi này." }, { status: 403 });
    }

    const usageRes = await queryPg(
      `SELECT
        (SELECT COUNT(*)::int FROM curriculum_items WHERE exam_id = $1) AS curriculum,
        (SELECT COUNT(*)::int FROM class_assignments WHERE exam_id = $1) AS assignments,
        (SELECT COUNT(*)::int FROM submissions WHERE exam_id = $1) AS submissions;`,
      [id]
    );

    const uRow = usageRes.rows[0] || {};
    const usages = {
      curriculum: Number(uRow.curriculum || 0),
      assignments: Number(uRow.assignments || 0),
      submissions: Number(uRow.submissions || 0),
    };

    if (usages.curriculum > 0 || usages.assignments > 0 || usages.submissions > 0) {
      return NextResponse.json(
        {
          success: false,
          error: `Đề đang được dùng: ${usages.curriculum} mục lộ trình, ${usages.assignments} lớp giao, ${usages.submissions} bài nộp — gỡ khỏi lộ trình trước khi xoá`,
          usages,
        },
        { status: 409 }
      );
    }

    await queryPg("DELETE FROM exams WHERE id = $1;", [id]);

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (err: any) {
    return serverError(err, { route: "/api/teacher/exams/[id]", method: "DELETE", message: err.message || "Lỗi xóa đề thi." });
  }
}
