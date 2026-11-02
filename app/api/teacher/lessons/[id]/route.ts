import { NextResponse } from "next/server";
import { queryPg } from "@/lib/db-pg";
import { requireRole } from "@/lib/api-auth";
import { canUseSubject } from "@/lib/subjects";

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
    const lRes = await queryPg("SELECT * FROM lessons WHERE id = $1", [id]);
    if (lRes.rows.length === 0) {
      return NextResponse.json({ success: false, error: "Bài học không tồn tại." }, { status: 404 });
    }

    const lessonRow = lRes.rows[0];
    if (authUser.role === "TEACHER" && lessonRow.created_by !== authUser.userId) {
      return NextResponse.json({ success: false, error: "Bạn không có quyền truy cập bài học này." }, { status: 403 });
    }

    const questionIds: string[] = Array.isArray(lessonRow.question_ids)
      ? lessonRow.question_ids
      : (typeof lessonRow.question_ids === "string" ? JSON.parse(lessonRow.question_ids) : []);

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

    const lesson = {
      id: lessonRow.id,
      title: lessonRow.title,
      description: lessonRow.description,
      skills: Array.isArray(lessonRow.skills) ? lessonRow.skills : [],
      question_ids: questionIds,
      subject_id: lessonRow.subject_id || "english",
      created_by: lessonRow.created_by,
      created_at: lessonRow.created_at,
      updated_at: lessonRow.updated_at,
    };

    return NextResponse.json({ success: true, lesson, questions, flashcards }, { status: 200 });
  } catch (err: any) {
    console.error("API /api/teacher/lessons/[id] GET Error:", err);
    return NextResponse.json({ success: false, error: err.message || "Lỗi nạp bài học." }, { status: 500 });
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

    const { title, description, question_ids, subject_id } = body;

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

    if (question_ids !== undefined) {
      if (!Array.isArray(question_ids) || question_ids.some((qid) => typeof qid !== "string")) {
        return NextResponse.json(
          { success: false, error: "question_ids phải là mảng chuỗi ID câu hỏi." },
          { status: 400 }
        );
      }

      const cleanQIds: string[] = question_ids.map((q) => q.trim());
      const skills: string[] = [];

      if (cleanQIds.length > 0) {
        const qRes = await queryPg("SELECT * FROM questions WHERE id = ANY($1)", [cleanQIds]);
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
        for (const qid of cleanQIds) {
          const qRow = qMap.get(qid);
          if (qRow && qRow.skill && !seenSkills.has(qRow.skill)) {
            seenSkills.add(qRow.skill);
            skills.push(qRow.skill);
          }
        }
      }

      sets.push(`question_ids = $${pIdx++}`);
      params.push(JSON.stringify(cleanQIds));

      sets.push(`skills = $${pIdx++}`);
      params.push(skills);
    }

    sets.push(`updated_at = NOW()`);

    params.push(id);
    const updateRes = await queryPg(
      `UPDATE lessons SET ${sets.join(", ")} WHERE id = $${pIdx} RETURNING *;`,
      params
    );

    const updated = updateRes.rows[0];
    const lesson = {
      id: updated.id,
      title: updated.title,
      description: updated.description,
      skills: Array.isArray(updated.skills) ? updated.skills : [],
      question_ids: Array.isArray(updated.question_ids)
        ? updated.question_ids
        : (typeof updated.question_ids === "string" ? JSON.parse(updated.question_ids) : []),
      subject_id: updated.subject_id || "english",
      created_by: updated.created_by,
      created_at: updated.created_at,
      updated_at: updated.updated_at,
    };

    return NextResponse.json({ success: true, lesson }, { status: 200 });
  } catch (err: any) {
    console.error("API /api/teacher/lessons/[id] PUT Error:", err);
    return NextResponse.json({ success: false, error: err.message || "Lỗi cập nhật bài học." }, { status: 500 });
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
    console.error("API /api/teacher/lessons/[id] DELETE Error:", err);
    return NextResponse.json({ success: false, error: err.message || "Lỗi xóa bài học." }, { status: 500 });
  }
}
