"use client";

import { useState } from "react";
import { KeyRound, Copy, Check, Loader2, AlertCircle, X } from "lucide-react";

interface ResetPasswordButtonProps {
  userId: string;
  userName?: string;
  role?: "ADMIN" | "TEACHER" | "admin" | "teacher";
  className?: string;
}

export default function ResetPasswordButton({
  userId,
  userName = "người dùng này",
  role = "ADMIN",
  className = "",
}: ResetPasswordButtonProps) {
  const [showConfirm, setShowConfirm] = useState(false);
  const [showResult, setShowResult] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tempPassword, setTempPassword] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const handleOpenConfirm = () => {
    setError(null);
    setShowConfirm(true);
  };

  const handleCloseAll = () => {
    setShowConfirm(false);
    setShowResult(false);
    setIsLoading(false);
    setError(null);
    setTempPassword(null);
    setCopied(false);
  };

  const handleResetPassword = async () => {
    setIsLoading(true);
    setError(null);

    const isTeacher = role === "TEACHER" || role === "teacher";
    const endpoint = isTeacher
      ? `/api/teacher/students/${userId}/reset-password`
      : `/api/admin/users/${userId}/reset-password`;

    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.error || "Không thể cấp lại mật khẩu. Vui lòng thử lại.");
        setIsLoading(false);
        return;
      }

      setTempPassword(data.temp_password);
      setShowConfirm(false);
      setShowResult(true);
    } catch (err: any) {
      setError("Lỗi kết nối máy chủ khi cấp lại mật khẩu.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopy = async () => {
    if (!tempPassword) return;
    try {
      await navigator.clipboard.writeText(tempPassword);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback nếu clipboard API không khả dụng
      const input = document.createElement("input");
      input.value = tempPassword;
      document.body.appendChild(input);
      input.select();
      document.execCommand("copy");
      document.body.removeChild(input);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={handleOpenConfirm}
        className={`px-3 py-1.5 bg-surface-alt text-brand-600 border border-line rounded-xl text-xs font-medium hover:bg-brand-50 inline-flex items-center space-x-1.5 transition-all ${className}`}
        title="Cấp lại mật khẩu tạm thời"
      >
        <KeyRound className="w-3.5 h-3.5 text-brand-600" />
        <span>Cấp lại mật khẩu</span>
      </button>

      {/* Modal Xác Nhận */}
      {showConfirm && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 font-sans animate-in fade-in">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl border border-line space-y-4">
            <div className="flex justify-between items-center border-b border-line/40 pb-3">
              <h3 className="text-base font-bold text-ink flex items-center space-x-2">
                <KeyRound className="w-5 h-5 text-brand-600" />
                <span>Xác nhận cấp lại mật khẩu</span>
              </h3>
              <button
                type="button"
                onClick={handleCloseAll}
                className="text-ink-subtle hover:text-ink p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-ink-muted leading-relaxed">
              Mật khẩu cũ của <strong>{userName}</strong> sẽ không dùng được nữa. Hệ thống sẽ sinh một mật khẩu tạm mới có hiệu lực ngay lập tức.
            </p>

            {error && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-start space-x-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600" />
                <span>{error}</span>
              </div>
            )}

            <div className="pt-2 flex justify-end space-x-2">
              <button
                type="button"
                disabled={isLoading}
                onClick={handleCloseAll}
                className="px-4 py-2 text-xs font-medium text-ink-muted hover:bg-surface-alt rounded-xl border border-line"
              >
                Hủy
              </button>
              <button
                type="button"
                disabled={isLoading}
                onClick={handleResetPassword}
                className="px-4 py-2 text-xs font-bold bg-brand-600 text-white rounded-xl hover:bg-brand-700 flex items-center space-x-1.5 disabled:opacity-50"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Đang xử lý...</span>
                  </>
                ) : (
                  <span>Xác nhận cấp lại</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Hiện Mật Khẩu Tạm */}
      {showResult && tempPassword && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 font-sans animate-in fade-in">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl border border-line space-y-4">
            <div className="flex justify-between items-center border-b border-line/40 pb-3">
              <h3 className="text-base font-bold text-ink flex items-center space-x-2">
                <KeyRound className="w-5 h-5 text-emerald-600" />
                <span>Mật khẩu tạm thời</span>
              </h3>
              <button
                type="button"
                onClick={handleCloseAll}
                className="text-ink-subtle hover:text-ink p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-2">
              <p className="text-xs text-ink-muted">
                Mật khẩu tạm đã được tạo cho <strong>{userName}</strong>:
              </p>

              <div className="flex items-center justify-between p-3 bg-surface-alt border border-line rounded-xl">
                <span className="font-mono text-base font-bold tracking-wider text-brand-700 select-all">
                  {tempPassword}
                </span>
                <button
                  type="button"
                  onClick={handleCopy}
                  className="px-3 py-1.5 bg-white border border-line rounded-lg text-xs font-medium text-brand-600 hover:bg-brand-50 flex items-center space-x-1 shadow-sm transition-all"
                >
                  {copied ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                      <span className="text-emerald-700">Đã sao chép</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Sao chép</span>
                    </>
                  )}
                </button>
              </div>

              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-[11px] text-amber-800 space-y-1">
                <p className="font-bold flex items-center space-x-1">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0 text-amber-600" />
                  <span>Chỉ hiện một lần. Người dùng sẽ phải đổi mật khẩu khi đăng nhập.</span>
                </p>
                <p className="text-amber-700">
                  Vui lòng sao chép và gửi trực tiếp cho người dùng. Mật khẩu không được lưu dạng văn bản thô trên máy chủ.
                </p>
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={handleCloseAll}
                className="px-5 py-2 text-xs font-medium bg-brand-600 text-white rounded-xl hover:bg-brand-700"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
