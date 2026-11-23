import { NextResponse } from "next/server";
import { requireRole } from "@/lib/api-auth";
import { parseDocumentFile, AiUnavailableError } from "@/lib/document-parser";
import { withAiUsageContext } from "@/lib/ai-usage";
import { serverError } from "@/lib/api-errors";
import { reportAlert } from "@/lib/admin-alerts";
import { convertParsedGroups } from "@/lib/exam-import";

export const maxDuration = 120; // bóc tách + AI lượt 2 (FEAT-015)

const MAX_SIZE_BYTES = 15 * 1024 * 1024; // BR-INGEST-01
const MAX_GROUPS = 50; // BR-INGEST-03
const ALLOWED = ["docx", "pdf", "png", "jpg", "jpeg", "webp"];

export async function POST(req: Request) {
  const auth = await requireRole(["ADMIN", "TEACHER"]);
  if (auth.error) return auth.error;

  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const targetSkill = (formData.get("targetSkill") as string) || "Auto";

    if (!file) {
      return NextResponse.json({ success: false, error: "Vui lòng đính kèm tệp tài liệu để bóc tách." }, { status: 400 });
    }
    if (file.size > MAX_SIZE_BYTES) {
      return NextResponse.json({ success: false, error: "Tệp vượt quá giới hạn 15MB cho phép." }, { status: 400 });
    }
    const ext = file.name.split(".").pop()?.toLowerCase() || "";
    if (!ALLOWED.includes(ext)) {
      return NextResponse.json(
        { success: false, error: "Định dạng tệp không được hỗ trợ. Vui lòng tải file .docx, .pdf hoặc ảnh chụp (.png, .jpg)." },
        { status: 400 }
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const fileMime = ext === "pdf" ? "application/pdf" : ext === "docx" ? "" : file.type || `image/${ext === "jpg" ? "jpeg" : ext}`;

    const result = await withAiUsageContext({ purpose: "EXAM_IMPORT", teacherId: auth.user.userId }, async () => {
      const parsed = await parseDocumentFile(buffer, file.name, file.type, targetSkill);
      const groups = (parsed.structuredData.groups || []).slice(0, MAX_GROUPS);
      const converted = await convertParsedGroups(groups, {
        teacherId: auth.user.userId,
        fileExt: ext,
        // AI lượt 2 cần file gốc để đọc gạch chân (PDF/ảnh); DOCX đã giữ <u> từ mammoth
        file: fileMime ? { mimeType: fileMime, base64: buffer.toString("base64") } : undefined,
      });
      return { parsed, ...converted };
    });

    const questionsCount = result.groups.reduce((acc, g) => acc + Math.max(1, g.sub_questions.length), 0);
    return NextResponse.json({
      success: true,
      fileName: file.name,
      fileType: ext,
      engineUsed: result.parsed.engineUsed,
      groupsCount: result.groups.length,
      questionsCount,
      extractedData: {
        examTitle: result.parsed.structuredData.examTitle,
        suggestedDurationMinutes: result.parsed.structuredData.suggestedDurationMinutes,
        groups: result.groups,
      },
      conversion: result.conversion,
    });
  } catch (error) {
    if (error instanceof AiUnavailableError) {
      // BR-W11: hết mọi nhà cung cấp AI → báo admin một lần theo loại, trả 503 cho giáo viên
      void reportAlert({
        level: "ERROR",
        source: "AI",
        title: "AI nhập đề: mọi nhà cung cấp đều lỗi",
        fingerprint: "AI:EXAM_IMPORT:ALL_PROVIDERS_FAILED",
        detail: { userId: auth.user.userId, role: auth.user.role, route: "/api/teacher/exams/ai-parse", method: "POST" },
      });
      return NextResponse.json({ success: false, error: error.message }, { status: 503 });
    }
    return serverError(error, {
      route: "/api/teacher/exams/ai-parse",
      method: "POST",
      userId: auth.user.userId,
      role: auth.user.role,
      message: (error as Error)?.message || "Đã xảy ra lỗi trong quá trình bóc tách tài liệu.",
    });
  }
}
