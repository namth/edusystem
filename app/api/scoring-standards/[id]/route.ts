import { NextResponse } from "next/server";
import { queryPg } from "@/lib/db-pg";
import { requireRole } from "@/lib/api-auth";
import { validateSections, validateAggregation, parseJsonField } from "../route";

export async function PUT(
  req: Request,
  props: { params: Promise<{ id: string }> }
) {
  const auth = await requireRole(["ADMIN"]);
  if (auth.error) return auth.error;

  const { id } = await props.params;

  try {
    const existingRes = await queryPg("SELECT * FROM scoring_standards WHERE id = $1", [id]);
    if (existingRes.rows.length === 0) {
      return NextResponse.json({ success: false, error: "Không tìm thấy chuẩn chấm." }, { status: 404 });
    }
    const existing = existingRes.rows[0];

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return NextResponse.json({ success: false, error: "Dữ liệu không hợp lệ." }, { status: 400 });
    }

    const { name, framework, description, sections, aggregation } = body;

    let cleanName: string | undefined = undefined;
    if (name !== undefined) {
      if (typeof name !== "string" || name.trim().length === 0 || name.trim().length > 150) {
        return NextResponse.json({ success: false, error: "Tên chuẩn chấm phải từ 1 đến 150 ký tự." }, { status: 400 });
      }
      cleanName = name.trim();
    }

    let cleanFramework: string | null | undefined = undefined;
    if (framework !== undefined) {
      cleanFramework = framework !== null ? String(framework).trim() : null;
    }

    let cleanDescription: string | null | undefined = undefined;
    if (description !== undefined) {
      cleanDescription = description !== null ? String(description).trim() : null;
    }

    const effectiveSections = sections !== undefined ? sections : parseJsonField(existing.sections, []);
    const effectiveAggregation = aggregation !== undefined ? aggregation : parseJsonField(existing.aggregation, {});

    // Validate sections & aggregation together
    const secValidation = await validateSections(effectiveSections);
    if (!secValidation.valid) {
      return NextResponse.json({ success: false, error: secValidation.error }, { status: 400 });
    }

    const aggValidation = validateAggregation(effectiveAggregation, effectiveSections);
    if (!aggValidation.valid) {
      return NextResponse.json({ success: false, error: aggValidation.error }, { status: 400 });
    }

    // Build update query
    const setClauses: string[] = [];
    const params: any[] = [];
    let pIdx = 1;

    if (cleanName !== undefined) {
      setClauses.push(`name = $${pIdx++}`);
      params.push(cleanName);
    }
    if (cleanFramework !== undefined) {
      setClauses.push(`framework = $${pIdx++}`);
      params.push(cleanFramework);
    }
    if (cleanDescription !== undefined) {
      setClauses.push(`description = $${pIdx++}`);
      params.push(cleanDescription);
    }
    if (sections !== undefined) {
      setClauses.push(`sections = $${pIdx++}`);
      params.push(JSON.stringify(sections));
    }
    if (aggregation !== undefined) {
      setClauses.push(`aggregation = $${pIdx++}`);
      params.push(JSON.stringify(aggregation));
    }

    setClauses.push(`updated_at = NOW()`);

    params.push(id);
    const updateRes = await queryPg(
      `UPDATE scoring_standards
       SET ${setClauses.join(", ")}
       WHERE id = $${pIdx}
       RETURNING id, name, framework, description, sections, aggregation, is_system, created_by, created_at, updated_at;`,
      params
    );

    const r = updateRes.rows[0];
    const standard = {
      id: r.id,
      name: r.name,
      framework: r.framework,
      description: r.description,
      sections: parseJsonField(r.sections, []),
      aggregation: parseJsonField(r.aggregation, {}),
      is_system: Boolean(r.is_system),
      created_by: r.created_by,
      created_at: r.created_at,
      updated_at: r.updated_at,
    };

    return NextResponse.json({ success: true, standard }, { status: 200 });
  } catch (err: any) {
    console.error("PUT /api/scoring-standards/[id] error:", err);
    return NextResponse.json({ success: false, error: err.message || "Lỗi cập nhật chuẩn chấm." }, { status: 500 });
  }
}

export async function DELETE(
  req: Request,
  props: { params: Promise<{ id: string }> }
) {
  const auth = await requireRole(["ADMIN"]);
  if (auth.error) return auth.error;

  const { id } = await props.params;

  try {
    const existingRes = await queryPg("SELECT * FROM scoring_standards WHERE id = $1", [id]);
    if (existingRes.rows.length === 0) {
      return NextResponse.json({ success: false, error: "Không tìm thấy chuẩn chấm." }, { status: 404 });
    }
    const existing = existingRes.rows[0];

    if (existing.is_system) {
      return NextResponse.json({ success: false, error: "Không thể xóa chuẩn chấm hệ thống." }, { status: 409 });
    }

    // Check usage in exams and courses
    const examUsageRes = await queryPg(
      "SELECT COUNT(*)::int AS count FROM exams WHERE scoring_standard_id = $1",
      [id]
    );
    const courseUsageRes = await queryPg(
      "SELECT COUNT(*)::int AS count FROM courses WHERE default_scoring_standard_id = $1",
      [id]
    );

    const examCount = Number(examUsageRes.rows[0]?.count || 0);
    const courseCount = Number(courseUsageRes.rows[0]?.count || 0);

    if (examCount > 0 || courseCount > 0) {
      return NextResponse.json(
        {
          success: false,
          error: `Chuẩn chấm đang được sử dụng (${examCount} đề thi, ${courseCount} khóa học).`,
          usage: {
            exams: examCount,
            courses: courseCount,
          },
        },
        { status: 409 }
      );
    }

    await queryPg("DELETE FROM scoring_standards WHERE id = $1", [id]);
    return NextResponse.json({ success: true }, { status: 200 });
  } catch (err: any) {
    console.error("DELETE /api/scoring-standards/[id] error:", err);
    return NextResponse.json({ success: false, error: err.message || "Lỗi xóa chuẩn chấm." }, { status: 500 });
  }
}
