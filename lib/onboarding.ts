// Tiện ích dùng chung cho luồng đăng ký phỏng vấn & tên đăng nhập (FEAT-012, DEC-026…028).
// File này KHÔNG import module server để giao diện client (TASK-036) dùng chung được.

export const PLACEHOLDER_EMAIL_DOMAIN = "kito.io.vn";
export const TRIAL_SLOT_LIMIT = 9;

export const USERNAME_RE = /^[a-z][a-z0-9._]{3,29}$/;

export const RESERVED_USERNAMES = [
  "admin",
  "administrator",
  "root",
  "support",
  "kitokit",
  "kito",
  "teacher",
  "student",
  "system",
  "null",
  "undefined",
] as const;

const RESERVED_SET = new Set<string>(RESERVED_USERNAMES);

export function normalizeUsername(s: string): string {
  return (typeof s === "string" ? s : "").trim().toLowerCase();
}

export function placeholderEmail(username: string): string {
  return `${normalizeUsername(username)}@${PLACEHOLDER_EMAIL_DOMAIN}`;
}

export function isPlaceholderEmail(email: string): boolean {
  if (typeof email !== "string") return false;
  return email.trim().toLowerCase().endsWith(`@${PLACEHOLDER_EMAIL_DOMAIN}`);
}

export function validateUsername(s: unknown): string | null {
  if (typeof s !== "string" || !s.trim()) {
    return "Vui lòng nhập tên đăng nhập.";
  }
  const u = normalizeUsername(s);
  if (u.length < 4 || u.length > 30) {
    return "Tên đăng nhập phải từ 4 đến 30 ký tự.";
  }
  if (!/^[a-z]/.test(u)) {
    return "Tên đăng nhập phải bắt đầu bằng chữ cái (a-z).";
  }
  if (!USERNAME_RE.test(u)) {
    return "Tên đăng nhập chỉ được gồm chữ thường không dấu (a-z), chữ số (0-9), dấu chấm (.) hoặc gạch dưới (_).";
  }
  if (RESERVED_SET.has(u)) {
    return "Tên đăng nhập này đã được hệ thống đặt trước, vui lòng chọn tên khác.";
  }
  return null;
}

function stripVietnamese(str: string): string {
  return str
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[đĐ]/g, "d")
    .toLowerCase();
}

/**
 * Chuyển họ tên tiếng Việt thành gốc tên đăng nhập dạng `<tên>.<họ>`.
 * Ví dụ: "Nguyễn Văn An" → "an.nguyen", "Đặng Đức" → "duc.dang".
 */
export function usernameBaseFromName(name: string): string {
  const ascii = stripVietnamese(typeof name === "string" ? name : "");
  const parts = ascii.match(/[a-z0-9]+/g) || [];
  let base = "";
  if (parts.length >= 2) {
    base = `${parts[parts.length - 1]}.${parts[0]}`;
  } else if (parts.length === 1) {
    base = parts[0];
  } else {
    base = "hocsinh";
  }
  if (!/^[a-z]/.test(base)) {
    base = `hs.${base}`;
  }
  base = base.slice(0, 25).replace(/\.+$/, "");
  if (base.length < 2) {
    base = "hocsinh";
  }
  return base;
}

/**
 * Rút gốc tên đăng nhập từ phần trước `@` của email.
 */
export function usernameBaseFromEmail(email: string): string {
  const local = stripVietnamese(String(email || "").split("@")[0] || "");
  let cleaned = local
    .replace(/[^a-z0-9._]+/g, ".")
    .replace(/\.{2,}/g, ".")
    .replace(/^[^a-z]+/, "")
    .replace(/[._]+$/, "")
    .slice(0, 25);
  if (!cleaned || !/^[a-z]/.test(cleaned)) {
    return "hs";
  }
  return cleaned;
}

/**
 * Sinh `count` gợi ý tên đăng nhập hợp lệ bằng cách nối thêm 2–4 chữ số ngẫu nhiên.
 */
export function suggestUsernames(base: string, count = 5): string[] {
  const target = Math.max(1, Math.min(20, Math.trunc(count) || 5));
  let cleanBase = stripVietnamese(typeof base === "string" ? base : "")
    .replace(/[^a-z0-9._]+/g, "")
    .replace(/^[^a-z]+/, "")
    .slice(0, 25);

  if (!cleanBase || !/^[a-z]/.test(cleanBase) || RESERVED_SET.has(cleanBase)) {
    cleanBase = cleanBase && /^[a-z]/.test(cleanBase) ? `${cleanBase}` : "hs";
  }

  const results = new Set<string>();
  let attempts = 0;
  while (results.size < target && attempts < target * 50) {
    attempts++;
    // 2–4 chữ số ngẫu nhiên (10..9999); nếu cleanBase quá ngắn (<2 ký tự) thì đảm bảo đủ ≥4 ký tự
    const minNum = cleanBase.length < 2 ? 100 : 10;
    const num = Math.floor(minNum + Math.random() * (10000 - minNum));
    const candidate = `${cleanBase}${num}`.slice(0, 30);
    if (validateUsername(candidate) === null) {
      results.add(candidate);
    }
  }

  // Fallback tất định nếu ngẫu nhiên chưa đủ
  let seq = 10;
  while (results.size < target) {
    const candidate = `${cleanBase}${seq++}`.slice(0, 30);
    if (validateUsername(candidate) === null) {
      results.add(candidate);
    }
  }

  return Array.from(results);
}

export interface OnboardingOption<T extends string = string> {
  readonly code: T;
  readonly value: T;
  readonly label: string;
}

function opt<T extends string>(code: T, label: string): OnboardingOption<T> {
  return { code, value: code, label } as const;
}

export const GRADE_LEVELS = [
  opt("G1", "Lớp 1"),
  opt("G2", "Lớp 2"),
  opt("G3", "Lớp 3"),
  opt("G4", "Lớp 4"),
  opt("G5", "Lớp 5"),
  opt("G6", "Lớp 6"),
  opt("G7", "Lớp 7"),
  opt("G8", "Lớp 8"),
  opt("G9", "Lớp 9"),
  opt("G10", "Lớp 10"),
  opt("G11", "Lớp 11"),
  opt("G12", "Lớp 12"),
  opt("UNIVERSITY", "Đại học"),
  opt("WORKING", "Đã đi làm"),
] as const;

export const ENGLISH_GOALS = [
  opt("SCHOOL", "Học trên lớp"),
  opt("CAMBRIDGE", "Cambridge (Starters/Movers/Flyers/KET/PET)"),
  opt("IELTS", "IELTS"),
  opt("TOEIC", "TOEIC"),
  opt("GRADE10", "Thi vào 10"),
  opt("UNSURE", "Chưa rõ"),
] as const;

export const TEACHER_LEVELS = [
  opt("PRESCHOOL", "Mầm non"),
  opt("PRIMARY", "Tiểu học"),
  opt("LOWER_SECONDARY", "THCS"),
  opt("UPPER_SECONDARY", "THPT"),
  opt("CERTIFICATE", "Luyện thi chứng chỉ"),
  opt("UNIVERSITY", "Đại học"),
  opt("ADULT", "Người đi làm"),
] as const;

export const WORKPLACE_TYPES = [
  opt("PUBLIC_SCHOOL", "Trường công lập"),
  opt("PRIVATE_SCHOOL", "Trường tư thục / quốc tế"),
  opt("CENTER", "Trung tâm"),
  opt("FREELANCE", "Gia sư / dạy tự do"),
] as const;

export const STUDENT_COUNTS = [
  opt("LT10", "Dưới 10"),
  opt("R10_50", "10–50"),
  opt("R50_200", "50–200"),
  opt("GT200", "Trên 200"),
] as const;

export const TEACHER_NEEDS = [
  opt("AI_GRADING", "AI chấm Writing/Speaking"),
  opt("AUTHORING", "Soạn đề & bài học"),
  opt("AI_IMPORT", "AI nhập đề từ file"),
  opt("CLASS_MGMT", "Quản lý lớp & lộ trình"),
  opt("PROGRESS", "Theo dõi tiến độ học sinh"),
] as const;

export const SIGNUP_SOURCES = [
  opt("FACEBOOK", "Facebook"),
  opt("ZALO", "Zalo"),
  opt("REFERRAL", "Bạn bè / đồng nghiệp giới thiệu"),
  opt("GOOGLE", "Tìm kiếm Google"),
  opt("OTHER", "Khác"),
] as const;
