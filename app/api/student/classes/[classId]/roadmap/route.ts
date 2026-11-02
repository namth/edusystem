import { NextResponse } from "next/server";
import { requireRole } from "@/lib/api-auth";
import { queryPg } from "@/lib/db-pg";
import { flattenRoadmap, computeProgressPercent } from "@/lib/roadmap";
import { loadStudentRoadmap } from "@/lib/lesson-access";

export async function GET(
  req: Request,
  props: { params: Promise<{ classId: string }> }
) {
  const auth = await requireRole(["STUDENT"]);
  if (auth.error) return auth.error;
  const user = auth.user;

  const { classId } = await props.params;

  const roadmapRes = await loadStudentRoadmap(classId, user.userId);
  if (!roadmapRes.ok) {
    return NextResponse.json(
      { success: false, error: roadmapRes.error },
      { status: roadmapRes.status }
    );
  }

  const { klass, items, states } = roadmapRes;

  const flattened = flattenRoadmap(items);
  const progress_percent = computeProgressPercent(states, items);

  const bestPercentMap = new Map<string, number>();
  if (items.length > 0) {
    const attemptsRes = await queryPg(
      `SELECT lesson_id, MAX(score_percent) as best_percent
       FROM lesson_attempts
       WHERE class_id = $1 AND student_id = $2 AND status IN ('GRADED', 'AI_SKIPPED')
       GROUP BY lesson_id`,
      [classId, user.userId]
    );
    for (const row of attemptsRes.rows) {
      if (row.best_percent !== null && row.best_percent !== undefined) {
        bestPercentMap.set(row.lesson_id, Number(row.best_percent));
      }
    }
  }

  const formattedItems = flattened.map((item) => {
    const isLesson = item.type === "LESSON";
    const best_percent =
      isLesson && item.lesson_id && bestPercentMap.has(item.lesson_id)
        ? bestPercentMap.get(item.lesson_id)!
        : null;

    return {
      id: item.id,
      parent_id: item.parent_id ?? null,
      type: item.type,
      title: item.title,
      order_index: item.order_index != null ? Number(item.order_index) : 0,
      lesson_id: item.lesson_id ?? null,
      exam_id: item.exam_id ?? null,
      state: states[item.id]?.state ?? "LOCKED",
      best_percent,
      due_date: states[item.id]?.due_date ?? null,
    };
  });

  return NextResponse.json({
    success: true,
    class: {
      id: klass.id,
      name: klass.name,
      unlock_mode: klass.unlock_mode,
      pass_percent: klass.pass_percent,
    },
    progress_percent,
    items: formattedItems,
  });
}
