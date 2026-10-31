import { NextResponse } from "next/server";
import { requireRole } from "@/lib/api-auth";
import { parseExamRawTextWithAI } from "@/lib/ai-engine";

// Bóc tách đề từ văn bản thô bằng AI — chạy ở server để không lộ khoá AI ra trình duyệt
export async function POST(req: Request) {
  const auth = await requireRole(["ADMIN"]);
  if (auth.error) return auth.error;

  try {
    const body = await req.json().catch(() => ({}));
    const rawContent = typeof body.rawContent === "string" ? body.rawContent.trim() : "";
    if (!rawContent) {
      return NextResponse.json({ success: false, error: "Vui lòng dán nội dung đề thi." }, { status: 400 });
    }
    const data = await parseExamRawTextWithAI(rawContent);
    return NextResponse.json({ success: true, data });
  } catch (err: any) {
    console.error("POST /api/admin/parse-exam-text error:", err);
    return NextResponse.json({ success: false, error: err.message || "Lỗi bóc tách đề thi." }, { status: 500 });
  }
}
