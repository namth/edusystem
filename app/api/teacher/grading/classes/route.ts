import { NextResponse } from "next/server";
import { requireRole } from "@/lib/api-auth";
import { queryPg } from "@/lib/db-pg";
import { fail, parseJson, ensureGradebookSchema } from "@/lib/gradebook-data";

// GET /api/teacher/grading/classes — các lớp của giáo viên (ADMIN: mọi lớp) kèm số liệu chấm.
export async function GET() {
  const auth = await requireRole(["ADMIN", "TEACHER"]);
  if (auth.error) return auth.error;
  const user = auth.user;

  try {
    await ensureGradebookSchema();
    const clsRes =
      user.role === "ADMIN"
        ? await queryPg("SELECT id, name FROM classes ORDER BY created_at ASC, id ASC")
        : await queryPg("SELECT id, name FROM classes WHERE teacher_id = $1 ORDER BY created_at ASC, id ASC", [
            user.userId,
          ]);
    const ids: string[] = clsRes.rows.map((c: any) => c.id);

    const counts: Record<string, { student_count: number; pending_review: number; needs_review: number }> = {};
    for (const id of ids) counts[id] = { student_count: 0, pending_review: 0, needs_review: 0 };

    if (ids.length > 0) {
      const en = await queryPg(
        "SELECT class_id, COUNT(DISTINCT student_id)::int AS n FROM enrollments WHERE class_id = ANY($1::text[]) GROUP BY class_id",
        [ids]
      );
      for (const r of en.rows) counts[r.class_id].student_count = Number(r.n);

      let subsRows: any[] = [];
      try {
        const subs = await queryPg(
          `SELECT class_ref AS class_id, status, results, reviewed_at FROM submissions
           WHERE class_ref = ANY($1::text[]) AND status IN ('GRADED', 'NEEDS_REVIEW')`,
          [ids]
        );
        subsRows = subs.rows;
      } catch {
        subsRows = [];
      }

      let lesRows: any[] = [];
      try {
        const les = await queryPg(
          `SELECT class_id, status, results, reviewed_at FROM lesson_attempts
           WHERE class_id = ANY($1::text[]) AND status IN ('GRADED', 'NEEDS_REVIEW')`,
          [ids]
        );
        lesRows = les.rows;
      } catch {
        lesRows = [];
      }

      for (const r of [...subsRows, ...lesRows]) {
        const c = counts[r.class_id];
        if (!c) continue;
        if (r.status === "NEEDS_REVIEW") {
          c.needs_review++;
        } else {
          const results = parseJson(r.results);
          const ai = Array.isArray(results) && results.some((x: any) => x && x.kind === "AI");
          if (ai && !r.reviewed_at) c.pending_review++;
        }
      }
    }

    return NextResponse.json({
      classes: clsRes.rows.map((c: any) => ({ id: c.id, name: c.name, ...counts[c.id] })),
    });
  } catch (err: any) {
    console.error("GET /api/teacher/grading/classes error:", err);
    return fail(500, err.message || "Lỗi tải danh sách lớp.");
  }
}
