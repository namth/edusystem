// TASK-049 — Cấp lại mật khẩu tạm: admin cho mọi tài khoản, giáo viên cho học sinh lớp mình.
// File do tài khoản kiểm chéo viết, bị khoá khi nộp.
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
    set: (n: string, v: string) => { if (n === "auth_token") h.token = v; },
    delete: () => { h.token = undefined; },
  }),
}));
vi.mock("@/lib/db-pg", () => ({
  queryPg: (sql: string, params?: unknown[]) => h.pg.queryPg(sql, params),
  getPgPool: () => ({ connect: async () => ({ query: (s: string, p?: unknown[]) => h.pg.queryPg(s, p), release: () => {} }) }),
  ensureSchema: async () => {},
}));
vi.mock("@/lib/neo4j", () => ({ syncTeacherManagesClass: async () => {}, syncStudentEnrolledInClass: async () => {}, runCypherQuery: async () => [] }));

import { signJwtToken } from "@/lib/jwt";
import { hashPassword, comparePassword } from "@/lib/auth";
import { resetRateLimits } from "@/lib/rate-limit";

async function loginAs(role: "ADMIN" | "TEACHER" | "STUDENT" | null, userId?: string) {
  h.token = role ? await signJwtToken({ userId: userId!, email: `${userId}@x.vn`, role }) : undefined;
}
const post = (url: string) => new Request(`http://localhost${url}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
const admin = async (id: string) =>
  (await import("@/app/api/admin/users/[id]/reset-password/route")).POST(post(`/api/admin/users/${id}/reset-password`), { params: Promise.resolve({ id }) });
const teacher = async (studentId: string) =>
  (await import("@/app/api/teacher/students/[studentId]/reset-password/route")).POST(
    post(`/api/teacher/students/${studentId}/reset-password`), { params: Promise.resolve({ studentId }) });
const login = async (identifier: string, password: string) =>
  (await import("@/app/api/auth/login/route")).POST(
    new Request("http://localhost/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ identifier, password }) }));
const rows = async (sql: string, p?: unknown[]) => (await h.pg.db.query(sql, p)).rows;
const pwdOf = async (id: string) => (await rows(`SELECT password FROM users WHERE id=$1`, [id]))[0].password as string;

const OLD = "MatKhauCu@123";

beforeEach(async () => {
  h.token = undefined;
  resetRateLimits();
  h.pg = await createFakePg(["db-migration-004-enrollments-assignments.sql"]);
  await h.pg.db.exec(`
    ALTER TABLE users ADD COLUMN must_change_password BOOLEAN DEFAULT FALSE;
    ALTER TABLE users ADD COLUMN last_login_at TIMESTAMPTZ;
    ALTER TABLE users ADD COLUMN reset_token VARCHAR(255);
    ALTER TABLE users ADD COLUMN reset_token_expires TIMESTAMP;
  `);
  const old = hashPassword(OLD);
  await h.pg.db.query(
    `INSERT INTO users (id,name,email,role,password,must_change_password,reset_token,reset_token_expires) VALUES
     ('a1','Admin','a1@x.vn','ADMIN',$1,FALSE,NULL,NULL),
     ('a2','Admin Hai','a2@x.vn','ADMIN',$1,FALSE,NULL,NULL),
     ('t1','GV Một','t1@x.vn','TEACHER',$1,FALSE,NULL,NULL),
     ('t2','GV Hai','t2@x.vn','TEACHER',$1,FALSE,NULL,NULL),
     ('s1','HS Một','s1@x.vn','STUDENT',$1,FALSE,'tok123',NOW() + INTERVAL '1 hour'),
     ('s2','HS Hai','s2@x.vn','STUDENT',$1,FALSE,NULL,NULL),
     ('s3','HS Ba','s3@x.vn','STUDENT',$1,FALSE,NULL,NULL),
     ('s4','HS Bốn','s4@x.vn','STUDENT',$1,FALSE,NULL,NULL)`,
    [old]
  );
  await h.pg.db.exec(`
    INSERT INTO classes (id,name,code,teacher_id) VALUES ('c1','Lớp 1','C1','t1'), ('c2','Lớp 2','C2','t2'), ('c3','Lớp 3','C3','t1');
    INSERT INTO enrollments (id,student_id,class_id) VALUES ('en1','s1','c1'), ('en2','s2','c2'), ('en3','s4','c3');
  `);
});

describe("lib/password-reset", () => {
  it("generateTempPassword: 10 ký tự, đúng bảng ký tự, luôn có hoa + thường + số, không lặp lại", async () => {
    const { generateTempPassword } = await import("@/lib/password-reset");
    const allowed = /^[ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789]{10}$/;
    const seen = new Set<string>();
    for (let i = 0; i < 300; i++) {
      const p = generateTempPassword();
      expect(p).toMatch(allowed);
      expect(p).toMatch(/[A-Z]/);
      expect(p).toMatch(/[a-z]/);
      expect(p).toMatch(/[0-9]/);
      seen.add(p);
    }
    expect(seen.size).toBeGreaterThan(290);
  });

  it("issueTempPassword: trả mật khẩu tạm, lưu bản băm, bật must_change_password, xoá reset_token", async () => {
    const { issueTempPassword } = await import("@/lib/password-reset");
    const temp = await issueTempPassword("s1");
    expect(temp).toHaveLength(10);
    const r = (await rows(`SELECT password,must_change_password,reset_token,reset_token_expires FROM users WHERE id='s1'`))[0];
    expect(r.password).not.toBe(temp);
    expect(r.password).not.toContain(temp);
    expect(comparePassword(temp, r.password)).toBe(true);
    expect(comparePassword(OLD, r.password)).toBe(false);
    expect(r.must_change_password).toBe(true);
    expect(r.reset_token).toBeNull();
    expect(r.reset_token_expires).toBeNull();
  });

  it("issueTempPassword chỉ đổi đúng một tài khoản", async () => {
    const { issueTempPassword } = await import("@/lib/password-reset");
    const before = await pwdOf("s2");
    await issueTempPassword("s1");
    expect(await pwdOf("s2")).toBe(before);
  });
});

describe("POST /api/admin/users/[id]/reset-password", () => {
  it("admin cấp lại cho học sinh → 200, temp_password dài 10, đăng nhập được, mật khẩu cũ hết hiệu lực, DB đúng", async () => {
    await loginAs("ADMIN", "a1");
    const res = await admin("s1");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(typeof body.temp_password).toBe("string");
    expect(body.temp_password).toHaveLength(10);

    const r = (await rows(`SELECT password,must_change_password,reset_token FROM users WHERE id='s1'`))[0];
    expect(r.must_change_password).toBe(true);
    expect(r.reset_token).toBeNull();
    expect(r.password).not.toContain(body.temp_password);

    h.token = undefined;
    expect((await login("s1@x.vn", OLD)).status).toBe(401);
    const l = await login("s1@x.vn", body.temp_password);
    expect(l.status).toBe(200);
    expect((await l.json()).user.mustChangePassword).toBe(true);
  });

  it("admin cấp lại được cho giáo viên và admin khác", async () => {
    await loginAs("ADMIN", "a1");
    expect((await admin("t1")).status).toBe(200);
    expect((await admin("a2")).status).toBe(200);
    expect((await rows(`SELECT must_change_password FROM users WHERE id='t1'`))[0].must_change_password).toBe(true);
  });

  it("hai lần cấp liên tiếp cho ra hai mật khẩu khác nhau, chỉ mật khẩu mới nhất dùng được", async () => {
    await loginAs("ADMIN", "a1");
    const t1 = (await (await admin("s2")).json()).temp_password;
    const t2 = (await (await admin("s2")).json()).temp_password;
    expect(t1).not.toBe(t2);
    h.token = undefined;
    expect((await login("s2@x.vn", t1)).status).toBe(401);
    expect((await login("s2@x.vn", t2)).status).toBe(200);
  });

  it("admin tự cấp cho chính mình → 400, mật khẩu không đổi", async () => {
    await loginAs("ADMIN", "a1");
    const before = await pwdOf("a1");
    const res = await admin("a1");
    expect(res.status).toBe(400);
    expect((await res.json()).error).toContain("Dùng chức năng đổi mật khẩu cho tài khoản của bạn");
    expect(await pwdOf("a1")).toBe(before);
  });

  it("id không tồn tại → 404", async () => {
    await loginAs("ADMIN", "a1");
    expect((await admin("khong-co")).status).toBe(404);
  });

  it("TEACHER / STUDENT / chưa đăng nhập → 401 hoặc 403, mật khẩu đích không đổi", async () => {
    const before = await pwdOf("s1");
    await loginAs("TEACHER", "t1");
    expect([401, 403]).toContain((await admin("s1")).status);
    expect((await admin("s1")).status).not.toBe(200);
    await loginAs("STUDENT", "s2");
    expect([401, 403]).toContain((await admin("s1")).status);
    await loginAs(null);
    expect([401, 403]).toContain((await admin("s1")).status);
    expect(await pwdOf("s1")).toBe(before);
    expect((await rows(`SELECT must_change_password FROM users WHERE id='s1'`))[0].must_change_password).toBe(false);
  });

  it("có header Cache-Control: no-store", async () => {
    await loginAs("ADMIN", "a1");
    expect((await admin("s1")).headers.get("Cache-Control")).toContain("no-store");
  });

  it("lần gọi thứ 21 trong một giờ → 429 (20 lần đầu thành công)", async () => {
    await loginAs("ADMIN", "a1");
    for (let i = 0; i < 20; i++) expect((await admin("s1")).status, `lần ${i + 1}`).toBe(200);
    const res = await admin("s1");
    expect(res.status).toBe(429);
    expect(res.headers.get("Cache-Control")).toContain("no-store");
  });

  it("không log mật khẩu tạm", async () => {
    const spies = (["log", "info", "warn", "error", "debug"] as const).map((k) => vi.spyOn(console, k).mockImplementation(() => {}));
    await loginAs("ADMIN", "a1");
    const temp = (await (await admin("s1")).json()).temp_password;
    for (const s of spies) {
      for (const call of s.mock.calls) expect(JSON.stringify(call)).not.toContain(temp);
      s.mockRestore();
    }
  });
});

describe("POST /api/teacher/students/[studentId]/reset-password", () => {
  it("giáo viên cấp lại cho học sinh lớp mình → 200, đăng nhập được, bắt đổi mật khẩu, mật khẩu cũ hết hiệu lực", async () => {
    await loginAs("TEACHER", "t1");
    const res = await teacher("s1");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.temp_password).toHaveLength(10);
    const r = (await rows(`SELECT password,must_change_password,reset_token FROM users WHERE id='s1'`))[0];
    expect(r.must_change_password).toBe(true);
    expect(r.reset_token).toBeNull();
    expect(r.password).not.toContain(body.temp_password);
    expect(res.headers.get("Cache-Control")).toContain("no-store");
    h.token = undefined;
    expect((await login("s1@x.vn", OLD)).status).toBe(401);
    expect((await login("s1@x.vn", body.temp_password)).status).toBe(200);
  });

  it("học sinh thuộc một trong nhiều lớp của giáo viên (lớp thứ hai) → 200", async () => {
    await loginAs("TEACHER", "t1");
    expect((await teacher("s4")).status).toBe(200);
  });

  it("học sinh lớp giáo viên khác, học sinh chưa vào lớp nào, giáo viên/admin khác, id không tồn tại → đều 404 cùng thông điệp, mật khẩu đích không đổi", async () => {
    await loginAs("TEACHER", "t1");
    const targets = ["s2", "s3", "t2", "a1", "khong-co", "t1"];
    const before: Record<string, string> = {};
    for (const id of ["s2", "s3", "t2", "a1", "t1"]) before[id] = await pwdOf(id);
    const msgs = new Set<string>();
    for (const id of targets) {
      const res = await teacher(id);
      expect(res.status, id).toBe(404);
      msgs.add(JSON.stringify(await res.json()));
    }
    expect(msgs.size).toBe(1);
    for (const id of Object.keys(before)) expect(await pwdOf(id), id).toBe(before[id]);
    expect((await rows(`SELECT id FROM users WHERE must_change_password = TRUE`))).toEqual([]);
  });

  it("giáo viên khác (t2) không cấp được cho học sinh lớp t1 → 404", async () => {
    await loginAs("TEACHER", "t2");
    const before = await pwdOf("s1");
    expect((await teacher("s1")).status).toBe(404);
    expect(await pwdOf("s1")).toBe(before);
  });

  it("STUDENT → 403; chưa đăng nhập → 401/403; ADMIN không dùng route giáo viên", async () => {
    const before = await pwdOf("s1");
    await loginAs("STUDENT", "s2");
    expect((await teacher("s1")).status).toBe(403);
    await loginAs(null);
    expect([401, 403]).toContain((await teacher("s1")).status);
    await loginAs("ADMIN", "a1");
    expect([401, 403]).toContain((await teacher("s1")).status);
    expect(await pwdOf("s1")).toBe(before);
  });

  it("lần gọi thứ 21 trong một giờ → 429", async () => {
    await loginAs("TEACHER", "t1");
    for (let i = 0; i < 20; i++) expect((await teacher("s1")).status, `lần ${i + 1}`).toBe(200);
    expect((await teacher("s1")).status).toBe(429);
  });

  it("giới hạn tính riêng theo người gọi: t1 hết lượt thì t2 vẫn gọi được", async () => {
    await loginAs("TEACHER", "t1");
    for (let i = 0; i < 21; i++) await teacher("s1");
    await loginAs("TEACHER", "t2");
    expect((await teacher("s2")).status).toBe(200);
  });
});

describe("Giao diện: ResetPasswordButton", () => {
  const read = (p: string) => fs.readFileSync(p, "utf8");

  it("component tồn tại, dùng KeyRound, nhãn 'Cấp lại mật khẩu' (không dấu +), có sao chép và dòng cảnh báo một lần", () => {
    const src = read("components/ResetPasswordButton.tsx");
    expect(src).toContain("KeyRound");
    expect(src).toContain("Cấp lại mật khẩu");
    expect(src).not.toMatch(/\+\s*Cấp lại/);
    expect(src).toContain("Chỉ hiện một lần");
    expect(src).toContain("temp_password");
    expect(src).toMatch(/clipboard/);
    expect(src).toContain("sẽ không dùng được nữa");
  });

  it("component gọi đúng route theo vai trò", () => {
    const src = read("components/ResetPasswordButton.tsx");
    expect(src).toContain("/api/admin/users/");
    expect(src).toContain("/api/teacher/students/");
    expect(src).toContain("reset-password");
  });

  it.each([
    "app/admin/accounts/page.tsx",
    "app/admin/students/[id]/page.tsx",
    "app/teacher/classes/[classId]/page.tsx",
  ])("%s có ResetPasswordButton", (p) => {
    const src = read(p);
    expect(src).toContain("ResetPasswordButton");
    expect(src).toMatch(/import\s+.*ResetPasswordButton.*from/);
  });

  it("trang giáo viên lớp học (admin/teachers/[id]) không bị đụng tới", () => {
    expect(read("app/admin/teachers/[id]/page.tsx")).not.toContain("ResetPasswordButton");
  });
});
