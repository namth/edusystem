import { NextResponse } from "next/server";
import { queryPg, getPgPool } from "@/lib/db-pg";
import { requireRole } from "@/lib/api-auth";

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireRole(["ADMIN"]);
  if (auth.error) return auth.error;

  try {
    const body = await req.json();
    if (!body || (body.action !== "APPROVE" && body.action !== "REJECT")) {
      return NextResponse.json(
        { success: false, error: "Hành động không hợp lệ (chỉ APPROVE hoặc REJECT)." },
        { status: 400 }
      );
    }

    const { id } = await params;
    if (!id?.trim()) {
      return NextResponse.json(
        { success: false, error: "Thiếu ID yêu cầu." },
        { status: 400 }
      );
    }

    const cleanId = id.trim();

    const existingRes = await queryPg(
      `SELECT * FROM slot_requests WHERE id = $1;`,
      [cleanId]
    );

    if (existingRes.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: "Đơn yêu cầu không tồn tại." },
        { status: 404 }
      );
    }

    const currentReq = existingRes.rows[0];
    if (currentReq.status !== "PENDING") {
      return NextResponse.json(
        { success: false, error: "Đơn yêu cầu đã được xử lý trước đó." },
        { status: 409 }
      );
    }

    if (body.action === "APPROVE") {
      const pool = getPgPool();
      const client = await pool.connect();
      try {
        await client.query("BEGIN");

        const updateRes = await client.query(
          `UPDATE slot_requests SET status = 'APPROVED' WHERE id = $1 AND status = 'PENDING' RETURNING *;`,
          [cleanId]
        );

        if (updateRes.rowCount === 0) {
          await client.query("ROLLBACK");
          return NextResponse.json(
            { success: false, error: "Đơn yêu cầu đã được xử lý trước đó." },
            { status: 409 }
          );
        }

        const updated = updateRes.rows[0];
        await client.query(
          `UPDATE users SET slot_limit = COALESCE(slot_limit, 0) + $1 WHERE id = $2;`,
          [Number(updated.requested_slots), updated.teacher_id]
        );

        await client.query("COMMIT");

        return NextResponse.json({
          success: true,
          slot_request: {
            ...updated,
            requested_slots: Number(updated.requested_slots),
            total_cost: Number(updated.total_cost),
          },
        });
      } catch (txErr) {
        await client.query("ROLLBACK");
        throw txErr;
      } finally {
        client.release();
      }
    } else {
      // REJECT
      const updateRes = await queryPg(
        `UPDATE slot_requests SET status = 'REJECTED' WHERE id = $1 AND status = 'PENDING' RETURNING *;`,
        [cleanId]
      );

      if (updateRes.rowCount === 0) {
        return NextResponse.json(
          { success: false, error: "Đơn yêu cầu đã được xử lý trước đó." },
          { status: 409 }
        );
      }

      const updated = updateRes.rows[0];
      return NextResponse.json({
        success: true,
        slot_request: {
          ...updated,
          requested_slots: Number(updated.requested_slots),
          total_cost: Number(updated.total_cost),
        },
      });
    }
  } catch (err: any) {
    console.error("API /api/admin/requests/[id] PUT Error:", err);
    return NextResponse.json(
      { success: false, error: err.message || "Lỗi hệ thống khi duyệt yêu cầu mua slot." },
      { status: 500 }
    );
  }
}
