"use client";

import { useState, useEffect } from "react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import {
  GraduationCap,
  BookOpen,
  PlusCircle,
  ArrowRight,
  Loader2,
  AlertCircle,
  CheckCircle2,
  RotateCcw,
  Calendar,
} from "lucide-react";

interface StudentClass {
  id: string;
  name: string;
  code: string;
  schedule?: string;
  description?: string;
  status?: string;
}

export default function StudentHomePage() {
  const { user } = useAuth();
  const [classes, setClasses] = useState<StudentClass[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [joinCode, setJoinCode] = useState("");
  const [enrolling, setEnrolling] = useState(false);
  const [joinMessage, setJoinMessage] = useState<{
    type: "success" | "error" | "info";
    text: string;
  } | null>(null);

  const fetchClasses = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/student/classes");
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.success) {
        throw new Error(json.error || "Không thể tải danh sách lớp học.");
      }
      setClasses(json.classes || []);
    } catch (err: any) {
      console.error("fetchClasses error:", err);
      setError(err.message || "Đã xảy ra lỗi khi tải danh sách lớp học.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchClasses();
  }, []);

  const handleJoinClass = async (e: React.FormEvent) => {
    e.preventDefault();
    const raw = joinCode.trim();
    if (!raw) return;

    setEnrolling(true);
    setJoinMessage(null);

    try {
      const res = await fetch("/api/student/enroll", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: raw }),
      });

      const json = await res.json().catch(() => ({}));

      if (res.status === 200) {
        if (json.alreadyEnrolled) {
          setJoinMessage({
            type: "info",
            text: "Bạn đã ở trong lớp này",
          });
        } else {
          const className = json.class?.name ? `"${json.class.name}"` : "";
          setJoinMessage({
            type: "success",
            text: `Đã tham gia lớp ${className} thành công!`,
          });
          setJoinCode("");
          fetchClasses();
        }
      } else if (res.status === 404) {
        setJoinMessage({
          type: "error",
          text: "Mã lớp không đúng",
        });
      } else if (res.status === 409) {
        setJoinMessage({
          type: "error",
          text: "Lớp đã đủ chỗ",
        });
      } else {
        setJoinMessage({
          type: "error",
          text: json.error || "Đã xảy ra lỗi khi tham gia lớp học.",
        });
      }
    } catch (err: any) {
      console.error("handleJoinClass error:", err);
      setJoinMessage({
        type: "error",
        text: err.message || "Đã xảy ra lỗi kết nối khi tham gia lớp.",
      });
    } finally {
      setEnrolling(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-brand-50">
      <Navbar />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full flex-1">
        {/* Banner Welcome */}
        <div className="mb-8 p-6 rounded-2xl bg-gradient-to-r from-brand-800 to-brand-800 text-white shadow-md flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <div className="flex items-center space-x-2 text-xs font-mono text-teal-200 uppercase tracking-wider mb-2">
              <GraduationCap className="w-4 h-4" />
              <span>Student Workspace Portal</span>
            </div>
            <h1 className="text-3xl font-bold font-headline">
              Xin chào, {user?.name || "bạn"}!
            </h1>
            <p className="text-sm text-blue-100 mt-1 max-w-xl">
              Hệ thống học tiếng Anh và luyện thi trực tuyến. Theo dõi tiến độ học tập và luyện đề 4 kỹ năng cùng AI.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Link
              href="/student/dashboard"
              className="px-4 py-2.5 bg-white/10 hover:bg-white/20 text-white text-sm font-semibold rounded-xl transition-all shadow-sm font-headline"
            >
              Bảng điều khiển &rarr;
            </Link>
            <Link
              href="/student/analytics"
              className="px-4 py-2.5 bg-teal-200 text-brand-800 hover:bg-white text-sm font-semibold rounded-xl transition-all shadow-sm font-headline"
            >
              Xem Tiến Độ AI &amp; Band Score &rarr;
            </Link>
          </div>
        </div>

        {/* Global Error Banner */}
        {error && (
          <div className="mb-8 p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs">
            <div className="flex items-center space-x-2">
              <AlertCircle className="w-5 h-5 text-red-600 shrink-0" />
              <span className="text-sm font-semibold">{error}</span>
            </div>
            <button
              onClick={fetchClasses}
              className="px-4 py-1.5 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-lg transition-colors cursor-pointer shrink-0 flex items-center space-x-1"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Thử lại</span>
            </button>
          </div>
        )}

        {/* Tham gia lớp bằng mã */}
        <section className="mb-8 bg-white p-6 rounded-2xl border border-brand-100 shadow-sm max-w-2xl">
          <h2 className="text-base font-bold font-headline text-brand-800 mb-2 flex items-center space-x-2">
            <PlusCircle className="w-5 h-5 text-emerald-700" />
            <span>Tham Gia Lớp Bằng Mã</span>
          </h2>
          <p className="text-xs text-ink-muted mb-4">
            Nhập mã lớp do giáo viên cung cấp để tham gia lớp học mới.
          </p>

          <form onSubmit={handleJoinClass} className="flex flex-col sm:flex-row gap-3">
            <input
              type="text"
              required
              placeholder="Nhập mã lớp..."
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value)}
              className="flex-1 px-4 py-2.5 bg-brand-50 border border-brand-100 rounded-xl text-sm font-mono focus:outline-none focus:border-brand-800 uppercase"
            />
            <button
              type="submit"
              disabled={enrolling}
              className="px-6 py-2.5 bg-brand-800 hover:bg-brand-800 text-white text-xs font-bold rounded-xl shadow transition-all font-headline shrink-0 flex items-center justify-center space-x-1 cursor-pointer disabled:opacity-60"
            >
              {enrolling ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Đang xử lý...</span>
                </>
              ) : (
                <span>Tham Gia Lớp</span>
              )}
            </button>
          </form>

          {joinMessage && (
            <div
              className={`mt-4 p-3.5 rounded-xl border text-xs font-medium flex items-center space-x-2 ${
                joinMessage.type === "success"
                  ? "bg-emerald-50 border-emerald-200 text-emerald-800"
                  : joinMessage.type === "info"
                  ? "bg-blue-50 border-blue-200 text-blue-800"
                  : "bg-red-50 border-red-200 text-red-800"
              }`}
            >
              {joinMessage.type === "success" ? (
                <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
              ) : (
                <AlertCircle className="w-4 h-4 shrink-0 text-current" />
              )}
              <span>{joinMessage.text}</span>
            </div>
          )}
        </section>

        {/* Lớp của tôi */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold font-headline text-brand-800 flex items-center space-x-2">
              <BookOpen className="w-5 h-5 text-emerald-700" />
              <span>Lớp của tôi ({classes.length})</span>
            </h2>
          </div>

          {loading ? (
            <div className="p-8 bg-white rounded-2xl border border-brand-100 flex items-center justify-center space-x-2 text-xs font-mono text-ink-subtle">
              <Loader2 className="w-4 h-4 animate-spin text-brand-800" />
              <span>Đang tải danh sách lớp học...</span>
            </div>
          ) : classes.length === 0 ? (
            <div className="p-8 text-center bg-white rounded-2xl border border-brand-100 space-y-2">
              <p className="text-sm font-bold text-ink">
                Bạn chưa tham gia lớp nào — nhập mã lớp do giáo viên cung cấp.
              </p>
              <p className="text-xs text-ink-muted">
                Sau khi tham gia lớp, toàn bộ tài liệu học tập và bài tập sẽ hiển thị ở đây.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {classes.map((cls) => (
                <div
                  key={cls.id}
                  className="bg-white p-6 rounded-2xl border border-brand-100 shadow-sm hover:shadow-md transition-all flex flex-col justify-between"
                >
                  <div>
                    <div className="flex justify-between items-start mb-3 gap-2">
                      <h3 className="text-base font-bold font-headline text-ink">
                        {cls.name}
                      </h3>
                      <span className="px-2.5 py-1 rounded-md bg-brand-100 text-brand-800 font-mono text-xs font-bold shrink-0">
                        {cls.code}
                      </span>
                    </div>

                    <div className="flex items-center text-xs text-ink-muted mb-4 space-x-1.5 font-mono">
                      <Calendar className="w-4 h-4 text-ink-subtle shrink-0" />
                      <span>{cls.schedule || "Lịch học linh hoạt"}</span>
                    </div>
                  </div>

                  <div className="pt-4 border-t border-brand-100 flex justify-end">
                    <Link
                      href={`/student/class/${cls.id}`}
                      className="px-4 py-2 bg-brand-800 hover:bg-brand-800 text-white text-xs font-semibold rounded-xl transition-all shadow flex items-center space-x-1 font-headline"
                    >
                      <span>Vào Lớp Học</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>

      <Footer />
    </div>
  );
}
