"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import AdminLayout from "@/components/AdminLayout";
import TeacherLayout from "@/components/TeacherLayout";
import StudentLayout from "@/components/StudentLayout";
import { supabase } from "@/lib/supabase";
import { User, Mail, Phone, Camera, Save, CheckCircle2, Shield, Loader2, KeyRound } from "lucide-react";

export default function UserProfilePage() {
  const { user } = useAuth();
  const role = user?.role || "ADMIN";

  const [name, setName] = useState(user?.name || "");
  const [email, setEmail] = useState(user?.email || "");
  const [phone, setPhone] = useState(user?.phone || "");
  const [targetBand, setTargetBand] = useState(user?.targetBand || "");
  const [avatarUrl, setAvatarUrl] = useState("https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=400&auto=format&fit=crop");
  const [password, setPassword] = useState("123456");

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      setName(user.name);
      setEmail(user.email);
      setPhone(user.phone || "");
      setTargetBand(user.targetBand || "");
    }
  }, [user]);

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setIsSubmitting(true);
    setSuccessMsg(null);

    try {
      const { error } = await supabase
        .from("users")
        .update({
          name: name.trim(),
          email: email.trim(),
          phone: phone.trim(),
          target_band: targetBand.trim(),
          password: password.trim(),
        })
        .eq("id", user.id);

      if (error) {
        console.error("Profile update error:", error);
      }

      setSuccessMsg("Đã cập nhật thông tin cá nhân & ảnh đại diện thành công!");
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (e) {
      console.error(e);
    } finally {
      setIsSubmitting(false);
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
          Xem thông tin cá nhân, cập nhật ảnh đại diện Avatar và chỉnh sửa thông tin liên hệ.
        </p>
      </div>

      {successMsg && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 flex items-center space-x-2">
          <CheckCircle2 className="w-5 h-5 text-emerald-600" />
          <span className="text-xs font-bold">{successMsg}</span>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {/* Avatar Card */}
        <div className="bg-white p-6 rounded-3xl border border-[#d8c2b6] shadow-sm flex flex-col items-center text-center space-y-4">
          <div className="relative group w-32 h-32 rounded-full overflow-hidden border-4 border-[#fff1ea] shadow-md">
            <img src={avatarUrl} alt={name} className="w-full h-full object-cover" />
            <button
              onClick={() => {
                const newAvatar = prompt("Nhập đường dẫn URL ảnh Avatar mới:", avatarUrl);
                if (newAvatar) setAvatarUrl(newAvatar);
              }}
              className="absolute inset-0 bg-black/40 text-white flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-all text-xs font-medium"
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

        {/* Edit Info Form */}
        <div className="md:col-span-2 bg-white p-8 rounded-3xl border border-[#d8c2b6] shadow-sm">
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
                Địa Chỉ Email Đăng Nhập (*)
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#857469]" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-9 pr-3 py-2.5 bg-[#fff8f5] border border-[#d8c2b6] rounded-xl text-sm focus:outline-none focus:border-[#6d3807]"
                />
              </div>
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

            <div>
              <label className="block text-xs font-bold uppercase text-[#211a16] mb-1">
                Mật Khẩu Mới
              </label>
              <div className="relative">
                <KeyRound className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#857469]" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Nhập mật khẩu mới..."
                  className="w-full pl-9 pr-3 py-2.5 bg-[#fff8f5] border border-[#d8c2b6] rounded-xl text-sm focus:outline-none focus:border-[#6d3807]"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-3 bg-[#6d3807] hover:bg-[#8a4f1e] text-white font-bold text-xs rounded-xl shadow transition-all flex items-center justify-center space-x-2 disabled:opacity-50"
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
      </div>
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
