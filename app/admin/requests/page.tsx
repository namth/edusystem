"use client";

import { useState, useEffect } from "react";
import AdminLayout from "@/components/AdminLayout";
import { AlertCircle, Loader2, Info } from "lucide-react";

interface SlotRequest {
  id: string;
  teacher_id: string;
  teacher_name: string;
  teacher_email: string;
  requested_slots: number;
  total_cost: number;
  status: "PENDING" | "APPROVED" | "REJECTED";
  created_at: string;
}

export default function AdminRequestsPage() {
  const [slotRequests, setSlotRequests] = useState<SlotRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [processingId, setProcessingId] = useState<string | null>(null);

  const fetchRequests = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/requests");
      const data = await res.json();

      if (!res.ok || !data.slot_requests) {
        setError(data.error || "Không thể tải danh sách đơn mua slot.");
        return;
      }

      setSlotRequests(
        (data.slot_requests || []).map((row: any) => ({
          id: row.id,
          teacher_id: row.teacher_id,
          teacher_name: row.teacher_name,
          teacher_email: row.teacher_email,
          requested_slots: Number(row.requested_slots),
          total_cost: Number(row.total_cost),
          status: row.status,
          created_at: new Date(row.created_at).toLocaleDateString("vi-VN"),
        }))
      );
    } catch (e: any) {
      console.error(e);
      setError(e.message || "Lỗi hệ thống khi tải các yêu cầu thanh toán.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRequests();
  }, []);

  const handleAction = async (id: string, action: "APPROVE" | "REJECT") => {
    setProcessingId(id);
    try {
      const res = await fetch(`/api/admin/requests/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        alert("Lỗi khi xử lý đơn: " + (data.error || "Không rõ nguyên nhân"));
        return;
      }

      // Cập nhật dòng tại chỗ
      setSlotRequests((prev) =>
        prev.map((r) =>
          r.id === id
            ? {
                ...r,
                status: data.slot_request?.status || (action === "APPROVE" ? "APPROVED" : "REJECTED"),
              }
            : r
        )
      );
    } catch (err: any) {
      console.error(err);
      alert("Lỗi kết nối khi gửi yêu cầu xử lý đơn.");
    } finally {
      setProcessingId(null);
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
            Bám sát thiết kế Stitch `Admin Portal: Request Management`. Quản lý phê duyệt giao dịch mua thêm slot của giảng viên.
          </p>
        </div>

        {error && (
          <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
              <span className="text-xs font-bold">{error}</span>
            </div>
            <button
              onClick={fetchRequests}
              className="px-3 py-1.5 bg-rose-600 text-white rounded-lg text-xs font-medium hover:bg-rose-700"
            >
              Thử lại
            </button>
          </div>
        )}

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

                      <div className="flex items-center space-x-2">
                        {req.status === "PENDING" ? (
                          <>
                            <button
                              disabled={processingId === req.id}
                              onClick={() => handleAction(req.id, "APPROVE")}
                              className="px-3.5 py-1.5 bg-[#6d3807] hover:bg-[#8a4f1e] text-white text-[10px] font-mono font-bold rounded-lg shadow disabled:opacity-50"
                            >
                              Duyệt
                            </button>
                            <button
                              disabled={processingId === req.id}
                              onClick={() => handleAction(req.id, "REJECT")}
                              className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white text-[10px] font-mono font-bold rounded-lg shadow disabled:opacity-50"
                            >
                              Từ chối
                            </button>
                          </>
                        ) : req.status === "APPROVED" ? (
                          <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 text-[10px] font-mono font-bold rounded">
                            APPROVED
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 bg-rose-100 text-rose-800 text-[10px] font-mono font-bold rounded">
                            REJECTED
                          </span>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Right: Course Orders placeholder */}
            <div className="bg-white p-6 rounded-2xl border border-[#d8c2b6] shadow-sm space-y-4">
              <h2 className="text-base font-bold font-headline text-[#6d3807] flex items-center space-x-2">
                <Info className="w-5 h-5 text-[#6d3807]" />
                <span>Thanh Toán Khóa Học Của Học Viên</span>
              </h2>

              <div className="p-8 text-center border-2 border-dashed border-[#d8c2b6] rounded-2xl bg-[#fff8f5] space-y-2">
                <Info className="w-8 h-8 text-[#857469] mx-auto" />
                <p className="text-sm font-semibold text-[#52443a]">
                  Chưa hỗ trợ đơn mua khóa học của học sinh
                </p>
                <p className="text-xs text-[#857469]">
                  Tính năng thanh toán khóa học đang chờ hoàn thiện bảng dữ liệu và mô hình giá.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
