import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || "https://owlvfznycutvkrvgbiot.supabase.co",
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "sb_publishable_8X7i9iuqijcB9IspKxOugA_cMOElBaK",
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const url = request.nextUrl.clone();
  const { pathname } = url;

  // Static assets & API routes bypass middleware checks
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api") ||
    pathname.includes(".") ||
    pathname === "/favicon.ico"
  ) {
    return supabaseResponse;
  }

  const isAuthPage =
    pathname === "/login" ||
    pathname === "/register" ||
    pathname === "/forgot-password" ||
    pathname === "/reset-password";

  const isChangePasswordPage = pathname === "/change-password";

  // Check if user has must_change_password flag
  const mustChangePassword =
    user?.user_metadata?.must_change_password === true ||
    user?.app_metadata?.must_change_password === true;

  // 1. Unauthenticated Users
  if (!user) {
    // If trying to access protected routes, redirect to login
    if (!isAuthPage && pathname !== "/") {
      url.pathname = "/login";
      url.searchParams.set("redirectTo", pathname);
      return NextResponse.redirect(url);
    }
    return supabaseResponse;
  }

  // 2. Authenticated Users with must_change_password = true
  if (mustChangePassword) {
    if (!isChangePasswordPage && pathname !== "/login") {
      url.pathname = "/change-password";
      return NextResponse.redirect(url);
    }
    return supabaseResponse;
  }

  // 3. Authenticated Users visiting Auth Pages (login/register)
  if (isAuthPage) {
    const role = user.user_metadata?.role || "STUDENT";
    if (role === "TEACHER") url.pathname = "/teacher/classes";
    else if (role === "ADMIN") url.pathname = "/admin/requests";
    else url.pathname = "/student/dashboard";
    return NextResponse.redirect(url);
  }

  // 4. Authenticated Users visiting /change-password when NOT needed
  if (isChangePasswordPage && !mustChangePassword) {
    const role = user.user_metadata?.role || "STUDENT";
    if (role === "TEACHER") url.pathname = "/teacher/classes";
    else if (role === "ADMIN") url.pathname = "/admin/requests";
    else url.pathname = "/student/dashboard";
    return NextResponse.redirect(url);
  }

  // 5. Role-Based Access Control (RBAC) Protection
  const role = user.user_metadata?.role || "STUDENT";

  if (pathname.startsWith("/teacher") && role !== "TEACHER" && role !== "ADMIN") {
    url.pathname = "/student/dashboard";
    return NextResponse.redirect(url);
  }

  if (pathname.startsWith("/admin") && role !== "ADMIN") {
    if (role === "TEACHER") url.pathname = "/teacher/classes";
    else url.pathname = "/student/dashboard";
    return NextResponse.redirect(url);
  }

  if (pathname.startsWith("/student") && role === "TEACHER") {
    // Teachers are allowed to view student routes or redirected if needed, keep accessible for grading/viewing
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
