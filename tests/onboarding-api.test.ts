// TASK-035 — FEAT-012: đăng ký học sinh không cần email (tên đăng nhập + email tạm @kito.io.vn),
// đăng ký giáo viên dùng thử kèm khảo sát, đăng nhập bằng tên đăng nhập, đổi email tạm.
// File do trưởng phòng viết, bị khoá.
/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from "vitest";
import fs from "fs";
import { createFakePg } from "./helpers/pg-fake";

const h = vi.hoisted(() => {
  process.env.JWT_SECRET = "test_secret_for_vitest_only_0123456789abcdef";
  return { token: undefined as string | undefined, pg: null as any, cookiesSet: [] as string[] };
});

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (n: string) => (n === "auth_token" && h.token ? { value: h.token } : undefined),
    set: (n: string) => h.cookiesSet.push(n),
  }),
  headers: async () => new Headers(),
}));
vi.mock("@/lib/db-pg", () => ({
  queryPg: (sql: string, params?: unknown[]) => h.pg.queryPg(sql, params),
  // FEAT-015: ghi danh cần transaction (chargeEnrollment) → pool giả chạy thẳng trên PGlite
  getPgPool: () => ({ connect: async () => ({ query: (s: string, p?: unknown[]) => h.pg.queryPg(s, p), release: () => {} }) }),
  ensureSchema: async () => {},
}));
vi.mock("@/lib/neo4j", () => ({
  syncStudentEnrolledInClass: async () => {},
  runCypherQuery: async () => [],
}));

import { signJwtToken } from "@/lib/jwt";
import { hashPassword } from "@/lib/auth";

const req = (url: string, body: unknown, ip = "9.9.9.9", method = "POST") =>
  new Request(`http://localhost${url}`, {
    method,
    headers: { "Content-Type": "application/json", "x-forwarded-for": ip },
    body: JSON.stringify(body),
  });
const registerStudent = async (body: unknown, ip?: string) =>
  (await import("@/app/api/auth/register/route")).POST(req("/api/auth/register", body, ip));
const registerTeacher = async (body: unknown, ip?: string) =>
  (await import("@/app/api/auth/register/teacher/route")).POST(req("/api/auth/register/teacher", body, ip));
const login = async (identifier: string, password: string) =>
  (await import("@/app/api/auth/login/route")).POST(req("/api/auth/login", { identifier, password }));
const usernameAvailable = async (u: string, ip = "9.9.9.9") =>
  (await import("@/app/api/auth/username-available/route")).GET(
    new Request(`http://localhost/api/auth/username-available?u=${encodeURIComponent(u)}`, { headers: { "x-forwarded-for": ip } })
  );
const forgot = async (email: string) =>
  (await import("@/app/api/auth/forgot-password/route")).POST(req("/api/auth/forgot-password", { email }));
const profilePut = async (body: unknown) =>
  (await import("@/app/api/profile/route")).PUT(req("/api/profile", body, "9.9.9.9", "PUT"));

const rows = async (sql: string, params: unknown[] = []) => (await h.pg.db.query(sql, params)).rows as any[];
const userBy = async (where: string, v: string) => (await rows(`SELECT * FROM users WHERE ${where} = $1`, [v]))[0];

const studentNoEmail = (over: Record<string, unknown> = {}) => ({
  name: "Nguyễn Văn An",
  gradeLevel: "G7",
  goals: { subjects: ["english"], englishGoal: "CAMBRIDGE" },
  hasEmail: false,
  username: "an.nguyen24",
  password: "matkhau1",
  ...over,
});
const studentWithEmail = (over: Record<string, unknown> = {}) => ({
  name: "Trần Bình",
  gradeLevel: "G10",
  goals: { subjects: ["english"], englishGoal: "IELTS", targetScore: "6.5" },
  hasEmail: true,
  email: "Binh.Tran@Gmail.com",
  password: "matkhau1",
  ...over,
});
const teacherBody = (over: Record<string, unknown> = {}) => ({
  honorific: "CO",
  name: "Cô Lan",
  subjects: ["english"],
  levels: ["PRIMARY", "LOWER_SECONDARY"],
  workplaceType: "CENTER",
  workplaceName: "Trung tâm Ánh Dương",
  studentCount: "R10_50",
  needs: ["AI_GRADING", "AUTHORING"],
  source: "FACEBOOK",
  phone: "0912 345 678",
  email: "co.lan@gmail.com",
  password: "matkhau123",
  ...over,
});

beforeEach(async () => {
  h.token = undefined;
  h.cookiesSet.length = 0;
  h.pg = await createFakePg([
    "db-migration-004-enrollments-assignments.sql",
    "db-migration-010-notifications.sql",
    "db-migration-013-onboarding.sql",
  ]);
  await h.pg.db.exec(`
    ALTER TABLE users ADD COLUMN IF NOT EXISTS slot_limit INT DEFAULT 250;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN DEFAULT FALSE;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_token TEXT;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_token_expires TIMESTAMPTZ;
  `);
  (await import("@/lib/rate-limit")).resetRateLimits();
});

describe("Migration 013", () => {
  it("thêm cột users + bảng teacher_profiles; chạy lại không lỗi; ensureSchema có cùng DDL", async () => {
    const sql = fs.readFileSync("docs/db-migration-013-onboarding.sql", "utf8");
    await h.pg.db.exec(sql); // chạy lần 2
    const cols = (await rows(`SELECT column_name FROM information_schema.columns WHERE table_name = 'users'`)).map((r) => r.column_name);
    for (const c of ["username", "email_is_placeholder", "grade_level", "learning_goals", "teacher_status"]) expect(cols).toContain(c);
    const tp = (await rows(`SELECT column_name FROM information_schema.columns WHERE table_name = 'teacher_profiles'`)).map((r) => r.column_name);
    for (const c of ["user_id", "answers", "reviewed_by", "reviewed_at", "review_note", "created_at"]) expect(tp).toContain(c);
    const ens = fs.readFileSync("lib/db-pg.ts", "utf8");
    expect(ens).toMatch(/teacher_profiles/);
    expect(ens).toMatch(/email_is_placeholder/);
  });

  it("username duy nhất không phân biệt hoa thường", async () => {
    await h.pg.db.query(`INSERT INTO users (id, name, email, username) VALUES ('a','A','a@x.vn','Bao.Le')`);
    await expect(h.pg.db.query(`INSERT INTO users (id, name, email, username) VALUES ('b','B','b@x.vn','bao.le')`)).rejects.toThrow();
  });

  it("giáo viên có sẵn được gán VERIFIED", async () => {
    const pg = await createFakePg();
    await pg.db.query(`INSERT INTO users (id, name, email, role) VALUES ('t0','T','t0@x.vn','TEACHER'), ('s0','S','s0@x.vn','STUDENT')`);
    await pg.db.exec(`ALTER TABLE users DROP COLUMN teacher_status;`);
    await pg.db.exec(fs.readFileSync("docs/db-migration-013-onboarding.sql", "utf8"));
    const r = (await pg.db.query(`SELECT id, teacher_status FROM users ORDER BY id`)).rows as any[];
    expect(r.find((x) => x.id === "t0").teacher_status).toBe("VERIFIED");
    expect(r.find((x) => x.id === "s0").teacher_status).toBeNull();
  });
});

describe("lib/onboarding — tiện ích dùng chung (không phụ thuộc server)", () => {
  it("không import module server", () => {
    const s = fs.readFileSync("lib/onboarding.ts", "utf8");
    expect(s).not.toMatch(/db-pg|next\/headers|from "crypto"|node:/);
  });

  it("validateUsername / normalizeUsername / tên cấm", async () => {
    const o = await import("@/lib/onboarding");
    expect(o.normalizeUsername("  An.Nguyen ")).toBe("an.nguyen");
    expect(o.validateUsername("an.nguyen24")).toBeNull();
    for (const bad of ["ab", "1abc", "an nguyen", "an-nguyen", "ăn.nguyen", "a".repeat(31), "admin", "kitokit"]) {
      expect(o.validateUsername(bad), bad).toEqual(expect.any(String));
    }
  });

  it("usernameBaseFromName bỏ dấu, đ→d, dạng tên.họ; gợi ý đều hợp lệ", async () => {
    const o = await import("@/lib/onboarding");
    expect(o.usernameBaseFromName("Nguyễn Văn An")).toBe("an.nguyen");
    expect(o.usernameBaseFromName("Đặng Đức")).toBe("duc.dang");
    const s = o.suggestUsernames("an.nguyen", 5);
    expect(s.length).toBe(5);
    expect(new Set(s).size).toBe(5);
    for (const u of s) {
      expect(o.validateUsername(u)).toBeNull();
      expect(u.startsWith("an.nguyen")).toBe(true);
    }
  });

  it("email tạm theo đuôi kito.io.vn", async () => {
    const o = await import("@/lib/onboarding");
    expect(o.PLACEHOLDER_EMAIL_DOMAIN).toBe("kito.io.vn");
    expect(o.placeholderEmail("an.nguyen24")).toBe("an.nguyen24@kito.io.vn");
    expect(o.isPlaceholderEmail("AN@KITO.IO.VN")).toBe(true);
    expect(o.isPlaceholderEmail("an@gmail.com")).toBe(false);
    expect(o.TRIAL_SLOT_LIMIT).toBe(9);
  });

  it("export đủ các enum cho giao diện", async () => {
    const o: any = await import("@/lib/onboarding");
    const codes = (arr: any[]) => arr.map((x) => (typeof x === "string" ? x : x.value ?? x.code));
    expect(codes(o.GRADE_LEVELS)).toEqual(expect.arrayContaining(["G1", "G12", "UNIVERSITY", "WORKING"]));
    expect(codes(o.ENGLISH_GOALS)).toEqual(expect.arrayContaining(["SCHOOL", "CAMBRIDGE", "IELTS", "TOEIC", "GRADE10", "UNSURE"]));
    expect(codes(o.TEACHER_LEVELS)).toEqual(expect.arrayContaining(["PRESCHOOL", "PRIMARY", "LOWER_SECONDARY", "UPPER_SECONDARY", "CERTIFICATE", "UNIVERSITY", "ADULT"]));
    expect(codes(o.WORKPLACE_TYPES)).toEqual(expect.arrayContaining(["PUBLIC_SCHOOL", "PRIVATE_SCHOOL", "CENTER", "FREELANCE"]));
    expect(codes(o.STUDENT_COUNTS)).toEqual(expect.arrayContaining(["LT10", "R10_50", "R50_200", "GT200"]));
    expect(codes(o.TEACHER_NEEDS)).toEqual(expect.arrayContaining(["AI_GRADING", "AUTHORING", "AI_IMPORT", "CLASS_MGMT", "PROGRESS"]));
    expect(codes(o.SIGNUP_SOURCES)).toEqual(expect.arrayContaining(["FACEBOOK", "ZALO", "REFERRAL", "GOOGLE", "OTHER"]));
  });
});

describe("POST /api/auth/register — học sinh", () => {
  it("không có email → tạo tên đăng nhập + email tạm, đặt cookie, lưu lớp & mục tiêu", async () => {
    const res = await registerStudent(studentNoEmail());
    expect(res.status).toBe(201);
    const j = await res.json();
    expect(j.success).toBe(true);
    expect(j.username).toBe("an.nguyen24");
    expect(j.user.emailIsPlaceholder).toBe(true);
    expect(h.cookiesSet).toContain("auth_token");
    const u = await userBy("username", "an.nguyen24");
    expect(u.role).toBe("STUDENT");
    expect(u.email).toBe("an.nguyen24@kito.io.vn");
    expect(u.email_is_placeholder).toBe(true);
    expect(u.grade_level).toBe("G7");
    expect(u.learning_goals.englishGoal ?? u.learning_goals.english_goal).toBe("CAMBRIDGE");
    expect(u.target_band).toBeNull();
    expect(u.password).not.toContain("matkhau1");
  });

  it("đăng nhập được bằng tên đăng nhập (không phân biệt hoa thường) và bằng email tạm", async () => {
    await registerStudent(studentNoEmail());
    const r1 = await login("An.Nguyen24", "matkhau1");
    expect(r1.status).toBe(200);
    const j1 = await r1.json();
    expect(j1.user.username).toBe("an.nguyen24");
    expect(j1.user.emailIsPlaceholder).toBe(true);
    expect((await login("an.nguyen24@kito.io.vn", "matkhau1")).status).toBe(200);
    expect((await login("an.nguyen24", "saimatkhau")).status).toBe(401);
  });

  it("có email → email thật, username tự sinh từ email, target_band theo mục tiêu IELTS", async () => {
    const res = await registerStudent(studentWithEmail());
    expect(res.status).toBe(201);
    const j = await res.json();
    const u = await userBy("email", "binh.tran@gmail.com");
    expect(u).toBeTruthy();
    expect(u.email_is_placeholder).toBe(false);
    expect(u.username).toMatch(/^binh\.tran/);
    expect(j.username).toBe(u.username);
    expect(u.target_band).toBe("IELTS 6.5");
    expect((await login(u.username, "matkhau1")).status).toBe(200);
  });

  it("username tự sinh không trùng khi phần trước @ đã có người dùng", async () => {
    await h.pg.db.query(`INSERT INTO users (id, name, email, username) VALUES ('x1','X','x1@x.vn','binh.tran')`);
    expect((await registerStudent(studentWithEmail())).status).toBe(201);
    const u = await userBy("email", "binh.tran@gmail.com");
    expect(u.username).not.toBe("binh.tran");
    expect(u.username).toMatch(/^binh\.tran/);
  });

  it("tương thích body cũ { name, email, password } (không có gradeLevel/goals)", async () => {
    const res = await registerStudent({ name: "Cũ", email: "cu@x.vn", password: "matkhau1" });
    expect(res.status).toBe(201);
    expect((await userBy("email", "cu@x.vn")).role).toBe("STUDENT");
  });

  it("username trùng → 400 field=username kèm gợi ý chưa ai dùng", async () => {
    await registerStudent(studentNoEmail());
    const res = await registerStudent(studentNoEmail({ name: "An khác" }), "8.8.8.8");
    expect(res.status).toBe(400);
    const j = await res.json();
    expect(j.success).toBe(false);
    expect(j.field).toBe("username");
    expect(Array.isArray(j.suggestions) && j.suggestions.length).toBeGreaterThanOrEqual(1);
    for (const s of j.suggestions) expect(await userBy("username", s)).toBeUndefined();
  });

  it.each([
    [{ username: "ab" }, "username"],
    [{ username: "admin" }, "username"],
    [{ username: undefined }, "username"],
    [{ name: "A" }, "name"],
    [{ password: "123" }, "password"],
    [{ gradeLevel: "LOP_MUOI_BA" }, "gradeLevel"],
  ])("dữ liệu sai %o → 400 field=%s", async (over, field) => {
    const res = await registerStudent(studentNoEmail(over as any));
    expect(res.status).toBe(400);
    const j = await res.json();
    expect(j.field).toBe(field);
    expect(typeof j.error).toBe("string");
    expect((await rows(`SELECT count(*)::int AS n FROM users`))[0].n).toBe(0);
  });

  it("email đuôi @kito.io.vn do người dùng nhập → 400 field=email", async () => {
    const res = await registerStudent(studentWithEmail({ email: "gia@kito.io.vn" }));
    expect(res.status).toBe(400);
    expect((await res.json()).field).toBe("email");
  });

  it("email đã đăng ký → 400 field=email", async () => {
    await registerStudent(studentWithEmail());
    const res = await registerStudent(studentWithEmail({ name: "Người khác" }), "8.8.8.8");
    expect(res.status).toBe(400);
    expect((await res.json()).field).toBe("email");
  });

  it("body có role ADMIN/TEACHER → vẫn tạo STUDENT", async () => {
    await registerStudent(studentNoEmail({ role: "ADMIN" }));
    expect((await userBy("username", "an.nguyen24")).role).toBe("STUDENT");
  });

  it("bẫy bot website → 200 nhưng không tạo user, không đặt cookie", async () => {
    const res = await registerStudent(studentNoEmail({ website: "http://spam" }));
    expect(res.status).toBe(200);
    expect((await rows(`SELECT count(*)::int AS n FROM users`))[0].n).toBe(0);
    expect(h.cookiesSet).not.toContain("auth_token");
  });

  it("quá 5 lần/giờ/IP → 429 có Retry-After (đếm cả lần lỗi validate)", async () => {
    for (let i = 0; i < 5; i++) await registerStudent({ name: "A" }, "7.7.7.7");
    const res = await registerStudent(studentNoEmail(), "7.7.7.7");
    expect(res.status).toBe(429);
    expect(res.headers.get("Retry-After")).toBeTruthy();
    expect((await registerStudent(studentNoEmail(), "6.6.6.6")).status).toBe(201);
  });

  it("có mã lớp hợp lệ → được ghi danh và trả tên lớp", async () => {
    await h.pg.db.query(`INSERT INTO users (id, name, email, role, teacher_status, slot_balance) VALUES ('t1','GV','t1@x.vn','TEACHER','VERIFIED',10)`); // FEAT-015: ghi danh trừ ví
    await h.pg.db.query(`INSERT INTO classes (id, name, code, teacher_id, max_slots) VALUES ('c1','Lớp 7A','ABC123','t1',30)`);
    const j = await (await registerStudent(studentNoEmail({ classCode: "abc123" }))).json();
    expect(j.enrolled).toEqual({ classId: "c1", className: "Lớp 7A" });
    const u = await userBy("username", "an.nguyen24");
    expect((await rows(`SELECT * FROM enrollments WHERE student_id = $1 AND class_id = 'c1'`, [u.id])).length).toBe(1);
  });

  it("mã lớp sai hoặc lớp đầy → vẫn tạo tài khoản, enrolled=null kèm enrollError", async () => {
    const r1 = await registerStudent(studentNoEmail({ classCode: "KHONGCO" }));
    expect(r1.status).toBe(201);
    const j1 = await r1.json();
    expect(j1.enrolled).toBeNull();
    expect(typeof j1.enrollError).toBe("string");

    await h.pg.db.query(`INSERT INTO classes (id, name, code, teacher_id, max_slots) VALUES ('c2','Đầy','FULL01','t1',0)`);
    const r2 = await registerStudent(studentNoEmail({ username: "binh.le99", classCode: "FULL01" }), "8.8.8.8");
    expect(r2.status).toBe(201);
    const j2 = await r2.json();
    expect(j2.enrolled).toBeNull();
    expect(typeof j2.enrollError).toBe("string");
    expect((await rows(`SELECT count(*)::int AS n FROM enrollments`))[0].n).toBe(0);
  });
});

describe("POST /api/student/enroll vẫn hoạt động qua lib/enrollment", () => {
  it("ghi danh bằng mã, sai mã 404, lớp đầy 409", async () => {
    await h.pg.db.query(`INSERT INTO users (id, name, email, role) VALUES ('s1','S','s1@x.vn','STUDENT')`);
    await h.pg.db.query(`INSERT INTO users (id, name, email, role, teacher_status, slot_balance) VALUES ('t1','GV','t1@x.vn','TEACHER','VERIFIED',10)`); // FEAT-015: ghi danh trừ ví
    await h.pg.db.query(`INSERT INTO classes (id, name, code, teacher_id, max_slots) VALUES ('c1','L','ABC123','t1',30), ('c2','Đầy','FULL01','t1',0)`);
    h.token = await signJwtToken({ userId: "s1", email: "s1@x.vn", role: "STUDENT" });
    const enroll = async (code: string) => (await import("@/app/api/student/enroll/route")).POST(req("/api/student/enroll", { code }));
    expect((await enroll("abc123")).status).toBe(200);
    expect((await enroll("NOPE")).status).toBe(404);
    expect((await enroll("FULL01")).status).toBe(409);
    const lib = await import("@/lib/enrollment");
    expect(typeof lib.enrollStudentByCode).toBe("function");
    expect(fs.readFileSync("app/api/student/enroll/route.ts", "utf8")).toMatch(/enrollStudentByCode/);
  });
});

describe("GET /api/auth/username-available", () => {
  it("còn trống / đã dùng (kèm ≥3 gợi ý chưa dùng) / sai định dạng", async () => {
    await h.pg.db.query(`INSERT INTO users (id, name, email, username) VALUES ('x1','X','x1@x.vn','an.nguyen')`);
    const free = await (await usernameAvailable("hoa.tran")).json();
    expect(free).toMatchObject({ success: true, available: true });

    const taken = await (await usernameAvailable("An.Nguyen")).json();
    expect(taken.available).toBe(false);
    expect(taken.suggestions.length).toBeGreaterThanOrEqual(3);
    for (const s of taken.suggestions) expect(await userBy("username", s)).toBeUndefined();

    const bad = await (await usernameAvailable("a b")).json();
    expect(bad.available).toBe(false);
    expect(typeof bad.error).toBe("string");
    expect((await (await usernameAvailable("admin")).json()).available).toBe(false);
  });

  it("quá 30 lần/phút/IP → 429", async () => {
    for (let i = 0; i < 30; i++) await usernameAvailable(`ten.so${i}x`, "5.5.5.5");
    expect((await usernameAvailable("hoa.tran", "5.5.5.5")).status).toBe(429);
  });
});

describe("GET /api/auth/email-available (báo trùng ngay khi gõ)", () => {
  const check = async (e: string, ip = "9.9.9.9") =>
    (await import("@/app/api/auth/email-available/route")).GET(
      new Request(`http://localhost/api/auth/email-available?e=${encodeURIComponent(e)}`, { headers: { "x-forwarded-for": ip } })
    );

  it("còn trống / đã dùng (không phân biệt hoa thường) / sai định dạng / đuôi email tạm", async () => {
    await h.pg.db.query(`INSERT INTO users (id, name, email) VALUES ('x1','X','co.lan@gmail.com')`);
    expect(await (await check("moi.tinh@gmail.com")).json()).toMatchObject({ success: true, available: true });
    const taken = await (await check("Co.Lan@Gmail.com")).json();
    expect(taken.available).toBe(false);
    expect(taken.error).toMatch(/đã được dùng/);
    for (const bad of ["co.lan", "abc@", "lan@kito.io.vn"]) {
      const j = await (await check(bad)).json();
      expect(j.available, bad).toBe(false);
      expect(typeof j.error).toBe("string");
    }
  });

  it("quá 30 lần/phút/IP → 429", async () => {
    for (let i = 0; i < 30; i++) await check(`a${i}@x.vn`, "3.3.3.3");
    expect((await check("b@x.vn", "3.3.3.3")).status).toBe(429);
  });
});

describe("POST /api/auth/register/teacher — giáo viên dùng thử", () => {
  it("tạo TEACHER TRIAL, slot_limit 9, hồ sơ khảo sát, cookie, thông báo cho mọi admin", async () => {
    await h.pg.db.query(`INSERT INTO users (id, name, email, role) VALUES ('ad1','Admin 1','ad1@x.vn','ADMIN'), ('ad2','Admin 2','ad2@x.vn','ADMIN'), ('s9','S','s9@x.vn','STUDENT')`);
    const res = await registerTeacher(teacherBody());
    expect(res.status).toBe(201);
    const j = await res.json();
    expect(j.success).toBe(true);
    expect(j.user.teacherStatus).toBe("TRIAL");
    expect(h.cookiesSet).toContain("auth_token");

    const u = await userBy("email", "co.lan@gmail.com");
    expect(u.role).toBe("TEACHER");
    expect(u.teacher_status).toBe("TRIAL");
    expect(Number(u.slot_limit)).toBe(9);
    expect(u.username).toMatch(/^co\.lan/);
    expect(u.email_is_placeholder).toBe(false);

    const tp = (await rows(`SELECT * FROM teacher_profiles WHERE user_id = $1`, [u.id]))[0];
    expect(tp.answers).toMatchObject({
      subjects: ["english"],
      levels: ["PRIMARY", "LOWER_SECONDARY"],
      workplace_type: "CENTER",
      workplace_name: "Trung tâm Ánh Dương",
      student_count: "R10_50",
      honorific: "CO",
      needs: ["AI_GRADING", "AUTHORING"],
      source: "FACEBOOK",
    });

    const n = await rows(`SELECT user_id, type, ref_id, link, title FROM notifications ORDER BY user_id`);
    expect(n.map((x) => x.user_id)).toEqual(["ad1", "ad2"]);
    for (const x of n) {
      expect(x.type).toBe("TEACHER_SIGNUP");
      expect(x.ref_id).toBe(u.id);
      expect(x.link).toBe("/admin/teachers?status=TRIAL");
      expect(x.title).toContain("Cô Lan");
    }
    expect((await login("co.lan@gmail.com", "matkhau123")).status).toBe(200);
    expect((await (await login("co.lan@gmail.com", "matkhau123")).json()).user.teacherStatus).toBe("TRIAL");
  });

  it("body có role ADMIN → vẫn TEACHER TRIAL", async () => {
    await registerTeacher(teacherBody({ role: "ADMIN", teacher_status: "VERIFIED", teacherStatus: "VERIFIED" }));
    const u = await userBy("email", "co.lan@gmail.com");
    expect(u.role).toBe("TEACHER");
    expect(u.teacher_status).toBe("TRIAL");
  });

  it.each([
    [{ subjects: [] }, "subjects"],
    [{ levels: ["SAO_HOA"] }, "levels"],
    [{ workplaceType: "NHA" }, "workplaceType"],
    [{ studentCount: "1000" }, "studentCount"],
    [{ honorific: undefined }, "honorific"],
    [{ honorific: "ANH" }, "honorific"],
    [{ needs: ["BAY"] }, "needs"],
    [{ source: "TIKTOK_LA" }, "source"],
    [{ phone: "12345" }, "phone"],
    [{ email: undefined }, "email"],
    [{ email: "lan@kito.io.vn" }, "email"],
    [{ password: "1234567" }, "password"],
  ])("dữ liệu sai %o → 400 field=%s, không tạo gì", async (over, field) => {
    const res = await registerTeacher(teacherBody(over as any));
    expect(res.status).toBe(400);
    expect((await res.json()).field).toBe(field);
    expect((await rows(`SELECT count(*)::int AS n FROM users`))[0].n).toBe(0);
    expect((await rows(`SELECT count(*)::int AS n FROM teacher_profiles`))[0].n).toBe(0);
  });

  it("không gửi needs (02/11 bỏ câu hỏi nhu cầu) vẫn đăng ký được", async () => {
    expect((await registerTeacher(teacherBody({ needs: undefined }))).status).toBe(201);
    const u = await userBy("email", "co.lan@gmail.com");
    const tp = (await rows(`SELECT answers FROM teacher_profiles WHERE user_id = $1`, [u.id]))[0];
    expect(tp.answers.honorific).toBe("CO");
  });

  it("source bỏ trống vẫn hợp lệ; email trùng → 400 không sinh hồ sơ thừa", async () => {
    expect((await registerTeacher(teacherBody({ source: undefined }))).status).toBe(201);
    const res = await registerTeacher(teacherBody({ name: "Người khác" }), "8.8.8.8");
    expect(res.status).toBe(400);
    expect((await res.json()).field).toBe("email");
    expect((await rows(`SELECT count(*)::int AS n FROM teacher_profiles`))[0].n).toBe(1);
  });

  it("tạo user và hồ sơ trong một câu SQL (CTE)", async () => {
    await registerTeacher(teacherBody());
    const ins = h.pg.calls.filter((c: any) => /INSERT\s+INTO\s+teacher_profiles/i.test(c.sql));
    expect(ins.length).toBe(1);
    expect(ins[0].sql).toMatch(/INSERT\s+INTO\s+users/i);
  });

  it("bẫy bot và giới hạn 5 lần/giờ/IP", async () => {
    expect((await registerTeacher(teacherBody({ website: "x" }))).status).toBe(200);
    expect((await rows(`SELECT count(*)::int AS n FROM users`))[0].n).toBe(0);
    for (let i = 0; i < 4; i++) await registerTeacher({}, "4.4.4.4");
    await registerTeacher({}, "4.4.4.4");
    expect((await registerTeacher(teacherBody(), "4.4.4.4")).status).toBe(429);
  });
});

describe("Quên mật khẩu & đổi email tạm", () => {
  it("forgot-password với email tạm: không tạo token, phản hồi giống email không tồn tại", async () => {
    await registerStudent(studentNoEmail());
    const r1 = await forgot("an.nguyen24@kito.io.vn");
    const r2 = await forgot("khongton.tai@gmail.com");
    expect(r1.status).toBe(r2.status);
    const [j1, j2] = [await r1.json(), await r2.json()];
    expect(j1.success).toBe(j2.success);
    expect(String(j1.message).replace("an.nguyen24@kito.io.vn", "E")).toBe(String(j2.message).replace("khongton.tai@gmail.com", "E"));
    expect((await userBy("username", "an.nguyen24")).reset_token).toBeNull();
  });

  it("forgot-password với email thật vẫn tạo token (không hồi quy)", async () => {
    await registerStudent(studentWithEmail());
    await forgot("binh.tran@gmail.com");
    expect((await userBy("email", "binh.tran@gmail.com")).reset_token).toBeTruthy();
  });

  it("PUT /api/profile đổi email tạm sang email thật → email_is_placeholder=false", async () => {
    await registerStudent(studentNoEmail());
    const u = await userBy("username", "an.nguyen24");
    h.token = await signJwtToken({ userId: u.id, email: u.email, role: "STUDENT" });
    const res = await profilePut({ email: "An.Nguyen@Gmail.com" });
    expect(res.status).toBe(200);
    const after = await userBy("id", u.id);
    expect(after.email).toBe("an.nguyen@gmail.com");
    expect(after.email_is_placeholder).toBe(false);
    expect(after.username).toBe("an.nguyen24");
  });

  it("PUT /api/profile: email đuôi kito.io.vn hoặc đã có người dùng → 400; không gửi email thì không đổi", async () => {
    await h.pg.db.query(`INSERT INTO users (id, name, email, role, password) VALUES ('o1','O','daco@x.vn','STUDENT',$1)`, [hashPassword("x123456")]);
    await registerStudent(studentNoEmail());
    const u = await userBy("username", "an.nguyen24");
    h.token = await signJwtToken({ userId: u.id, email: u.email, role: "STUDENT" });
    expect((await profilePut({ email: "khac@kito.io.vn" })).status).toBe(400);
    expect((await profilePut({ email: "daco@x.vn" })).status).toBe(400);
    expect((await profilePut({ name: "An Mới" })).status).toBe(200);
    const after = await userBy("id", u.id);
    expect(after.email).toBe("an.nguyen24@kito.io.vn");
    expect(after.email_is_placeholder).toBe(true);
    expect(after.name).toBe("An Mới");
  });
});

describe("Chống lách", () => {
  it("file test này đủ số ca kiểm tra", () => {
    const s = fs.readFileSync(__filename, "utf8");
    expect((s.match(/\bit(\.each\(\[[\s\S]*?\]\))?\(/g) || []).length).toBeGreaterThanOrEqual(30);
  });

  it("route đăng ký không còn giá trị cứng 'IELTS 6.5' và không đọc role từ body", () => {
    for (const f of ["app/api/auth/register/route.ts", "app/api/auth/register/teacher/route.ts"]) {
      const s = fs.readFileSync(f, "utf8");
      expect(s, f).not.toMatch(/IELTS 6\.5/);
      expect(s, f).not.toMatch(/body\.role|\{\s*[^}]*\brole\b[^}]*\}\s*=\s*body/);
    }
  });
});
