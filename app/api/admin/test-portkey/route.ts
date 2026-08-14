import { NextResponse } from "next/server";
import { callPortkeyGrading } from "@/lib/portkey";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { teacherId, userPrompt, studentId, submissionId } = body;

    if (!teacherId) {
      return NextResponse.json({ success: false, error: "Missing teacherId" }, { status: 400 });
    }

    const res = await callPortkeyGrading({
      systemPrompt: "You are an expert IELTS examiner. Grade the submission accurately and provide structured band scores and detailed feedback.",
      userPrompt: userPrompt || "Analyze this sample IELTS essay: 'Task 2: Some people think that universities should provide graduates with knowledge and skills needed in the workplace.'",
      teacherId: teacherId,
      studentId: studentId || "student_01",
      submissionId: submissionId || `test_sub_${Date.now().toString().slice(-4)}`,
    });

    return NextResponse.json({
      success: true,
      content: res.content,
      usage: res.usage,
      logId: res.logId,
      isSimulated: res.isSimulated,
    });
  } catch (err: any) {
    console.error("API /api/admin/test-portkey Error:", err);
    return NextResponse.json(
      { success: false, error: err.message || "Lỗi khi gọi Portkey AI Gateway." },
      { status: 500 }
    );
  }
}
