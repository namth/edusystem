import { NextResponse } from "next/server";
import { requireRole } from "@/lib/api-auth";
import { queryPg } from "@/lib/db-pg";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function PUT(req: Request, context: RouteContext) {
  const auth = await requireRole(["ADMIN", "TEACHER"]);
  if (auth.error) return auth.error;
  const { user } = auth;

  try {
    const { id } = await context.params;

    const findResult = await queryPg("SELECT * FROM flashcards WHERE id = $1", [id]);
    if (findResult.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: "Flashcard không tồn tại" },
        { status: 404 }
      );
    }

    const existing = findResult.rows[0];
    const canEdit =
      user.role === "ADMIN" ||
      existing.created_by === null ||
      existing.created_by === undefined ||
      existing.created_by === "" ||
      existing.created_by === user.userId;

    if (!canEdit) {
      return NextResponse.json(
        { success: false, error: "Bạn không có quyền chỉnh sửa thẻ này." },
        { status: 403 }
      );
    }

    let body: any;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        { success: false, error: "Dữ liệu JSON không hợp lệ" },
        { status: 400 }
      );
    }

    let newVn = existing.vietnamese_name;
    if (body.vietnamese_name !== undefined) {
      if (typeof body.vietnamese_name !== "string" || !body.vietnamese_name.trim()) {
        return NextResponse.json(
          { success: false, error: "Nghĩa tiếng Việt không được để trống" },
          { status: 400 }
        );
      }
      newVn = body.vietnamese_name.trim();
    }

    let newEng = existing.correct_english_word;
    if (body.correct_english_word !== undefined) {
      if (typeof body.correct_english_word !== "string" || !body.correct_english_word.trim()) {
        return NextResponse.json(
          { success: false, error: "Từ tiếng Anh không được để trống" },
          { status: 400 }
        );
      }
      newEng = body.correct_english_word.trim();
    }

    let existingOptions: string[] = [];
    if (Array.isArray(existing.options)) {
      existingOptions = existing.options;
    } else if (typeof existing.options === "string") {
      try {
        existingOptions = JSON.parse(existing.options);
      } catch {
        existingOptions = [];
      }
    }

    let newOptions = existingOptions;
    if (body.options !== undefined) {
      const raw = Array.isArray(body.options) ? body.options : [];
      const trimmed = raw
        .map((s: unknown) => (typeof s === "string" ? s.trim() : ""))
        .filter((s: string) => s.length > 0);

      if (!trimmed.includes(newEng)) {
        trimmed.push(newEng);
      }
      newOptions = Array.from(new Set(trimmed));
    } else if (body.correct_english_word !== undefined) {
      if (!newOptions.includes(newEng)) {
        newOptions = Array.from(new Set([...newOptions, newEng]));
      }
    }

    let newImg = existing.image_url;
    if (body.image_url !== undefined) {
      newImg =
        typeof body.image_url === "string" && body.image_url.trim() ? body.image_url.trim() : null;
    }

    let newAud = existing.audio_url;
    if (body.audio_url !== undefined) {
      newAud =
        typeof body.audio_url === "string" && body.audio_url.trim() ? body.audio_url.trim() : null;
    }

    const updateSql = `
      UPDATE flashcards
      SET vietnamese_name = $1, correct_english_word = $2, options = $3, image_url = $4, audio_url = $5
      WHERE id = $6
      RETURNING *
    `;

    const updateResult = await queryPg(updateSql, [
      newVn,
      newEng,
      JSON.stringify(newOptions),
      newImg,
      newAud,
      id,
    ]);

    const updatedRow = updateResult.rows[0];
    const flashcard = {
      ...updatedRow,
      options: newOptions,
      can_edit: true,
    };

    return NextResponse.json({ success: true, flashcard }, { status: 200 });
  } catch (err: any) {
    console.error("PUT /api/teacher/flashcards/[id] error:", err);
    return NextResponse.json(
      { success: false, error: err.message || "Lỗi cập nhật flashcard" },
      { status: 500 }
    );
  }
}

export async function DELETE(req: Request, context: RouteContext) {
  const auth = await requireRole(["ADMIN", "TEACHER"]);
  if (auth.error) return auth.error;
  const { user } = auth;

  try {
    const { id } = await context.params;

    const findResult = await queryPg("SELECT * FROM flashcards WHERE id = $1", [id]);
    if (findResult.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: "Flashcard không tồn tại" },
        { status: 404 }
      );
    }

    const existing = findResult.rows[0];
    const canDelete =
      user.role === "ADMIN" ||
      existing.created_by === null ||
      existing.created_by === undefined ||
      existing.created_by === "" ||
      existing.created_by === user.userId;

    if (!canDelete) {
      return NextResponse.json(
        { success: false, error: "Bạn không có quyền xóa thẻ này." },
        { status: 403 }
      );
    }

    // Kiểm tra xem thẻ có đang được câu hỏi nào tham chiếu không
    const refResult = await queryPg(
      "SELECT id FROM questions WHERE (content->'flashcard_ids' ? $1) OR (content->'flashcardIds' ? $1)",
      [id]
    );

    if (refResult.rows.length > 0) {
      const question_ids = refResult.rows.map((r) => r.id);
      return NextResponse.json(
        {
          success: false,
          error: `Thẻ đang được dùng trong ${question_ids.length} câu hỏi`,
          question_ids,
        },
        { status: 409 }
      );
    }

    await queryPg("DELETE FROM flashcards WHERE id = $1", [id]);

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (err: any) {
    console.error("DELETE /api/teacher/flashcards/[id] error:", err);
    return NextResponse.json(
      { success: false, error: err.message || "Lỗi xóa flashcard" },
      { status: 500 }
    );
  }
}
