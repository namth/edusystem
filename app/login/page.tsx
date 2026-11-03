"use client";

import React, { useState, useEffect, Suspense, useSyncExternalStore } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Mail,
  Lock,
  LogIn,
  AlertCircle,
  Loader2,
  Eye,
  EyeOff,
  GraduationCap,
  BookOpen,
  Sparkles,
  CheckCircle2,
  ArrowRight,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import Mascot, { type MascotMood } from "@/components/onboarding/Mascot";
import SpeechBubble from "@/components/onboarding/SpeechBubble";
import { safeNextPath } from "@/components/onboarding/redirect";

const noopSubscribe = () => () => {};

function greetingByHour(): string {
  const h = new Date().getHours();
  if (h < 11) {
    return "Chào buổi sáng! Hôm nay mình cùng chinh phục bài học mới nhé.";
  }
  if (h < 18) {
    return "Chào buổi chiều! Sẵn sàng luyện tập và bứt phá điểm số cùng Kito chưa?";
  }
  return "Chào buổi tối! Ôn bài nhẹ nhàng cùng Kito trước khi nghỉ ngơi nhé.";
}

function LoginFormContent() {
  const { user, loading: authLoading, login } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const rawNext = searchParams.get("next") ?? searchParams.get("redirectTo");

  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [mood, setMood] = useState<MascotMood>("idle");
  // Server render câu chào chung, trình duyệt dùng câu chào theo giờ máy người dùng
  const greeting = useSyncExternalStore(
    noopSubscribe,
    greetingByHour,
    () => "Chào bạn! Đăng nhập để bắt đầu học và làm bài cùng Kito nhé."
  );

  useEffect(() => {
    if (!authLoading && user) {
      if (user.mustChangePassword) {
        router.replace("/change-password");
      } else {
        router.replace(safeNextPath(rawNext, user.role));
      }
    }
  }, [authLoading, user, rawNext, router]);

  const handleStandardLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!identifier.trim() || !password.trim()) {
      setMood("oops");
      setErrorMsg("Vui lòng nhập đầy đủ Email hoặc tên đăng nhập và Mật khẩu.");
      return;
    }

    setLoading(true);
    setMood("think");
    try {
      const res = await login(identifier.trim(), password);
      if (res.success && res.user) {
        setMood("happy");
        if (res.user.mustChangePassword) {
          router.push("/change-password");
        } else {
          router.push(safeNextPath(rawNext, res.user.role));
        }
      } else {
        setMood("oops");
        if (res.status === 429 && res.retryAfterSeconds) {
          const mins = Math.max(1, Math.ceil(res.retryAfterSeconds / 60));
          setErrorMsg(
            res.error || `Bạn đã thử sai quá nhiều lần. Vui lòng thử lại sau ${mins} phút.`
          );
        } else {
          setErrorMsg(res.error || "Email hoặc mật khẩu không chính xác.");
        }
      }
    } catch {
      setMood("oops");
      setErrorMsg("Không thể kết nối máy chủ. Vui lòng thử lại.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full overflow-x-hidden bg-surface-alt flex flex-col lg:flex-row font-sans text-ink">
      {/* Nửa trái trên màn rộng: nền gradient brand + mascot có quầng sáng */}
      <section className="hidden lg:flex lg:w-1/2 relative isolate overflow-hidden bg-gradient-to-br from-brand-900 via-brand-800 to-brand-600 text-white p-12 flex-col justify-between">
        <div
          className="absolute inset-0 -z-10 kk-grid-dark [mask-image:radial-gradient(ellipse_at_center,black,transparent_75%)]"
          aria-hidden="true"
        />

        <div className="flex items-center justify-between">
          <Link href="/" className="inline-flex items-center">
            <img src="/brand/kitokit-logo-ngang.png" alt="KitoKit" className="h-14 w-auto object-contain" />
          </Link>
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/10 border border-white/15 text-brand-100 text-xs font-bold">
            <Sparkles className="w-3.5 h-3.5 text-accent-400" />
            Học vui · Thi chắc
          </span>
        </div>

        <div className="my-auto py-8 space-y-6 max-w-lg">
          <div className="flex items-center gap-5">
            <div className="relative">
              <div
                className="absolute -inset-4 rounded-full bg-white/30 blur-2xl pointer-events-none"
                aria-hidden="true"
              />
              <Mascot mood={mood} size="lg" />
            </div>
            <div className="flex-1">
              <SpeechBubble
                text={errorMsg ? "Ôi, thông tin đăng nhập chưa khớp rồi. Bạn kiểm tra lại nhé!" : greeting}
                variant="dark"
              />
            </div>
          </div>

          <h1 className="font-display text-3xl xl:text-4xl font-extrabold leading-tight text-white">
            Không gian học tập &amp; luyện thi thông minh cùng trợ lý Kito
          </h1>

          <ul className="space-y-3 text-sm text-brand-100">
            <li className="flex items-center gap-2.5">
              <CheckCircle2 className="w-5 h-5 text-accent-400 shrink-0" />
              <span>Làm bài trắc nghiệm có điểm ngay, AI chấm Viết &amp; Nói chi tiết</span>
            </li>
            <li className="flex items-center gap-2.5">
              <CheckCircle2 className="w-5 h-5 text-accent-400 shrink-0" />
              <span>Học sinh đăng nhập nhanh bằng email hoặc tên đăng nhập riêng</span>
            </li>
            <li className="flex items-center gap-2.5">
              <CheckCircle2 className="w-5 h-5 text-accent-400 shrink-0" />
              <span>Thầy cô quản lý lộ trình lớp học và ngân hàng đề đa môn</span>
            </li>
          </ul>
        </div>

        <div className="text-xs text-brand-200 flex items-center justify-between">
          <span>© 2026 KitoKit</span>
          <span>Nền tảng học &amp; thi đa môn</span>
        </div>
      </section>

      {/* Nửa phải (hoặc toàn màn trên mobile): thẻ đăng nhập */}
      <main className="flex-1 flex flex-col items-center justify-center px-4 sm:px-6 py-8 sm:py-12">
        {/* Mascot nhỏ phía trên thẻ ở màn hẹp */}
        <div className="lg:hidden flex flex-col items-center text-center mb-6 space-y-2 max-w-sm">
          <Link href="/" className="inline-flex items-center gap-2 mb-1">
            <span className="font-display text-xl font-extrabold text-brand-600">
              KitoKit
            </span>
          </Link>
          <Mascot mood={mood} size="sm" />
          <p className="text-xs font-medium text-ink-muted px-2">{greeting}</p>
        </div>

        <div className="w-full max-w-md bg-white rounded-3xl border border-line p-6 sm:p-8 md:p-10 shadow-sm space-y-6">
          <div>
            <h2 className="font-display text-2xl sm:text-3xl font-extrabold text-ink tracking-tight">
              Đăng nhập KitoKit
            </h2>
            <p className="text-xs sm:text-sm text-ink-muted mt-1">
              Dành cho học sinh, giáo viên và quản trị viên.
            </p>
          </div>

          {errorMsg && (
            <div
              role="alert"
              className="p-3.5 bg-rose-50 border border-rose-200 text-rose-800 rounded-2xl text-xs sm:text-sm font-bold flex items-start gap-2.5"
            >
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          <form onSubmit={handleStandardLogin} className="space-y-4">
            <div>
              <label
                htmlFor="login-identifier"
                className="block text-xs font-bold uppercase text-brand-700 mb-1.5"
              >
                Email hoặc tên đăng nhập
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-subtle" />
                <input
                  id="login-identifier"
                  type="text"
                  required
                  autoComplete="username"
                  aria-label="Email hoặc tên đăng nhập"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  placeholder="Email hoặc tên đăng nhập"
                  className="w-full pl-10 pr-3.5 py-3 bg-surface-alt border border-line rounded-2xl text-sm font-semibold text-ink placeholder-ink-subtle focus:outline-none focus:ring-2 focus:ring-brand-600"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label
                  htmlFor="login-password"
                  className="block text-xs font-bold uppercase text-brand-700"
                >
                  Mật khẩu
                </label>
                <Link
                  href="/forgot-password"
                  className="text-xs font-bold text-brand-600 hover:underline"
                >
                  Quên mật khẩu?
                </Link>
              </div>
              <div className="relative">
                <Lock className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-subtle" />
                <input
                  id="login-password"
                  type={showPassword ? "text" : "password"}
                  required
                  autoComplete="current-password"
                  aria-label="Mật khẩu"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Mật khẩu"
                  className="w-full pl-10 pr-10 py-3 bg-surface-alt border border-line rounded-2xl text-sm font-semibold text-ink placeholder-ink-subtle focus:outline-none focus:ring-2 focus:ring-brand-600"
                />
                <button
                  type="button"
                  aria-label={showPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
                  onClick={() => setShowPassword((prev) => !prev)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-subtle hover:text-ink cursor-pointer"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 px-6 bg-gradient-to-r from-accent-400 to-accent-500 hover:from-accent-500 hover:to-accent-600 text-white font-bold text-sm rounded-2xl shadow-md transition-all cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-white" />
                  <span>Đang đăng nhập...</span>
                </>
              ) : (
                <>
                  <LogIn className="w-4 h-4 text-white" />
                  <span>Đăng nhập</span>
                </>
              )}
            </button>
          </form>

          {/* 2 thẻ chọn đăng ký mới */}
          <div className="pt-4 border-t border-line space-y-3">
            <p className="text-xs font-bold uppercase tracking-wider text-ink-subtle text-center">
              Chưa có tài khoản? Chọn vai trò của bạn
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Link
                href="/register"
                className="group p-3.5 rounded-2xl border border-line hover:border-brand-500 bg-surface-alt hover:bg-brand-50/60 transition-all flex flex-col justify-between gap-2"
              >
                <div className="flex items-center justify-between">
                  <span className="w-8 h-8 rounded-xl bg-brand-100 text-brand-700 flex items-center justify-center">
                    <GraduationCap className="w-4 h-4" />
                  </span>
                  <ArrowRight className="w-4 h-4 text-ink-subtle group-hover:text-brand-600 transition-colors" />
                </div>
                <div>
                  <p className="text-xs font-extrabold text-ink">Tôi là học sinh</p>
                  <p className="text-[11px] text-ink-muted font-medium">Tạo tài khoản</p>
                </div>
              </Link>

              <Link
                href="/register/teacher"
                className="group p-3.5 rounded-2xl border border-line hover:border-accent-400 bg-surface-alt hover:bg-accent-50/60 transition-all flex flex-col justify-between gap-2"
              >
                <div className="flex items-center justify-between">
                  <span className="w-8 h-8 rounded-xl bg-accent-100 text-accent-700 flex items-center justify-center">
                    <BookOpen className="w-4 h-4" />
                  </span>
                  <ArrowRight className="w-4 h-4 text-ink-subtle group-hover:text-accent-600 transition-colors" />
                </div>
                <div>
                  <p className="text-xs font-extrabold text-ink">Tôi là giáo viên</p>
                  <p className="text-[11px] text-ink-muted font-medium">Dùng thử miễn phí</p>
                </div>
              </Link>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-surface-alt flex items-center justify-center text-xs font-bold text-brand-600">
          Đang tải...
        </div>
      }
    >
      <LoginFormContent />
    </Suspense>
  );
}
