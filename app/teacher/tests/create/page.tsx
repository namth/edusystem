"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import TeacherLayout from "@/components/TeacherLayout";
import QuestionSetEditor, { QuestionSetSavePayload } from "@/components/question-builder/QuestionSetEditor";
import { Loader2, AlertCircle, RefreshCw, ArrowLeft, Edit3 } from "lucide-react";

function TeacherTestCreateContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const editId = searchParams.get("editId");
  const tabParam = searchParams.get("tab");
  const modeParam = searchParams.get("mode");
  const sourceParam = searchParams.get("source");
  const courseIdParam = searchParams.get("courseId");
  const unitIdParam = searchParams.get("unitId");

  const [isLoading, setIsLoading] = useState(Boolean(editId));
  const [loadError, setLoadError] = useState<string | null>(null);

  const [initialData, setInitialData] = useState<{
    title?: string;
    description?: string;
    duration?: number;
    courseId?: string | null;
    scoring_standard_id?: string | null;
    questions?: any[];
    flashcards?: any[];
  }>({});

  const loadExam = useCallback(async (id: string) => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const res = await fetch(`/api/teacher/exams/${id}`);
      const data = await res.json().catch(() => null);

      if (!res.ok || !data?.success) {
        throw new Error(data?.error || "Không thể tải thông tin đề thi.");
      }

      setInitialData({
        title: data.exam?.title || "",
        description: data.exam?.description || "",
        duration: data.exam?.duration_minutes || 60,
        courseId: data.course_id || null,
        scoring_standard_id: data.exam?.scoring_standard_id || null,
        questions: data.questions || [],
        flashcards: data.flashcards || [],
      });
    } catch (err: any) {
      console.error("Load exam error:", err);
      setLoadError(err.message || "Lỗi tải thông tin đề thi.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (editId) {
      loadExam(editId);
    } else {
      setIsLoading(false);
      setLoadError(null);
      setInitialData({});
    }
  }, [editId, loadExam]);

  const handleSave = async (payload: QuestionSetSavePayload): Promise<{ ok: boolean; error?: string }> => {
    try {
      const url = editId ? `/api/teacher/exams/${editId}` : "/api/teacher/exams";
      const method = editId ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.success) {
        return { ok: false, error: data?.error || "Lỗi lưu đề thi." };
      }

      alert(editId ? "Đã cập nhật bộ đề thi & danh sách câu hỏi thành công!" : "Đã lưu bộ đề thi mới thành công!");
      router.push("/teacher/tests");
      return { ok: true };
    } catch (err: any) {
      console.error("Save exam error:", err);
      return { ok: false, error: err.message || "Lỗi kết nối khi lưu đề thi." };
    }
  };

  return (
    <TeacherLayout>
      <div className="max-w-[1280px] mx-auto space-y-6">
        {/* Edit Mode Banner */}
        {editId && !loadError && (
          <div className="p-4 rounded-2xl bg-amber-50 border border-amber-300 text-amber-900 flex items-center justify-between shadow-2xs">
            <div className="flex items-center space-x-2 text-xs font-bold">
              <Edit3 className="w-4 h-4 text-amber-700" />
              <span>
                Chế độ Chỉnh Sửa Bộ Đề: <strong className="text-brand-600">{initialData.title || editId}</strong> (ID: {editId})
              </span>
            </div>
            <Link
              href="/teacher/tests/create"
              className="text-xs font-bold text-amber-800 hover:underline bg-white px-3 py-1 rounded-lg border border-amber-200"
            >
              + Soạn Bộ Đề Mới Khác
            </Link>
          </div>
        )}

        {loadError ? (
          <div className="bg-red-50 border border-red-200 rounded-2xl p-6 text-center space-y-4">
            <div className="flex items-center justify-center gap-2 text-red-700 font-bold">
              <AlertCircle className="w-5 h-5" />
              <span>{loadError}</span>
            </div>
            <div className="flex items-center justify-center gap-3">
              <button
                type="button"
                onClick={() => editId && loadExam(editId)}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-xl transition flex items-center gap-2 cursor-pointer"
              >
                <RefreshCw className="w-4 h-4" />
                <span>Thử lại</span>
              </button>
              <Link
                href="/teacher/tests"
                className="px-4 py-2 bg-white border border-line text-ink-muted text-xs font-bold rounded-xl hover:bg-surface-alt transition flex items-center gap-2"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Quay lại danh sách</span>
              </Link>
            </div>
          </div>
        ) : (
          <QuestionSetEditor
            mode="EXAM"
            initialTitle={initialData.title}
            initialDescription={initialData.description}
            initialDuration={initialData.duration}
            initialCourseId={initialData.courseId || courseIdParam || null}
            initialScoringStandardId={initialData.scoring_standard_id || null}
            initialQuestions={initialData.questions}
            initialFlashcards={initialData.flashcards}
            isLoading={isLoading}
            onSave={handleSave}
            aiIngestProps={{
              initialDestinationType: sourceParam === "course" || courseIdParam ? "curriculum" : "standalone",
              initialCourseId: courseIdParam || undefined,
              initialUnitId: unitIdParam || undefined,
            }}
          />
        )}
      </div>
    </TeacherLayout>
  );
}

export default function TeacherTestCreatePage() {
  return (
    <Suspense
      fallback={
        <TeacherLayout>
          <div className="flex items-center justify-center py-20 text-xs font-bold text-brand-600 space-x-2">
            <Loader2 className="w-5 h-5 animate-spin text-brand-600" />
            <span>Đang tải trình biên soạn &amp; chỉnh sửa đề thi...</span>
          </div>
        </TeacherLayout>
      }
    >
      <TeacherTestCreateContent />
    </Suspense>
  );
}
