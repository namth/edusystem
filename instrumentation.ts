// Next.js gọi register() một lần khi server khởi động.
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { validateEnvironmentVars } = await import("@/lib/env-check");
  validateEnvironmentVars();
}
