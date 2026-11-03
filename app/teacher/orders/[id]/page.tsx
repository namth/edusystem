"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import TeacherLayout from "@/components/TeacherLayout";
import PaymentPanel, { OrderData, PaymentData } from "@/components/orders/PaymentPanel";
import { ArrowLeft, Loader2, AlertCircle, CheckCircle2, Ban } from "lucide-react";

export default function TeacherOrderDetailPage() {
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

  const handleReportPaid = async () => {
    if (!orderId) return;
    setActionLoading(true);
    setActionSuccess(null);
    setErrorMsg(null);
    try {
      const res = await fetch(`/api/orders/${orderId}/report-paid`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setErrorMsg(data.error || "Không thể cập nhật trạng thái đã chuyển khoản.");
        return;
      }
      setActionSuccess("Đã ghi nhận thông báo chuyển khoản!");
      await fetchOrder();
      setTimeout(() => setActionSuccess(null), 4000);
    } catch (err: any) {
      console.error(err);
      setErrorMsg("Lỗi kết nối khi báo đã chuyển khoản.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleCancelOrder = async () => {
    if (!orderId) return;
    const confirmCancel = window.confirm("Bạn có chắc chắn muốn huỷ đơn hàng này?");
    if (!confirmCancel) return;

    setActionLoading(true);
    setErrorMsg(null);
    try {
      const res = await fetch(`/api/orders/${orderId}/cancel`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setErrorMsg(data.error || "Không thể huỷ đơn hàng.");
        return;
      }
      await fetchOrder();
    } catch (err: any) {
      console.error(err);
      setErrorMsg("Lỗi kết nối khi huỷ đơn hàng.");
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <TeacherLayout>
      <div className="max-w-[1000px] mx-auto space-y-6 font-sans">
        {/* Navigation back */}
        <div className="flex items-center justify-between">
          <Link
            href="/teacher/slots"
            className="inline-flex items-center text-xs font-bold text-brand-600 hover:text-brand-700 transition-colors"
          >
            <ArrowLeft className="w-4 h-4 mr-1 text-brand-600" />
            <span>Quay lại trang quản lý slot</span>
          </Link>
        </div>

        {/* Trạng thái thông báo thành công */}
        {actionSuccess && (
          <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 flex items-center space-x-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            <span className="font-semibold text-xs leading-relaxed">{actionSuccess}</span>
          </div>
        )}

        {/* Trạng thái lỗi */}
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

        {/* 1. Trạng thái Loading */}
        {loading ? (
          <div className="p-12 bg-white rounded-3xl border border-line text-center space-y-3">
            <Loader2 className="w-6 h-6 animate-spin text-brand-600 mx-auto" />
            <p className="text-xs text-ink-muted">Đang tải thông tin đơn hàng &amp; thanh toán VietQR...</p>
          </div>
        ) : notFound ? (
          /* 2. Trạng thái 404 */
          <div className="p-12 bg-white rounded-3xl border border-line text-center space-y-4">
            <div className="w-12 h-12 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center mx-auto border border-rose-200">
              <AlertCircle className="w-6 h-6" />
            </div>
            <h2 className="text-xl font-bold text-ink">Không tìm thấy đơn hàng</h2>
            <p className="text-xs text-ink-muted">
              Đơn hàng không tồn tại hoặc bạn không có quyền xem đơn hàng này.
            </p>
            <div>
              <Link
                href="/teacher/slots"
                className="inline-flex items-center px-4 py-2 bg-brand-600 text-white text-xs font-bold rounded-xl hover:bg-brand-700 transition-colors"
              >
                Về trang Slot học sinh &amp; đơn hàng
              </Link>
            </div>
          </div>
        ) : !order || !payment ? (
          /* 3. Trạng thái rỗng */
          <div className="p-12 bg-white rounded-3xl border border-line text-center space-y-3">
            <p className="text-xs text-ink-muted">Không có dữ liệu đơn hàng.</p>
            <button
              onClick={fetchOrder}
              className="px-4 py-2 bg-brand-600 text-white text-xs font-bold rounded-xl hover:bg-brand-700"
            >
              Thử lại
            </button>
          </div>
        ) : (
          /* 4. Trạng thái có dữ liệu */
          <PaymentPanel
            order={order}
            payment={payment}
            actions={
              order.status === "PENDING" ? (
                <div className="flex flex-col sm:flex-row items-center justify-end gap-3">
                  {order.payment_reported_at ? (
                    <span className="text-xs font-bold text-brand-600 py-2.5 px-4 bg-brand-50 rounded-xl border border-brand-200">
                      Đã báo — chờ KitoKit xác nhận
                    </span>
                  ) : (
                    <button
                      type="button"
                      disabled={actionLoading}
                      onClick={handleReportPaid}
                      className="w-full sm:w-auto px-5 py-2.5 bg-brand-600 hover:bg-brand-700 text-white rounded-xl text-xs font-bold shadow transition-all flex items-center justify-center space-x-1.5 disabled:opacity-50"
                    >
                      {actionLoading ? (
                        <Loader2 className="w-4 h-4 animate-spin text-white" />
                      ) : (
                        <CheckCircle2 className="w-4 h-4 text-white" />
                      )}
                      <span>Tôi đã chuyển khoản</span>
                    </button>
                  )}

                  <button
                    type="button"
                    disabled={actionLoading}
                    onClick={handleCancelOrder}
                    className="w-full sm:w-auto px-4 py-2.5 bg-surface-alt hover:bg-rose-50 text-rose-700 border border-line hover:border-rose-200 rounded-xl text-xs font-bold transition-all flex items-center justify-center space-x-1.5 disabled:opacity-50"
                  >
                    <Ban className="w-4 h-4 text-rose-700" />
                    <span>Huỷ đơn</span>
                  </button>
                </div>
              ) : null
            }
          />
        )}
      </div>
    </TeacherLayout>
  );
}
