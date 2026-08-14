import { NextResponse } from "next/server";
import { queryPg } from "@/lib/db-pg";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: teacherId } = await params;

    if (!teacherId?.trim()) {
      return NextResponse.json({ success: false, error: "Missing teacherId" }, { status: 400 });
    }

    const cleanId = teacherId.trim();

    // 1. Fetch teacher user profile from PostgreSQL
    const userRes = await queryPg(`SELECT * FROM users WHERE id = $1 LIMIT 1;`, [cleanId]);

    if (userRes.rows.length === 0) {
      return NextResponse.json({ success: false, error: "Teacher not found", teacher: null }, { status: 404 });
    }

    const teacherRow = userRes.rows[0];
    const teacher = {
      id: teacherRow.id,
      name: teacherRow.name,
      email: teacherRow.email,
      phone: teacherRow.phone || "",
      target_band: teacherRow.target_band || "",
      created_at: new Date(teacherRow.created_at).toLocaleDateString("vi-VN"),
      slot_limit: teacherRow.slot_limit || 250,
    };

    // 2. Fetch classes managed by this teacher
    const classRes = await queryPg(`SELECT * FROM classes WHERE teacher_id = $1 ORDER BY created_at DESC;`, [cleanId]);
    const classRows = classRes.rows;

    // 3. Calculate real headcount per class from enrollments
    const enrRes = await queryPg(`SELECT class_id, COUNT(*)::int as student_count FROM enrollments GROUP BY class_id;`);
    const headcountMap: Record<string, number> = {};
    enrRes.rows.forEach((r: any) => {
      headcountMap[r.class_id] = Number(r.student_count || 0);
    });

    const managedClasses = classRows.map((c: any) => ({
      id: c.id,
      name: c.name,
      code: c.code,
      schedule: c.schedule || "Chưa xếp lịch học",
      student_count: headcountMap[c.id] || 0,
    }));

    // 4. Fetch real AI Usage logs
    let aiLogs: any[] = [];
    try {
      const logsRes = await queryPg(
        `SELECT * FROM ai_usage_logs WHERE teacher_id = $1 OR teacher_id = $2 ORDER BY created_at DESC LIMIT 50;`,
        [cleanId, teacherRow.email]
      );
      aiLogs = logsRes.rows.map((row: any) => ({
        id: row.id,
        teacher_id: row.teacher_id,
        student_id: row.student_id || "",
        submission_id: row.submission_id || "",
        model: row.model || "portkey-ai-gateway",
        prompt_tokens: Number(row.prompt_tokens || 0),
        completion_tokens: Number(row.completion_tokens || 0),
        total_tokens: Number(row.total_tokens || 0),
        cost_usd: Number(row.cost_usd || 0),
        created_at: new Date(row.created_at).toLocaleString("vi-VN"),
      }));
    } catch (e) {
      console.warn("AI logs fetch warning (table may not exist yet):", e);
    }

    return NextResponse.json({
      success: true,
      teacher,
      classes: managedClasses,
      aiLogs,
    });
  } catch (err: any) {
    console.error("API /api/admin/teachers/[id] GET Error:", err);
    return NextResponse.json({ success: false, error: err.message || "Lỗi hệ thống khi tải thông tin." }, { status: 500 });
  }
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: teacherId } = await params;
    const body = await req.json();
    const { name, email, phone, target_band, slot_limit } = body;

    if (!teacherId?.trim()) {
      return NextResponse.json({ success: false, error: "Missing teacherId" }, { status: 400 });
    }

    const cleanId = teacherId.trim();

    if (slot_limit !== undefined) {
      // Update slot limit
      await queryPg(`UPDATE users SET slot_limit = $1 WHERE id = $2;`, [Number(slot_limit), cleanId]);
    } else {
      // Update profile info
      await queryPg(
        `UPDATE users SET name = $1, email = $2, phone = $3, target_band = $4 WHERE id = $5;`,
        [name?.trim(), email?.trim().toLowerCase(), phone?.trim() || "", target_band?.trim() || "", cleanId]
      );
    }

    return NextResponse.json({ success: true, message: "Cập nhật thông tin giảng viên thành công!" });
  } catch (err: any) {
    console.error("API /api/admin/teachers/[id] PUT Error:", err);
    return NextResponse.json({ success: false, error: err.message || "Lỗi hệ thống khi cập nhật." }, { status: 500 });
  }
}
