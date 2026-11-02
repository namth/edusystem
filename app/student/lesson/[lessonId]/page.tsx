"use client";

import { useState, useEffect, useRef, useCallback, Suspense } from "react";
import { useParams, useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import StudentLayout from "@/components/StudentLayout";
import LessonPlayer, { GradeResult, FlashcardItem } from "@/components/lesson-player/LessonPlayer";
import { emptyAnswerFor, countAnswered } from "@/lib/lesson-player";
import {
  ArrowLeft,
  CheckCircle2,
  AlertCircle,
  Clock,
  Loader2,
  RotateCcw,
  Sparkles,
  Award,
  History,
  FileQuestion,
  ChevronRight,
  BookOpen,
} from "lucide-react";

interface LessonData {
  id: string;
  title: string;
  description?: string;
}

interface AttemptItem {
  id: string;
  lesson_id: string;
  class_id: string;
  student_id: string;
  answers: Record<string, unknown>;
  results: GradeResult[];
  objective_earned: number;
  objective_max: number;
  ai_earned: number | null;
  ai_max: number;
  score_percent: number | null;
  status: "GRADED" | "GRADING" | "AI_SKIPPED";
  created_at: string;
  graded_at: string | null;
}

function StudentLessonContent() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();

  const lessonId = (params?.lessonId || "") as string;
  const classId = searchParams.get("classId") || "";

  const [lesson, setLesson] = useState<LessonData | null>(null);
  const [questions, setQuestions] = useState<any[]>([]);
  const [flashcards, setFlashcards] = useState<FlashcardItem[]>([]);
  const [answers, setAnswers] = useState<Record<string, unknown>>({});
  const [attempts, setAttempts] = useState<AttemptItem[]>([]);
  const [currentAttempt, setCurrentAttempt] = useState<AttemptItem | null>(null);

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [errorStatus, setErrorStatus] = useState<number | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Load lesson data and attempt history in parallel
  const loadData = useCallback(async () => {
    if (!lessonId || !classId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setErrorStatus(null);
    setErrorMessage(null);

    try {
      const [lessonRes, attemptsRes] = await Promise.all([
        fetch(`/api/student/lessons/${lessonId}?classId=${encodeURIComponent(classId)}`),
        fetch(`/api/student/lessons/${lessonId}/attempts?classId=${encodeURIComponent(classId)}`),
      ]);

      if (!lessonRes.ok) {
        setErrorStatus(lessonRes.status);
        const data = await lessonRes.json().catch(() => ({}));
        if (lessonRes.status === 403) {
          setErrorMessage(data.error || "Bài học chưa được mở hoặc bạn không có quyền truy cập.");
        } else if (lessonRes.status === 404) {
          setErrorMessage("Không tìm thấy bài học");
        } else {
          setErrorMessage(data.error || "Không thể tải bài học. Vui lòng thử lại.");
        }
        setLoading(false);
        return;
      }

      const lessonJson = await lessonRes.json();
      const qs: any[] = lessonJson.questions || [];
      const fcs: FlashcardItem[] = lessonJson.flashcards || [];
      setLesson(lessonJson.lesson || null);
      setQuestions(qs);
      setFlashcards(fcs);

      // Initialize empty answers for all questions
      const initAnswers: Record<string, unknown> = {};
      for (const q of qs) {
        initAnswers[q.id] = emptyAnswerFor(q);
      }
      setAnswers(initAnswers);

      if (attemptsRes.ok) {
        const attemptsJson = await attemptsRes.json();
        const attList: AttemptItem[] = attemptsJson.attempts || [];
        setAttempts(attList);
      }
    } catch (err: any) {
      setErrorStatus(500);
      setErrorMessage(err.message || "Lỗi kết nối mạng.");
    } finally {
      setLoading(false);
    }
  }, [lessonId, classId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Polling when current attempt status is GRADING
  useEffect(() => {
    if (!currentAttempt || currentAttempt.status !== "GRADING") {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
      return;
    }

    const attemptId = currentAttempt.id;

    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/student/attempts/${attemptId}`);
        if (res.ok) {
          const data = await res.json();
          if (data.success && data.attempt) {
            const updated: AttemptItem = data.attempt;
            if (updated.status !== "GRADING") {
              setCurrentAttempt(updated);
              // Update attempts list
              setAttempts((prev) =>
                prev.map((a) => (a.id === updated.id ? updated : a))
              );
            }
          }
        }
      } catch (e) {
        console.error("Polling attempt error:", e);
      }
    }, 3000);

    pollingIntervalRef.current = interval;

    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
    };
  }, [currentAttempt?.id, currentAttempt?.status]);

  const handleAnswerChange = (questionId: string, answer: unknown) => {
    if (currentAttempt) return; // Readonly when viewing result
    setAnswers((prev) => ({
      ...prev,
      [questionId]: answer,
    }));
  };

  const answeredCount = countAnswered(questions, answers);
  const totalQuestions = questions.length;

  // Submit attempt
  const handleSubmit = async () => {
    if (submitting || !classId || !lessonId) return;

    if (answeredCount < totalQuestions) {
      const confirmed = window.confirm(
        `Bạn mới trả lời ${answeredCount}/${totalQuestions} câu hỏi. Bạn có chắc chắn muốn nộp bài không?`
      );
      if (!confirmed) return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(`/api/student/lessons/${lessonId}/attempts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ classId, answers }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        alert(data.error || "Nộp bài thất bại. Vui lòng thử lại.");
        return;
      }

      const newAttempt: AttemptItem = data.attempt;
      setCurrentAttempt(newAttempt);
      setAttempts((prev) => [newAttempt, ...prev]);
    } catch (err: any) {
      alert(err.message || "Lỗi khi nộp bài. Vui lòng kiểm tra kết nối.");
    } finally {
      setSubmitting(false);
    }
  };

  // Reset to retry
  const handleRetry = () => {
    const initAnswers: Record<string, unknown> = {};
    for (const q of questions) {
      initAnswers[q.id] = emptyAnswerFor(q);
    }
    setAnswers(initAnswers);
    setCurrentAttempt(null);
  };

  // View past attempt
  const handleViewAttempt = (att: AttemptItem) => {
    setCurrentAttempt(att);
    setAnswers(att.answers || {});
  };

  // Missing classId check
  if (!classId) {
    return (
      <StudentLayout>
        <div className="max-w-4xl mx-auto py-12 px-4">
          <div className="rounded-2xl border border-rose-300 bg-rose-50 p-6 text-center space-y-4">
            <AlertCircle className="w-12 h-12 text-rose-600 mx-auto" />
            <h2 className="text-lg font-bold text-rose-900 font-headline">
              Thiếu thông tin lớp học (classId)
            </h2>
            <p className="text-sm text-rose-700">
              Vui lòng mở bài học từ tab Lộ trình trong trang lớp học của bạn.
            </p>
            <Link
              href="/student/dashboard"
              className="inline-flex items-center gap-2 rounded-xl bg-brand-600 px-4 py-2 text-sm font-bold text-white hover:bg-brand-700 transition-all"
            >
              <ArrowLeft className="w-4 h-4" />
              Về Dashboard
            </Link>
          </div>
        </div>
      </StudentLayout>
    );
  }

  // Loading state
  if (loading) {
    return (
      <StudentLayout>
        <div className="max-w-4xl mx-auto py-20 px-4 text-center">
          <Loader2 className="w-10 h-10 animate-spin text-brand-600 mx-auto mb-4" />
          <p className="text-sm font-semibold text-ink-muted">
            Đang tải nội dung bài học…
          </p>
        </div>
      </StudentLayout>
    );
  }

  // Error handling: 403, 404, or network error
  if (errorStatus || errorMessage) {
    return (
      <StudentLayout>
        <div className="max-w-4xl mx-auto py-12 px-4">
          <div
            className={`rounded-2xl border p-8 text-center space-y-4 ${
              errorStatus === 403
                ? "border-amber-300 bg-amber-50 text-amber-900"
                : errorStatus === 404
                ? "border-gray-300 bg-gray-50 text-gray-900"
                : "border-rose-300 bg-rose-50 text-rose-900"
            }`}
          >
            <AlertCircle className="w-12 h-12 mx-auto" />
            <h2 className="text-xl font-bold font-headline">
              {errorStatus === 403
                ? "Bài học chưa được mở"
                : errorStatus === 404
                ? "Không tìm thấy bài học"
                : "Có lỗi xảy ra"}
            </h2>
            <p className="text-sm max-w-md mx-auto">
              {errorMessage || "Vui lòng kiểm tra lại quyền truy cập hoặc thử lại sau."}
            </p>

            <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
              {errorStatus === 403 && (
                <Link
                  href={`/student/class/${classId}`}
                  className="inline-flex items-center gap-2 rounded-xl bg-brand-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-brand-700 transition-all shadow-xs"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Về lộ trình lớp
                </Link>
              )}
              {errorStatus !== 403 && (
                <button
                  type="button"
                  onClick={loadData}
                  className="inline-flex items-center gap-2 rounded-xl bg-brand-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-brand-700 transition-all shadow-xs cursor-pointer"
                >
                  <RotateCcw className="w-4 h-4" />
                  Thử lại
                </button>
              )}
            </div>
          </div>
        </div>
      </StudentLayout>
    );
  }

  return (
    <StudentLayout>
      <div className="max-w-5xl mx-auto py-6 px-4 md:px-6 space-y-6">
        {/* Navigation back to class roadmap */}
        <div className="flex items-center justify-between">
          <Link
            href={`/student/class/${classId}`}
            className="inline-flex items-center gap-2 text-sm font-bold text-brand-600 hover:underline"
          >
            <ArrowLeft className="w-4 h-4" />
            Về lộ trình lớp
          </Link>

          {currentAttempt && (
            <button
              type="button"
              onClick={handleRetry}
              className="inline-flex items-center gap-1.5 rounded-xl border border-brand-600 bg-white px-3.5 py-1.5 text-xs font-bold text-brand-600 hover:bg-brand-50 transition-all shadow-2xs cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Làm lại bài học
            </button>
          )}
        </div>

        {/* Thanh tiêu đề bài học */}
        <div className="rounded-2xl border border-line bg-white p-6 md:p-8 shadow-xs">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-brand-700">
                <BookOpen className="w-4 h-4" />
                <span>Bài học</span>
              </div>
              <h1 className="text-2xl md:text-3xl font-extrabold text-ink font-headline">
                {lesson?.title || "Bài học"}
              </h1>
              {lesson?.description && (
                <p className="text-sm text-ink-muted max-w-2xl leading-relaxed">
                  {lesson.description}
                </p>
              )}
            </div>

            {/* Tiến độ trả lời hoặc Nút nộp bài */}
            <div className="flex flex-col sm:flex-row sm:items-center gap-3 shrink-0">
              {!currentAttempt ? (
                <>
                  <div className="rounded-xl border border-line-soft bg-surface-alt px-4 py-2 text-center">
                    <span className="block text-xs font-bold text-ink-muted">
                      Tiến độ
                    </span>
                    <span className="font-extrabold text-sm text-brand-600">
                      Đã trả lời {answeredCount}/{totalQuestions}
                    </span>
                  </div>

                  <button
                    type="button"
                    disabled={submitting}
                    onClick={handleSubmit}
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-brand-600 px-6 py-2.5 text-sm font-bold text-white hover:bg-brand-700 disabled:opacity-50 transition-all shadow-xs cursor-pointer"
                  >
                    {submitting ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Đang nộp…
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="w-4 h-4" />
                        Nộp bài
                      </>
                    )}
                  </button>
                </>
              ) : (
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={handleRetry}
                    className="inline-flex items-center gap-2 rounded-xl bg-brand-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-brand-700 transition-all shadow-xs cursor-pointer"
                  >
                    <RotateCcw className="w-4 h-4" />
                    Làm lại
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Banner kết quả khi đang xem một lần làm bài */}
          {currentAttempt && (
            <div className="mt-6 pt-6 border-t border-line-soft">
              <div
                className={`rounded-2xl border p-5 ${
                  currentAttempt.status === "GRADING"
                    ? "border-amber-300 bg-amber-50"
                    : currentAttempt.status === "AI_SKIPPED"
                    ? "border-blue-300 bg-blue-50"
                    : currentAttempt.score_percent !== null && currentAttempt.score_percent >= 70
                    ? "border-emerald-300 bg-emerald-50"
                    : "border-orange-300 bg-orange-50"
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 font-bold text-sm">
                      {currentAttempt.status === "GRADING" ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin text-amber-700" />
                          <span className="text-amber-900 font-headline">
                            Đang chấm phần tự luận…
                          </span>
                        </>
                      ) : (
                        <>
                          <Award className="w-4 h-4 text-brand-600" />
                          <span className="text-ink font-headline">
                            Kết quả lần làm bài
                          </span>
                        </>
                      )}
                    </div>
                    <p className="text-xs text-ink-muted">
                      Nộp lúc:{" "}
                      {new Date(currentAttempt.created_at).toLocaleString("vi-VN")}
                    </p>

                    {currentAttempt.status === "AI_SKIPPED" && (
                      <p className="text-xs font-semibold text-blue-800 mt-1">
                        Phần tự luận chưa được chấm (giáo viên hết lượt AI).
                      </p>
                    )}
                  </div>

                  <div className="flex items-baseline gap-2">
                    {currentAttempt.status === "GRADING" ? (
                      <span className="text-sm font-bold text-amber-800 animate-pulse">
                        Đang đợi AI phản hồi…
                      </span>
                    ) : (
                      <span className="font-extrabold text-3xl text-brand-600 font-headline">
                        {currentAttempt.score_percent != null
                          ? `${currentAttempt.score_percent}%`
                          : "—"}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Trình làm bài / Xem kết quả bài học */}
        <LessonPlayer
          questions={questions}
          flashcards={flashcards}
          answers={answers}
          onChange={handleAnswerChange}
          results={currentAttempt ? currentAttempt.results : null}
          disabled={Boolean(currentAttempt)}
        />

        {/* Lịch sử các lần làm bài */}
        {attempts.length > 0 && (
          <div className="rounded-2xl border border-line bg-white p-6 shadow-xs space-y-4">
            <div className="flex items-center gap-2 border-b border-line-soft pb-3">
              <History className="w-4 h-4 text-brand-600" />
              <h3 className="font-headline font-bold text-base text-ink">
                Lịch sử các lần làm bài ({attempts.length})
              </h3>
            </div>

            <div className="divide-y divide-line-soft">
              {attempts.map((att, idx) => {
                const isSelected = currentAttempt?.id === att.id;
                const formattedTime = new Date(att.created_at).toLocaleString("vi-VN");

                return (
                  <button
                    key={att.id}
                    type="button"
                    onClick={() => handleViewAttempt(att)}
                    className={`w-full flex items-center justify-between p-3.5 text-left rounded-xl transition-all cursor-pointer ${
                      isSelected
                        ? "bg-brand-50 font-bold text-brand-600"
                        : "hover:bg-surface-alt"
                    }`}
                  >
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-brand-600">
                          Lần #{attempts.length - idx}
                        </span>
                        <span className="text-xs text-ink-muted">
                          {formattedTime}
                        </span>
                      </div>
                      <div className="text-xs font-medium text-ink-muted">
                        Trạng thái:{" "}
                        {att.status === "GRADING" ? (
                          <span className="text-amber-700 font-bold">
                            Đang chấm AI…
                          </span>
                        ) : att.status === "AI_SKIPPED" ? (
                          <span className="text-blue-700 font-bold">
                            AI_SKIPPED (Hết lượt AI)
                          </span>
                        ) : (
                          <span className="text-emerald-700 font-bold">
                            Đã chấm
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <span className="font-headline font-extrabold text-base text-brand-600">
                        {att.score_percent != null
                          ? `${att.score_percent}%`
                          : att.status === "GRADING"
                          ? "Đang chấm..."
                          : "—"}
                      </span>
                      <ChevronRight className="w-4 h-4 text-line" />
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </StudentLayout>
  );
}

export default function StudentLessonPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-surface-alt">
          <Loader2 className="w-8 h-8 animate-spin text-brand-600" />
        </div>
      }
    >
      <StudentLessonContent />
    </Suspense>
  );
}
