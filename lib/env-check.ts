// Environment variable validation helper
export function validateEnvironmentVars() {
  const required = [
    "NEXT_PUBLIC_SUPABASE_URL",
    "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    "PORTKEY_API_KEY",
  ];

  const missing: string[] = [];

  for (const envVar of required) {
    if (!process.env[envVar]) {
      missing.push(envVar);
    }
  }

  if (missing.length > 0) {
    console.warn(`[WARNING] Missing environment variables: ${missing.join(", ")}`);
  }
}
