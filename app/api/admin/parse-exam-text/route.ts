import { NextResponse } from "next/server";
import { requireRole } from "@/lib/api-auth";
import { parseExamRawTextWithAI } from "@/lib/ai-engine";
import { withAiUsageContext } from "@/lib/ai-usage";
import { serverError } from "@/lib/api-errors";

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
    const data = await withAiUsageContext(
      { purpose: "EXAM_IMPORT", teacherId: auth.user.userId },
      () => parseExamRawTextWithAI(rawContent)
    );
    return NextResponse.json({ success: true, data });
  } catch (err: any) {
    return serverError(err, { route: "/api/admin/parse-exam-text", method: "POST", message: err.message || "Lỗi bóc tách đề thi." });
  }
}
