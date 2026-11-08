// TASK-033 — Landing KitoKit ở "/", form liên hệ lưu khách hàng tiềm năng (leads), trang admin xem leads.
// File do trưởng phòng viết, bị khoá.
import { describe, it, expect, vi, beforeEach } from "vitest";
import fs from "fs";
import path from "path";
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
  ensureSchema: async () => {},
}));

import { signJwtToken } from "@/lib/jwt";

async function loginAs(role: "ADMIN" | "TEACHER" | "STUDENT" | null, userId = "u1") {
  h.token = role ? await signJwtToken({ userId, email: `${userId}@x.vn`, role }) : undefined;
}
const read = (p: string) => fs.readFileSync(p, "utf8");
const exists = (p: string) => fs.existsSync(p);
const post = (body: unknown, ip = "1.2.3.4") =>
  new Request("http://localhost/api/leads", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-forwarded-for": ip },
    body: JSON.stringify(body),
  });
const leadsPost = async (body: unknown, ip?: string) => (await import("@/app/api/leads/route")).POST(post(body, ip));
const rows = async (sql: string) => (await h.pg.db.query(sql)).rows;

// redirect() của Next ném lỗi có digest "NEXT_REDIRECT;<type>;<url>;..."
async function redirectTarget(fn: () => unknown): Promise<string | null> {
  try {
    await fn();
    return null;
  } catch (e: any) {
    const d = String(e?.digest || "");
    if (!d.startsWith("NEXT_REDIRECT")) throw e;
    return d.split(";")[2] ?? null;
  }
}

beforeEach(async () => {
  h.token = undefined;
  h.pg = await createFakePg(["db-migration-011-leads.sql"]);
  (await import("@/lib/rate-limit")).resetRateLimits();
});

describe("Trang chủ / là landing (Server Component)", () => {
  it("không phải client component; khai báo metadata; dùng logo KitoKit và các section", () => {
    const s = read("app/page.tsx");
    expect(s.trimStart().startsWith('"use client"')).toBe(false);
    expect(s).toMatch(/export const metadata/);
    const all = [s, ...fs.readdirSync("components/landing").filter((f) => f.endsWith(".tsx")).map((f) => read(path.join("components/landing", f)))].join("\n");
    expect(all).toContain("/brand/kitokit-logo-ngang.png");
    expect(all).toContain("/brand/mascot-3d/");
    for (const id of ['id="tinh-nang"', 'id="hoc-sinh"', 'id="giao-vien"', 'id="faq"', 'id="lien-he"']) expect(all, id).toContain(id);
    // 02/11: bỏ mục liệt kê môn học (để mở rộng dần), tập trung giới thiệu tính năng
    expect(all).not.toContain('id="mon-hoc"');
    expect(all).toContain('"/register"');
    expect(all).toContain('"/login"');
    expect(all).toContain("/api/leads");
    expect(all).not.toMatch(/test_01/);
    expect(all).not.toMatch(/12\.000\+|AURA/);
  });

  it("có ít nhất 6 file section trong components/landing", () => {
    expect(fs.readdirSync("components/landing").filter((f) => f.endsWith(".tsx")).length).toBeGreaterThanOrEqual(6);
  });

  it("khách → hiển thị landing (không chuyển hướng)", async () => {
    await loginAs(null);
    const Page = (await import("@/app/page")).default as any;
    expect(await redirectTarget(() => Page())).toBeNull();
  });

  it("đã đăng nhập → chuyển hướng theo vai trò", async () => {
    const Page = (await import("@/app/page")).default as any;
    await loginAs("ADMIN");
    expect(await redirectTarget(() => Page())).toBe("/admin");
    await loginAs("TEACHER");
    expect(await redirectTarget(() => Page())).toBe("/teacher/classes");
    await loginAs("STUDENT");
    expect(await redirectTarget(() => Page())).toBe("/student/dashboard");
  });

  it("/student/landing chuyển về /", async () => {
    const Old = (await import("@/app/student/landing/page")).default as any;
    expect(await redirectTarget(() => Old())).toBe("/");
  });
});

describe("Landing — icon động & bản quyền INOVA", () => {
  it("6 icon động cho tính năng (AI chấm, soạn thảo, AI nhập đề, lộ trình, điểm tức thì, thông báo) dùng keyframes kk-*", () => {
    const m = read("components/landing/motion/MotionIcons.tsx");
    for (const name of ["AiGradingMotion", "EditorMotion", "AiImportMotion", "RoadmapMotion", "InstantResultMotion", "ProgressNotifyMotion"]) {
      expect(m, name).toMatch(new RegExp(`export function ${name}`));
    }
    expect(m.trimStart().startsWith('"use client"')).toBe(false);
    const css = read("app/globals.css");
    expect(css).toMatch(/@keyframes kk-/);
    expect(css).toMatch(/prefers-reduced-motion/);
  });

  it("footer ghi bản quyền thuộc pháp nhân INOVA (lấy từ BRAND), liên kết inova.io.vn", () => {
    const f = read("components/landing/LandingFooter.tsx");
    expect(f).toMatch(/Bản quyền thuộc về/);
    expect(f).toContain("BRAND.company.fullName");
    expect(f).toContain("https://inova.io.vn");
  });
});

describe("lib/landing-stats — số liệu thật từ DB", () => {
  it("đếm đề, câu hỏi, học sinh", async () => {
    await h.pg.db.exec(`
      INSERT INTO users (id,name,email,role) VALUES ('s1','A','a@x','STUDENT'),('s2','B','b@x','STUDENT'),('t1','T','t@x','TEACHER');
      INSERT INTO exams (id,title,question_ids) VALUES ('e1','E','[]'),('e2','E2','[]');
      INSERT INTO questions (id,skill) VALUES ('q1','Reading'),('q2','Reading'),('q3','Writing');
    `);
    const { getLandingStats } = await import("@/lib/landing-stats");
    expect(await getLandingStats()).toEqual({ exams: 2, questions: 3, students: 2 });
  });

  it("DB lỗi → null (landing ẩn dải số liệu), không ném lỗi", async () => {
    h.pg = { queryPg: async () => { throw new Error("db down"); } };
    const { getLandingStats } = await import("@/lib/landing-stats");
    expect(await getLandingStats()).toBeNull();
  });
});

describe("POST /api/leads — form liên hệ công khai", () => {
  const ok = { name: "Phụ huynh An", phone: "0912345678", role: "PARENT", message: "Cho con học thử" };

  it("hợp lệ → 201, lưu DB với status NEW", async () => {
    const res = await leadsPost(ok);
    expect(res.status).toBe(201);
    expect((await res.json()).success).toBe(true);
    const r = await rows(`SELECT name, phone, email, role, message, status FROM leads`);
    expect(r).toEqual([{ name: "Phụ huynh An", phone: "0912345678", email: null, role: "PARENT", message: "Cho con học thử", status: "NEW" }]);
  });

  it("thiếu tên / thiếu cả SĐT lẫn email / SĐT sai / role lạ / lời nhắn > 1000 ký tự → 400", async () => {
    expect((await leadsPost({ ...ok, name: " " })).status).toBe(400);
    expect((await leadsPost({ name: "A", role: "PARENT" })).status).toBe(400);
    expect((await leadsPost({ ...ok, phone: "12ab" })).status).toBe(400);
    expect((await leadsPost({ ...ok, role: "HACKER" })).status).toBe(400);
    expect((await leadsPost({ ...ok, message: "x".repeat(1001) })).status).toBe(400);
    expect((await leadsPost({ name: "B", email: "khong-hop-le", role: "TEACHER" })).status).toBe(400);
    expect((await rows(`SELECT COUNT(*)::int n FROM leads`))[0].n).toBe(0);
  });

  it("chỉ có email hợp lệ cũng được; role CENTER / TEACHER / STUDENT hợp lệ", async () => {
    expect((await leadsPost({ name: "Trung tâm X", email: "tt@x.vn", role: "CENTER" })).status).toBe(201);
    expect((await leadsPost({ name: "GV", phone: "+84912345678", role: "TEACHER" })).status).toBe(201);
    expect((await leadsPost({ name: "HS", phone: "0987654321", role: "STUDENT" })).status).toBe(201);
  });

  it("bẫy bot: trường ẩn website có giá trị → trả 200 success nhưng không lưu", async () => {
    const res = await leadsPost({ ...ok, website: "http://spam" });
    expect(res.status).toBe(200);
    expect((await res.json()).success).toBe(true);
    expect((await rows(`SELECT COUNT(*)::int n FROM leads`))[0].n).toBe(0);
  });

  it("tối đa 5 lần gửi / giờ / IP → lần 6 bị 429; IP khác vẫn gửi được", async () => {
    for (let i = 0; i < 5; i++) expect((await leadsPost({ ...ok, phone: `091234567${i}` }, "9.9.9.9")).status).toBe(201);
    expect((await leadsPost(ok, "9.9.9.9")).status).toBe(429);
    expect((await leadsPost(ok, "8.8.8.8")).status).toBe(201);
  });
});

describe("API admin xem / cập nhật leads", () => {
  const list = async () => (await import("@/app/api/admin/leads/route")).GET(new Request("http://localhost/api/admin/leads"));
  const patch = async (id: string, body: unknown) =>
    (await import("@/app/api/admin/leads/[id]/route")).PATCH(
      new Request(`http://localhost/api/admin/leads/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }),
      { params: Promise.resolve({ id }) }
    );

  beforeEach(async () => {
    await h.pg.db.exec(`
      INSERT INTO leads (id,name,phone,role,status,created_at) VALUES
        ('l1','Cũ','0911111111','PARENT','NEW', NOW() - INTERVAL '1 day'),
        ('l2','Mới','0922222222','CENTER','NEW', NOW());
    `);
  });

  it("chưa đăng nhập 401; TEACHER/STUDENT 403; ADMIN thấy danh sách mới nhất trước", async () => {
    expect((await list()).status).toBe(401);
    await loginAs("TEACHER");
    expect((await list()).status).toBe(403);
    await loginAs("STUDENT");
    expect((await list()).status).toBe(403);
    await loginAs("ADMIN");
    const json = await (await list()).json();
    expect(json.leads.map((l: any) => l.id)).toEqual(["l2", "l1"]);
  });

  it("PATCH status: ADMIN đổi NEW → CONTACTED → DONE; giá trị lạ 400; không có 404; TEACHER 403", async () => {
    await loginAs("TEACHER");
    expect((await patch("l1", { status: "DONE" })).status).toBe(403);
    await loginAs("ADMIN");
    expect((await patch("l1", { status: "CONTACTED" })).status).toBe(200);
    expect((await patch("l1", { status: "XYZ" })).status).toBe(400);
    expect((await patch("nope", { status: "DONE" })).status).toBe(404);
    expect((await rows(`SELECT status FROM leads WHERE id='l1'`))[0].status).toBe("CONTACTED");
  });
});

describe("Giao diện admin + trang đăng nhập", () => {
  it("trang /admin/leads (client) gọi API, menu admin có mục Liên hệ từ website", () => {
    const s = read("app/admin/leads/page.tsx");
    expect(s.trimStart().startsWith('"use client"')).toBe(true);
    expect(s).toContain("/api/admin/leads");
    expect(s).toMatch(/method:\s*"PATCH"/);
    expect(read("components/AdminLayout.tsx")).toMatch(/href:\s*"\/admin\/leads"[^}]*Liên Hệ Từ Website|Liên Hệ Từ Website[^}]*\/admin\/leads/);
  });

  it("trang đăng nhập / đăng ký bỏ nội dung riêng IELTS và số liệu bịa", () => {
    for (const p of ["app/login/page.tsx", "app/register/page.tsx"]) {
      const s = read(p);
      expect(s, p).not.toMatch(/12\.000\+|Khảo Thí IELTS|IELTS Trực Tuyến/);
    }
  });

  it("migration 011 tạo bảng leads", () => {
    expect(exists("docs/db-migration-011-leads.sql")).toBe(true);
  });
});
