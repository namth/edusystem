"use client";

import { useState, useEffect, useMemo } from "react";
import AdminLayout from "@/components/AdminLayout";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { GraduationCap, UserPlus, Trash2, Loader2, CheckCircle2, Award, X, Save, ArrowRight } from "lucide-react";

interface StudentUser {
  id: string;
  name: string;
  email: string;
  password?: string;
  phone?: string;
  created_at: string;
  enrolled_class_ids?: string[];
  tests_count?: number;
  avg_score?: number;
}

interface ClassItem {
  id: string;
  name: string;
  code: string;
  teacher_id: string;
}

export default function AdminStudentsPage() {
  const [students, setStudents] = useState<StudentUser[]>([]);
  const [classList, setClassList] = useState<ClassItem[]>([]);
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
  const [targetBand, setTargetBand] = useState("IELTS 7.5");
  const [selectedClassIds, setSelectedClassIds] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchStudentsAndData = async () => {
    try {
      // 1. Fetch Students
      const { data: userData, error: userError } = await supabase
        .from("users")
        .select("*")
        .eq("role", "STUDENT")
        .order("created_at", { ascending: false });

      if (userError) {
        console.error("Students load error:", userError);
        return;
      }

      // 2. Fetch Classes
      const { data: clsData } = await supabase.from("classes").select("*");
      setClassList(clsData || []);

      // 3. Fetch Enrollments
      const { data: enrData } = await supabase.from("enrollments").select("*");
      const studentClassIdsMap: Record<string, string[]> = {};

      if (enrData) {
        enrData.forEach((e: any) => {
          if (!studentClassIdsMap[e.student_id]) studentClassIdsMap[e.student_id] = [];
          studentClassIdsMap[e.student_id].push(e.class_id);
        });
      }

      // 4. Fetch Submissions
      const { data: subData } = await supabase.from("submissions").select("*");
      const studentSubMap: Record<string, { count: number; sum: number }> = {};
      if (subData) {
        subData.forEach((s: any) => {
          if (!studentSubMap[s.student_id]) {
            studentSubMap[s.student_id] = { count: 0, sum: 0 };
          }
          studentSubMap[s.student_id].count += 1;
          studentSubMap[s.student_id].sum += Number(s.ai_score || s.final_score || 7.0);
        });
      }

      const formatted: StudentUser[] = (userData || []).map((row: any) => {
        const stats = studentSubMap[row.id] || { count: 0, sum: 0 };
        const avg = stats.count > 0 ? Math.round((stats.sum / stats.count) * 10) / 10 : 7.0;

        return {
          id: row.id,
          name: row.name,
          email: row.email,
          password: row.password,
          phone: row.phone || "0912345678",
          created_at: new Date(row.created_at).toLocaleDateString("vi-VN"),
          enrolled_class_ids: studentClassIdsMap[row.id] || ["cls_101"],
          tests_count: stats.count,
          avg_score: avg,
        };
      });

      setStudents(formatted);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStudentsAndData();
  }, []);

  const filteredStudents = useMemo(() => {
    if (!searchQuery.trim()) return students;
    const q = searchQuery.toLowerCase().trim();
    return students.filter((st) => {
      const matchName = st.name.toLowerCase().includes(q);
      const matchId = st.id.toLowerCase().includes(q);
      const matchEmail = st.email.toLowerCase().includes(q);
      const matchPhone = st.phone?.toLowerCase().includes(q);
      return matchName || matchId || matchEmail || matchPhone;
    });
  }, [students, searchQuery]);

  const openCreateModal = () => {
    setName("");
    setEmail("");
    setPassword("");
    setPhone("");
    setTargetBand("IELTS 7.5");
    setSelectedClassIds(classList.length > 0 ? [classList[0].id] : []);
    setShowCreateModal(true);
  };

  const toggleClassSelection = (classId: string) => {
    if (selectedClassIds.includes(classId)) {
      setSelectedClassIds(selectedClassIds.filter((id) => id !== classId));
    } else {
      setSelectedClassIds([...selectedClassIds, classId]);
    }
  };

  const handleCreateStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim() || !password.trim()) return;

    setIsSubmitting(true);
    try {
      const studentId = `student_${Date.now().toString().slice(-4)}`;

      // Insert Student User
      const { error: userErr } = await supabase.from("users").insert([
        {
          id: studentId,
          name: name.trim(),
          email: email.trim(),
          password: password.trim(),
          role: "STUDENT",
          phone: phone.trim() || "0912345678",
          target_band: targetBand.trim(),
        },
      ]);

      if (userErr) {
        console.error("Create student error:", userErr);
        return;
      }

      // Insert Multi-Class Enrollments
      if (selectedClassIds.length > 0) {
        const enrollmentRows = selectedClassIds.map((cId) => ({
          id: `enr_${Date.now().toString().slice(-4)}_${Math.floor(Math.random() * 100)}`,
          student_id: studentId,
          class_id: cId,
        }));
        await supabase.from("enrollments").insert(enrollmentRows);
      }

      setSuccessMsg(`Đã tạo thành công học viên "${name}"!`);
      setShowCreateModal(false);
      fetchStudentsAndData();
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (e) {
      console.error(e);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteStudent = async (id: string, stName: string) => {
    if (!confirm(`Bạn có chắc chắn muốn xóa tài khoản Học viên "${stName}" không?`)) return;

    try {
      const { error } = await supabase.from("users").delete().eq("id", id);
      if (error) {
        console.error("Delete student error:", error);
        return;
      }
      fetchStudentsAndData();
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <AdminLayout
      onSearchChange={setSearchQuery}
      searchPlaceholder="Tìm học sinh theo Tên, ID, Email, SĐT..."
      searchValue={searchQuery}
    >
      <div className="max-w-[1280px] mx-auto space-y-8 font-sans">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#d8c2b6]/40 pb-6">
          <div>
            <div className="flex items-center space-x-2 text-xs text-[#004d5e] uppercase tracking-wider font-bold mb-1">
              <GraduationCap className="w-4 h-4 text-[#004d5e]" />
              <span>Super Admin &bull; Global Student Roster</span>
            </div>
            <h1 className="text-3xl font-bold text-[#211a16] tracking-tight">
              Quản Lý Học Sinh &amp; Tiến Độ Học Tập
            </h1>
            <p className="text-sm text-[#52443a] mt-1">
              Theo dõi danh sách học viên toàn hệ thống và tiến độ nộp bài thi trong PostgreSQL Database.
            </p>
          </div>

          <button
            onClick={openCreateModal}
            className="px-5 py-2.5 bg-[#6d3807] hover:bg-[#8a4f1e] text-white text-sm font-medium rounded-xl shadow transition-all flex items-center space-x-2 shrink-0"
          >
            <UserPlus className="w-4 h-4 text-[#ffb782]" />
            <span>+ Thêm Học Sinh Mới</span>
          </button>
        </div>

        {successMsg && (
          <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 flex items-center space-x-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-600" />
            <span className="text-xs font-bold">{successMsg}</span>
          </div>
        )}

        {/* Clean Students List (No target band, No class names) */}
        {loading ? (
          <div className="flex items-center space-x-2 text-xs text-[#52443a] p-12 bg-white rounded-2xl border border-[#d8c2b6]">
            <Loader2 className="w-4 h-4 animate-spin text-[#6d3807]" />
            <span>Đang nạp danh sách học sinh từ PostgreSQL...</span>
          </div>
        ) : filteredStudents.length === 0 ? (
          <div className="p-12 text-center bg-white rounded-2xl border border-[#d8c2b6] space-y-3">
            <p className="text-xs text-[#52443a]">Không tìm thấy học sinh nào khớp với từ khóa tìm kiếm.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {filteredStudents.map((st) => (
              <div
                key={st.id}
                className="bg-white p-6 rounded-2xl border border-[#d8c2b6] shadow-sm flex flex-col justify-between space-y-4 hover:shadow-md transition-all"
              >
                <div className="space-y-2">
                  <div className="flex justify-between items-start">
                    <div className="flex items-center space-x-2">
                      <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-xs font-bold">
                        STUDENT
                      </span>
                      <span className="text-xs text-[#857469]">ID: {st.id}</span>
                    </div>
                    <span className="text-xs text-[#857469]">Tham gia: {st.created_at}</span>
                  </div>

                  <h3 className="text-lg font-bold text-[#211a16]">{st.name}</h3>
                  <p className="text-xs text-[#52443a]">
                    Email: <strong className="text-[#004d5e]">{st.email}</strong> &bull; SĐT: {st.phone}
                  </p>

                  <div className="pt-2 border-t border-[#d8c2b6]/30 flex items-center justify-between text-xs text-[#6d3807]">
                    <span className="flex items-center font-medium">
                      <Award className="w-4 h-4 mr-1 text-[#6d3807]" />
                      Đã nộp: <strong>{st.tests_count} bài thi</strong> &bull; Score TB: <strong className="ml-1 text-[#6d3807] font-bold">{st.avg_score} / 10</strong>
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-end space-x-2 pt-2 border-t border-[#d8c2b6]/20">
                  <Link
                    href={`/admin/students/${st.id}`}
                    className="px-3.5 py-2 bg-[#fff8f5] text-[#6d3807] border border-[#d8c2b6] rounded-xl text-xs font-medium hover:bg-[#f9ebe4] flex items-center space-x-1 transition-all"
                  >
                    <span>Xem Hồ Sơ &amp; Kết Quả</span>
                    <ArrowRight className="w-3.5 h-3.5 text-[#6d3807]" />
                  </Link>

                  <button
                    onClick={() => handleDeleteStudent(st.id, st.name)}
                    className="p-2 text-rose-600 hover:bg-rose-50 border border-rose-200 rounded-xl transition-all"
                    title="Xóa học sinh"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Modal: Create Student */}
        {showCreateModal && (
          <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 font-sans">
            <div className="bg-white rounded-3xl p-6 md:p-8 max-w-lg w-full shadow-2xl border border-[#d8c2b6] space-y-6 animate-in fade-in zoom-in-95">
              <div className="flex justify-between items-center border-b border-[#d8c2b6]/40 pb-4">
                <h2 className="text-xl font-bold text-[#6d3807] flex items-center space-x-2">
                  <UserPlus className="w-5 h-5 text-[#6d3807]" />
                  <span>Khởi Tạo Học Sinh Mới</span>
                </h2>
                <button onClick={() => setShowCreateModal(false)} className="text-[#857469] hover:text-[#211a16]">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleCreateStudent} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold uppercase text-[#211a16] mb-1">
                    Họ &amp; Tên Học Sinh (*)
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ví dụ: Trần Hoàng Nam"
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
                    placeholder="namtran.student@gmail.com"
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
                    Số Điện Thoại
                  </label>
                  <input
                    type="tel"
                    placeholder="0912345678"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full px-3 py-2.5 bg-[#fff8f5] border border-[#d8c2b6] rounded-xl text-sm focus:outline-none focus:border-[#6d3807]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase text-[#211a16] mb-1">
                    Mục Tiêu Band Điểm
                  </label>
                  <input
                    type="text"
                    placeholder="IELTS 7.5"
                    value={targetBand}
                    onChange={(e) => setTargetBand(e.target.value)}
                    className="w-full px-3 py-2.5 bg-[#fff8f5] border border-[#d8c2b6] rounded-xl text-sm focus:outline-none focus:border-[#6d3807]"
                  />
                </div>

                {/* Multi-Class Checkboxes */}
                <div>
                  <label className="block text-xs font-bold uppercase text-[#6d3807] mb-2">
                    Chọn Các Lớp Học Tham Gia (Học Đồng Thời Nhiều Lớp)
                  </label>
                  <div className="space-y-2 max-h-40 overflow-y-auto p-3 bg-[#fff8f5] border border-[#d8c2b6] rounded-xl">
                    {classList.map((cls) => (
                      <label key={cls.id} className="flex items-center space-x-2 text-xs font-medium cursor-pointer">
                        <input
                          type="checkbox"
                          checked={selectedClassIds.includes(cls.id)}
                          onChange={() => toggleClassSelection(cls.id)}
                          className="accent-[#6d3807] rounded"
                        />
                        <span>{cls.name} ({cls.code})</span>
                      </label>
                    ))}
                  </div>
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
                    <span>Tạo Học Sinh</span>
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
