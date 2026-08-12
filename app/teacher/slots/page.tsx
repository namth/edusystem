"use client";

import { useState, useEffect } from "react";
import TeacherLayout from "@/components/TeacherLayout";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabase";
import { CreditCard, Shield, HelpCircle, Loader2, CheckCircle2, ArrowRight } from "lucide-react";

interface SlotRequest {
  id: string;
  requested_slots: number;
  status: "PENDING" | "APPROVED";
  created_at: string;
}

export default function TeacherSlotsPage() {
  const { user } = useAuth();
  const [requests, setRequests] = useState<SlotRequest[]>([]);
  const [newSlots, setNewSlots] = useState(50);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Stats
  const [totalLimit, setTotalLimit] = useState(250);
  const [usedSlots, setUsedSlots] = useState(218);

  const fetchRequests = async () => {
    if (!user) return;
    try {
      const { data, error } = await supabase
        .from("slot_requests")
        .select("*")
        .eq("teacher_id", user.id)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Requests query error:", error);
        return;
      }

      setRequests(
        (data || []).map((row: any) => ({
          id: row.id,
          requested_slots: row.requested_slots,
          status: row.status,
          created_at: new Date(row.created_at).toLocaleDateString("vi-VN"),
        }))
      );

      // Dynamically calculate slot counts
      const approvedSlots = (data || [])
        .filter((r: any) => r.status === "APPROVED")
        .reduce((sum: number, r: any) => sum + r.requested_slots, 0);

      setTotalLimit(250 + approvedSlots);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      fetchRequests();
    }
  }, [user]);

  const handlePurchase = async () => {
    if (!user) return;
    setIsSubmitting(true);
    setSuccessMsg(null);

    const reqId = `SLOT-${Date.now().toString().slice(-4)}`;

    try {
      const { error } = await supabase.from("slot_requests").insert([
        {
          id: reqId,
          teacher_id: user.id,
          teacher_name: user.name,
          teacher_email: user.email,
          requested_slots: newSlots,
          total_cost: 0,
          status: "PENDING",
        },
      ]);

      if (error) {
        console.error("Purchase creation failed:", error);
        return;
      }

      setSuccessMsg(`Yêu cầu mở rộng ${newSlots.toLocaleString("vi-VN")} slot sĩ số đã được gửi đi! Vui lòng chờ Admin phê duyệt.`);
      fetchRequests();
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <TeacherLayout>
      <div className="max-w-[1280px] mx-auto space-y-8 font-sans">
        {/* Header */}
        <div className="border-b border-[#d8c2b6]/40 pb-6">
          <h1 className="font-headline text-3xl font-bold text-[#211a16] tracking-tight">
            Quản Lý &amp; Mở Rộng Hạn Mức Sĩ Số Slots
          </h1>
          <p className="text-sm text-[#52443a] mt-1">
            Gửi yêu cầu nâng hạn mức sĩ số slots tài khoản học viên để mở rộng quy mô lớp học.
          </p>
        </div>

        {successMsg && (
          <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 flex items-center space-x-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            <span className="font-semibold text-xs leading-relaxed">{successMsg}</span>
          </div>
        )}

        {/* Bento Grid Stats (Formatted Numbers) */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white p-6 rounded-3xl border border-[#d8c2b6] shadow-sm text-center">
            <p className="text-xs text-[#52443a] font-bold uppercase mb-1">Tổng Hạn Mức Slots Được Cấp</p>
            <p className="text-3xl font-bold text-[#6d3807]">{totalLimit.toLocaleString("vi-VN")} Slots</p>
          </div>
          <div className="bg-white p-6 rounded-3xl border border-[#d8c2b6] shadow-sm text-center">
            <p className="text-xs text-[#52443a] font-bold uppercase mb-1">Sĩ Số Đã Sử Dụng</p>
            <p className="text-3xl font-bold text-[#6d3807]">{usedSlots.toLocaleString("vi-VN")} Slots</p>
          </div>
          <div className="bg-white p-6 rounded-3xl border border-[#d8c2b6] shadow-sm text-center">
            <p className="text-xs text-[#52443a] font-bold uppercase mb-1">Số Slot Còn Trống</p>
            <p className="text-3xl font-bold text-[#004d5e]">{(totalLimit - usedSlots).toLocaleString("vi-VN")} Slots</p>
          </div>
        </div>

        {/* Purchase Slider Section (No price column) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <div className="lg:col-span-8 bg-white p-6 rounded-3xl border border-[#d8c2b6] shadow-sm space-y-6">
            <h2 className="text-base font-bold text-[#6d3807] flex items-center space-x-2">
              <CreditCard className="w-5 h-5 text-[#6d3807]" />
              <span>Yêu Cầu Mở Rộng Hạn Mức Sĩ Số Slots</span>
            </h2>

            <div className="space-y-4">
              <div className="flex justify-between items-center text-xs font-bold uppercase text-[#211a16]">
                <span>Số lượng Slot yêu cầu: <strong className="text-[#6d3807] text-sm">{newSlots.toLocaleString("vi-VN")} Slots</strong></span>
              </div>
              <input
                type="range"
                min={10}
                max={500}
                step={10}
                value={newSlots}
                onChange={(e) => setNewSlots(Number(e.target.value))}
                className="w-full h-2 bg-[#fff1ea] rounded-lg appearance-none cursor-pointer accent-[#6d3807]"
              />
              <div className="flex justify-between text-[10px] text-[#857469] font-medium">
                <span>Tối thiểu: 10 slots</span>
                <span>Tối đa: 500 slots</span>
              </div>
            </div>

            <button
              onClick={handlePurchase}
              disabled={isSubmitting}
              className="w-full py-3.5 bg-[#6d3807] hover:bg-[#8a4f1e] text-white rounded-xl text-xs font-bold transition-all shadow flex items-center justify-center space-x-2 disabled:opacity-50"
            >
              {isSubmitting ? (
                <Loader2 className="w-4 h-4 animate-spin text-white" />
              ) : (
                <>
                  <span>Gửi Yêu Cầu Phê Duyệt Hạn Mức Slots</span>
                  <ArrowRight className="w-4 h-4 text-[#ffb782]" />
                </>
              )}
            </button>
          </div>

          <div className="lg:col-span-4 bg-white p-6 rounded-3xl border border-[#d8c2b6] shadow-sm space-y-4">
            <h3 className="text-base font-bold text-[#6d3807]">Lịch Sử Yêu Cầu Gần Đây</h3>

            {loading ? (
              <div className="flex items-center space-x-2 text-xs text-[#52443a]">
                <Loader2 className="w-4 h-4 animate-spin text-[#6d3807]" />
                <span>Đang tải lịch sử...</span>
              </div>
            ) : requests.length === 0 ? (
              <p className="text-xs text-[#52443a]">Chưa có yêu cầu mua slot nào được thực hiện.</p>
            ) : (
              <div className="space-y-3">
                {requests.map((r) => (
                  <div key={r.id} className="p-3 bg-[#fff8f5] rounded-xl border border-[#d8c2b6]/40 flex justify-between items-center">
                    <div>
                      <div className="text-xs font-bold text-[#211a16]">+{r.requested_slots.toLocaleString("vi-VN")} Slots ({r.id})</div>
                      <div className="text-[10px] text-[#857469]">{r.created_at}</div>
                    </div>
                    <div>
                      <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${
                        r.status === "APPROVED" ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"
                      }`}>
                        {r.status === "APPROVED" ? "Đã duyệt" : "Chờ duyệt"}
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
