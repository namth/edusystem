import { NextResponse } from "next/server";
import { clearAuthCookie } from "@/lib/auth";

export async function POST() {
  await clearAuthCookie();
  return NextResponse.json({ success: true, message: "Đã đăng xuất an toàn khỏi hệ thống." });
}
