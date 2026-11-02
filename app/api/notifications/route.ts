import { NextResponse } from "next/server";
import { requireRole } from "@/lib/api-auth";
import { listNotifications } from "@/lib/notifications";

export async function GET(req: Request) {
  const auth = await requireRole();
  if (auth.error) return auth.error;

  const { searchParams } = new URL(req.url);
  const limitParam = searchParams.get("limit");
  const limit = limitParam !== null ? parseInt(limitParam, 10) : 20;

  const data = await listNotifications(auth.user.userId, limit);
  return NextResponse.json({
    success: true,
    items: data.items,
    unread: data.unread,
  });
}
