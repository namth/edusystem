import { NextResponse } from "next/server";
import { queryPg } from "@/lib/db-pg";
import { requireRole } from "@/lib/api-auth";
import { getAiPricing } from "@/lib/ai-usage";
import { usdToVnd } from "@/lib/ai-pricing";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireRole(["ADMIN"]);
  if (auth.error) return auth.error;

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
    let profile: {
      answers: Record<string, any>;
      reviewed_by?: string | null;
      reviewed_at: string | null;
      review_note: string | null;
      created_at: string | null;
    } | null = null;
    try {
      const profRes = await queryPg(
        `SELECT answers, reviewed_by, reviewed_at, review_note, created_at
         FROM teacher_profiles
         WHERE user_id = $1
         LIMIT 1;`,
        [cleanId]
      );
      if (profRes.rows.length > 0) {
        const pr = profRes.rows[0];
        profile = {
          answers:
            typeof pr.answers === "string"
              ? JSON.parse(pr.answers)
              : pr.answers || {},
          reviewed_by: pr.reviewed_by ?? null,
          reviewed_at: pr.reviewed_at ?? null,
          review_note: pr.review_note ?? null,
          created_at: pr.created_at ?? null,
        };
      }
    } catch (e) {
      console.warn("teacher_profiles fetch warning:", e);
    }

    const teacherStatus = teacherRow.teacher_status ?? null;
    const teacher = {
      id: teacherRow.id,
      name: teacherRow.name,
      email: teacherRow.email,
      phone: teacherRow.phone || "",
      target_band: teacherRow.target_band || "",
      created_at: new Date(teacherRow.created_at).toLocaleDateString("vi-VN"),
      slot_limit: Number(teacherRow.slot_limit ?? 0),
      slot_balance: Number(teacherRow.slot_balance ?? 0),
      teacher_status: teacherStatus,
      profile,
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

    // Số học sinh đã dùng theo BR-S01 (DISTINCT học sinh qua mọi lớp của giáo viên)
    const usedRes = await queryPg(
      `SELECT COUNT(DISTINCT e.student_id)::int AS used
       FROM enrollments e
       JOIN classes c ON e.class_id = c.id
       WHERE c.teacher_id = $1;`,
      [cleanId]
    );
    const students_used = Number(usedRes.rows[0]?.used) || 0;

    // 4. Fetch real AI Usage logs
    let aiLogs: any[] = [];
    let ai_totals = { requests: 0, total_tokens: 0, cost_vnd: 0 };
    try {
      const pricing = await getAiPricing();
      const totRes = await queryPg(
        `SELECT COUNT(*)::int AS requests,
                COALESCE(SUM(total_tokens), 0) AS total_tokens,
                COALESCE(SUM(cost_usd), 0) AS cost_usd
         FROM ai_usage_logs
         WHERE teacher_id = $1 OR teacher_id = $2;`,
        [cleanId, teacherRow.email]
      );
      const tr = totRes.rows[0] || {};
      ai_totals = {
        requests: Number(tr.requests) || 0,
        total_tokens: Number(tr.total_tokens) || 0,
        cost_vnd: usdToVnd(Number(tr.cost_usd) || 0, pricing.usd_vnd_rate),
      };
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
      teacher_status: teacherStatus,
      profile,
      classes: managedClasses,
      aiLogs,
      ai_totals,
      students_used,
    });
  } catch (err: any) {
    console.error("API /api/admin/teachers/[id] GET Error:", err);
    return NextResponse.json({ success: false, error: err.message || "Lỗi hệ thống khi tải thông tin." }, { status: 500 });
  }
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireRole(["ADMIN"]);
  if (auth.error) return auth.error;

  try {
    const { id: teacherId } = await params;
    const body = await req.json().catch(() => ({}));
    const { name, email, phone, target_band } = body;

    if (!teacherId?.trim()) {
      return NextResponse.json({ success: false, error: "Missing teacherId" }, { status: 400 });
    }

    const cleanId = teacherId.trim();

    // Bỏ qua slot_limit (DEC-042, TASK-053); chỉ cập nhật thông tin cá nhân nếu có
    const updates: string[] = [];
    const values: any[] = [];
    let idx = 1;

    if (name !== undefined) {
      updates.push(`name = $${idx++}`);
      values.push(name?.trim());
    }
    if (email !== undefined) {
      updates.push(`email = $${idx++}`);
      values.push(email?.trim().toLowerCase());
    }
    if (phone !== undefined) {
      updates.push(`phone = $${idx++}`);
      values.push(phone?.trim() || "");
    }
    if (target_band !== undefined) {
      updates.push(`target_band = $${idx++}`);
      values.push(target_band?.trim() || "");
    }

    if (updates.length > 0) {
      values.push(cleanId);
      await queryPg(
        `UPDATE users SET ${updates.join(", ")} WHERE id = $${idx};`,
        values
      );
    }

    return NextResponse.json({ success: true, message: "Cập nhật thông tin giảng viên thành công!" });
  } catch (err: any) {
    console.error("API /api/admin/teachers/[id] PUT Error:", err);
    return NextResponse.json({ success: false, error: err.message || "Lỗi hệ thống khi cập nhật." }, { status: 500 });
  }
}
