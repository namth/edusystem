import { NextResponse } from "next/server";
import { requireRole } from "@/lib/api-auth";
import { cancelOrder } from "@/lib/slot-orders";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireRole(["ADMIN", "TEACHER"]);
  if (auth.error) return auth.error;

  const { id } = await params;
  if (!id?.trim()) {
    return NextResponse.json(
      { success: false, error: "Thiếu mã đơn hàng." },
      { status: 400 }
    );
  }

  const result = await cancelOrder(id.trim(), {
    userId: auth.user.userId,
    role: auth.user.role,
  });

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
