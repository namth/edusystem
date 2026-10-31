import crypto from "crypto";
import { NextResponse } from "next/server";
import { getAuthenticatedUserFromCookie, type TokenPayload } from "@/lib/auth";

export type Role = "ADMIN" | "TEACHER" | "STUDENT";

export type AuthResult =
  | { user: TokenPayload; error: null }
  | { user: null; error: NextResponse };

// Đọc phiên từ cookie (dùng getAuthenticatedUserFromCookie).
// Không có phiên/token hỏng → error 401 { success:false, error:"Bạn cần đăng nhập." }
// Có phiên nhưng role không thuộc `allowed` → error 403 { success:false, error:"Bạn không có quyền thực hiện thao tác này." }
// `allowed` bỏ trống = mọi vai trò đã đăng nhập.
export async function requireRole(allowed?: Role[]): Promise<AuthResult> {
  const user = await getAuthenticatedUserFromCookie();
  if (!user) {
    return {
      user: null,
      error: NextResponse.json(
        { success: false, error: "Bạn cần đăng nhập." },
        { status: 401 }
      ),
    };
  }

  if (allowed && allowed.length > 0) {
    if (!allowed.includes(user.role as Role)) {
      return {
        user: null,
        error: NextResponse.json(
          { success: false, error: "Bạn không có quyền thực hiện thao tác này." },
          { status: 403 }
        ),
      };
    }
  }

  return { user, error: null };
}

// true khi process.env.INTERNAL_API_TOKEN khác rỗng VÀ header `x-internal-token` bằng đúng giá trị đó
// (so sánh thời gian hằng, vd crypto.timingSafeEqual sau khi kiểm độ dài).
export function hasValidInternalToken(req: Request): boolean {
  const expected = process.env.INTERNAL_API_TOKEN;
  if (!expected || expected.trim() === "") {
    return false;
  }

  const provided = req.headers.get("x-internal-token");
  if (!provided) {
    return false;
  }

  try {
    const expectedBuf = Buffer.from(expected);
    const providedBuf = Buffer.from(provided);

    if (expectedBuf.length !== providedBuf.length) {
      return false;
    }

    return crypto.timingSafeEqual(expectedBuf, providedBuf);
  } catch {
    return false;
  }
}
