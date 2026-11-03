"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import TeacherLayout from "@/components/TeacherLayout";
import { useAuth } from "@/context/AuthContext";
import {
  CreditCard,
  HelpCircle,
  Loader2,
  ArrowRight,
  AlertCircle,
  ExternalLink,
} from "lucide-react";

interface SlotOrder {
  id: string;
  code?: string;
  requested_slots: number;
  total_cost: number;
  status: "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED";
  created_at: string;
  created_at_raw?: string;
}

export default function TeacherSlotsPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [requests, setRequests] = useState<SlotOrder[]>([]);
  const [newSlots, setNewSlots] = useState(50);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Stats
  const [usage, setUsage] = useState<{ used: number; limit: number }>({ used: 0, limit: 0 });

  const fetchRequests = async () => {
    try {
      setLoading(true);
      setErrorMsg(null);
      const res = await fetch("/api/teacher/slot-requests");
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        setErrorMsg(errData.error || "Không thể tải danh sách đơn mua slot.");
        return;
      }
      const data = await res.json();
      if (data.usage) {
        setUsage(data.usage);
      }
      const rows: SlotOrder[] = (data.slot_requests || []).map((row: any) => ({
        id: row.id,
        code: row.code || `KK${row.id.replace(/[^A-Za-z0-9]/g, "").slice(-8).toUpperCase()}`,
        requested_slots: Number(row.requested_slots),
        total_cost: Number(row.total_cost),
        status: row.status,
        created_at_raw: row.created_at,
        created_at: row.created_at
          ? new Date(row.created_at).toLocaleDateString("vi-VN")
          : "Hôm nay",
      }));
      setRequests(rows);
    } catch (e: any) {
      console.error("Failed to fetch slot requests:", e);
      setErrorMsg(e.message || "Lỗi kết nối khi tải dữ liệu đơn mua slot.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRequests();
  }, [user]);

  // Đơn giá gần nhất lấy từ đơn gần nhất
  const latestOrderWithPrice = requests.find(
    (r) => r.requested_slots > 0 && r.total_cost > 0
  );
  const estimatedUnitPrice = latestOrderWithPrice
    ? Math.round(latestOrderWithPrice.total_cost / latestOrderWithPrice.requested_slots)
    : null;

  const estimatedTotal = estimatedUnitPrice ? newSlots * estimatedUnitPrice : null;

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
        // Hiện lỗi server trả về (ví dụ 403 TRIAL_LIMIT)
        setErrorMsg(data.error || "Gửi yêu cầu mua slot thất bại.");
        return;
      }

      const orderId = data.slot_request?.id;
      if (orderId) {
        router.push(`/teacher/orders/${orderId}`);
      } else {
        fetchRequests();
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

  return (
    <TeacherLayout>
      <div className="max-w-[1280px] mx-auto space-y-8 font-sans">
        {/* Header */}
        <div className="border-b border-line/40 pb-6">
          <h1 className="font-headline text-3xl font-bold text-ink tracking-tight">
            Slot học sinh &amp; đơn hàng
          </h1>
          <p className="text-sm text-ink-muted mt-1">
            Đang dùng {usage.used} / {usage.limit} slot học sinh. Quy tắc: 1 slot = 1 học sinh (học sinh học nhiều lớp của thầy cô chỉ tính 1).
          </p>
        </div>

        {/* Banner giải thích */}
        <div className="p-4 rounded-2xl bg-brand-50 border border-brand-200 text-brand-900 flex items-start space-x-3">
          <HelpCircle className="w-5 h-5 text-brand-600 shrink-0 mt-0.5" />
          <div className="text-xs leading-relaxed">
            <span className="font-bold text-sm text-brand-700">
              Đang dùng {usage.used} / {usage.limit} slot học sinh
            </span>
            <p className="mt-0.5 text-ink-subtle">
              1 slot = 1 học sinh (học sinh học nhiều lớp của thầy cô chỉ tính 1 slot). Chấm bài tự luận AI không trừ slot.
            </p>
          </div>
        </div>

        {errorMsg && (
          <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
              <span className="font-semibold text-xs leading-relaxed">{errorMsg}</span>
            </div>
            <button
              onClick={fetchRequests}
              className="px-3 py-1.5 bg-rose-600 text-white rounded-lg text-xs font-medium hover:bg-rose-700"
            >
              Thử lại
            </button>
          </div>
        )}

        {/* Bento Grid Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white p-6 rounded-3xl border border-line shadow-sm text-center">
            <p className="text-xs text-ink-muted font-bold uppercase mb-1">
              Tổng Hạn Mức Slots Được Cấp
            </p>
            <p className="text-3xl font-bold text-brand-600">
              {usage.limit.toLocaleString("vi-VN")} Slots
            </p>
          </div>
          <div className="bg-white p-6 rounded-3xl border border-line shadow-sm text-center">
            <p className="text-xs text-ink-muted font-bold uppercase mb-1">
              Sĩ Số Đã Sử Dụng
            </p>
            <p className="text-3xl font-bold text-brand-600">
              {usage.used.toLocaleString("vi-VN")} Slots
            </p>
          </div>
          <div className="bg-white p-6 rounded-3xl border border-line shadow-sm text-center">
            <p className="text-xs text-ink-muted font-bold uppercase mb-1">
              Số Slot Còn Trống
            </p>
            <p className="text-3xl font-bold text-brand-800">
              {Math.max(0, usage.limit - usage.used).toLocaleString("vi-VN")} Slots
            </p>
          </div>
        </div>

        {/* Purchase Slider Section */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
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

            {loading ? (
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
                          (+{o.requested_slots.toLocaleString("vi-VN")} slots)
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
