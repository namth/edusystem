// TASK-001 — Bắt buộc xác thực & phân quyền cho toàn bộ API route.
// File này do trưởng phòng viết và bị khoá (tests.lock).
import { describe, it, expect, vi, beforeEach } from "vitest";

const h = vi.hoisted(() => {
  process.env.JWT_SECRET = "test_secret_for_vitest_only_0123456789abcdef";
  process.env.INTERNAL_API_TOKEN = "internal_test_token_xyz";
  const state = {
    token: undefined as string | undefined,
    touched: [] as string[],
    eqCalls: [] as [string, unknown][],
    inserts: [] as unknown[],
  };
  const touch = (name: string) => (..._args: unknown[]) => {
    state.touched.push(name);
    return Promise.resolve({ rows: [], rowCount: 0 });
  };
  // Builder Supabase giả: mọi method trả về chính nó, await ra { data: [], error: null }.
  const makeBuilder = (): any =>
    new Proxy(
      {},
      {
        get(_t, prop) {
          if (prop === "then") {
            return (resolve: (v: unknown) => void) => resolve({ data: [], error: null });
          }
          return (...args: unknown[]) => {
            state.touched.push(`supabase.${String(prop)}`);
            if (prop === "eq") state.eqCalls.push([args[0] as string, args[1]]);
            if (prop === "insert") state.inserts.push(args[0]);
            return makeBuilder();
          };
        },
      }
    );
  return { state, touch, makeBuilder };
});

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => (name === "auth_token" && h.state.token ? { value: h.state.token } : undefined),
    set: () => {},
  }),
}));
vi.mock("@/lib/db-pg", () => ({
  queryPg: h.touch("queryPg"),
  getPgPool: h.touch("getPgPool"),
  ensureSchema: h.touch("ensureSchema"),
}));
vi.mock("@/lib/neo4j", () => ({
  getNeo4jDriver: () => null,
  runCypherQuery: h.touch("neo4j"),
  syncTeacherManagesClass: h.touch("neo4j"),
  syncStudentEnrolledInClass: h.touch("neo4j"),
  recordStudentSkillScore: h.touch("neo4j"),
  syncCourseExam: h.touch("neo4j"),
  getExamCourseMapping: h.touch("neo4j"),
}));
vi.mock("@/lib/supabase", () => ({ supabase: h.makeBuilder() }));
vi.mock("@/lib/supabase-server", () => ({
  createClient: async () => h.makeBuilder(),
  getServerSupabaseClient: () => h.makeBuilder(),
}));
vi.mock("@supabase/supabase-js", () => ({ createClient: () => h.makeBuilder() }));
vi.mock("@/lib/redis-queue", () => ({
  pushRedisStreamEvent: h.touch("redis"),
  pushGradingEvent: h.touch("redis"),
}));
vi.mock("@/lib/kafka", () => ({ emitKafkaEvent: h.touch("kafka") }));
vi.mock("@/lib/portkey", () => ({ callPortkeyGrading: h.touch("portkey") }));
vi.mock("@/lib/ai-engine", () => ({
  evaluateSpeakingWithAudio: h.touch("ai"),
  evaluateWritingWithRubric: h.touch("ai"),
  evaluateSpeakingSubmission: h.touch("ai"),
  evaluateWritingSubmission: h.touch("ai"),
  evaluateAITaskWithRubric: h.touch("ai"),
  evaluateAITaskWithGeminiFlashLite: h.touch("ai"),
  parseExamRawTextWithAI: h.touch("ai"),
}));

import { signJwtToken } from "@/lib/jwt";

type Role = "ADMIN" | "TEACHER" | "STUDENT";
const ALL: Role[] = ["ADMIN", "TEACHER", "STUDENT"];

async function loginAs(role: Role | null, userId = `usr_${role?.toLowerCase()}_1`) {
  h.state.token = role ? await signJwtToken({ userId, email: `${userId}@x.vn`, role }) : undefined;
}

function req(method: string, url: string, body?: unknown, headers: Record<string, string> = {}) {
  return new Request(`http://localhost${url}`, {
    method,
    headers: { "Content-Type": "application/json", ...headers },
    body: body === undefined || method === "GET" ? undefined : JSON.stringify(body),
  });
}

type Case = {
  name: string;
  load: () => Promise<Record<string, any>>;
  method: string;
  url: string;
  body?: unknown;
  ctx?: unknown;
  allowed: Role[];
};

const idCtx = { params: Promise.resolve({ id: "usr_teacher_9" }) };

const CASES: Case[] = [
  { name: "admin/create-user POST", load: () => import("@/app/api/admin/create-user/route"), method: "POST", url: "/api/admin/create-user", body: { email: "a@b.vn", password: "Abcdef1!", name: "A", role: "STUDENT" }, allowed: ["ADMIN"] },
  { name: "admin/delete-user POST", load: () => import("@/app/api/admin/delete-user/route"), method: "POST", url: "/api/admin/delete-user", body: { userId: "usr_x" }, allowed: ["ADMIN"] },
  { name: "admin/teachers/[id] GET", load: () => import("@/app/api/admin/teachers/[id]/route"), method: "GET", url: "/api/admin/teachers/usr_teacher_9", ctx: idCtx, allowed: ["ADMIN"] },
  { name: "admin/teachers/[id] PUT", load: () => import("@/app/api/admin/teachers/[id]/route"), method: "PUT", url: "/api/admin/teachers/usr_teacher_9", body: { name: "B" }, ctx: idCtx, allowed: ["ADMIN"] },
  { name: "admin/test-db GET", load: () => import("@/app/api/admin/test-db/route"), method: "GET", url: "/api/admin/test-db", allowed: ["ADMIN"] },
  { name: "admin/test-portkey POST", load: () => import("@/app/api/admin/test-portkey/route"), method: "POST", url: "/api/admin/test-portkey", body: {}, allowed: ["ADMIN"] },
  { name: "admin/test-supabase GET", load: () => import("@/app/api/admin/test-supabase/route"), method: "GET", url: "/api/admin/test-supabase", allowed: ["ADMIN"] },
  { name: "events POST", load: () => import("@/app/api/events/route"), method: "POST", url: "/api/events", body: { streamKey: "s", eventType: "E", payload: {} }, allowed: ["ADMIN", "TEACHER"] },
  { name: "exam/bind-lesson POST", load: () => import("@/app/api/exam/bind-lesson/route"), method: "POST", url: "/api/exam/bind-lesson", body: { examId: "e1", lessonId: "l1" }, allowed: ["ADMIN", "TEACHER"] },
  { name: "exam/categories GET", load: () => import("@/app/api/exam/categories/route"), method: "GET", url: "/api/exam/categories", allowed: ALL },
  { name: "exam/grade-async POST", load: () => import("@/app/api/exam/grade-async/route"), method: "POST", url: "/api/exam/grade-async", body: { submissionId: "sub_1" }, allowed: ["ADMIN", "TEACHER"] },
  { name: "exam/grade-override PUT", load: () => import("@/app/api/exam/grade-override/route"), method: "PUT", url: "/api/exam/grade-override", body: { submissionId: "sub_1", finalScore: 7 }, allowed: ["ADMIN", "TEACHER"] },
  { name: "exam/rubrics GET", load: () => import("@/app/api/exam/rubrics/route"), method: "GET", url: "/api/exam/rubrics", allowed: ["ADMIN", "TEACHER"] },
  { name: "exam/rubrics POST", load: () => import("@/app/api/exam/rubrics/route"), method: "POST", url: "/api/exam/rubrics", body: { name: "R" }, allowed: ["ADMIN"] },
  { name: "exam/rubrics PUT", load: () => import("@/app/api/exam/rubrics/route"), method: "PUT", url: "/api/exam/rubrics", body: { id: "r1", name: "R" }, allowed: ["ADMIN"] },
  { name: "exam/rubrics DELETE", load: () => import("@/app/api/exam/rubrics/route"), method: "DELETE", url: "/api/exam/rubrics?id=r1", allowed: ["ADMIN"] },
  { name: "submissions POST", load: () => import("@/app/api/submissions/route"), method: "POST", url: "/api/submissions", body: { exam_id: "e1", answers: {} }, allowed: ALL },
  { name: "submissions GET", load: () => import("@/app/api/submissions/route"), method: "GET", url: "/api/submissions", allowed: ALL },
  { name: "tts GET", load: () => import("@/app/api/tts/route"), method: "GET", url: "/api/tts?text=hello&gender=Female", allowed: ALL },
];

async function call(c: Case, headers: Record<string, string> = {}) {
  const mod = await c.load();
  const handler = mod[c.method];
  expect(handler, `${c.name}: thiếu handler ${c.method}`).toBeTypeOf("function");
  const res: Response = c.ctx ? await handler(req(c.method, c.url, c.body, headers), c.ctx) : await handler(req(c.method, c.url, c.body, headers));
  return res;
}

beforeEach(() => {
  // Không gọi mạng thật (TTS, Portkey...) trong test.
  vi.stubGlobal("fetch", async () => new Response(JSON.stringify({ error: "offline" }), { status: 503 }));
  h.state.token = undefined;
  h.state.touched.length = 0;
  h.state.eqCalls.length = 0;
  h.state.inserts.length = 0;
});

describe("API route: chưa đăng nhập → 401, không chạm DB/AI/queue", () => {
  for (const c of CASES) {
    it(c.name, async () => {
      await loginAs(null);
      const res = await call(c);
      expect(res.status).toBe(401);
      const json = await res.json();
      expect(json.success).toBe(false);
      expect(typeof json.error).toBe("string");
      expect(h.state.touched).toEqual([]);
    });
  }
});

describe("API route: sai vai trò → 403, không chạm DB/AI/queue", () => {
  for (const c of CASES) {
    for (const role of ALL.filter((r) => !c.allowed.includes(r))) {
      it(`${c.name} với ${role}`, async () => {
        await loginAs(role);
        const res = await call(c);
        expect(res.status).toBe(403);
        const json = await res.json();
        expect(json.success).toBe(false);
        expect(h.state.touched).toEqual([]);
      });
    }
  }
});

describe("API route: đúng vai trò → qua được lớp phân quyền", () => {
  for (const c of CASES) {
    for (const role of c.allowed) {
      it(`${c.name} với ${role}`, async () => {
        await loginAs(role);
        const res = await call(c);
        expect([401, 403]).not.toContain(res.status);
      });
    }
  }
});

describe("Token giả mạo / sai chữ ký bị từ chối", () => {
  it("token ký bằng secret khác → 401", async () => {
    await loginAs("ADMIN");
    const [hd, pl] = h.state.token!.split(".");
    h.state.token = `${hd}.${pl}.AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA`;
    const res = await call(CASES[1]);
    expect(res.status).toBe(401);
    expect(h.state.touched).toEqual([]);
  });
});

describe("Gọi nội bộ worker → grade-async bằng x-internal-token", () => {
  const gradeAsync = CASES.find((c) => c.name === "exam/grade-async POST")!;

  it("token nội bộ đúng, không cookie → qua được phân quyền", async () => {
    await loginAs(null);
    const res = await call(gradeAsync, { "x-internal-token": "internal_test_token_xyz" });
    expect([401, 403]).not.toContain(res.status);
  });

  it("token nội bộ sai → 401", async () => {
    await loginAs(null);
    const res = await call(gradeAsync, { "x-internal-token": "sai" });
    expect(res.status).toBe(401);
    expect(h.state.touched).toEqual([]);
  });

  it("INTERNAL_API_TOKEN rỗng → header rỗng không được chấp nhận", async () => {
    const saved = process.env.INTERNAL_API_TOKEN;
    process.env.INTERNAL_API_TOKEN = "";
    try {
      await loginAs(null);
      const res = await call(gradeAsync, { "x-internal-token": "" });
      expect(res.status).toBe(401);
    } finally {
      process.env.INTERNAL_API_TOKEN = saved;
    }
  });
});

// Quyền sở hữu dữ liệu của /api/submissions: xem tests/student-api.test.ts (chạy trên pg).

describe("middleware: bảo vệ trang /student", () => {
  async function run(path: string) {
    const { NextRequest } = await import("next/server");
    const { middleware, config } = await import("@/middleware");
    const headers = new Headers();
    if (h.state.token) headers.set("cookie", `auth_token=${h.state.token}`);
    const res = await middleware(new NextRequest(`http://localhost${path}`, { headers }));
    return { res, config };
  }
  const redirectsToLogin = (res: Response) =>
    res.status >= 300 && res.status < 400 && new URL(res.headers.get("location")!).pathname === "/login";

  it("matcher có /student", async () => {
    const { config } = await run("/student/dashboard");
    expect(JSON.stringify(config.matcher)).toContain("/student");
  });

  it("chưa đăng nhập vào /student/dashboard → chuyển /login", async () => {
    await loginAs(null);
    const { res } = await run("/student/dashboard");
    expect(redirectsToLogin(res)).toBe(true);
  });

  it("chưa đăng nhập vào /student/landing → vẫn xem được (trang công khai)", async () => {
    await loginAs(null);
    const { res } = await run("/student/landing");
    expect(redirectsToLogin(res)).toBe(false);
  });

  for (const role of ALL) {
    it(`${role} vào /student/dashboard → cho qua`, async () => {
      await loginAs(role);
      const { res } = await run("/student/dashboard");
      expect(redirectsToLogin(res)).toBe(false);
    });
  }

  it("STUDENT vào /admin vẫn bị chặn (không hồi quy)", async () => {
    await loginAs("STUDENT");
    const { res } = await run("/admin/accounts");
    expect(redirectsToLogin(res)).toBe(true);
  });
});
