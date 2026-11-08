// app/api/admin/teachers/[id]/slot-wallet/route.ts — Admin xem ví slot và sổ cái của một giáo viên (FEAT-015 §6)
import { NextResponse } from "next/server";
import { requireRole } from "@/lib/api-auth";
import { queryPg } from "@/lib/db-pg";
import { getTeacherWalletData } from "@/lib/class-billing";

export async function GET(
  req: Request,
  props: { params: Promise<{ id: string }> }
) {
  const auth = await requireRole(["ADMIN"]);
  if (auth.error) return auth.error;

  const { id: teacherId } = await props.params;

  const userRes = await queryPg(
    "SELECT id, role FROM users WHERE id = $1 LIMIT 1",
    [teacherId]
  );
  if (userRes.rows.length === 0) {
    return NextResponse.json(
      { success: false, error: "Giáo viên không tồn tại." },
      { status: 404 }
    );
  }

  const url = new URL(req.url);
  const cursor = url.searchParams.get("cursor");
  const classId = url.searchParams.get("class_id");

  const data = await getTeacherWalletData(teacherId, cursor, classId);

  return NextResponse.json({
    success: true,
    ...data,
  });
}
