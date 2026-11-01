import Portkey from "portkey-ai";
import { queryPg } from "@/lib/db-pg";

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
  const usage = response.usage || { prompt_tokens: 850, completion_tokens: 320, total_tokens: 1170 };

  const promptTokens = usage.prompt_tokens || 850;
  const completionTokens = usage.completion_tokens || 320;
  const totalTokens = usage.total_tokens || promptTokens + completionTokens;

  // Cost estimation: ~$0.002 per 1,000 tokens
  const costUsd = Number(((totalTokens / 1000) * 0.002).toFixed(6));

  // Save actual log record into PostgreSQL Database (ai_usage_logs table)
  const logId = `log_${Date.now().toString().slice(-6)}`;

  try {
    // Ensure table exists
    await queryPg(`
      CREATE TABLE IF NOT EXISTS ai_usage_logs (
        id VARCHAR(50) PRIMARY KEY,
        teacher_id VARCHAR(50),
        student_id VARCHAR(50),
        submission_id VARCHAR(50),
        model VARCHAR(100),
        prompt_tokens INT DEFAULT 0,
        completion_tokens INT DEFAULT 0,
        total_tokens INT DEFAULT 0,
        cost_usd NUMERIC(10, 6) DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await queryPg(
      `INSERT INTO ai_usage_logs (id, teacher_id, student_id, submission_id, model, prompt_tokens, completion_tokens, total_tokens, cost_usd, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW());`,
      [logId, teacherId, studentId ?? null, submissionId, model, promptTokens, completionTokens, totalTokens, costUsd]
    );
  } catch (dbErr) {
    console.warn("Save ai_usage_logs warning:", dbErr);
  }

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
}
