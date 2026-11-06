import { NextResponse } from "next/server";
import { requireRole } from "@/lib/api-auth";
import { fail, kindParam, loadItemData, parseJson, resolveItem, toApiRow } from "@/lib/gradebook-data";
import { queryPg } from "@/lib/db-pg";

type Ctx = { params: Promise<{ classId: string; kind: string; itemId: string }> };

// GET /api/teacher/grading/classes/[classId]/items/[kind]/[itemId] — bảng điểm một bài.
export async function GET(_req: Request, context: Ctx) {
  const auth = await requireRole(["ADMIN", "TEACHER"]);
  if (auth.error) return auth.error;
  const { classId, kind: kindStr, itemId } = await context.params;

  try {
    const r = await resolveItem(auth.user, classId, kindStr, itemId);
    if (r.error) return r.error;
    const { cls, kind, item } = r;

    const data = await loadItemData(cls, kind, itemId);
    let columns: any;
    if (kind === "EXAM") {
      let snapshot: any = null;
      for (const rec of data.recs) {
        snapshot = parseJson(rec.row.standard_snapshot);
        if (snapshot) break;
      }
      if (!snapshot) {
        const ex = await queryPg(
          `SELECT s.sections FROM exams e JOIN scoring_standards s ON s.id = e.scoring_standard_id WHERE e.id = $1 LIMIT 1`,
          [itemId]
        );
        if (ex.rows[0]) snapshot = { sections: parseJson(ex.rows[0].sections) };
      }
      const sections = Array.isArray(snapshot?.sections) ? snapshot.sections : [];
      columns = {
        kind: "exam",
        sections: sections.map((s: any) => ({ skill: s.skill, min: s.min, max: s.max, step: s.step })),
      };
    } else {
      columns = { kind: "lesson", fields: ["objective_percent", "ai_percent", "total_percent"] };
    }

    return NextResponse.json({
      item: {
        kind: kindParam(kind),
        id: item.id,
        title: item.title,
        source: item.source,
        class: { id: cls.id, name: cls.name },
      },
      columns,
      finalized_at: data.finalizedAt,
      rows: data.rows.map((row) => toApiRow(row, data.finalizedAt)),
    });
  } catch (err: any) {
    console.error("GET items/[kind]/[itemId] error:", err);
    return fail(500, err.message || "Lỗi tải bảng điểm bài.");
  }
}
