// app/api/teacher/classes/[classId]/end/route.ts — Kết thúc lớp học (FEAT-015 §6, BR-W08, TC-W10)
import { NextResponse } from "next/server";
import { requireRole } from "@/lib/api-auth";
import { queryPg } from "@/lib/db-pg";

export async function POST(
  req: Request,
  props: { params: Promise<{ classId: string }> }
) {
  const auth = await requireRole(["TEACHER", "ADMIN"]);
  if (auth.error) return auth.error;

  const { classId } = await props.params;

  const classRes = await queryPg(
    "SELECT id, teacher_id, billing_status FROM classes WHERE id = $1 LIMIT 1",
    [classId]
  );
  if (classRes.rows.length === 0) {
    return NextResponse.json(
      { success: false, error: "Lớp học không tồn tại." },
      { status: 404 }
    );
  }

  const cls = classRes.rows[0];
  if (auth.user.role === "TEACHER" && cls.teacher_id !== auth.user.userId) {
    return NextResponse.json(
      { success: false, error: "Lớp học không tồn tại." },
      { status: 404 }
    );
  }

  if (cls.billing_status === "ENDED") {
    return NextResponse.json(
      { success: false, error: "Lớp học đã kết thúc trước đó." },
      { status: 409 }
    );
  }

  await queryPg(
    "UPDATE classes SET billing_status = 'ENDED', ended_at = NOW() WHERE id = $1",
    [classId]
  );

  return NextResponse.json({ success: true });
}
