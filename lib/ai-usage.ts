import { AsyncLocalStorage } from "node:async_hooks";
import crypto from "node:crypto";
import { queryPg } from "@/lib/db-pg";
import {
  type AiPricing,
  DEFAULT_AI_PRICING,
  costUsd,
  validateAiPricing,
} from "@/lib/ai-pricing";

export type AiPurpose =
  | "EXAM_GRADING"
  | "LESSON_GRADING"
  | "EXAM_IMPORT"
  | "OTHER";

export interface AiUsageContext {
  purpose: AiPurpose;
  teacherId?: string | null;
  studentId?: string | null;
  submissionId?: string | null;
  lessonAttemptId?: string | null;
}

const storage = new AsyncLocalStorage<AiUsageContext>();

export function withAiUsageContext<T>(
  ctx: AiUsageContext,
  fn: () => Promise<T>
): Promise<T> {
  return storage.run(ctx, fn);
}

export function getAiUsageContext(): AiUsageContext | undefined {
  return storage.getStore();
}

export async function getAiPricing(): Promise<AiPricing> {
  try {
    const res = await queryPg(
      `SELECT value FROM system_settings WHERE key = 'ai_pricing' LIMIT 1`
    );
    if (res.rows.length > 0 && res.rows[0].value) {
      const raw =
        typeof res.rows[0].value === "string"
          ? JSON.parse(res.rows[0].value)
          : res.rows[0].value;
      const validated = validateAiPricing(raw);
      if (validated.ok) {
        return validated.value;
      }
    }
  } catch (err) {
    console.warn("getAiPricing warning:", err);
  }
  return {
    usd_vnd_rate: DEFAULT_AI_PRICING.usd_vnd_rate,
    models: { ...DEFAULT_AI_PRICING.models },
  };
}

export async function recordAiUsage(
  e: {
    provider: string;
    model: string;
    promptTokens: number;
    completionTokens: number;
    totalTokens?: number;
  } & Partial<AiUsageContext>
): Promise<void> {
  try {
    const ctx = storage.getStore();
    const purpose: AiPurpose = e.purpose ?? ctx?.purpose ?? "OTHER";
    const teacherId = e.teacherId !== undefined ? e.teacherId : ctx?.teacherId ?? null;
    const studentId = e.studentId !== undefined ? e.studentId : ctx?.studentId ?? null;
    const submissionId = e.submissionId !== undefined ? e.submissionId : ctx?.submissionId ?? null;
    const lessonAttemptId =
      e.lessonAttemptId !== undefined ? e.lessonAttemptId : ctx?.lessonAttemptId ?? null;

    const promptTokens =
      typeof e.promptTokens === "number" && Number.isFinite(e.promptTokens) && e.promptTokens > 0
        ? Math.round(e.promptTokens)
        : 0;
    const completionTokens =
      typeof e.completionTokens === "number" &&
      Number.isFinite(e.completionTokens) &&
      e.completionTokens > 0
        ? Math.round(e.completionTokens)
        : 0;
    const totalTokens =
      typeof e.totalTokens === "number" && Number.isFinite(e.totalTokens) && e.totalTokens >= 0
        ? Math.round(e.totalTokens)
        : promptTokens + completionTokens;

    const pricing = await getAiPricing();
    const cost = costUsd(e.model || "", promptTokens, completionTokens, pricing);
    const id = `aiu_${crypto.randomUUID()}`;

    await queryPg(
      `INSERT INTO ai_usage_logs (
        id, purpose, provider, model, teacher_id, student_id, submission_id, lesson_attempt_id,
        prompt_tokens, completion_tokens, total_tokens, cost_usd, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW())`,
      [
        id,
        purpose,
        e.provider || null,
        e.model || "",
        teacherId,
        studentId,
        submissionId,
        lessonAttemptId,
        promptTokens,
        completionTokens,
        totalTokens,
        cost,
      ]
    );
  } catch (err) {
    console.warn("recordAiUsage warning:", err);
  }
}
