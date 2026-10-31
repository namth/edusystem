// TASK-026 — /api/exam/rubrics bằng pg (giữ hợp đồng), xoá route chết exam/categories + exam/bind-lesson, bỏ mock-data ở trang lộ trình.
// File do trưởng phòng viết, bị khoá.
import { describe, it, expect, vi, beforeEach } from "vitest";
import fs from "fs";
import { createFakePg } from "./helpers/pg-fake";

const h = vi.hoisted(() => {
  process.env.JWT_SECRET = "test_secret_for_vitest_only_0123456789abcdef";
  return { token: undefined as string | undefined, pg: null as any };
});
vi.mock("next/headers", () => ({
  cookies: async () => ({ get: (n: string) => (n === "auth_token" && h.token ? { value: h.token } : undefined), set: () => {} }),
}));
vi.mock("@/lib/db-pg", () => ({ queryPg: (s: string, p?: unknown[]) => h.pg.queryPg(s, p), ensureSchema: async () => {} }));
vi.mock("@/lib/supabase-server", () => ({
  createClient: () => { throw new Error("dùng queryPg"); },
  getServerSupabaseClient: () => { throw new Error("dùng queryPg"); },
}));

import { signJwtToken } from "@/lib/jwt";
async function loginAs(role: "ADMIN" | "TEACHER" | "STUDENT" | null, userId?: string) {
  h.token = role ? await signJwtToken({ userId: userId!, email: `${userId}@x.vn`, role }) : undefined;
}
const req = (method: string, url: string, body?: unknown) =>
  new Request(`http://localhost${url}`, { method, headers: { "Content-Type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) });
const api = () => import("@/app/api/exam/rubrics/route");
const rows = async (sql: string) => (await h.pg.db.query(sql)).rows;

beforeEach(async () => {
  h.token = undefined;
  h.pg = await createFakePg();
  await h.pg.db.exec(`
    CREATE TABLE scoring_rubrics (id TEXT PRIMARY KEY, name TEXT, description TEXT, scale_min NUMERIC, scale_max NUMERIC, scale_step NUMERIC, criteria JSONB, output_language TEXT, created_at TIMESTAMPTZ DEFAULT NOW());
    INSERT INTO scoring_rubrics (id,name,scale_min,scale_max,scale_step,criteria,output_language) VALUES
      ('rubric_ielts_speaking','IELTS Speaking Band',0,9,0.5,'[{"key":"f","label":"F","weight":1,"descriptor":"d"}]','vi'),
      ('rubric_hsk_writing','Tiêu Chí HSK Tiếng Trung',0,100,1,'[]','vi');
  `);
});

describe("GET /api/exam/rubrics", () => {
  it("chưa đăng nhập 401; STUDENT 403; TEACHER đọc được, giữ hợp đồng (skill, framework, language, số)", async () => {
    const { GET } = await api();
    expect((await GET()).status).toBe(401);
    await loginAs("STUDENT", "s1");
    expect((await GET()).status).toBe(403);
    await loginAs("TEACHER", "t1");
    const json = await (await GET()).json();
    expect(json.success).toBe(true);
    const sp = json.rubrics.find((r: any) => r.id === "rubric_ielts_speaking");
    expect(sp).toMatchObject({ skill: "Speaking", framework: "IELTS", language: "EN", scale_min: 0, scale_max: 9, scale_step: 0.5 });
    expect(json.rubrics.find((r: any) => r.id === "rubric_hsk_writing")).toMatchObject({ skill: "Writing", framework: "HSK", language: "ZH", scale_max: 100 });
  });
});

describe("POST/PUT/DELETE — chỉ ADMIN", () => {
  it("TEACHER → 403", async () => {
    await loginAs("TEACHER", "t1");
    const a = await api();
    expect((await a.POST(req("POST", "/x", { name: "x" }))).status).toBe(403);
    expect((await a.PUT(req("PUT", "/x", { id: "rubric_hsk_writing", name: "y" }))).status).toBe(403);
    expect((await a.DELETE(req("DELETE", "/x?id=rubric_hsk_writing"))).status).toBe(403);
  });

  it("POST tạo (mặc định thang 0–9 bước 0.5), tên rỗng → 400; PUT sửa; DELETE xoá; thiếu id → 400", async () => {
    await loginAs("ADMIN", "a1");
    const a = await api();
    const res = await a.POST(req("POST", "/x", { name: "Rubric mới", criteria: [{ key: "k", label: "L", weight: 1, descriptor: "d" }] }));
    expect([200, 201]).toContain(res.status);
    const created = (await res.json()).rubric;
    expect(created).toMatchObject({ name: "Rubric mới", scale_min: 0, scale_max: 9, scale_step: 0.5, output_language: "vi" });
    expect((await a.POST(req("POST", "/x", { name: "  " }))).status).toBe(400);
    expect((await a.PUT(req("PUT", "/x", { id: created.id, name: "Đổi tên", scale_max: 10 }))).status).toBe(200);
    expect((await rows(`SELECT name, scale_max FROM scoring_rubrics WHERE id='${created.id}'`))[0]).toMatchObject({ name: "Đổi tên" });
    expect((await a.PUT(req("PUT", "/x", { name: "x" }))).status).toBe(400);
    expect((await a.DELETE(req("DELETE", `/x?id=${created.id}`))).status).toBe(200);
    expect(await rows(`SELECT id FROM scoring_rubrics WHERE id='${created.id}'`)).toEqual([]);
  });

  it("DELETE rubric đang được chuẩn chấm tham chiếu (sections[].rubric_id) → 409", async () => {
    await h.pg.db.exec(`CREATE TABLE scoring_standards (id VARCHAR(50) PRIMARY KEY, name TEXT, sections JSONB, aggregation JSONB, is_system BOOLEAN);
      INSERT INTO scoring_standards VALUES ('std_x','X','[{"skill":"Speaking","rubric_id":"rubric_ielts_speaking"}]','{}',false);`);
    await loginAs("ADMIN", "a1");
    expect((await (await api()).DELETE(req("DELETE", "/x?id=rubric_ielts_speaking"))).status).toBe(409);
  });
});

describe("Dọn code chết & dữ liệu giả", () => {
  it("không còn route exam/categories và exam/bind-lesson (bảng không tồn tại, không trang nào gọi)", () => {
    expect(fs.existsSync("app/api/exam/categories/route.ts")).toBe(false);
    expect(fs.existsSync("app/api/exam/bind-lesson/route.ts")).toBe(false);
  });
  it("/api/exam/rubrics không dùng Supabase", () => {
    const s = fs.readFileSync("app/api/exam/rubrics/route.ts", "utf8");
    expect(s).not.toContain("supabase");
  });
  it("trang lộ trình /teacher/tests không dùng mock-data", () => {
    const s = fs.readFileSync("app/teacher/tests/page.tsx", "utf8");
    expect(s).not.toContain("@/lib/mock-data");
    expect(s).not.toContain("INITIAL_COURSES");
  });
});
