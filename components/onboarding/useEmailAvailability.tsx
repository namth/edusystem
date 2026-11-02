"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { CheckCircle2, Loader2 } from "lucide-react";
import { isPlaceholderEmail, PLACEHOLDER_EMAIL_DOMAIN } from "@/lib/onboarding";

export type EmailStatus = "idle" | "checking" | "available" | "taken" | "invalid";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Kiểm tra email còn dùng được ngay khi gõ (chờ 400ms), giống kiểm tra tên đăng nhập.
// Kết quả server lưu kèm email đã kiểm; email đổi mà chưa có kết quả → "checking".
export function useEmailAvailability(rawEmail: string, active: boolean) {
  const email = rawEmail.trim().toLowerCase();
  const [check, setCheck] = useState<{ email: string; available: boolean; message: string | null } | null>(null);

  const localError = !email
    ? null
    : !EMAIL_RE.test(email)
      ? "Nhập đầy đủ dạng ten@mien.com nhé."
      : isPlaceholderEmail(email)
        ? `Đuôi @${PLACEHOLDER_EMAIL_DOMAIN} dành cho email tạm của hệ thống, vui lòng dùng email thật.`
        : null;

  useEffect(() => {
    if (!active || !email || localError) return;
    let cancelled = false;
    const timer = window.setTimeout(async () => {
      try {
        const res = await fetch(`/api/auth/email-available?e=${encodeURIComponent(email)}`);
        const data = await res.json().catch(() => ({}));
        if (cancelled) return;
        if (res.ok && data.success) {
          setCheck({ email, available: !!data.available, message: data.available ? null : data.error || null });
        } else {
          // Lỗi mạng / quá giới hạn: không chặn người dùng, server vẫn kiểm lại khi nộp
          setCheck({ email, available: true, message: null });
        }
      } catch {
        if (!cancelled) setCheck({ email, available: true, message: null });
      }
    }, 400);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [active, email, localError]);

  const done = check && check.email === email ? check : null;
  const status: EmailStatus = !email
    ? "idle"
    : localError
      ? "invalid"
      : !done
        ? "checking"
        : done.available
          ? "available"
          : "taken";
  const message = localError ?? done?.message ?? null;

  return { status, message };
}

export function EmailAvailabilityHint({ status, message }: { status: EmailStatus; message: string | null }) {
  if (status === "idle") return null;
  if (status === "checking") {
    return (
      <p className="flex items-center gap-1.5 text-xs font-bold text-ink-muted">
        <Loader2 className="w-3.5 h-3.5 animate-spin" /> Đang kiểm tra email…
      </p>
    );
  }
  if (status === "available") {
    return (
      <p className="flex items-center gap-1.5 text-xs font-bold text-emerald-700">
        <CheckCircle2 className="w-3.5 h-3.5" /> Email này dùng được
      </p>
    );
  }
  if (status === "invalid") {
    return <p className="text-xs font-bold text-ink-muted">{message}</p>;
  }
  return (
    <div className="rounded-xl bg-rose-50 border border-rose-200 px-3 py-2 text-xs font-bold text-rose-700">
      {message || "Email này đã được dùng để đăng ký."}{" "}
      <Link href="/login" className="underline text-brand-700">
        Đăng nhập
      </Link>
    </div>
  );
}
