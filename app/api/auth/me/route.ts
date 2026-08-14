import { NextResponse } from "next/server";
import { queryPg } from "@/lib/db-pg";
import { getAuthenticatedUserFromCookie } from "@/lib/auth";

export async function GET() {
  try {
    const authPayload = await getAuthenticatedUserFromCookie();

    if (!authPayload?.userId) {
      return NextResponse.json({ success: false, user: null }, { status: 401 });
    }

    // Query user profile directly from PostgreSQL
    const result = await queryPg(`SELECT * FROM users WHERE id = $1 LIMIT 1;`, [authPayload.userId]);

    if (result.rows.length === 0) {
      return NextResponse.json({ success: false, user: null }, { status: 404 });
    }

    const row = result.rows[0];
    const user = {
      id: row.id,
      name: row.name,
      email: row.email,
      username: row.id,
      role: row.role || "STUDENT",
      phone: row.phone || "",
      targetBand: row.target_band || "IELTS 6.5",
      assignedClasses: row.role === "TEACHER" ? ["cls_101", "cls_102"] : ["cls_101"],
      mustChangePassword: row.must_change_password === true,
    };

    return NextResponse.json({ success: true, user });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
