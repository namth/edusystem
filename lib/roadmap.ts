// lib/roadmap.ts — hàm thuần tính trạng thái mục lộ trình (FEAT-010 BR-L04, BR-L05)
// Tuyệt đối không import DB, React, hoặc Next.js.

export type UnlockMode = "MANUAL" | "ALL_OPEN" | "SEQUENTIAL";
export type ItemState = "LOCKED" | "OPEN" | "COMPLETED";

export interface RoadmapItem {
  id: string;
  parent_id: string | null;
  type: "UNIT" | "LESSON" | "EXAM" | string;
  order_index: number;
  lesson_id?: string | null;
  exam_id?: string | null;
  [k: string]: unknown;
}

export interface UnlockRow {
  curriculum_item_id: string;
  student_id: string | null;
  due_date?: string | null;
}

/**
 * flattenRoadmap:
 * Mục gốc (parent_id null — gồm unit và mục học đặt ở gốc) sắp theo order_index;
 * ngay sau mỗi unit là các con của nó theo order_index.
 */
export function flattenRoadmap<T extends RoadmapItem>(items: T[]): T[] {
  const isRoot = (item: T) =>
    item.parent_id === null || item.parent_id === undefined || item.parent_id === "";

  const roots = items
    .filter(isRoot)
    .sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0));

  const childrenByParent = new Map<string, T[]>();
  for (const item of items) {
    if (!isRoot(item) && item.parent_id) {
      const list = childrenByParent.get(item.parent_id);
      if (list) {
        list.push(item);
      } else {
        childrenByParent.set(item.parent_id, [item]);
      }
    }
  }

  for (const list of childrenByParent.values()) {
    list.sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0));
  }

  const result: T[] = [];
  for (const root of roots) {
    result.push(root);
    if (root.type === "UNIT") {
      const children = childrenByParent.get(root.id);
      if (children) {
        result.push(...children);
      }
    }
  }

  return result;
}

/**
 * computeRoadmapStates:
 * Tính trạng thái (LOCKED | OPEN | COMPLETED) và due_date cho từng mục lộ trình.
 */
export function computeRoadmapStates(input: {
  items: RoadmapItem[];
  mode: UnlockMode;
  unlocks: UnlockRow[];
  completedItemIds: Set<string>;
  studentId: string;
}): Record<string, { state: ItemState; due_date: string | null }> {
  const { items, mode, unlocks, completedItemIds, studentId } = input;
  const result: Record<string, { state: ItemState; due_date: string | null }> = {};

  const childrenByParent = new Map<string, RoadmapItem[]>();
  for (const item of items) {
    if (item.parent_id) {
      const list = childrenByParent.get(item.parent_id);
      if (list) {
        list.push(item);
      } else {
        childrenByParent.set(item.parent_id, [item]);
      }
    }
  }

  // Helper tìm due_date theo thứ tự ưu tiên:
  // dòng riêng HS chính mục -> dòng cả lớp chính mục -> dòng riêng HS unit cha -> dòng cả lớp unit cha -> null
  const getDueDate = (item: RoadmapItem): string | null => {
    const studentItemUnlock = unlocks.find(
      (u) => u.curriculum_item_id === item.id && u.student_id === studentId
    );
    if (studentItemUnlock) return studentItemUnlock.due_date ?? null;

    const classItemUnlock = unlocks.find(
      (u) =>
        u.curriculum_item_id === item.id &&
        (u.student_id === null || u.student_id === undefined)
    );
    if (classItemUnlock) return classItemUnlock.due_date ?? null;

    if (item.parent_id) {
      const studentParentUnlock = unlocks.find(
        (u) => u.curriculum_item_id === item.parent_id && u.student_id === studentId
      );
      if (studentParentUnlock) return studentParentUnlock.due_date ?? null;

      const classParentUnlock = unlocks.find(
        (u) =>
          u.curriculum_item_id === item.parent_id &&
          (u.student_id === null || u.student_id === undefined)
      );
      if (classParentUnlock) return classParentUnlock.due_date ?? null;
    }

    return null;
  };

  const getUnitDueDate = (unit: RoadmapItem): string | null => {
    const studentUnitUnlock = unlocks.find(
      (u) => u.curriculum_item_id === unit.id && u.student_id === studentId
    );
    if (studentUnitUnlock) return studentUnitUnlock.due_date ?? null;

    const classUnitUnlock = unlocks.find(
      (u) =>
        u.curriculum_item_id === unit.id &&
        (u.student_id === null || u.student_id === undefined)
    );
    if (classUnitUnlock) return classUnitUnlock.due_date ?? null;

    return null;
  };

  const flattened = flattenRoadmap(items);
  const learningItems = flattened.filter((i) => i.type !== "UNIT");

  if (mode === "ALL_OPEN") {
    for (const item of learningItems) {
      const state: ItemState = completedItemIds.has(item.id) ? "COMPLETED" : "OPEN";
      result[item.id] = { state, due_date: getDueDate(item) };
    }
  } else if (mode === "MANUAL") {
    for (const item of learningItems) {
      if (completedItemIds.has(item.id)) {
        result[item.id] = { state: "COMPLETED", due_date: getDueDate(item) };
      } else {
        const hasUnlock = unlocks.some((u) => {
          const matchTarget =
            u.curriculum_item_id === item.id ||
            (item.parent_id && u.curriculum_item_id === item.parent_id);
          const matchStudent =
            u.student_id === null ||
            u.student_id === undefined ||
            u.student_id === studentId;
          return matchTarget && matchStudent;
        });
        result[item.id] = {
          state: hasUnlock ? "OPEN" : "LOCKED",
          due_date: getDueDate(item),
        };
      }
    }
  } else if (mode === "SEQUENTIAL") {
    let firstUncompletedFound = false;

    for (const item of learningItems) {
      if (completedItemIds.has(item.id)) {
        result[item.id] = { state: "COMPLETED", due_date: getDueDate(item) };
      } else {
        const isFirstUncompleted = !firstUncompletedFound;
        firstUncompletedFound = true;

        const hasStudentUnlock = unlocks.some((u) => {
          const matchTarget =
            u.curriculum_item_id === item.id ||
            (item.parent_id && u.curriculum_item_id === item.parent_id);
          const matchStudent = u.student_id === studentId;
          return matchTarget && matchStudent;
        });

        if (hasStudentUnlock || isFirstUncompleted) {
          result[item.id] = { state: "OPEN", due_date: getDueDate(item) };
        } else {
          result[item.id] = { state: "LOCKED", due_date: getDueDate(item) };
        }
      }
    }
  }

  // Trạng thái unit:
  // COMPLETED nếu có ≥ 1 con và mọi con COMPLETED;
  // OPEN nếu có con OPEN hoặc COMPLETED;
  // còn lại (kể cả unit rỗng) LOCKED.
  const unitItems = items.filter((i) => i.type === "UNIT");
  for (const unit of unitItems) {
    const children = childrenByParent.get(unit.id) || [];
    const dueDate = getUnitDueDate(unit);

    if (
      children.length > 0 &&
      children.every((child) => result[child.id]?.state === "COMPLETED")
    ) {
      result[unit.id] = { state: "COMPLETED", due_date: dueDate };
    } else if (
      children.some(
        (child) =>
          result[child.id]?.state === "OPEN" ||
          result[child.id]?.state === "COMPLETED"
      )
    ) {
      result[unit.id] = { state: "OPEN", due_date: dueDate };
    } else {
      result[unit.id] = { state: "LOCKED", due_date: dueDate };
    }
  }

  return result;
}

/**
 * computeProgressPercent:
 * Math.round(số mục học COMPLETED / tổng mục học × 100); không có mục học → 0.
 */
export function computeProgressPercent(
  states: Record<string, { state: ItemState }>,
  items: RoadmapItem[]
): number {
  const learningItems = items.filter((item) => item.type !== "UNIT");
  if (learningItems.length === 0) return 0;

  const completedCount = learningItems.filter(
    (item) => states[item.id]?.state === "COMPLETED"
  ).length;

  return Math.round((completedCount / learningItems.length) * 100);
}
