import { NextResponse } from "next/server";
import { requireRole } from "@/lib/api-auth";
import { queryPg } from "@/lib/db-pg";
import { average10 } from "@/lib/gradebook";
import { fail, kindParam, loadClassItems } from "@/lib/gradebook-data";

type Ctx = { params: Promise<{ classId: string }> };

// GET /api/student/classes/[classId]/gradebook — bảng điểm chính thức của chính học sinh (bài đã chốt).
export async function GET(_req: Request, context: Ctx) {
  const auth = await requireRole(["STUDENT"]);
  if (auth.error) return auth.error;
  const studentId = auth.user.userId; // không nhận studentId từ query/body
  const { classId } = await context.params;

  try {
    const clsRes = await queryPg("SELECT id, name, teacher_id, course_id FROM classes WHERE id = $1 LIMIT 1", [
      classId,
    ]);
    if (!clsRes.rows[0]) return fail(404, "Lớp học không tồn tại.");

    const en = await queryPg("SELECT 1 FROM enrollments WHERE class_id = $1 AND student_id = $2 LIMIT 1", [
      classId,
      studentId,
    ]);
    if (en.rows.length === 0) return fail(403, "Bạn chưa ghi danh lớp này.");

    const fin = await queryPg(
      "SELECT item_kind, item_id, finalized_at FROM class_grade_items WHERE class_id = $1 AND finalized_at IS NOT NULL",
      [classId]
    );
    const finMap = new Map<string, any>();
    for (const r of fin.rows) finMap.set(`${r.item_kind}:${r.item_id}`, r.finalized_at);

    const grades = await queryPg("SELECT * FROM class_grades WHERE class_id = $1 AND student_id = $2", [
      classId,
      studentId,
    ]);
    const gradeMap = new Map<string, any>();
    for (const g of grades.rows) gradeMap.set(`${g.item_kind}:${g.item_id}`, g);

    const classItems = await loadClassItems(clsRes.rows[0]);
    const n = (v: any) => (v === null || v === undefined ? null : Number(v));
    // Bỏ phần mili giây để mốc chốt gọn; vẫn là ISO 8601 hợp lệ.
    const iso = (v: any) => new Date(v).toISOString().replace(/\.\d{3}Z$/, "Z");

    const items = classItems
      .filter((i) => finMap.has(`${i.kind}:${i.id}`))
      .map((i) => {
        const g = gradeMap.get(`${i.kind}:${i.id}`);
        return {
          kind: kindParam(i.kind),
          id: i.id,
          title: i.title,
          raw_score: g ? n(g.raw_score) : null,
          raw_max: g ? n(g.raw_max) : null,
          score10: g ? n(g.score10) : null,
          passed: g && typeof g.passed === "boolean" ? g.passed : null,
          note: g?.note ?? null,
          finalized_at: iso(finMap.get(`${i.kind}:${i.id}`)),
        };
      });

    return NextResponse.json({ items, average10: average10(items.map((i) => i.score10)) });
  } catch (err: any) {
    console.error("GET /api/student/classes/[classId]/gradebook error:", err);
    return fail(500, err.message || "Lỗi tải bảng điểm.");
  }
}
