"use client";

import { useState, useEffect } from "react";
import AdminLayout from "@/components/AdminLayout";
import { supabase } from "@/lib/supabase";
import { CheckCircle2, XCircle, AlertCircle, Loader2 } from "lucide-react";

interface SlotRequest {
  id: string;
  teacher_name: string;
  teacher_email: string;
  requested_slots: number;
  total_cost: number;
  status: "PENDING" | "APPROVED";
  created_at: string;
}

interface PurchaseOrder {
  id: string;
  student_name: string;
  student_email: string;
  course_title: string;
  amount: number;
  transfer_code: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
  created_at: string;
}

export default function AdminRequestsPage() {
  const [slotRequests, setSlotRequests] = useState<SlotRequest[]>([]);
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchRequests = async () => {
    try {
      // 1. Fetch Slot Requests
      const { data: slotData, error: slotError } = await supabase
        .from("slot_requests")
        .select("*")
        .order("created_at", { ascending: false });

      // 2. Fetch Orders
      const { data: orderData, error: orderError } = await supabase
        .from("orders")
        .select("*")
        .order("created_at", { ascending: false });

      if (slotError || orderError) {
        console.error("Requests query error:", slotError, orderError);
        return;
      }

      setSlotRequests(
        (slotData || []).map((row: any) => ({
          id: row.id,
          teacher_name: row.teacher_name,
          teacher_email: row.teacher_email,
          requested_slots: row.requested_slots,
          total_cost: Number(row.total_cost),
          status: row.status,
          created_at: new Date(row.created_at).toLocaleDateString("vi-VN"),
        }))
      );

      setOrders(
        (orderData || []).map((row: any) => ({
          id: row.id,
          student_name: row.student_name,
          student_email: row.student_email,
          course_title: row.course_title,
          amount: Number(row.amount),
          transfer_code: row.transfer_code,
          status: row.status,
          created_at: new Date(row.created_at).toLocaleDateString("vi-VN"),
        }))
      );
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRequests();
  }, []);

  const handleApproveSlot = async (id: string) => {
    try {
      const { error } = await supabase
        .from("slot_requests")
        .update({ status: "APPROVED" })
        .eq("id", id);

      if (error) {
        console.error("Approve slot failed:", error);
        return;
      }
      fetchRequests();
    } catch (err) {
      console.error(err);
    }
  };

  const handleApproveOrder = async (id: string) => {
    try {
      const { error } = await supabase
        .from("orders")
        .update({ status: "APPROVED" })
        .eq("id", id);

      if (error) {
        console.error("Approve order failed:", error);
        return;
      }
      fetchRequests();
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <AdminLayout>
      <div className="max-w-[1280px] mx-auto space-y-8 font-sans">
        {/* Header */}
        <div className="border-b border-[#d8c2b6]/40 pb-6">
          <h1 className="font-headline text-3xl font-bold text-[#211a16] tracking-tight">
            Purchase Request Approval
          </h1>
          <p className="text-sm text-[#52443a] mt-1">
            Bám sát thiết kế Stitch `Admin Portal: Request Management`. Quản lý phê duyệt giao dịch mua khoá học của học viên &amp; mua thêm slot của giảng viên.
          </p>
        </div>

        {loading ? (
          <div className="flex items-center space-x-2 font-mono text-xs text-[#52443a] p-12 bg-white rounded-2xl border border-[#d8c2b6]">
            <Loader2 className="w-4 h-4 animate-spin text-[#6d3807]" />
            <span>Đang tải các yêu cầu thanh toán từ database...</span>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Left: Slot Requests */}
            <div className="bg-white p-6 rounded-2xl border border-[#d8c2b6] shadow-sm space-y-4">
              <h2 className="text-base font-bold font-headline text-[#6d3807] flex items-center space-x-2">
                <AlertCircle className="w-5 h-5 text-[#6d3807]" />
                <span>Yêu Cầu Mua Slot Từ Giáo Viên ({slotRequests.filter((r) => r.status === "PENDING").length})</span>
              </h2>

              <div className="space-y-3">
                {slotRequests.length === 0 ? (
                  <p className="text-xs text-[#52443a]">Không có yêu cầu mua slot nào.</p>
                ) : (
                  slotRequests.map((req) => (
                    <div key={req.id} className="p-4 rounded-xl border border-[#d8c2b6]/40 bg-[#fff8f5] flex justify-between items-center">
                      <div>
                        <div className="text-xs font-bold text-[#211a16] font-headline">
                          GV: {req.teacher_name} (+{req.requested_slots} Slots)
                        </div>
                        <div className="text-[10px] font-mono text-[#857469]">
                          Email: {req.teacher_email} &bull; {req.created_at}
                        </div>
                        <div className="text-xs font-mono font-bold text-[#6d3807] mt-1">
                          Số tiền: {req.total_cost.toLocaleString()} VNĐ
                        </div>
                      </div>

                      <div>
                        {req.status === "PENDING" ? (
                          <button
                            onClick={() => handleApproveSlot(req.id)}
                            className="px-3.5 py-1.5 bg-[#6d3807] hover:bg-[#8a4f1e] text-white text-[10px] font-mono font-bold rounded-lg shadow"
                          >
                            Duyệt
                          </button>
                        ) : (
                          <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 text-[10px] font-mono font-bold rounded">
                            APPROVED
                          </span>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Right: Course Orders */}
            <div className="bg-white p-6 rounded-2xl border border-[#d8c2b6] shadow-sm space-y-4">
              <h2 className="text-base font-bold font-headline text-[#6d3807] flex items-center space-x-2">
                <AlertCircle className="w-5 h-5 text-[#6d3807]" />
                <span>Thanh Toán Khóa Học Của Học Viên ({orders.filter((o) => o.status === "PENDING").length})</span>
              </h2>

              <div className="space-y-3">
                {orders.length === 0 ? (
                  <p className="text-xs text-[#52443a]">Không có giao dịch khóa học nào.</p>
                ) : (
                  orders.map((ord) => (
                    <div key={ord.id} className="p-4 rounded-xl border border-[#d8c2b6]/40 bg-[#fff8f5] flex justify-between items-center">
                      <div>
                        <div className="text-xs font-bold text-[#211a16] font-headline">
                          {ord.student_name} &bull; {ord.course_title}
                        </div>
                        <div className="text-[10px] font-mono text-[#857469]">
                          Cú pháp CK: <strong className="text-[#6d3807]">{ord.transfer_code}</strong> &bull; {ord.created_at}
                        </div>
                        <div className="text-xs font-mono font-bold text-[#6d3807] mt-1">
                          Số tiền: {ord.amount.toLocaleString()} VNĐ
                        </div>
                      </div>

                      <div>
                        {ord.status === "PENDING" ? (
                          <button
                            onClick={() => handleApproveOrder(ord.id)}
                            className="px-3.5 py-1.5 bg-[#6d3807] hover:bg-[#8a4f1e] text-white text-[10px] font-mono font-bold rounded-lg shadow"
                          >
                            Duyệt
                          </button>
                        ) : (
                          <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 text-[10px] font-mono font-bold rounded">
                            APPROVED
                          </span>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
