import { NextResponse } from "next/server";
import { queryPg } from "@/lib/db-pg";
import { requireRole } from "@/lib/api-auth";

// Helper to deduce framework and language safely
function inferFrameworkAndLanguage(id: string, name: string) {
  const lowerId = (id || "").toLowerCase();
  const lowerName = (name || "").toLowerCase();

  let framework = "IELTS";
  let language = "EN";

  if (lowerId.includes("hsk") || lowerName.includes("hsk") || lowerName.includes("tiếng trung")) {
    framework = "HSK";
    language = "ZH";
  } else if (lowerId.includes("jlpt") || lowerName.includes("jlpt") || lowerName.includes("tiếng nhật")) {
    framework = "JLPT";
    language = "JA";
  } else if (lowerId.includes("toeic") || lowerName.includes("toeic")) {
    framework = "TOEIC";
    language = "EN";
  } else if (lowerId.includes("toefl") || lowerName.includes("toefl")) {
    framework = "TOEFL";
    language = "EN";
  } else if (lowerId.includes("cefr") || lowerName.includes("cefr")) {
    framework = "CEFR";
    language = "EN";
  } else if (lowerId.includes("internal") || lowerName.includes("nội bộ")) {
    framework = "INTERNAL";
    language = "VI";
  }

  return { framework, language };
}

function formatRubric(r: any) {
  const { framework, language } = inferFrameworkAndLanguage(r.id, r.name);
  const rawCriteria = r.criteria;
  const criteria = Array.isArray(rawCriteria)
    ? rawCriteria
    : typeof rawCriteria === "string"
    ? JSON.parse(rawCriteria)
    : [];

  return {
    ...r,
    scale_min: Number(r.scale_min ?? 0),
    scale_max: Number(r.scale_max ?? 9),
    scale_step: Number(r.scale_step ?? 0.5),
    criteria,
    skill: (r.name || "").toLowerCase().includes("speaking") ? "Speaking" : "Writing",
    framework: r.framework || framework,
    language: r.language || language,
  };
}

// GET: Fetch all scoring rubrics from Postgres DB
export async function GET() {
  const auth = await requireRole(["ADMIN", "TEACHER"]);
  if (auth.error) return auth.error;

  try {
    const res = await queryPg(
      "SELECT * FROM scoring_rubrics ORDER BY created_at ASC;"
    );

    const rubrics = res.rows.map(formatRubric);

    return NextResponse.json({ success: true, rubrics });
  } catch (err: any) {
    console.error("Error fetching rubrics:", err);
    return NextResponse.json({ success: false, error: err?.message || "Internal error" }, { status: 500 });
  }
}

// POST: Create a new scoring rubric in Postgres DB
export async function POST(request: Request) {
  const auth = await requireRole(["ADMIN"]);
  if (auth.error) return auth.error;

  try {
    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return NextResponse.json({ success: false, error: "Dữ liệu không hợp lệ" }, { status: 400 });
    }

    const {
      id,
      name,
      description,
      scale_min,
      scale_max,
      scale_step,
      criteria,
      output_language,
    } = body;

    if (!name || typeof name !== "string" || !name.trim()) {
      return NextResponse.json({ success: false, error: "Tên Bộ Rubric không được để trống" }, { status: 400 });
    }

    const rubricId = (id && typeof id === "string" && id.trim()) ? id.trim() : `rubric_${Date.now()}`;
    const cleanName = name.trim();
    const cleanDescription = description?.trim() || "";
    const scaleMin = scale_min !== undefined && scale_min !== null ? Number(scale_min) : 0;
    const scaleMax = scale_max !== undefined && scale_max !== null ? Number(scale_max) : 9;
    const scaleStep = scale_step !== undefined && scale_step !== null ? Number(scale_step) : 0.5;
    const criteriaList = Array.isArray(criteria) ? criteria : [];
    const outputLang = output_language || "vi";

    const res = await queryPg(
      `INSERT INTO scoring_rubrics (id, name, description, scale_min, scale_max, scale_step, criteria, output_language, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
       ON CONFLICT (id) DO UPDATE SET
         name = EXCLUDED.name,
         description = EXCLUDED.description,
         scale_min = EXCLUDED.scale_min,
         scale_max = EXCLUDED.scale_max,
         scale_step = EXCLUDED.scale_step,
         criteria = EXCLUDED.criteria,
         output_language = EXCLUDED.output_language
       RETURNING *;`,
      [
        rubricId,
        cleanName,
        cleanDescription,
        scaleMin,
        scaleMax,
        scaleStep,
        JSON.stringify(criteriaList),
        outputLang,
      ]
    );

    return NextResponse.json({
      success: true,
      rubric: formatRubric(res.rows[0]),
    }, { status: 201 });
  } catch (err: any) {
    console.error("Error creating rubric:", err);
    return NextResponse.json({ success: false, error: err?.message || "Internal error" }, { status: 500 });
  }
}

// PUT: Update an existing scoring rubric in Postgres DB
export async function PUT(request: Request) {
  const auth = await requireRole(["ADMIN"]);
  if (auth.error) return auth.error;

  try {
    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return NextResponse.json({ success: false, error: "Dữ liệu không hợp lệ" }, { status: 400 });
    }

    const { id } = body;
    if (!id || typeof id !== "string" || !id.trim()) {
      return NextResponse.json({ success: false, error: "Missing rubric id" }, { status: 400 });
    }

    const rubricId = id.trim();
    const existing = await queryPg("SELECT * FROM scoring_rubrics WHERE id = $1;", [rubricId]);
    if (existing.rows.length === 0) {
      return NextResponse.json({ success: false, error: "Không tìm thấy rubric" }, { status: 404 });
    }

    const updates: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (body.name !== undefined) {
      if (typeof body.name !== "string" || !body.name.trim()) {
        return NextResponse.json({ success: false, error: "Tên Bộ Rubric không được để trống" }, { status: 400 });
      }
      updates.push(`name = $${paramIndex++}`);
      values.push(body.name.trim());
    }
    if (body.description !== undefined) {
      updates.push(`description = $${paramIndex++}`);
      values.push(body.description !== null ? String(body.description).trim() : "");
    }
    if (body.scale_min !== undefined) {
      updates.push(`scale_min = $${paramIndex++}`);
      values.push(Number(body.scale_min));
    }
    if (body.scale_max !== undefined) {
      updates.push(`scale_max = $${paramIndex++}`);
      values.push(Number(body.scale_max));
    }
    if (body.scale_step !== undefined) {
      updates.push(`scale_step = $${paramIndex++}`);
      values.push(Number(body.scale_step));
    }
    if (body.criteria !== undefined) {
      updates.push(`criteria = $${paramIndex++}`);
      values.push(JSON.stringify(body.criteria || []));
    }
    if (body.output_language !== undefined) {
      updates.push(`output_language = $${paramIndex++}`);
      values.push(String(body.output_language));
    }

    if (updates.length === 0) {
      return NextResponse.json({
        success: true,
        rubric: formatRubric(existing.rows[0]),
      });
    }

    values.push(rubricId);
    const updateSql = `UPDATE scoring_rubrics SET ${updates.join(", ")} WHERE id = $${paramIndex} RETURNING *;`;
    const res = await queryPg(updateSql, values);

    return NextResponse.json({
      success: true,
      rubric: formatRubric(res.rows[0]),
    });
  } catch (err: any) {
    console.error("Error updating rubric:", err);
    return NextResponse.json({ success: false, error: err?.message || "Internal error" }, { status: 500 });
  }
}

// DELETE: Delete a scoring rubric by ID
export async function DELETE(request: Request) {
  const auth = await requireRole(["ADMIN"]);
  if (auth.error) return auth.error;

  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id || !id.trim()) {
      return NextResponse.json({ success: false, error: "Missing rubric id" }, { status: 400 });
    }

    const rubricId = id.trim();

    try {
      const refCheck = await queryPg(
        `SELECT EXISTS (
          SELECT 1 FROM scoring_standards, jsonb_array_elements(sections) s
          WHERE s->>'rubric_id' = $1
        ) AS is_referenced;`,
        [rubricId]
      );
      if (refCheck.rows[0]?.is_referenced) {
        return NextResponse.json(
          { success: false, error: "Rubric đang được chuẩn chấm tham chiếu, không thể xoá." },
          { status: 409 }
        );
      }
    } catch (err: any) {
      // Bỏ qua kiểm tra nếu bảng scoring_standards chưa tồn tại
    }

    await queryPg("DELETE FROM scoring_rubrics WHERE id = $1;", [rubricId]);

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("Error deleting rubric:", err);
    return NextResponse.json({ success: false, error: err?.message || "Internal error" }, { status: 500 });
  }
}
