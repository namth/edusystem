"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  CheckCircle2,
  XCircle,
  Sparkles,
  Award,
  BookOpen,
  Loader2,
  UserCheck,
  AlertCircle,
  Clock,
  ExternalLink,
} from "lucide-react";
import LessonPlayer from "@/components/lesson-player/LessonPlayer";
import { sanitizeQuestionForStudent } from "@/lib/grading";

export default function ExamSubmissionReviewPage() {
  const params = useParams();
  const router = useRouter();
  const submissionId = params.submissionId as string;

  const [submission, setSubmission] = useState<any>(null);
  const [exam, setExam] = useState<any>(null);
  const [questions, setQuestions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorStatus, setErrorStatus] = useState<403 | 404 | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    let timerId: any = null;
    let isMounted = true;

    const fetchReviewData = async () => {
      try {
        const res = await fetch(`/api/submissions/${submissionId}`);
        if (!isMounted) return;

        if (res.status === 403) {
          setErrorStatus(403);
          setLoading(false);
          return;
        }

        if (res.status === 404) {
          setErrorStatus(404);
          setLoading(false);
          return;
        }

        if (!res.ok) {
          const errJson = await res.json().catch(() => ({}));
          setErrorMsg(errJson.error || "Lỗi tải chi tiết bài nộp.");
          setLoading(false);
          return;
        }

        const json = await res.json();
        if (!isMounted) return;

        if (!json.success || !json.submission) {
          setErrorMsg(json.error || "Không tìm thấy bài nộp.");
          setLoading(false);
          return;
        }

        setSubmission(json.submission);
        setExam(json.exam || null);

        // Chuẩn hóa và ẩn thông tin nội bộ của câu hỏi qua sanitizeQuestionForStudent
        const rawQuestions = Array.isArray(json.questions) ? json.questions : [];
        const sanitized = rawQuestions.map((q: any) => sanitizeQuestionForStudent(q));
        setQuestions(sanitized);

        setErrorStatus(null);
        setErrorMsg(null);

        // Nếu trạng thái đang chấm GRADING, tự động cập nhật sau 5 giây
        if (
          json.submission.status === "GRADING" ||
          json.submission.status === "PENDING_GRADING" ||
          json.submission.status === "AI_GRADING_IN_PROGRESS"
        ) {
          timerId = setTimeout(fetchReviewData, 5000);
        }
      } catch (err: any) {
        if (!isMounted) return;
        console.error("Error loading review:", err);
        setErrorMsg(err?.message || "Đã xảy ra lỗi khi tải bài nộp.");
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    fetchReviewData();

    return () => {
      isMounted = false;
      if (timerId) clearTimeout(timerId);
    };
  }, [submissionId, retryCount]);

  if (loading) {
    return (
      <div className="h-screen flex flex-col items-center justify-center bg-[#fff8f5]">
        <Loader2 className="w-8 h-8 text-[#6d3807] animate-spin mb-2" />
        <p className="font-mono text-xs text-[#52443a]">Đang nạp chi tiết bài nộp {submissionId}...</p>
      </div>
    );
  }

  if (errorStatus === 403) {
    return (
      <div className="h-screen flex flex-col items-center justify-center bg-[#fff8f5] space-y-4">
        <p className="text-sm text-[#52443a]">Bạn không có quyền xem bài nộp này.</p>
        <Link href="/student/dashboard" className="px-4 py-2 bg-[#6d3807] text-white rounded-xl text-xs font-bold">
          Quay lại Dashboard
        </Link>
      </div>
    );
  }

  if (errorStatus === 404 || (!submission && !errorMsg)) {
    return (
      <div className="h-screen flex flex-col items-center justify-center bg-[#fff8f5] space-y-4">
        <p className="text-sm text-[#52443a]">Không tìm thấy bài nộp.</p>
        <Link href="/student/dashboard" className="px-4 py-2 bg-[#6d3807] text-white rounded-xl text-xs font-bold">
          Quay lại Dashboard
        </Link>
      </div>
    );
  }

  if (errorMsg) {
    return (
      <div className="h-screen flex flex-col items-center justify-center bg-[#fff8f5] space-y-4">
        <p className="text-sm text-rose-700 font-bold">{errorMsg}</p>
        <button
          type="button"
          onClick={() => {
            setLoading(true);
            setErrorMsg(null);
            setRetryCount((c) => c + 1);
          }}
          className="px-4 py-2 bg-[#6d3807] text-white rounded-xl text-xs font-bold hover:bg-[#8a4f1e] cursor-pointer"
        >
          Thử lại
        </button>
      </div>
    );
  }

  const isGrading =
    submission.status === "GRADING" ||
    submission.status === "PENDING_GRADING" ||
    submission.status === "AI_GRADING_IN_PROGRESS";
  const isNeedsReview = submission.status === "NEEDS_REVIEW";
  const isGraded = submission.status === "GRADED";
  const sectionScores = submission.section_scores || {};
  const teacherFeedback = submission.teacher_feedback || submission.teacher_review?.teacher_note;

  return (
    <div className="min-h-screen bg-[#fff8f5] text-[#211a16] font-sans pb-16">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-[#fff8f5]/95 backdrop-blur-sm border-b border-[#d8c2b6] flex justify-between items-center px-6 h-16 shadow-2xs">
        <div className="flex items-center gap-3">
          <Link
            href="/student/dashboard"
            className="p-2 text-[#52443a] hover:text-[#6d3807] transition-all rounded-lg hover:bg-white"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="font-headline text-base font-bold text-[#211a16]">
              {exam?.title || "Xem Chi Tiết Bài Thi"}
            </h1>
            <p className="text-[11px] text-[#857469]">Mã bài nộp: {submissionId}</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {submission.is_late && (
            <span className="px-3 py-1 bg-rose-100 text-rose-800 text-xs font-bold rounded-lg border border-rose-300">
              Nộp trễ
            </span>
          )}

          {isGrading ? (
            <span className="px-3 py-1 bg-blue-100 text-blue-800 text-xs font-bold rounded-lg border border-blue-300 flex items-center gap-1.5 animate-pulse">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              <span>Đang chấm Writing/Speaking…</span>
            </span>
          ) : isNeedsReview ? (
            <span className="px-3 py-1 bg-amber-100 text-amber-900 text-xs font-bold rounded-lg border border-amber-300 flex items-center gap-1.5">
              <AlertCircle className="w-3.5 h-3.5 text-amber-700" />
              <span>Chờ giáo viên chấm phần tự luận</span>
            </span>
          ) : isGraded ? (
            <span className="px-3 py-1 bg-emerald-100 text-emerald-800 text-xs font-bold rounded-lg border border-emerald-300 flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700" />
              <span>Đã hoàn thành chấm điểm</span>
            </span>
          ) : null}
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-4xl mx-auto p-6 space-y-6">
        {/* Banner trạng thái đang chấm */}
        {isGrading && (
          <div className="p-4 bg-blue-50 border border-blue-200 rounded-2xl text-blue-900 text-xs flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Loader2 className="w-4 h-4 animate-spin text-blue-700 shrink-0" />
              <span>
                Hệ thống AI đang chấm bài thi tự luận của bạn. Trang sẽ tự động cập nhật kết quả khi
                hoàn tất...
              </span>
            </div>
          </div>
        )}

        {/* Banner nhận xét của giáo viên */}
        {teacherFeedback && (
          <div className="p-5 bg-gradient-to-r from-emerald-50 to-[#fff8f5] rounded-3xl border-2 border-emerald-300 shadow-xs space-y-1">
            <div className="flex items-center space-x-2 text-emerald-800 font-bold text-xs uppercase tracking-wide">
              <UserCheck className="w-4 h-4 text-emerald-700" />
              <span>Nhận xét từ giáo viên:</span>
            </div>
            <p className="text-xs text-[#211a16] leading-relaxed font-medium bg-white p-3 rounded-xl border border-emerald-200 whitespace-pre-wrap">
              {teacherFeedback}
            </p>
          </div>
        )}

        {/* Tổng kết điểm */}
        <div className="p-6 bg-white rounded-3xl border border-[#d8c2b6] shadow-sm space-y-5">
          <div className="flex items-center justify-between border-b border-[#ede0d9] pb-3">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-[#fff1ea] text-[#6d3807] rounded-full border border-[#d8c2b6] text-xs font-bold">
              <Award className="w-4 h-4 text-[#6d3807]" />
              <span>Bảng Tổng Hợp Kết Quả</span>
            </div>
            <span className="text-xs text-[#857469] font-mono">
              Tổng số câu hỏi: {questions.length}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 bg-[#fff8f5] rounded-2xl border border-[#ede0d9] text-center space-y-1">
              <span className="text-xs font-bold text-[#857469] uppercase tracking-wider block">
                Tổng điểm
              </span>
              <div className="text-3xl font-extrabold text-[#6d3807]">
                {submission.total_score !== null && submission.total_score !== undefined
                  ? submission.total_score
                  : "—"}
              </div>
            </div>

            <div className="p-4 bg-[#fff8f5] rounded-2xl border border-[#ede0d9] text-center space-y-1">
              <span className="text-xs font-bold text-[#857469] uppercase tracking-wider block">
                Kết quả xếp loại
              </span>
              <div className="text-2xl font-extrabold">
                {submission.passed === true ? (
                  <span className="text-emerald-700">Đạt</span>
                ) : submission.passed === false ? (
                  <span className="text-rose-700">Chưa đạt</span>
                ) : (
                  <span className="text-gray-500">—</span>
                )}
              </div>
            </div>
          </div>

          {/* Điểm từng phần theo kỹ năng (section_scores) */}
          {Object.keys(sectionScores).length > 0 && (
            <div className="space-y-3 pt-2">
              <span className="text-xs font-bold text-[#52443a] uppercase tracking-wider block">
                Điểm từng kỹ năng (section_scores):
              </span>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {Object.entries(sectionScores).map(([skill, sData]: [string, any]) => (
                  <div
                    key={skill}
                    className="p-3.5 rounded-xl border border-[#ede0d9] bg-[#fffdfc] text-center space-y-1"
                  >
                    <div className="text-xs font-bold text-[#52443a]">{skill}</div>
                    <div className="text-xl font-bold text-[#6d3807]">
                      {sData?.score !== undefined ? sData.score : "—"}
                    </div>
                    {sData?.max !== undefined && sData?.earned !== undefined && (
                      <div className="text-[11px] text-[#857469]">
                        {sData.earned}/{sData.max} câu
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Danh sách câu hỏi hiển thị qua LessonPlayer ở chế độ kết quả */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-[#6d3807] font-bold text-sm uppercase tracking-wide">
            <BookOpen className="w-4 h-4" />
            <span>Chi tiết từng câu hỏi &amp; bài làm:</span>
          </div>

          <LessonPlayer
            questions={questions}
            flashcards={[]}
            answers={submission.answers || {}}
            results={submission.results || []}
            onChange={() => {}}
            disabled={true}
            allowSpeaking={true}
          />
        </div>
      </main>
    </div>
  );
}
