// TASK-019 — API chuẩn chấm + trang admin + rubric-resolver bằng pg (FEAT-011 SCR-E1, DEC-014).
// File do trưởng phòng viết, bị khoá.
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
}));
vi.mock("@/lib/db-pg", () => ({
  queryPg: (sql: string, params?: unknown[]) => h.pg.queryPg(sql, params),
  ensureSchema: async () => {},
}));
vi.mock("@/lib/supabase", () => ({ supabase: new Proxy({}, { get() { throw new Error("không dùng Supabase client"); } }) }));

import { signJwtToken } from "@/lib/jwt";

async function loginAs(role: "ADMIN" | "TEACHER" | "STUDENT" | null, userId?: string) {
  h.token = role ? await signJwtToken({ userId: userId!, email: `${userId}@x.vn`, role }) : undefined;
}
const req = (method: string, body?: unknown) =>
  new Request("http://localhost/x", { method, headers: { "Content-Type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) });
const ctx = (id: string) => ({ params: Promise.resolve({ id }) });
const rows = async (sql: string) => (await h.pg.db.query(sql)).rows;
const list = () => import("@/app/api/scoring-standards/route");
const one = () => import("@/app/api/scoring-standards/[id]/route");

beforeEach(async () => {
  h.token = undefined;
  h.pg = await createFakePg();
  await h.pg.db.exec(`
    CREATE TABLE courses (id VARCHAR(50) PRIMARY KEY, title VARCHAR(255), created_by VARCHAR(50));
    CREATE TABLE scoring_rubrics (id TEXT PRIMARY KEY, name TEXT, description TEXT, scale_min NUMERIC, scale_max NUMERIC, scale_step NUMERIC, criteria JSONB, output_language TEXT, created_at TIMESTAMPTZ DEFAULT NOW());
    INSERT INTO scoring_rubrics (id,name,scale_min,scale_max,scale_step,criteria,output_language) VALUES
      ('rubric_ielts_writing','IELTS Writing',0,9,0.5,'[{"key":"task","label":"Task","weight":1,"descriptor":"d"}]','vi'),
      ('rubric_ielts_speaking','IELTS Speaking',0,9,0.5,'[{"key":"flu","label":"Fluency","weight":1,"descriptor":"d"}]','vi');
  `);
  await h.pg.db.exec(fs.readFileSync("docs/db-migration-009-scoring-standards.sql", "utf8"));
  await h.pg.db.exec(`
    INSERT INTO exams (id,title,scoring_standard_id) VALUES ('eI','Đề IELTS','std_ielts'), ('eN','Đề không chuẩn',NULL);
    INSERT INTO courses (id,title,default_scoring_standard_id) VALUES ('co1','Khóa','std_hsk1');
  `);
});

const valid = {
  name: "Thang 100", framework: "INTERNAL",
  sections: [
    { skill: "Reading", min: 0, max: 100, step: 1, conversion: "LINEAR" },
    { skill: "Listening", min: 0, max: 100, step: 1, conversion: "TABLE", table_question_count: 10,
      table: [{ min_correct: 0, score: 0 }, { min_correct: 5, score: 50 }, { min_correct: 10, score: 100 }] },
    { skill: "Writing", min: 0, max: 100, step: 1, conversion: "LINEAR", rubric_id: "rubric_ielts_writing" },
  ],
  aggregation: { method: "AVERAGE", round_step: 1, pass_score: 50 },
};

describe("GET /api/scoring-standards", () => {
  it("chưa đăng nhập 401; STUDENT 403; TEACHER và ADMIN xem được, có đủ 4 chuẩn hệ thống", async () => {
    const { GET } = await list();
    expect((await GET(req("GET"))).status).toBe(401);
    await loginAs("STUDENT", "s1");
    expect((await GET(req("GET"))).status).toBe(403);
    await loginAs("TEACHER", "t1");
    const json = await (await GET(req("GET"))).json();
    expect(json.standards.map((s: any) => s.id)).toEqual(expect.arrayContaining(["std_ielts", "std_toeic_lr", "std_hsk1", "std_internal_10"]));
    expect(json.standards.find((s: any) => s.id === "std_ielts")).toMatchObject({ is_system: true, framework: "IELTS" });
  });
});

describe("POST/PUT/DELETE — chỉ ADMIN", () => {
  it("TEACHER không tạo/sửa/xoá được (403)", async () => {
    await loginAs("TEACHER", "t1");
    expect((await (await list()).POST(req("POST", valid))).status).toBe(403);
    expect((await (await one()).PUT(req("PUT", { name: "x" }), ctx("std_ielts"))).status).toBe(403);
    expect((await (await one()).DELETE(req("DELETE"), ctx("std_ielts"))).status).toBe(403);
  });

  it("POST hợp lệ → 201, id 'std_' + uuid, is_system false, created_by", async () => {
    await loginAs("ADMIN", "a1");
    const res = await (await list()).POST(req("POST", valid));
    expect(res.status).toBe(201);
    const { standard } = await res.json();
    expect(standard.id).toMatch(/^std_[0-9a-f-]{36}$/);
    expect(standard).toMatchObject({ name: "Thang 100", is_system: false, created_by: "a1" });
    expect(standard.sections).toHaveLength(3);
  });

  it("POST dữ liệu sai → 400 (không ghi)", async () => {
    await loginAs("ADMIN", "a1");
    const { POST } = await list();
    const bad: any[] = [
      { ...valid, name: " " },
      { ...valid, sections: [] },
      { ...valid, sections: [{ ...valid.sections[0], skill: "Cooking" }] },
      { ...valid, sections: [valid.sections[0], valid.sections[0]] },                                     // trùng kỹ năng
      { ...valid, sections: [{ ...valid.sections[0], min: 10, max: 10 }] },                               // min ≥ max
      { ...valid, sections: [{ ...valid.sections[0], step: 0 }] },
      { ...valid, sections: [{ ...valid.sections[0], conversion: "MAGIC" }] },
      { ...valid, sections: [{ ...valid.sections[1], table: [] }] },                                      // TABLE thiếu bảng
      { ...valid, sections: [{ ...valid.sections[1], table: [{ min_correct: 5, score: 50 }, { min_correct: 2, score: 20 }] }] }, // không tăng dần
      { ...valid, sections: [{ ...valid.sections[1], table: [{ min_correct: 0, score: 500 }] }] },        // điểm ngoài thang
      { ...valid, sections: [{ ...valid.sections[1], table_question_count: 0 }] },
      { ...valid, sections: [{ ...valid.sections[2], rubric_id: "rubric_none" }] },                       // rubric không tồn tại
      { ...valid, aggregation: { method: "MEDIAN", round_step: 1 } },
      { ...valid, aggregation: { method: "SUM", round_step: 0 } },
      { ...valid, aggregation: { method: "WEIGHTED", round_step: 1, weights: { Reading: -1 } } },
      { ...valid, aggregation: { method: "AVERAGE", round_step: 1, section_min: { Speaking: 5 } } },     // sàn cho kỹ năng không có
    ];
    for (const b of bad) expect((await POST(req("POST", b))).status, JSON.stringify(b).slice(0, 120)).toBe(400);
    expect((await rows(`SELECT COUNT(*)::int n FROM scoring_standards`))[0].n).toBe(4);
  });

  it("PUT: sửa được cả chuẩn hệ thống; validate như POST; không có → 404", async () => {
    await loginAs("ADMIN", "a1");
    const { PUT } = await one();
    const res = await PUT(req("PUT", { name: "IELTS (sửa)" }), ctx("std_ielts"));
    expect(res.status).toBe(200);
    expect((await res.json()).standard).toMatchObject({ name: "IELTS (sửa)", is_system: true });
    expect((await PUT(req("PUT", { sections: [] }), ctx("std_ielts"))).status).toBe(400);
    expect((await PUT(req("PUT", { name: "x" }), ctx("std_none"))).status).toBe(404);
  });

  it("DELETE: chuẩn hệ thống → 409; đang được đề/khóa dùng → 409; chuẩn tự tạo không dùng → 200", async () => {
    await loginAs("ADMIN", "a1");
    const { DELETE } = await one();
    expect((await DELETE(req("DELETE"), ctx("std_ielts"))).status).toBe(409);
    const { standard } = await (await (await list()).POST(req("POST", valid))).json();
    await h.pg.db.query(`UPDATE exams SET scoring_standard_id=$1 WHERE id='eN'`, [standard.id]);
    const r409 = await DELETE(req("DELETE"), ctx(standard.id));
    expect(r409.status).toBe(409);
    expect((await r409.json()).usage).toMatchObject({ exams: 1, courses: 0 });
    await h.pg.db.query(`UPDATE exams SET scoring_standard_id=NULL WHERE id='eN'`);
    expect((await DELETE(req("DELETE"), ctx(standard.id))).status).toBe(200);
  });
});

describe("lib/rubric-resolver.ts dùng pg và chuẩn chấm của đề", () => {
  it("không còn import Supabase trình duyệt", () => {
    const src = fs.readFileSync("lib/rubric-resolver.ts", "utf8");
    expect(src).not.toContain('"@/lib/supabase"');
  });

  it("đề có chuẩn: lấy rubric tiêu chí của phần kỹ năng, thang theo phần", async () => {
    const { resolveRubricForExam } = await import("@/lib/rubric-resolver");
    const w = await resolveRubricForExam("eI", "WRITING_ESSAY");
    expect(w).toMatchObject({ id: "rubric_ielts_writing", scale: { min: 0, max: 9, step: 0.5 } });
    expect(w.criteria[0].key).toBe("task");
    const s = await resolveRubricForExam("eI", "SPEAKING_TOPIC_PROMPT");
    expect(s.id).toBe("rubric_ielts_speaking");
  });

  it("đề không chuẩn → chuẩn mặc định Thang 10 (std_internal_10), thang 0–10", async () => {
    const { resolveRubricForExam } = await import("@/lib/rubric-resolver");
    const r = await resolveRubricForExam("eN", "WRITING_ESSAY");
    expect(r.scale).toEqual({ min: 0, max: 10, step: 0.25 });
  });
});

describe("Trang admin SCR-E1", () => {
  it("app/admin/scoring-standards/page.tsx gọi API, có form phần thi + bảng tra + quy tắc tổng", () => {
    const s = fs.readFileSync("app/admin/scoring-standards/page.tsx", "utf8");
    expect(s.trimStart().startsWith('"use client"')).toBe(true);
    expect(s).toContain("/api/scoring-standards");
    for (const k of ["LINEAR", "TABLE", "min_correct", "AVERAGE", "SUM", "WEIGHTED", "pass_score", "rubric_id", "is_system"]) expect(s, k).toContain(k);
    expect(s).toMatch(/409/);
    expect(s).not.toContain('"@/lib/supabase"');
  });
  it("AdminLayout có menu 'Chuẩn Chấm Điểm' trỏ /admin/scoring-standards", () => {
    const s = fs.readFileSync("components/AdminLayout.tsx", "utf8");
    expect(s).toContain("/admin/scoring-standards");
    expect(s).toContain("Chuẩn Chấm Điểm");
  });
});
