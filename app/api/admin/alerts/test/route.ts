// FEAT-016 §6.2 — gửi tin Telegram thử (chỉ ADMIN). Không tạo dòng cảnh báo, không tính trần BR-W04.
import { NextResponse } from "next/server";
import { requireRole } from "@/lib/api-auth";
import { sendTelegram, telegramConfigured } from "@/lib/telegram";

export async function POST() {
  const auth = await requireRole(["ADMIN"]);
  if (auth.error) return auth.error;
  if (!telegramConfigured()) {
    return NextResponse.json({ success: false, error: "Chưa cấu hình Telegram." }, { status: 400 });
  }
  const r = await sendTelegram(
    "✅ <b>KitoKit</b>: tin thử của kênh cảnh báo admin. Thấy tin này nghĩa là Telegram đã cấu hình đúng."
  );
  if (!r.ok) {
    return NextResponse.json({ success: false, error: `Telegram từ chối: ${r.error}` }, { status: 502 });
  }
  return NextResponse.json({ success: true });
}
