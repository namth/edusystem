import crypto from "crypto";
import { NextResponse } from "next/server";
import { queryPg, getPgPool } from "@/lib/db-pg";
import { requireRole } from "@/lib/api-auth";
import { syncStudentEnrolledInClass } from "@/lib/neo4j";
import { chargeEnrollment } from "@/lib/slot-wallet";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireRole(["ADMIN"]);
  if (auth.error) return auth.error;

  try {
    const { id } = await params;
    if (!id?.trim()) {
      return NextResponse.json(
        { success: false, error: "Thiếu ID người dùng." },
        { status: 400 }
      );
    }

    const cleanId = id.trim();

    const userRes = await queryPg(
      `SELECT id, name, email, role, phone, target_band, status, slot_limit, created_at
       FROM users
       WHERE id = $1;`,
      [cleanId]
    );

    if (userRes.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: "Người dùng không tồn tại." },
        { status: 404 }
      );
    }

    const u = userRes.rows[0];
    const user = {
      id: u.id,
      name: u.name,
      email: u.email,
      role: u.role,
      phone: u.phone,
      target_band: u.target_band,
      status: u.status,
      slot_limit:
        u.slot_limit !== null && u.slot_limit !== undefined
          ? Number(u.slot_limit)
          : 250,
      created_at: u.created_at,
    };

    const classRes = await queryPg(
      `SELECT c.id, c.name, c.code, c.teacher_id
       FROM classes c
       JOIN enrollments e ON e.class_id = c.id
       WHERE e.student_id = $1
       ORDER BY e.created_at DESC;`,
      [cleanId]
    );

    const subRes = await queryPg(
      `SELECT * FROM submissions WHERE student_id = $1 ORDER BY created_at DESC;`,
      [cleanId]
    );

    return NextResponse.json({
      user,
      classes: classRes.rows,
      submissions: subRes.rows,
    });
  } catch (err: any) {
    console.error("API /api/admin/users/[id] GET Error:", err);
    return NextResponse.json(
      { success: false, error: err.message || "Lỗi hệ thống khi tải thông tin người dùng." },
      { status: 500 }
    );
  }
}

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireRole(["ADMIN"]);
  if (auth.error) return auth.error;

  try {
    const { id } = await params;
    if (!id?.trim()) {
      return NextResponse.json(
        { success: false, error: "Thiếu ID người dùng." },
        { status: 400 }
      );
    }

    const cleanId = id.trim();

    const userRes = await queryPg(
      `SELECT id, name, email, role, phone, target_band, status, slot_limit, created_at
       FROM users
       WHERE id = $1;`,
      [cleanId]
    );

    if (userRes.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: "Người dùng không tồn tại." },
        { status: 404 }
      );
    }

    const currentUser = userRes.rows[0];
    const body = await req.json();

    if (body.name !== undefined) {
      if (typeof body.name !== "string" || body.name.trim() === "") {
        return NextResponse.json(
          { success: false, error: "Tên không được để trống." },
          { status: 400 }
        );
      }
    }

    if (body.status !== undefined) {
      if (!["ACTIVE", "INACTIVE", "SUSPENDED"].includes(body.status)) {
        return NextResponse.json(
          { success: false, error: "Trạng thái không hợp lệ." },
          { status: 400 }
        );
      }
    }

    let uniqueClassIds: string[] | undefined = undefined;
    if (body.class_ids !== undefined) {
      if (!Array.isArray(body.class_ids)) {
        return NextResponse.json(
          { success: false, error: "class_ids phải là mảng." },
          { status: 400 }
        );
      }

      if (currentUser.role !== "STUDENT") {
        return NextResponse.json(
          { success: false, error: "Chỉ được gán lớp cho người dùng vai trò STUDENT." },
          { status: 400 }
        );
      }

      uniqueClassIds = Array.from(new Set(body.class_ids));

      if (uniqueClassIds.length > 0) {
        const checkClasses = await queryPg(
          `SELECT id FROM classes WHERE id = ANY($1);`,
          [uniqueClassIds]
        );
        const foundSet = new Set(checkClasses.rows.map((r: any) => r.id));
        const allExist = uniqueClassIds.every((cid) => typeof cid === "string" && foundSet.has(cid));
        if (!allExist) {
          return NextResponse.json(
            { success: false, error: "Một hoặc nhiều mã lớp học không tồn tại." },
            { status: 400 }
          );
        }
      }
    }

    const updates: string[] = [];
    const updateParams: unknown[] = [];
    let pIdx = 1;

    if (body.name !== undefined) {
      updates.push(`name = $${pIdx++}`);
      updateParams.push(body.name.trim());
    }

    if (body.phone !== undefined) {
      updates.push(`phone = $${pIdx++}`);
      updateParams.push(typeof body.phone === "string" ? body.phone.trim() : null);
    }

    if (body.target_band !== undefined) {
      updates.push(`target_band = $${pIdx++}`);
      updateParams.push(typeof body.target_band === "string" ? body.target_band.trim() : null);
    }

    if (body.status !== undefined) {
      updates.push(`status = $${pIdx++}`);
      updateParams.push(body.status);
    }

    let newlyAddedClassIds: string[] = [];
    if (uniqueClassIds !== undefined) {
      const existingEnr = await queryPg(
        `SELECT class_id FROM enrollments WHERE student_id = $1;`,
        [cleanId]
      );
      const existingSet = new Set(existingEnr.rows.map((r: any) => r.class_id));
      newlyAddedClassIds = uniqueClassIds.filter((cid) => !existingSet.has(cid));
    }

    const pool = getPgPool();
    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      if (newlyAddedClassIds.length > 0) {
        for (const cid of newlyAddedClassIds) {
          const chargeRes = await chargeEnrollment(client, { classId: cid, studentId: cleanId });
          if (!chargeRes.ok) {
            await client.query("ROLLBACK");
            return NextResponse.json(
              { success: false, error: chargeRes.error },
              { status: chargeRes.status }
            );
          }
        }
      }

      if (updates.length > 0) {
        updateParams.push(cleanId);
        await client.query(
          `UPDATE users SET ${updates.join(", ")} WHERE id = $${pIdx};`,
          updateParams
        );
      }

      if (uniqueClassIds !== undefined) {
        await client.query(`DELETE FROM enrollments WHERE student_id = $1;`, [cleanId]);
        for (const classId of uniqueClassIds) {
          const enrId = "enr_" + crypto.randomUUID();
          await client.query(
            `INSERT INTO enrollments (id, student_id, class_id) VALUES ($1, $2, $3);`,
            [enrId, cleanId, classId]
          );
        }
      }

      await client.query("COMMIT");
    } catch (txErr) {
      await client.query("ROLLBACK");
      throw txErr;
    } finally {
      client.release();
    }

    if (newlyAddedClassIds.length > 0) {
      for (const cId of newlyAddedClassIds) {
        try {
          await syncStudentEnrolledInClass(cleanId, cId);
        } catch (graphErr) {
          console.warn("Neo4j Sync Warning:", graphErr);
        }
      }
    }

    const finalRes = await queryPg(
      `SELECT id, name, email, role, phone, target_band, status, slot_limit, created_at
       FROM users
       WHERE id = $1;`,
      [cleanId]
    );
    const finalUser = finalRes.rows[0];

    return NextResponse.json({
      success: true,
      user: {
        id: finalUser.id,
        name: finalUser.name,
        email: finalUser.email,
        role: finalUser.role,
        phone: finalUser.phone,
        target_band: finalUser.target_band,
        status: finalUser.status,
        slot_limit:
          finalUser.slot_limit !== null && finalUser.slot_limit !== undefined
            ? Number(finalUser.slot_limit)
            : 250,
        created_at: finalUser.created_at,
      },
    });
  } catch (err: any) {
    console.error("API /api/admin/users/[id] PUT Error:", err);
    return NextResponse.json(
      { success: false, error: err.message || "Lỗi hệ thống khi cập nhật người dùng." },
      { status: 500 }
    );
  }
}
