import { NextResponse } from "next/server";
import crypto from "crypto";
import { queryPg } from "@/lib/db-pg";
import { requireRole } from "@/lib/api-auth";
import { canUseSubject } from "@/lib/subjects";
import { assertTrialAllows, trialLimitResponse } from "@/lib/teacher-trial";
import { serverError } from "@/lib/api-errors";

export async function GET(req: Request) {
  const auth = await requireRole(["ADMIN", "TEACHER"]);
  if (auth.error) return auth.error;
  const authUser = auth.user;

  try {
    const { searchParams } = new URL(req.url);
    const q = searchParams.get("q");
    const skill = searchParams.get("skill");
    const subjectId = searchParams.get("subject_id");

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

    if (subjectId && subjectId.trim()) {
      conditions.push(`l.subject_id = $${params.length + 1}`);
      params.push(subjectId.trim());
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    const sql = `
      SELECT
        l.*,
        (SELECT COUNT(*)::int FROM sections s WHERE s.lesson_id = l.id AND s.deleted_at IS NULL) AS block_count,
        (SELECT COUNT(*)::int FROM curriculum_items ci WHERE ci.lesson_id = l.id) AS usage_count
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
      block_count: Number(r.block_count || 0),
      usage_count: Number(r.usage_count || 0),
      subject_id: r.subject_id || "english",
      created_by: r.created_by,
      created_at: r.created_at,
      updated_at: r.updated_at,
    }));

    return NextResponse.json({ success: true, lessons });
  } catch (err: any) {
    return serverError(err, { route: "/api/teacher/lessons", method: "GET", message: err.message || "Lỗi nạp danh sách bài học." });
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

    let cleanSubjectId = "english";
    let hasExplicitSubjectId = false;
    if (body.subject_id !== undefined && body.subject_id !== null) {
      if (typeof body.subject_id !== "string" || !body.subject_id.trim()) {
        return NextResponse.json({ success: false, error: "Môn học không hợp lệ" }, { status: 400 });
      }
      cleanSubjectId = body.subject_id.trim();
      hasExplicitSubjectId = true;
      if (!(await canUseSubject(authUser, cleanSubjectId))) {
        return NextResponse.json({ success: false, error: "Môn học không hợp lệ" }, { status: 400 });
      }
    }

    const description = body.description !== undefined && body.description !== null ? String(body.description) : null;

    const trial = await assertTrialAllows(authUser.userId, "contents");
    if (!trial.ok) {
      return trialLimitResponse("contents", trial.error);
    }

    const id = "lsn_" + crypto.randomUUID();

    let insertSql = `INSERT INTO lessons (id, title, description, skills, created_by, created_at, updated_at)
       VALUES ($1, $2, $3, '{}', $4, NOW(), NOW())
       RETURNING *;`;
    let insertParams: any[] = [id, title, description, authUser.userId];

    if (hasExplicitSubjectId) {
      insertSql = `INSERT INTO lessons (id, title, description, skills, subject_id, created_by, created_at, updated_at)
       VALUES ($1, $2, $3, '{}', $4, $5, NOW(), NOW())
       RETURNING *;`;
      insertParams = [id, title, description, cleanSubjectId, authUser.userId];
    }

    const res = await queryPg(insertSql, insertParams);

    const inserted = res.rows[0];
    const lesson = {
      id: inserted.id,
      title: inserted.title,
      description: inserted.description,
      skills: Array.isArray(inserted.skills) ? inserted.skills : [],
      subject_id: inserted.subject_id || cleanSubjectId,
      created_by: inserted.created_by,
      created_at: inserted.created_at,
      updated_at: inserted.updated_at,
    };

    return NextResponse.json({ success: true, lesson }, { status: 201 });
  } catch (err: any) {
    return serverError(err, { route: "/api/teacher/lessons", method: "POST", message: err.message || "Lỗi tạo bài học." });
  }
}
