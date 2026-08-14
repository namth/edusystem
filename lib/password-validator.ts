export interface PasswordValidationResult {
  isValid: boolean;
  score: number; // 0 to 4
  errors: string[];
  hasMinLength: boolean;
  hasUppercase: boolean;
  hasLowercase: boolean;
  hasNumber: boolean;
}

const COMMON_WEAK_PASSWORDS = new Set([
  "123456",
  "12345678",
  "123456789",
  "password",
  "qwerty",
  "admin123",
  "teacher123",
  "student123",
  "edtech123",
  "1234567890",
  "iloveyou",
  "abc123456",
  "00000000",
]);

export function validatePasswordStrength(password: string): PasswordValidationResult {
  const errors: string[] = [];
  const clean = password ? password.trim() : "";

  const hasMinLength = clean.length >= 8;
  const hasUppercase = /[A-Z]/.test(clean);
  const hasLowercase = /[a-z]/.test(clean);
  const hasNumber = /[0-9]/.test(clean);

  let score = 0;
  if (hasMinLength) score++;
  if (hasUppercase) score++;
  if (hasLowercase) score++;
  if (hasNumber) score++;

  if (!hasMinLength) {
    errors.push("Mật khẩu phải có độ dài tối thiểu từ 8 ký tự trở lên.");
  }
  if (!hasUppercase) {
    errors.push("Mật khẩu phải chứa ít nhất 1 chữ cái viết hoa (A-Z).");
  }
  if (!hasLowercase) {
    errors.push("Mật khẩu phải chứa ít nhất 1 chữ cái viết thường (a-z).");
  }
  if (!hasNumber) {
    errors.push("Mật khẩu phải chứa ít nhất 1 chữ số (0-9).");
  }

  if (COMMON_WEAK_PASSWORDS.has(clean.toLowerCase())) {
    errors.push("Mật khẩu này quá đơn giản và dễ đoán. Vui lòng chọn mật khẩu phức tạp hơn.");
  }

  const isValid = errors.length === 0;

  return {
    isValid,
    score,
    errors,
    hasMinLength,
    hasUppercase,
    hasLowercase,
    hasNumber,
  };
}
