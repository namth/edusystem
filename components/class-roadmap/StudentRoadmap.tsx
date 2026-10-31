"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  Route,
  BookOpen,
  FileText,
  Folder,
  Lock,
  Play,
  CheckCircle2,
  Calendar,
  AlertCircle,
  Loader2,
  ChevronDown,
  ChevronRight,
  Award,
  ArrowRight,
} from "lucide-react";

interface StudentRoadmapProps {
  classId: string;
}

interface ClassMeta {
  id: string;
  name: string;
  unlock_mode: "MANUAL" | "ALL_OPEN" | "SEQUENTIAL";
  pass_percent: number;
}

interface RoadmapItem {
  id: string;
  parent_id: string | null;
  type: string; // "UNIT" | "LESSON" | "EXAM"
  title: string;
  lesson_id?: string | null;
  exam_id?: string | null;
  order_index: number;
  state: "LOCKED" | "OPEN" | "COMPLETED";
  best_percent?: number | null;
  due_date?: string | null;
}

interface RoadmapResponse {
  class: ClassMeta;
  progress_percent: number;
  items: RoadmapItem[];
}

export default function StudentRoadmap({ classId }: StudentRoadmapProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<RoadmapResponse | null>(null);
  const [collapsedUnits, setCollapsedUnits] = useState<Record<string, boolean>>({});

  const loadRoadmap = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/student/classes/${classId}/roadmap`);

      if (res.status === 403) {
        throw new Error("Bạn chưa tham gia lớp học này.");
      }

      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || "Không thể tải lộ trình học.");
      }

      const resJson = await res.json();
      setData({
        class: resJson.class,
        progress_percent: resJson.progress_percent ?? 0,
        items: resJson.items || [],
      });
    } catch (err: any) {
      console.error("Lỗi nạp lộ trình học sinh:", err);
      setError(err.message || "Đã xảy ra lỗi khi tải dữ liệu lộ trình.");
    } finally {
      setLoading(false);
    }
  }, [classId]);

  useEffect(() => {
    loadRoadmap();
  }, [loadRoadmap]);

  const toggleUnit = (unitId: string) => {
    setCollapsedUnits((prev) => ({ ...prev, [unitId]: !prev[unitId] }));
  };

  const formatDueDate = (dateStr?: string | null) => {
    if (!dateStr) return null;
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString("vi-VN", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return dateStr;
    }
  };

  const checkIsOverdue = (dateStr?: string | null) => {
    if (!dateStr) return false;
    return new Date(dateStr).getTime() < Date.now();
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-12 bg-white rounded-2xl border border-[#d8c2b6] space-y-3">
        <Loader2 className="w-6 h-6 animate-spin text-[#6d3807]" />
        <span className="text-xs font-medium text-[#52443a]">
          Đang tải dữ liệu lộ trình lớp học...
        </span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 rounded-2xl bg-white border border-red-200 text-center space-y-4">
        <AlertCircle className="w-10 h-10 text-red-600 mx-auto" />
        <div>
          <h3 className="text-base font-bold text-[#211a16] font-headline mb-1">
            Không thể tải lộ trình
          </h3>
          <p className="text-xs text-red-700 font-medium">{error}</p>
        </div>
        <button
          onClick={loadRoadmap}
          className="px-5 py-2 bg-[#6d3807] hover:bg-[#8a4f1e] text-white text-xs font-bold rounded-xl transition-all cursor-pointer font-headline inline-flex items-center space-x-1.5"
        >
          <span>Thử lại</span>
        </button>
      </div>
    );
  }

  const items = data?.items || [];
  const classInfo = data?.class;
  const progressPercent = data?.progress_percent ?? 0;

  // Mô tả chế độ lớp
  let modeSubtitle = "";
  if (classInfo?.unlock_mode === "SEQUENTIAL") {
    modeSubtitle = `Tuần tự — cần đạt ${classInfo.pass_percent ?? 70}%`;
  } else if (classInfo?.unlock_mode === "ALL_OPEN") {
    modeSubtitle = "Mở tất cả";
  } else if (classInfo?.unlock_mode === "MANUAL") {
    modeSubtitle = "Giáo viên mở từng mục";
  }

  if (items.length === 0) {
    return (
      <div className="p-12 text-center bg-white rounded-3xl border border-[#d8c2b6] space-y-3">
        <BookOpen className="w-12 h-12 text-[#6d3807] mx-auto opacity-40" />
        <h3 className="text-base font-bold text-[#211a16] font-headline">
          Giáo viên chưa gắn khóa học cho lớp này hoặc khóa học chưa có lộ trình.
        </h3>
        <p className="text-xs text-[#52443a]">
          Vui lòng liên hệ giáo viên phụ trách để cập nhật chương trình học cho lớp.
        </p>
      </div>
    );
  }

  const units = items.filter((it) => it.type === "UNIT");
  const rootStandaloneItems = items.filter((it) => it.type !== "UNIT" && !it.parent_id);

  const renderItemRow = (item: RoadmapItem) => {
    const isLocked = item.state === "LOCKED";
    const isOpen = item.state === "OPEN";
    const isCompleted = item.state === "COMPLETED";

    const formattedDate = formatDueDate(item.due_date);
    const isOverdue = checkIsOverdue(item.due_date) && !isCompleted;

    const content = (
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 w-full">
        <div className="flex items-center space-x-3">
          {/* Biểu tượng theo state */}
          <div className="shrink-0">
            {isLocked ? (
              <div className="p-2 rounded-xl bg-neutral-100 text-neutral-400">
                <Lock className="w-4 h-4" />
              </div>
            ) : isOpen ? (
              <div className="p-2 rounded-xl bg-[#fff1ea] text-[#6d3807]">
                <Play className="w-4 h-4 fill-[#6d3807]" />
              </div>
            ) : (
              <div className="p-2 rounded-xl bg-emerald-50 text-emerald-600">
                <CheckCircle2 className="w-4 h-4" />
              </div>
            )}
          </div>

          <div>
            <div className="flex items-center space-x-2">
              <span className="px-2 py-0.5 rounded-md bg-[#fff8f5] border border-[#d8c2b6] text-[10px] font-mono font-bold uppercase text-[#6d3807]">
                {item.type === "LESSON" ? "Bài học" : item.type === "EXAM" ? "Đề thi" : item.type}
              </span>
              <h4
                className={`text-xs font-bold font-headline ${
                  isLocked ? "text-neutral-500" : "text-[#211a16] group-hover:text-[#6d3807]"
                }`}
              >
                {item.title}
              </h4>
            </div>

            {/* Trạng thái & hạn due_date */}
            <div className="flex flex-wrap items-center gap-3 mt-1 text-[11px]">
              {item.best_percent != null && (
                <span className="text-emerald-700 font-bold flex items-center space-x-1">
                  <Award className="w-3.5 h-3.5" />
                  <span>Điểm cao nhất: {item.best_percent}%</span>
                </span>
              )}

              {formattedDate && (
                <span
                  className={`flex items-center space-x-1 ${
                    isOverdue
                      ? "text-red-600 font-bold bg-red-50 px-2 py-0.5 rounded-md border border-red-200"
                      : "text-[#857469]"
                  }`}
                >
                  <Calendar className="w-3.5 h-3.5" />
                  <span>
                    {isOverdue ? "Quá hạn: " : "Hạn: "}
                    {formattedDate}
                  </span>
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="shrink-0 flex items-center space-x-3">
          {isLocked ? (
            <span className="px-3 py-1 rounded-xl bg-neutral-100 text-neutral-500 text-xs font-medium">
              Chưa mở
            </span>
          ) : isCompleted ? (
            <div className="flex items-center space-x-2">
              <span className="px-2.5 py-1 rounded-xl bg-emerald-100 text-emerald-800 text-xs font-bold">
                Đã hoàn thành
              </span>
              <ArrowRight className="w-4 h-4 text-[#857469] group-hover:translate-x-1 transition-transform" />
            </div>
          ) : (
            <div className="flex items-center space-x-2">
              <span className="px-3 py-1 rounded-xl bg-[#6d3807] text-white text-xs font-bold shadow-xs">
                Vào làm bài
              </span>
              <ArrowRight className="w-4 h-4 text-[#6d3807] group-hover:translate-x-1 transition-transform" />
            </div>
          )}
        </div>
      </div>
    );

    if (isLocked) {
      return (
        <div
          key={item.id}
          title="Chưa được mở"
          className="p-4 rounded-2xl bg-neutral-50/70 border border-neutral-200/80 cursor-not-allowed select-none transition-all"
        >
          {content}
        </div>
      );
    }

    if (item.type === "LESSON") {
      return (
        <Link
          key={item.id}
          href={`/student/lesson/${item.lesson_id}?classId=${classId}`}
          className="block p-4 rounded-2xl bg-white hover:bg-[#fff8f5] border border-[#d8c2b6] shadow-xs hover:shadow-sm transition-all group cursor-pointer"
        >
          {content}
        </Link>
      );
    }

    return (
      <Link
        key={item.id}
        href={`/student/exam/${item.exam_id}`}
        className="block p-4 rounded-2xl bg-white hover:bg-[#fff8f5] border border-[#d8c2b6] shadow-xs hover:shadow-sm transition-all group cursor-pointer"
      >
        {content}
      </Link>
    );
  };

  return (
    <div className="space-y-6 font-sans text-[#211a16]">
      {/* KHỐI TIẾN ĐỘ TỔNG QUAN */}
      <section className="bg-white p-6 rounded-3xl border border-[#d8c2b6] shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h2 className="text-base font-bold font-headline text-[#6d3807] flex items-center space-x-2">
              <Route className="w-5 h-5 text-[#6d3807]" />
              <span>Tiến Độ Lộ Trình Lớp Học</span>
            </h2>
            {modeSubtitle && (
              <p className="text-xs text-[#52443a] mt-0.5 font-medium">{modeSubtitle}</p>
            )}
          </div>

          <div className="text-right">
            <span className="text-2xl font-extrabold text-[#6d3807] font-headline">
              {progressPercent}%
            </span>
            <span className="text-xs text-[#857469] block">Hoàn thành</span>
          </div>
        </div>

        {/* Thanh tiến độ progress_percent */}
        <div className="w-full bg-[#fff1ea] h-3 rounded-full overflow-hidden border border-[#ffb783]/40">
          <div
            className="bg-[#6d3807] h-full rounded-full transition-all duration-500 ease-out"
            style={{ width: `${Math.min(100, Math.max(0, progressPercent))}%` }}
          />
        </div>
      </section>

      {/* CÂY LỘ TRÌNH: UNIT -> MỤC */}
      <section className="space-y-4">
        {units.length > 0 ? (
          <div className="space-y-4">
            {units.map((unit) => {
              const children = items.filter((it) => it.parent_id === unit.id);
              const isCollapsed = collapsedUnits[unit.id] || false;
              const completedCount = children.filter((it) => it.state === "COMPLETED").length;

              return (
                <div
                  key={unit.id}
                  className="bg-white rounded-3xl border border-[#d8c2b6] shadow-sm overflow-hidden"
                >
                  {/* Unit Header (gấp/mở) */}
                  <button
                    type="button"
                    onClick={() => toggleUnit(unit.id)}
                    className="w-full p-4 sm:p-5 flex items-center justify-between bg-[#fff8f5] hover:bg-[#fff1ea] transition-colors cursor-pointer text-left border-b border-[#d8c2b6]/40"
                  >
                    <div className="flex items-center space-x-3">
                      <div className="p-2 rounded-xl bg-white border border-[#d8c2b6] text-[#6d3807]">
                        <Folder className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="flex items-center space-x-2">
                          <span className="px-2 py-0.5 rounded-md bg-[#6d3807] text-white text-[10px] font-mono font-bold uppercase">
                            Unit
                          </span>
                          <h3 className="text-sm font-bold font-headline text-[#211a16]">
                            {unit.title}
                          </h3>
                        </div>
                        <span className="text-[11px] text-[#52443a] mt-0.5 block">
                          Đã hoàn thành {completedCount}/{children.length} mục
                        </span>
                      </div>
                    </div>

                    <div className="p-1 rounded-lg text-[#6d3807]">
                      {isCollapsed ? (
                        <ChevronRight className="w-5 h-5" />
                      ) : (
                        <ChevronDown className="w-5 h-5" />
                      )}
                    </div>
                  </button>

                  {/* Danh sách mục con */}
                  {!isCollapsed && (
                    <div className="p-4 sm:p-6 space-y-3 bg-white">
                      {children.length === 0 ? (
                        <p className="text-xs text-[#857469] italic text-center py-4">
                          Unit này chưa có bài học hoặc đề thi.
                        </p>
                      ) : (
                        children.map((child) => renderItemRow(child))
                      )}
                    </div>
                  )}
                </div>
              );
            })}

            {/* Root items without unit */}
            {rootStandaloneItems.length > 0 && (
              <div className="bg-white rounded-3xl border border-[#d8c2b6] shadow-sm p-6 space-y-3">
                <h3 className="text-xs font-bold uppercase text-[#857469] font-headline mb-2">
                  Các mục khác
                </h3>
                {rootStandaloneItems.map((item) => renderItemRow(item))}
              </div>
            )}
          </div>
        ) : (
          /* Không có unit -> render danh sách phẳng */
          <div className="space-y-3">
            {items.map((item) => renderItemRow(item))}
          </div>
        )}
      </section>
    </div>
  );
}
