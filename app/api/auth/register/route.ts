import crypto from "crypto";
import { NextResponse } from "next/server";
import { queryPg } from "@/lib/db-pg";
import { hashPassword, setAuthCookie } from "@/lib/auth";
import { checkRateLimit, recordRateLimitHit } from "@/lib/rate-limit";
import { enrollStudentByCode } from "@/lib/enrollment";
import {
  ENGLISH_GOALS,
  GRADE_LEVELS,
  isPlaceholderEmail,
  normalizeUsername,
  placeholderEmail,
  suggestUsernames,
  usernameBaseFromEmail,
  validateUsername,
} from "@/lib/onboarding";

const ONE_HOUR_MS = 60 * 60 * 1000;
const MAX_REGISTERS_PER_HOUR = 5;

const VALID_GRADES = new Set<string>(GRADE_LEVELS.map((g) => g.code));
const VALID_ENGLISH_GOALS = new Set<string>(ENGLISH_GOALS.map((g) => g.code));

async function findUnusedSuggestions(base: string, want = 3): Promise<string[]> {
  const candidates = suggestUsernames(base, 10);
  const placeholders = candidates.map((_, idx) => `$${idx + 1}`).join(", ");
  const takenRes = await queryPg(
    `SELECT LOWER(username) AS u FROM users WHERE LOWER(username) IN (${placeholders});`,
    candidates
  );
  const takenSet = new Set(takenRes.rows.map((r: any) => String(r.u || "").toLowerCase()));
  return candidates.filter((c) => !takenSet.has(c)).slice(0, Math.max(want, 3));
}

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
  const suggestions = await findUnusedSuggestions(base, 5);
  return suggestions[0] || `hs${Date.now().toString().slice(-6)}`;
}

export async function POST(req: Request) {
  try {
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    const rateKey = `register:student:${ip}`;

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

    const cleanPassword = typeof body?.password === "string" ? body.password.trim() : "";
    if (cleanPassword.length < 6) {
      return NextResponse.json(
        {
          success: false,
          error: "Mật khẩu tối thiểu phải từ 6 ký tự trở lên.",
          field: "password",
        },
        { status: 400 }
      );
    }

    let gradeLevel: string | null = null;
    if (body?.gradeLevel !== undefined && body?.gradeLevel !== null && body?.gradeLevel !== "") {
      if (typeof body.gradeLevel !== "string" || !VALID_GRADES.has(body.gradeLevel)) {
        return NextResponse.json(
          {
            success: false,
            error: "Khối lớp không hợp lệ.",
            field: "gradeLevel",
          },
          { status: 400 }
        );
      }
      gradeLevel = body.gradeLevel;
    }

    let subjects: string[] | undefined;
    let englishGoal: string | undefined;
    let targetScore: string | undefined;

    if (body?.goals !== undefined && body?.goals !== null) {
      if (typeof body.goals !== "object" || Array.isArray(body.goals)) {
        return NextResponse.json(
          { success: false, error: "Mục tiêu học tập không hợp lệ.", field: "goals" },
          { status: 400 }
        );
      }

      if (body.goals.subjects !== undefined) {
        if (
          !Array.isArray(body.goals.subjects) ||
          body.goals.subjects.length > 10 ||
          !body.goals.subjects.every((s: unknown) => typeof s === "string" && s.trim().length > 0 && s.length <= 50)
        ) {
          return NextResponse.json(
            {
              success: false,
              error: "Danh sách môn học không hợp lệ.",
              field: "subjects",
            },
            { status: 400 }
          );
        }
        subjects = body.goals.subjects.map((s: string) => s.trim());
      }

      const rawEngGoal = body.goals.englishGoal ?? body.goals.english_goal;
      if (rawEngGoal !== undefined && rawEngGoal !== null && rawEngGoal !== "") {
        if (typeof rawEngGoal !== "string" || !VALID_ENGLISH_GOALS.has(rawEngGoal)) {
          return NextResponse.json(
            {
              success: false,
              error: "Mục tiêu tiếng Anh không hợp lệ.",
              field: "englishGoal",
            },
            { status: 400 }
          );
        }
        englishGoal = rawEngGoal;
      }

      const rawScore = body.goals.targetScore ?? body.goals.target_score ?? body?.targetScore;
      if (rawScore !== undefined && rawScore !== null && rawScore !== "") {
        if (typeof rawScore !== "string" || rawScore.trim().length > 20) {
          return NextResponse.json(
            {
              success: false,
              error: "Điểm mục tiêu tối đa 20 ký tự.",
              field: "targetScore",
            },
            { status: 400 }
          );
        }
        targetScore = rawScore.trim();
      }
    }

    let emailToUse: string;
    let usernameToUse: string;
    let emailIsPlaceholder: boolean;

    if (body?.hasEmail === false) {
      const rawUsername = typeof body?.username === "string" ? body.username : "";
      const uError = validateUsername(rawUsername);
      if (uError) {
        return NextResponse.json(
          {
            success: false,
            error: uError,
            field: "username",
          },
          { status: 400 }
        );
      }

      usernameToUse = normalizeUsername(rawUsername);
      emailToUse = placeholderEmail(usernameToUse);
      emailIsPlaceholder = true;

      const existing = await queryPg(
        `SELECT 1 FROM users WHERE LOWER(username) = $1 OR LOWER(email) = $2 LIMIT 1;`,
        [usernameToUse, emailToUse]
      );
      if (existing.rows.length > 0) {
        const suggestions = await findUnusedSuggestions(usernameToUse, 3);
        return NextResponse.json(
          {
            success: false,
            error: "Tên đăng nhập này đã có bạn khác dùng rồi.",
            field: "username",
            suggestions,
          },
          { status: 400 }
        );
      }
    } else {
      const rawEmail = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
      if (!rawEmail || rawEmail.length > 100 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(rawEmail)) {
        return NextResponse.json(
          {
            success: false,
            error: "Vui lòng nhập Email hợp lệ.",
            field: "email",
          },
          { status: 400 }
        );
      }

      if (isPlaceholderEmail(rawEmail)) {
        return NextResponse.json(
          {
            success: false,
            error: "Vui lòng nhập địa chỉ email thật của bạn.",
            field: "email",
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

      emailToUse = rawEmail;
      emailIsPlaceholder = false;
      usernameToUse = await generateUniqueUsernameFromEmail(rawEmail);
    }

    const hashedPassword = hashPassword(cleanPassword);
    const phoneToUse = typeof body?.phone === "string" && body.phone.trim() ? body.phone.trim() : null;
    const newUserId = `usr_student_${crypto.randomBytes(6).toString("hex")}`;

    const learningGoalsObj =
      subjects !== undefined || englishGoal !== undefined || targetScore !== undefined
        ? {
            ...(subjects !== undefined ? { subjects } : {}),
            ...(englishGoal !== undefined ? { englishGoal, english_goal: englishGoal } : {}),
            ...(targetScore !== undefined ? { targetScore, target_score: targetScore } : {}),
          }
        : null;

    let targetBand: string | null = null;
    if ((englishGoal === "IELTS" || englishGoal === "TOEIC") && targetScore) {
      targetBand = `${englishGoal} ${targetScore}`;
    }

    try {
      await queryPg(
        `INSERT INTO users (
          id, name, email, username, email_is_placeholder, password, role,
          phone, grade_level, learning_goals, target_band, created_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, 'STUDENT', $7, $8, $9, $10, NOW());`,
        [
          newUserId,
          cleanName,
          emailToUse,
          usernameToUse,
          emailIsPlaceholder,
          hashedPassword,
          phoneToUse,
          gradeLevel,
          learningGoalsObj ? JSON.stringify(learningGoalsObj) : null,
          targetBand,
        ]
      );
    } catch (dbErr: any) {
      if (dbErr.code === "23505" || dbErr.message?.includes("unique constraint")) {
        if (body?.hasEmail === false) {
          const suggestions = await findUnusedSuggestions(usernameToUse, 3);
          return NextResponse.json(
            {
              success: false,
              error: "Tên đăng nhập này đã có bạn khác dùng rồi.",
              field: "username",
              suggestions,
            },
            { status: 400 }
          );
        }
        return NextResponse.json(
          {
            success: false,
            error: `Email "${emailToUse}" đã được đăng ký tài khoản trước đó.`,
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

    let enrolled: { classId: string; className: string } | null = null;
    let enrollError: string | undefined;

    const rawClassCode = typeof body?.classCode === "string" ? body.classCode.trim() : "";
    if (rawClassCode) {
      try {
        const enrollRes = await enrollStudentByCode(newUserId, rawClassCode);
        if (enrollRes.ok) {
          enrolled = {
            classId: enrollRes.class.id,
            className: enrollRes.class.name,
          };
        } else {
          enrollError = enrollRes.error;
        }
      } catch (err: any) {
        enrollError = err?.message || "Không thể ghi danh vào lớp học.";
      }
    }

    await setAuthCookie({
      userId: newUserId,
      email: emailToUse,
      role: "STUDENT",
    });

    return NextResponse.json(
      {
        success: true,
        user: {
          id: newUserId,
          name: cleanName,
          email: emailToUse,
          username: usernameToUse,
          role: "STUDENT",
          emailIsPlaceholder,
        },
        username: usernameToUse,
        enrolled,
        ...(enrollError ? { enrollError } : {}),
      },
      { status: 201 }
    );
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || "Lỗi hệ thống khi đăng ký." },
      { status: 500 }
    );
  }
}
