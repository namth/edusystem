import { NextResponse } from "next/server";
import { queryPg } from "@/lib/db-pg";

export async function GET() {
  const results: Record<string, any> = {
    timestamp: new Date().toISOString(),
    connectionMode: "Native PostgreSQL Pool (pg)",
    tests: {},
  };

  try {
    // Test 1: Query database time & PostgreSQL version
    const versionRes = await queryPg("SELECT version(), NOW() as current_time;");
    results.tests.postgresConnection = {
      success: true,
      serverTime: versionRes.rows[0]?.current_time,
      postgresVersion: versionRes.rows[0]?.version?.slice(0, 50),
    };

    // Test 2: Query count of users from public.users table
    const countRes = await queryPg("SELECT COUNT(*)::int as count FROM users;");
    results.tests.usersTableQuery = {
      success: true,
      totalUsers: countRes.rows[0]?.count ?? 0,
    };

    // Test 3: Insert & Delete temporary test user
    const testId = `usr_test_${Date.now()}`;
    const testEmail = `test_pg_pool_${Date.now()}@example.com`;

    await queryPg(
      `INSERT INTO users (id, name, email, password, role, created_at) VALUES ($1, $2, $3, $4, $5, NOW());`,
      [testId, "Test Native PG User", testEmail, "password123", "TEACHER"]
    );

    const checkIns = await queryPg("SELECT id, name, email, role FROM users WHERE id = $1;", [testId]);
    await queryPg("DELETE FROM users WHERE id = $1;", [testId]);

    results.tests.nativePgCrudTest = {
      success: checkIns.rows.length === 1,
      testUser: checkIns.rows[0],
      note: "Khởi tạo, truy vấn và dọn dẹp user thành công 100% qua Native PostgreSQL Pool!",
    };
  } catch (err: any) {
    results.tests.error = {
      success: false,
      message: err.message,
      code: err.code,
    };
  }

  return NextResponse.json(results, { status: 200 });
}
