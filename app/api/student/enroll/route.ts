import { NextResponse } from "next/server";
import { requireRole } from "@/lib/api-auth";
import { enrollStudentByCode } from "@/lib/enrollment";

export async function POST(request: Request) {
  const auth = await requireRole(["STUDENT"]);
  if (auth.error) return auth.error;

  try {
    const body = await request.json().catch(() => ({}));
    const rawCode = typeof body.code === "string" ? body.code.trim() : "";

    const result = await enrollStudentByCode(auth.user.userId, rawCode);

    if (!result.ok) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: result.status }
      );
    }

    return NextResponse.json({
      success: true,
      class: result.class,
      alreadyEnrolled: result.alreadyEnrolled,
    });
  } catch (err: any) {
    console.error("POST /api/student/enroll error:", err);
    return NextResponse.json(
      { success: false, error: err.message || "Lỗi ghi danh lớp học." },
      { status: 500 }
    );
  }
}
