import { NextResponse } from "next/server";
import { requireRole } from "@/lib/api-auth";
import {
  assertClassAccess,
  fail,
  kindParam,
  loadAttempts,
  loadClassItems,
  loadStudents,
  type AttemptRec,
} from "@/lib/gradebook-data";
import { isPendingReview } from "@/lib/gradebook";
import { queryPg } from "@/lib/db-pg";

// GET /api/teacher/grading/classes/[classId] — hub lớp: các bài + số liệu chấm.
export async function GET(_req: Request, context: { params: Promise<{ classId: string }> }) {
  const auth = await requireRole(["ADMIN", "TEACHER"]);
  if (auth.error) return auth.error;
  const { classId } = await context.params;

  try {
    const access = await assertClassAccess(auth.user, classId);
    if (access.error) return access.error;
    const cls = access.cls;

    const [items, students] = await Promise.all([loadClassItems(cls), loadStudents(cls.id)]);
    const enrolled = new Set(students.map((s) => s.id));
    const lessonIds = items.filter((i) => i.kind === "LESSON").map((i) => i.id);
    const examIds = items.filter((i) => i.kind === "EXAM").map((i) => i.id);
    const [lessonRecs, examRecs] = await Promise.all([
      loadAttempts(cls.id, "LESSON", lessonIds),
      loadAttempts(cls.id, "EXAM", examIds),
    ]);
    const finRes = await queryPg(
      "SELECT item_kind, item_id, finalized_at FROM class_grade_items WHERE class_id = $1",
      [cls.id]
    );
    const finMap = new Map<string, any>();
    for (const r of finRes.rows) finMap.set(`${r.item_kind}:${r.item_id}`, r.finalized_at);

    const byItem = new Map<string, AttemptRec[]>();
    for (const r of [...lessonRecs, ...examRecs]) {
      if (!enrolled.has(r.student_id)) continue;
      const k = `${r.kind}:${r.item_id}`;
      const list = byItem.get(k) || [];
      list.push(r);
      byItem.set(k, list);
    }

    return NextResponse.json({
      class: { id: cls.id, name: cls.name },
      items: items.map((it) => {
        const k = `${it.kind}:${it.id}`;
        const recs = byItem.get(k) || [];
        return {
          kind: kindParam(it.kind),
          id: it.id,
          title: it.title,
          source: it.source,
          has_ai: recs.some((r) => r.lite.has_ai),
          submitted: new Set(recs.map((r) => r.student_id)).size,
          student_count: students.length,
          pending_review: recs.filter((r) => isPendingReview(r.lite)).length,
          needs_review: recs.filter((r) => r.lite.status === "NEEDS_REVIEW").length,
          grading: recs.filter((r) => r.lite.status === "GRADING").length,
          finalized_at: finMap.get(k) ?? null,
        };
      }),
    });
  } catch (err: any) {
    console.error("GET /api/teacher/grading/classes/[classId] error:", err);
    return fail(500, err.message || "Lỗi tải hub lớp.");
  }
}
