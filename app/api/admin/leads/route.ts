import { NextResponse } from "next/server";
import { requireRole } from "@/lib/api-auth";
import { queryPg } from "@/lib/db-pg";
import { ensureLeadsTable } from "@/lib/leads";

export async function GET(_req?: Request) {
  const auth = await requireRole(["ADMIN"]);
  if (auth.error) {
    return auth.error;
  }

  await ensureLeadsTable();

  const res = await queryPg(
    `SELECT id, name, phone, email, role, message, status, source, ip, created_at
     FROM leads
     ORDER BY created_at DESC
     LIMIT 500`
  );

  return NextResponse.json({ success: true, leads: res.rows });
}
