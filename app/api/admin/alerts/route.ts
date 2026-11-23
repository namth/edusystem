// FEAT-016 §6.2 — danh sách cảnh báo hệ thống (chỉ ADMIN).
import { NextResponse } from "next/server";
import { requireRole } from "@/lib/api-auth";
import { queryPg } from "@/lib/db-pg";
import { ALERT_LEVELS, ALERT_SOURCES, type AlertLevel, type AlertSource } from "@/lib/admin-alerts";
import { telegramConfigured } from "@/lib/telegram";
import { serverError } from "@/lib/api-errors";

const PAGE_SIZE = 50;
const STATUSES = ["NEW", "RESOLVED", "ALL"];

export async function GET(req: Request) {
  const auth = await requireRole(["ADMIN"]);
  if (auth.error) return auth.error;

  const url = new URL(req.url);
  const status = (url.searchParams.get("status") || "NEW").toUpperCase();
  const level = (url.searchParams.get("level") || "").toUpperCase();
  const source = (url.searchParams.get("source") || "").toUpperCase();
  const page = Number(url.searchParams.get("page") || "1");
  if (
    !STATUSES.includes(status) ||
    (level && !ALERT_LEVELS.includes(level as AlertLevel)) ||
    (source && !ALERT_SOURCES.includes(source as AlertSource)) ||
    !Number.isInteger(page) ||
    page < 1
  ) {
    return NextResponse.json({ success: false, error: "Tham số lọc không hợp lệ." }, { status: 400 });
  }

  try {
    const where: string[] = [];
    const params: unknown[] = [];
    const add = (col: string, v: string) => {
      params.push(v);
      where.push(`${col} = $` + params.length);
    };
    if (status !== "ALL") add("status", status);
    if (level) add("level", level);
    if (source) add("source", source);
    const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

    const totalRes = await queryPg(`SELECT COUNT(*)::int AS n FROM admin_alerts ${whereSql}`, params);
    const itemsRes = await queryPg(
      `SELECT id, fingerprint, level, source, title, detail, occurrences, status, first_seen_at, last_seen_at,
              last_notified_at, resolved_at, resolved_by
       FROM admin_alerts ${whereSql}
       ORDER BY last_seen_at DESC, id
       LIMIT ${PAGE_SIZE} OFFSET ${(page - 1) * PAGE_SIZE}`,
      params
    );
    const newRes = await queryPg(`SELECT COUNT(*)::int AS n FROM admin_alerts WHERE status = 'NEW'`);
    return NextResponse.json({
      success: true,
      items: itemsRes.rows,
      total: Number(totalRes.rows[0]?.n) || 0,
      page,
      pageSize: PAGE_SIZE,
      counts: { NEW: Number(newRes.rows[0]?.n) || 0 },
      telegram: { configured: telegramConfigured() },
    });
  } catch (err) {
    return serverError(err, {
      route: "/api/admin/alerts",
      method: "GET",
      userId: auth.user.userId,
      role: auth.user.role,
      message: "Lỗi tải danh sách cảnh báo.",
    });
  }
}
