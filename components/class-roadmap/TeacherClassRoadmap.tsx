"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Route,
  BookOpen,
  FileText,
  Folder,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Save,
  Calendar,
  Lock,
  Unlock,
  Users,
  Award,
  ChevronRight,
  ShieldAlert,
} from "lucide-react";

interface TeacherClassRoadmapProps {
  classId: string;
}

interface ClassInfo {
  id: string;
  name: string;
  code: string;
  teacher_id: string;
  course_id: string | null;
  unlock_mode: "MANUAL" | "ALL_OPEN" | "SEQUENTIAL";
  pass_percent: number;
}

interface CourseOption {
  id: string;
  title: string;
  description?: string;
}

interface RoadmapItem {
  id: string;
  parent_id: string | null;
  type: string; // "UNIT" | "LESSON" | "EXAM"
  title: string;
  order_index: number;
  lesson_id?: string | null;
  exam_id?: string | null;
}

interface UnlockEntry {
  class_id: string;
  curriculum_item_id: string;
  student_id: string | null;
  due_date: string | null;
  unlocked_by?: string;
  unlocked_at?: string;
}

interface ProgressStudent {
  id: string;
  name: string;
}

interface ProgressItem {
  id: string;
  title: string;
  type: string;
}

interface ProgressCell {
  best_percent?: number | null;
  attempts?: number;
  completed?: boolean;
}

interface ProgressData {
  students: ProgressStudent[];
  items: ProgressItem[];
  cells: Record<string, Record<string, ProgressCell>>;
}

export default function TeacherClassRoadmap({ classId }: TeacherClassRoadmapProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Core data
  const [classInfo, setClassInfo] = useState<ClassInfo | null>(null);
  const [courses, setCourses] = useState<CourseOption[]>([]);
  const [items, setItems] = useState<RoadmapItem[]>([]);
  const [unlocks, setUnlocks] = useState<UnlockEntry[]>([]);
  const [progress, setProgress] = useState<ProgressData | null>(null);

  // Settings form state
  const [selectedCourseId, setSelectedCourseId] = useState<string>("");
  const [unlockMode, setUnlockMode] = useState<"MANUAL" | "ALL_OPEN" | "SEQUENTIAL">("MANUAL");
  const [passPercent, setPassPercent] = useState<number>(70);
  const [savingSettings, setSavingSettings] = useState(false);

  // Due date inputs per item for MANUAL mode
  const [dueDates, setDueDates] = useState<Record<string, string>>({});
  const [togglingItems, setTogglingItems] = useState<Record<string, boolean>>({});
  const [individualUnlocking, setIndividualUnlocking] = useState<Record<string, boolean>>({});

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [roadmapRes, coursesRes] = await Promise.all([
        fetch(`/api/teacher/classes/${classId}/roadmap`),
        fetch("/api/teacher/courses"),
      ]);

      if (!roadmapRes.ok) {
        const j = await roadmapRes.json().catch(() => ({}));
        throw new Error(j.error || "Không thể tải dữ liệu lộ trình lớp.");
      }
      if (!coursesRes.ok) {
        const j = await coursesRes.json().catch(() => ({}));
        throw new Error(j.error || "Không thể tải danh sách khóa học.");
      }

      const roadmapData = await roadmapRes.json();
      const coursesData = await coursesRes.json();

      const cls: ClassInfo = roadmapData.class;
      setClassInfo(cls);
      setCourses(coursesData.courses || []);
      setItems(roadmapData.items || []);
      setUnlocks(roadmapData.unlocks || []);

      setSelectedCourseId(cls.course_id || "");
      setUnlockMode(cls.unlock_mode || "MANUAL");
      setPassPercent(cls.pass_percent ?? 70);

      // Populate due dates
      const datesMap: Record<string, string> = {};
      (roadmapData.unlocks || []).forEach((u: UnlockEntry) => {
        if (!u.student_id && u.due_date) {
          datesMap[u.curriculum_item_id] = u.due_date.slice(0, 10);
        }
      });
      setDueDates(datesMap);

      // If course is assigned, also fetch progress
      if (cls.course_id) {
        const progRes = await fetch(`/api/teacher/classes/${classId}/progress`);
        if (progRes.ok) {
          const progData = await progRes.json();
          setProgress({
            students: progData.students || [],
            items: progData.items || [],
            cells: progData.cells || {},
          });
        }
      } else {
        setProgress(null);
      }
    } catch (err: any) {
      console.error("Lỗi nạp dữ liệu lộ trình:", err);
      setError(err.message || "Đã xảy ra lỗi khi tải dữ liệu.");
    } finally {
      setLoading(false);
    }
  }, [classId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!classInfo) return;

    setSavingSettings(true);
    setError(null);
    try {
      const body: Record<string, any> = {};

      const currentCourseId = classInfo.course_id || "";
      if (selectedCourseId !== currentCourseId) {
        body.course_id = selectedCourseId ? selectedCourseId : null;
      }
      if (unlockMode !== classInfo.unlock_mode) {
        body.unlock_mode = unlockMode;
      }
      if (passPercent !== classInfo.pass_percent) {
        body.pass_percent = Number(passPercent);
      }

      if (Object.keys(body).length === 0) {
        setSuccessMsg("Cài đặt chưa có thay đổi nào.");
        setTimeout(() => setSuccessMsg(null), 3000);
        return;
      }

      const res = await fetch(`/api/teacher/classes/${classId}/settings`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Không thể cập nhật cài đặt lộ trình.");
      }

      setSuccessMsg("Đã lưu cài đặt lộ trình thành công!");
      setTimeout(() => setSuccessMsg(null), 4000);
      await loadData();
    } catch (err: any) {
      console.error("Lỗi lưu cài đặt:", err);
      setError(err.message || "Lỗi cập nhật cài đặt.");
    } finally {
      setSavingSettings(false);
    }
  };

  const handleToggleUnlock = async (item: RoadmapItem) => {
    const isUnlocked = unlocks.some(
      (u) => u.curriculum_item_id === item.id && (u.student_id === null || u.student_id === undefined)
    );

    setTogglingItems((prev) => ({ ...prev, [item.id]: true }));
    setError(null);

    try {
      if (isUnlocked) {
        // Tắt -> DELETE
        const res = await fetch(`/api/teacher/classes/${classId}/unlocks?curriculum_item_id=${item.id}`, {
          method: "DELETE",
        });
        const data = await res.json();
        if (!res.ok || !data.success) {
          throw new Error(data.error || "Không thể khoá mục này.");
        }
        // Cập nhật tại chỗ
        setUnlocks((prev) =>
          prev.filter(
            (u) => !(u.curriculum_item_id === item.id && (u.student_id === null || u.student_id === undefined))
          )
        );
      } else {
        // Bật -> POST
        const dateVal = dueDates[item.id];
        const res = await fetch(`/api/teacher/classes/${classId}/unlocks`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            curriculum_item_id: item.id,
            due_date: dateVal ? new Date(dateVal).toISOString() : null,
          }),
        });
        const data = await res.json();
        if (!res.ok || !data.success) {
          throw new Error(data.error || "Không thể mở mục này.");
        }
        // Cập nhật tại chỗ
        setUnlocks((prev) => {
          const filtered = prev.filter(
            (u) => !(u.curriculum_item_id === item.id && (u.student_id === null || u.student_id === undefined))
          );
          return [...filtered, data.unlock];
        });
      }
    } catch (err: any) {
      console.error("Lỗi toggle mở/khoá mục:", err);
      setError(err.message || "Lỗi thao tác mở/khoá.");
    } finally {
      setTogglingItems((prev) => ({ ...prev, [item.id]: false }));
    }
  };

  const handleDueDateChange = async (itemId: string, newDate: string) => {
    setDueDates((prev) => ({ ...prev, [itemId]: newDate }));

    const isUnlocked = unlocks.some(
      (u) => u.curriculum_item_id === itemId && (u.student_id === null || u.student_id === undefined)
    );

    if (isUnlocked) {
      try {
        const res = await fetch(`/api/teacher/classes/${classId}/unlocks`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            curriculum_item_id: itemId,
            due_date: newDate ? new Date(newDate).toISOString() : null,
          }),
        });
        const data = await res.json();
        if (data.success && data.unlock) {
          setUnlocks((prev) => {
            const filtered = prev.filter(
              (u) => !(u.curriculum_item_id === itemId && (u.student_id === null || u.student_id === undefined))
            );
            return [...filtered, data.unlock];
          });
        }
      } catch (err) {
        console.error("Lỗi cập nhật due_date:", err);
      }
    }
  };

  const handleUnlockForStudent = async (curriculumItemId: string, studentId: string) => {
    const key = `${curriculumItemId}_${studentId}`;
    setIndividualUnlocking((prev) => ({ ...prev, [key]: true }));
    setError(null);

    try {
      const res = await fetch(`/api/teacher/classes/${classId}/unlocks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          curriculum_item_id: curriculumItemId,
          student_id: studentId,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Không thể mở riêng cho học sinh.");
      }

      setUnlocks((prev) => [...prev, data.unlock]);
      setSuccessMsg("Đã mở riêng mục cho học sinh thành công!");
      setTimeout(() => setSuccessMsg(null), 3000);

      // Nạp lại progress để hiển thị trạng thái mới
      const progRes = await fetch(`/api/teacher/classes/${classId}/progress`);
      if (progRes.ok) {
        const progData = await progRes.json();
        setProgress({
          students: progData.students || [],
          items: progData.items || [],
          cells: progData.cells || {},
        });
      }
    } catch (err: any) {
      console.error("Lỗi mở riêng học sinh:", err);
      setError(err.message || "Lỗi mở riêng cho học sinh.");
    } finally {
      setIndividualUnlocking((prev) => ({ ...prev, [key]: false }));
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-12 bg-white rounded-2xl border border-line space-y-3">
        <Loader2 className="w-6 h-6 animate-spin text-brand-600" />
        <span className="text-xs font-medium text-ink-muted">
          Đang tải dữ liệu lộ trình lớp học...
        </span>
      </div>
    );
  }

  return (
    <div className="space-y-8 font-sans text-ink">
      {/* Thông báo lỗi & nút Thử lại */}
      {error && (
        <div className="p-4 rounded-2xl bg-red-50 border border-red-200 text-red-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center space-x-2">
            <AlertCircle className="w-5 h-5 text-red-600 shrink-0" />
            <span className="text-xs font-bold">{error}</span>
          </div>
          <button
            onClick={loadData}
            className="px-4 py-1.5 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-xl transition-all cursor-pointer shrink-0 font-headline"
          >
            Thử lại
          </button>
        </div>
      )}

      {/* Thông báo thành công */}
      {successMsg && (
        <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 flex items-center space-x-2">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          <span className="text-xs font-bold">{successMsg}</span>
        </div>
      )}

      {/* KHỐI CÀI ĐẶT LỘ TRÌNH LỚP */}
      <section className="bg-white p-6 rounded-3xl border border-line shadow-sm space-y-6">
        <div className="border-b border-line/40 pb-4 flex justify-between items-center">
          <div>
            <h2 className="text-lg font-bold text-brand-600 flex items-center space-x-2 font-headline">
              <Route className="w-5 h-5 text-brand-600" />
              <span>Cài Đặt Lộ Trình Lớp Học</span>
            </h2>
            <p className="text-xs text-ink-muted mt-0.5">
              Gắn khóa học, thiết lập quy tắc mở bài và điều kiện hoàn thành cho học sinh lớp này.
            </p>
          </div>
        </div>

        <form onSubmit={handleSaveSettings} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* 1. Chọn Khóa học */}
            <div>
              <label className="block text-xs font-bold uppercase text-brand-600 mb-2">
                Khóa học áp dụng cho lớp
              </label>
              <select
                value={selectedCourseId}
                onChange={(e) => setSelectedCourseId(e.target.value)}
                className="w-full p-3 bg-surface-alt border border-line rounded-xl text-xs font-medium text-ink focus:outline-none focus:border-brand-600"
              >
                <option value="">— Chưa gắn —</option>
                {courses.map((course) => (
                  <option key={course.id} value={course.id}>
                    {course.title}
                  </option>
                ))}
              </select>
            </div>

            {/* 2. Ngưỡng hoàn thành pass_percent */}
            <div>
              <label className="block text-xs font-bold uppercase text-brand-600 mb-2 flex items-center justify-between">
                <span>Ngưỡng hoàn thành bài học (pass_percent %)</span>
                {unlockMode !== "SEQUENTIAL" && (
                  <span className="text-[11px] font-normal text-ink-subtle lowercase">
                    (chỉ kích hoạt ở chế độ Tuần tự)
                  </span>
                )}
              </label>
              <div className="relative">
                <input
                  type="number"
                  min="1"
                  max="100"
                  value={passPercent}
                  onChange={(e) => setPassPercent(Number(e.target.value))}
                  disabled={unlockMode !== "SEQUENTIAL"}
                  className="w-full p-3 bg-surface-alt border border-line rounded-xl text-xs font-bold text-ink focus:outline-none focus:border-brand-600 disabled:opacity-50 disabled:bg-neutral-100"
                />
                <span className="absolute right-4 top-3 text-xs font-bold text-ink-subtle">%</span>
              </div>
            </div>
          </div>

          {/* 3. Chế độ mở bài unlock_mode */}
          <div>
            <label className="block text-xs font-bold uppercase text-brand-600 mb-2">
              Chế độ mở bài (Unlock Mode)
            </label>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {/* MANUAL */}
              <label
                className={`p-4 rounded-2xl border-2 cursor-pointer transition-all flex flex-col justify-between ${
                  unlockMode === "MANUAL"
                    ? "border-brand-600 bg-surface-alt shadow-sm"
                    : "border-line/60 bg-white hover:bg-surface-alt"
                }`}
              >
                <div className="flex items-center space-x-2 mb-1">
                  <input
                    type="radio"
                    name="unlock_mode"
                    value="MANUAL"
                    checked={unlockMode === "MANUAL"}
                    onChange={() => setUnlockMode("MANUAL")}
                    className="accent-brand-600"
                  />
                  <span className="text-xs font-bold font-headline text-ink">MANUAL</span>
                </div>
                <p className="text-[11px] text-ink-muted">Giáo viên mở từng mục</p>
              </label>

              {/* ALL_OPEN */}
              <label
                className={`p-4 rounded-2xl border-2 cursor-pointer transition-all flex flex-col justify-between ${
                  unlockMode === "ALL_OPEN"
                    ? "border-brand-600 bg-surface-alt shadow-sm"
                    : "border-line/60 bg-white hover:bg-surface-alt"
                }`}
              >
                <div className="flex items-center space-x-2 mb-1">
                  <input
                    type="radio"
                    name="unlock_mode"
                    value="ALL_OPEN"
                    checked={unlockMode === "ALL_OPEN"}
                    onChange={() => setUnlockMode("ALL_OPEN")}
                    className="accent-brand-600"
                  />
                  <span className="text-xs font-bold font-headline text-ink">ALL_OPEN</span>
                </div>
                <p className="text-[11px] text-ink-muted">Mở tất cả</p>
              </label>

              {/* SEQUENTIAL */}
              <label
                className={`p-4 rounded-2xl border-2 cursor-pointer transition-all flex flex-col justify-between ${
                  unlockMode === "SEQUENTIAL"
                    ? "border-brand-600 bg-surface-alt shadow-sm"
                    : "border-line/60 bg-white hover:bg-surface-alt"
                }`}
              >
                <div className="flex items-center space-x-2 mb-1">
                  <input
                    type="radio"
                    name="unlock_mode"
                    value="SEQUENTIAL"
                    checked={unlockMode === "SEQUENTIAL"}
                    onChange={() => setUnlockMode("SEQUENTIAL")}
                    className="accent-brand-600"
                  />
                  <span className="text-xs font-bold font-headline text-ink">SEQUENTIAL</span>
                </div>
                <p className="text-[11px] text-ink-muted">
                  Tuần tự — hoàn thành mục trước mới mở mục sau
                </p>
              </label>
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={savingSettings}
              className="px-6 py-2.5 bg-brand-600 hover:bg-brand-700 text-white rounded-xl text-xs font-bold shadow flex items-center space-x-2 disabled:opacity-50 transition-all cursor-pointer font-headline"
            >
              {savingSettings ? (
                <Loader2 className="w-4 h-4 animate-spin text-white" />
              ) : (
                <Save className="w-4 h-4 text-accent-400" />
              )}
              <span>Lưu cài đặt</span>
            </button>
          </div>
        </form>
      </section>

      {/* CÂY LỘ TRÌNH LỚP */}
      <section className="bg-white p-6 rounded-3xl border border-line shadow-sm space-y-6">
        <div className="border-b border-line/40 pb-4 flex justify-between items-center">
          <div>
            <h2 className="text-lg font-bold text-brand-600 flex items-center space-x-2 font-headline">
              <BookOpen className="w-5 h-5 text-brand-600" />
              <span>Danh Sách Mục &amp; Lộ Trình Khóa Học</span>
            </h2>
            <p className="text-xs text-ink-muted mt-0.5">
              {unlockMode === "MANUAL"
                ? "Chế độ Thủ công: Bật/tắt công tắc để mở bài cho cả lớp và đặt hạn nộp (tuỳ chọn)."
                : unlockMode === "ALL_OPEN"
                ? "Chế độ Mở tất cả: Mọi bài học và đề thi đều được mở tự động cho học sinh."
                : "Chế độ Tuần tự: Học sinh hoàn thành từng mục đạt ngưỡng pass_percent để mở bài kế tiếp."}
            </p>
          </div>
        </div>

        {/* Trạng thái rỗng */}
        {!classInfo?.course_id ? (
          <div className="p-10 text-center bg-surface-alt rounded-2xl border border-line space-y-2">
            <AlertCircle className="w-8 h-8 text-brand-600 mx-auto opacity-60" />
            <p className="text-xs font-bold text-ink">
              Lớp chưa gắn khóa học. Chọn khóa học ở trên để bắt đầu.
            </p>
          </div>
        ) : items.length === 0 ? (
          <div className="p-10 text-center bg-surface-alt rounded-2xl border border-line space-y-2">
            <BookOpen className="w-8 h-8 text-brand-600 mx-auto opacity-60" />
            <p className="text-xs font-bold text-ink">Khóa học chưa có lộ trình.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {items.map((item) => {
              const isChild = Boolean(item.parent_id);
              const classUnlock = unlocks.find(
                (u) =>
                  u.curriculum_item_id === item.id &&
                  (u.student_id === null || u.student_id === undefined)
              );
              const isUnlocked = Boolean(classUnlock);
              const dueDate = dueDates[item.id] || "";
              const isToggling = togglingItems[item.id] || false;

              return (
                <div
                  key={item.id}
                  className={`p-4 rounded-2xl border transition-all flex flex-col md:flex-row md:items-center justify-between gap-4 ${
                    isChild
                      ? "ml-6 md:ml-10 bg-white border-line/60"
                      : "bg-surface-alt border-line shadow-xs"
                  }`}
                >
                  <div className="flex items-center space-x-3">
                    <div className="shrink-0">
                      {item.type === "UNIT" ? (
                        <Folder className="w-5 h-5 text-brand-600" />
                      ) : item.type === "LESSON" ? (
                        <BookOpen className="w-5 h-5 text-amber-700" />
                      ) : (
                        <FileText className="w-5 h-5 text-indigo-700" />
                      )}
                    </div>

                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="px-2 py-0.5 rounded-md bg-white border border-line text-[10px] font-mono font-bold uppercase text-brand-600">
                          {item.type === "UNIT"
                            ? "Unit"
                            : item.type === "LESSON"
                            ? "Bài học"
                            : "Đề thi"}
                        </span>
                        <h3 className="text-xs font-bold text-ink font-headline">
                          {item.title}
                        </h3>
                      </div>
                    </div>
                  </div>

                  {/* Hành động ở MANUAL vs ALL_OPEN / SEQUENTIAL */}
                  <div className="flex items-center space-x-4 shrink-0">
                    {unlockMode === "MANUAL" ? (
                      <div className="flex items-center space-x-4">
                        {/* Input hạn do_date */}
                        <div className="flex items-center space-x-2">
                          <Calendar className="w-4 h-4 text-ink-subtle" />
                          <input
                            type="date"
                            value={dueDate}
                            onChange={(e) => handleDueDateChange(item.id, e.target.value)}
                            placeholder="Hạn nộp (due_date)"
                            className="p-1.5 bg-white border border-line rounded-lg text-xs text-ink focus:outline-none focus:border-brand-600"
                          />
                        </div>

                        {/* Công tắc Mở cho cả lớp */}
                        <button
                          type="button"
                          disabled={isToggling}
                          onClick={() => handleToggleUnlock(item)}
                          className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center space-x-1.5 cursor-pointer disabled:opacity-50 ${
                            isUnlocked
                              ? "bg-emerald-600 text-white hover:bg-emerald-700 shadow-xs"
                              : "bg-line-soft text-ink-muted hover:bg-line-soft"
                          }`}
                        >
                          {isToggling ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : isUnlocked ? (
                            <Unlock className="w-3.5 h-3.5 text-white" />
                          ) : (
                            <Lock className="w-3.5 h-3.5 text-ink-muted" />
                          )}
                          <span>{isUnlocked ? "Đang mở cả lớp" : "Mở cho cả lớp"}</span>
                        </button>
                      </div>
                    ) : (
                      <span className="text-[11px] italic text-ink-subtle font-medium">
                        {unlockMode === "ALL_OPEN"
                          ? "Mở tự động theo chế độ ALL_OPEN"
                          : "Mở tự động theo chế độ SEQUENTIAL"}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* BẢNG TIẾN ĐỘ HỌC SINH */}
      {classInfo?.course_id && progress && progress.students.length > 0 && (
        <section className="bg-white p-6 rounded-3xl border border-line shadow-sm space-y-6">
          <div className="border-b border-line/40 pb-4">
            <h2 className="text-lg font-bold text-brand-600 flex items-center space-x-2 font-headline">
              <Users className="w-5 h-5 text-brand-600" />
              <span>Bảng Tiến Độ Học Sinh Theo Mục Lộ Trình</span>
            </h2>
            <p className="text-xs text-ink-muted mt-0.5">
              Theo dõi kết quả điểm cao nhất và mở riêng từng mục cho học sinh cần ngoại lệ (DEC-008).
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-surface-alt border-b border-line text-ink-muted">
                  <th className="p-3.5 font-bold border-r border-line/40 min-w-[180px]">
                    Học sinh
                  </th>
                  {progress.items.map((it) => (
                    <th
                      key={it.id}
                      className="p-3.5 font-bold text-center border-r border-line/40 min-w-[160px]"
                    >
                      <div className="font-headline text-brand-600 truncate" title={it.title}>
                        {it.title}
                      </div>
                      <span className="text-[10px] font-mono text-ink-subtle uppercase">
                        {it.type === "LESSON" ? "Bài học" : it.type === "EXAM" ? "Đề thi" : it.type}
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-line/40">
                {progress.students.map((st) => (
                  <tr key={st.id} className="hover:bg-surface-alt transition-colors">
                    <td className="p-3.5 font-bold border-r border-line/40 text-ink">
                      {st.name}
                    </td>
                    {progress.items.map((it) => {
                      const cell = progress.cells[st.id]?.[it.id];
                      const isCompleted = Boolean(cell?.completed);
                      const key = `${it.id}_${st.id}`;
                      const isUnlockingIndividual = individualUnlocking[key] || false;
                      const hasIndividualUnlock = unlocks.some(
                        (u) => u.curriculum_item_id === it.id && u.student_id === st.id
                      );

                      return (
                        <td
                          key={it.id}
                          className={`p-3 text-center border-r border-line/40 transition-colors ${
                            isCompleted ? "bg-emerald-50 text-emerald-800" : ""
                          }`}
                        >
                          <div className="flex flex-col items-center justify-center space-y-1">
                            {it.type === "LESSON" ? (
                              <span className="font-bold font-mono">
                                {cell?.best_percent != null ? `${cell.best_percent}%` : "—"}
                              </span>
                            ) : (
                              <span className="font-bold">
                                {isCompleted ? (
                                  <span className="text-emerald-700">✓ Hoàn thành</span>
                                ) : (
                                  <span className="text-ink-subtle">—</span>
                                )}
                              </span>
                            )}

                            {/* Ở SEQUENTIAL: Nút Mở riêng nếu chưa hoàn thành */}
                            {unlockMode === "SEQUENTIAL" && !isCompleted && (
                              <div className="pt-1">
                                {hasIndividualUnlock ? (
                                  <span className="text-[10px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                                    Đã mở riêng
                                  </span>
                                ) : (
                                  <button
                                    type="button"
                                    disabled={isUnlockingIndividual}
                                    onClick={() => handleUnlockForStudent(it.id, st.id)}
                                    className="px-2 py-1 bg-brand-600 hover:bg-brand-700 text-white text-[10px] font-bold rounded-lg transition-all cursor-pointer disabled:opacity-50 font-headline"
                                  >
                                    {isUnlockingIndividual ? "..." : "Mở riêng"}
                                  </button>
                                )}
                              </div>
                            )}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
