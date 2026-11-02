// TASK-006 — Logic kéo thả cây lộ trình (hàm thuần trong lib/curriculum-dnd.ts).
// "Khe" (gapIndex) đánh số theo danh sách anh em ĐÍCH đang hiển thị, VẪN gồm mục đang kéo:
// khe 0 = trước mục đầu, khe n = sau mục cuối. File do trưởng phòng viết, bị khoá.
import { describe, it, expect } from "vitest";
import { isNoopGap, computeDrop, type DndItem } from "@/lib/curriculum-dnd";

const base = (): DndItem[] => [
  { id: "U1", parent_id: null, order_index: 1, type: "UNIT" },
  { id: "U2", parent_id: null, order_index: 2, type: "UNIT" },
  { id: "L1", parent_id: "U1", order_index: 1, type: "LESSON" },
  { id: "L2", parent_id: "U1", order_index: 2, type: "LESSON" },
  { id: "L3", parent_id: "U1", order_index: 3, type: "EXAM" },
  { id: "L4", parent_id: "U2", order_index: 1, type: "LESSON" },
];

const order = (items: DndItem[], parent: string | null) =>
  items
    .filter((i) => (i.parent_id ?? null) === parent)
    .sort((a, b) => a.order_index - b.order_index)
    .map((i) => i.id);

describe("isNoopGap — khe ngay trên/dưới chính mục đang kéo không phải vị trí mới", () => {
  it("mục đầu L1: khe 0 và 1 là chính nó; khe 2 trở đi là di chuyển", () => {
    expect(isNoopGap(base(), "L1", "U1", 0)).toBe(true);
    expect(isNoopGap(base(), "L1", "U1", 1)).toBe(true);
    expect(isNoopGap(base(), "L1", "U1", 2)).toBe(false);
    expect(isNoopGap(base(), "L1", "U1", 3)).toBe(false);
  });

  it("mục giữa L2: khe 1 và 2 là chính nó; khe 0 và 3 là di chuyển", () => {
    expect(isNoopGap(base(), "L2", "U1", 1)).toBe(true);
    expect(isNoopGap(base(), "L2", "U1", 2)).toBe(true);
    expect(isNoopGap(base(), "L2", "U1", 0)).toBe(false);
    expect(isNoopGap(base(), "L2", "U1", 3)).toBe(false);
  });

  it("sang unit khác thì không bao giờ là noop", () => {
    expect(isNoopGap(base(), "L1", "U2", 0)).toBe(false);
    expect(isNoopGap(base(), "L1", "U2", 1)).toBe(false);
  });

  it("unit ở gốc cũng theo cùng quy tắc", () => {
    expect(isNoopGap(base(), "U1", null, 0)).toBe(true);
    expect(isNoopGap(base(), "U1", null, 1)).toBe(true);
    expect(isNoopGap(base(), "U1", null, 2)).toBe(false);
  });
});

describe("computeDrop — vị trí thả khớp đúng ô preview", () => {
  it("khe noop → noop: true, không đổi gì", () => {
    const r = computeDrop(base(), "L1", "U1", 1);
    expect(r.noop).toBe(true);
    expect(r.changed).toEqual([]);
    expect(order(r.items, "U1")).toEqual(["L1", "L2", "L3"]);
  });

  it("kéo L1 XUỐNG khe 2 (giữa L2 và L3) → L2, L1, L3", () => {
    const r = computeDrop(base(), "L1", "U1", 2);
    expect(r.noop).toBe(false);
    expect(order(r.items, "U1")).toEqual(["L2", "L1", "L3"]);
  });

  it("kéo L1 XUỐNG khe cuối (3) → L2, L3, L1", () => {
    expect(order(computeDrop(base(), "L1", "U1", 3).items, "U1")).toEqual(["L2", "L3", "L1"]);
  });

  it("kéo L3 LÊN khe 0 → L3, L1, L2", () => {
    expect(order(computeDrop(base(), "L3", "U1", 0).items, "U1")).toEqual(["L3", "L1", "L2"]);
  });

  it("kéo L3 LÊN khe 1 → L1, L3, L2", () => {
    expect(order(computeDrop(base(), "L3", "U1", 1).items, "U1")).toEqual(["L1", "L3", "L2"]);
  });

  it("order_index của nhóm đích được đánh lại liên tục 1..n", () => {
    const r = computeDrop(base(), "L1", "U1", 3);
    const u1 = r.items.filter((i) => i.parent_id === "U1").sort((a, b) => a.order_index - b.order_index);
    expect(u1.map((i) => i.order_index)).toEqual([1, 2, 3]);
  });

  it("sang unit khác: chèn đúng khe, đổi parent_id, đánh lại thứ tự cả nhóm cũ", () => {
    const r = computeDrop(base(), "L1", "U2", 1);
    expect(order(r.items, "U2")).toEqual(["L4", "L1"]);
    expect(order(r.items, "U1")).toEqual(["L2", "L3"]);
    const l1 = r.items.find((i) => i.id === "L1")!;
    expect(l1.parent_id).toBe("U2");
    const u1 = r.items.filter((i) => i.parent_id === "U1").map((i) => i.order_index).sort();
    expect(u1).toEqual([1, 2]);
  });

  it("changed chỉ gồm các mục thực sự đổi parent_id hoặc order_index", () => {
    const r = computeDrop(base(), "L1", "U2", 1);
    expect(r.changed.map((i) => i.id).sort()).toEqual(["L1", "L2", "L3"]);
    const r2 = computeDrop(base(), "L3", "U1", 1);
    expect(r2.changed.map((i) => i.id).sort()).toEqual(["L2", "L3"]);
  });

  it("đổi thứ tự unit ở gốc: kéo U2 lên khe 0 → U2, U1; con giữ nguyên", () => {
    const r = computeDrop(base(), "U2", null, 0);
    expect(order(r.items, null)).toEqual(["U2", "U1"]);
    expect(order(r.items, "U1")).toEqual(["L1", "L2", "L3"]);
  });

  it("khe vượt quá cuối danh sách được kẹp về cuối", () => {
    expect(order(computeDrop(base(), "L1", "U1", 99).items, "U1")).toEqual(["L2", "L3", "L1"]);
  });

  it("không làm thay đổi mảng đầu vào", () => {
    const input = base();
    const snapshot = JSON.stringify(input);
    computeDrop(input, "L1", "U2", 0);
    expect(JSON.stringify(input)).toBe(snapshot);
  });

  it("id không tồn tại → noop", () => {
    const r = computeDrop(base(), "X", "U1", 0);
    expect(r.noop).toBe(true);
    expect(r.changed).toEqual([]);
  });
});
