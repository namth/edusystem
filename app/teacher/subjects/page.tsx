"use client";

import { useState, useEffect, useCallback } from "react";
import TeacherLayout from "@/components/TeacherLayout";
import { useAuth } from "@/context/AuthContext";
import {
  GraduationCap,
  BookOpen,
  Languages,
  Calculator,
  Atom,
  FlaskConical,
  Globe,
  Code,
  Music,
  Palette,
  Plus,
  Pencil,
  Trash2,
  RefreshCw,
  AlertCircle,
  Loader2,
  X,
  Check,
} from "lucide-react";

interface SubjectItem {
  id: string;
  code: string;
  name: string;
  icon: string | null;
  color: string | null;
  mode: "LANGUAGE" | "SIMPLE";
  owner_id: string | null;
  is_active: boolean;
  order_index: number;
  usage_count: number;
}

interface ConflictUsages {
  courses: number;
  exams: number;
  lessons: number;
}

const ICON_OPTIONS = [
  { key: "languages", label: "Ngôn ngữ", Icon: Languages },
  { key: "calculator", label: "Toán học", Icon: Calculator },
  { key: "atom", label: "Vật lý", Icon: Atom },
  { key: "flask", label: "Hoá / Sinh", Icon: FlaskConical },
  { key: "globe", label: "Địa / Sử", Icon: Globe },
  { key: "code", label: "Tin học", Icon: Code },
  { key: "music", label: "Âm nhạc", Icon: Music },
  { key: "palette", label: "Mỹ thuật", Icon: Palette },
  { key: "book-open", label: "Tổng hợp", Icon: BookOpen },
];

const COLOR_PRESETS = [
  { value: "#1453e0", label: "Xanh dương", dotClass: "bg-brand-600" },
  { value: "#2563eb", label: "Xanh lam", dotClass: "bg-blue-600" },
  { value: "#16a34a", label: "Xanh lá", dotClass: "bg-emerald-600" },
  { value: "#d97706", label: "Cam hổ phách", dotClass: "bg-amber-600" },
  { value: "#e11d48", label: "Đỏ hồng", dotClass: "bg-rose-600" },
  { value: "#7c3aed", label: "Tím", dotClass: "bg-violet-600" },
  { value: "#0d9488", label: "Xanh ngọc", dotClass: "bg-teal-600" },
  { value: "#475569", label: "Xám đá", dotClass: "bg-slate-600" },
];

function renderSubjectIcon(iconKey: string | null) {
  const found = ICON_OPTIONS.find((o) => o.key === iconKey);
  const IconComp = found ? found.Icon : GraduationCap;
  return <IconComp className="w-5 h-5" />;
}

export default function TeacherSubjectsPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === "ADMIN";

  const [subjects, setSubjects] = useState<SubjectItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Modal Create / Edit
  const [showModal, setShowModal] = useState(false);
  const [editingSubject, setEditingSubject] = useState<SubjectItem | null>(null);
  const [formName, setFormName] = useState("");
  const [formIcon, setFormIcon] = useState("book-open");
  const [formColor, setFormColor] = useState(COLOR_PRESETS[0].value);
  const [formMode, setFormMode] = useState<"LANGUAGE" | "SIMPLE">("SIMPLE");
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Toggling & Deleting
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [conflictModal, setConflictModal] = useState<{
    subjectName: string;
    usages: ConflictUsages;
  } | null>(null);

  const fetchSubjects = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const res = await fetch("/api/subjects");
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.success) {
        throw new Error(json?.error || "Không thể tải danh sách môn học.");
      }
      setSubjects(Array.isArray(json.subjects) ? json.subjects : []);
    } catch (err: any) {
      setErrorMessage(err.message || "Lỗi tải danh sách môn học.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSubjects();
  }, [fetchSubjects]);

  const openCreateModal = () => {
    setEditingSubject(null);
    setFormName("");
    setFormIcon("book-open");
    setFormColor(COLOR_PRESETS[0].value);
    setFormMode("SIMPLE");
    setFormError(null);
    setShowModal(true);
  };

  const openEditModal = (subj: SubjectItem) => {
    setEditingSubject(subj);
    setFormName(subj.name);
    setFormIcon(subj.icon || "book-open");
    setFormColor(subj.color || COLOR_PRESETS[0].value);
    setFormMode(subj.mode || "SIMPLE");
    setFormError(null);
    setShowModal(true);
  };

  const handleSaveSubject = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = formName.trim();
    if (!cleanName) {
      setFormError("Vui lòng nhập tên môn học.");
      return;
    }

    setIsSubmitting(true);
    setFormError(null);
    try {
      const payload: Record<string, unknown> = {
        name: cleanName,
        icon: formIcon,
        color: formColor,
      };
      if (isAdmin) {
        payload.mode = formMode;
      }

      const url = editingSubject ? `/api/subjects/${editingSubject.id}` : "/api/subjects";
      const method = editingSubject ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json().catch(() => null);

      if (!res.ok || !json?.success) {
        setFormError(json?.error || "Không thể lưu môn học.");
        return;
      }

      setShowModal(false);
      await fetchSubjects();
    } catch (err: any) {
      setFormError(err.message || "Lỗi kết nối máy chủ.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleActive = async (subj: SubjectItem) => {
    setTogglingId(subj.id);
    try {
      const res = await fetch(`/api/subjects/${subj.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_active: !subj.is_active }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.success) {
        alert(json?.error || "Không thể cập nhật trạng thái môn học.");
        return;
      }
      setSubjects((prev) =>
        prev.map((item) =>
          item.id === subj.id ? { ...item, is_active: !subj.is_active } : item
        )
      );
    } catch (err: any) {
      alert(err.message || "Lỗi kết nối khi bật/tắt môn học.");
    } finally {
      setTogglingId(null);
    }
  };

  const handleDeleteSubject = async (subj: SubjectItem) => {
    if (!confirm(`Bạn có chắc chắn muốn xóa môn học "${subj.name}" không?`)) {
      return;
    }

    setDeletingId(subj.id);
    try {
      const res = await fetch(`/api/subjects/${subj.id}`, {
        method: "DELETE",
      });
      const json = await res.json().catch(() => null);

      if (res.status === 409) {
        if (json?.usages) {
          setConflictModal({
            subjectName: subj.name,
            usages: {
              courses: Number(json.usages.courses || 0),
              exams: Number(json.usages.exams || 0),
              lessons: Number(json.usages.lessons || 0),
            },
          });
        } else {
          alert(json?.error || "Không thể xóa môn học này.");
        }
        return;
      }

      if (!res.ok || !json?.success) {
        alert(json?.error || "Lỗi xóa môn học.");
        return;
      }

      setSubjects((prev) => prev.filter((item) => item.id !== subj.id));
    } catch (err: any) {
      alert(err.message || "Lỗi kết nối khi xóa môn học.");
    } finally {
      setDeletingId(null);
    }
  };

  const customSubjectsCount = subjects.filter((s) => s.owner_id !== null).length;

  return (
    <TeacherLayout>
      <div className="max-w-6xl mx-auto space-y-6 font-sans text-ink">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-line shadow-sm">
          <div className="flex items-center space-x-3.5">
            <div className="w-12 h-12 rounded-2xl bg-brand-50 text-brand-600 flex items-center justify-center font-bold shadow-xs">
              <GraduationCap className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-ink font-headline">Môn Học</h1>
              <p className="text-xs text-ink-muted mt-0.5">
                Quản lý danh mục môn học của trung tâm và giáo viên để phân loại khóa học, bài học, đề thi
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={openCreateModal}
            className="inline-flex items-center justify-center px-5 py-2.5 bg-brand-600 hover:bg-brand-700 text-white rounded-xl text-xs font-bold shadow-sm transition-all space-x-2 shrink-0 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Tạo môn</span>
          </button>
        </div>

        {/* Loading State */}
        {isLoading && (
          <div className="bg-white p-12 rounded-2xl border border-line shadow-sm flex flex-col items-center justify-center text-center space-y-3">
            <Loader2 className="w-8 h-8 animate-spin text-brand-600" />
            <p className="text-xs font-semibold text-ink-muted">Đang tải danh sách môn học...</p>
          </div>
        )}

        {/* Error State */}
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
              type="button"
              onClick={fetchSubjects}
              className="inline-flex items-center px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition-all space-x-1.5 shadow-2xs cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Thử lại</span>
            </button>
          </div>
        )}

        {/* Subject Cards */}
        {!isLoading && !errorMessage && (
          <>
            {customSubjectsCount === 0 && !isAdmin && (
              <div className="bg-white p-6 rounded-2xl border border-dashed border-line flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 rounded-xl bg-brand-50 text-brand-600 flex items-center justify-center shrink-0">
                    <GraduationCap className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-ink">
                      Chưa có môn học riêng — bấm Tạo môn
                    </h3>
                    <p className="text-xs text-ink-muted">
                      Bạn có thể dùng ngay môn hệ thống hoặc tạo thêm các môn học riêng cho lớp của mình.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={openCreateModal}
                  className="px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer"
                >
                  Tạo môn
                </button>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {subjects.map((subj) => {
                const isSystem = subj.owner_id === null;
                const canModify = isAdmin || !isSystem;

                return (
                  <div
                    key={subj.id}
                    className={`bg-white rounded-2xl border transition-all p-5 shadow-2xs flex flex-col justify-between ${
                      subj.is_active
                        ? "border-line hover:border-brand-600"
                        : "border-line/60 opacity-75 bg-surface-alt"
                    }`}
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2 mb-3">
                        <div className="flex items-center space-x-3">
                          <div
                            style={subj.color ? { backgroundColor: subj.color } : undefined}
                            className="w-10 h-10 rounded-xl bg-brand-600 text-white flex items-center justify-center shrink-0 shadow-2xs"
                          >
                            {renderSubjectIcon(subj.icon)}
                          </div>
                          <div>
                            <h3 className="text-sm font-bold text-ink">{subj.name}</h3>
                            <span className="text-[11px] text-ink-muted font-mono">{subj.code}</span>
                          </div>
                        </div>

                        <div className="flex items-center space-x-1.5 shrink-0">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                              isSystem
                                ? "bg-brand-50 text-brand-600 border-line"
                                : "bg-surface-alt text-ink-muted border-line"
                            }`}
                          >
                            {isSystem ? "Hệ thống" : "Của tôi"}
                          </span>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 mt-3">
                        <span className="px-2 py-0.5 rounded-md bg-surface-alt border border-line text-[10px] font-semibold text-ink-muted">
                          Chế độ: {subj.mode === "LANGUAGE" ? "Ngôn ngữ (4 kỹ năng)" : "Cơ bản (SIMPLE)"}
                        </span>
                        <span className="px-2 py-0.5 rounded-md bg-brand-50 text-brand-600 text-[10px] font-bold">
                          Đang dùng: {subj.usage_count}
                        </span>
                      </div>
                    </div>

                    <div className="pt-4 mt-4 border-t border-line/40 flex items-center justify-between">
                      {canModify ? (
                        <>
                          <button
                            type="button"
                            disabled={togglingId === subj.id}
                            onClick={() => handleToggleActive(subj)}
                            className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition-all cursor-pointer ${
                              subj.is_active
                                ? "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100"
                                : "bg-surface-alt text-ink-muted border-line hover:bg-brand-50"
                            }`}
                          >
                            {togglingId === subj.id
                              ? "Đang lưu..."
                              : subj.is_active
                              ? "Đang bật"
                              : "Đang tắt"}
                          </button>

                          <div className="flex items-center space-x-1">
                            <button
                              type="button"
                              onClick={() => openEditModal(subj)}
                              className="p-1.5 text-ink-muted hover:text-brand-600 hover:bg-brand-50 rounded-lg transition-colors cursor-pointer"
                              title="Chỉnh sửa môn học"
                            >
                              <Pencil className="w-4 h-4" />
                            </button>
                            {subj.id !== "english" && (
                              <button
                                type="button"
                                disabled={deletingId === subj.id}
                                onClick={() => handleDeleteSubject(subj)}
                                className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg transition-colors disabled:opacity-40 cursor-pointer"
                                title="Xóa môn học"
                              >
                                {deletingId === subj.id ? (
                                  <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                  <Trash2 className="w-4 h-4" />
                                )}
                              </button>
                            )}
                          </div>
                        </>
                      ) : (
                        <span className="text-[11px] text-ink-subtle italic">
                          Môn hệ thống (chỉ xem)
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}

        {/* Create / Edit Modal */}
        {showModal && (
          <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-line space-y-5">
              <div className="flex items-center justify-between border-b border-line/40 pb-3">
                <h2 className="text-base font-bold text-ink">
                  {editingSubject ? "Chỉnh sửa môn học" : "Tạo môn học mới"}
                </h2>
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="text-ink-subtle hover:text-ink"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSaveSubject} className="space-y-4">
                {formError && (
                  <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs font-bold text-rose-700">
                    {formError}
                  </div>
                )}

                <div>
                  <label className="block text-xs font-bold text-ink mb-1">
                    Tên môn học (*)
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={100}
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    placeholder="Ví dụ: Toán lớp 5, Vật lý đại cương..."
                    className="w-full px-3.5 py-2.5 bg-surface-alt border border-line rounded-xl text-xs font-bold text-ink focus:outline-none focus:border-brand-600"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-ink mb-1.5">
                    Biểu tượng
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {ICON_OPTIONS.map(({ key, label, Icon }) => {
                      const active = formIcon === key;
                      return (
                        <button
                          key={key}
                          type="button"
                          onClick={() => setFormIcon(key)}
                          className={`flex items-center space-x-2 p-2 rounded-xl border text-xs font-semibold transition-all cursor-pointer ${
                            active
                              ? "border-brand-600 bg-brand-50 text-brand-600"
                              : "border-line bg-surface-alt text-ink-muted hover:border-brand-600"
                          }`}
                        >
                          <Icon className="w-4 h-4 shrink-0" />
                          <span className="truncate">{label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-ink mb-1.5">
                    Màu sắc nhận diện
                  </label>
                  <div className="flex flex-wrap gap-2.5">
                    {COLOR_PRESETS.map((preset) => {
                      const active = formColor === preset.value;
                      return (
                        <button
                          key={preset.value}
                          type="button"
                          onClick={() => setFormColor(preset.value)}
                          title={preset.label}
                          className={`w-8 h-8 rounded-full flex items-center justify-center border-2 transition-all cursor-pointer ${
                            preset.dotClass
                          } ${active ? "border-ink scale-110 shadow-sm" : "border-transparent opacity-80 hover:opacity-100"}`}
                        >
                          {active && <Check className="w-4 h-4 text-white" />}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {isAdmin && (
                  <div>
                    <label className="block text-xs font-bold text-ink mb-1">
                      Chế độ môn học (ADMIN)
                    </label>
                    <select
                      value={formMode}
                      onChange={(e) => setFormMode(e.target.value as "LANGUAGE" | "SIMPLE")}
                      className="w-full px-3.5 py-2.5 bg-surface-alt border border-line rounded-xl text-xs font-bold text-ink focus:outline-none focus:border-brand-600"
                    >
                      <option value="SIMPLE">SIMPLE — Trắc nghiệm / Cơ bản</option>
                      <option value="LANGUAGE">LANGUAGE — Ngôn ngữ 4 kỹ năng</option>
                    </select>
                  </div>
                )}

                <div className="pt-2 flex justify-end space-x-2">
                  <button
                    type="button"
                    onClick={() => setShowModal(false)}
                    className="px-4 py-2.5 border border-line text-ink-muted rounded-xl text-xs font-bold hover:bg-surface-alt"
                  >
                    Hủy
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="px-5 py-2.5 bg-brand-600 hover:bg-brand-700 text-white rounded-xl text-xs font-bold shadow-xs flex items-center space-x-1.5 disabled:opacity-50 cursor-pointer"
                  >
                    {isSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    <span>{editingSubject ? "Lưu thay đổi" : "Tạo môn"}</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* 409 Conflict Dialog */}
        {conflictModal && (
          <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-rose-300 space-y-4">
              <div className="flex items-start space-x-3">
                <div className="w-10 h-10 rounded-xl bg-rose-100 text-rose-600 flex items-center justify-center shrink-0">
                  <AlertCircle className="w-5 h-5" />
                </div>
                <div className="flex-1">
                  <h3 className="text-sm font-bold text-ink">
                    Không thể xóa môn &ldquo;{conflictModal.subjectName}&rdquo;
                  </h3>
                  <p className="text-xs text-ink-muted mt-1 leading-relaxed">
                    Môn đang được dùng: {conflictModal.usages.courses} khoá, {conflictModal.usages.exams} đề, {conflictModal.usages.lessons} bài học
                  </p>
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="button"
                  onClick={() => setConflictModal(null)}
                  className="px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer"
                >
                  Đã hiểu
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </TeacherLayout>
  );
}
