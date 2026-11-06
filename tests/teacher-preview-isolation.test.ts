// Xem trước đề thi như học sinh (SCR-L3 mở rộng cho đề) + tách biệt phân hệ giáo viên ↔ học sinh / quản trị.
// File do trưởng phòng viết, bị khoá.
import { describe, it, expect, vi, beforeEach } from "vitest";
import fs from "fs";
import path from "path";
import { createFakePg } from "./helpers/pg-fake";

const h = vi.hoisted(() => {
  process.env.JWT_SECRET = "test_secret_for_vitest_only_0123456789abcdef";
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
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

import { signJwtToken } from "@/lib/jwt";

type Role = "ADMIN" | "TEACHER" | "STUDENT";
async function loginAs(role: Role | null, userId = "u1") {
  h.token = role ? await signJwtToken({ userId, email: `${userId}@x.vn`, role }) : undefined;
}
const req = (method: string, body?: unknown) =>
  new Request("http://localhost/x", {
    method,
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
const ctx = (id: string) => ({ params: Promise.resolve({ id }) });
const api = () => import("@/app/api/teacher/exams/[id]/preview/route");

beforeEach(async () => {
  h.token = undefined;
  h.pg = await createFakePg();
  await h.pg.db.exec(`
    ALTER TABLE exams ADD COLUMN description TEXT;
    INSERT INTO questions (id,skill,category,prompt,content) VALUES
      ('qMC','Reading','READING_MC','P','{"sub_questions":[{"id":"s1","text":"?","option_a":"a","option_b":"b","option_c":"c","option_d":"d","correct_answer":"B"}]}'),
      ('qE','Writing','WRITING_ESSAY','Viết','{"min_words":10}'),
      ('qF','Reading','READING_FLASHCARD_SET','Thẻ','{"flashcard_ids":["f1"]}');
    INSERT INTO flashcards (id,vietnamese_name,correct_english_word,options) VALUES ('f1','táo','apple','["pear","apple"]');
    INSERT INTO exams (id,title,duration_minutes,skills,question_ids,created_by) VALUES
      ('e1','Đề 1',45,'{Reading,Writing}','["qMC","qE","qF"]','t1'), ('e2','Đề t2',60,'{}','["qMC"]','t2');
  `);
});

describe("GET /api/teacher/exams/[id]/preview — đề thi như học sinh thấy", () => {
  it("chưa đăng nhập 401; STUDENT 403; đề của GV khác 403; không có 404; ADMIN xem được", async () => {
    const { GET } = await api();
    expect((await GET(req("GET"), ctx("e1"))).status).toBe(401);
    await loginAs("STUDENT", "s1");
    expect((await GET(req("GET"), ctx("e1"))).status).toBe(403);
    await loginAs("TEACHER", "t1");
    expect((await GET(req("GET"), ctx("e2"))).status).toBe(403);
    expect((await GET(req("GET"), ctx("eX"))).status).toBe(404);
    await loginAs("ADMIN", "a1");
    expect((await GET(req("GET"), ctx("e2"))).status).toBe(200);
  });

  it("câu hỏi đúng thứ tự, đã ẩn đáp án; kèm thời lượng và kỹ năng", async () => {
    await loginAs("TEACHER", "t1");
    const json = await (await (await api()).GET(req("GET"), ctx("e1"))).json();
    expect(json.exam).toMatchObject({ id: "e1", title: "Đề 1", duration_minutes: 45, skills: ["Reading", "Writing"] });
    expect(json.questions.map((q: { id: string }) => q.id)).toEqual(["qMC", "qE", "qF"]);
    const text = JSON.stringify(json);
    expect(text).not.toContain("correct_answer");
    expect(text).not.toContain("correct_english_word");
  });
});

describe("POST /api/teacher/exams/[id]/preview — chấm thử, KHÔNG tạo lượt làm bài", () => {
  it("trả điểm khách quan; câu AI chỉ đánh dấu; không ghi submissions", async () => {
    await loginAs("TEACHER", "t1");
    const res = await (await api()).POST(req("POST", { answers: { qMC: { s1: "b" }, qE: "essay", qF: { f1: "pear" } } }), ctx("e1"));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.objective_earned).toBe(1);
    expect(json.objective_max).toBe(2);
    expect(json.ai_max).toBe(1);
    expect((await h.pg.db.query("SELECT COUNT(*)::int n FROM submissions")).rows[0].n).toBe(0);
  });

  it("answers không phải object → 400; đề của GV khác → 403", async () => {
    await loginAs("TEACHER", "t1");
    const { POST } = await api();
    expect((await POST(req("POST", { answers: [] }), ctx("e1"))).status).toBe(400);
    expect((await POST(req("POST", { answers: {} }), ctx("e2"))).status).toBe(403);
  });
});

describe("middleware: giáo viên / quản trị không vào được phân hệ học sinh", () => {
  async function run(p: string) {
    const { NextRequest } = await import("next/server");
    const { middleware } = await import("@/middleware");
    const headers = new Headers();
    if (h.token) headers.set("cookie", `auth_token=${h.token}`);
    return middleware(new NextRequest(`http://localhost${p}`, { headers }));
  }
  const location = (res: Response) => {
    const loc = res.headers.get("location");
    return loc ? new URL(loc).pathname : null;
  };

  it("TEACHER vào /student/exam/x → về /teacher/classes", async () => {
    await loginAs("TEACHER");
    expect(location(await run("/student/exam/e1"))).toBe("/teacher/classes");
    expect(location(await run("/student/lesson/l1"))).toBe("/teacher/classes");
  });

  it("ADMIN vào /student/dashboard → về /admin", async () => {
    await loginAs("ADMIN");
    expect(location(await run("/student/dashboard"))).toBe("/admin");
  });

  it("STUDENT vẫn vào được /student/exam/x; /student/landing vẫn công khai", async () => {
    await loginAs("STUDENT");
    expect(location(await run("/student/exam/e1"))).toBeNull();
    await loginAs(null);
    expect(location(await run("/student/landing"))).toBeNull();
  });
});

describe("Giao diện phân hệ giáo viên không dẫn sang phân hệ khác", () => {
  const read = (p: string) => fs.readFileSync(p, "utf8");
  function walk(dir: string): string[] {
    return fs.readdirSync(dir, { withFileTypes: true }).flatMap((d) => {
      const p = path.join(dir, d.name);
      return d.isDirectory() ? walk(p) : /\.(tsx?|jsx?)$/.test(d.name) ? [p] : [];
    });
  }
  const teacherFiles = [
    ...walk("app/teacher"),
    ...walk("components/teacher"),
    ...walk("components/question-builder"),
    "components/TeacherLayout.tsx",
    "components/class-roadmap/TeacherClassRoadmap.tsx",
  ];

  it("không có đường dẫn trang /student/... hoặc /admin/... (API /api/... không tính)", () => {
    const bad: string[] = [];
    for (const f of teacherFiles) {
      const s = read(f);
      const m = s.match(/["'`]\/(student|admin)(\/|["'`?])/g);
      if (m) bad.push(`${f}: ${m.join(", ")}`);
    }
    expect(bad).toEqual([]);
  });

  it("Navbar dùng ở trang học sinh không có nút chuyển sang Giáo viên / Quản trị", () => {
    const s = read("components/Navbar.tsx");
    expect(s).not.toMatch(/href="\/(teacher|admin)/);
  });

  it("xem trước dùng modal chung ở: sửa bài học, sửa đề thi, kho bài học, kho đề, lộ trình", () => {
    expect(read("app/teacher/lessons/[id]/page.tsx")).toMatch(/StudentPreviewButton kind="lesson"/);
    expect(read("app/teacher/tests/create/page.tsx")).toMatch(/StudentPreviewButton kind="exam"/);
    expect(read("components/teacher/LessonLibraryPanel.tsx")).toMatch(/<StudentPreviewModal[\s\S]*kind="lesson"/);
    expect(read("components/teacher/ExamLibraryPanel.tsx")).toMatch(/<StudentPreviewModal[\s\S]*kind="exam"/);
    expect(read("app/teacher/tests/page.tsx")).toContain("<StudentPreviewModal");
    const modal = read("components/teacher/StudentPreviewModal.tsx");
    expect(modal).toContain("@/components/lesson-player/LessonPlayer");
    expect(modal).toContain("/preview");
  });

  it("AI Import trong phân hệ giáo viên mở trình Upload đề của giáo viên", () => {
    // Trang lộ trình bỏ hẳn nút "AI Exam Importer" (yêu cầu 05/11)
    expect(read("app/teacher/tests/page.tsx")).not.toContain("AI Exam Importer");
    expect(read("components/teacher/ExamLibraryPanel.tsx")).toContain('href="/teacher/tests/create?mode=ai"');
    expect(read("app/teacher/tests/create/page.tsx")).toMatch(/modeParam === "ai"/);
  });
});

describe("Layout 3 phân hệ: logo dọc, topbar gọn, đăng xuất chỉ trong menu hồ sơ", () => {
  const layouts = ["components/TeacherLayout.tsx", "components/StudentLayout.tsx", "components/AdminLayout.tsx"];
  for (const f of layouts) {
    it(f, () => {
      const s = fs.readFileSync(f, "utf8");
      expect(s).toContain("/brand/kitokit-logo-dung.png");
      expect(s).not.toMatch(/KitoKit · /);
      // đúng một nút gọi handleLogout (trong menu hồ sơ)
      expect(s.match(/onClick=\{handleLogout\}/g)?.length).toBe(1);
      expect(s).toContain("useDismissable(userMenuRef");
      expect(s).toContain("ref={userMenuRef}");
    });
  }
});
