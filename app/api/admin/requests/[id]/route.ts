import { NextResponse } from "next/server";
import { requireRole } from "@/lib/api-auth";
import { approveOrder, rejectOrder } from "@/lib/slot-orders";

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireRole(["ADMIN"]);
  if (auth.error) return auth.error;

  try {
    const body = await req.json().catch(() => ({}));
    if (!body || (body.action !== "APPROVE" && body.action !== "REJECT")) {
      return NextResponse.json(
        { success: false, error: "Hành động không hợp lệ (chỉ APPROVE hoặc REJECT)." },
        { status: 400 }
      );
    }

    const { id } = await params;
    if (!id?.trim()) {
      return NextResponse.json(
        { success: false, error: "Thiếu ID yêu cầu." },
        { status: 400 }
      );
    }

    const cleanId = id.trim();

    const result =
      body.action === "APPROVE"
        ? await approveOrder(cleanId, auth.user.userId)
        : await rejectOrder(cleanId, auth.user.userId, "Từ chối từ trang cũ");

    if (!result.ok) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: result.status }
      );
    }

    return NextResponse.json({
      success: true,
      slot_request: result.order,
    });
  } catch (err: any) {
    console.error("API /api/admin/requests/[id] PUT Error:", err);
    return NextResponse.json(
      { success: false, error: err.message || "Lỗi hệ thống khi duyệt yêu cầu mua slot." },
      { status: 500 }
    );
  }
}
