"use client";

import { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { School, User, Mail, Phone, Lock, AlertCircle, Loader2, UserCheck, ShieldCheck, Eye, EyeOff } from "lucide-react";

export default function RegisterPage() {
  const { register } = useAuth();
  const router = useRouter();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!name.trim() || !email.trim() || !password.trim()) {
      setErrorMsg("Vui lòng điền đầy đủ Họ tên, Email và Mật khẩu!");
      return;
    }

    if (password.length < 6) {
      setErrorMsg("Mật khẩu phải chứa ít nhất 6 ký tự!");
      return;
    }

    if (password !== confirmPassword) {
      setErrorMsg("Mật khẩu xác nhận không khớp!");
      return;
    }

    setLoading(true);
    try {
      const res = await register(name, email, password, phone);
      if (res.success) {
        router.push("/student/dashboard");
      } else {
        setErrorMsg(res.error || "Đăng ký tài khoản không thành công. Vui lòng kiểm tra lại Email!");
      }
    } catch (err: any) {
      console.error(err);
      setErrorMsg("Đã xảy ra lỗi hệ thống khi đăng ký.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-surface-alt min-h-screen flex flex-col academic-grid font-sans text-ink selection:bg-brand-600 selection:text-white">
      {/* Top Header Navigation */}
      <header className="fixed top-0 w-full h-16 flex items-center justify-between px-6 md:px-10 bg-white/80 backdrop-blur-md z-50 border-b border-line/30">
        <div className="flex items-center gap-2.5">
          <img src="/brand/kitokit-mark.png" alt="" className="w-9 h-9 object-contain" />
          <span className="text-xl font-bold text-brand-600 tracking-tight">
            KitoKit
          </span>
        </div>
        <Link href="/login" className="text-xs font-bold text-brand-600 hover:text-brand-700 transition-colors">
          Đã có tài khoản? Đăng nhập ngay &rarr;
        </Link>
      </header>

      {/* Main Content Area */}
      <main className="flex-grow flex items-center justify-center pt-24 pb-12 px-4 sm:px-6 md:px-10">
        <div className="max-w-[1100px] w-full grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12 items-center">
          
          {/* Left Visual / Branding Pane */}
          <div className="hidden lg:flex flex-col space-y-8 pr-6">
            <div className="space-y-4">
              <h1 className="text-4xl font-extrabold text-brand-600 leading-tight tracking-tight">
                Khởi Đầu Hành Trình <br />
                <span className="text-ink-muted">Chinh Phục Tri Thức Cùng KitoKit</span>
              </h1>
              <p className="text-sm text-ink-muted leading-relaxed max-w-md">
                Tạo tài khoản học viên để truy cập kho bài học & đề thi đa môn phong phú, luyện tập phản xạ và nhận đánh giá học thuật tự động bằng công nghệ AI.
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
                <span>Trải nghiệm làm bài thi thử miễn phí không giới hạn</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-accent-400" />
                <span>AI phân tích chi tiết điểm mạnh và điểm cần cải thiện</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-brand-600" />
                <span>Lớp học tương tác trực tiếp cùng thầy cô</span>
              </div>
            </div>
          </div>

          {/* Right Form Pane */}
          <div className="w-full flex justify-center lg:justify-end">
            <div className="w-full max-w-[440px] bg-white p-8 md:p-10 rounded-3xl shadow-sm border border-line/40 space-y-6">
              
              <div>
                <h2 className="text-2xl font-extrabold text-ink tracking-tight">
                  TẠO TÀI KHOẢN HỌC VIÊN
                </h2>
                <p className="text-xs text-ink-subtle mt-1">
                  Điền thông tin để kích hoạt hồ sơ học thuật trên hệ thống.
                </p>
              </div>

              {errorMsg && (
                <div className="p-3.5 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs font-bold flex items-start space-x-2 animate-shake">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <span>{errorMsg}</span>
                </div>
              )}

              <form onSubmit={handleRegisterSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold uppercase text-brand-600 mb-1.5">
                    Họ và Tên Đầy Đủ
                  </label>
                  <div className="relative">
                    <User className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-subtle" />
                    <input
                      type="text"
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Ví dụ: Nguyễn Văn An"
                      className="w-full pl-10 pr-3 py-2.5 bg-surface-alt border border-line rounded-xl text-xs font-bold text-ink placeholder-ink-subtle focus:outline-none focus:ring-2 focus:ring-brand-600"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase text-brand-600 mb-1.5">
                    Địa Chỉ Email
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-subtle" />
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="student.name@edu.vn"
                      className="w-full pl-10 pr-3 py-2.5 bg-surface-alt border border-line rounded-xl text-xs font-bold text-ink placeholder-ink-subtle focus:outline-none focus:ring-2 focus:ring-brand-600"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase text-brand-600 mb-1.5">
                    Số Điện Thoại (Tùy chọn)
                  </label>
                  <div className="relative">
                    <Phone className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-subtle" />
                    <input
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="0912 345 678"
                      className="w-full pl-10 pr-3 py-2.5 bg-surface-alt border border-line rounded-xl text-xs font-bold text-ink placeholder-ink-subtle focus:outline-none focus:ring-2 focus:ring-brand-600"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase text-brand-600 mb-1.5">
                    Mật Khẩu
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-subtle" />
                    <input
                      type={showPassword ? "text" : "password"}
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Mật khẩu tối thiểu 6 ký tự"
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

                <div>
                  <label className="block text-xs font-bold uppercase text-brand-600 mb-1.5">
                    Xác Nhận Mật Khẩu
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-subtle" />
                    <input
                      type={showPassword ? "text" : "password"}
                      required
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Nhập lại mật khẩu"
                      className="w-full pl-10 pr-3 py-2.5 bg-surface-alt border border-line rounded-xl text-xs font-bold text-ink placeholder-ink-subtle focus:outline-none focus:ring-2 focus:ring-brand-600"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full mt-2 py-3.5 bg-brand-600 hover:bg-brand-700 active:scale-[0.98] text-white font-bold text-xs rounded-xl shadow-md transition-all cursor-pointer flex items-center justify-center space-x-2 disabled:opacity-50"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin text-accent-400" />
                      <span>Đang đăng ký...</span>
                    </>
                  ) : (
                    <>
                      <UserCheck className="w-4 h-4 text-accent-400" />
                      <span>HOÀN TẤT ĐĂNG KÝ HỌC VIÊN</span>
                    </>
                  )}
                </button>
              </form>

              <div className="pt-4 border-t border-line/30 text-center">
                <p className="text-xs text-ink-subtle font-medium">
                  Đã có tài khoản?{" "}
                  <Link href="/login" className="font-bold text-brand-600 hover:underline">
                    Đăng nhập ngay
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
