import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { verifyJwtToken } from "@/lib/jwt";

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const token = req.cookies.get("auth_token")?.value;

  let userRole: string | null = null;
  if (token) {
    // Cryptographically verify HS256 signature using Edge-compatible Web Crypto API
    const payload = await verifyJwtToken(token);
    userRole = payload?.role || null;
  }

  // Guard Admin Routes
  if (pathname.startsWith("/admin")) {
    if (!userRole || userRole !== "ADMIN") {
      return NextResponse.redirect(new URL("/login", req.url));
    }
  }

  // Guard Teacher Routes
  if (pathname.startsWith("/teacher")) {
    if (!userRole || (userRole !== "TEACHER" && userRole !== "ADMIN")) {
      return NextResponse.redirect(new URL("/login", req.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/teacher/:path*"],
};
