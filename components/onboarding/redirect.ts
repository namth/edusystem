export function roleHomePath(role?: string | null): string {
  if (role === "ADMIN") return "/admin/requests";
  if (role === "TEACHER") return "/teacher/classes";
  return "/student/dashboard";
}

/**
 * Chặn open-redirect: chỉ nhận đường dẫn nội bộ bắt đầu bằng `/` và không bắt đầu bằng `//` hay `/\`.
 * Không hợp lệ thì trả về trang mặc định theo vai trò.
 */
export function safeNextPath(next: unknown, role?: string | null): string {
  if (typeof next === "string") {
    const trimmed = next.trim();
    if (trimmed.startsWith("/") && !trimmed.startsWith("//") && !trimmed.startsWith("/\\")) {
      return trimmed;
    }
  }
  return roleHomePath(role);
}
