// app/api/admin/teachers/[id]/slot-adjust/route.ts — Admin cộng/trừ tay số dư ví slot giáo viên (FEAT-015 §6, BR-W03, BR-W07, TC-W12)
import { NextResponse } from "next/server";
import { requireRole } from "@/lib/api-auth";
import { queryPg } from "@/lib/db-pg";
import { adjustBalance } from "@/lib/slot-wallet";

export async function POST(
  req: Request,
  props: { params: Promise<{ id: string }> }
) {
  const auth = await requireRole(["ADMIN"]);
  if (auth.error) return auth.error;

  const { id: teacherId } = await props.params;

  const userRes = await queryPg(
    "SELECT id FROM users WHERE id = $1 LIMIT 1",
    [teacherId]
  );
  if (userRes.rows.length === 0) {
    return NextResponse.json(
      { success: false, error: "Giáo viên không tồn tại." },
      { status: 404 }
    );
  }

  const body = await req.json().catch(() => ({}));
  const { delta, note } = body || {};

  const result = await adjustBalance({
    teacherId,
    delta,
    note,
    createdBy: auth.user.userId,
  });

  if (!result.ok) {
    return NextResponse.json(
      { success: false, error: result.error },
      { status: result.status }
    );
  }

  return NextResponse.json(
    { success: true, balance: result.balance },
    { status: 200 }
  );
}
