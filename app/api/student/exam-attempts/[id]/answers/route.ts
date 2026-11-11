import { NextResponse } from "next/server";
import { requireRole } from "@/lib/api-auth";
import { queryPg } from "@/lib/db-pg";
import { assertClassOpen, classLockedResponse } from "@/lib/class-billing";

export async function PUT(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await requireRole(["STUDENT"]);
  if (auth.error) return auth.error;

  const { id } = await context.params;
  const studentId = auth.user.userId;

  const body = await req.json().catch(() => ({}));
  const answers = body?.answers;

  if (typeof answers !== "object" || answers === null || Array.isArray(answers)) {
    return NextResponse.json(
      { success: false, error: "answers phải là object." },
      { status: 400 }
    );
  }

  const subRes = await queryPg(
    "SELECT id, student_id, status, deadline_at, class_ref FROM submissions WHERE id = $1 LIMIT 1",
    [id]
  );
  if (subRes.rows.length === 0) {
    return NextResponse.json(
      { success: false, error: "Lượt thi không tồn tại." },
      { status: 404 }
    );
  }

  const sub = subRes.rows[0];
  if (sub.student_id !== studentId) {
    return NextResponse.json(
      { success: false, error: "Bạn không có quyền sửa lượt thi này." },
      { status: 403 }
    );
  }

  if (sub.class_ref) {
    const classCheck = await assertClassOpen(sub.class_ref);
    if (!classCheck.ok) {
      return classLockedResponse();
    }
  }

  if (sub.status !== "IN_PROGRESS") {
    return NextResponse.json(
      { success: false, error: "Lượt thi không ở trạng thái đang làm." },
      { status: 409 }
    );
  }

  if (sub.deadline_at) {
    const deadlineTime = new Date(sub.deadline_at).getTime();
    const nowTime = Date.now();
    // quá hạn + 2 phút -> 409
    if (nowTime > deadlineTime + 2 * 60 * 1000) {
      return NextResponse.json(
        { success: false, error: "Lượt thi đã quá thời hạn nộp bài." },
        { status: 409 }
      );
    }
  }

  await queryPg(
    "UPDATE submissions SET answers = $1 WHERE id = $2",
    [JSON.stringify(answers), id]
  );

  return NextResponse.json({ success: true }, { status: 200 });
}
