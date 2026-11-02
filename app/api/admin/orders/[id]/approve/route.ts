import { NextResponse } from "next/server";
import { requireRole } from "@/lib/api-auth";
import { approveOrder } from "@/lib/slot-orders";

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
  const paymentRef = typeof body?.payment_ref === "string" ? body.payment_ref.trim() : undefined;

  const result = await approveOrder(id.trim(), auth.user.userId, paymentRef);
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
