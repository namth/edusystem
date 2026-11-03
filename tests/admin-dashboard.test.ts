// TASK-043 — FEAT-013 §3.5, §4, §7 (BR 10–12): trang tổng quan /admin + sắp lại menu admin.
// File do trưởng phòng viết, bị khoá.
/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from "vitest";
import fs from "fs";
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
  ensureSchema: async () => {},
}));

import { signJwtToken } from "@/lib/jwt";
async function loginAs(role: "ADMIN" | "TEACHER" | "STUDENT" | null, userId?: string) {
  h.token = role ? await signJwtToken({ userId: userId!, email: `${userId}@x.vn`, role }) : undefined;
}
const get = (qs = "") => new Request(`http://localhost/api/admin/dashboard${qs}`);
const dash = async (qs = "") => (await import("@/app/api/admin/dashboard/route")).GET(get(qs));
const read = (f: string) => fs.readFileSync(f, "utf8");

// Ranh giới tháng 11/2026 theo giờ VN (UTC+7): 2026-10-31T17:00:00Z … 2026-11-30T17:00:00Z
const IN_NOV_EARLY = "2026-10-31T17:30:00Z";   // 01/11 00:30 VN → tháng 11
const IN_OCT_LATE = "2026-10-31T16:30:00Z";    // 31/10 23:30 VN → tháng 10
const IN_NOV_MID = "2026-11-15T03:00:00Z";      // 15/11 10:00 VN
const IN_DEC_EARLY = "2026-11-30T17:10:00Z";    // 01/12 00:10 VN → tháng 12

beforeEach(async () => {
  h.token = undefined;
  h.pg = await createFakePg(["db-migration-004-enrollments-assignments.sql", "db-migration-005-system-settings.sql"]);
  await h.pg.db.exec(`
    ALTER TABLE users ADD COLUMN slot_limit INT DEFAULT 250;
    CREATE TABLE courses (id VARCHAR(50) PRIMARY KEY, title VARCHAR(255), created_by VARCHAR(50));
    CREATE TABLE curriculum_items (id VARCHAR(50) PRIMARY KEY, course_id VARCHAR(50) NOT NULL, parent_id VARCHAR(50), title VARCHAR(255) NOT NULL,
      type VARCHAR(20) NOT NULL, exam_id VARCHAR(50), order_index INT DEFAULT 0, created_by VARCHAR(50), created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP);
    CREATE TABLE slot_requests (id VARCHAR(50) PRIMARY KEY, teacher_id VARCHAR(50) NOT NULL, teacher_name VARCHAR(100) NOT NULL, teacher_email VARCHAR(100) NOT NULL,
      requested_slots INTEGER NOT NULL, total_cost NUMERIC(12,2) NOT NULL, status VARCHAR(20) DEFAULT 'PENDING', created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP);
  `);
  for (const m of ["006-lessons", "009-scoring-standards", "014-ai-usage", "016-slot-orders"]) await h.pg.db.exec(read(`docs/db-migration-${m}.sql`));
  await h.pg.db.query(`UPDATE system_settings SET value=$1::jsonb WHERE key='ai_pricing'`,
    [JSON.stringify({ usd_vnd_rate: 25000, models: { "gemini-2.5-flash": { input_per_1m: 1, output_per_1m: 2 } } })]);
  await h.pg.db.exec(`
    INSERT INTO users (id,name,email,role,teacher_status) VALUES
      ('a1','Admin','a1@x.vn','ADMIN',NULL),
      ('t1','Cô Lan','t1@x.vn','TEACHER','VERIFIED'), ('t2','Thầy Minh','t2@x.vn','TEACHER','VERIFIED'), ('t3','GV cũ','t3@x.vn','TEACHER',NULL),
      ('tT','GV thử','tt@x.vn','TEACHER','TRIAL'),
      ('s1','HS1','s1@x.vn','STUDENT',NULL), ('s2','HS2','s2@x.vn','STUDENT',NULL), ('s3','HS3','s3@x.vn','STUDENT',NULL);
    INSERT INTO lessons (id,title,created_by) VALUES ('l1','B1','t1'), ('l2','B2','t1');
    INSERT INTO exams (id,title,created_by) VALUES ('e1','Đ1','t1'), ('e2','Đ2','t2'), ('e3','Đ3','t2');
  `);
  await h.pg.db.query(`
    INSERT INTO submissions (id,exam_id,student_id,answers,status,submitted_at) VALUES
      ('sub1','e1','s1','{}','GRADED',$1), ('sub2','e1','s2','{}','GRADED',$2), ('sub3','e2','s3','{}','GRADED',$3),
      ('subX','e2','s3','{}','IN_PROGRESS',NULL), ('subD','e2','s1','{}','GRADED',$4)`,
    [IN_NOV_EARLY, IN_OCT_LATE, IN_NOV_MID, IN_DEC_EARLY]);
  await h.pg.db.query(`
    INSERT INTO lesson_attempts (id,lesson_id,class_id,student_id,status,created_at) VALUES
      ('att1','l1','c1','s1','GRADED',$1), ('att2','l1','c1','s2','GRADED',$2)`, [IN_NOV_MID, IN_OCT_LATE]);
  // Log AI: 2 lần gọi cho sub1 (tính 1 bài), 1 cho att1, 1 import (không tính bài), 1 tháng 10, 1 model chưa có giá
  await h.pg.db.query(`
    INSERT INTO ai_usage_logs (id,purpose,model,teacher_id,submission_id,lesson_attempt_id,prompt_tokens,completion_tokens,total_tokens,cost_usd,created_at) VALUES
      ('g1','EXAM_GRADING','gemini-2.5-flash','t1','sub1',NULL,1000000,0,1000000,1,$1),
      ('g2','EXAM_GRADING','gemini-2.5-flash','t1','sub1',NULL,0,500000,500000,1,$2),
      ('g3','LESSON_GRADING','gemini-2.5-flash','t2',NULL,'att1',200000,100000,300000,0.4,$2),
      ('g4','EXAM_IMPORT','gemini-2.5-flash','t2',NULL,NULL,100000,0,100000,0.1,$2),
      ('g5','EXAM_GRADING','gemini-2.5-flash','t1','sub2',NULL,9,9,18,5,$3),
      ('g6','EXAM_GRADING','model-moi','t2','sub3',NULL,1000,1000,2000,0,$2)`,
    [IN_NOV_EARLY, IN_NOV_MID, IN_OCT_LATE]);
  // Đơn: duyệt trong tháng 11 (tính doanh thu), duyệt tháng 10, chờ xử lý 2 đơn
  await h.pg.db.query(`
    INSERT INTO slot_requests (id,teacher_id,teacher_name,teacher_email,requested_slots,total_cost,status,code,decided_at) VALUES
      ('o1','t1','Cô Lan','t1@x.vn',10,120000,'APPROVED','KKAAAA2222',$1),
      ('o2','t2','Thầy Minh','t2@x.vn',5,60000,'APPROVED','KKBBBB2222',$2),
      ('o3','t2','Thầy Minh','t2@x.vn',5,60000,'PENDING','KKCCCC2222',NULL),
      ('o4','t1','Cô Lan','t1@x.vn',5,60000,'PENDING','KKDDDD2222',NULL),
      ('o5','t1','Cô Lan','t1@x.vn',5,60000,'REJECTED','KKEEEE2222',$1)`,
    [IN_NOV_MID, IN_OCT_LATE]);
});

// ─────────────────────────────────────────────────────────────────────────────
describe("GET /api/admin/dashboard", () => {
  it("401 khi chưa đăng nhập; TEACHER/STUDENT 403", async () => {
    expect((await dash()).status).toBe(401);
    await loginAs("TEACHER", "t1");
    expect((await dash()).status).toBe(403);
    await loginAs("STUDENT", "s1");
    expect((await dash()).status).toBe(403);
  });

  it("month sai định dạng → 400", async () => {
    await loginAs("ADMIN", "a1");
    for (const m of ["2026-13", "11-2026", "2026-1", "abc"]) expect((await dash(`?month=${m}`)).status, m).toBe(400);
  });

  it("số tổng toàn thời gian: GV đã xác minh (kể cả teacher_status NULL) / dùng thử, học sinh, bài học, đề thi, đơn chờ", async () => {
    await loginAs("ADMIN", "a1");
    const j = await (await dash("?month=2026-11")).json();
    expect(j.success).toBe(true);
    expect(j.month).toBe("2026-11");
    expect(j.totals).toEqual({ teachers_verified: 3, teachers_trial: 1, students: 3, lessons: 2, exams: 3 });
    expect(j.pending_orders).toBe(2);
  });

  it("số trong tháng theo giờ VN: bài nộp, bài AI chấm (đếm bài khác nhau, bỏ EXAM_IMPORT), token, chi phí VND, doanh thu", async () => {
    await loginAs("ADMIN", "a1");
    const m = (await (await dash("?month=2026-11")).json()).monthly;
    expect(m.submissions).toBe(3);                      // sub1, sub3 + att1 (sub2/att2 tháng 10, subD tháng 12, subX chưa nộp)
    expect(m.ai_graded).toBe(3);                        // sub1, att1, sub3
    expect(m.ai_tokens).toBe(1000000 + 500000 + 300000 + 100000 + 2000);
    expect(m.ai_cost_vnd).toBe(Math.round((1 + 1 + 0.4 + 0.1 + 0) * 25000));
    expect(m.revenue_vnd).toBe(120000);
    expect(m.unpriced_calls).toBe(1);                   // model-moi
  });

  it("tháng 10 chỉ thấy dữ liệu tháng 10", async () => {
    await loginAs("ADMIN", "a1");
    const m = (await (await dash("?month=2026-10")).json()).monthly;
    expect(m).toMatchObject({ submissions: 2, ai_graded: 1, ai_tokens: 18, ai_cost_vnd: 125000, revenue_vnd: 60000, unpriced_calls: 0 });
  });

  it("daily: đủ mọi ngày trong tháng, đúng ngày theo giờ VN", async () => {
    await loginAs("ADMIN", "a1");
    const d = (await (await dash("?month=2026-11")).json()).daily;
    expect(d).toHaveLength(30);
    expect(d[0].date).toBe("2026-11-01");
    expect(d[29].date).toBe("2026-11-30");
    expect(d[0]).toMatchObject({ submissions: 1, ai_cost_vnd: 25000 });
    expect(d[14]).toMatchObject({ date: "2026-11-15", submissions: 2, ai_cost_vnd: Math.round(1.5 * 25000) });
    expect(d[1]).toMatchObject({ submissions: 0, ai_cost_vnd: 0 });
  });

  it("top_teachers: sắp theo chi phí giảm dần, tối đa 10, có tên, số bài AI, token, chi phí", async () => {
    await loginAs("ADMIN", "a1");
    const t = (await (await dash("?month=2026-11")).json()).top_teachers;
    expect(t.map((x: any) => x.teacher_id)).toEqual(["t1", "t2"]);
    expect(t[0]).toMatchObject({ name: "Cô Lan", ai_graded: 1, tokens: 1500000, cost_vnd: 50000 });
    expect(t[1]).toMatchObject({ name: "Thầy Minh", ai_graded: 2, tokens: 402000, cost_vnd: 12500 });
    expect(t.length).toBeLessThanOrEqual(10);
  });

  it("không truyền month → tháng hiện tại theo giờ VN", async () => {
    await loginAs("ADMIN", "a1");
    const j = await (await dash()).json();
    const vn = new Date(Date.now() + 7 * 3600 * 1000).toISOString().slice(0, 7);
    expect(j.month).toBe(vn);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe("Trang /admin (tổng quan)", () => {
  it("client page gọi /api/admin/dashboard?month=, chọn tháng, biểu đồ recharts, link đơn chờ sang /admin/orders", () => {
    const s = read("app/admin/page.tsx");
    expect(s.trimStart().startsWith('"use client"')).toBe(true);
    expect(s).toMatch(/\/api\/admin\/dashboard\?month=/);
    expect(s).toMatch(/from ["']recharts["']/);
    expect(s).toMatch(/\/admin\/orders/);
    expect(s).toMatch(/AdminLayout/);
    for (const k of ["teachers_verified", "students", "lessons", "exams", "submissions", "ai_graded", "ai_tokens", "ai_cost_vnd", "revenue_vnd", "unpriced_calls", "top_teachers"]) expect(s, k).toContain(k);
    expect(s).not.toMatch(/@\/lib\/(db-pg|admin-dashboard)/);
  });
});

describe("Menu admin & điều hướng", () => {
  it("thứ tự menu đúng đặc tả §4", () => {
    const s = read("components/AdminLayout.tsx");
    const hrefs = [...s.matchAll(/href:\s*"(\/admin[^"]*)"/g)].map((m) => m[1]);
    expect(hrefs).toEqual(["/admin", "/admin/orders", "/admin/teachers", "/admin/students", "/admin/accounts", "/admin/scoring-standards", "/admin/leads", "/admin/settings"]);
    for (const k of ["Tổng quan", "Đơn hàng", "Liên Hệ Từ Website", "Chuẩn Chấm Điểm"]) expect(s, k).toMatch(new RegExp(k, "i"));
    expect(s).toMatch(/LayoutDashboard/);
    expect(s).toMatch(/Receipt/);
  });

  it("'Tổng quan' chỉ sáng khi pathname đúng bằng /admin; menu Đơn hàng có số đơn chờ từ /api/admin/orders", () => {
    const s = read("components/AdminLayout.tsx");
    expect(s).toMatch(/pathname\s*===\s*["']\/admin["']|item\.href\s*===\s*["']\/admin["']/);
    expect(s).toMatch(/\/api\/admin\/orders/);
    expect(s).toMatch(/counts/);
  });

  it("đăng nhập ADMIN về /admin (roleHomePath, trang chủ, Navbar)", async () => {
    const { roleHomePath, safeNextPath } = await import("@/components/onboarding/redirect");
    expect(roleHomePath("ADMIN")).toBe("/admin");
    expect(safeNextPath(null, "ADMIN")).toBe("/admin");
    expect(read("app/page.tsx")).toMatch(/redirect\("\/admin"\)/);
    expect(read("components/Navbar.tsx")).not.toContain("/admin/requests");
  });

  it("không còn link nào tới /admin/requests (trừ trang chuyển hướng)", () => {
    const walk = (d: string, out: string[] = []): string[] => {
      for (const e of fs.readdirSync(d, { withFileTypes: true })) {
        const p = `${d}/${e.name}`;
        if (e.isDirectory()) walk(p, out); else if (/\.tsx?$/.test(e.name)) out.push(p);
      }
      return out;
    };
    const bad = [...walk("app"), ...walk("components"), ...walk("lib")]
      .filter((f) => !f.startsWith("app/admin/requests/") && !f.startsWith("app/api/"))
      .filter((f) => /["'`]\/admin\/requests/.test(read(f)));
    expect(bad).toEqual([]);
  });
});
