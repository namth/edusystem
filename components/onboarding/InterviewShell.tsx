"use client";

import React from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import Mascot, { type MascotMood } from "./Mascot";
import SpeechBubble from "./SpeechBubble";

interface InterviewShellProps {
  stepIndex: number;
  totalSteps: number;
  canGoBack: boolean;
  onBack: () => void;
  mood: MascotMood;
  question: string;
  subtext?: string | null;
  errorMessage?: string | null;
  audience?: "student" | "teacher";
  children: React.ReactNode;
}

export default function InterviewShell({
  stepIndex,
  totalSteps,
  canGoBack,
  onBack,
  mood,
  question,
  subtext,
  errorMessage,
  audience = "student",
  children,
}: InterviewShellProps) {
  const progress = Math.max(
    0,
    Math.min(100, Math.round((stepIndex / Math.max(1, totalSteps)) * 100))
  );

  return (
    <div className="min-h-screen w-full overflow-x-hidden bg-surface-alt flex flex-col font-sans text-ink">
      {/* Thanh đầu trang + tiến độ */}
      <header className="w-full bg-white/90 backdrop-blur-md border-b border-line">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            {canGoBack ? (
              <button
                type="button"
                aria-label="Quay lại"
                onClick={onBack}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-line bg-surface-alt hover:bg-brand-50 text-xs font-bold text-ink transition-colors cursor-pointer shrink-0"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Quay lại</span>
              </button>
            ) : (
              <Link href="/" className="inline-flex items-center gap-2 shrink-0">
                <img
                  src="/brand/kitokit-mark-transparent.png"
                  alt="KitoKit"
                  className="w-8 h-8 object-contain"
                />
                <span className="font-display text-lg font-extrabold text-brand-600">
                  KitoKit
                </span>
              </Link>
            )}
          </div>

          <div className="flex-1 max-w-xs sm:max-w-md mx-2">
            <div
              role="progressbar"
              aria-label="Tiến độ đăng ký"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={progress}
              className="w-full h-2.5 bg-line-soft rounded-full overflow-hidden"
            >
              <div
                className="h-full bg-gradient-to-r from-brand-500 to-accent-400 rounded-full transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>

          <Link
            href="/login"
            className="text-xs font-bold text-brand-600 hover:text-brand-700 whitespace-nowrap shrink-0"
          >
            Đăng nhập
          </Link>
        </div>
      </header>

      {/* Thân phỏng vấn: 2 cột trên màn rộng, 1 cột trên màn hẹp */}
      <main className="flex-1 flex items-center justify-center px-4 sm:px-6 py-6 sm:py-10">
        <div className="w-full max-w-4xl grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-10 items-center">
          {/* Cột trái: Mascot + Bong bóng thoại */}
          <div className="lg:col-span-5 flex flex-col items-center lg:items-start gap-4">
            <div className="flex items-center gap-3 lg:flex-col lg:items-start w-full">
              <Mascot mood={mood} size="md" className="shrink-0" />
              <div className="flex-1 w-full">
                <SpeechBubble
                  text={question}
                  subtext={subtext}
                  variant={errorMessage ? "error" : "default"}
                />
              </div>
            </div>

            {errorMessage && (
              <div
                role="alert"
                className="w-full rounded-2xl bg-rose-50 border border-rose-200 px-4 py-3 text-xs sm:text-sm font-bold text-rose-800"
              >
                {errorMessage}
              </div>
            )}
          </div>

          {/* Cột phải: Vùng trả lời */}
          <div className="lg:col-span-7 w-full">
            <div className="w-full bg-white rounded-3xl border border-line p-5 sm:p-8 shadow-sm">
              {children}
            </div>
          </div>
        </div>
      </main>

      {/* Chân trang: liên kết chuyển đổi vai trò & đăng nhập */}
      <footer className="py-4 px-4 sm:px-6 border-t border-line/60 bg-white/60">
        <div className="max-w-4xl mx-auto flex flex-wrap items-center justify-between gap-2 text-xs text-ink-muted">
          <div>
            Đã có tài khoản?{" "}
            <Link href="/login" className="font-bold text-brand-600 hover:underline">
              Đăng nhập
            </Link>
          </div>
          <div>
            {audience === "student" ? (
              <>
                Bạn là giáo viên?{" "}
                <Link
                  href="/register/teacher"
                  className="font-bold text-brand-600 hover:underline"
                >
                  Đăng ký dùng thử giáo viên
                </Link>
              </>
            ) : (
              <>
                Bạn là học sinh?{" "}
                <Link href="/register" className="font-bold text-brand-600 hover:underline">
                  Đăng ký tài khoản học sinh
                </Link>
              </>
            )}
          </div>
        </div>
      </footer>
    </div>
  );
}
