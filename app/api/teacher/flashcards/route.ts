import crypto from "crypto";
import { NextResponse } from "next/server";
import { requireRole } from "@/lib/api-auth";
import { queryPg } from "@/lib/db-pg";

export async function GET(req: Request) {
  const auth = await requireRole(["ADMIN", "TEACHER"]);
  if (auth.error) return auth.error;
  const { user } = auth;

  try {
    const { searchParams } = new URL(req.url);
    const q = (searchParams.get("q") || "").trim();

    let sql = "SELECT * FROM flashcards";
    const params: unknown[] = [];

    if (q) {
      sql += " WHERE vietnamese_name ILIKE $1 OR correct_english_word ILIKE $1";
      params.push(`%${q}%`);
    }

    sql += " ORDER BY created_at DESC";

    const result = await queryPg(sql, params);
    const flashcards = result.rows.map((row) => {
      let options: string[] = [];
      if (Array.isArray(row.options)) {
        options = row.options;
      } else if (typeof row.options === "string") {
        try {
          options = JSON.parse(row.options);
        } catch {
          options = [];
        }
      }

      const can_edit =
        user.role === "ADMIN" ||
        row.created_by === null ||
        row.created_by === undefined ||
        row.created_by === "" ||
        row.created_by === user.userId;

      return {
        ...row,
        options,
        can_edit,
      };
    });

    return NextResponse.json({ flashcards }, { status: 200 });
  } catch (err: any) {
    console.error("GET /api/teacher/flashcards error:", err);
    return NextResponse.json(
      { success: false, error: err.message || "Lỗi nạp danh sách flashcards" },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  const auth = await requireRole(["ADMIN", "TEACHER"]);
  if (auth.error) return auth.error;
  const { user } = auth;

  try {
    let body: any;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        { success: false, error: "Dữ liệu JSON không hợp lệ" },
        { status: 400 }
      );
    }

    const vnName = typeof body?.vietnamese_name === "string" ? body.vietnamese_name.trim() : "";
    const engWord = typeof body?.correct_english_word === "string" ? body.correct_english_word.trim() : "";

    if (!vnName || !engWord) {
      return NextResponse.json(
        { success: false, error: "Nghĩa tiếng Việt và từ tiếng Anh là bắt buộc" },
        { status: 400 }
      );
    }

    const rawOptions = Array.isArray(body?.options) ? body.options : [];
    const trimmedOptions = rawOptions
      .map((s: unknown) => (typeof s === "string" ? s.trim() : ""))
      .filter((s: string) => s.length > 0);

    if (!trimmedOptions.includes(engWord)) {
      trimmedOptions.push(engWord);
    }

    const options = Array.from(new Set(trimmedOptions));
    const imageUrl =
      typeof body?.image_url === "string" && body.image_url.trim() ? body.image_url.trim() : null;
    const audioUrl =
      typeof body?.audio_url === "string" && body.audio_url.trim() ? body.audio_url.trim() : null;

    const id = "fc_" + crypto.randomUUID();
    const createdBy = user.userId;

    const insertSql = `
      INSERT INTO flashcards (id, vietnamese_name, correct_english_word, options, image_url, audio_url, created_by)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `;

    const result = await queryPg(insertSql, [
      id,
      vnName,
      engWord,
      JSON.stringify(options),
      imageUrl,
      audioUrl,
      createdBy,
    ]);

    const row = result.rows[0];
    const flashcard = {
      ...row,
      options,
      can_edit: true,
    };

    return NextResponse.json({ success: true, flashcard }, { status: 201 });
  } catch (err: any) {
    console.error("POST /api/teacher/flashcards error:", err);
    return NextResponse.json(
      { success: false, error: err.message || "Lỗi tạo flashcard mới" },
      { status: 500 }
    );
  }
}
