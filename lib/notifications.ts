// Thông báo trong ứng dụng (DEC-021, bảng notifications — migration 010).
// Các hàm notify* không bao giờ ném lỗi: lỗi thông báo chỉ được log, không làm hỏng việc chấm bài.
import crypto from "crypto";
import { queryPg } from "@/lib/db-pg";
import { submissionScore } from "@/lib/score-display";
import { appBaseUrl, isMailerConfigured, sendEmail } from "@/lib/mailer";
import { notificationEmail } from "@/lib/email-templates";

export type NotificationType =
  | "EXAM_GRADED"
  | "EXAM_NEEDS_REVIEW"
  | "LESSON_NEEDS_REVIEW"
  | "GRADEBOOK_FINALIZED"
  | "TEACHER_SIGNUP"
  | "TEACHER_VERIFIED"
  | "ORDER_CREATED"
  | "ORDER_APPROVED"
  | "ORDER_REJECTED"
  | "ORDER_PAID_REPORTED";

export interface NotificationItem {
  id: string;
  type: NotificationType;
  title: string;
  body: string | null;
  link: string | null;
  ref_id: string;
  read_at: string | null;
  created_at: string;
}

export async function createNotification(n: {
  userId: string;
  type: NotificationType;
  title: string;
  body?: string | null;
  link?: string | null;
  refId: string;
}): Promise<void> {
  const res = await queryPg(
    `INSERT INTO notifications (id, user_id, type, title, body, link, ref_id, read_at, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, NULL, NOW())
     ON CONFLICT (user_id, type, ref_id)
     DO UPDATE SET title = EXCLUDED.title, body = EXCLUDED.body, link = EXCLUDED.link, read_at = NULL, created_at = NOW()
     RETURNING (xmax = 0) AS inserted`,
    ["ntf_" + crypto.randomUUID(), n.userId, n.type, n.title, n.body ?? null, n.link ?? null, n.refId]
  );
  // Chỉ gửi email khi thực sự tạo dòng mới (không gửi lại khi trúng ON CONFLICT).
  if (EMAIL_NOTIFICATION_TYPES.has(n.type) && res.rows?.[0]?.inserted === true) {
    await emailNotification(n);
  }
}

/** Các loại thông báo được gửi kèm email (Resend). */
const EMAIL_NOTIFICATION_TYPES = new Set<NotificationType>([
  "TEACHER_SIGNUP",
  "ORDER_PAID_REPORTED",
  "ORDER_APPROVED",
  "ORDER_REJECTED",
  "TEACHER_VERIFIED",
]);

/** Gửi email cho người nhận thông báo. Không bao giờ ném lỗi và không chờ quá ~10 s. */
async function emailNotification(n: {
  userId: string;
  type: NotificationType;
  title: string;
  body?: string | null;
  link?: string | null;
}): Promise<void> {
  try {
    if (!isMailerConfigured()) return;
    const u = await queryPg("SELECT email FROM users WHERE id = $1 LIMIT 1", [n.userId]);
    const to: string | undefined = u.rows[0]?.email;
    if (!to) return;
    const url = n.link ? appBaseUrl() + (n.link.startsWith("/") ? n.link : "/" + n.link) : null;
    const mail = notificationEmail({ title: n.title, body: n.body, url });
    await sendEmail({ to, ...mail });
  } catch (err) {
    console.warn("createNotification: gửi email thất bại", err instanceof Error ? err.name : "error");
  }
}

function parseJson(v: unknown): any {
  if (typeof v === "string") {
    try {
      return JSON.parse(v);
    } catch {
      return null;
    }
  }
  return v ?? null;
}

async function loadSubmission(submissionId: string) {
  const res = await queryPg(
    `SELECT s.id, s.student_id, s.exam_id, s.class_ref, s.status, s.total_score, s.passed, s.standard_snapshot,
            e.title AS exam_title, e.created_by AS exam_owner
     FROM submissions s LEFT JOIN exams e ON e.id = s.exam_id
     WHERE s.id = $1 LIMIT 1`,
    [submissionId]
  );
  return res.rows[0] || null;
}

/** Học sinh: "Bài “…” đã có điểm: 6.5/9 — Đạt". Gọi khi bài chuyển sang GRADED sau khi chờ AI/giáo viên. */
export async function notifyExamGraded(submissionId: string): Promise<void> {
  try {
    const sub = await loadSubmission(submissionId);
    if (!sub || sub.status !== "GRADED") return;
    const score = submissionScore({ ...sub, standard_snapshot: parseJson(sub.standard_snapshot) });
    const scoreText = score.value === null ? "" : score.max !== null ? `${score.value}/${score.max}` : String(score.value);
    const passText = sub.passed === true ? " — Đạt" : sub.passed === false ? " — Chưa đạt" : "";
    await createNotification({
      userId: sub.student_id,
      type: "EXAM_GRADED",
      title: `Bài “${sub.exam_title || sub.exam_id}” đã có điểm`,
      body: scoreText ? `Điểm: ${scoreText}${passText}` : `Đã chấm xong${passText}`,
      link: `/student/exam/review/${sub.id}`,
      refId: sub.id,
    });
  } catch (err) {
    console.error("notifyExamGraded error:", err);
  }
}

/** Giáo viên lớp (hoặc người tạo đề nếu là bài luyện tập): có bài chờ chấm tay. */
export async function notifyNeedsReview(submissionId: string): Promise<void> {
  try {
    const sub = await loadSubmission(submissionId);
    if (!sub || sub.status !== "NEEDS_REVIEW") return;
    let teacherId: string | null = null;
    if (sub.class_ref) {
      const c = await queryPg("SELECT teacher_id FROM classes WHERE id = $1 LIMIT 1", [sub.class_ref]);
      teacherId = c.rows[0]?.teacher_id || null;
    }
    teacherId = teacherId || sub.exam_owner || null;
    if (!teacherId) return;
    const st = await queryPg("SELECT name FROM users WHERE id = $1 LIMIT 1", [sub.student_id]);
    await createNotification({
      userId: teacherId,
      type: "EXAM_NEEDS_REVIEW",
      title: `Bài “${sub.exam_title || sub.exam_id}” cần chấm tay`,
      body: `Học sinh: ${st.rows[0]?.name || sub.student_id}`,
      link: sub.class_ref ? `/teacher/grading/${sub.class_ref}/exam/${sub.exam_id}` : "/teacher/grading",
      refId: sub.id,
    });
  } catch (err) {
    console.error("notifyNeedsReview error:", err);
  }
}

/** Giáo viên của lớp: bài học có mục AI lỗi, cần chấm tay (FEAT-014, DEC-041). */
export async function notifyLessonNeedsReview(attemptId: string): Promise<void> {
  try {
    const res = await queryPg(
      `SELECT a.id, a.student_id, a.lesson_id, a.class_id, l.title AS lesson_title
       FROM lesson_attempts a LEFT JOIN lessons l ON l.id = a.lesson_id
       WHERE a.id = $1 LIMIT 1`,
      [attemptId]
    );
    const att = res.rows[0];
    if (!att || !att.class_id) return;
    const c = await queryPg("SELECT teacher_id FROM classes WHERE id = $1 LIMIT 1", [att.class_id]);
    const teacherId = c.rows[0]?.teacher_id || null;
    if (!teacherId) return;
    const st = await queryPg("SELECT name FROM users WHERE id = $1 LIMIT 1", [att.student_id]);
    await createNotification({
      userId: teacherId,
      type: "LESSON_NEEDS_REVIEW",
      title: `Bài học “${att.lesson_title || att.lesson_id}” cần chấm tay`,
      body: `Học sinh: ${st.rows[0]?.name || att.student_id}`,
      link: `/teacher/grading/${att.class_id}/lesson/${att.lesson_id}`,
      refId: att.id,
    });
  } catch (err) {
    console.error("notifyLessonNeedsReview error:", err);
  }
}

/** Học sinh có điểm trong bảng điểm vừa chốt (FEAT-014). Chốt lại thì cập nhật cùng dòng. Trả số thông báo đã gửi. */
export async function notifyGradebookFinalized(gradeItemId: string): Promise<number> {
  try {
    const itemRes = await queryPg(
      `SELECT i.id, i.class_id, i.item_kind, i.item_id,
              CASE WHEN i.item_kind = 'LESSON' THEN l.title ELSE e.title END AS title
       FROM class_grade_items i
       LEFT JOIN lessons l ON i.item_kind = 'LESSON' AND l.id = i.item_id
       LEFT JOIN exams e ON i.item_kind = 'EXAM' AND e.id = i.item_id
       WHERE i.id = $1 LIMIT 1`,
      [gradeItemId]
    );
    const item = itemRes.rows[0];
    if (!item) return 0;
    const grades = await queryPg(
      `SELECT student_id FROM class_grades
       WHERE class_id = $1 AND item_kind = $2 AND item_id = $3 AND score10 IS NOT NULL`,
      [item.class_id, item.item_kind, item.item_id]
    );
    let sent = 0;
    for (const g of grades.rows) {
      await createNotification({
        userId: g.student_id,
        type: "GRADEBOOK_FINALIZED",
        title: `Bảng điểm “${item.title || item.item_id}” đã được chốt`,
        body: "Giáo viên đã chốt điểm chính thức. Xem trong tab Bảng điểm của lớp.",
        link: `/student/class/${item.class_id}?tab=gradebook`,
        refId: item.id,
      });
      sent++;
    }
    return sent;
  } catch (err) {
    console.error("notifyGradebookFinalized error:", err);
    return 0;
  }
}

export async function listNotifications(
  userId: string,
  limit = 20
): Promise<{ items: NotificationItem[]; unread: number }> {
  const safeLimit = Math.max(1, Math.min(100, Math.trunc(limit) || 20));
  const [list, count] = await Promise.all([
    queryPg(
      `SELECT id, type, title, body, link, ref_id, read_at, created_at
       FROM notifications WHERE user_id = $1 ORDER BY created_at DESC, id DESC LIMIT $2`,
      [userId, safeLimit]
    ),
    queryPg(`SELECT COUNT(*)::int AS n FROM notifications WHERE user_id = $1 AND read_at IS NULL`, [userId]),
  ]);
  return { items: list.rows as NotificationItem[], unread: Number(count.rows[0]?.n || 0) };
}

/** Đánh dấu đã đọc; không truyền ids → tất cả. Chỉ đụng thông báo của chính userId. Trả số dòng cập nhật. */
export async function markNotificationsRead(userId: string, ids?: string[]): Promise<number> {
  if (ids !== undefined) {
    const clean = ids.filter((x) => typeof x === "string" && x.length > 0);
    if (clean.length === 0) return 0;
    const res = await queryPg(
      `UPDATE notifications SET read_at = NOW() WHERE user_id = $1 AND read_at IS NULL AND id = ANY($2)`,
      [userId, clean]
    );
    return res.rowCount ?? 0;
  }
  const res = await queryPg(`UPDATE notifications SET read_at = NOW() WHERE user_id = $1 AND read_at IS NULL`, [userId]);
  return res.rowCount ?? 0;
}
