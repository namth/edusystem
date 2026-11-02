// DEC-021 — lib/notifications.ts (hợp đồng dùng chung cho TASK-029/030). File do trưởng phòng viết.
import { describe, it, expect, vi, beforeEach } from "vitest";
import fs from "fs";
import { createFakePg } from "./helpers/pg-fake";

const h = vi.hoisted(() => ({ pg: null as any }));
vi.mock("@/lib/db-pg", () => ({
  queryPg: (sql: string, params?: unknown[]) => h.pg.queryPg(sql, params),
  ensureSchema: async () => {},
}));

import {
  createNotification,
  notifyExamGraded,
  notifyNeedsReview,
  listNotifications,
  markNotificationsRead,
} from "@/lib/notifications";

const rows = async (sql: string, p?: unknown[]) => (await h.pg.db.query(sql, p)).rows;
const SNAP = JSON.stringify({ id: "std_ielts", name: "IELTS Academic", sections: [{ skill: "Reading", min: 0, max: 9, step: 0.5 }], aggregation: { method: "AVERAGE" } });

beforeEach(async () => {
  h.pg = await createFakePg();
  await h.pg.db.exec(fs.readFileSync("docs/db-migration-009-scoring-standards.sql", "utf8").replace(/ALTER TABLE courses[^;]*;/g, ""));
  await h.pg.db.exec(fs.readFileSync("docs/db-migration-010-notifications.sql", "utf8"));
  await h.pg.db.exec(fs.readFileSync("docs/db-migration-010-notifications.sql", "utf8")); // chạy lại được
  await h.pg.db.exec(`
    INSERT INTO users (id,name,email,role) VALUES ('t1','GV','t1@x.vn','TEACHER'), ('t2','GV2','t2@x.vn','TEACHER'), ('s1','Học Sinh A','s1@x.vn','STUDENT');
    INSERT INTO classes (id,name,code,teacher_id) VALUES ('c1','Lớp','AAA','t2');
    INSERT INTO exams (id,title,question_ids,created_by) VALUES ('e1','Đề Starters 1','[]','t1');
  `);
  await h.pg.db.query(
    `INSERT INTO submissions (id,exam_id,student_id,answers,status,total_score,passed,standard_snapshot,class_ref) VALUES
     ('sub1','e1','s1','{}','GRADED',6.5,true,$1,NULL), ('sub2','e1','s1','{}','NEEDS_REVIEW',NULL,NULL,$1,'c1'),
     ('sub3','e1','s1','{}','NEEDS_REVIEW',NULL,NULL,$1,NULL), ('sub4','e1','s1','{}','GRADING',NULL,NULL,$1,NULL)`,
    [SNAP]
  );
});

describe("notifyExamGraded", () => {
  it("tạo thông báo cho học sinh kèm điểm, đạt và link xem lại", async () => {
    await notifyExamGraded("sub1");
    const r = await rows(`SELECT * FROM notifications`);
    expect(r).toHaveLength(1);
    expect(r[0]).toMatchObject({ user_id: "s1", type: "EXAM_GRADED", ref_id: "sub1", link: "/student/exam/review/sub1", read_at: null });
    expect(r[0].title).toContain("Đề Starters 1");
    expect(r[0].body).toContain("6.5");
    expect(r[0].body).toContain("Đạt");
  });

  it("gọi lại (chấm lại) không nhân đôi, cập nhật nội dung và đặt lại chưa đọc", async () => {
    await notifyExamGraded("sub1");
    await h.pg.db.exec(`UPDATE notifications SET read_at = NOW(); UPDATE submissions SET total_score = 7, passed = false WHERE id='sub1'`);
    await notifyExamGraded("sub1");
    const r = await rows(`SELECT * FROM notifications`);
    expect(r).toHaveLength(1);
    expect(r[0].read_at).toBeNull();
    expect(r[0].body).toContain("7");
    expect(r[0].body).toContain("Chưa đạt");
  });

  it("bài chưa GRADED hoặc không tồn tại → không tạo; lỗi DB không ném ra ngoài", async () => {
    await notifyExamGraded("sub4");
    await notifyExamGraded("nope");
    expect(await rows(`SELECT * FROM notifications`)).toHaveLength(0);
    vi.spyOn(console, "error").mockImplementation(() => {});
    await h.pg.db.exec(`DROP TABLE notifications`);
    await expect(notifyExamGraded("sub1")).resolves.toBeUndefined();
  });
});

describe("notifyNeedsReview", () => {
  it("bài của lớp → giáo viên lớp; bài luyện tập → người tạo đề; kèm tên học sinh, link /teacher/grading", async () => {
    await notifyNeedsReview("sub2");
    await notifyNeedsReview("sub3");
    await notifyNeedsReview("sub1"); // không ở NEEDS_REVIEW → bỏ qua
    const r = await rows(`SELECT user_id, ref_id, type, body, link FROM notifications ORDER BY ref_id`);
    expect(r).toEqual([
      expect.objectContaining({ user_id: "t2", ref_id: "sub2", type: "EXAM_NEEDS_REVIEW", link: "/teacher/grading" }),
      expect.objectContaining({ user_id: "t1", ref_id: "sub3", type: "EXAM_NEEDS_REVIEW" }),
    ]);
    expect(r[0].body).toContain("Học Sinh A");
  });
});

describe("listNotifications / markNotificationsRead", () => {
  it("chỉ thấy của mình, mới nhất trước, đếm chưa đọc; đánh dấu theo id hoặc tất cả, không đụng của người khác", async () => {
    await createNotification({ userId: "s1", type: "EXAM_GRADED", title: "A", refId: "x1" });
    await createNotification({ userId: "s1", type: "EXAM_GRADED", title: "B", refId: "x2" });
    await createNotification({ userId: "t1", type: "EXAM_NEEDS_REVIEW", title: "C", refId: "x3" });
    await h.pg.db.exec(`UPDATE notifications SET created_at = NOW() - INTERVAL '1 hour' WHERE ref_id='x1'`);

    const mine = await listNotifications("s1");
    expect(mine.items.map((i) => i.title)).toEqual(["B", "A"]);
    expect(mine.unread).toBe(2);

    const otherId = (await rows(`SELECT id FROM notifications WHERE ref_id='x3'`))[0].id;
    expect(await markNotificationsRead("s1", [mine.items[0].id, otherId])).toBe(1);
    expect((await listNotifications("s1")).unread).toBe(1);
    expect((await listNotifications("t1")).unread).toBe(1);

    expect(await markNotificationsRead("s1")).toBe(1);
    expect((await listNotifications("s1")).unread).toBe(0);
    expect(await markNotificationsRead("s1", [])).toBe(0);
  });

  it("giới hạn số lượng 1–100", async () => {
    for (let i = 0; i < 5; i++) await createNotification({ userId: "s1", type: "EXAM_GRADED", title: `N${i}`, refId: `r${i}` });
    expect((await listNotifications("s1", 2)).items).toHaveLength(2);
    expect((await listNotifications("s1", 0)).items.length).toBeGreaterThan(0);
  });
});
