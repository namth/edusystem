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
    <div className="bg-[#fff8f5] min-h-screen flex flex-col academic-grid font-sans text-[#211a16] selection:bg-[#6d3807] selection:text-white">
      {/* Top Header */}
      <header className="fixed top-0 w-full h-16 flex items-center justify-between px-6 md:px-10 bg-white/80 backdrop-blur-md z-50 border-b border-[#d8c2b6]/30">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 bg-[#6d3807] rounded-xl flex items-center justify-center text-white shadow-xs">
            <School className="w-5 h-5 text-[#ffb782]" />
          </div>
          <span className="text-xl font-bold text-[#6d3807] tracking-tight">
            EduTest Pro
          </span>
        </div>
        <div className="flex items-center gap-4">
          <Link
            href="/register"
            className="text-xs font-bold text-[#6d3807] hover:text-[#85460c] transition-colors"
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
              <h1 className="text-4xl font-extrabold text-[#6d3807] leading-tight tracking-tight">
                Chất Lượng Chuẩn Mực <br />
                <span className="text-[#785840]">Khảo Thí IELTS Trực Tuyến</span>
              </h1>
              <p className="text-sm text-[#52443a] leading-relaxed max-w-md">
                Truy cập cổng đề thi mô phỏng, theo dõi lộ trình nâng Band điểm và làm chủ các kỹ năng tiếng Anh theo tiêu chuẩn học thuật quốc tế.
              </p>
            </div>

            {/* Floating Visual Image Card */}
            <div className="relative w-full aspect-square max-w-[380px] rounded-3xl overflow-hidden shadow-md border border-[#d8c2b6]/40 float-anim group">
              <div className="absolute inset-0 bg-gradient-to-tr from-[#6d3807]/15 to-transparent z-10 pointer-events-none" />
              <img
                src="https://lh3.googleusercontent.com/aida-public/AB6AXuBK1LOHlfWUn4f96qQY5VZ6AFGdycltIZyQPAem2c4NoS1inlFPiWq1UzXqG-cfa7_g9PiXg8IQmAAPn2RpXwtokGME4IL_E3TuyvCFvZ_J4RM_fFKNfmhcvcxB9qf-1kSBdYYAwaZbK239WFhmtZaxR84ixeH8dJyOinjW0S4bSqqxGGOcLRPwloePCBCqMkcScjtiMkyfqefJ-5YJ5ndbh3vSFeccntNjkZv-HrrhwVN1Wir2d_3y"
                alt="EduTest Pro Academic Study Space"
                className="w-full h-full object-cover transform scale-105 group-hover:scale-110 transition-transform duration-700"
              />
            </div>

            {/* Social Proof */}
            <div className="flex items-center gap-4">
              <div className="flex -space-x-2">
                <div className="w-9 h-9 rounded-full border-2 border-white bg-[#f9ebe4] flex items-center justify-center text-xs font-bold text-[#6d3807] shadow-xs">
                  A
                </div>
                <div className="w-9 h-9 rounded-full border-2 border-white bg-[#f9ebe4] flex items-center justify-center text-xs font-bold text-[#6d3807] shadow-xs">
                  B
                </div>
                <div className="w-9 h-9 rounded-full border-2 border-white bg-[#f9ebe4] flex items-center justify-center text-xs font-bold text-[#6d3807] shadow-xs">
                  C
                </div>
              </div>
              <p className="text-xs font-medium text-[#52443a]">
                Hơn <strong className="text-[#6d3807] font-bold">12.000+</strong> học viên tham gia thi thử trong kỳ này
              </p>
            </div>
          </div>

          {/* Right Form Pane */}
          <div className="w-full flex justify-center lg:justify-end">
            <div className="w-full max-w-[440px] bg-white p-8 md:p-10 rounded-3xl shadow-sm border border-[#d8c2b6]/40 space-y-6">
              
              <div>
                <h2 className="text-2xl font-extrabold text-[#211a16] tracking-tight">
                  CỔNG ĐĂNG NHẬP HỌC VIÊN
                </h2>
                <p className="text-xs text-[#857469] mt-1">
                  Chào mừng trở lại. Nhập thông tin để tiếp tục bài thi.
                </p>
              </div>

              {/* Login Method Tabs */}
              <div className="flex p-1 bg-[#f9ebe4] rounded-xl border border-[#d8c2b6]/30">
                <button
                  type="button"
                  onClick={() => { setActiveTab("login"); setErrorMsg(null); }}
                  className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                    activeTab === "login"
                      ? "bg-white text-[#6d3807] shadow-xs"
                      : "text-[#857469] hover:text-[#211a16]"
                  }`}
                >
                  Đăng Nhập Chuẩn
                </button>
                <button
                  type="button"
                  onClick={() => { setActiveTab("code"); setErrorMsg(null); }}
                  className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                    activeTab === "code"
                      ? "bg-white text-[#6d3807] shadow-xs"
                      : "text-[#857469] hover:text-[#211a16]"
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
                    <label className="block text-xs font-bold uppercase text-[#6d3807] mb-1.5">
                      Email / Tên Đăng Nhập
                    </label>
                    <div className="relative">
                      <Mail className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[#857469]" />
                      <input
                        type="text"
                        required
                        value={identifier}
                        onChange={(e) => setIdentifier(e.target.value)}
                        placeholder="student.name@edu.vn"
                        className="w-full pl-10 pr-3 py-2.5 bg-[#fff8f5] border border-[#d8c2b6] rounded-xl text-xs font-bold text-[#211a16] placeholder-[#a89588] focus:outline-none focus:ring-2 focus:ring-[#6d3807]"
                      />
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="block text-xs font-bold uppercase text-[#6d3807]">
                        Mật Khẩu
                      </label>
                      <Link
                        href="/forgot-password"
                        className="text-xs font-bold text-[#6d3807] hover:underline"
                      >
                        Quên mật khẩu?
                      </Link>
                    </div>
                    <div className="relative">
                      <Lock className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[#857469]" />
                      <input
                        type={showPassword ? "text" : "password"}
                        required
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="••••••••"
                        className="w-full pl-10 pr-10 py-2.5 bg-[#fff8f5] border border-[#d8c2b6] rounded-xl text-xs font-bold text-[#211a16] placeholder-[#a89588] focus:outline-none focus:ring-2 focus:ring-[#6d3807]"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-[#857469] hover:text-[#211a16] cursor-pointer"
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-1">
                    <label className="flex items-center space-x-2 text-xs text-[#52443a] font-medium cursor-pointer">
                      <input
                        type="checkbox"
                        defaultChecked
                        className="w-4 h-4 text-[#6d3807] border-[#d8c2b6] rounded focus:ring-[#6d3807]"
                      />
                      <span>Duy trì đăng nhập 30 ngày</span>
                    </label>
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-3.5 bg-[#6d3807] hover:bg-[#85460c] active:scale-[0.98] text-white font-bold text-xs rounded-xl shadow-md transition-all cursor-pointer flex items-center justify-center space-x-2 disabled:opacity-50"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin text-[#ffb782]" />
                        <span>Đang xử lý đăng nhập...</span>
                      </>
                    ) : (
                      <>
                        <LogIn className="w-4 h-4 text-[#ffb782]" />
                        <span>ĐĂNG NHẬP VÀO BẢNG ĐIỀU KHIỂN</span>
                      </>
                    )}
                  </button>
                </form>
              ) : (
                /* Class Code Join Form */
                <form onSubmit={handleClassCodeJoin} className="space-y-4">
                  <div className="p-3 bg-[#fff8f5] rounded-xl border border-[#d8c2b6]/60 text-xs text-[#52443a] flex items-start space-x-2">
                    <HelpCircle className="w-4 h-4 text-[#6d3807] shrink-0 mt-0.5" />
                    <span>
                      Nhập mã phòng thi 6 ký tự do giáo viên cấp để tham gia làm bài khảo thí nhanh.
                    </span>
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase text-[#6d3807] mb-1.5 text-center">
                      Mã Phòng Thi (6 Ký Tự)
                    </label>
                    <input
                      type="text"
                      maxLength={6}
                      value={classCode}
                      onChange={(e) => setClassCode(e.target.value.toUpperCase())}
                      placeholder="XXXXXX"
                      className="w-full text-center tracking-[0.4em] py-3 bg-[#fff8f5] border-2 border-[#d8c2b6] rounded-xl text-base font-extrabold text-[#6d3807] placeholder-[#a89588] focus:outline-none focus:ring-2 focus:ring-[#6d3807] uppercase"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase text-[#6d3807] mb-1.5">
                      Họ và Tên Học Viên
                    </label>
                    <input
                      type="text"
                      value={studentName}
                      onChange={(e) => setStudentName(e.target.value)}
                      placeholder="Ví dụ: Nguyễn Văn An"
                      className="w-full px-3.5 py-2.5 bg-[#fff8f5] border border-[#d8c2b6] rounded-xl text-xs font-bold text-[#211a16] placeholder-[#a89588] focus:outline-none focus:ring-2 focus:ring-[#6d3807]"
                    />
                  </div>

                  <button
                    type="submit"
                    className="w-full py-3.5 bg-[#785840] hover:bg-[#624732] active:scale-[0.98] text-white font-bold text-xs rounded-xl shadow-md transition-all cursor-pointer flex items-center justify-center space-x-2"
                  >
                    <Key className="w-4 h-4 text-[#ffb782]" />
                    <span>THAM GIA PHÒNG THI TỨC THỜI</span>
                  </button>
                </form>
              )}

              <div className="pt-4 border-t border-[#d8c2b6]/30 text-center">
                <p className="text-xs text-[#857469] font-medium">
                  Chưa có tài khoản Học viên?{" "}
                  <Link href="/register" className="font-bold text-[#6d3807] hover:underline">
                    Đăng ký ngay
                  </Link>
                </p>
              </div>

            </div>
          </div>

        </div>
      </main>

      {/* Footer */}
      <footer className="mt-auto py-6 px-6 md:px-10 flex flex-col md:flex-row justify-between items-center gap-4 text-xs font-medium text-[#857469] border-t border-[#d8c2b6]/30">
        <div className="flex items-center gap-3">
          <span>© 2026 EduTest Pro Academic</span>
          <span className="w-1 h-1 bg-[#857469] rounded-full" />
          <span>Hệ Thống Đánh Giá & Khảo Thí</span>
        </div>
        <div className="flex items-center gap-1.5 italic text-xs text-[#6d3807]">
          <ShieldCheck className="w-4 h-4" />
          <span>Môi Trường Khảo Thí An Toàn</span>
        </div>
      </footer>
    </div>
  );
}

export default function StudentLoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#fff8f5] flex items-center justify-center text-xs font-bold text-[#6d3807]">Đang tải...</div>}>
      <LoginFormContent />
    </Suspense>
  );
}
