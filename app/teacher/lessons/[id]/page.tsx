"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import TeacherLayout from "@/components/TeacherLayout";
import QuestionSetEditor, {
  QuestionSetSavePayload,
} from "@/components/question-builder/QuestionSetEditor";
import { StudentPreviewButton } from "@/components/teacher/StudentPreviewModal";
import {
  ArrowLeft,
  Loader2,
  AlertCircle,
  RefreshCw,
  ShieldAlert,
  FileQuestion,
} from "lucide-react";

interface LessonData {
  title: string;
  description: string;
  questions: any[];
  flashcards: any[];
}

export default function TeacherLessonDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = (params?.id as string) || "";

  const isNew = id === "new";

  const [isLoading, setIsLoading] = useState(!isNew);
  const [errorCode, setErrorCode] = useState<number | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [lessonData, setLessonData] = useState<LessonData>({
    title: "",
    description: "",
    questions: [],
    flashcards: [],
  });

  const loadLesson = useCallback(async () => {
    if (isNew) {
      setIsLoading(false);
      setErrorCode(null);
      setErrorMessage(null);
      return;
    }

    setIsLoading(true);
    setErrorCode(null);
    setErrorMessage(null);

    try {
      const res = await fetch(`/api/teacher/lessons/${id}`);
      const json = await res.json().catch(() => null);

      if (res.status === 403) {
        setErrorCode(403);
        setErrorMessage(json?.error || "Bạn không có quyền xem bài học này.");
        return;
      }

      if (res.status === 404) {
        setErrorCode(404);
        setErrorMessage(json?.error || "Không tìm thấy bài học.");
        return;
      }

      if (!res.ok || !json?.success) {
        setErrorCode(res.status || 500);
        setErrorMessage(json?.error || "Lỗi nạp bài học.");
        return;
      }

      setLessonData({
        title: json.lesson?.title || "",
        description: json.lesson?.description || "",
        questions: Array.isArray(json.questions) ? json.questions : [],
        flashcards: Array.isArray(json.flashcards) ? json.flashcards : [],
      });
    } catch (err: any) {
      console.error("Load lesson error:", err);
      setErrorCode(500);
      setErrorMessage(err.message || "Lỗi kết nối khi tải bài học.");
    } finally {
      setIsLoading(false);
    }
  }, [id, isNew]);

  useEffect(() => {
    loadLesson();
  }, [loadLesson]);

  const handleSave = async (
    payload: QuestionSetSavePayload
  ): Promise<{ ok: boolean; error?: string }> => {
    try {
      if (id === "new") {
        // Step 1: POST /api/teacher/lessons { title, description }
        const createRes = await fetch("/api/teacher/lessons", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: payload.title,
            description: payload.description,
          }),
        });

        const createJson = await createRes.json().catch(() => null);
        if (!createRes.ok || !createJson?.success) {
          return { ok: false, error: createJson?.error || "Lỗi tạo bài học mới." };
        }

        const newLessonId = createJson.lesson.id;

        // Step 2: PUT /api/teacher/lessons/{id} { question_ids }
        const putRes = await fetch(`/api/teacher/lessons/${newLessonId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            question_ids: payload.question_ids,
          }),
        });

        const putJson = await putRes.json().catch(() => null);
        if (!putRes.ok || !putJson?.success) {
          return { ok: false, error: putJson?.error || "Lỗi lưu danh sách câu hỏi." };
        }

        router.replace(`/teacher/lessons/${newLessonId}`);
        return { ok: true };
      } else {
        // id có sẵn: PUT /api/teacher/lessons/{id} { title, description, question_ids }
        const res = await fetch(`/api/teacher/lessons/${id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: payload.title,
            description: payload.description,
            question_ids: payload.question_ids,
          }),
        });

        const json = await res.json().catch(() => null);
        if (!res.ok || !json?.success) {
          return { ok: false, error: json?.error || "Lỗi cập nhật bài học." };
        }

        return { ok: true };
      }
    } catch (err: any) {
      console.error("Save lesson error:", err);
      return { ok: false, error: err.message || "Lỗi kết nối khi lưu bài học." };
    }
  };

  return (
    <TeacherLayout>
      <div className="max-w-[1280px] mx-auto space-y-6">
        {/* Navigation Bar */}
        <div className="flex items-center justify-between">
          <Link
            href="/teacher/library?tab=lessons"
            className="inline-flex items-center space-x-2 text-xs font-bold text-brand-600 hover:text-brand-700 bg-brand-50 hover:bg-brand-100 px-4 py-2 rounded-xl transition-all border border-line"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>← Kho bài học</span>
          </Link>

          {!isNew && !isLoading && !errorMessage && (
            <div className="flex items-center gap-3">
              {/* Xem trước như học sinh (SCR-L3) — modal dùng chung, nạp qua /api/teacher/lessons/[id]/preview */}
              <StudentPreviewButton kind="lesson" id={id} title={lessonData.title} />
              <span className="text-xs text-ink-muted font-medium">
                ID bài học: <code className="bg-gray-100 px-2 py-0.5 rounded text-[11px]">{id}</code>
              </span>
            </div>
          )}
        </div>

        {/* Loading State */}
        {isLoading && (
          <div className="bg-white p-16 rounded-2xl border border-line shadow-sm flex flex-col items-center justify-center text-center space-y-3">
            <Loader2 className="w-8 h-8 animate-spin text-brand-600" />
            <p className="text-xs font-semibold text-ink-muted">Đang tải thông tin bài học...</p>
          </div>
        )}

        {/* 403 Forbidden State */}
        {!isLoading && errorCode === 403 && (
          <div className="bg-amber-50 border border-amber-300 p-10 rounded-2xl text-center space-y-4">
            <div className="w-14 h-14 rounded-2xl bg-amber-100 text-amber-700 mx-auto flex items-center justify-center">
              <ShieldAlert className="w-7 h-7" />
            </div>
            <div>
              <h2 className="text-base font-bold text-amber-900">403 — Không có quyền truy cập</h2>
              <p className="text-xs text-amber-800 mt-1 max-w-md mx-auto">
                {errorMessage || "Bạn không có quyền xem bài học này."}
              </p>
            </div>
            <Link
              href="/teacher/library?tab=lessons"
              className="inline-flex items-center px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs"
            >
              Quay lại Kho bài học
            </Link>
          </div>
        )}

        {/* 404 Not Found State */}
        {!isLoading && errorCode === 404 && (
          <div className="bg-white border border-line p-10 rounded-2xl text-center space-y-4 shadow-sm">
            <div className="w-14 h-14 rounded-2xl bg-gray-100 text-gray-600 mx-auto flex items-center justify-center">
              <FileQuestion className="w-7 h-7" />
            </div>
            <div>
              <h2 className="text-base font-bold text-ink">404 — Không tìm thấy bài học</h2>
              <p className="text-xs text-ink-muted mt-1 max-w-md mx-auto">
                {errorMessage || "Không tìm thấy bài học hoặc bài học đã bị xóa."}
              </p>
            </div>
            <Link
              href="/teacher/library?tab=lessons"
              className="inline-flex items-center px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs"
            >
              Về Kho bài học
            </Link>
          </div>
        )}

        {/* Other Errors with Retry */}
        {!isLoading && errorCode !== 403 && errorCode !== 404 && errorMessage && (
          <div className="bg-rose-50 border border-rose-200 p-8 rounded-2xl text-center space-y-4">
            <div className="w-12 h-12 rounded-full bg-rose-100 text-rose-600 mx-auto flex items-center justify-center">
              <AlertCircle className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-rose-900">Lỗi tải dữ liệu</h3>
              <p className="text-xs text-rose-700 mt-1">{errorMessage}</p>
            </div>
            <button
              onClick={loadLesson}
              className="inline-flex items-center px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition-all space-x-1.5 shadow-2xs"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Thử lại</span>
            </button>
          </div>
        )}

        {/* Main Editor Component */}
        {!isLoading && !errorMessage && (
          <div className="bg-white rounded-2xl border border-line shadow-sm p-6">
            <QuestionSetEditor
              mode="LESSON"
              initialTitle={lessonData.title}
              initialDescription={lessonData.description}
              initialQuestions={lessonData.questions}
              initialFlashcards={lessonData.flashcards}
              saveLabel={isNew ? "Tạo bài học" : "Lưu bài học"}
              onSave={handleSave}
            />
          </div>
        )}

      </div>
    </TeacherLayout>
  );
}
