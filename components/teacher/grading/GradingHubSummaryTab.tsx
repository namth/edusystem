"use client";

import { AlertCircle, Award, RefreshCw, Users } from "lucide-react";

export interface SummaryData {
  items: {
    kind: "lesson" | "exam";
    id: string;
    title: string;
    finalized_at: string;
  }[];
  students: {
    id: string;
    name: string;
    cells: Record<
      string,
      {
        raw_score: number | null;
        raw_max: number | null;
        score10: number | null;
        label: string;
      }
    >;
    average10: number | null;
  }[];
  item_averages: Record<string, number | null>;
}

interface HubSummaryTabProps {
  data: SummaryData | null;
  loading: boolean;
  errorMessage: string | null;
  onRetry: () => void;
}

export default function GradingHubSummaryTab({
  data,
  loading,
  errorMessage,
  onRetry,
}: HubSummaryTabProps) {
  if (errorMessage) {
    return (
      <div className="p-6 bg-rose-50 border border-rose-200 rounded-2xl flex items-center justify-between text-rose-800 font-sans">
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

  if (loading) {
    return (
      <div className="bg-white rounded-3xl border border-line p-8 space-y-4 animate-pulse font-sans">
        <div className="h-6 bg-surface-alt rounded-lg w-1/3"></div>
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-12 bg-surface-alt rounded-xl w-full"></div>
          ))}
        </div>
      </div>
    );
  }

  const items = data?.items || [];
  const students = data?.students || [];
  const itemAverages = data?.item_averages || {};

  if (items.length === 0) {
    return (
      <div className="bg-white rounded-3xl border border-line p-12 text-center space-y-3 font-sans">
        <Award className="w-12 h-12 text-brand-600 mx-auto opacity-30" />
        <h3 className="text-sm font-bold text-ink">Chưa có bài nào được chốt điểm</h3>
        <p className="text-xs text-ink-muted max-w-md mx-auto">
          Bảng tổng kết chỉ hiển thị các bài học và đề thi đã hoàn tất việc chốt bảng điểm chính thức.
        </p>
      </div>
    );
  }

  if (students.length === 0) {
    return (
      <div className="bg-white rounded-3xl border border-line p-12 text-center space-y-3 font-sans">
        <Users className="w-12 h-12 text-brand-600 mx-auto opacity-30" />
        <p className="text-xs font-medium text-ink-muted">Lớp chưa có học sinh</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-3xl border border-line shadow-2xs overflow-hidden font-sans">
      <div className="p-5 border-b border-line flex justify-between items-center bg-surface-alt/50">
        <div>
          <h3 className="text-sm font-bold text-ink font-headline">
            Bảng Tổng Kết Điểm Đã Chốt Theo Thang 10
          </h3>
          <p className="text-xs text-ink-muted mt-0.5">
            Điểm chính thức của học sinh trên các bài đã chốt và điểm trung bình quy đổi.
          </p>
        </div>
        <span className="px-3 py-1 bg-brand-50 text-brand-700 border border-brand-200 rounded-lg text-xs font-bold font-mono">
          {items.length} bài đã chốt
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="bg-surface-alt border-b border-line text-ink-muted font-bold">
              <th className="p-3.5 pl-5 border-r border-line/60 min-w-[180px]">Học sinh</th>
              {items.map((it) => (
                <th
                  key={`${it.kind}:${it.id}`}
                  className="p-3.5 text-center border-r border-line/60 min-w-[140px]"
                >
                  <div className="truncate max-w-[140px] mx-auto text-ink font-bold">
                    {it.title}
                  </div>
                  <div className="text-[10px] text-ink-subtle font-mono">
                    {it.kind === "lesson" ? "Bài học" : "Đề thi"}
                  </div>
                </th>
              ))}
              <th className="p-3.5 pr-5 text-center min-w-[130px] bg-brand-50/50 text-brand-900">
                Trung bình (average10)
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line/40">
            {students.map((st) => (
              <tr key={st.id} className="hover:bg-surface-alt/50 transition-colors">
                <td className="p-3.5 pl-5 border-r border-line/60">
                  <div className="font-bold text-ink">{st.name}</div>
                  <div className="text-[10px] text-ink-subtle font-mono">{st.id}</div>
                </td>

                {items.map((it) => {
                  const cellKey = `${it.kind}:${it.id}`;
                  const c = st.cells[cellKey];
                  const hasScore = c && c.score10 !== null && c.score10 !== undefined;

                  return (
                    <td
                      key={cellKey}
                      className="p-3.5 text-center border-r border-line/60 font-mono"
                    >
                      {hasScore ? (
                        <div className="space-y-0.5">
                          <span className="inline-block px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-800 border border-emerald-200 font-bold text-xs">
                            {c.score10}
                          </span>
                          <div className="text-[10px] text-ink-subtle">{c.label}</div>
                        </div>
                      ) : (
                        <span className="text-ink-subtle italic text-[11px]">Chưa nộp</span>
                      )}
                    </td>
                  );
                })}

                <td className="p-3.5 pr-5 text-center font-mono font-bold bg-brand-50/30">
                  {st.average10 !== null && st.average10 !== undefined ? (
                    <span className="inline-block px-2.5 py-1 rounded-lg bg-brand-100 text-brand-800 font-bold text-xs">
                      {st.average10}
                    </span>
                  ) : (
                    <span className="text-ink-subtle">—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="bg-surface-alt/80 border-t-2 border-line text-xs font-bold text-ink">
              <td className="p-3.5 pl-5 border-r border-line/60 font-headline text-brand-600">
                Trung bình từng bài
              </td>
              {items.map((it) => {
                const cellKey = `${it.kind}:${it.id}`;
                const avg = itemAverages[cellKey];
                return (
                  <td
                    key={cellKey}
                    className="p-3.5 text-center border-r border-line/60 font-mono text-brand-800"
                  >
                    {avg !== null && avg !== undefined ? `${avg}` : "—"}
                  </td>
                );
              })}
              <td className="p-3.5 pr-5 text-center bg-brand-100/50 text-brand-800 font-mono">
                —
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
