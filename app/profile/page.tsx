"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import AdminLayout from "@/components/AdminLayout";
import TeacherLayout from "@/components/TeacherLayout";
import StudentLayout from "@/components/StudentLayout";
import {
  User,
  Mail,
  Phone,
  Camera,
  Save,
  CheckCircle2,
  AlertCircle,
  Loader2,
  KeyRound,
  Lock,
} from "lucide-react";

export default function UserProfilePage() {
  const { user: authUser } = useAuth();
  const [role, setRole] = useState(authUser?.role || "STUDENT");

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [targetBand, setTargetBand] = useState("");
  const [avatarUrl, setAvatarUrl] = useState(
    "https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=400&auto=format&fit=crop"
  );

  // Password state
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isChangingPass, setIsChangingPass] = useState(false);

  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [passSuccessMsg, setPassSuccessMsg] = useState<string | null>(null);
  const [passErrorMsg, setPassErrorMsg] = useState<string | null>(null);

  const fetchProfile = async () => {
    try {
      setIsLoading(true);
      const res = await fetch("/api/profile");
      if (res.ok) {
        const data = await res.json();
        if (data.user) {
          setName(data.user.name || "");
          setEmail(data.user.email || "");
          setPhone(data.user.phone || "");
          setTargetBand(data.user.target_band || "");
          if (data.user.role) {
            setRole(data.user.role);
          }
        }
      }
    } catch (err) {
      console.error("Failed to load profile:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchProfile();
  }, []);

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setSuccessMsg(null);
    setErrorMsg(null);

    try {
      const res = await fetch("/api/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          phone: phone.trim(),
          target_band: targetBand.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        setErrorMsg(data.error || "Cập nhật hồ sơ thất bại.");
      } else {
        setSuccessMsg("Đã cập nhật thông tin cá nhân thành công!");
        if (data.user) {
          setName(data.user.name || "");
          setPhone(data.user.phone || "");
          setTargetBand(data.user.target_band || "");
        }
        setTimeout(() => setSuccessMsg(null), 4000);
      }
    } catch (err: any) {
      setErrorMsg(err.message || "Lỗi hệ thống khi cập nhật hồ sơ.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPassSuccessMsg(null);
    setPassErrorMsg(null);

    if (!newPassword) {
      setPassErrorMsg("Vui lòng nhập mật khẩu mới.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setPassErrorMsg("Mật khẩu xác nhận không khớp.");
      return;
    }

    setIsChangingPass(true);

    try {
      const res = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          newPassword: newPassword.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        setPassErrorMsg(data.error || "Đổi mật khẩu thất bại.");
      } else {
        setPassSuccessMsg(data.message || "Đổi mật khẩu thành công!");
        setNewPassword("");
        setConfirmPassword("");
        setTimeout(() => setPassSuccessMsg(null), 4000);
      }
    } catch (err: any) {
      setPassErrorMsg(err.message || "Lỗi khi gọi API đổi mật khẩu.");
    } finally {
      setIsChangingPass(false);
    }
  };

  const ProfileContent = (
    <div className="max-w-4xl mx-auto space-y-8 font-sans">
      {/* Header */}
      <div className="border-b border-[#d8c2b6]/40 pb-6">
        <div className="flex items-center space-x-2 text-xs text-[#004d5e] uppercase tracking-wider font-bold mb-1">
          <User className="w-4 h-4 text-[#004d5e]" />
          <span>User Account Settings &amp; Personal Profile</span>
        </div>
        <h1 className="text-3xl font-bold text-[#211a16] tracking-tight">
          Hồ Sơ Cá Nhân &amp; Cài Đặt Tài Khoản
        </h1>
        <p className="text-sm text-[#52443a] mt-1">
          Xem thông tin cá nhân, cập nhật thông tin liên hệ và quản lý bảo mật mật khẩu tài khoản.
        </p>
      </div>

      {isLoading ? (
        <div className="p-12 flex justify-center items-center text-stone-500 space-x-2">
          <Loader2 className="w-6 h-6 animate-spin text-[#6d3807]" />
          <span className="text-sm font-medium">Đang tải thông tin hồ sơ...</span>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Avatar Card */}
          <div className="bg-white p-6 rounded-3xl border border-[#d8c2b6] shadow-sm flex flex-col items-center text-center space-y-4 h-fit">
            <div className="relative group w-32 h-32 rounded-full overflow-hidden border-4 border-[#fff1ea] shadow-md">
              <img src={avatarUrl} alt={name} className="w-full h-full object-cover" />
              <button
                type="button"
                onClick={() => {
                  const newAvatar = prompt("Nhập đường dẫn URL ảnh Avatar mới:", avatarUrl);
                  if (newAvatar) setAvatarUrl(newAvatar);
                }}
                className="absolute inset-0 bg-black/40 text-white flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-all text-xs font-medium cursor-pointer"
              >
                <Camera className="w-6 h-6 mb-1" />
                <span>Đổi Ảnh</span>
              </button>
            </div>

            <div>
              <h3 className="text-lg font-bold text-[#211a16]">{name || "Người Dùng"}</h3>
              <p className="text-xs text-[#52443a] mt-0.5">{email}</p>
              <span className="inline-block mt-3 px-3 py-1 rounded-full bg-[#fff1ea] text-[#6d3807] border border-[#ffb782] text-xs font-bold uppercase">
                {role}
              </span>
            </div>
          </div>

          {/* Forms Section */}
          <div className="md:col-span-2 space-y-6">
            {/* Edit Info Form */}
            <div className="bg-white p-8 rounded-3xl border border-[#d8c2b6] shadow-sm">
              <h2 className="text-lg font-bold text-[#211a16] mb-4 flex items-center space-x-2">
                <User className="w-5 h-5 text-[#6d3807]" />
                <span>Thông Tin Cơ Bản</span>
              </h2>

              {successMsg && (
                <div className="mb-4 p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 flex items-center space-x-2">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                  <span className="text-xs font-bold">{successMsg}</span>
                </div>
              )}

              {errorMsg && (
                <div className="mb-4 p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 flex items-center space-x-2">
                  <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
                  <span className="text-xs font-bold">{errorMsg}</span>
                </div>
              )}

              <form onSubmit={handleUpdateProfile} className="space-y-5">
                <div>
                  <label className="block text-xs font-bold uppercase text-[#211a16] mb-1">
                    Họ &amp; Tên (*)
                  </label>
                  <div className="relative">
                    <User className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#857469]" />
                    <input
                      type="text"
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="w-full pl-9 pr-3 py-2.5 bg-[#fff8f5] border border-[#d8c2b6] rounded-xl text-sm focus:outline-none focus:border-[#6d3807]"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase text-[#211a16] mb-1">
                    Địa Chỉ Email Đăng Nhập (Chỉ đọc)
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#857469]" />
                    <input
                      type="email"
                      disabled
                      value={email}
                      className="w-full pl-9 pr-3 py-2.5 bg-stone-100 border border-[#d8c2b6] rounded-xl text-sm text-stone-600 cursor-not-allowed"
                    />
                  </div>
                  <p className="text-[11px] text-[#857469] mt-1">
                    Email là mã định danh đăng nhập, không thể tự chỉnh sửa.
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase text-[#211a16] mb-1">
                    Số Điện Thoại Liên Hệ
                  </label>
                  <div className="relative">
                    <Phone className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#857469]" />
                    <input
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="w-full pl-9 pr-3 py-2.5 bg-[#fff8f5] border border-[#d8c2b6] rounded-xl text-sm focus:outline-none focus:border-[#6d3807]"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase text-[#211a16] mb-1">
                    Mục Tiêu / Bằng Cấp Năng Lực
                  </label>
                  <input
                    type="text"
                    value={targetBand}
                    onChange={(e) => setTargetBand(e.target.value)}
                    placeholder="Ví dụ: IELTS 7.5 / M.A TESOL"
                    className="w-full px-3 py-2.5 bg-[#fff8f5] border border-[#d8c2b6] rounded-xl text-sm focus:outline-none focus:border-[#6d3807]"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full py-3 bg-[#6d3807] hover:bg-[#8a4f1e] text-white font-bold text-xs rounded-xl shadow transition-all flex items-center justify-center space-x-2 disabled:opacity-50 cursor-pointer"
                >
                  {isSubmitting ? (
                    <Loader2 className="w-4 h-4 animate-spin text-white" />
                  ) : (
                    <Save className="w-4 h-4 text-[#ffb782]" />
                  )}
                  <span>Lưu Cập Nhật Hồ Sơ</span>
                </button>
              </form>
            </div>

            {/* Change Password Form */}
            <div className="bg-white p-8 rounded-3xl border border-[#d8c2b6] shadow-sm">
              <h2 className="text-lg font-bold text-[#211a16] mb-2 flex items-center space-x-2">
                <Lock className="w-5 h-5 text-[#6d3807]" />
                <span>Đổi Mật Khẩu An Toàn</span>
              </h2>
              <p className="text-xs text-[#52443a] mb-5">
                Mật khẩu mới phải có tối thiểu 8 ký tự, bao gồm cả chữ hoa, chữ thường và chữ số (chuẩn OWASP).
              </p>

              {passSuccessMsg && (
                <div className="mb-4 p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 flex items-center space-x-2">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                  <span className="text-xs font-bold">{passSuccessMsg}</span>
                </div>
              )}

              {passErrorMsg && (
                <div className="mb-4 p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 flex items-center space-x-2">
                  <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
                  <span className="text-xs font-bold">{passErrorMsg}</span>
                </div>
              )}

              <form onSubmit={handleChangePassword} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold uppercase text-[#211a16] mb-1">
                    Mật Khẩu Mới (*)
                  </label>
                  <div className="relative">
                    <KeyRound className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#857469]" />
                    <input
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Nhập mật khẩu mới (tối thiểu 8 ký tự)..."
                      className="w-full pl-9 pr-3 py-2.5 bg-[#fff8f5] border border-[#d8c2b6] rounded-xl text-sm focus:outline-none focus:border-[#6d3807]"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase text-[#211a16] mb-1">
                    Xác Nhận Mật Khẩu Mới (*)
                  </label>
                  <div className="relative">
                    <KeyRound className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#857469]" />
                    <input
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Nhập lại mật khẩu mới..."
                      className="w-full pl-9 pr-3 py-2.5 bg-[#fff8f5] border border-[#d8c2b6] rounded-xl text-sm focus:outline-none focus:border-[#6d3807]"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isChangingPass}
                  className="w-full py-3 bg-[#004d5e] hover:bg-[#003844] text-white font-bold text-xs rounded-xl shadow transition-all flex items-center justify-center space-x-2 disabled:opacity-50 cursor-pointer"
                >
                  {isChangingPass ? (
                    <Loader2 className="w-4 h-4 animate-spin text-white" />
                  ) : (
                    <KeyRound className="w-4 h-4 text-emerald-300" />
                  )}
                  <span>Cập Nhật Mật Khẩu</span>
                </button>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  if (role === "ADMIN") {
    return <AdminLayout>{ProfileContent}</AdminLayout>;
  } else if (role === "TEACHER") {
    return <TeacherLayout>{ProfileContent}</TeacherLayout>;
  } else {
    return <StudentLayout>{ProfileContent}</StudentLayout>;
  }
}
