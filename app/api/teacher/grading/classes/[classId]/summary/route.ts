import { NextResponse } from "next/server";
import { requireRole } from "@/lib/api-auth";
import { queryPg } from "@/lib/db-pg";
import {
  assertClassAccess,
  fail,
  kindParam,
  loadClassItems,
  loadGrades,
  loadStudents,
} from "@/lib/gradebook-data";
import { average10 } from "@/lib/gradebook";

function labelOf(g: any): string {
  if (!g || g.score10 === null || g.score10 === undefined) return "Chưa nộp";
  const raw = g.raw_score === null || g.raw_score === undefined ? null : Number(g.raw_score);
  const max = g.raw_max === null || g.raw_max === undefined ? null : Number(g.raw_max);
  if (raw === null) return "Chưa nộp";
  if (max === 100) return `${raw}%`;
  return max === null ? String(raw) : `${raw}/${max}`;
}

// GET /api/teacher/grading/classes/[classId]/summary — học sinh × các bài đã chốt (ảnh chụp).
export async function GET(_req: Request, context: { params: Promise<{ classId: string }> }) {
  const auth = await requireRole(["ADMIN", "TEACHER"]);
  if (auth.error) return auth.error;
  const { classId } = await context.params;

  try {
    const access = await assertClassAccess(auth.user, classId);
    if (access.error) return access.error;
    const cls = access.cls;

    const [allItems, students, finRes] = await Promise.all([
      loadClassItems(cls),
      loadStudents(cls.id),
      queryPg(
        "SELECT item_kind, item_id, finalized_at FROM class_grade_items WHERE class_id = $1 AND finalized_at IS NOT NULL",
        [cls.id]
      ),
    ]);
    const finMap = new Map<string, any>();
    for (const r of finRes.rows) finMap.set(`${r.item_kind}:${r.item_id}`, r.finalized_at);
    const items = allItems.filter((i) => finMap.has(`${i.kind}:${i.id}`));

    const gradeMap = new Map<string, any>();
    for (const kind of ["LESSON", "EXAM"] as const) {
      const ids = items.filter((i) => i.kind === kind).map((i) => i.id);
      for (const g of await loadGrades(cls.id, kind, ids)) {
        gradeMap.set(`${g.item_kind}:${g.item_id}:${g.student_id}`, g);
      }
    }

    const itemScores: Record<string, (number | null)[]> = {};
    const outStudents = students.map((s) => {
      const cells: Record<string, any> = {};
      const scores: (number | null)[] = [];
      for (const it of items) {
        const key = `${kindParam(it.kind)}:${it.id}`;
        const g = gradeMap.get(`${it.kind}:${it.id}:${s.id}`);
        const score10 = g && g.score10 !== null && g.score10 !== undefined ? Number(g.score10) : null;
        cells[key] = {
          raw_score: g && g.raw_score !== null && g.raw_score !== undefined ? Number(g.raw_score) : null,
          raw_max: g && g.raw_max !== null && g.raw_max !== undefined ? Number(g.raw_max) : null,
          score10,
          label: labelOf(g),
        };
        scores.push(score10);
        (itemScores[key] ||= []).push(score10);
      }
      return { id: s.id, name: s.name, cells, average10: average10(scores) };
    });

    const itemAverages: Record<string, number | null> = {};
    for (const it of items) {
      const key = `${kindParam(it.kind)}:${it.id}`;
      itemAverages[key] = average10(itemScores[key] || []);
    }

    return NextResponse.json({
      items: items.map((i) => ({
        kind: kindParam(i.kind),
        id: i.id,
        title: i.title,
        finalized_at: finMap.get(`${i.kind}:${i.id}`),
      })),
      students: outStudents,
      item_averages: itemAverages,
    });
  } catch (err: any) {
    console.error("GET /api/teacher/grading/classes/[classId]/summary error:", err);
    return fail(500, err.message || "Lỗi tải bảng tổng kết.");
  }
}
