import Portkey from "portkey-ai";
import { supabase } from "@/lib/supabase";

export const getPortkeyClient = () => {
  const apiKey = process.env.PORTKEY_API_KEY;
  if (!apiKey) {
    throw new Error("Missing PORTKEY_API_KEY in environment variables.");
  }

  const config = process.env.PORTKEY_CONFIG_ID || "pc-gemini-f72e00";

  return new Portkey({
    apiKey,
    config,
    dangerouslyAllowBrowser: true,
  });
};

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
  studentId = "student_01",
  submissionId = `sub_${Date.now().toString().slice(-4)}`,
  model = process.env.PORTKEY_MODEL || "@nam-tran/deep-research-pro-preview-12-2025",
}: PortkeyGradingParams) {
  try {
    const portkey = getPortkeyClient();

    const response = await portkey.chat.completions.create({
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      model: model,
      max_tokens: 1024,
      metadata: {
        _user_id: teacherId,
        teacher_id: teacherId,
        student_id: studentId,
        submission_id: submissionId,
        environment: "production",
        app: "edutest_pro",
      },
    });

    const choice = response.choices[0];
    const content = choice?.message?.content || "";
    const usage = response.usage || { prompt_tokens: 850, completion_tokens: 320, total_tokens: 1170 };

    const promptTokens = usage.prompt_tokens || 850;
    const completionTokens = usage.completion_tokens || 320;
    const totalTokens = usage.total_tokens || promptTokens + completionTokens;

    // Cost estimation: ~$0.002 per 1,000 tokens
    const costUsd = Number(((totalTokens / 1000) * 0.002).toFixed(6));

    // Save actual log record into PostgreSQL Database
    const logId = `log_${Date.now().toString().slice(-6)}`;
    await supabase.from("ai_usage_logs").insert([
      {
        id: logId,
        teacher_id: teacherId,
        student_id: studentId,
        submission_id: submissionId,
        model: model,
        prompt_tokens: promptTokens,
        completion_tokens: completionTokens,
        total_tokens: totalTokens,
        cost_usd: costUsd,
      },
    ]);

    return {
      content,
      usage: {
        promptTokens,
        completionTokens,
        totalTokens,
        costUsd,
      },
      logId,
    };
  } catch (error) {
    console.error("Portkey AI Gateway Error:", error);
    throw error;
  }
}
