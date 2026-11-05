import { NextResponse } from "next/server";
import { requireRole } from "@/lib/api-auth";
import { fail, finalizeItem, resolveItem } from "@/lib/gradebook-data";

type Ctx = { params: Promise<{ classId: string; kind: string; itemId: string }> };

// POST /api/teacher/grading/classes/[classId]/items/[kind]/[itemId]/finalize — chốt bảng điểm bài.
export async function POST(req: Request, context: Ctx) {
  const auth = await requireRole(["ADMIN", "TEACHER"]);
  if (auth.error) return auth.error;
  const { classId, kind: kindStr, itemId } = await context.params;

  try {
    const r = await resolveItem(auth.user, classId, kindStr, itemId);
    if (r.error) return r.error;

    let body: any = {};
    try {
      body = await req.json();
    } catch {
      body = {};
    }
    const confirm = !!body && body.confirmUnreviewed === true;

    const out = await finalizeItem(r.cls, r.kind, itemId, auth.user.userId, confirm);
    return NextResponse.json(out.body, { status: out.status });
  } catch (err: any) {
    console.error("POST finalize error:", err);
    return fail(500, err.message || "Lỗi chốt bảng điểm.");
  }
}
