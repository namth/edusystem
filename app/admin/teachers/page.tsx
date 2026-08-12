"use client";

import { useState, useEffect, useMemo } from "react";
import AdminLayout from "@/components/AdminLayout";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { UserCheck, UserPlus, Trash2, Loader2, CheckCircle2, Award, X, Save, ArrowRight } from "lucide-react";

interface TeacherUser {
  id: string;
  name: string;
  email: string;
  password?: string;
  phone?: string;
  created_at: string;
  slot_limit?: number;
}

export default function AdminTeachersPage() {
  const [teachers, setTeachers] = useState<TeacherUser[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Modal States
  const [showCreateModal, setShowCreateModal] = useState(false);

  // Form States
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [qualification, setQualification] = useState("M.A TESOL (IELTS 8.5)");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchTeachers = async () => {
    try {
      const { data: userData, error: userError } = await supabase
        .from("users")
        .select("*")
        .eq("role", "TEACHER")
        .order("created_at", { ascending: false });

      if (userError) {
        console.error("Teachers load error:", userError);
        return;
      }

      const formatted: TeacherUser[] = (userData || []).map((row: any) => ({
        id: row.id,
        name: row.name,
        email: row.email,
        password: row.password,
        phone: row.phone || "0912345679",
        created_at: new Date(row.created_at).toLocaleDateString("vi-VN"),
        slot_limit: row.slot_limit || 250,
      }));

      setTeachers(formatted);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTeachers();
  }, []);

  const filteredTeachers = useMemo(() => {
    if (!searchQuery.trim()) return teachers;
    const q = searchQuery.toLowerCase().trim();
    return teachers.filter((t) => {
      const matchName = t.name.toLowerCase().includes(q);
      const matchId = t.id.toLowerCase().includes(q);
      const matchEmail = t.email.toLowerCase().includes(q);
      const matchPhone = t.phone?.toLowerCase().includes(q);
      return matchName || matchId || matchEmail || matchPhone;
    });
  }, [teachers, searchQuery]);

  const handleCreateTeacher = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim() || !password.trim()) return;

    setIsSubmitting(true);
    try {
      const teacherId = `teacher_${Date.now().toString().slice(-4)}`;
      const { error } = await supabase.from("users").insert([
        {
          id: teacherId,
          name: name.trim(),
          email: email.trim(),
          password: password.trim(),
          role: "TEACHER",
          phone: phone.trim() || "0912345679",
          target_band: qualification.trim(),
        },
      ]);

      if (error) {
        console.error("Create teacher error:", error);
        return;
      }

      setSuccessMsg(`Đã khởi tạo thành công giảng viên "${name}"!`);
      setShowCreateModal(false);
      setName("");
      setEmail("");
      setPassword("");
      setPhone("");
      fetchTeachers();
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (e) {
      console.error(e);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteTeacher = async (id: string, teacherName: string) => {
    if (!confirm(`Bạn có chắc chắn muốn xóa tài khoản Giáo viên "${teacherName}" không?`)) return;

    try {
      const { error } = await supabase.from("users").delete().eq("id", id);
      if (error) {
        console.error("Delete teacher error:", error);
        return;
      }
      fetchTeachers();
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <AdminLayout
      onSearchChange={setSearchQuery}
      searchPlaceholder="Tìm giáo viên theo Tên, ID, Email, SĐT..."
      searchValue={searchQuery}
    >
      <div className="max-w-[1280px] mx-auto space-y-8 font-sans">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#d8c2b6]/40 pb-6">
          <div>
            <div className="flex items-center space-x-2 text-xs text-[#004d5e] uppercase tracking-wider font-bold mb-1">
              <UserCheck className="w-4 h-4 text-[#004d5e]" />
              <span>Super Admin &bull; Faculty &amp; Teacher Management</span>
            </div>
            <h1 className="text-3xl font-bold text-[#211a16] tracking-tight">
              Quản Lý Giáo Viên &amp; Hạn Mức Sĩ Số
            </h1>
            <p className="text-sm text-[#52443a] mt-1">
              Theo dõi hồ sơ giảng viên và điều chỉnh hạn mức slot sinh viên trong PostgreSQL Database.
            </p>
          </div>

          <button
            onClick={() => setShowCreateModal(true)}
            className="px-5 py-2.5 bg-[#6d3807] hover:bg-[#8a4f1e] text-white text-sm font-medium rounded-xl shadow transition-all flex items-center space-x-2 shrink-0"
          >
            <UserPlus className="w-4 h-4 text-[#ffb782]" />
            <span>+ Thêm Giáo Viên Mới</span>
          </button>
        </div>

        {successMsg && (
          <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 flex items-center space-x-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-600" />
            <span className="text-xs font-bold">{successMsg}</span>
          </div>
        )}

        {/* Clean Teachers List (No degree, No classes) */}
        {loading ? (
          <div className="flex items-center space-x-2 text-xs text-[#52443a] p-12 bg-white rounded-2xl border border-[#d8c2b6]">
            <Loader2 className="w-4 h-4 animate-spin text-[#6d3807]" />
            <span>Đang nạp danh sách giảng viên từ PostgreSQL...</span>
          </div>
        ) : filteredTeachers.length === 0 ? (
          <div className="p-12 text-center bg-white rounded-2xl border border-[#d8c2b6] space-y-3">
            <p className="text-xs text-[#52443a]">Không tìm thấy giảng viên nào khớp với từ khóa tìm kiếm.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {filteredTeachers.map((t) => (
              <div
                key={t.id}
                className="bg-white p-6 rounded-2xl border border-[#d8c2b6] shadow-sm flex flex-col justify-between space-y-4 hover:shadow-md transition-all"
              >
                <div className="space-y-2">
                  <div className="flex justify-between items-start">
                    <div className="flex items-center space-x-2">
                      <span className="px-2.5 py-0.5 rounded-full bg-[#fff1ea] text-[#6d3807] text-xs font-bold border border-[#ffb782]">
                        TEACHER
                      </span>
                      <span className="text-xs text-[#857469]">ID: {t.id}</span>
                    </div>
                    <span className="text-xs text-[#857469]">Tạo ngày: {t.created_at}</span>
                  </div>

                  <h3 className="text-lg font-bold text-[#211a16]">{t.name}</h3>
                  <p className="text-xs text-[#52443a]">
                    Email: <strong className="text-[#004d5e]">{t.email}</strong> &bull; SĐT: {t.phone}
                  </p>

                  <div className="pt-2 border-t border-[#d8c2b6]/30 flex items-center justify-between text-xs text-[#6d3807]">
                    <span className="flex items-center font-medium">
                      <Award className="w-4 h-4 mr-1 text-[#6d3807]" />
                      Hạn mức Slot Sĩ Số: <strong className="ml-1 text-[#6d3807] font-bold">{t.slot_limit} Slots</strong>
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-end space-x-2 pt-2 border-t border-[#d8c2b6]/20">
                  <Link
                    href={`/admin/teachers/${t.id}`}
                    className="px-3.5 py-2 bg-[#fff8f5] text-[#6d3807] border border-[#d8c2b6] rounded-xl text-xs font-medium hover:bg-[#f9ebe4] flex items-center space-x-1 transition-all"
                  >
                    <span>Xem Hồ Sơ &amp; Sửa Slot</span>
                    <ArrowRight className="w-3.5 h-3.5 text-[#6d3807]" />
                  </Link>

                  <button
                    onClick={() => handleDeleteTeacher(t.id, t.name)}
                    className="p-2 text-rose-600 hover:bg-rose-50 border border-rose-200 rounded-xl transition-all"
                    title="Xóa tài khoản giáo viên"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Modal: Create Teacher */}
        {showCreateModal && (
          <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 font-sans">
            <div className="bg-white rounded-3xl p-6 md:p-8 max-w-lg w-full shadow-2xl border border-[#d8c2b6] space-y-6 animate-in fade-in zoom-in-95">
              <div className="flex justify-between items-center border-b border-[#d8c2b6]/40 pb-4">
                <h2 className="text-xl font-bold text-[#6d3807] flex items-center space-x-2">
                  <UserPlus className="w-5 h-5 text-[#6d3807]" />
                  <span>Tạo Tài Khoản Giáo Viên Mới</span>
                </h2>
                <button onClick={() => setShowCreateModal(false)} className="text-[#857469] hover:text-[#211a16]">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleCreateTeacher} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold uppercase text-[#211a16] mb-1">
                    Họ &amp; Tên Giảng Viên (*)
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ví dụ: Thầy Nguyễn Văn Đức"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full px-3 py-2.5 bg-[#fff8f5] border border-[#d8c2b6] rounded-xl text-sm focus:outline-none focus:border-[#6d3807]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase text-[#211a16] mb-1">
                    Email Đăng Nhập (*)
                  </label>
                  <input
                    type="email"
                    required
                    placeholder="teacher.duc@edtech.edu.vn"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full px-3 py-2.5 bg-[#fff8f5] border border-[#d8c2b6] rounded-xl text-sm focus:outline-none focus:border-[#6d3807]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase text-[#211a16] mb-1">
                    Mật Khẩu Khởi Tạo (*)
                  </label>
                  <input
                    type="password"
                    required
                    placeholder="Nhập mật khẩu..."
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full px-3 py-2.5 bg-[#fff8f5] border border-[#d8c2b6] rounded-xl text-sm focus:outline-none focus:border-[#6d3807]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase text-[#211a16] mb-1">
                    Số Điện Thoại Liên Hệ
                  </label>
                  <input
                    type="tel"
                    placeholder="0912345679"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full px-3 py-2.5 bg-[#fff8f5] border border-[#d8c2b6] rounded-xl text-sm focus:outline-none focus:border-[#6d3807]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase text-[#211a16] mb-1">
                    Bằng Cấp &amp; Trình Độ Giảng Dạy
                  </label>
                  <input
                    type="text"
                    placeholder="M.A TESOL (IELTS 8.5)"
                    value={qualification}
                    onChange={(e) => setQualification(e.target.value)}
                    className="w-full px-3 py-2.5 bg-[#fff8f5] border border-[#d8c2b6] rounded-xl text-sm focus:outline-none focus:border-[#6d3807]"
                  />
                </div>

                <div className="pt-2 flex space-x-3">
                  <button
                    type="button"
                    onClick={() => setShowCreateModal(false)}
                    className="flex-1 py-3 border border-[#d8c2b6] text-[#52443a] rounded-xl text-xs font-medium hover:bg-[#fff8f5]"
                  >
                    Hủy
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="flex-1 py-3 bg-[#6d3807] hover:bg-[#8a4f1e] text-white rounded-xl text-xs font-medium shadow flex items-center justify-center space-x-2 disabled:opacity-50"
                  >
                    {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin text-white" /> : <Save className="w-4 h-4 text-[#ffb782]" />}
                    <span>Lưu Giảng Viên</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
