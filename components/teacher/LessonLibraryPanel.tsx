"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  BookMarked,
  Plus,
  Search,
  Filter,
  Trash2,
  Edit3,
  Layers,
  GraduationCap,
  Calendar,
  AlertCircle,
  RefreshCw,
  Loader2,
  X,
  ExternalLink,
} from "lucide-react";

interface LessonItem {
  id: string;
  title: string;
  description: string | null;
  skills: string[];
  block_count: number;
  usage_count: number;
  created_by: string;
  created_at: string;
  updated_at: string;
}

interface UsageConflict {
  course_id: string;
  course_title: string | null;
  curriculum_item_id: string;
}

export default function LessonLibraryPanel() {
  const [lessons, setLessons] = useState<LessonItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [selectedSkill, setSelectedSkill] = useState<string>("ALL");

  // Deletion and conflict states
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [conflictUsages, setConflictUsages] = useState<UsageConflict[] | null>(null);

  // Debounce search input (~300ms)
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(searchQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const fetchLessons = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const params = new URLSearchParams();
      if (debouncedQuery.trim()) {
        params.append("q", debouncedQuery.trim());
      }
      if (selectedSkill && selectedSkill !== "ALL") {
        params.append("skill", selectedSkill);
      }

      const queryString = params.toString() ? `?${params.toString()}` : "";
      const res = await fetch(`/api/teacher/lessons${queryString}`);
      const json = await res.json().catch(() => null);

      if (!res.ok || !json?.success) {
        throw new Error(json?.error || "Không thể tải danh sách bài học.");
      }

      setLessons(Array.isArray(json.lessons) ? json.lessons : []);
    } catch (err: any) {
      console.error("Fetch lessons error:", err);
      setErrorMessage(err.message || "Lỗi nạp danh sách bài học.");
    } finally {
      setIsLoading(false);
    }
  }, [debouncedQuery, selectedSkill]);

  useEffect(() => {
    fetchLessons();
  }, [fetchLessons]);

  const handleDeleteLesson = async (id: string, title: string) => {
    if (!confirm(`Bạn có chắc chắn muốn xóa bài học "${title}" không?`)) {
      return;
    }

    setDeletingId(id);
    try {
      const res = await fetch(`/api/teacher/lessons/${id}`, {
        method: "DELETE",
      });

      const json = await res.json().catch(() => null);

      if (res.status === 409) {
        // Conflict: lesson is attached to curriculum
        setConflictUsages(json?.usages || []);
        return;
      }

      if (!res.ok || !json?.success) {
        alert(json?.error || "Lỗi xóa bài học.");
        return;
      }

      // Success: Remove locally
      setLessons((prev) => prev.filter((item) => item.id !== id));
    } catch (err: any) {
      console.error("Delete lesson error:", err);
      alert(err.message || "Lỗi kết nối khi xóa bài học.");
    } finally {
      setDeletingId(null);
    }
  };

  const isFiltered = debouncedQuery.trim().length > 0 || selectedSkill !== "ALL";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-line shadow-sm">
        <div className="flex items-center space-x-3">
          <div className="w-12 h-12 rounded-2xl bg-brand-50 text-brand-600 flex items-center justify-center font-bold shadow-xs">
            <BookMarked className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-ink font-headline">Kho Bài Học</h2>
            <p className="text-xs text-ink-muted">
              Quản lý các bài học độc lập, kết hợp khối câu hỏi đa kỹ năng để gắn vào lộ trình học
            </p>
          </div>
        </div>

        <Link
          href="/teacher/lessons/new"
          className="inline-flex items-center justify-center px-5 py-2.5 bg-brand-600 hover:bg-brand-700 text-white rounded-xl text-xs font-bold shadow-sm transition-all space-x-2 shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>Tạo bài học</span>
        </Link>
      </div>

      {/* Filters & Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-line shadow-2xs flex flex-col sm:flex-row items-center justify-between gap-3">
        {/* Search Input */}
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-subtle" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Tìm theo tiêu đề bài học..."
            className="w-full pl-9 pr-3.5 py-2 bg-surface-alt border border-line rounded-xl text-xs text-ink placeholder-ink-subtle focus:outline-none focus:border-brand-600 transition-all"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Skill Filter Chips */}
        <div className="flex items-center space-x-1.5 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0">
          <span className="text-[11px] font-bold text-ink-muted mr-1 flex items-center">
            <Filter className="w-3 h-3 mr-1" /> Kỹ năng:
          </span>
          {(["ALL", "Reading", "Listening", "Writing"] as const).map((sk) => {
            const active = selectedSkill === sk;
            const label = sk === "ALL" ? "Tất cả" : sk;
            return (
              <button
                key={sk}
                onClick={() => setSelectedSkill(sk)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 ${
                  active
                    ? "bg-brand-600 text-white shadow-2xs"
                    : "bg-surface-alt text-ink-muted hover:bg-brand-100 border border-line"
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>

      {/* 4 UI States */}

      {/* 1. Loading State */}
      {isLoading && (
        <div className="bg-white p-12 rounded-2xl border border-line shadow-sm flex flex-col items-center justify-center text-center space-y-3">
          <Loader2 className="w-8 h-8 animate-spin text-brand-600" />
          <p className="text-xs font-semibold text-ink-muted">Đang tải danh sách bài học...</p>
        </div>
      )}

      {/* 2. Error State */}
      {!isLoading && errorMessage && (
        <div className="bg-rose-50 border border-rose-200 p-8 rounded-2xl text-center space-y-4">
          <div className="w-12 h-12 rounded-full bg-rose-100 text-rose-600 mx-auto flex items-center justify-center">
            <AlertCircle className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-rose-900">Không thể tải dữ liệu</h3>
            <p className="text-xs text-rose-700 mt-1">{errorMessage}</p>
          </div>
          <button
            onClick={fetchLessons}
            className="inline-flex items-center px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition-all space-x-1.5 shadow-2xs"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Thử lại</span>
          </button>
        </div>
      )}

      {/* 3. Empty State (No lessons) */}
      {!isLoading && !errorMessage && lessons.length === 0 && (
        <div className="bg-white p-12 rounded-2xl border border-line shadow-sm text-center space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-brand-50 text-brand-600 mx-auto flex items-center justify-center">
            <BookMarked className="w-7 h-7" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-ink">
              {isFiltered ? "Không tìm thấy bài học phù hợp" : "Chưa có bài học nào — Tạo bài học đầu tiên"}
            </h3>
            <p className="text-xs text-ink-muted mt-1 max-w-md mx-auto">
              {isFiltered
                ? "Hãy thử tìm kiếm từ khóa khác hoặc điều chỉnh bộ lọc kỹ năng."
                : "Bắt đầu xây dựng kho học liệu bằng cách tạo bài học mới với các khối bài tập phong phú."}
            </p>
          </div>
          {!isFiltered ? (
            <Link
              href="/teacher/lessons/new"
              className="inline-flex items-center px-5 py-2.5 bg-brand-600 hover:bg-brand-700 text-white rounded-xl text-xs font-bold transition-all space-x-2 shadow-xs"
            >
              <Plus className="w-4 h-4" />
              <span>Tạo bài học đầu tiên</span>
            </Link>
          ) : (
            <button
              onClick={() => {
                setSearchQuery("");
                setSelectedSkill("ALL");
              }}
              className="inline-flex items-center px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-xs font-bold transition-all"
            >
              Xóa bộ lọc
            </button>
          )}
        </div>
      )}

      {/* 4. Data State */}
      {!isLoading && !errorMessage && lessons.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {lessons.map((lesson) => (
            <div
              key={lesson.id}
              className="bg-white rounded-2xl border border-line hover:border-brand-600 transition-all p-5 shadow-2xs hover:shadow-md flex flex-col justify-between group"
            >
              <div>
                {/* Top Meta: Skills & Actions */}
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div className="flex flex-wrap gap-1.5">
                    {lesson.skills && lesson.skills.length > 0 ? (
                      lesson.skills.map((sk) => (
                        <span
                          key={sk}
                          className="px-2 py-0.5 rounded-md bg-brand-50 text-brand-600 border border-line/50 text-[10px] font-bold"
                        >
                          {sk}
                        </span>
                      ))
                    ) : (
                      <span className="px-2 py-0.5 rounded-md bg-gray-100 text-gray-600 text-[10px] font-medium">
                        Chưa có khối
                      </span>
                    )}
                  </div>

                  <div className="flex items-center space-x-1 shrink-0">
                    <Link
                      href={`/teacher/lessons/${lesson.id}`}
                      className="p-1.5 text-ink-muted hover:text-brand-600 hover:bg-brand-50 rounded-lg transition-colors border border-transparent hover:border-line/50"
                      title="Chỉnh sửa bài học"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </Link>
                    <button
                      type="button"
                      onClick={() => handleDeleteLesson(lesson.id, lesson.title)}
                      disabled={deletingId === lesson.id}
                      className="p-1.5 text-rose-600 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition-colors border border-transparent hover:border-rose-200 disabled:opacity-40"
                      title="Xóa bài học"
                    >
                      {deletingId === lesson.id ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Trash2 className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>
                </div>

                {/* Title & Description */}
                <Link href={`/teacher/lessons/${lesson.id}`} className="block">
                  <h2 className="text-sm font-bold text-ink group-hover:text-brand-600 transition-colors line-clamp-2">
                    {lesson.title}
                  </h2>
                  {lesson.description && (
                    <p className="text-xs text-ink-muted mt-1 line-clamp-2 leading-relaxed">
                      {lesson.description}
                    </p>
                  )}
                </Link>
              </div>

              {/* Footer Info */}
              <div className="pt-4 mt-4 border-t border-line/40 flex flex-col space-y-2 text-[11px] text-ink-muted">
                <div className="flex items-center justify-between">
                  <span className="flex items-center space-x-1 font-semibold text-brand-600">
                    <Layers className="w-3.5 h-3.5" />
                    <span>{lesson.block_count} khối</span>
                  </span>
                  <span className="flex items-center space-x-1">
                    <GraduationCap className="w-3.5 h-3.5 text-ink-subtle" />
                    <span>Dùng trong {lesson.usage_count} khóa</span>
                  </span>
                </div>

                <div className="flex items-center space-x-1 text-ink-subtle text-[10px]">
                  <Calendar className="w-3 h-3" />
                  <span>
                    Cập nhật: {new Date(lesson.updated_at).toLocaleString("vi-VN")}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 409 Conflict Dialog (DEC-005) */}
      {conflictUsages && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-rose-300 space-y-4">
            <div className="flex items-start space-x-3">
              <div className="w-10 h-10 rounded-xl bg-rose-100 text-rose-600 flex items-center justify-center shrink-0">
                <AlertCircle className="w-5 h-5" />
              </div>
              <div className="flex-1">
                <h3 className="text-sm font-bold text-ink">Không thể xóa bài học này</h3>
                <p className="text-xs text-ink-muted mt-1">
                  Gỡ bài học khỏi lộ trình trước khi xoá. Bài học đang được sử dụng trong các khóa học sau:
                </p>
              </div>
            </div>

            <div className="max-h-48 overflow-y-auto space-y-1.5 p-3 rounded-xl bg-surface-alt border border-line">
              {conflictUsages.map((usage, idx) => (
                <div
                  key={`${usage.course_id}_${idx}`}
                  className="flex items-center justify-between text-xs p-2 rounded-lg bg-white border border-line/50"
                >
                  <span className="font-semibold text-ink truncate">
                    {usage.course_title || usage.course_id}
                  </span>
                  <Link
                    href={`/teacher/tests`}
                    className="text-[11px] text-brand-600 font-bold hover:underline flex items-center space-x-0.5 shrink-0 ml-2"
                  >
                    <span>Lộ trình</span>
                    <ExternalLink className="w-3 h-3" />
                  </Link>
                </div>
              ))}
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setConflictUsages(null)}
                className="px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs"
              >
                Đã hiểu
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
