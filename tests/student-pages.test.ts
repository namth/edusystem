// TASK-004 — Trang học sinh dùng API pg, bỏ Supabase client & dữ liệu giả.
// File do trưởng phòng viết, bị khoá.
import { describe, it, expect, vi, beforeEach } from "vitest";
import fs from "fs";
import path from "path";
import { createFakePg } from "./helpers/pg-fake";

const h = vi.hoisted(() => {
  process.env.JWT_SECRET = "test_secret_for_vitest_only_0123456789abcdef";
  return {
    token: undefined as string | undefined,
    pg: null as null | Awaited<ReturnType<typeof import("./helpers/pg-fake").createFakePg>>,
  };
});

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (n: string) => (n === "auth_token" && h.token ? { value: h.token } : undefined),
    set: () => {},
  }),
}));
vi.mock("@/lib/db-pg", () => ({
  queryPg: (sql: string, params?: unknown[]) => h.pg!.queryPg(sql, params),
  ensureSchema: async () => {},
}));

import { signJwtToken } from "@/lib/jwt";

beforeEach(async () => {
  h.token = undefined;
  h.pg = await createFakePg(["db-migration-004-enrollments-assignments.sql"]);
  await h.pg.db.exec(`
    INSERT INTO exams (id,title,duration_minutes,skills,created_at,stimulus_text) VALUES
      ('e1','Đề Một',60,ARRAY['Reading'],'2026-02-01','bài đọc dài'),
      ('e2','Đề Hai',45,ARRAY['Listening'],'2026-02-03','x'),
      ('e3','Đề Ba',30,ARRAY['Writing'],'2026-02-02','y');
  `);
});

describe("GET /api/exams — danh sách đề (ngân hàng luyện tập)", () => {
  const list = async () => {
    const { GET } = await import("@/app/api/exams/route");
    return GET(new Request("http://localhost/api/exams"));
  };

  it("chưa đăng nhập → 401", async () => {
    expect((await list()).status).toBe(401);
  });

  it("đã đăng nhập → danh sách mới nhất trước, gồm id/title/duration_minutes/skills", async () => {
    h.token = await signJwtToken({ userId: "s1", email: "s1@x.vn", role: "STUDENT" });
    const res = await list();
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.exams.map((e: any) => e.id)).toEqual(["e2", "e3", "e1"]);
    expect(json.exams[0]).toMatchObject({ id: "e2", title: "Đề Hai", duration_minutes: 45, skills: ["Listening"] });
  });

  it("không trả nội dung đề (stimulus_text, question_ids) trong danh sách", async () => {
    h.token = await signJwtToken({ userId: "s1", email: "s1@x.vn", role: "STUDENT" });
    const json = await (await list()).json();
    for (const e of json.exams) {
      expect(e).not.toHaveProperty("stimulus_text");
      expect(e).not.toHaveProperty("question_ids");
    }
  });
});

const ROOT = path.resolve(__dirname, "..");
const read = (p: string) => fs.readFileSync(path.join(ROOT, p), "utf8");

const PAGES: Record<string, string[]> = {
  "app/student/dashboard/page.tsx": ["/api/student/classes", "/api/student/enroll", "/api/submissions"],
  "app/student/class/[classId]/page.tsx": ["/api/student/classes/", "/api/exams"],
  "app/student/analytics/page.tsx": ["/api/submissions", "/api/exams"],
};

const FORBIDDEN_IMPORTS = ["@/lib/supabase", "@/lib/neo4j", "@/lib/mock-data", "@/lib/db-pg"];
const FAKE_DATA = [
  "student_01",
  "teacher_01",
  "sub_demo_01",
  "sub_starter",
  "asg_starter",
  "test_01",
  "test_02",
  "IELTS Master 7.5 - K24",
  "Thầy Nguyễn Văn Đức",
  "IELTS Academic Mock Test #01",
  "Bài Thi IELTS Standard #01",
  "studentCount: 25",
];

describe("Trang học sinh gọi API pg, không dùng Supabase/mock", () => {
  for (const [file, endpoints] of Object.entries(PAGES)) {
    describe(file, () => {
      const src = () => read(file);

      it("không import Supabase client, Neo4j, mock-data hay db-pg", () => {
        for (const imp of FORBIDDEN_IMPORTS) expect(src(), imp).not.toContain(`"${imp}"`);
      });

      it("không còn dữ liệu giả / fallback viết cứng", () => {
        for (const s of FAKE_DATA) expect(src(), s).not.toContain(s);
      });

      it("gọi đúng các endpoint", () => {
        for (const ep of endpoints) expect(src(), ep).toContain(ep);
      });

      it("có trạng thái lỗi hiển thị cho người dùng", () => {
        expect(src()).toMatch(/\b(error|errorMsg|loadError)\b/);
      });
    });
  }

  it("trang lớp học xử lý 403 (chưa tham gia lớp) và 404 (không có lớp)", () => {
    const src = read("app/student/class/[classId]/page.tsx");
    expect(src).toMatch(/403/);
    expect(src).toMatch(/404/);
  });

  it("dashboard xử lý 409 (lớp đủ chỗ) và alreadyEnrolled khi ghi danh", () => {
    const src = read("app/student/dashboard/page.tsx");
    expect(src).toMatch(/409/);
    expect(src).toContain("alreadyEnrolled");
  });

  it("trang cũ /student/test/[id] (schema đề cũ, không còn liên kết) đã bị xoá", () => {
    expect(fs.existsSync(path.join(ROOT, "app/student/test"))).toBe(false);
  });
});
