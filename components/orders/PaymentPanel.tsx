"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { findBankByBin } from "@/lib/vietqr-banks";
import { Copy, Check, AlertTriangle, ShieldCheck, FileText } from "lucide-react";

export interface OrderData {
  id: string;
  code: string;
  teacher_id?: string;
  teacher_name?: string;
  teacher_email?: string;
  requested_slots: number;
  unit_price: number;
  total_cost: number;
  status: "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED";
  source?: "TEACHER" | "ADMIN";
  note?: string | null;
  payment_reported_at?: string | null;
  decided_by?: string | null;
  decided_at?: string | null;
  reject_reason?: string | null;
  created_at: string;
}

export interface PaymentData {
  configured: boolean;
  bank_bin?: string;
  bank_name?: string;
  account_no?: string;
  account_name?: string;
  amount: number;
  add_info: string;
  qr_payload?: string | null;
}

export interface PaymentPanelProps {
  order: OrderData;
  payment: PaymentData;
  actions?: React.ReactNode;
}

export default function PaymentPanel({ order, payment, actions }: PaymentPanelProps) {
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  useEffect(() => {
    if (order.status === "PENDING" && payment.configured && payment.qr_payload) {
      QRCode.toDataURL(payment.qr_payload, {
        width: 320,
        margin: 2,
        color: {
          dark: "#000000",
          light: "#ffffff",
        },
      })
        .then((url) => setQrDataUrl(url))
        .catch((err) => {
          console.error("Lỗi khi vẽ mã QR:", err);
          setQrDataUrl(null);
        });
    } else {
      setQrDataUrl(null);
    }
  }, [order.status, payment.configured, payment.qr_payload]);

  const copyToClipboard = (key: string, text: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text).then(() => {
      setCopiedKey(key);
      setTimeout(() => {
        setCopiedKey((curr) => (curr === key ? null : curr));
      }, 2000);
    });
  };

  const bankDisplay =
    payment.bank_name ||
    (payment.bank_bin ? findBankByBin(payment.bank_bin)?.short_name : "") ||
    "Ngân hàng nhận tiền";

  // Huy hiệu trạng thái
  const renderBadge = () => {
    if (order.status === "PENDING") {
      if (order.payment_reported_at) {
        return (
          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-brand-100 text-brand-700 border border-brand-200">
            Đã báo chuyển khoản
          </span>
        );
      }
      return (
        <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-200">
          Chờ thanh toán
        </span>
      );
    }
    if (order.status === "APPROVED") {
      return (
        <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
          Đã duyệt
        </span>
      );
    }
    if (order.status === "REJECTED") {
      return (
        <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-rose-100 text-rose-800 border border-rose-200">
          Từ chối
          {order.reject_reason ? `: ${order.reject_reason}` : ""}
        </span>
      );
    }
    if (order.status === "CANCELLED") {
      return (
        <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-rose-100 text-rose-800 border border-rose-200">
          Đã huỷ
        </span>
      );
    }
    return null;
  };

  const isPending = order.status === "PENDING";

  return (
    <div className="bg-white rounded-3xl border border-line p-6 md:p-8 space-y-6 shadow-sm">
      {/* Header đơn hàng */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-line/40 gap-3">
        <div>
          <span className="text-xs uppercase font-bold text-ink-muted">Đơn hàng mua slot</span>
          <h2 className="text-xl md:text-2xl font-bold text-ink tracking-tight flex items-center gap-2">
            <span>Mã đơn: {order.code}</span>
          </h2>
          <p className="text-xs text-ink-subtle mt-0.5">
            Tạo lúc: {new Date(order.created_at).toLocaleString("vi-VN")}
          </p>
        </div>
        <div>{renderBadge()}</div>
      </div>

      {/* Nội dung thanh toán hoặc biên nhận */}
      {!payment.configured && isPending ? (
        <div className="p-6 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 flex items-start space-x-3">
          <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="font-bold">Chưa cấu hình tài khoản</p>
            <p className="mt-1">
              KitoKit chưa cấu hình tài khoản nhận tiền, vui lòng liên hệ quản trị viên.
            </p>
          </div>
        </div>
      ) : isPending ? (
        <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-start">
          {/* Cột QR Code */}
          <div className="md:col-span-5 flex flex-col items-center justify-center p-6 bg-surface-alt rounded-2xl border border-line text-center space-y-3">
            {qrDataUrl ? (
              <img
                src={qrDataUrl}
                alt="VietQR thanh toán"
                className="w-[240px] h-[240px] rounded-xl border border-line shadow-sm bg-white p-2 object-contain"
              />
            ) : (
              <div className="w-[240px] h-[240px] rounded-xl border border-dashed border-line flex items-center justify-center text-xs text-ink-muted">
                Đang tạo mã VietQR...
              </div>
            )}
            <div className="text-center">
              <p className="text-xs text-ink-subtle">Quét mã bằng app ngân hàng</p>
              <p className="text-sm font-bold text-brand-600">{bankDisplay}</p>
            </div>
          </div>

          {/* Cột Thông tin chuyển khoản */}
          <div className="md:col-span-7 space-y-4">
            <h3 className="text-sm font-bold uppercase tracking-wider text-ink-muted flex items-center gap-1.5">
              <FileText className="w-4 h-4 text-brand-600" />
              <span>Thông tin chuyển khoản</span>
            </h3>

            <div className="divide-y divide-line/40 bg-surface-alt rounded-2xl border border-line p-4 text-xs">
              {/* Ngân hàng */}
              <div className="py-2.5 flex items-center justify-between">
                <div>
                  <span className="text-ink-subtle block">Ngân hàng</span>
                  <span className="font-bold text-sm text-ink">{payment.bank_name || bankDisplay}</span>
                </div>
                <button
                  type="button"
                  onClick={() => copyToClipboard("bank_name", payment.bank_name || bankDisplay)}
                  className="px-3 py-1.5 rounded-lg border border-line bg-white hover:bg-brand-50 text-ink text-xs font-medium flex items-center gap-1 transition-colors"
                >
                  {copiedKey === "bank_name" ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                      <span className="text-emerald-700 font-bold">Đã sao chép</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5 text-ink-muted" />
                      <span>Sao chép</span>
                    </>
                  )}
                </button>
              </div>

              {/* Số tài khoản */}
              <div className="py-2.5 flex items-center justify-between">
                <div>
                  <span className="text-ink-subtle block">Số tài khoản</span>
                  <span className="font-mono font-bold text-sm text-ink">{payment.account_no || ""}</span>
                </div>
                <button
                  type="button"
                  onClick={() => copyToClipboard("account_no", payment.account_no || "")}
                  className="px-3 py-1.5 rounded-lg border border-line bg-white hover:bg-brand-50 text-ink text-xs font-medium flex items-center gap-1 transition-colors"
                >
                  {copiedKey === "account_no" ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                      <span className="text-emerald-700 font-bold">Đã sao chép</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5 text-ink-muted" />
                      <span>Sao chép</span>
                    </>
                  )}
                </button>
              </div>

              {/* Chủ tài khoản */}
              <div className="py-2.5 flex items-center justify-between">
                <div>
                  <span className="text-ink-subtle block">Chủ tài khoản</span>
                  <span className="font-bold text-sm text-ink">{payment.account_name || ""}</span>
                </div>
                <button
                  type="button"
                  onClick={() => copyToClipboard("account_name", payment.account_name || "")}
                  className="px-3 py-1.5 rounded-lg border border-line bg-white hover:bg-brand-50 text-ink text-xs font-medium flex items-center gap-1 transition-colors"
                >
                  {copiedKey === "account_name" ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                      <span className="text-emerald-700 font-bold">Đã sao chép</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5 text-ink-muted" />
                      <span>Sao chép</span>
                    </>
                  )}
                </button>
              </div>

              {/* Số tiền */}
              <div className="py-2.5 flex items-center justify-between">
                <div>
                  <span className="text-ink-subtle block">Số tiền</span>
                  <span className="font-bold text-base text-brand-600">
                    {payment.amount.toLocaleString("vi-VN")} đ
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => copyToClipboard("amount", String(payment.amount))}
                  className="px-3 py-1.5 rounded-lg border border-line bg-white hover:bg-brand-50 text-ink text-xs font-medium flex items-center gap-1 transition-colors"
                >
                  {copiedKey === "amount" ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                      <span className="text-emerald-700 font-bold">Đã sao chép</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5 text-ink-muted" />
                      <span>Sao chép</span>
                    </>
                  )}
                </button>
              </div>

              {/* Nội dung chuyển khoản */}
              <div className="py-2.5 flex items-center justify-between">
                <div>
                  <span className="text-ink-subtle block">Nội dung chuyển khoản (bắt buộc đúng)</span>
                  <span className="font-mono font-bold text-sm text-ink-base bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                    {payment.add_info}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => copyToClipboard("add_info", payment.add_info)}
                  className="px-3 py-1.5 rounded-lg border border-line bg-white hover:bg-brand-50 text-ink text-xs font-medium flex items-center gap-1 transition-colors"
                >
                  {copiedKey === "add_info" ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                      <span className="text-emerald-700 font-bold">Đã sao chép</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5 text-ink-muted" />
                      <span>Sao chép</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-brand-50/50 border border-brand-100 text-ink-subtle text-xs">
              <p>
                <strong>Lưu ý:</strong> Vui lòng giữ nguyên nội dung chuyển khoản để hệ thống tự động
                khớp đơn nhanh nhất.
              </p>
            </div>
          </div>
        </div>
      ) : (
        /* Biên nhận khi đơn không còn PENDING */
        <div className="p-6 rounded-2xl bg-surface-alt border border-line space-y-4">
          <div className="flex items-center space-x-2 text-brand-600 font-bold">
            <ShieldCheck className="w-5 h-5 text-brand-600" />
            <span>Biên nhận đơn hàng</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 text-xs">
            <div className="p-3 bg-white rounded-xl border border-line">
              <span className="text-ink-subtle block">Mã đơn hàng</span>
              <span className="font-mono font-bold text-sm text-ink">{order.code}</span>
            </div>
            <div className="p-3 bg-white rounded-xl border border-line">
              <span className="text-ink-subtle block">Số slot</span>
              <span className="font-bold text-sm text-brand-600">
                +{order.requested_slots.toLocaleString("vi-VN")} slots
              </span>
            </div>
            <div className="p-3 bg-white rounded-xl border border-line">
              <span className="text-ink-subtle block">Số tiền</span>
              <span className="font-bold text-sm text-ink">
                {order.total_cost.toLocaleString("vi-VN")} đ
              </span>
            </div>
            <div className="p-3 bg-white rounded-xl border border-line">
              <span className="text-ink-subtle block">Thời điểm duyệt/xử lý</span>
              <span className="font-bold text-xs text-ink">
                {order.decided_at
                  ? new Date(order.decided_at).toLocaleString("vi-VN")
                  : "Chưa có"}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Chi tiết đơn */}
      <div className="pt-4 border-t border-line/40 grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
        <div>
          <span className="text-ink-subtle block">Số lượng slot mua:</span>
          <strong className="text-brand-600 text-sm">
            +{order.requested_slots.toLocaleString("vi-VN")} slot học sinh
          </strong>
        </div>
        <div>
          <span className="text-ink-subtle block">Đơn giá:</span>
          <strong className="text-ink">
            {order.unit_price > 0
              ? `${order.unit_price.toLocaleString("vi-VN")} đ / slot`
              : "Theo thoả thuận"}
          </strong>
        </div>
        <div>
          <span className="text-ink-subtle block">Tổng thanh toán:</span>
          <strong className="text-ink text-sm">
            {order.total_cost.toLocaleString("vi-VN")} đ
          </strong>
        </div>
      </div>

      {/* Ghi chú đơn nếu có */}
      {order.note && (
        <div className="p-3 bg-surface-alt rounded-xl border border-line text-xs text-ink">
          <span className="font-bold text-ink-muted">Ghi chú đơn hàng:</span> {order.note}
        </div>
      )}

      {/* Actions (nút thao tác) */}
      {actions && <div className="pt-4 border-t border-line/40">{actions}</div>}
    </div>
  );
}
