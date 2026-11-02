import { NextResponse } from "next/server";
import { requireRole } from "@/lib/api-auth";
import {
  convertExamToLessonItem,
  convertLessonToExamItem,
  ConvertItemResult,
} from "@/lib/library-ops";

export async function POST(req: Request) {
  const auth = await requireRole(["ADMIN", "TEACHER"]);
  if (auth.error) return auth.error;
  const authUser = auth.user;

  try {
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return NextResponse.json(
        { success: false, error: "Dữ liệu không hợp lệ." },
        { status: 400 }
      );
    }

    const { from, ids, duration_minutes } = body;

    if (from !== "lesson" && from !== "exam") {
      return NextResponse.json(
        { success: false, error: "Tham số 'from' phải là 'lesson' hoặc 'exam'." },
        { status: 400 }
      );
    }

    if (
      !Array.isArray(ids) ||
      ids.length === 0 ||
      ids.length > 50 ||
      ids.some((id) => typeof id !== "string" || !id.trim())
    ) {
      return NextResponse.json(
        { success: false, error: "Danh sách 'ids' phải là mảng từ 1 đến 50 chuỗi ID." },
        { status: 400 }
      );
    }

    let durationMinutes = 30;
    if (duration_minutes !== undefined) {
      if (
        typeof duration_minutes !== "number" ||
        !Number.isInteger(duration_minutes) ||
        duration_minutes < 1
      ) {
        return NextResponse.json(
          { success: false, error: "Thời gian làm bài phải là số nguyên ≥ 1." },
          { status: 400 }
        );
      }
      durationMinutes = duration_minutes;
    }

    const results: ConvertItemResult[] = [];
    for (const rawId of ids) {
      const id = rawId.trim();
      if (from === "lesson") {
        const resItem = await convertLessonToExamItem(id, authUser, durationMinutes);
        results.push(resItem);
      } else {
        const resItem = await convertExamToLessonItem(id, authUser);
        results.push(resItem);
      }
    }

    return NextResponse.json({ success: true, results }, { status: 200 });
  } catch (err: any) {
    console.error("API /api/teacher/library/convert POST Error:", err);
    return NextResponse.json(
      { success: false, error: err.message || "Lỗi chuyển đổi mục thư viện." },
      { status: 500 }
    );
  }
}
