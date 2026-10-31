// TASK-003 — API học sinh trên PostgreSQL (pg): lớp đã ghi danh, ghi danh bằng mã,
// chi tiết lớp + bài được giao, chi tiết đề, bài nộp. File do trưởng phòng viết, bị khoá.
import { describe, it, expect, vi, beforeEach } from "vitest";
import { createFakePg } from "./helpers/pg-fake";

const h = vi.hoisted(() => {
  process.env.JWT_SECRET = "test_secret_for_vitest_only_0123456789abcdef";
  return {
    token: undefined as string | undefined,
    pg: null as null | Awaited<ReturnType<typeof import("./helpers/pg-fake").createFakePg>>,
    neo4jEnroll: [] as [string, string][],
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
  getPgPool: () => {
    throw new Error("Không dùng pool trực tiếp trong route — dùng queryPg");
  },
  ensureSchema: async () => {},
}));
vi.mock("@/lib/neo4j", () => ({
  getNeo4jDriver: () => null,
  runCypherQuery: async () => [],
  syncTeacherManagesClass: async () => {},
  syncStudentEnrolledInClass: async (s: string, c: string) => {
    h.neo4jEnroll.push([s, c]);
  },
  recordStudentSkillScore: async () => {},
  syncCourseExam: async () => {},
  getExamCourseMapping: async () => [],
}));
const forbidSupabase = () =>
  new Proxy({}, { get() { throw new Error("Route không được dùng Supabase client — dùng queryPg"); } });
vi.mock("@/lib/supabase", () => ({ supabase: forbidSupabase() }));
vi.mock("@/lib/supabase-server", () => ({ createClient: forbidSupabase, getServerSupabaseClient: forbidSupabase }));
vi.mock("@/lib/ai-engine", () => ({
  evaluateWritingSubmission: async () => ({ overallBand: 6.5, feedback: "ok" }),
  evaluateSpeakingWithAudio: async () => ({ overallBand: 6, feedback: "ok" }),
}));

import { signJwtToken } from "@/lib/jwt";

type Role = "ADMIN" | "TEACHER" | "STUDENT";
async function loginAs(role: Role | null, userId?: string) {
  h.token = role ? await signJwtToken({ userId: userId!, email: `${userId}@x.vn`, role }) : undefined;
}
function req(method: string, url: string, body?: unknown) {
  return new Request(`http://localhost${url}`, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}
const ctx = <T extends object>(p: T) => ({ params: Promise.resolve(p) });

beforeEach(async () => {
  h.token = undefined;
  h.neo4jEnroll.length = 0;
  h.pg = await createFakePg(["db-migration-004-enrollments-assignments.sql"]);
  await h.pg.db.exec(`
    INSERT INTO users (id,name,email,role) VALUES
      ('s1','HS Một','s1@x.vn','STUDENT'), ('s2','HS Hai','s2@x.vn','STUDENT'), ('s3','HS Ba','s3@x.vn','STUDENT'),
      ('t1','GV Một','t1@x.vn','TEACHER'), ('t2','GV Hai','t2@x.vn','TEACHER'), ('a1','Admin','a1@x.vn','ADMIN');
    INSERT INTO classes (id,name,code,teacher_id,max_slots,created_at) VALUES
      ('c1','Lớp IELTS A','ABC123','t1',3,'2026-01-01'),
      ('c2','Lớp Đầy','FULL01','t2',1,'2026-01-02'),
      ('c3','Lớp Khác','OTHER9','t2',30,'2026-01-03');
    INSERT INTO exams (id,title,duration_minutes,skills,created_at) VALUES
      ('e1','Đề Một',60,ARRAY['Reading'],'2026-02-01'),
      ('e2','Đề Hai',45,ARRAY['Listening'],'2026-02-02'),
      ('e3','Đề Ba',30,ARRAY['Writing'],'2026-02-03');
    INSERT INTO enrollments (id,student_id,class_id,created_at) VALUES
      ('en1','s1','c1','2026-03-01'), ('en2','s2','c2','2026-03-02'), ('en3','s1','c3','2026-03-03');
    INSERT INTO class_assignments (id,class_id,exam_id,due_date,max_attempts) VALUES
      ('as1','c1','e1','2026-12-31T00:00:00Z',2), ('as2','c1','e2',NULL,1), ('as3','c3','e3',NULL,1);
    INSERT INTO submissions (id,exam_id,student_id,answers,final_score,created_at) VALUES
      ('sub1','e1','s1','{}',6.5,'2026-04-01'), ('sub2','e1','s2','{}',7.0,'2026-04-02'),
      ('sub3','e3','s1','{}',5.5,'2026-04-03'), ('sub4','e2','s1','{}',6.0,'2026-04-04');
  `);
});

describe("GET /api/student/classes — lớp đã ghi danh của chính mình", () => {
  const load = () => import("@/app/api/student/classes/route");

  it("chưa đăng nhập → 401", async () => {
    const { GET } = await load();
    expect((await GET(req("GET", "/api/student/classes"))).status).toBe(401);
  });

  it("STUDENT s1 thấy đúng c1 và c3, không thấy c2", async () => {
    await loginAs("STUDENT", "s1");
    const { GET } = await load();
    const res = await GET(req("GET", "/api/student/classes"));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.classes.map((c: any) => c.id).sort()).toEqual(["c1", "c3"]);
    expect(json.classes[0]).toMatchObject({ name: expect.any(String), code: expect.any(String) });
  });

  it("học sinh chưa ghi danh lớp nào → mảng rỗng", async () => {
    await loginAs("STUDENT", "s3");
    const { GET } = await load();
    const json = await (await GET(req("GET", "/api/student/classes"))).json();
    expect(json).toEqual({ success: true, classes: [] });
  });
});

describe("POST /api/student/enroll — ghi danh bằng mã lớp", () => {
  const load = () => import("@/app/api/student/enroll/route");
  const count = async (sql: string) => Number((await h.pg!.db.query<any>(sql)).rows[0].n);

  it("chưa đăng nhập → 401; TEACHER/ADMIN → 403", async () => {
    const { POST } = await load();
    expect((await POST(req("POST", "/api/student/enroll", { code: "ABC123" }))).status).toBe(401);
    await loginAs("TEACHER", "t1");
    expect((await POST(req("POST", "/api/student/enroll", { code: "ABC123" }))).status).toBe(403);
    await loginAs("ADMIN", "a1");
    expect((await POST(req("POST", "/api/student/enroll", { code: "ABC123" }))).status).toBe(403);
  });

  it("thiếu mã → 400", async () => {
    await loginAs("STUDENT", "s3");
    const { POST } = await load();
    const res = await POST(req("POST", "/api/student/enroll", { code: "   " }));
    expect(res.status).toBe(400);
    expect((await res.json()).success).toBe(false);
  });

  it("mã không tồn tại → 404", async () => {
    await loginAs("STUDENT", "s3");
    const { POST } = await load();
    expect((await POST(req("POST", "/api/student/enroll", { code: "NOPE00" }))).status).toBe(404);
  });

  it("mã hợp lệ (không phân biệt hoa thường, có khoảng trắng) → ghi danh bằng userId của token + đồng bộ Neo4j", async () => {
    await loginAs("STUDENT", "s3");
    const { POST } = await load();
    const res = await POST(req("POST", "/api/student/enroll", { code: "  abc123 ", student_id: "s2" }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toMatchObject({ success: true, alreadyEnrolled: false, class: { id: "c1" } });
    expect(await count(`SELECT COUNT(*) n FROM enrollments WHERE student_id='s3' AND class_id='c1'`)).toBe(1);
    expect(await count(`SELECT COUNT(*) n FROM enrollments WHERE student_id='s2' AND class_id='c1'`)).toBe(0);
    expect(h.neo4jEnroll).toContainEqual(["s3", "c1"]);
  });

  it("đã ghi danh rồi → 200 alreadyEnrolled=true, không tạo bản ghi trùng", async () => {
    await loginAs("STUDENT", "s1");
    const { POST } = await load();
    const json = await (await POST(req("POST", "/api/student/enroll", { code: "ABC123" }))).json();
    expect(json).toMatchObject({ success: true, alreadyEnrolled: true });
    expect(await count(`SELECT COUNT(*) n FROM enrollments WHERE student_id='s1' AND class_id='c1'`)).toBe(1);
  });

  it("lớp đã đủ chỗ → 409, không ghi danh", async () => {
    await loginAs("STUDENT", "s3");
    const { POST } = await load();
    const res = await POST(req("POST", "/api/student/enroll", { code: "FULL01" }));
    expect(res.status).toBe(409);
    expect(await count(`SELECT COUNT(*) n FROM enrollments WHERE class_id='c2'`)).toBe(1);
  });

  it("lỗi Neo4j không làm hỏng ghi danh", async () => {
    const neo = await import("@/lib/neo4j");
    const spy = vi.spyOn(neo, "syncStudentEnrolledInClass").mockRejectedValueOnce(new Error("neo4j down"));
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
    await loginAs("STUDENT", "s3");
    const { POST } = await load();
    const res = await POST(req("POST", "/api/student/enroll", { code: "OTHER9" }));
    expect(res.status).toBe(200);
    expect(await count(`SELECT COUNT(*) n FROM enrollments WHERE student_id='s3' AND class_id='c3'`)).toBe(1);
    spy.mockRestore();
  });
});

describe("GET /api/student/classes/[classId] — chi tiết lớp + bài được giao", () => {
  const load = () => import("@/app/api/student/classes/[classId]/route");
  const get = async (classId: string) => {
    const { GET } = await load();
    return GET(req("GET", `/api/student/classes/${classId}`), ctx({ classId }));
  };

  it("chưa đăng nhập → 401", async () => {
    expect((await get("c1")).status).toBe(401);
  });

  it("lớp không tồn tại → 404", async () => {
    await loginAs("ADMIN", "a1");
    expect((await get("cX")).status).toBe(404);
  });

  it("STUDENT chưa ghi danh lớp → 403", async () => {
    await loginAs("STUDENT", "s2");
    expect((await get("c1")).status).toBe(403);
  });

  it("TEACHER không phụ trách lớp → 403; TEACHER phụ trách → 200", async () => {
    await loginAs("TEACHER", "t2");
    expect((await get("c1")).status).toBe(403);
    await loginAs("TEACHER", "t1");
    expect((await get("c1")).status).toBe(200);
  });

  it("STUDENT đã ghi danh: lớp + bài được giao kèm thông tin đề + bài nộp của chính mình cho các đề đó", async () => {
    await loginAs("STUDENT", "s1");
    const res = await get("c1");
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.class).toMatchObject({ id: "c1", name: "Lớp IELTS A", code: "ABC123", teacher_id: "t1" });

    const byExam = Object.fromEntries(json.assignments.map((a: any) => [a.exam_id, a]));
    expect(Object.keys(byExam).sort()).toEqual(["e1", "e2"]);
    expect(byExam.e1).toMatchObject({ id: "as1", class_id: "c1", max_attempts: 2, exam: { id: "e1", title: "Đề Một", duration_minutes: 60, skills: ["Reading"] } });
    expect(byExam.e1.due_date).toBeTruthy();
    expect(byExam.e2.due_date).toBeNull();

    const subIds = json.submissions.map((s: any) => s.id).sort();
    expect(subIds).toEqual(["sub1", "sub4"]); // không có sub2 (của s2), không có sub3 (đề e3 không giao cho c1)
  });

  it("đề được giao nhưng đã bị xoá → exam: null, không lỗi", async () => {
    await h.pg!.db.exec(`DELETE FROM exams WHERE id='e2'`);
    await loginAs("STUDENT", "s1");
    const json = await (await get("c1")).json();
    const a2 = json.assignments.find((a: any) => a.exam_id === "e2");
    expect(a2.exam).toBeNull();
  });

  it("TEACHER/ADMIN xem lớp: submissions là mảng rỗng", async () => {
    await loginAs("ADMIN", "a1");
    const json = await (await get("c1")).json();
    expect(json.submissions).toEqual([]);
  });
});

describe("GET /api/exams/[id] — chi tiết đề", () => {
  const get = async (id: string) => {
    const { GET } = await import("@/app/api/exams/[id]/route");
    return GET(req("GET", `/api/exams/${id}`), ctx({ id }));
  };

  it("chưa đăng nhập → 401", async () => {
    expect((await get("e1")).status).toBe(401);
  });

  it("có đề → 200 { success, exam }", async () => {
    await loginAs("STUDENT", "s1");
    const res = await get("e1");
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ success: true, exam: { id: "e1", title: "Đề Một", duration_minutes: 60 } });
  });

  it("không có đề → 404", async () => {
    await loginAs("STUDENT", "s1");
    expect((await get("eX")).status).toBe(404);
  });
});

describe("/api/submissions chạy trên PostgreSQL (pg)", () => {
  const load = () => import("@/app/api/submissions/route");

  it("POST STUDENT: lưu vào bảng submissions, student_id lấy từ token", async () => {
    await loginAs("STUDENT", "s3");
    const { POST } = await load();
    const res = await POST(req("POST", "/api/submissions", { exam_id: "e1", student_id: "s2", answers: { q1: "A" } }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.data).toMatchObject({ exam_id: "e1", student_id: "s3" });
    const rows = (await h.pg!.db.query<any>(`SELECT * FROM submissions WHERE exam_id='e1' AND student_id='s3'`)).rows;
    expect(rows).toHaveLength(1);
    expect(rows[0].answers).toEqual({ q1: "A" });
    expect(rows[0].id).toBe(json.data.id);
    expect((await h.pg!.db.query<any>(`SELECT COUNT(*) n FROM submissions WHERE student_id='s2'`)).rows[0].n).toBe(1);
  });

  it("POST thiếu exam_id → 400, không ghi", async () => {
    await loginAs("STUDENT", "s3");
    const { POST } = await load();
    const res = await POST(req("POST", "/api/submissions", { answers: {} }));
    expect(res.status).toBe(400);
    expect((await h.pg!.db.query<any>(`SELECT COUNT(*) n FROM submissions WHERE student_id='s3'`)).rows[0].n).toBe(0);
  });

  it("POST TEACHER/ADMIN thiếu student_id → 400 (không còn mặc định student_01)", async () => {
    await loginAs("TEACHER", "t1");
    const { POST } = await load();
    const res = await POST(req("POST", "/api/submissions", { exam_id: "e1", answers: {} }));
    expect(res.status).toBe(400);
    expect((await h.pg!.db.query<any>(`SELECT COUNT(*) n FROM submissions WHERE student_id='student_01'`)).rows[0].n).toBe(0);
  });

  it("POST bài viết đủ dài → lưu điểm AI vào ai_score", async () => {
    await loginAs("STUDENT", "s3");
    const { POST } = await load();
    const res = await POST(req("POST", "/api/submissions", { exam_id: "e3", answers: {}, writing_essay: "This is a sufficiently long essay text for grading." }));
    expect(res.status).toBe(200);
    const row = (await h.pg!.db.query<any>(`SELECT * FROM submissions WHERE exam_id='e3' AND student_id='s3'`)).rows[0];
    expect(Number(row.ai_score)).toBe(6.5);
  });

  it("GET STUDENT: chỉ bài của mình, mới nhất trước, bỏ qua student_id trên query", async () => {
    await loginAs("STUDENT", "s1");
    const { GET } = await load();
    const json = await (await GET(req("GET", "/api/submissions?student_id=s2"))).json();
    expect(json.success).toBe(true);
    expect(json.data.map((s: any) => s.id)).toEqual(["sub4", "sub3", "sub1"]);
  });

  it("GET STUDENT lọc theo exam_id", async () => {
    await loginAs("STUDENT", "s1");
    const { GET } = await load();
    const json = await (await GET(req("GET", "/api/submissions?exam_id=e1"))).json();
    expect(json.data.map((s: any) => s.id)).toEqual(["sub1"]);
  });

  it("GET TEACHER lọc theo student_id trên query", async () => {
    await loginAs("TEACHER", "t1");
    const { GET } = await load();
    const json = await (await GET(req("GET", "/api/submissions?student_id=s2"))).json();
    expect(json.data.map((s: any) => s.id)).toEqual(["sub2"]);
  });
});

describe("ensureSchema tạo bảng của migration 004", () => {
  it("lib/db-pg.ts chứa DDL cho enrollments và class_assignments", async () => {
    const fs = await import("fs");
    const src = fs.readFileSync("lib/db-pg.ts", "utf8");
    expect(src).toMatch(/CREATE TABLE IF NOT EXISTS enrollments/i);
    expect(src).toMatch(/CREATE TABLE IF NOT EXISTS class_assignments/i);
  });
});
