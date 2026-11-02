"use client";

import { useState, useEffect, useRef, useCallback, useMemo, Suspense } from "react";
import { useParams, useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import StudentLayout from "@/components/StudentLayout";
import LessonPlayer, { FlashcardItem } from "@/components/lesson-player/LessonPlayer";
import { emptyExamAnswerFor, groupQuestionsBySkill, formatRemaining } from "@/lib/exam-player";
import { countAnswered } from "@/lib/lesson-player";
import { sanitizeStimulusHtml } from "@/lib/stimulus-html";
import { summarizeAttemptResult } from "@/lib/attempt-summary";
import {
  buildScreens, navStatus, screenIndexOfQuestion, clampScreenIndex,
  unansweredNumbers, formatSavedAt, keyToOptionLetter, isTypingTarget, applyOptionShortcut,
} from "@/lib/exam-layout";
import {
  Timer, AlertCircle, Loader2, Clock, FileCheck, ExternalLink,
  ArrowLeft, ArrowRight, Flag, LayoutGrid, Volume2, GripVertical, X, CheckCircle2,
} from "lucide-react";

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
  section_scores?: Record<string, { score: number | null; earned?: number; max?: number }>;
  total_score?: number | null;
  passed?: boolean | null;
  is_late?: boolean;
  standard_snapshot?: any;
}

function StudentExamInner() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const examId = (params?.examId || "") as string;
  const classId = searchParams.get("classId") || undefined;

  const [phase, setPhase] = useState<"loading" | "start" | "running" | "submitting" | "result" | "error">("loading");
  const [examMeta, setExamMeta] = useState<{ id: string; title: string; duration_minutes: number } | null>(null);
  const [contentData, setContentData] = useState<ExamContentData | null>(null);
  const [attempt, setAttempt] = useState<AttemptData | null>(null);
  const [remainingAttempts, setRemainingAttempts] = useState<number | null>(null);
  const [answers, setAnswers] = useState<Record<string, unknown>>({});
  const [activeSkill, setActiveSkill] = useState<string>("");
  const [currentScreenIdx, setCurrentScreenIdx] = useState<number>(0);
  const [flaggedIds, setFlaggedIds] = useState<Record<string, boolean>>({});
  const [saveStatusText, setSaveStatusText] = useState<string>("");
  const [splitRatio, setSplitRatio] = useState<number>(55);
  const [fontSize, setFontSize] = useState<"text-sm" | "text-base" | "text-lg">("text-base");
  const [mobileSplitTab, setMobileSplitTab] = useState<"passage" | "questions">("passage");
  const [showNavigator, setShowNavigator] = useState<boolean>(true);
  const [showMobileNav, setShowMobileNav] = useState<boolean>(false);
  const [showExitModal, setShowExitModal] = useState<boolean>(false);
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
  const splitContainerRef = useRef<HTMLDivElement | null>(null);
  const passageScrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => () => {
    if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
    if (autoSaveIntervalRef.current) clearInterval(autoSaveIntervalRef.current);
    if (gradingPollingRef.current) clearInterval(gradingPollingRef.current);
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
      setCurrentScreenIdx(0);
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
          setCurrentScreenIdx(0);
          setPhase("running");
          return;
        }
      }
      const examRes = await fetch(`/api/exams/${examId}`);
      if (examRes.status === 404) { setErrorMessage("Không tìm thấy đề thi."); setPhase("error"); return; }
      if (!examRes.ok) { setErrorMessage("Lỗi tải thông tin đề thi."); setPhase("error"); return; }
      const examJson = await examRes.json();
      setExamMeta(examJson.exam);
      setPhase("start");
    } catch (err: any) {
      setErrorMessage(err.message || "Đã xảy ra lỗi khi kết nối máy chủ.");
      setPhase("error");
    }
  }, [examId, classId, initAnswers]);

  useEffect(() => { if (examId) checkInitialStatus(); }, [examId, checkInitialStatus]);

  const handleStartExam = async () => {
    setStartLoading(true);
    setErrorMessage(null);
    try {
      const res = await fetch(`/api/student/exams/${examId}/attempts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ classId }),
      });
      if (res.status === 403) { setErrorMessage("Bạn không có quyền làm đề thi này (403)."); return; }
      if (res.status === 409) { setErrorMessage("Bạn đã hết lượt làm đề này (409)."); return; }
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
      if (res.status === 409 && autoSaveIntervalRef.current) { clearInterval(autoSaveIntervalRef.current); return; }
      setSaveStatusText(res.ok ? formatSavedAt(new Date()) : "Chưa lưu được");
    } catch {
      setSaveStatusText("Chưa lưu được");
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
      if (new Date(attempt.deadline_at).getTime() - curNow <= 0 && !hasAutoSubmittedRef.current) {
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

  const questions = contentData?.questions || [];
  const flashcards = contentData?.flashcards || [];
  const groupedSkills = useMemo(() => groupQuestionsBySkill(questions), [questions]);
  const orderedQuestions = useMemo(() => groupedSkills.flatMap((g) => g.questions), [groupedSkills]);
  const screens = useMemo(() => buildScreens(questions), [questions]);
  const safeScreenIdx = clampScreenIndex(currentScreenIdx, screens.length);
  const currentScreen = screens[safeScreenIdx] || null;

  const screenQuestions = useMemo(() => {
    if (!currentScreen) return [];
    const map = new Map(orderedQuestions.map((q) => [String(q.id), q]));
    return currentScreen.questionIds.map((id) => map.get(String(id))).filter(Boolean);
  }, [currentScreen, orderedQuestions]);

  const screenStartNumber = useMemo(() => {
    if (!currentScreen || currentScreen.questionIds.length === 0) return 1;
    const idx = orderedQuestions.findIndex((q) => String(q.id) === String(currentScreen.questionIds[0]));
    return idx >= 0 ? idx + 1 : 1;
  }, [currentScreen, orderedQuestions]);

  useEffect(() => {
    if (currentScreen?.skill && currentScreen.skill !== activeSkill) setActiveSkill(currentScreen.skill);
    if (passageScrollRef.current) passageScrollRef.current.scrollTop = 0;
  }, [currentScreen?.key]);

  const goToScreen = useCallback((nextIdx: number) => {
    setCurrentScreenIdx(clampScreenIndex(nextIdx, screens.length));
    setShowMobileNav(false);
  }, [screens.length]);

  useEffect(() => {
    if (phase !== "running") return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ""; };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => { window.removeEventListener("beforeunload", onBeforeUnload); };
  }, [phase]);

  useEffect(() => {
    if (phase !== "running") return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (isTypingTarget(e.target) || showConfirmModal || showExitModal) return;
      if (e.key === "ArrowLeft") { e.preventDefault(); setCurrentScreenIdx((p) => clampScreenIndex(p - 1, screens.length)); return; }
      if (e.key === "ArrowRight") { e.preventDefault(); setCurrentScreenIdx((p) => clampScreenIndex(p + 1, screens.length)); return; }
      const letter = keyToOptionLetter(e.key);
      if (letter && screenQuestions.length === 1) {
        const onlyQ = screenQuestions[0];
        const nextAns = applyOptionShortcut(onlyQ, answersRef.current[onlyQ.id], letter);
        if (nextAns !== null) setAnswers((prev) => ({ ...prev, [onlyQ.id]: nextAns }));
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => { window.removeEventListener("keydown", onKeyDown); };
  }, [phase, screens.length, screenQuestions, showConfirmModal, showExitModal]);

  const handleDividerPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    const onMove = (ev: PointerEvent) => {
      const rect = splitContainerRef.current?.getBoundingClientRect();
      if (!rect || rect.width <= 0) return;
      setSplitRatio(Math.max(30, Math.min(70, Math.round(((ev.clientX - rect.left) / rect.width) * 100))));
    };
    const onUp = () => { window.removeEventListener("pointermove", onMove); window.removeEventListener("pointerup", onUp); };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  };

  const toggleScreenFlag = () => {
    if (!currentScreen) return;
    const ids = currentScreen.questionIds;
    const allFlagged = ids.every((id) => Boolean(flaggedIds[id]));
    setFlaggedIds((prev) => {
      const next = { ...prev };
      for (const id of ids) next[id] = !allFlagged;
      return next;
    });
  };

  if (phase === "loading") {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center space-y-3">
        <Loader2 className="w-8 h-8 text-brand-600 animate-spin" />
        <p className="text-sm font-medium text-ink-muted">Đang chuẩn bị đề thi...</p>
      </div>
    );
  }

  if (phase === "error") {
    return (
      <div className="max-w-md mx-auto my-12 p-6 rounded-2xl bg-white border border-rose-200 text-center space-y-4">
        <AlertCircle className="w-10 h-10 text-rose-600 mx-auto" />
        <h2 className="text-lg font-bold text-ink">Không thể tải đề thi</h2>
        <p className="text-sm text-rose-700">{errorMessage || "Đã xảy ra lỗi."}</p>
        <div className="flex justify-center gap-3 pt-2">
          <button type="button" onClick={checkInitialStatus} className="px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-xl text-xs font-bold cursor-pointer">Thử lại</button>
          <Link href="/student/dashboard" className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-xs font-bold">Về Dashboard</Link>
        </div>
      </div>
    );
  }

  if (phase === "start") {
    return (
      <div className="max-w-2xl mx-auto my-10 p-6 md:p-8 rounded-3xl bg-white border border-line space-y-6">
        <div className="border-b border-line-soft pb-4">
          <h1 className="text-2xl font-bold font-headline text-ink mb-2">{examMeta?.title || "Đề thi"}</h1>
          <div className="flex flex-wrap items-center gap-4 text-xs text-ink-muted">
            <span className="flex items-center gap-1 font-semibold"><Clock className="w-4 h-4 text-brand-600" />Thời gian: {examMeta?.duration_minutes ?? 0} phút</span>
            {remainingAttempts !== null && remainingAttempts !== undefined && (
              <span className="flex items-center gap-1 font-semibold text-purple-700"><FileCheck className="w-4 h-4" />Số lượt còn lại: {remainingAttempts}</span>
            )}
          </div>
        </div>
        <div className="rounded-2xl border border-amber-200 bg-amber-50/60 p-4 space-y-2">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-amber-800"><AlertCircle className="w-4 h-4 text-amber-700" />Lưu ý quan trọng:</div>
          <p className="text-xs text-ink-muted leading-relaxed">Đồng hồ tính theo máy chủ, tải lại trang không dừng giờ. Vui lòng đảm bảo kết nối mạng ổn định trong suốt quá trình làm bài thi.</p>
        </div>
        {errorMessage && <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-semibold text-rose-800">{errorMessage}</div>}
        <div className="flex items-center justify-between pt-2">
          <Link href="/student/dashboard" className="inline-flex items-center gap-1 text-xs font-bold text-ink-muted hover:text-brand-600"><ArrowLeft className="w-4 h-4" /> Quay lại</Link>
          <button type="button" disabled={startLoading} onClick={handleStartExam} className="inline-flex items-center gap-2 px-6 py-2.5 bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white rounded-xl text-sm font-bold shadow-xs cursor-pointer">
            {startLoading && <Loader2 className="w-4 h-4 animate-spin" />}Bắt đầu làm bài
          </button>
        </div>
      </div>
    );
  }

  if (phase === "submitting") {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center space-y-3">
        <Loader2 className="w-10 h-10 text-brand-600 animate-spin" />
        <h3 className="text-base font-bold text-ink">Đang nộp bài thi lên máy chủ...</h3>
        <p className="text-xs text-ink-muted">Hệ thống đang lưu bài và tiến hành chấm điểm.</p>
      </div>
    );
  }

  if (phase === "result" && attempt) {
    const summary = summarizeAttemptResult({ ...attempt, standard_snapshot: attempt.standard_snapshot || contentData?.standard || null });
    const pendingLabel = summary.pending.length > 0 ? summary.pending.join(", ") : "tự luận";
    return (
      <div className="max-w-3xl mx-auto my-8 p-6 md:p-8 rounded-3xl bg-white border border-line space-y-6">
        <div className="flex items-center justify-between border-b border-line-soft pb-4">
          <div><h1 className="text-xl font-bold font-headline text-ink">Kết Quả Bài Thi</h1><p className="text-xs text-ink-subtle">Mã bài nộp: {attempt.id}</p></div>
          {attempt.is_late && <span className="px-3 py-1 bg-rose-100 border border-rose-300 text-rose-800 rounded-lg text-xs font-bold">Nộp trễ</span>}
        </div>
        {(summary.state === "PARTIAL" || summary.state === "WAITING_AI") && <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4 flex items-start gap-3 text-xs text-blue-900 font-medium"><Loader2 className="w-5 h-5 text-blue-600 animate-spin shrink-0 mt-0.5" /><div className="space-y-1"><div className="font-bold">AI đang chấm phần {pendingLabel}…</div><div>Có điểm, hệ thống sẽ báo ở mục Thông báo (chuông trên thanh đầu trang).</div></div></div>}
        {summary.state === "WAITING_TEACHER" && <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 flex items-start gap-3 text-xs text-amber-900 font-medium"><AlertCircle className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" /><div className="space-y-1"><div className="font-bold">Giáo viên sẽ chấm phần {pendingLabel}.</div><div>Có điểm, hệ thống sẽ báo ở mục Thông báo (chuông trên thanh đầu trang).</div></div></div>}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-5 rounded-2xl bg-surface-alt border border-line-soft text-center space-y-1">
            <div className="text-xs font-bold text-ink-subtle uppercase tracking-wider">Tổng điểm</div>
            {summary.state === "FINAL" ? <div className="text-3xl font-extrabold text-brand-600">{summary.total !== null ? summary.total : "—"}</div> : <div className="text-base font-extrabold text-brand-600 pt-1">Chờ phần {pendingLabel}</div>}
          </div>
          <div className="p-5 rounded-2xl bg-surface-alt border border-line-soft text-center space-y-1">
            <div className="text-xs font-bold text-ink-subtle uppercase tracking-wider">Kết quả xếp loại</div>
            <div className="text-2xl font-extrabold">{summary.state === "FINAL" ? (summary.passed === true ? <span className="text-emerald-700">Đạt</span> : summary.passed === false ? <span className="text-rose-700">Chưa đạt</span> : <span className="text-gray-500">—</span>) : <span className="text-sm font-semibold text-ink-subtle">Chờ chấm xong</span>}</div>
          </div>
        </div>
        {summary.graded.length > 0 && (
          <div className="space-y-3">
            <h3 className="text-sm font-bold text-ink uppercase tracking-wider">{summary.state === "FINAL" ? "Điểm từng phần:" : "Đã chấm:"}</h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {summary.graded.map((g) => (<div key={g.skill} className="p-3.5 rounded-xl border border-line-soft bg-surface-alt text-center space-y-1"><div className="text-xs font-bold text-ink-muted">{g.skill}</div><div className="text-xl font-bold text-brand-600">{g.score}</div>{g.max !== undefined && g.earned !== undefined && <div className="text-[11px] text-ink-subtle">{g.earned}/{g.max} câu</div>}</div>))}
            </div>
          </div>
        )}
        {summary.pending.length > 0 && (
          <div className="space-y-3">
            <h3 className="text-sm font-bold text-ink uppercase tracking-wider">{summary.state === "WAITING_TEACHER" ? "Chờ giáo viên chấm:" : "AI đang chấm:"}</h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {summary.pending.map((skill) => (<div key={skill} className="p-3.5 rounded-xl border border-dashed border-line bg-surface-alt text-center space-y-1"><div className="text-xs font-bold text-ink-muted">{skill}</div><div className="text-xs font-semibold text-ink-subtle">{summary.state === "WAITING_TEACHER" ? "Giáo viên sẽ chấm" : "AI đang chấm…"}</div></div>))}
            </div>
          </div>
        )}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-line-soft">
          <Link href="/student/dashboard" className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-xs font-bold">Về Dashboard</Link>
          <Link href={`/student/exam/review/${attempt.id}`} className="inline-flex items-center gap-1.5 px-5 py-2.5 bg-brand-600 hover:bg-brand-700 text-white rounded-xl text-xs font-bold shadow-xs"><span>Xem chi tiết</span><ExternalLink className="w-3.5 h-3.5" /></Link>
        </div>
      </div>
    );
  }

  const msRemaining = attempt?.deadline_at ? new Date(attempt.deadline_at).getTime() - now : 0;
  const answeredCount = countAnswered(questions, answers);
  const totalCount = questions.length;
  const progressPct = totalCount > 0 ? Math.round((answeredCount / totalCount) * 100) : 0;
  const missingNums = unansweredNumbers(questions, answers);
  const isCurrentScreenFlagged = Boolean(currentScreen && currentScreen.questionIds.every((id) => flaggedIds[id]));
  const handleAnswerChange = (qId: string, val: unknown) => setAnswers((prev) => ({ ...prev, [qId]: val }));

  const renderNavigatorGrid = () => (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold uppercase tracking-wider text-ink">Bảng câu hỏi</span>
        <span className="text-xs font-semibold text-brand-600">{answeredCount}/{totalCount} đã làm</span>
      </div>
      <div className="grid grid-cols-5 gap-2">
        {orderedQuestions.map((q, idx) => {
          const st = navStatus({
            isCurrent: Boolean(currentScreen?.questionIds.includes(q.id)),
            isFlagged: Boolean(flaggedIds[q.id]),
            isAnswered: countAnswered([q], answers) > 0,
          });
          const btnStyle =
            st === "current" ? "bg-brand-600 text-white border-brand-600 ring-2 ring-brand-600/30" :
            st === "flagged" ? "bg-amber-100 text-amber-900 border-amber-400" :
            st === "answered" ? "bg-emerald-100 text-emerald-900 border-emerald-400" :
            "bg-white text-ink-muted border-line hover:border-brand-600";
          return (
            <button key={q.id} type="button" onClick={() => { const t = screenIndexOfQuestion(screens, q.id); if (t >= 0) goToScreen(t); }} className={`h-9 rounded-xl border text-xs font-bold transition-all cursor-pointer ${btnStyle}`}>
              {idx + 1}
            </button>
          );
        })}
      </div>
      <div className="grid grid-cols-2 gap-2 pt-2 border-t border-line-soft text-[11px] font-medium text-ink-muted">
        <div className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-brand-600 inline-block" />Đang làm</div>
        <div className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-amber-200 border border-amber-400 inline-block" />Đánh dấu</div>
        <div className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-emerald-200 border border-emerald-400 inline-block" />Đã làm</div>
        <div className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-white border border-line inline-block" />Chưa làm</div>
      </div>
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 bg-surface-alt flex flex-col overflow-hidden">
      <header className="shrink-0 bg-surface-alt border-b border-line px-4 py-2.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-3 min-w-0">
            <button type="button" onClick={() => setShowExitModal(true)} className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl border border-line bg-white hover:bg-brand-50 text-xs font-bold text-ink-muted cursor-pointer">
              <ArrowLeft className="w-3.5 h-3.5" />Thoát
            </button>
            <div className="min-w-0">
              <h2 className="font-headline font-bold text-sm text-ink truncate">{contentData?.exam.title || "Bài thi"}</h2>
              <div className="flex flex-wrap items-center gap-2 text-[11px] text-brand-600 font-semibold">
                <span>Màn {safeScreenIdx + 1} / {Math.max(1, screens.length)}</span>
                <span>•</span>
                <span>Đã làm {answeredCount}/{totalCount} câu</span>
                {saveStatusText && <><span>•</span><span className={saveStatusText === "Chưa lưu được" ? "text-rose-700" : "text-emerald-700"}>{saveStatusText}</span></>}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border font-mono text-sm font-extrabold ${msRemaining < 300000 ? "bg-rose-50 text-rose-700 border-rose-300 animate-pulse" : "bg-white text-brand-600 border-line"}`}>
              <Timer className="w-4 h-4" /><span>{formatRemaining(msRemaining)}</span>
            </div>
            <button type="button" onClick={() => setShowMobileNav(true)} className="lg:hidden inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl border border-line bg-white text-xs font-bold text-ink-muted cursor-pointer"><LayoutGrid className="w-4 h-4" />Bảng câu</button>
            <button type="button" onClick={() => setShowNavigator((v) => !v)} className="hidden lg:inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl border border-line bg-white hover:bg-brand-50 text-xs font-bold text-ink-muted cursor-pointer"><LayoutGrid className="w-4 h-4" />Bảng câu hỏi</button>
            <button type="button" onClick={() => setShowConfirmModal(true)} className="px-4 py-1.5 bg-brand-600 hover:bg-brand-700 text-white rounded-xl text-xs font-bold shadow-xs cursor-pointer">Nộp bài</button>
          </div>
        </div>

        {groupedSkills.length > 1 && (
          <div className="flex items-center gap-2 mt-2 overflow-x-auto pt-1">
            {groupedSkills.map((g) => (
              <button
                key={g.skill}
                type="button"
                onClick={() => {
                  saveTempAnswers();
                  setActiveSkill(g.skill);
                  const firstQ = g.questions[0];
                  if (firstQ) { const idx = screenIndexOfQuestion(screens, firstQ.id); if (idx >= 0) goToScreen(idx); }
                }}
                className={`px-3 py-1 rounded-lg text-xs font-bold whitespace-nowrap cursor-pointer ${activeSkill === g.skill ? "bg-brand-600 text-white" : "bg-white text-ink-muted border border-line hover:bg-brand-50"}`}
              >
                {g.skill} ({g.questions.length})
              </button>
            ))}
          </div>
        )}
      </header>

      <div className="h-1 w-full bg-line-soft shrink-0"><div className="h-full bg-brand-600 transition-all duration-300" style={{ width: `${progressPct}%` }} /></div>

      <div className="flex-1 flex min-h-0 overflow-hidden">
        <main className="flex-1 min-w-0 flex flex-col overflow-hidden">
          {currentScreen?.mode === "LISTENING" && (
            <div className="flex-1 overflow-y-auto">
              {currentScreen.stimulus_audio_url && (
                <div className="sticky top-0 z-20 bg-surface-alt/95 backdrop-blur-xs border-b border-line px-4 py-3">
                  <div className="max-w-3xl mx-auto flex items-center gap-3 rounded-xl border border-line bg-white p-2.5 shadow-2xs">
                    <Volume2 className="w-5 h-5 text-brand-600 shrink-0" />
                    <audio controls src={currentScreen.stimulus_audio_url} className="w-full h-8" />
                  </div>
                </div>
              )}
              <div className="max-w-3xl mx-auto p-4 md:p-6 space-y-5">
                {currentScreen.stimulus_text && (
                  <div className="rounded-2xl border border-line bg-white p-5 text-sm leading-relaxed text-ink [&_img]:max-h-[45vh] [&_img]:w-auto [&_img]:max-w-full [&_img]:object-contain [&_img]:mx-auto [&_img]:rounded-xl" dangerouslySetInnerHTML={{ __html: sanitizeStimulusHtml(currentScreen.stimulus_text) }} />
                )}
                <LessonPlayer questions={screenQuestions} flashcards={flashcards} answers={answers} onChange={handleAnswerChange} allowSpeaking={true} hideStimulus={true} startNumber={screenStartNumber} />
              </div>
            </div>
          )}

          {currentScreen?.mode === "FOCUS" && (
            <div className="flex-1 overflow-y-auto p-4 md:p-6">
              <div className="max-w-[720px] mx-auto space-y-5">
                {currentScreen.stimulus_text && (
                  <div className="rounded-2xl border border-line bg-white p-5 text-sm leading-relaxed text-ink shadow-2xs [&_img]:max-h-[45vh] [&_img]:w-auto [&_img]:max-w-full [&_img]:object-contain [&_img]:mx-auto [&_img]:rounded-xl" dangerouslySetInnerHTML={{ __html: sanitizeStimulusHtml(currentScreen.stimulus_text) }} />
                )}
                <LessonPlayer questions={screenQuestions} flashcards={flashcards} answers={answers} onChange={handleAnswerChange} allowSpeaking={true} hideStimulus={true} startNumber={screenStartNumber} />
              </div>
            </div>
          )}

          {currentScreen?.mode === "SPLIT" && (
            <>
              <div className="lg:hidden flex flex-col flex-1 min-h-0">
                <div className="flex border-b border-line bg-white px-4 pt-2 gap-2 shrink-0">
                  <button type="button" onClick={() => setMobileSplitTab("passage")} className={`px-4 py-2 text-xs font-bold border-b-2 cursor-pointer ${mobileSplitTab === "passage" ? "border-brand-600 text-brand-600" : "border-transparent text-ink-muted"}`}>Bài đọc</button>
                  <button type="button" onClick={() => setMobileSplitTab("questions")} className={`px-4 py-2 text-xs font-bold border-b-2 cursor-pointer ${mobileSplitTab === "questions" ? "border-brand-600 text-brand-600" : "border-transparent text-ink-muted"}`}>Câu hỏi ({screenQuestions.length})</button>
                </div>
                <div className="flex-1 overflow-y-auto p-4">
                  {mobileSplitTab === "passage" ? (
                    <div className={`rounded-2xl border border-line bg-white p-5 leading-relaxed text-ink ${fontSize} [&_img]:max-w-full [&_img]:h-auto [&_img]:mx-auto [&_img]:rounded-xl`} dangerouslySetInnerHTML={{ __html: sanitizeStimulusHtml(currentScreen.stimulus_text) }} />
                  ) : (
                    <LessonPlayer questions={screenQuestions} flashcards={flashcards} answers={answers} onChange={handleAnswerChange} allowSpeaking={true} hideStimulus={true} startNumber={screenStartNumber} />
                  )}
                </div>
              </div>

              <div ref={splitContainerRef} className="hidden lg:flex flex-1 min-h-0 overflow-hidden">
                <div style={{ width: `${splitRatio}%` }} className="h-full flex flex-col bg-white border-r border-line">
                  <div className="flex items-center justify-between px-5 py-2.5 border-b border-line-soft bg-surface-alt shrink-0">
                    <span className="text-xs font-bold uppercase tracking-wider text-brand-600">Bài đọc</span>
                    <div className="flex items-center gap-1">
                      <span className="text-[11px] text-ink-muted mr-1">Cỡ chữ:</span>
                      {(["text-sm", "text-base", "text-lg"] as const).map((sz, i) => (
                        <button key={sz} type="button" onClick={() => setFontSize(sz)} className={`px-2 py-0.5 rounded text-xs font-bold cursor-pointer ${fontSize === sz ? "bg-brand-600 text-white" : "bg-surface-alt text-ink-muted border border-line"}`}>
                          {i === 0 ? "A-" : i === 1 ? "A" : "A+"}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div ref={passageScrollRef} className={`flex-1 overflow-y-auto p-6 leading-relaxed text-ink ${fontSize} [&_img]:max-w-full [&_img]:h-auto [&_img]:mx-auto [&_img]:rounded-xl [&_p]:my-2`} dangerouslySetInnerHTML={{ __html: sanitizeStimulusHtml(currentScreen.stimulus_text) }} />
                </div>

                <div onPointerDown={handleDividerPointerDown} title="Kéo để chỉnh độ rộng cột" className="w-2.5 bg-line-soft hover:bg-line cursor-col-resize flex items-center justify-center shrink-0 select-none">
                  <GripVertical className="w-3.5 h-3.5 text-brand-600" />
                </div>

                <div style={{ width: `${100 - splitRatio}%` }} className="h-full overflow-y-auto p-6">
                  <LessonPlayer questions={screenQuestions} flashcards={flashcards} answers={answers} onChange={handleAnswerChange} allowSpeaking={true} hideStimulus={true} startNumber={screenStartNumber} />
                </div>
              </div>
            </>
          )}
        </main>

        {showNavigator && (
          <aside className="hidden lg:block w-64 shrink-0 border-l border-line bg-surface-alt p-4 overflow-y-auto">
            {renderNavigatorGrid()}
          </aside>
        )}
      </div>

      <footer className="shrink-0 bg-white border-t border-line px-4 py-2.5">
        <div className="max-w-5xl mx-auto flex items-center justify-between gap-3">
          <button type="button" disabled={safeScreenIdx <= 0} onClick={() => goToScreen(safeScreenIdx - 1)} className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border border-line bg-white hover:bg-brand-50 disabled:opacity-40 text-xs font-bold text-ink cursor-pointer">
            <ArrowLeft className="w-4 h-4" />Màn trước
          </button>

          <button type="button" onClick={toggleScreenFlag} className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border text-xs font-bold cursor-pointer ${isCurrentScreenFlagged ? "bg-amber-100 border-amber-400 text-amber-900" : "bg-white border-line text-ink-muted hover:bg-surface-alt"}`}>
            <Flag className="w-3.5 h-3.5" />
            {isCurrentScreenFlagged ? "Đã đánh dấu xem lại" : "Đánh dấu xem lại"}
          </button>

          {safeScreenIdx < screens.length - 1 ? (
            <button type="button" onClick={() => goToScreen(safeScreenIdx + 1)} className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-xs font-bold cursor-pointer">
              Màn tiếp<ArrowRight className="w-4 h-4" />
            </button>
          ) : (
            <button type="button" onClick={() => setShowConfirmModal(true)} className="inline-flex items-center gap-1.5 px-5 py-2 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-xs font-bold cursor-pointer">
              <CheckCircle2 className="w-4 h-4" />Nộp bài
            </button>
          )}
        </div>
      </footer>

      {showMobileNav && (
        <div className="fixed inset-0 z-50 bg-black/40 flex justify-end lg:hidden">
          <div className="w-72 bg-white h-full p-4 overflow-y-auto space-y-4">
            <div className="flex items-center justify-between border-b border-line-soft pb-2">
              <span className="font-bold text-sm text-ink">Điều hướng nhanh</span>
              <button type="button" onClick={() => setShowMobileNav(false)} className="p-1 text-ink-muted"><X className="w-4 h-4" /></button>
            </div>
            {renderNavigatorGrid()}
          </div>
        </div>
      )}

      {showExitModal && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 space-y-4 border border-line">
            <h3 className="font-bold text-sm text-ink">Tạm rời phòng thi?</h3>
            <p className="text-xs text-ink-muted leading-relaxed">Đồng hồ làm bài trên máy chủ vẫn tiếp tục chạy. Các câu trả lời của bạn sẽ được lưu nháp trước khi rời trang.</p>
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setShowExitModal(false)} className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-xs font-bold cursor-pointer">Ở lại làm tiếp</button>
              <button type="button" onClick={async () => { await saveTempAnswers(); router.push("/student/dashboard"); }} className="px-3 py-1.5 bg-brand-600 hover:bg-brand-700 text-white rounded-lg text-xs font-bold cursor-pointer">Rời trang</button>
            </div>
          </div>
        </div>
      )}

      {showConfirmModal && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 border border-line">
            <div className="flex items-center gap-2 text-amber-700 font-bold text-sm">
              <AlertCircle className="w-5 h-5" />
              <span>{missingNums.length > 0 ? "Chưa hoàn thành toàn bộ câu hỏi" : "Xác nhận nộp bài thi"}</span>
            </div>
            <p className="text-xs text-ink-muted leading-relaxed">Bạn đã trả lời {answeredCount}/{totalCount} câu hỏi. Bạn có chắc chắn muốn nộp bài ngay bây giờ không?</p>
            {missingNums.length > 0 && (
              <div className="space-y-2">
                <div className="text-xs font-semibold text-brand-600">Câu chưa làm (bấm để nhảy tới):</div>
                <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto">
                  {missingNums.map((num) => {
                    const targetQ = orderedQuestions[num - 1];
                    return (
                      <button key={num} type="button" onClick={() => { setShowConfirmModal(false); if (targetQ) { const idx = screenIndexOfQuestion(screens, targetQ.id); if (idx >= 0) goToScreen(idx); } }} className="px-2.5 py-1 rounded-lg border border-amber-300 bg-amber-50 hover:bg-amber-100 text-amber-900 text-xs font-bold cursor-pointer">
                        Câu {num}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setShowConfirmModal(false)} className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-xs font-bold cursor-pointer">Làm tiếp</button>
              <button type="button" onClick={() => doSubmit(answers)} className="px-4 py-1.5 bg-brand-600 hover:bg-brand-700 text-white rounded-lg text-xs font-bold cursor-pointer">Xác nhận nộp bài</button>
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
      <Suspense fallback={<div className="min-h-[60vh] flex flex-col items-center justify-center"><Loader2 className="w-8 h-8 text-brand-600 animate-spin mb-2" /><p className="text-xs text-ink-muted">Đang tải trang làm đề...</p></div>}>
        <StudentExamInner />
      </Suspense>
    </StudentLayout>
  );
}
