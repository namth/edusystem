// TASK-037 — FEAT-012 §6: giới hạn giáo viên dùng thử (DEC-027) và admin xác minh (DEC-028).
// File do trưởng phòng viết, bị khoá.
/* eslint-disable @typescript-eslint/no-explicit-any */
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
  headers: async () => new Headers(),
}));
vi.mock("@/lib/db-pg", () => ({
  queryPg: (sql: string, params?: unknown[]) => h.pg.queryPg(sql, params),
  ensureSchema: async () => {},
}));
vi.mock("@/lib/neo4j", () => ({
  syncStudentEnrolledInClass: async () => {},
  syncTeacherManagesClass: async () => {},
  syncCourseExam: async () => {},
  runCypherQuery: async () => [],
}));
vi.mock("@/lib/redis-queue", () => ({ enqueueGradingJob: async () => "job", pushToQueue: async () => "job" }));

import { signJwtToken } from "@/lib/jwt";

async function loginAs(role: "ADMIN" | "TEACHER" | "STUDENT", userId: string) {
  h.token = await signJwtToken({ userId, email: `${userId}@x.vn`, role });
}
const req = (url: string, body?: unknown, method = "POST") =>
  new Request(`http://localhost${url}`, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
const get = (url: string) => new Request(`http://localhost${url}`);
const ctx = <T extends Record<string, string>>(p: T) => ({ params: Promise.resolve(p) });
const rows = async (sql: string, params: unknown[] = []) => (await h.pg.db.query(sql, params)).rows as any[];
const n = async (sql: string, params: unknown[] = []) => Number((await rows(sql, params))[0].n);

const createClass = async (name = "Lớp mới") => (await import("@/app/api/teacher/classes/route")).POST(req("/api/teacher/classes", { name }));
const createLesson = async (title = "Bài mới") => (await import("@/app/api/teacher/lessons/route")).POST(req("/api/teacher/lessons", { title }));
const createExam = async (title = "Đề mới") =>
  (await import("@/app/api/teacher/exams/route")).POST(req("/api/teacher/exams", { title, duration_minutes: 30, question_ids: ["q1"] }));
const addStudent = async (classId: string, email: string) =>
  (await import("@/app/api/teacher/classes/[classId]/students/route")).POST(
    req(`/api/teacher/classes/${classId}/students`, { name: "HS " + email, email }),
    ctx({ classId })
  );
const assign = async (classId: string, exam_id: string, max_attempts: number) =>
  (await import("@/app/api/teacher/classes/[classId]/assignments/route")).POST(
    req(`/api/teacher/classes/${classId}/assignments`, { exam_id, max_attempts }),
    ctx({ classId })
  );
const trialUsage = async () => (await import("@/app/api/teacher/trial-usage/route")).GET(get("/api/teacher/trial-usage"));
const verify = async (id: string, body: unknown) =>
  (await import("@/app/api/admin/teachers/[id]/verify/route")).POST(req(`/api/admin/teachers/${id}/verify`, body), ctx({ id }));

async function expectTrialLimit(res: Response, limit: string) {
  expect(res.status).toBe(403);
  const j = await res.json();
  expect(j).toMatchObject({ success: false, code: "TRIAL_LIMIT", limit });
  expect(typeof j.error).toBe("string");
  expect(j.error.length).toBeGreaterThan(10);
}

beforeEach(async () => {
  h.token = undefined;
  h.pg = await createFakePg([
    "db-migration-004-enrollments-assignments.sql",
    "db-migration-007-question-owner.sql",
    "db-migration-010-notifications.sql",
    "db-migration-013-onboarding.sql",
  ]);
  await h.pg.db.exec(`
    ALTER TABLE users ADD COLUMN IF NOT EXISTS slot_limit INT DEFAULT 250;
    ALTER TABLE submissions ADD COLUMN IF NOT EXISTS class_ref VARCHAR(50);
    ALTER TABLE exams ADD COLUMN IF NOT EXISTS description TEXT;
    CREATE TABLE slot_requests (id VARCHAR(50) PRIMARY KEY, teacher_id VARCHAR(50), teacher_name VARCHAR(100), teacher_email VARCHAR(100),
      requested_slots INT NOT NULL, total_cost NUMERIC(12,2) NOT NULL, status VARCHAR(20) DEFAULT 'PENDING', created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP);
    CREATE TABLE courses (id VARCHAR(50) PRIMARY KEY, title VARCHAR(255), created_by VARCHAR(50));
    CREATE TABLE curriculum_items (
      id VARCHAR(50) PRIMARY KEY, course_id VARCHAR(50) NOT NULL, parent_id VARCHAR(50), title VARCHAR(255) NOT NULL,
      type VARCHAR(20) NOT NULL, exam_id VARCHAR(50), order_index INT DEFAULT 0, created_by VARCHAR(50),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);
  // FEAT-013 (TASK-041): slot_requests mở rộng thành đơn hàng — chạy migration như DB thật
  await h.pg.db.exec(fs.readFileSync("docs/db-migration-005-system-settings.sql", "utf8"));
  await h.pg.db.exec(fs.readFileSync("docs/db-migration-016-slot-orders.sql", "utf8"));
  await h.pg.db.exec(fs.readFileSync("docs/db-migration-006-lessons.sql", "utf8"));
  await h.pg.db.exec(`
    INSERT INTO users (id, name, email, role, teacher_status, slot_limit) VALUES
      ('tT','GV thử','tt@x.vn','TEACHER','TRIAL',9),
      ('tR','GV bị từ chối','tr@x.vn','TEACHER','REJECTED',9),
      ('tV','GV xác minh','tv@x.vn','TEACHER','VERIFIED',250),
      ('ad','Admin','ad@x.vn','ADMIN',NULL,250),
      ('s1','HS1','s1@x.vn','STUDENT',NULL,0),
      ('s2','HS2','s2@x.vn','STUDENT',NULL,0),
      ('s3','HS3','s3@x.vn','STUDENT',NULL,0),
      ('s4','HS4','s4@x.vn','STUDENT',NULL,0);
    INSERT INTO teacher_profiles (user_id, answers) VALUES ('tT', '{"subjects":["english"],"levels":["PRIMARY"],"workplace_type":"CENTER","student_count":"LT10","needs":["AI_GRADING"]}');
    INSERT INTO questions (id, skill, category, prompt, content, created_by) VALUES
      ('q1','Reading','READING_MC','Câu 1','{"sub_questions":[]}','tT'),
      ('q2','Reading','READING_MC','Câu 2','{"sub_questions":[]}','tV');
  `);
});

describe("lib/teacher-trial", () => {
  it("TRIAL_LIMITS đúng DEC-027; module server không bị import vào client component", async () => {
    const t = await import("@/lib/teacher-trial");
    expect(t.TRIAL_LIMITS).toMatchObject({ classes: 1, contents: 3, students: 3, attemptsPerItem: 1 });
    const banner = fs.readFileSync("components/teacher/TrialBanner.tsx", "utf8");
    expect(banner).not.toMatch(/teacher-trial|db-pg/);
    expect(banner).toContain("/api/teacher/trial-usage");
  });

  it("isTrialTeacher: TRIAL và REJECTED bị giới hạn; VERIFIED, ADMIN thì không", async () => {
    const t = await import("@/lib/teacher-trial");
    expect(await t.isTrialTeacher("tT")).toBe(true);
    expect(await t.isTrialTeacher("tR")).toBe(true);
    expect(await t.isTrialTeacher("tV")).toBe(false);
    expect(await t.isTrialTeacher("ad")).toBe(false);
  });

  it("getTrialUsage đếm lớp, bài học + đề, học sinh khác nhau qua mọi lớp", async () => {
    await h.pg.db.exec(`
      INSERT INTO classes (id, name, code, teacher_id) VALUES ('c1','A','C1','tT');
      INSERT INTO lessons (id, title, question_ids, created_by) VALUES ('l1','L1','[]','tT');
      INSERT INTO exams (id, title, created_by) VALUES ('e1','E1','tT'), ('eV','EV','tV');
      INSERT INTO enrollments (id, student_id, class_id) VALUES ('en1','s1','c1'), ('en2','s2','c1');
    `);
    const t = await import("@/lib/teacher-trial");
    expect(await t.getTrialUsage("tT")).toEqual({ classes: 1, contents: 2, students: 2 });
  });
});

describe("Giới hạn tạo lớp / nội dung", () => {
  it("dùng thử: lớp thứ 2 → 403 TRIAL_LIMIT; lớp tạo ra có max_slots ≤ 3", async () => {
    await loginAs("TEACHER", "tT");
    const r1 = await createClass();
    expect(r1.status).toBeLessThan(300);
    expect(await n(`SELECT max(max_slots) AS n FROM classes WHERE teacher_id='tT'`)).toBeLessThanOrEqual(3);
    await expectTrialLimit(await createClass("Lớp 2"), "classes");
    expect(await n(`SELECT count(*) AS n FROM classes WHERE teacher_id='tT'`)).toBe(1);
  });

  it("REJECTED vẫn bị giới hạn; VERIFIED và ADMIN không bị", async () => {
    await h.pg.db.exec(`INSERT INTO classes (id, name, code, teacher_id) VALUES ('cR','R','CR','tR'), ('cV','V','CV','tV')`);
    await loginAs("TEACHER", "tR");
    await expectTrialLimit(await createClass(), "classes");
    await loginAs("TEACHER", "tV");
    expect((await createClass()).status).toBeLessThan(300);
    expect((await createClass("V3")).status).toBeLessThan(300);
    await loginAs("ADMIN", "ad");
    expect((await createClass("Admin 1")).status).toBeLessThan(300);
    expect((await createClass("Admin 2")).status).toBeLessThan(300);
  });

  it("3 nội dung tính chung bài học + đề: 2 bài học + 1 đề rồi tạo thêm bài học hoặc đề đều bị chặn", async () => {
    await loginAs("TEACHER", "tT");
    expect((await createLesson("B1")).status).toBeLessThan(300);
    expect((await createLesson("B2")).status).toBeLessThan(300);
    expect((await createExam("Đ1")).status).toBeLessThan(300);
    await expectTrialLimit(await createLesson("B3"), "contents");
    await expectTrialLimit(await createExam("Đ2"), "contents");
    expect(await n(`SELECT count(*) AS n FROM lessons WHERE created_by='tT'`)).toBe(2);
    expect(await n(`SELECT count(*) AS n FROM exams WHERE created_by='tT'`)).toBe(1);
  });

  it("xoá bớt nội dung thì được tạo lại", async () => {
    await h.pg.db.exec(`INSERT INTO lessons (id, title, question_ids, created_by) VALUES ('l1','L1','[]','tT'),('l2','L2','[]','tT'),('l3','L3','[]','tT')`);
    await loginAs("TEACHER", "tT");
    await expectTrialLimit(await createLesson(), "contents");
    await h.pg.db.exec(`DELETE FROM lessons WHERE id='l3'`);
    expect((await createLesson()).status).toBeLessThan(300);
  });

  it("AI nhập đề cũng kiểm tra giới hạn nội dung (trước khi gọi AI / ghi DB)", () => {
    const s = fs.readFileSync("app/api/teacher/exams/ai-import/route.ts", "utf8");
    expect(s).toMatch(/assertTrialAllows\([^)]*["']contents["']/);
    expect(s.indexOf("assertTrialAllows")).toBeLessThan(s.search(/INSERT\s+INTO\s+exams/i));
  });
});

describe("Giới hạn 3 học sinh — mọi đường vào lớp", () => {
  beforeEach(async () => {
    await h.pg.db.exec(`
      INSERT INTO classes (id, name, code, teacher_id, max_slots) VALUES ('c1','Lớp thử','TRY001','tT',3), ('cV','Lớp V','VER001','tV',30);
      INSERT INTO enrollments (id, student_id, class_id) VALUES ('en1','s1','c1'), ('en2','s2','c1'), ('en3','s3','c1');
    `);
  });

  it("enrollStudentByCode (link mời / mã lớp / đăng ký kèm mã): học sinh thứ 4 → 409", async () => {
    const { enrollStudentByCode } = await import("@/lib/enrollment");
    const r = await enrollStudentByCode("s4", "TRY001");
    expect(r.ok).toBe(false);
    expect((r as any).status).toBe(409);
    expect(await n(`SELECT count(*) AS n FROM enrollments WHERE class_id='c1'`)).toBe(3);
    expect((await enrollStudentByCode("s4", "VER001")).ok).toBe(true);
  });

  it("đếm theo học sinh khác nhau qua mọi lớp của giáo viên, kể cả khi lớp còn chỗ", async () => {
    await h.pg.db.exec(`UPDATE classes SET max_slots = 30 WHERE id = 'c1'`);
    const { enrollStudentByCode } = await import("@/lib/enrollment");
    expect((await enrollStudentByCode("s4", "TRY001")).ok).toBe(false);
  });

  it("giáo viên thêm học sinh thứ 4 → 403 TRIAL_LIMIT, không tạo user mới", async () => {
    await h.pg.db.exec(`UPDATE classes SET max_slots = 30 WHERE id = 'c1'`); // lớp còn chỗ — chỉ giới hạn dùng thử chặn
    await loginAs("TEACHER", "tT");
    const before = await n(`SELECT count(*) AS n FROM users`);
    await expectTrialLimit(await addStudent("c1", "moi@x.vn"), "students");
    expect(await n(`SELECT count(*) AS n FROM users`)).toBe(before);
  });

  it("POST /api/admin/create-user do giáo viên dùng thử gọi có kiểm tra giới hạn học sinh", () => {
    const s = fs.readFileSync("app/api/admin/create-user/route.ts", "utf8");
    expect(s).toMatch(/assertTrialAllows\([^)]*["']students["']/);
  });

  it("giáo viên đã xác minh không bị giới hạn", async () => {
    await h.pg.db.exec(`INSERT INTO enrollments (id, student_id, class_id) VALUES ('v1','s1','cV'),('v2','s2','cV'),('v3','s3','cV')`);
    const { enrollStudentByCode } = await import("@/lib/enrollment");
    expect((await enrollStudentByCode("s4", "VER001")).ok).toBe(true);
  });
});

describe("Mỗi học sinh 1 lần nộp mỗi bài/đề trong lớp dùng thử", () => {
  beforeEach(async () => {
    await h.pg.db.exec(`
      INSERT INTO classes (id, name, code, teacher_id) VALUES ('c1','Lớp thử','TRY001','tT'), ('cV','Lớp V','VER001','tV');
      INSERT INTO enrollments (id, student_id, class_id) VALUES ('en1','s1','c1'), ('en2','s1','cV');
      INSERT INTO exams (id, title, question_ids, created_by) VALUES ('eT','Đề thử','["q1"]','tT'), ('eV','Đề V','["q2"]','tV');
      INSERT INTO lessons (id, title, question_ids, created_by) VALUES ('lT','Bài thử','[]','tT');
    `);
  });

  it("giao bài cho lớp dùng thử: max_attempts bị ép về 1", async () => {
    await loginAs("TEACHER", "tT");
    const res = await assign("c1", "eT", 5);
    expect(res.status).toBeLessThan(300);
    expect(await n(`SELECT max_attempts AS n FROM class_assignments WHERE class_id='c1' AND exam_id='eT'`)).toBe(1);
    await loginAs("TEACHER", "tV");
    await assign("cV", "eV", 5);
    expect(await n(`SELECT max_attempts AS n FROM class_assignments WHERE class_id='cV' AND exam_id='eV'`)).toBe(5);
  });

  it("checkExamAccess: lớp dùng thử chỉ 1 lượt dù max_attempts cũ lớn hơn", async () => {
    await h.pg.db.exec(`
      INSERT INTO class_assignments (id, class_id, exam_id, max_attempts) VALUES ('a1','c1','eT',3), ('a2','cV','eV',3);
      INSERT INTO submissions (id, exam_id, student_id, answers, status, class_ref) VALUES
        ('sub1','eT','s1','{}','GRADED','c1'), ('sub2','eV','s1','{}','GRADED','cV');
    `);
    const { checkExamAccess } = await import("@/lib/exam-attempts");
    const t = await checkExamAccess("eT", "s1", "c1");
    expect(t.allowed).toBe(false);
    expect(t.limit).toBe(1);
    const v = await checkExamAccess("eV", "s1", "cV");
    expect(v.allowed).toBe(true);
    expect(v.limit).toBe(3);
  });

  it("assertTrialAttemptAllowed: bài học đã nộp 1 lần trong lớp dùng thử → chặn; lớp thường → cho", async () => {
    const t = await import("@/lib/teacher-trial");
    expect((await t.assertTrialAttemptAllowed({ studentId: "s1", classId: "c1", kind: "lesson", itemId: "lT" })).ok).toBe(true);
    await h.pg.db.exec(`
      INSERT INTO lesson_attempts (id, lesson_id, class_id, student_id) VALUES ('att1','lT','c1','s1'), ('att2','lT','cV','s1');
    `);
    expect((await t.assertTrialAttemptAllowed({ studentId: "s1", classId: "c1", kind: "lesson", itemId: "lT" })).ok).toBe(false);
    expect((await t.assertTrialAttemptAllowed({ studentId: "s1", classId: "cV", kind: "lesson", itemId: "lT" })).ok).toBe(true);
    expect((await t.assertTrialAttemptAllowed({ studentId: "s2", classId: "c1", kind: "lesson", itemId: "lT" })).ok).toBe(true);
  });

  it("route nộp bài học gọi assertTrialAttemptAllowed sau checkLessonAccess, trước khi ghi lượt", () => {
    const s = fs.readFileSync("app/api/student/lessons/[lessonId]/attempts/route.ts", "utf8");
    const iAccess = s.indexOf("checkLessonAccess(");
    const iTrial = s.indexOf("assertTrialAttemptAllowed(");
    const iInsert = s.search(/INSERT\s+INTO\s+lesson_attempts/i);
    expect(iAccess).toBeGreaterThan(-1);
    expect(iTrial).toBeGreaterThan(iAccess);
    expect(iTrial).toBeLessThan(iInsert);
  });
});

describe("Mua slot & trial-usage", () => {
  it("giáo viên dùng thử không gửi được đơn mua slot; đã xác minh thì được", async () => {
    const slots = async () =>
      (await import("@/app/api/teacher/slot-requests/route")).POST(req("/api/teacher/slot-requests", { requested_slots: 10 }));
    await loginAs("TEACHER", "tT");
    await expectTrialLimit(await slots(), "slots");
    await loginAs("TEACHER", "tV");
    expect((await slots()).status).toBeLessThan(300);
  });

  it("GET /api/teacher/trial-usage: dùng thử có limits/used; đã xác minh limits=null; học sinh 403", async () => {
    await h.pg.db.exec(`INSERT INTO classes (id, name, code, teacher_id) VALUES ('c1','A','C1','tT')`);
    await loginAs("TEACHER", "tT");
    const j = await (await trialUsage()).json();
    expect(j).toMatchObject({ success: true, status: "TRIAL", limits: { classes: 1, contents: 3, students: 3 }, used: { classes: 1, contents: 0, students: 0 } });
    await loginAs("TEACHER", "tV");
    expect((await (await trialUsage()).json()).limits).toBeNull();
    await loginAs("STUDENT", "s1");
    expect((await trialUsage()).status).toBe(403);
  });
});

describe("Admin xác minh giáo viên", () => {
  it("chỉ ADMIN; giáo viên/học sinh → 403; không phải giáo viên → 404; quyết định lạ → 400", async () => {
    await loginAs("TEACHER", "tV");
    expect((await verify("tT", { decision: "VERIFIED" })).status).toBe(403);
    await loginAs("STUDENT", "s1");
    expect((await verify("tT", { decision: "VERIFIED" })).status).toBe(403);
    await loginAs("ADMIN", "ad");
    expect((await verify("s1", { decision: "VERIFIED" })).status).toBe(404);
    expect((await verify("tT", { decision: "OK" })).status).toBe(400);
    expect((await verify("tT", { decision: "REJECTED", note: "x".repeat(501) })).status).toBe(400);
  });

  it("VERIFIED: mở giới hạn ngay ở request kế tiếp, slot_limit ≥ 250, ghi người duyệt, báo giáo viên", async () => {
    await h.pg.db.exec(`INSERT INTO classes (id, name, code, teacher_id) VALUES ('c1','A','C1','tT')`);
    await loginAs("TEACHER", "tT");
    await expectTrialLimit(await createClass("B"), "classes");

    await loginAs("ADMIN", "ad");
    const res = await verify("tT", { decision: "VERIFIED", note: "Đã gọi điện" });
    expect(res.status).toBe(200);
    expect((await res.json()).teacher).toMatchObject({ id: "tT", teacher_status: "VERIFIED" });
    const u = (await rows(`SELECT teacher_status, slot_limit FROM users WHERE id='tT'`))[0];
    expect(u.teacher_status).toBe("VERIFIED");
    expect(Number(u.slot_limit)).toBeGreaterThanOrEqual(250);
    const p = (await rows(`SELECT reviewed_by, reviewed_at, review_note FROM teacher_profiles WHERE user_id='tT'`))[0];
    expect(p.reviewed_by).toBe("ad");
    expect(p.reviewed_at).toBeTruthy();
    expect(p.review_note).toBe("Đã gọi điện");
    const ntf = await rows(`SELECT type, ref_id, link FROM notifications WHERE user_id='tT'`);
    expect(ntf).toEqual([{ type: "TEACHER_VERIFIED", ref_id: "tT", link: "/teacher/classes" }]);

    await loginAs("TEACHER", "tT"); // cùng token kiểu cũ — trạng thái phải đọc từ DB
    expect((await createClass("B")).status).toBeLessThan(300);
  });

  it("REJECTED: giữ giới hạn, trial-usage trả ghi chú; xác minh giáo viên chưa có hồ sơ vẫn được", async () => {
    await loginAs("ADMIN", "ad");
    expect((await verify("tT", { decision: "REJECTED", note: "Thiếu thông tin" })).status).toBe(200);
    await loginAs("TEACHER", "tT");
    const j = await (await trialUsage()).json();
    expect(j.status).toBe("REJECTED");
    expect(j.limits).not.toBeNull();
    expect(j.reviewNote).toBe("Thiếu thông tin");

    await loginAs("ADMIN", "ad");
    expect((await verify("tR", { decision: "VERIFIED" })).status).toBe(200);
    expect((await rows(`SELECT count(*)::int AS n FROM teacher_profiles WHERE user_id='tR'`))[0].n).toBe(1);
  });

  it("GET /api/admin/users lọc teacherStatus; giá trị lạ 400; chi tiết giáo viên có khảo sát", async () => {
    await loginAs("ADMIN", "ad");
    const list = async (q: string) => (await import("@/app/api/admin/users/route")).GET(get(`/api/admin/users?${q}`));
    const j = await (await list("role=TEACHER&teacherStatus=TRIAL")).json();
    const arr = j.users ?? j.data ?? j;
    expect(arr.map((u: any) => u.id)).toEqual(["tT"]);
    expect(arr[0].teacher_status).toBe("TRIAL");
    expect((await list("role=TEACHER&teacherStatus=ABC")).status).toBe(400);

    const d = await (await (await import("@/app/api/admin/teachers/[id]/route")).GET(get("/api/admin/teachers/tT"), ctx({ id: "tT" }))).json();
    const teacher = d.teacher ?? d;
    expect(teacher.teacher_status ?? d.teacher_status).toBe("TRIAL");
    const profile = d.profile ?? teacher.profile;
    expect(profile.answers.workplace_type).toBe("CENTER");
  });
});

describe("Giao diện", () => {
  it("TeacherLayout chèn TrialBanner, giữ nguyên menu", () => {
    const s = fs.readFileSync("components/TeacherLayout.tsx", "utf8");
    expect(s).toMatch(/<TrialBanner\s*\/>/);
    expect(s).toContain('"/teacher/library"');
  });

  it("trang admin giáo viên có lọc chờ xác minh, đọc ?status, có nút xác minh/từ chối và nhãn khảo sát tiếng Việt", () => {
    const list = fs.readFileSync("app/admin/teachers/page.tsx", "utf8");
    expect(list).toMatch(/teacherStatus=TRIAL/);
    expect(list).toMatch(/Chờ xác minh/);
    expect(list).toMatch(/useSearchParams|searchParams/);
    const detail = fs.readFileSync("app/admin/teachers/[id]/page.tsx", "utf8");
    expect(detail).toMatch(/\/verify/);
    expect(detail).toMatch(/Xác minh/);
    expect(detail).toMatch(/Từ chối/);
    expect(detail).toMatch(/@\/lib\/onboarding/);
  });

  it("chống lách: đủ số ca", () => {
    const s = fs.readFileSync(__filename, "utf8");
    expect((s.match(/\bit\(/g) || []).length).toBeGreaterThanOrEqual(25);
  });
});
