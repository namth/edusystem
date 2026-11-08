// app/api/teacher/slot-wallet/route.ts — API xem ví slot và lịch sử ledger của giáo viên (FEAT-015 §6)
import { NextResponse } from "next/server";
import { requireRole } from "@/lib/api-auth";
import { getTeacherWalletData } from "@/lib/class-billing";

export async function GET(req: Request) {
  const auth = await requireRole(["TEACHER"]);
  if (auth.error) return auth.error;

  const url = new URL(req.url);
  const cursor = url.searchParams.get("cursor");
  const classId = url.searchParams.get("class_id");

  const data = await getTeacherWalletData(auth.user.userId, cursor, classId);

  return NextResponse.json({
    success: true,
    ...data,
  });
}
