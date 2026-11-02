"use client";

import { useState, useEffect, useMemo } from "react";
import AdminLayout from "@/components/AdminLayout";
import Link from "next/link";
import { GraduationCap, UserPlus, Trash2, Loader2, CheckCircle2, Award, X, Save, ArrowRight, AlertCircle } from "lucide-react";

interface StudentUser {
  id: string;
  name: string;
  email: string;
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
  const [error, setError] = useState<string | null>(null);
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
    setLoading(true);
    setError(null);
    try {
      const [resUsers, resClasses] = await Promise.all([
        fetch("/api/admin/users?role=STUDENT"),
        fetch("/api/admin/classes"),
      ]);

      const dataUsers = await resUsers.json();
      const dataClasses = await resClasses.json();

      if (!resUsers.ok || !dataUsers.users) {
        setError(dataUsers.error || "Không thể tải danh sách học sinh.");
        return;
      }
      if (!resClasses.ok || !dataClasses.classes) {
        setError(dataClasses.error || "Không thể tải danh sách lớp học.");
        return;
      }

      setClassList(dataClasses.classes || []);

      const formatted: StudentUser[] = (dataUsers.users || []).map((row: any) => ({
        id: row.id,
        name: row.name,
        email: row.email,
        phone: row.phone || "0912345678",
        created_at: new Date(row.created_at).toLocaleDateString("vi-VN"),
        enrolled_class_ids: row.class_ids || [],
        tests_count: Number(row.submission_count) || 0,
        avg_score:
          row.latest_score !== null && row.latest_score !== undefined
            ? Number(row.latest_score)
            : 0,
      }));

      setStudents(formatted);
    } catch (e: any) {
      console.error(e);
      setError(e.message || "Lỗi hệ thống khi tải danh sách học sinh.");
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
      const res = await fetch("/api/admin/create-user", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          role: "STUDENT",
          email: email.trim(),
          password: password.trim(),
          name: name.trim(),
          phone: phone.trim(),
          targetBand: targetBand.trim(),
          classIds: selectedClassIds,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        const errorMsg = typeof data.error === "string" ? data.error : (data.error?.message || JSON.stringify(data.error || data));
        alert("Lỗi khởi tạo học sinh: " + errorMsg);
        return;
      }

      setSuccessMsg(`Đã tạo thành công học viên "${name}"!`);
      setShowCreateModal(false);
      fetchStudentsAndData();
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (e: any) {
      console.error(e);
      alert("Đã xảy ra lỗi hệ thống khi tạo tài khoản học sinh.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteStudent = async (id: string, stName: string) => {
    if (!confirm(`Bạn có chắc chắn muốn xóa tài khoản Học viên "${stName}" không?`)) return;

    try {
      const res = await fetch("/api/admin/delete-user", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: id }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        alert("Lỗi khi xóa học sinh: " + (data.error || "Không rõ nguyên nhân"));
        return;
      }

      setSuccessMsg(`Đã xóa thành công học viên "${stName}" khỏi hệ thống.`);
      fetchStudentsAndData();
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (e: any) {
      console.error("Delete student error:", e);
      alert("Lỗi kết nối khi xóa tài khoản.");
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
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-line/40 pb-6">
          <div>
            <div className="flex items-center space-x-2 text-xs text-brand-800 uppercase tracking-wider font-bold mb-1">
              <GraduationCap className="w-4 h-4 text-brand-800" />
              <span>Super Admin &bull; Global Student Roster</span>
            </div>
            <h1 className="text-3xl font-bold text-ink tracking-tight">
              Quản Lý Học Sinh &amp; Tiến Độ Học Tập
            </h1>
            <p className="text-sm text-ink-muted mt-1">
              Theo dõi danh sách học viên toàn hệ thống và tiến độ nộp bài thi trong PostgreSQL Database.
            </p>
          </div>

          <button
            onClick={openCreateModal}
            className="px-5 py-2.5 bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium rounded-xl shadow transition-all flex items-center space-x-2 shrink-0"
          >
            <UserPlus className="w-4 h-4 text-white" />
            <span>Thêm Học Sinh Mới</span>
          </button>
        </div>

        {successMsg && (
          <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 flex items-center space-x-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-600" />
            <span className="text-xs font-bold">{successMsg}</span>
          </div>
        )}

        {error && (
          <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
              <span className="text-xs font-bold">{error}</span>
            </div>
            <button
              onClick={fetchStudentsAndData}
              className="px-3 py-1.5 bg-rose-600 text-white rounded-lg text-xs font-medium hover:bg-rose-700"
            >
              Thử lại
            </button>
          </div>
        )}

        {/* Clean Students List */}
        {loading ? (
          <div className="flex items-center space-x-2 text-xs text-ink-muted p-12 bg-white rounded-2xl border border-line">
            <Loader2 className="w-4 h-4 animate-spin text-brand-600" />
            <span>Đang nạp danh sách học sinh từ PostgreSQL...</span>
          </div>
        ) : filteredStudents.length === 0 ? (
          <div className="p-12 text-center bg-white rounded-2xl border border-line space-y-3">
            <p className="text-xs text-ink-muted">Không tìm thấy học sinh nào khớp với từ khóa tìm kiếm.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {filteredStudents.map((st) => (
              <div
                key={st.id}
                className="bg-white p-6 rounded-2xl border border-line shadow-sm flex flex-col justify-between space-y-4 hover:shadow-md transition-all"
              >
                <div className="space-y-2">
                  <div className="flex justify-between items-start">
                    <div className="flex items-center space-x-2">
                      <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-xs font-bold">
                        STUDENT
                      </span>
                      <span className="text-xs text-ink-subtle">ID: {st.id}</span>
                    </div>
                    <span className="text-xs text-ink-subtle">Tham gia: {st.created_at}</span>
                  </div>

                  <h3 className="text-lg font-bold text-ink">{st.name}</h3>
                  <p className="text-xs text-ink-muted">
                    Email: <strong className="text-brand-800">{st.email}</strong> &bull; SĐT: {st.phone}
                  </p>

                  <div className="pt-2 border-t border-line/30 flex items-center justify-between text-xs text-brand-600">
                    <span className="flex items-center font-medium">
                      <Award className="w-4 h-4 mr-1 text-brand-600" />
                      Đã nộp: <strong>{st.tests_count} bài thi</strong> &bull; Điểm bài mới nhất: <strong className="ml-1 text-brand-600 font-bold">{st.avg_score} / 10</strong>
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-end space-x-2 pt-2 border-t border-line/20">
                  <Link
                    href={`/admin/students/${st.id}`}
                    className="px-3.5 py-2 bg-surface-alt text-brand-600 border border-line rounded-xl text-xs font-medium hover:bg-brand-100 flex items-center space-x-1 transition-all"
                  >
                    <span>Xem Hồ Sơ &amp; Kết Quả</span>
                    <ArrowRight className="w-3.5 h-3.5 text-brand-600" />
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
            <div className="bg-white rounded-3xl p-6 md:p-8 max-w-lg w-full shadow-2xl border border-line space-y-6 animate-in fade-in zoom-in-95">
              <div className="flex justify-between items-center border-b border-line/40 pb-4">
                <h2 className="text-xl font-bold text-brand-600 flex items-center space-x-2">
                  <UserPlus className="w-5 h-5 text-brand-600" />
                  <span>Khởi Tạo Học Sinh Mới</span>
                </h2>
                <button onClick={() => setShowCreateModal(false)} className="text-ink-subtle hover:text-ink">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleCreateStudent} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold uppercase text-ink mb-1">
                    Họ &amp; Tên Học Sinh (*)
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ví dụ: Trần Hoàng Nam"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full px-3 py-2.5 bg-surface-alt border border-line rounded-xl text-sm focus:outline-none focus:border-brand-600"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase text-ink mb-1">
                    Email Đăng Nhập (*)
                  </label>
                  <input
                    type="email"
                    required
                    placeholder="namtran.student@gmail.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full px-3 py-2.5 bg-surface-alt border border-line rounded-xl text-sm focus:outline-none focus:border-brand-600"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase text-ink mb-1">
                    Mật Khẩu Khởi Tạo (*)
                  </label>
                  <input
                    type="password"
                    required
                    placeholder="Nhập mật khẩu..."
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full px-3 py-2.5 bg-surface-alt border border-line rounded-xl text-sm focus:outline-none focus:border-brand-600"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase text-ink mb-1">
                    Số Điện Thoại
                  </label>
                  <input
                    type="tel"
                    placeholder="0912345678"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full px-3 py-2.5 bg-surface-alt border border-line rounded-xl text-sm focus:outline-none focus:border-brand-600"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase text-ink mb-1">
                    Mục Tiêu Band Điểm
                  </label>
                  <input
                    type="text"
                    placeholder="IELTS 7.5"
                    value={targetBand}
                    onChange={(e) => setTargetBand(e.target.value)}
                    className="w-full px-3 py-2.5 bg-surface-alt border border-line rounded-xl text-sm focus:outline-none focus:border-brand-600"
                  />
                </div>

                {/* Multi-Class Checkboxes */}
                <div>
                  <label className="block text-xs font-bold uppercase text-brand-600 mb-2">
                    Chọn Các Lớp Học Tham Gia (Học Đồng Thời Nhiều Lớp)
                  </label>
                  <div className="space-y-2 max-h-40 overflow-y-auto p-3 bg-surface-alt border border-line rounded-xl">
                    {classList.map((cls) => (
                      <label key={cls.id} className="flex items-center space-x-2 text-xs font-medium cursor-pointer">
                        <input
                          type="checkbox"
                          checked={selectedClassIds.includes(cls.id)}
                          onChange={() => toggleClassSelection(cls.id)}
                          className="accent-brand-600 rounded"
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
                    className="flex-1 py-3 border border-line text-ink-muted rounded-xl text-xs font-medium hover:bg-surface-alt"
                  >
                    Hủy
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="flex-1 py-3 bg-brand-600 hover:bg-brand-700 text-white rounded-xl text-xs font-medium shadow flex items-center justify-center space-x-2 disabled:opacity-50"
                  >
                    {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin text-white" /> : <Save className="w-4 h-4 text-white" />}
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
