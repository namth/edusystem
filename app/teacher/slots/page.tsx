"use client";

import { useState, useEffect } from "react";
import TeacherLayout from "@/components/TeacherLayout";
import { useAuth } from "@/context/AuthContext";
import {
  CreditCard,
  Shield,
  HelpCircle,
  Loader2,
  CheckCircle2,
  ArrowRight,
  AlertCircle,
} from "lucide-react";

interface SlotRequest {
  id: string;
  requested_slots: number;
  total_cost: number;
  status: "PENDING" | "APPROVED" | "REJECTED";
  created_at: string;
}

export default function TeacherSlotsPage() {
  const { user } = useAuth();
  const [requests, setRequests] = useState<SlotRequest[]>([]);
  const [newSlots, setNewSlots] = useState(50);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Stats
  const [totalLimit, setTotalLimit] = useState(250);
  const [usedSlots, setUsedSlots] = useState(218);

  const fetchRequests = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/teacher/slot-requests");
      if (res.ok) {
        const data = await res.json();
        const rows: SlotRequest[] = (data.slot_requests || []).map((row: any) => ({
          id: row.id,
          requested_slots: Number(row.requested_slots),
          total_cost: Number(row.total_cost),
          status: row.status,
          created_at: row.created_at
            ? new Date(row.created_at).toLocaleDateString("vi-VN")
            : "Hôm nay",
        }));
        setRequests(rows);

        const approvedSlots = rows
          .filter((r) => r.status === "APPROVED")
          .reduce((sum, r) => sum + r.requested_slots, 0);

        setTotalLimit(250 + approvedSlots);
      }
    } catch (e) {
      console.error("Failed to fetch slot requests:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRequests();
  }, [user]);

  const handlePurchase = async () => {
    setIsSubmitting(true);
    setSuccessMsg(null);
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

      const costText =
        data.slot_request?.total_cost !== undefined
          ? ` (Chi phí ước tính: ${Number(data.slot_request.total_cost).toLocaleString("vi-VN")} VNĐ)`
          : "";

      setSuccessMsg(
        `Yêu cầu mở rộng ${newSlots.toLocaleString("vi-VN")} slot sĩ số${costText} đã được gửi thành công! Vui lòng chờ Admin phê duyệt.`
      );
      fetchRequests();
    } catch (err: any) {
      setErrorMsg(err.message || "Lỗi kết nối khi gửi yêu cầu.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <TeacherLayout>
      <div className="max-w-[1280px] mx-auto space-y-8 font-sans">
        {/* Header */}
        <div className="border-b border-line/40 pb-6">
          <h1 className="font-headline text-3xl font-bold text-ink tracking-tight">
            Quản Lý &amp; Mở Rộng Hạn Mức Sĩ Số Slots
          </h1>
          <p className="text-sm text-ink-muted mt-1">
            Gửi yêu cầu nâng hạn mức sĩ số slots tài khoản học viên để mở rộng quy mô lớp học.
          </p>
        </div>

        {successMsg && (
          <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 flex items-center space-x-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            <span className="font-semibold text-xs leading-relaxed">{successMsg}</span>
          </div>
        )}

        {errorMsg && (
          <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 flex items-center space-x-2">
            <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
            <span className="font-semibold text-xs leading-relaxed">{errorMsg}</span>
          </div>
        )}

        {/* Bento Grid Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white p-6 rounded-3xl border border-line shadow-sm text-center">
            <p className="text-xs text-ink-muted font-bold uppercase mb-1">
              Tổng Hạn Mức Slots Được Cấp
            </p>
            <p className="text-3xl font-bold text-brand-600">
              {totalLimit.toLocaleString("vi-VN")} Slots
            </p>
          </div>
          <div className="bg-white p-6 rounded-3xl border border-line shadow-sm text-center">
            <p className="text-xs text-ink-muted font-bold uppercase mb-1">
              Sĩ Số Đã Sử Dụng
            </p>
            <p className="text-3xl font-bold text-brand-600">
              {usedSlots.toLocaleString("vi-VN")} Slots
            </p>
          </div>
          <div className="bg-white p-6 rounded-3xl border border-line shadow-sm text-center">
            <p className="text-xs text-ink-muted font-bold uppercase mb-1">
              Số Slot Còn Trống
            </p>
            <p className="text-3xl font-bold text-brand-800">
              {(totalLimit - usedSlots).toLocaleString("vi-VN")} Slots
            </p>
          </div>
        </div>

        {/* Purchase Slider Section */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <div className="lg:col-span-8 bg-white p-6 rounded-3xl border border-line shadow-sm space-y-6">
            <h2 className="text-base font-bold text-brand-600 flex items-center space-x-2">
              <CreditCard className="w-5 h-5 text-brand-600" />
              <span>Yêu Cầu Mở Rộng Hạn Mức Sĩ Số Slots</span>
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
                  <span>Gửi Yêu Cầu Phê Duyệt Hạn Mức Slots</span>
                  <ArrowRight className="w-4 h-4 text-white" />
                </>
              )}
            </button>
          </div>

          <div className="lg:col-span-4 bg-white p-6 rounded-3xl border border-line shadow-sm space-y-4">
            <h3 className="text-base font-bold text-brand-600">Lịch Sử Yêu Cầu Gần Đây</h3>

            {loading ? (
              <div className="flex items-center space-x-2 text-xs text-ink-muted">
                <Loader2 className="w-4 h-4 animate-spin text-brand-600" />
                <span>Đang tải lịch sử...</span>
              </div>
            ) : requests.length === 0 ? (
              <p className="text-xs text-ink-muted">Chưa có yêu cầu mua slot nào được thực hiện.</p>
            ) : (
              <div className="space-y-3">
                {requests.map((r) => (
                  <div
                    key={r.id}
                    className="p-3 bg-surface-alt rounded-xl border border-line/40 flex justify-between items-center"
                  >
                    <div>
                      <div className="text-xs font-bold text-ink">
                        +{r.requested_slots.toLocaleString("vi-VN")} Slots ({r.id})
                      </div>
                      <div className="text-[10px] text-ink-subtle">
                        {r.created_at} &bull; Chi phí: {r.total_cost.toLocaleString("vi-VN")} đ
                      </div>
                    </div>
                    <div>
                      <span
                        className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${
                          r.status === "APPROVED"
                            ? "bg-emerald-100 text-emerald-800"
                            : r.status === "REJECTED"
                            ? "bg-rose-100 text-rose-800"
                            : "bg-amber-100 text-amber-800"
                        }`}
                      >
                        {r.status === "APPROVED"
                          ? "Đã duyệt"
                          : r.status === "REJECTED"
                          ? "Từ chối"
                          : "Chờ duyệt"}
                      </span>
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
