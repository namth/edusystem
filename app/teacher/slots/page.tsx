"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import TeacherLayout from "@/components/TeacherLayout";
import { useAuth } from "@/context/AuthContext";
import { SlotLedgerTable } from "@/components/slots/SlotLedgerTable";
import {
  CreditCard,
  HelpCircle,
  Loader2,
  ArrowRight,
  AlertCircle,
  AlertTriangle,
  ExternalLink,
  Wallet,
  GraduationCap,
} from "lucide-react";

interface SlotOrder {
  id: string;
  code?: string;
  requested_slots: number;
  total_cost: number;
  status: "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED";
  created_at: string;
}

interface WalletClass {
  id: string;
  name: string;
  billing_status: "ACTIVE" | "GRACE" | "LOCKED" | "ENDED" | string;
  start_date: string | null;
  next_charge_at: string | null;
  grace_until: string | null;
  student_count: number;
  enough_for_next: boolean;
}

interface WalletData {
  balance: number;
  unit_price_vnd: number;
  total_next_needed: number;
  classes: WalletClass[];
}

export default function TeacherSlotsPage() {
  const router = useRouter();
  const { user } = useAuth();
  const buySectionRef = useRef<HTMLDivElement>(null);

  const [wallet, setWallet] = useState<WalletData | null>(null);
  const [requests, setRequests] = useState<SlotOrder[]>([]);
  const [newSlots, setNewSlots] = useState(50);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [loadingWallet, setLoadingWallet] = useState(true);
  const [loadingOrders, setLoadingOrders] = useState(true);

  const formatDateVN = (dateStr: string | null) => {
    if (!dateStr) return "—";
    try {
      const parts = dateStr.split("T")[0].split("-");
      if (parts.length === 3) {
        return `${parts[2]}/${parts[1]}/${parts[0]}`;
      }
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      const day = String(d.getDate()).padStart(2, "0");
      const month = String(d.getMonth() + 1).padStart(2, "0");
      const year = d.getFullYear();
      return `${day}/${month}/${year}`;
    } catch {
      return dateStr;
    }
  };

  const fetchWallet = async () => {
    try {
      setLoadingWallet(true);
      setErrorMsg(null);
      const res = await fetch("/api/teacher/slot-wallet");
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || "Không thể tải dữ liệu ví slot.");
      }
      const data = await res.json();
      setWallet({
        balance: Number(data.balance ?? 0),
        unit_price_vnd: Number(data.unit_price_vnd ?? 0),
        total_next_needed: Number(data.total_next_needed ?? 0),
        classes: data.classes || [],
      });
    } catch (e: any) {
      console.error("Failed to fetch wallet:", e);
      setErrorMsg(e.message || "Lỗi kết nối khi tải dữ liệu ví slot.");
    } finally {
      setLoadingWallet(false);
    }
  };

  const fetchOrders = async () => {
    try {
      setLoadingOrders(true);
      const res = await fetch("/api/teacher/slot-requests");
      if (!res.ok) return;
      const data = await res.json();
      const rows: SlotOrder[] = (data.slot_requests || []).map((row: any) => ({
        id: row.id,
        code: row.code || `KK${row.id.replace(/[^A-Za-z0-9]/g, "").slice(-8).toUpperCase()}`,
        requested_slots: Number(row.requested_slots),
        total_cost: Number(row.total_cost),
        status: row.status,
        created_at: row.created_at
          ? new Date(row.created_at).toLocaleDateString("vi-VN")
          : "Hôm nay",
      }));
      setRequests(rows);
    } catch (e: any) {
      console.error("Failed to fetch orders:", e);
    } finally {
      setLoadingOrders(false);
    }
  };

  const reloadAll = () => {
    fetchWallet();
    fetchOrders();
  };

  useEffect(() => {
    fetchWallet();
    fetchOrders();
  }, [user]);

  const unitPrice = wallet?.unit_price_vnd || 0;
  const estimatedTotal = unitPrice > 0 ? newSlots * unitPrice : null;

  const scrollToBuy = () => {
    if (buySectionRef.current) {
      buySectionRef.current.scrollIntoView({ behavior: "smooth" });
    }
  };

  const handlePurchase = async () => {
    setIsSubmitting(true);
    setErrorMsg(null);

    try {
      const res = await fetch("/api/teacher/slot-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requested_slots: newSlots,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        setErrorMsg(data.error || "Gửi yêu cầu mua slot thất bại.");
        return;
      }

      const orderId = data.slot_request?.id;
      if (orderId) {
        router.push(`/teacher/orders/${orderId}`);
      } else {
        fetchOrders();
        fetchWallet();
      }
    } catch (err: any) {
      setErrorMsg(err.message || "Lỗi kết nối khi gửi yêu cầu.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderStatusBadge = (status: string) => {
    if (status === "APPROVED") {
      return (
        <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
          Đã duyệt
        </span>
      );
    }
    if (status === "REJECTED") {
      return (
        <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800">
          Từ chối
        </span>
      );
    }
    if (status === "CANCELLED") {
      return (
        <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800">
          Đã huỷ
        </span>
      );
    }
    return (
      <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800">
        Chờ thanh toán
      </span>
    );
  };

  const renderClassStatus = (cls: WalletClass) => {
    switch (cls.billing_status) {
      case "ACTIVE":
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
            Đang chạy
          </span>
        );
      case "GRACE":
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
            Ân hạn {cls.grace_until ? `đến ${formatDateVN(cls.grace_until)}` : ""}
          </span>
        );
      case "LOCKED":
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-rose-50 text-rose-700 border border-rose-200">
            Tạm khoá
          </span>
        );
      case "ENDED":
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-700 border border-slate-200">
            Đã kết thúc
          </span>
        );
      default:
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-700 border border-slate-200">
            {cls.billing_status}
          </span>
        );
    }
  };

  const balance = wallet?.balance ?? 0;
  const total_next_needed = wallet?.total_next_needed ?? 0;
  const isShortOfSlots = balance < total_next_needed;
  const missingSlots = Math.max(0, total_next_needed - balance);

  return (
    <TeacherLayout>
      <div className="max-w-[1280px] mx-auto space-y-8 font-sans">
        {/* Header */}
        <div className="border-b border-line/40 pb-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="font-headline text-3xl font-bold text-ink tracking-tight flex items-center gap-3">
              <Wallet className="w-8 h-8 text-brand-600" />
              <span>Ví slot</span>
            </h1>
            <p className="text-sm text-ink-muted mt-1">
              Quản lý số dư slot học sinh-tháng, theo dõi chu kỳ trừ của các lớp và nạp thêm slot.
            </p>
          </div>
          <button
            onClick={scrollToBuy}
            className="inline-flex items-center px-4 py-2.5 bg-brand-600 hover:bg-brand-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm cursor-pointer"
          >
            <CreditCard className="w-4 h-4 mr-2" />
            <span>Mua slot</span>
          </button>
        </div>

        {/* Lỗi tổng quan + Thử lại */}
        {errorMsg && (
          <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
              <span className="font-semibold text-xs leading-relaxed">{errorMsg}</span>
            </div>
            <button
              onClick={reloadAll}
              className="px-3 py-1.5 bg-rose-600 text-white rounded-lg text-xs font-medium hover:bg-rose-700 transition-colors"
            >
              Thử lại
            </button>
          </div>
        )}

        {/* Trạng thái Đang tải ví */}
        {loadingWallet && (
          <div className="flex flex-col items-center justify-center p-12 bg-white rounded-3xl border border-line shadow-sm">
            <Loader2 className="w-8 h-8 animate-spin text-brand-600 mb-3" />
            <p className="text-xs text-ink-muted font-medium">Đang nạp thông tin ví slot...</p>
          </div>
        )}

        {/* Nội dung ví khi đã có dữ liệu */}
        {!loadingWallet && wallet && (
          <>
            {/* Cảnh báo thiếu slot */}
            {isShortOfSlots && (
              <div className="p-5 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-sm">
                <div className="flex items-start sm:items-center space-x-3">
                  <AlertTriangle className="w-6 h-6 text-amber-600 shrink-0 mt-0.5 sm:mt-0" />
                  <div className="text-xs sm:text-sm">
                    <span className="font-bold text-amber-800">Cảnh báo thiếu slot:</span>{" "}
                    <span>
                      Còn thiếu {missingSlots.toLocaleString("vi-VN")} slot cho các lần trừ trong 31 ngày tới.
                    </span>
                  </div>
                </div>
                <button
                  onClick={scrollToBuy}
                  className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm shrink-0 cursor-pointer"
                >
                  Mua slot
                </button>
              </div>
            )}

            {/* Thẻ lớn Số dư */}
            <div className="bg-white p-8 rounded-3xl border border-line shadow-sm">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div>
                  <p className="text-xs text-ink-muted font-bold uppercase tracking-wider mb-2">
                    Số Dư Hiện Tại
                  </p>
                  <div className="flex items-baseline space-x-3">
                    <span className="text-4xl sm:text-5xl font-black text-brand-600 tracking-tight">
                      {balance.toLocaleString("vi-VN")}
                    </span>
                    <span className="text-xl font-bold text-ink">slot</span>
                  </div>
                  <p className="text-xs text-ink-muted mt-2">
                    1 slot = 1 học sinh × 1 tháng trong một lớp
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-4 border-t md:border-t-0 md:border-l border-line pt-4 md:pt-0 md:pl-8">
                  <div>
                    <p className="text-[11px] text-ink-muted font-medium">Nhu cầu 31 ngày tới</p>
                    <p className="text-xl font-bold text-ink mt-0.5">
                      {total_next_needed.toLocaleString("vi-VN")} slot
                    </p>
                  </div>
                  <div>
                    <p className="text-[11px] text-ink-muted font-medium">Đơn giá tham khảo</p>
                    <p className="text-xl font-bold text-ink mt-0.5">
                      {unitPrice > 0 ? `${unitPrice.toLocaleString("vi-VN")} đ` : "Liên hệ"}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Bảng "Lớp & lần trừ tới" */}
            <div className="bg-white p-6 rounded-3xl border border-line shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-bold text-ink flex items-center space-x-2">
                  <GraduationCap className="w-5 h-5 text-brand-600" />
                  <span>Lớp &amp; lần trừ tới</span>
                </h2>
                <span className="text-xs text-ink-muted">
                  {wallet.classes.length} lớp học
                </span>
              </div>

              {wallet.classes.length === 0 ? (
                <div className="p-8 text-center border border-dashed border-line rounded-2xl bg-surface-alt">
                  <p className="text-xs text-ink-muted">Chưa có lớp học nào.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-surface-alt border-b border-line text-ink-muted font-bold uppercase text-[10px] tracking-wider">
                      <tr>
                        <th className="px-4 py-3">Lớp học</th>
                        <th className="px-4 py-3">Trạng thái</th>
                        <th className="px-4 py-3">Ngày khai giảng</th>
                        <th className="px-4 py-3">Ngày trừ tới</th>
                        <th className="px-4 py-3 text-right">Sĩ số</th>
                        <th className="px-4 py-3 text-center">Đánh giá</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-line/60">
                      {wallet.classes.map((c) => (
                        <tr key={c.id} className="hover:bg-brand-50/20 transition-colors">
                          <td className="px-4 py-3 font-semibold text-ink">
                            <Link
                              href={`/teacher/classes/${c.id}`}
                              className="text-brand-600 hover:text-brand-700 hover:underline inline-flex items-center gap-1"
                            >
                              <span>{c.name}</span>
                              <ExternalLink className="w-3 h-3" />
                            </Link>
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            {renderClassStatus(c)}
                          </td>
                          <td className="px-4 py-3 text-ink-muted whitespace-nowrap">
                            {formatDateVN(c.start_date)}
                          </td>
                          <td className="px-4 py-3 text-ink-muted whitespace-nowrap">
                            {formatDateVN(c.next_charge_at)}
                          </td>
                          <td className="px-4 py-3 text-right font-medium text-ink whitespace-nowrap">
                            {c.student_count.toLocaleString("vi-VN")}
                          </td>
                          <td className="px-4 py-3 text-center whitespace-nowrap">
                            {c.enough_for_next ? (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                                Đủ
                              </span>
                            ) : (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800">
                                Thiếu
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Bảng Lịch sử Giao dịch */}
            <div className="bg-white p-6 rounded-3xl border border-line shadow-sm">
              <SlotLedgerTable
                classes={wallet.classes.map((c) => ({ id: c.id, name: c.name }))}
                onRefreshWallet={fetchWallet}
              />
            </div>
          </>
        )}

        {/* Section Mua slot & Đơn hàng của tôi */}
        <div id="buy-slots" ref={buySectionRef} className="grid grid-cols-1 lg:grid-cols-12 gap-8 pt-4">
          {/* Purchase Slider Section */}
          <div className="lg:col-span-6 bg-white p-6 rounded-3xl border border-line shadow-sm space-y-6">
            <h2 className="text-base font-bold text-brand-600 flex items-center space-x-2">
              <CreditCard className="w-5 h-5 text-brand-600" />
              <span>Mua thêm slot học sinh</span>
            </h2>

            <div className="space-y-4">
              <div className="flex justify-between items-center text-xs font-bold uppercase text-ink">
                <span>
                  Số lượng Slot yêu cầu:{" "}
                  <strong className="text-brand-600 text-sm">
                    {newSlots.toLocaleString("vi-VN")} Slots
                  </strong>
                </span>
              </div>
              <input
                type="range"
                min={10}
                max={500}
                step={10}
                value={newSlots}
                onChange={(e) => setNewSlots(Number(e.target.value))}
                className="w-full h-2 bg-brand-50 rounded-lg appearance-none cursor-pointer accent-brand-600"
              />
              <div className="flex justify-between text-[10px] text-ink-subtle font-medium">
                <span>Tối thiểu: 10 slots</span>
                <span>Tối đa: 500 slots</span>
              </div>

              {/* Dự kiến chi phí */}
              <div className="p-3 bg-surface-alt rounded-xl border border-line flex items-center justify-between text-xs">
                <span className="text-ink-subtle">Giá dự kiến:</span>
                <span className="font-bold text-brand-600 text-sm">
                  {estimatedTotal !== null
                    ? `${estimatedTotal.toLocaleString("vi-VN")} đ`
                    : "Giá tính khi tạo đơn"}
                </span>
              </div>
            </div>

            <button
              onClick={handlePurchase}
              disabled={isSubmitting}
              className="w-full py-3.5 bg-brand-600 hover:bg-brand-700 text-white rounded-xl text-xs font-bold transition-all shadow flex items-center justify-center space-x-2 disabled:opacity-50 cursor-pointer"
            >
              {isSubmitting ? (
                <Loader2 className="w-4 h-4 animate-spin text-white" />
              ) : (
                <>
                  <span>Tạo đơn thanh toán VietQR</span>
                  <ArrowRight className="w-4 h-4 text-white" />
                </>
              )}
            </button>
          </div>

          {/* Bảng đơn của tôi */}
          <div className="lg:col-span-6 bg-white p-6 rounded-3xl border border-line shadow-sm space-y-4">
            <h3 className="text-base font-bold text-brand-600">Đơn hàng của tôi</h3>

            {loadingOrders ? (
              <div className="flex items-center space-x-2 text-xs text-ink-muted py-8 justify-center">
                <Loader2 className="w-4 h-4 animate-spin text-brand-600" />
                <span>Đang tải danh sách đơn hàng...</span>
              </div>
            ) : requests.length === 0 ? (
              <div className="p-8 text-center border border-dashed border-line rounded-2xl bg-surface-alt">
                <p className="text-xs text-ink-muted">Chưa có đơn hàng mua slot nào.</p>
              </div>
            ) : (
              <div className="space-y-3 max-h-[460px] overflow-y-auto pr-1">
                {requests.map((o) => (
                  <div
                    key={o.id}
                    className="p-3 bg-surface-alt hover:bg-brand-50/40 transition-colors rounded-xl border border-line/40 flex justify-between items-center"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <Link
                          href={`/teacher/orders/${o.id}`}
                          className="text-xs font-bold text-brand-600 hover:underline flex items-center gap-1"
                        >
                          <span>{o.code || o.id}</span>
                          <ExternalLink className="w-3 h-3 text-brand-600" />
                        </Link>
                        <span className="text-xs font-bold text-ink">
                          ({o.requested_slots.toLocaleString("vi-VN")} slots)
                        </span>
                      </div>
                      <div className="text-[10px] text-ink-subtle mt-0.5">
                        {o.created_at} &bull; Số tiền: {o.total_cost.toLocaleString("vi-VN")} đ
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {renderStatusBadge(o.status)}
                      <Link
                        href={`/teacher/orders/${o.id}`}
                        className="px-2.5 py-1 text-[11px] font-medium text-brand-600 hover:text-brand-700 hover:bg-brand-100 rounded-lg border border-transparent hover:border-brand-200 transition-colors"
                      >
                        Chi tiết
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </TeacherLayout>
  );
}
