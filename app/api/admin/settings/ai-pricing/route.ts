import { NextResponse } from "next/server";
import { requireRole } from "@/lib/api-auth";
import { queryPg } from "@/lib/db-pg";
import { getAiPricing } from "@/lib/ai-usage";
import { findModelPrice, validateAiPricing } from "@/lib/ai-pricing";

export async function GET(req: Request) {
  const auth = await requireRole(["ADMIN"]);
  if (auth.error) return auth.error;

  try {
    const pricing = await getAiPricing();
    const res = await queryPg(
      `SELECT DISTINCT model FROM ai_usage_logs WHERE model IS NOT NULL AND model != ''`
    );
    const distinctModels = res.rows.map((r: any) => r.model as string);
    const unpriced_models = distinctModels
      .filter((m) => findModelPrice(m, pricing) === null)
      .sort((a, b) => a.localeCompare(b));

    return NextResponse.json({
      success: true,
      pricing,
      unpriced_models,
    });
  } catch (err: any) {
    console.error("GET /api/admin/settings/ai-pricing error:", err);
    return NextResponse.json(
      { success: false, error: err.message || "Lỗi khi lấy bảng giá AI." },
      { status: 500 }
    );
  }
}

export async function PUT(req: Request) {
  const auth = await requireRole(["ADMIN"]);
  if (auth.error) return auth.error;

  try {
    const body = await req.json().catch(() => null);
    const validation = validateAiPricing(body);
    if (!validation.ok) {
      return NextResponse.json(
        { success: false, error: validation.error },
        { status: 400 }
      );
    }

    await queryPg(
      `INSERT INTO system_settings (key, value, description, updated_by, updated_at)
       VALUES ('ai_pricing', $1::jsonb, 'Giá model AI USD / 1 triệu token input-output, tỷ giá USD→VND', $2, NOW())
       ON CONFLICT (key) DO UPDATE
       SET value = EXCLUDED.value,
           updated_by = EXCLUDED.updated_by,
           updated_at = NOW()`,
      [JSON.stringify(validation.value), auth.user.userId]
    );

    return NextResponse.json({
      success: true,
      pricing: validation.value,
    });
  } catch (err: any) {
    console.error("PUT /api/admin/settings/ai-pricing error:", err);
    return NextResponse.json(
      { success: false, error: err.message || "Lỗi khi cập nhật bảng giá AI." },
      { status: 500 }
    );
  }
}
