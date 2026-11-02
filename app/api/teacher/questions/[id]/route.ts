import { NextResponse } from "next/server";
import { queryPg } from "@/lib/db-pg";
import { requireRole } from "@/lib/api-auth";
import { buildStandardQuestionContent } from "@/lib/question-content-types";
import { VALID_QUESTION_CATEGORIES } from "../route";

async function canEditQuestion(question: any, authUser: { userId: string; role: string }): Promise<boolean> {
  if (authUser.role === "ADMIN") return true;
  if (question.created_by === authUser.userId) return true;
  if (question.created_by === null || question.created_by === undefined) {
    const checkRes = await queryPg(
      `SELECT 1 FROM exams WHERE created_by = $1 AND question_ids ? $2
       UNION ALL
       SELECT 1 FROM lessons WHERE created_by = $1 AND question_ids ? $2
       LIMIT 1;`,
      [authUser.userId, question.id]
    );
    return checkRes.rows.length > 0;
  }
  return false;
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
    const qRes = await queryPg("SELECT * FROM questions WHERE id = $1", [id]);
    if (qRes.rows.length === 0) {
      return NextResponse.json({ success: false, error: "Câu hỏi không tồn tại." }, { status: 404 });
    }

    const question = qRes.rows[0];
    const allowed = await canEditQuestion(question, authUser);
    if (!allowed) {
      return NextResponse.json({ success: false, error: "Bạn không có quyền sửa câu hỏi này." }, { status: 403 });
    }

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return NextResponse.json({ success: false, error: "Dữ liệu không hợp lệ." }, { status: 400 });
    }

    const { skill, category, prompt, stimulus_text, stimulus_audio_url, content } = body;

    const sets: string[] = [];
    const params: any[] = [];
    let pIdx = 1;

    if (skill !== undefined) {
      if (!skill || typeof skill !== "string" || !skill.trim()) {
        return NextResponse.json({ success: false, error: "Kỹ năng (skill) không được để trống." }, { status: 400 });
      }
      sets.push(`skill = $${pIdx++}`);
      params.push(skill.trim());
    }

    if (category !== undefined) {
      if (!category || typeof category !== "string" || !VALID_QUESTION_CATEGORIES.has(category)) {
        return NextResponse.json({ success: false, error: "Loại câu hỏi (category) không hợp lệ." }, { status: 400 });
      }
      sets.push(`category = $${pIdx++}`);
      params.push(category);
    }

    if (prompt !== undefined) {
      sets.push(`prompt = $${pIdx++}`);
      params.push(prompt !== null ? String(prompt) : null);
    }

    if (stimulus_text !== undefined) {
      sets.push(`stimulus_text = $${pIdx++}`);
      params.push(stimulus_text !== null ? String(stimulus_text) : null);
    }

    if (stimulus_audio_url !== undefined) {
      sets.push(`stimulus_audio_url = $${pIdx++}`);
      params.push(stimulus_audio_url !== null ? String(stimulus_audio_url) : null);
    }

    if (content !== undefined) {
      if (!content || typeof content !== "object" || Array.isArray(content)) {
        return NextResponse.json({ success: false, error: "Nội dung câu hỏi (content) phải là một object." }, { status: 400 });
      }

      let contentToSave = content;
      try {
        const existingContent = typeof question.content === "string" ? JSON.parse(question.content) : (question.content || {});
        const merged = {
          ...existingContent,
          ...content,
          category: category || question.category,
          ...body,
        };
        const standard = buildStandardQuestionContent(merged);
        if (standard && typeof standard === "object" && !Array.isArray(standard)) {
          contentToSave = standard;
        }
      } catch {
        contentToSave = content;
      }

      sets.push(`content = $${pIdx++}`);
      params.push(JSON.stringify(contentToSave));
    }

    if (sets.length === 0) {
      const q = {
        ...question,
        content: typeof question.content === "string" ? JSON.parse(question.content) : question.content,
      };
      return NextResponse.json({ success: true, question: q }, { status: 200 });
    }

    params.push(id);
    const updateRes = await queryPg(
      `UPDATE questions SET ${sets.join(", ")} WHERE id = $${pIdx} RETURNING *;`,
      params
    );

    const updated = {
      ...updateRes.rows[0],
      content: typeof updateRes.rows[0].content === "string" ? JSON.parse(updateRes.rows[0].content) : updateRes.rows[0].content,
    };

    return NextResponse.json({ success: true, question: updated }, { status: 200 });
  } catch (err: any) {
    console.error("API /api/teacher/questions/[id] PUT Error:", err);
    return NextResponse.json({ success: false, error: err.message || "Lỗi cập nhật câu hỏi." }, { status: 500 });
  }
}
