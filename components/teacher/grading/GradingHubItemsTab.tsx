"use client";

import { useState, useMemo } from "react";
import {
  FileText,
  BookOpen,
  CheckCircle2,
  AlertCircle,
  Clock,
  Sparkles,
  Layers,
  ChevronRight,
  RefreshCw,
} from "lucide-react";

export interface HubClassItem {
  kind: "lesson" | "exam";
  id: string;
  title: string;
  source: string;
  has_ai: boolean;
  submitted: number;
  student_count: number;
  pending_review: number;
  needs_review: number;
  grading: number;
  finalized_at: string | null;
}

interface HubItemsTabProps {
  items: HubClassItem[];
  classId: string;
  onSelectItem: (kind: "lesson" | "exam", id: string) => void;
  loading: boolean;
  errorMessage: string | null;
  onRetry: () => void;
}

export default function GradingHubItemsTab({
  items,
  classId,
  onSelectItem,
  loading,
  errorMessage,
  onRetry,
}: HubItemsTabProps) {
  const [kindFilter, setKindFilter] = useState<"all" | "lesson" | "exam">("all");
  const [onlyActionable, setOnlyActionable] = useState(false);

  const filteredItems = useMemo(() => {
    return items.filter((it) => {
      if (kindFilter === "lesson" && it.kind !== "lesson") return false;
      if (kindFilter === "exam" && it.kind !== "exam") return false;
      if (onlyActionable) {
        const hasPending = (it.pending_review || 0) > 0;
        const hasNeedsReview = (it.needs_review || 0) > 0;
        const hasGrading = (it.grading || 0) > 0;
        const isNotFinalized = !it.finalized_at;
        if (!hasPending && !hasNeedsReview && !hasGrading && !isNotFinalized) {
          return false;
        }
      }
      return true;
    });
  }, [items, kindFilter, onlyActionable]);

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

  if (errorMessage) {
    return (
      <div className="p-6 bg-rose-50 border border-rose-200 rounded-2xl flex items-center justify-between text-rose-800">
        <div className="flex items-center space-x-3">
          <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
          <span className="text-xs font-bold">{errorMessage}</span>
        </div>
        <button
          onClick={onRetry}
          className="px-3.5 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold flex items-center space-x-1.5 transition-colors cursor-pointer"
        >
          <RefreshCw className="w-3.5 h-3.5 text-white" />
          <span>Thử lại</span>
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4 font-sans">
      {/* Filter Bar */}
      <div className="bg-white p-4 rounded-2xl border border-line shadow-2xs flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div className="flex items-center space-x-2">
          <span className="text-xs font-bold text-ink-muted mr-1">Loại bài:</span>
          <div className="inline-flex rounded-xl bg-surface-alt p-1 border border-line">
            <button
              onClick={() => setKindFilter("all")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                kindFilter === "all"
                  ? "bg-white text-brand-600 shadow-2xs"
                  : "text-ink-muted hover:text-ink"
              }`}
            >
              Tất cả
            </button>
            <button
              onClick={() => setKindFilter("lesson")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                kindFilter === "lesson"
                  ? "bg-white text-brand-600 shadow-2xs"
                  : "text-ink-muted hover:text-ink"
              }`}
            >
              Bài học
            </button>
            <button
              onClick={() => setKindFilter("exam")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                kindFilter === "exam"
                  ? "bg-white text-brand-600 shadow-2xs"
                  : "text-ink-muted hover:text-ink"
              }`}
            >
              Đề thi
            </button>
          </div>
        </div>

        <label className="flex items-center space-x-2.5 text-xs font-bold text-ink cursor-pointer select-none">
          <input
            type="checkbox"
            checked={onlyActionable}
            onChange={(e) => setOnlyActionable(e.target.checked)}
            className="w-4 h-4 rounded text-brand-600 focus:ring-brand-500 border-line cursor-pointer"
          />
          <span>Chỉ bài còn việc</span>
        </label>
      </div>

      {/* Table Content */}
      {loading ? (
        <div className="bg-white rounded-3xl border border-line p-8 space-y-4 animate-pulse">
          <div className="h-6 bg-surface-alt rounded-lg w-1/4"></div>
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-12 bg-surface-alt rounded-xl w-full"></div>
            ))}
          </div>
        </div>
      ) : items.length === 0 ? (
        <div className="bg-white rounded-3xl border border-line p-12 text-center space-y-3">
          <Layers className="w-12 h-12 text-brand-600 mx-auto opacity-30" />
          <p className="text-xs font-medium text-ink-muted">
            Lớp chưa có bài học/đề nào trong lộ trình hoặc được giao
          </p>
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="bg-white rounded-3xl border border-line p-12 text-center space-y-2">
          <p className="text-xs font-medium text-ink-muted">
            Không tìm thấy bài nào phù hợp với bộ lọc đã chọn.
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-3xl border border-line shadow-2xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-surface-alt border-b border-line text-ink-muted font-bold">
                  <th className="p-3.5 pl-5">Tên bài</th>
                  <th className="p-3.5">Loại</th>
                  <th className="p-3.5 text-center">Hình thức</th>
                  <th className="p-3.5 text-center">Đã nộp</th>
                  <th className="p-3.5 text-center">Chờ duyệt</th>
                  <th className="p-3.5 text-center">Cần chấm tay</th>
                  <th className="p-3.5 text-center">Đang chấm</th>
                  <th className="p-3.5 text-center">Trạng thái</th>
                  <th className="p-3.5 pr-5 text-right">Chi tiết</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line/40">
                {filteredItems.map((it) => {
                  const isLesson = it.kind === "lesson";
                  return (
                    <tr
                      key={`${it.kind}:${it.id}`}
                      onClick={() => onSelectItem(it.kind, it.id)}
                      className="hover:bg-brand-50/40 transition-colors cursor-pointer group"
                    >
                      <td className="p-3.5 pl-5">
                        <div className="font-bold text-ink group-hover:text-brand-600 transition-colors">
                          {it.title}
                        </div>
                        <div className="text-[10px] text-ink-subtle font-mono">
                          {it.source === "ROADMAP" ? "Trong lộ trình" : "Giao bài riêng"} &bull; ID: {it.id}
                        </div>
                      </td>

                      <td className="p-3.5">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-bold ${
                            isLesson
                              ? "bg-brand-50 text-brand-700 border border-brand-200"
                              : "bg-purple-50 text-purple-700 border border-purple-200"
                          }`}
                        >
                          {isLesson ? "Bài học" : "Đề thi"}
                        </span>
                      </td>

                      <td className="p-3.5 text-center">
                        <span
                          className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold font-mono ${
                            it.has_ai
                              ? "bg-purple-100 text-purple-900 border border-purple-200"
                              : "bg-emerald-50 text-emerald-800 border border-emerald-200"
                          }`}
                        >
                          {it.has_ai ? "AI" : "KQ"}
                        </span>
                      </td>

                      <td className="p-3.5 text-center font-mono font-medium text-ink">
                        {it.submitted}/{it.student_count}
                      </td>

                      <td className="p-3.5 text-center">
                        {it.pending_review > 0 ? (
                          <span className="inline-block px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200 font-mono font-bold text-[11px]">
                            {it.pending_review}
                          </span>
                        ) : (
                          <span className="text-ink-subtle font-mono">0</span>
                        )}
                      </td>

                      <td className="p-3.5 text-center">
                        {it.needs_review > 0 ? (
                          <span className="inline-block px-2 py-0.5 rounded-full bg-rose-50 text-rose-800 border border-rose-200 font-mono font-bold text-[11px]">
                            {it.needs_review}
                          </span>
                        ) : (
                          <span className="text-ink-subtle font-mono">0</span>
                        )}
                      </td>

                      <td className="p-3.5 text-center">
                        {it.grading > 0 ? (
                          <span className="inline-block px-2 py-0.5 rounded-full bg-blue-50 text-blue-800 border border-blue-200 font-mono font-bold text-[11px]">
                            {it.grading}
                          </span>
                        ) : (
                          <span className="text-ink-subtle font-mono">0</span>
                        )}
                      </td>

                      <td className="p-3.5 text-center">
                        {it.finalized_at ? (
                          <span className="inline-block px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 text-[11px] font-bold">
                            Đã chốt {formatDate(it.finalized_at)}
                          </span>
                        ) : (
                          <span className="inline-block px-2.5 py-1 rounded-full bg-surface-alt text-ink-muted border border-line text-[11px] font-bold">
                            Mở
                          </span>
                        )}
                      </td>

                      <td className="p-3.5 pr-5 text-right text-ink-subtle group-hover:text-brand-600 transition-colors">
                        <ChevronRight className="w-4 h-4 ml-auto" />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
