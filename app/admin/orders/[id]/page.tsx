"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import AdminLayout from "@/components/AdminLayout";
import PaymentPanel, { OrderData, PaymentData } from "@/components/orders/PaymentPanel";
import { ArrowLeft, Loader2, AlertCircle, CheckCircle2, XCircle, X } from "lucide-react";

export default function AdminOrderDetailPage() {
  const params = useParams();
  const router = useRouter();
  const rawId = params?.id;
  const orderId = (Array.isArray(rawId) ? rawId[0] : rawId) || "";

  const [order, setOrder] = useState<OrderData | null>(null);
  const [payment, setPayment] = useState<PaymentData | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  // Modal từ chối
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [rejectError, setRejectError] = useState<string | null>(null);

  const fetchOrder = async () => {
    if (!orderId) return;
    setLoading(true);
    setErrorMsg(null);
    setNotFound(false);
    try {
      const res = await fetch(`/api/orders/${orderId}`);
      if (res.status === 404) {
        setNotFound(true);
        return;
      }
      const data = await res.json();
      if (!res.ok || !data.success) {
        setErrorMsg(data.error || "Không thể tải thông tin đơn hàng.");
        return;
      }
      setOrder(data.order);
      setPayment(data.payment);
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || "Lỗi kết nối khi tải đơn hàng.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrder();
  }, [orderId]);

  // Duyệt đơn
  const handleApprove = async () => {
    if (!orderId) return;
    const ok = window.confirm("Xác nhận DUYỆT đơn hàng này và cộng slot cho giáo viên?");
    if (!ok) return;

    setActionLoading(true);
    setActionSuccess(null);
    setErrorMsg(null);
    try {
      const res = await fetch(`/api/admin/orders/${orderId}/approve`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setErrorMsg(data.error || "Không thể duyệt đơn hàng.");
        return;
      }
      setActionSuccess("Đã duyệt đơn hàng thành công!");
      await fetchOrder();
      setTimeout(() => setActionSuccess(null), 4000);
    } catch (err: any) {
      console.error(err);
      setErrorMsg("Lỗi kết nối khi duyệt đơn hàng.");
    } finally {
      setActionLoading(false);
    }
  };

  // Từ chối đơn
  const handleConfirmReject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!orderId) return;
    if (!rejectReason.trim()) {
      setRejectError("Vui lòng nhập lý do từ chối.");
      return;
    }

    setActionLoading(true);
    setRejectError(null);
    try {
      const res = await fetch(`/api/admin/orders/${orderId}/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: rejectReason.trim() }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setRejectError(data.error || "Không thể từ chối đơn hàng.");
        return;
      }
      setShowRejectModal(false);
      setActionSuccess("Đã từ chối đơn hàng.");
      await fetchOrder();
      setTimeout(() => setActionSuccess(null), 4000);
    } catch (err: any) {
      console.error(err);
      setRejectError("Lỗi kết nối khi từ chối đơn.");
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <AdminLayout>
      <div className="max-w-[1000px] mx-auto space-y-6 font-sans">
        {/* Navigation link */}
        <div className="flex items-center justify-between">
          <Link
            href="/admin/orders"
            className="inline-flex items-center text-xs font-bold text-brand-600 hover:text-brand-700 transition-colors"
          >
            <ArrowLeft className="w-4 h-4 mr-1 text-brand-600" />
            <span>Quay lại danh sách đơn hàng</span>
          </Link>
        </div>

        {/* Thông báo thành công */}
        {actionSuccess && (
          <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 flex items-center space-x-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            <span className="font-semibold text-xs leading-relaxed">{actionSuccess}</span>
          </div>
        )}

        {/* Thông báo lỗi */}
        {errorMsg && (
          <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
              <span className="font-semibold text-xs leading-relaxed">{errorMsg}</span>
            </div>
            <button
              onClick={fetchOrder}
              className="px-3 py-1.5 bg-rose-600 text-white rounded-lg text-xs font-medium hover:bg-rose-700 transition-colors"
            >
              Thử lại
            </button>
          </div>
        )}

        {/* 1. Đang tải */}
        {loading ? (
          <div className="p-12 bg-white rounded-3xl border border-line text-center space-y-3">
            <Loader2 className="w-6 h-6 animate-spin text-brand-600 mx-auto" />
            <p className="text-xs text-ink-muted">Đang nạp chi tiết đơn hàng...</p>
          </div>
        ) : notFound ? (
          /* 2. Không tìm thấy */
          <div className="p-12 bg-white rounded-3xl border border-line text-center space-y-4">
            <div className="w-12 h-12 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center mx-auto border border-rose-200">
              <AlertCircle className="w-6 h-6" />
            </div>
            <h2 className="text-xl font-bold text-ink">Không tìm thấy đơn hàng</h2>
            <p className="text-xs text-ink-muted">Mã ID đơn hàng không tồn tại trong hệ thống.</p>
            <Link
              href="/admin/orders"
              className="inline-flex items-center px-4 py-2 bg-brand-600 text-white text-xs font-bold rounded-xl hover:bg-brand-700"
            >
              Về danh sách đơn hàng
            </Link>
          </div>
        ) : !order || !payment ? (
          /* 3. Rỗng */
          <div className="p-12 bg-white rounded-3xl border border-line text-center space-y-3">
            <p className="text-xs text-ink-muted">Không có dữ liệu đơn hàng.</p>
            <button
              onClick={fetchOrder}
              className="px-4 py-2 bg-brand-600 text-white text-xs font-bold rounded-xl"
            >
              Thử lại
            </button>
          </div>
        ) : (
          /* 4. Có dữ liệu */
          <>
            {/* Thông tin giáo viên đặt đơn */}
            <div className="bg-white p-4 rounded-2xl border border-line flex flex-col sm:flex-row justify-between sm:items-center text-xs gap-2">
              <div>
                <span className="text-ink-subtle">Giáo viên: </span>
                <strong className="text-ink text-sm">{order.teacher_name}</strong>
                <span className="text-ink-muted ml-2">({order.teacher_email})</span>
              </div>
              <div>
                <Link
                  href={`/admin/teachers/${order.teacher_id}`}
                  className="text-brand-600 font-bold hover:underline"
                >
                  Xem hồ sơ giáo viên &rarr;
                </Link>
              </div>
            </div>

            <PaymentPanel
              order={order}
              payment={payment}
              actions={
                order.status === "PENDING" ? (
                  <div className="flex flex-col sm:flex-row items-center justify-end gap-3">
                    <button
                      type="button"
                      disabled={actionLoading}
                      onClick={handleApprove}
                      className="w-full sm:w-auto px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow transition-all flex items-center justify-center space-x-1.5 disabled:opacity-50"
                    >
                      {actionLoading ? (
                        <Loader2 className="w-4 h-4 animate-spin text-white" />
                      ) : (
                        <CheckCircle2 className="w-4 h-4 text-white" />
                      )}
                      <span>Duyệt đơn hàng</span>
                    </button>

                    <button
                      type="button"
                      disabled={actionLoading}
                      onClick={() => {
                        setRejectReason("");
                        setRejectError(null);
                        setShowRejectModal(true);
                      }}
                      className="w-full sm:w-auto px-4 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold shadow transition-all flex items-center justify-center space-x-1.5 disabled:opacity-50"
                    >
                      <XCircle className="w-4 h-4 text-white" />
                      <span>Từ chối</span>
                    </button>
                  </div>
                ) : null
              }
            />
          </>
        )}

        {/* Modal từ chối */}
        {showRejectModal && (
          <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl border border-line space-y-4 animate-in fade-in zoom-in-95">
              <div className="flex justify-between items-center border-b border-line/40 pb-3">
                <h3 className="text-base font-bold text-ink">Từ chối đơn hàng {order?.code}</h3>
                <button
                  type="button"
                  onClick={() => setShowRejectModal(false)}
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
                    placeholder="Nhập lý do từ chối để thông báo cho giáo viên..."
                    className="w-full px-3 py-2 bg-surface-alt border border-line rounded-xl text-xs focus:outline-none focus:border-brand-600"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowRejectModal(false)}
                    className="px-4 py-2 border border-line rounded-xl text-xs font-medium text-ink-muted hover:bg-surface-alt"
                  >
                    Huỷ
                  </button>
                  <button
                    type="submit"
                    disabled={actionLoading}
                    className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold disabled:opacity-50"
                  >
                    {actionLoading ? "Đang xử lý..." : "Xác nhận từ chối"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
