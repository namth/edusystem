"use client";

import { useState, useEffect, useMemo } from "react";
import AdminLayout from "@/components/AdminLayout";
import { UserPlus, BookOpen, Loader2, CheckCircle2, X, Save, Users, AlertCircle } from "lucide-react";

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
  const [error, setError] = useState<string | null>(null);

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
    setLoading(true);
    setError(null);
    try {
      const [resUsers, resClasses] = await Promise.all([
        fetch("/api/admin/users"),
        fetch("/api/admin/classes"),
      ]);

      const dataUsers = await resUsers.json();
      const dataClasses = await resClasses.json();

      if (!resUsers.ok || !dataUsers.users) {
        setError(dataUsers.error || "Không thể tải danh sách tài khoản.");
        return;
      }
      if (!resClasses.ok || !dataClasses.classes) {
        setError(dataClasses.error || "Không thể tải danh sách lớp học.");
        return;
      }

      const classes: ClassItem[] = dataClasses.classes || [];
      setClassList(classes);

      const classMap: Record<string, string> = {};
      classes.forEach((c) => {
        classMap[c.id] = c.name;
      });

      const formatted: AccountUser[] = (dataUsers.users || []).map((row: any) => {
        let classIds: string[] = [];
        let classNames: string[] = [];

        if (row.role === "TEACHER") {
          const teacherClasses = classes.filter((c) => c.teacher_id === row.id);
          classIds = teacherClasses.map((c) => c.id);
          classNames = teacherClasses.map((c) => c.name);
        } else if (row.role === "STUDENT") {
          classIds = row.class_ids || [];
          classNames = classIds.map((cid) => classMap[cid] || cid);
        }

        return {
          id: row.id,
          name: row.name,
          email: row.email,
          role: row.role,
          phone: row.phone,
          target_band: row.target_band,
          created_at: new Date(row.created_at).toLocaleDateString("vi-VN"),
          class_ids: classIds,
          classes_names: classNames,
        };
      });

      setAccounts(formatted);
    } catch (e: any) {
      console.error(e);
      setError(e.message || "Lỗi hệ thống khi tải danh sách tài khoản.");
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
      const res = await fetch("/api/admin/create-user", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          role,
          email: email.trim(),
          password: password.trim(),
          name: name.trim(),
          phone: role === "TEACHER" ? "0912345679" : "0912345678",
          targetBand: role === "TEACHER" ? "M.A TESOL" : "IELTS 6.5",
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        const rawErr = data.error;
        let errorMsg = "Không thể tạo tài khoản.";
        if (typeof rawErr === "string") {
          errorMsg = rawErr;
        } else if (rawErr && typeof rawErr === "object") {
          errorMsg = rawErr.message || JSON.stringify(rawErr);
        }
        alert("Lỗi khởi tạo tài khoản: " + errorMsg);
        return;
      }

      setSuccessMsg(`Tài khoản "${name}" (${role}) đã được tạo lập thành công!`);
      setShowCreateModal(false);
      setName("");
      setEmail("");
      setPassword("");
      fetchAccountsAndClasses();
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err: any) {
      console.error(err);
      alert("Đã xảy ra lỗi hệ thống khi tạo tài khoản.");
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
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-line/40 pb-6">
          <div>
            <div className="flex items-center space-x-2 text-xs text-brand-800 uppercase tracking-wider font-bold mb-1">
              <Users className="w-4 h-4 text-brand-800" />
              <span>Super Admin &bull; Global User Directory</span>
            </div>
            <h1 className="text-3xl font-bold text-ink tracking-tight">
              Quản Lý Tài Khoản Systems &amp; Phân Lớp
            </h1>
            <p className="text-sm text-ink-muted mt-1">
              Danh sách tài khoản sắp xếp theo thời gian mới nhất, hỗ trợ xem lớp học và lọc trực tiếp danh sách thành viên trong lớp.
            </p>
          </div>

          <button
            onClick={() => setShowCreateModal(true)}
            className="px-5 py-2.5 bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium rounded-xl shadow transition-all flex items-center space-x-2 shrink-0"
          >
            <UserPlus className="w-4 h-4 text-white" />
            <span>Thêm Tài Khoản Mới</span>
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
              onClick={fetchAccountsAndClasses}
              className="px-3 py-1.5 bg-rose-600 text-white rounded-lg text-xs font-medium hover:bg-rose-700"
            >
              Thử lại
            </button>
          </div>
        )}

        {/* Role Filter Tabs & Active Filter Badge */}
        <div className="bg-white p-4 rounded-2xl border border-line shadow-sm flex flex-wrap items-center gap-3">
          <div className="flex bg-surface-alt p-1 rounded-xl border border-line">
            {(["ALL", "ADMIN", "TEACHER", "STUDENT"] as const).map((r) => (
              <button
                key={r}
                onClick={() => setRoleFilter(r)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  roleFilter === r
                    ? "bg-brand-600 text-white shadow-sm"
                    : "text-ink-muted hover:text-brand-600"
                }`}
              >
                {r === "ALL" ? "Tất Cả" : r}
              </button>
            ))}
          </div>

          {activeClassFilter && (
            <div className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-brand-50 border border-brand-300 text-xs text-brand-600 font-bold">
              <BookOpen className="w-3.5 h-3.5 text-brand-600" />
              <span>Đang lọc theo lớp: <strong>{activeClassName}</strong></span>
              <button onClick={clearClassFilter} className="ml-1 hover:text-rose-600">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>

        {/* Accounts Table */}
        {loading ? (
          <div className="flex items-center space-x-2 text-xs text-ink-muted p-12 bg-white rounded-2xl border border-line">
            <Loader2 className="w-4 h-4 animate-spin text-brand-600" />
            <span>Đang nạp danh sách tài khoản từ database...</span>
          </div>
        ) : filteredAccounts.length === 0 ? (
          <div className="p-12 text-center bg-white rounded-2xl border border-line space-y-3">
            <p className="text-xs text-ink-muted">Không tìm thấy tài khoản nào phù hợp với bộ lọc hiện tại.</p>
            {activeClassFilter && (
              <button onClick={clearClassFilter} className="px-3 py-1.5 bg-brand-600 text-white rounded-xl text-xs font-medium">
                Xóa bộ lọc lớp học
              </button>
            )}
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-line shadow-sm overflow-hidden">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="bg-surface-alt border-b border-line text-xs font-bold text-ink-muted">
                  <th className="p-4">Thành Viên (Họ &amp; Tên)</th>
                  <th className="p-4">Email Đăng Nhập</th>
                  <th className="p-4">Vai Trò</th>
                  <th className="p-4">Ngày Tạo</th>
                  <th className="p-4">Lớp Học Liên Quan</th>
                  <th className="p-4 text-right">Thao Tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line/30 text-xs">
                {filteredAccounts.map((acc) => (
                  <tr key={acc.id} className="hover:bg-surface-alt transition-colors">
                    <td className="p-4 font-bold text-ink">{acc.name}</td>
                    <td className="p-4 text-ink-muted">{acc.email}</td>
                    <td className="p-4">
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                          acc.role === "ADMIN"
                            ? "bg-purple-100 text-purple-800"
                            : acc.role === "TEACHER"
                            ? "bg-brand-50 text-brand-600 border border-brand-300"
                            : "bg-emerald-100 text-emerald-800"
                        }`}
                      >
                        {acc.role}
                      </span>
                    </td>
                    <td className="p-4 text-ink-subtle">{acc.created_at}</td>
                    <td className="p-4 text-ink-muted">
                      {acc.role === "ADMIN" ? (
                        <span className="text-ink-subtle italic">Toàn bộ hệ thống</span>
                      ) : acc.classes_names && acc.classes_names.length > 0 ? (
                        <span className="font-medium text-brand-600">
                          {acc.classes_names.join(", ")}
                        </span>
                      ) : (
                        <span className="text-ink-subtle italic">Chưa gán lớp</span>
                      )}
                    </td>
                    <td className="p-4 text-right">
                      {acc.role !== "ADMIN" && (
                        <button
                          onClick={() => setViewingClassesUser(acc)}
                          className="px-3 py-1.5 bg-surface-alt text-brand-600 border border-line rounded-xl text-xs font-medium hover:bg-brand-100 inline-flex items-center space-x-1 transition-all"
                        >
                          <BookOpen className="w-3.5 h-3.5 text-brand-600" />
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
            <div className="bg-white rounded-3xl p-6 md:p-8 max-w-lg w-full shadow-2xl border border-line space-y-6 animate-in fade-in zoom-in-95">
              <div className="flex justify-between items-center border-b border-line/40 pb-4">
                <h2 className="text-xl font-bold text-brand-600 flex items-center space-x-2">
                  <UserPlus className="w-5 h-5 text-brand-600" />
                  <span>Khởi Tạo Tài Khoản Hệ Thống Mới</span>
                </h2>
                <button onClick={() => setShowCreateModal(false)} className="text-ink-subtle hover:text-ink">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleCreateAccount} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold uppercase text-ink mb-1">
                    Họ &amp; Tên (*)
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ví dụ: Phạm Mỹ Duyên"
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
                    placeholder="user@example.com"
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
                    Vai Trò Hệ Thống (Role)
                  </label>
                  <select
                    value={role}
                    onChange={(e) => setRole(e.target.value)}
                    className="w-full px-3 py-2.5 bg-surface-alt border border-line rounded-xl text-sm focus:outline-none focus:border-brand-600"
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
            <div className="bg-white rounded-3xl p-6 md:p-8 max-w-lg w-full shadow-2xl border border-line space-y-6 animate-in fade-in zoom-in-95">
              <div className="flex justify-between items-center border-b border-line/40 pb-4">
                <div>
                  <h2 className="text-xl font-bold text-brand-600 flex items-center space-x-2">
                    <BookOpen className="w-5 h-5 text-brand-600" />
                    <span>Danh Sách Lớp Học Của {viewingClassesUser.name}</span>
                  </h2>
                  <p className="text-xs text-ink-muted mt-0.5">
                    {viewingClassesUser.role === "TEACHER" ? "Lớp đang quản lý" : "Lớp đang tham gia học"}
                  </p>
                </div>
                <button onClick={() => setViewingClassesUser(null)} className="text-ink-subtle hover:text-ink">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-3">
                <p className="text-xs text-ink-muted">
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
                          className="w-full text-left p-3.5 rounded-xl border border-line bg-surface-alt hover:bg-brand-50 hover:border-brand-300 transition-all flex items-center justify-between group"
                        >
                          <div>
                            <span className="font-bold text-sm text-ink group-hover:text-brand-600 block">
                              {cName}
                            </span>
                            <span className="text-xs text-ink-subtle">Mã Lớp: {matchedClass?.code || cId}</span>
                          </div>
                          <span className="text-xs font-bold text-brand-600 group-hover:underline flex items-center">
                            Lọc Lớp Này &rarr;
                          </span>
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <div className="p-6 text-center border-2 border-dashed border-line rounded-2xl bg-surface-alt">
                    <p className="text-xs text-ink-muted">Tài khoản này hiện chưa tham gia hoặc chưa quản lý lớp học nào.</p>
                  </div>
                )}
              </div>

              <div className="pt-2 flex justify-end">
                <button
                  onClick={() => setViewingClassesUser(null)}
                  className="px-5 py-2.5 bg-brand-600 text-white rounded-xl text-xs font-medium"
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
