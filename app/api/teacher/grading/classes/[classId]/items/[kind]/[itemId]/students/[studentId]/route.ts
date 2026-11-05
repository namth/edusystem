import { NextResponse } from "next/server";
import { requireRole } from "@/lib/api-auth";
import { fail, loadItemData, resolveItem, toApiRow, upsertStudentCell } from "@/lib/gradebook-data";

type Ctx = { params: Promise<{ classId: string; kind: string; itemId: string; studentId: string }> };

// PUT /api/teacher/grading/classes/[classId]/items/[kind]/[itemId]/students/[studentId]
// Chọn lượt được tính / nhập điểm tay / ghi chú cho một ô.
export async function PUT(req: Request, context: Ctx) {
  const auth = await requireRole(["ADMIN", "TEACHER"]);
  if (auth.error) return auth.error;
  const { classId, kind: kindStr, itemId, studentId } = await context.params;

  try {
    const r = await resolveItem(auth.user, classId, kindStr, itemId);
    if (r.error) return r.error;
    const { cls, kind } = r;

    let body: any = {};
    try {
      body = await req.json();
    } catch {
      body = {};
    }
    if (!body || typeof body !== "object" || Array.isArray(body)) return fail(400, "Body không hợp lệ.");

    const data = await loadItemData(cls, kind, itemId);
    const row = data.rows.find((x) => x.student.id === studentId);
    if (!row) return fail(404, "Học sinh không ghi danh trong lớp.");

    // Hợp nhất với giá trị hiện có: chỉ trường được gửi mới đổi.
    let chosen: string | null = row.grade?.chosen_attempt_id ?? null;
    let manual: number | null =
      row.grade && row.grade.manual_score10 !== null && row.grade.manual_score10 !== undefined
        ? Number(row.grade.manual_score10)
        : null;
    let note: string | null = row.grade?.note ?? null;

    if (body.chosen_attempt_id !== undefined) {
      if (body.chosen_attempt_id !== null && (typeof body.chosen_attempt_id !== "string" || !body.chosen_attempt_id)) {
        return fail(400, "chosen_attempt_id không hợp lệ.");
      }
      if (body.chosen_attempt_id !== null && !row.recs.some((a) => a.lite.id === body.chosen_attempt_id)) {
        return fail(400, "Lượt không thuộc học sinh, bài và lớp này.");
      }
      chosen = body.chosen_attempt_id;
    }
    if (body.manual_score10 !== undefined) {
      if (body.manual_score10 !== null) {
        const m = body.manual_score10;
        if (typeof m !== "number" || !Number.isFinite(m) || m < 0 || m > 10) {
          return fail(400, "Điểm nhập tay phải nằm trong khoảng [0, 10].");
        }
      }
      manual = body.manual_score10;
    }
    if (body.note !== undefined) {
      if (body.note !== null && typeof body.note !== "string") return fail(400, "Ghi chú không hợp lệ.");
      if (typeof body.note === "string" && body.note.length > 2000) {
        return fail(400, "Ghi chú tối đa 2000 ký tự.");
      }
      note = body.note;
    }

    if (data.finalizedAt) {
      return fail(409, "Bài đã chốt — mở chốt để sửa.", { code: "GRADEBOOK_FINALIZED" });
    }

    await upsertStudentCell(cls, kind, itemId, studentId, { chosen_attempt_id: chosen, manual_score10: manual, note });

    const fresh = await loadItemData(cls, kind, itemId);
    const out = fresh.rows.find((x) => x.student.id === studentId)!;
    return NextResponse.json({ success: true, row: toApiRow(out, fresh.finalizedAt) });
  } catch (err: any) {
    console.error("PUT students/[studentId] error:", err);
    return fail(500, err.message || "Lỗi cập nhật ô điểm.");
  }
}
