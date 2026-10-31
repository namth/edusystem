import { NextResponse } from "next/server";
import crypto from "crypto";
import { queryPg } from "@/lib/db-pg";
import { requireRole } from "@/lib/api-auth";

export function parseJsonField<T>(val: any, fallback: T): T {
  if (val === null || val === undefined) return fallback;
  if (typeof val === "object") return val;
  if (typeof val === "string") {
    try {
      return JSON.parse(val);
    } catch {
      return fallback;
    }
  }
  return fallback;
}

export async function validateSections(sections: any): Promise<{ valid: boolean; error?: string }> {
  if (!Array.isArray(sections) || sections.length === 0) {
    return { valid: false, error: "Danh sách phần thi (sections) phải là mảng không rỗng." };
  }

  const allowedSkills = new Set(["Reading", "Listening", "Writing", "Speaking"]);
  const seenSkills = new Set<string>();

  for (const sec of sections) {
    if (!sec || typeof sec !== "object") {
      return { valid: false, error: "Phần thi không hợp lệ." };
    }

    if (!allowedSkills.has(sec.skill)) {
      return { valid: false, error: `Kỹ năng "${sec.skill}" không hợp lệ (chỉ chấp nhận Reading, Listening, Writing, Speaking).` };
    }

    if (seenSkills.has(sec.skill)) {
      return { valid: false, error: `Kỹ năng "${sec.skill}" bị trùng lặp trong sections.` };
    }
    seenSkills.add(sec.skill);

    if (
      typeof sec.min !== "number" ||
      typeof sec.max !== "number" ||
      typeof sec.step !== "number" ||
      Number.isNaN(sec.min) ||
      Number.isNaN(sec.max) ||
      Number.isNaN(sec.step)
    ) {
      return { valid: false, error: `min, max, step của phần ${sec.skill} phải là số.` };
    }

    if (sec.min >= sec.max) {
      return { valid: false, error: `min (${sec.min}) phải nhỏ hơn max (${sec.max}) cho phần ${sec.skill}.` };
    }

    if (sec.step <= 0) {
      return { valid: false, error: `step (${sec.step}) phải lớn hơn 0 cho phần ${sec.skill}.` };
    }

    if (sec.conversion !== "LINEAR" && sec.conversion !== "TABLE") {
      return { valid: false, error: `conversion của phần ${sec.skill} phải là LINEAR hoặc TABLE.` };
    }

    if (sec.conversion === "TABLE") {
      if (!Array.isArray(sec.table) || sec.table.length === 0) {
        return { valid: false, error: `Bảng tra điểm (table) của phần ${sec.skill} không được để trống.` };
      }

      if (
        typeof sec.table_question_count !== "number" ||
        !Number.isInteger(sec.table_question_count) ||
        sec.table_question_count < 1
      ) {
        return { valid: false, error: `table_question_count của phần ${sec.skill} phải là số nguyên ≥ 1.` };
      }

      let lastMinCorrect = -1;
      for (const row of sec.table) {
        if (!row || typeof row !== "object") {
          return { valid: false, error: `Dòng trong bảng tra điểm của phần ${sec.skill} không hợp lệ.` };
        }

        if (
          typeof row.min_correct !== "number" ||
          !Number.isInteger(row.min_correct) ||
          row.min_correct < 0
        ) {
          return { valid: false, error: `min_correct trong bảng tra phải là số nguyên ≥ 0.` };
        }

        if (row.min_correct <= lastMinCorrect) {
          return { valid: false, error: `min_correct trong bảng tra phải tăng dần nghiêm ngặt.` };
        }
        lastMinCorrect = row.min_correct;

        if (
          typeof row.score !== "number" ||
          Number.isNaN(row.score) ||
          row.score < sec.min ||
          row.score > sec.max
        ) {
          return { valid: false, error: `Điểm quy đổi trong bảng tra (${row.score}) phải nằm trong khoảng [${sec.min}, ${sec.max}].` };
        }
      }
    }

    if (sec.rubric_id !== undefined && sec.rubric_id !== null && sec.rubric_id !== "") {
      if (typeof sec.rubric_id !== "string") {
        return { valid: false, error: `rubric_id của phần ${sec.skill} phải là chuỗi.` };
      }
      const rRes = await queryPg("SELECT id FROM scoring_rubrics WHERE id = $1", [sec.rubric_id]);
      if (rRes.rows.length === 0) {
        return { valid: false, error: `Rubric ID "${sec.rubric_id}" không tồn tại trong hệ thống.` };
      }
    }
  }

  return { valid: true };
}

export function validateAggregation(
  aggregation: any,
  sections: any[]
): { valid: boolean; error?: string } {
  if (!aggregation || typeof aggregation !== "object" || Array.isArray(aggregation)) {
    return { valid: false, error: "Quy tắc tính điểm tổng (aggregation) không hợp lệ." };
  }

  if (
    aggregation.method !== "AVERAGE" &&
    aggregation.method !== "SUM" &&
    aggregation.method !== "WEIGHTED"
  ) {
    return { valid: false, error: "Phương pháp tổng hợp (method) phải là AVERAGE, SUM hoặc WEIGHTED." };
  }

  if (
    typeof aggregation.round_step !== "number" ||
    Number.isNaN(aggregation.round_step) ||
    aggregation.round_step <= 0
  ) {
    return { valid: false, error: "round_step phải là số > 0." };
  }

  if (aggregation.weights !== undefined && aggregation.weights !== null) {
    if (typeof aggregation.weights !== "object" || Array.isArray(aggregation.weights)) {
      return { valid: false, error: "weights phải là đối tượng." };
    }
    for (const [skill, w] of Object.entries(aggregation.weights)) {
      if (typeof w !== "number" || Number.isNaN(w) || (w as number) < 0) {
        return { valid: false, error: `Trọng số (weight) cho ${skill} phải là số ≥ 0.` };
      }
    }
  }

  if (aggregation.pass_score !== undefined && aggregation.pass_score !== null) {
    if (typeof aggregation.pass_score !== "number" || Number.isNaN(aggregation.pass_score)) {
      return { valid: false, error: "pass_score phải là số." };
    }
  }

  if (aggregation.section_min !== undefined && aggregation.section_min !== null) {
    if (typeof aggregation.section_min !== "object" || Array.isArray(aggregation.section_min)) {
      return { valid: false, error: "section_min phải là đối tượng." };
    }
    const sectionSkillSet = new Set(
      Array.isArray(sections) ? sections.map((s: any) => s.skill) : []
    );
    for (const [skill, minVal] of Object.entries(aggregation.section_min)) {
      if (!sectionSkillSet.has(skill)) {
        return {
          valid: false,
          error: `section_min chứa kỹ năng "${skill}" không có trong danh sách phần thi.`,
        };
      }
      if (typeof minVal !== "number" || Number.isNaN(minVal)) {
        return { valid: false, error: `Điểm sàn cho kỹ năng ${skill} phải là số.` };
      }
    }
  }

  return { valid: true };
}

export async function GET(req: Request) {
  const auth = await requireRole(["ADMIN", "TEACHER"]);
  if (auth.error) return auth.error;

  try {
    const res = await queryPg(
      `SELECT id, name, framework, description, sections, aggregation, is_system, created_by, created_at, updated_at
       FROM scoring_standards
       ORDER BY is_system DESC, name ASC;`
    );

    const standards = res.rows.map((r: any) => ({
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
    }));

    return NextResponse.json({ standards }, { status: 200 });
  } catch (err: any) {
    console.error("GET /api/scoring-standards error:", err);
    return NextResponse.json({ success: false, error: err.message || "Lỗi nạp danh sách chuẩn chấm." }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const auth = await requireRole(["ADMIN"]);
  if (auth.error) return auth.error;

  try {
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return NextResponse.json({ success: false, error: "Dữ liệu không hợp lệ." }, { status: 400 });
    }

    const { name, framework, description, sections, aggregation } = body;

    if (!name || typeof name !== "string" || name.trim().length === 0 || name.trim().length > 150) {
      return NextResponse.json({ success: false, error: "Tên chuẩn chấm phải từ 1 đến 150 ký tự." }, { status: 400 });
    }

    const secValidation = await validateSections(sections);
    if (!secValidation.valid) {
      return NextResponse.json({ success: false, error: secValidation.error }, { status: 400 });
    }

    const aggValidation = validateAggregation(aggregation, sections);
    if (!aggValidation.valid) {
      return NextResponse.json({ success: false, error: aggValidation.error }, { status: 400 });
    }

    const id = "std_" + crypto.randomUUID();
    const cleanName = name.trim();
    const cleanFramework = framework !== undefined && framework !== null ? String(framework).trim() : null;
    const cleanDesc = description !== undefined && description !== null ? String(description).trim() : null;

    const res = await queryPg(
      `INSERT INTO scoring_standards (id, name, framework, description, sections, aggregation, is_system, created_by, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, FALSE, $7, NOW(), NOW())
       RETURNING id, name, framework, description, sections, aggregation, is_system, created_by, created_at, updated_at;`,
      [
        id,
        cleanName,
        cleanFramework,
        cleanDesc,
        JSON.stringify(sections),
        JSON.stringify(aggregation),
        auth.user.userId,
      ]
    );

    const r = res.rows[0];
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

    return NextResponse.json({ success: true, standard }, { status: 201 });
  } catch (err: any) {
    console.error("POST /api/scoring-standards error:", err);
    return NextResponse.json({ success: false, error: err.message || "Lỗi tạo chuẩn chấm." }, { status: 500 });
  }
}
