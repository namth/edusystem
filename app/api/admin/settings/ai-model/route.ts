import { NextResponse } from "next/server";
import { requireRole } from "@/lib/api-auth";
import { getAiIngestionModelConfig, updateAiIngestionModelConfig } from "@/lib/ai-model-resolver";

export async function GET() {
  const auth = await requireRole(["ADMIN"]);
  if (auth.error) return auth.error;

  try {
    const config = await getAiIngestionModelConfig();
    return NextResponse.json({
      success: true,
      config,
      availableModels: [
        { id: "gemini-2.5-flash", name: "Google Gemini 2.5 Flash (Khuyên dùng - Siêu nhanh, Tiết kiệm)", provider: "google" },
        { id: "gemini-2.5-pro", name: "Google Gemini 2.5 Pro (Độ chính xác học thuật cao)", provider: "google" },
        { id: "gpt-4o", name: "OpenAI GPT-4o (Vision & Reasoning)", provider: "openai" },
        { id: "gpt-4o-mini", name: "OpenAI GPT-4o Mini (Kinh tế)", provider: "openai" },
      ],
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  const auth = await requireRole(["ADMIN"]);
  if (auth.error) return auth.error;
  const authUser = auth.user;

  try {
    const body = await req.json();
    const { model, provider = "google", temperature = 0.1, max_tokens = 8192 } = body;

    if (!model) {
      return NextResponse.json({ success: false, error: "Thiếu tên mô hình AI." }, { status: 400 });
    }

    const updated = await updateAiIngestionModelConfig(
      { model, provider, temperature, max_tokens },
      authUser.userId
    );

    return NextResponse.json({
      success: true,
      message: `Đã cập nhật mô hình AI bóc tách sang: ${model}`,
      config: updated,
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
