import { NextResponse } from "next/server";
import { requireRole } from "@/lib/api-auth";
import { queryPg } from "@/lib/db-pg";
import { ensureLeadsTable } from "@/lib/leads";

const ALLOWED_STATUSES = ["NEW", "CONTACTED", "DONE"];

export async function PATCH(
  req: Request,
  context: { params: Promise<{ id: string }> | { id: string } }
) {
  const auth = await requireRole(["ADMIN"]);
  if (auth.error) {
    return auth.error;
  }

  const { id } = await context.params;

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ success: false, error: "Dữ liệu không hợp lệ." }, { status: 400 });
  }

  const { status } = body || {};
  if (!status || !ALLOWED_STATUSES.includes(status)) {
    return NextResponse.json(
      { success: false, error: "Trạng thái không hợp lệ. Chỉ chấp nhận NEW, CONTACTED, DONE." },
      { status: 400 }
    );
  }

  await ensureLeadsTable();

  const res = await queryPg(
    `UPDATE leads
     SET status = $1
     WHERE id = $2
     RETURNING id, name, phone, email, role, message, status, source, ip, created_at`,
    [status, id]
  );

  if (res.rowCount === 0 || !res.rows[0]) {
    return NextResponse.json(
      { success: false, error: "Không tìm thấy khách hàng tiềm năng." },
      { status: 404 }
    );
  }

  return NextResponse.json({ success: true, lead: res.rows[0] });
}
