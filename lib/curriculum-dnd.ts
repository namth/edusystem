export interface DndItem {
  id: string;
  parent_id: string | null;
  order_index: number;
  [k: string]: unknown;
}

// gapIndex: khe trong danh sách anh em ĐÍCH (cha = targetParentId) sắp theo order_index,
// danh sách này VẪN GỒM mục đang kéo nếu nó cùng cha. Khe 0 = trước mục đầu, khe n = sau mục cuối.
export function isNoopGap(
  items: DndItem[],
  dragId: string,
  targetParentId: string | null,
  gapIndex: number
): boolean {
  const dragItem = items.find((item) => item.id === dragId);
  if (!dragItem) {
    return true;
  }

  const normDragParent = dragItem.parent_id ?? null;
  const normTargetParent = targetParentId ?? null;

  if (normDragParent !== normTargetParent) {
    return false;
  }

  const siblings = items
    .filter((item) => (item.parent_id ?? null) === normTargetParent)
    .sort((a, b) => a.order_index - b.order_index);

  const i = siblings.findIndex((item) => item.id === dragId);
  if (i === -1) {
    return true;
  }

  return gapIndex === i || gapIndex === i + 1;
}

export function computeDrop<T extends DndItem = DndItem>(
  items: T[],
  dragId: string,
  targetParentId: string | null,
  gapIndex: number
): { noop: boolean; items: T[]; changed: T[] } {
  const dragItem = items.find((item) => item.id === dragId);
  if (!dragItem) {
    return {
      noop: true,
      items: items.map((x) => ({ ...x })),
      changed: [],
    };
  }

  if (isNoopGap(items, dragId, targetParentId, gapIndex)) {
    return {
      noop: true,
      items: items.map((x) => ({ ...x })),
      changed: [],
    };
  }

  const newItems: T[] = items.map((x) => ({ ...x }));
  const draggedInNew = newItems.find((x) => x.id === dragId)!;

  const normOldParent = draggedInNew.parent_id ?? null;
  const normTargetParent = targetParentId ?? null;
  const isSameParent = normOldParent === normTargetParent;

  const oldSiblings = newItems
    .filter((x) => (x.parent_id ?? null) === normOldParent)
    .sort((a, b) => a.order_index - b.order_index);
  const i = oldSiblings.findIndex((x) => x.id === dragId);

  const targetSiblings = isSameParent
    ? oldSiblings.filter((x) => x.id !== dragId)
    : newItems
        .filter((x) => (x.parent_id ?? null) === normTargetParent)
        .sort((a, b) => a.order_index - b.order_index);

  let insertIndex = isSameParent && gapIndex > i ? gapIndex - 1 : gapIndex;
  insertIndex = Math.max(0, Math.min(insertIndex, targetSiblings.length));

  draggedInNew.parent_id = targetParentId;
  targetSiblings.splice(insertIndex, 0, draggedInNew);

  targetSiblings.forEach((item, idx) => {
    item.order_index = idx + 1;
  });

  if (!isSameParent) {
    const remainingOldSiblings = oldSiblings.filter((x) => x.id !== dragId);
    remainingOldSiblings.forEach((item, idx) => {
      item.order_index = idx + 1;
    });
  }

  const changed: T[] = [];
  for (const item of newItems) {
    const orig = items.find((x) => x.id === item.id);
    if (orig) {
      const parentDiff = (item.parent_id ?? null) !== (orig.parent_id ?? null);
      const orderDiff = item.order_index !== orig.order_index;
      if (parentDiff || orderDiff) {
        changed.push(item);
      }
    }
  }

  return {
    noop: false,
    items: newItems,
    changed,
  };
}
