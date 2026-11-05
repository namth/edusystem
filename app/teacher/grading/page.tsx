"use client";

import { Suspense, useState, useEffect, useCallback, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import TeacherLayout from "@/components/TeacherLayout";
import {
  BookOpen,
  Award,
  Layers,
  ChevronDown,
  RefreshCw,
  AlertCircle,
  Loader2,
  ChevronRight,
  FileText,
} from "lucide-react";

interface ClassOption {
  id: string;
  name: string;
  student_count: number;
  pending_review: number;
  needs_review: number;
}

interface HubClassItem {
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

interface SummaryData {
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

function TeacherGradingHubContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const urlClassId = searchParams.get("class");
  const urlTab = searchParams.get("tab");

  const [classes, setClasses] = useState<ClassOption[]>([]);
  const [selectedClassId, setSelectedClassId] = useState<string>("");
  const [activeTab, setActiveTab] = useState<"items" | "summary">("items");

  // Loading & error states
  const [classesLoading, setClassesLoading] = useState(true);
  const [classesError, setClassesError] = useState<string | null>(null);

  // Tab items state & filters
  const [items, setItems] = useState<HubClassItem[]>([]);
  const [itemsLoading, setItemsLoading] = useState(false);
  const [itemsError, setItemsError] = useState<string | null>(null);
  const [kindFilter, setKindFilter] = useState<"all" | "lesson" | "exam">("all");
  const [onlyActionable, setOnlyActionable] = useState(false);

  // Tab summary state
  const [summaryData, setSummaryData] = useState<SummaryData | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summaryError, setSummaryError] = useState<string | null>(null);

  // 1. Tải danh sách lớp từ API
  const fetchClasses = useCallback(async () => {
    try {
      setClassesLoading(true);
      setClassesError(null);
      const res = await fetch("/api/teacher/grading/classes");
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Không thể tải danh sách lớp học.");
      }
      const data = await res.json();
      const list: ClassOption[] = data.classes || [];
      setClasses(list);

      // Xác định lớp được chọn: ưu tiên URL, không có thì lấy lớp đầu tiên
      let targetClassId = urlClassId;
      if (!targetClassId || !list.some((c) => c.id === targetClassId)) {
        targetClassId = list.length > 0 ? list[0].id : "";
      }
      setSelectedClassId(targetClassId);

      const targetTab = urlTab === "summary" ? "summary" : "items";
      setActiveTab(targetTab);

      if (targetClassId) {
        router.replace(`/teacher/grading?class=${targetClassId}&tab=${targetTab}`);
      }
    } catch (e: any) {
      setClassesError(e.message || "Lỗi tải lớp học.");
    } finally {
      setClassesLoading(false);
    }
  }, [urlClassId, urlTab, router]);

  useEffect(() => {
    fetchClasses();
  }, [fetchClasses]);

  // Đồng bộ tab từ URL
  useEffect(() => {
    if (urlTab === "summary") {
      setActiveTab("summary");
    } else {
      setActiveTab("items");
    }
  }, [urlTab]);

  // 2. Chuyển đổi lớp
  const handleSelectClass = (newClassId: string) => {
    setSelectedClassId(newClassId);
    router.replace(`/teacher/grading?class=${newClassId}&tab=${activeTab}`);
  };

  // 3. Chuyển đổi tab
  const handleSelectTab = (newTab: "items" | "summary") => {
    setActiveTab(newTab);
    if (selectedClassId) {
      router.replace(`/teacher/grading?class=${selectedClassId}&tab=${newTab}`);
    }
  };

  // 4. Tải danh sách bài của lớp
  const fetchItems = useCallback(async (classId: string) => {
    if (!classId) return;
    try {
      setItemsLoading(true);
      setItemsError(null);
      const res = await fetch(`/api/teacher/grading/classes/${classId}`);
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Không thể tải danh sách bài của lớp.");
      }
      const data = await res.json();
      setItems(data.items || []);
    } catch (e: any) {
      setItemsError(e.message || "Lỗi tải bài học/đề thi.");
    } finally {
      setItemsLoading(false);
    }
  }, []);

  // 5. Tải tổng kết lớp
  const fetchSummary = useCallback(async (classId: string) => {
    if (!classId) return;
    try {
      setSummaryLoading(true);
      setSummaryError(null);
      const res = await fetch(`/api/teacher/grading/classes/${classId}/summary`);
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Không thể tải bảng tổng kết lớp.");
      }
      const data = await res.json();
      setSummaryData(data);
    } catch (e: any) {
      setSummaryError(e.message || "Lỗi tải bảng tổng kết.");
    } finally {
      setSummaryLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!selectedClassId) return;
    if (activeTab === "items") {
      fetchItems(selectedClassId);
    } else {
      fetchSummary(selectedClassId);
    }
  }, [selectedClassId, activeTab, fetchItems, fetchSummary]);

  // Lọc client cho tab Bài
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

  // 4 Trạng thái UI
  if (classesLoading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-10 bg-white rounded-2xl border border-line w-1/3"></div>
        <div className="h-64 bg-white rounded-3xl border border-line"></div>
      </div>
    );
  }

  if (classesError) {
    return (
      <div className="p-8 bg-white rounded-3xl border border-line text-center space-y-4 font-sans">
        <AlertCircle className="w-10 h-10 text-rose-600 mx-auto" />
        <div className="space-y-1">
          <h3 className="text-sm font-bold text-ink">Đã xảy ra lỗi khi tải dữ liệu</h3>
          <p className="text-xs text-rose-700">{classesError}</p>
        </div>
        <button
          onClick={fetchClasses}
          className="px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-xl text-xs font-bold inline-flex items-center space-x-1.5 transition-colors cursor-pointer"
        >
          <RefreshCw className="w-3.5 h-3.5 text-white" />
          <span>Thử lại</span>
        </button>
      </div>
    );
  }

  if (classes.length === 0) {
    return (
      <div className="bg-white rounded-3xl border border-line p-12 text-center space-y-4 font-sans">
        <div className="w-16 h-16 rounded-full bg-brand-50 flex items-center justify-center mx-auto text-brand-600">
          <BookOpen className="w-8 h-8" />
        </div>
        <div className="space-y-1">
          <h2 className="text-base font-bold text-ink font-headline">Bạn chưa có lớp nào</h2>
          <p className="text-xs text-ink-muted max-w-sm mx-auto">
            Hãy tạo hoặc tham gia lớp học trước để theo dõi lộ trình và chấm điểm bài nộp của học sinh.
          </p>
        </div>
        <div className="pt-2">
          <Link
            href="/teacher/classes"
            className="px-5 py-2.5 bg-brand-600 hover:bg-brand-700 text-white rounded-xl text-xs font-bold inline-flex items-center space-x-2 transition-colors shadow-xs font-headline cursor-pointer"
          >
            <span>Quản lý lớp học</span>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 font-sans">
      {/* Top Header & Class Selector Bar */}
      <div className="bg-white rounded-3xl p-6 border border-line shadow-2xs flex flex-col md:flex-row justify-between md:items-center gap-4">
        <div className="space-y-1">
          <div className="text-[10px] font-bold uppercase font-mono tracking-wider text-brand-600">
            Cổng Quản Lý &bull; Chấm Điểm
          </div>
          <h1 className="text-2xl font-bold text-ink font-headline tracking-tight">
            Chấm &amp; Bảng Điểm Theo Lớp
          </h1>
          <p className="text-xs text-ink-muted">
            Quản lý bài nộp, sửa điểm bài tự luận AI và chốt bảng điểm chính thức theo từng bài.
          </p>
        </div>

        {/* Class Selection Dropdown */}
        <div className="flex items-center space-x-3 shrink-0">
          <span className="text-xs font-bold text-ink-muted">Chọn lớp:</span>
          <div className="relative">
            <select
              value={selectedClassId}
              onChange={(e) => handleSelectClass(e.target.value)}
              className="appearance-none bg-surface-alt hover:bg-surface-alt/80 border border-line rounded-2xl px-4 py-2.5 pr-10 text-xs font-bold text-ink cursor-pointer focus:outline-none focus:border-brand-600 transition-colors"
            >
              {classes.map((cls) => (
                <option key={cls.id} value={cls.id}>
                  {cls.name} ({cls.student_count} học sinh)
                </option>
              ))}
            </select>
            <ChevronDown className="w-4 h-4 text-ink-muted absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>
        </div>
      </div>

      {/* Tabs Switcher: Bài | Tổng kết lớp */}
      <div className="flex space-x-2 border-b border-line/60">
        <button
          onClick={() => handleSelectTab("items")}
          className={`px-5 py-3 rounded-t-2xl font-headline text-xs font-bold transition-all flex items-center space-x-2 cursor-pointer ${
            activeTab === "items"
              ? "bg-brand-600 text-white shadow-xs"
              : "bg-white text-ink-muted hover:bg-surface-alt border-t border-x border-line"
          }`}
        >
          <Layers className="w-4 h-4" />
          <span>Danh sách bài ({items.length})</span>
        </button>

        <button
          onClick={() => handleSelectTab("summary")}
          className={`px-5 py-3 rounded-t-2xl font-headline text-xs font-bold transition-all flex items-center space-x-2 cursor-pointer ${
            activeTab === "summary"
              ? "bg-brand-600 text-white shadow-xs"
              : "bg-white text-ink-muted hover:bg-surface-alt border-t border-x border-line"
          }`}
        >
          <Award className="w-4 h-4" />
          <span>Tổng kết lớp</span>
        </button>
      </div>

      {/* TAB 1: DANH SÁCH BÀI */}
      {activeTab === "items" && (
        <div className="space-y-4">
          {/* Filter Bar */}
          <div className="bg-white p-4 rounded-2xl border border-line shadow-2xs flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
            <div className="flex items-center space-x-2">
              <span className="text-xs font-bold text-ink-muted mr-1">Bộ lọc:</span>
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

          {itemsError ? (
            <div className="p-6 bg-rose-50 border border-rose-200 rounded-2xl flex items-center justify-between text-rose-800">
              <div className="flex items-center space-x-3">
                <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
                <span className="text-xs font-bold">{itemsError}</span>
              </div>
              <button
                onClick={() => fetchItems(selectedClassId)}
                className="px-3.5 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold flex items-center space-x-1.5 transition-colors cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5 text-white" />
                <span>Thử lại</span>
              </button>
            </div>
          ) : itemsLoading ? (
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
                    {filteredItems.map((item) => {
                      const isLesson = item.kind === "lesson";
                      return (
                        <tr
                          key={`${item.kind}:${item.id}`}
                          onClick={() => {
                            const classId = selectedClassId;
                            router.push(
                              `/teacher/grading/${classId}/${item.kind}/${item.id}`
                            );
                          }}
                          className="hover:bg-brand-50/40 transition-colors cursor-pointer group"
                        >
                          <td className="p-3.5 pl-5">
                            <div className="font-bold text-ink group-hover:text-brand-600 transition-colors">
                              {item.title}
                            </div>
                            <div className="text-[10px] text-ink-subtle font-mono">
                              {item.source === "ROADMAP" ? "Trong lộ trình" : "Giao bài riêng"} &bull; ID: {item.id}
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
                                item.has_ai
                                  ? "bg-purple-100 text-purple-900 border border-purple-200"
                                  : "bg-emerald-50 text-emerald-800 border border-emerald-200"
                              }`}
                            >
                              {item.has_ai ? "AI" : "KQ"}
                            </span>
                          </td>

                          <td className="p-3.5 text-center font-mono font-medium text-ink">
                            {item.submitted}/{item.student_count}
                          </td>

                          <td className="p-3.5 text-center">
                            {item.pending_review > 0 ? (
                              <span className="inline-block px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200 font-mono font-bold text-[11px]">
                                {item.pending_review}
                              </span>
                            ) : (
                              <span className="text-ink-subtle font-mono">0</span>
                            )}
                          </td>

                          <td className="p-3.5 text-center">
                            {item.needs_review > 0 ? (
                              <span className="inline-block px-2 py-0.5 rounded-full bg-rose-50 text-rose-800 border border-rose-200 font-mono font-bold text-[11px]">
                                {item.needs_review}
                              </span>
                            ) : (
                              <span className="text-ink-subtle font-mono">0</span>
                            )}
                          </td>

                          <td className="p-3.5 text-center">
                            {item.grading > 0 ? (
                              <span className="inline-block px-2 py-0.5 rounded-full bg-blue-50 text-blue-800 border border-blue-200 font-mono font-bold text-[11px]">
                                {item.grading}
                              </span>
                            ) : (
                              <span className="text-ink-subtle font-mono">0</span>
                            )}
                          </td>

                          <td className="p-3.5 text-center">
                            {item.finalized_at ? (
                              <span className="inline-block px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 text-[11px] font-bold">
                                Đã chốt {formatDate(item.finalized_at)}
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
      )}

      {/* TAB 2: TỔNG KẾT LỚP */}
      {activeTab === "summary" && (
        <div className="space-y-4">
          {summaryError ? (
            <div className="p-6 bg-rose-50 border border-rose-200 rounded-2xl flex items-center justify-between text-rose-800 font-sans">
              <div className="flex items-center space-x-3">
                <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
                <span className="text-xs font-bold">{summaryError}</span>
              </div>
              <button
                onClick={() => fetchSummary(selectedClassId)}
                className="px-3.5 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold flex items-center space-x-1.5 transition-colors cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5 text-white" />
                <span>Thử lại</span>
              </button>
            </div>
          ) : summaryLoading ? (
            <div className="bg-white rounded-3xl border border-line p-8 space-y-4 animate-pulse font-sans">
              <div className="h-6 bg-surface-alt rounded-lg w-1/3"></div>
              <div className="space-y-3">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className="h-12 bg-surface-alt rounded-xl w-full"></div>
                ))}
              </div>
            </div>
          ) : !summaryData || summaryData.items.length === 0 ? (
            <div className="bg-white rounded-3xl border border-line p-12 text-center space-y-3 font-sans">
              <Award className="w-12 h-12 text-brand-600 mx-auto opacity-30" />
              <h3 className="text-sm font-bold text-ink">Chưa có bài nào được chốt điểm</h3>
              <p className="text-xs text-ink-muted max-w-md mx-auto">
                Bảng tổng kết chỉ hiển thị các bài học và đề thi đã hoàn tất việc chốt bảng điểm chính thức.
              </p>
            </div>
          ) : (
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
                  {summaryData.items.length} bài đã chốt
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-surface-alt border-b border-line text-ink-muted font-bold">
                      <th className="p-3.5 pl-5 border-r border-line/60 min-w-[180px]">Học sinh</th>
                      {summaryData.items.map((it) => (
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
                    {summaryData.students.map((st) => (
                      <tr key={st.id} className="hover:bg-surface-alt/50 transition-colors">
                        <td className="p-3.5 pl-5 border-r border-line/60">
                          <div className="font-bold text-ink">{st.name}</div>
                          <div className="text-[10px] text-ink-subtle font-mono">{st.id}</div>
                        </td>

                        {summaryData.items.map((it) => {
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
                      {summaryData.items.map((it) => {
                        const cellKey = `${it.kind}:${it.id}`;
                        const avg = summaryData.item_averages?.[cellKey];
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
          )}
        </div>
      )}
    </div>
  );
}

export default function TeacherGradingPage() {
  return (
    <TeacherLayout>
      <Suspense
        fallback={
          <div className="p-12 text-center text-xs text-ink-muted bg-white rounded-3xl border border-line">
            <Loader2 className="w-6 h-6 animate-spin text-brand-600 mx-auto mb-2" />
            <span>Đang nạp dữ liệu trung tâm Chấm &amp; Bảng điểm...</span>
          </div>
        }
      >
        <TeacherGradingHubContent />
      </Suspense>
    </TeacherLayout>
  );
}
