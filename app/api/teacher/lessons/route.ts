import { NextResponse } from "next/server";
import crypto from "crypto";
import { queryPg } from "@/lib/db-pg";
import { requireRole } from "@/lib/api-auth";

export async function GET(req: Request) {
  const auth = await requireRole(["ADMIN", "TEACHER"]);
  if (auth.error) return auth.error;
  const authUser = auth.user;

  try {
    const { searchParams } = new URL(req.url);
    const q = searchParams.get("q");
    const skill = searchParams.get("skill");

    const conditions: string[] = [];
    const params: any[] = [];

    if (authUser.role === "TEACHER") {
      conditions.push(`l.created_by = $${params.length + 1}`);
      params.push(authUser.userId);
    }

    if (q && q.trim()) {
      conditions.push(`l.title ILIKE $${params.length + 1}`);
      params.push(`%${q.trim()}%`);
    }

    if (skill && skill.trim()) {
      conditions.push(`$${params.length + 1} = ANY(l.skills)`);
      params.push(skill.trim());
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    const sql = `
      SELECT
        l.id,
        l.title,
        l.description,
        l.skills,
        l.question_ids,
        COALESCE(jsonb_array_length(CASE WHEN jsonb_typeof(l.question_ids) = 'array' THEN l.question_ids ELSE '[]'::jsonb END), 0) AS block_count,
        (SELECT COUNT(*)::int FROM curriculum_items ci WHERE ci.lesson_id = l.id) AS usage_count,
        l.created_by,
        l.created_at,
        l.updated_at
      FROM lessons l
      ${whereClause}
      ORDER BY l.updated_at DESC;
    `;

    const res = await queryPg(sql, params);

    const lessons = res.rows.map((r: any) => ({
      id: r.id,
      title: r.title,
      description: r.description,
      skills: Array.isArray(r.skills) ? r.skills : [],
      question_ids: Array.isArray(r.question_ids)
        ? r.question_ids
        : (typeof r.question_ids === "string" ? JSON.parse(r.question_ids) : []),
      block_count: Number(r.block_count || 0),
      usage_count: Number(r.usage_count || 0),
      created_by: r.created_by,
      created_at: r.created_at,
      updated_at: r.updated_at,
    }));

    return NextResponse.json({ success: true, lessons });
  } catch (err: any) {
    console.error("API /api/teacher/lessons GET Error:", err);
    return NextResponse.json({ success: false, error: err.message || "Lỗi nạp danh sách bài học." }, { status: 500 });
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

    const title = typeof body.title === "string" ? body.title.trim() : "";
    if (!title || title.length > 255) {
      return NextResponse.json(
        { success: false, error: "Tiêu đề bài học phải từ 1 đến 255 ký tự." },
        { status: 400 }
      );
    }

    const description = body.description !== undefined && body.description !== null ? String(body.description) : null;
    const id = "lsn_" + crypto.randomUUID();

    const res = await queryPg(
      `INSERT INTO lessons (id, title, description, skills, question_ids, created_by, created_at, updated_at)
       VALUES ($1, $2, $3, '{}', '[]', $4, NOW(), NOW())
       RETURNING id, title, description, skills, question_ids, created_by, created_at, updated_at;`,
      [id, title, description, authUser.userId]
    );

    const inserted = res.rows[0];
    const lesson = {
      id: inserted.id,
      title: inserted.title,
      description: inserted.description,
      skills: Array.isArray(inserted.skills) ? inserted.skills : [],
      question_ids: Array.isArray(inserted.question_ids)
        ? inserted.question_ids
        : (typeof inserted.question_ids === "string" ? JSON.parse(inserted.question_ids) : []),
      created_by: inserted.created_by,
      created_at: inserted.created_at,
      updated_at: inserted.updated_at,
    };

    return NextResponse.json({ success: true, lesson }, { status: 201 });
  } catch (err: any) {
    console.error("API /api/teacher/lessons POST Error:", err);
    return NextResponse.json({ success: false, error: err.message || "Lỗi tạo bài học." }, { status: 500 });
  }
}
