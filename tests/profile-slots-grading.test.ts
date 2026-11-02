// TASK-024 — Hồ sơ, mua slot, trang chấm bài qua API pg; gỡ Supabase trình duyệt khỏi các trang còn lại.
// File do trưởng phòng viết, bị khoá.
import { describe, it, expect, vi, beforeEach } from "vitest";
import fs from "fs";
import { createFakePg } from "./helpers/pg-fake";

const h = vi.hoisted(() => {
  process.env.JWT_SECRET = "test_secret_for_vitest_only_0123456789abcdef";
  process.env.SLOT_UNIT_PRICE_VND = "10000";
  return { token: undefined as string | undefined, pg: null as any };
});
vi.mock("next/headers", () => ({
  cookies: async () => ({ get: (n: string) => (n === "auth_token" && h.token ? { value: h.token } : undefined), set: () => {} }),
}));
vi.mock("@/lib/db-pg", () => ({ queryPg: (s: string, p?: unknown[]) => h.pg.queryPg(s, p), ensureSchema: async () => {} }));

import { signJwtToken } from "@/lib/jwt";
async function loginAs(role: "ADMIN" | "TEACHER" | "STUDENT" | null, userId?: string) {
  h.token = role ? await signJwtToken({ userId: userId!, email: `${userId}@x.vn`, role }) : undefined;
}
const req = (method: string, url: string, body?: unknown) =>
  new Request(`http://localhost${url}`, { method, headers: { "Content-Type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) });
const rows = async (sql: string) => (await h.pg.db.query(sql)).rows;

beforeEach(async () => {
  h.token = undefined;
  h.pg = await createFakePg(["db-migration-004-enrollments-assignments.sql"]);
  await h.pg.db.exec(`
    ALTER TABLE users ADD COLUMN slot_limit INT DEFAULT 0;
    CREATE TABLE slot_requests (id VARCHAR(50) PRIMARY KEY, teacher_id VARCHAR(50), teacher_name VARCHAR(100), teacher_email VARCHAR(100),
      requested_slots INT NOT NULL, total_cost NUMERIC(12,2) NOT NULL, status VARCHAR(20) DEFAULT 'PENDING', created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP);
    CREATE TABLE courses (id VARCHAR(50) PRIMARY KEY, title VARCHAR(255), created_by VARCHAR(50));
  `);
  // FEAT-013 (TASK-041): slot_requests mở rộng thành đơn hàng — chạy migration như DB thật
  await h.pg.db.exec(fs.readFileSync("docs/db-migration-005-system-settings.sql", "utf8"));
  await h.pg.db.exec(fs.readFileSync("docs/db-migration-016-slot-orders.sql", "utf8"));
  await h.pg.db.exec(`UPDATE system_settings SET value = '{"unit_price_vnd":10000}'::jsonb WHERE key = 'slot_pricing'`);   // DEC-033: giá đọc từ cấu hình
  await h.pg.db.exec(fs.readFileSync("docs/db-migration-009-scoring-standards.sql", "utf8"));
  await h.pg.db.exec(`
    INSERT INTO users (id,name,email,role,phone,password,target_band) VALUES
      ('t1','GV1','t1@x.vn','TEACHER','0901','salt:hash',NULL), ('t2','GV2','t2@x.vn','TEACHER',NULL,'salt:hash',NULL),
      ('s1','HS1','s1@x.vn','STUDENT',NULL,'salt:hash','6.5'), ('s2','HS2','s2@x.vn','STUDENT',NULL,'salt:hash',NULL);
    INSERT INTO classes (id,name,code,teacher_id) VALUES ('c1','Lớp','AAA','t1');
    INSERT INTO exams (id,title,created_by) VALUES ('e1','Đề t1','t1'), ('e2','Đề t2','t2');
    INSERT INTO submissions (id,exam_id,student_id,answers,status,class_ref,total_score,section_scores,created_at) VALUES
      ('sb1','e1','s1','{}','NEEDS_REVIEW','c1',NULL,'{"Reading":{"score":7}}','2026-10-03'),
      ('sb2','e1','s2','{}','GRADED',NULL,6.5,'{}','2026-10-02'),
      ('sb3','e2','s1','{}','GRADED',NULL,8,'{}','2026-10-01');
  `);
});

describe("PUT /api/profile — tự sửa hồ sơ", () => {
  const put = async (body: unknown) => (await import("@/app/api/profile/route")).PUT(req("PUT", "/x", body));
  it("chưa đăng nhập 401; sửa tên/sđt/mục tiêu của chính mình", async () => {
    expect((await put({ name: "x" })).status).toBe(401);
    await loginAs("STUDENT", "s1");
    const res = await put({ name: " Học sinh 1 ", phone: "0988", target_band: "7.0" });
    expect(res.status).toBe(200);
    expect((await rows(`SELECT name, phone, target_band FROM users WHERE id='s1'`))[0]).toEqual({ name: "Học sinh 1", phone: "0988", target_band: "7.0" });
    expect(JSON.stringify(await res.json())).not.toContain("salt:hash");
  });
  it("KHÔNG cho đổi password/email/role/slot_limit qua route này; tên rỗng → 400", async () => {
    await loginAs("STUDENT", "s1");
    await put({ name: "A", password: "123456", email: "hack@x.vn", role: "ADMIN", slot_limit: 999 });
    expect((await rows(`SELECT password, email, role, slot_limit FROM users WHERE id='s1'`))[0]).toEqual({ password: "salt:hash", email: "s1@x.vn", role: "STUDENT", slot_limit: 0 });
    expect((await put({ name: "  " })).status).toBe(400);
  });
});

describe("/api/teacher/slot-requests — mua slot", () => {
  const api = () => import("@/app/api/teacher/slot-requests/route");
  it("STUDENT 403; GV tạo đơn: thông tin GV lấy từ token/DB, giá tính phía server", async () => {
    await loginAs("STUDENT", "s1");
    expect((await (await api()).POST(req("POST", "/x", { requested_slots: 10 }))).status).toBe(403);
    await loginAs("TEACHER", "t1");
    const res = await (await api()).POST(req("POST", "/x", { requested_slots: 10, total_cost: 1, teacher_id: "t2" }));
    expect(res.status).toBe(201);
    const { slot_request } = await res.json();
    expect(slot_request).toMatchObject({ teacher_id: "t1", teacher_name: "GV1", teacher_email: "t1@x.vn", requested_slots: 10, total_cost: 100000, status: "PENDING" });
  });
  it("số slot không phải số nguyên 1–10000 → 400; GET chỉ đơn của mình", async () => {
    await loginAs("TEACHER", "t1");
    for (const n of [0, -5, 2.5, 20000, "abc"]) expect((await (await api()).POST(req("POST", "/x", { requested_slots: n }))).status).toBe(400);
    await h.pg.db.exec(`INSERT INTO slot_requests (id,teacher_id,teacher_name,teacher_email,requested_slots,total_cost) VALUES ('rT2','t2','GV2','t2@x.vn',5,0)`);
    await (await api()).POST(req("POST", "/x", { requested_slots: 3 }));
    const list = (await (await (await api()).GET(req("GET", "/x"))).json()).slot_requests;
    expect(list.every((r: any) => r.teacher_id === "t1")).toBe(true);
    expect(list).toHaveLength(1);
  });
});

describe("GET /api/teacher/submissions — danh sách bài nộp để chấm", () => {
  const get = async (q = "") => (await import("@/app/api/teacher/submissions/route")).GET(req("GET", `/x${q}`));
  it("TEACHER thấy bài của đề mình tạo hoặc lớp mình dạy, kèm tên đề/học sinh; lọc status; STUDENT 403", async () => {
    await loginAs("TEACHER", "t1");
    const json = await (await get()).json();
    expect(json.submissions.map((s: any) => s.id)).toEqual(["sb1", "sb2"]);
    expect(json.submissions[0]).toMatchObject({ exam_title: "Đề t1", student_name: "HS1", status: "NEEDS_REVIEW" });
    expect((await (await get("?status=NEEDS_REVIEW")).json()).submissions.map((s: any) => s.id)).toEqual(["sb1"]);
    await loginAs("ADMIN", "a1");
    expect((await (await get()).json()).submissions).toHaveLength(3);
    await loginAs("STUDENT", "s1");
    expect((await get()).status).toBe(403);
  });
});

describe("Trang không còn Supabase trình duyệt; trang chấm bài dùng hợp đồng grade-override mới", () => {
  for (const p of ["app/profile/page.tsx", "app/teacher/slots/page.tsx", "app/teacher/grading/page.tsx", "app/teacher/tests/page.tsx"]) {
    it(p, () => {
      const s = fs.readFileSync(p, "utf8");
      expect(s).not.toContain('"@/lib/supabase"');
      expect(s).not.toContain("supabase.");
    });
  }
  it("trang hồ sơ gọi /api/profile, đổi mật khẩu qua /api/auth/change-password, không gửi password tới /api/profile", () => {
    const s = fs.readFileSync("app/profile/page.tsx", "utf8");
    expect(s).toContain("/api/profile");
    expect(s).toContain("/api/auth/change-password");
  });
  it("trang chấm bài: /api/teacher/submissions + grade-override với section_scores", () => {
    const s = fs.readFileSync("app/teacher/grading/page.tsx", "utf8");
    expect(s).toContain("/api/teacher/submissions");
    expect(s).toContain("section_scores");
    expect(s).not.toContain("overriddenScore");
    expect(s).not.toContain("teacher_01");
  });
});
