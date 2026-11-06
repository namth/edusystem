"use client";

import { useState, useEffect, useCallback } from "react";
import { Loader2, AlertCircle, BookOpen, FileText, CheckCircle2 } from "lucide-react";

export interface GradebookItem {
  kind: "lesson" | "exam" | "LESSON" | "EXAM" | string;
  id: string;
  title: string;
  raw_score: number | null;
  raw_max: number | null;
  score10: number | null;
  passed: boolean | null;
  note: string | null;
  finalized_at: string;
}

export interface GradebookData {
  items: GradebookItem[];
  average10: number | null;
}

export default function ClassGradebook({ classId }: { classId: string }) {
  const [data, setData] = useState<GradebookData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [is403, setIs403] = useState(false);

  const fetchGradebook = useCallback(async () => {
    if (!classId) return;
    setLoading(true);
    setError(null);
    setIs403(false);

    try {
      const res = await fetch(`/api/student/classes/${classId}/gradebook`);
      if (res.status === 403) {
        setIs403(true);
        setError("Bạn chưa ghi danh lớp này hoặc không có quyền truy cập bảng điểm.");
        return;
      }
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.error || "Không thể tải bảng điểm.");
      }
      const json = await res.json();
      setData({
        items: json.items || [],
        average10: json.average10 ?? null,
      });
    } catch (err: any) {
      setError(err.message || "Đã xảy ra lỗi khi tải bảng điểm.");
    } finally {
      setLoading(false);
    }
  }, [classId]);

  useEffect(() => {
    fetchGradebook();
  }, [fetchGradebook]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-12 bg-white rounded-2xl border border-line">
        <Loader2 className="w-8 h-8 text-brand-600 animate-spin mb-2" />
        <p className="text-xs text-ink-muted">Đang tải bảng điểm...</p>
      </div>
    );
  }

  if (error || is403) {
    return (
      <div className="p-8 text-center bg-white rounded-2xl border border-rose-200 space-y-4">
        <AlertCircle className="w-10 h-10 text-rose-600 mx-auto" />
        <p className="text-sm font-bold text-rose-800">{error || "Không thể tải bảng điểm."}</p>
        {!is403 && (
          <button
            type="button"
            onClick={fetchGradebook}
            className="px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white text-xs font-bold rounded-xl transition-all shadow-sm cursor-pointer"
          >
            Thử lại
          </button>
        )}
      </div>
    );
  }

  const items = data?.items || [];

  if (items.length === 0) {
    return (
      <div className="p-12 text-center bg-white rounded-2xl border border-line space-y-3">
        <CheckCircle2 className="w-10 h-10 text-brand-600 mx-auto" />
        <p className="text-sm font-bold text-ink">Giáo viên chưa chốt bài nào</p>
        <p className="text-xs text-ink-muted">
          Điểm chính thức sẽ hiển thị tại đây ngay sau khi giáo viên chốt điểm bài làm.
        </p>
      </div>
    );
  }

  const average10 = data?.average10;

  return (
    <div className="space-y-4">
      <div className="overflow-x-auto bg-white rounded-2xl border border-line shadow-sm">
        <table className="w-full text-left border-collapse text-sm">
          <thead>
            <tr className="border-b border-line bg-surface-alt text-xs font-bold text-ink-muted uppercase tracking-wider">
              <th className="py-3.5 px-4">Tên bài</th>
              <th className="py-3.5 px-4">Loại</th>
              <th className="py-3.5 px-4">Điểm</th>
              <th className="py-3.5 px-4">Thang 10</th>
              <th className="py-3.5 px-4">Ghi chú</th>
              <th className="py-3.5 px-4">Ngày chốt</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line-soft">
            {items.map((item) => {
              const isLesson = item.kind === "lesson" || item.kind === "LESSON";
              const isExam = item.kind === "exam" || item.kind === "EXAM";
              const kindLabel = isLesson ? "Bài học" : isExam ? "Đề thi" : item.kind;

              let scoreDisplay = "—";
              if (isLesson) {
                scoreDisplay = item.raw_score != null ? `${item.raw_score}%` : "—";
              } else {
                if (item.raw_score != null && item.raw_max != null) {
                  scoreDisplay = `${item.raw_score}/${item.raw_max}`;
                } else if (item.raw_score != null) {
                  scoreDisplay = `${item.raw_score}`;
                }
              }

              const score10Display = item.score10 != null ? Number(item.score10).toFixed(1) : "—";
              const finalizedDate = item.finalized_at
                ? new Date(item.finalized_at).toLocaleDateString("vi-VN")
                : "—";

              return (
                <tr key={`${item.kind}-${item.id}`} className="hover:bg-surface-alt/60 transition-colors">
                  <td className="py-3.5 px-4 font-semibold text-ink">
                    <div className="flex items-center gap-2">
                      {isLesson ? (
                        <BookOpen className="w-4 h-4 text-brand-600 shrink-0" />
                      ) : (
                        <FileText className="w-4 h-4 text-brand-600 shrink-0" />
                      )}
                      <span>{item.title}</span>
                    </div>
                  </td>
                  <td className="py-3.5 px-4">
                    <span
                      className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                        isLesson
                          ? "bg-sky-50 text-sky-800 border border-sky-200"
                          : "bg-purple-50 text-purple-800 border border-purple-200"
                      }`}
                    >
                      {kindLabel}
                    </span>
                  </td>
                  <td className="py-3.5 px-4 font-mono font-bold text-ink">
                    {scoreDisplay}
                  </td>
                  <td className="py-3.5 px-4 font-mono font-extrabold text-brand-600">
                    {score10Display}
                  </td>
                  <td className="py-3.5 px-4 text-xs text-ink-muted max-w-xs truncate">
                    {item.note || "—"}
                  </td>
                  <td className="py-3.5 px-4 text-xs font-mono text-ink-muted">
                    {finalizedDate}
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-line bg-surface-alt/80 font-bold text-ink">
              <td colSpan={3} className="py-3.5 px-4 text-right">
                Trung bình:
              </td>
              <td className="py-3.5 px-4 font-mono font-extrabold text-brand-700 text-base">
                {average10 != null ? Number(average10).toFixed(1) : "—"}
              </td>
              <td colSpan={2} className="py-3.5 px-4"></td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
