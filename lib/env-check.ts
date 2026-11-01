// Kiểm tra biến môi trường lúc khởi động server (gọi từ instrumentation.ts).
// Thiếu biến bắt buộc ở production → ném lỗi để container không chạy với cấu hình hỏng.
const REQUIRED = ["DATABASE_URL", "JWT_SECRET", "INTERNAL_API_TOKEN", "REDIS_URL"];
const RECOMMENDED = ["PORTKEY_API_KEY", "GOOGLE_API_KEY", "NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "NEO4J_URI"];

export function findEnvProblems(env: Record<string, string | undefined> = process.env) {
  const errors: string[] = [];
  for (const k of REQUIRED) if (!env[k]?.trim()) errors.push(`Thiếu ${k}`);
  if (env.JWT_SECRET && env.JWT_SECRET.length < 32) errors.push("JWT_SECRET ngắn hơn 32 ký tự");
  const warnings = RECOMMENDED.filter((k) => !env[k]?.trim()).map((k) => `Thiếu ${k}`);
  return { errors, warnings };
}

export function validateEnvironmentVars(env: Record<string, string | undefined> = process.env) {
  const { errors, warnings } = findEnvProblems(env);
  if (warnings.length > 0) console.warn(`[env] ${warnings.join(", ")}`);
  if (errors.length === 0) return;
  if (env.NODE_ENV === "production") {
    throw new Error(`[env] Cấu hình production không hợp lệ: ${errors.join(", ")}`);
  }
  console.warn(`[env] ${errors.join(", ")}`);
}
