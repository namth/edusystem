import crypto from "crypto";
import { NextResponse } from "next/server";
import { checkRateLimit, recordRateLimitHit } from "@/lib/rate-limit";
import { queryPg } from "@/lib/db-pg";
import { ensureLeadsTable } from "@/lib/leads";

const ALLOWED_ROLES = ["PARENT", "STUDENT", "TEACHER", "CENTER"];
const ONE_HOUR_MS = 60 * 60 * 1000;

export async function POST(req: Request) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const rateLimitKey = `leads:${ip}`;

  const rateCheck = checkRateLimit(rateLimitKey, 5, ONE_HOUR_MS);
  if (!rateCheck.allowed) {
    return NextResponse.json(
      { success: false, error: "Bạn đã gửi quá nhiều yêu cầu. Vui lòng thử lại sau 1 giờ." },
      {
        status: 429,
        headers: { "Retry-After": String(rateCheck.retryAfterSeconds) },
      }
    );
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ success: false, error: "Dữ liệu không hợp lệ." }, { status: 400 });
  }

  // Honeypot field check
  if (body.website && String(body.website).trim() !== "") {
    return NextResponse.json({ success: true }, { status: 200 });
  }

  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name || name.length > 120) {
    return NextResponse.json(
      { success: false, error: "Họ và tên bắt buộc từ 1 đến 120 ký tự." },
      { status: 400 }
    );
  }

  const role = body.role;
  if (!role || !ALLOWED_ROLES.includes(role)) {
    return NextResponse.json(
      { success: false, error: "Vai trò không hợp lệ." },
      { status: 400 }
    );
  }

  const hasPhone = typeof body.phone === "string" && body.phone.trim().length > 0;
  const hasEmail = typeof body.email === "string" && body.email.trim().length > 0;

  if (!hasPhone && !hasEmail) {
    return NextResponse.json(
      { success: false, error: "Vui lòng cung cấp số điện thoại hoặc email." },
      { status: 400 }
    );
  }

  let validPhone: string | null = null;
  if (hasPhone) {
    const cleanedPhone = body.phone.trim().replace(/[\s.\-]/g, "");
    if (!/^(\+84|0)\d{9,10}$/.test(cleanedPhone)) {
      return NextResponse.json(
        { success: false, error: "Số điện thoại không đúng định dạng." },
        { status: 400 }
      );
    }
    validPhone = cleanedPhone;
  }

  let validEmail: string | null = null;
  if (hasEmail) {
    const trimmedEmail = body.email.trim();
    if (trimmedEmail.length > 150 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      return NextResponse.json(
        { success: false, error: "Email không đúng định dạng." },
        { status: 400 }
      );
    }
    validEmail = trimmedEmail;
  }

  let message: string | null = null;
  if (body.message !== undefined && body.message !== null) {
    if (typeof body.message !== "string") {
      return NextResponse.json(
        { success: false, error: "Lời nhắn không hợp lệ." },
        { status: 400 }
      );
    }
    if (body.message.length > 1000) {
      return NextResponse.json(
        { success: false, error: "Lời nhắn tối đa 1000 ký tự." },
        { status: 400 }
      );
    }
    message = body.message;
  }

  await ensureLeadsTable();

  recordRateLimitHit(rateLimitKey, ONE_HOUR_MS);

  const id = `lead_${crypto.randomBytes(8).toString("hex")}`;
  await queryPg(
    `INSERT INTO leads (id, name, phone, email, role, message, status, source, ip, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, 'NEW', 'landing', $7, NOW())`,
    [id, name, validPhone, validEmail, role, message, ip]
  );

  return NextResponse.json({ success: true }, { status: 201 });
}
