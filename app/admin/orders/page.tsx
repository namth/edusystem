"use client";

import { Suspense, useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import AdminLayout from "@/components/AdminLayout";
import { VIETQR_BANKS, findBankByBin } from "@/lib/vietqr-banks";
import { buildVietQrPayload } from "@/lib/vietqr";
import QRCode from "qrcode";
import {
  Search,
  Filter,
  CheckCircle2,
  XCircle,
  Ban,
  Eye,
  Loader2,
  AlertCircle,
  Settings,
  CreditCard,
  QrCode,
  X,
} from "lucide-react";

interface OrderItem {
  id: string;
  code: string;
  teacher_id: string;
  teacher_name: string;
  teacher_email: string;
  requested_slots: number;
  unit_price: number;
  total_cost: number;
  status: "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED";
  source: "TEACHER" | "ADMIN";
  note: string | null;
  payment_reported_at: string | null;
  decided_at: string | null;
  reject_reason: string | null;
  created_at: string;
}

interface Counts {
  PENDING: number;
  APPROVED: number;
  REJECTED: number;
  CANCELLED: number;
}

function OrdersContent() {
  const searchParams = useSearchParams();
  const initialStatus = searchParams.get("status") || "";
  const initialQ = searchParams.get("q") || "";

  const [activeTab, setActiveTab] = useState<"orders" | "settings">("orders");

  // Bộ lọc danh sách đơn
  const [statusFilter, setStatusFilter] = useState<string>(initialStatus);
  const [sourceFilter, setSourceFilter] = useState<string>("");
  const [searchTerm, setSearchTerm] = useState<string>(initialQ);

  const [orders, setOrders] = useState<OrderItem[]>([]);
  const [counts, setCounts] = useState<Counts>({
    PENDING: 0,
    APPROVED: 0,
    REJECTED: 0,
    CANCELLED: 0,
  });
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  // Modal từ chối
  const [rejectingOrder, setRejectingOrder] = useState<OrderItem | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [rejectError, setRejectError] = useState<string | null>(null);
  const [isRejecting, setIsRejecting] = useState(false);

  // Thao tác duyệt / huỷ
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  // Cấu hình thanh toán
  const [paymentConfig, setPaymentConfig] = useState({
    bank_bin: "",
    bank_name: "",
    account_no: "",
    account_name: "",
  });
  const [unitPriceVnd, setUnitPriceVnd] = useState<number>(0);
  const [settingsLoading, setSettingsLoading] = useState(false);
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [settingsError, setSettingsError] = useState<string | null>(null);
  const [settingsSuccess, setSettingsSuccess] = useState<string | null>(null);
  const [previewQrUrl, setPreviewQrUrl] = useState<string | null>(null);

  // Tải danh sách đơn hàng
  const fetchOrders = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const params = new URLSearchParams();
      if (statusFilter) params.append("status", statusFilter);
      if (sourceFilter) params.append("source", sourceFilter);
      if (searchTerm.trim()) params.append("q", searchTerm.trim());

      const res = await fetch(`/api/admin/orders?${params.toString()}`);
      const data = await res.json();
      if (!res.ok || !data.success) {
        setErrorMsg(data.error || "Không thể tải danh sách đơn hàng.");
        return;
      }
      setOrders(data.orders || []);
      if (data.counts) {
        setCounts(data.counts);
      }
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || "Lỗi kết nối khi tải danh sách đơn.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === "orders") {
      fetchOrders();
    }
  }, [statusFilter, sourceFilter, activeTab]);

  // Tải cấu hình thanh toán
  const fetchSettings = async () => {
    setSettingsLoading(true);
    setSettingsError(null);
    try {
      const res = await fetch("/api/admin/settings/payment");
      const data = await res.json();
      if (res.ok && data.success) {
        if (data.payment_account) {
          setPaymentConfig({
            bank_bin: data.payment_account.bank_bin || "",
            bank_name: data.payment_account.bank_name || "",
            account_no: data.payment_account.account_no || "",
            account_name: data.payment_account.account_name || "",
          });
        }
        if (data.slot_pricing && typeof data.slot_pricing.unit_price_vnd === "number") {
          setUnitPriceVnd(data.slot_pricing.unit_price_vnd);
        }
      }
    } catch (err: any) {
      console.error(err);
      setSettingsError("Lỗi kết nối khi tải cấu hình thanh toán.");
    } finally {
      setSettingsLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === "settings") {
      fetchSettings();
    }
  }, [activeTab]);

  // Vẽ QR xem trước khi cấu hình thay đổi
  useEffect(() => {
    if (
      paymentConfig.bank_bin &&
      /^\d{6}$/.test(paymentConfig.bank_bin) &&
      paymentConfig.account_no &&
      /^\d{6,19}$/.test(paymentConfig.account_no)
    ) {
      try {
        const payload = buildVietQrPayload({
          bankBin: paymentConfig.bank_bin,
          accountNo: paymentConfig.account_no,
          amount: 10000,
          addInfo: "KITOKIT TEST",
        });
        QRCode.toDataURL(payload, { width: 220, margin: 2 })
          .then((url) => setPreviewQrUrl(url))
          .catch(() => setPreviewQrUrl(null));
      } catch {
        setPreviewQrUrl(null);
      }
    } else {
      setPreviewQrUrl(null);
    }
  }, [paymentConfig.bank_bin, paymentConfig.account_no]);

  // Xử lý tìm kiếm bằng Enter
  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchOrders();
  };

  // Duyệt đơn
  const handleApprove = async (id: string) => {
    const ok = window.confirm("Xác nhận DUYỆT đơn hàng này và cộng slot cho giáo viên?");
    if (!ok) return;

    setActionLoadingId(id);
    setActionSuccess(null);
    setErrorMsg(null);
    try {
      const res = await fetch(`/api/admin/orders/${id}/approve`, { method: "POST" });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setErrorMsg(data.error || "Không thể duyệt đơn hàng.");
        return;
      }
      setActionSuccess("Đã duyệt đơn hàng thành công!");
      fetchOrders();
      setTimeout(() => setActionSuccess(null), 4000);
    } catch (err: any) {
      console.error(err);
      setErrorMsg("Lỗi kết nối khi duyệt đơn hàng.");
    } finally {
      setActionLoadingId(null);
    }
  };

  // Huỷ đơn
  const handleCancel = async (id: string) => {
    const ok = window.confirm("Xác nhận HUỶ đơn hàng này?");
    if (!ok) return;

    setActionLoadingId(id);
    setActionSuccess(null);
    setErrorMsg(null);
    try {
      const res = await fetch(`/api/orders/${id}/cancel`, { method: "POST" });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setErrorMsg(data.error || "Không thể huỷ đơn hàng.");
        return;
      }
      setActionSuccess("Đã huỷ đơn hàng thành công!");
      fetchOrders();
      setTimeout(() => setActionSuccess(null), 4000);
    } catch (err: any) {
      console.error(err);
      setErrorMsg("Lỗi kết nối khi huỷ đơn hàng.");
    } finally {
      setActionLoadingId(null);
    }
  };

  // Mở modal từ chối
  const openRejectModal = (order: OrderItem) => {
    setRejectingOrder(order);
    setRejectReason("");
    setRejectError(null);
  };

  // Xác nhận từ chối
  const handleConfirmReject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rejectingOrder) return;
    if (!rejectReason.trim()) {
      setRejectError("Vui lòng nhập lý do từ chối.");
      return;
    }

    setIsRejecting(true);
    setRejectError(null);
    try {
      const res = await fetch(`/api/admin/orders/${rejectingOrder.id}/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: rejectReason.trim() }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setRejectError(data.error || "Không thể từ chối đơn hàng.");
        return;
      }
      setRejectingOrder(null);
      setActionSuccess("Đã từ chối đơn hàng.");
      fetchOrders();
      setTimeout(() => setActionSuccess(null), 4000);
    } catch (err: any) {
      console.error(err);
      setRejectError("Lỗi kết nối khi gửi lý do từ chối.");
    } finally {
      setIsRejecting(false);
    }
  };

  // Lưu cấu hình thanh toán
  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSettingsSaving(true);
    setSettingsError(null);
    setSettingsSuccess(null);

    try {
      const res = await fetch("/api/admin/settings/payment", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          payment_account: {
            bank_bin: paymentConfig.bank_bin,
            bank_name: paymentConfig.bank_name,
            account_no: paymentConfig.account_no,
            account_name: paymentConfig.account_name,
          },
          slot_pricing: {
            unit_price_vnd: unitPriceVnd,
          },
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        setSettingsError(data.error || "Lưu cấu hình thanh toán thất bại.");
        return;
      }

      setSettingsSuccess("Đã lưu cấu hình thanh toán VietQR và đơn giá slot thành công!");
      setTimeout(() => setSettingsSuccess(null), 4000);
    } catch (err: any) {
      console.error(err);
      setSettingsError("Lỗi kết nối khi lưu cấu hình.");
    } finally {
      setSettingsSaving(false);
    }
  };

  // Chọn ngân hàng
  const handleBankSelect = (bin: string) => {
    const bank = findBankByBin(bin);
    if (bank) {
      setPaymentConfig((prev) => ({
        ...prev,
        bank_bin: bank.bin,
        bank_name: bank.short_name,
      }));
    } else {
      setPaymentConfig((prev) => ({
        ...prev,
        bank_bin: bin,
      }));
    }
  };

  const totalOrdersCount =
    counts.PENDING + counts.APPROVED + counts.REJECTED + counts.CANCELLED;

  return (
    <div className="max-w-[1280px] mx-auto space-y-6 font-sans">
      {/* Header */}
      <div className="border-b border-line/40 pb-4 flex flex-col sm:flex-row justify-between sm:items-center gap-4">
        <div>
          <h1 className="font-headline text-3xl font-bold text-ink tracking-tight">
            Quản trị đơn hàng mua slot
          </h1>
          <p className="text-sm text-ink-muted mt-0.5">
            Phê duyệt thanh toán VietQR và cấu hình tài khoản nhận tiền hệ thống.
          </p>
        </div>

        {/* Tab switcher */}
        <div className="flex bg-surface-alt p-1 rounded-2xl border border-line">
          <button
            type="button"
            onClick={() => setActiveTab("orders")}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
              activeTab === "orders"
                ? "bg-white text-brand-600 shadow-sm"
                : "text-ink-muted hover:text-ink"
            }`}
          >
            <CreditCard className="w-4 h-4" />
            <span>Đơn hàng</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("settings")}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
              activeTab === "settings"
                ? "bg-white text-brand-600 shadow-sm"
                : "text-ink-muted hover:text-ink"
            }`}
          >
            <Settings className="w-4 h-4" />
            <span>Cấu hình thanh toán</span>
          </button>
        </div>
      </div>

      {/* Thông báo */}
      {actionSuccess && (
        <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 flex items-center space-x-2">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          <span className="font-semibold text-xs leading-relaxed">{actionSuccess}</span>
        </div>
      )}

      {errorMsg && (
        <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
            <span className="font-semibold text-xs leading-relaxed">{errorMsg}</span>
          </div>
          <button
            onClick={fetchOrders}
            className="px-3 py-1.5 bg-rose-600 text-white rounded-lg text-xs font-medium hover:bg-rose-700"
          >
            Thử lại
          </button>
        </div>
      )}

      {/* TAB 1: ĐƠN HÀNG */}
      {activeTab === "orders" && (
        <div className="space-y-6">
          {/* Bộ lọc trạng thái & tìm kiếm */}
          <div className="bg-white p-4 rounded-3xl border border-line shadow-sm space-y-4">
            {/* Lọc trạng thái tabs */}
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setStatusFilter("")}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                  statusFilter === ""
                    ? "bg-brand-600 text-white shadow"
                    : "bg-surface-alt text-ink-muted hover:bg-brand-50 hover:text-brand-600 border border-line"
                }`}
              >
                Tất cả ({totalOrdersCount})
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter("PENDING")}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                  statusFilter === "PENDING"
                    ? "bg-amber-600 text-white shadow"
                    : "bg-surface-alt text-amber-800 hover:bg-amber-50 border border-amber-200"
                }`}
              >
                Chờ xử lý ({counts.PENDING})
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter("APPROVED")}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                  statusFilter === "APPROVED"
                    ? "bg-emerald-600 text-white shadow"
                    : "bg-surface-alt text-emerald-800 hover:bg-emerald-50 border border-emerald-200"
                }`}
              >
                Đã duyệt ({counts.APPROVED})
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter("REJECTED")}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                  statusFilter === "REJECTED"
                    ? "bg-rose-600 text-white shadow"
                    : "bg-surface-alt text-rose-800 hover:bg-rose-50 border border-rose-200"
                }`}
              >
                Từ chối ({counts.REJECTED})
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter("CANCELLED")}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                  statusFilter === "CANCELLED"
                    ? "bg-rose-700 text-white shadow"
                    : "bg-surface-alt text-rose-900 hover:bg-rose-50 border border-line"
                }`}
              >
                Đã huỷ ({counts.CANCELLED})
              </button>
            </div>

            {/* Hàng 2: Tìm kiếm và Lọc Nguồn */}
            <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
              <form onSubmit={handleSearchSubmit} className="flex-1 w-full flex gap-2">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 text-ink-subtle absolute left-3 top-3" />
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Tìm theo mã đơn (KK...), tên hoặc email giáo viên..."
                    className="w-full pl-9 pr-4 py-2 bg-surface-alt border border-line rounded-xl text-xs text-ink focus:outline-none focus:border-brand-600"
                  />
                </div>
                <button
                  type="submit"
                  className="px-4 py-2 bg-brand-600 text-white rounded-xl text-xs font-bold hover:bg-brand-700 transition-colors"
                >
                  Tìm
                </button>
              </form>

              <div className="flex items-center gap-2 w-full sm:w-auto">
                <Filter className="w-4 h-4 text-ink-subtle" />
                <span className="text-xs text-ink-muted whitespace-nowrap">Nguồn:</span>
                <select
                  value={sourceFilter}
                  onChange={(e) => setSourceFilter(e.target.value)}
                  className="px-3 py-2 bg-surface-alt border border-line rounded-xl text-xs text-ink focus:outline-none focus:border-brand-600"
                >
                  <option value="">Tất cả nguồn</option>
                  <option value="TEACHER">Giáo viên</option>
                  <option value="ADMIN">Admin</option>
                </select>
              </div>
            </div>
          </div>

          {/* Bảng đơn hàng */}
          <div className="bg-white rounded-3xl border border-line shadow-sm overflow-hidden">
            {loading ? (
              <div className="p-12 text-center space-y-2">
                <Loader2 className="w-6 h-6 animate-spin text-brand-600 mx-auto" />
                <p className="text-xs text-ink-muted">Đang tải danh sách đơn hàng...</p>
              </div>
            ) : orders.length === 0 ? (
              <div className="p-12 text-center space-y-2">
                <p className="text-xs text-ink-muted">Không có đơn hàng nào khớp với bộ lọc.</p>
                <button
                  type="button"
                  onClick={fetchOrders}
                  className="px-3 py-1.5 bg-brand-600 text-white rounded-xl text-xs font-bold"
                >
                  Tải lại
                </button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="bg-surface-alt border-b border-line text-ink-muted font-bold uppercase tracking-wider">
                      <th className="p-3.5">Mã đơn</th>
                      <th className="p-3.5">Giáo viên</th>
                      <th className="p-3.5 text-right">Số slot</th>
                      <th className="p-3.5 text-right">Số tiền</th>
                      <th className="p-3.5 text-center">Nguồn</th>
                      <th className="p-3.5 text-center">Trạng thái</th>
                      <th className="p-3.5">Báo CK lúc</th>
                      <th className="p-3.5">Ngày tạo</th>
                      <th className="p-3.5 text-right">Thao tác</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line/30">
                    {orders.map((o) => {
                      const isPending = o.status === "PENDING";
                      return (
                        <tr key={o.id} className="hover:bg-surface-alt transition-colors">
                          <td className="p-3.5 font-mono font-bold text-brand-600">
                            <Link
                              href={`/admin/orders/${o.id}`}
                              className="hover:underline flex items-center gap-1"
                            >
                              <span>{o.code}</span>
                            </Link>
                          </td>
                          <td className="p-3.5">
                            <div className="font-bold text-ink">{o.teacher_name}</div>
                            <div className="text-[11px] text-ink-subtle">{o.teacher_email}</div>
                          </td>
                          <td className="p-3.5 text-right font-bold text-brand-600">
                            +{o.requested_slots.toLocaleString("vi-VN")}
                          </td>
                          <td className="p-3.5 text-right font-bold text-ink">
                            {o.total_cost.toLocaleString("vi-VN")} đ
                          </td>
                          <td className="p-3.5 text-center">
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                o.source === "ADMIN"
                                  ? "bg-purple-100 text-purple-800"
                                  : "bg-surface-alt text-ink-muted border border-line"
                              }`}
                            >
                              {o.source === "ADMIN" ? "Admin" : "Giáo viên"}
                            </span>
                          </td>
                          <td className="p-3.5 text-center">
                            {o.status === "PENDING" ? (
                              o.payment_reported_at ? (
                                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-brand-100 text-brand-700 border border-brand-200">
                                  Đã báo CK
                                </span>
                              ) : (
                                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800">
                                  Chờ thanh toán
                                </span>
                              )
                            ) : o.status === "APPROVED" ? (
                              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                                Đã duyệt
                              </span>
                            ) : o.status === "REJECTED" ? (
                              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800">
                                Từ chối
                              </span>
                            ) : (
                              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800">
                                Đã huỷ
                              </span>
                            )}
                          </td>
                          <td className="p-3.5 text-[11px] text-ink-subtle">
                            {o.payment_reported_at
                              ? new Date(o.payment_reported_at).toLocaleString("vi-VN")
                              : "—"}
                          </td>
                          <td className="p-3.5 text-[11px] text-ink-subtle">
                            {new Date(o.created_at).toLocaleDateString("vi-VN")}
                          </td>
                          <td className="p-3.5 text-right space-x-1 whitespace-nowrap">
                            <Link
                              href={`/admin/orders/${o.id}`}
                              className="inline-flex items-center px-2.5 py-1 text-[11px] font-medium text-brand-600 hover:text-brand-700 hover:bg-brand-50 rounded-lg border border-line transition-colors"
                            >
                              <Eye className="w-3 h-3 mr-1" />
                              <span>Xem</span>
                            </Link>

                            {isPending && (
                              <>
                                <button
                                  type="button"
                                  disabled={actionLoadingId === o.id}
                                  onClick={() => handleApprove(o.id)}
                                  className="inline-flex items-center px-2.5 py-1 text-[11px] font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-sm transition-all disabled:opacity-50"
                                >
                                  {actionLoadingId === o.id ? (
                                    <Loader2 className="w-3 h-3 animate-spin mr-1" />
                                  ) : (
                                    <CheckCircle2 className="w-3 h-3 mr-1" />
                                  )}
                                  <span>Duyệt</span>
                                </button>

                                <button
                                  type="button"
                                  disabled={actionLoadingId === o.id}
                                  onClick={() => openRejectModal(o)}
                                  className="inline-flex items-center px-2.5 py-1 text-[11px] font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-lg shadow-sm transition-all disabled:opacity-50"
                                >
                                  <XCircle className="w-3 h-3 mr-1" />
                                  <span>Từ chối</span>
                                </button>

                                <button
                                  type="button"
                                  disabled={actionLoadingId === o.id}
                                  onClick={() => handleCancel(o.id)}
                                  className="inline-flex items-center px-2.5 py-1 text-[11px] font-bold text-rose-700 bg-surface-alt hover:bg-rose-50 border border-line rounded-lg transition-all disabled:opacity-50"
                                >
                                  <Ban className="w-3 h-3 mr-1 text-rose-700" />
                                  <span>Huỷ</span>
                                </button>
                              </>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: CẤU HÌNH THANH TOÁN */}
      {activeTab === "settings" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          <div className="lg:col-span-7 bg-white p-6 md:p-8 rounded-3xl border border-line shadow-sm space-y-6">
            <h2 className="text-lg font-bold text-brand-600 flex items-center gap-2">
              <Settings className="w-5 h-5 text-brand-600" />
              <span>Cấu hình thanh toán VietQR &amp; Đơn giá</span>
            </h2>

            {settingsSuccess && (
              <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 flex items-center space-x-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                <span className="text-xs font-bold">{settingsSuccess}</span>
              </div>
            )}

            {settingsError && (
              <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 flex items-center space-x-2">
                <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
                <span className="text-xs font-bold">{settingsError}</span>
              </div>
            )}

            {settingsLoading ? (
              <div className="p-8 text-center space-y-2">
                <Loader2 className="w-5 h-5 animate-spin text-brand-600 mx-auto" />
                <p className="text-xs text-ink-muted">Đang tải cấu hình...</p>
              </div>
            ) : (
              <form onSubmit={handleSaveSettings} className="space-y-4">
                {/* Chọn ngân hàng */}
                <div>
                  <label className="block text-xs font-bold uppercase text-ink mb-1">
                    Ngân hàng thụ hưởng (VietQR)
                  </label>
                  <select
                    value={paymentConfig.bank_bin}
                    onChange={(e) => handleBankSelect(e.target.value)}
                    className="w-full px-3 py-2.5 bg-surface-alt border border-line rounded-xl text-xs focus:outline-none focus:border-brand-600"
                  >
                    <option value="">-- Chọn ngân hàng --</option>
                    {VIETQR_BANKS.map((b) => (
                      <option key={b.bin} value={b.bin}>
                        {b.short_name} ({b.bin}) — {b.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Tên ngân hàng & Mã BIN */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold uppercase text-ink mb-1">Mã BIN (6 số)</label>
                    <input
                      type="text"
                      maxLength={6}
                      value={paymentConfig.bank_bin}
                      onChange={(e) => setPaymentConfig({ ...paymentConfig, bank_bin: e.target.value })}
                      placeholder="VD: 970436"
                      className="w-full px-3 py-2 bg-surface-alt border border-line rounded-xl text-xs font-mono focus:outline-none focus:border-brand-600"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold uppercase text-ink mb-1">Tên ngắn gọn</label>
                    <input
                      type="text"
                      value={paymentConfig.bank_name}
                      onChange={(e) => setPaymentConfig({ ...paymentConfig, bank_name: e.target.value })}
                      placeholder="VD: Vietcombank"
                      className="w-full px-3 py-2 bg-surface-alt border border-line rounded-xl text-xs focus:outline-none focus:border-brand-600"
                    />
                  </div>
                </div>

                {/* Số tài khoản */}
                <div>
                  <label className="block text-xs font-bold uppercase text-ink mb-1">
                    Số tài khoản nhận tiền
                  </label>
                  <input
                    type="text"
                    value={paymentConfig.account_no}
                    onChange={(e) => setPaymentConfig({ ...paymentConfig, account_no: e.target.value })}
                    placeholder="VD: 1012345678"
                    className="w-full px-3 py-2.5 bg-surface-alt border border-line rounded-xl text-xs font-mono focus:outline-none focus:border-brand-600"
                  />
                </div>

                {/* Chủ tài khoản */}
                <div>
                  <label className="block text-xs font-bold uppercase text-ink mb-1">
                    Tên chủ tài khoản (in hoa không dấu)
                  </label>
                  <input
                    type="text"
                    value={paymentConfig.account_name}
                    onChange={(e) =>
                      setPaymentConfig({ ...paymentConfig, account_name: e.target.value.toUpperCase() })
                    }
                    placeholder="VD: CONG TY TNHH KITOKIT"
                    className="w-full px-3 py-2.5 bg-surface-alt border border-line rounded-xl text-xs font-bold uppercase focus:outline-none focus:border-brand-600"
                  />
                  <p className="text-[10px] text-ink-subtle mt-0.5">
                    Gợi ý: Nhập in hoa không dấu theo đúng chuẩn ngân hàng.
                  </p>
                </div>

                {/* Đơn giá 1 slot */}
                <div className="pt-2 border-t border-line/40">
                  <label className="block text-xs font-bold uppercase text-ink mb-1">
                    Đơn giá 1 slot học sinh (VND)
                  </label>
                  <input
                    type="number"
                    min={0}
                    step={1000}
                    value={unitPriceVnd}
                    onChange={(e) => setUnitPriceVnd(Number(e.target.value))}
                    className="w-full px-3 py-2.5 bg-surface-alt border border-line rounded-xl text-xs font-bold focus:outline-none focus:border-brand-600"
                  />
                  <p className="text-[10px] text-ink-subtle mt-0.5">
                    Số tiền VND cho 1 slot học sinh khi giáo viên tự tạo đơn.
                  </p>
                </div>

                <div className="pt-3">
                  <button
                    type="submit"
                    disabled={settingsSaving}
                    className="w-full py-3 bg-brand-600 hover:bg-brand-700 text-white rounded-xl text-xs font-bold shadow flex items-center justify-center space-x-2 transition-all disabled:opacity-50"
                  >
                    {settingsSaving ? (
                      <Loader2 className="w-4 h-4 animate-spin text-white" />
                    ) : (
                      <span>Lưu cấu hình</span>
                    )}
                  </button>
                </div>
              </form>
            )}
          </div>

          {/* Cột xem trước QR mẫu */}
          <div className="lg:col-span-5 bg-white p-6 md:p-8 rounded-3xl border border-line shadow-sm space-y-4 text-center">
            <h3 className="text-sm font-bold uppercase tracking-wider text-ink-muted flex items-center justify-center gap-1.5">
              <QrCode className="w-4 h-4 text-brand-600" />
              <span>Xem trước QR mẫu (10.000đ)</span>
            </h3>

            <div className="p-4 bg-surface-alt rounded-2xl border border-line flex flex-col items-center justify-center min-h-[260px]">
              {previewQrUrl ? (
                <img
                  src={previewQrUrl}
                  alt="QR mẫu VietQR"
                  className="w-[200px] h-[200px] rounded-xl border border-line bg-white p-2 object-contain"
                />
              ) : (
                <div className="text-xs text-ink-muted">
                  Điền đủ Mã BIN và Số tài khoản để hiển thị mã QR mẫu.
                </div>
              )}
            </div>

            <div className="text-xs text-ink-subtle space-y-1">
              <p>Nội dung chuyển khoản mẫu: <strong className="text-ink">KITOKIT TEST</strong></p>
              <p>Số tiền mẫu: <strong className="text-brand-600">10.000 đ</strong></p>
            </div>
          </div>
        </div>
      )}

      {/* Modal từ chối đơn hàng */}
      {rejectingOrder && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl border border-line space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex justify-between items-center border-b border-line/40 pb-3">
              <h3 className="text-base font-bold text-ink">
                Từ chối đơn hàng {rejectingOrder.code}
              </h3>
              <button
                type="button"
                onClick={() => setRejectingOrder(null)}
                className="text-ink-subtle hover:text-ink"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {rejectError && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs">
                {rejectError}
              </div>
            )}

            <form onSubmit={handleConfirmReject} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-ink mb-1">
                  Lý do từ chối (bắt buộc, tối đa 500 ký tự)
                </label>
                <textarea
                  required
                  rows={3}
                  maxLength={500}
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  placeholder="Nhập lý do từ chối để gửi thông báo cho giáo viên..."
                  className="w-full px-3 py-2 bg-surface-alt border border-line rounded-xl text-xs focus:outline-none focus:border-brand-600"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setRejectingOrder(null)}
                  className="px-4 py-2 border border-line rounded-xl text-xs font-medium text-ink-muted hover:bg-surface-alt"
                >
                  Huỷ
                </button>
                <button
                  type="submit"
                  disabled={isRejecting}
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold disabled:opacity-50"
                >
                  {isRejecting ? "Đang xử lý..." : "Xác nhận từ chối"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default function AdminOrdersPage() {
  return (
    <AdminLayout>
      <Suspense
        fallback={
          <div className="p-12 text-center text-xs text-ink-muted">
            <Loader2 className="w-5 h-5 animate-spin mx-auto text-brand-600 mb-2" />
            <span>Đang nạp trang quản lý đơn hàng...</span>
          </div>
        }
      >
        <OrdersContent />
      </Suspense>
    </AdminLayout>
  );
}
