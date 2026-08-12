import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase-server";

// Initialize Supabase Admin Client using Service Role Key (or fallback anon key for dev)
const supabaseAdminUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://owlvfznycutvkrvgbiot.supabase.co";
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "sb_publishable_8X7i9iuqijcB9IspKxOugA_cMOElBaK";

const supabaseAdmin = createClient(supabaseAdminUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

export async function POST(req: Request) {
  try {
    const supabaseServer = await createServerClient();
    const {
      data: { user: callerUser },
    } = await supabaseServer.auth.getUser();

    // Check caller authorization
    const callerRole = callerUser?.user_metadata?.role || "STUDENT";
    if (!callerUser || (callerRole !== "ADMIN" && callerRole !== "TEACHER")) {
      return NextResponse.json(
        { success: false, error: "Bạn không có quyền khởi tạo tài khoản mới." },
        { status: 403 }
      );
    }

    const body = await req.json();
    const {
      email,
      username,
      password,
      name,
      phone,
      targetBand,
      role: targetRole,
      classIds,
    } = body;

    // Enforce role creation rules
    if (callerRole === "TEACHER" && targetRole !== "STUDENT") {
      return NextResponse.json(
        { success: false, error: "Giáo viên chỉ có quyền tạo tài khoản Học viên." },
        { status: 403 }
      );
    }

    const emailToUse = email?.trim() || `${(username || name || "user").trim().toLowerCase().replace(/\s+/g, "")}_${Date.now().toString().slice(-4)}@student.edu.vn`;
    const tempPassword = password?.trim() || "123456";

    // 1. Create User via Supabase Admin API
    const { data: createdAuth, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: emailToUse,
      password: tempPassword,
      email_confirm: true, // Auto-confirm email so student/teacher can login with temp password
      user_metadata: {
        full_name: name?.trim() || emailToUse.split("@")[0],
        name: name?.trim() || emailToUse.split("@")[0],
        phone: phone?.trim() || "",
        role: targetRole || "STUDENT",
        target_band: targetBand?.trim() || "IELTS 6.5",
        must_change_password: true, // Force onboarding password change on first login
      },
    });

    if (authError) {
      console.error("Supabase Admin createUser Error:", authError.message);
      return NextResponse.json(
        { success: false, error: authError.message },
        { status: 400 }
      );
    }

    const newUserId = createdAuth.user.id;

    // 2. Insert Enrollments if classIds provided
    if (Array.isArray(classIds) && classIds.length > 0) {
      const enrollmentRows = classIds.map((cId: string) => ({
        id: `enr_${Date.now().toString().slice(-4)}_${Math.floor(Math.random() * 1000)}`,
        student_id: newUserId,
        class_id: cId,
      }));
      await supabaseAdmin.from("enrollments").insert(enrollmentRows);
    }

    return NextResponse.json({
      success: true,
      user: {
        id: newUserId,
        email: emailToUse,
        name: name || emailToUse.split("@")[0],
        role: targetRole || "STUDENT",
        tempPassword,
      },
    });
  } catch (err: any) {
    console.error("API /api/admin/create-user Exception:", err);
    return NextResponse.json(
      { success: false, error: err.message || "Lỗi hệ thống khi tạo tài khoản." },
      { status: 500 }
    );
  }
}
