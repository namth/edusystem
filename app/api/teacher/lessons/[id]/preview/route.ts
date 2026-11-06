// Xem trước như học sinh (SCR-L3) — nội dung đã ẩn đáp án + chấm thử không lưu. Logic chung: lib/teacher-preview.ts
import { previewContent, previewGrade } from "@/lib/teacher-preview";

export async function GET(req: Request, props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;
  return previewContent("lesson", id);
}

export async function POST(req: Request, props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;
  return previewGrade("lesson", id, req);
}
