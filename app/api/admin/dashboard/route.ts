import { NextResponse } from "next/server";
import { requireRole } from "@/lib/api-auth";
import { getAdminDashboardData } from "@/lib/admin-dashboard";

export async function GET(req: Request) {
  const auth = await requireRole(["ADMIN"]);
  if (auth.error) {
    return auth.error;
  }

  const { searchParams } = new URL(req.url);
  const rawMonth = searchParams.get("month");

  if (rawMonth !== null && rawMonth !== undefined && rawMonth !== "") {
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(rawMonth)) {
      return NextResponse.json(
        { success: false, error: "Định dạng tháng không hợp lệ (YYYY-MM)." },
        { status: 400 }
      );
    }
  }

  try {
    const data = await getAdminDashboardData(rawMonth);
    return NextResponse.json(data);
  } catch (error) {
    console.error("Dashboard error:", error);
    return NextResponse.json(
      { success: false, error: "Lỗi tải dữ liệu tổng quan admin." },
      { status: 500 }
    );
  }
}
