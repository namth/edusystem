"use client";

import Link from "next/link";
import { AlertTriangle, Lock, Clock, AlertCircle } from "lucide-react";

interface ClassBillingBannerProps {
  billing_status?: "ACTIVE" | "GRACE" | "LOCKED" | "ENDED" | string;
  status?: string;
  grace_until?: string | null;
}

export function ClassBillingBanner({
  billing_status,
  status,
  grace_until,
}: ClassBillingBannerProps) {
  const currentStatus = (billing_status || status || "ACTIVE").toUpperCase();

  if (currentStatus === "ACTIVE") {
    return null;
  }

  // Tính số ngày còn lại trong thời gian ân hạn
  let daysRemaining = 7;
  if (grace_until) {
    const until = new Date(grace_until).getTime();
    const now = Date.now();
    const diff = Math.ceil((until - now) / (1000 * 60 * 60 * 24));
    daysRemaining = Math.max(0, diff);
  }

  if (currentStatus === "GRACE") {
    return (
      <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-sm">
        <div className="flex items-center space-x-3">
          <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
          <div className="text-xs sm:text-sm">
            <span className="font-bold">Lớp không đủ slot cho tháng mới.</span>{" "}
            <span>Còn {daysRemaining} ngày trước khi tạm khoá.</span>
          </div>
        </div>
        <Link
          href="/teacher/slots"
          className="inline-flex items-center px-3.5 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm shrink-0"
        >
          Mua slot
        </Link>
      </div>
    );
  }

  if (currentStatus === "LOCKED") {
    return (
      <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-900 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-sm">
        <div className="flex items-center space-x-3">
          <Lock className="w-5 h-5 text-rose-600 shrink-0" />
          <div className="text-xs sm:text-sm font-semibold">
            Lớp đang tạm khoá: học sinh chỉ xem được bài cũ.
          </div>
        </div>
        <Link
          href="/teacher/slots"
          className="inline-flex items-center px-3.5 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm shrink-0"
        >
          Mua slot
        </Link>
      </div>
    );
  }

  if (currentStatus === "ENDED") {
    return (
      <div className="p-4 rounded-2xl bg-slate-100 border border-slate-200 text-slate-700 flex items-center space-x-3 shadow-sm">
        <Clock className="w-5 h-5 text-slate-500 shrink-0" />
        <div className="text-xs sm:text-sm font-medium">Lớp đã kết thúc</div>
      </div>
    );
  }

  return null;
}

export default ClassBillingBanner;
