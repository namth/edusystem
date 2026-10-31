"use client";

import { useState, useEffect, useRef, useCallback, Suspense } from "react";
import { useParams, useSearchParams } from "next/navigation";
import Link from "next/link";
import StudentLayout from "@/components/StudentLayout";
import LessonPlayer, { FlashcardItem } from "@/components/lesson-player/LessonPlayer";
import { emptyExamAnswerFor, groupQuestionsBySkill, formatRemaining } from "@/lib/exam-player";
import { countAnswered } from "@/lib/lesson-player";
import { Timer, AlertCircle, Loader2, Award, Clock, FileCheck, ExternalLink, ArrowLeft } from "lucide-react";

interface ExamContentData {
  exam: { id: string; title: string; duration_minutes: number; skills?: string[] };
  standard?: { id: string; name: string; sections?: { skill: string; min: number; max: number }[] };
  questions: any[];
  flashcards?: FlashcardItem[];
}

interface AttemptData {
  id: string;
  started_at: string;
  deadline_at: string;
  status: "IN_PROGRESS" | "GRADED" | "GRADING" | "NEEDS_REVIEW";
  answers?: Record<string, unknown>;
  section_scores?: Record<string, { score: number; earned?: number; max?: number }>;
  total_score?: number | null;
  passed?: boolean | null;
  is_late?: boolean;
}

function StudentExamInner() {
  const params = useParams();
  const searchParams = useSearchParams();
  const examId = (params?.examId || "") as string;
  const classId = searchParams.get("classId") || undefined;

  const [phase, setPhase] = useState<"loading" | "start" | "running" | "submitting" | "result" | "error">("loading");
  const [examMeta, setExamMeta] = useState<{ id: string; title: string; duration_minutes: number } | null>(null);
  const [contentData, setContentData] = useState<ExamContentData | null>(null);
  const [attempt, setAttempt] = useState<AttemptData | null>(null);
  const [remainingAttempts, setRemainingAttempts] = useState<number | null>(null);
  const [answers, setAnswers] = useState<Record<string, unknown>>({});
  const [activeSkill, setActiveSkill] = useState<string>("");
  const [now, setNow] = useState<number>(Date.now());
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [startLoading, setStartLoading] = useState<boolean>(false);
  const [showConfirmModal, setShowConfirmModal] = useState<boolean>(false);

  const answersRef = useRef<Record<string, unknown>>({});
  answersRef.current = answers;
  const countdownIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const autoSaveIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const gradingPollingRef = useRef<NodeJS.Timeout | null>(null);
  const hasAutoSubmittedRef = useRef<boolean>(false);

  useEffect(() => {
    return () => {
      if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
      if (autoSaveIntervalRef.current) clearInterval(autoSaveIntervalRef.current);
      if (gradingPollingRef.current) clearInterval(gradingPollingRef.current);
    };
  }, []);

  const initAnswers = useCallback((questions: any[], savedAnswers?: Record<string, unknown>) => {
    const initial: Record<string, unknown> = { ...(savedAnswers || {}) };
    for (const q of questions) {
      if (initial[q.id] === undefined) initial[q.id] = emptyExamAnswerFor(q);
    }
    setAnswers(initial);
  }, []);

  const fetchContentAndEnter = useCallback(async (curAttempt: AttemptData) => {
    try {
      const res = await fetch(`/api/student/exams/${examId}/content`);
      if (!res.ok) throw new Error("Không thể tải nội dung đề thi");
      const data: ExamContentData = await res.json();
      setContentData(data);
      initAnswers(data.questions || [], curAttempt.answers);
      const grouped = groupQuestionsBySkill(data.questions || []);
      if (grouped.length > 0) setActiveSkill(grouped[0].skill);
      setPhase("running");
    } catch (err: any) {
      setErrorMessage(err.message || "Lỗi tải đề thi");
      setPhase("error");
    }
  }, [examId, initAnswers]);

  const checkInitialStatus = useCallback(async () => {
    setPhase("loading");
    setErrorMessage(null);
    try {
      const contentRes = await fetch(`/api/student/exams/${examId}/content`);
      if (contentRes.ok) {
        const cData: ExamContentData = await contentRes.json();
        setContentData(cData);
        const attRes = await fetch(`/api/student/exams/${examId}/attempts`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ classId }),
        });
        if (attRes.ok) {
          const { attempt: curAttempt, remaining_attempts } = await attRes.json();
          setAttempt(curAttempt);
          setRemainingAttempts(remaining_attempts ?? null);
          initAnswers(cData.questions || [], curAttempt.answers);
          const grouped = groupQuestionsBySkill(cData.questions || []);
          if (grouped.length > 0) setActiveSkill(grouped[0].skill);
          setPhase("running");
          return;
        }
      }
      const examRes = await fetch(`/api/exams/${examId}`);
      if (examRes.status === 404) {
        setErrorMessage("Không tìm thấy đề thi.");
        setPhase("error");
        return;
      }
      if (!examRes.ok) {
        setErrorMessage("Lỗi tải thông tin đề thi.");
        setPhase("error");
        return;
      }
      const examJson = await examRes.json();
      setExamMeta(examJson.exam);
      setPhase("start");
    } catch (err: any) {
      setErrorMessage(err.message || "Đã xảy ra lỗi khi kết nối máy chủ.");
      setPhase("error");
    }
  }, [examId, classId, initAnswers]);

  useEffect(() => {
    if (examId) checkInitialStatus();
  }, [examId, checkInitialStatus]);

  const handleStartExam = async () => {
    setStartLoading(true);
    setErrorMessage(null);
    try {
      const res = await fetch(`/api/student/exams/${examId}/attempts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ classId }),
      });
      if (res.status === 403) {
        setErrorMessage("Bạn không có quyền làm đề thi này (403).");
        return;
      }
      if (res.status === 409) {
        setErrorMessage("Bạn đã hết lượt làm đề này (409).");
        return;
      }
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setErrorMessage(data.error || "Không thể bắt đầu lượt thi.");
        return;
      }
      const { attempt: newAttempt, remaining_attempts } = await res.json();
      setAttempt(newAttempt);
      setRemainingAttempts(remaining_attempts ?? null);
      await fetchContentAndEnter(newAttempt);
    } catch (err: any) {
      setErrorMessage(err.message || "Lỗi khi bắt đầu làm bài.");
    } finally {
      setStartLoading(false);
    }
  };

  const saveTempAnswers = useCallback(async (currentAnswers?: Record<string, unknown>) => {
    if (!attempt || attempt.status !== "IN_PROGRESS") return;
    try {
      const res = await fetch(`/api/student/exam-attempts/${attempt.id}/answers`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers: currentAnswers || answersRef.current }),
      });
      if (res.status === 409 && autoSaveIntervalRef.current) clearInterval(autoSaveIntervalRef.current);
    } catch (err) {
      console.warn("Auto save answers error:", err);
    }
  }, [attempt]);

  const doSubmit = useCallback(async (finalAnswers: Record<string, unknown>, isAuto = false) => {
    if (!attempt) return;
    if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
    if (autoSaveIntervalRef.current) clearInterval(autoSaveIntervalRef.current);
    setPhase("submitting");
    setShowConfirmModal(false);
    try {
      const res = await fetch(`/api/student/exam-attempts/${attempt.id}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers: finalAnswers }),
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || "Lỗi nộp bài thi");
      }
      const { attempt: submittedAttempt } = await res.json();
      setAttempt(submittedAttempt);
      setPhase("result");
      if (submittedAttempt.status === "GRADING") {
        gradingPollingRef.current = setInterval(async () => {
          try {
            const pollRes = await fetch(`/api/submissions/${submittedAttempt.id}`);
            if (pollRes.ok) {
              const pollJson = await pollRes.json();
              if (pollJson.submission && pollJson.submission.status !== "GRADING") {
                setAttempt(pollJson.submission);
                if (gradingPollingRef.current) clearInterval(gradingPollingRef.current);
              }
            }
          } catch {}
        }, 5000);
      }
    } catch (err: any) {
      setErrorMessage(err.message || "Lỗi nộp bài thi.");
      setPhase("error");
    }
  }, [attempt]);

  useEffect(() => {
    if (phase !== "running" || !attempt?.deadline_at) return;
    countdownIntervalRef.current = setInterval(() => {
      const curNow = Date.now();
      setNow(curNow);
      const deadlineMs = new Date(attempt.deadline_at).getTime();
      if (deadlineMs - curNow <= 0 && !hasAutoSubmittedRef.current) {
        hasAutoSubmittedRef.current = true;
        // Tự động nộp bài thi khi hết giờ (autoSubmit)
        doSubmit(answersRef.current, true);
      }
    }, 1000);
    autoSaveIntervalRef.current = setInterval(() => { saveTempAnswers(); }, 30000);
    return () => {
      if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
      if (autoSaveIntervalRef.current) clearInterval(autoSaveIntervalRef.current);
    };
  }, [phase, attempt?.deadline_at, doSubmit, saveTempAnswers]);

  if (phase === "loading") {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center space-y-3">
        <Loader2 className="w-8 h-8 text-[#6d3807] animate-spin" />
        <p className="text-sm font-medium text-[#52443a]">Đang chuẩn bị đề thi...</p>
      </div>
    );
  }

  if (phase === "error") {
    return (
      <div className="max-w-md mx-auto my-12 p-6 rounded-2xl bg-white border border-rose-200 text-center space-y-4">
        <AlertCircle className="w-10 h-10 text-rose-600 mx-auto" />
        <h2 className="text-lg font-bold text-[#211a16]">Không thể tải đề thi</h2>
        <p className="text-sm text-rose-700">{errorMessage || "Đã xảy ra lỗi."}</p>
        <div className="flex justify-center gap-3 pt-2">
          <button type="button" onClick={checkInitialStatus} className="px-4 py-2 bg-[#6d3807] hover:bg-[#8a4f1e] text-white rounded-xl text-xs font-bold cursor-pointer">Thử lại</button>
          <Link href="/student/dashboard" className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-xs font-bold">Về Dashboard</Link>
        </div>
      </div>
    );
  }

  if (phase === "start") {
    return (
      <div className="max-w-2xl mx-auto my-10 p-6 md:p-8 rounded-3xl bg-white border border-[#d8c2b6] space-y-6">
        <div className="border-b border-[#ede0d9] pb-4">
          <h1 className="text-2xl font-bold font-headline text-[#211a16] mb-2">{examMeta?.title || "Đề thi"}</h1>
          <div className="flex flex-wrap items-center gap-4 text-xs text-[#52443a]">
            <span className="flex items-center gap-1 font-semibold"><Clock className="w-4 h-4 text-[#6d3807]" />Thời gian: {examMeta?.duration_minutes ?? 0} phút</span>
            {remainingAttempts !== null && remainingAttempts !== undefined && (
              <span className="flex items-center gap-1 font-semibold text-purple-700"><FileCheck className="w-4 h-4" />Số lượt còn lại: {remainingAttempts}</span>
            )}
          </div>
        </div>
        <div className="rounded-2xl border border-amber-200 bg-amber-50/60 p-4 space-y-2">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-amber-800"><AlertCircle className="w-4 h-4 text-amber-700" />Lưu ý quan trọng:</div>
          <p className="text-xs text-[#52443a] leading-relaxed">Đồng hồ tính theo máy chủ, tải lại trang không dừng giờ. Vui lòng đảm bảo kết nối mạng ổn định trong suốt quá trình làm bài thi.</p>
        </div>
        {errorMessage && <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-semibold text-rose-800">{errorMessage}</div>}
        <div className="flex items-center justify-between pt-2">
          <Link href="/student/dashboard" className="inline-flex items-center gap-1 text-xs font-bold text-[#52443a] hover:text-[#6d3807]"><ArrowLeft className="w-4 h-4" /> Quay lại</Link>
          <button type="button" disabled={startLoading} onClick={handleStartExam} className="inline-flex items-center gap-2 px-6 py-2.5 bg-[#6d3807] hover:bg-[#8a4f1e] disabled:opacity-50 text-white rounded-xl text-sm font-bold shadow-xs cursor-pointer">
            {startLoading && <Loader2 className="w-4 h-4 animate-spin" />}Bắt đầu làm bài
          </button>
        </div>
      </div>
    );
  }

  if (phase === "submitting") {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center space-y-3">
        <Loader2 className="w-10 h-10 text-[#6d3807] animate-spin" />
        <h3 className="text-base font-bold text-[#211a16]">Đang nộp bài thi lên máy chủ...</h3>
        <p className="text-xs text-[#52443a]">Hệ thống đang lưu bài và tiến hành chấm điểm.</p>
      </div>
    );
  }

  if (phase === "result" && attempt) {
    const isGrading = attempt.status === "GRADING";
    const isNeedsReview = attempt.status === "NEEDS_REVIEW";
    const sectionScores = attempt.section_scores || {};
    return (
      <div className="max-w-3xl mx-auto my-8 p-6 md:p-8 rounded-3xl bg-white border border-[#d8c2b6] space-y-6">
        <div className="flex items-center justify-between border-b border-[#ede0d9] pb-4">
          <div><h1 className="text-xl font-bold font-headline text-[#211a16]">Kết Quả Bài Thi</h1><p className="text-xs text-[#857469]">Mã bài nộp: {attempt.id}</p></div>
          {attempt.is_late && <span className="px-3 py-1 bg-rose-100 border border-rose-300 text-rose-800 rounded-lg text-xs font-bold">Nộp trễ</span>}
        </div>
        {isGrading && <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4 flex items-center gap-3 text-xs text-blue-900 font-medium"><Loader2 className="w-5 h-5 text-blue-600 animate-spin shrink-0" /><span>Đang chấm Writing/Speaking… Hệ thống sẽ tự động cập nhật kết quả.</span></div>}
        {isNeedsReview && <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 flex items-center gap-3 text-xs text-amber-900 font-medium"><AlertCircle className="w-5 h-5 text-amber-700 shrink-0" /><span>Chờ giáo viên chấm phần tự luận. Điểm tổng sẽ được cập nhật sau.</span></div>}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-5 rounded-2xl bg-[#fff8f5] border border-[#ede0d9] text-center space-y-1">
            <div className="text-xs font-bold text-[#857469] uppercase tracking-wider">Tổng điểm</div>
            <div className="text-3xl font-extrabold text-[#6d3807]">{attempt.total_score !== null && attempt.total_score !== undefined ? attempt.total_score : "—"}</div>
          </div>
          <div className="p-5 rounded-2xl bg-[#fff8f5] border border-[#ede0d9] text-center space-y-1">
            <div className="text-xs font-bold text-[#857469] uppercase tracking-wider">Kết quả xếp loại</div>
            <div className="text-2xl font-extrabold">{attempt.passed === true ? <span className="text-emerald-700">Đạt</span> : attempt.passed === false ? <span className="text-rose-700">Chưa đạt</span> : <span className="text-gray-500">—</span>}</div>
          </div>
        </div>
        {Object.keys(sectionScores).length > 0 && (
          <div className="space-y-3">
            <h3 className="text-sm font-bold text-[#211a16] uppercase tracking-wider">Điểm theo kỹ năng:</h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {Object.entries(sectionScores).map(([skill, sData]) => (
                <div key={skill} className="p-3.5 rounded-xl border border-[#ede0d9] bg-[#fffdfc] text-center space-y-1">
                  <div className="text-xs font-bold text-[#52443a]">{skill}</div>
                  <div className="text-xl font-bold text-[#6d3807]">{sData?.score !== undefined ? sData.score : "—"}</div>
                  {sData?.max !== undefined && sData?.earned !== undefined && <div className="text-[11px] text-[#857469]">{sData.earned}/{sData.max} câu</div>}
                </div>
              ))}
            </div>
          </div>
        )}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-[#ede0d9]">
          <Link href="/student/dashboard" className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-xs font-bold">Về Dashboard</Link>
          <Link href={`/student/exam/review/${attempt.id}`} className="inline-flex items-center gap-1.5 px-5 py-2.5 bg-[#6d3807] hover:bg-[#8a4f1e] text-white rounded-xl text-xs font-bold shadow-xs">
            <span>Xem chi tiết</span><ExternalLink className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>
    );
  }

  const questions = contentData?.questions || [];
  const flashcards = contentData?.flashcards || [];
  const groupedSkills = groupQuestionsBySkill(questions);
  const activeQuestions = groupedSkills.find((g) => g.skill === activeSkill)?.questions || [];
  const msRemaining = attempt?.deadline_at ? new Date(attempt.deadline_at).getTime() - now : 0;
  const answeredCount = countAnswered(questions, answers);
  const totalCount = questions.length;

  return (
    <div className="space-y-6 pb-16">
      <div className="sticky top-0 z-40 bg-[#fff8f5]/95 backdrop-blur-sm border-b border-[#d8c2b6] px-4 py-3 shadow-xs">
        <div className="max-w-5xl mx-auto flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-headline font-bold text-sm text-[#211a16] line-clamp-1">{contentData?.exam.title || "Bài thi"}</h2>
            <div className="text-xs text-[#6d3807] font-semibold">Đã trả lời {answeredCount}/{totalCount} câu</div>
          </div>
          <div className="flex items-center gap-3">
            <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border font-mono text-sm font-extrabold ${msRemaining < 300000 ? "bg-rose-50 text-rose-700 border-rose-300 animate-pulse" : "bg-white text-[#6d3807] border-[#d8c2b6]"}`}>
              <Timer className="w-4 h-4" /><span>{formatRemaining(msRemaining)}</span>
            </div>
            <button type="button" onClick={() => { if (answeredCount < totalCount) setShowConfirmModal(true); else doSubmit(answers); }} className="px-4 py-1.5 bg-[#6d3807] hover:bg-[#8a4f1e] text-white rounded-xl text-xs font-bold shadow-xs cursor-pointer">Nộp bài</button>
          </div>
        </div>
        {groupedSkills.length > 1 && (
          <div className="max-w-5xl mx-auto flex items-center gap-2 mt-3 overflow-x-auto pt-1">
            {groupedSkills.map((g) => (
              <button key={g.skill} type="button" onClick={() => { saveTempAnswers(); setActiveSkill(g.skill); }} className={`px-3 py-1 rounded-lg text-xs font-bold whitespace-nowrap cursor-pointer ${activeSkill === g.skill ? "bg-[#6d3807] text-white" : "bg-white text-[#52443a] border border-[#d8c2b6] hover:bg-[#fff1ea]"}`}>{g.skill} ({g.questions.length})</button>
            ))}
          </div>
        )}
      </div>

      <div className="max-w-4xl mx-auto px-4">
        <LessonPlayer questions={activeQuestions} flashcards={flashcards} answers={answers} onChange={(qId, val) => setAnswers((prev) => ({ ...prev, [qId]: val }))} allowSpeaking={true} />
      </div>

      {showConfirmModal && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 space-y-4 border border-[#d8c2b6]">
            <div className="flex items-center gap-2 text-amber-700 font-bold text-sm"><AlertCircle className="w-5 h-5" /><span>Chưa hoàn thành toàn bộ câu hỏi</span></div>
            <p className="text-xs text-[#52443a] leading-relaxed">Bạn mới trả lời {answeredCount}/{totalCount} câu hỏi. Bạn có chắc chắn muốn nộp bài ngay bây giờ không?</p>
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setShowConfirmModal(false)} className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-xs font-bold cursor-pointer">Làm tiếp</button>
              <button type="button" onClick={() => doSubmit(answers)} className="px-4 py-1.5 bg-[#6d3807] hover:bg-[#8a4f1e] text-white rounded-lg text-xs font-bold cursor-pointer">Xác nhận nộp bài</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function StudentExamPage() {
  return (
    <StudentLayout>
      <Suspense fallback={<div className="min-h-[60vh] flex flex-col items-center justify-center"><Loader2 className="w-8 h-8 text-[#6d3807] animate-spin mb-2" /><p className="text-xs text-[#52443a]">Đang tải trang làm đề...</p></div>}>
        <StudentExamInner />
      </Suspense>
    </StudentLayout>
  );
}
