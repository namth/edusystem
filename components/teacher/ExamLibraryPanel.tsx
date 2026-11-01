"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  FileText,
  Plus,
  Search,
  Trash2,
  Edit3,
  Eye,
  Clock,
  HelpCircle,
  GraduationCap,
  Calendar,
  AlertCircle,
  RefreshCw,
  Loader2,
  X,
  Sparkles,
} from "lucide-react";

interface ExamItem {
  id: string;
  title: string;
  description: string | null;
  skills: string[];
  duration_minutes: number;
  question_count: number;
  usage_count: number;
  subject_id?: string;
  created_by: string;
  created_at: string;
}

interface SubjectOption {
  id: string;
  name: string;
}

interface ExamUsageCounts {
  curriculum: number;
  assignments: number;
  submissions: number;
}

export default function ExamLibraryPanel() {
  const [exams, setExams] = useState<ExamItem[]>([]);
  const [subjects, setSubjects] = useState<SubjectOption[]>([]);
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>("");
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");

  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [conflictUsages, setConflictUsages] = useState<ExamUsageCounts | null>(null);

  useEffect(() => {
    fetch("/api/subjects")
      .then((r) => r.json())
      .then((json) => {
        if (json?.success && Array.isArray(json.subjects)) {
          setSubjects(json.subjects);
        }
      })
      .catch(() => {});
  }, []);

  // Debounce search input (~300ms)
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(searchQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const fetchExams = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const q = debouncedQuery.trim();
      const baseQs = q ? `?q=${encodeURIComponent(q)}` : "";
      const subjQs = selectedSubjectId
        ? `${baseQs ? "&" : "?"}subject_id=${encodeURIComponent(selectedSubjectId)}`
        : "";
      const queryString = `${baseQs}${subjQs}`;
      const res = await fetch(`/api/teacher/exams${queryString}`);
      const json = await res.json().catch(() => null);

      if (!res.ok || !json?.success) {
        throw new Error(json?.error || "Không thể tải danh sách đề thi.");
      }

      setExams(Array.isArray(json.exams) ? json.exams : []);
    } catch (err: any) {
      console.error("Fetch exams error:", err);
      setErrorMessage(err.message || "Lỗi nạp danh sách đề thi.");
    } finally {
      setIsLoading(false);
    }
  }, [debouncedQuery, selectedSubjectId]);

  useEffect(() => {
    fetchExams();
  }, [fetchExams]);

  const handleDeleteExam = async (id: string, title: string) => {
    if (!confirm(`Bạn có chắc chắn muốn xóa đề thi "${title}" không?`)) {
      return;
    }

    setDeletingId(id);
    try {
      const res = await fetch(`/api/teacher/exams/${id}`, {
        method: "DELETE",
      });

      const json = await res.json().catch(() => null);

      if (res.status === 409) {
        const u = json?.usages || {};
        setConflictUsages({
          curriculum: Number(u.curriculum || 0),
          assignments: Number(u.assignments || 0),
          submissions: Number(u.submissions || 0),
        });
        return;
      }

      if (!res.ok || !json?.success) {
        alert(json?.error || "Lỗi xóa đề thi.");
        return;
      }

      setExams((prev) => prev.filter((item) => item.id !== id));
    } catch (err: any) {
      console.error("Delete exam error:", err);
      alert(err.message || "Lỗi kết nối khi xóa đề thi.");
    } finally {
      setDeletingId(null);
    }
  };

  const isFiltered = debouncedQuery.trim().length > 0 || selectedSubjectId !== "";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-line shadow-sm">
        <div className="flex items-center space-x-3">
          <div className="w-12 h-12 rounded-2xl bg-brand-50 text-brand-600 flex items-center justify-center font-bold shadow-xs">
            <FileText className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-ink font-headline">Kho Đề Thi</h2>
            <p className="text-xs text-ink-muted">
              Quản lý toàn bộ đề thi đã tạo, chỉnh sửa câu hỏi hoặc gắn đề vào lộ trình khóa học
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <Link
            href="/admin/tests/import"
            className="inline-flex items-center justify-center px-4 py-2.5 bg-brand-50 text-brand-600 hover:bg-brand-100 border border-line rounded-xl text-xs font-bold shadow-2xs transition-all space-x-1.5"
          >
            <Sparkles className="w-4 h-4 text-brand-600" />
            <span>AI Import</span>
          </Link>

          <Link
            href="/teacher/tests/create"
            className="inline-flex items-center justify-center px-5 py-2.5 bg-brand-600 hover:bg-brand-700 text-white rounded-xl text-xs font-bold shadow-sm transition-all space-x-2"
          >
            <Plus className="w-4 h-4" />
            <span>Tạo đề mới</span>
          </Link>
        </div>
      </div>

      {/* Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-line shadow-2xs flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-subtle" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Tìm theo tên đề thi..."
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

        <div className="flex items-center space-x-2 w-full sm:w-auto">
          <span className="text-[11px] font-bold text-ink-muted shrink-0">Môn học:</span>
          <select
            value={selectedSubjectId}
            onChange={(e) => setSelectedSubjectId(e.target.value)}
            className="px-3 py-2 bg-surface-alt border border-line rounded-xl text-xs font-bold text-ink focus:outline-none focus:border-brand-600"
          >
            <option value="">Tất cả môn</option>
            {subjects.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* 1. Loading State */}
      {isLoading && (
        <div className="bg-white p-12 rounded-2xl border border-line shadow-sm flex flex-col items-center justify-center text-center space-y-3">
          <Loader2 className="w-8 h-8 animate-spin text-brand-600" />
          <p className="text-xs font-semibold text-ink-muted">Đang tải danh sách đề thi...</p>
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
            onClick={fetchExams}
            className="inline-flex items-center px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition-all space-x-1.5 shadow-2xs"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Thử lại</span>
          </button>
        </div>
      )}

      {/* 3. Empty State */}
      {!isLoading && !errorMessage && exams.length === 0 && (
        <div className="bg-white p-12 rounded-2xl border border-line shadow-sm text-center space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-brand-50 text-brand-600 mx-auto flex items-center justify-center">
            <FileText className="w-7 h-7" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-ink">
              {isFiltered ? "Không tìm thấy đề thi phù hợp" : "Chưa có đề thi — bấm Tạo đề mới"}
            </h3>
            <p className="text-xs text-ink-muted mt-1 max-w-md mx-auto">
              {isFiltered
                ? "Hãy thử tìm kiếm từ khóa khác."
                : "Bắt đầu xây dựng kho đề thi bằng cách tạo bộ đề mới hoặc nhập đề tự động bằng AI."}
            </p>
          </div>
          {!isFiltered ? (
            <Link
              href="/teacher/tests/create"
              className="inline-flex items-center px-5 py-2.5 bg-brand-600 hover:bg-brand-700 text-white rounded-xl text-xs font-bold transition-all space-x-2 shadow-xs"
            >
              <Plus className="w-4 h-4" />
              <span>Tạo đề mới</span>
            </Link>
          ) : (
            <button
              onClick={() => setSearchQuery("")}
              className="inline-flex items-center px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-xs font-bold transition-all"
            >
              Xóa bộ lọc
            </button>
          )}
        </div>
      )}

      {/* 4. Data State */}
      {!isLoading && !errorMessage && exams.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {exams.map((exam) => (
            <div
              key={exam.id}
              className="bg-white rounded-2xl border border-line hover:border-brand-600 transition-all p-5 shadow-2xs hover:shadow-md flex flex-col justify-between group"
            >
              <div>
                {/* Top Meta: Skills & Actions */}
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div className="flex flex-wrap gap-1.5">
                    {exam.skills && exam.skills.length > 0 ? (
                      exam.skills.map((sk) => (
                        <span
                          key={sk}
                          className="px-2 py-0.5 rounded-md bg-brand-50 text-brand-600 border border-line/50 text-[10px] font-bold"
                        >
                          {sk}
                        </span>
                      ))
                    ) : (
                      <span className="px-2 py-0.5 rounded-md bg-gray-100 text-gray-600 text-[10px] font-medium">
                        Chưa có câu hỏi
                      </span>
                    )}
                  </div>

                  <div className="flex items-center space-x-1 shrink-0">
                    <Link
                      href={`/student/exam/${exam.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-1.5 text-ink-muted hover:text-brand-600 hover:bg-brand-50 rounded-lg transition-colors border border-transparent hover:border-line/50"
                      title="Xem thử đề thi"
                    >
                      <Eye className="w-3.5 h-3.5" />
                    </Link>
                    <Link
                      href={`/teacher/tests/create?editId=${exam.id}`}
                      className="p-1.5 text-ink-muted hover:text-brand-600 hover:bg-brand-50 rounded-lg transition-colors border border-transparent hover:border-line/50"
                      title="Sửa đề thi"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </Link>
                    <button
                      type="button"
                      onClick={() => handleDeleteExam(exam.id, exam.title)}
                      disabled={deletingId === exam.id}
                      className="p-1.5 text-rose-600 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition-colors border border-transparent hover:border-rose-200 disabled:opacity-40"
                      title="Xóa đề thi"
                    >
                      {deletingId === exam.id ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Trash2 className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>
                </div>

                {/* Title & Description */}
                <Link href={`/teacher/tests/create?editId=${exam.id}`} className="block">
                  <h3 className="text-sm font-bold text-ink group-hover:text-brand-600 transition-colors line-clamp-2">
                    {exam.title}
                  </h3>
                  {exam.description && (
                    <p className="text-xs text-ink-muted mt-1 line-clamp-2 leading-relaxed">
                      {exam.description}
                    </p>
                  )}
                </Link>
              </div>

              {/* Footer Info */}
              <div className="pt-4 mt-4 border-t border-line/40 flex flex-col space-y-2 text-[11px] text-ink-muted">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center space-x-3">
                    <span className="flex items-center space-x-1 font-semibold text-brand-600">
                      <HelpCircle className="w-3.5 h-3.5" />
                      <span>{exam.question_count} câu</span>
                    </span>
                    <span className="flex items-center space-x-1 text-ink-muted">
                      <Clock className="w-3.5 h-3.5 text-ink-subtle" />
                      <span>{exam.duration_minutes} phút</span>
                    </span>
                  </div>
                  <span className="flex items-center space-x-1">
                    <GraduationCap className="w-3.5 h-3.5 text-ink-subtle" />
                    <span>Dùng trong {exam.usage_count} lộ trình</span>
                  </span>
                </div>

                <div className="flex items-center space-x-1 text-ink-subtle text-[10px]">
                  <Calendar className="w-3 h-3" />
                  <span>
                    Ngày tạo: {exam.created_at ? new Date(exam.created_at).toLocaleString("vi-VN") : "—"}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 409 Conflict Dialog */}
      {conflictUsages && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-rose-300 space-y-4">
            <div className="flex items-start space-x-3">
              <div className="w-10 h-10 rounded-xl bg-rose-100 text-rose-600 flex items-center justify-center shrink-0">
                <AlertCircle className="w-5 h-5" />
              </div>
              <div className="flex-1">
                <h3 className="text-sm font-bold text-ink">Không thể xóa đề thi này</h3>
                <p className="text-xs text-ink-muted mt-1 leading-relaxed">
                  Đề đang được dùng: {conflictUsages.curriculum} mục lộ trình, {conflictUsages.assignments} lớp giao, {conflictUsages.submissions} bài nộp — gỡ khỏi lộ trình trước khi xoá
                </p>
              </div>
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
