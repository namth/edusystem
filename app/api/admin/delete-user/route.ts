import { NextResponse } from "next/server";
import { queryPg } from "@/lib/db-pg";
import { runCypherQuery } from "@/lib/neo4j";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { userId } = body;

    if (!userId?.trim()) {
      return NextResponse.json(
        { success: false, error: "Vui lòng cung cấp User ID cần xóa." },
        { status: 400 }
      );
    }

    const targetUserId = userId.trim();

    // 1. Delete enrollments from PostgreSQL
    try {
      await queryPg(`DELETE FROM enrollments WHERE student_id = $1;`, [targetUserId]);
    } catch (e) {
      console.warn("Delete enrollments warning:", e);
    }

    // 2. Delete user from PostgreSQL public.users table
    const result = await queryPg(`DELETE FROM users WHERE id = $1 RETURNING id;`, [targetUserId]);

    // 3. Polyglot Sync: Remove Node/Edges from Neo4j Graph DB
    try {
      await runCypherQuery(
        `MATCH (n {id: $targetUserId}) DETACH DELETE n`,
        { targetUserId }
      );
    } catch (graphErr) {
      console.warn("Neo4j Delete Node Warning:", graphErr);
    }

    return NextResponse.json({
      success: true,
      deletedCount: result.rowCount,
      message: `Đã xóa thành công tài khoản ID ${targetUserId} khỏi CSDL PostgreSQL & Neo4j.`,
    });
  } catch (err: any) {
    console.error("API /api/admin/delete-user Exception:", err);
    return NextResponse.json(
      { success: false, error: err.message || "Lỗi hệ thống khi xóa người dùng." },
      { status: 500 }
    );
  }
}
