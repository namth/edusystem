"use client";

import { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import Link from "next/link";
import { School, Mail, KeyRound, CheckCircle2, AlertCircle, Loader2, ArrowLeft } from "lucide-react";

export default function ForgotPasswordPage() {
  const { resetPasswordForEmail } = useAuth();

  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (!email.trim()) {
      setErrorMsg("Vui lòng nhập Email của bạn!");
      return;
    }

    setLoading(true);
    try {
      const ok = await resetPasswordForEmail(email);
      if (ok) {
        setSuccessMsg(`Đã gửi liên kết khôi phục mật khẩu tới địa chỉ "${email}". Vui lòng kiểm tra hộp thư đến (hoặc hòm thư Spam)!`);
      } else {
        setErrorMsg("Không thể gửi email khôi phục. Vui lòng kiểm tra lại địa chỉ Email.");
      }
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
          <div className="w-16 h-16 bg-[#6d3807] rounded-2xl flex items-center justify-center shadow-lg shadow-[#6d3807]/20 border border-[#85460c]">
            <KeyRound className="w-9 h-9 text-[#ffb782]" />
          </div>
        </div>
        <h2 className="mt-4 text-center text-2xl font-extrabold text-[#211a16] tracking-tight">
          QUÊN MẬT KHẨU
        </h2>
        <p className="mt-1 text-center text-xs font-semibold text-[#857469]">
          Nhập Email đã đăng ký để nhận liên kết khôi phục mật khẩu
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

          {successMsg ? (
            <div className="space-y-4">
              <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-xl text-xs font-bold flex items-start space-x-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                <span>{successMsg}</span>
              </div>
              <Link
                href="/login"
                className="w-full py-3 px-4 bg-[#6d3807] text-white rounded-xl text-xs font-bold flex items-center justify-center space-x-2"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Quay về trang Đăng nhập</span>
              </Link>
            </div>
          ) : (
            <form className="space-y-5" onSubmit={handleSubmit}>
              <div>
                <label className="block text-xs font-bold uppercase text-[#6d3807] mb-1.5">
                  Địa Chỉ Email Cần Khôi Phục
                </label>
                <div className="relative rounded-xl shadow-xs">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                    <Mail className="h-4 h-4 text-[#857469]" />
                  </div>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="student@domain.edu.vn"
                    className="block w-full pl-10 pr-3 py-2.5 bg-[#fff8f5] border border-[#d8c2b6] rounded-xl text-xs font-bold text-[#211a16] placeholder-[#a89588] focus:outline-none focus:ring-2 focus:ring-[#6d3807]"
                  />
                </div>
              </div>

              <div>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 px-4 bg-[#6d3807] hover:bg-[#85460c] text-white rounded-xl text-xs font-bold shadow-md shadow-[#6d3807]/20 flex items-center justify-center space-x-2 transition-all cursor-pointer disabled:opacity-50"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin text-[#ffb782]" />
                      <span>Đang gửi email...</span>
                    </>
                  ) : (
                    <span>GỬI LIÊN KẾT KHÔI PHỤC</span>
                  )}
                </button>
              </div>
            </form>
          )}

          <div className="mt-6 border-t border-[#d8c2b6]/40 pt-4 text-center">
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
