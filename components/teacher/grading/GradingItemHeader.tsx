"use client";

import Link from "next/link";
import { ArrowLeft, CheckCircle2, Lock, Unlock, Loader2, Award } from "lucide-react";

interface ItemHeaderProps {
  classId: string;
  item: {
    kind: "lesson" | "exam";
    id: string;
    title: string;
    source?: string;
    class?: { id: string; name: string };
  };
  finalizedAt: string | null;
  onFinalize: () => void;
  onReopen: () => void;
  isFinalizing: boolean;
  isReopening: boolean;
  standardName?: string;
}

export default function GradingItemHeader({
  classId,
  item,
  finalizedAt,
  onFinalize,
  onReopen,
  isFinalizing,
  isReopening,
  standardName,
}: ItemHeaderProps) {
  const isFinalized = !!finalizedAt;
  const isLesson = item.kind === "lesson";

  const formatDate = (iso: string) => {
    try {
      const d = new Date(iso);
      const day = String(d.getDate()).padStart(2, "0");
      const month = String(d.getMonth() + 1).padStart(2, "0");
      return `${day}/${month}`;
    } catch {
      return iso;
    }
  };

  return (
    <div className="space-y-4 font-sans">
      {/* Back to Hub Navigation */}
      <div>
        <Link
          href={`/teacher/grading?class=${classId}`}
          className="text-xs text-brand-600 hover:underline inline-flex items-center font-medium"
        >
          <ArrowLeft className="w-3.5 h-3.5 mr-1" />
          <span>Quay lại hub Chấm &amp; Bảng điểm</span>
        </Link>
      </div>

      {/* Main Header Banner */}
      <div className="bg-white rounded-3xl p-6 border border-line shadow-2xs flex flex-col md:flex-row justify-between md:items-center gap-4">
        <div className="space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`px-2.5 py-0.5 rounded-lg text-xs font-bold font-mono ${
                isLesson
                  ? "bg-brand-50 text-brand-700 border border-brand-200"
                  : "bg-purple-50 text-purple-700 border border-purple-200"
              }`}
            >
              {isLesson ? "Bài học" : "Đề thi"}
            </span>

            {standardName && !isLesson && (
              <span className="px-2.5 py-0.5 bg-surface-alt text-ink-muted border border-line rounded-lg text-xs font-medium">
                Chuẩn: {standardName}
              </span>
            )}

            {item.class && (
              <span className="text-xs font-medium text-ink-muted">
                Lớp: <strong className="text-ink">{item.class.name}</strong>
              </span>
            )}
          </div>

          <h1 className="text-2xl font-bold text-ink font-headline tracking-tight">
            {item.title}
          </h1>
          <p className="text-xs text-ink-muted font-mono">
            Mã bài: {item.id} &bull; {item.source === "ROADMAP" ? "Lộ trình lớp" : "Đề giao riêng"}
          </p>
        </div>

        {/* Action Button: Finalize or Reopen */}
        <div className="flex items-center space-x-3 shrink-0">
          {isFinalized ? (
            <button
              onClick={onReopen}
              disabled={isReopening}
              className="px-4 py-2.5 bg-white border border-amber-300 hover:bg-amber-50 text-amber-800 rounded-xl text-xs font-bold flex items-center space-x-1.5 transition-all shadow-2xs cursor-pointer font-headline"
            >
              {isReopening ? (
                <Loader2 className="w-4 h-4 animate-spin text-amber-700" />
              ) : (
                <Unlock className="w-4 h-4 text-amber-700" />
              )}
              <span>Mở chốt</span>
            </button>
          ) : (
            <button
              onClick={onFinalize}
              disabled={isFinalizing}
              className="px-4 py-2.5 bg-brand-600 hover:bg-brand-700 text-white rounded-xl text-xs font-bold flex items-center space-x-1.5 transition-all shadow-xs cursor-pointer font-headline"
            >
              {isFinalizing ? (
                <Loader2 className="w-4 h-4 animate-spin text-white" />
              ) : (
                <Lock className="w-4 h-4 text-white" />
              )}
              <span>Chốt bảng điểm</span>
            </button>
          )}
        </div>
      </div>

      {/* Finalized Banner Notification */}
      {isFinalized && (
        <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-900 flex items-center justify-between animate-in fade-in">
          <div className="flex items-center space-x-2.5">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            <span className="text-xs font-bold">
              Đã chốt {formatDate(finalizedAt)} — mở chốt để sửa
            </span>
          </div>
          <span className="text-[11px] text-emerald-700 font-medium">
            Điểm chính thức đã khoá và hiển thị cho học viên
          </span>
        </div>
      )}
    </div>
  );
}
