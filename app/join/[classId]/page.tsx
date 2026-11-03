"use client";

import { useState, useEffect, use } from "react";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import Link from "next/link";
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
  teacher_name?: string | null;
  schedule?: string | null;
  max_slots?: number | null;
  enrolled_count?: number;
  is_enrolled?: boolean;
}

export default function JoinClassPage({ params }: { params: Promise<{ classId: string }> }) {
  const resolvedParams = use(params);
  const rawClassId = resolvedParams.classId;

  const { user, login, register } = useAuth();
  const router = useRouter();

  const [classInfo, setClassInfo] = useState<ClassInfo | null>(null);
  const [loadingClass, setLoadingClass] = useState(true);
  const [notFound, setNotFound] = useState(false);
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

  // 1. Fetch Class and Teacher Info via public lookup API
  useEffect(() => {
    async function loadClassData() {
      setLoadingClass(true);
      setNotFound(false);
      try {
        const res = await fetch(`/api/classes/lookup/${encodeURIComponent(rawClassId)}`);
        if (res.status === 404) {
          setNotFound(true);
          setClassInfo(null);
          return;
        }

        const json = await res.json().catch(() => ({}));
        if (!res.ok || !json.success || !json.class) {
          setErrorMsg(json.error || "Không thể tải thông tin lớp học.");
          setClassInfo(null);
          return;
        }

        setClassInfo(json.class);
        setIsAlreadyEnrolled(Boolean(json.class.is_enrolled));
      } catch (err) {
        console.error("Error loading class:", err);
        setErrorMsg("Đã xảy ra lỗi khi tải thông tin lớp học.");
      } finally {
        setLoadingClass(false);
      }
    }

    if (rawClassId) {
      loadClassData();
    }
  }, [rawClassId]);

  // Helper: Enroll Student via API
  const enrollInClass = async (code: string) => {
    const res = await fetch("/api/student/enroll", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code }),
    });

    if (res.status === 409) {
      return { success: false, error: "Lớp học đã đủ chỗ, vui lòng liên hệ giáo viên." };
    }
    if (res.status === 403) {
      return { success: false, error: "Chỉ tài khoản học sinh mới tham gia lớp được." };
    }

    const json = await res.json().catch(() => ({}));
    if (!res.ok || !json.success) {
      return { success: false, error: json.error || "Lỗi ghi danh lớp học." };
    }

    return { success: true, data: json };
  };

  // Handle Logged-In User Join Click
  const handleLoggedInJoin = async () => {
    if (!user || !classInfo) return;
    setIsSubmitting(true);
    setErrorMsg(null);
    try {
      const res = await enrollInClass(classInfo.code);
      if (res.success) {
        router.push("/student/dashboard");
      } else {
        setErrorMsg(res.error);
      }
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

    if (!classInfo) return;

    setIsSubmitting(true);
    try {
      const res = await register(regName, regEmail, regPassword, regPhone);
      if (res.success) {
        const enrollRes = await enrollInClass(classInfo.code);
        if (enrollRes.success) {
          router.push("/student/dashboard");
        } else {
          setErrorMsg(enrollRes.error);
        }
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

    if (!classInfo) return;

    setIsSubmitting(true);
    try {
      const res = await login(loginId, loginPassword);
      if (res.success && res.user) {
        const enrollRes = await enrollInClass(classInfo.code);
        if (enrollRes.success) {
          if (res.user.mustChangePassword) {
            router.push("/change-password");
          } else {
            router.push("/student/dashboard");
          }
        } else {
          setErrorMsg(enrollRes.error);
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
      <div className="min-h-screen bg-surface-alt flex items-center justify-center text-xs font-bold text-brand-600">
        <Loader2 className="w-5 h-5 animate-spin mr-2" />
        <span>Đang tải thông tin lớp học...</span>
      </div>
    );
  }

  if (notFound || !classInfo) {
    return (
      <div className="min-h-screen bg-surface-alt flex flex-col items-center justify-center p-6 space-y-4">
        <div className="w-16 h-16 bg-rose-50 text-rose-600 rounded-2xl flex items-center justify-center border border-rose-200">
          <AlertCircle className="w-8 h-8" />
        </div>
        <h1 className="text-xl font-bold text-brand-600 text-center">
          Link mời không hợp lệ hoặc lớp không còn tồn tại.
        </h1>
        <Link
          href="/student/dashboard"
          className="px-5 py-2.5 bg-brand-600 text-white rounded-xl text-xs font-bold hover:bg-brand-700 transition-all"
        >
          Quay lại Dashboard
        </Link>
      </div>
    );
  }

  return (
    <div className="bg-surface-alt min-h-screen flex flex-col academic-grid font-sans text-ink selection:bg-brand-600 selection:text-white">
      {/* Top Header */}
      <header className="fixed top-0 w-full h-16 flex items-center justify-between px-6 md:px-10 bg-white/80 backdrop-blur-md z-50 border-b border-line/30">
        <div className="flex items-center">
          <img src="/brand/kitokit-logo-ngang.png" alt="KitoKit" className="h-11 w-auto object-contain" />
        </div>
        <Link href="/login" className="text-xs font-bold text-brand-600 hover:underline">
          Đăng nhập hệ thống &rarr;
        </Link>
      </header>

      {/* Main Content Area */}
      <main className="flex-grow flex items-center justify-center pt-24 pb-12 px-4 sm:px-6 md:px-10">
        <div className="max-w-[1100px] w-full grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12 items-center">
          
          {/* Left Visual / Class Detail Pane */}
          <div className="hidden lg:flex flex-col space-y-8 pr-6">
            <div className="space-y-4">
              <div className="inline-flex items-center gap-2 px-3 py-1 bg-brand-100 border border-line/50 rounded-full text-xs font-bold text-brand-600">
                <BookOpen className="w-3.5 h-3.5" />
                <span>MÃ LỚP: {classInfo.code}</span>
              </div>
              <h1 className="text-3xl font-extrabold text-brand-600 leading-tight tracking-tight">
                {classInfo.name}
              </h1>
              <p className="text-xs text-ink-muted leading-relaxed max-w-md">
                Đăng ký hoặc đăng nhập tài khoản học viên để tự động tham gia lớp học và mở khóa ngân hàng đề thi của giảng viên.
              </p>
            </div>

            {/* Class Metadata Box */}
            <div className="p-5 bg-white/90 rounded-2xl border border-line/50 shadow-xs space-y-3">
              {classInfo.teacher_name && (
                <div className="flex items-center gap-3 text-xs font-bold text-ink">
                  <User className="w-4 h-4 text-brand-600" />
                  <span>Giảng viên: <strong className="text-brand-600">{classInfo.teacher_name}</strong></span>
                </div>
              )}
              {classInfo.schedule && (
                <div className="flex items-center gap-3 text-xs font-semibold text-ink-muted">
                  <Calendar className="w-4 h-4 text-brand-600" />
                  <span>Lịch học: {classInfo.schedule}</span>
                </div>
              )}
              <div className="flex items-center gap-3 text-xs font-semibold text-ink-muted">
                <Users className="w-4 h-4 text-brand-600" />
                <span>Sĩ số: {classInfo.enrolled_count ?? 0} / {classInfo.max_slots ?? 35} học viên</span>
              </div>
            </div>

            {/* Floating Visual Card */}
            <div className="relative w-full aspect-video max-w-[380px] rounded-3xl overflow-hidden shadow-md border border-line/40 float-anim">
              <div className="absolute inset-0 bg-gradient-to-tr from-brand-600/20 to-transparent z-10" />
              <img
                src="/brand/mascot-3d/kito-3d-vui-mung.png"
                alt="KitoKit — Lớp học"
                className="w-full h-full object-contain bg-white p-6"
              />
            </div>
          </div>

          {/* Right Form Pane */}
          <div className="w-full flex justify-center lg:justify-end">
            <div className="w-full max-w-[440px] bg-white p-8 md:p-10 rounded-3xl shadow-sm border border-line/40 space-y-6">
              
              {user ? (
                /* Already Logged In Case */
                <div className="space-y-6 text-center">
                  <div className="w-16 h-16 bg-brand-100 rounded-2xl flex items-center justify-center mx-auto border border-line/50">
                    <School className="w-8 h-8 text-brand-600" />
                  </div>
                  <div>
                    <h2 className="text-xl font-extrabold text-ink">
                      {isAlreadyEnrolled ? "BẠN ĐÃ LÀ THÀNH VIÊN LỚP HỌC" : "THAM GIA LỚP HỌC NGAY"}
                    </h2>
                    <p className="text-xs text-ink-subtle mt-1.5">
                      Xin chào <strong className="text-brand-600">{user.name}</strong> ({user.email})
                    </p>
                  </div>

                  <div className="p-4 bg-surface-alt rounded-xl border border-line/60 text-left text-xs space-y-1.5">
                    <p className="font-bold text-brand-600">{classInfo.name}</p>
                    {classInfo.teacher_name && (
                      <p className="text-ink-muted">Giảng viên: {classInfo.teacher_name}</p>
                    )}
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
                      className="w-full py-3.5 bg-brand-600 hover:bg-brand-700 text-white font-bold text-xs rounded-xl shadow-md flex items-center justify-center space-x-2"
                    >
                      <span>VÀO BẢNG ĐIỀU KHIỂN HỌC VIÊN</span>
                      <ArrowRight className="w-4 h-4" />
                    </Link>
                  ) : (
                    <button
                      type="button"
                      onClick={handleLoggedInJoin}
                      disabled={isSubmitting}
                      className="w-full py-3.5 bg-brand-600 hover:bg-brand-700 text-white font-bold text-xs rounded-xl shadow-md flex items-center justify-center space-x-2 cursor-pointer disabled:opacity-50"
                    >
                      {isSubmitting ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin text-white" />
                          <span>Đang đăng ký ghi danh...</span>
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="w-4 h-4 text-white" />
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
                    <h2 className="text-2xl font-extrabold text-ink tracking-tight">
                      THAM GIA LỚP HỌC
                    </h2>
                    <p className="text-xs text-ink-subtle mt-1">
                      {classInfo.name}
                    </p>
                  </div>

                  {/* Tab Switcher */}
                  <div className="flex p-1 bg-brand-100 rounded-xl border border-line/30">
                    <button
                      type="button"
                      onClick={() => { setActiveTab("register"); setErrorMsg(null); }}
                      className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                        activeTab === "register"
                          ? "bg-white text-brand-600 shadow-xs"
                          : "text-ink-subtle hover:text-ink"
                      }`}
                    >
                      Tạo Tài Khoản Mới
                    </button>
                    <button
                      type="button"
                      onClick={() => { setActiveTab("login"); setErrorMsg(null); }}
                      className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                        activeTab === "login"
                          ? "bg-white text-brand-600 shadow-xs"
                          : "text-ink-subtle hover:text-ink"
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
                        <label className="block text-xs font-bold uppercase text-brand-600 mb-1.5">
                          Họ và Tên Học Viên
                        </label>
                        <div className="relative">
                          <User className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-subtle" />
                          <input
                            type="text"
                            required
                            value={regName}
                            onChange={(e) => setRegName(e.target.value)}
                            placeholder="Ví dụ: Nguyễn Văn An"
                            className="w-full pl-10 pr-3 py-2.5 bg-surface-alt border border-line rounded-xl text-xs font-bold text-ink placeholder-ink-subtle focus:outline-none focus:ring-2 focus:ring-brand-600"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-bold uppercase text-brand-600 mb-1.5">
                          Địa Chỉ Email
                        </label>
                        <div className="relative">
                          <Mail className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-subtle" />
                          <input
                            type="email"
                            required
                            value={regEmail}
                            onChange={(e) => setRegEmail(e.target.value)}
                            placeholder="student.name@edu.vn"
                            className="w-full pl-10 pr-3 py-2.5 bg-surface-alt border border-line rounded-xl text-xs font-bold text-ink placeholder-ink-subtle focus:outline-none focus:ring-2 focus:ring-brand-600"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-bold uppercase text-brand-600 mb-1.5">
                          Số Điện Thoại (Tùy chọn)
                        </label>
                        <div className="relative">
                          <Phone className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-subtle" />
                          <input
                            type="tel"
                            value={regPhone}
                            onChange={(e) => setRegPhone(e.target.value)}
                            placeholder="0912 345 678"
                            className="w-full pl-10 pr-3 py-2.5 bg-surface-alt border border-line rounded-xl text-xs font-bold text-ink placeholder-ink-subtle focus:outline-none focus:ring-2 focus:ring-brand-600"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-bold uppercase text-brand-600 mb-1.5">
                          Mật Khẩu
                        </label>
                        <div className="relative">
                          <Lock className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-subtle" />
                          <input
                            type={showPassword ? "text" : "password"}
                            required
                            value={regPassword}
                            onChange={(e) => setRegPassword(e.target.value)}
                            placeholder="Mật khẩu tối thiểu 6 ký tự"
                            className="w-full pl-10 pr-10 py-2.5 bg-surface-alt border border-line rounded-xl text-xs font-bold text-ink placeholder-ink-subtle focus:outline-none focus:ring-2 focus:ring-brand-600"
                          />
                          <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-subtle hover:text-ink cursor-pointer"
                          >
                            {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </button>
                        </div>
                      </div>

                      <button
                        type="submit"
                        disabled={isSubmitting}
                        className="w-full py-3.5 bg-brand-600 hover:bg-brand-700 active:scale-[0.98] text-white font-bold text-xs rounded-xl shadow-md transition-all cursor-pointer flex items-center justify-center space-x-2 disabled:opacity-50"
                      >
                        {isSubmitting ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin text-white" />
                            <span>Đang tạo tài khoản & vào lớp...</span>
                          </>
                        ) : (
                          <>
                            <UserCheck className="w-4 h-4 text-white" />
                            <span>ĐĂNG KÝ & THAM GIA LỚP HỌC</span>
                          </>
                        )}
                      </button>
                    </form>
                  ) : (
                    /* Login Form */
                    <form onSubmit={handleLoginSubmit} className="space-y-4">
                      <div>
                        <label className="block text-xs font-bold uppercase text-brand-600 mb-1.5">
                          Email / Tên Đăng Nhập
                        </label>
                        <div className="relative">
                          <Mail className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-subtle" />
                          <input
                            type="text"
                            required
                            value={loginId}
                            onChange={(e) => setLoginId(e.target.value)}
                            placeholder="student.name@edu.vn"
                            className="w-full pl-10 pr-3 py-2.5 bg-surface-alt border border-line rounded-xl text-xs font-bold text-ink placeholder-ink-subtle focus:outline-none focus:ring-2 focus:ring-brand-600"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-bold uppercase text-brand-600 mb-1.5">
                          Mật Khẩu
                        </label>
                        <div className="relative">
                          <Lock className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-subtle" />
                          <input
                            type={showPassword ? "text" : "password"}
                            required
                            value={loginPassword}
                            onChange={(e) => setLoginPassword(e.target.value)}
                            placeholder="••••••••"
                            className="w-full pl-10 pr-10 py-2.5 bg-surface-alt border border-line rounded-xl text-xs font-bold text-ink placeholder-ink-subtle focus:outline-none focus:ring-2 focus:ring-brand-600"
                          />
                          <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-subtle hover:text-ink cursor-pointer"
                          >
                            {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </button>
                        </div>
                      </div>

                      <button
                        type="submit"
                        disabled={isSubmitting}
                        className="w-full py-3.5 bg-brand-600 hover:bg-brand-700 active:scale-[0.98] text-white font-bold text-xs rounded-xl shadow-md transition-all cursor-pointer flex items-center justify-center space-x-2 disabled:opacity-50"
                      >
                        {isSubmitting ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin text-white" />
                            <span>Đang đăng nhập & ghi danh...</span>
                          </>
                        ) : (
                          <>
                            <LogIn className="w-4 h-4 text-white" />
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
      <footer className="mt-auto py-6 px-6 md:px-10 flex flex-col md:flex-row justify-between items-center gap-4 text-xs font-medium text-ink-subtle border-t border-line/30">
        <div className="flex items-center gap-3">
          <span>© 2026 KitoKit</span>
          <span className="w-1 h-1 bg-ink-subtle rounded-full" />
          <span>Hệ Thống Đánh Giá & Khảo Thí</span>
        </div>
        <div className="flex items-center gap-1.5 italic text-xs text-brand-600">
          <ShieldCheck className="w-4 h-4" />
          <span>Môi Trường Khảo Thí An Toàn</span>
        </div>
      </footer>
    </div>
  );
}
