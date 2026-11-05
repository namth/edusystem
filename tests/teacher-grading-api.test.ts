// TASK-045 — Test API chấm & bảng điểm theo lớp, gradebook học sinh, phân quyền (FEAT-014).
// Hợp đồng nghiệm thu do tài khoản kiểm chéo viết, bị khoá (tests.lock).
import { describe, it, expect, vi, beforeEach } from "vitest";
import fs from "fs";
import { createFakePg } from "./helpers/pg-fake";
import { signJwtToken } from "@/lib/jwt";

const h = vi.hoisted(() => {
  process.env.JWT_SECRET = "test_secret_for_vitest_only_0123456789abcdef";
  process.env.INTERNAL_API_TOKEN = "internal_test_token_xyz";
  return {
    token: undefined as string | undefined,
    pg: null as any,
  };
});

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (n: string) => (n === "auth_token" && h.token ? { value: h.token } : undefined),
    set: () => {},
  }),
}));

vi.mock("@/lib/db-pg", () => ({
  queryPg: (sql: string, params?: unknown[]) => h.pg.queryPg(sql, params),
  getPgPool: () => ({
    connect: async () => ({
      query: (sql: string, params?: unknown[]) => h.pg.queryPg(sql, params),
      release: () => {},
    }),
    query: (sql: string, params?: unknown[]) => h.pg.queryPg(sql, params),
  }),
  ensureSchema: async () => {},
}));

type Role = "ADMIN" | "TEACHER" | "STUDENT";
async function loginAs(role: Role | null, userId?: string) {
  h.token = role ? await signJwtToken({ userId: userId!, email: `${userId}@x.vn`, role }) : undefined;
}

const req = (method: string, url: string, body?: unknown, headers: Record<string, string> = {}) =>
  new Request(`http://localhost${url}`, {
    method,
    headers: { "Content-Type": "application/json", ...headers },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

const ctx = <T extends object>(p: T) => ({ params: Promise.resolve(p) });
const rows = async (sql: string, p?: unknown[]) => (await h.pg.db.query(sql, p)).rows;

// API Loaders
const apiClasses = async () =>
  // @ts-ignore
  (await import("@/app/api/teacher/grading/classes/route")).GET(req("GET", "/api/teacher/grading/classes"));

const apiClassHub = async (classId: string) =>
  // @ts-ignore
  (await import("@/app/api/teacher/grading/classes/[classId]/route")).GET(
    req("GET", `/api/teacher/grading/classes/${classId}`),
    ctx({ classId })
  );

const apiSummary = async (classId: string) =>
  // @ts-ignore
  (await import("@/app/api/teacher/grading/classes/[classId]/summary/route")).GET(
    req("GET", `/api/teacher/grading/classes/${classId}/summary`),
    ctx({ classId })
  );

const apiItemDetail = async (classId: string, kind: string, itemId: string) =>
  // @ts-ignore
  (await import("@/app/api/teacher/grading/classes/[classId]/items/[kind]/[itemId]/route")).GET(
    req("GET", `/api/teacher/grading/classes/${classId}/items/${kind}/${itemId}`),
    ctx({ classId, kind, itemId })
  );

const apiPutStudentCell = async (classId: string, kind: string, itemId: string, studentId: string, body: unknown) =>
  // @ts-ignore
  (await import("@/app/api/teacher/grading/classes/[classId]/items/[kind]/[itemId]/students/[studentId]/route")).PUT(
    req("PUT", `/api/teacher/grading/classes/${classId}/items/${kind}/${itemId}/students/${studentId}`, body),
    ctx({ classId, kind, itemId, studentId })
  );

const apiFinalize = async (classId: string, kind: string, itemId: string, body: unknown = {}) =>
  // @ts-ignore
  (await import("@/app/api/teacher/grading/classes/[classId]/items/[kind]/[itemId]/finalize/route")).POST(
    req("POST", `/api/teacher/grading/classes/${classId}/items/${kind}/${itemId}/finalize`, body),
    ctx({ classId, kind, itemId })
  );

const apiReopen = async (classId: string, kind: string, itemId: string) =>
  // @ts-ignore
  (await import("@/app/api/teacher/grading/classes/[classId]/items/[kind]/[itemId]/reopen/route")).POST(
    req("POST", `/api/teacher/grading/classes/${classId}/items/${kind}/${itemId}/reopen`),
    ctx({ classId, kind, itemId })
  );

const apiGetAttempt = async (kind: string, attemptId: string) =>
  // @ts-ignore
  (await import("@/app/api/teacher/grading/attempts/[kind]/[attemptId]/route")).GET(
    req("GET", `/api/teacher/grading/attempts/${kind}/${attemptId}`),
    ctx({ kind, attemptId })
  );

const apiPutAttempt = async (kind: string, attemptId: string, body: unknown) =>
  // @ts-ignore
  (await import("@/app/api/teacher/grading/attempts/[kind]/[attemptId]/route")).PUT(
    req("PUT", `/api/teacher/grading/attempts/${kind}/${attemptId}`, body),
    ctx({ kind, attemptId })
  );

const apiStudentGradebook = async (classId: string, query = "") =>
  // @ts-ignore
  (await import("@/app/api/student/classes/[classId]/gradebook/route")).GET(
    req("GET", `/api/student/classes/${classId}/gradebook${query}`),
    ctx({ classId })
  );

const apiMembers = async (classId: string) =>
  (await import("@/app/api/teacher/classes/[classId]/members/route")).GET(
    req("GET", `/api/teacher/classes/${classId}/members`),
    ctx({ classId })
  );

const SNAP_IELTS = JSON.stringify({
  id: "std_ielts",
  name: "IELTS Academic",
  sections: [
    { skill: "Reading", min: 0, max: 9, step: 0.5 },
    { skill: "Writing", min: 0, max: 9, step: 0.5 },
  ],
  aggregation: { method: "AVERAGE" },
});

beforeEach(async () => {
  h.token = undefined;
  h.pg = await createFakePg(["db-migration-004-enrollments-assignments.sql"]);

  await h.pg.db.exec(`
    ALTER TABLE users ADD COLUMN IF NOT EXISTS slot_limit INT DEFAULT 250;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN DEFAULT FALSE;
    CREATE TABLE IF NOT EXISTS courses (
      id VARCHAR(50) PRIMARY KEY, title VARCHAR(255), created_by VARCHAR(50), default_scoring_standard_id VARCHAR(50)
    );
    CREATE TABLE IF NOT EXISTS curriculum_items (
      id VARCHAR(50) PRIMARY KEY, course_id VARCHAR(50) NOT NULL, parent_id VARCHAR(50), title VARCHAR(255) NOT NULL,
      type VARCHAR(20) NOT NULL, exam_id VARCHAR(50), lesson_id VARCHAR(50), order_index INT DEFAULT 0, created_by VARCHAR(50),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);

  await h.pg.db.exec(fs.readFileSync("docs/db-migration-006-lessons.sql", "utf8"));
  await h.pg.db.exec(fs.readFileSync("docs/db-migration-009-scoring-standards.sql", "utf8"));
  await h.pg.db.exec(fs.readFileSync("docs/db-migration-010-notifications.sql", "utf8"));
  await h.pg.db.exec(fs.readFileSync("docs/db-migration-017-gradebook.sql", "utf8"));

  // Seed baseline
  await h.pg.db.exec(`
    INSERT INTO users (id, name, email, role) VALUES
      ('t1', 'GV 1', 't1@x.vn', 'TEACHER'),
      ('t2', 'GV 2', 't2@x.vn', 'TEACHER'),
      ('admin1', 'Quản trị viên', 'admin@x.vn', 'ADMIN'),
      ('s1', 'Học sinh 1', 's1@x.vn', 'STUDENT'),
      ('s2', 'Học sinh 2', 's2@x.vn', 'STUDENT'),
      ('s3', 'Học sinh 3', 's3@x.vn', 'STUDENT'),
      ('sOut', 'Học sinh ngoài', 'sout@x.vn', 'STUDENT');

    INSERT INTO courses (id, title, created_by, default_scoring_standard_id) VALUES
      ('co1', 'Khóa Luyện IELTS', 't1', 'std_ielts');

    INSERT INTO classes (id, name, code, teacher_id, course_id) VALUES
      ('c1', 'Lớp IELTS Sáng', 'IEL101', 't1', 'co1'),
      ('c2', 'Lớp IELTS Tối', 'IEL102', 't2', 'co1');

    INSERT INTO enrollments (id, student_id, class_id) VALUES
      ('en1', 's1', 'c1'),
      ('en2', 's2', 'c1'),
      ('en3', 's3', 'c2');

    INSERT INTO questions (id, skill, category, prompt, content) VALUES
      ('qMC', 'Reading', 'READING_MC', 'Đọc đoạn văn và chọn đáp án', '{"sub_questions":[{"id":"q1","correct_answer":"A"}]}'),
      ('qEssay', 'Writing', 'WRITING_ESSAY', 'Viết bài luận 250 từ', '{"min_words":250}');

    INSERT INTO exams (id, title, question_ids, created_by, scoring_standard_id) VALUES
      ('eRoadmap', 'Đề Đọc - Viết Lộ Trình', '["qMC","qEssay"]', 't2', 'std_ielts'),
      ('eAssign', 'Đề Giao Thêm Cuối Tuần', '["qMC","qEssay"]', 't1', 'std_ielts'),
      ('eC2Only', 'Đề Riêng Lớp 2', '["qMC"]', 't2', 'std_ielts'),
      ('eFree', 'Đề Tự Luyện Ngoài Lớp', '["qMC"]', 't2', 'std_ielts');

    INSERT INTO lessons (id, title, question_ids, created_by) VALUES
      ('lObj', 'Bài học Khách quan', '["qMC"]', 't1'),
      ('lAI', 'Bài học Viết Luận AI', '["qMC","qEssay"]', 't1');

    INSERT INTO curriculum_items (id, course_id, title, type, lesson_id, exam_id, order_index) VALUES
      ('ci1', 'co1', 'Bài 1: Khách quan', 'LESSON', 'lObj', NULL, 1),
      ('ci2', 'co1', 'Bài 2: Tự luận AI', 'LESSON', 'lAI', NULL, 2),
      ('ci3', 'co1', 'Đề 1: Đọc - Viết', 'EXAM', NULL, 'eRoadmap', 3);

    INSERT INTO class_assignments (id, class_id, exam_id, max_attempts) VALUES
      ('as1', 'c1', 'eAssign', 3),
      ('as2', 'c2', 'eC2Only', 2);
  `);
});

// ─────────────────────────────────────────────────────────────────────────────
describe("1. TC-B01: Phân quyền & guard assertClassAccess", () => {
  it("chưa đăng nhập → 401 trên mọi route giáo viên và học sinh", async () => {
    await loginAs(null);
    expect((await apiClasses()).status).toBe(401);
    expect((await apiClassHub("c1")).status).toBe(401);
    expect((await apiSummary("c1")).status).toBe(401);
    expect((await apiItemDetail("c1", "exam", "eRoadmap")).status).toBe(401);
    expect((await apiPutStudentCell("c1", "exam", "eRoadmap", "s1", {})).status).toBe(401);
    expect((await apiFinalize("c1", "exam", "eRoadmap")).status).toBe(401);
    expect((await apiReopen("c1", "exam", "eRoadmap")).status).toBe(401);
    expect((await apiGetAttempt("exam", "sub1")).status).toBe(401);
    expect((await apiPutAttempt("exam", "sub1", {})).status).toBe(401);
    expect((await apiStudentGradebook("c1")).status).toBe(401);
  });

  it("STUDENT gọi các route giáo viên → 403", async () => {
    await loginAs("STUDENT", "s1");
    expect((await apiClasses()).status).toBe(403);
    expect((await apiClassHub("c1")).status).toBe(403);
    expect((await apiSummary("c1")).status).toBe(403);
    expect((await apiItemDetail("c1", "exam", "eRoadmap")).status).toBe(403);
    expect((await apiPutStudentCell("c1", "exam", "eRoadmap", "s1", {})).status).toBe(403);
    expect((await apiFinalize("c1", "exam", "eRoadmap")).status).toBe(403);
    expect((await apiReopen("c1", "exam", "eRoadmap")).status).toBe(403);
    expect((await apiGetAttempt("exam", "sub1")).status).toBe(403);
    expect((await apiPutAttempt("exam", "sub1", {})).status).toBe(403);
  });

  it("TEACHER không phải chủ lớp gọi route lớp khác → 403", async () => {
    await loginAs("TEACHER", "t2"); // t2 dạy c2, không dạy c1
    expect((await apiClassHub("c1")).status).toBe(403);
    expect((await apiSummary("c1")).status).toBe(403);
    expect((await apiItemDetail("c1", "exam", "eRoadmap")).status).toBe(403);
    expect((await apiPutStudentCell("c1", "exam", "eRoadmap", "s1", {})).status).toBe(403);
    expect((await apiFinalize("c1", "exam", "eRoadmap")).status).toBe(403);
    expect((await apiReopen("c1", "exam", "eRoadmap")).status).toBe(403);
  });

  it("người tạo đề KHÔNG thấy bài nộp của lớp giáo viên khác (DEC-038)", async () => {
    // eRoadmap do t2 tạo, nhưng nộp trong c1 (t1 quản lý)
    await h.pg.db.query(
      `INSERT INTO submissions (id, exam_id, student_id, answers, status, class_ref, standard_snapshot) VALUES
       ('sub_c1', 'eRoadmap', 's1', '{}', 'GRADED', 'c1', $1)`,
      [SNAP_IELTS]
    );
    await loginAs("TEACHER", "t2"); // creator of eRoadmap
    expect((await apiGetAttempt("exam", "sub_c1")).status).toBe(403);
    expect((await apiPutAttempt("exam", "sub_c1", { items: [] })).status).toBe(403);

    // Chủ lớp t1 thì truy cập được
    await loginAs("TEACHER", "t1");
    expect([401, 403]).not.toContain((await apiGetAttempt("exam", "sub_c1")).status);
  });

  it("lớp không tồn tại → 404; kind ngoài lesson|exam → 400", async () => {
    await loginAs("TEACHER", "t1");
    expect((await apiClassHub("cNone")).status).toBe(404);
    expect((await apiSummary("cNone")).status).toBe(404);
    expect((await apiItemDetail("cNone", "exam", "eRoadmap")).status).toBe(404);

    expect((await apiItemDetail("c1", "flashcard", "eRoadmap")).status).toBe(400);
    expect((await apiPutStudentCell("c1", "quiz", "eRoadmap", "s1", {})).status).toBe(400);
    expect((await apiFinalize("c1", "assignment", "eRoadmap")).status).toBe(400);
  });

  it("ADMIN truy cập được mọi lớp", async () => {
    await loginAs("ADMIN", "admin1");
    expect((await apiClassHub("c1")).status).toBe(200);
    expect((await apiClassHub("c2")).status).toBe(200);
    expect((await apiSummary("c1")).status).toBe(200);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe("2. TC-B02: Danh sách bài của lớp (Hub & Bảng điểm)", () => {
  it("danh sách bài = lộ trình ∪ đề giao, thứ tự lộ trình trước đề giao sau, không trùng", async () => {
    // Thêm eRoadmap vào class_assignments để test trường hợp vừa có trong lộ trình vừa được giao
    await h.pg.db.exec(`INSERT INTO class_assignments (id, class_id, exam_id) VALUES ('asDuplicate', 'c1', 'eRoadmap')`);

    await loginAs("TEACHER", "t1");
    const res = await apiClassHub("c1");
    expect(res.status).toBe(200);
    const json = await res.json();

    expect(json.items).toHaveLength(4); // lObj (ROADMAP), lAI (ROADMAP), eRoadmap (ROADMAP), eAssign (ASSIGNMENT)
    expect(json.items.map((i: any) => ({ kind: i.kind, id: i.id, source: i.source }))).toEqual([
      { kind: "lesson", id: "lObj", source: "ROADMAP" },
      { kind: "lesson", id: "lAI", source: "ROADMAP" },
      { kind: "exam", id: "eRoadmap", source: "ROADMAP" },
      { kind: "exam", id: "eAssign", source: "ASSIGNMENT" },
    ]);
  });

  it("bài luyện tự do (class_ref NULL) không xuất hiện trong hub", async () => {
    await h.pg.db.query(
      `INSERT INTO submissions (id, exam_id, student_id, answers, status, class_ref, standard_snapshot) VALUES
       ('subFree', 'eFree', 's1', '{}', 'GRADED', NULL, $1)`,
      [SNAP_IELTS]
    );

    await loginAs("TEACHER", "t1");
    const json = await (await apiClassHub("c1")).json();
    const ids = json.items.map((i: any) => i.id);
    expect(ids).not.toContain("eFree");
  });

  it("bài không thuộc lớp → 404 khi gọi bảng điểm bài", async () => {
    await loginAs("TEACHER", "t1");
    expect((await apiItemDetail("c1", "exam", "eC2Only")).status).toBe(404);
    expect((await apiItemDetail("c1", "exam", "eFree")).status).toBe(404);
    expect((await apiItemDetail("c1", "lesson", "lNonExistent")).status).toBe(404);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe("3. TC-B05: Sửa lượt đề thi (PUT attempts/exam/[attemptId])", () => {
  beforeEach(async () => {
    await h.pg.db.query(
      `INSERT INTO submissions (id, exam_id, student_id, answers, status, class_ref, standard_snapshot, results, total_score, section_scores) VALUES
       ('sub1', 'eRoadmap', 's1', '{"qMC":"A","qEssay":"Test"}', 'GRADED', 'c1', $1, $2, 6.0, '{"Reading":{"score":6},"Writing":{"score":6}}')`,
      [
        SNAP_IELTS,
        JSON.stringify([
          { question_id: "qMC", kind: "OBJECTIVE", skill: "Reading", score: 6.0 },
          { question_id: "qEssay", kind: "AI", skill: "Writing", score: 6.0, ai_score: 6.0, ai_feedback: "AI Good", feedback: "AI Good" },
        ]),
      ]
    );
  });

  it("lưu teacher_score, giữ ai_score, tính lại điểm phần/tổng, cập nhật 1 dòng thông báo EXAM_GRADED", async () => {
    await loginAs("TEACHER", "t1");
    const res = await apiPutAttempt("exam", "sub1", {
      items: [{ question_id: "qEssay", teacher_score: 8.0, teacher_feedback: "Giáo viên khen" }],
      feedback: "Nhận xét tổng thể bài thi",
    });
    expect(res.status).toBe(200);

    const sub = (await rows(`SELECT * FROM submissions WHERE id='sub1'`))[0];
    const results = typeof sub.results === "string" ? JSON.parse(sub.results) : sub.results;
    const aiItem = results.find((r: any) => r.question_id === "qEssay");

    expect(aiItem.ai_score).toBe(6.0);
    expect(aiItem.teacher_score).toBe(8.0);
    expect(aiItem.score).toBe(8.0);
    expect(aiItem.teacher_feedback).toBe("Giáo viên khen");
    expect(aiItem.teacher_by).toBe("t1");
    expect(sub.teacher_feedback).toBe("Nhận xét tổng thể bài thi");
    expect(sub.reviewed_at).toBeTruthy();
    expect(sub.reviewed_by).toBe("t1");
    expect(Number(sub.total_score)).toBe(7.0); // (6.0 + 8.0) / 2

    // Thông báo EXAM_GRADED cho học sinh
    const notifs = await rows(`SELECT * FROM notifications WHERE ref_id='sub1' AND type='EXAM_GRADED'`);
    expect(notifs).toHaveLength(1);
    expect(notifs[0]).toMatchObject({ user_id: "s1", link: "/student/exam/review/sub1" });
    expect(notifs[0].body).toContain("7");
  });

  it("điểm ngoài thang / sai bước / sửa câu khách quan → 400", async () => {
    await loginAs("TEACHER", "t1");
    // Thang IELTS Writing max 9, min 0, step 0.5
    expect((await apiPutAttempt("exam", "sub1", { items: [{ question_id: "qEssay", teacher_score: 10 }] })).status).toBe(400);
    expect((await apiPutAttempt("exam", "sub1", { items: [{ question_id: "qEssay", teacher_score: -1 }] })).status).toBe(400);
    expect((await apiPutAttempt("exam", "sub1", { items: [{ question_id: "qEssay", teacher_score: 7.3 }] })).status).toBe(400);
    // Sửa câu khách quan
    expect((await apiPutAttempt("exam", "sub1", { items: [{ question_id: "qMC", teacher_score: 8 }] })).status).toBe(400);
  });

  it("teacher_score = null: quay lại điểm AI gốc và tính lại tổng", async () => {
    await loginAs("TEACHER", "t1");
    // Sửa trước lên 8.0
    await apiPutAttempt("exam", "sub1", { items: [{ question_id: "qEssay", teacher_score: 8.0 }] });
    // Huỷ sửa về null
    const res = await apiPutAttempt("exam", "sub1", { items: [{ question_id: "qEssay", teacher_score: null }] });
    expect(res.status).toBe(200);

    const sub = (await rows(`SELECT * FROM submissions WHERE id='sub1'`))[0];
    const results = typeof sub.results === "string" ? JSON.parse(sub.results) : sub.results;
    const aiItem = results.find((r: any) => r.question_id === "qEssay");
    expect(aiItem.score).toBe(6.0);
    expect(aiItem.teacher_score).toBeUndefined();
    expect(Number(sub.total_score)).toBe(6.0);
  });

  it("lượt đang IN_PROGRESS hoặc GRADING → 409", async () => {
    await h.pg.db.exec(`UPDATE submissions SET status='GRADING' WHERE id='sub1'`);
    await loginAs("TEACHER", "t1");
    expect((await apiPutAttempt("exam", "sub1", { items: [{ question_id: "qEssay", teacher_score: 7 }] })).status).toBe(409);

    await h.pg.db.exec(`UPDATE submissions SET status='IN_PROGRESS' WHERE id='sub1'`);
    expect((await apiPutAttempt("exam", "sub1", { items: [{ question_id: "qEssay", teacher_score: 7 }] })).status).toBe(409);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe("4. Sửa lượt bài học (PUT attempts/lesson/[attemptId])", () => {
  beforeEach(async () => {
    await h.pg.db.query(
      `INSERT INTO lesson_attempts (id, lesson_id, student_id, class_id, status, objective_earned, objective_max, ai_max, results, score_percent) VALUES
       ('att1', 'lAI', 's1', 'c1', 'NEEDS_REVIEW', 1, 1, 1, $1, NULL)`,
      [
        JSON.stringify([
          {
            question_id: "qEssay",
            kind: "AI",
            items: [{ key: "task2", band: null, ai_score: null }],
          },
        ]),
      ]
    );
  });

  it("lượt NEEDS_REVIEW chấm đủ mục AI → chuyển GRADED và tính lại score_percent", async () => {
    await loginAs("TEACHER", "t1");
    const res = await apiPutAttempt("lesson", "att1", {
      items: [{ question_id: "qEssay", item_key: "task2", teacher_score: 9.0, teacher_feedback: "Xuất sắc" }],
      feedback: "Bài học tốt",
    });
    expect(res.status).toBe(200);

    const att = (await rows(`SELECT * FROM lesson_attempts WHERE id='att1'`))[0];
    expect(att.status).toBe("GRADED");
    expect(att.graded_at).toBeTruthy();
    expect(att.reviewed_at).toBeTruthy();
    expect(att.reviewed_by).toBe("t1");
    expect(Number(att.score_percent)).toBe(100); // obj 1/1 (50%) + ai 9/9 (50%) = 100%
  });

  it("chấm thiếu mục AI thì vẫn giữ NEEDS_REVIEW", async () => {
    // 2 mục AI
    await h.pg.db.query(
      `UPDATE lesson_attempts SET results = $1 WHERE id='att1'`,
      [
        JSON.stringify([
          {
            question_id: "qEssay",
            kind: "AI",
            items: [
              { key: "itemA", band: null, ai_score: null },
              { key: "itemB", band: null, ai_score: null },
            ],
          },
        ]),
      ]
    );

    await loginAs("TEACHER", "t1");
    // Chỉ chấm 1 mục
    const res = await apiPutAttempt("lesson", "att1", {
      items: [{ question_id: "qEssay", item_key: "itemA", teacher_score: 8.0 }],
    });
    expect(res.status).toBe(200);
    const att = (await rows(`SELECT status, score_percent FROM lesson_attempts WHERE id='att1'`))[0];
    expect(att.status).toBe("NEEDS_REVIEW");
    expect(att.score_percent).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe("5. TC-B08: Finalize (Chốt bảng điểm bài)", () => {
  beforeEach(async () => {
    await h.pg.db.query(
      `INSERT INTO submissions (id, exam_id, student_id, answers, status, class_ref, standard_snapshot, total_score, results, submitted_at) VALUES
       ('sub1', 'eRoadmap', 's1', '{}', 'GRADED', 'c1', $1, 7.0, $2, NOW() - INTERVAL '1 hour')`,
      [
        SNAP_IELTS,
        JSON.stringify([
          { question_id: "qMC", kind: "OBJECTIVE", score: 7 },
          { question_id: "qEssay", kind: "AI", score: 7, ai_score: 7 },
        ]),
      ]
    );
  });

  it("còn lượt GRADING hoặc NEEDS_REVIEW → 409 GRADING_PENDING kèm danh sách học sinh", async () => {
    await h.pg.db.query(
      `INSERT INTO submissions (id, exam_id, student_id, answers, status, class_ref, standard_snapshot) VALUES
       ('subPending', 'eRoadmap', 's2', '{}', 'NEEDS_REVIEW', 'c1', $1)`,
      [SNAP_IELTS]
    );

    await loginAs("TEACHER", "t1");
    const res = await apiFinalize("c1", "exam", "eRoadmap");
    expect(res.status).toBe(409);
    const json = await res.json();
    expect(json.code).toBe("GRADING_PENDING");
    expect(json.students).toContain("s2");
  });

  it("còn ô có lượt chờ duyệt (isPendingReview) chưa xác nhận → 409 UNREVIEWED", async () => {
    // sub1 có mục AI, reviewed_at = NULL -> pending review
    await loginAs("TEACHER", "t1");
    const res = await apiFinalize("c1", "exam", "eRoadmap");
    expect(res.status).toBe(409);
    const json = await res.json();
    expect(json.code).toBe("UNREVIEWED");
    expect(json.count).toBe(1);
  });

  it("xác nhận confirmUnreviewed: true → 200, đặt reviewed_at, chụp điểm cho mọi học sinh ghi danh, gửi thông báo", async () => {
    await loginAs("TEACHER", "t1");
    const res = await apiFinalize("c1", "exam", "eRoadmap", { confirmUnreviewed: true });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.finalized_at).toBeTruthy();
    expect(json.notified).toBe(1); // s1 có điểm nhận thông báo, s2 chưa nộp không nhận

    // Kiểm tra class_grade_items
    const items = await rows(`SELECT * FROM class_grade_items WHERE class_id='c1' AND item_id='eRoadmap'`);
    expect(items).toHaveLength(1);
    expect(items[0].finalized_at).toBeTruthy();
    expect(items[0].finalized_by).toBe("t1");

    // Lượt chờ duyệt được đánh dấu reviewed_at
    const sub = (await rows(`SELECT reviewed_at, reviewed_by FROM submissions WHERE id='sub1'`))[0];
    expect(sub.reviewed_at).toBeTruthy();
    expect(sub.reviewed_by).toBe("t1");

    // Kiểm tra ảnh chụp class_grades cho TẤT CẢ học sinh ghi danh trong c1 (s1 và s2)
    const grades = await rows(`SELECT * FROM class_grades WHERE class_id='c1' AND item_id='eRoadmap' ORDER BY student_id`);
    expect(grades).toHaveLength(2);

    // s1 có nộp
    expect(grades[0].student_id).toBe("s1");
    expect(grades[0].attempt_id).toBe("sub1");
    expect(Number(grades[0].score10)).toBe(7.8); // 7.0/9 = 77.8% -> 7.8
    expect(grades[0].finalized_at).toBeTruthy();

    // s2 chưa nộp: có dòng nhưng các trường điểm là NULL
    expect(grades[1].student_id).toBe("s2");
    expect(grades[1].attempt_id).toBeNull();
    expect(grades[1].score10).toBeNull();
    expect(grades[1].finalized_at).toBeTruthy();

    // Thông báo GRADEBOOK_FINALIZED: s1 nhận, s2 không nhận
    const notifs = await rows(`SELECT * FROM notifications WHERE type='GRADEBOOK_FINALIZED'`);
    expect(notifs).toHaveLength(1);
    expect(notifs[0]).toMatchObject({
      user_id: "s1",
      link: "/student/class/c1?tab=gradebook",
      ref_id: items[0].id,
    });
  });

  it("bài đã chốt gọi finalize lại → 409 ALREADY_FINALIZED", async () => {
    await loginAs("TEACHER", "t1");
    await apiFinalize("c1", "exam", "eRoadmap", { confirmUnreviewed: true });
    const res = await apiFinalize("c1", "exam", "eRoadmap", { confirmUnreviewed: true });
    expect(res.status).toBe(409);
    expect((await res.json()).code).toBe("ALREADY_FINALIZED");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe("6. TC-B09: Hành vi sau chốt & Mở chốt (reopen)", () => {
  beforeEach(async () => {
    // Chốt bài eRoadmap trong c1
    await h.pg.db.query(
      `INSERT INTO submissions (id, exam_id, student_id, answers, status, class_ref, standard_snapshot, total_score, results, submitted_at) VALUES
       ('subOld', 'eRoadmap', 's1', '{}', 'GRADED', 'c1', $1, 7.0, '[]', NOW() - INTERVAL '2 hours')`,
      [SNAP_IELTS]
    );
    await loginAs("TEACHER", "t1");
    await apiFinalize("c1", "exam", "eRoadmap", { confirmUnreviewed: true });
  });

  it("sau chốt: PUT ô học sinh → 409; PUT lượt nộp trước mốc → 409", async () => {
    await loginAs("TEACHER", "t1");
    // Sửa ô học sinh
    const putCell = await apiPutStudentCell("c1", "exam", "eRoadmap", "s1", { manual_score10: 9.0 });
    expect(putCell.status).toBe(409);

    // Sửa lượt nộp trước mốc
    const putAttempt = await apiPutAttempt("exam", "subOld", { items: [{ question_id: "qEssay", teacher_score: 9.0 }] });
    expect(putAttempt.status).toBe(409);
  });

  it("sau chốt: lượt nộp sau mốc chốt sửa được (200), nhưng ảnh chụp điểm không đổi", async () => {
    // Thêm lượt nộp sau mốc chốt
    await h.pg.db.query(
      `INSERT INTO submissions (id, exam_id, student_id, answers, status, class_ref, standard_snapshot, total_score, results, submitted_at) VALUES
       ('subNew', 'eRoadmap', 's1', '{}', 'GRADED', 'c1', $1, 6.0, $2, NOW() + INTERVAL '10 minutes')`,
      [
        SNAP_IELTS,
        JSON.stringify([
          { question_id: "qMC", kind: "OBJECTIVE", score: 6 },
          { question_id: "qEssay", kind: "AI", score: 6, ai_score: 6 },
        ]),
      ]
    );

    await loginAs("TEACHER", "t1");
    const res = await apiPutAttempt("exam", "subNew", {
      items: [{ question_id: "qEssay", teacher_score: 8.5 }],
    });
    expect(res.status).toBe(200);

    // Ảnh chụp trong class_grades của s1 vẫn giữ nguyên điểm cũ (7.8)
    const grade = (await rows(`SELECT * FROM class_grades WHERE class_id='c1' AND item_id='eRoadmap' AND student_id='s1'`))[0];
    expect(Number(grade.score10)).toBe(7.8);
    expect(grade.attempt_id).toBe("subOld");
  });

  it("mở chốt (reopen): bài chưa chốt 409; bài đã chốt 200, học sinh không còn thấy bài trong gradebook", async () => {
    await loginAs("TEACHER", "t1");
    // eAssign chưa chốt gọi reopen → 409
    expect((await apiReopen("c1", "exam", "eAssign")).status).toBe(409);

    // Reopen eRoadmap
    const res = await apiReopen("c1", "exam", "eRoadmap");
    expect(res.status).toBe(200);

    const cgi = (await rows(`SELECT * FROM class_grade_items WHERE class_id='c1' AND item_id='eRoadmap'`))[0];
    expect(cgi.finalized_at).toBeNull();
    expect(cgi.reopened_at).toBeTruthy();

    // Học sinh s1 gọi gradebook → không còn thấy bài này
    await loginAs("STUDENT", "s1");
    const gb = await (await apiStudentGradebook("c1")).json();
    expect(gb.items).toHaveLength(0);
    expect(gb.average10).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe("7. TC-B03 & PUT ô học sinh (lựa chọn lượt, nhập tay)", () => {
  it("nhập tay manual_score10: hợp lệ [0, 10] → 200; ngoài khoảng → 400; note tối đa 2000 ký tự", async () => {
    await loginAs("TEACHER", "t1");
    const ok = await apiPutStudentCell("c1", "exam", "eRoadmap", "s1", { manual_score10: 8.5, note: "Chăm chỉ" });
    expect(ok.status).toBe(200);

    const row = (await rows(`SELECT manual_score10, note FROM class_grades WHERE class_id='c1' AND student_id='s1' AND item_id='eRoadmap'`))[0];
    expect(Number(row.manual_score10)).toBe(8.5);
    expect(row.note).toBe("Chăm chỉ");

    // Ngoài [0, 10]
    expect((await apiPutStudentCell("c1", "exam", "eRoadmap", "s1", { manual_score10: -0.5 })).status).toBe(400);
    expect((await apiPutStudentCell("c1", "exam", "eRoadmap", "s1", { manual_score10: 10.5 })).status).toBe(400);

    // Note > 2000 ký tự
    expect((await apiPutStudentCell("c1", "exam", "eRoadmap", "s1", { note: "a".repeat(2001) })).status).toBe(400);

    // Học sinh chưa ghi danh c1 → 404
    expect((await apiPutStudentCell("c1", "exam", "eRoadmap", "sOut", { manual_score10: 5 })).status).toBe(404);
  });

  it("chosen_attempt_id phải là lượt của đúng học sinh, bài và lớp đó → nếu không 400", async () => {
    // sub_other thuộc s3 và lớp c2
    await h.pg.db.query(
      `INSERT INTO submissions (id, exam_id, student_id, answers, status, class_ref, standard_snapshot) VALUES
       ('sub_c2', 'eRoadmap', 's3', '{}', 'GRADED', 'c2', $1)`,
      [SNAP_IELTS]
    );

    await loginAs("TEACHER", "t1");
    // Gán sub_c2 cho s1 ở c1 → 400
    const res = await apiPutStudentCell("c1", "exam", "eRoadmap", "s1", { chosen_attempt_id: "sub_c2" });
    expect(res.status).toBe(400);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe("8. TC-B10 & TC-B11: Bảng tổng kết & Gradebook học sinh", () => {
  beforeEach(async () => {
    // Chốt 2 bài trong c1:
    // Bài 1 (eRoadmap): s1 có điểm 8.0, s2 chưa nộp
    // Bài 2 (lObj): s1 có điểm 9.0, s2 được giáo viên nhập tay 0.0
    await h.pg.db.query(
      `INSERT INTO submissions (id, exam_id, student_id, answers, status, class_ref, standard_snapshot, total_score, results, submitted_at) VALUES
       ('sub1', 'eRoadmap', 's1', '{}', 'GRADED', 'c1', $1, 7.2, '[]', NOW() - INTERVAL '1 hour')`,
      [SNAP_IELTS]
    );

    await h.pg.db.query(
      `INSERT INTO lesson_attempts (id, lesson_id, student_id, class_id, status, score_percent, created_at) VALUES
       ('att1', 'lObj', 's1', 'c1', 'GRADED', 90, NOW() - INTERVAL '1 hour')`
    );

    await loginAs("TEACHER", "t1");
    // Nhập tay s2 điểm 0 ở bài lObj
    await apiPutStudentCell("c1", "lesson", "lObj", "s2", { manual_score10: 0.0 });

    // Finalize cả 2 bài
    await apiFinalize("c1", "exam", "eRoadmap", { confirmUnreviewed: true });
    await apiFinalize("c1", "lesson", "lObj", { confirmUnreviewed: true });
  });

  it("TC-B10: summary tính trung bình đúng: bỏ qua ô rỗng, tính ô nhập tay 0, làm tròn 0.1", async () => {
    await loginAs("TEACHER", "t1");
    const res = await apiSummary("c1");
    expect(res.status).toBe(200);
    const json = await res.json();

    expect(json.items).toHaveLength(2); // 2 bài đã chốt
    expect(json.students).toHaveLength(2);

    const s1Row = json.students.find((s: any) => s.id === "s1");
    const s2Row = json.students.find((s: any) => s.id === "s2");

    // s1: bài 1 (7.2/9 = 8.0), bài 2 (90% = 9.0) -> TB: 8.5
    expect(s1Row.average10).toBe(8.5);

    // s2: bài 1 rỗng (chưa nộp, bỏ qua), bài 2 nhập tay 0.0 -> TB: 0.0
    expect(s2Row.average10).toBe(0.0);
    expect(s2Row.cells["lesson:lObj"].score10).toBe(0.0);
    expect(s2Row.cells["exam:eRoadmap"].score10).toBeNull();
  });

  it("TC-B11: học sinh chỉ thấy bài đã chốt, chỉ dòng của mình, không nhận studentId từ query; chưa ghi danh 403", async () => {
    // Học sinh chưa ghi danh c1 gọi → 403
    await loginAs("STUDENT", "sOut");
    expect((await apiStudentGradebook("c1")).status).toBe(403);

    // Học sinh s1 gọi
    await loginAs("STUDENT", "s1");
    // Thử bypass bằng cách nhét ?studentId=s2
    const res = await apiStudentGradebook("c1", "?studentId=s2");
    expect(res.status).toBe(200);
    const json = await res.json();

    // Chỉ trả kết quả của chính s1
    expect(json.items).toHaveLength(2);
    expect(json.average10).toBe(8.5);
    expect(JSON.stringify(json)).not.toContain("s2");
    expect(JSON.stringify(json)).not.toContain("0.0"); // điểm của s2 không xuất hiện
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe("9. TC-B14: members không đếm bài nộp của lớp khác", () => {
  it("GET /api/teacher/classes/[classId]/members chỉ tính submission có class_ref = classId", async () => {
    // s1 có 1 bài ở c1, 1 bài ở c2, 1 bài tự do
    await h.pg.db.query(
      `INSERT INTO submissions (id, exam_id, student_id, answers, status, class_ref, standard_snapshot, total_score) VALUES
       ('sub_c1', 'eRoadmap', 's1', '{}', 'GRADED', 'c1', $1, 8.0),
       ('sub_c2', 'eRoadmap', 's1', '{}', 'GRADED', 'c2', $1, 9.0),
       ('sub_free', 'eFree', 's1', '{}', 'GRADED', NULL, $1, 10.0)`,
      [SNAP_IELTS]
    );

    await loginAs("TEACHER", "t1");
    const res = await apiMembers("c1");
    expect(res.status).toBe(200);
    const json = await res.json();

    const s1 = json.students.find((s: any) => s.id === "s1");
    expect(s1.submission_count).toBe(1); // CHỈ tính bài của c1, không phải 3
    expect(s1.latest_total).toBe(8.0);   // Điểm bài của c1, không bị lấy 9.0 hay 10.0
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe("10. TC-B15: GRADEBOOK_FINALIZED chỉ gửi học sinh có điểm; chốt lại không nhân đôi", () => {
  it("chốt lại (reopen -> finalize) cập nhật cùng dòng thông báo, không tạo dòng thứ hai", async () => {
    await h.pg.db.query(
      `INSERT INTO submissions (id, exam_id, student_id, answers, status, class_ref, standard_snapshot, total_score, results, submitted_at) VALUES
       ('sub1', 'eRoadmap', 's1', '{}', 'GRADED', 'c1', $1, 7.0, '[]', NOW() - INTERVAL '1 hour')`,
      [SNAP_IELTS]
    );

    await loginAs("TEACHER", "t1");
    // Lần chốt 1
    await apiFinalize("c1", "exam", "eRoadmap", { confirmUnreviewed: true });
    let notifs = await rows(`SELECT * FROM notifications WHERE type='GRADEBOOK_FINALIZED' AND user_id='s1'`);
    expect(notifs).toHaveLength(1);

    // Học sinh đọc thông báo
    await h.pg.db.exec(`UPDATE notifications SET read_at = NOW() WHERE type='GRADEBOOK_FINALIZED'`);

    // Giáo viên reopen và finalize lại
    await apiReopen("c1", "exam", "eRoadmap");
    await apiFinalize("c1", "exam", "eRoadmap", { confirmUnreviewed: true });

    notifs = await rows(`SELECT * FROM notifications WHERE type='GRADEBOOK_FINALIZED' AND user_id='s1'`);
    expect(notifs).toHaveLength(1); // Vẫn duy nhất 1 dòng
    expect(notifs[0].read_at).toBeNull(); // Reset trạng thái chưa đọc
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe("11. GET attempts/[kind]/[attemptId] — Chi tiết lượt chấm cho giáo viên", () => {
  it("trả về câu hỏi kèm đáp án vì người xem là giáo viên; lượt không thuộc lớp nào → 404", async () => {
    await h.pg.db.query(
      `INSERT INTO submissions (id, exam_id, student_id, answers, status, class_ref, standard_snapshot, total_score, results) VALUES
       ('sub_c1', 'eRoadmap', 's1', '{"qMC":"A"}', 'GRADED', 'c1', $1, 7.0, $2),
       ('sub_free', 'eFree', 's1', '{"qMC":"A"}', 'GRADED', NULL, $1, 7.0, '[]')`,
      [
        SNAP_IELTS,
        JSON.stringify([{ question_id: "qMC", score: 7 }]),
      ]
    );

    await loginAs("TEACHER", "t1");
    const res = await apiGetAttempt("exam", "sub_c1");
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.student.id).toBe("s1");
    expect(json.locked).toBe(false);

    // Câu hỏi có đáp án
    const q = json.questions.find((x: any) => x.id === "qMC");
    expect(q).toBeTruthy();
    expect(JSON.stringify(q)).toContain("correct_answer");

    // Lượt tự do không thuộc lớp nào → 404
    expect((await apiGetAttempt("exam", "sub_free")).status).toBe(404);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe("12. GET /api/teacher/grading/classes — Hub danh sách lớp", () => {
  it("TEACHER chỉ thấy lớp của mình kèm student_count/needs_review/pending_review; ADMIN thấy tất cả", async () => {
    await h.pg.db.query(
      `INSERT INTO submissions (id, exam_id, student_id, answers, status, class_ref, standard_snapshot) VALUES
       ('subNR', 'eRoadmap', 's1', '{}', 'NEEDS_REVIEW', 'c1', $1)`,
      [SNAP_IELTS]
    );

    await loginAs("TEACHER", "t1");
    const res = await apiClasses();
    expect(res.status).toBe(200);
    const json = await res.json();

    expect(json.classes.map((c: any) => c.id)).toEqual(["c1"]);
    expect(json.classes[0]).toMatchObject({
      id: "c1",
      name: "Lớp IELTS Sáng",
      student_count: 2, // s1, s2
      needs_review: 1,
    });

    await loginAs("ADMIN", "admin1");
    const adminJson = await (await apiClasses()).json();
    expect(adminJson.classes).toHaveLength(2);
  });
});
