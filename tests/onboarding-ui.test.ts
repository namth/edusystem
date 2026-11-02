// TASK-036 — FEAT-012 giao diện: /login mới, /register và /register/teacher dạng phỏng vấn có mascot.
// Luồng thật kiểm bằng e2e/onboarding.spec.ts; file này kiểm hàm thuần, API phụ và quy ước tĩnh.
// File do trưởng phòng viết, bị khoá.
/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from "vitest";
import fs from "fs";
import path from "path";
import { createFakePg } from "./helpers/pg-fake";

const h = vi.hoisted(() => {
  process.env.JWT_SECRET = "test_secret_for_vitest_only_0123456789abcdef";
  return { token: undefined as string | undefined, pg: null as any, fail: false };
});
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (n: string) => (n === "auth_token" && h.token ? { value: h.token } : undefined),
    set: () => {},
  }),
  headers: async () => new Headers(),
}));
vi.mock("@/lib/db-pg", () => ({
  queryPg: (sql: string, params?: unknown[]) => {
    if (h.fail) throw new Error("db down");
    return h.pg.queryPg(sql, params);
  },
  ensureSchema: async () => {},
}));

import { signJwtToken } from "@/lib/jwt";

const read = (p: string) => fs.readFileSync(p, "utf8");
const DIR = "components/onboarding";
const allOnboarding = () =>
  fs.readdirSync(DIR).filter((f) => /\.(tsx?|css)$/.test(f)).map((f) => read(path.join(DIR, f))).join("\n");

beforeEach(async () => {
  h.token = undefined;
  h.fail = false;
  h.pg = await createFakePg();
  await h.pg.db.exec(`
    CREATE TABLE courses (id VARCHAR(50) PRIMARY KEY, title VARCHAR(255), created_by VARCHAR(50));
    CREATE TABLE lessons (id VARCHAR(50) PRIMARY KEY, title VARCHAR(255), created_by VARCHAR(50));
  `);
  for (const m of ["db-migration-012-subjects.sql", "db-migration-013-onboarding.sql"]) {
    await h.pg.db.exec(fs.readFileSync(path.join("docs", m), "utf8"));
  }
});

describe("safeNextPath — chống chuyển hướng ra ngoài", () => {
  it("chỉ nhận đường dẫn nội bộ; còn lại theo vai trò", async () => {
    const { safeNextPath } = await import("@/components/onboarding/redirect");
    expect(safeNextPath("/student/exam/1?x=2", "STUDENT")).toBe("/student/exam/1?x=2");
    for (const bad of ["https://evil.com", "//evil.com", "/\\evil.com", "javascript:alert(1)", "", null, undefined]) {
      expect(safeNextPath(bad as any, "STUDENT"), String(bad)).toBe("/student/dashboard");
    }
    expect(safeNextPath(null, "TEACHER")).toBe("/teacher/classes");
    expect(safeNextPath(null, "ADMIN")).toBe("/admin/requests");
  });
});

describe("GET /api/auth/signup-options (công khai)", () => {
  it("chỉ trả môn hệ thống, chỉ id + name", async () => {
    await h.pg.db.exec(`INSERT INTO subjects (id, code, name, owner_id) VALUES ('gv_rieng','rieng','Môn riêng GV','t1') ON CONFLICT DO NOTHING`);
    const j = await (await (await import("@/app/api/auth/signup-options/route")).GET(new Request("http://localhost/api/auth/signup-options"))).json();
    expect(j.success).toBe(true);
    expect(j.subjects.some((s: any) => s.id === "english")).toBe(true);
    expect(j.subjects.some((s: any) => s.id === "gv_rieng")).toBe(false);
    for (const s of j.subjects) expect(Object.keys(s).sort()).toEqual(["id", "name"]);
  });

  it("DB lỗi → vẫn trả Tiếng Anh dự phòng", async () => {
    h.fail = true;
    const j = await (await (await import("@/app/api/auth/signup-options/route")).GET(new Request("http://localhost/api/auth/signup-options"))).json();
    expect(j).toEqual({ success: true, subjects: [{ id: "english", name: "Tiếng Anh" }] });
  });
});

describe("GET /api/auth/me trả trường FEAT-012", () => {
  it("username, teacherStatus, emailIsPlaceholder", async () => {
    await h.pg.db.exec(`INSERT INTO users (id, name, email, role, username, email_is_placeholder, teacher_status)
      VALUES ('t1','Cô Lan','lan@kito.io.vn','TEACHER','co.lan',TRUE,'TRIAL')`);
    h.token = await signJwtToken({ userId: "t1", email: "lan@kito.io.vn", role: "TEACHER" });
    const j = await (await ((await import("@/app/api/auth/me/route")).GET as any)(new Request("http://localhost/api/auth/me"))).json();
    expect(j.user).toMatchObject({ username: "co.lan", teacherStatus: "TRIAL", emailIsPlaceholder: true });
  });
});

describe("Khung phỏng vấn components/onboarding", () => {
  it("đủ các thành phần, mascot dùng ảnh nền trong suốt, có 5 cảm xúc", () => {
    for (const f of ["Mascot.tsx", "SpeechBubble.tsx", "InterviewShell.tsx", "ChoiceChips.tsx", "useInterviewDraft.ts", "Confetti.tsx", "redirect.ts"]) {
      expect(fs.existsSync(path.join(DIR, f)), f).toBe(true);
    }
    const m = read(path.join(DIR, "Mascot.tsx"));
    expect(m).toContain("/brand/kitokit-mark-transparent.png");
    for (const mood of ["idle", "think", "happy", "oops", "celebrate"]) expect(m).toContain(mood);
  });

  it("có hỗ trợ trợ năng: progressbar, aria-live, aria-pressed", () => {
    const s = allOnboarding();
    expect(s).toMatch(/role="progressbar"/);
    expect(s).toMatch(/aria-valuenow/);
    expect(s).toMatch(/aria-live="polite"/);
    expect(s).toMatch(/aria-pressed/);
  });

  it("nháp lưu sessionStorage, có try/catch, không bao giờ lưu mật khẩu", () => {
    const s = read(path.join(DIR, "useInterviewDraft.ts"));
    expect(s).toContain("sessionStorage");
    expect(s).toMatch(/try\s*\{/);
    expect(s).toMatch(/password/);
    expect(s).toMatch(/kitokit-signup-student|kitokit-signup-/);
    expect(allOnboarding() + read("app/register/page.tsx") + read("app/register/teacher/page.tsx")).not.toMatch(/localStorage/);
  });

  it("globals.css có keyframes mascot và tắt khi prefers-reduced-motion", () => {
    const css = read("app/globals.css");
    expect(css).toMatch(/@keyframes\s+mascot-/);
    expect(css).toMatch(/prefers-reduced-motion:\s*reduce[\s\S]*\.mascot-/);
  });
});

describe("Trang /register và /register/teacher", () => {
  it("học sinh: dùng lib/onboarding, gọi đủ API, xưng 'bạn', có câu hỏi email và email tạm", () => {
    const s = read("app/register/page.tsx");
    expect(s.trimStart().startsWith('"use client"')).toBe(true);
    expect(s).toMatch(/@\/lib\/onboarding/);
    for (const api of ["/api/auth/signup-options", "/api/auth/username-available", "/api/classes/lookup/"]) expect(s, api).toContain(api);
    expect(s).toMatch(/registerStudent/);
    expect(s).toMatch(/Bạn có email không\?/);
    expect(s).toMatch(/PLACEHOLDER_EMAIL_DOMAIN|placeholderEmail/);
    expect(s).not.toMatch(/\bem\b(?= (tên|học|có|muốn|đang))/i); // không gọi "em"
    expect(s).toContain("/register/teacher");
    expect(s).toMatch(/InterviewShell/);
  });

  it("giáo viên: dùng enum lib/onboarding, gọi registerTeacher, nêu đủ giới hạn dùng thử", () => {
    const s = read("app/register/teacher/page.tsx");
    expect(s).toMatch(/@\/lib\/onboarding/);
    for (const e of ["HONORIFICS", "TEACHER_LEVELS", "WORKPLACE_TYPES", "STUDENT_COUNTS"]) expect(s, e).toContain(e);
    expect(s).toMatch(/registerTeacher/);
    expect(s).toMatch(/thầy cô/i);
    expect(s).toMatch(/1 lớp/);
    expect(s).toMatch(/3 bài học/);
    expect(s).toMatch(/3 học sinh/);
  });

  it("AuthContext có registerStudent/registerTeacher và trường teacherStatus, emailIsPlaceholder", () => {
    const s = read("context/AuthContext.tsx");
    for (const k of ["registerStudent", "registerTeacher", "teacherStatus", "emailIsPlaceholder", "/api/auth/register/teacher"]) expect(s, k).toContain(k);
  });
});

describe("Trang /login", () => {
  it("không điền sẵn tài khoản demo; ô 'Email hoặc tên đăng nhập'; 2 lối đăng ký; dùng safeNextPath", () => {
    const s = read("app/login/page.tsx");
    expect(s).toContain('placeholder="Email hoặc tên đăng nhập"');
    expect(s).toContain('placeholder="Mật khẩu"');
    expect(s).toContain('"/register"');
    expect(s).toContain('"/register/teacher"');
    expect(s).toContain("/forgot-password");
    expect(s).toMatch(/safeNextPath/);
    expect(s).not.toMatch(/useState\(\s*["'][^"']*@[^"']*["']\s*\)/); // không email điền sẵn
    expect(s).not.toMatch(/useState\(\s*["']123456["']\s*\)/);
    expect(s).toMatch(/Mascot/);
  });

  it("/teacher/login chỉ chuyển hướng về /login", () => {
    const s = read("app/teacher/login/page.tsx");
    expect(s.trimStart().startsWith('"use client"')).toBe(false);
    expect(s).toMatch(/redirect\(\s*["']\/login["']\s*\)/);
    expect(s).not.toMatch(/123456|teacher\.duc/);
  });

  it("trang hồ sơ có khối email tạm gọi PUT /api/profile", () => {
    const s = read("app/profile/page.tsx");
    expect(s).toMatch(/emailIsPlaceholder/);
    expect(s).toMatch(/email tạm/i);
  });

  it("chống lách: đủ số ca", () => {
    expect((read(__filename).match(/\bit\(/g) || []).length).toBeGreaterThanOrEqual(15);
  });
});
