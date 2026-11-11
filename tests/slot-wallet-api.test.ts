// TASK-053 — Khoá lớp LOCKED/ENDED ở nộp bài & AI; API ví slot, ngày khai giảng, kết thúc lớp, admin cộng/trừ
// Hợp đồng nghiệm thu do kỹ sư kiểm thử chéo (agy1) viết — người code không sửa file này.
/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from "vitest";
import fs from "fs";
import path from "path";
import { createFakePg } from "./helpers/pg-fake";
import { signJwtToken } from "@/lib/jwt";
import { todayVN, addMonths } from "@/lib/slot-wallet";

const h = vi.hoisted(() => {
  process.env.JWT_SECRET = "test_secret_for_vitest_only_0123456789abcdef";
  process.env.INTERNAL_API_TOKEN = "internal_test_token_xyz";
  return {
    token: undefined as string | undefined,
    pg: null as any,
    aiExamCalls: [] as any[],
    aiLessonCalls: [] as any[],
    events: [] as any[],
  };
});

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (n: string) => (n === "auth_token" && h.token ? { value: h.token } : undefined),
    set: () => {},
  }),
  headers: async () => new Headers(),
}));

let poolLock = Promise.resolve();
vi.mock("@/lib/db-pg", () => ({
  queryPg: (sql: string, params?: unknown[]) => h.pg.queryPg(sql, params),
  getPgPool: () => ({
    connect: async () => {
      let releaseLock: () => void;
      const nextLock = new Promise<void>((r) => (releaseLock = r));
      const prevLock = poolLock;
      poolLock = prevLock.then(() => nextLock);
      await prevLock;
      return {
        query: (s: string, p?: unknown[]) => h.pg.queryPg(s, p),
        release: () => {
          releaseLock();
        },
      };
    },
  }),
  ensureSchema: async () => {},
}));

vi.mock("@/lib/exam-ai-grading", () => ({
  gradeExamOpenAnswer: async (input: any) => {
    h.aiExamCalls.push(input);
    return { score: 7.0, feedback: "AI grading feedback for exam" };
  },
}));

vi.mock("@/lib/lesson-ai-grading", () => ({
  gradeOpenAnswer: async (input: any) => {
    h.aiLessonCalls.push(input);
    return 7.5;
  },
}));

vi.mock("@/lib/redis-queue", () => ({
  pushRedisStreamEvent: async (...a: any[]) => {
    h.events.push(a);
  },
  pushGradingEvent: async (...a: any[]) => {
    h.events.push(a);
  },
}));

vi.mock("@/lib/mailer", () => ({
  appBaseUrl: () => "http://localhost:3000",
  isMailerConfigured: () => true,
  sendEmail: async () => ({ success: true }),
}));

vi.mock("@/lib/neo4j", () => ({
  syncStudentEnrolledInClass: async () => {},
  syncTeacherManagesClass: async () => {},
  syncCourseExam: async () => {},
  runCypherQuery: async () => [],
}));

vi.mock("@/lib/supabase", () => ({
  supabase: new Proxy({}, { get() { throw new Error("không dùng Supabase client"); } }),
}));
vi.mock("@/lib/supabase-server", () => ({
  createClient: () => { throw new Error("dùng queryPg"); },
  getServerSupabaseClient: () => { throw new Error("dùng queryPg"); },
}));

async function loginAs(role: "ADMIN" | "TEACHER" | "STUDENT" | null, userId?: string) {
  h.token = role ? await signJwtToken({ userId: userId!, email: `${userId}@x.vn`, role }) : undefined;
}

const req = (method: string, url: string, body?: unknown, headers: Record<string, string> = {}) =>
  new Request(`http://localhost${url}`, {
    method,
    headers: { "Content-Type": "application/json", ...headers },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

const ctx = <T extends Record<string, string>>(p: T) => ({ params: Promise.resolve(p) });
const rows = async (sql: string, p: unknown[] = []) => (await h.pg.db.query(sql, p)).rows as any[];

// Dynamic loaders to avoid tsc module-resolution failure before coder writes the files
async function loadClassBilling() {
  // @ts-ignore
  return await import("@/lib/class-billing");
}

async function loadExamAttemptsRoute() {
  // @ts-ignore
  return await import("@/app/api/student/exams/[examId]/attempts/route");
}

async function loadExamAnswersRoute() {
  // @ts-ignore
  return await import("@/app/api/student/exam-attempts/[id]/answers/route");
}

async function loadExamSubmitRoute() {
  // @ts-ignore
  return await import("@/app/api/student/exam-attempts/[id]/submit/route");
}

async function loadLessonAttemptsRoute() {
  // @ts-ignore
  return await import("@/app/api/student/lessons/[lessonId]/attempts/route");
}

async function loadStudentAttemptGetRoute() {
  // @ts-ignore
  return await import("@/app/api/student/attempts/[id]/route");
}

async function loadExamGradeAsyncRoute() {
  // @ts-ignore
  return await import("@/app/api/exam/grade-async/route");
}

async function loadLessonsGradeAsyncRoute() {
  // @ts-ignore
  return await import("@/app/api/lessons/grade-async/route");
}

async function loadTeacherSlotWalletRoute() {
  // @ts-ignore
  return await import("@/app/api/teacher/slot-wallet/route");
}

async function loadTeacherClassBillingRoute() {
  // @ts-ignore
  return await import("@/app/api/teacher/classes/[classId]/billing/route");
}

async function loadTeacherClassEndRoute() {
  // @ts-ignore
  return await import("@/app/api/teacher/classes/[classId]/end/route");
}

async function loadAdminTeacherSlotWalletRoute() {
  // @ts-ignore
  return await import("@/app/api/admin/teachers/[id]/slot-wallet/route");
}

async function loadAdminTeacherSlotAdjustRoute() {
  // @ts-ignore
  return await import("@/app/api/admin/teachers/[id]/slot-adjust/route");
}

async function loadAdminTeacherRoute() {
  // @ts-ignore
  return await import("@/app/api/admin/teachers/[id]/route");
}

function shiftDays(baseDateStr: string, days: number): string {
  const d = new Date(baseDateStr + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

const TODAY = todayVN();

beforeEach(async () => {
  h.token = undefined;
  h.aiExamCalls.length = 0;
  h.aiLessonCalls.length = 0;
  h.events.length = 0;
  delete process.env.SLOT_UNIT_PRICE_VND;

  h.pg = await createFakePg(["db-migration-018-slot-wallet.sql"]);

  // Tạo bảng courses, curriculum_items và slot_requests trước khi chạy các migration phụ thuộc
  await h.pg.db.exec(`
    CREATE TABLE IF NOT EXISTS courses (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      created_by TEXT,
      default_scoring_standard_id TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS curriculum_items (
      id TEXT PRIMARY KEY,
      course_id TEXT,
      teacher_id TEXT,
      parent_id TEXT,
      title TEXT,
      type TEXT,
      exam_id TEXT,
      lesson_id TEXT,
      order_index INT DEFAULT 0,
      created_by TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS slot_requests (
      id VARCHAR(50) PRIMARY KEY,
      teacher_id VARCHAR(50) NOT NULL,
      teacher_name VARCHAR(100) NOT NULL,
      teacher_email VARCHAR(100) NOT NULL,
      requested_slots INTEGER NOT NULL,
      total_cost NUMERIC(12,2) NOT NULL,
      status VARCHAR(20) DEFAULT 'PENDING',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);

  const runMig = async (m: string) => {
    await h.pg.db.exec(fs.readFileSync(path.resolve(__dirname, "../docs", m), "utf8"));
  };

  await runMig("db-migration-004-enrollments-assignments.sql");
  await runMig("db-migration-005-system-settings.sql");
  await runMig("db-migration-006-lessons.sql");
  await runMig("db-migration-009-scoring-standards.sql");
  await runMig("db-migration-010-notifications.sql");
  await runMig("db-migration-013-onboarding.sql");
  await runMig("db-migration-014-ai-usage.sql");
  await runMig("db-migration-016-slot-orders.sql");
  await runMig("db-migration-017-gradebook.sql");

  // Bổ sung các cột mở rộng cho submissions trong môi trường PGlite
  await h.pg.db.exec(`
    ALTER TABLE users ADD COLUMN IF NOT EXISTS slot_limit INT DEFAULT 250;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS slot_balance INT DEFAULT 0;

    ALTER TABLE submissions ADD COLUMN IF NOT EXISTS started_at TIMESTAMPTZ;
    ALTER TABLE submissions ADD COLUMN IF NOT EXISTS deadline_at TIMESTAMPTZ;
    ALTER TABLE submissions ADD COLUMN IF NOT EXISTS class_ref VARCHAR(50);
    ALTER TABLE submissions ADD COLUMN IF NOT EXISTS standard_snapshot JSONB;
    ALTER TABLE submissions ADD COLUMN IF NOT EXISTS total_score NUMERIC;
    ALTER TABLE submissions ADD COLUMN IF NOT EXISTS passed BOOLEAN;
  `);

  // Cấu hình đơn giá slot trong system_settings
  await h.pg.db.query(
    `INSERT INTO system_settings (key, value, description)
     VALUES ('slot_pricing', '{"unit_price_vnd": 50000}'::jsonb, 'Đơn giá slot')
     ON CONFLICT (key) DO UPDATE SET value = '{"unit_price_vnd": 50000}'::jsonb`
  );

  // Tạo người dùng mẫu
  await h.pg.db.exec(`
    INSERT INTO users (id, name, email, role, teacher_status, slot_balance, slot_limit)
    VALUES
      ('admin1', 'Admin Hệ Thống', 'admin@x.vn', 'ADMIN', NULL, 0, 0),
      ('t1', 'Cô Lan', 't1@x.vn', 'TEACHER', 'VERIFIED', 20, 100),
      ('t2', 'Thầy Minh', 't2@x.vn', 'TEACHER', 'VERIFIED', 0, 50),
      ('s1', 'Học Sinh An', 's1@x.vn', 'STUDENT', NULL, 0, 0),
      ('s2', 'Học Sinh Bình', 's2@x.vn', 'STUDENT', NULL, 0, 0),
      ('s3', 'Học Sinh Chi', 's3@x.vn', 'STUDENT', NULL, 0, 0);
  `);

  // Tạo lớp học với các trạng thái khác nhau
  const todayStr = TODAY;
  const past30Str = shiftDays(todayStr, -30);
  const past40Str = shiftDays(todayStr, -40);
  const past10Str = shiftDays(todayStr, -10);
  const next30Str = shiftDays(todayStr, 30);
  const graceUntilStr = shiftDays(todayStr, 7) + " 23:59:59+07";

  await h.pg.db.exec(`
    INSERT INTO classes (id, name, code, teacher_id, max_slots, start_date, next_charge_at, grace_until, billing_status, billing_period)
    VALUES
      ('c_active', 'Lớp Hoạt Động', 'ACT01', 't1', 30, '${todayStr}', '${next30Str}', NULL, 'ACTIVE', 0),
      ('c_grace',  'Lớp Ân Hạn',    'GRA01', 't1', 30, '${past30Str}', '${todayStr}', '${graceUntilStr}', 'GRACE', 0),
      ('c_locked', 'Lớp Tạm Khoá',  'LCK01', 't1', 30, '${past40Str}', '${past10Str}', NULL, 'LOCKED', 0),
      ('c_ended',  'Lớp Kết Thúc',  'END01', 't1', 30, '${past40Str}', NULL, NULL, 'ENDED', 1),
      ('c_t2',     'Lớp Thầy Minh', 'TM001', 't2', 30, '${todayStr}', '${next30Str}', NULL, 'ACTIVE', 0);

    -- Lộ trình chứa bài học lsn_test, mở toàn bộ, để kiểm khoá lớp mà không nới quyền truy cập bài (checkLessonAccess)
    INSERT INTO courses (id, title, created_by) VALUES ('crs_w', 'Khoá ví', 't1');
    INSERT INTO curriculum_items (id, course_id, teacher_id, parent_id, title, type, lesson_id, order_index)
      VALUES ('ci_w1', 'crs_w', 't1', NULL, 'Bài test', 'LESSON', 'lsn_test', 1);
    UPDATE classes SET course_id = 'crs_w', unlock_mode = 'ALL_OPEN' WHERE id IN ('c_active', 'c_grace', 'c_locked', 'c_ended');

    INSERT INTO enrollments (id, class_id, student_id)
    VALUES
      ('en_act_s1', 'c_active', 's1'),
      ('en_gra_s1', 'c_grace',  's1'),
      ('en_lck_s1', 'c_locked', 's1'),
      ('en_lck_s2', 'c_locked', 's2'),
      ('en_lck_s3', 'c_locked', 's3'),
      ('en_end_s1', 'c_ended',  's1'),
      ('en_t2_s1',  'c_t2',     's1');
  `);

  // Tạo câu hỏi, đề thi, bài học
  await h.pg.db.exec(`
    INSERT INTO questions (id, skill, category, prompt, content)
    VALUES
      ('q_mc', 'Reading', 'READING_MC', 'Chọn đáp án đúng', '{"options":["A","B","C","D"],"correct_answer":"A"}'),
      ('q_essay', 'Writing', 'WRITING_ESSAY', 'Viết một đoạn văn', '{"min_words": 50}');

    INSERT INTO exams (id, title, duration_minutes, question_ids, created_by)
    VALUES
      ('ex_test', 'Đề Kiểm Tra', 45, '["q_mc", "q_essay"]', 't1');

    INSERT INTO class_assignments (id, class_id, exam_id, max_attempts)
    VALUES
      ('as_act', 'c_active', 'ex_test', 10),
      ('as_gra', 'c_grace',  'ex_test', 10),
      ('as_lck', 'c_locked', 'ex_test', 10),
      ('as_end', 'c_ended',  'ex_test', 10);

    INSERT INTO lessons (id, title, question_ids, created_by)
    VALUES
      ('lsn_test', 'Bài Học Số 1', '["q_mc", "q_essay"]', 't1');
  `);
});

// ─────────────────────────────────────────────────────────────────────────────
// 1. Thư viện trợ giúp: lib/class-billing.ts (assertClassOpen, classLockedResponse)
// ─────────────────────────────────────────────────────────────────────────────
describe("1. lib/class-billing.ts (mới: assertClassOpen, classLockedResponse)", () => {
  it("assertClassOpen: cho phép nếu không truyền classId (bài tự do)", async () => {
    const { assertClassOpen } = await loadClassBilling();
    const resNull = await assertClassOpen(null);
    expect(resNull.ok).toBe(true);

    const resEmpty = await assertClassOpen("");
    expect(resEmpty.ok).toBe(true);

    const resUndef = await assertClassOpen(undefined);
    expect(resUndef.ok).toBe(true);
  });

  it("assertClassOpen: cho phép lớp ACTIVE và GRACE", async () => {
    const { assertClassOpen } = await loadClassBilling();
    const resAct = await assertClassOpen("c_active");
    expect(resAct.ok).toBe(true);
    expect(resAct.billing_status).toBe("ACTIVE");

    const resGra = await assertClassOpen("c_grace");
    expect(resGra.ok).toBe(true);
    expect(resGra.billing_status).toBe("GRACE");
  });

  it("assertClassOpen: từ chối 403 CLASS_LOCKED khi lớp LOCKED hoặc ENDED", async () => {
    const { assertClassOpen } = await loadClassBilling();
    const resLck = await assertClassOpen("c_locked");
    expect(resLck.ok).toBe(false);
    expect(resLck.status).toBe(403);
    expect(resLck.code).toBe("CLASS_LOCKED");
    expect(resLck.error).toBe("Lớp đang tạm khoá hoặc đã kết thúc, chưa làm bài được. Vui lòng liên hệ giáo viên.");

    const resEnd = await assertClassOpen("c_ended");
    expect(resEnd.ok).toBe(false);
    expect(resEnd.status).toBe(403);
    expect(resEnd.code).toBe("CLASS_LOCKED");
  });

  it("classLockedResponse: trả về NextResponse 403 đúng hợp đồng JSON", async () => {
    const { classLockedResponse } = await loadClassBilling();
    const resp = classLockedResponse();
    expect(resp.status).toBe(403);
    const body = await resp.json();
    expect(body).toEqual({
      success: false,
      code: "CLASS_LOCKED",
      error: "Lớp đang tạm khoá hoặc đã kết thúc, chưa làm bài được. Vui lòng liên hệ giáo viên.",
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. Chặn lớp LOCKED/ENDED ở làm bài & nộp bài (BR-W06, BR-W08, TC-W08)
// ─────────────────────────────────────────────────────────────────────────────
describe("2. Khoá lớp ở mở lượt thi, lưu câu trả lời, nộp bài (BR-W06, BR-W08, TC-W08)", () => {
  it("POST /api/student/exams/[examId]/attempts: chặn 403 CLASS_LOCKED khi lớp LOCKED hoặc ENDED", async () => {
    const { POST } = await loadExamAttemptsRoute();
    await loginAs("STUDENT", "s1");

    // Lớp LOCKED -> 403
    const resLck = await POST(req("POST", "/x", { classId: "c_locked" }), ctx({ examId: "ex_test" }));
    expect(resLck.status).toBe(403);
    const bodyLck = await resLck.json();
    expect(bodyLck.code).toBe("CLASS_LOCKED");
    expect(bodyLck.error).toContain("Lớp đang tạm khoá hoặc đã kết thúc");

    // Lớp ENDED -> 403
    const resEnd = await POST(req("POST", "/x", { classId: "c_ended" }), ctx({ examId: "ex_test" }));
    expect(resEnd.status).toBe(403);
    const bodyEnd = await resEnd.json();
    expect(bodyEnd.code).toBe("CLASS_LOCKED");
  });

  it("POST /api/student/exams/[examId]/attempts: cho phép khi lớp ACTIVE, GRACE hoặc bài tự do", async () => {
    const { POST } = await loadExamAttemptsRoute();
    await loginAs("STUDENT", "s1");

    // Lớp ACTIVE -> 201 hoặc 200
    const resAct = await POST(req("POST", "/x", { classId: "c_active" }), ctx({ examId: "ex_test" }));
    expect([200, 201]).toContain(resAct.status);
    const bodyAct = await resAct.json();
    expect(bodyAct.success).toBe(true);

    // Lớp GRACE -> 201 hoặc 200
    const resGra = await POST(req("POST", "/x", { classId: "c_grace" }), ctx({ examId: "ex_test" }));
    expect([200, 201]).toContain(resGra.status);
    const bodyGra = await resGra.json();
    expect(bodyGra.success).toBe(true);

    // Bài tự do (không truyền classId) -> cho phép
    const resFree = await POST(req("POST", "/x", {}), ctx({ examId: "ex_test" }));
    expect([200, 201]).toContain(resFree.status);
  });

  it("PUT /api/student/exam-attempts/[id]/answers: chặn 403 CLASS_LOCKED theo class_ref trong DB", async () => {
    const { PUT } = await loadExamAnswersRoute();
    await loginAs("STUDENT", "s1");

    // Tạo các lượt thi sẵn trong DB
    await h.pg.db.exec(`
      INSERT INTO submissions (id, exam_id, student_id, answers, status, class_ref, started_at, deadline_at)
      VALUES
        ('sub_lck', 'ex_test', 's1', '{}', 'IN_PROGRESS', 'c_locked', NOW(), NOW() + INTERVAL '1 hour'),
        ('sub_end', 'ex_test', 's1', '{}', 'IN_PROGRESS', 'c_ended',  NOW(), NOW() + INTERVAL '1 hour'),
        ('sub_act', 'ex_test', 's1', '{}', 'IN_PROGRESS', 'c_active', NOW(), NOW() + INTERVAL '1 hour'),
        ('sub_fre', 'ex_test', 's1', '{}', 'IN_PROGRESS', NULL,       NOW(), NOW() + INTERVAL '1 hour');
    `);

    // Gửi PUT lưu câu trả lời cho bài thuộc lớp LOCKED -> 403
    const resLck = await PUT(req("PUT", "/x", { answers: { q_mc: "A" } }), ctx({ id: "sub_lck" }));
    expect(resLck.status).toBe(403);
    const bodyLck = await resLck.json();
    expect(bodyLck.code).toBe("CLASS_LOCKED");

    // Lớp ENDED -> 403
    const resEnd = await PUT(req("PUT", "/x", { answers: { q_mc: "A" } }), ctx({ id: "sub_end" }));
    expect(resEnd.status).toBe(403);

    // Lớp ACTIVE -> 200
    const resAct = await PUT(req("PUT", "/x", { answers: { q_mc: "A" } }), ctx({ id: "sub_act" }));
    expect(resAct.status).toBe(200);

    // Tự do -> 200
    const resFre = await PUT(req("PUT", "/x", { answers: { q_mc: "A" } }), ctx({ id: "sub_fre" }));
    expect(resFre.status).toBe(200);
  });

  it("POST /api/student/exam-attempts/[id]/submit: chặn 403 CLASS_LOCKED khi nộp bài lớp LOCKED/ENDED", async () => {
    const { POST } = await loadExamSubmitRoute();
    await loginAs("STUDENT", "s1");

    await h.pg.db.exec(`
      INSERT INTO submissions (id, exam_id, student_id, answers, status, class_ref, started_at, deadline_at)
      VALUES
        ('sub_sub_lck', 'ex_test', 's1', '{"q_mc":"A"}', 'IN_PROGRESS', 'c_locked', NOW(), NOW() + INTERVAL '1 hour'),
        ('sub_sub_end', 'ex_test', 's1', '{"q_mc":"A"}', 'IN_PROGRESS', 'c_ended',  NOW(), NOW() + INTERVAL '1 hour'),
        ('sub_sub_act', 'ex_test', 's1', '{"q_mc":"A"}', 'IN_PROGRESS', 'c_active', NOW(), NOW() + INTERVAL '1 hour');
    `);

    // Nộp bài lớp LOCKED -> 403
    const resLck = await POST(req("POST", "/x", {}), ctx({ id: "sub_sub_lck" }));
    expect(resLck.status).toBe(403);
    const bodyLck = await resLck.json();
    expect(bodyLck.code).toBe("CLASS_LOCKED");

    // Nộp bài lớp ENDED -> 403
    const resEnd = await POST(req("POST", "/x", {}), ctx({ id: "sub_sub_end" }));
    expect(resEnd.status).toBe(403);

    // Nộp bài lớp ACTIVE -> 200 thành công
    const resAct = await POST(req("POST", "/x", {}), ctx({ id: "sub_sub_act" }));
    expect(resAct.status).toBe(200);
    const bodyAct = await resAct.json();
    expect(bodyAct.success).toBe(true);
  });

  it("POST /api/student/lessons/[lessonId]/attempts: chặn 403 CLASS_LOCKED cho bài học lớp LOCKED/ENDED", async () => {
    const { POST } = await loadLessonAttemptsRoute();
    await loginAs("STUDENT", "s1");

    // Làm bài học lớp LOCKED -> 403
    const resLck = await POST(
      req("POST", "/x", { classId: "c_locked", answers: { q_mc: "A" } }),
      ctx({ lessonId: "lsn_test" })
    );
    expect(resLck.status).toBe(403);
    const bodyLck = await resLck.json();
    expect(bodyLck.code).toBe("CLASS_LOCKED");

    // Làm bài học lớp ENDED -> 403
    const resEnd = await POST(
      req("POST", "/x", { classId: "c_ended", answers: { q_mc: "A" } }),
      ctx({ lessonId: "lsn_test" })
    );
    expect(resEnd.status).toBe(403);

    // Làm bài học lớp ACTIVE -> thành công (200/201)
    const resAct = await POST(
      req("POST", "/x", { classId: "c_active", answers: { q_mc: "A" } }),
      ctx({ lessonId: "lsn_test" })
    );
    expect([200, 201]).toContain(resAct.status);

    // Làm bài học lớp GRACE -> thành công
    const resGra = await POST(
      req("POST", "/x", { classId: "c_grace", answers: { q_mc: "A" } }),
      ctx({ lessonId: "lsn_test" })
    );
    expect([200, 201]).toContain(resGra.status);
  });

  it("GET /api/student/attempts/[id]: học sinh lớp LOCKED vẫn GET được bài đã nộp và điểm", async () => {
    const { GET } = await loadStudentAttemptGetRoute();
    await loginAs("STUDENT", "s1");

    // Tạo lượt làm bài đã nộp của lớp LOCKED
    await h.pg.db.exec(`
      INSERT INTO lesson_attempts (id, lesson_id, class_id, student_id, answers, results, objective_earned, objective_max, score_percent, status)
      VALUES ('att_lck_view', 'lsn_test', 'c_locked', 's1', '{"q_mc":"A"}', '[]', 10, 10, 100, 'GRADED');
    `);

    const res = await GET(req("GET", "/x"), ctx({ id: "att_lck_view" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.attempt.id).toBe("att_lck_view");
    expect(body.attempt.score_percent).toBe(100);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. grade-async của bài thuộc lớp LOCKED / ENDED (TC-W08)
// ─────────────────────────────────────────────────────────────────────────────
describe("3. grade-async của bài thuộc lớp LOCKED/ENDED (TC-W08)", () => {
  it("POST /api/exam/grade-async: bài thuộc lớp LOCKED/ENDED không gọi AI, để NEEDS_REVIEW với last_grading_error = 'CLASS_LOCKED'", async () => {
    const { POST } = await loadExamGradeAsyncRoute();

    // Bài thi đang GRADING thuộc lớp LOCKED
    await h.pg.db.exec(`
      INSERT INTO submissions (id, exam_id, student_id, answers, status, class_ref, last_grading_error)
      VALUES
        ('sub_ai_lck', 'ex_test', 's1', '{"q_essay":"Bài viết của học sinh"}', 'GRADING', 'c_locked', NULL),
        ('sub_ai_end', 'ex_test', 's1', '{"q_essay":"Bài viết lớp kết thúc"}', 'GRADING', 'c_ended', NULL);
    `);

    // Gọi grade-async với internal token
    const resLck = await POST(
      req("POST", "/api/exam/grade-async", { submissionId: "sub_ai_lck" }, { "x-internal-token": "internal_test_token_xyz" })
    );
    expect(resLck.status).toBe(200);

    // Không được gọi hàm AI
    expect(h.aiExamCalls).toHaveLength(0);

    // Trạng thái trong DB phải là NEEDS_REVIEW, last_grading_error = 'CLASS_LOCKED'
    const subLckRow = (await rows("SELECT status, last_grading_error FROM submissions WHERE id = 'sub_ai_lck'"))[0];
    expect(subLckRow.status).toBe("NEEDS_REVIEW");
    expect(subLckRow.last_grading_error).toBe("CLASS_LOCKED");

    // Thông báo cho giáo viên t1 đã được tạo
    const notifs = await rows("SELECT * FROM notifications WHERE user_id = 't1'");
    expect(notifs.length).toBeGreaterThan(0);

    // Tương tự với lớp ENDED
    const resEnd = await POST(
      req("POST", "/api/exam/grade-async", { submissionId: "sub_ai_end" }, { "x-internal-token": "internal_test_token_xyz" })
    );
    expect(resEnd.status).toBe(200);
    expect(h.aiExamCalls).toHaveLength(0);
    const subEndRow = (await rows("SELECT status, last_grading_error FROM submissions WHERE id = 'sub_ai_end'"))[0];
    expect(subEndRow.status).toBe("NEEDS_REVIEW");
    expect(subEndRow.last_grading_error).toBe("CLASS_LOCKED");
  });

  it("POST /api/lessons/grade-async: bài học thuộc lớp LOCKED/ENDED không gọi AI, để NEEDS_REVIEW với last_grading_error = 'CLASS_LOCKED'", async () => {
    const { POST } = await loadLessonsGradeAsyncRoute();

    await h.pg.db.exec(`
      INSERT INTO lesson_attempts (id, lesson_id, class_id, student_id, answers, status, results, objective_earned, objective_max)
      VALUES
        ('att_ai_lck', 'lsn_test', 'c_locked', 's1', '{"q_essay":"Bài làm học sinh"}', 'GRADING', '[]', 5, 10),
        ('att_ai_end', 'lsn_test', 'c_ended',  's1', '{"q_essay":"Bài làm kết thúc"}', 'GRADING', '[]', 5, 10);
    `);

    const resLck = await POST(
      req("POST", "/api/lessons/grade-async", { attemptId: "att_ai_lck" }, { "x-internal-token": "internal_test_token_xyz" })
    );
    expect(resLck.status).toBe(200);
    expect(h.aiLessonCalls).toHaveLength(0);

    const attLckRow = (await rows("SELECT status, last_grading_error FROM lesson_attempts WHERE id = 'att_ai_lck'"))[0];
    expect(attLckRow.status).toBe("NEEDS_REVIEW");
    expect(attLckRow.last_grading_error).toBe("CLASS_LOCKED");

    // Lớp ENDED
    const resEnd = await POST(
      req("POST", "/api/lessons/grade-async", { attemptId: "att_ai_end" }, { "x-internal-token": "internal_test_token_xyz" })
    );
    expect(resEnd.status).toBe(200);
    expect(h.aiLessonCalls).toHaveLength(0);

    const attEndRow = (await rows("SELECT status, last_grading_error FROM lesson_attempts WHERE id = 'att_ai_end'"))[0];
    expect(attEndRow.status).toBe("NEEDS_REVIEW");
    expect(attEndRow.last_grading_error).toBe("CLASS_LOCKED");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. API ví giáo viên: GET /api/teacher/slot-wallet
// ─────────────────────────────────────────────────────────────────────────────
describe("4. API ví giáo viên: GET /api/teacher/slot-wallet", () => {
  it("Kiểm tra phân quyền: 401 khi chưa đăng nhập, 403 khi STUDENT", async () => {
    const { GET } = await loadTeacherSlotWalletRoute();

    // Chưa đăng nhập -> 401
    const resNoAuth = await GET(req("GET", "/api/teacher/slot-wallet"));
    expect(resNoAuth.status).toBe(401);

    // Học sinh -> 403
    await loginAs("STUDENT", "s1");
    const resStudent = await GET(req("GET", "/api/teacher/slot-wallet"));
    expect(resStudent.status).toBe(403);
  });

  it("Giáo viên xem ví: trả đúng balance, unit_price_vnd, classes của mình, enough_for_next, total_next_needed, ledger phân trang", async () => {
    const { GET } = await loadTeacherSlotWalletRoute();
    await loginAs("TEACHER", "t1");

    // Tạo thêm một số dòng ledger cho t1
    await h.pg.db.exec(`
      INSERT INTO slot_ledger (id, teacher_id, delta, balance_after, reason, class_id, note, created_at)
      VALUES
        ('led_1', 't1', 10, 10, 'PURCHASE', NULL, 'Mua 10 slot', NOW() - INTERVAL '5 days'),
        ('led_2', 't1', 10, 20, 'ADMIN_ADJUST', NULL, 'Admin tặng 10 slot', NOW() - INTERVAL '4 days'),
        ('led_t2', 't2', 5, 5, 'PURCHASE', NULL, 'Của thầy Minh', NOW() - INTERVAL '1 day');
    `);

    const res = await GET(req("GET", "/api/teacher/slot-wallet"));
    expect(res.status).toBe(200);
    const body = await res.json();

    // Số dư ví t1 = 20
    expect(body.balance).toBe(20);
    expect(body.unit_price_vnd).toBe(50000);

    // Danh sách lớp: chỉ có lớp của t1, KHÔNG có lớp của t2 (c_t2)
    const classIds = body.classes.map((c: any) => c.id);
    expect(classIds).toContain("c_active");
    expect(classIds).toContain("c_grace");
    expect(classIds).toContain("c_locked");
    expect(classIds).not.toContain("c_t2");

    // Kiểm tra enough_for_next
    // c_active có 1 học sinh (s1) -> balance 20 >= 1 -> enough_for_next: true
    const cAct = body.classes.find((c: any) => c.id === "c_active");
    expect(cAct.student_count).toBe(1);
    expect(cAct.enough_for_next).toBe(true);

    // total_next_needed: tổng sĩ số các lớp sẽ trừ trong 31 ngày tới
    expect(typeof body.total_next_needed).toBe("number");
    expect(body.total_next_needed).toBeGreaterThanOrEqual(1);

    // Ledger: chỉ có dòng của t1, không có led_t2
    const ledgerIds = body.ledger.map((l: any) => l.id);
    expect(ledgerIds).toContain("led_1");
    expect(ledgerIds).toContain("led_2");
    expect(ledgerIds).not.toContain("led_t2");
  });

  it("Ledger hỗ trợ lọc theo class_id và phân trang 20 dòng", async () => {
    const { GET } = await loadTeacherSlotWalletRoute();
    await loginAs("TEACHER", "t1");

    // Tạo 25 dòng ledger cho t1 với class_id cụ thể
    const inserts: string[] = [];
    for (let i = 1; i <= 25; i++) {
      inserts.push(
        `('led_bulk_${i}', 't1', -1, ${20 - i}, 'ENROLL', 'c_active', 'HS ${i}', NOW() - INTERVAL '${30 - i} minutes')`
      );
    }
    await h.pg.db.exec(`
      INSERT INTO slot_ledger (id, teacher_id, delta, balance_after, reason, class_id, note, created_at)
      VALUES ${inserts.join(",")};
    `);

    // Trang 1: 20 dòng, có next_cursor
    const resPage1 = await GET(req("GET", "/api/teacher/slot-wallet?class_id=c_active"));
    expect(resPage1.status).toBe(200);
    const bodyPage1 = await resPage1.json();
    expect(bodyPage1.ledger).toHaveLength(20);
    expect(bodyPage1.next_cursor).toBeTruthy();

    // Trang 2 dùng cursor
    const resPage2 = await GET(req("GET", `/api/teacher/slot-wallet?class_id=c_active&cursor=${encodeURIComponent(bodyPage1.next_cursor)}`));
    expect(resPage2.status).toBe(200);
    const bodyPage2 = await resPage2.json();
    expect(bodyPage2.ledger.length).toBeGreaterThanOrEqual(5);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 5. API đặt ngày khai giảng: PUT /api/teacher/classes/[classId]/billing (TC-W13, BR-W11)
// ─────────────────────────────────────────────────────────────────────────────
describe("5. Đặt ngày khai giảng: PUT /api/teacher/classes/[classId]/billing (TC-W13, BR-W11)", () => {
  it("Phân quyền: 401 không auth, 403 STUDENT, 404 giáo viên khác", async () => {
    const { PUT } = await loadTeacherClassBillingRoute();

    // Không auth -> 401
    const resNoAuth = await PUT(req("PUT", "/x", { start_date: TODAY }), ctx({ classId: "c_active" }));
    expect(resNoAuth.status).toBe(401);

    // Học sinh -> 403
    await loginAs("STUDENT", "s1");
    const resStudent = await PUT(req("PUT", "/x", { start_date: TODAY }), ctx({ classId: "c_active" }));
    expect(resStudent.status).toBe(403);

    // Giáo viên t2 gọi vào lớp của t1 -> 404 (Brief: Giáo viên A gọi billing/end của lớp giáo viên B -> 404)
    await loginAs("TEACHER", "t2");
    const resOtherTeacher = await PUT(req("PUT", "/x", { start_date: TODAY }), ctx({ classId: "c_active" }));
    expect(resOtherTeacher.status).toBe(404);
  });

  it("Validation start_date: sai định dạng, quá 30 ngày quá khứ, quá 90 ngày tương lai -> 400", async () => {
    const { PUT } = await loadTeacherClassBillingRoute();
    await loginAs("TEACHER", "t1");

    // Thiếu start_date -> 400
    const resEmpty = await PUT(req("PUT", "/x", {}), ctx({ classId: "c_active" }));
    expect(resEmpty.status).toBe(400);

    // Sai định dạng -> 400
    const resBadFmt = await PUT(req("PUT", "/x", { start_date: "01/01/2026" }), ctx({ classId: "c_active" }));
    expect(resBadFmt.status).toBe(400);

    // Quá 30 ngày trong quá khứ (-35 ngày) -> 400
    const past35 = shiftDays(TODAY, -35);
    const resTooPast = await PUT(req("PUT", "/x", { start_date: past35 }), ctx({ classId: "c_active" }));
    expect(resTooPast.status).toBe(400);

    // Quá 90 ngày trong tương lai (+95 ngày) -> 400
    const future95 = shiftDays(TODAY, 95);
    const resTooFuture = await PUT(req("PUT", "/x", { start_date: future95 }), ctx({ classId: "c_active" }));
    expect(resTooFuture.status).toBe(400);
  });

  it("TC-W13: Đã có dòng CYCLE của lớp -> 409 không cho đổi start_date", async () => {
    const { PUT } = await loadTeacherClassBillingRoute();
    await loginAs("TEACHER", "t1");

    // Tạo dòng CYCLE cho c_active
    await h.pg.db.exec(`
      INSERT INTO slot_ledger (id, teacher_id, delta, balance_after, reason, class_id, period, student_count)
      VALUES ('led_cycle_act', 't1', -1, 19, 'CYCLE', 'c_active', 0, 1);
    `);

    const validNewDate = shiftDays(TODAY, 10);
    const res = await PUT(req("PUT", "/x", { start_date: validNewDate }), ctx({ classId: "c_active" }));
    expect(res.status).toBe(409);
  });

  it("TC-W13: Chưa có CYCLE: đổi start_date thành công và next_charge_at được tính lại đúng", async () => {
    const { PUT } = await loadTeacherClassBillingRoute();
    await loginAs("TEACHER", "t1");

    // Chọn ngày khai giảng mới hợp lệ: 15 ngày nữa
    const validNewDate = shiftDays(TODAY, 15);
    const res = await PUT(req("PUT", "/x", { start_date: validNewDate }), ctx({ classId: "c_active" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);

    // Kiểm tra trong DB: start_date đã đổi, next_charge_at = addMonths(start_date, 1) vì billing_period = 0
    const row = (await rows("SELECT start_date::text, next_charge_at::text, billing_period FROM classes WHERE id = 'c_active'"))[0];
    expect(row.start_date).toBe(validNewDate);
    const expectedNext = addMonths(validNewDate, row.billing_period + 1);
    expect(row.next_charge_at).toBe(expectedNext);
  });

  it("Admin cũng có quyền đổi start_date của bất kỳ lớp nào", async () => {
    const { PUT } = await loadTeacherClassBillingRoute();
    await loginAs("ADMIN", "admin1");

    const validNewDate = shiftDays(TODAY, 20);
    const res = await PUT(req("PUT", "/x", { start_date: validNewDate }), ctx({ classId: "c_active" }));
    expect(res.status).toBe(200);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 6. API kết thúc lớp: POST /api/teacher/classes/[classId]/end (TC-W10, BR-W08)
// ─────────────────────────────────────────────────────────────────────────────
describe("6. Kết thúc lớp: POST /api/teacher/classes/[classId]/end (TC-W10, BR-W08)", () => {
  it("Phân quyền: 401 không auth, 403 STUDENT, 404 giáo viên khác", async () => {
    const { POST } = await loadTeacherClassEndRoute();

    // Không auth -> 401
    const resNoAuth = await POST(req("POST", "/x"), ctx({ classId: "c_active" }));
    expect(resNoAuth.status).toBe(401);

    // Học sinh -> 403
    await loginAs("STUDENT", "s1");
    const resStudent = await POST(req("POST", "/x"), ctx({ classId: "c_active" }));
    expect(resStudent.status).toBe(403);

    // Giáo viên t2 gọi kết thúc lớp của t1 -> 404
    await loginAs("TEACHER", "t2");
    const resOtherTeacher = await POST(req("POST", "/x"), ctx({ classId: "c_active" }));
    expect(resOtherTeacher.status).toBe(404);
  });

  it("TC-W10: Kết thúc lớp thành công -> billing_status = 'ENDED', ended_at = NOW(); gọi lần 2 -> 409", async () => {
    const { POST } = await loadTeacherClassEndRoute();
    await loginAs("TEACHER", "t1");

    // Lần 1: Thành công
    const res1 = await POST(req("POST", "/x"), ctx({ classId: "c_active" }));
    expect(res1.status).toBe(200);
    const body1 = await res1.json();
    expect(body1.success).toBe(true);

    const row = (await rows("SELECT billing_status, ended_at FROM classes WHERE id = 'c_active'"))[0];
    expect(row.billing_status).toBe("ENDED");
    expect(row.ended_at).toBeTruthy();

    // Lần 2: Đã ENDED -> 409 (Brief: Đã ENDED -> 409)
    const res2 = await POST(req("POST", "/x"), ctx({ classId: "c_active" }));
    expect(res2.status).toBe(409);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 7. API ví admin: GET /api/admin/teachers/[id]/slot-wallet
// ─────────────────────────────────────────────────────────────────────────────
describe("7. API ví admin: GET /api/admin/teachers/[id]/slot-wallet", () => {
  it("Phân quyền: 401 không auth, 403 TEACHER và STUDENT, 404 GV không tồn tại", async () => {
    const { GET } = await loadAdminTeacherSlotWalletRoute();

    // Không auth -> 401
    const resNoAuth = await GET(req("GET", "/x"), ctx({ id: "t1" }));
    expect(resNoAuth.status).toBe(401);

    // TEACHER -> 403
    await loginAs("TEACHER", "t1");
    const resTeacher = await GET(req("GET", "/x"), ctx({ id: "t1" }));
    expect(resTeacher.status).toBe(403);

    // STUDENT -> 403
    await loginAs("STUDENT", "s1");
    const resStudent = await GET(req("GET", "/x"), ctx({ id: "t1" }));
    expect(resStudent.status).toBe(403);

    // Admin nhưng ID giáo viên không tồn tại -> 404
    await loginAs("ADMIN", "admin1");
    const resNotFound = await GET(req("GET", "/x"), ctx({ id: "non_existent_teacher" }));
    expect(resNotFound.status).toBe(404);
  });

  it("Admin xem ví giáo viên: trả đầy đủ cấu trúc ví của giáo viên đó", async () => {
    const { GET } = await loadAdminTeacherSlotWalletRoute();
    await loginAs("ADMIN", "admin1");

    const res = await GET(req("GET", "/x"), ctx({ id: "t1" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.balance).toBe(20);
    expect(body.unit_price_vnd).toBe(50000);
    expect(body.classes.length).toBeGreaterThanOrEqual(1);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 8. API Admin điều chỉnh số dư: POST /api/admin/teachers/[id]/slot-adjust (TC-W12, BR-W03, BR-W07)
// ─────────────────────────────────────────────────────────────────────────────
describe("8. Admin cộng/trừ tay: POST /api/admin/teachers/[id]/slot-adjust (TC-W12, BR-W03, BR-W07)", () => {
  it("TC-W12: Phân quyền: GV gọi slot-adjust -> 403, STUDENT -> 403, chưa đăng nhập -> 401", async () => {
    const { POST } = await loadAdminTeacherSlotAdjustRoute();

    // Chưa đăng nhập -> 401
    const resNoAuth = await POST(req("POST", "/x", { delta: 5, note: "Lý do" }), ctx({ id: "t1" }));
    expect(resNoAuth.status).toBe(401);

    // GV gọi -> 403
    await loginAs("TEACHER", "t1");
    const resTeacher = await POST(req("POST", "/x", { delta: 5, note: "Tự cộng" }), ctx({ id: "t1" }));
    expect(resTeacher.status).toBe(403);

    // STUDENT -> 403
    await loginAs("STUDENT", "s1");
    const resStudent = await POST(req("POST", "/x", { delta: 5, note: "HS cộng" }), ctx({ id: "t1" }));
    expect(resStudent.status).toBe(403);
  });

  it("TC-W12: Validation payload: delta = 0, delta số thực, |delta| > 100000, thiếu note, note > 500 ký tự -> 400", async () => {
    const { POST } = await loadAdminTeacherSlotAdjustRoute();
    await loginAs("ADMIN", "admin1");

    // delta = 0 -> 400
    const resZero = await POST(req("POST", "/x", { delta: 0, note: "Test note" }), ctx({ id: "t1" }));
    expect(resZero.status).toBe(400);

    // delta số thực (2.5) -> 400
    const resFloat = await POST(req("POST", "/x", { delta: 2.5, note: "Test note" }), ctx({ id: "t1" }));
    expect(resFloat.status).toBe(400);

    // |delta| > 100000 -> 400
    const resTooLarge = await POST(req("POST", "/x", { delta: 100001, note: "Test note" }), ctx({ id: "t1" }));
    expect(resTooLarge.status).toBe(400);

    // Thiếu note -> 400
    const resNoNote = await POST(req("POST", "/x", { delta: 10 }), ctx({ id: "t1" }));
    expect(resNoNote.status).toBe(400);

    // Note chỉ có khoảng trắng -> 400
    const resBlankNote = await POST(req("POST", "/x", { delta: 10, note: "   " }), ctx({ id: "t1" }));
    expect(resBlankNote.status).toBe(400);

    // Note > 500 ký tự -> 400
    const longNote = "a".repeat(501);
    const resLongNote = await POST(req("POST", "/x", { delta: 10, note: longNote }), ctx({ id: "t1" }));
    expect(resLongNote.status).toBe(400);
  });

  it("TC-W12: Admin trừ tay làm số dư âm -> 409", async () => {
    const { POST } = await loadAdminTeacherSlotAdjustRoute();
    await loginAs("ADMIN", "admin1");

    // t2 hiện có số dư = 0. Admin cố trừ -5 -> 409
    const res = await POST(req("POST", "/x", { delta: -5, note: "Trừ phạt vi phạm" }), ctx({ id: "t2" }));
    expect(res.status).toBe(409);

    // Số dư vẫn là 0
    const bal = (await rows("SELECT slot_balance FROM users WHERE id = 't2'"))[0].slot_balance;
    expect(bal).toBe(0);
  });

  it("Admin trừ tay hợp lệ: số dư giảm, ghi dòng ADMIN_ADJUST kèm created_by của admin", async () => {
    const { POST } = await loadAdminTeacherSlotAdjustRoute();
    await loginAs("ADMIN", "admin1");

    // t1 hiện có số dư 20. Trừ 5 -> còn 15
    const res = await POST(req("POST", "/x", { delta: -5, note: "Trừ điều chỉnh kiểm toán" }), ctx({ id: "t1" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);

    const bal = (await rows("SELECT slot_balance FROM users WHERE id = 't1'"))[0].slot_balance;
    expect(bal).toBe(15);

    // Kiểm tra dòng ledger
    const led = (await rows("SELECT * FROM slot_ledger WHERE teacher_id = 't1' AND reason = 'ADMIN_ADJUST' ORDER BY created_at DESC LIMIT 1"))[0];
    expect(led.delta).toBe(-5);
    expect(led.balance_after).toBe(15);
    expect(led.note).toBe("Trừ điều chỉnh kiểm toán");
    expect(led.created_by).toBe("admin1");
  });

  it("Tiêu chí mục 5 & BR-W07: slot-adjust cộng cho giáo viên có lớp LOCKED đủ slot -> lớp về ACTIVE ngay trong cùng lời gọi", async () => {
    const { POST } = await loadAdminTeacherSlotAdjustRoute();
    await loginAs("ADMIN", "admin1");

    // Lớp c_locked của t1 có 3 học sinh (s1, s2, s3).
    // Đặt số dư t1 về 0 trước
    await h.pg.db.query("UPDATE users SET slot_balance = 0 WHERE id = 't1'");

    // Admin cộng +10 slot cho t1
    const res = await POST(req("POST", "/x", { delta: 10, note: "Cấp bù khuyến mãi 10 slot" }), ctx({ id: "t1" }));
    expect(res.status).toBe(200);

    // Lớp c_locked phải được tự động chuyển về ACTIVE ngay trong cùng lời gọi!
    const cRow = (await rows("SELECT billing_status, billing_period FROM classes WHERE id = 'c_locked'"))[0];
    expect(cRow.billing_status).toBe("ACTIVE");

    // Sĩ số 3 bị trừ qua 1 dòng CYCLE -> số dư sau cùng của t1 = 10 - 3 = 7
    const bal = (await rows("SELECT slot_balance FROM users WHERE id = 't1'"))[0].slot_balance;
    expect(bal).toBe(6); // BR-W07: trừ cả c_locked (3) và c_grace (1) của t1 → 10 - 3 - 1

    // Có dòng CYCLE ghi nhận trừ 3 slot cho c_locked
    const cycleRows = await rows("SELECT * FROM slot_ledger WHERE class_id = 'c_locked' AND reason = 'CYCLE'");
    expect(cycleRows).toHaveLength(1);
    expect(cycleRows[0].delta).toBe(-3);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 9. Admin teachers route: PUT bỏ nhận slot_limit, GET trả thêm slot_balance
// ─────────────────────────────────────────────────────────────────────────────
describe("9. app/api/admin/teachers/[id]/route.ts (PUT bỏ slot_limit, GET thêm slot_balance)", () => {
  it("PUT: body có slot_limit -> bỏ qua không đổi slot_limit lẫn slot_balance trong DB", async () => {
    const { PUT, GET } = await loadAdminTeacherRoute();
    await loginAs("ADMIN", "admin1");

    // Trước khi PUT: t1 có slot_limit = 100, slot_balance = 20
    await h.pg.db.query("UPDATE users SET slot_limit = 100, slot_balance = 20 WHERE id = 't1'");

    // Gửi PUT với slot_limit: 999
    const resPut = await PUT(
      req("PUT", "/api/admin/teachers/t1", { slot_limit: 999, name: "Cô Lan Mới" }),
      ctx({ id: "t1" })
    );
    expect(resPut.status).toBe(200);

    // Kiểm tra trong DB: slot_limit VẪN LÀ 100, slot_balance VẪN LÀ 20!
    const userRow = (await rows("SELECT name, slot_limit, slot_balance FROM users WHERE id = 't1'"))[0];
    expect(userRow.slot_limit).toBe(100);
    expect(userRow.slot_balance).toBe(20);
    expect(userRow.name).toBe("Cô Lan Mới");
  });

  it("GET: trả thêm thông tin slot_balance của giáo viên", async () => {
    const { GET } = await loadAdminTeacherRoute();
    await loginAs("ADMIN", "admin1");

    await h.pg.db.query("UPDATE users SET slot_balance = 42 WHERE id = 't1'");

    const res = await GET(req("GET", "/api/admin/teachers/t1"), ctx({ id: "t1" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.teacher.slot_balance).toBe(42);
  });
});
