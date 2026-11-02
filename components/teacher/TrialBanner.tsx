"use client";

import { useEffect, useState } from "react";
import { Sparkles, AlertTriangle } from "lucide-react";

interface TrialUsagePayload {
  success?: boolean;
  status?: "TRIAL" | "VERIFIED" | "REJECTED" | string;
  limits?: {
    classes: number;
    contents: number;
    students: number;
    attemptsPerItem?: number;
  } | null;
  used?: {
    classes: number;
    contents: number;
    students: number;
  } | null;
  reviewNote?: string | null;
}

export default function TrialBanner() {
  const [data, setData] = useState<TrialUsagePayload | null>(null);

  useEffect(() => {
    let active = true;
    fetch("/api/teacher/trial-usage")
      .then((res) => (res.ok ? res.json() : null))
      .then((json: TrialUsagePayload | null) => {
        if (active && json && json.success) {
          setData(json);
        }
      })
      .catch(() => {
        // Bỏ qua lỗi: không hiện banner
      });
    return () => {
      active = false;
    };
  }, []);

  if (!data || !data.limits || !data.used) {
    return null;
  }

  const { limits, used, status, reviewNote } = data;
  const isRejected = status === "REJECTED";

  return (
    <div
      className={`mb-6 rounded-2xl border px-4 py-3 text-xs font-medium shadow-sm ${
        isRejected
          ? "bg-amber-50 border-amber-300 text-amber-950"
          : "bg-accent-400/20 border-accent-400 text-ink"
      }`}
    >
      <div className="flex flex-wrap items-center gap-2">
        {isRejected ? (
          <AlertTriangle className="h-4 w-4 shrink-0 text-amber-700" />
        ) : (
          <Sparkles className="h-4 w-4 shrink-0 text-brand-600" />
        )}
        <span>
          Đang dùng thử · {used.classes}/{limits.classes} lớp · {used.contents}/
          {limits.contents} bài học &amp; đề · {used.students}/{limits.students}{" "}
          học sinh — KitoKit sẽ liên hệ xác minh để mở đủ tính năng
        </span>
      </div>
      {isRejected && reviewNote && (
        <p className="mt-1.5 pl-6 text-xs font-semibold text-amber-900">
          Ghi chú xác minh: {reviewNote}
        </p>
      )}
    </div>
  );
}
