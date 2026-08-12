"use client";

import { useState, useEffect, useMemo } from "react";
import TeacherLayout from "@/components/TeacherLayout";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabase";
import {
  PlusCircle,
  Users,
  Copy,
  CheckCircle2,
  Loader2,
  BookOpen,
  X,
  Save,
  Clock,
  Edit3,
  Trash2,
  Layers,
} from "lucide-react";

interface ClassRoom {
  id: string;
  name: string;
  code: string;
  teacher_id: string;
  max_slots: number;
  schedule: string;
  status: "ACTIVE" | "COMPLETED" | "UPCOMING";
  description?: string;
  student_count?: number;
}

// Helpers for encoding status in schedule string without schema errors
function encodeScheduleWithStatus(rawSchedule: string, status: "ACTIVE" | "COMPLETED" | "UPCOMING"): string {
  const cleanSched = (rawSchedule || "").replace(/\s*\[STATUS:(ACTIVE|COMPLETED|UPCOMING)\]/gi, "").trim();
  if (status === "ACTIVE") return cleanSched;
  return `${cleanSched} [STATUS:${status}]`;
}

function parseScheduleAndStatus(fullSchedule?: string): { schedule: string; status: "ACTIVE" | "COMPLETED" | "UPCOMING" } {
  if (!fullSchedule) return { schedule: "Thứ 2 - Thứ 4 - Thứ 6 (18:00 - 20:00)", status: "ACTIVE" };
  const match = fullSchedule.match(/\[STATUS:(ACTIVE|COMPLETED|UPCOMING)\]/i);
  const status = (match ? match[1].toUpperCase() : "ACTIVE") as "ACTIVE" | "COMPLETED" | "UPCOMING";
  const cleanSched = fullSchedule.replace(/\s*\[STATUS:(ACTIVE|COMPLETED|UPCOMING)\]/gi, "").trim();
  return { schedule: cleanSched, status };
}

export default function TeacherClassesPage() {
  const { user } = useAuth();
  const [classes, setClasses] = useState<ClassRoom[]>([]);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Status Filter Tab
  const [statusTab, setStatusTab] = useState<"ALL" | "ACTIVE" | "COMPLETED" | "UPCOMING">("ALL");

  // Create Modal State
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [className, setClassName] = useState("");
  const [schedule, setSchedule] = useState("Thứ 2 - Thứ 4 - Thứ 6 (18:00 - 20:00)");
  const [createStatus, setCreateStatus] = useState<"ACTIVE" | "COMPLETED" | "UPCOMING">("ACTIVE");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Edit Modal State
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingClass, setEditingClass] = useState<ClassRoom | null>(null);
  const [editName, setEditName] = useState("");
  const [editCode, setEditCode] = useState("");
  const [editSchedule, setEditSchedule] = useState("");
  const [editMaxSlots, setEditMaxSlots] = useState(30);
  const [editStatus, setEditStatus] = useState<"ACTIVE" | "COMPLETED" | "UPCOMING">("ACTIVE");
  const [isEditingSubmitting, setIsEditingSubmitting] = useState(false);

  const fetchClasses = async () => {
    if (!user) return;
    try {
      setLoading(true);
      // 1. Fetch Classes
      const { data: clsData, error } = await supabase
        .from("classes")
        .select("*")
        .eq("teacher_id", user.id)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Classes load error:", error);
        return;
      }

      // 2. Fetch Enrollments headcount
      const { data: enrData } = await supabase.from("enrollments").select("*");
      const classHeadcountMap: Record<string, number> = {};
      if (enrData) {
        enrData.forEach((e: any) => {
          classHeadcountMap[e.class_id] = (classHeadcountMap[e.class_id] || 0) + 1;
        });
      }

      const formatted: ClassRoom[] = (clsData || []).map((row: any) => {
        const { schedule: cleanSched, status: parsedStatus } = parseScheduleAndStatus(row.schedule);
        return {
          id: row.id,
          name: row.name,
          code: row.code,
          teacher_id: row.teacher_id,
          max_slots: Number(row.max_slots) || 30,
          schedule: cleanSched,
          status: parsedStatus,
          description: row.description || "Lớp luyện thi IELTS chuyên sâu target 7.0+, bổ trợ từ vựng & ngữ pháp.",
          student_count: classHeadcountMap[row.id] || 0,
        };
      });

      setClasses(formatted);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      fetchClasses();
    }
  }, [user]);

  const handleCreateClass = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!className.trim() || !user) return;

    setIsSubmitting(true);
    try {
      const classId = `cls_${Date.now().toString().slice(-3)}`;
      const code = `IELTS${Math.floor(1000 + Math.random() * 9000)}`;
      const finalSchedule = encodeScheduleWithStatus(schedule.trim() || "Thứ 2 - Thứ 4 (18:00 - 20:00)", createStatus);

      const { error } = await supabase.from("classes").insert([
        {
          id: classId,
          name: className.trim(),
          code,
          teacher_id: user.id,
          max_slots: 30,
          schedule: finalSchedule,
        },
      ]);

      if (error) {
        console.error("Class creation error:", error.message || error);
        alert("Lỗi khi tạo lớp học: " + (error.message || "Không thể lưu vào CSDL"));
        return;
      }

      // Sync Neo4j teacher manages class
      try {
        const { syncTeacherManagesClass } = await import("@/lib/neo4j");
        await syncTeacherManagesClass(user.id, classId);
      } catch (err) {
        console.warn("Neo4j relationship sync warning:", err);
      }

      setClassName("");
      setShowCreateModal(false);
      fetchClasses();
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const openEditModal = (cls: ClassRoom) => {
    setEditingClass(cls);
    setEditName(cls.name);
    setEditCode(cls.code);
    setEditSchedule(cls.schedule);
    setEditMaxSlots(cls.max_slots);
    setEditStatus(cls.status);
    setShowEditModal(true);
  };

  const handleUpdateClass = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingClass || !editName.trim()) return;

    setIsEditingSubmitting(true);
    try {
      const finalSchedule = encodeScheduleWithStatus(editSchedule.trim(), editStatus);

      const { error } = await supabase
        .from("classes")
        .update({
          name: editName.trim(),
          code: editCode.trim(),
          schedule: finalSchedule,
          max_slots: Number(editMaxSlots) || 30,
        })
        .eq("id", editingClass.id);

      if (error) {
        alert("Lỗi cập nhật lớp học: " + error.message);
        return;
      }

      setShowEditModal(false);
      fetchClasses();
    } catch (err) {
      console.error(err);
    } finally {
      setIsEditingSubmitting(false);
    }
  };

  const handleDeleteClass = async (classId: string, className: string) => {
    if (!confirm(`Bạn có chắc chắn muốn xóa lớp học "${className}" không?\nLưu ý: Thao tác này sẽ giải tán lớp học khỏi hệ thống.`)) return;

    try {
      const { error } = await supabase.from("classes").delete().eq("id", classId);
      if (error) {
        alert("Lỗi xóa lớp học: " + error.message);
        return;
      }
      fetchClasses();
    } catch (err) {
      console.error(err);
    }
  };

  const copyInviteLink = (code: string) => {
    const inviteUrl = `${window.location.origin}/join/${code}`;
    navigator.clipboard.writeText(inviteUrl);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2500);
  };

  const filteredClasses = useMemo(() => {
    if (statusTab === "ALL") return classes;
    return classes.filter((c) => c.status === statusTab);
  }, [classes, statusTab]);

  const getStatusBadge = (st: "ACTIVE" | "COMPLETED" | "UPCOMING") => {
    switch (st) {
      case "ACTIVE":
        return <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-900 border border-emerald-300 font-bold text-[11px] flex items-center gap-1 font-mono">🟢 Đang Diễn Ra</span>;
      case "COMPLETED":
        return <span className="px-2.5 py-0.5 rounded-full bg-rose-100 text-rose-900 border border-rose-300 font-bold text-[11px] flex items-center gap-1 font-mono">🔴 Đã Hoàn Thành</span>;
      case "UPCOMING":
        return <span className="px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-300 font-bold text-[11px] flex items-center gap-1 font-mono">🟡 Sắp Khai Giảng</span>;
    }
  };

  return (
    <TeacherLayout>
      <div className="max-w-[1280px] mx-auto space-y-8 font-sans text-[#211a16]">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#d8c2b6]/40 pb-6">
          <div>
            <div className="flex items-center space-x-2 text-xs text-[#6d3807] uppercase tracking-wider font-bold mb-1">
              <BookOpen className="w-4 h-4 text-[#6d3807]" />
              <span>Teacher Portal &bull; Classrooms & Lifecycle Management</span>
            </div>
            <h1 className="font-headline text-3xl font-bold text-[#211a16] tracking-tight">
              Quản Lý Lớp Học &amp; Danh Sách Học Viên
            </h1>
            <p className="text-sm text-[#52443a] mt-1">
              Quản lý thông tin lớp học, theo dõi sĩ số, cập nhật trạng thái vòng đời lớp học và phân bổ bài thi.
            </p>
          </div>

          <button
            onClick={() => setShowCreateModal(true)}
            className="px-5 py-2.5 bg-[#6d3807] hover:bg-[#8a4f1e] text-white text-xs font-bold rounded-xl shadow transition-all flex items-center space-x-2 shrink-0 cursor-pointer font-headline"
          >
            <PlusCircle className="w-4 h-4 text-[#ffb782]" />
            <span>+ Tạo Lớp Học Mới</span>
          </button>
        </div>

        {/* Lifecycle Status Filter Bar */}
        <div className="flex items-center space-x-2 overflow-x-auto pb-2 border-b border-[#d8c2b6]/40">
          <span className="text-xs font-bold text-[#6d3807] uppercase tracking-wider font-mono mr-2 flex items-center gap-1 shrink-0">
            <Layers className="w-4 h-4" /> Trạng Thái Lớp:
          </span>
          {[
            { id: "ALL", label: "🌐 Tất Cả Lớp" },
            { id: "ACTIVE", label: "🟢 Đang Diễn Ra" },
            { id: "COMPLETED", label: "🔴 Đã Hoàn Thành" },
            { id: "UPCOMING", label: "🟡 Sắp Khai Giảng" },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setStatusTab(tab.id as any)}
              className={`px-4 py-2 rounded-xl text-xs font-bold font-headline transition-all cursor-pointer whitespace-nowrap ${
                statusTab === tab.id
                  ? "bg-[#6d3807] text-white shadow-xs"
                  : "bg-white text-[#52443a] hover:bg-[#fff8f5] border border-[#d8c2b6]"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Classes Grid */}
        {loading ? (
          <div className="flex items-center space-x-2 text-xs text-[#52443a] p-12 bg-white rounded-2xl border border-[#d8c2b6]">
            <Loader2 className="w-4 h-4 animate-spin text-[#6d3807]" />
            <span>Đang nạp danh sách lớp học từ PostgreSQL...</span>
          </div>
        ) : filteredClasses.length === 0 ? (
          <div className="p-12 text-center bg-white rounded-2xl border border-[#d8c2b6] space-y-3">
            <BookOpen className="w-12 h-12 text-[#6d3807] mx-auto opacity-50" />
            <p className="text-xs text-[#52443a]">Không tìm thấy lớp học nào thuộc trạng thái này.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredClasses.map((cls) => (
              <div
                key={cls.id}
                className="bg-[#ffffff] p-6 rounded-3xl border border-[#d8c2b6] shadow-sm flex flex-col justify-between space-y-4 hover:shadow-md transition-all group"
              >
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="px-2.5 py-1 bg-[#fff1ea] text-[#6d3807] border border-[#ffb782] text-xs font-bold rounded-lg font-mono">
                      Mã: {cls.code}
                    </span>
                    {getStatusBadge(cls.status)}
                  </div>

                  <h3 className="font-bold text-lg text-[#211a16] group-hover:text-[#6d3807] transition-colors font-headline">
                    {cls.name}
                  </h3>

                  <div className="flex justify-between items-center text-xs text-[#52443a]">
                    <span className="flex items-center">
                      <Users className="w-3.5 h-3.5 mr-1 text-[#6d3807]" />
                      <strong>{cls.student_count}</strong> / {cls.max_slots} Học viên
                    </span>
                    <span className="text-[11px] font-mono text-[#857469]">ID: {cls.id}</span>
                  </div>

                  <div className="pt-2 border-t border-[#d8c2b6]/30 text-xs text-[#6d3807] font-medium flex items-center">
                    <Clock className="w-3.5 h-3.5 mr-1.5 shrink-0 text-[#6d3807]" />
                    <span>Lịch học: {cls.schedule}</span>
                  </div>
                </div>

                {/* Class Card Footer Actions */}
                <div className="pt-3 border-t border-[#d8c2b6]/40 flex items-center space-x-2">
                  <Link
                    href={`/teacher/classes/${cls.id}`}
                    className="flex-1 py-2.5 bg-[#6d3807] text-white hover:bg-[#8a4f1e] text-xs font-bold rounded-xl flex items-center justify-center space-x-1.5 transition-all shadow-xs font-headline"
                  >
                    <BookOpen className="w-3.5 h-3.5 text-[#ffb782]" />
                    <span>Vào Lớp Học</span>
                  </Link>

                  <button
                    onClick={() => copyInviteLink(cls.code)}
                    className="p-2.5 bg-[#fff8f5] border border-[#d8c2b6] hover:bg-[#f9ebe4] text-[#6d3807] rounded-xl flex items-center justify-center transition-all cursor-pointer"
                    title="Copy Link Mời Học Sinh"
                  >
                    {copiedCode === cls.code ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    ) : (
                      <Copy className="w-4 h-4 text-[#6d3807]" />
                    )}
                  </button>

                  <button
                    onClick={() => openEditModal(cls)}
                    className="p-2.5 bg-[#fff8f5] border border-[#d8c2b6] hover:bg-[#f9ebe4] text-[#6d3807] rounded-xl flex items-center justify-center transition-all cursor-pointer"
                    title="Chỉnh Sửa Thông Tin Lớp"
                  >
                    <Edit3 className="w-4 h-4" />
                  </button>

                  <button
                    onClick={() => handleDeleteClass(cls.id, cls.name)}
                    className="p-2.5 text-rose-600 hover:bg-rose-50 border border-rose-200 rounded-xl transition-all cursor-pointer"
                    title="Xóa Lớp Học"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Modal: Create Class */}
        {showCreateModal && (
          <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl p-6 md:p-8 max-w-lg w-full shadow-2xl border border-[#d8c2b6] space-y-6 animate-in fade-in zoom-in-95">
              <div className="flex justify-between items-center border-b border-[#d8c2b6]/40 pb-4">
                <h2 className="text-xl font-bold text-[#6d3807] flex items-center space-x-2 font-headline">
                  <PlusCircle className="w-5 h-5 text-[#6d3807]" />
                  <span>Tạo Lớp Học Mới</span>
                </h2>
                <button onClick={() => setShowCreateModal(false)} className="text-[#857469] cursor-pointer">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleCreateClass} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold uppercase text-[#6d3807] mb-1">
                    Tên Lớp Học (*)
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ví dụ: IELTS Master 7.5 - Khóa K25"
                    value={className}
                    onChange={(e) => setClassName(e.target.value)}
                    className="w-full p-3 bg-[#fff8f5] border border-[#d8c2b6] rounded-xl text-xs font-bold focus:outline-none focus:border-[#6d3807]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase text-[#6d3807] mb-1">
                    Lịch Học Offline / Online
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ví dụ: Thứ 2 - Thứ 4 - Thứ 6 (19:30 - 21:30)"
                    value={schedule}
                    onChange={(e) => setSchedule(e.target.value)}
                    className="w-full p-3 bg-[#fff8f5] border border-[#d8c2b6] rounded-xl text-xs font-medium focus:outline-none focus:border-[#6d3807]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase text-[#6d3807] mb-1">
                    Trạng Thái Khai Giảng
                  </label>
                  <select
                    value={createStatus}
                    onChange={(e) => setCreateStatus(e.target.value as any)}
                    className="w-full p-3 bg-[#fff8f5] border border-[#d8c2b6] rounded-xl text-xs font-bold focus:outline-none focus:border-[#6d3807]"
                  >
                    <option value="ACTIVE">🟢 Đang Diễn Ra (Đang giảng dạy)</option>
                    <option value="UPCOMING">🟡 Sắp Khai Giảng (Tuyển sinh)</option>
                    <option value="COMPLETED">🔴 Đã Hoàn Thành (Lưu trữ)</option>
                  </select>
                </div>

                <div className="pt-4 flex space-x-3">
                  <button
                    type="button"
                    onClick={() => setShowCreateModal(false)}
                    className="flex-1 py-3 border border-[#d8c2b6] text-[#52443a] rounded-xl text-xs font-medium hover:bg-[#fff8f5] cursor-pointer"
                  >
                    Hủy
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="flex-1 py-3 bg-[#6d3807] hover:bg-[#8a4f1e] text-white rounded-xl text-xs font-bold shadow flex items-center justify-center space-x-2 disabled:opacity-50 cursor-pointer font-headline"
                  >
                    {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin text-white" /> : <Save className="w-4 h-4 text-[#ffb782]" />}
                    <span>Xác Nhận Tạo Lớp</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal: Edit Class */}
        {showEditModal && editingClass && (
          <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl p-6 md:p-8 max-w-lg w-full shadow-2xl border border-[#d8c2b6] space-y-6 animate-in fade-in zoom-in-95">
              <div className="flex justify-between items-center border-b border-[#d8c2b6]/40 pb-4">
                <h2 className="text-xl font-bold text-[#6d3807] flex items-center space-x-2 font-headline">
                  <Edit3 className="w-5 h-5 text-[#6d3807]" />
                  <span>Chỉnh Sửa Thông Tin Lớp Học</span>
                </h2>
                <button onClick={() => setShowEditModal(false)} className="text-[#857469] cursor-pointer">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleUpdateClass} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold uppercase text-[#6d3807] mb-1">
                    Tên Lớp Học (*)
                  </label>
                  <input
                    type="text"
                    required
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="w-full p-3 bg-[#fff8f5] border border-[#d8c2b6] rounded-xl text-xs font-bold focus:outline-none focus:border-[#6d3807]"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold uppercase text-[#6d3807] mb-1">
                      Mã Lớp Học (*)
                    </label>
                    <input
                      type="text"
                      required
                      value={editCode}
                      onChange={(e) => setEditCode(e.target.value)}
                      className="w-full p-3 bg-[#fff8f5] border border-[#d8c2b6] rounded-xl text-xs font-mono font-bold focus:outline-none focus:border-[#6d3807]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase text-[#6d3807] mb-1">
                      Sức Chứa (Tối đa)
                    </label>
                    <input
                      type="number"
                      required
                      min="1"
                      max="100"
                      value={editMaxSlots}
                      onChange={(e) => setEditMaxSlots(Number(e.target.value))}
                      className="w-full p-3 bg-[#fff8f5] border border-[#d8c2b6] rounded-xl text-xs font-bold focus:outline-none focus:border-[#6d3807]"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase text-[#6d3807] mb-1">
                    Lịch Học
                  </label>
                  <input
                    type="text"
                    required
                    value={editSchedule}
                    onChange={(e) => setEditSchedule(e.target.value)}
                    className="w-full p-3 bg-[#fff8f5] border border-[#d8c2b6] rounded-xl text-xs font-medium focus:outline-none focus:border-[#6d3807]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase text-[#6d3807] mb-1">
                    Trạng Thái Vòng Đời Lớp Học (*)
                  </label>
                  <select
                    value={editStatus}
                    onChange={(e) => setEditStatus(e.target.value as any)}
                    className="w-full p-3 bg-[#fff8f5] border border-[#d8c2b6] rounded-xl text-xs font-bold focus:outline-none focus:border-[#6d3807]"
                  >
                    <option value="ACTIVE">🟢 Đang Diễn Ra (Đang trong thời gian học)</option>
                    <option value="COMPLETED">🔴 Đã Hoàn Thành (Kết thúc khóa & lưu trữ điểm)</option>
                    <option value="UPCOMING">🟡 Sắp Khai Giảng (Đang mở ghi danh)</option>
                  </select>
                </div>

                <div className="pt-4 flex space-x-3">
                  <button
                    type="button"
                    onClick={() => setShowEditModal(false)}
                    className="flex-1 py-3 border border-[#d8c2b6] text-[#52443a] rounded-xl text-xs font-medium hover:bg-[#fff8f5] cursor-pointer"
                  >
                    Hủy
                  </button>
                  <button
                    type="submit"
                    disabled={isEditingSubmitting}
                    className="flex-1 py-3 bg-[#6d3807] hover:bg-[#8a4f1e] text-white rounded-xl text-xs font-bold shadow flex items-center justify-center space-x-2 disabled:opacity-50 cursor-pointer font-headline"
                  >
                    {isEditingSubmitting ? <Loader2 className="w-4 h-4 animate-spin text-white" /> : <Save className="w-4 h-4 text-[#ffb782]" />}
                    <span>Cập Nhật Thông Tin</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </TeacherLayout>
  );
}
