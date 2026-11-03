"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import Link from "next/link";
import AdminLayout from "@/components/AdminLayout";
import {
  Users,
  UserCheck,
  GraduationCap,
  BookOpen,
  FileText,
  CheckCircle2,
  Cpu,
  Coins,
  BadgeDollarSign,
  AlertTriangle,
  RotateCcw,
  Receipt,
  Sparkles,
} from "lucide-react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
} from "recharts";

interface TotalsData {
  teachers_verified: number;
  teachers_trial: number;
  students: number;
  lessons: number;
  exams: number;
}

interface MonthlyData {
  submissions: number;
  ai_graded: number;
  ai_tokens: number;
  ai_cost_vnd: number;
  revenue_vnd: number;
  unpriced_calls: number;
}

interface DailyData {
  date: string;
  submissions: number;
  ai_cost_vnd: number;
}

interface TopTeacherData {
  teacher_id: string;
  name: string;
  ai_graded: number;
  tokens: number;
  cost_vnd: number;
}

interface DashboardApiResponse {
  success: boolean;
  month: string;
  totals: TotalsData;
  pending_orders: number;
  monthly: MonthlyData;
  daily: DailyData[];
  top_teachers: TopTeacherData[];
}

function getRecentMonths(count = 12): string[] {
  const months: string[] = [];
  const now = new Date(Date.now() + 7 * 3600 * 1000);
  let y = now.getUTCFullYear();
  let m = now.getUTCMonth() + 1;
  for (let i = 0; i < count; i++) {
    months.push(`${y}-${String(m).padStart(2, "0")}`);
    m--;
    if (m === 0) {
      m = 12;
      y--;
    }
  }
  return months;
}

export default function AdminDashboardPage() {
  const recentMonths = useMemo(() => getRecentMonths(12), []);
  const [selectedMonth, setSelectedMonth] = useState<string>(recentMonths[0]);
  const [data, setData] = useState<DashboardApiResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDashboard = useCallback(async (m: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/dashboard?month=${m}`);
      if (!res.ok) {
        throw new Error("Không thể tải dữ liệu tổng quan admin");
      }
      const json: DashboardApiResponse = await res.json();
      setData(json);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Đã xảy ra lỗi khi tải dữ liệu.";
      setError(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchDashboard(selectedMonth);
  }, [selectedMonth, fetchDashboard]);

  const totals = data?.totals;
  const monthly = data?.monthly;
  const pending_orders = data?.pending_orders ?? 0;
  const daily = data?.daily ?? [];
  const top_teachers = data?.top_teachers ?? [];

  return (
    <AdminLayout>
      <div className="space-y-8">
        {/* Header & Month Selector */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold font-headline text-ink tracking-tight">
              Tổng quan hệ thống
            </h1>
            <p className="text-sm text-ink-muted mt-1">
              Theo dõi số liệu người dùng, học tập, đơn hàng và chi phí AI
            </p>
          </div>

          <div className="flex items-center gap-3">
            <label htmlFor="month-select" className="text-xs font-semibold text-ink-muted">
              Chọn kỳ:
            </label>
            <select
              id="month-select"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="bg-white border border-line rounded-xl px-3.5 py-2 text-sm font-medium text-ink focus:outline-none focus:ring-2 focus:ring-brand-500 shadow-sm"
            >
              {recentMonths.map((m) => {
                const [year, month] = m.split("-");
                return (
                  <option key={m} value={m}>
                    Tháng {month}/{year}
                  </option>
                );
              })}
            </select>
          </div>
        </div>

        {/* Unpriced Calls Alert */}
        {monthly && monthly.unpriced_calls > 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-center justify-between gap-4 text-amber-900 shadow-sm animate-in fade-in">
            <div className="flex items-center gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
              <p className="text-sm font-medium">
                <span className="font-bold">{monthly.unpriced_calls}</span> lần gọi AI chưa có giá model — vào Cấu hình AI để thêm giá
              </p>
            </div>
            <Link
              href="/admin/settings"
              className="shrink-0 px-3.5 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-semibold transition-colors"
            >
              Cấu hình AI
            </Link>
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-2xl p-6 text-center text-red-900">
            <p className="text-sm font-medium mb-3">{error}</p>
            <button
              onClick={() => void fetchDashboard(selectedMonth)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-semibold transition-colors"
            >
              <RotateCcw className="w-4 h-4" />
              <span>Thử lại</span>
            </button>
          </div>
        )}

        {/* Loading Skeleton or Content */}
        {loading && !data ? (
          <div className="space-y-8 animate-pulse">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="bg-white rounded-2xl p-5 border border-line h-28" />
              ))}
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="bg-white rounded-2xl p-5 border border-line h-28" />
              ))}
            </div>
            <div className="bg-white rounded-2xl p-6 border border-line h-80" />
            <div className="bg-white rounded-2xl p-6 border border-line h-64" />
          </div>
        ) : (
          <>
            {/* Hàng thẻ Tổng (Toàn thời gian) */}
            <div>
              <h2 className="text-xs font-bold uppercase tracking-wider text-ink-subtle mb-3">
                Số liệu toàn thời gian
              </h2>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white rounded-2xl p-5 border border-line shadow-sm">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-medium text-ink-muted">Giáo viên</span>
                    <div className="p-2 bg-brand-50 rounded-xl text-brand-600">
                      <UserCheck className="w-5 h-5" />
                    </div>
                  </div>
                  <div className="flex items-baseline gap-2">
                    <span className="text-2xl font-bold font-headline text-ink">
                      {totals?.teachers_verified ?? 0}
                    </span>
                    <span className="text-xs text-ink-muted font-normal">
                      ({totals?.teachers_trial ?? 0} dùng thử)
                    </span>
                  </div>
                </div>

                <div className="bg-white rounded-2xl p-5 border border-line shadow-sm">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-medium text-ink-muted">Học sinh</span>
                    <div className="p-2 bg-brand-50 rounded-xl text-brand-600">
                      <GraduationCap className="w-5 h-5" />
                    </div>
                  </div>
                  <div className="text-2xl font-bold font-headline text-ink">
                    {totals?.students ?? 0}
                  </div>
                </div>

                <div className="bg-white rounded-2xl p-5 border border-line shadow-sm">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-medium text-ink-muted">Bài học</span>
                    <div className="p-2 bg-brand-50 rounded-xl text-brand-600">
                      <BookOpen className="w-5 h-5" />
                    </div>
                  </div>
                  <div className="text-2xl font-bold font-headline text-ink">
                    {totals?.lessons ?? 0}
                  </div>
                </div>

                <div className="bg-white rounded-2xl p-5 border border-line shadow-sm">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-medium text-ink-muted">Đề thi</span>
                    <div className="p-2 bg-brand-50 rounded-xl text-brand-600">
                      <FileText className="w-5 h-5" />
                    </div>
                  </div>
                  <div className="text-2xl font-bold font-headline text-ink">
                    {totals?.exams ?? 0}
                  </div>
                </div>
              </div>
            </div>

            {/* Hàng thẻ Trong tháng */}
            <div>
              <h2 className="text-xs font-bold uppercase tracking-wider text-ink-subtle mb-3">
                Số liệu trong tháng {selectedMonth.split("-")[1]}/{selectedMonth.split("-")[0]}
              </h2>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                <div className="bg-white rounded-2xl p-5 border border-line shadow-sm">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-medium text-ink-muted">Bài đã nộp</span>
                    <div className="p-1.5 bg-brand-50 rounded-lg text-brand-600">
                      <CheckCircle2 className="w-4 h-4" />
                    </div>
                  </div>
                  <div className="text-xl font-bold font-headline text-ink">
                    {monthly?.submissions ?? 0}
                  </div>
                </div>

                <div className="bg-white rounded-2xl p-5 border border-line shadow-sm">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-medium text-ink-muted">Bài chấm bằng AI</span>
                    <div className="p-1.5 bg-brand-50 rounded-lg text-brand-600">
                      <Sparkles className="w-4 h-4" />
                    </div>
                  </div>
                  <div className="text-xl font-bold font-headline text-ink">
                    {monthly?.ai_graded ?? 0}
                  </div>
                </div>

                <div className="bg-white rounded-2xl p-5 border border-line shadow-sm">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-medium text-ink-muted">Token đã dùng</span>
                    <div className="p-1.5 bg-brand-50 rounded-lg text-brand-600">
                      <Cpu className="w-4 h-4" />
                    </div>
                  </div>
                  <div className="text-xl font-bold font-headline text-ink">
                    {(monthly?.ai_tokens ?? 0).toLocaleString("vi-VN")}
                  </div>
                </div>

                <div className="bg-white rounded-2xl p-5 border border-line shadow-sm">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-medium text-ink-muted">Chi phí AI</span>
                    <div className="p-1.5 bg-accent-50 rounded-lg text-accent-500">
                      <Coins className="w-4 h-4" />
                    </div>
                  </div>
                  <div className="text-xl font-bold font-headline text-ink">
                    {(monthly?.ai_cost_vnd ?? 0).toLocaleString("vi-VN")} đ
                  </div>
                </div>

                <div className="bg-white rounded-2xl p-5 border border-line shadow-sm">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-medium text-ink-muted">Doanh thu slot</span>
                    <div className="p-1.5 bg-emerald-50 rounded-lg text-emerald-600">
                      <BadgeDollarSign className="w-4 h-4" />
                    </div>
                  </div>
                  <div className="text-xl font-bold font-headline text-ink">
                    {(monthly?.revenue_vnd ?? 0).toLocaleString("vi-VN")} đ
                  </div>
                </div>

                <Link
                  href="/admin/orders?status=PENDING"
                  className="bg-white rounded-2xl p-5 border border-line shadow-sm hover:border-brand-500 hover:shadow-md transition-all group block"
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-medium text-ink-muted group-hover:text-brand-600">
                      Đơn chờ xử lý
                    </span>
                    <div className="p-1.5 bg-amber-50 rounded-lg text-amber-600 group-hover:bg-amber-100">
                      <Receipt className="w-4 h-4" />
                    </div>
                  </div>
                  <div className="text-xl font-bold font-headline text-ink group-hover:text-brand-600">
                    {pending_orders}
                  </div>
                </Link>
              </div>
            </div>

            {/* Biểu đồ cột theo ngày (Recharts) */}
            <div className="bg-white rounded-2xl p-6 border border-line shadow-sm">
              <div className="mb-6">
                <h2 className="text-base font-bold font-headline text-ink">
                  Hoạt động & chi phí AI theo ngày
                </h2>
                <p className="text-xs text-ink-muted mt-0.5">
                  Số bài nộp và chi phí AI trong tháng theo giờ Việt Nam
                </p>
              </div>

              {daily.length === 0 ? (
                <div className="h-64 flex items-center justify-center text-xs text-ink-subtle">
                  Chưa có dữ liệu theo ngày.
                </div>
              ) : (
                <div className="w-full h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={daily}
                      margin={{ top: 10, right: 20, left: 0, bottom: 25 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-line)" />
                      <XAxis
                        dataKey="date"
                        tickFormatter={(val: string) => val.slice(8)}
                        tick={{ fontSize: 11, fill: "var(--color-ink-muted)" }}
                        tickLine={false}
                        axisLine={{ stroke: "var(--color-line)" }}
                      />
                      <YAxis
                        yAxisId="left"
                        allowDecimals={false}
                        tick={{ fontSize: 11, fill: "var(--color-ink-muted)" }}
                        tickLine={false}
                        axisLine={{ stroke: "var(--color-line)" }}
                      />
                      <YAxis
                        yAxisId="right"
                        orientation="right"
                        tickFormatter={(val: number) => `${Math.round(val / 1000)}k`}
                        tick={{ fontSize: 11, fill: "var(--color-ink-muted)" }}
                        tickLine={false}
                        axisLine={{ stroke: "var(--color-line)" }}
                      />
                      <Tooltip
                        formatter={(value: any, name: any) => {
                          if (name === "Chi phí AI (VND)") {
                            return [`${Number(value).toLocaleString("vi-VN")} đ`, name];
                          }
                          return [value, name];
                        }}
                        labelFormatter={(label: any) => `Ngày ${label}`}
                        contentStyle={{
                          backgroundColor: "#ffffff",
                          borderColor: "var(--color-line)",
                          borderRadius: "0.75rem",
                          boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
                          fontSize: "12px",
                        }}
                      />
                      <Legend
                        verticalAlign="top"
                        align="right"
                        wrapperStyle={{ paddingBottom: "12px", fontSize: "12px" }}
                      />
                      <Bar
                        yAxisId="left"
                        dataKey="submissions"
                        name="Số bài nộp"
                        fill="var(--color-brand-500)"
                        radius={[4, 4, 0, 0]}
                      />
                      <Bar
                        yAxisId="right"
                        dataKey="ai_cost_vnd"
                        name="Chi phí AI (VND)"
                        fill="var(--color-accent-500)"
                        radius={[4, 4, 0, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>

            {/* Bảng Top giáo viên dùng AI */}
            <div className="bg-white rounded-2xl border border-line shadow-sm overflow-hidden">
              <div className="p-6 border-b border-line">
                <h2 className="text-base font-bold font-headline text-ink">
                  Top giáo viên dùng AI trong tháng
                </h2>
                <p className="text-xs text-ink-muted mt-0.5">
                  Xếp hạng theo tổng chi phí AI (tối đa 10 giáo viên)
                </p>
              </div>

              {top_teachers.length === 0 ? (
                <div className="p-8 text-center text-xs text-ink-subtle">
                  Chưa có dữ liệu dùng AI trong tháng này.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-surface-alt border-b border-line text-xs font-semibold text-ink-muted">
                        <th className="py-3 px-6">#</th>
                        <th className="py-3 px-6">Giáo viên</th>
                        <th className="py-3 px-6 text-right">Bài AI chấm</th>
                        <th className="py-3 px-6 text-right">Token</th>
                        <th className="py-3 px-6 text-right">Chi phí (VND)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-line text-sm">
                      {top_teachers.map((teacher, index) => (
                        <tr key={teacher.teacher_id} className="hover:bg-brand-50/40 transition-colors">
                          <td className="py-3.5 px-6 font-semibold text-ink-subtle text-xs">
                            {index + 1}
                          </td>
                          <td className="py-3.5 px-6 font-medium text-ink">
                            <Link
                              href={`/admin/teachers/${teacher.teacher_id}`}
                              className="text-brand-600 hover:text-brand-700 hover:underline"
                            >
                              {teacher.name}
                            </Link>
                          </td>
                          <td className="py-3.5 px-6 text-right text-ink">
                            {teacher.ai_graded}
                          </td>
                          <td className="py-3.5 px-6 text-right text-ink">
                            {teacher.tokens.toLocaleString("vi-VN")}
                          </td>
                          <td className="py-3.5 px-6 text-right font-semibold text-ink">
                            {teacher.cost_vnd.toLocaleString("vi-VN")} đ
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </AdminLayout>
  );
}
