// FEAT-016 §6.2 — đánh dấu đã xử lý / mở lại một cảnh báo (chỉ ADMIN).
import { NextResponse } from "next/server";
import { requireRole } from "@/lib/api-auth";
import { queryPg } from "@/lib/db-pg";
import { serverError } from "@/lib/api-errors";

const RETURNING =
  "RETURNING id, fingerprint, level, source, title, detail, occurrences, status, first_seen_at, last_seen_at, last_notified_at, resolved_at, resolved_by";

export async function PATCH(req: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireRole(["ADMIN"]);
  if (auth.error) return auth.error;
  const { id } = await context.params;

  const body = (await req.json().catch(() => null)) as { status?: string } | null;
  const status = body?.status;
  if (status !== "RESOLVED" && status !== "NEW") {
    return NextResponse.json(
      { success: false, error: "Trạng thái không hợp lệ. Chỉ chấp nhận RESOLVED, NEW." },
      { status: 400 }
    );
  }

  try {
    const res =
      status === "RESOLVED"
        ? await queryPg(
            `UPDATE admin_alerts SET status = 'RESOLVED', resolved_at = NOW(), resolved_by = $2 WHERE id = $1 ${RETURNING}`,
            [id, auth.user.userId]
          )
        : await queryPg(
            `UPDATE admin_alerts SET status = 'NEW', resolved_at = NULL, resolved_by = NULL WHERE id = $1 ${RETURNING}`,
            [id]
          );
    if (!res.rows[0]) {
      return NextResponse.json({ success: false, error: "Không tìm thấy cảnh báo." }, { status: 404 });
    }
    return NextResponse.json({ success: true, alert: res.rows[0] });
  } catch (err) {
    return serverError(err, {
      route: "/api/admin/alerts/[id]",
      method: "PATCH",
      userId: auth.user.userId,
      role: auth.user.role,
      message: "Lỗi cập nhật cảnh báo.",
    });
  }
}
