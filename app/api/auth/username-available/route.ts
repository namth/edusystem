import { NextResponse } from "next/server";
import { queryPg } from "@/lib/db-pg";
import { checkRateLimit, recordRateLimitHit } from "@/lib/rate-limit";
import {
  normalizeUsername,
  suggestUsernames,
  validateUsername,
} from "@/lib/onboarding";

const WINDOW_MS = 60 * 1000;
const MAX_CHECKS = 30;

export async function GET(req: Request) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const rateKey = `username-available:${ip}`;

  const rl = checkRateLimit(rateKey, MAX_CHECKS, WINDOW_MS);
  if (!rl.allowed) {
    return NextResponse.json(
      {
        success: false,
        error: "Bạn đã kiểm tra quá nhiều lần. Vui lòng thử lại sau ít giây.",
      },
      {
        status: 429,
        headers: { "Retry-After": String(rl.retryAfterSeconds) },
      }
    );
  }
  recordRateLimitHit(rateKey, WINDOW_MS);

  const { searchParams } = new URL(req.url);
  const rawU = searchParams.get("u") || "";
  const u = normalizeUsername(rawU);

  const validationError = validateUsername(u);
  if (validationError) {
    return NextResponse.json({
      success: true,
      available: false,
      error: validationError,
      suggestions: [],
    });
  }

  const existing = await queryPg(
    `SELECT 1 FROM users WHERE LOWER(username) = $1 LIMIT 1;`,
    [u]
  );

  if (existing.rows.length === 0) {
    return NextResponse.json({
      success: true,
      available: true,
      suggestions: [],
    });
  }

  const candidates = suggestUsernames(u, 10);
  const placeholders = candidates.map((_, idx) => `$${idx + 1}`).join(", ");
  const takenRes = await queryPg(
    `SELECT LOWER(username) AS u FROM users WHERE LOWER(username) IN (${placeholders});`,
    candidates
  );
  const takenSet = new Set(takenRes.rows.map((r: any) => String(r.u || "").toLowerCase()));
  const suggestions = candidates.filter((c) => !takenSet.has(c)).slice(0, 5);

  return NextResponse.json({
    success: true,
    available: false,
    error: "Tên đăng nhập này đã có người sử dụng.",
    suggestions,
  });
}
