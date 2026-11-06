"use client";

// Modal toàn màn hình "Xem trước như học sinh" (SCR-L3) — dùng chung cho bài học và đề thi.
// Nạp qua /api/teacher/{lessons|exams}/[id]/preview: nội dung đã ẩn đáp án, chấm thử không lưu.
// Giáo viên không bao giờ được dẫn sang trang của phân hệ học sinh.
import { useState, useEffect, useCallback, useMemo } from "react";
import LessonPlayer, { GradeResult, FlashcardItem } from "@/components/lesson-player/LessonPlayer";
import { emptyAnswerFor, countAnswered } from "@/lib/lesson-player";
import { groupQuestionsBySkill } from "@/lib/exam-player";
import {
  Loader2,
  AlertCircle,
  RefreshCw,
  FileQuestion,
  Eye,
  X,
  RotateCcw,
  CheckCircle2,
  Sparkles,
  Clock,
} from "lucide-react";

export type StudentPreviewKind = "lesson" | "exam";

interface PreviewQuestion {
  id: string;
  category: string;
  skill?: string;
  content: unknown;
  [k: string]: unknown;
}

interface PreviewMeta {
  id: string;
  title: string;
  description?: string | null;
  duration_minutes?: number;
  skills?: string[];
}

interface PreviewScore {
  objective_earned: number;
  objective_max: number;
  ai_max: number;
  score_percent: number;
}

export interface StudentPreviewModalProps {
  kind: StudentPreviewKind;
  id: string;
  /** Tiêu đề hiển thị trong lúc chờ nạp. */
  fallbackTitle?: string;
  onClose: () => void;
}

const NOUN: Record<StudentPreviewKind, string> = { lesson: "bài học", exam: "đề thi" };

function initAnswers(qs: PreviewQuestion[]): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const q of qs) out[q.id] = emptyAnswerFor(q as { category: string; content: unknown });
  return out;
}

export default function StudentPreviewModal({ kind, id, fallbackTitle, onClose }: StudentPreviewModalProps) {
  const endpoint = `/api/teacher/${kind === "lesson" ? "lessons" : "exams"}/${id}/preview`;
  const noun = NOUN[kind];

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [meta, setMeta] = useState<PreviewMeta | null>(null);
  const [questions, setQuestions] = useState<PreviewQuestion[]>([]);
  const [flashcards, setFlashcards] = useState<FlashcardItem[]>([]);
  const [answers, setAnswers] = useState<Record<string, unknown>>({});
  const [results, setResults] = useState<GradeResult[] | null>(null);
  const [score, setScore] = useState<PreviewScore | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Nạp dữ liệu thuần (không setState) → áp vào state trong .then, tránh setState đồng bộ trong effect.
  const fetchPreview = useCallback(async (): Promise<
    | { ok: true; meta: PreviewMeta | null; questions: PreviewQuestion[]; flashcards: FlashcardItem[] }
    | { ok: false; error: string }
  > => {
    try {
      const res = await fetch(endpoint);
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.success) {
        return { ok: false, error: json?.error || `Không thể tải nội dung xem trước ${noun}.` };
      }
      return {
        ok: true,
        meta: json[kind] || null,
        questions: Array.isArray(json.questions) ? json.questions : [],
        flashcards: Array.isArray(json.flashcards) ? json.flashcards : [],
      };
    } catch (err: unknown) {
      console.error("Preview load error:", err);
      return { ok: false, error: err instanceof Error ? err.message : `Lỗi kết nối khi tải xem trước ${noun}.` };
    }
  }, [endpoint, kind, noun]);

  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    fetchPreview().then((r) => {
      if (cancelled) return;
      if (r.ok) {
        setMeta(r.meta);
        setQuestions(r.questions);
        setFlashcards(r.flashcards);
        setAnswers(initAnswers(r.questions));
      } else {
        setError(r.error);
      }
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [fetchPreview, reloadKey]);

  const retry = () => {
    setLoading(true);
    setError(null);
    setSubmitError(null);
    setResults(null);
    setScore(null);
    setReloadKey((k) => k + 1);
  };

  // Esc để đóng, khoá cuộn trang nền
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [onClose]);

  const handleReset = () => {
    setResults(null);
    setScore(null);
    setSubmitError(null);
    setAnswers(initAnswers(questions));
  };

  const handleGrade = async () => {
    setSubmitting(true);
    setSubmitError(null);
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.success) {
        setSubmitError(json?.error || "Lỗi khi chấm thử.");
        return;
      }
      setResults(json.results || []);
      setScore({
        objective_earned: Number(json.objective_earned) || 0,
        objective_max: Number(json.objective_max) || 0,
        ai_max: Number(json.ai_max) || 0,
        score_percent: Number(json.score_percent) || 0,
      });
    } catch (err: unknown) {
      console.error("Preview grade error:", err);
      setSubmitError(err instanceof Error ? err.message : "Lỗi kết nối khi chấm thử.");
    } finally {
      setSubmitting(false);
    }
  };

  const answeredCount = useMemo(() => countAnswered(questions, answers), [questions, answers]);

  // Đề thi: chia theo kỹ năng như học sinh làm bài; bài học: một khối liền
  const sections = useMemo(() => {
    if (kind === "lesson") return [{ skill: "", questions, start: 1 }];
    let start = 1;
    return groupQuestionsBySkill(questions).map((g) => {
      const sec = { skill: g.skill, questions: g.questions as PreviewQuestion[], start };
      start += g.questions.length;
      return sec;
    });
  }, [kind, questions]);

  const onAnswer = (qId: string, val: unknown) => setAnswers((prev) => ({ ...prev, [qId]: val }));
  const hasContent = !loading && !error && questions.length > 0;
  const title = meta?.title || fallbackTitle || (kind === "lesson" ? "Bài học" : "Đề thi");

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Xem trước như học sinh: ${title}`}
      className="fixed inset-0 z-50 bg-surface-alt flex flex-col overflow-hidden animate-in fade-in duration-200"
    >
      {/* Header */}
      <div className="h-16 shrink-0 border-b border-line-soft bg-white px-4 sm:px-8 flex items-center justify-between shadow-2xs">
        <div className="flex items-center gap-3 overflow-hidden">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600 border border-brand-300">
            <Eye className="w-5 h-5" />
          </span>
          <div className="truncate">
            <div className="flex items-center gap-2">
              <h2 className="font-headline font-bold text-base text-ink truncate">Xem trước như học sinh: {title}</h2>
              <span className="hidden sm:inline-flex rounded-full bg-amber-100 text-amber-800 border border-amber-300 px-2 py-0.5 text-[11px] font-bold">
                Không lưu kết quả
              </span>
            </div>
            <p className="text-[11px] text-ink-muted truncate flex items-center gap-2">
              <span>Nội dung đã ẩn đáp án đúng như học sinh nhìn thấy.</span>
              {kind === "exam" && meta?.duration_minutes ? (
                <span className="hidden sm:inline-flex items-center gap-1 font-semibold text-ink">
                  <Clock className="w-3 h-3" /> {meta.duration_minutes} phút
                </span>
              ) : null}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="inline-flex items-center gap-1.5 rounded-xl border border-line bg-white px-3.5 py-1.5 text-xs font-bold text-ink-muted hover:bg-gray-50 hover:text-ink transition-all cursor-pointer"
        >
          <X className="w-4 h-4" />
          <span>Đóng</span>
        </button>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 md:p-8">
        <div className="max-w-4xl mx-auto space-y-6">
          {loading && (
            <div className="bg-white p-16 rounded-2xl border border-line shadow-sm flex flex-col items-center justify-center text-center space-y-3">
              <Loader2 className="w-8 h-8 animate-spin text-brand-600" />
              <p className="text-xs font-semibold text-ink-muted">Đang tải nội dung xem trước {noun}...</p>
            </div>
          )}

          {!loading && error && (
            <div className="bg-rose-50 border border-rose-200 p-8 rounded-2xl text-center space-y-4">
              <div className="w-12 h-12 rounded-full bg-rose-100 text-rose-600 mx-auto flex items-center justify-center">
                <AlertCircle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-rose-900">Không thể tải bản xem trước</h3>
                <p className="text-xs text-rose-700 mt-1">{error}</p>
              </div>
              <button
                onClick={retry}
                className="inline-flex items-center px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition-all space-x-1.5 shadow-2xs cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Thử lại</span>
              </button>
            </div>
          )}

          {!loading && !error && questions.length === 0 && (
            <div className="bg-white border border-line p-12 rounded-2xl text-center space-y-3 shadow-xs">
              <FileQuestion className="w-10 h-10 text-gray-400 mx-auto" />
              <h3 className="text-sm font-bold text-ink">
                {kind === "lesson" ? "Bài học" : "Đề thi"} chưa có câu hỏi
              </h3>
              <p className="text-xs text-ink-muted max-w-sm mx-auto">
                Hãy thêm ít nhất một khối câu hỏi trong trang soạn trước khi xem trước.
              </p>
              <button
                type="button"
                onClick={onClose}
                className="inline-flex items-center px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-xl text-xs font-bold transition-all shadow-2xs cursor-pointer"
              >
                Đóng xem trước
              </button>
            </div>
          )}

          {hasContent && (
            <>
              {results && score && (
                <div className="rounded-2xl border border-emerald-300 bg-emerald-50/60 p-6 shadow-xs space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-600 text-white shadow-xs">
                        <CheckCircle2 className="h-6 w-6" />
                      </div>
                      <div>
                        <h3 className="font-headline font-bold text-lg text-emerald-950">
                          Kết quả chấm thử: {score.score_percent}%
                        </h3>
                        <p className="text-xs font-medium text-emerald-800">
                          Đúng {score.objective_earned} / {score.objective_max} điểm trắc nghiệm &amp; khách quan.
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={handleReset}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-400 bg-white px-3.5 py-2 text-xs font-bold text-emerald-900 hover:bg-emerald-50 transition-all cursor-pointer shadow-2xs"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>Làm lại</span>
                    </button>
                  </div>
                  <div className="flex items-center gap-2 rounded-xl bg-amber-50 border border-amber-200 px-3.5 py-2.5 text-xs text-amber-900 font-medium">
                    <Sparkles className="w-4 h-4 text-amber-700 shrink-0" />
                    <span>Phần tự luận / nói chỉ được AI chấm khi học sinh làm bài thật.</span>
                  </div>
                </div>
              )}

              {submitError && (
                <div className="rounded-xl border border-rose-300 bg-rose-50 p-4 text-xs font-medium text-rose-800 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>{submitError}</span>
                </div>
              )}

              {sections.map((sec) => (
                <section key={sec.skill || "all"} className="space-y-3">
                  {sec.skill && (
                    <h3 className="font-headline font-bold text-sm text-brand-600 uppercase tracking-wide">
                      {sec.skill}
                    </h3>
                  )}
                  <LessonPlayer
                    questions={sec.questions}
                    flashcards={flashcards}
                    answers={answers}
                    onChange={onAnswer}
                    results={results}
                    disabled={submitting || Boolean(results)}
                    startNumber={sec.start}
                  />
                </section>
              ))}
            </>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="h-16 shrink-0 border-t border-line-soft bg-white px-4 sm:px-8 flex items-center justify-between shadow-xs">
        <div className="text-xs text-ink-muted">
          {hasContent && (
            <span>
              Đã trả lời: <strong className="text-ink">{answeredCount}</strong> / {questions.length} câu
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-line bg-white px-4 py-2 text-xs font-bold text-ink-muted hover:bg-gray-50 transition-all cursor-pointer"
          >
            Đóng
          </button>
          {hasContent &&
            (results ? (
              <button
                type="button"
                onClick={handleReset}
                className="inline-flex items-center gap-1.5 rounded-xl border border-brand-600 bg-brand-50 hover:bg-brand-100 px-4 py-2 text-xs font-bold text-brand-600 transition-all cursor-pointer shadow-2xs"
              >
                <RotateCcw className="w-4 h-4" />
                <span>Làm lại</span>
              </button>
            ) : (
              <button
                type="button"
                disabled={submitting}
                onClick={handleGrade}
                className="inline-flex items-center gap-1.5 rounded-xl bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white px-5 py-2 text-xs font-bold transition-all shadow-xs cursor-pointer"
              >
                {submitting ? (
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
            ))}
        </div>
      </div>
    </div>
  );
}

/** Nút "Xem trước như học sinh" đặt trong trang soạn (bài học / đề thi). */
export function StudentPreviewButton({
  kind,
  id,
  title,
  className,
}: {
  kind: StudentPreviewKind;
  id: string;
  title?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={
          className ||
          "inline-flex items-center space-x-1.5 text-xs font-bold text-brand-600 hover:text-brand-700 bg-white hover:bg-brand-50 px-4 py-2 rounded-xl transition-all border border-brand-600 shadow-2xs cursor-pointer"
        }
      >
        <Eye className="w-4 h-4" />
        <span>Xem trước như học sinh</span>
      </button>
      {open && <StudentPreviewModal kind={kind} id={id} fallbackTitle={title} onClose={() => setOpen(false)} />}
    </>
  );
}
