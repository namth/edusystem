import { queryPg } from "@/lib/db-pg";
import {
  computeRoadmapStates,
  type RoadmapItem,
  type UnlockMode,
  type ItemState,
  type UnlockRow,
} from "@/lib/roadmap";
import { loadCompletedItemIds } from "@/lib/roadmap-data";

export interface StudentRoadmapClass {
  id: string;
  name: string;
  course_id: string | null;
  unlock_mode: string;
  pass_percent: number;
  teacher_id: string;
}

export async function loadStudentRoadmap(
  classId: string,
  studentId: string
): Promise<
  | { ok: false; status: 403 | 404; error: string }
  | {
      ok: true;
      klass: StudentRoadmapClass;
      items: RoadmapItem[];
      states: Record<string, { state: ItemState; due_date: string | null }>;
    }
> {
  const classRes = await queryPg(
    "SELECT id, name, course_id, unlock_mode, pass_percent, teacher_id FROM classes WHERE id = $1",
    [classId]
  );
  if (classRes.rows.length === 0) {
    return { ok: false, status: 404, error: "Lớp học không tồn tại." };
  }

  const enrollRes = await queryPg(
    "SELECT 1 FROM enrollments WHERE class_id = $1 AND student_id = $2",
    [classId, studentId]
  );
  if (enrollRes.rows.length === 0) {
    return { ok: false, status: 403, error: "Học sinh chưa ghi danh vào lớp học này." };
  }

  const row = classRes.rows[0];
  const klass: StudentRoadmapClass = {
    id: row.id,
    name: row.name,
    course_id: row.course_id || null,
    unlock_mode: row.unlock_mode || "MANUAL",
    pass_percent: row.pass_percent != null ? Number(row.pass_percent) : 70,
    teacher_id: row.teacher_id,
  };

  if (!klass.course_id) {
    return {
      ok: true,
      klass,
      items: [],
      states: {},
    };
  }

  const itemsRes = await queryPg(
    "SELECT id, course_id, parent_id, title, type, exam_id, lesson_id, order_index FROM curriculum_items WHERE course_id = $1 ORDER BY order_index ASC",
    [klass.course_id]
  );
  const items: RoadmapItem[] = itemsRes.rows.map((r: any) => ({
    ...r,
    order_index: r.order_index != null ? Number(r.order_index) : 0,
  }));

  const unlocksRes = await queryPg(
    "SELECT curriculum_item_id, student_id, due_date FROM class_unlocks WHERE class_id = $1",
    [classId]
  );
  const unlocks: UnlockRow[] = unlocksRes.rows.map((u: any) => ({
    curriculum_item_id: u.curriculum_item_id,
    student_id: u.student_id ?? null,
    due_date: u.due_date != null ? String(u.due_date) : null,
  }));

  const completedItemIds = await loadCompletedItemIds(classId, studentId);

  const states = computeRoadmapStates({
    items,
    mode: klass.unlock_mode as UnlockMode,
    unlocks,
    completedItemIds,
    studentId,
  });

  return {
    ok: true,
    klass,
    items,
    states,
  };
}

export async function checkLessonAccess(
  classId: string,
  lessonId: string,
  studentId: string
): Promise<
  | { ok: false; status: 400 | 403 | 404; error: string }
  | {
      ok: true;
      klass: StudentRoadmapClass;
      item: RoadmapItem;
      lesson: {
        id: string;
        title: string;
        description: string | null;
        question_ids: string[];
      };
    }
> {
  if (!classId || typeof classId !== "string" || !classId.trim()) {
    return { ok: false, status: 400, error: "Thiếu mã lớp học (classId)." };
  }

  const lessonRes = await queryPg(
    "SELECT id, title, description, question_ids FROM lessons WHERE id = $1",
    [lessonId]
  );
  if (lessonRes.rows.length === 0) {
    return { ok: false, status: 404, error: "Bài học không tồn tại." };
  }
  const lRow = lessonRes.rows[0];

  const roadmapRes = await loadStudentRoadmap(classId, studentId);
  if (!roadmapRes.ok) {
    return roadmapRes;
  }

  const matchingItems = roadmapRes.items.filter(
    (i) => i.type === "LESSON" && i.lesson_id === lessonId
  );
  if (matchingItems.length === 0) {
    return { ok: false, status: 403, error: "Bài học không thuộc lộ trình lớp." };
  }

  const activeItem =
    matchingItems.find((i) => {
      const s = roadmapRes.states[i.id]?.state;
      return s === "OPEN" || s === "COMPLETED";
    }) || matchingItems[0];

  const itemState = roadmapRes.states[activeItem.id]?.state;
  if (itemState === "LOCKED") {
    return { ok: false, status: 403, error: "Bài học chưa được mở." };
  }

  const question_ids: string[] = Array.isArray(lRow.question_ids)
    ? lRow.question_ids
    : typeof lRow.question_ids === "string"
    ? JSON.parse(lRow.question_ids)
    : [];

  return {
    ok: true,
    klass: roadmapRes.klass,
    item: activeItem,
    lesson: {
      id: lRow.id,
      title: lRow.title,
      description: lRow.description ?? null,
      question_ids,
    },
  };
}
