"use client";

import { useState, useEffect } from "react";
import TeacherLayout from "@/components/TeacherLayout";
import { useAuth } from "@/context/AuthContext";
import {
  UserPlus,
  CheckCircle2,
  Loader2,
  KeyRound,
  User,
  Mail,
  Phone,
  Save,
  AlertCircle,
  RefreshCw,
} from "lucide-react";

interface ClassItem {
  id: string;
  name: string;
  code: string;
}

export default function TeacherCreateStudentPage() {
  const { user } = useAuth();
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [loadingClasses, setLoadingClasses] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Form State
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [targetBand, setTargetBand] = useState("IELTS 7.0");
  const [selectedClassIds, setSelectedClassIds] = useState<string[]>([]);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [tempPasswordOnce, setTempPasswordOnce] = useState<{ name: string; password: string } | null>(null);

  const loadTeacherClasses = async () => {
    if (!user) return;
    try {
      setLoadingClasses(true);
      setErrorMessage(null);
      const res = await fetch("/api/teacher/classes");
      const data = await res.json();

      if (!res.ok || !data.classes) {
        throw new Error(data.error || "Không thể tải danh sách lớp học");
      }

      const classList: ClassItem[] = data.classes.map((c: any) => ({
        id: c.id,
        name: c.name,
        code: c.code,
      }));

      setClasses(classList);
      if (classList.length > 0) {
        setSelectedClassIds([classList[0].id]);
      }
    } catch (e: any) {
      console.error(e);
      setErrorMessage(e.message || "Lỗi nạp danh sách lớp học.");
    } finally {
      setLoadingClasses(false);
    }
  };

  useEffect(() => {
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
    if (!name.trim() || !user) return;

    if (selectedClassIds.length === 0) {
      alert("Vui lòng chọn ít nhất một lớp học để gán học sinh.");
      return;
    }

    setIsSubmitting(true);
    setSuccessMsg(null);
    setTempPasswordOnce(null);

    try {
      const studentUsername = username.trim() || `st_${Date.now().toString().slice(-4)}`;
      const studentEmail = email.trim() || `${studentUsername}@student.edu.vn`;

      let generatedTempPassword: string | undefined;
      let alreadyExisted = false;

      // Ghi danh vào từng lớp đã chọn thông qua API pg
      for (const classId of selectedClassIds) {
        const res = await fetch(`/api/teacher/classes/${classId}/students`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: name.trim(),
            email: studentEmail,
            phone: phone.trim() || undefined,
          }),
        });

        const data = await res.json();
        if (!res.ok || !data.success) {
          throw new Error(data.error || "Không thể thêm học sinh vào lớp.");
        }

        if (data.temp_password) {
          generatedTempPassword = data.temp_password;
        }
        if (data.already_existed) {
          alreadyExisted = true;
        }
      }

      if (generatedTempPassword) {
        setTempPasswordOnce({ name: name.trim(), password: generatedTempPassword });
        setSuccessMsg(
          `Đã tạo tài khoản thành công cho học viên "${name}"! Email: "${studentEmail}". Mật khẩu tạm thời: "${generatedTempPassword}". Học sinh sẽ được yêu cầu đổi mật khẩu ở lần đăng nhập đầu tiên.`
        );
      } else if (alreadyExisted) {
        setSuccessMsg(
          `Học sinh "${name}" (${studentEmail}) đã có tài khoản và đã được ghi danh vào các lớp đã chọn thành công!`
        );
      } else {
        setSuccessMsg(`Đã ghi danh học viên "${name}" vào các lớp thành công!`);
      }

      setName("");
      setUsername("");
      setEmail("");
      setPhone("");
    } catch (err: any) {
      console.error(err);
      alert("Lỗi khi thêm học viên: " + (err.message || "Không xác định"));
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
          <h1 className="text-3xl font-bold text-[#211a16] tracking-tight font-headline">
            Tạo Tài Khoản Học Sinh &amp; Gán Lớp Học
          </h1>
          <p className="text-sm text-[#52443a] mt-1">
            Tạo tài khoản học sinh qua API PostgreSQL, hệ thống tự cấp mật khẩu tạm ngẫu nhiên an toàn (chỉ hiển thị 1 lần) và gán học sinh vào các lớp học.
          </p>
        </div>

        {/* Error State with Retry */}
        {errorMessage && (
          <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
              <span className="text-xs font-bold">{errorMessage}</span>
            </div>
            <button
              onClick={loadTeacherClasses}
              className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold flex items-center space-x-1 cursor-pointer transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Thử lại</span>
            </button>
          </div>
        )}

        {/* Success Banner */}
        {successMsg && (
          <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
              <span className="text-xs font-bold leading-relaxed">{successMsg}</span>
            </div>
            <button onClick={() => setSuccessMsg(null)} className="text-emerald-700 hover:text-emerald-900 cursor-pointer text-xs font-bold">
              ✕
            </button>
          </div>
        )}

        {/* Temp Password Display Once */}
        {tempPasswordOnce && (
          <div className="p-5 rounded-2xl bg-amber-50 border-2 border-amber-300 text-amber-950 space-y-2">
            <div className="flex items-center space-x-2">
              <KeyRound className="w-5 h-5 text-amber-700 shrink-0" />
              <span className="text-xs font-bold uppercase tracking-wider">
                Mật Khẩu Tạm Thời Khởi Tạo (Chỉ Hiện 1 Lần)
              </span>
            </div>
            <p className="text-xs">
              Học sinh: <strong>{tempPasswordOnce.name}</strong> &bull; Mật khẩu tạm thời:{" "}
              <code className="px-2.5 py-1 bg-white border border-amber-300 rounded font-mono font-bold text-sm text-[#6d3807]">
                {tempPasswordOnce.password}
              </code>
            </p>
            <p className="text-[11px] text-amber-800 italic">
              Vui lòng copy và gửi lại cho học sinh ngay. Mật khẩu không được lưu dạng thô ở bất kỳ đâu và học sinh sẽ phải đổi mật khẩu trong lần đăng nhập đầu tiên.
            </p>
            <button
              onClick={() => setTempPasswordOnce(null)}
              className="mt-1 px-3 py-1 bg-amber-200 hover:bg-amber-300 rounded-lg text-xs font-bold text-amber-900 cursor-pointer"
            >
              Tôi đã ghi lại
            </button>
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
                Username Đăng Nhập
              </label>
              <div className="relative">
                <User className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[#6d3807]" />
                <input
                  type="text"
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
                  Email (*)
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[#857469]" />
                  <input
                    type="email"
                    required
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

            {/* Multi-Select Class Checkboxes */}
            <div>
              <label className="block text-xs font-bold uppercase text-[#6d3807] mb-2 flex items-center justify-between">
                <span>Chọn Các Lớp Học Tham Gia</span>
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
              className="w-full py-3.5 bg-[#6d3807] hover:bg-[#8a4f1e] text-white font-bold text-xs rounded-xl shadow transition-all flex items-center justify-center space-x-2 disabled:opacity-50 cursor-pointer font-headline"
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
