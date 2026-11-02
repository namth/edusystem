// TASK-009 — Tính trạng thái mục lộ trình cho học sinh (FEAT-010 BR-L04, BR-L05, TC-L05) — lib/roadmap.ts (hàm thuần).
// File do trưởng phòng viết, bị khoá.
import { describe, it, expect } from "vitest";
import { computeRoadmapStates, computeProgressPercent, flattenRoadmap, type RoadmapItem, type UnlockRow } from "@/lib/roadmap";

// U1(1): A(1) LESSON, B(2) EXAM ; R(2) LESSON ở gốc ; U2(3): C(1) LESSON, D(2) LESSON ; U3(4) rỗng
const items: RoadmapItem[] = [
  { id: "U2", parent_id: null, type: "UNIT", order_index: 3 },
  { id: "C", parent_id: "U2", type: "LESSON", order_index: 1, lesson_id: "l3" },
  { id: "U1", parent_id: null, type: "UNIT", order_index: 1 },
  { id: "B", parent_id: "U1", type: "EXAM", order_index: 2, exam_id: "e1" },
  { id: "A", parent_id: "U1", type: "LESSON", order_index: 1, lesson_id: "l1" },
  { id: "R", parent_id: null, type: "LESSON", order_index: 2, lesson_id: "l2" },
  { id: "D", parent_id: "U2", type: "LESSON", order_index: 2, lesson_id: "l4" },
  { id: "U3", parent_id: null, type: "UNIT", order_index: 4 },
];
const run = (mode: "MANUAL" | "ALL_OPEN" | "SEQUENTIAL", opts: { unlocks?: UnlockRow[]; completed?: string[]; studentId?: string } = {}) =>
  computeRoadmapStates({
    items,
    mode,
    unlocks: opts.unlocks ?? [],
    completedItemIds: new Set(opts.completed ?? []),
    studentId: opts.studentId ?? "s1",
  });
const states = (r: ReturnType<typeof run>, ids: string[]) => ids.map((id) => r[id].state);

describe("flattenRoadmap — thứ tự học", () => {
  it("unit và mục gốc theo order_index, mục con theo order_index; unit nằm trước con của nó", () => {
    expect(flattenRoadmap(items).map((i) => i.id)).toEqual(["U1", "A", "B", "R", "U2", "C", "D", "U3"]);
  });
});

describe("ALL_OPEN", () => {
  it("mọi mục học OPEN, mục đã hoàn thành là COMPLETED", () => {
    const r = run("ALL_OPEN", { completed: ["A"] });
    expect(states(r, ["A", "B", "R", "C", "D"])).toEqual(["COMPLETED", "OPEN", "OPEN", "OPEN", "OPEN"]);
  });
});

describe("MANUAL", () => {
  it("không có dòng mở nào → mọi mục LOCKED", () => {
    expect(states(run("MANUAL"), ["A", "B", "R", "C", "D"])).toEqual(["LOCKED", "LOCKED", "LOCKED", "LOCKED", "LOCKED"]);
  });
  it("mở unit = mở mọi mục con; mở từng mục; kèm hạn", () => {
    const r = run("MANUAL", {
      unlocks: [
        { curriculum_item_id: "U1", student_id: null, due_date: "2026-11-10T00:00:00Z" },
        { curriculum_item_id: "C", student_id: null, due_date: null },
      ],
    });
    expect(states(r, ["A", "B", "R", "C", "D"])).toEqual(["OPEN", "OPEN", "LOCKED", "OPEN", "LOCKED"]);
    expect(r.A.due_date).toBe("2026-11-10T00:00:00Z");
    expect(r.C.due_date).toBeNull();
  });
  it("hạn riêng của mục ưu tiên hơn hạn của unit; dòng riêng học sinh ưu tiên hơn dòng cả lớp", () => {
    const r = run("MANUAL", {
      unlocks: [
        { curriculum_item_id: "U1", student_id: null, due_date: "2026-11-10T00:00:00Z" },
        { curriculum_item_id: "A", student_id: null, due_date: "2026-11-05T00:00:00Z" },
        { curriculum_item_id: "A", student_id: "s1", due_date: "2026-11-20T00:00:00Z" },
      ],
    });
    expect(r.A.due_date).toBe("2026-11-20T00:00:00Z");
    expect(r.B.due_date).toBe("2026-11-10T00:00:00Z");
  });
  it("dòng mở riêng học sinh khác không ảnh hưởng", () => {
    const r = run("MANUAL", { unlocks: [{ curriculum_item_id: "R", student_id: "s2", due_date: null }] });
    expect(r.R.state).toBe("LOCKED");
  });
  it("đã hoàn thành vẫn hiện COMPLETED dù sau đó bị khoá", () => {
    expect(run("MANUAL", { completed: ["D"] }).D.state).toBe("COMPLETED");
  });
});

describe("SEQUENTIAL", () => {
  it("chưa làm gì → chỉ mục học đầu tiên OPEN", () => {
    expect(states(run("SEQUENTIAL"), ["A", "B", "R", "C", "D"])).toEqual(["OPEN", "LOCKED", "LOCKED", "LOCKED", "LOCKED"]);
  });
  it("hoàn thành A, B → R mở, sau đó khoá", () => {
    expect(states(run("SEQUENTIAL", { completed: ["A", "B"] }), ["A", "B", "R", "C", "D"])).toEqual(["COMPLETED", "COMPLETED", "OPEN", "LOCKED", "LOCKED"]);
  });
  it("mục chưa hoàn thành chặn mọi mục sau dù mục sau đã hoàn thành trước đó", () => {
    expect(states(run("SEQUENTIAL", { completed: ["A", "C"] }), ["A", "B", "R", "C", "D"])).toEqual(["COMPLETED", "OPEN", "LOCKED", "COMPLETED", "LOCKED"]);
  });
  it("dòng mở riêng cho học sinh là ngoại lệ (mở unit cũng được); dòng cả lớp bị bỏ qua (BR-L05)", () => {
    const r = run("SEQUENTIAL", {
      unlocks: [
        { curriculum_item_id: "U2", student_id: "s1", due_date: null },
        { curriculum_item_id: "R", student_id: null, due_date: null },
      ],
    });
    expect(states(r, ["A", "B", "R", "C", "D"])).toEqual(["OPEN", "LOCKED", "LOCKED", "OPEN", "OPEN"]);
  });
  it("hoàn thành hết → mọi mục COMPLETED", () => {
    expect(states(run("SEQUENTIAL", { completed: ["A", "B", "R", "C", "D"] }), ["A", "B", "R", "C", "D"]).every((s) => s === "COMPLETED")).toBe(true);
  });
});

describe("Trạng thái unit (suy ra từ mục con, không tính là mục học)", () => {
  it("COMPLETED khi mọi con hoàn thành; OPEN khi có con mở/hoàn thành; LOCKED khi mọi con khoá; unit rỗng LOCKED", () => {
    const r = run("SEQUENTIAL", { completed: ["A", "B"] });
    expect(r.U1.state).toBe("COMPLETED");
    expect(r.U2.state).toBe("LOCKED");
    expect(r.U3.state).toBe("LOCKED");
    expect(run("SEQUENTIAL").U1.state).toBe("OPEN");
  });
});

describe("computeProgressPercent", () => {
  it("số mục học hoàn thành / tổng mục học × 100, làm tròn số nguyên; không có mục học → 0", () => {
    expect(computeProgressPercent(run("ALL_OPEN", { completed: ["A", "B"] }), items)).toBe(40);
    expect(computeProgressPercent(run("ALL_OPEN", { completed: ["A"] }), items)).toBe(20);
    expect(computeProgressPercent({}, [{ id: "U9", parent_id: null, type: "UNIT", order_index: 1 }])).toBe(0);
  });
});
