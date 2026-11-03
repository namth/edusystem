import { NextResponse } from "next/server";
import { queryPg } from "@/lib/db-pg";

const FALLBACK_SUBJECTS = [{ id: "english", name: "Tiếng Anh" }];

export async function GET(_req?: Request) {
  try {
    const res = await queryPg(
      `SELECT id, name FROM subjects WHERE owner_id IS NULL AND is_active = TRUE ORDER BY order_index ASC, name ASC;`
    );
    const subjects = (res.rows || []).map((r: any) => ({
      id: String(r.id),
      name: String(r.name),
    }));
    if (subjects.length === 0) {
      return NextResponse.json({ success: true, subjects: FALLBACK_SUBJECTS });
    }
    return NextResponse.json({ success: true, subjects });
  } catch {
    return NextResponse.json({ success: true, subjects: FALLBACK_SUBJECTS });
  }
}
