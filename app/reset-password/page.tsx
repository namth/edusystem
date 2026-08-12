"use client";

import { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { KeyRound, Lock, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";

export default function ResetPasswordPage() {
  const { updatePasswordAndProfile } = useAuth();
  const router = useRouter();

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!password.trim()) {
      setErrorMsg("Vui lòng nhập mật khẩu mới!");
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
      const ok = await updatePasswordAndProfile(password);
      if (ok) {
        router.push("/student/dashboard");
      } else {
        setErrorMsg("Lỗi cập nhật mật khẩu. Vui lòng thử lại!");
      }
    } catch (err: any) {
      console.error(err);
      setErrorMsg("Có lỗi xảy ra khi cập nhật mật khẩu.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#faf5f0] flex flex-col justify-center py-12 sm:px-6 lg:px-8 font-sans selection:bg-[#6d3807] selection:text-white">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex justify-center">
          <div className="w-16 h-16 bg-[#6d3807] rounded-2xl flex items-center justify-center shadow-lg shadow-[#6d3807]/20 border border-[#85460c]">
            <KeyRound className="w-9 h-9 text-[#ffb782]" />
          </div>
        </div>
        <h2 className="mt-4 text-center text-2xl font-extrabold text-[#211a16] tracking-tight">
          ĐẶT LẠI MẬT KHẨU MỚI
        </h2>
        <p className="mt-1 text-center text-xs font-semibold text-[#857469]">
          Nhập mật khẩu mới cho tài khoản của bạn
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-6 shadow-xl border border-[#d8c2b6] sm:rounded-2xl sm:px-10">
          {errorMsg && (
            <div className="mb-5 p-3.5 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs font-bold flex items-start space-x-2 animate-shake">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          <form className="space-y-4" onSubmit={handleSubmit}>
            <div>
              <label className="block text-xs font-bold uppercase text-[#6d3807] mb-1">
                Mật Khẩu Mới
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[#857469]" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Mật khẩu mới tối thiểu 6 ký tự"
                  className="w-full pl-10 pr-3 py-2.5 bg-[#fff8f5] border border-[#d8c2b6] rounded-xl text-xs font-bold text-[#211a16] placeholder-[#a89588] focus:outline-none focus:ring-2 focus:ring-[#6d3807]"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase text-[#6d3807] mb-1">
                Xác Nhận Mật Khẩu Mới
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[#857469]" />
                <input
                  type="password"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Nhập lại mật khẩu mới"
                  className="w-full pl-10 pr-3 py-2.5 bg-[#fff8f5] border border-[#d8c2b6] rounded-xl text-xs font-bold text-[#211a16] placeholder-[#a89588] focus:outline-none focus:ring-2 focus:ring-[#6d3807]"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full mt-2 py-3 px-4 bg-[#6d3807] hover:bg-[#85460c] text-white rounded-xl text-xs font-bold shadow-md shadow-[#6d3807]/20 flex items-center justify-center space-x-2 transition-all cursor-pointer disabled:opacity-50"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-[#ffb782]" />
                  <span>Đang cập nhật...</span>
                </>
              ) : (
                <span>LƯU MẬT KHẨU MỚI</span>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
