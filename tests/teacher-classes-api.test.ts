// TASK-023 — Lớp học của giáo viên qua API pg: danh sách/tạo/sửa/xoá lớp, thành viên, giao đề, thêm học sinh.
// Gỡ Supabase trình duyệt khỏi trang lớp học & tạo tài khoản học sinh. File do trưởng phòng viết, bị khoá.
import { describe, it, expect, vi, beforeEach } from "vitest";
import fs from "fs";
import { createFakePg } from "./helpers/pg-fake";

const h = vi.hoisted(() => {
  process.env.JWT_SECRET = "test_secret_for_vitest_only_0123456789abcdef";
  return { token: undefined as string | undefined, pg: null as any };
});
vi.mock("next/headers", () => ({
  cookies: async () => ({ get: (n: string) => (n === "auth_token" && h.token ? { value: h.token } : undefined), set: () => {} }),
}));
vi.mock("@/lib/db-pg", () => ({
  queryPg: (sql: string, params?: unknown[]) => h.pg.queryPg(sql, params),
  getPgPool: () => ({ connect: async () => ({ query: (s: string, p?: unknown[]) => h.pg.queryPg(s, p), release: () => {} }) }),
  ensureSchema: async () => {},
}));
vi.mock("@/lib/neo4j", () => ({ syncTeacherManagesClass: async () => {}, syncStudentEnrolledInClass: async () => {}, runCypherQuery: async () => [] }));

import { signJwtToken } from "@/lib/jwt";
async function loginAs(role: "ADMIN" | "TEACHER" | "STUDENT" | null, userId?: string) {
  h.token = role ? await signJwtToken({ userId: userId!, email: `${userId}@x.vn`, role }) : undefined;
}
const req = (method: string, url: string, body?: unknown) =>
  new Request(`http://localhost${url}`, { method, headers: { "Content-Type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) });
const ctx = (classId: string) => ({ params: Promise.resolve({ classId }) });
const rows = async (sql: string) => (await h.pg.db.query(sql)).rows;
const list = () => import("@/app/api/teacher/classes/route");
const one = () => import("@/app/api/teacher/classes/[classId]/route");

beforeEach(async () => {
  h.token = undefined;
  h.pg = await createFakePg(["db-migration-004-enrollments-assignments.sql"]);
  await h.pg.db.exec(`
    ALTER TABLE users ADD COLUMN must_change_password BOOLEAN DEFAULT FALSE;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS slot_limit INT DEFAULT 250;   -- DEC-031: ghi danh kiểm slot học sinh
    ALTER TABLE submissions ADD COLUMN IF NOT EXISTS class_ref VARCHAR(50);
    CREATE TABLE courses (id VARCHAR(50) PRIMARY KEY, title VARCHAR(255), created_by VARCHAR(50));
    CREATE TABLE class_unlocks (class_id VARCHAR(50), curriculum_item_id VARCHAR(50), student_id VARCHAR(50), unlocked_by VARCHAR(50));
    INSERT INTO users (id,name,email,role,password) VALUES ('t1','GV1','t1@x.vn','TEACHER','x'), ('t2','GV2','t2@x.vn','TEACHER','x'),
      ('s1','HS1','s1@x.vn','STUDENT','x'), ('s9','Có sẵn','old@x.vn','STUDENT','x');
    -- FEAT-015: ghi danh trừ ví slot của GV đã xác minh
    UPDATE users SET teacher_status='VERIFIED', slot_balance=10 WHERE role='TEACHER';
    INSERT INTO classes (id,name,code,teacher_id,max_slots) VALUES ('c1','Lớp t1','AAA111','t1',2), ('c2','Lớp t2','BBB222','t2',30);
    INSERT INTO enrollments (id,student_id,class_id) VALUES ('en1','s1','c1');
    INSERT INTO exams (id,title,created_by) VALUES ('e1','Đề t1','t1'), ('e2','Đề t2','t2'), ('e0','Đề chung',NULL);
    INSERT INTO submissions (id,exam_id,student_id,answers,status,created_at,class_ref) VALUES ('sb1','e1','s1','{}','GRADED','2026-10-01','c1');
  `);
});

describe("Phân quyền", () => {
  it("chưa đăng nhập 401; STUDENT 403; lớp của GV khác 403 (GET chi tiết, PUT, DELETE, thành viên, giao đề, thêm HS)", async () => {
    const { GET } = await list();
    expect((await GET(req("GET", "/x"))).status).toBe(401);
    await loginAs("STUDENT", "s1");
    expect((await GET(req("GET", "/x"))).status).toBe(403);
    await loginAs("TEACHER", "t1");
    const o = await one();
    expect((await o.PUT(req("PUT", "/x", { name: "x" }), ctx("c2"))).status).toBe(403);
    expect((await o.DELETE(req("DELETE", "/x"), ctx("c2"))).status).toBe(403);
    expect((await (await import("@/app/api/teacher/classes/[classId]/members/route")).GET(req("GET", "/x"), ctx("c2"))).status).toBe(403);
    expect((await (await import("@/app/api/teacher/classes/[classId]/assignments/route")).POST(req("POST", "/x", { exam_id: "e1" }), ctx("c2"))).status).toBe(403);
    expect((await (await import("@/app/api/teacher/classes/[classId]/students/route")).POST(req("POST", "/x", { name: "a", email: "a@x.vn" }), ctx("c2"))).status).toBe(403);
    expect((await o.PUT(req("PUT", "/x", { name: "x" }), ctx("cX"))).status).toBe(404);
  });
});

describe("Danh sách & tạo/sửa/xoá lớp", () => {
  it("GET: TEACHER chỉ lớp của mình kèm student_count; ADMIN tất cả", async () => {
    await loginAs("TEACHER", "t1");
    const json = await (await (await list()).GET(req("GET", "/x"))).json();
    expect(json.classes.map((c: any) => c.id)).toEqual(["c1"]);
    expect(json.classes[0]).toMatchObject({ name: "Lớp t1", code: "AAA111", student_count: 1, max_slots: 2 });
    await loginAs("ADMIN", "a1");
    expect((await (await (await list()).GET(req("GET", "/x"))).json()).classes).toHaveLength(2);
  });

  it("POST: 201, id 'cls_' + uuid, mã lớp 6 ký tự A-Z0-9 không trùng, teacher_id = người gọi; dữ liệu sai → 400", async () => {
    await loginAs("TEACHER", "t1");
    const { POST } = await list();
    const res = await POST(req("POST", "/x", { name: " Lớp mới ", schedule: "T2-T4", max_slots: 25 }));
    expect(res.status).toBe(201);
    const { class: c } = await res.json();
    expect(c.id).toMatch(/^cls_[0-9a-f-]{36}$/);
    expect(c.code).toMatch(/^[A-Z0-9]{6}$/);
    expect(c).toMatchObject({ name: "Lớp mới", schedule: "T2-T4", max_slots: 25, teacher_id: "t1" });
    for (const b of [{ name: " " }, { name: "x", max_slots: 0 }, { name: "x", max_slots: 1000 }]) expect((await POST(req("POST", "/x", b))).status).toBe(400);
  });

  it("PUT chỉ cập nhật trường gửi lên; DELETE xoá lớp + ghi danh + giao đề", async () => {
    await loginAs("TEACHER", "t1");
    const o = await one();
    expect((await o.PUT(req("PUT", "/x", { schedule: "Tối T7" }), ctx("c1"))).status).toBe(200);
    expect((await rows(`SELECT name, schedule FROM classes WHERE id='c1'`))[0]).toEqual({ name: "Lớp t1", schedule: "Tối T7" });
    await h.pg.db.exec(`INSERT INTO class_assignments (id,class_id,exam_id) VALUES ('as9','c1','e1')`);
    expect((await o.DELETE(req("DELETE", "/x"), ctx("c1"))).status).toBe(200);
    expect(await rows(`SELECT id FROM classes WHERE id='c1'`)).toEqual([]);
    expect(await rows(`SELECT id FROM enrollments WHERE class_id='c1'`)).toEqual([]);
    expect(await rows(`SELECT id FROM class_assignments WHERE class_id='c1'`)).toEqual([]);
  });
});

describe("Thành viên & giao đề", () => {
  it("GET members: học sinh (không mật khẩu) + số bài nộp; bài đã giao kèm tên đề", async () => {
    await h.pg.db.exec(`INSERT INTO class_assignments (id,class_id,exam_id,max_attempts) VALUES ('as1','c1','e1',2)`);
    await loginAs("TEACHER", "t1");
    const json = await (await (await import("@/app/api/teacher/classes/[classId]/members/route")).GET(req("GET", "/x"), ctx("c1"))).json();
    expect(json.students).toEqual([expect.objectContaining({ id: "s1", name: "HS1", submission_count: 1 })]);
    expect(JSON.stringify(json)).not.toContain('"password"');
    expect(json.assignments).toEqual([expect.objectContaining({ id: "as1", exam_id: "e1", exam_title: "Đề t1", max_attempts: 2 })]);
  });

  it("POST assignments: đề của mình hoặc đề chung → 201; đề của GV khác → 400; giao trùng → 409; DELETE gỡ", async () => {
    await loginAs("TEACHER", "t1");
    const api = await import("@/app/api/teacher/classes/[classId]/assignments/route");
    const res = await api.POST(req("POST", "/x", { exam_id: "e1", due_date: "2026-12-01T00:00:00Z", max_attempts: 3 }), ctx("c1"));
    expect(res.status).toBe(201);
    const { assignment } = await res.json();
    expect(assignment).toMatchObject({ class_id: "c1", exam_id: "e1", max_attempts: 3 });
    expect((await api.POST(req("POST", "/x", { exam_id: "e0" }), ctx("c1"))).status).toBe(201);
    expect((await api.POST(req("POST", "/x", { exam_id: "e2" }), ctx("c1"))).status).toBe(400);
    expect((await api.POST(req("POST", "/x", { exam_id: "e1" }), ctx("c1"))).status).toBe(409);
    expect((await api.DELETE(req("DELETE", `/x?id=${assignment.id}`), ctx("c1"))).status).toBe(200);
    expect(await rows(`SELECT id FROM class_assignments WHERE id='${assignment.id}'`)).toEqual([]);
  });
});

describe("POST students — thêm học sinh vào lớp", () => {
  const add = async (classId: string, body: unknown) =>
    (await import("@/app/api/teacher/classes/[classId]/students/route")).POST(req("POST", "/x", body), ctx(classId));

  it("email mới: tạo tài khoản STUDENT (mật khẩu băm, phải đổi lần đầu), trả mật khẩu tạm 1 lần, ghi danh", async () => {
    await loginAs("TEACHER", "t1");
    const res = await add("c1", { name: "Học sinh mới", email: "New@X.vn", phone: "0901" });
    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json).toMatchObject({ already_existed: false });
    expect(typeof json.temp_password).toBe("string");
    expect(json.temp_password.length).toBeGreaterThanOrEqual(8);
    const u = (await rows(`SELECT id, role, email, password, must_change_password FROM users WHERE email='new@x.vn'`))[0];
    expect(u).toMatchObject({ role: "STUDENT", must_change_password: true });
    expect(u.password).toMatch(/^[0-9a-f]+:[0-9a-f]+$/);
    expect(u.password).not.toContain(json.temp_password);
    expect(await rows(`SELECT id FROM enrollments WHERE class_id='c1' AND student_id='${u.id}'`)).toHaveLength(1);
  });

  it("email học sinh có sẵn → chỉ ghi danh, không trả mật khẩu; email của GV → 409; lớp đầy → 409; thiếu tên/email sai → 400", async () => {
    await loginAs("TEACHER", "t1");
    const r = await add("c1", { name: "x", email: "old@x.vn" });
    expect(r.status).toBe(200);
    const j = await r.json();
    expect(j.already_existed).toBe(true);
    expect(j.temp_password).toBeUndefined();
    expect((await add("c1", { name: "x", email: "t2@x.vn" })).status).toBe(409);
    expect((await add("c1", { name: "y", email: "full@x.vn" })).status).toBe(409);   // max_slots = 2 đã đủ (s1, s9)
    expect((await add("c1", { name: "", email: "z@x.vn" })).status).toBe(400);
    expect((await add("c1", { name: "z", email: "khong-hop-le" })).status).toBe(400);
  });
});

describe("Trang không còn Supabase trình duyệt", () => {
  for (const p of ["app/teacher/classes/page.tsx", "app/teacher/classes/[classId]/page.tsx", "app/teacher/students/create/page.tsx"]) {
    it(p, () => {
      const s = fs.readFileSync(p, "utf8");
      expect(s).not.toContain('"@/lib/supabase"');
      expect(s).not.toContain("supabase.");
      expect(s).toContain("/api/teacher/classes");
    });
  }
});
