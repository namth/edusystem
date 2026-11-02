import { NextResponse } from "next/server";
import crypto from "crypto";
import { requireRole } from "@/lib/api-auth";
import { queryPg } from "@/lib/db-pg";
import { syncTeacherManagesClass } from "@/lib/neo4j";
import { assertTrialAllows, isTrialTeacher, trialLimitResponse } from "@/lib/teacher-trial";

export async function GET(_req?: Request) {
  const auth = await requireRole(["ADMIN", "TEACHER"]);
  if (auth.error) return auth.error;
  const user = auth.user;

  try {
    let sql = `
      SELECT 
        c.*,
        (SELECT COUNT(*)::int FROM enrollments e WHERE e.class_id = c.id) AS student_count
      FROM classes c
      ORDER BY c.created_at DESC
    `;
    let params: unknown[] = [];

    if (user.role === "TEACHER") {
      sql = `
        SELECT 
          c.*,
          (SELECT COUNT(*)::int FROM enrollments e WHERE e.class_id = c.id) AS student_count
        FROM classes c
        WHERE c.teacher_id = $1
        ORDER BY c.created_at DESC
      `;
      params = [user.userId];
    }

    const res = await queryPg(sql, params);
    const classes = res.rows.map((row: any) => ({
      id: row.id,
      name: row.name,
      code: row.code,
      teacher_id: row.teacher_id,
      schedule: row.schedule ?? null,
      max_slots: Number(row.max_slots ?? 30),
      course_id: row.course_id ?? null,
      unlock_mode: row.unlock_mode ?? "MANUAL",
      pass_percent: Number(row.pass_percent ?? 70),
      created_at: row.created_at,
      student_count: Number(row.student_count ?? 0),
    }));

    return NextResponse.json({ classes });
  } catch (err: any) {
    console.error("GET /api/teacher/classes error:", err);
    return NextResponse.json(
      { success: false, error: err.message || "Lỗi tải danh sách lớp học." },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  const auth = await requireRole(["ADMIN", "TEACHER"]);
  if (auth.error) return auth.error;
  const user = auth.user;

  try {
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return NextResponse.json(
        { success: false, error: "Dữ liệu không hợp lệ." },
        { status: 400 }
      );
    }

    const { name, schedule, max_slots, course_id } = body;

    if (!name || typeof name !== "string") {
      return NextResponse.json(
        { success: false, error: "Tên lớp không hợp lệ." },
        { status: 400 }
      );
    }
    const trimmedName = name.trim();
    if (trimmedName.length < 1 || trimmedName.length > 150) {
      return NextResponse.json(
        { success: false, error: "Tên lớp phải từ 1 đến 150 ký tự." },
        { status: 400 }
      );
    }

    let parsedMaxSlots = 30;
    if (max_slots !== undefined) {
      if (
        typeof max_slots !== "number" ||
        !Number.isInteger(max_slots) ||
        max_slots < 1 ||
        max_slots > 500
      ) {
        return NextResponse.json(
          { success: false, error: "Sĩ số tối đa phải là số nguyên từ 1 đến 500." },
          { status: 400 }
        );
      }
      parsedMaxSlots = max_slots;
    }

    const trial = await assertTrialAllows(user.userId, "classes");
    if (!trial.ok) {
      return trialLimitResponse("classes", trial.error);
    }
    if (await isTrialTeacher(user.userId)) {
      parsedMaxSlots = Math.min(parsedMaxSlots, 3);
    }

    const classId = "cls_" + crypto.randomUUID();

    // Sinh mã lớp 6 ký tự A-Z0-9 ngẫu nhiên, sinh lại nếu trùng
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    let code = "";
    for (let attempt = 0; attempt < 20; attempt++) {
      let candidate = "";
      for (let i = 0; i < 6; i++) {
        candidate += chars.charAt(Math.floor(Math.random() * chars.length));
      }
      const exist = await queryPg("SELECT 1 FROM classes WHERE code = $1", [candidate]);
      if (exist.rows.length === 0) {
        code = candidate;
        break;
      }
    }
    if (!code) {
      return NextResponse.json(
        { success: false, error: "Không thể sinh mã lớp duy nhất, vui lòng thử lại." },
        { status: 500 }
      );
    }

    const teacherId = user.userId;
    const finalSchedule = typeof schedule === "string" ? schedule.trim() : null;
    const finalCourseId = typeof course_id === "string" ? course_id.trim() : null;

    const insertSql = `
      INSERT INTO classes (id, name, code, teacher_id, schedule, max_slots, course_id)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `;
    const res = await queryPg(insertSql, [
      classId,
      trimmedName,
      code,
      teacherId,
      finalSchedule,
      parsedMaxSlots,
      finalCourseId,
    ]);
    const createdClass = res.rows[0];

    try {
      await syncTeacherManagesClass(teacherId, classId);
    } catch (neoErr) {
      console.warn("syncTeacherManagesClass Neo4j sync warning:", neoErr);
    }

    return NextResponse.json(
      {
        success: true,
        class: {
          id: createdClass.id,
          name: createdClass.name,
          code: createdClass.code,
          teacher_id: createdClass.teacher_id,
          schedule: createdClass.schedule ?? null,
          max_slots: Number(createdClass.max_slots),
          course_id: createdClass.course_id ?? null,
          unlock_mode: createdClass.unlock_mode ?? "MANUAL",
          pass_percent: Number(createdClass.pass_percent ?? 70),
          created_at: createdClass.created_at,
        },
      },
      { status: 201 }
    );
  } catch (err: any) {
    console.error("POST /api/teacher/classes error:", err);
    return NextResponse.json(
      { success: false, error: err.message || "Lỗi tạo lớp học." },
      { status: 500 }
    );
  }
}
