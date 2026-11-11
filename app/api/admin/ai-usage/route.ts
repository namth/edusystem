import { NextResponse } from "next/server";
import { requireRole } from "@/lib/api-auth";
import { getAiUsageReport, type AiUsageReport } from "@/lib/ai-usage-report";

function csvCell(v: string | number | null | undefined): string {
  const s = v === null || v === undefined ? "" : String(v);
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function buildCsv(report: AiUsageReport): string {
  const header = [
    "Giáo viên",
    "Email",
    "Trạng thái",
    "Học sinh đã dùng",
    "Giới hạn slot",
    "Số lượt gọi AI",
    "Token đầu vào",
    "Token đầu ra",
    "Tổng token",
    "Chi phí (đ)",
    "Chi phí chấm đề (đ)",
    "Chi phí chấm bài học (đ)",
    "Chi phí nhập đề (đ)",
    "Chi phí khác (đ)",
    "Doanh thu (đ)",
    "Chênh lệch (đ)",
  ];
  const lines = [header.map(csvCell).join(",")];
  for (const t of report.teachers) {
    lines.push(
      [
        t.name,
        t.email,
        t.teacher_status ?? "",
        t.students_used,
        t.slot_limit,
        t.requests,
        t.prompt_tokens,
        t.completion_tokens,
        t.total_tokens,
        t.cost_vnd,
        t.by_purpose.EXAM_GRADING.cost_vnd,
        t.by_purpose.LESSON_GRADING.cost_vnd,
        t.by_purpose.EXAM_IMPORT.cost_vnd,
        t.by_purpose.OTHER.cost_vnd,
        t.revenue_vnd,
        t.margin_vnd,
      ]
        .map(csvCell)
        .join(",")
    );
  }
  lines.push(
    [
      "Chưa gán giáo viên",
      "",
      "",
      "",
      "",
      report.unattributed.requests,
      "",
      "",
      report.unattributed.tokens,
      report.unattributed.cost_vnd,
      "",
      "",
      "",
      "",
      "",
      "",
    ]
      .map(csvCell)
      .join(",")
  );
  return "\uFEFF" + lines.join("\r\n") + "\r\n";
}

export async function GET(req: Request) {
  const auth = await requireRole(["ADMIN"]);
  if (auth.error) return auth.error;

  const { searchParams } = new URL(req.url);
  const rawMonth = searchParams.get("month");
  if (rawMonth !== null && rawMonth !== "" && !/^\d{4}-(0[1-9]|1[0-2])$/.test(rawMonth)) {
    return NextResponse.json(
      { success: false, error: "Định dạng tháng không hợp lệ (YYYY-MM)." },
      { status: 400 }
    );
  }

  try {
    const report = await getAiUsageReport({ month: rawMonth });

    if (searchParams.get("format") === "csv") {
      return new Response(buildCsv(report), {
        status: 200,
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="ai-usage-${report.month}.csv"`,
        },
      });
    }

    return NextResponse.json({ success: true, ...report });
  } catch (error) {
    console.error("AI usage report error:", error);
    return NextResponse.json(
      { success: false, error: "Lỗi tải báo cáo chi phí AI." },
      { status: 500 }
    );
  }
}
