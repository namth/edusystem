import crypto from "crypto";
import { NextResponse } from "next/server";
import { runBillingCycle } from "@/lib/slot-wallet";

function timingSafeEqualStr(a: string, b: string): boolean {
  if (!a || !b) return false;
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get("authorization") || req.headers.get("Authorization") || "";
    const prefix = "bearer ";
    if (!authHeader.toLowerCase().startsWith(prefix)) {
      return NextResponse.json({ success: false, error: "Thiếu Bearer token xác thực." }, { status: 401 });
    }

    const token = authHeader.slice(prefix.length).trim();
    const cronSecret = process.env.CRON_SECRET || "";

    if (!cronSecret || !timingSafeEqualStr(token, cronSecret)) {
      return NextResponse.json({ success: false, error: "Mã bí mật CRON_SECRET không hợp lệ." }, { status: 401 });
    }

    const result = await runBillingCycle();
    return NextResponse.json(result, { status: 200 });
  } catch (err: any) {
    console.error("POST /api/cron/slot-billing error:", err);
    return NextResponse.json(
      { success: false, error: err.message || "Lỗi khi chạy kỳ tính phí slot." },
      { status: 500 }
    );
  }
}
