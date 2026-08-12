"use client";

import { useState, useEffect, use } from "react";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { syncStudentEnrolledInClass } from "@/lib/neo4j";
import {
  School,
  User,
  Mail,
  Phone,
  Lock,
  LogIn,
  UserCheck,
  AlertCircle,
  Loader2,
  CheckCircle2,
  ShieldCheck,
  BookOpen,
  Calendar,
  Users,
  Eye,
  EyeOff,
  ArrowRight
} from "lucide-react";

interface ClassInfo {
  id: string;
  name: string;
  code: string;
  teacher_id: string;
  teacher_name?: string;
  schedule?: string;
  max_slots?: number;
  enrolled_count?: number;
}

export default function JoinClassPage({ params }: { params: Promise<{ classId: string }> }) {
  const resolvedParams = use(params);
  const rawClassId = resolvedParams.classId;

  const { user, login, register } = useAuth();
  const router = useRouter();

  const [classInfo, setClassInfo] = useState<ClassInfo | null>(null);
  const [loadingClass, setLoadingClass] = useState(true);
  const [isAlreadyEnrolled, setIsAlreadyEnrolled] = useState(false);

  const [activeTab, setActiveTab] = useState<"register" | "login">("register");

  // Registration Form State
  const [regName, setRegName] = useState("");
  const [regEmail, setRegEmail] = useState("");
  const [regPhone, setRegPhone] = useState("");
  const [regPassword, setRegPassword] = useState("");

  // Login Form State
  const [loginId, setLoginId] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // 1. Fetch Class and Teacher Info
  useEffect(() => {
    async function loadClassData() {
      setLoadingClass(true);
      try {
        // Query by id OR code
        let { data: classRow } = await supabase
          .from("classes")
          .select("*")
          .or(`id.eq.${rawClassId},code.eq.${rawClassId}`)
          .maybeSingle();

        if (!classRow) {
          // Fallback to first class
          const { data: firstClass } = await supabase.from("classes").select("*").limit(1).single();
          classRow = firstClass;
        }

        if (classRow) {
          // Fetch Teacher Name
          let teacherName = "Thầy Nguyễn Văn Đức";
          if (classRow.teacher_id) {
            const { data: teacherRow } = await supabase
              .from("users")
              .select("name")
              .eq("id", classRow.teacher_id)
              .maybeSingle();
            if (teacherRow?.name) teacherName = teacherRow.name;
          }

          // Count Enrollments
          const { count } = await supabase
            .from("enrollments")
            .select("*", { count: "exact", head: true })
            .eq("class_id", classRow.id);

          setClassInfo({
            ...classRow,
            teacher_name: teacherName,
            enrolled_count: count || 0,
          });

          // Check if current user is already enrolled
          if (user) {
            const { data: enr } = await supabase
              .from("enrollments")
              .select("id")
              .eq("student_id", user.id)
              .eq("class_id", classRow.id)
              .maybeSingle();

            if (enr) setIsAlreadyEnrolled(true);
          }
        }
      } catch (err) {
        console.error("Error loading class:", err);
      } finally {
        setLoadingClass(false);
      }
    }

    loadClassData();
  }, [rawClassId, user]);

  // Helper: Enroll Student into Class & Sync Neo4j
  const enrollStudent = async (studentId: string, targetClassId: string) => {
    try {
      await supabase.from("enrollments").upsert(
        [
          {
            id: `enr_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
            student_id: studentId,
            class_id: targetClassId,
            status: "APPROVED",
          },
        ],
        { onConflict: "student_id,class_id" }
      );
      await syncStudentEnrolledInClass(studentId, targetClassId);
    } catch (err) {
      console.error("Enrollment error:", err);
    }
  };

  // Handle Logged-In User Join Click
  const handleLoggedInJoin = async () => {
    if (!user || !classInfo) return;
    setIsSubmitting(true);
    setErrorMsg(null);
    try {
      await enrollStudent(user.id, classInfo.id);
      router.push("/student/dashboard");
    } catch (err: any) {
      setErrorMsg("Không thể tham gia lớp học. Vui lòng thử lại!");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Student Registration + Auto Join
  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!regName.trim() || !regEmail.trim() || !regPassword.trim()) {
      setErrorMsg("Vui lòng điền đầy đủ Họ tên, Email và Mật khẩu!");
      return;
    }

    if (regPassword.length < 6) {
      setErrorMsg("Mật khẩu phải chứa ít nhất 6 ký tự!");
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await register(regName, regEmail, regPassword, regPhone);
      if (res.success) {
        // Fetch newly created user ID from current session
        const { data: sessionRes } = await supabase.auth.getUser();
        if (sessionRes?.user && classInfo) {
          await enrollStudent(sessionRes.user.id, classInfo.id);
        }
        router.push("/student/dashboard");
      } else {
        setErrorMsg(res.error || "Đăng ký không thành công. Email có thể đã được sử dụng!");
      }
    } catch (err: any) {
      console.error(err);
      setErrorMsg("Đã xảy ra lỗi hệ thống khi đăng ký.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Student Login + Auto Join
  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!loginId.trim() || !loginPassword.trim()) {
      setErrorMsg("Vui lòng nhập Email/Tên đăng nhập và Mật khẩu!");
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await login(loginId, loginPassword);
      if (res.success && res.user && classInfo) {
        await enrollStudent(res.user.id, classInfo.id);
        if (res.user.mustChangePassword) {
          router.push("/change-password");
        } else {
          router.push("/student/dashboard");
        }
      } else {
        setErrorMsg(res.error || "Tên đăng nhập hoặc mật khẩu không đúng!");
      }
    } catch (err: any) {
      console.error(err);
      setErrorMsg("Đã xảy ra lỗi đăng nhập.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loadingClass) {
    return (
      <div className="min-h-screen bg-[#fff8f5] flex items-center justify-center text-xs font-bold text-[#6d3807]">
        <Loader2 className="w-5 h-5 animate-spin mr-2" />
        <span>Đang tải thông tin lớp học...</span>
      </div>
    );
  }

  return (
    <div className="bg-[#fff8f5] min-h-screen flex flex-col academic-grid font-sans text-[#211a16] selection:bg-[#6d3807] selection:text-white">
      {/* Top Header */}
      <header className="fixed top-0 w-full h-16 flex items-center justify-between px-6 md:px-10 bg-white/80 backdrop-blur-md z-50 border-b border-[#d8c2b6]/30">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 bg-[#6d3807] rounded-xl flex items-center justify-center text-white shadow-xs">
            <School className="w-5 h-5 text-[#ffb782]" />
          </div>
          <span className="text-xl font-bold text-[#6d3807] tracking-tight">
            EduTest Pro
          </span>
        </div>
        <Link href="/login" className="text-xs font-bold text-[#6d3807] hover:underline">
          Đăng nhập hệ thống &rarr;
        </Link>
      </header>

      {/* Main Content Area */}
      <main className="flex-grow flex items-center justify-center pt-24 pb-12 px-4 sm:px-6 md:px-10">
        <div className="max-w-[1100px] w-full grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12 items-center">
          
          {/* Left Visual / Class Detail Pane */}
          <div className="hidden lg:flex flex-col space-y-8 pr-6">
            <div className="space-y-4">
              <div className="inline-flex items-center gap-2 px-3 py-1 bg-[#f9ebe4] border border-[#d8c2b6]/50 rounded-full text-xs font-bold text-[#6d3807]">
                <BookOpen className="w-3.5 h-3.5" />
                <span>MÃ LỚP: {classInfo?.code || "IELTS75K24"}</span>
              </div>
              <h1 className="text-3xl font-extrabold text-[#6d3807] leading-tight tracking-tight">
                {classInfo?.name || "Lớp Học IELTS Khảo Thí Special"}
              </h1>
              <p className="text-xs text-[#52443a] leading-relaxed max-w-md">
                Đăng ký hoặc đăng nhập tài khoản học viên để tự động tham gia lớp học và mở khóa ngân hàng đề thi của giảng viên.
              </p>
            </div>

            {/* Class Metadata Box */}
            <div className="p-5 bg-white/90 rounded-2xl border border-[#d8c2b6]/50 shadow-xs space-y-3">
              <div className="flex items-center gap-3 text-xs font-bold text-[#211a16]">
                <User className="w-4 h-4 text-[#6d3807]" />
                <span>Giảng viên: <strong className="text-[#6d3807]">{classInfo?.teacher_name}</strong></span>
              </div>
              {classInfo?.schedule && (
                <div className="flex items-center gap-3 text-xs font-semibold text-[#52443a]">
                  <Calendar className="w-4 h-4 text-[#6d3807]" />
                  <span>Lịch học: {classInfo.schedule}</span>
                </div>
              )}
              <div className="flex items-center gap-3 text-xs font-semibold text-[#52443a]">
                <Users className="w-4 h-4 text-[#6d3807]" />
                <span>Sĩ số: {classInfo?.enrolled_count} / {classInfo?.max_slots || 35} học viên</span>
              </div>
            </div>

            {/* Floating Visual Card */}
            <div className="relative w-full aspect-video max-w-[380px] rounded-3xl overflow-hidden shadow-md border border-[#d8c2b6]/40 float-anim">
              <div className="absolute inset-0 bg-gradient-to-tr from-[#6d3807]/20 to-transparent z-10" />
              <img
                src="https://lh3.googleusercontent.com/aida-public/AB6AXuBK1LOHlfWUn4f96qQY5VZ6AFGdycltIZyQPAem2c4NoS1inlFPiWq1UzXqG-cfa7_g9PiXg8IQmAAPn2RpXwtokGME4IL_E3TuyvCFvZ_J4RM_fFKNfmhcvcxB9qf-1kSBdYYAwaZbK239WFhmtZaxR84ixeH8dJyOinjW0S4bSqqxGGOcLRPwloePCBCqMkcScjtiMkyfqefJ-5YJ5ndbh3vSFeccntNjkZv-HrrhwVN1Wir2d_3y"
                alt="EduTest Class Portal"
                className="w-full h-full object-cover"
              />
            </div>
          </div>

          {/* Right Form Pane */}
          <div className="w-full flex justify-center lg:justify-end">
            <div className="w-full max-w-[440px] bg-white p-8 md:p-10 rounded-3xl shadow-sm border border-[#d8c2b6]/40 space-y-6">
              
              {user ? (
                /* Already Logged In Case */
                <div className="space-y-6 text-center">
                  <div className="w-16 h-16 bg-[#f9ebe4] rounded-2xl flex items-center justify-center mx-auto border border-[#d8c2b6]/50">
                    <School className="w-8 h-8 text-[#6d3807]" />
                  </div>
                  <div>
                    <h2 className="text-xl font-extrabold text-[#211a16]">
                      {isAlreadyEnrolled ? "BẠN ĐÃ LÀ THÀNH VIÊN LỚP HỌC" : "THAM GIA LỚP HỌC NGAY"}
                    </h2>
                    <p className="text-xs text-[#857469] mt-1.5">
                      Xin chào <strong className="text-[#6d3807]">{user.name}</strong> ({user.email})
                    </p>
                  </div>

                  <div className="p-4 bg-[#fff8f5] rounded-xl border border-[#d8c2b6]/60 text-left text-xs space-y-1.5">
                    <p className="font-bold text-[#6d3807]">{classInfo?.name}</p>
                    <p className="text-[#52443a]">Giảng viên: {classInfo?.teacher_name}</p>
                  </div>

                  {errorMsg && (
                    <div className="p-3.5 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs font-bold flex items-start space-x-2">
                      <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                      <span>{errorMsg}</span>
                    </div>
                  )}

                  {isAlreadyEnrolled ? (
                    <Link
                      href="/student/dashboard"
                      className="w-full py-3.5 bg-[#6d3807] hover:bg-[#85460c] text-white font-bold text-xs rounded-xl shadow-md flex items-center justify-center space-x-2"
                    >
                      <span>VÀO BẢNG ĐIỀU KHIỂN HỌC VIÊN</span>
                      <ArrowRight className="w-4 h-4" />
                    </Link>
                  ) : (
                    <button
                      type="button"
                      onClick={handleLoggedInJoin}
                      disabled={isSubmitting}
                      className="w-full py-3.5 bg-[#6d3807] hover:bg-[#85460c] text-white font-bold text-xs rounded-xl shadow-md flex items-center justify-center space-x-2 cursor-pointer disabled:opacity-50"
                    >
                      {isSubmitting ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin text-[#ffb782]" />
                          <span>Đang đăng ký ghi danh...</span>
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="w-4 h-4 text-[#ffb782]" />
                          <span>XÁC NHẬN THAM GIA LỚP HỌC</span>
                        </>
                      )}
                    </button>
                  )}
                </div>
              ) : (
                /* Unauthenticated User: Form with 2 Tabs (Register & Join OR Login & Join) */
                <>
                  <div>
                    <h2 className="text-2xl font-extrabold text-[#211a16] tracking-tight">
                      THAM GIA LỚP HỌC
                    </h2>
                    <p className="text-xs text-[#857469] mt-1">
                      {classInfo?.name}
                    </p>
                  </div>

                  {/* Tab Switcher */}
                  <div className="flex p-1 bg-[#f9ebe4] rounded-xl border border-[#d8c2b6]/30">
                    <button
                      type="button"
                      onClick={() => { setActiveTab("register"); setErrorMsg(null); }}
                      className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                        activeTab === "register"
                          ? "bg-white text-[#6d3807] shadow-xs"
                          : "text-[#857469] hover:text-[#211a16]"
                      }`}
                    >
                      Tạo Tài Khoản Mới
                    </button>
                    <button
                      type="button"
                      onClick={() => { setActiveTab("login"); setErrorMsg(null); }}
                      className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                        activeTab === "login"
                          ? "bg-white text-[#6d3807] shadow-xs"
                          : "text-[#857469] hover:text-[#211a16]"
                      }`}
                    >
                      Đã Có Tài Khoản
                    </button>
                  </div>

                  {errorMsg && (
                    <div className="p-3.5 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs font-bold flex items-start space-x-2 animate-shake">
                      <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                      <span>{errorMsg}</span>
                    </div>
                  )}

                  {activeTab === "register" ? (
                    /* Register Form */
                    <form onSubmit={handleRegisterSubmit} className="space-y-4">
                      <div>
                        <label className="block text-xs font-bold uppercase text-[#6d3807] mb-1.5">
                          Họ và Tên Học Viên
                        </label>
                        <div className="relative">
                          <User className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[#857469]" />
                          <input
                            type="text"
                            required
                            value={regName}
                            onChange={(e) => setRegName(e.target.value)}
                            placeholder="Ví dụ: Nguyễn Văn An"
                            className="w-full pl-10 pr-3 py-2.5 bg-[#fff8f5] border border-[#d8c2b6] rounded-xl text-xs font-bold text-[#211a16] placeholder-[#a89588] focus:outline-none focus:ring-2 focus:ring-[#6d3807]"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-bold uppercase text-[#6d3807] mb-1.5">
                          Địa Chỉ Email
                        </label>
                        <div className="relative">
                          <Mail className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[#857469]" />
                          <input
                            type="email"
                            required
                            value={regEmail}
                            onChange={(e) => setRegEmail(e.target.value)}
                            placeholder="student.name@edu.vn"
                            className="w-full pl-10 pr-3 py-2.5 bg-[#fff8f5] border border-[#d8c2b6] rounded-xl text-xs font-bold text-[#211a16] placeholder-[#a89588] focus:outline-none focus:ring-2 focus:ring-[#6d3807]"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-bold uppercase text-[#6d3807] mb-1.5">
                          Số Điện Thoại (Tùy chọn)
                        </label>
                        <div className="relative">
                          <Phone className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[#857469]" />
                          <input
                            type="tel"
                            value={regPhone}
                            onChange={(e) => setRegPhone(e.target.value)}
                            placeholder="0912 345 678"
                            className="w-full pl-10 pr-3 py-2.5 bg-[#fff8f5] border border-[#d8c2b6] rounded-xl text-xs font-bold text-[#211a16] placeholder-[#a89588] focus:outline-none focus:ring-2 focus:ring-[#6d3807]"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-bold uppercase text-[#6d3807] mb-1.5">
                          Mật Khẩu
                        </label>
                        <div className="relative">
                          <Lock className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[#857469]" />
                          <input
                            type={showPassword ? "text" : "password"}
                            required
                            value={regPassword}
                            onChange={(e) => setRegPassword(e.target.value)}
                            placeholder="Mật khẩu tối thiểu 6 ký tự"
                            className="w-full pl-10 pr-10 py-2.5 bg-[#fff8f5] border border-[#d8c2b6] rounded-xl text-xs font-bold text-[#211a16] placeholder-[#a89588] focus:outline-none focus:ring-2 focus:ring-[#6d3807]"
                          />
                          <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-[#857469] hover:text-[#211a16] cursor-pointer"
                          >
                            {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </button>
                        </div>
                      </div>

                      <button
                        type="submit"
                        disabled={isSubmitting}
                        className="w-full py-3.5 bg-[#6d3807] hover:bg-[#85460c] active:scale-[0.98] text-white font-bold text-xs rounded-xl shadow-md transition-all cursor-pointer flex items-center justify-center space-x-2 disabled:opacity-50"
                      >
                        {isSubmitting ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin text-[#ffb782]" />
                            <span>Đang tạo tài khoản & vào lớp...</span>
                          </>
                        ) : (
                          <>
                            <UserCheck className="w-4 h-4 text-[#ffb782]" />
                            <span>ĐĂNG KÝ & THAM GIA LỚP HỌC</span>
                          </>
                        )}
                      </button>
                    </form>
                  ) : (
                    /* Login Form */
                    <form onSubmit={handleLoginSubmit} className="space-y-4">
                      <div>
                        <label className="block text-xs font-bold uppercase text-[#6d3807] mb-1.5">
                          Email / Tên Đăng Nhập
                        </label>
                        <div className="relative">
                          <Mail className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[#857469]" />
                          <input
                            type="text"
                            required
                            value={loginId}
                            onChange={(e) => setLoginId(e.target.value)}
                            placeholder="student.name@edu.vn"
                            className="w-full pl-10 pr-3 py-2.5 bg-[#fff8f5] border border-[#d8c2b6] rounded-xl text-xs font-bold text-[#211a16] placeholder-[#a89588] focus:outline-none focus:ring-2 focus:ring-[#6d3807]"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-bold uppercase text-[#6d3807] mb-1.5">
                          Mật Khẩu
                        </label>
                        <div className="relative">
                          <Lock className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[#857469]" />
                          <input
                            type={showPassword ? "text" : "password"}
                            required
                            value={loginPassword}
                            onChange={(e) => setLoginPassword(e.target.value)}
                            placeholder="••••••••"
                            className="w-full pl-10 pr-10 py-2.5 bg-[#fff8f5] border border-[#d8c2b6] rounded-xl text-xs font-bold text-[#211a16] placeholder-[#a89588] focus:outline-none focus:ring-2 focus:ring-[#6d3807]"
                          />
                          <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-[#857469] hover:text-[#211a16] cursor-pointer"
                          >
                            {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </button>
                        </div>
                      </div>

                      <button
                        type="submit"
                        disabled={isSubmitting}
                        className="w-full py-3.5 bg-[#6d3807] hover:bg-[#85460c] active:scale-[0.98] text-white font-bold text-xs rounded-xl shadow-md transition-all cursor-pointer flex items-center justify-center space-x-2 disabled:opacity-50"
                      >
                        {isSubmitting ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin text-[#ffb782]" />
                            <span>Đang đăng nhập & ghi danh...</span>
                          </>
                        ) : (
                          <>
                            <LogIn className="w-4 h-4 text-[#ffb782]" />
                            <span>ĐĂNG NHẬP & THAM GIA LỚP HỌC</span>
                          </>
                        )}
                      </button>
                    </form>
                  )}
                </>
              )}

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
