import { NextResponse } from "next/server";
import { requireRole } from "@/lib/api-auth";
import { duplicateExamInTx } from "@/lib/library-ops";

export async function POST(
  req: Request,
  props: { params: Promise<{ id: string }> }
) {
  const auth = await requireRole(["ADMIN", "TEACHER"]);
  if (auth.error) return auth.error;
  const authUser = auth.user;

  const { id } = await props.params;

  try {
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return NextResponse.json(
        { success: false, error: "Dữ liệu không hợp lệ." },
        { status: 400 }
      );
    }

    const cleanTitle = typeof body.title === "string" ? body.title.trim() : "";
    if (!cleanTitle || cleanTitle.length > 255) {
      return NextResponse.json(
        { success: false, error: "Tiêu đề đề thi phải từ 1 đến 255 ký tự." },
        { status: 400 }
      );
    }

    const outcome = await duplicateExamInTx(id, cleanTitle, authUser);
    if (outcome.status !== 201) {
      return NextResponse.json(
        { success: false, error: outcome.error },
        { status: outcome.status }
      );
    }

    return NextResponse.json({ success: true, exam: outcome.exam }, { status: 201 });
  } catch (err: any) {
    console.error("API /api/teacher/exams/[id]/duplicate POST Error:", err);
    return NextResponse.json(
      { success: false, error: err.message || "Lỗi nhân bản đề thi." },
      { status: 500 }
    );
  }
}
