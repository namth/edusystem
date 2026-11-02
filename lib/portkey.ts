import Portkey from "portkey-ai";
import { recordAiUsage } from "@/lib/ai-usage";

export interface PortkeyGradingParams {
  systemPrompt?: string;
  userPrompt: string;
  teacherId: string;
  studentId?: string;
  submissionId?: string;
  model?: string;
}

export async function callPortkeyGrading({
  systemPrompt = "You are an expert IELTS examiner. Grade the submission accurately and provide structured band scores and detailed feedback.",
  userPrompt,
  teacherId,
  studentId,
  submissionId = `sub_${Date.now().toString().slice(-4)}`,
  model = process.env.PORTKEY_MODEL || "@nam-tran/deep-research-pro-preview-12-2025",
}: PortkeyGradingParams) {
  const apiKey = process.env.PORTKEY_API_KEY;
  if (!apiKey || !apiKey.trim()) {
    throw new Error("Chưa cấu hình PORTKEY_API_KEY");
  }

  const config = process.env.PORTKEY_CONFIG_ID || "pc-gemini-f72e00";

  const portkey = new Portkey({
    apiKey,
    config,
  });

  const metadata: Record<string, string> = {
    _user_id: teacherId,
    teacher_id: teacherId,
    environment: "production",
    app: "edutest_pro",
  };
  if (studentId) metadata.student_id = studentId;
  if (submissionId) metadata.submission_id = submissionId;

  const response = await portkey.chat.completions.create({
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    model: model,
    max_tokens: 1024,
    metadata,
  });

  const choice = response.choices[0];
  const rawContent = choice?.message?.content;
  const content = typeof rawContent === "string" ? rawContent : "Evaluation completed via Portkey Gateway.";

  const promptTokens = response.usage?.prompt_tokens ?? 0;
  const completionTokens = response.usage?.completion_tokens ?? 0;
  const totalTokens = response.usage?.total_tokens ?? (promptTokens + completionTokens);
  const usedModel = (response as any).model || model;

  await recordAiUsage({
    provider: "portkey",
    model: usedModel,
    promptTokens,
    completionTokens,
    totalTokens,
    teacherId,
    studentId,
    submissionId,
    purpose: "OTHER",
  });

  return {
    content,
    usage: {
      promptTokens,
      completionTokens,
      totalTokens,
    },
    logId: "",
  };
}
