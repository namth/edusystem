import { NextResponse } from "next/server";
import crypto from "crypto";
import { queryPg } from "@/lib/db-pg";
import { getAuthenticatedUserFromCookie } from "@/lib/auth";
import { requireRole } from "@/lib/api-auth";
import { syncCourseExam } from "@/lib/neo4j";
import { pushRedisStreamEvent } from "@/lib/redis-queue";

function canUseQuestion(question: any, authUser: { userId: string; role: string }): boolean {
  if (authUser.role === "ADMIN") return true;
  return question.created_by === authUser.userId || question.created_by === null || question.created_by === undefined;
}

export async function GET() {
  try {
    const authUser = await getAuthenticatedUserFromCookie();

    if (!authUser) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    let sql = `SELECT * FROM exams ORDER BY created_at DESC;`;
    let params: any[] = [];

    if (authUser.role === "TEACHER") {
      sql = `SELECT * FROM exams WHERE created_by = $1 OR created_by IS NULL ORDER BY created_at DESC;`;
      params = [authUser.userId];
    }

    const result = await queryPg(sql, params);
    const exams = result.rows.map((row: any) => ({
      id: row.id,
      title: row.title,
      description: row.description || "",
      created_by: row.created_by,
      created_at: row.created_at,
    }));

    return NextResponse.json({ success: true, exams });
  } catch (err: any) {
    console.error("API /api/teacher/exams GET Error:", err);
    return NextResponse.json({ success: false, error: err.message || "Lỗi nạp danh sách đề thi." }, { status: 500 });
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

    const { title, description, duration_minutes, question_ids, course_id } = body;

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

    if (!Array.isArray(question_ids) || question_ids.length === 0 || question_ids.some((qid) => typeof qid !== "string" || !qid.trim())) {
      return NextResponse.json({ success: false, error: "question_ids phải là mảng chuỗi ID câu hỏi không rỗng." }, { status: 400 });
    }

    const cleanQIds: string[] = question_ids.map((q) => q.trim());
    const qRes = await queryPg("SELECT id, skill, created_by FROM questions WHERE id = ANY($1)", [cleanQIds]);
    const qMap = new Map(qRes.rows.map((r: any) => [r.id, r]));

    for (const qid of cleanQIds) {
      const qRow = qMap.get(qid);
      if (!qRow || !canUseQuestion(qRow, authUser)) {
        return NextResponse.json(
          { success: false, error: "Câu hỏi không tồn tại hoặc bạn không có quyền sử dụng." },
          { status: 400 }
        );
      }
    }

    const skills: string[] = [];
    const seenSkills = new Set<string>();
    for (const qid of cleanQIds) {
      const qRow = qMap.get(qid);
      if (qRow && qRow.skill && !seenSkills.has(qRow.skill)) {
        seenSkills.add(qRow.skill);
        skills.push(qRow.skill);
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

    const examId = "exam_" + crypto.randomUUID();
    const cleanDesc = description !== undefined && description !== null ? String(description) : null;

    const insertRes = await queryPg(
      `INSERT INTO exams (id, title, description, duration_minutes, skills, question_ids, created_by, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
       RETURNING *;`,
      [
        examId,
        cleanTitle,
        cleanDesc,
        finalDuration,
        skills,
        JSON.stringify(cleanQIds),
        authUser.userId,
      ]
    );

    const examRow = insertRes.rows[0];
    const exam = {
      ...examRow,
      question_ids: Array.isArray(examRow.question_ids)
        ? examRow.question_ids
        : (typeof examRow.question_ids === "string" ? JSON.parse(examRow.question_ids) : []),
      skills: Array.isArray(examRow.skills) ? examRow.skills : [],
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

    return NextResponse.json({ success: true, exam }, { status: 201 });
  } catch (err: any) {
    console.error("API /api/teacher/exams POST Error:", err);
    return NextResponse.json({ success: false, error: err.message || "Lỗi tạo đề thi." }, { status: 500 });
  }
}
