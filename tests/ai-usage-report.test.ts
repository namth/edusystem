// TASK-050 — Báo cáo token & chi phí AI theo giáo viên, sửa số liệu trang chi tiết GV.
// File do kỹ sư kiểm thử chéo viết, dùng làm hợp đồng nghiệm thu — người code không sửa file này.
/* eslint-disable @typescript-eslint/no-explicit-any */
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
  headers: async () => new Headers(),
}));

vi.mock("@/lib/db-pg", () => ({
  queryPg: (sql: string, params?: unknown[]) => h.pg.queryPg(sql, params),
  getPgPool: () => ({
    connect: async () => ({
      query: (s: string, p?: unknown[]) => h.pg.queryPg(s, p),
      release: () => {},
    }),
  }),
  ensureSchema: async () => {},
}));

import { signJwtToken } from "@/lib/jwt";

async function loginAs(role: "ADMIN" | "TEACHER" | "STUDENT" | null, userId?: string) {
  h.token = role ? await signJwtToken({ userId: userId!, email: `${userId}@x.vn`, role }) : undefined;
}

const req = (url: string, init?: RequestInit) => new Request(`http://localhost${url}`, init);
const get = (url: string) => new Request(`http://localhost${url}`);
const ctx = (id: string) => ({ params: Promise.resolve({ id }) });
const read = (f: string) => fs.readFileSync(f, "utf8");

// Mốc thời gian kiểm thử (tháng 11/2026 UTC+7)
const IN_NOV_EARLY = "2026-10-31T17:30:00Z"; // 01/11 00:30 VN → tháng 11
const IN_NOV_MID = "2026-11-15T03:00:00Z";   // 15/11 10:00 VN
const IN_OCT_LATE = "2026-10-31T16:30:00Z";  // 31/10 23:30 VN → tháng 10 (tháng trước)
const IN_DEC_EARLY = "2026-11-30T17:10:00Z"; // 01/12 00:10 VN → tháng 12 (tháng sau)

beforeEach(async () => {
  h.token = undefined;
  h.pg = await createFakePg([
    "db-migration-004-enrollments-assignments.sql",
    "db-migration-005-system-settings.sql",
    "db-migration-013-onboarding.sql",
  ]);

  await h.pg.db.exec(`
    ALTER TABLE users ADD COLUMN IF NOT EXISTS slot_limit INT DEFAULT 250;
    CREATE TABLE courses (id VARCHAR(50) PRIMARY KEY, title VARCHAR(255), created_by VARCHAR(50));
    CREATE TABLE curriculum_items (id VARCHAR(50) PRIMARY KEY, course_id VARCHAR(50) NOT NULL, parent_id VARCHAR(50), title VARCHAR(255) NOT NULL,
      type VARCHAR(20) NOT NULL, exam_id VARCHAR(50), order_index INT DEFAULT 0, created_by VARCHAR(50), created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP);
    CREATE TABLE slot_requests (id VARCHAR(50) PRIMARY KEY, teacher_id VARCHAR(50) NOT NULL, teacher_name VARCHAR(100) NOT NULL, teacher_email VARCHAR(100) NOT NULL,
      requested_slots INTEGER NOT NULL, total_cost NUMERIC(12,2) NOT NULL, status VARCHAR(20) DEFAULT 'PENDING', created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP);
  `);

  for (const m of ["006-lessons", "014-ai-usage", "016-slot-orders"]) {
    await h.pg.db.exec(read(`docs/db-migration-${m}.sql`));
  }

  // Tỷ giá quy đổi trong test: 25.000 VND / USD
  await h.pg.db.query(
    `UPDATE system_settings SET value=$1::jsonb WHERE key='ai_pricing'`,
    [JSON.stringify({ usd_vnd_rate: 25000, models: { "gemini-2.5-flash": { input_per_1m: 1, output_per_1m: 2 } } })]
  );

  // 1. Seed người dùng:
  // - t1: Cô Lan (VERIFIED, slot_limit = 20)
  // - t2: Thầy Minh (TRIAL, slot_limit = 0)
  // - t3: GV Số Không (NULL status, slot_limit = 15, không gọi AI)
  // - s1, s2: Học sinh
  // - a1: Admin
  await h.pg.db.exec(`
    INSERT INTO users (id, name, email, role, teacher_status, slot_limit) VALUES
      ('a1', 'Admin Hệ Thống', 'admin@x.vn', 'ADMIN', NULL, 0),
      ('t1', 'Cô Lan', 'lan@x.vn', 'TEACHER', 'VERIFIED', 20),
      ('t2', 'Thầy Minh', 'minh@x.vn', 'TEACHER', 'TRIAL', 0),
      ('t3', 'GV Số Không', 'zero@x.vn', 'TEACHER', NULL, 15),
      ('s1', 'Học sinh 1', 'hs1@x.vn', 'STUDENT', NULL, 0),
      ('s2', 'Học sinh 2', 'hs2@x.vn', 'STUDENT', NULL, 0);
  `);

  // 2. Seed lớp & học sinh (BR-S01):
  // s1 ghi danh CẢ c1 và c2 của t1. s2 ở c1.
  // -> t1 chỉ dùng 2 slots (2 học sinh khác nhau), dù tổng sĩ số 2 lớp là 3.
  await h.pg.db.exec(`
    INSERT INTO classes (id, name, code, teacher_id, max_slots) VALUES
      ('c1', 'Lớp 10A', 'L10A', 't1', 30),
      ('c2', 'Lớp 10B', 'L10B', 't1', 30);
    INSERT INTO enrollments (id, student_id, class_id) VALUES
      ('enr1', 's1', 'c1'),
      ('enr2', 's1', 'c2'),
      ('enr3', 's2', 'c1');
  `);

  // 3. Seed đơn mua slot (tiêu chí: revenue_vnd chỉ tính APPROVED có decided_at trong tháng):
  // - r1: APPROVED trong tháng 11 -> 200.000 đ
  // - r2: APPROVED trong tháng 10 -> 500.000 đ (tháng trước -> không tính)
  // - r3: PENDING trong tháng 11 -> 100.000 đ (không tính)
  // - r4: REJECTED trong tháng 11 -> 100.000 đ (không tính)
  // - r5: CANCELLED trong tháng 11 -> 100.000 đ (không tính)
  await h.pg.db.query(`
    INSERT INTO slot_requests (id, teacher_id, teacher_name, teacher_email, requested_slots, total_cost, status, code, decided_at) VALUES
      ('r1', 't1', 'Cô Lan', 'lan@x.vn', 10, 200000, 'APPROVED', 'KK00000001', $1),
      ('r2', 't1', 'Cô Lan', 'lan@x.vn', 20, 500000, 'APPROVED', 'KK00000002', $2),
      ('r3', 't1', 'Cô Lan', 'lan@x.vn', 5, 100000, 'PENDING', 'KK00000003', NULL),
      ('r4', 't1', 'Cô Lan', 'lan@x.vn', 5, 100000, 'REJECTED', 'KK00000004', $1),
      ('r5', 't1', 'Cô Lan', 'lan@x.vn', 5, 100000, 'CANCELLED', 'KK00000005', $1);
  `, [IN_NOV_MID, IN_OCT_LATE]);

  // 4. Seed AI usage logs:
  // t1: ĐỦ 60 LOGS trong tháng 11:
  // - 40 logs EXAM_GRADING: prompt 1000, comp 500, total 1500, cost_usd 0.01 (tổng tokens 60.000, cost_usd 0.40 -> 10.000 đ)
  // - 10 logs LESSON_GRADING: prompt 2000, comp 1000, total 3000, cost_usd 0.02 (tổng tokens 30.000, cost_usd 0.20 -> 5.000 đ)
  // - 5 logs EXAM_IMPORT: prompt 5000, comp 0, total 5000, cost_usd 0.05 (tổng tokens 25.000, cost_usd 0.25 -> 6.250 đ)
  // - 5 logs OTHER: prompt 1000, comp 0, total 1000, cost_usd 0.01 (tổng tokens 5.000, cost_usd 0.05 -> 1.250 đ)
  // Tổng cộng t1: 60 logs, prompt 90.000, comp 30.000, total 120.000 tokens, cost_usd 0.90 -> cost_vnd = 22.500 đ.
  // Doanh thu t1: 200.000 đ. Chênh lệch: 200.000 - 22.500 = 177.500 đ.
  for (let i = 1; i <= 40; i++) {
    await h.pg.db.query(
      `INSERT INTO ai_usage_logs (id, purpose, model, teacher_id, prompt_tokens, completion_tokens, total_tokens, cost_usd, created_at)
       VALUES ($1, 'EXAM_GRADING', 'gemini-2.5-flash', 't1', 1000, 500, 1500, 0.01, $2)`,
      [`log-t1-eg-${i}`, IN_NOV_MID]
    );
  }
  for (let i = 1; i <= 10; i++) {
    await h.pg.db.query(
      `INSERT INTO ai_usage_logs (id, purpose, model, teacher_id, prompt_tokens, completion_tokens, total_tokens, cost_usd, created_at)
       VALUES ($1, 'LESSON_GRADING', 'gemini-2.5-flash', 't1', 2000, 1000, 3000, 0.02, $2)`,
      [`log-t1-lg-${i}`, IN_NOV_MID]
    );
  }
  for (let i = 1; i <= 5; i++) {
    await h.pg.db.query(
      `INSERT INTO ai_usage_logs (id, purpose, model, teacher_id, prompt_tokens, completion_tokens, total_tokens, cost_usd, created_at)
       VALUES ($1, 'EXAM_IMPORT', 'gemini-2.5-flash', 't1', 5000, 0, 5000, 0.05, $2)`,
      [`log-t1-ei-${i}`, IN_NOV_MID]
    );
  }
  for (let i = 1; i <= 5; i++) {
    await h.pg.db.query(
      `INSERT INTO ai_usage_logs (id, purpose, model, teacher_id, prompt_tokens, completion_tokens, total_tokens, cost_usd, created_at)
       VALUES ($1, 'OTHER', 'gemini-2.5-flash', 't1', 1000, 0, 1000, 0.01, $2)`,
      [`log-t1-ot-${i}`, IN_NOV_MID]
    );
  }

  // t2: 2 logs EXAM_GRADING trong tháng 11:
  // prompt 100.000, comp 50.000, total 150.000, cost_usd 1.0 mỗi log.
  // Tổng t2: 2 requests, 300.000 tokens, cost_usd 2.0 -> cost_vnd = 50.000 đ.
  // Doanh thu t2: 0 đ -> chênh lệch = -50.000 đ (âm).
  await h.pg.db.query(
    `INSERT INTO ai_usage_logs (id, purpose, model, teacher_id, prompt_tokens, completion_tokens, total_tokens, cost_usd, created_at) VALUES
     ('log-t2-1', 'EXAM_GRADING', 'gemini-2.5-flash', 't2', 100000, 50000, 150000, 1.0, $1),
     ('log-t2-2', 'EXAM_GRADING', 'gemini-2.5-flash', 't2', 100000, 50000, 150000, 1.0, $1)`,
    [IN_NOV_MID]
  );

  // Unattributed: 2 logs có teacher_id IS NULL trong tháng 11
  // prompt 3000, comp 2000, total 5000, cost_usd 0.05 mỗi log.
  // Tổng: 10.000 tokens, cost_usd 0.10 -> 2.500 đ.
  await h.pg.db.query(
    `INSERT INTO ai_usage_logs (id, purpose, model, teacher_id, prompt_tokens, completion_tokens, total_tokens, cost_usd, created_at) VALUES
     ('log-un-1', 'EXAM_IMPORT', 'gemini-2.5-flash', NULL, 3000, 2000, 5000, 0.05, $1),
     ('log-un-2', 'EXAM_IMPORT', 'gemini-2.5-flash', NULL, 3000, 2000, 5000, 0.05, $1)`,
    [IN_NOV_MID]
  );

  // Ranh giới thời gian: log tháng 10 và tháng 12 của t1 KHÔNG được tính vào tháng 11
  await h.pg.db.query(
    `INSERT INTO ai_usage_logs (id, purpose, model, teacher_id, prompt_tokens, completion_tokens, total_tokens, cost_usd, created_at) VALUES
     ('log-t1-oct', 'EXAM_GRADING', 'gemini-2.5-flash', 't1', 99999, 99999, 199998, 10.0, $1),
     ('log-t1-dec', 'EXAM_GRADING', 'gemini-2.5-flash', 't1', 99999, 99999, 199998, 10.0, $2)`,
    [IN_OCT_LATE, IN_DEC_EARLY]
  );
});

// ─────────────────────────────────────────────────────────────────────────────
describe("1. lib/ai-usage-report.ts — Hàm getAiUsageReport", () => {
  it("trả về cấu trúc báo cáo đầy đủ, cộng đủ 60 log, lọc đúng tháng và tính đúng BR-S01 students_used", async () => {
    const { getAiUsageReport } = await import("@/lib/ai-usage-report");
    const report = await getAiUsageReport({ month: "2026-11" });

    expect(report.month).toBe("2026-11");
    expect(Array.isArray(report.teachers)).toBe(true);

    // Chỉ có các giáo viên (role = 'TEACHER'), không có học sinh s1 hay admin a1
    const teacherIds = report.teachers.map((t: any) => t.teacher_id);
    expect(teacherIds).toContain("t1");
    expect(teacherIds).toContain("t2");
    expect(teacherIds).toContain("t3");
    expect(teacherIds).not.toContain("a1");
    expect(teacherIds).not.toContain("s1");
    expect(teacherIds).not.toContain("s2");

    // Sắp xếp giảm dần theo cost_vnd: t2 (50.000 đ) > t1 (22.500 đ) > t3 (0 đ)
    expect(report.teachers[0].teacher_id).toBe("t2");
    expect(report.teachers[1].teacher_id).toBe("t1");
    expect(report.teachers[2].teacher_id).toBe("t3");

    // Chi tiết giáo viên t1 (có 60 log trong tháng 11)
    const t1 = report.teachers.find((t: any) => t.teacher_id === "t1");
    expect(t1).toBeDefined();
    expect(t1.name).toBe("Cô Lan");
    expect(t1.email).toBe("lan@x.vn");
    expect(t1.teacher_status).toBe("VERIFIED");
    expect(t1.slot_limit).toBe(20);

    // Tiêu chí: BR-S01 s1 học 2 lớp của t1 nhưng chỉ tính 1 slot -> students_used = 2 (s1 + s2)
    expect(t1.students_used).toBe(2);

    // Tiêu chí: Cộng đủ 60 log trong tháng (không bị giới hạn 50 dòng)
    expect(t1.requests).toBe(60);
    expect(t1.prompt_tokens).toBe(90000);
    expect(t1.completion_tokens).toBe(30000);
    expect(t1.total_tokens).toBe(120000);
    expect(t1.cost_vnd).toBe(22500);

    // Tiêu chí: Doanh thu chỉ tính đơn APPROVED có decided_at trong tháng -> 200.000 đ
    expect(t1.revenue_vnd).toBe(200000);
    // Chênh lệch margin_vnd = revenue_vnd - cost_vnd
    expect(t1.margin_vnd).toBe(177500);

    // Tiêu chí: by_purpose có đủ 4 mục và cộng lại bằng tổng
    expect(t1.by_purpose).toBeDefined();
    expect(t1.by_purpose.EXAM_GRADING).toEqual({ tokens: 60000, cost_vnd: 10000 });
    expect(t1.by_purpose.LESSON_GRADING).toEqual({ tokens: 30000, cost_vnd: 5000 });
    expect(t1.by_purpose.EXAM_IMPORT).toEqual({ tokens: 25000, cost_vnd: 6250 });
    expect(t1.by_purpose.OTHER).toEqual({ tokens: 5000, cost_vnd: 1250 });

    const purposeTokensSum =
      t1.by_purpose.EXAM_GRADING.tokens +
      t1.by_purpose.LESSON_GRADING.tokens +
      t1.by_purpose.EXAM_IMPORT.tokens +
      t1.by_purpose.OTHER.tokens;
    expect(purposeTokensSum).toBe(t1.total_tokens);

    const purposeCostSum =
      t1.by_purpose.EXAM_GRADING.cost_vnd +
      t1.by_purpose.LESSON_GRADING.cost_vnd +
      t1.by_purpose.EXAM_IMPORT.cost_vnd +
      t1.by_purpose.OTHER.cost_vnd;
    expect(purposeCostSum).toBe(t1.cost_vnd);

    // Chi tiết giáo viên t2 (chênh lệch âm, slot_limit = 0)
    const t2 = report.teachers.find((t: any) => t.teacher_id === "t2");
    expect(t2).toBeDefined();
    expect(t2.name).toBe("Thầy Minh");
    expect(t2.teacher_status).toBe("TRIAL");
    expect(t2.slot_limit).toBe(0); // 0 trong DB là 0, không fallback 250
    expect(t2.students_used).toBe(0);
    expect(t2.requests).toBe(2);
    expect(t2.total_tokens).toBe(300000);
    expect(t2.cost_vnd).toBe(50000);
    expect(t2.revenue_vnd).toBe(0);
    expect(t2.margin_vnd).toBe(-50000); // Âm 50.000 đ

    // Tiêu chí: Giáo viên không có log (t3) vẫn có dòng với số 0
    const t3 = report.teachers.find((t: any) => t.teacher_id === "t3");
    expect(t3).toBeDefined();
    expect(t3.name).toBe("GV Số Không");
    expect(t3.requests).toBe(0);
    expect(t3.prompt_tokens).toBe(0);
    expect(t3.completion_tokens).toBe(0);
    expect(t3.total_tokens).toBe(0);
    expect(t3.cost_vnd).toBe(0);
    expect(t3.revenue_vnd).toBe(0);
    expect(t3.margin_vnd).toBe(0);
    expect(t3.by_purpose.EXAM_GRADING.tokens).toBe(0);
    expect(t3.by_purpose.EXAM_GRADING.cost_vnd).toBe(0);

    // Tiêu chí: Log teacher_id NULL vào unattributed
    expect(report.unattributed).toBeDefined();
    const unTokens = report.unattributed.tokens ?? report.unattributed.total_tokens;
    expect(unTokens).toBe(10000);
    expect(report.unattributed.cost_vnd).toBe(2500);
  });

  it("không truyền month hoặc để trống thì mặc định lấy tháng hiện tại (UTC)", async () => {
    const { getAiUsageReport } = await import("@/lib/ai-usage-report");
    const report = await (getAiUsageReport as any)();
    expect(report.month).toMatch(/^\d{4}-\d{2}$/);
    expect(Array.isArray(report.teachers)).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe("2. GET /api/admin/ai-usage — Phân quyền, tham số & định dạng CSV", () => {
  const getAiUsageRoute = async (qs = "") =>
    (await import("@/app/api/admin/ai-usage/route")).GET(get(`/api/admin/ai-usage${qs}`));

  it("chưa đăng nhập trả 401; TEACHER hoặc STUDENT trả 403", async () => {
    expect((await getAiUsageRoute()).status).toBe(401);

    await loginAs("TEACHER", "t1");
    expect((await getAiUsageRoute()).status).toBe(403);

    await loginAs("STUDENT", "s1");
    expect((await getAiUsageRoute()).status).toBe(403);
  });

  it("tháng sai định dạng (month=2026-13, 2026-0, abc, 11-2026) → 400", async () => {
    await loginAs("ADMIN", "a1");
    for (const badMonth of ["2026-13", "2026-0", "abc", "11-2026", "2026-00"]) {
      const res = await getAiUsageRoute(`?month=${badMonth}`);
      expect(res.status, badMonth).toBe(400);
      const json = await res.json();
      expect(json.success).toBe(false);
    }
  });

  it("ADMIN tải báo cáo thành công (JSON)", async () => {
    await loginAs("ADMIN", "a1");
    const res = await getAiUsageRoute("?month=2026-11");
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.month).toBe("2026-11");
    expect(json.teachers.length).toBe(3);
  });

  it("format=csv trả text/csv; charset=utf-8 có BOM, header Content-Disposition và cột tiếng Việt", async () => {
    await loginAs("ADMIN", "a1");
    const res = await getAiUsageRoute("?month=2026-11&format=csv");
    expect(res.status).toBe(200);

    // Header Content-Type
    const contentType = res.headers.get("Content-Type") || "";
    expect(contentType.toLowerCase()).toContain("text/csv");
    expect(contentType.toLowerCase()).toContain("utf-8");

    // Header Content-Disposition
    const disposition = res.headers.get("Content-Disposition") || "";
    expect(disposition).toContain("attachment");
    expect(disposition).toContain('filename="ai-usage-2026-11.csv"');

    // Tiêu chí: Có UTF-8 BOM (EF BB BF). Response.text() tự bỏ BOM nên kiểm trên byte.
    const bytes = new Uint8Array(await res.clone().arrayBuffer());
    expect([bytes[0], bytes[1], bytes[2]]).toEqual([0xef, 0xbb, 0xbf]);
    const text = await res.text();

    // Tiêu chí: Cột tiếng Việt
    const lines = text.trim().split("\n");
    const headerLine = lines[0];
    expect(headerLine).toMatch(/Giáo viên|Tên/i);
    expect(headerLine).toMatch(/Email/i);
    expect(headerLine).toMatch(/Token|Chi phí/i);

    // Đủ số dòng giáo viên (t1, t2, t3)
    expect(text).toContain("lan@x.vn");
    expect(text).toContain("minh@x.vn");
    expect(text).toContain("zero@x.vn");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe("3. GET /api/admin/teachers/[id] — Số liệu chi tiết giáo viên", () => {
  const getTeacherDetail = async (id: string) =>
    (await import("@/app/api/admin/teachers/[id]/route")).GET(get(`/api/admin/teachers/${id}`), ctx(id));

  it("trả ai_totals (SQL SUM trên toàn bộ log mọi tháng) và students_used theo BR-S01", async () => {
    await loginAs("ADMIN", "a1");
    const res = await getTeacherDetail("t1");
    expect(res.status).toBe(200);
    const json = await res.json();

    expect(json.success).toBe(true);
    // Danh sách 50 log gần nhất vẫn giữ nguyên (LIMIT 50)
    expect(json.aiLogs.length).toBe(50);

    // Tiêu chí: ai_totals cộng toàn bộ 60 log của giáo viên bằng SQL SUM
    expect(json.ai_totals).toBeDefined();
    // ai_totals = toàn bộ log của t1 mọi tháng (brief §4), không phải 50 dòng hiển thị
    const all = (await h.pg.db.query(
      `SELECT COUNT(*)::int AS n, COALESCE(SUM(total_tokens),0)::int AS tok FROM ai_usage_logs WHERE teacher_id = 't1'`
    )).rows[0] as { n: number; tok: number };
    expect(all.n).toBeGreaterThan(50);
    expect(json.ai_totals.requests).toBe(all.n);
    expect(json.ai_totals.total_tokens).toBe(all.tok);
    expect(json.ai_totals.cost_vnd).toBeGreaterThanOrEqual(22500);

    // Tiêu chí: students_used theo BR-S01 (s1 học 2 lớp của t1 chỉ tính 1 slot -> 2 học sinh)
    expect(json.students_used).toBe(2);
  });

  it("giáo viên có slot_limit = 0 trong DB giữ nguyên 0, không fallback 250", async () => {
    await loginAs("ADMIN", "a1");
    const res = await getTeacherDetail("t2");
    expect(res.status).toBe(200);
    const json = await res.json();

    expect(json.teacher.slot_limit).toBe(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe("4. Giao diện & Menu quản trị (AdminLayout & Pages)", () => {
  it("components/AdminLayout.tsx: menu 'Chi phí AI' (icon Coins) đặt sau 'Tổng quan'", () => {
    const s = read("components/AdminLayout.tsx");
    expect(s).toContain("/admin/ai-usage");
    expect(s).toContain("Chi phí AI");
    expect(s).toMatch(/Coins/);

    // Đặt ngay sau Tổng quan
    const hrefs = [...s.matchAll(/href:\s*["'](\/admin[^"']*)["']/g)].map((m) => m[1]);
    const overviewIdx = hrefs.indexOf("/admin");
    const aiUsageIdx = hrefs.indexOf("/admin/ai-usage");
    expect(overviewIdx).toBeGreaterThanOrEqual(0);
    expect(aiUsageIdx).toBe(overviewIdx + 1);
  });

  it("app/admin/ai-usage/page.tsx: Client component đủ 4 thẻ tổng, bộ chọn tháng, ô tìm kiếm, nút xuất CSV", () => {
    expect(fs.existsSync("app/admin/ai-usage/page.tsx")).toBe(true);
    const s = read("app/admin/ai-usage/page.tsx");
    expect(s.trimStart().startsWith('"use client"')).toBe(true);

    // 4 thẻ tổng: token, chi phí, doanh thu, chênh lệch
    for (const kw of ["token", "chi phí", "doanh thu", "chênh lệch"]) {
      expect(s.toLowerCase(), `Thiếu thẻ ${kw}`).toContain(kw);
    }

    // Bộ chọn tháng, ô tìm kiếm, nút xuất CSV
    expect(s).toMatch(/month|tháng/i);
    expect(s).toMatch(/format=csv|xuất csv/i);
    expect(s).toMatch(/search|tìm/i);

    // Đường dẫn tới chi tiết giáo viên
    expect(s).toMatch(/\/admin\/teachers\//);

    // Định dạng tiền tệ vi-VN
    expect(s).toMatch(/vi-VN/);

    // 4 trạng thái: đang tải, lỗi, rỗng, có dữ liệu
    expect(s).toMatch(/loading|đang tải/i);
  });

  it("app/admin/teachers/[id]/page.tsx: bỏ '100% REAL', bỏ fallback 250, dùng ai_totals và students_used từ server", () => {
    const s = read("app/admin/teachers/[id]/page.tsx");

    // Đã bỏ chú thích "100% REAL"
    expect(s).not.toContain("100% REAL");

    // Đã bỏ tính tổng chỉ từ 50 aiLogs ở client
    expect(s).not.toMatch(/aiLogs\.reduce/);

    // Đã bỏ tính slot dùng bằng cách cộng dồn sĩ số các lớp
    expect(s).not.toMatch(/classes\.reduce\(\s*\([^)]*\)\s*=>\s*[^}]*student_count/);

    // Bỏ fallback slot_limit || 250
    expect(s).not.toMatch(/slot_limit\s*\|\|\s*250/);
    expect(s).not.toMatch(/slotLimit\s*\|\|\s*250/);

    // Dùng ai_totals và students_used
    expect(s).toMatch(/ai_totals/);
    // FEAT-015 (TASK-054): khối "Slot Capacity" thay bằng Ví slot → không còn hiển thị students_used ở trang này
    expect(s).toMatch(/slot-wallet/);
  });
});
