import { NextResponse } from "next/server";
import { queryPg } from "@/lib/db-pg";
import { requireRole } from "@/lib/api-auth";
import { checkRateLimit, recordRateLimitHit } from "@/lib/rate-limit";
import { issueTempPassword } from "@/lib/password-reset";

const RATE_LIMIT_MAX = 20;
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000; // 1 hour

const NOT_FOUND_MESSAGE = "Học sinh không tồn tại hoặc không thuộc lớp của bạn.";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ studentId: string }> }
) {
  const auth = await requireRole(["TEACHER"]);
  if (auth.error) {
    auth.error.headers.set("Cache-Control", "no-store");
    return auth.error;
  }

  const { studentId } = await params;
  const cleanStudentId = studentId?.trim();
  if (!cleanStudentId) {
    return NextResponse.json(
      { success: false, error: NOT_FOUND_MESSAGE },
      { status: 404, headers: { "Cache-Control": "no-store" } }
    );
  }

  const rateKey = `reset-password:${auth.user.userId}`;
  const rl = checkRateLimit(rateKey, RATE_LIMIT_MAX, RATE_LIMIT_WINDOW_MS);
  if (!rl.allowed) {
    return NextResponse.json(
      {
        success: false,
        error: "Bạn đã vượt quá giới hạn cấp lại mật khẩu (20 lần/giờ). Vui lòng thử lại sau.",
      },
      {
        status: 429,
        headers: {
          "Cache-Control": "no-store",
          "Retry-After": String(rl.retryAfterSeconds),
        },
      }
    );
  }
  recordRateLimitHit(rateKey, RATE_LIMIT_WINDOW_MS);

  const checkSql = `
    SELECT u.id
    FROM users u
    JOIN enrollments e ON e.student_id = u.id
    JOIN classes c ON c.id = e.class_id
    WHERE u.id = $1
      AND u.role = 'STUDENT'
      AND c.teacher_id = $2
    LIMIT 1;
  `;
  const studentRes = await queryPg(checkSql, [cleanStudentId, auth.user.userId]);

  if (studentRes.rows.length === 0) {
    return NextResponse.json(
      { success: false, error: NOT_FOUND_MESSAGE },
      { status: 404, headers: { "Cache-Control": "no-store" } }
    );
  }

  const temp_password = await issueTempPassword(cleanStudentId);

  return NextResponse.json(
    { success: true, temp_password },
    { status: 200, headers: { "Cache-Control": "no-store" } }
  );
}
