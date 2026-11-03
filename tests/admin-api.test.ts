// TASK-017 — Khu admin chuyển sang API pg: người dùng, lớp, duyệt đơn mua slot. Gỡ Supabase trình duyệt khỏi trang admin.
// File do trưởng phòng viết, bị khoá.
import { describe, it, expect, vi, beforeEach } from "vitest";
import fs from "fs";
import { createFakePg } from "./helpers/pg-fake";

const h = vi.hoisted(() => {
  process.env.JWT_SECRET = "test_secret_for_vitest_only_0123456789abcdef";
  return { token: undefined as string | undefined, pg: null as any };
});

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (n: string) => (n === "auth_token" && h.token ? { value: h.token } : undefined),
    set: () => {},
  }),
}));
vi.mock("@/lib/db-pg", () => ({
  queryPg: (sql: string, params?: unknown[]) => h.pg.queryPg(sql, params),
  getPgPool: () => ({
    connect: async () => ({ query: (sql: string, params?: unknown[]) => h.pg.queryPg(sql, params), release: () => {} }),
  }),
  ensureSchema: async () => {},
}));
vi.mock("@/lib/neo4j", () => ({
  syncStudentEnrolledInClass: async () => {},
  runCypherQuery: async () => [],
}));

import { signJwtToken } from "@/lib/jwt";

async function loginAs(role: "ADMIN" | "TEACHER" | "STUDENT" | null, userId?: string) {
  h.token = role ? await signJwtToken({ userId: userId!, email: `${userId}@x.vn`, role }) : undefined;
}
const req = (method: string, url: string, body?: unknown) =>
  new Request(`http://localhost${url}`, { method, headers: { "Content-Type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) });
const ctx = (id: string) => ({ params: Promise.resolve({ id }) });
const rows = async (sql: string) => (await h.pg.db.query(sql)).rows;

beforeEach(async () => {
  h.token = undefined;
  h.pg = await createFakePg(["db-migration-004-enrollments-assignments.sql"]);
  await h.pg.db.exec(`
    ALTER TABLE users ADD COLUMN slot_limit INT DEFAULT 250;
    ALTER TABLE users ADD COLUMN reset_token VARCHAR(255);
    CREATE TABLE slot_requests (id VARCHAR(50) PRIMARY KEY, teacher_id VARCHAR(50), teacher_name VARCHAR(100), teacher_email VARCHAR(100),
      requested_slots INT NOT NULL, total_cost NUMERIC(12,2) NOT NULL, status VARCHAR(20) DEFAULT 'PENDING', created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP);
    INSERT INTO users (id,name,email,role,phone,password,slot_limit,reset_token) VALUES
      ('a1','Admin','a1@x.vn','ADMIN',NULL,'salt:hash',0,NULL),
      ('t1','Cô Lan','lan@x.vn','TEACHER','0901','salt:hash',10,'tok'),
      ('s1','Nguyễn An','an@x.vn','STUDENT','0902','salt:hash',0,NULL),
      ('s2','Trần Bình','binh@x.vn','STUDENT',NULL,'salt:hash',0,NULL);
    INSERT INTO classes (id,name,code,teacher_id) VALUES ('c1','Lớp A','AAA','t1'), ('c2','Lớp B','BBB','t1');
    INSERT INTO enrollments (id,student_id,class_id) VALUES ('e1','s1','c1');
    INSERT INTO submissions (id,exam_id,student_id,answers,final_score,created_at) VALUES
      ('sb1','ex1','s1','{}',6.5,'2026-10-01'), ('sb2','ex1','s1','{}',7.0,'2026-10-02');
    INSERT INTO slot_requests (id,teacher_id,teacher_name,teacher_email,requested_slots,total_cost,status) VALUES
      ('r1','t1','Cô Lan','lan@x.vn',50,500000,'PENDING'), ('r2','t1','Cô Lan','lan@x.vn',20,200000,'APPROVED');
  `);
  // FEAT-013 (TASK-041): đơn hàng mở rộng slot_requests; route cũ đi qua lib/slot-orders
  await h.pg.db.exec(fs.readFileSync("docs/db-migration-005-system-settings.sql", "utf8"));
  await h.pg.db.exec(fs.readFileSync("docs/db-migration-010-notifications.sql", "utf8"));
  await h.pg.db.exec(fs.readFileSync("docs/db-migration-016-slot-orders.sql", "utf8"));
});

const users = () => import("@/app/api/admin/users/route");
const user = () => import("@/app/api/admin/users/[id]/route");

describe("Chỉ ADMIN", () => {
  it("chưa đăng nhập 401; TEACHER/STUDENT 403 cho mọi route admin mới", async () => {
    const calls = async () => [
      await (await users()).GET(req("GET", "/x")),
      await (await user()).GET(req("GET", "/x"), ctx("s1")),
      await (await user()).PUT(req("PUT", "/x", { name: "x" }), ctx("s1")),
      await (await import("@/app/api/admin/classes/route")).GET(req("GET", "/x")),
      await (await import("@/app/api/admin/requests/route")).GET(req("GET", "/x")),
      await (await import("@/app/api/admin/requests/[id]/route")).PUT(req("PUT", "/x", { action: "APPROVE" }), ctx("r1")),
    ];
    for (const r of await calls()) expect(r.status).toBe(401);
    await loginAs("TEACHER", "t1");
    for (const r of await calls()) expect(r.status).toBe(403);
    await loginAs("STUDENT", "s1");
    for (const r of await calls()) expect(r.status).toBe(403);
  });
});

describe("GET /api/admin/users", () => {
  it("lọc theo role và q (tên/email, không phân biệt hoa thường); KHÔNG trả password/reset_token", async () => {
    await loginAs("ADMIN", "a1");
    const { GET } = await users();
    const st = (await (await GET(req("GET", "/x?role=STUDENT"))).json()).users;
    expect(st.map((u: any) => u.id).sort()).toEqual(["s1", "s2"]);
    const s1 = st.find((u: any) => u.id === "s1");
    expect(s1).toMatchObject({ name: "Nguyễn An", email: "an@x.vn", class_ids: ["c1"], submission_count: 2, latest_score: 7 });
    expect(st.find((u: any) => u.id === "s2")).toMatchObject({ class_ids: [], submission_count: 0, latest_score: null });
    const text = JSON.stringify(await (await GET(req("GET", "/x"))).json());
    expect(text).not.toContain("salt:hash");
    expect(text).not.toContain('"password"');
    expect(text).not.toContain("reset_token");
    const q = (await (await GET(req("GET", "/x?q=B%C3%8CNH"))).json()).users;
    expect(q.map((u: any) => u.id)).toEqual(["s2"]);
  });

  it("role không hợp lệ → 400", async () => {
    await loginAs("ADMIN", "a1");
    expect((await (await users()).GET(req("GET", "/x?role=HACKER"))).status).toBe(400);
  });
});

describe("GET/PUT /api/admin/users/[id]", () => {
  it("GET: user (không mật khẩu) + lớp đã ghi danh + bài nộp mới nhất trước; không có → 404", async () => {
    await loginAs("ADMIN", "a1");
    const { GET } = await user();
    const json = await (await GET(req("GET", "/x"), ctx("s1"))).json();
    expect(json.user).toMatchObject({ id: "s1", name: "Nguyễn An" });
    expect(json.user).not.toHaveProperty("password");
    expect(json.classes.map((c: any) => c.id)).toEqual(["c1"]);
    expect(json.submissions.map((s: any) => s.id)).toEqual(["sb2", "sb1"]);
    expect((await GET(req("GET", "/x"), ctx("zz"))).status).toBe(404);
  });

  it("PUT: sửa thông tin + thay danh sách lớp của học sinh", async () => {
    await loginAs("ADMIN", "a1");
    const { PUT } = await user();
    const res = await PUT(req("PUT", "/x", { name: "An Mới", phone: "0999", status: "INACTIVE", class_ids: ["c2"] }), ctx("s1"));
    expect(res.status).toBe(200);
    expect((await rows(`SELECT name, phone, status FROM users WHERE id='s1'`))[0]).toEqual({ name: "An Mới", phone: "0999", status: "INACTIVE" });
    expect((await rows(`SELECT class_id FROM enrollments WHERE student_id='s1'`)).map((r: any) => r.class_id)).toEqual(["c2"]);
  });

  it("PUT dữ liệu sai → 400 không ghi: status lạ, tên rỗng, lớp không tồn tại, gán lớp cho không phải học sinh; không cho đổi role/password", async () => {
    await loginAs("ADMIN", "a1");
    const { PUT } = await user();
    for (const [id, body] of [["s1", { status: "BANNED" }], ["s1", { name: " " }], ["s1", { class_ids: ["cX"] }], ["t1", { class_ids: ["c1"] }]] as const) {
      expect((await PUT(req("PUT", "/x", body), ctx(id))).status, JSON.stringify(body)).toBe(400);
    }
    await PUT(req("PUT", "/x", { role: "ADMIN", password: "x" }), ctx("s1"));
    expect((await rows(`SELECT role, password FROM users WHERE id='s1'`))[0]).toEqual({ role: "STUDENT", password: "salt:hash" });
  });
});

describe("GET /api/admin/classes", () => {
  it("mọi lớp kèm tên giáo viên và sĩ số", async () => {
    await loginAs("ADMIN", "a1");
    const json = await (await (await import("@/app/api/admin/classes/route")).GET(req("GET", "/x"))).json();
    expect(json.classes.find((c: any) => c.id === "c1")).toMatchObject({ name: "Lớp A", code: "AAA", teacher_name: "Cô Lan", student_count: 1 });
  });
});

describe("Duyệt đơn mua slot — /api/admin/requests", () => {
  it("GET: danh sách đơn, PENDING trước", async () => {
    await loginAs("ADMIN", "a1");
    const json = await (await (await import("@/app/api/admin/requests/route")).GET(req("GET", "/x"))).json();
    expect(json.slot_requests.map((r: any) => r.id)).toEqual(["r1", "r2"]);
  });

  it("APPROVE đơn PENDING → APPROVED và cộng requested_slots vào slot_limit của giáo viên", async () => {
    await loginAs("ADMIN", "a1");
    const { PUT } = await import("@/app/api/admin/requests/[id]/route");
    const res = await PUT(req("PUT", "/x", { action: "APPROVE" }), ctx("r1"));
    expect(res.status).toBe(200);
    expect((await rows(`SELECT status FROM slot_requests WHERE id='r1'`))[0].status).toBe("APPROVED");
    expect((await rows(`SELECT slot_limit FROM users WHERE id='t1'`))[0].slot_limit).toBe(60);
  });

  it("duyệt lại đơn đã xử lý → 409, không cộng thêm; REJECT → REJECTED không cộng; action lạ → 400; không có → 404", async () => {
    await loginAs("ADMIN", "a1");
    const { PUT } = await import("@/app/api/admin/requests/[id]/route");
    expect((await PUT(req("PUT", "/x", { action: "APPROVE" }), ctx("r2"))).status).toBe(409);
    expect((await PUT(req("PUT", "/x", { action: "MAYBE" }), ctx("r1"))).status).toBe(400);
    expect((await PUT(req("PUT", "/x", { action: "APPROVE" }), ctx("rX"))).status).toBe(404);
    expect((await PUT(req("PUT", "/x", { action: "REJECT" }), ctx("r1"))).status).toBe(200);
    expect((await rows(`SELECT status FROM slot_requests WHERE id='r1'`))[0].status).toBe("REJECTED");
    expect((await rows(`SELECT slot_limit FROM users WHERE id='t1'`))[0].slot_limit).toBe(10);
  });
});

describe("Trang admin không còn dùng Supabase trình duyệt", () => {
  const PAGES = ["app/admin/accounts/page.tsx", "app/admin/students/page.tsx", "app/admin/students/[id]/page.tsx", "app/admin/teachers/page.tsx", "app/admin/requests/page.tsx"];
  for (const p of PAGES) {
    it(p, () => {
      const s = fs.readFileSync(p, "utf8");
      expect(s).not.toContain('"@/lib/supabase"');
      expect(s).not.toContain("supabase.");
      expect(s).toContain("/api/admin/");
    });
  }
});
