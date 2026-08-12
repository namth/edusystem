"use client";

import { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { School, Mail, Lock, BookOpen, GraduationCap, ArrowRight, AlertCircle } from "lucide-react";

export default function TeacherLoginPage() {
  const { login } = useAuth();
  const router = useRouter();

  const [isRegistering, setIsRegistering] = useState(false);
  const [email, setEmail] = useState("teacher.duc@edtech.edu.vn");
  const [password, setPassword] = useState("123456");
  const [schoolName, setSchoolName] = useState("");
  const [subject, setSubject] = useState("ESL / IELTS Preparation");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const res = await login(email, password);
    if (res.success && res.user) {
      if (res.user.role === "ADMIN") {
        router.push("/admin/requests");
      } else if (res.user.role === "TEACHER") {
        router.push("/teacher/classes");
      } else {
        router.push("/student/dashboard");
      }
    } else {
      setErrorMsg("Thông tin đăng nhập chưa đúng. Vui lòng thử lại!");
    }
  };

  return (
    <div className="bg-[#fff8f5] min-h-screen flex font-sans text-[#211a16]">
      {/* Left Visual Anchor */}
      <section className="hidden lg:flex lg:w-1/2 relative bg-[#f3e6de] items-center justify-center p-12 overflow-hidden border-r border-[#d8c2b6]/40">
        <div className="relative z-10 w-full max-w-xl space-y-8">
          <div>
            <h1 className="font-headline text-4xl font-bold text-[#6d3807] mb-2">EduTest Pro</h1>
            <p className="text-lg text-[#52443a]">Academic Excellence &amp; Precision Analytics</p>
          </div>

          <div className="rounded-2xl overflow-hidden shadow-sm border border-[#d8c2b6] bg-[#ffffff] p-4">
            <div className="aspect-square rounded-xl overflow-hidden">
              <img
                className="w-full h-full object-cover"
                alt="Teacher Workspace"
                src="https://images.unsplash.com/photo-1524178232363-1fb2b075b655?q=80&w=800&auto=format&fit=crop"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-6 pt-4">
            <div className="flex items-start gap-3">
              <BookOpen className="w-6 h-6 text-[#6d3807] shrink-0 mt-1" />
              <div>
                <h3 className="text-xs font-bold text-[#211a16]">Advanced Analytics</h3>
                <p className="text-xs text-[#52443a]">Theo dõi tiến độ học viên theo thời gian thực.</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <GraduationCap className="w-6 h-6 text-[#6d3807] shrink-0 mt-1" />
              <div>
                <h3 className="text-xs font-bold text-[#211a16]">Smart Assessment</h3>
                <p className="text-xs text-[#52443a]">Chấm điểm tự động và duyệt nhận xét AI.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Right Form Interaction Canvas */}
      <section className="w-full lg:w-1/2 flex items-center justify-center p-6 md:p-12 bg-[#fff8f5]">
        <div className="w-full max-w-md bg-[#ffffff] p-8 md:p-10 rounded-3xl shadow-sm border border-[#d8c2b6]/40">
          <div className="text-center mb-8">
            <h2 className="font-headline text-2xl font-bold text-[#211a16] mb-2">
              {isRegistering ? "Join the Faculty" : "Teacher Portal Login"}
            </h2>
            <p className="text-xs text-[#52443a]">
              {isRegistering
                ? "Tạo hồ sơ giảng dạy để bắt đầu quản lý lớp học."
                : "Vui lòng nhập thông tin tài khoản Giáo viên để tiếp tục."}
            </p>
          </div>

          {errorMsg && (
            <div className="mb-4 p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            {isRegistering && (
              <>
                <div className="space-y-1">
                  <label className="block text-xs font-bold text-[#52443a]">
                    Tên Trường / Trung Tâm
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Cambridge International"
                    value={schoolName}
                    onChange={(e) => setSchoolName(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border border-[#d8c2b6] bg-[#ffffff] text-sm focus:outline-none focus:border-[#6d3807]"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-xs font-bold text-[#52443a]">
                    Môn Học Chính
                  </label>
                  <select
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border border-[#d8c2b6] bg-[#ffffff] text-sm focus:outline-none focus:border-[#6d3807]"
                  >
                    <option value="ESL / IELTS Preparation">ESL / IELTS Preparation</option>
                    <option value="English Language Arts">English Language Arts</option>
                    <option value="TOEIC / Academic English">TOEIC / Academic English</option>
                  </select>
                </div>
              </>
            )}

            <div className="space-y-1">
              <label className="block text-xs font-bold text-[#52443a]">
                Institutional Email Address
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-[#857469]" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="teacher@school.edu"
                  className="w-full pl-11 pr-4 py-3 rounded-xl border border-[#d8c2b6] bg-[#ffffff] text-sm focus:outline-none focus:border-[#6d3807]"
                />
              </div>
            </div>

            <div className="space-y-1">
              <div className="flex justify-between items-center">
                <label className="block text-xs font-bold text-[#52443a]">Password</label>
              </div>
              <div className="relative">
                <Lock className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-[#857469]" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-11 pr-4 py-3 rounded-xl border border-[#d8c2b6] bg-[#ffffff] text-sm focus:outline-none focus:border-[#6d3807]"
                />
              </div>
            </div>

            <button
              type="submit"
              className="w-full bg-[#6d3807] hover:bg-[#8a4f1e] text-white text-xs font-bold py-3.5 rounded-xl shadow-md transition-all flex items-center justify-center space-x-2 font-headline"
            >
              <span>{isRegistering ? "Khởi Tạo Tài Khoản Giáo Viên" : "Đăng Nhập Teacher Portal"}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          <div className="mt-6 text-center pt-4 border-t border-[#d8c2b6]/30">
            <p className="text-xs text-[#52443a]">
              {isRegistering ? "Đã có tài khoản Giáo viên?" : "Chưa có tài khoản?"}{" "}
              <button
                onClick={() => setIsRegistering(!isRegistering)}
                className="font-bold text-[#6d3807] hover:underline ml-1"
              >
                {isRegistering ? "Đăng nhập ngay" : "Tạo tài khoản Giáo viên"}
              </button>
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
