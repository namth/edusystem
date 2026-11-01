"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import TeacherLayout from "@/components/TeacherLayout";
import QuestionSetEditor, {
  QuestionSetSavePayload,
} from "@/components/question-builder/QuestionSetEditor";
import LessonPlayer, {
  GradeResult,
  FlashcardItem,
} from "@/components/lesson-player/LessonPlayer";
import { emptyAnswerFor, countAnswered } from "@/lib/lesson-player";
import {
  ArrowLeft,
  Loader2,
  AlertCircle,
  RefreshCw,
  ShieldAlert,
  FileQuestion,
  Eye,
  X,
  RotateCcw,
  CheckCircle2,
  Sparkles,
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

  // State cho Modal Xem trước như học sinh (SCR-L3)
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [previewLesson, setPreviewLesson] = useState<{
    id: string;
    title: string;
    description?: string;
  } | null>(null);
  const [previewQuestions, setPreviewQuestions] = useState<any[]>([]);
  const [previewFlashcards, setPreviewFlashcards] = useState<FlashcardItem[]>([]);
  const [previewAnswers, setPreviewAnswers] = useState<Record<string, unknown>>({});
  const [previewResults, setPreviewResults] = useState<GradeResult[] | null>(null);
  const [previewScore, setPreviewScore] = useState<{
    objective_earned: number;
    objective_max: number;
    ai_max: number;
    score_percent: number;
  } | null>(null);
  const [isPreviewSubmitting, setIsPreviewSubmitting] = useState(false);
  const [previewSubmitError, setPreviewSubmitError] = useState<string | null>(null);

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

  // Logic nạp bản xem trước (SCR-L3)
  const loadPreview = useCallback(async () => {
    if (isNew || !id) return;
    setPreviewLoading(true);
    setPreviewError(null);
    setPreviewSubmitError(null);
    setPreviewResults(null);
    setPreviewScore(null);

    try {
      const res = await fetch(`/api/teacher/lessons/${id}/preview`);
      const json = await res.json().catch(() => null);

      if (!res.ok || !json?.success) {
        setPreviewError(json?.error || "Không thể tải nội dung xem trước bài học.");
        return;
      }

      const qs: any[] = Array.isArray(json.questions) ? json.questions : [];
      const fcs: FlashcardItem[] = Array.isArray(json.flashcards) ? json.flashcards : [];
      setPreviewLesson(json.lesson || null);
      setPreviewQuestions(qs);
      setPreviewFlashcards(fcs);

      const initAnswers: Record<string, unknown> = {};
      for (const q of qs) {
        initAnswers[q.id] = emptyAnswerFor(q);
      }
      setPreviewAnswers(initAnswers);
    } catch (err: any) {
      console.error("Preview load error:", err);
      setPreviewError(err.message || "Lỗi kết nối khi tải xem trước bài học.");
    } finally {
      setPreviewLoading(false);
    }
  }, [id, isNew]);

  const handleOpenPreview = () => {
    setShowPreviewModal(true);
    loadPreview();
  };

  const handleClosePreview = () => {
    setShowPreviewModal(false);
    setPreviewResults(null);
    setPreviewScore(null);
    setPreviewSubmitError(null);
  };

  const handleResetPreview = () => {
    setPreviewResults(null);
    setPreviewScore(null);
    setPreviewSubmitError(null);
    const initAnswers: Record<string, unknown> = {};
    for (const q of previewQuestions) {
      initAnswers[q.id] = emptyAnswerFor(q);
    }
    setPreviewAnswers(initAnswers);
  };

  const handleGradePreview = async () => {
    setIsPreviewSubmitting(true);
    setPreviewSubmitError(null);

    try {
      const res = await fetch(`/api/teacher/lessons/${id}/preview`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers: previewAnswers }),
      });

      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.success) {
        setPreviewSubmitError(json?.error || "Lỗi khi chấm thử.");
        return;
      }

      setPreviewResults(json.results || []);
      setPreviewScore({
        objective_earned: Number(json.objective_earned) || 0,
        objective_max: Number(json.objective_max) || 0,
        ai_max: Number(json.ai_max) || 0,
        score_percent: Number(json.score_percent) || 0,
      });
    } catch (err: any) {
      console.error("Preview grade error:", err);
      setPreviewSubmitError(err.message || "Lỗi kết nối khi chấm thử.");
    } finally {
      setIsPreviewSubmitting(false);
    }
  };

  const answeredCount = useMemo(() => {
    return countAnswered(previewQuestions, previewAnswers);
  }, [previewQuestions, previewAnswers]);

  return (
    <TeacherLayout>
      <div className="max-w-[1280px] mx-auto space-y-6">
        {/* Navigation Bar */}
        <div className="flex items-center justify-between">
          <Link
            href="/teacher/library?tab=lessons"
            className="inline-flex items-center space-x-2 text-xs font-bold text-[#6d3807] hover:text-[#8a4f1e] bg-[#fff1ea] hover:bg-[#ffdcc5] px-4 py-2 rounded-xl transition-all border border-[#d8c2b6]"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>← Kho bài học</span>
          </Link>

          {!isNew && !isLoading && !errorMessage && (
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={handleOpenPreview}
                className="inline-flex items-center space-x-1.5 text-xs font-bold text-[#6d3807] hover:text-[#8a4f1e] bg-white hover:bg-[#fff1ea] px-4 py-2 rounded-xl transition-all border border-[#6d3807] shadow-2xs cursor-pointer"
              >
                <Eye className="w-4 h-4" />
                <span>Xem trước như học sinh</span>
              </button>
              <span className="text-xs text-[#52443a] font-medium">
                ID bài học: <code className="bg-gray-100 px-2 py-0.5 rounded text-[11px]">{id}</code>
              </span>
            </div>
          )}
        </div>

        {/* Loading State */}
        {isLoading && (
          <div className="bg-white p-16 rounded-2xl border border-[#d8c2b6] shadow-sm flex flex-col items-center justify-center text-center space-y-3">
            <Loader2 className="w-8 h-8 animate-spin text-[#6d3807]" />
            <p className="text-xs font-semibold text-[#52443a]">Đang tải thông tin bài học...</p>
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
              className="inline-flex items-center px-4 py-2 bg-[#6d3807] hover:bg-[#8a4f1e] text-white rounded-xl text-xs font-bold transition-all shadow-xs"
            >
              Quay lại Kho bài học
            </Link>
          </div>
        )}

        {/* 404 Not Found State */}
        {!isLoading && errorCode === 404 && (
          <div className="bg-white border border-[#d8c2b6] p-10 rounded-2xl text-center space-y-4 shadow-sm">
            <div className="w-14 h-14 rounded-2xl bg-gray-100 text-gray-600 mx-auto flex items-center justify-center">
              <FileQuestion className="w-7 h-7" />
            </div>
            <div>
              <h2 className="text-base font-bold text-[#211a16]">404 — Không tìm thấy bài học</h2>
              <p className="text-xs text-[#52443a] mt-1 max-w-md mx-auto">
                {errorMessage || "Không tìm thấy bài học hoặc bài học đã bị xóa."}
              </p>
            </div>
            <Link
              href="/teacher/library?tab=lessons"
              className="inline-flex items-center px-4 py-2 bg-[#6d3807] hover:bg-[#8a4f1e] text-white rounded-xl text-xs font-bold transition-all shadow-xs"
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
          <div className="bg-white rounded-2xl border border-[#d8c2b6] shadow-sm p-6">
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

        {/* Modal Toàn màn hình: Xem trước như học sinh (SCR-L3) */}
        {showPreviewModal && (
          <div className="fixed inset-0 z-50 bg-[#fcf9f7] flex flex-col overflow-hidden animate-in fade-in duration-200">
            {/* Header Modal */}
            <div className="h-16 shrink-0 border-b border-[#ede0d9] bg-white px-4 sm:px-8 flex items-center justify-between shadow-2xs">
              <div className="flex items-center gap-3 overflow-hidden">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#fff1ea] text-[#6d3807] border border-[#ffb782]">
                  <Eye className="w-5 h-5" />
                </span>
                <div className="truncate">
                  <div className="flex items-center gap-2">
                    <h2 className="font-headline font-bold text-base text-[#211a16] truncate">
                      Xem trước như học sinh: {previewLesson?.title || lessonData.title || "Bài học"}
                    </h2>
                    <span className="hidden sm:inline-flex rounded-full bg-amber-100 text-amber-800 border border-amber-300 px-2 py-0.5 text-[11px] font-bold">
                      Không lưu kết quả
                    </span>
                  </div>
                  <p className="text-[11px] text-[#52443a] truncate">
                    Nội dung đã ẩn đáp án đúng như học sinh nhìn thấy.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleClosePreview}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-[#d8c2b6] bg-white px-3.5 py-1.5 text-xs font-bold text-[#52443a] hover:bg-gray-50 hover:text-[#211a16] transition-all cursor-pointer"
                >
                  <X className="w-4 h-4" />
                  <span>Đóng</span>
                </button>
              </div>
            </div>

            {/* Body Modal */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 md:p-8">
              <div className="max-w-4xl mx-auto space-y-6">
                {/* Trạng thái 1: Đang tải */}
                {previewLoading && (
                  <div className="bg-white p-16 rounded-2xl border border-[#d8c2b6] shadow-sm flex flex-col items-center justify-center text-center space-y-3">
                    <Loader2 className="w-8 h-8 animate-spin text-[#6d3807]" />
                    <p className="text-xs font-semibold text-[#52443a]">
                      Đang tải nội dung xem trước bài học...
                    </p>
                  </div>
                )}

                {/* Trạng thái 2: Lỗi tải dữ liệu */}
                {!previewLoading && previewError && (
                  <div className="bg-rose-50 border border-rose-200 p-8 rounded-2xl text-center space-y-4">
                    <div className="w-12 h-12 rounded-full bg-rose-100 text-rose-600 mx-auto flex items-center justify-center">
                      <AlertCircle className="w-6 h-6" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-rose-900">Không thể tải bản xem trước</h3>
                      <p className="text-xs text-rose-700 mt-1">{previewError}</p>
                    </div>
                    <button
                      onClick={loadPreview}
                      className="inline-flex items-center px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition-all space-x-1.5 shadow-2xs cursor-pointer"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      <span>Thử lại</span>
                    </button>
                  </div>
                )}

                {/* Trạng thái 3: Rỗng (không có câu hỏi) */}
                {!previewLoading && !previewError && previewQuestions.length === 0 && (
                  <div className="bg-white border border-[#d8c2b6] p-12 rounded-2xl text-center space-y-3 shadow-xs">
                    <FileQuestion className="w-10 h-10 text-gray-400 mx-auto" />
                    <h3 className="text-sm font-bold text-[#211a16]">Bài học chưa có câu hỏi</h3>
                    <p className="text-xs text-[#52443a] max-w-sm mx-auto">
                      Hãy thêm ít nhất một khối câu hỏi trong trang soạn bài trước khi xem trước.
                    </p>
                    <button
                      type="button"
                      onClick={handleClosePreview}
                      className="inline-flex items-center px-4 py-2 bg-[#6d3807] hover:bg-[#8a4f1e] text-white rounded-xl text-xs font-bold transition-all shadow-2xs cursor-pointer"
                    >
                      Đóng xem trước
                    </button>
                  </div>
                )}

                {/* Trạng thái 4: Có dữ liệu câu hỏi */}
                {!previewLoading && !previewError && previewQuestions.length > 0 && (
                  <>
                    {/* Bảng kết quả sau khi chấm thử */}
                    {previewResults && previewScore && (
                      <div className="rounded-2xl border border-emerald-300 bg-emerald-50/60 p-6 shadow-xs space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                          <div className="flex items-center gap-3">
                            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-600 text-white shadow-xs">
                              <CheckCircle2 className="h-6 w-6" />
                            </div>
                            <div>
                              <h3 className="font-headline font-bold text-lg text-emerald-950">
                                Kết quả chấm thử: {previewScore.score_percent}%
                              </h3>
                              <p className="text-xs font-medium text-emerald-800">
                                Đúng {previewScore.objective_earned} / {previewScore.objective_max} điểm trắc nghiệm & khách quan.
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={handleResetPreview}
                              className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-400 bg-white px-3.5 py-2 text-xs font-bold text-emerald-900 hover:bg-emerald-50 transition-all cursor-pointer shadow-2xs"
                            >
                              <RotateCcw className="w-3.5 h-3.5" />
                              <span>Làm lại</span>
                            </button>
                          </div>
                        </div>

                        {/* Ghi chú về câu hỏi AI */}
                        <div className="flex items-center gap-2 rounded-xl bg-amber-50 border border-amber-200 px-3.5 py-2.5 text-xs text-amber-900 font-medium">
                          <Sparkles className="w-4 h-4 text-amber-700 shrink-0" />
                          <span>Phần tự luận chỉ được AI chấm khi học sinh làm bài.</span>
                        </div>
                      </div>
                    )}

                    {/* Lỗi khi bấm chấm thử */}
                    {previewSubmitError && (
                      <div className="rounded-xl border border-rose-300 bg-rose-50 p-4 text-xs font-medium text-rose-800 flex items-center gap-2">
                        <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                        <span>{previewSubmitError}</span>
                      </div>
                    )}

                    {/* Trình làm bài LessonPlayer */}
                    <LessonPlayer
                      questions={previewQuestions}
                      flashcards={previewFlashcards}
                      answers={previewAnswers}
                      onChange={(qId, val) =>
                        setPreviewAnswers((prev) => ({ ...prev, [qId]: val }))
                      }
                      results={previewResults}
                      disabled={isPreviewSubmitting || Boolean(previewResults)}
                    />
                  </>
                )}
              </div>
            </div>

            {/* Footer Modal */}
            <div className="h-16 shrink-0 border-t border-[#ede0d9] bg-white px-4 sm:px-8 flex items-center justify-between shadow-xs">
              <div className="text-xs text-[#52443a]">
                {!previewLoading && !previewError && previewQuestions.length > 0 && (
                  <span>
                    Đã trả lời: <strong className="text-[#211a16]">{answeredCount}</strong> /{" "}
                    {previewQuestions.length} câu
                  </span>
                )}
              </div>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={handleClosePreview}
                  className="rounded-xl border border-[#d8c2b6] bg-white px-4 py-2 text-xs font-bold text-[#52443a] hover:bg-gray-50 transition-all cursor-pointer"
                >
                  Đóng
                </button>

                {!previewLoading && !previewError && previewQuestions.length > 0 && (
                  <>
                    {previewResults ? (
                      <button
                        type="button"
                        onClick={handleResetPreview}
                        className="inline-flex items-center gap-1.5 rounded-xl border border-[#6d3807] bg-[#fff1ea] hover:bg-[#ffdcc5] px-4 py-2 text-xs font-bold text-[#6d3807] transition-all cursor-pointer shadow-2xs"
                      >
                        <RotateCcw className="w-4 h-4" />
                        <span>Làm lại</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        disabled={isPreviewSubmitting}
                        onClick={handleGradePreview}
                        className="inline-flex items-center gap-1.5 rounded-xl bg-[#6d3807] hover:bg-[#8a4f1e] disabled:opacity-50 text-white px-5 py-2 text-xs font-bold transition-all shadow-xs cursor-pointer"
                      >
                        {isPreviewSubmitting ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            <span>Đang chấm...</span>
                          </>
                        ) : (
                          <>
                            <CheckCircle2 className="w-4 h-4" />
                            <span>Chấm thử</span>
                          </>
                        )}
                      </button>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </TeacherLayout>
  );
}
