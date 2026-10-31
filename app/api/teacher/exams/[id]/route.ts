import { NextResponse } from "next/server";
import { queryPg } from "@/lib/db-pg";
import { requireRole } from "@/lib/api-auth";
import { runCypherQuery, syncCourseExam, getExamCourseMapping } from "@/lib/neo4j";

function canUseQuestion(question: any, authUser: { userId: string; role: string }): boolean {
  if (authUser.role === "ADMIN") return true;
  return question.created_by === authUser.userId || question.created_by === null || question.created_by === undefined;
}

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

    const questionIds: string[] = Array.isArray(examRow.question_ids)
      ? examRow.question_ids
      : (typeof examRow.question_ids === "string" ? JSON.parse(examRow.question_ids) : []);

    let questions: any[] = [];
    if (questionIds.length > 0) {
      const qRes = await queryPg("SELECT * FROM questions WHERE id = ANY($1)", [questionIds]);
      const qMap = new Map(
        qRes.rows.map((r: any) => [
          r.id,
          {
            ...r,
            content: typeof r.content === "string" ? JSON.parse(r.content) : r.content,
          },
        ])
      );
      questions = questionIds.map((qid) => qMap.get(qid)).filter(Boolean);
    }

    const flashcardIdSet = new Set<string>();
    for (const q of questions) {
      if (typeof q.category === "string" && q.category.includes("FLASHCARD")) {
        const ids = q.content?.flashcard_ids || q.content?.flashcardIds;
        if (Array.isArray(ids)) {
          for (const fid of ids) {
            if (typeof fid === "string" && fid.trim()) {
              flashcardIdSet.add(fid.trim());
            }
          }
        }
      }
    }

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
      question_ids: questionIds,
      skills: Array.isArray(examRow.skills) ? examRow.skills : [],
    };

    return NextResponse.json({
      success: true,
      exam,
      questions,
      flashcards,
      course_id,
    }, { status: 200 });
  } catch (err: any) {
    console.error("API /api/teacher/exams/[id] GET Error:", err);
    return NextResponse.json({ success: false, error: err.message || "Lỗi nạp thông tin đề thi." }, { status: 500 });
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

    const { title, description, duration_minutes, question_ids, course_id } = body;
    const sets: string[] = [];
    const params: any[] = [];
    let pIdx = 1;

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

    if (question_ids !== undefined) {
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

      const seenSkills = new Set<string>();
      const newSkills: string[] = [];
      for (const qid of cleanQIds) {
        const qRow = qMap.get(qid);
        if (qRow && qRow.skill && !seenSkills.has(qRow.skill)) {
          seenSkills.add(qRow.skill);
          newSkills.push(qRow.skill);
        }
      }

      sets.push(`question_ids = $${pIdx++}`);
      params.push(JSON.stringify(cleanQIds));

      sets.push(`skills = $${pIdx++}`);
      params.push(newSkills);
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
    if (sets.length > 0) {
      params.push(id);
      const updateRes = await queryPg(
        `UPDATE exams SET ${sets.join(", ")} WHERE id = $${pIdx} RETURNING *;`,
        params
      );
      updatedExamRow = updateRes.rows[0];
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
      question_ids: Array.isArray(updatedExamRow.question_ids)
        ? updatedExamRow.question_ids
        : (typeof updatedExamRow.question_ids === "string" ? JSON.parse(updatedExamRow.question_ids) : []),
      skills: Array.isArray(updatedExamRow.skills) ? updatedExamRow.skills : [],
    };

    return NextResponse.json({ success: true, exam }, { status: 200 });
  } catch (err: any) {
    console.error("API /api/teacher/exams/[id] PUT Error:", err);
    return NextResponse.json({ success: false, error: err.message || "Lỗi cập nhật đề thi." }, { status: 500 });
  }
}
