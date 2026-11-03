// TASK-039 — FEAT-013 §3.4, §7 (BR 6–8), DEC-031: 1 slot = 1 học sinh; chấm AI không trừ slot.
// File do trưởng phòng viết, bị khoá.
/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from "vitest";
import fs from "fs";
import path from "path";
import { createFakePg } from "./helpers/pg-fake";

const h = vi.hoisted(() => {
  process.env.JWT_SECRET = "test_secret_for_vitest_only_0123456789abcdef";
  return { token: undefined as string | undefined, pg: null as any };
});

vi.mock("next/headers", () => ({
  cookies: async () => ({ get: (n: string) => (n === "auth_token" && h.token ? { value: h.token } : undefined), set: () => {} }),
  headers: async () => new Headers(),
}));
vi.mock("@/lib/db-pg", () => ({
  queryPg: (sql: string, params?: unknown[]) => h.pg.queryPg(sql, params),
  getPgPool: () => ({ connect: async () => ({ query: (s: string, p?: unknown[]) => h.pg.queryPg(s, p), release: () => {} }) }),
  ensureSchema: async () => {},
}));
vi.mock("@/lib/neo4j", () => ({
  syncStudentEnrolledInClass: async () => {},
  syncTeacherManagesClass: async () => {},
  syncCourseExam: async () => {},
  runCypherQuery: async () => [],
}));
vi.mock("@/lib/redis-queue", () => ({ pushRedisStreamEvent: async () => {}, pushGradingEvent: async () => {} }));

import { signJwtToken } from "@/lib/jwt";

async function loginAs(role: "ADMIN" | "TEACHER" | "STUDENT" | null, userId?: string) {
  h.token = role ? await signJwtToken({ userId: userId!, email: `${userId}@x.vn`, role }) : undefined;
}
const req = (method: string, url: string, body?: unknown) =>
  new Request(`http://localhost${url}`, { method, headers: { "Content-Type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) });
const ctx = <T extends Record<string, string>>(p: T) => ({ params: Promise.resolve(p) });
const rows = async (sql: string, p: unknown[] = []) => (await h.pg.db.query(sql, p)).rows as any[];
const enrolled = async (classId: string) => (await rows(`SELECT student_id FROM enrollments WHERE class_id=$1 ORDER BY student_id`, [classId])).map((r) => r.student_id);
const read = (f: string) => fs.readFileSync(f, "utf8");

async function expectSlotFull(res: Response) {
  expect(res.status).toBe(409);
  const j = await res.json();
  expect(j.success).toBe(false);
  expect(j.error).toMatch(/slot/i);
}

beforeEach(async () => {
  h.token = undefined;
  h.pg = await createFakePg([
    "db-migration-004-enrollments-assignments.sql",
    "db-migration-007-question-owner.sql",
    "db-migration-010-notifications.sql",
    "db-migration-013-onboarding.sql",
  ]);
  await h.pg.db.exec(`
    ALTER TABLE users ADD COLUMN IF NOT EXISTS slot_limit INT DEFAULT 250;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN DEFAULT FALSE;
    CREATE TABLE courses (id VARCHAR(50) PRIMARY KEY, title VARCHAR(255), created_by VARCHAR(50));
    CREATE TABLE curriculum_items (id VARCHAR(50) PRIMARY KEY, course_id VARCHAR(50) NOT NULL, parent_id VARCHAR(50), title VARCHAR(255) NOT NULL,
      type VARCHAR(20) NOT NULL, exam_id VARCHAR(50), order_index INT DEFAULT 0, created_by VARCHAR(50), created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP);
    CREATE TABLE slot_requests (id VARCHAR(50) PRIMARY KEY, teacher_id VARCHAR(50), teacher_name VARCHAR(100), teacher_email VARCHAR(100),
      requested_slots INT NOT NULL, total_cost NUMERIC(12,2) NOT NULL, status VARCHAR(20) DEFAULT 'PENDING', created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP);
    INSERT INTO users (id,name,email,role,teacher_status,slot_limit) VALUES
      ('a1','Admin','a1@x.vn','ADMIN',NULL,0),
      ('t1','GV1','t1@x.vn','TEACHER','VERIFIED',2),
      ('t2','GV2','t2@x.vn','TEACHER','VERIFIED',250),
      ('s1','HS1','s1@x.vn','STUDENT',NULL,0), ('s2','HS2','s2@x.vn','STUDENT',NULL,0),
      ('s3','HS3','s3@x.vn','STUDENT',NULL,0), ('s4','HS4','s4@x.vn','STUDENT',NULL,0);
    INSERT INTO classes (id,name,code,teacher_id,max_slots) VALUES
      ('c1','Lớp 1','AAA111','t1',30), ('c2','Lớp 2','BBB222','t1',30), ('c3','Lớp GV2','CCC333','t2',30), ('cA','Lớp admin','ADM001','a1',30);
  `);
  await h.pg.db.exec(read("docs/db-migration-006-lessons.sql"));
});

const fillT1 = () => h.pg.db.exec(`INSERT INTO enrollments (id,student_id,class_id) VALUES ('e1','s1','c1'), ('e2','s2','c1')`);

// ─────────────────────────────────────────────────────────────────────────────
describe("lib/student-slots.ts", () => {
  it("getStudentSlotUsage đếm học sinh KHÁC NHAU trên mọi lớp của giáo viên", async () => {
    const { getStudentSlotUsage } = await import("@/lib/student-slots");
    expect(await getStudentSlotUsage("t1")).toEqual({ used: 0, limit: 2 });
    await h.pg.db.exec(`INSERT INTO enrollments (id,student_id,class_id) VALUES ('e1','s1','c1'), ('e2','s1','c2'), ('e3','s2','c3')`);
    expect(await getStudentSlotUsage("t1")).toEqual({ used: 1, limit: 2 });
    expect(await getStudentSlotUsage("t2")).toEqual({ used: 1, limit: 250 });
  });

  it("assertStudentSlotAvailable: đủ slot → học sinh mới bị chặn 409, học sinh đã có trong lớp khác của GV vẫn ok", async () => {
    const { assertStudentSlotAvailable } = await import("@/lib/student-slots");
    expect(await assertStudentSlotAvailable("t1", "s3")).toEqual({ ok: true });
    await fillT1();
    const r = await assertStudentSlotAvailable("t1", "s3");
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.status).toBe(409);
      expect(r.error).toMatch(/slot/i);
    }
    expect(await assertStudentSlotAvailable("t1", "s1")).toEqual({ ok: true });
    expect(await assertStudentSlotAvailable("t2", "s3")).toEqual({ ok: true });
  });

  it("lớp của ADMIN không bị giới hạn slot", async () => {
    const { assertStudentSlotAvailable } = await import("@/lib/student-slots");
    expect(await assertStudentSlotAvailable("a1", "s3")).toEqual({ ok: true });
  });

  it("giảm slot_limit dưới số đang dùng: không xoá ai, chỉ chặn học sinh mới", async () => {
    await fillT1();
    await h.pg.db.exec(`UPDATE users SET slot_limit=1 WHERE id='t1'`);
    const { getStudentSlotUsage, assertStudentSlotAvailable } = await import("@/lib/student-slots");
    expect(await getStudentSlotUsage("t1")).toEqual({ used: 2, limit: 1 });
    expect((await assertStudentSlotAvailable("t1", "s3")).ok).toBe(false);
    expect(await enrolled("c1")).toEqual(["s1", "s2"]);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe("Mọi đường ghi danh đều chặn khi hết slot", () => {
  it("enrollStudentByCode (mã lớp / link mời): hết slot → 409, không ghi; học sinh đã có ở lớp khác của GV → vào được", async () => {
    await fillT1();
    const { enrollStudentByCode } = await import("@/lib/enrollment");
    const r = await enrollStudentByCode("s3", "AAA111");
    expect(r).toMatchObject({ ok: false, status: 409 });
    if (!r.ok) expect(r.error).toMatch(/slot|đủ chỗ/i);
    expect(await enrolled("c1")).toEqual(["s1", "s2"]);
    expect((await enrollStudentByCode("s1", "BBB222")).ok).toBe(true);
    expect(await enrolled("c2")).toEqual(["s1"]);
    expect((await enrollStudentByCode("s3", "CCC333")).ok).toBe(true);
  });

  it("POST /api/student/enroll: học sinh nhận 409 khi giáo viên hết slot", async () => {
    await fillT1();
    await loginAs("STUDENT", "s3");
    const { POST } = await import("@/app/api/student/enroll/route");
    const res = await POST(req("POST", "/api/student/enroll", { code: "AAA111" }));
    expect(res.status).toBe(409);
    expect(await enrolled("c1")).toEqual(["s1", "s2"]);
  });

  it("POST /api/teacher/classes/[classId]/students — thêm học sinh CÓ SẴN khi hết slot → 409; học sinh đã có ở lớp khác → 201", async () => {
    await fillT1();
    await loginAs("TEACHER", "t1");
    const { POST } = await import("@/app/api/teacher/classes/[classId]/students/route");
    await expectSlotFull(await POST(req("POST", "/x", { name: "HS3", email: "s3@x.vn" }), ctx({ classId: "c2" })));
    expect(await enrolled("c2")).toEqual([]);
    const ok = await POST(req("POST", "/x", { name: "HS1", email: "s1@x.vn" }), ctx({ classId: "c2" }));
    expect(ok.status).toBeLessThan(300);
    expect(await enrolled("c2")).toEqual(["s1"]);
  });

  it("POST /api/teacher/classes/[classId]/students — tạo học sinh MỚI khi hết slot → 409 và KHÔNG tạo tài khoản", async () => {
    await fillT1();
    await loginAs("TEACHER", "t1");
    const { POST } = await import("@/app/api/teacher/classes/[classId]/students/route");
    await expectSlotFull(await POST(req("POST", "/x", { name: "HS mới", email: "moi@x.vn" }), ctx({ classId: "c1" })));
    expect(await rows(`SELECT id FROM users WHERE email='moi@x.vn'`)).toEqual([]);
  });

  it("POST /api/admin/create-user có classIds vào lớp GV hết slot → 409 và KHÔNG tạo tài khoản", async () => {
    await fillT1();
    await loginAs("ADMIN", "a1");
    const { POST } = await import("@/app/api/admin/create-user/route");
    await expectSlotFull(await POST(req("POST", "/x", { email: "moi2@x.vn", password: "matkhau123", name: "Mới", role: "STUDENT", classIds: ["c1"] })));
    expect(await rows(`SELECT id FROM users WHERE email='moi2@x.vn'`)).toEqual([]);
    const ok = await POST(req("POST", "/x", { email: "moi3@x.vn", password: "matkhau123", name: "Mới", role: "STUDENT", classIds: ["c3"] }));
    expect(ok.status).toBeLessThan(300);
  });

  it("PUT /api/admin/users/[id] gán class_ids vào lớp GV hết slot → 409, ghi danh cũ giữ nguyên", async () => {
    await fillT1();
    await h.pg.db.exec(`INSERT INTO enrollments (id,student_id,class_id) VALUES ('e9','s3','c3')`);
    await loginAs("ADMIN", "a1");
    const { PUT } = await import("@/app/api/admin/users/[id]/route");
    await expectSlotFull(await PUT(req("PUT", "/x", { class_ids: ["c3", "c1"] }), ctx({ id: "s3" })));
    expect((await rows(`SELECT class_id FROM enrollments WHERE student_id='s3'`)).map((r) => r.class_id)).toEqual(["c3"]);
    // học sinh đã ở lớp của t1 thì chuyển sang lớp khác của t1 không tốn thêm slot
    const ok = await PUT(req("PUT", "/x", { class_ids: ["c2"] }), ctx({ id: "s1" }));
    expect(ok.status).toBeLessThan(300);
  });

  it("giáo viên dùng thử vẫn bị giới hạn dùng thử trước (403 TRIAL_LIMIT), không đổi hành vi DEC-027", async () => {
    await h.pg.db.exec(`UPDATE users SET teacher_status='TRIAL', slot_limit=9 WHERE id='t1';
      INSERT INTO enrollments (id,student_id,class_id) VALUES ('e1','s1','c1'), ('e2','s2','c1'), ('e3','s3','c1')`);
    await loginAs("TEACHER", "t1");
    const { POST } = await import("@/app/api/teacher/classes/[classId]/students/route");
    const res = await POST(req("POST", "/x", { name: "HS4", email: "s4@x.vn" }), ctx({ classId: "c1" }));
    expect(res.status).toBe(403);
    expect((await res.json()).code).toBe("TRIAL_LIMIT");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe("GET /api/teacher/slot-requests trả số slot thật", () => {
  it("usage = { used, limit } của chính giáo viên", async () => {
    await h.pg.db.exec(`INSERT INTO enrollments (id,student_id,class_id) VALUES ('e1','s1','c1'), ('e2','s1','c2'), ('e3','s2','c3')`);
    await loginAs("TEACHER", "t1");
    const { GET } = await import("@/app/api/teacher/slot-requests/route");
    const j = await (await GET(req("GET", "/x"))).json();
    expect(j.success).toBe(true);
    expect(j.usage).toEqual({ used: 1, limit: 2 });
    expect(Array.isArray(j.slot_requests)).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe("Chấm AI không còn đọc/trừ/hoàn slot", () => {
  it("không còn câu lệnh cộng/trừ slot_limit trong app/, lib/, worker/ (trừ duyệt đơn mua slot)", () => {
    const walk = (d: string, out: string[] = []): string[] => {
      for (const e of fs.readdirSync(d, { withFileTypes: true })) {
        const p = path.join(d, e.name);
        if (e.isDirectory()) walk(p, out); else if (/\.(ts|tsx|js)$/.test(e.name)) out.push(p);
      }
      return out;
    };
    const bad = [...walk("app"), ...walk("lib"), ...walk("worker")]
      .filter((f) => /slot_limit\s*-\s*1|slot_limit\s*\+\s*1|hoàn slot/i.test(read(f)))
      .map((f) => f.split(path.sep).join("/"));
    expect(bad).toEqual([]);
    expect(read("app/api/student/exam-attempts/[id]/submit/route.ts")).not.toMatch(/slot_limit/);
    expect(read("app/api/student/lessons/[lessonId]/attempts/route.ts")).not.toMatch(/slot_limit|AI_SKIPPED/);
  });

  it("giao diện không còn gọi slot là lượt chấm / không viết cứng số đã dùng", () => {
    const s = read("app/teacher/slots/page.tsx");
    expect(s).not.toMatch(/useState\(218\)|useState\(250\)/);
    expect(s).toMatch(/usage/);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe("Migration 015 (Claude viết, chạy tay một lần)", () => {
  it("trả lại slot đã bị trừ: ≥ 250 + slot đã duyệt; không hạ ai; bỏ qua TRIAL", async () => {
    await h.pg.db.exec(`
      INSERT INTO users (id,name,email,role,teacher_status,slot_limit) VALUES
        ('t3','GV3','t3@x.vn','TEACHER','VERIFIED',400), ('t4','GV4','t4@x.vn','TEACHER','TRIAL',3);
      INSERT INTO slot_requests (id,teacher_id,teacher_name,teacher_email,requested_slots,total_cost,status) VALUES
        ('r1','t1','GV1','t1@x.vn',50,0,'APPROVED'), ('r2','t1','GV1','t1@x.vn',70,0,'PENDING'), ('r3','t1','GV1','t1@x.vn',30,0,'REJECTED');
    `);
    await h.pg.db.exec(read("docs/db-migration-015-student-slots.sql"));
    const m = Object.fromEntries((await rows(`SELECT id, slot_limit FROM users WHERE role='TEACHER'`)).map((r) => [r.id, r.slot_limit]));
    expect(m).toEqual({ t1: 300, t2: 250, t3: 400, t4: 3 });
  });

  it("không nằm trong ensureSchema (tránh ghi đè việc admin hạ slot)", () => {
    expect(read("lib/db-pg.ts")).not.toMatch(/250\s*\+\s*COALESCE|migration 015/i);
  });
});
