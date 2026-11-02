"use client";

import { useEffect, useState } from "react";
import AdminLayout from "@/components/AdminLayout";
import {
  Users,
  Search,
  Filter,
  Loader2,
  AlertCircle,
  Phone,
  Mail,
  Calendar,
  RefreshCw,
  CheckCircle,
} from "lucide-react";

interface LeadItem {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  role: "PARENT" | "STUDENT" | "TEACHER" | "CENTER";
  message: string | null;
  status: "NEW" | "CONTACTED" | "DONE";
  source: string;
  ip: string | null;
  created_at: string;
}

const ROLE_LABELS: Record<string, string> = {
  PARENT: "Phụ huynh",
  STUDENT: "Học sinh",
  TEACHER: "Giáo viên",
  CENTER: "Trung tâm",
};

const STATUS_CONFIG: Record<
  string,
  { label: string; badgeClass: string }
> = {
  NEW: { label: "Mới", badgeClass: "bg-blue-50 text-brand-600 border-blue-200" },
  CONTACTED: { label: "Đã liên hệ", badgeClass: "bg-amber-50 text-amber-700 border-amber-200" },
  DONE: { label: "Hoàn tất", badgeClass: "bg-emerald-50 text-emerald-700 border-emerald-200" },
};

export default function AdminLeadsPage() {
  const [leads, setLeads] = useState<LeadItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const fetchLeads = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/leads");
      if (!res.ok) {
        throw new Error("Không thể tải danh sách khách hàng.");
      }
      const data = await res.json();
      if (data.success && Array.isArray(data.leads)) {
        setLeads(data.leads);
      } else {
        throw new Error(data.error || "Lỗi dữ liệu.");
      }
    } catch (err: any) {
      setError(err.message || "Đã xảy ra lỗi khi kết nối máy chủ.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLeads();
  }, []);

  const handleStatusChange = async (id: string, newStatus: string) => {
    setUpdatingId(id);
    try {
      const res = await fetch(`/api/admin/leads/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      const data = await res.json();
      if (res.ok && data.success && data.lead) {
        setLeads((prev) =>
          prev.map((item) => (item.id === id ? { ...item, status: data.lead.status } : item))
        );
      } else {
        alert(data.error || "Không thể cập nhật trạng thái.");
      }
    } catch {
      alert("Đã xảy ra lỗi kết nối khi cập nhật.");
    } finally {
      setUpdatingId(null);
    }
  };

  const filteredLeads = leads.filter((lead) => {
    if (statusFilter !== "ALL" && lead.status !== statusFilter) {
      return false;
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchName = lead.name.toLowerCase().includes(q);
      const matchPhone = lead.phone?.toLowerCase().includes(q);
      const matchEmail = lead.email?.toLowerCase().includes(q);
      return matchName || matchPhone || matchEmail;
    }
    return true;
  });

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-ink">Liên Hệ Từ Website</h1>
            <p className="text-sm text-ink-muted mt-1">
              Danh sách liên hệ từ form landing page KitoKit
            </p>
          </div>
          <button
            onClick={fetchLeads}
            disabled={loading}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-surface border border-line text-xs font-semibold text-ink-muted hover:text-brand-600 hover:border-brand-300 transition-colors cursor-pointer w-fit"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            Làm mới
          </button>
        </div>

        {/* Filter bar */}
        <div className="bg-surface rounded-2xl p-4 border border-line shadow-xs flex flex-col md:flex-row gap-4 items-stretch md:items-center justify-between">
          <div className="flex items-center gap-2 overflow-x-auto pb-1 md:pb-0">
            <span className="text-xs font-semibold text-ink-muted mr-1 flex items-center gap-1">
              <Filter className="w-3.5 h-3.5" /> Lọc:
            </span>
            {["ALL", "NEW", "CONTACTED", "DONE"].map((s) => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer whitespace-nowrap ${
                  statusFilter === s
                    ? "bg-brand-600 text-white shadow-xs"
                    : "bg-surface-alt text-ink-muted hover:bg-brand-50 hover:text-brand-600"
                }`}
              >
                {s === "ALL" ? "Tất cả" : STATUS_CONFIG[s]?.label || s}
                <span className="ml-1.5 opacity-80 text-[10px]">
                  (
                  {s === "ALL"
                    ? leads.length
                    : leads.filter((item) => item.status === s).length}
                  )
                </span>
              </button>
            ))}
          </div>

          <div className="relative min-w-[240px]">
            <Search className="w-4 h-4 text-ink-subtle absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Tìm theo tên, SĐT, email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-surface-alt border border-line rounded-xl focus:outline-none focus:border-brand-600 text-ink placeholder-ink-subtle"
            />
          </div>
        </div>

        {/* Table & States */}
        {loading ? (
          <div className="bg-surface rounded-2xl border border-line p-12 flex flex-col items-center justify-center text-ink-muted">
            <Loader2 className="w-8 h-8 animate-spin text-brand-600 mb-3" />
            <p className="text-xs font-semibold">Đang tải danh sách khách hàng...</p>
          </div>
        ) : error ? (
          <div className="bg-rose-50 border border-rose-200 rounded-2xl p-6 text-rose-800 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-bold">Lỗi tải dữ liệu</p>
              <p className="text-xs mt-1">{error}</p>
              <button
                onClick={fetchLeads}
                className="mt-3 text-xs font-bold text-rose-700 underline cursor-pointer"
              >
                Thử lại
              </button>
            </div>
          </div>
        ) : filteredLeads.length === 0 ? (
          <div className="bg-surface rounded-2xl border border-line p-12 text-center text-ink-muted">
            <Users className="w-10 h-10 text-ink-subtle mx-auto mb-3" />
            <p className="text-sm font-bold text-ink">Chưa có liên hệ nào từ website</p>
            <p className="text-xs text-ink-subtle mt-1">
              {searchQuery || statusFilter !== "ALL"
                ? "Không tìm thấy kết quả phù hợp với bộ lọc hiện tại."
                : "Khi người dùng gửi form trên landing page, thông tin sẽ hiển thị tại đây."}
            </p>
          </div>
        ) : (
          <div className="bg-surface rounded-2xl border border-line shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-surface-alt border-b border-line text-ink-muted uppercase font-bold text-[11px]">
                  <tr>
                    <th className="py-3 px-4">Họ và tên</th>
                    <th className="py-3 px-4">Liên hệ</th>
                    <th className="py-3 px-4">Vai trò</th>
                    <th className="py-3 px-4 min-w-[200px]">Lời nhắn</th>
                    <th className="py-3 px-4">Thời gian</th>
                    <th className="py-3 px-4 text-center">Trạng thái</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line text-ink">
                  {filteredLeads.map((lead) => (
                    <tr key={lead.id} className="hover:bg-brand-50/40 transition-colors">
                      <td className="py-3.5 px-4 font-bold text-ink">{lead.name}</td>
                      <td className="py-3.5 px-4">
                        <div className="space-y-1">
                          {lead.phone && (
                            <div className="flex items-center gap-1.5 text-ink-muted">
                              <Phone className="w-3.5 h-3.5 text-brand-600 shrink-0" />
                              <a
                                href={`tel:${lead.phone}`}
                                className="hover:text-brand-600 font-medium font-mono"
                              >
                                {lead.phone}
                              </a>
                            </div>
                          )}
                          {lead.email && (
                            <div className="flex items-center gap-1.5 text-ink-muted">
                              <Mail className="w-3.5 h-3.5 text-brand-600 shrink-0" />
                              <a
                                href={`mailto:${lead.email}`}
                                className="hover:text-brand-600 font-medium"
                              >
                                {lead.email}
                              </a>
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="inline-block px-2.5 py-1 rounded-full text-[11px] font-semibold bg-surface-alt border border-line text-ink">
                          {ROLE_LABELS[lead.role] || lead.role}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-ink-muted max-w-xs break-words">
                        {lead.message ? (
                          lead.message
                        ) : (
                          <span className="text-ink-subtle italic">Không có lời nhắn</span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-ink-subtle whitespace-nowrap">
                        <div className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          <span>
                            {lead.created_at
                              ? new Date(lead.created_at).toLocaleString("vi-VN", {
                                  dateStyle: "short",
                                  timeStyle: "short",
                                })
                              : "—"}
                          </span>
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <select
                          disabled={updatingId === lead.id}
                          value={lead.status}
                          onChange={(e) => handleStatusChange(lead.id, e.target.value)}
                          className={`text-xs font-bold px-2.5 py-1.5 rounded-lg border cursor-pointer focus:outline-none focus:ring-2 focus:ring-brand-400 ${
                            STATUS_CONFIG[lead.status]?.badgeClass || "border-line"
                          }`}
                        >
                          <option value="NEW">Mới</option>
                          <option value="CONTACTED">Đã liên hệ</option>
                          <option value="DONE">Hoàn tất</option>
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
