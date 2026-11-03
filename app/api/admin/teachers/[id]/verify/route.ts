import { NextResponse } from "next/server";
import { requireRole } from "@/lib/api-auth";
import { queryPg } from "@/lib/db-pg";
import { createNotification } from "@/lib/notifications";

export async function POST(
  req: Request,
  context: { params: Promise<{ id: string }> | { id: string } }
) {
  const auth = await requireRole(["ADMIN"]);
  if (auth.error) return auth.error;
  const adminUser = auth.user;

  try {
    const { id } = await context.params;
    const teacherId = typeof id === "string" ? id.trim() : "";
    if (!teacherId) {
      return NextResponse.json(
        { success: false, error: "Thiếu mã giáo viên." },
        { status: 400 }
      );
    }

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return NextResponse.json(
        { success: false, error: "Dữ liệu không hợp lệ." },
        { status: 400 }
      );
    }

    const { decision, note } = body;
    if (decision !== "VERIFIED" && decision !== "REJECTED") {
      return NextResponse.json(
        { success: false, error: "Quyết định xác minh không hợp lệ." },
        { status: 400 }
      );
    }

    let cleanNote: string | null = null;
    if (note !== undefined && note !== null) {
      if (typeof note !== "string" || note.length > 500) {
        return NextResponse.json(
          { success: false, error: "Ghi chú không được vượt quá 500 ký tự." },
          { status: 400 }
        );
      }
      cleanNote = note.trim() || null;
    }

    const userRes = await queryPg(
      `SELECT id, role, teacher_status, slot_limit FROM users WHERE id = $1 LIMIT 1`,
      [teacherId]
    );
    if (userRes.rows.length === 0 || userRes.rows[0].role !== "TEACHER") {
      return NextResponse.json(
        { success: false, error: "Không tìm thấy tài khoản giáo viên." },
        { status: 404 }
      );
    }

    if (decision === "VERIFIED") {
      await queryPg(
        `UPDATE users
         SET teacher_status = 'VERIFIED',
             slot_limit = GREATEST(COALESCE(slot_limit, 0), 250)
         WHERE id = $1`,
        [teacherId]
      );
    } else {
      await queryPg(
        `UPDATE users
         SET teacher_status = 'REJECTED'
         WHERE id = $1`,
        [teacherId]
      );
    }

    await queryPg(
      `INSERT INTO teacher_profiles (user_id, answers, reviewed_by, reviewed_at, review_note)
       VALUES ($1, '{}'::jsonb, $2, NOW(), $3)
       ON CONFLICT (user_id)
       DO UPDATE SET
         reviewed_by = EXCLUDED.reviewed_by,
         reviewed_at = NOW(),
         review_note = EXCLUDED.review_note`,
      [teacherId, adminUser.userId, cleanNote]
    );

    try {
      await createNotification({
        userId: teacherId,
        type: "TEACHER_VERIFIED",
        title:
          decision === "VERIFIED"
            ? "Tài khoản giáo viên đã được xác minh"
            : "Kết quả xác minh tài khoản giáo viên",
        body:
          cleanNote ||
          (decision === "VERIFIED"
            ? "Tài khoản của thầy cô đã được mở đủ tính năng trên KitoKit."
            : "Tài khoản của thầy cô chưa được xác minh."),
        link: "/teacher/classes",
        refId: teacherId,
      });
    } catch (notifyErr) {
      console.error("createNotification TEACHER_VERIFIED error:", notifyErr);
    }

    return NextResponse.json({
      success: true,
      teacher: {
        id: teacherId,
        teacher_status: decision,
      },
    });
  } catch (err: any) {
    console.error("POST /api/admin/teachers/[id]/verify error:", err);
    return NextResponse.json(
      { success: false, error: err.message || "Lỗi xác minh giáo viên." },
      { status: 500 }
    );
  }
}
