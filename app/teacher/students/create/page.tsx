"use client";

import { useState, useEffect } from "react";
import TeacherLayout from "@/components/TeacherLayout";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabase";
import { UserPlus, CheckCircle2, Loader2, KeyRound, User, Mail, Phone, BookOpen, Save } from "lucide-react";

interface ClassItem {
  id: string;
  name: string;
  code: string;
}

export default function TeacherCreateStudentPage() {
  const { user } = useAuth();
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [loadingClasses, setLoadingClasses] = useState(true);

  // Form State
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [targetBand, setTargetBand] = useState("IELTS 7.0");
  const [defaultPassword, setDefaultPassword] = useState("123456");
  const [selectedClassIds, setSelectedClassIds] = useState<string[]>([]);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    async function loadTeacherClasses() {
      if (!user) return;
      try {
        const { data } = await supabase
          .from("classes")
          .select("*")
          .eq("teacher_id", user.id);

        if (data && data.length > 0) {
          setClasses(data);
          setSelectedClassIds([data[0].id]);
        } else {
          setClasses([
            { id: "cls_101", name: "IELTS Master 7.5 - K24", code: "IELTS75K24" },
            { id: "cls_102", name: "IELTS Foundation 5.5 - K12", code: "IELTS55K12" },
          ]);
          setSelectedClassIds(["cls_101"]);
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoadingClasses(false);
      }
    }
    loadTeacherClasses();
  }, [user]);

  const toggleClassSelection = (classId: string) => {
    if (selectedClassIds.includes(classId)) {
      setSelectedClassIds(selectedClassIds.filter((id) => id !== classId));
    } else {
      setSelectedClassIds([...selectedClassIds, classId]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !defaultPassword.trim() || !user) return;

    setIsSubmitting(true);
    setSuccessMsg(null);

    try {
      const studentUsername = username.trim() || `st_${Date.now().toString().slice(-4)}`;
      const studentEmail = email.trim() || `${studentUsername}@student.edu.vn`;

      const res = await fetch("/api/admin/create-user", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          role: "STUDENT",
          email: studentEmail,
          username: studentUsername,
          password: defaultPassword.trim(),
          name: name.trim(),
          phone: phone.trim(),
          targetBand: targetBand.trim(),
          classIds: selectedClassIds,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        alert("Lỗi tạo tài khoản: " + (data.error || "Không rõ nguyên nhân"));
        return;
      }

      setSuccessMsg(
        `Đã tạo tài khoản thành công cho học viên "${name}"! Email/Username: "${studentEmail}", Mật khẩu mặc định: "${defaultPassword}". Học sinh sẽ được yêu cầu đổi mật khẩu ở lần đăng nhập đầu tiên.`
      );
      setName("");
      setUsername("");
      setEmail("");
      setPhone("");
      setDefaultPassword("123456");
      setTimeout(() => setSuccessMsg(null), 6000);
    } catch (err: any) {
      console.error(err);
      alert("Đã xảy ra lỗi hệ thống khi tạo tài khoản học viên.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <TeacherLayout>
      <div className="max-w-[800px] mx-auto space-y-8 font-sans">
        {/* Header */}
        <div className="border-b border-[#d8c2b6]/40 pb-6">
          <div className="flex items-center space-x-2 text-xs text-[#004d5e] uppercase tracking-wider font-bold mb-1">
            <UserPlus className="w-4 h-4 text-[#004d5e]" />
            <span>Teacher Portal &bull; Student Account Provisioning</span>
          </div>
          <h1 className="text-3xl font-bold text-[#211a16] tracking-tight">
            Tạo Tài Khoản Học Sinh &amp; Gán Nhiều Lớp Học
          </h1>
          <p className="text-sm text-[#52443a] mt-1">
            Cấp tài khoản bằng Username (dành cho học sinh không có Email/SĐT), mật khẩu mặc định và chọn tham gia nhiều lớp học.
          </p>
        </div>

        {successMsg && (
          <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 flex items-center space-x-3">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            <span className="text-xs font-bold leading-relaxed">{successMsg}</span>
          </div>
        )}

        {/* Create Student Form */}
        <div className="bg-white p-8 rounded-3xl border border-[#d8c2b6] shadow-sm">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-xs font-bold uppercase text-[#211a16] mb-1">
                Họ &amp; Tên Học Sinh (*)
              </label>
              <div className="relative">
                <User className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[#857469]" />
                <input
                  type="text"
                  required
                  placeholder="Ví dụ: Trần Hoàng Nam"
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                    if (!username) {
                      const suggested = e.target.value
                        .toLowerCase()
                        .normalize("NFD")
                        .replace(/[\u0300-\u036f]/g, "")
                        .replace(/[^a-z0-9]/g, "");
                      setUsername(suggested);
                    }
                  }}
                  className="w-full pl-10 pr-3 py-2.5 bg-[#fff8f5] border border-[#d8c2b6] rounded-xl text-sm focus:outline-none focus:border-[#6d3807]"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase text-[#6d3807] mb-1">
                Username Đăng Nhập (*) (Dành cho học sinh chưa có Email/SĐT)
              </label>
              <div className="relative">
                <User className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[#6d3807]" />
                <input
                  type="text"
                  required
                  placeholder="namtran01"
                  value={username}
                  onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""))}
                  className="w-full pl-10 pr-3 py-2.5 bg-[#fff1ea] border border-[#ffb782] rounded-xl text-sm font-bold text-[#6d3807] focus:outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold uppercase text-[#211a16] mb-1">
                  Email Liên Hệ (Tùy chọn)
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[#857469]" />
                  <input
                    type="email"
                    placeholder="namtran.student@gmail.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full pl-10 pr-3 py-2.5 bg-[#fff8f5] border border-[#d8c2b6] rounded-xl text-sm focus:outline-none focus:border-[#6d3807]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-[#211a16] mb-1">
                  Số Điện Thoại (Tùy chọn)
                </label>
                <div className="relative">
                  <Phone className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[#857469]" />
                  <input
                    type="tel"
                    placeholder="0912345678"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full pl-10 pr-3 py-2.5 bg-[#fff8f5] border border-[#d8c2b6] rounded-xl text-sm focus:outline-none focus:border-[#6d3807]"
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold uppercase text-[#6d3807] mb-1">
                  Mật Khẩu Mặc Định Khởi Tạo (*)
                </label>
                <div className="relative">
                  <KeyRound className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[#857469]" />
                  <input
                    type="text"
                    required
                    value={defaultPassword}
                    onChange={(e) => setDefaultPassword(e.target.value)}
                    className="w-full pl-10 pr-3 py-2.5 bg-[#fff8f5] border border-[#d8c2b6] rounded-xl text-sm focus:outline-none focus:border-[#6d3807]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-[#211a16] mb-1">
                  Mục Tiêu Band Điểm
                </label>
                <input
                  type="text"
                  placeholder="IELTS 7.0"
                  value={targetBand}
                  onChange={(e) => setTargetBand(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-[#fff8f5] border border-[#d8c2b6] rounded-xl text-sm focus:outline-none focus:border-[#6d3807]"
                />
              </div>
            </div>

            {/* Multi-Select Class Checkboxes */}
            <div>
              <label className="block text-xs font-bold uppercase text-[#6d3807] mb-2 flex items-center justify-between">
                <span>Chọn Các Lớp Học Tham Gia (Học Sinh Có Thể Thuộc Nhiều Lớp Đồng Thời)</span>
                <span className="text-[#857469] font-normal lowercase">Đã chọn: {selectedClassIds.length} lớp</span>
              </label>

              {loadingClasses ? (
                <div className="p-4 text-xs text-[#52443a] bg-[#fff8f5] rounded-xl border border-[#d8c2b6]">
                  Đang tải danh sách lớp học...
                </div>
              ) : (
                <div className="space-y-2 max-h-48 overflow-y-auto p-4 bg-[#fff1ea] border border-[#ffb782] rounded-2xl">
                  {classes.map((cls) => (
                    <label
                      key={cls.id}
                      className="flex items-center space-x-3 text-xs font-medium cursor-pointer p-2 rounded-xl hover:bg-white transition-colors border border-transparent hover:border-[#d8c2b6]"
                    >
                      <input
                        type="checkbox"
                        checked={selectedClassIds.includes(cls.id)}
                        onChange={() => toggleClassSelection(cls.id)}
                        className="accent-[#6d3807] w-4 h-4 rounded"
                      />
                      <span className="text-[#211a16] font-bold">{cls.name}</span>
                      <span className="text-[#857469] font-mono">(Mã: {cls.code})</span>
                    </label>
                  ))}
                </div>
              )}
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-3.5 bg-[#6d3807] hover:bg-[#8a4f1e] text-white font-bold text-xs rounded-xl shadow transition-all flex items-center justify-center space-x-2 disabled:opacity-50"
            >
              {isSubmitting ? (
                <Loader2 className="w-4 h-4 animate-spin text-white" />
              ) : (
                <Save className="w-4 h-4 text-[#ffb782]" />
              )}
              <span>Tạo Học Sinh &amp; Gán Danh Sách Lớp</span>
            </button>
          </form>
        </div>
      </div>
    </TeacherLayout>
  );
}
