import { NextResponse } from "next/server";
import { requireRole } from "@/lib/api-auth";
import { queryPg } from "@/lib/db-pg";
import { fail, loadFinalizeState, resolveItem } from "@/lib/gradebook-data";

type Ctx = { params: Promise<{ classId: string; kind: string; itemId: string }> };

// POST /api/teacher/grading/classes/[classId]/items/[kind]/[itemId]/reopen — mở chốt.
export async function POST(_req: Request, context: Ctx) {
  const auth = await requireRole(["ADMIN", "TEACHER"]);
  if (auth.error) return auth.error;
  const { classId, kind: kindStr, itemId } = await context.params;

  try {
    const r = await resolveItem(auth.user, classId, kindStr, itemId);
    if (r.error) return r.error;

    const fin = await loadFinalizeState(r.cls.id, r.kind, itemId);
    if (!fin || !fin.finalized_at) {
      return fail(409, "Bài chưa được chốt.", { code: "NOT_FINALIZED" });
    }
    await queryPg("UPDATE class_grade_items SET finalized_at = NULL, reopened_at = NOW() WHERE id = $1", [fin.id]);
    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("POST reopen error:", err);
    return fail(500, err.message || "Lỗi mở chốt.");
  }
}
