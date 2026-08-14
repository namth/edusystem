import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function GET() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

  const results: Record<string, any> = {
    timestamp: new Date().toISOString(),
    config: { supabaseUrl, hasServiceRoleKey: !!serviceRoleKey },
    tests: {},
  };

  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // Test Step 1: auth.users creation with exact teacher metadata
  let testUserId: string | null = null;
  const testEmail = `teacher_fulltest_${Date.now()}@example.com`;

  try {
    const { data: cData, error: cError } = await supabaseAdmin.auth.admin.createUser({
      email: testEmail,
      password: "password123",
      email_confirm: true,
      user_metadata: {
        full_name: "Thầy Test Full Flow",
        name: "Thầy Test Full Flow",
        phone: "0912345678",
        role: "TEACHER",
        target_band: "M.A TESOL",
        must_change_password: true,
      },
    });

    if (cError) {
      results.tests.step1_authUsers = { success: false, error: cError };
    } else {
      testUserId = cData?.user?.id || null;
      results.tests.step1_authUsers = { success: true, createdId: testUserId };
    }
  } catch (e: any) {
    results.tests.step1_authUsers = { success: false, exception: e.message };
  }

  // Test Step 2: public.users upsert with the exact payload used in create-user route
  if (testUserId) {
    try {
      const { data: dbData, error: dbError } = await supabaseAdmin
        .from("users")
        .upsert([
          {
            id: testUserId,
            name: "Thầy Test Full Flow",
            email: testEmail,
            role: "TEACHER",
            phone: "0912345678",
            target_band: "M.A TESOL",
          },
        ])
        .select();

      if (dbError) {
        results.tests.step2_publicUsersUpsert = { success: false, error: dbError };
      } else {
        results.tests.step2_publicUsersUpsert = { success: true, row: dbData };
      }
    } catch (e: any) {
      results.tests.step2_publicUsersUpsert = { success: false, exception: e.message };
    }

    // Cleanup test user from both tables
    try {
      await supabaseAdmin.from("users").delete().eq("id", testUserId);
      await supabaseAdmin.auth.admin.deleteUser(testUserId);
      results.tests.cleanup = { success: true };
    } catch (e: any) {
      results.tests.cleanup = { success: false, error: e.message };
    }
  }

  return NextResponse.json(results, { status: 200 });
}
