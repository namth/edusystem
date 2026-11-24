// Worker gửi sự kiện về kênh cảnh báo admin (FEAT-016, BR-W10). Chỉ nhận header x-internal-token (bất biến 5).
import { NextResponse } from "next/server";
import { hasValidInternalToken } from "@/lib/api-auth";
import { reportAlert, ALERT_LEVELS, type AlertLevel } from "@/lib/admin-alerts";
import { serverError } from "@/lib/api-errors";

export async function POST(req: Request) {
  if (!hasValidInternalToken(req)) {
    return NextResponse.json({ success: false, error: "Bạn cần đăng nhập." }, { status: 401 });
  }
  try {
    const body = await req.json().catch(() => null);
    const title = typeof body?.title === "string" ? body.title.trim() : "";
    const level = (typeof body?.level === "string" ? body.level.toUpperCase() : "ERROR") as AlertLevel;
    if (!title || !ALERT_LEVELS.includes(level)) {
      return NextResponse.json({ success: false, error: "Thiếu tiêu đề hoặc mức cảnh báo không hợp lệ." }, { status: 400 });
    }
    const rawFp = typeof body?.fingerprint === "string" && body.fingerprint.trim() ? body.fingerprint.trim() : title;
    const fingerprint = rawFp.startsWith("WORKER:") ? rawFp : `WORKER:${rawFp}`;
    const d = body?.detail && typeof body.detail === "object" ? body.detail : {};
    await reportAlert({
      level,
      source: "WORKER", // nguồn luôn do server đặt
      title,
      fingerprint,
      detail: {
        message: typeof d.message === "string" ? d.message : undefined,
        stack: typeof d.stack === "string" ? d.stack : undefined,
        extra: d.extra && typeof d.extra === "object" ? d.extra : undefined,
      },
    });
    return NextResponse.json({ success: true });
  } catch (err) {
    return serverError(err, { route: "/api/internal/alerts", method: "POST" });
  }
}
