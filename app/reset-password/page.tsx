"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { KeyRound, Lock, CheckCircle2, AlertCircle, Loader2, ArrowLeft, Eye, EyeOff, ShieldCheck } from "lucide-react";
import { validatePasswordStrength } from "@/lib/password-validator";

function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const token = searchParams.get("token") || "";
  const email = searchParams.get("email") || "";

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const validation = validatePasswordStrength(newPassword);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (!token || !email) {
      setErrorMsg("Liên kết khôi phục mật khẩu không hợp lệ.");
      return;
    }

    if (!validation.isValid) {
      setErrorMsg(validation.errors[0] || "Mật khẩu chưa đạt yêu cầu an toàn.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setErrorMsg("Mật khẩu xác nhận không khớp.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          email,
          newPassword,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        setErrorMsg(data.error || "Không thể đặt lại mật khẩu. Vui lòng kiểm tra lại liên kết.");
        return;
      }

      setSuccessMsg("Đã đặt lại mật khẩu thành công! Bạn có thể đăng nhập bằng mật khẩu mới ngay bây giờ.");
      setTimeout(() => {
        router.push("/login");
      }, 3000);
    } catch (err: any) {
      console.error(err);
      setErrorMsg("Có lỗi xảy ra khi gửi yêu cầu.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#faf5f0] flex flex-col justify-center py-12 sm:px-6 lg:px-8 font-sans selection:bg-[#6d3807] selection:text-white">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex justify-center">
          <div className="w-16 h-16 bg-[#6d3807] rounded-2xl flex items-center justify-center shadow-lg border border-[#85460c]">
            <KeyRound className="w-9 h-9 text-[#ffb782]" />
          </div>
        </div>
        <h2 className="mt-4 text-center text-2xl font-extrabold text-[#211a16] tracking-tight">
          ĐẶT LẠI MẬT KHẨU MỚI
        </h2>
        <p className="mt-1 text-center text-xs font-semibold text-[#857469]">
          Tài khoản: <strong className="text-[#6d3807]">{email || "Hệ thống khảo thí EduTest Pro"}</strong>
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-6 shadow-xl border border-[#d8c2b6] sm:rounded-2xl sm:px-10 space-y-5">
          {errorMsg && (
            <div className="p-3.5 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs font-bold flex items-start space-x-2 animate-shake">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg ? (
            <div className="space-y-4">
              <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-xl text-xs font-bold flex items-start space-x-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                <span>{successMsg}</span>
              </div>
              <p className="text-[11px] text-[#857469] text-center">Đang chuyển hướng về trang Đăng nhập...</p>
              <Link
                href="/login"
                className="w-full py-3 px-4 bg-[#6d3807] text-white rounded-xl text-xs font-bold flex items-center justify-center space-x-2"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Chuyển tới trang Đăng nhập ngay</span>
              </Link>
            </div>
          ) : (
            <form className="space-y-4" onSubmit={handleSubmit}>
              <div>
                <label className="block text-xs font-bold uppercase text-[#6d3807] mb-1">
                  Mật Khẩu Mới (*)
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#857469]" />
                  <input
                    type={showPassword ? "text" : "password"}
                    required
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Tối thiểu 8 ký tự (viết hoa, viết thường, số)"
                    className="w-full pl-9 pr-9 py-2.5 bg-[#fff8f5] border border-[#d8c2b6] rounded-xl text-xs font-bold text-[#211a16] focus:outline-none focus:ring-2 focus:ring-[#6d3807]"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#857469] hover:text-[#211a16]"
                  >
                    {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              {/* Password Strength Indicator */}
              {newPassword && (
                <div className="p-3 bg-[#fff8f5] rounded-xl border border-[#d8c2b6]/60 space-y-1.5 text-[11px]">
                  <div className="flex justify-between font-bold text-[#52443a]">
                    <span>Độ mạnh mật khẩu:</span>
                    <span className={validation.isValid ? "text-emerald-700 font-extrabold" : "text-amber-700 font-extrabold"}>
                      {validation.score <= 2 ? "Yếu" : validation.score === 3 ? "Trung bình" : "Rất mạnh ✓"}
                    </span>
                  </div>
                  <div className="grid grid-cols-4 gap-1.5">
                    <span className={`h-1.5 rounded-full ${validation.hasMinLength ? "bg-emerald-500" : "bg-gray-200"}`} />
                    <span className={`h-1.5 rounded-full ${validation.hasUppercase ? "bg-emerald-500" : "bg-gray-200"}`} />
                    <span className={`h-1.5 rounded-full ${validation.hasLowercase ? "bg-emerald-500" : "bg-gray-200"}`} />
                    <span className={`h-1.5 rounded-full ${validation.hasNumber ? "bg-emerald-500" : "bg-gray-200"}`} />
                  </div>
                  <div className="text-[10px] text-[#857469] space-y-0.5 pt-1">
                    <p className={validation.hasMinLength ? "text-emerald-700" : ""}>✓ Tối thiểu 8 ký tự</p>
                    <p className={validation.hasUppercase ? "text-emerald-700" : ""}>✓ Ít nhất 1 chữ cái viết hoa (A-Z)</p>
                    <p className={validation.hasLowercase ? "text-emerald-700" : ""}>✓ Ít nhất 1 chữ cái viết thường (a-z)</p>
                    <p className={validation.hasNumber ? "text-emerald-700" : ""}>✓ Ít nhất 1 chữ số (0-9)</p>
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold uppercase text-[#6d3807] mb-1">
                  Xác Nhận Mật Khẩu Mới (*)
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#857469]" />
                  <input
                    type={showPassword ? "text" : "password"}
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Nhập lại mật khẩu mới"
                    className="w-full pl-9 pr-3 py-2.5 bg-[#fff8f5] border border-[#d8c2b6] rounded-xl text-xs font-bold text-[#211a16] focus:outline-none focus:ring-2 focus:ring-[#6d3807]"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 px-4 bg-[#6d3807] hover:bg-[#85460c] text-white rounded-xl text-xs font-bold shadow-md flex items-center justify-center space-x-2 transition-all cursor-pointer disabled:opacity-50 mt-2"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-[#ffb782]" />
                    <span>Đang cập nhật mật khẩu...</span>
                  </>
                ) : (
                  <>
                    <ShieldCheck className="w-4 h-4 text-[#ffb782]" />
                    <span>CẬP NHẬT MẬT KHẨU MỚI</span>
                  </>
                )}
              </button>
            </form>
          )}

          <div className="border-t border-[#d8c2b6]/40 pt-3 text-center">
            <Link href="/login" className="text-xs font-bold text-[#6d3807] hover:underline flex items-center justify-center space-x-1">
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Quay về trang Đăng nhập</span>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<div className="p-12 text-center text-xs text-[#52443a]">Đang nạp trang...</div>}>
      <ResetPasswordForm />
    </Suspense>
  );
}
