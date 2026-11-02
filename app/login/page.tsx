"use client";

import { useState, Suspense } from "react";
import { useAuth } from "@/context/AuthContext";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { School, Mail, Lock, LogIn, AlertCircle, Loader2, Eye, EyeOff, Key, UserCheck, ShieldCheck, HelpCircle } from "lucide-react";

function LoginFormContent() {
  const { login } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get("redirectTo");

  const [activeTab, setActiveTab] = useState<"login" | "code">("login");
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [classCode, setClassCode] = useState("");
  const [studentName, setStudentName] = useState("");

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const redirectByRole = (role: string) => {
    if (redirectTo) {
      router.push(redirectTo);
      return;
    }
    if (role === "ADMIN") {
      router.push("/admin/requests");
    } else if (role === "TEACHER") {
      router.push("/teacher/classes");
    } else {
      router.push("/student/dashboard");
    }
  };

  const handleStandardLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    if (!identifier.trim() || !password.trim()) {
      setErrorMsg("Vui lòng điền đầy đủ Email/Tên đăng nhập và Mật khẩu.");
      return;
    }

    setLoading(true);
    try {
      const res = await login(identifier, password);
      if (res.success && res.user) {
        if (res.user.mustChangePassword) {
          router.push("/change-password");
        } else {
          redirectByRole(res.user.role);
        }
      } else {
        setErrorMsg(res.error || "Email/Username hoặc mật khẩu không đúng. Vui lòng kiểm tra lại!");
      }
    } catch (err: any) {
      console.error(err);
      setErrorMsg("Đã xảy ra lỗi kết nối. Vui lòng thử lại!");
    } finally {
      setLoading(false);
    }
  };

  const handleClassCodeJoin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!classCode.trim() || !studentName.trim()) {
      setErrorMsg("Vui lòng nhập Mã lớp học (6 ký tự) và Họ tên của bạn.");
      return;
    }
    setErrorMsg("Mã lớp học hợp lệ. Đang kết nối vào phòng thi thử...");
    setTimeout(() => {
      router.push("/student/dashboard");
    }, 1000);
  };

  return (
    <div className="bg-surface-alt min-h-screen flex flex-col academic-grid font-sans text-ink selection:bg-brand-600 selection:text-white">
      {/* Top Header */}
      <header className="fixed top-0 w-full h-16 flex items-center justify-between px-6 md:px-10 bg-white/80 backdrop-blur-md z-50 border-b border-line/30">
        <div className="flex items-center gap-2.5">
          <img src="/brand/kitokit-mark.png" alt="" className="w-9 h-9 object-contain" />
          <span className="text-xl font-bold text-brand-600 tracking-tight">
            KitoKit
          </span>
        </div>
        <div className="flex items-center gap-4">
          <Link
            href="/register"
            className="text-xs font-bold text-brand-600 hover:text-brand-700 transition-colors"
          >
            Chưa có tài khoản? Đăng ký ngay &rarr;
          </Link>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-grow flex items-center justify-center pt-24 pb-12 px-4 sm:px-6 md:px-10">
        <div className="max-w-[1100px] w-full grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12 items-center">
          
          {/* Left Visual / Branding Pane */}
          <div className="hidden lg:flex flex-col space-y-8 pr-6">
            <div className="space-y-4">
              <h1 className="text-4xl font-extrabold text-brand-600 leading-tight tracking-tight">
                Học Vui – Thi Chắc <br />
                <span className="text-ink-muted">Cổng Học & Thi Đa Môn KitoKit</span>
              </h1>
              <p className="text-sm text-ink-muted leading-relaxed max-w-md">
                Nền tảng học tập và luyện thi đa môn thông minh dành cho học sinh, phụ huynh và giáo viên với hệ thống bài tập phong phú cùng trợ lý AI chấm điểm chuẩn xác.
              </p>
            </div>

            {/* Floating Visual Image Card */}
            <div className="relative w-full aspect-square max-w-[380px] rounded-3xl overflow-hidden shadow-md border border-line/40 float-anim group">
              <div className="absolute inset-0 bg-gradient-to-tr from-brand-600/15 to-transparent z-10 pointer-events-none" />
              <img
                src="/brand/kitokit-mark.png"
                alt="KitoKit"
                className="w-full h-full object-contain bg-white p-8 transform group-hover:scale-105 transition-transform duration-700"
              />
            </div>

            {/* Features Highlight */}
            <div className="flex flex-col gap-2.5 text-xs text-ink-muted">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-brand-500" />
                <span>Tiếng Anh 4 kỹ năng tích hợp chấm AI tức thì</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-accent-400" />
                <span>Kho bài học & đề thi đa môn bám sát chương trình</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-brand-600" />
                <span>Theo dõi tiến độ và nhận xét chi tiết sau mỗi bài làm</span>
              </div>
            </div>
          </div>

          {/* Right Form Pane */}
          <div className="w-full flex justify-center lg:justify-end">
            <div className="w-full max-w-[440px] bg-white p-8 md:p-10 rounded-3xl shadow-sm border border-line/40 space-y-6">
              
              <div>
                <h2 className="text-2xl font-extrabold text-ink tracking-tight">
                  CỔNG ĐĂNG NHẬP HỌC VIÊN
                </h2>
                <p className="text-xs text-ink-subtle mt-1">
                  Chào mừng trở lại. Nhập thông tin để tiếp tục bài thi.
                </p>
              </div>

              {/* Login Method Tabs */}
              <div className="flex p-1 bg-brand-100 rounded-xl border border-line/30">
                <button
                  type="button"
                  onClick={() => { setActiveTab("login"); setErrorMsg(null); }}
                  className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                    activeTab === "login"
                      ? "bg-white text-brand-600 shadow-xs"
                      : "text-ink-subtle hover:text-ink"
                  }`}
                >
                  Đăng Nhập Chuẩn
                </button>
                <button
                  type="button"
                  onClick={() => { setActiveTab("code"); setErrorMsg(null); }}
                  className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                    activeTab === "code"
                      ? "bg-white text-brand-600 shadow-xs"
                      : "text-ink-subtle hover:text-ink"
                  }`}
                >
                  Vào Bằng Mã Lớp
                </button>
              </div>

              {errorMsg && (
                <div className="p-3.5 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs font-bold flex items-start space-x-2 animate-shake">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <span>{errorMsg}</span>
                </div>
              )}

              {/* Standard Login Form */}
              {activeTab === "login" ? (
                <form onSubmit={handleStandardLogin} className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold uppercase text-brand-600 mb-1.5">
                      Email / Tên Đăng Nhập
                    </label>
                    <div className="relative">
                      <Mail className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-subtle" />
                      <input
                        type="text"
                        required
                        value={identifier}
                        onChange={(e) => setIdentifier(e.target.value)}
                        placeholder="student.name@edu.vn"
                        className="w-full pl-10 pr-3 py-2.5 bg-surface-alt border border-line rounded-xl text-xs font-bold text-ink placeholder-ink-subtle focus:outline-none focus:ring-2 focus:ring-brand-600"
                      />
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="block text-xs font-bold uppercase text-brand-600">
                        Mật Khẩu
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
                        type={showPassword ? "text" : "password"}
                        required
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="••••••••"
                        className="w-full pl-10 pr-10 py-2.5 bg-surface-alt border border-line rounded-xl text-xs font-bold text-ink placeholder-ink-subtle focus:outline-none focus:ring-2 focus:ring-brand-600"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-subtle hover:text-ink cursor-pointer"
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-1">
                    <label className="flex items-center space-x-2 text-xs text-ink-muted font-medium cursor-pointer">
                      <input
                        type="checkbox"
                        defaultChecked
                        className="w-4 h-4 text-brand-600 border-line rounded focus:ring-brand-600"
                      />
                      <span>Duy trì đăng nhập 30 ngày</span>
                    </label>
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-3.5 bg-brand-600 hover:bg-brand-700 active:scale-[0.98] text-white font-bold text-xs rounded-xl shadow-md transition-all cursor-pointer flex items-center justify-center space-x-2 disabled:opacity-50"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin text-accent-400" />
                        <span>Đang xử lý đăng nhập...</span>
                      </>
                    ) : (
                      <>
                        <LogIn className="w-4 h-4 text-accent-400" />
                        <span>ĐĂNG NHẬP VÀO BẢNG ĐIỀU KHIỂN</span>
                      </>
                    )}
                  </button>
                </form>
              ) : (
                /* Class Code Join Form */
                <form onSubmit={handleClassCodeJoin} className="space-y-4">
                  <div className="p-3 bg-surface-alt rounded-xl border border-line/60 text-xs text-ink-muted flex items-start space-x-2">
                    <HelpCircle className="w-4 h-4 text-brand-600 shrink-0 mt-0.5" />
                    <span>
                      Nhập mã phòng thi 6 ký tự do giáo viên cấp để tham gia làm bài khảo thí nhanh.
                    </span>
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase text-brand-600 mb-1.5 text-center">
                      Mã Phòng Thi (6 Ký Tự)
                    </label>
                    <input
                      type="text"
                      maxLength={6}
                      value={classCode}
                      onChange={(e) => setClassCode(e.target.value.toUpperCase())}
                      placeholder="XXXXXX"
                      className="w-full text-center tracking-[0.4em] py-3 bg-surface-alt border-2 border-line rounded-xl text-base font-extrabold text-brand-600 placeholder-ink-subtle focus:outline-none focus:ring-2 focus:ring-brand-600 uppercase"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase text-brand-600 mb-1.5">
                      Họ và Tên Học Viên
                    </label>
                    <input
                      type="text"
                      value={studentName}
                      onChange={(e) => setStudentName(e.target.value)}
                      placeholder="Ví dụ: Nguyễn Văn An"
                      className="w-full px-3.5 py-2.5 bg-surface-alt border border-line rounded-xl text-xs font-bold text-ink placeholder-ink-subtle focus:outline-none focus:ring-2 focus:ring-brand-600"
                    />
                  </div>

                  <button
                    type="submit"
                    className="w-full py-3.5 bg-ink-muted hover:bg-ink-muted active:scale-[0.98] text-white font-bold text-xs rounded-xl shadow-md transition-all cursor-pointer flex items-center justify-center space-x-2"
                  >
                    <Key className="w-4 h-4 text-accent-400" />
                    <span>THAM GIA PHÒNG THI TỨC THỜI</span>
                  </button>
                </form>
              )}

              <div className="pt-4 border-t border-line/30 text-center">
                <p className="text-xs text-ink-subtle font-medium">
                  Chưa có tài khoản Học viên?{" "}
                  <Link href="/register" className="font-bold text-brand-600 hover:underline">
                    Đăng ký ngay
                  </Link>
                </p>
              </div>

            </div>
          </div>

        </div>
      </main>

      {/* Footer */}
      <footer className="mt-auto py-6 px-6 md:px-10 flex flex-col md:flex-row justify-between items-center gap-4 text-xs font-medium text-ink-subtle border-t border-line/30">
        <div className="flex items-center gap-3">
          <span>© 2026 KitoKit</span>
          <span className="w-1 h-1 bg-ink-subtle rounded-full" />
          <span>Hệ Thống Đánh Giá & Khảo Thí</span>
        </div>
        <div className="flex items-center gap-1.5 italic text-xs text-brand-600">
          <ShieldCheck className="w-4 h-4" />
          <span>Môi Trường Khảo Thí An Toàn</span>
        </div>
      </footer>
    </div>
  );
}

export default function StudentLoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-surface-alt flex items-center justify-center text-xs font-bold text-brand-600">Đang tải...</div>}>
      <LoginFormContent />
    </Suspense>
  );
}
