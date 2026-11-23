"use client";
// Bảng câu hỏi của màn làm đề (SCR-13). FEAT-017: phần chỉ đọc là ô biểu tượng sách, câu chiếm nhiều số hiện "7–11".
import { BookOpen } from "lucide-react";
import { countAnswered } from "@/lib/lesson-player";
import { navStatus, questionNumberLabel, screenIndexOfQuestion, type ExamScreen, type SectionScreen } from "@/lib/exam-layout";

interface NavQuestion {
  id: string;
  category: string;
  content: unknown;
  number_start?: number;
  number_count?: number;
  [k: string]: unknown;
}

export default function ExamNavigatorGrid({
  screens,
  currentIndex,
  questions,
  answers,
  flaggedIds,
  bySections,
  onGo,
}: {
  screens: (ExamScreen | SectionScreen)[];
  currentIndex: number;
  questions: NavQuestion[];
  answers: Record<string, unknown>;
  flaggedIds: Record<string, boolean>;
  bySections: boolean;
  onGo: (screenIndex: number) => void;
}) {
  const current = screens[currentIndex];
  const answeredCount = countAnswered(questions, answers);
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold uppercase tracking-wider text-ink">Bảng câu hỏi</span>
        <span className="text-xs font-semibold text-brand-600">{answeredCount}/{questions.length} đã làm</span>
      </div>
      <div className="grid grid-cols-5 gap-2">
        {bySections && screens.map((sc, si) => (sc as SectionScreen).readOnly ? (
          <button key={`ro_${sc.key}`} type="button" aria-label={`Màn ${si + 1}: phần chỉ đọc`} onClick={() => onGo(si)}
            className={`h-9 rounded-xl border text-xs font-bold transition-all cursor-pointer inline-flex items-center justify-center ${si === currentIndex ? "bg-brand-600 text-white border-brand-600" : si < currentIndex ? "bg-emerald-100 text-emerald-900 border-emerald-400" : "bg-white text-ink-muted border-line hover:border-brand-600"}`}>
            <BookOpen className={`w-4 h-4 ${si === currentIndex ? "text-white" : ""}`} />
          </button>
        ) : null)}
        {questions.map((q, idx) => {
          const st = navStatus({
            isCurrent: Boolean(current?.questionIds.includes(q.id)),
            isFlagged: Boolean(flaggedIds[q.id]),
            isAnswered: countAnswered([q], answers) > 0,
          });
          const btnStyle =
            st === "current" ? "bg-brand-600 text-white border-brand-600 ring-2 ring-brand-600/30" :
            st === "flagged" ? "bg-amber-100 text-amber-900 border-amber-400" :
            st === "answered" ? "bg-emerald-100 text-emerald-900 border-emerald-400" :
            "bg-white text-ink-muted border-line hover:border-brand-600";
          return (
            <button key={q.id} type="button" onClick={() => { const t = screenIndexOfQuestion(screens, q.id); if (t >= 0) onGo(t); }} className={`h-9 rounded-xl border text-xs font-bold transition-all cursor-pointer ${btnStyle}`}>
              {bySections ? questionNumberLabel(q, idx + 1) : idx + 1}
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
}
