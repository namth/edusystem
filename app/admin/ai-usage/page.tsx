"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import AdminLayout from "@/components/AdminLayout";
import { AlertCircle, Download, Loader2, Coins } from "lucide-react";

interface PurposeStat {
  tokens: number;
  cost_vnd: number;
}

interface TeacherRow {
  teacher_id: string;
  name: string;
  email: string;
  teacher_status: string | null;
  students_used: number;
  slot_limit: number;
  requests: number;
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
  cost_vnd: number;
  by_purpose: Record<"EXAM_GRADING" | "LESSON_GRADING" | "EXAM_IMPORT" | "OTHER", PurposeStat>;
  revenue_vnd: number;
  margin_vnd: number;
}

interface Report {
  month: string;
  teachers: TeacherRow[];
  unattributed: { requests: number; tokens: number; cost_vnd: number };
}

const fmtNum = (n: number) => n.toLocaleString("vi-VN");
const fmtVnd = (n: number) => `${n.toLocaleString("vi-VN")} đ`;

function currentMonthVn(): string {
  return new Date(Date.now() + 7 * 3600 * 1000).toISOString().slice(0, 7);
}

export default function AdminAiUsagePage() {
  const [month, setMonth] = useState<string>(currentMonthVn());
  const [search, setSearch] = useState("");
  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (m: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/ai-usage?month=${encodeURIComponent(m)}`);
      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.error || "Không thể tải báo cáo chi phí AI.");
        setReport(null);
        return;
      }
      setReport(data as Report);
    } catch {
      setError("Lỗi kết nối khi tải báo cáo chi phí AI.");
      setReport(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) {
      void load(month);
    }
  }, [month, load]);

  const rows = useMemo(() => {
    const list = report?.teachers ?? [];
    const q = search.trim().toLowerCase();
    if (!q) return list;
    return list.filter(
      (t) => t.name.toLowerCase().includes(q) || t.email.toLowerCase().includes(q)
    );
  }, [report, search]);

  const totals = useMemo(() => {
    const list = report?.teachers ?? [];
    const tokens = list.reduce((s, t) => s + t.total_tokens, 0) + (report?.unattributed.tokens ?? 0);
    const cost = list.reduce((s, t) => s + t.cost_vnd, 0) + (report?.unattributed.cost_vnd ?? 0);
    const revenue = list.reduce((s, t) => s + t.revenue_vnd, 0);
    return { tokens, cost, revenue, margin: revenue - cost };
  }, [report]);

  return (
    <AdminLayout>
      <div className="max-w-[1280px] mx-auto space-y-6 font-sans">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-line/40 pb-4">
          <div>
            <h1 className="text-2xl font-bold text-ink flex items-center gap-2">
              <Coins className="w-6 h-6 text-brand-600" />
              Chi phí AI theo giáo viên
            </h1>
            <p className="text-xs text-ink-muted mt-1">
              Token, chi phí AI và doanh thu bán slot của từng giáo viên trong tháng (UTC+7).
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <label className="text-xs font-bold text-ink flex items-center gap-2">
              Tháng
              <input
                type="month"
                value={month}
                onChange={(e) => setMonth(e.target.value)}
                className="px-3 py-2 bg-white border border-line rounded-xl text-xs focus:outline-none focus:border-brand-600"
              />
            </label>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Tìm theo tên hoặc email..."
              className="px-3 py-2 bg-white border border-line rounded-xl text-xs w-60 focus:outline-none focus:border-brand-600"
            />
            <a
              href={`/api/admin/ai-usage?month=${encodeURIComponent(month)}&format=csv`}
              className="px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white text-xs font-bold rounded-xl flex items-center gap-1.5"
            >
              <Download className="w-4 h-4" />
              Xuất CSV
            </a>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center gap-2 text-xs text-ink-muted p-12 bg-white rounded-2xl border border-line">
            <Loader2 className="w-5 h-5 animate-spin text-brand-600" />
            <span>Đang tải báo cáo chi phí AI...</span>
          </div>
        ) : error ? (
          <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 flex items-center gap-2 text-xs font-bold">
            <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
            <span className="flex-1">{error}</span>
            <button
              type="button"
              onClick={() => void load(month)}
              className="px-3 py-1.5 bg-rose-600 text-white rounded-lg"
            >
              Thử lại
            </button>
          </div>
        ) : report ? (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="p-4 bg-white rounded-2xl border border-line">
                <span className="text-xs text-ink-muted block">Tổng token</span>
                <span className="text-xl font-bold text-brand-600">{fmtNum(totals.tokens)}</span>
              </div>
              <div className="p-4 bg-white rounded-2xl border border-line">
                <span className="text-xs text-ink-muted block">Tổng chi phí AI</span>
                <span className="text-xl font-bold text-ink">{fmtVnd(totals.cost)}</span>
              </div>
              <div className="p-4 bg-white rounded-2xl border border-line">
                <span className="text-xs text-ink-muted block">Doanh thu bán slot</span>
                <span className="text-xl font-bold text-emerald-700">{fmtVnd(totals.revenue)}</span>
              </div>
              <div
                className={`p-4 rounded-2xl border ${
                  totals.margin < 0 ? "bg-rose-50 border-rose-300" : "bg-white border-line"
                }`}
              >
                <span className="text-xs text-ink-muted block">Chênh lệch</span>
                <span
                  className={`text-xl font-bold ${totals.margin < 0 ? "text-rose-700" : "text-ink"}`}
                >
                  {fmtVnd(totals.margin)}
                </span>
              </div>
            </div>

            {report.teachers.length === 0 ? (
              <div className="p-8 text-center border border-dashed border-line rounded-2xl bg-white text-xs text-ink-muted">
                Chưa có giáo viên nào trong hệ thống.
              </div>
            ) : rows.length === 0 ? (
              <div className="p-8 text-center border border-dashed border-line rounded-2xl bg-white text-xs text-ink-muted">
                Không có giáo viên nào khớp với từ khoá tìm kiếm.
              </div>
            ) : (
              <div className="overflow-x-auto rounded-2xl border border-line bg-white">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="bg-surface-alt border-b border-line font-bold text-ink-muted">
                      <th className="p-3">Giáo viên</th>
                      <th className="p-3 text-right">Học sinh</th>
                      <th className="p-3 text-right">Lượt gọi</th>
                      <th className="p-3 text-right">Tổng token</th>
                      <th className="p-3 text-right">Chi phí</th>
                      <th className="p-3 text-right">Doanh thu</th>
                      <th className="p-3 text-right">Chênh lệch</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line/30">
                    {rows.map((t) => (
                      <tr key={t.teacher_id} className="hover:bg-surface-alt">
                        <td className="p-3">
                          <Link
                            href={`/admin/teachers/${t.teacher_id}`}
                            className="font-bold text-brand-600 hover:underline"
                          >
                            {t.name}
                          </Link>
                          <span className="block text-ink-subtle">{t.email}</span>
                        </td>
                        <td className="p-3 text-right">
                          {fmtNum(t.students_used)} / {fmtNum(t.slot_limit)}
                        </td>
                        <td className="p-3 text-right">{fmtNum(t.requests)}</td>
                        <td className="p-3 text-right">{fmtNum(t.total_tokens)}</td>
                        <td className="p-3 text-right font-mono">{fmtVnd(t.cost_vnd)}</td>
                        <td className="p-3 text-right font-mono">{fmtVnd(t.revenue_vnd)}</td>
                        <td
                          className={`p-3 text-right font-mono font-bold ${
                            t.margin_vnd < 0 ? "text-rose-700 bg-rose-50" : "text-emerald-700"
                          }`}
                        >
                          {fmtVnd(t.margin_vnd)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-surface-alt border-t border-line text-ink-muted">
                      <td className="p-3 font-bold">Chưa gán giáo viên</td>
                      <td className="p-3" />
                      <td className="p-3 text-right">{fmtNum(report.unattributed.requests)}</td>
                      <td className="p-3 text-right">{fmtNum(report.unattributed.tokens)}</td>
                      <td className="p-3 text-right font-mono">{fmtVnd(report.unattributed.cost_vnd)}</td>
                      <td className="p-3" />
                      <td className="p-3" />
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </>
        ) : null}
      </div>
    </AdminLayout>
  );
}
