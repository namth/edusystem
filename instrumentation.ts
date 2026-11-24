// Next.js gọi register() một lần khi server khởi động.
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { validateEnvironmentVars } = await import("@/lib/env-check");
  validateEnvironmentVars();
}

// Lỗi chưa được bắt ở route handler / server component / middleware → báo admin (FEAT-016, DEC-047).
export async function onRequestError(
  err: unknown,
  request: { path: string; method: string },
  context: { routePath?: string; routeType?: string }
) {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  try {
    const { reportAlert, errorSignature } = await import("@/lib/admin-alerts");
    const e = (err && typeof err === "object" ? err : {}) as { message?: string; stack?: string };
    const route = context?.routePath || request?.path || "unknown";
    await reportAlert({
      level: "ERROR",
      source: "SERVER",
      title: `Lỗi chưa bắt: ${request?.method || ""} ${route} (${errorSignature(err)})`.trim(),
      fingerprint: `SERVER:${route}:${errorSignature(err)}`,
      detail: {
        message: e.message ?? String(err),
        route,
        method: request?.method,
        stack: e.stack,
        extra: { routeType: context?.routeType },
      },
    });
  } catch {
    // không bao giờ làm hỏng xử lý lỗi của Next
  }
}
