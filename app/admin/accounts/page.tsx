"use client";

import { useState, useEffect, useMemo } from "react";
import AdminLayout from "@/components/AdminLayout";
import { supabase } from "@/lib/supabase";
import { UserPlus, Filter, BookOpen, Loader2, CheckCircle2, X, Save, Users } from "lucide-react";

interface AccountUser {
  id: string;
  name: string;
  email: string;
  role: string;
  phone?: string;
  target_band?: string;
  created_at: string;
  classes_names?: string[];
  class_ids?: string[];
}

interface ClassItem {
  id: string;
  name: string;
  code: string;
  teacher_id: string;
}

export default function AdminAccountsPage() {
  const [accounts, setAccounts] = useState<AccountUser[]>([]);
  const [classList, setClassList] = useState<ClassItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Filter & Search states
  const [roleFilter, setRoleFilter] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [activeClassFilter, setActiveClassFilter] = useState<string | null>(null);

  // Modal States
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [viewingClassesUser, setViewingClassesUser] = useState<AccountUser | null>(null);

  // Form States
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("STUDENT");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const fetchAccountsAndClasses = async () => {
    try {
      // 1. Fetch all classes
      const { data: clsData } = await supabase.from("classes").select("*");
      setClassList(clsData || []);

      // 2. Fetch all enrollments
      const { data: enrData } = await supabase.from("enrollments").select("*");

      // 3. Fetch all users sorted by created_at DESC
      const { data: userData, error: userError } = await supabase
        .from("users")
        .select("*")
        .order("created_at", { ascending: false });

      if (userError) {
        console.error("Accounts fetch error:", userError);
        return;
      }

      // Build class mapping for teachers and students
      const userClassIdsMap: Record<string, string[]> = {};
      const userClassNamesMap: Record<string, string[]> = {};

      if (clsData) {
        // Teacher class mappings
        clsData.forEach((c: any) => {
          if (!userClassIdsMap[c.teacher_id]) userClassIdsMap[c.teacher_id] = [];
          if (!userClassNamesMap[c.teacher_id]) userClassNamesMap[c.teacher_id] = [];
          userClassIdsMap[c.teacher_id].push(c.id);
          userClassNamesMap[c.teacher_id].push(c.name);
        });
      }

      if (enrData && clsData) {
        // Student enrollment mappings
        enrData.forEach((e: any) => {
          if (!userClassIdsMap[e.student_id]) userClassIdsMap[e.student_id] = [];
          if (!userClassNamesMap[e.student_id]) userClassNamesMap[e.student_id] = [];

          userClassIdsMap[e.student_id].push(e.class_id);
          const matchedClass = clsData.find((c) => c.id === e.class_id);
          if (matchedClass) {
            userClassNamesMap[e.student_id].push(matchedClass.name);
          }
        });
      }

      const formatted: AccountUser[] = (userData || []).map((row: any) => ({
        id: row.id,
        name: row.name,
        email: row.email,
        role: row.role,
        phone: row.phone,
        target_band: row.target_band,
        created_at: new Date(row.created_at).toLocaleDateString("vi-VN"),
        class_ids: userClassIdsMap[row.id] || [],
        classes_names: userClassNamesMap[row.id] || [],
      }));

      setAccounts(formatted);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAccountsAndClasses();
  }, []);

  // Filtered Accounts Logic
  const filteredAccounts = useMemo(() => {
    return accounts.filter((acc) => {
      // Role Filter
      if (roleFilter !== "ALL" && acc.role !== roleFilter) return false;

      // Active Class Filter (Drill-down filter)
      if (activeClassFilter) {
        if (!acc.class_ids?.includes(activeClassFilter)) return false;
      }

      // Search Query Filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchName = acc.name.toLowerCase().includes(q);
        const matchEmail = acc.email.toLowerCase().includes(q);
        const matchClasses = acc.classes_names?.some((c) => c.toLowerCase().includes(q));
        if (!matchName && !matchEmail && !matchClasses) return false;
      }

      return true;
    });
  }, [accounts, roleFilter, activeClassFilter, searchQuery]);

  const handleCreateAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim() || !password.trim()) return;

    setIsSubmitting(true);
    try {
      const id =
        role === "TEACHER"
          ? `teacher_${Date.now().toString().slice(-4)}`
          : role === "ADMIN"
          ? `admin_${Date.now().toString().slice(-4)}`
          : `student_${Date.now().toString().slice(-4)}`;

      const { error } = await supabase.from("users").insert([
        {
          id,
          name: name.trim(),
          email: email.trim(),
          password: password.trim(),
          role,
          phone: role === "TEACHER" ? "0912345679" : "0912345678",
          target_band: role === "TEACHER" ? "M.A TESOL" : "IELTS 6.5",
        },
      ]);

      if (error) {
        console.error("Account create error:", error);
        return;
      }

      setSuccessMsg(`Tài khoản "${name}" (${role}) đã được tạo lập thành công!`);
      setShowCreateModal(false);
      setName("");
      setEmail("");
      setPassword("");
      fetchAccountsAndClasses();
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleFilterByClass = (classId: string) => {
    setActiveClassFilter(classId);
    setViewingClassesUser(null);
  };

  const clearClassFilter = () => {
    setActiveClassFilter(null);
  };

  const activeClassName = classList.find((c) => c.id === activeClassFilter)?.name;

  return (
    <AdminLayout
      onSearchChange={setSearchQuery}
      searchPlaceholder="Tìm tài khoản theo Tên, Email, Lớp..."
      searchValue={searchQuery}
    >
      <div className="max-w-[1280px] mx-auto space-y-8 font-sans">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#d8c2b6]/40 pb-6">
          <div>
            <div className="flex items-center space-x-2 text-xs text-[#004d5e] uppercase tracking-wider font-bold mb-1">
              <Users className="w-4 h-4 text-[#004d5e]" />
              <span>Super Admin &bull; Global User Directory</span>
            </div>
            <h1 className="text-3xl font-bold text-[#211a16] tracking-tight">
              Quản Lý Tài Khoản Systems &amp; Phân Lớp
            </h1>
            <p className="text-sm text-[#52443a] mt-1">
              Danh sách tài khoản sắp xếp theo thời gian mới nhất, hỗ trợ xem lớp học và lọc trực tiếp danh sách thành viên trong lớp.
            </p>
          </div>

          <button
            onClick={() => setShowCreateModal(true)}
            className="px-5 py-2.5 bg-[#6d3807] hover:bg-[#8a4f1e] text-white text-sm font-medium rounded-xl shadow transition-all flex items-center space-x-2 shrink-0"
          >
            <UserPlus className="w-4 h-4 text-[#ffb782]" />
            <span>+ Thêm Tài Khoản Mới</span>
          </button>
        </div>

        {successMsg && (
          <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 flex items-center space-x-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-600" />
            <span className="text-xs font-bold">{successMsg}</span>
          </div>
        )}

        {/* Role Filter Tabs & Active Filter Badge */}
        <div className="bg-white p-4 rounded-2xl border border-[#d8c2b6] shadow-sm flex flex-wrap items-center gap-3">
          <div className="flex bg-[#fff8f5] p-1 rounded-xl border border-[#d8c2b6]">
            {(["ALL", "ADMIN", "TEACHER", "STUDENT"] as const).map((r) => (
              <button
                key={r}
                onClick={() => setRoleFilter(r)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  roleFilter === r
                    ? "bg-[#6d3807] text-white shadow-sm"
                    : "text-[#52443a] hover:text-[#6d3807]"
                }`}
              >
                {r === "ALL" ? "Tất Cả" : r}
              </button>
            ))}
          </div>

          {activeClassFilter && (
            <div className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-[#fff1ea] border border-[#ffb782] text-xs text-[#6d3807] font-bold">
              <BookOpen className="w-3.5 h-3.5 text-[#6d3807]" />
              <span>Đang lọc theo lớp: <strong>{activeClassName}</strong></span>
              <button onClick={clearClassFilter} className="ml-1 hover:text-rose-600">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>

        {/* Accounts Table */}
        {loading ? (
          <div className="flex items-center space-x-2 text-xs text-[#52443a] p-12 bg-white rounded-2xl border border-[#d8c2b6]">
            <Loader2 className="w-4 h-4 animate-spin text-[#6d3807]" />
            <span>Đang nạp danh sách tài khoản từ database...</span>
          </div>
        ) : filteredAccounts.length === 0 ? (
          <div className="p-12 text-center bg-white rounded-2xl border border-[#d8c2b6] space-y-3">
            <p className="text-xs text-[#52443a]">Không tìm thấy tài khoản nào phù hợp với bộ lọc hiện tại.</p>
            {activeClassFilter && (
              <button onClick={clearClassFilter} className="px-3 py-1.5 bg-[#6d3807] text-white rounded-xl text-xs font-medium">
                Xóa bộ lọc lớp học
              </button>
            )}
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-[#d8c2b6] shadow-sm overflow-hidden">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="bg-[#fff8f5] border-b border-[#d8c2b6] text-xs font-bold text-[#52443a]">
                  <th className="p-4">Thành Viên (Họ &amp; Tên)</th>
                  <th className="p-4">Email Đăng Nhập</th>
                  <th className="p-4">Vai Trò</th>
                  <th className="p-4">Ngày Tạo</th>
                  <th className="p-4">Lớp Học Liên Quan</th>
                  <th className="p-4 text-right">Thao Tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#d8c2b6]/30 text-xs">
                {filteredAccounts.map((acc) => (
                  <tr key={acc.id} className="hover:bg-[#fff8f5] transition-colors">
                    <td className="p-4 font-bold text-[#211a16]">{acc.name}</td>
                    <td className="p-4 text-[#52443a]">{acc.email}</td>
                    <td className="p-4">
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                          acc.role === "ADMIN"
                            ? "bg-purple-100 text-purple-800"
                            : acc.role === "TEACHER"
                            ? "bg-[#fff1ea] text-[#6d3807] border border-[#ffb782]"
                            : "bg-emerald-100 text-emerald-800"
                        }`}
                      >
                        {acc.role}
                      </span>
                    </td>
                    <td className="p-4 text-[#857469]">{acc.created_at}</td>
                    <td className="p-4 text-[#52443a]">
                      {acc.role === "ADMIN" ? (
                        <span className="text-[#857469] italic">Toàn bộ hệ thống</span>
                      ) : acc.classes_names && acc.classes_names.length > 0 ? (
                        <span className="font-medium text-[#6d3807]">
                          {acc.classes_names.join(", ")}
                        </span>
                      ) : (
                        <span className="text-[#857469] italic">Chưa gán lớp</span>
                      )}
                    </td>
                    <td className="p-4 text-right">
                      {acc.role !== "ADMIN" && (
                        <button
                          onClick={() => setViewingClassesUser(acc)}
                          className="px-3 py-1.5 bg-[#fff8f5] text-[#6d3807] border border-[#d8c2b6] rounded-xl text-xs font-medium hover:bg-[#f9ebe4] inline-flex items-center space-x-1 transition-all"
                        >
                          <BookOpen className="w-3.5 h-3.5 text-[#6d3807]" />
                          <span>Xem Lớp Học</span>
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Modal: Create Account */}
        {showCreateModal && (
          <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 font-sans">
            <div className="bg-white rounded-3xl p-6 md:p-8 max-w-lg w-full shadow-2xl border border-[#d8c2b6] space-y-6 animate-in fade-in zoom-in-95">
              <div className="flex justify-between items-center border-b border-[#d8c2b6]/40 pb-4">
                <h2 className="text-xl font-bold text-[#6d3807] flex items-center space-x-2">
                  <UserPlus className="w-5 h-5 text-[#6d3807]" />
                  <span>Khởi Tạo Tài Khoản Hệ Thống Mới</span>
                </h2>
                <button onClick={() => setShowCreateModal(false)} className="text-[#857469] hover:text-[#211a16]">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleCreateAccount} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold uppercase text-[#211a16] mb-1">
                    Họ &amp; Tên (*)
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ví dụ: Phạm Mỹ Duyên"
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
                    placeholder="user@example.com"
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
                    Vai Trò Hệ Thống (Role)
                  </label>
                  <select
                    value={role}
                    onChange={(e) => setRole(e.target.value)}
                    className="w-full px-3 py-2.5 bg-[#fff8f5] border border-[#d8c2b6] rounded-xl text-sm focus:outline-none focus:border-[#6d3807]"
                  >
                    <option value="STUDENT">STUDENT (Học Viên)</option>
                    <option value="TEACHER">TEACHER (Giáo Viên)</option>
                    <option value="ADMIN">ADMIN (Quản Trị Viên)</option>
                  </select>
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
                    <span>Khởi Tạo Tài Khoản</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal: View User Classes & Direct Interactive Filter */}
        {viewingClassesUser && (
          <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 font-sans">
            <div className="bg-white rounded-3xl p-6 md:p-8 max-w-lg w-full shadow-2xl border border-[#d8c2b6] space-y-6 animate-in fade-in zoom-in-95">
              <div className="flex justify-between items-center border-b border-[#d8c2b6]/40 pb-4">
                <div>
                  <h2 className="text-xl font-bold text-[#6d3807] flex items-center space-x-2">
                    <BookOpen className="w-5 h-5 text-[#6d3807]" />
                    <span>Danh Sách Lớp Học Của {viewingClassesUser.name}</span>
                  </h2>
                  <p className="text-xs text-[#52443a] mt-0.5">
                    {viewingClassesUser.role === "TEACHER" ? "Lớp đang quản lý" : "Lớp đang tham gia học"}
                  </p>
                </div>
                <button onClick={() => setViewingClassesUser(null)} className="text-[#857469] hover:text-[#211a16]">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-3">
                <p className="text-xs text-[#52443a]">
                  Bấm vào tên lớp dưới đây để <strong>lọc trực tiếp</strong> danh sách toàn bộ Thầy cô &amp; Học sinh trong lớp đó:
                </p>

                {viewingClassesUser.class_ids && viewingClassesUser.class_ids.length > 0 ? (
                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {viewingClassesUser.class_ids.map((cId, idx) => {
                      const cName = viewingClassesUser.classes_names?.[idx] || cId;
                      const matchedClass = classList.find((c) => c.id === cId);

                      return (
                        <button
                          key={cId}
                          onClick={() => handleFilterByClass(cId)}
                          className="w-full text-left p-3.5 rounded-xl border border-[#d8c2b6] bg-[#fff8f5] hover:bg-[#fff1ea] hover:border-[#ffb782] transition-all flex items-center justify-between group"
                        >
                          <div>
                            <span className="font-bold text-sm text-[#211a16] group-hover:text-[#6d3807] block">
                              {cName}
                            </span>
                            <span className="text-xs text-[#857469]">Mã Lớp: {matchedClass?.code || cId}</span>
                          </div>
                          <span className="text-xs font-bold text-[#6d3807] group-hover:underline flex items-center">
                            Lọc Lớp Này &rarr;
                          </span>
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <div className="p-6 text-center border-2 border-dashed border-[#d8c2b6] rounded-2xl bg-[#fff8f5]">
                    <p className="text-xs text-[#52443a]">Tài khoản này hiện chưa tham gia hoặc chưa quản lý lớp học nào.</p>
                  </div>
                )}
              </div>

              <div className="pt-2 flex justify-end">
                <button
                  onClick={() => setViewingClassesUser(null)}
                  className="px-5 py-2.5 bg-[#6d3807] text-white rounded-xl text-xs font-medium"
                >
                  Đóng
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
