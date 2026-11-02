import crypto from "crypto";
import { NextResponse } from "next/server";
import { queryPg } from "@/lib/db-pg";
import { hashPassword, setAuthCookie } from "@/lib/auth";
import { checkRateLimit, recordRateLimitHit } from "@/lib/rate-limit";
import { createNotification } from "@/lib/notifications";
import {
  SIGNUP_SOURCES,
  STUDENT_COUNTS,
  TEACHER_LEVELS,
  TEACHER_NEEDS,
  TRIAL_SLOT_LIMIT,
  WORKPLACE_TYPES,
  isPlaceholderEmail,
  suggestUsernames,
  usernameBaseFromEmail,
  validateUsername,
  HONORIFICS,
} from "@/lib/onboarding";

const ONE_HOUR_MS = 60 * 60 * 1000;
const MAX_REGISTERS_PER_HOUR = 5;

const VALID_LEVELS = new Set<string>(TEACHER_LEVELS.map((x) => x.code));
const VALID_WORKPLACE_TYPES = new Set<string>(WORKPLACE_TYPES.map((x) => x.code));
const VALID_STUDENT_COUNTS = new Set<string>(STUDENT_COUNTS.map((x) => x.code));
const VALID_NEEDS = new Set<string>(TEACHER_NEEDS.map((x) => x.code));
const VALID_HONORIFICS = new Set<string>(HONORIFICS.map((o) => o.code));
const VALID_SOURCES = new Set<string>(SIGNUP_SOURCES.map((x) => x.code));

async function generateUniqueUsernameFromEmail(email: string): Promise<string> {
  const base = usernameBaseFromEmail(email);
  if (validateUsername(base) === null) {
    const existing = await queryPg(
      `SELECT 1 FROM users WHERE LOWER(username) = $1 LIMIT 1;`,
      [base]
    );
    if (existing.rows.length === 0) {
      return base;
    }
  }
  const candidates = suggestUsernames(base, 10);
  const placeholders = candidates.map((_, idx) => `$${idx + 1}`).join(", ");
  const takenRes = await queryPg(
    `SELECT LOWER(username) AS u FROM users WHERE LOWER(username) IN (${placeholders});`,
    candidates
  );
  const takenSet = new Set(takenRes.rows.map((r: any) => String(r.u || "").toLowerCase()));
  const unused = candidates.filter((c) => !takenSet.has(c));
  return unused[0] || `gv${Date.now().toString().slice(-6)}`;
}

export async function POST(req: Request) {
  try {
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    const rateKey = `register:teacher:${ip}`;

    const rl = checkRateLimit(rateKey, MAX_REGISTERS_PER_HOUR, ONE_HOUR_MS);
    if (!rl.allowed) {
      return NextResponse.json(
        {
          success: false,
          error: "Bạn đã gửi quá nhiều yêu cầu đăng ký. Vui lòng thử lại sau 1 giờ.",
        },
        {
          status: 429,
          headers: { "Retry-After": String(rl.retryAfterSeconds) },
        }
      );
    }
    recordRateLimitHit(rateKey, ONE_HOUR_MS);

    let body: any;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        { success: false, error: "Dữ liệu gửi lên không hợp lệ." },
        { status: 400 }
      );
    }

    // Bẫy bot (honeypot)
    if (body?.website && String(body.website).trim() !== "") {
      return NextResponse.json({ success: true }, { status: 200 });
    }

    const cleanName = typeof body?.name === "string" ? body.name.trim() : "";
    if (cleanName.length < 2 || cleanName.length > 100) {
      return NextResponse.json(
        {
          success: false,
          error: "Họ và tên phải từ 2 đến 100 ký tự.",
          field: "name",
        },
        { status: 400 }
      );
    }

    if (
      !Array.isArray(body?.subjects) ||
      body.subjects.length < 1 ||
      body.subjects.length > 10 ||
      !body.subjects.every((s: unknown) => typeof s === "string" && s.trim().length > 0 && s.length <= 50)
    ) {
      return NextResponse.json(
        {
          success: false,
          error: "Vui lòng chọn từ 1 đến 10 môn giảng dạy.",
          field: "subjects",
        },
        { status: 400 }
      );
    }
    const subjects = body.subjects.map((s: string) => s.trim());

    if (
      !Array.isArray(body?.levels) ||
      body.levels.length < 1 ||
      !body.levels.every((lv: unknown) => typeof lv === "string" && VALID_LEVELS.has(lv))
    ) {
      return NextResponse.json(
        {
          success: false,
          error: "Cấp học giảng dạy không hợp lệ.",
          field: "levels",
        },
        { status: 400 }
      );
    }
    const levels = body.levels as string[];

    const workplaceType = body?.workplaceType;
    if (typeof workplaceType !== "string" || !VALID_WORKPLACE_TYPES.has(workplaceType)) {
      return NextResponse.json(
        {
          success: false,
          error: "Nơi công tác không hợp lệ.",
          field: "workplaceType",
        },
        { status: 400 }
      );
    }

    let workplaceName: string | null = null;
    if (body?.workplaceName !== undefined && body?.workplaceName !== null && body?.workplaceName !== "") {
      if (typeof body.workplaceName !== "string" || body.workplaceName.trim().length > 150) {
        return NextResponse.json(
          {
            success: false,
            error: "Tên trường/trung tâm tối đa 150 ký tự.",
            field: "workplaceName",
          },
          { status: 400 }
        );
      }
      workplaceName = body.workplaceName.trim();
    }

    const studentCount = body?.studentCount;
    if (typeof studentCount !== "string" || !VALID_STUDENT_COUNTS.has(studentCount)) {
      return NextResponse.json(
        {
          success: false,
          error: "Quy mô học sinh không hợp lệ.",
          field: "studentCount",
        },
        { status: 400 }
      );
    }

    // Danh xưng để xưng hô (thầy/cô) — bắt buộc
    if (typeof body?.honorific !== "string" || !VALID_HONORIFICS.has(body.honorific)) {
      return NextResponse.json(
        { success: false, error: "Vui lòng chọn danh xưng thầy hoặc cô.", field: "honorific" },
        { status: 400 }
      );
    }
    const honorific = body.honorific as string;

    // Nhu cầu sử dụng: không còn hỏi khi đăng ký (02/11) — vẫn nhận nếu client cũ gửi
    if (
      body?.needs !== undefined &&
      body?.needs !== null &&
      (!Array.isArray(body.needs) ||
        !body.needs.every((n: unknown) => typeof n === "string" && VALID_NEEDS.has(n)))
    ) {
      return NextResponse.json(
        { success: false, error: "Nhu cầu sử dụng không hợp lệ.", field: "needs" },
        { status: 400 }
      );
    }
    const needs = Array.isArray(body?.needs) ? (body.needs as string[]) : [];

    let source: string | null = null;
    if (body?.source !== undefined && body?.source !== null && body?.source !== "") {
      if (typeof body.source !== "string" || !VALID_SOURCES.has(body.source)) {
        return NextResponse.json(
          {
            success: false,
            error: "Nguồn biết đến KitoKit không hợp lệ.",
            field: "source",
          },
          { status: 400 }
        );
      }
      source = body.source;
    }

    const rawPhone = typeof body?.phone === "string" ? body.phone.trim().replace(/[\s.\-]/g, "") : "";
    if (!/^(\+84|0)\d{9,10}$/.test(rawPhone)) {
      return NextResponse.json(
        {
          success: false,
          error: "Số điện thoại không đúng định dạng Việt Nam.",
          field: "phone",
        },
        { status: 400 }
      );
    }

    const rawEmail = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
    if (!rawEmail || rawEmail.length > 100 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(rawEmail)) {
      return NextResponse.json(
        {
          success: false,
          error: "Vui lòng nhập địa chỉ Email hợp lệ.",
          field: "email",
        },
        { status: 400 }
      );
    }

    if (isPlaceholderEmail(rawEmail)) {
      return NextResponse.json(
        {
          success: false,
          error: "Giáo viên cần sử dụng địa chỉ email thật để đăng ký.",
          field: "email",
        },
        { status: 400 }
      );
    }

    const cleanPassword = typeof body?.password === "string" ? body.password.trim() : "";
    if (cleanPassword.length < 8) {
      return NextResponse.json(
        {
          success: false,
          error: "Mật khẩu dành cho giáo viên phải có ít nhất 8 ký tự.",
          field: "password",
        },
        { status: 400 }
      );
    }

    const existingEmail = await queryPg(
      `SELECT 1 FROM users WHERE LOWER(email) = $1 LIMIT 1;`,
      [rawEmail]
    );
    if (existingEmail.rows.length > 0) {
      return NextResponse.json(
        {
          success: false,
          error: `Email "${rawEmail}" đã được đăng ký tài khoản trước đó.`,
          field: "email",
        },
        { status: 400 }
      );
    }

    const usernameToUse = await generateUniqueUsernameFromEmail(rawEmail);
    const hashedPassword = hashPassword(cleanPassword);
    const newUserId = `usr_teacher_${crypto.randomBytes(6).toString("hex")}`;

    const answers = {
      subjects,
      levels,
      workplace_type: workplaceType,
      workplace_name: workplaceName,
      student_count: studentCount,
      honorific,
      needs,
      source,
    };

    try {
      await queryPg(
        `WITH u AS (
          INSERT INTO users (
            id, name, email, username, email_is_placeholder, password,
            role, phone, teacher_status, slot_limit, created_at
          )
          VALUES ($1, $2, $3, $4, FALSE, $5, 'TEACHER', $6, 'TRIAL', $7, NOW())
          RETURNING id
        )
        INSERT INTO teacher_profiles (user_id, answers, created_at)
        SELECT id, $8::jsonb, NOW() FROM u;`,
        [
          newUserId,
          cleanName,
          rawEmail,
          usernameToUse,
          hashedPassword,
          rawPhone,
          TRIAL_SLOT_LIMIT,
          JSON.stringify(answers),
        ]
      );
    } catch (dbErr: any) {
      if (dbErr.code === "23505" || dbErr.message?.includes("unique constraint")) {
        return NextResponse.json(
          {
            success: false,
            error: `Email "${rawEmail}" đã được đăng ký tài khoản trước đó.`,
            field: "email",
          },
          { status: 400 }
        );
      }
      return NextResponse.json(
        { success: false, error: `Lỗi CSDL PostgreSQL: ${dbErr.message}` },
        { status: 500 }
      );
    }

    // Gửi thông báo cho mọi tài khoản ADMIN
    try {
      const adminsRes = await queryPg(`SELECT id FROM users WHERE role = 'ADMIN';`);
      for (const admin of adminsRes.rows) {
        await createNotification({
          userId: admin.id,
          type: "TEACHER_SIGNUP",
          title: `Giáo viên mới chờ xác minh: ${cleanName}`,
          body: `SĐT: ${rawPhone} · Email: ${rawEmail}`,
          link: "/admin/teachers?status=TRIAL",
          refId: newUserId,
        });
      }
    } catch (notifyErr) {
      console.error("registerTeacher notification error:", notifyErr);
    }

    await setAuthCookie({
      userId: newUserId,
      email: rawEmail,
      role: "TEACHER",
    });

    return NextResponse.json(
      {
        success: true,
        user: {
          id: newUserId,
          name: cleanName,
          email: rawEmail,
          username: usernameToUse,
          role: "TEACHER",
          teacherStatus: "TRIAL",
          emailIsPlaceholder: false,
        },
      },
      { status: 201 }
    );
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || "Lỗi hệ thống khi đăng ký giáo viên." },
      { status: 500 }
    );
  }
}
