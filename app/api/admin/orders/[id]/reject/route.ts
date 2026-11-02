import { NextResponse } from "next/server";
import { requireRole } from "@/lib/api-auth";
import { rejectOrder } from "@/lib/slot-orders";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireRole(["ADMIN"]);
  if (auth.error) return auth.error;

  const { id } = await params;
  if (!id?.trim()) {
    return NextResponse.json(
      { success: false, error: "Thiếu mã đơn hàng." },
      { status: 400 }
    );
  }

  const body = await req.json().catch(() => ({}));
  if (!body || typeof body.reason !== "string" || !body.reason.trim()) {
    return NextResponse.json(
      { success: false, error: "Lý do từ chối không được để trống." },
      { status: 400 }
    );
  }

  const result = await rejectOrder(id.trim(), auth.user.userId, body.reason);
  if (!result.ok) {
    return NextResponse.json(
      { success: false, error: result.error },
      { status: result.status }
    );
  }

  return NextResponse.json({
    success: true,
    order: result.order,
  });
}
