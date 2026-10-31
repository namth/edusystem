import { NextResponse } from "next/server";
import { requireRole } from "@/lib/api-auth";
import { queryPg } from "@/lib/db-pg";
import { loadClassProgress } from "@/lib/roadmap-data";

export async function GET(
  req: Request,
  context: { params: Promise<{ classId: string }> | { classId: string } }
) {
  const auth = await requireRole(["ADMIN", "TEACHER"]);
  if (auth.error) return auth.error;
  const user = auth.user;

  const { classId } = await context.params;

  const classRes = await queryPg(
    "SELECT id, teacher_id FROM classes WHERE id = $1",
    [classId]
  );
  if (classRes.rows.length === 0) {
    return NextResponse.json({ success: false, error: "Lớp học không tồn tại." }, { status: 404 });
  }

  const cls = classRes.rows[0];
  if (user.role === "TEACHER" && cls.teacher_id !== user.userId) {
    return NextResponse.json(
      { success: false, error: "Bạn không có quyền truy cập lớp học này." },
      { status: 403 }
    );
  }

  const progress = await loadClassProgress(classId);

  return NextResponse.json({
    success: true,
    students: progress.students,
    items: progress.items,
    cells: progress.cells,
  });
}
