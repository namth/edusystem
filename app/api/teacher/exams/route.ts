import { NextResponse } from "next/server";
import crypto from "crypto";
import { queryPg } from "@/lib/db-pg";
import { getAuthenticatedUserFromCookie } from "@/lib/auth";
import { requireRole } from "@/lib/api-auth";
import { syncCourseExam } from "@/lib/neo4j";
import { pushRedisStreamEvent } from "@/lib/redis-queue";
import { canUseSubject } from "@/lib/subjects";
import { assertTrialAllows, trialLimitResponse } from "@/lib/teacher-trial";
import { serverError } from "@/lib/api-errors";
import { pgDb, inPgTx, sectionsFromBody, treeErrorResponse } from "@/lib/sections-db";
import { loadTree, saveTreeInTx, getVersion } from "@/lib/exam-structure";

export async function GET(req?: Request) {
  try {
    const authUser = await getAuthenticatedUserFromCookie();

    if (!authUser) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const conditions: string[] = [];
    const params: any[] = [];

    if (authUser.role === "TEACHER") {
      conditions.push(`(e.created_by = $${params.length + 1} OR e.created_by IS NULL)`);
      params.push(authUser.userId);
    }

    let q: string | null = null;
    let subjectId: string | null = null;
    if (req?.url) {
      try {
        const sp = new URL(req.url).searchParams;
        q = sp.get("q");
        subjectId = sp.get("subject_id");
      } catch {
        q = null;
        subjectId = null;
      }
    }

    if (q && q.trim()) {
      conditions.push(`e.title ILIKE $${params.length + 1}`);
      params.push(`%${q.trim()}%`);
    }

    if (subjectId && subjectId.trim()) {
      conditions.push(`e.subject_id = $${params.length + 1}`);
      params.push(subjectId.trim());
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    const sql = `
      SELECT
        e.*,
        (SELECT COUNT(*)::int FROM questions q JOIN sections s ON s.id = q.section_id
          WHERE s.exam_id = e.id AND s.deleted_at IS NULL AND q.deleted_at IS NULL) AS question_count,
        (SELECT COUNT(*)::int FROM curriculum_items ci WHERE ci.exam_id = e.id) AS usage_count
      FROM exams e
      ${whereClause}
      ORDER BY e.created_at DESC;
    `;

    const result = await queryPg(sql, params);
    const exams = result.rows.map((row: any) => ({
      id: row.id,
      title: row.title,
      description: row.description || "",
      duration_minutes: row.duration_minutes ?? 60,
      skills: Array.isArray(row.skills) ? row.skills : [],
      question_count: Number(row.question_count || 0),
      usage_count: Number(row.usage_count || 0),
      scoring_standard_id: row.scoring_standard_id || null,
      subject_id: row.subject_id || "english",
      created_by: row.created_by,
      created_at: row.created_at,
    }));

    return NextResponse.json({ success: true, exams });
  } catch (err: any) {
    return serverError(err, { route: "/api/teacher/exams", method: "GET", message: err.message || "Lỗi nạp danh sách đề thi." });
  }
}

export async function POST(req: Request) {
  const auth = await requireRole(["ADMIN", "TEACHER"]);
  if (auth.error) return auth.error;
  const authUser = auth.user;

  try {
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return NextResponse.json({ success: false, error: "Dữ liệu không hợp lệ." }, { status: 400 });
    }

    // FEAT-017: nhận { exam: {...}, sections: [...] }; vẫn đọc trường phẳng ở gốc body
    const meta = body.exam && typeof body.exam === "object" ? body.exam : body;
    const { title, description, duration_minutes, course_id, scoring_standard_id, subject_id } = meta;
    const sections = sectionsFromBody(body);
    if (!sections) {
      return NextResponse.json({ success: false, error: "Thiếu danh sách phần (sections)." }, { status: 400 });
    }

    const cleanTitle = typeof title === "string" ? title.trim() : "";
    if (!cleanTitle || cleanTitle.length > 255) {
      return NextResponse.json({ success: false, error: "Tiêu đề đề thi không hợp lệ (từ 1 đến 255 ký tự)." }, { status: 400 });
    }

    let finalDuration = 60;
    if (duration_minutes !== undefined && duration_minutes !== null) {
      if (typeof duration_minutes !== "number" || !Number.isInteger(duration_minutes) || duration_minutes < 1) {
        return NextResponse.json({ success: false, error: "Thời gian làm bài phải là số nguyên ≥ 1." }, { status: 400 });
      }
      finalDuration = duration_minutes;
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
      const courseRow = cRes.rows[0];
      if (
        authUser.role === "TEACHER" &&
        courseRow.created_by !== authUser.userId &&
        courseRow.created_by !== null &&
        courseRow.created_by !== undefined
      ) {
        return NextResponse.json({ success: false, error: "Bạn không có quyền truy cập khóa học này." }, { status: 400 });
      }
      courseTitle = courseRow.title;
    }

    let cleanScoringStandardId: string | null = null;
    if (scoring_standard_id !== undefined && scoring_standard_id !== null) {
      if (typeof scoring_standard_id !== "string" || !scoring_standard_id.trim()) {
        return NextResponse.json({ success: false, error: "scoring_standard_id không hợp lệ." }, { status: 400 });
      }
      cleanScoringStandardId = scoring_standard_id.trim();
      const stdRes = await queryPg("SELECT id FROM scoring_standards WHERE id = $1", [cleanScoringStandardId]);
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

    const examId = "exam_" + crypto.randomUUID();
    const cleanDesc = description !== undefined && description !== null ? String(description) : null;

    const trial = await assertTrialAllows(authUser.userId, "contents");
    if (!trial.ok) {
      return trialLimitResponse("contents", trial.error);
    }

    const cols = ["id", "title", "description", "duration_minutes", "skills", "created_by"];
    const insertParams: any[] = [
      examId,
      cleanTitle,
      cleanDesc,
      finalDuration,
      [],
      authUser.userId,
    ];

    if (cleanScoringStandardId) {
      cols.push("scoring_standard_id");
      insertParams.push(cleanScoringStandardId);
    }

    if (hasExplicitSubjectId) {
      cols.push("subject_id");
      insertParams.push(cleanSubjectId);
    }

    const placeholders = cols.map((_, idx) => `$${idx + 1}`).join(", ");
    const insertSql = `INSERT INTO exams (${cols.join(", ")}, created_at) VALUES (${placeholders}, NOW()) RETURNING *;`;

    let examRow: any;
    try {
      examRow = await inPgTx(async (db) => {
        await db.query(insertSql, insertParams);
        await saveTreeInTx(db, { kind: "exam", id: examId, userId: authUser.userId, sections });
        return (await db.query("SELECT * FROM exams WHERE id = $1", [examId])).rows[0];
      });
    } catch (e) {
      const res = treeErrorResponse(e);
      if (res) return res;
      throw e;
    }

    const exam = {
      ...examRow,
      updated_at: await getVersion(pgDb, "exam", examId),
      skills: Array.isArray(examRow.skills) ? examRow.skills : [],
      scoring_standard_id: examRow.scoring_standard_id ?? null,
      subject_id: examRow.subject_id || cleanSubjectId,
    };

    if (cleanCourseId && courseTitle) {
      try {
        await syncCourseExam(cleanCourseId, courseTitle, exam.id, exam.title);
      } catch (err) {
        console.warn("Neo4j syncCourseExam warning:", err);
      }
    }

    try {
      await pushRedisStreamEvent("stream:learning:exams", "EXAM_CREATED", {
        courseId: cleanCourseId || null,
        exam: {
          id: exam.id,
          title: exam.title,
          duration_minutes: exam.duration_minutes,
          skills: exam.skills,
        },
      });
    } catch (err) {
      console.warn("pushRedisStreamEvent warning:", err);
    }

    return NextResponse.json({ success: true, exam, sections: await loadTree(pgDb, "exam", examId) }, { status: 201 });
  } catch (err: any) {
    return serverError(err, { route: "/api/teacher/exams", method: "POST", message: err.message || "Lỗi tạo đề thi." });
  }
}
