"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { School, Lock, User, Phone, Target, AlertCircle, Loader2, Sparkles, CheckCircle2, ShieldCheck, Eye, EyeOff } from "lucide-react";

export default function ChangePasswordPage() {
  const { user, updatePasswordAndProfile } = useAuth();
  const router = useRouter();

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [targetBand, setTargetBand] = useState("IELTS 7.0");

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      setFullName(user.name || "");
      setPhone(user.phone || "");
      setTargetBand(user.targetBand || "IELTS 7.0");
    }
  }, [user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!newPassword.trim()) {
      setErrorMsg("Vui lòng nhập mật khẩu mới!");
      return;
    }

    if (newPassword.length < 6) {
      setErrorMsg("Mật khẩu mới phải có ít nhất 6 ký tự!");
      return;
    }

    if (newPassword !== confirmPassword) {
      setErrorMsg("Mật khẩu xác nhận không khớp!");
      return;
    }

    if (!fullName.trim()) {
      setErrorMsg("Vui lòng nhập Họ và Tên của bạn!");
      return;
    }

    setLoading(true);
    try {
      const ok = await updatePasswordAndProfile(newPassword, fullName, phone, targetBand);
      if (ok) {
        if (user?.role === "TEACHER") {
          router.push("/teacher/classes");
        } else if (user?.role === "ADMIN") {
          router.push("/admin/requests");
        } else {
          router.push("/student/dashboard");
        }
      } else {
        setErrorMsg("Không thể cập nhật thông tin. Vui lòng kiểm tra lại kết nối!");
      }
    } catch (err: any) {
      console.error(err);
      setErrorMsg("Đã xảy ra lỗi khi cập nhật.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-[#fff8f5] min-h-screen flex flex-col academic-grid font-sans text-[#211a16] selection:bg-[#6d3807] selection:text-white">
      {/* Top Header Navigation */}
      <header className="fixed top-0 w-full h-16 flex items-center justify-between px-6 md:px-10 bg-white/80 backdrop-blur-md z-50 border-b border-[#d8c2b6]/30">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 bg-[#6d3807] rounded-xl flex items-center justify-center text-white shadow-xs">
            <School className="w-5 h-5 text-[#ffb782]" />
          </div>
          <span className="text-xl font-bold text-[#6d3807] tracking-tight">
            EduTest Pro
          </span>
        </div>
        <div className="flex items-center gap-1.5 text-xs font-bold text-[#6d3807]">
          <Sparkles className="w-4 h-4 text-[#ffb782]" />
          <span>Kích Hoạt Hồ Sơ Lần Đầu</span>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-grow flex items-center justify-center pt-24 pb-12 px-4 sm:px-6 md:px-10">
        <div className="max-w-[1100px] w-full grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12 items-center">
          
          {/* Left Visual / Branding Pane */}
          <div className="hidden lg:flex flex-col space-y-8 pr-6">
            <div className="space-y-4">
              <h1 className="text-4xl font-extrabold text-[#6d3807] leading-tight tracking-tight">
                Hoàn Thiện Hồ Sơ <br />
                <span className="text-[#785840]">Bảo Mật & Mục Tiêu Học Tập</span>
              </h1>
              <p className="text-sm text-[#52443a] leading-relaxed max-w-md">
                Đặt mật khẩu cá nhân mới và bổ sung mục tiêu Band điểm để giảng viên và hệ thống tự động tối ưu hóa lộ trình rèn luyện cho bạn.
              </p>
            </div>

            {/* Floating Visual Image Card */}
            <div className="relative w-full aspect-square max-w-[380px] rounded-3xl overflow-hidden shadow-md border border-[#d8c2b6]/40 float-anim group">
              <div className="absolute inset-0 bg-gradient-to-tr from-[#6d3807]/15 to-transparent z-10 pointer-events-none" />
              <img
                src="https://lh3.googleusercontent.com/aida-public/AB6AXuBK1LOHlfWUn4f96qQY5VZ6AFGdycltIZyQPAem2c4NoS1inlFPiWq1UzXqG-cfa7_g9PiXg8IQmAAPn2RpXwtokGME4IL_E3TuyvCFvZ_J4RM_fFKNfmhcvcxB9qf-1kSBdYYAwaZbK239WFhmtZaxR84ixeH8dJyOinjW0S4bSqqxGGOcLRPwloePCBCqMkcScjtiMkyfqefJ-5YJ5ndbh3vSFeccntNjkZv-HrrhwVN1Wir2d_3y"
                alt="EduTest Onboarding Workspace"
                className="w-full h-full object-cover transform scale-105 group-hover:scale-110 transition-transform duration-700"
              />
            </div>

            {/* Social Proof */}
            <div className="flex items-center gap-4">
              <div className="flex -space-x-2">
                <div className="w-9 h-9 rounded-full border-2 border-white bg-[#f9ebe4] flex items-center justify-center text-xs font-bold text-[#6d3807] shadow-xs">
                  ✓
                </div>
                <div className="w-9 h-9 rounded-full border-2 border-white bg-[#f9ebe4] flex items-center justify-center text-xs font-bold text-[#6d3807] shadow-xs">
                  ★
                </div>
              </div>
              <p className="text-xs font-medium text-[#52443a]">
                Bảo vệ tài khoản với mã hóa chuẩn quốc tế
              </p>
            </div>
          </div>

          {/* Right Form Pane */}
          <div className="w-full flex justify-center lg:justify-end">
            <div className="w-full max-w-[440px] bg-white p-8 md:p-10 rounded-3xl shadow-sm border border-[#d8c2b6]/40 space-y-6">
              
              <div>
                <h2 className="text-2xl font-extrabold text-[#211a16] tracking-tight">
                  KÍCH HOẠT TÀI KHOẢN LẦN ĐẦU
                </h2>
                <p className="text-xs text-[#857469] mt-1">
                  Đổi mật khẩu mới & hoàn thiện thông tin cá nhân
                </p>
              </div>

              {errorMsg && (
                <div className="p-3.5 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs font-bold flex items-start space-x-2 animate-shake">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <span>{errorMsg}</span>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Section 1: Password Change */}
                <div className="p-4 bg-[#fff8f5] rounded-xl border border-[#d8c2b6]/60 space-y-3">
                  <span className="text-xs font-bold text-[#6d3807] block uppercase border-b border-[#d8c2b6]/40 pb-1.5">
                    🔐 Đặt Mật Khẩu Bảo Mật Mới
                  </span>

                  <div>
                    <label className="block text-[11px] font-bold text-[#211a16] mb-1">
                      Mật Khẩu Mới
                    </label>
                    <div className="relative">
                      <Lock className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#857469]" />
                      <input
                        type={showPassword ? "text" : "password"}
                        required
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="Mật khẩu tối thiểu 6 ký tự"
                        className="w-full pl-9 pr-9 py-2 bg-white border border-[#d8c2b6] rounded-xl text-xs font-bold text-[#211a16] focus:outline-none focus:ring-2 focus:ring-[#6d3807]"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#857469] hover:text-[#211a16] cursor-pointer"
                      >
                        {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-[#211a16] mb-1">
                      Xác Nhận Mật Khẩu Mới
                    </label>
                    <div className="relative">
                      <Lock className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#857469]" />
                      <input
                        type={showPassword ? "text" : "password"}
                        required
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="Nhập lại mật khẩu mới"
                        className="w-full pl-9 pr-3 py-2 bg-white border border-[#d8c2b6] rounded-xl text-xs font-bold text-[#211a16] focus:outline-none focus:ring-2 focus:ring-[#6d3807]"
                      />
                    </div>
                  </div>
                </div>

                {/* Section 2: Onboarding Profile Details */}
                <div className="p-4 bg-[#fff8f5] rounded-xl border border-[#d8c2b6]/60 space-y-3">
                  <span className="text-xs font-bold text-[#6d3807] block uppercase border-b border-[#d8c2b6]/40 pb-1.5">
                    👤 Bổ Sung Thông Tin Hồ Sơ
                  </span>

                  <div>
                    <label className="block text-[11px] font-bold text-[#211a16] mb-1">
                      Họ và Tên Đầy Đủ <span className="text-rose-600">*</span>
                    </label>
                    <div className="relative">
                      <User className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#857469]" />
                      <input
                        type="text"
                        required
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        placeholder="Ví dụ: Nguyễn Văn An"
                        className="w-full pl-9 pr-3 py-2 bg-white border border-[#d8c2b6] rounded-xl text-xs font-bold text-[#211a16] focus:outline-none focus:ring-2 focus:ring-[#6d3807]"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-[#211a16] mb-1">
                      Số Điện Thoại Liên Hệ
                    </label>
                    <div className="relative">
                      <Phone className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#857469]" />
                      <input
                        type="tel"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder="0912 345 678"
                        className="w-full pl-9 pr-3 py-2 bg-white border border-[#d8c2b6] rounded-xl text-xs font-bold text-[#211a16] focus:outline-none focus:ring-2 focus:ring-[#6d3807]"
                      />
                    </div>
                  </div>

                  {user?.role !== "TEACHER" && user?.role !== "ADMIN" && (
                    <div>
                      <label className="block text-[11px] font-bold text-[#211a16] mb-1">
                        Mục Tiêu Học Tập / Target Band
                      </label>
                      <div className="relative">
                        <Target className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#857469]" />
                        <select
                          value={targetBand}
                          onChange={(e) => setTargetBand(e.target.value)}
                          className="w-full pl-9 pr-3 py-2 bg-white border border-[#d8c2b6] rounded-xl text-xs font-bold text-[#211a16] focus:outline-none focus:ring-2 focus:ring-[#6d3807] cursor-pointer"
                        >
                          <option value="IELTS 5.5">IELTS Foundation (5.5)</option>
                          <option value="IELTS 6.5">IELTS Intermediate (6.5)</option>
                          <option value="IELTS 7.0">IELTS Master (7.0)</option>
                          <option value="IELTS 7.5+">IELTS Advanced (7.5+)</option>
                        </select>
                      </div>
                    </div>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full mt-3 py-3.5 bg-[#6d3807] hover:bg-[#85460c] active:scale-[0.98] text-white font-bold text-xs rounded-xl shadow-md transition-all cursor-pointer flex items-center justify-center space-x-2 disabled:opacity-50"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin text-[#ffb782]" />
                      <span>Đang lưu thông tin...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4 text-[#ffb782]" />
                      <span>HOÀN TẤT & TRUY CẬP HỆ THỐNG</span>
                    </>
                  )}
                </button>
              </form>

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
