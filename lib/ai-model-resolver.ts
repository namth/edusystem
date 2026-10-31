import { queryPg } from "./db-pg";

export interface AiModelConfig {
  provider: "google" | "openai" | "portkey";
  model: string;
  temperature?: number;
  max_tokens?: number;
}

const DEFAULT_CONFIG: AiModelConfig = {
  provider: "google",
  model: process.env.DEFAULT_AI_MODEL || "gemini-flash-lite-latest",
  temperature: 0.1,
  max_tokens: 8192,
};

let cachedConfig: AiModelConfig | null = null;
let lastFetchedAt = 0;
const CACHE_TTL_MS = 30000; // 30 seconds cache

/**
 * Resolves current AI Model configuration dynamically from system_settings table
 * with fallback to env variables and built-in defaults.
 */
export async function getAiIngestionModelConfig(): Promise<AiModelConfig> {
  const now = Date.now();
  if (cachedConfig && now - lastFetchedAt < CACHE_TTL_MS) {
    return cachedConfig;
  }

  try {
    const res = await queryPg(
      "SELECT value FROM system_settings WHERE key = $1 LIMIT 1",
      ["ai_exam_ingestion_model"]
    );

    if (res.rows.length > 0 && res.rows[0].value) {
      const val = typeof res.rows[0].value === "string"
        ? JSON.parse(res.rows[0].value)
        : res.rows[0].value;

      cachedConfig = {
        provider: val.provider || DEFAULT_CONFIG.provider,
        model: val.model || DEFAULT_CONFIG.model,
        temperature: val.temperature ?? DEFAULT_CONFIG.temperature,
        max_tokens: val.max_tokens ?? DEFAULT_CONFIG.max_tokens,
      };
      lastFetchedAt = now;
      return cachedConfig;
    }
  } catch (err) {
    console.warn("Failed to fetch dynamic AI model config from database, using default:", err);
  }

  return DEFAULT_CONFIG;
}

/**
 * Updates dynamic AI Model configuration in system_settings table (Admin only)
 */
export async function updateAiIngestionModelConfig(
  config: Partial<AiModelConfig>,
  updatedByUserId?: string
): Promise<AiModelConfig> {
  const current = await getAiIngestionModelConfig();
  const updated: AiModelConfig = {
    ...current,
    ...config,
  };

  await queryPg(
    `INSERT INTO system_settings (key, value, description, updated_by, updated_at)
     VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)
     ON CONFLICT (key) DO UPDATE
     SET value = EXCLUDED.value,
         updated_by = EXCLUDED.updated_by,
         updated_at = CURRENT_TIMESTAMP`,
    [
      "ai_exam_ingestion_model",
      JSON.stringify(updated),
      "Mô hình AI sử dụng để bóc tách câu hỏi từ file DOCX/PDF/Ảnh",
      updatedByUserId || null,
    ]
  );

  cachedConfig = updated;
  lastFetchedAt = Date.now();
  return updated;
}
