// TASK-060 — Siết API lớp học sinh: vai trò, bỏ cột nội bộ, thứ tự kiểm quyền với lớp khoá
// Hợp đồng nghiệm thu do kỹ sư kiểm thử chéo viết, file này bị khoá.
import { describe, it, expect, vi, beforeEach } from "vitest";
import fs from "fs";
import path from "path";
import { createFakePg } from "./helpers/pg-fake";

const h = vi.hoisted(() => {
  process.env.JWT_SECRET = "test_secret_for_vitest_only_0123456789abcdef";
  return {
    token: undefined as string | undefined,
    pg: null as null | Awaited<ReturnType<typeof import("./helpers/pg-fake").createFakePg>>,
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

vi.mock("@/lib/db-pg", () => ({
  queryPg: (sql: string, params?: unknown[]) => h.pg!.queryPg(sql, params),
  getPgPool: () => ({
    connect: async () => ({
      query: (sql: string, params?: unknown[]) => h.pg!.queryPg(sql, params),
      release: () => {},
    }),
  }),
  ensureSchema: async () => {},
}));

vi.mock("@/lib/redis-queue", () => ({
  pushRedisStreamEvent: async (...a: any[]) => {
    h.events.push(a);
  },
  pushGradingEvent: async () => {},
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
  h.events.length = 0;
  h.pg = await createFakePg(["db-migration-004-enrollments-assignments.sql"]);

  // Bổ sung các cấu trúc bảng cần thiết theo migration 006, 017, 018
  await h.pg.db.exec(`
    ALTER TABLE users ADD COLUMN IF NOT EXISTS slot_limit INT DEFAULT 250;
    CREATE TABLE IF NOT EXISTS courses (id VARCHAR(50) PRIMARY KEY, title VARCHAR(255), created_by VARCHAR(50));
    CREATE TABLE IF NOT EXISTS curriculum_items (
      id VARCHAR(50) PRIMARY KEY, course_id VARCHAR(50) NOT NULL, parent_id VARCHAR(50), title VARCHAR(255) NOT NULL,
      type VARCHAR(20) NOT NULL, exam_id VARCHAR(50), lesson_id VARCHAR(50), order_index INT DEFAULT 0, created_by VARCHAR(50),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);
  await h.pg.db.exec(fs.readFileSync(path.resolve(__dirname, "../docs/db-migration-006-lessons.sql"), "utf8"));
  await h.pg.db.exec(fs.readFileSync(path.resolve(__dirname, "../docs/db-migration-017-gradebook.sql"), "utf8"));

  await h.pg.db.exec(`
    ALTER TABLE classes ADD COLUMN IF NOT EXISTS billing_status VARCHAR(10) NOT NULL DEFAULT 'ACTIVE';
    ALTER TABLE classes ADD COLUMN IF NOT EXISTS grace_until TIMESTAMPTZ;
    ALTER TABLE classes ADD COLUMN IF NOT EXISTS next_charge_at DATE;
    ALTER TABLE classes ADD COLUMN IF NOT EXISTS billing_period INT NOT NULL DEFAULT 0;
    ALTER TABLE classes ADD COLUMN IF NOT EXISTS start_date DATE;
    ALTER TABLE classes ADD COLUMN IF NOT EXISTS ended_at TIMESTAMPTZ;
    ALTER TABLE classes ADD COLUMN IF NOT EXISTS unlock_mode VARCHAR(20) NOT NULL DEFAULT 'MANUAL';
    ALTER TABLE classes ADD COLUMN IF NOT EXISTS pass_percent INTEGER NOT NULL DEFAULT 70;
  `);

  // Dữ liệu mẫu
  await h.pg.db.exec(`
    INSERT INTO users (id, name, email, role) VALUES
      ('s1', 'Học sinh 1', 's1@x.vn', 'STUDENT'),
      ('s2', 'Học sinh 2', 's2@x.vn', 'STUDENT'),
      ('s_none', 'Học sinh chưa ghi danh', 's_none@x.vn', 'STUDENT'),
      ('t1', 'Giáo viên 1', 't1@x.vn', 'TEACHER'),
      ('t2', 'Giáo viên 2', 't2@x.vn', 'TEACHER'),
      ('admin1', 'Quản trị viên', 'admin@x.vn', 'ADMIN');

    INSERT INTO courses (id, title, created_by) VALUES
      ('course_1', 'Khoá IELTS Cơ bản', 't1');

    INSERT INTO classes (id, name, code, teacher_id, course_id, unlock_mode, pass_percent, schedule, billing_status, next_charge_at, billing_period, grace_until) VALUES
      ('cls_active', 'Lớp IELTS Sáng', 'IELTS01', 't1', 'course_1', 'ALL_OPEN', 70, 'T2-T4-T6 8:00', 'ACTIVE', '2026-12-01', 1, NULL),
      ('cls_locked', 'Lớp Bị Khoá', 'LOCK01', 't1', 'course_1', 'ALL_OPEN', 70, 'T3-T5-T7 18:00', 'LOCKED', '2026-11-01', 2, '2026-11-05T00:00:00Z'),
      ('cls_ended', 'Lớp Đã Kết Thúc', 'END01', 't1', 'course_1', 'ALL_OPEN', 70, 'Chủ nhật', 'ENDED', '2026-10-01', 3, NULL);

    INSERT INTO enrollments (id, student_id, class_id) VALUES
      ('en_1', 's1', 'cls_active'),
      ('en_2', 's1', 'cls_locked'),
      ('en_3', 's2', 'cls_active');

    INSERT INTO exams (id, title, duration_minutes, skills, created_at) VALUES
      ('ex_1', 'Đề kiểm tra 1', 60, ARRAY['Reading'], '2026-02-01');

    INSERT INTO class_assignments (id, class_id, exam_id, due_date, max_attempts) VALUES
      ('as_1', 'cls_active', 'ex_1', '2026-12-31T00:00:00Z', 2);

    INSERT INTO submissions (id, exam_id, student_id, answers, final_score, created_at) VALUES
      ('sub_1', 'ex_1', 's1', '{}', 7.0, '2026-03-01'),
      ('sub_2', 'ex_1', 's2', '{}', 6.5, '2026-03-02');

    INSERT INTO questions (id, skill, category, prompt, content) VALUES
      ('q1', 'Reading', 'READING_MC', 'Chọn đáp án', '{"sub_questions":[{"id":"sq1","text":"1?","option_a":"A","option_b":"B","correct_answer":"A"}]}');

    INSERT INTO lessons (id, title, description, question_ids, created_by) VALUES
      ('lsn_1', 'Bài 1: Giới thiệu', 'Mô tả bài 1', '["q1"]', 't1');

    INSERT INTO curriculum_items (id, course_id, parent_id, title, type, lesson_id, order_index) VALUES
      ('ci_1', 'course_1', NULL, 'Bài học 1', 'LESSON', 'lsn_1', 1);
  `);
});

describe("TASK-060: GET /api/student/classes — Siết vai trò STUDENT", () => {
  const load = () => import("@/app/api/student/classes/route");

  it("chưa đăng nhập → 401", async () => {
    const { GET } = await load();
    const res = await GET(req("GET", "/api/student/classes"));
    expect(res.status).toBe(401);
  });

  it("TEACHER và ADMIN không được phép truy cập → 403", async () => {
    const { GET } = await load();
    await loginAs("TEACHER", "t1");
    const resTeacher = await GET(req("GET", "/api/student/classes"));
    expect(resTeacher.status).toBe(403);

    await loginAs("ADMIN", "admin1");
    const resAdmin = await GET(req("GET", "/api/student/classes"));
    expect(resAdmin.status).toBe(403);
  });

  it("STUDENT s1 xem danh sách lớp đã ghi danh → 200, đúng các lớp của mình", async () => {
    await loginAs("STUDENT", "s1");
    const { GET } = await load();
    const res = await GET(req("GET", "/api/student/classes"));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    const classIds = json.classes.map((c: any) => c.id).sort();
    expect(classIds).toEqual(["cls_active", "cls_locked"]);
  });

  it("STUDENT chưa ghi danh lớp nào → 200, mảng classes rỗng", async () => {
    await loginAs("STUDENT", "s_none");
    const { GET } = await load();
    const res = await GET(req("GET", "/api/student/classes"));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.classes).toEqual([]);
  });
});

describe("TASK-060: GET /api/student/classes/[classId] — Siết vai trò & loại bỏ cột nội bộ", () => {
  const load = () => import("@/app/api/student/classes/[classId]/route");
  const get = async (classId: string) => {
    const { GET } = await load();
    return GET(req("GET", `/api/student/classes/${classId}`), ctx({ classId }));
  };

  it("chưa đăng nhập → 401", async () => {
    const res = await get("cls_active");
    expect(res.status).toBe(401);
  });

  it("TEACHER (kể cả giáo viên phụ trách) và ADMIN đều nhận 403 (chỉ cho STUDENT)", async () => {
    // t1 là giáo viên phụ trách cls_active
    await loginAs("TEACHER", "t1");
    const resTeacher = await get("cls_active");
    expect(resTeacher.status).toBe(403);

    await loginAs("ADMIN", "admin1");
    const resAdmin = await get("cls_active");
    expect(resAdmin.status).toBe(403);
  });

  it("lớp không tồn tại → 404", async () => {
    await loginAs("STUDENT", "s1");
    const res = await get("cls_nonexistent");
    expect(res.status).toBe(404);
  });

  it("STUDENT chưa ghi danh vào lớp → 403", async () => {
    await loginAs("STUDENT", "s2");
    // s2 chỉ ghi danh cls_active, chưa ghi danh cls_locked
    const res = await get("cls_locked");
    expect(res.status).toBe(403);
  });

  it("STUDENT đã ghi danh: trả về đầy đủ trường cho UI, KHÔNG chứa các cột nội bộ (teacher_id, next_charge_at, billing_period, grace_until)", async () => {
    await loginAs("STUDENT", "s1");
    const res = await get("cls_active");
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);

    // 1. Phải có các trường cần thiết cho UI học sinh (page.tsx, StudentRoadmap)
    expect(json.class).toMatchObject({
      id: "cls_active",
      name: "Lớp IELTS Sáng",
      code: "IELTS01",
      schedule: "T2-T4-T6 8:00",
      billing_status: "ACTIVE",
    });

    // 2. BẢO MẬT: Bỏ hoàn toàn các cột nội bộ & nhạy cảm
    const forbiddenFields = ["teacher_id", "next_charge_at", "billing_period", "grace_until"];
    for (const field of forbiddenFields) {
      expect(json.class[field], `Trường ${field} không được xuất hiện trong json.class`).toBeUndefined();
      expect(Object.keys(json.class)).not.toContain(field);
    }

    // 3. Danh sách bài giao và bài nộp
    expect(Array.isArray(json.assignments)).toBe(true);
    expect(json.assignments.length).toBe(1);
    expect(json.assignments[0]).toMatchObject({
      id: "as_1",
      class_id: "cls_active",
      exam_id: "ex_1",
      max_attempts: 2,
      exam: expect.objectContaining({ id: "ex_1", title: "Đề kiểm tra 1" }),
    });

    // Submissions chỉ chứa bài nộp của chính s1
    expect(Array.isArray(json.submissions)).toBe(true);
    expect(json.submissions.length).toBe(1);
    expect(json.submissions[0].id).toBe("sub_1");
    expect(json.submissions[0].student_id).toBe("s1");
  });
});

describe("TASK-060: POST /api/student/lessons/[lessonId]/attempts — Thứ tự kiểm quyền với lớp khoá", () => {
  const load = () => import("@/app/api/student/lessons/[lessonId]/attempts/route");
  const post = async (lessonId: string, body: unknown) => {
    const { POST } = await load();
    return POST(req("POST", `/api/student/lessons/${lessonId}/attempts`, body), ctx({ lessonId }));
  };

  it("chưa đăng nhập → 401; TEACHER → 403", async () => {
    const resUnauth = await post("lsn_1", { classId: "cls_active", answers: {} });
    expect(resUnauth.status).toBe(401);

    await loginAs("TEACHER", "t1");
    const resTeacher = await post("lsn_1", { classId: "cls_active", answers: {} });
    expect(resTeacher.status).toBe(403);
  });

  it("thiếu classId hoặc answers không hợp lệ → 400", async () => {
    await loginAs("STUDENT", "s1");
    const resNoClass = await post("lsn_1", { answers: {} });
    expect(resNoClass.status).toBe(400);

    const resBadAnswers = await post("lsn_1", { classId: "cls_active", answers: "not-an-object" });
    expect(resBadAnswers.status).toBe(400);
  });

  it("học sinh CHƯA ghi danh nộp bài vào lớp LOCKED: checkLessonAccess chạy trước, KHÔNG nhận CLASS_LOCKED", async () => {
    // s_none chưa từng ghi danh vào cls_locked
    await loginAs("STUDENT", "s_none");
    const res = await post("lsn_1", {
      classId: "cls_locked",
      answers: { q1: { sq1: "A" } },
    });

    // Phải bị từ chối truy cập (403), nhưng mã lỗi KHÔNG ĐƯỢC là CLASS_LOCKED (chống dò trạng thái lớp)
    expect(res.status).toBe(403);
    const json = await res.json();
    expect(json.success).toBe(false);
    expect(json.code).not.toBe("CLASS_LOCKED");
    expect(json.error).toMatch(/ghi danh|không tồn tại|truy cập/i);
  });

  it("học sinh CHƯA ghi danh nộp bài vào lớp ENDED: checkLessonAccess chạy trước, KHÔNG nhận CLASS_LOCKED", async () => {
    // s_none chưa ghi danh vào cls_ended
    await loginAs("STUDENT", "s_none");
    const res = await post("lsn_1", {
      classId: "cls_ended",
      answers: { q1: { sq1: "A" } },
    });

    expect(res.status).toBe(403);
    const json = await res.json();
    expect(json.success).toBe(false);
    expect(json.code).not.toBe("CLASS_LOCKED");
  });

  it("học sinh ĐÃ ghi danh ở lớp LOCKED: vượt qua checkLessonAccess nhưng nhận 403 CLASS_LOCKED", async () => {
    // s1 ĐÃ ghi danh vào cls_locked
    await loginAs("STUDENT", "s1");
    const res = await post("lsn_1", {
      classId: "cls_locked",
      answers: { q1: { sq1: "A" } },
    });

    expect(res.status).toBe(403);
    const json = await res.json();
    expect(json.success).toBe(false);
    expect(json.code).toBe("CLASS_LOCKED");
  });

  it("học sinh ĐÃ ghi danh ở lớp ACTIVE: nộp bài thành công → 201", async () => {
    // s1 ghi danh cls_active
    await loginAs("STUDENT", "s1");
    const res = await post("lsn_1", {
      classId: "cls_active",
      answers: { q1: { sq1: "A" } },
    });

    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.attempt).toBeDefined();
    expect(json.attempt.lesson_id).toBe("lsn_1");
    expect(json.attempt.class_id).toBe("cls_active");
    expect(json.attempt.student_id).toBe("s1");
  });
});
