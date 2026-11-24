// Mọi nhánh 500 của app/api/** đi qua serverError (FEAT-016, BR-W08).
// Log + báo admin (không chờ, không làm chậm phản hồi) + trả { success:false, error } với mã 500.
import { NextResponse } from "next/server";
import { errorSignature, reportAlert } from "@/lib/admin-alerts";

export interface ServerErrorContext {
  route: string;
  method: string;
  userId?: string;
  role?: string;
  /** Thông điệp tiếng Việt trả cho client; bỏ trống thì dùng thông điệp chung. */
  message?: string;
  /** Thân phản hồi riêng cho route có hợp đồng khác `{ success, error }` (vd `/api/tts`). */
  body?: Record<string, unknown>;
}

export const DEFAULT_SERVER_ERROR = "Đã xảy ra lỗi hệ thống. Vui lòng thử lại.";

export function serverError(err: unknown, ctx: ServerErrorContext): NextResponse {
  console.error(`${ctx.method} ${ctx.route} error:`, err);
  const e = (err && typeof err === "object" ? err : {}) as { message?: string; stack?: string };
  void reportAlert({
    level: "ERROR",
    source: "API",
    title: `${ctx.method} ${ctx.route} → 500 (${errorSignature(err)})`,
    fingerprint: `API:${ctx.method} ${ctx.route}:${errorSignature(err)}`,
    detail: {
      message: e.message ?? String(err),
      route: ctx.route,
      method: ctx.method,
      userId: ctx.userId,
      role: ctx.role,
      stack: e.stack,
    },
  }).catch(() => {});
  return NextResponse.json(ctx.body ?? { success: false, error: ctx.message || DEFAULT_SERVER_ERROR }, { status: 500 });
}
