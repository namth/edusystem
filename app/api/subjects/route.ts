import crypto from "crypto";
import { NextResponse } from "next/server";
import { queryPg } from "@/lib/db-pg";
import { requireRole } from "@/lib/api-auth";
import { slugifySubjectCode } from "@/lib/subjects";

export async function GET(req: Request) {
  const auth = await requireRole();
  if (auth.error) return auth.error;
  const user = auth.user;

  try {
    let activeOnly = false;
    if (req?.url) {
      try {
        activeOnly = new URL(req.url).searchParams.get("active") === "1";
      } catch {
        activeOnly = false;
      }
    }

    const conditions: string[] = [];
    const params: unknown[] = [];

    if (user.role === "STUDENT") {
      conditions.push("s.owner_id IS NULL");
      conditions.push("s.is_active = TRUE");
    } else if (user.role === "TEACHER") {
      conditions.push(`(s.owner_id IS NULL OR s.owner_id = $${params.length + 1})`);
      params.push(user.userId);
    }

    if (activeOnly && user.role !== "STUDENT") {
      conditions.push("s.is_active = TRUE");
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    const sql = `
      SELECT
        s.id,
        s.code,
        s.name,
        s.icon,
        s.color,
        s.mode,
        s.owner_id,
        s.is_active,
        s.order_index,
        s.created_at,
        (
          (SELECT COUNT(*)::int FROM courses c WHERE c.subject_id = s.id) +
          (SELECT COUNT(*)::int FROM exams e WHERE e.subject_id = s.id) +
          (SELECT COUNT(*)::int FROM lessons l WHERE l.subject_id = s.id)
        ) AS usage_count
      FROM subjects s
      ${whereClause}
      ORDER BY s.order_index ASC, s.name ASC;
    `;

    const res = await queryPg(sql, params);
    const subjects = res.rows.map((r: any) => ({
      id: r.id,
      code: r.code,
      name: r.name,
      icon: r.icon ?? null,
      color: r.color ?? null,
      mode: r.mode,
      owner_id: r.owner_id ?? null,
      is_active: Boolean(r.is_active),
      order_index: Number(r.order_index || 0),
      usage_count: Number(r.usage_count || 0),
    }));

    return NextResponse.json({ success: true, subjects });
  } catch (err: any) {
    console.error("API /api/subjects GET Error:", err);
    return NextResponse.json(
      { success: false, error: err.message || "Lỗi tải danh sách môn học." },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  const auth = await requireRole(["ADMIN", "TEACHER"]);
  if (auth.error) return auth.error;
  const user = auth.user;

  try {
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return NextResponse.json(
        { success: false, error: "Dữ liệu không hợp lệ." },
        { status: 400 }
      );
    }

    const name = typeof body.name === "string" ? body.name.trim() : "";
    if (!name || name.length > 100) {
      return NextResponse.json(
        { success: false, error: "Tên môn học phải từ 1 đến 100 ký tự." },
        { status: 400 }
      );
    }

    const rawCode =
      typeof body.code === "string" && body.code.trim() ? body.code : name;
    const code = slugifySubjectCode(rawCode);
    if (!code) {
      return NextResponse.json(
        { success: false, error: "Mã môn học không hợp lệ." },
        { status: 400 }
      );
    }

    let mode: "LANGUAGE" | "SIMPLE" = "SIMPLE";
    if (user.role === "ADMIN") {
      if (body.mode !== undefined && body.mode !== null) {
        if (body.mode !== "LANGUAGE" && body.mode !== "SIMPLE") {
          return NextResponse.json(
            { success: false, error: "Chế độ môn học không hợp lệ." },
            { status: 400 }
          );
        }
        mode = body.mode;
      }
    }

    const ownerId: string | null = user.role === "ADMIN" ? null : user.userId;
    const icon =
      typeof body.icon === "string" && body.icon.trim()
        ? body.icon.trim().slice(0, 40)
        : null;
    const color =
      typeof body.color === "string" && body.color.trim()
        ? body.color.trim().slice(0, 20)
        : null;
    const orderIndex =
      typeof body.order_index === "number" && Number.isInteger(body.order_index)
        ? body.order_index
        : 0;

    const dupRes = await queryPg(
      `SELECT id FROM subjects WHERE COALESCE(owner_id, '') = COALESCE($1, '') AND LOWER(code) = LOWER($2) LIMIT 1`,
      [ownerId, code]
    );
    if (dupRes.rows.length > 0) {
      return NextResponse.json(
        { success: false, error: "Mã môn học đã tồn tại trong cùng phạm vi." },
        { status: 409 }
      );
    }

    const id = `subj_${crypto.randomBytes(8).toString("hex")}`;

    const insertRes = await queryPg(
      `INSERT INTO subjects (id, code, name, icon, color, mode, owner_id, is_active, order_index, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, TRUE, $8, NOW())
       RETURNING *;`,
      [id, code, name, icon, color, mode, ownerId, orderIndex]
    );

    const row = insertRes.rows[0];
    const subject = {
      id: row.id,
      code: row.code,
      name: row.name,
      icon: row.icon ?? null,
      color: row.color ?? null,
      mode: row.mode,
      owner_id: row.owner_id ?? null,
      is_active: Boolean(row.is_active),
      order_index: Number(row.order_index || 0),
      usage_count: 0,
    };

    return NextResponse.json({ success: true, subject }, { status: 201 });
  } catch (err: any) {
    if (err?.code === "23505" || String(err?.message || "").includes("uq_subjects_owner_code")) {
      return NextResponse.json(
        { success: false, error: "Mã môn học đã tồn tại trong cùng phạm vi." },
        { status: 409 }
      );
    }
    console.error("API /api/subjects POST Error:", err);
    return NextResponse.json(
      { success: false, error: err.message || "Lỗi tạo môn học." },
      { status: 500 }
    );
  }
}
