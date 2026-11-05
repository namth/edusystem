// TASK-030 — API + chuông thông báo; giáo viên chấm tay xong → học sinh nhận thông báo (DEC-021).
// File do trưởng phòng viết, bị khoá.
import { describe, it, expect, vi, beforeEach } from "vitest";
import fs from "fs";
import { createFakePg } from "./helpers/pg-fake";

const h = vi.hoisted(() => {
  process.env.JWT_SECRET = "test_secret_for_vitest_only_0123456789abcdef";
  process.env.INTERNAL_API_TOKEN = "internal_test_token_xyz";
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
  getPgPool: () => ({ connect: async () => ({ query: (s: string, p?: unknown[]) => h.pg.queryPg(s, p), release: () => {} }) }),
  ensureSchema: async () => {},
}));
vi.mock("@/lib/redis-queue", () => ({ pushRedisStreamEvent: async () => {}, pushGradingEvent: async () => {} }));
vi.mock("@/lib/exam-ai-grading", () => ({ gradeExamOpenAnswer: async () => ({ score: 6, feedback: null }) }));

import { signJwtToken } from "@/lib/jwt";
import { createNotification } from "@/lib/notifications";

async function loginAs(role: "ADMIN" | "TEACHER" | "STUDENT" | null, userId?: string) {
  h.token = role ? await signJwtToken({ userId: userId!, email: `${userId}@x.vn`, role }) : undefined;
}
const req = (method: string, url: string, body?: unknown) =>
  new Request(`http://localhost${url}`, { method, headers: { "Content-Type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) });
const rows = async (sql: string, p?: unknown[]) => (await h.pg.db.query(sql, p)).rows;
const list = async (qs = "") => (await import("@/app/api/notifications/route")).GET(req("GET", `/api/notifications${qs}`));
const markRead = async (body: unknown) => (await import("@/app/api/notifications/read/route")).POST(req("POST", "/api/notifications/read", body));

beforeEach(async () => {
  h.token = undefined;
  h.pg = await createFakePg(["db-migration-004-enrollments-assignments.sql"]);
  await h.pg.db.exec(`
    ALTER TABLE users ADD COLUMN slot_limit INT DEFAULT 0;
    CREATE TABLE courses (id VARCHAR(50) PRIMARY KEY, title VARCHAR(255), created_by VARCHAR(50));
    CREATE TABLE curriculum_items (id VARCHAR(50) PRIMARY KEY, course_id VARCHAR(50) NOT NULL, parent_id VARCHAR(50), title VARCHAR(255) NOT NULL,
      type VARCHAR(20) NOT NULL, exam_id VARCHAR(50), order_index INT DEFAULT 0, created_by VARCHAR(50), created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP);
  `);
  await h.pg.db.exec(fs.readFileSync("docs/db-migration-006-lessons.sql", "utf8"));
  await h.pg.db.exec(fs.readFileSync("docs/db-migration-009-scoring-standards.sql", "utf8"));
  await h.pg.db.exec(fs.readFileSync("docs/db-migration-010-notifications.sql", "utf8"));
  await h.pg.db.exec(`
    INSERT INTO users (id,name,email,role,slot_limit) VALUES ('t2','GV2','t2@x.vn','TEACHER',0), ('s1','HS1','s1@x.vn','STUDENT',0), ('s2','HS2','s2@x.vn','STUDENT',0);
    INSERT INTO classes (id,name,code,teacher_id) VALUES ('c1','Lớp t2','CLS111','t2');
    INSERT INTO enrollments (id,student_id,class_id) VALUES ('en1','s1','c1');
    INSERT INTO questions (id,skill,category,prompt,content) VALUES ('w1','Writing','WRITING_ESSAY','Viết đoạn văn','{"min_words":50}');
    INSERT INTO exams (id,title,duration_minutes,question_ids,created_by,scoring_standard_id) VALUES ('eFree','Đề AI luyện tập',20,'["w1"]','t2','std_ielts');
  `);
});

describe("GET /api/notifications", () => {
  it("chưa đăng nhập → 401", async () => {
    expect((await list()).status).toBe(401);
  });

  it("trả thông báo của chính mình (mới nhất trước) + số chưa đọc; mọi vai trò dùng được", async () => {
    await createNotification({ userId: "s1", type: "EXAM_GRADED", title: "A", refId: "x1", link: "/student/exam/review/x1" });
    await createNotification({ userId: "s2", type: "EXAM_GRADED", title: "Của người khác", refId: "x2" });
    await createNotification({ userId: "t2", type: "EXAM_NEEDS_REVIEW", title: "GV", refId: "x3" });
    await loginAs("STUDENT", "s1");
    const json = await (await list()).json();
    expect(json.success).toBe(true);
    expect(json.items.map((i: any) => i.title)).toEqual(["A"]);
    expect(json.items[0]).toMatchObject({ link: "/student/exam/review/x1", read_at: null });
    expect(json.unread).toBe(1);
    await loginAs("TEACHER", "t2");
    expect((await (await list()).json()).items.map((i: any) => i.title)).toEqual(["GV"]);
  });

  it("?limit=N giới hạn số mục", async () => {
    for (let i = 0; i < 4; i++) await createNotification({ userId: "s1", type: "EXAM_GRADED", title: `N${i}`, refId: `r${i}` });
    await loginAs("STUDENT", "s1");
    const json = await (await list("?limit=2")).json();
    expect(json.items).toHaveLength(2);
    expect(json.unread).toBe(4);
  });
});

describe("POST /api/notifications/read", () => {
  it("chưa đăng nhập 401; ids sai kiểu → 400", async () => {
    expect((await markRead({})).status).toBe(401);
    await loginAs("STUDENT", "s1");
    expect((await markRead({ ids: "abc" })).status).toBe(400);
    expect((await markRead({ ids: [1, 2] })).status).toBe(400);
  });

  it("đánh dấu theo ids (chỉ của mình) hoặc tất cả khi không gửi ids", async () => {
    await createNotification({ userId: "s1", type: "EXAM_GRADED", title: "A", refId: "x1" });
    await createNotification({ userId: "s1", type: "EXAM_GRADED", title: "B", refId: "x2" });
    await createNotification({ userId: "s2", type: "EXAM_GRADED", title: "C", refId: "x3" });
    const [a] = await rows(`SELECT id FROM notifications WHERE ref_id='x1'`);
    const [c] = await rows(`SELECT id FROM notifications WHERE ref_id='x3'`);
    await loginAs("STUDENT", "s1");
    const r1 = await (await markRead({ ids: [a.id, c.id] })).json();
    expect(r1).toEqual({ success: true, updated: 1 });
    expect((await rows(`SELECT read_at FROM notifications WHERE ref_id='x3'`))[0].read_at).toBeNull();
    const r2 = await (await markRead({})).json();
    expect(r2).toEqual({ success: true, updated: 1 });
    expect((await (await list()).json()).unread).toBe(0);
  });
});

describe("Giáo viên chấm tay xong → học sinh nhận thông báo", () => {
  it("lượt NEEDS_REVIEW được GV chấm qua API chấm lượt mới → GRADED + thông báo EXAM_GRADED cho học sinh", async () => {
    await loginAs("STUDENT", "s1");
    const start = (await import("@/app/api/student/exams/[examId]/attempts/route")).POST;
    const submit = (await import("@/app/api/student/exam-attempts/[id]/submit/route")).POST;
    const a = (await (await start(req("POST", "/x", {}), { params: Promise.resolve({ examId: "eFree" }) })).json()).attempt;
    await submit(req("POST", "/x", { answers: { w1: "Essay" } }), { params: Promise.resolve({ id: a.id }) });
    // DEC-031: chấm AI không phụ thuộc slot → bài vào GRADING; giả lập AI lỗi để GV chấm tay
    expect((await rows(`SELECT status FROM submissions WHERE id=$1`, [a.id]))[0].status).toBe("GRADING");
    await h.pg.db.query(`UPDATE submissions SET status='NEEDS_REVIEW', class_ref='c1' WHERE id=$1`, [a.id]);

    await loginAs("TEACHER", "t2");
    // @ts-ignore
    const editAttempt = (await import("@/app/api/teacher/grading/attempts/[kind]/[attemptId]/route")).PUT;
    const res = await editAttempt(
      req("PUT", "/x", {
        items: [{ question_id: "w1", teacher_score: 7, teacher_feedback: "Khá" }],
        feedback: "Khá",
      }),
      { params: Promise.resolve({ kind: "exam", attemptId: a.id }) }
    );
    expect(res.status).toBe(200);
    const n = await rows(`SELECT user_id, type, link, body FROM notifications WHERE ref_id=$1 AND type='EXAM_GRADED'`, [a.id]);
    expect(n).toHaveLength(1);
    expect(n[0]).toMatchObject({ user_id: "s1", link: `/student/exam/review/${a.id}` });
    expect(n[0].body).toContain("7");
  });
});

const read = (p: string) => fs.readFileSync(p, "utf8");

describe("Chuông thông báo — components/NotificationBell.tsx", () => {
  const s = () => read("components/NotificationBell.tsx");
  it("client component gọi API, kiểm tra mỗi 60 giây và dọn interval", () => {
    expect(s().trimStart().startsWith('"use client"')).toBe(true);
    expect(s()).toContain("/api/notifications");
    expect(s()).toContain("/api/notifications/read");
    expect(s()).toMatch(/setInterval\([\s\S]*?60[_]?000/);
    expect(s()).toMatch(/clearInterval/);
  });
  it("huy hiệu số chưa đọc (quá 9 → 9+), danh sách mở trang theo link, có 'Đánh dấu đã đọc tất cả' và trạng thái rỗng", () => {
    expect(s()).toMatch(/9\+/);
    expect(s()).toMatch(/\.link/);
    expect(s()).toMatch(/Đánh dấu đã đọc/);
    expect(s()).toMatch(/Chưa có thông báo/);
  });
  it("không import module chỉ chạy server", () => {
    expect(s()).not.toMatch(/@\/lib\/(notifications|db-pg)/);
  });
  it("StudentLayout và TeacherLayout dùng NotificationBell thay nút chuông trang trí", () => {
    for (const p of ["components/StudentLayout.tsx", "components/TeacherLayout.tsx"]) {
      expect(read(p), p).toContain("@/components/NotificationBell");
      expect(read(p), p).toMatch(/<NotificationBell\b/);
    }
  });
});
