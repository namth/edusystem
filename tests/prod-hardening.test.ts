// TASK-032 — Vá lỗi chặn production: quyền xem đề, bỏ điểm AI giả, gỡ route chẩn đoán, giới hạn đăng nhập.
// File do trưởng phòng viết, bị khoá. Phân quyền theo vai trò của teacher/courses nằm ở tests/api-auth.test.ts.
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import fs from "fs";
import { createFakePg } from "./helpers/pg-fake";

const h = vi.hoisted(() => {
  process.env.JWT_SECRET = "test_secret_for_vitest_only_0123456789abcdef";
  return { token: undefined as string | undefined, pg: null as any };
});

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (n: string) => (n === "auth_token" && h.token ? { value: h.token } : undefined),
    set: (n: string, v: string) => { if (n === "auth_token") h.token = v; },
    delete: () => { h.token = undefined; },
  }),
}));
vi.mock("@/lib/db-pg", () => ({
  queryPg: (sql: string, params?: unknown[]) => h.pg.queryPg(sql, params),
  ensureSchema: async () => {},
}));

import { signJwtToken } from "@/lib/jwt";
import { hashPassword } from "@/lib/auth";

async function loginAs(role: "ADMIN" | "TEACHER" | "STUDENT" | null, userId?: string) {
  h.token = role ? await signJwtToken({ userId: userId!, email: `${userId}@x.vn`, role }) : undefined;
}
const ctx = (id: string) => ({ params: Promise.resolve({ id }) });
const get = (url: string) => new Request(`http://localhost${url}`);
const post = (url: string, body: unknown, ip = "1.1.1.1") =>
  new Request(`http://localhost${url}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-forwarded-for": ip },
    body: JSON.stringify(body),
  });

const examMeta = async (id: string) => (await import("@/app/api/exams/[id]/route")).GET(get(`/api/exams/${id}`), ctx(id));
const examContent = async (id: string) =>
  (await import("@/app/api/exams/[id]/content/route")).GET(get(`/api/exams/${id}/content`), ctx(id));

beforeEach(async () => {
  h.token = undefined;
  h.pg = await createFakePg();
  await h.pg.db.exec(`
    ALTER TABLE exams ADD COLUMN IF NOT EXISTS description TEXT;
    ALTER TABLE users ADD COLUMN must_change_password BOOLEAN DEFAULT FALSE;
    ALTER TABLE users ADD COLUMN last_login_at TIMESTAMPTZ;
    ALTER TABLE users ADD COLUMN reset_token TEXT;
    ALTER TABLE users ADD COLUMN reset_token_expires TIMESTAMPTZ;
    INSERT INTO exams (id,title,duration_minutes,skills,question_ids,created_by,description,stimulus_text) VALUES
      ('eMine','Đề của t1',30,ARRAY['Reading'],'["q1"]','t1','mô tả','bài đọc'),
      ('eOther','Đề của t2',20,ARRAY['Listening'],'["q1"]','t2',NULL,NULL),
      ('eSys','Đề hệ thống',45,ARRAY['Reading'],'["q1"]',NULL,NULL,NULL);
    INSERT INTO questions (id,skill,category,content) VALUES
      ('q1','Reading','READING_MC','{"type":"READING_MC","questions":[{"id":"a","prompt":"?","options":["A","B"],"answer":"A"}]}');
  `);
});

describe("GET /api/exams/[id] — quyền xem thông tin đề", () => {
  it("TEACHER xem đề của mình và đề hệ thống (created_by NULL) → 200; đề của GV khác → 403", async () => {
    await loginAs("TEACHER", "t1");
    expect((await examMeta("eMine")).status).toBe(200);
    expect((await examMeta("eSys")).status).toBe(200);
    expect((await examMeta("eOther")).status).toBe(403);
  });

  it("ADMIN xem mọi đề", async () => {
    await loginAs("ADMIN", "a1");
    expect((await examMeta("eOther")).status).toBe(200);
  });

  it("STUDENT chỉ nhận trường hiển thị trang bắt đầu (không question_ids, stimulus, created_by)", async () => {
    await loginAs("STUDENT", "s1");
    const res = await examMeta("eMine");
    expect(res.status).toBe(200);
    const { exam } = await res.json();
    expect(exam).toMatchObject({ id: "eMine", title: "Đề của t1", duration_minutes: 30, skills: ["Reading"], question_count: 1 });
    const allowed = ["id", "title", "description", "duration_minutes", "skills", "passing_score", "question_count"];
    for (const k of Object.keys(exam)) expect(allowed, `trường lộ ra: ${k}`).toContain(k);
  });

  it("đề không tồn tại → 404 với mọi vai trò", async () => {
    await loginAs("STUDENT", "s1");
    expect((await examMeta("nope")).status).toBe(404);
    await loginAs("TEACHER", "t1");
    expect((await examMeta("nope")).status).toBe(404);
  });
});

describe("GET /api/exams/[id]/content — nội dung kèm đáp án chỉ cho chủ đề", () => {
  it("STUDENT → 403 (học sinh lấy nội dung qua /api/student/exams/[examId]/content)", async () => {
    await loginAs("STUDENT", "s1");
    expect((await examContent("eMine")).status).toBe(403);
  });

  it("TEACHER: đề của mình / hệ thống → 200; của GV khác → 403", async () => {
    await loginAs("TEACHER", "t1");
    expect((await examContent("eMine")).status).toBe(200);
    expect((await examContent("eSys")).status).toBe(200);
    expect((await examContent("eOther")).status).toBe(403);
  });

  it("ADMIN → 200", async () => {
    await loginAs("ADMIN", "a1");
    expect((await examContent("eOther")).status).toBe(200);
  });
});

describe("Không còn điểm AI giả lập và route chẩn đoán", () => {
  it("gỡ admin/test-db, admin/test-supabase", () => {
    expect(fs.existsSync("app/api/admin/test-db/route.ts")).toBe(false);
    expect(fs.existsSync("app/api/admin/test-supabase/route.ts")).toBe(false);
  });

  it("lib/portkey.ts không còn nhánh giả lập điểm", () => {
    const s = fs.readFileSync("lib/portkey.ts", "utf8");
    expect(s).not.toMatch(/Band score 7\.5/);
    expect(s).not.toMatch(/isSimulated/);
    expect(s).not.toMatch(/student_01/);
  });

  it("thiếu PORTKEY_API_KEY → callPortkeyGrading ném lỗi, không ghi log dùng AI", async () => {
    const saved = process.env.PORTKEY_API_KEY;
    delete process.env.PORTKEY_API_KEY;
    try {
      const { callPortkeyGrading } = await import("@/lib/portkey");
      await expect(callPortkeyGrading({ userPrompt: "x", teacherId: "t1" })).rejects.toThrow();
      expect(h.pg.calls.some((c: any) => /ai_usage_logs/i.test(c.sql) && /INSERT/i.test(c.sql))).toBe(false);
    } finally {
      if (saved !== undefined) process.env.PORTKEY_API_KEY = saved;
    }
  });

  it("POST /api/admin/test-portkey khi gateway lỗi → 502 success:false kèm thông báo", async () => {
    const saved = process.env.PORTKEY_API_KEY;
    delete process.env.PORTKEY_API_KEY;
    try {
      await loginAs("ADMIN", "a1");
      const res = await (await import("@/app/api/admin/test-portkey/route")).POST(post("/api/admin/test-portkey", { teacherId: "t1" }));
      expect(res.status).toBe(502);
      const json = await res.json();
      expect(json.success).toBe(false);
      expect(typeof json.error).toBe("string");
    } finally {
      if (saved !== undefined) process.env.PORTKEY_API_KEY = saved;
    }
  });

  it("trang admin chi tiết GV không còn nhánh 'Simulation'", () => {
    const s = fs.readFileSync("app/admin/teachers/[id]/page.tsx", "utf8");
    expect(s).not.toMatch(/isSimulated/);
    expect(s).not.toMatch(/student_01/);
  });
});

describe("Giới hạn số lần thử — đăng nhập / quên mật khẩu", () => {
  const login = async (identifier: string, password: string, ip?: string) =>
    (await import("@/app/api/auth/login/route")).POST(post("/api/auth/login", { identifier, password }, ip));
  const forgot = async (email: string, ip?: string) =>
    (await import("@/app/api/auth/forgot-password/route")).POST(post("/api/auth/forgot-password", { email }, ip));

  beforeEach(async () => {
    (await import("@/lib/rate-limit")).resetRateLimits();
    await h.pg.db.query(
      `INSERT INTO users (id,name,email,role,password) VALUES ('s1','HS','hs@x.vn','STUDENT',$1), ('s2','HS2','hs2@x.vn','STUDENT',$1)`,
      [hashPassword("DungRoi@123")]
    );
  });
  afterEach(() => { vi.useRealTimers(); });

  it("sai 10 lần liên tiếp → lần thứ 11 bị 429 kể cả đúng mật khẩu, có Retry-After", async () => {
    for (let i = 0; i < 10; i++) expect((await login("hs@x.vn", "Sai@1234")).status).toBe(401);
    const res = await login("hs@x.vn", "DungRoi@123");
    expect(res.status).toBe(429);
    expect(Number(res.headers.get("retry-after"))).toBeGreaterThan(0);
    const json = await res.json();
    expect(json.success).toBe(false);
    expect(typeof json.error).toBe("string");
  });

  it("đếm theo tài khoản: đổi IP không lách được; tài khoản khác không bị ảnh hưởng", async () => {
    for (let i = 0; i < 10; i++) await login("HS@x.vn", "Sai@1234", `9.9.9.${i}`);
    expect((await login("hs@x.vn", "DungRoi@123", "8.8.8.8")).status).toBe(429);
    expect((await login("hs2@x.vn", "DungRoi@123")).status).toBe(200);
  });

  it("đăng nhập đúng trước khi chạm ngưỡng → xoá bộ đếm", async () => {
    for (let i = 0; i < 9; i++) await login("hs@x.vn", "Sai@1234");
    expect((await login("hs@x.vn", "DungRoi@123")).status).toBe(200);
    for (let i = 0; i < 9; i++) expect((await login("hs@x.vn", "Sai@1234")).status).toBe(401);
    expect((await login("hs@x.vn", "DungRoi@123")).status).toBe(200);
  });

  it("hết cửa sổ 15 phút → được thử lại", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-11-01T08:00:00Z"));
    for (let i = 0; i < 10; i++) await login("hs@x.vn", "Sai@1234");
    expect((await login("hs@x.vn", "DungRoi@123")).status).toBe(429);
    vi.setSystemTime(new Date("2026-11-01T08:16:00Z"));
    expect((await login("hs@x.vn", "DungRoi@123")).status).toBe(200);
  });

  it("quên mật khẩu: tối đa 5 yêu cầu / 15 phút cho một email → lần 6 bị 429", async () => {
    for (let i = 0; i < 5; i++) expect((await forgot("hs@x.vn", `7.7.7.${i}`)).status).toBe(200);
    expect((await forgot("hs@x.vn")).status).toBe(429);
    expect((await forgot("hs2@x.vn")).status).toBe(200);
  });
});
