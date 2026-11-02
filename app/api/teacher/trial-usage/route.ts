import { NextResponse } from "next/server";
import { requireRole } from "@/lib/api-auth";
import { queryPg } from "@/lib/db-pg";
import {
  TRIAL_LIMITS,
  getTrialUsage,
  isTrialTeacher,
} from "@/lib/teacher-trial";

export async function GET(_req?: Request) {
  const auth = await requireRole(["ADMIN", "TEACHER"]);
  if (auth.error) return auth.error;
  const user = auth.user;

  try {
    const userRes = await queryPg(
      `SELECT u.role, u.teacher_status, tp.review_note
       FROM users u
       LEFT JOIN teacher_profiles tp ON tp.user_id = u.id
       WHERE u.id = $1
       LIMIT 1`,
      [user.userId]
    );

    const row = userRes.rows[0];
    const isTrial = await isTrialTeacher(user.userId);

    if (!isTrial) {
      return NextResponse.json({
        success: true,
        status: row?.teacher_status || "VERIFIED",
        limits: null,
        used: null,
        reviewNote: row?.review_note ?? null,
      });
    }

    const used = await getTrialUsage(user.userId);
    return NextResponse.json({
      success: true,
      status: row?.teacher_status || "TRIAL",
      limits: TRIAL_LIMITS,
      used,
      reviewNote: row?.review_note ?? null,
    });
  } catch (err: any) {
    console.error("GET /api/teacher/trial-usage error:", err);
    return NextResponse.json(
      { success: false, error: err.message || "Lỗi tải tiến độ dùng thử." },
      { status: 500 }
    );
  }
}
