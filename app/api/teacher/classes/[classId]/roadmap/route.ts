import { NextResponse } from "next/server";
import { requireRole } from "@/lib/api-auth";
import { queryPg } from "@/lib/db-pg";
import { flattenRoadmap, type RoadmapItem } from "@/lib/roadmap";

export async function GET(
  req: Request,
  context: { params: Promise<{ classId: string }> | { classId: string } }
) {
  const auth = await requireRole(["ADMIN", "TEACHER"]);
  if (auth.error) return auth.error;
  const user = auth.user;

  const { classId } = await context.params;

  const classRes = await queryPg(
    "SELECT id, name, code, teacher_id, course_id, unlock_mode, pass_percent FROM classes WHERE id = $1",
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

  let items: any[] = [];
  if (cls.course_id) {
    const itemsRes = await queryPg(
      `SELECT id, parent_id, type, title, order_index, lesson_id, exam_id
       FROM curriculum_items
       WHERE course_id = $1
       ORDER BY order_index ASC`,
      [cls.course_id]
    );
    items = flattenRoadmap(itemsRes.rows as RoadmapItem[]).map((i: any) => ({
      id: i.id,
      parent_id: i.parent_id ?? null,
      type: i.type,
      title: i.title,
      order_index: i.order_index ?? 0,
      lesson_id: i.lesson_id ?? null,
      exam_id: i.exam_id ?? null,
    }));
  }

  const unlockRes = await queryPg(
    `SELECT class_id, curriculum_item_id, student_id, due_date, unlocked_by, unlocked_at
     FROM class_unlocks
     WHERE class_id = $1
     ORDER BY unlocked_at ASC`,
    [classId]
  );

  return NextResponse.json({
    success: true,
    class: {
      id: cls.id,
      name: cls.name,
      code: cls.code,
      teacher_id: cls.teacher_id,
      course_id: cls.course_id,
      unlock_mode: cls.unlock_mode,
      pass_percent: Number(cls.pass_percent),
    },
    items,
    unlocks: unlockRes.rows,
  });
}
