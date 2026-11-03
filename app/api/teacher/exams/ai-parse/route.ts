import { NextResponse } from "next/server";
import { requireRole } from "@/lib/api-auth";
import { parseDocumentFile } from "@/lib/document-parser";
import { withAiUsageContext } from "@/lib/ai-usage";

export const maxDuration = 60; // 60 seconds max execution for AI parsing

export async function POST(req: Request) {
  const auth = await requireRole(["ADMIN", "TEACHER"]);
  if (auth.error) return auth.error;

  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const targetSkill = (formData.get("targetSkill") as string) || "Auto";

    if (!file) {
      return NextResponse.json(
        { success: false, error: "Vui lòng đính kèm tệp tài liệu để bóc tách." },
        { status: 400 }
      );
    }

    // Business Rule BR-INGEST-01: Max size 15MB
    const MAX_SIZE_BYTES = 15 * 1024 * 1024;
    if (file.size > MAX_SIZE_BYTES) {
      return NextResponse.json(
        { success: false, error: "Tệp vượt quá giới hạn 15MB cho phép." },
        { status: 400 }
      );
    }

    const ext = file.name.split(".").pop()?.toLowerCase() || "";
    const allowedExtensions = ["docx", "pdf", "png", "jpg", "jpeg", "webp"];
    if (!allowedExtensions.includes(ext)) {
      return NextResponse.json(
        { success: false, error: "Định dạng tệp không được hỗ trợ. Vui lòng tải file .docx, .pdf hoặc ảnh chụp (.png, .jpg)." },
        { status: 400 }
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const parseResult = await withAiUsageContext(
      { purpose: "EXAM_IMPORT", teacherId: auth.user.userId },
      () => parseDocumentFile(buffer, file.name, file.type, targetSkill)
    );

    // Business Rule BR-INGEST-03: Max 50 questions per extraction batch
    if (parseResult.structuredData.questions.length > 50) {
      parseResult.structuredData.questions = parseResult.structuredData.questions.slice(0, 50);
    }

    const totalSubCount = parseResult.structuredData.questions.reduce(
      (acc, q) => acc + (Array.isArray(q.sub_questions) && q.sub_questions.length > 0 ? q.sub_questions.length : 1),
      0
    );

    return NextResponse.json({
      success: true,
      fileName: file.name,
      fileType: ext,
      engineUsed: parseResult.engineUsed,
      groupsCount: parseResult.structuredData.questions.length,
      questionsCount: totalSubCount,
      extractedData: parseResult.structuredData,
    });
  } catch (error: any) {
    console.error("AI Document Ingestion parse error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Đã xảy ra lỗi trong quá trình bóc tách tài liệu." },
      { status: 500 }
    );
  }
}
