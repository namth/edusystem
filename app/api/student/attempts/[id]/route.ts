import { NextResponse } from "next/server";
import { requireRole } from "@/lib/api-auth";
import { queryPg } from "@/lib/db-pg";

export async function GET(
  req: Request,
  props: { params: Promise<{ id: string }> }
) {
  const auth = await requireRole(["STUDENT"]);
  if (auth.error) return auth.error;
  const user = auth.user;

  const { id } = await props.params;

  const res = await queryPg("SELECT * FROM lesson_attempts WHERE id = $1", [id]);
  if (res.rows.length === 0) {
    return NextResponse.json(
      { success: false, error: "Không tìm thấy lần làm bài." },
      { status: 404 }
    );
  }

  const row = res.rows[0];
  if (row.student_id !== user.userId) {
    return NextResponse.json(
      { success: false, error: "Bạn không có quyền xem lần làm bài này." },
      { status: 403 }
    );
  }

  const attempt = {
    ...row,
    answers: typeof row.answers === "string" ? JSON.parse(row.answers) : row.answers,
    results: typeof row.results === "string" ? JSON.parse(row.results) : row.results,
    objective_earned: Number(row.objective_earned),
    objective_max: Number(row.objective_max),
    ai_max: Number(row.ai_max),
    ai_earned: row.ai_earned != null ? Number(row.ai_earned) : null,
    score_percent: row.score_percent != null ? Number(row.score_percent) : null,
  };

  return NextResponse.json({ success: true, attempt });
}
