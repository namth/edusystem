import { NextResponse } from "next/server";
import { requireRole } from "@/lib/api-auth";
import { markNotificationsRead } from "@/lib/notifications";

export async function POST(req: Request) {
  const auth = await requireRole();
  if (auth.error) return auth.error;

  const body = await req.json().catch(() => ({}));

  if (body && typeof body === "object" && !Array.isArray(body) && body.ids !== undefined) {
    if (!Array.isArray(body.ids) || body.ids.some((id: unknown) => typeof id !== "string")) {
      return NextResponse.json(
        { success: false, error: "ids phải là một mảng chuỗi." },
        { status: 400 }
      );
    }
  } else if (body && typeof body === "object" && !Array.isArray(body)) {
    // Không có ids -> đánh dấu tất cả
  } else {
    // Body không phải object hợp lệ
    return NextResponse.json(
      { success: false, error: "Dữ liệu yêu cầu không hợp lệ." },
      { status: 400 }
    );
  }

  const updated = await markNotificationsRead(auth.user.userId, body.ids);
  return NextResponse.json({ success: true, updated });
}
