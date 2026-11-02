import { NextResponse } from "next/server";
import { requireRole } from "@/lib/api-auth";
import { queryPg } from "@/lib/db-pg";
import { getPaymentAccount, formatOrder } from "@/lib/slot-orders";
import { buildVietQrPayload } from "@/lib/vietqr";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireRole(["ADMIN", "TEACHER"]);
  if (auth.error) return auth.error;

  const { id } = await params;
  if (!id?.trim()) {
    return NextResponse.json(
      { success: false, error: "Thiếu mã đơn hàng." },
      { status: 404 }
    );
  }

  const res = await queryPg(`SELECT * FROM slot_requests WHERE id = $1 LIMIT 1`, [id.trim()]);
  if (res.rows.length === 0) {
    return NextResponse.json(
      { success: false, error: "Đơn hàng không tồn tại." },
      { status: 404 }
    );
  }

  const orderRow = res.rows[0];

  // Giáo viên chỉ xem được đơn của mình
  if (auth.user.role === "TEACHER" && orderRow.teacher_id !== auth.user.userId) {
    return NextResponse.json(
      { success: false, error: "Đơn hàng không tồn tại." },
      { status: 404 }
    );
  }

  const paymentAccount = await getPaymentAccount();
  let qrPayload: string | null = null;

  if (paymentAccount.configured && orderRow.status === "PENDING") {
    try {
      qrPayload = buildVietQrPayload({
        bankBin: paymentAccount.bank_bin,
        accountNo: paymentAccount.account_no,
        amount: Number(orderRow.total_cost),
        addInfo: orderRow.code,
      });
    } catch (qrErr) {
      console.error("Lỗi khi tạo VietQR payload:", qrErr);
      qrPayload = null;
    }
  }

  const payment = {
    configured: paymentAccount.configured,
    bank_bin: paymentAccount.bank_bin,
    bank_name: paymentAccount.bank_name,
    account_no: paymentAccount.account_no,
    account_name: paymentAccount.account_name,
    amount: Number(orderRow.total_cost),
    add_info: orderRow.code,
    qr_payload: qrPayload,
  };

  return NextResponse.json({
    success: true,
    order: formatOrder(orderRow),
    payment,
  });
}
