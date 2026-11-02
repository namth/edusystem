import { NextResponse } from "next/server";
import { requireRole } from "@/lib/api-auth";
import { queryPg } from "@/lib/db-pg";

export async function GET(req: Request) {
  const auth = await requireRole(["ADMIN", "TEACHER"]);
  if (auth.error) return auth.error;

  const url = new URL(req.url);
  const status = url.searchParams.get("status");

  let sql: string;
  const params: any[] = [];

  if (auth.user.role === "TEACHER") {
    params.push(auth.user.userId);
    sql = `
      SELECT
        s.id,
        s.exam_id,
        e.title AS exam_title,
        s.student_id,
        u.name AS student_name,
        s.status,
        s.class_ref,
        s.section_scores,
        s.total_score,
        s.passed,
        s.is_late,
        s.submitted_at,
        s.created_at
      FROM submissions s
      LEFT JOIN exams e ON e.id = s.exam_id
      LEFT JOIN users u ON u.id = s.student_id
      LEFT JOIN classes c ON c.id = s.class_ref
      WHERE (e.created_by = $1 OR c.teacher_id = $1)
    `;
    if (status && status.trim() !== "") {
      params.push(status.trim());
      sql += ` AND s.status = $${params.length}`;
    }
  } else {
    sql = `
      SELECT
        s.id,
        s.exam_id,
        e.title AS exam_title,
        s.student_id,
        u.name AS student_name,
        s.status,
        s.class_ref,
        s.section_scores,
        s.total_score,
        s.passed,
        s.is_late,
        s.submitted_at,
        s.created_at
      FROM submissions s
      LEFT JOIN exams e ON e.id = s.exam_id
      LEFT JOIN users u ON u.id = s.student_id
      LEFT JOIN classes c ON c.id = s.class_ref
    `;
    if (status && status.trim() !== "") {
      params.push(status.trim());
      sql += ` WHERE s.status = $1`;
    }
  }

  sql += ` ORDER BY s.created_at DESC;`;

  const res = await queryPg(sql, params);

  const submissions = res.rows.map((row) => {
    let sectionScores = row.section_scores;
    if (typeof sectionScores === "string") {
      try {
        sectionScores = JSON.parse(sectionScores);
      } catch {
        sectionScores = {};
      }
    }

    return {
      id: row.id,
      exam_id: row.exam_id,
      exam_title: row.exam_title || null,
      student_id: row.student_id,
      student_name: row.student_name || null,
      status: row.status,
      class_ref: row.class_ref || null,
      section_scores: sectionScores || {},
      total_score:
        row.total_score !== null && row.total_score !== undefined
          ? Number(row.total_score)
          : null,
      passed:
        row.passed === null || row.passed === undefined
          ? null
          : Boolean(row.passed),
      is_late: Boolean(row.is_late),
      submitted_at: row.submitted_at || null,
      created_at: row.created_at,
    };
  });

  return NextResponse.json({
    success: true,
    submissions,
  });
}
