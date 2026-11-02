// Thông báo trong ứng dụng (DEC-021, bảng notifications — migration 010).
// Các hàm notify* không bao giờ ném lỗi: lỗi thông báo chỉ được log, không làm hỏng việc chấm bài.
import crypto from "crypto";
import { queryPg } from "@/lib/db-pg";
import { submissionScore } from "@/lib/score-display";

export type NotificationType = "EXAM_GRADED" | "EXAM_NEEDS_REVIEW" | "TEACHER_SIGNUP" | "TEACHER_VERIFIED";

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
  await queryPg(
    `INSERT INTO notifications (id, user_id, type, title, body, link, ref_id, read_at, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, NULL, NOW())
     ON CONFLICT (user_id, type, ref_id)
     DO UPDATE SET title = EXCLUDED.title, body = EXCLUDED.body, link = EXCLUDED.link, read_at = NULL, created_at = NOW()`,
    ["ntf_" + crypto.randomUUID(), n.userId, n.type, n.title, n.body ?? null, n.link ?? null, n.refId]
  );
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
      link: "/teacher/grading",
      refId: sub.id,
    });
  } catch (err) {
    console.error("notifyNeedsReview error:", err);
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
