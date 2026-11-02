import { NextResponse } from "next/server";
import { queryPg } from "@/lib/db-pg";

export const TRIAL_LIMITS = {
  classes: 1,
  contents: 3,
  students: 3,
  attemptsPerItem: 1,
} as const;

export type TrialKind = "classes" | "contents" | "students";

export async function isTrialTeacher(teacherId: string): Promise<boolean> {
  if (!teacherId || typeof teacherId !== "string") return false;
  const res = await queryPg(
    `SELECT role, teacher_status FROM users WHERE id = $1 LIMIT 1`,
    [teacherId]
  );
  if (res.rows.length === 0) return false;
  const row = res.rows[0];
  if (row.role !== "TEACHER") return false;
  return row.teacher_status === "TRIAL" || row.teacher_status === "REJECTED";
}

export async function getTrialUsage(
  teacherId: string
): Promise<{ classes: number; contents: number; students: number }> {
  const [clsRes, lsnRes, exmRes, stuRes] = await Promise.all([
    queryPg(`SELECT COUNT(*)::int AS n FROM classes WHERE teacher_id = $1`, [teacherId]),
    queryPg(`SELECT COUNT(*)::int AS n FROM lessons WHERE created_by = $1`, [teacherId]),
    queryPg(`SELECT COUNT(*)::int AS n FROM exams WHERE created_by = $1`, [teacherId]),
    queryPg(
      `SELECT COUNT(DISTINCT e.student_id)::int AS n
       FROM enrollments e
       JOIN classes c ON c.id = e.class_id
       WHERE c.teacher_id = $1`,
      [teacherId]
    ),
  ]);

  const classes = Number(clsRes.rows[0]?.n || 0);
  const lessons = Number(lsnRes.rows[0]?.n || 0);
  const exams = Number(exmRes.rows[0]?.n || 0);
  const students = Number(stuRes.rows[0]?.n || 0);

  return {
    classes,
    contents: lessons + exams,
    students,
  };
}

const TRIAL_ERROR_MESSAGES: Record<TrialKind, string> = {
  classes:
    "Tài khoản dùng thử chỉ tạo được 1 lớp. Vui lòng chờ KitoKit xác minh để mở đủ tính năng.",
  contents:
    "Tài khoản dùng thử chỉ tạo được tối đa 3 nội dung (bài học & đề thi). Vui lòng chờ KitoKit xác minh để mở đủ tính năng.",
  students:
    "Tài khoản dùng thử chỉ có tối đa 3 học sinh. Vui lòng chờ KitoKit xác minh để mở đủ tính năng.",
};

export async function assertTrialAllows(
  teacherId: string,
  kind: TrialKind,
  adding = 1
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (adding <= 0) return { ok: true };
  if (!(await isTrialTeacher(teacherId))) {
    return { ok: true };
  }

  const usage = await getTrialUsage(teacherId);
  const limit = TRIAL_LIMITS[kind];
  if (usage[kind] + adding > limit) {
    return {
      ok: false,
      error: TRIAL_ERROR_MESSAGES[kind],
    };
  }

  return { ok: true };
}

export async function isTrialClass(classId: string): Promise<boolean> {
  if (!classId || typeof classId !== "string") return false;
  const res = await queryPg(
    `SELECT teacher_id FROM classes WHERE id = $1 LIMIT 1`,
    [classId]
  );
  const teacherId = res.rows[0]?.teacher_id;
  if (!teacherId) return false;
  return isTrialTeacher(teacherId);
}

export function trialLimitResponse(
  kind: TrialKind | "attempts" | "slots",
  error: string
): NextResponse {
  return NextResponse.json(
    {
      success: false,
      error,
      code: "TRIAL_LIMIT",
      limit: kind,
    },
    { status: 403 }
  );
}

export async function assertTrialAttemptAllowed(a: {
  studentId: string;
  classId: string;
  kind: "lesson" | "exam";
  itemId: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!(await isTrialClass(a.classId))) {
    return { ok: true };
  }

  let count = 0;
  if (a.kind === "lesson") {
    const res = await queryPg(
      `SELECT COUNT(*)::int AS n
       FROM lesson_attempts
       WHERE student_id = $1 AND class_id = $2 AND lesson_id = $3
         AND COALESCE(status, '') <> 'IN_PROGRESS'`,
      [a.studentId, a.classId, a.itemId]
    );
    count = Number(res.rows[0]?.n || 0);
  } else {
    const res = await queryPg(
      `SELECT COUNT(*)::int AS n
       FROM submissions
       WHERE student_id = $1 AND class_ref = $2 AND exam_id = $3
         AND COALESCE(status, '') <> 'IN_PROGRESS'`,
      [a.studentId, a.classId, a.itemId]
    );
    count = Number(res.rows[0]?.n || 0);
  }

  if (count >= TRIAL_LIMITS.attemptsPerItem) {
    return {
      ok: false,
      error:
        "Lớp học đang trong chế độ dùng thử: mỗi học sinh chỉ được nộp tối đa 1 lần cho mỗi bài học hoặc đề thi.",
    };
  }

  return { ok: true };
}
