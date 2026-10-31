// TASK-009 — Cài đặt lớp, mở/khoá mục lộ trình, tiến độ học sinh (FEAT-010 BR-L04/L05/L08/L10, TC-L05/L08).
// File do trưởng phòng viết, bị khoá.
import { describe, it, expect, vi, beforeEach } from "vitest";
import fs from "fs";
import { createFakePg } from "./helpers/pg-fake";

const h = vi.hoisted(() => {
  process.env.JWT_SECRET = "test_secret_for_vitest_only_0123456789abcdef";
  return {
    token: undefined as string | undefined,
    pg: null as null | Awaited<ReturnType<typeof import("./helpers/pg-fake").createFakePg>>,
  };
});

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (n: string) => (n === "auth_token" && h.token ? { value: h.token } : undefined),
    set: () => {},
  }),
}));
vi.mock("@/lib/db-pg", () => ({
  queryPg: (sql: string, params?: unknown[]) => h.pg!.queryPg(sql, params),
  getPgPool: () => ({
    connect: async () => ({ query: (sql: string, params?: unknown[]) => h.pg!.queryPg(sql, params), release: () => {} }),
  }),
  ensureSchema: async () => {},
}));

import { signJwtToken } from "@/lib/jwt";

type Role = "ADMIN" | "TEACHER" | "STUDENT";
async function loginAs(role: Role | null, userId?: string) {
  h.token = role ? await signJwtToken({ userId: userId!, email: `${userId}@x.vn`, role }) : undefined;
}
const req = (method: string, url: string, body?: unknown) =>
  new Request(`http://localhost${url}`, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
const ctx = (classId: string) => ({ params: Promise.resolve({ classId }) });
const rows = async (sql: string) => (await h.pg!.db.query<any>(sql)).rows;

beforeEach(async () => {
  h.token = undefined;
  h.pg = await createFakePg(["db-migration-004-enrollments-assignments.sql"]);
  await h.pg.db.exec(`
    CREATE TABLE courses (id VARCHAR(50) PRIMARY KEY, title VARCHAR(255), created_by VARCHAR(50));
    CREATE TABLE curriculum_items (
      id VARCHAR(50) PRIMARY KEY, course_id VARCHAR(50) NOT NULL, parent_id VARCHAR(50), title VARCHAR(255) NOT NULL,
      type VARCHAR(20) NOT NULL, exam_id VARCHAR(50), order_index INT DEFAULT 0, created_by VARCHAR(50),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);
  await h.pg.db.exec(fs.readFileSync("docs/db-migration-006-lessons.sql", "utf8"));
  await h.pg.db.exec(`
    INSERT INTO users (id,name,email,role) VALUES
      ('t1','GV Một','t1@x.vn','TEACHER'), ('t2','GV Hai','t2@x.vn','TEACHER'),
      ('s1','HS Một','s1@x.vn','STUDENT'), ('s2','HS Hai','s2@x.vn','STUDENT'), ('s3','HS Ba','s3@x.vn','STUDENT');
    INSERT INTO courses VALUES ('co1','Khóa t1','t1'), ('co2','Khóa t2','t2'), ('coSys','Khóa chung',NULL);
    INSERT INTO classes (id,name,code,teacher_id) VALUES ('c1','Lớp A','AAA111','t1'), ('c2','Lớp B','BBB222','t2');
    INSERT INTO enrollments (id,student_id,class_id) VALUES ('en1','s1','c1'), ('en2','s2','c1'), ('en3','s3','c2');
    INSERT INTO exams (id,title,passing_score) VALUES ('e1','Đề Unit 1',5.0);
    INSERT INTO curriculum_items (id,course_id,parent_id,title,type,exam_id,lesson_id,order_index) VALUES
      ('U1','co1',NULL,'Unit 1','UNIT',NULL,NULL,1),
      ('A','co1','U1','Bài A','LESSON',NULL,'lA',1),
      ('B','co1','U1','Đề B','EXAM','e1',NULL,2),
      ('U2','co1',NULL,'Unit 2','UNIT',NULL,NULL,2),
      ('C','co1','U2','Bài C','LESSON',NULL,'lC',1),
      ('X','co2',NULL,'Unit t2','UNIT',NULL,NULL,1);
  `);
});

// ─────────────────────────────────────────────────────────────────────────────
describe("PUT /api/teacher/classes/[classId]/settings", () => {
  const put = async (classId: string, body: unknown) =>
    (await import("@/app/api/teacher/classes/[classId]/settings/route")).PUT(req("PUT", "/x", body), ctx(classId));

  it("chưa đăng nhập 401; STUDENT 403; lớp không có 404; lớp của GV khác 403", async () => {
    expect((await put("c1", { unlock_mode: "ALL_OPEN" })).status).toBe(401);
    await loginAs("STUDENT", "s1");
    expect((await put("c1", { unlock_mode: "ALL_OPEN" })).status).toBe(403);
    await loginAs("TEACHER", "t1");
    expect((await put("cX", { unlock_mode: "ALL_OPEN" })).status).toBe(404);
    expect((await put("c2", { unlock_mode: "ALL_OPEN" })).status).toBe(403);
  });

  it("cập nhật course_id (khóa của mình hoặc khóa chung), unlock_mode, pass_percent → 200 { class }", async () => {
    await loginAs("TEACHER", "t1");
    const res = await put("c1", { course_id: "co1", unlock_mode: "SEQUENTIAL", pass_percent: 80 });
    expect(res.status).toBe(200);
    expect((await res.json()).class).toMatchObject({ id: "c1", course_id: "co1", unlock_mode: "SEQUENTIAL", pass_percent: 80 });
    expect((await put("c1", { course_id: "coSys" })).status).toBe(200);
  });

  it("chỉ cập nhật trường được gửi", async () => {
    await loginAs("TEACHER", "t1");
    await put("c1", { course_id: "co1", unlock_mode: "SEQUENTIAL", pass_percent: 80 });
    await put("c1", { pass_percent: 60 });
    expect((await rows(`SELECT course_id, unlock_mode, pass_percent FROM classes WHERE id='c1'`))[0]).toEqual({ course_id: "co1", unlock_mode: "SEQUENTIAL", pass_percent: 60 });
  });

  it("giá trị sai → 400, không ghi", async () => {
    await loginAs("TEACHER", "t1");
    for (const body of [{ unlock_mode: "RANDOM" }, { pass_percent: 0 }, { pass_percent: 101 }, { pass_percent: 50.5 }, { course_id: "coX" }, { course_id: "co2" }]) {
      expect((await put("c1", body)).status, JSON.stringify(body)).toBe(400);
    }
    expect((await rows(`SELECT course_id, unlock_mode, pass_percent FROM classes WHERE id='c1'`))[0]).toEqual({ course_id: null, unlock_mode: "MANUAL", pass_percent: 70 });
  });

  it("ADMIN sửa được mọi lớp", async () => {
    await loginAs("ADMIN", "a1");
    expect((await put("c2", { unlock_mode: "ALL_OPEN" })).status).toBe(200);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe("/api/teacher/classes/[classId]/unlocks", () => {
  const api = () => import("@/app/api/teacher/classes/[classId]/unlocks/route");
  beforeEach(async () => { await h.pg!.db.exec(`UPDATE classes SET course_id='co1' WHERE id='c1'`); });

  it("mở unit cho cả lớp kèm hạn → 201; mở lại cùng mục thì cập nhật hạn, không tạo trùng", async () => {
    await loginAs("TEACHER", "t1");
    const { POST } = await api();
    const res = await POST(req("POST", "/x", { curriculum_item_id: "U1", due_date: "2026-11-10T00:00:00Z" }), ctx("c1"));
    expect(res.status).toBe(201);
    expect((await res.json()).unlock).toMatchObject({ class_id: "c1", curriculum_item_id: "U1", student_id: null, unlocked_by: "t1" });
    await POST(req("POST", "/x", { curriculum_item_id: "U1", due_date: "2026-11-20T00:00:00Z" }), ctx("c1"));
    const all = await rows(`SELECT due_date FROM class_unlocks WHERE class_id='c1' AND curriculum_item_id='U1'`);
    expect(all).toHaveLength(1);
    expect(new Date(all[0].due_date).toISOString()).toBe("2026-11-20T00:00:00.000Z");
  });

  it("mở riêng cho một học sinh đã ghi danh → 201; học sinh không thuộc lớp → 400", async () => {
    await loginAs("TEACHER", "t1");
    const { POST } = await api();
    expect((await POST(req("POST", "/x", { curriculum_item_id: "C", student_id: "s2" }), ctx("c1"))).status).toBe(201);
    expect((await POST(req("POST", "/x", { curriculum_item_id: "C", student_id: "s3" }), ctx("c1"))).status).toBe(400);
  });

  it("mục không thuộc khóa của lớp / lớp chưa gắn khóa → 400", async () => {
    await loginAs("TEACHER", "t1");
    const { POST } = await api();
    expect((await POST(req("POST", "/x", { curriculum_item_id: "X" }), ctx("c1"))).status).toBe(400);
    await h.pg!.db.exec(`UPDATE classes SET course_id=NULL WHERE id='c1'`);
    expect((await POST(req("POST", "/x", { curriculum_item_id: "U1" }), ctx("c1"))).status).toBe(400);
  });

  it("DELETE khoá lại (cả lớp hoặc riêng học sinh) → 200 { deleted }", async () => {
    await loginAs("TEACHER", "t1");
    const { POST, DELETE } = await api();
    await POST(req("POST", "/x", { curriculum_item_id: "U1" }), ctx("c1"));
    await POST(req("POST", "/x", { curriculum_item_id: "U1", student_id: "s1" }), ctx("c1"));
    const res = await DELETE(req("DELETE", "/x?curriculum_item_id=U1&student_id=s1"), ctx("c1"));
    expect(res.status).toBe(200);
    expect((await res.json()).deleted).toBe(1);
    expect(await rows(`SELECT student_id FROM class_unlocks`)).toEqual([{ student_id: null }]);
    await DELETE(req("DELETE", "/x?curriculum_item_id=U1"), ctx("c1"));
    expect(await rows(`SELECT * FROM class_unlocks`)).toEqual([]);
  });

  it("GV khác → 403; STUDENT → 403", async () => {
    const { POST } = await api();
    await loginAs("TEACHER", "t2");
    expect((await POST(req("POST", "/x", { curriculum_item_id: "U1" }), ctx("c1"))).status).toBe(403);
    await loginAs("STUDENT", "s1");
    expect((await POST(req("POST", "/x", { curriculum_item_id: "U1" }), ctx("c1"))).status).toBe(403);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe("GET /api/teacher/classes/[classId]/roadmap", () => {
  const get = async (classId: string) =>
    (await import("@/app/api/teacher/classes/[classId]/roadmap/route")).GET(req("GET", "/x"), ctx(classId));

  it("lớp chưa gắn khóa → items rỗng", async () => {
    await loginAs("TEACHER", "t1");
    const json = await (await get("c1")).json();
    expect(json).toMatchObject({ success: true, items: [], unlocks: [] });
    expect(json.class).toMatchObject({ id: "c1", unlock_mode: "MANUAL", pass_percent: 70, course_id: null });
  });

  it("trả mục của khóa theo thứ tự học + các dòng mở", async () => {
    await h.pg!.db.exec(`UPDATE classes SET course_id='co1' WHERE id='c1';
      INSERT INTO class_unlocks (class_id,curriculum_item_id,unlocked_by) VALUES ('c1','U1','t1');`);
    await loginAs("TEACHER", "t1");
    const json = await (await get("c1")).json();
    expect(json.items.map((i: any) => i.id)).toEqual(["U1", "A", "B", "U2", "C"]);
    expect(json.items[1]).toMatchObject({ type: "LESSON", lesson_id: "lA", parent_id: "U1" });
    expect(json.unlocks).toEqual([expect.objectContaining({ curriculum_item_id: "U1", student_id: null })]);
  });

  it("GV khác → 403", async () => {
    await loginAs("TEACHER", "t2");
    expect((await get("c1")).status).toBe(403);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe("GET /api/teacher/classes/[classId]/progress — điểm cao nhất & hoàn thành (BR-L04, BR-L10)", () => {
  const get = async () =>
    (await import("@/app/api/teacher/classes/[classId]/progress/route")).GET(req("GET", "/x"), ctx("c1"));

  beforeEach(async () => {
    await h.pg!.db.exec(`
      UPDATE classes SET course_id='co1', pass_percent=70 WHERE id='c1';
      INSERT INTO lesson_attempts (id,lesson_id,class_id,student_id,score_percent,status) VALUES
        ('at1','lA','c1','s1',55,'GRADED'), ('at2','lA','c1','s1',85,'GRADED'),
        ('at3','lA','c1','s2',95,'GRADING'),
        ('at4','lC','c1','s2',70,'AI_SKIPPED'),
        ('at5','lA','c2','s1',100,'GRADED');
      INSERT INTO submissions (id,exam_id,student_id,answers,final_score) VALUES
        ('sb1','e1','s1','{}',6.0), ('sb2','e1','s2','{}',4.0);
    `);
  });

  it("học sinh đã ghi danh × mục học (không có unit); ô có best_percent, attempts, completed", async () => {
    await loginAs("TEACHER", "t1");
    const res = await get();
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.students.map((s: any) => s.id).sort()).toEqual(["s1", "s2"]);
    expect(json.items.map((i: any) => i.id)).toEqual(["A", "B", "C"]);
    expect(json.cells.s1.A).toEqual({ best_percent: 85, attempts: 2, completed: true });
    expect(json.cells.s2.A).toEqual({ best_percent: null, attempts: 1, completed: false }); // lần GRADING chưa tính điểm
    expect(json.cells.s2.C).toEqual({ best_percent: 70, attempts: 1, completed: true });   // AI_SKIPPED vẫn tính, 70 ≥ 70
    expect(json.cells.s1.B.completed).toBe(true);   // đề: 6.0 ≥ passing_score 5.0
    expect(json.cells.s2.B.completed).toBe(false);  // 4.0 < 5.0
    expect(json.cells.s1.C).toEqual({ best_percent: null, attempts: 0, completed: false });
  });

  it("lần làm ở lớp khác không được tính", async () => {
    await h.pg!.db.exec(`DELETE FROM lesson_attempts WHERE class_id='c1'`);
    await loginAs("TEACHER", "t1");
    const json = await (await get()).json();
    expect(json.cells.s1.A).toEqual({ best_percent: null, attempts: 0, completed: false });
  });

  it("đề không có passing_score → chỉ cần có bài nộp", async () => {
    await h.pg!.db.exec(`UPDATE exams SET passing_score=NULL WHERE id='e1'`);
    await loginAs("TEACHER", "t1");
    const json = await (await get()).json();
    expect(json.cells.s2.B.completed).toBe(true);
  });

  it("GV khác → 403", async () => {
    await loginAs("TEACHER", "t2");
    expect((await get()).status).toBe(403);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe("lib/roadmap-data.ts — dùng chung cho API học sinh (TASK-012: API học sinh)", () => {
  it("loadCompletedItemIds trả các mục học đã hoàn thành của một học sinh trong lớp", async () => {
    await h.pg!.db.exec(`
      UPDATE classes SET course_id='co1', pass_percent=70 WHERE id='c1';
      INSERT INTO lesson_attempts (id,lesson_id,class_id,student_id,score_percent,status) VALUES ('a1','lA','c1','s1',90,'GRADED');
      INSERT INTO submissions (id,exam_id,student_id,answers,final_score) VALUES ('sb1','e1','s1','{}',6.0);
    `);
    const { loadCompletedItemIds } = await import("@/lib/roadmap-data");
    const done = await loadCompletedItemIds("c1", "s1");
    expect([...done].sort()).toEqual(["A", "B"]);
  });
});
