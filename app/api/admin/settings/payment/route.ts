import { NextResponse } from "next/server";
import { requireRole } from "@/lib/api-auth";
import { queryPg } from "@/lib/db-pg";
import { getPaymentAccount, getSlotPricing } from "@/lib/slot-orders";
import { sanitizeTransferContent } from "@/lib/vietqr";

export async function GET(req: Request) {
  const auth = await requireRole(["ADMIN"]);
  if (auth.error) return auth.error;

  const paymentAccount = await getPaymentAccount();
  const slotPricing = await getSlotPricing();

  return NextResponse.json({
    success: true,
    payment_account: {
      bank_bin: paymentAccount.bank_bin,
      bank_name: paymentAccount.bank_name,
      account_no: paymentAccount.account_no,
      account_name: paymentAccount.account_name,
    },
    slot_pricing: slotPricing,
  });
}

export async function PUT(req: Request) {
  const auth = await requireRole(["ADMIN"]);
  if (auth.error) return auth.error;

  const body = await req.json().catch(() => ({}));
  const { payment_account, slot_pricing } = body;

  let sanitizedPaymentAccount: {
    bank_bin: string;
    bank_name: string;
    account_no: string;
    account_name: string;
  } | null = null;

  if (payment_account !== undefined) {
    if (typeof payment_account !== "object" || payment_account === null) {
      return NextResponse.json(
        { success: false, error: "Thông tin tài khoản nhận tiền không hợp lệ." },
        { status: 400 }
      );
    }

    const { bank_bin, bank_name, account_no, account_name } = payment_account;

    if (typeof bank_bin !== "string" || !/^\d{6}$/.test(bank_bin)) {
      return NextResponse.json(
        { success: false, error: "Mã BIN ngân hàng phải gồm đúng 6 chữ số." },
        { status: 400 }
      );
    }

    if (typeof account_no !== "string" || !/^\d{6,19}$/.test(account_no)) {
      return NextResponse.json(
        { success: false, error: "Số tài khoản phải gồm từ 6 đến 19 chữ số." },
        { status: 400 }
      );
    }

    const normalizedName = sanitizeTransferContent(String(account_name || ""), 0);
    if (!normalizedName || normalizedName.length > 50) {
      return NextResponse.json(
        { success: false, error: "Tên chủ tài khoản không được để trống và tối đa 50 ký tự." },
        { status: 400 }
      );
    }

    sanitizedPaymentAccount = {
      bank_bin,
      bank_name: typeof bank_name === "string" ? bank_name.trim() : "",
      account_no,
      account_name: normalizedName,
    };
  }

  let validatedSlotPricing: { unit_price_vnd: number } | null = null;

  if (slot_pricing !== undefined) {
    if (typeof slot_pricing !== "object" || slot_pricing === null) {
      return NextResponse.json(
        { success: false, error: "Thông tin đơn giá slot không hợp lệ." },
        { status: 400 }
      );
    }

    const { unit_price_vnd } = slot_pricing;
    if (
      typeof unit_price_vnd !== "number" ||
      !Number.isInteger(unit_price_vnd) ||
      unit_price_vnd < 0 ||
      unit_price_vnd > 100000000
    ) {
      return NextResponse.json(
        { success: false, error: "Đơn giá 1 slot phải là số nguyên trong khoảng 0 - 100.000.000 VND." },
        { status: 400 }
      );
    }

    validatedSlotPricing = { unit_price_vnd };
  }

  if (sanitizedPaymentAccount) {
    await queryPg(
      `INSERT INTO system_settings (key, value, description, updated_at)
       VALUES ('payment_account', $1::jsonb, 'Tài khoản nhận tiền VietQR', NOW())
       ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW();`,
      [JSON.stringify(sanitizedPaymentAccount)]
    );
  }

  if (validatedSlotPricing) {
    await queryPg(
      `INSERT INTO system_settings (key, value, description, updated_at)
       VALUES ('slot_pricing', $1::jsonb, 'Đơn giá 1 slot học sinh (VND)', NOW())
       ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW();`,
      [JSON.stringify(validatedSlotPricing)]
    );
  }

  return NextResponse.json({ success: true });
}
