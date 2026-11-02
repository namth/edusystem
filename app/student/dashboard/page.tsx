"use client";

import { useState, useEffect } from "react";
import StudentLayout from "@/components/StudentLayout";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { Flame, Clock, ArrowRight, PlusCircle, CheckCircle2, Calendar, AlertCircle, Loader2 } from "lucide-react";
import { submissionScore, formatScore } from "@/lib/score-display";

interface UserClass {
  id: string;
  name: string;
  code: string;
  schedule: string;
}

export default function StudentDashboardPage() {
  const { user } = useAuth();
  const [classes, setClasses] = useState<UserClass[]>([]);
  const [recentSubmissions, setRecentSubmissions] = useState<any[]>([]);
  const [joinCode, setJoinCode] = useState("");
  const [joinMsg, setJoinMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDashboardData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [classesRes, subsRes] = await Promise.all([
        fetch("/api/student/classes"),
        fetch("/api/submissions"),
      ]);

      if (!classesRes.ok) {
        const json = await classesRes.json().catch(() => ({}));
        throw new Error(json.error || "Không thể tải danh sách lớp học.");
      }
      if (!subsRes.ok) {
        const json = await subsRes.json().catch(() => ({}));
        throw new Error(json.error || "Không thể tải lịch sử bài nộp.");
      }

      const classesJson = await classesRes.json();
      const subsJson = await subsRes.json();

      if (!classesJson.success) {
        throw new Error(classesJson.error || "Không thể tải danh sách lớp học.");
      }
      if (!subsJson.success) {
        throw new Error(subsJson.error || "Không thể tải lịch sử bài nộp.");
      }

      const mappedClasses = (classesJson.classes || []).map((c: any) => ({
        id: c.id,
        name: c.name,
        code: c.code,
        schedule: c.schedule || "Chưa có lịch học cố định",
      }));

      setClasses(mappedClasses);
      setRecentSubmissions((subsJson.data || []).slice(0, 5));
    } catch (e: any) {
      console.error(e);
      setError(e.message || "Đã xảy ra lỗi khi tải dữ liệu.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const handleJoinClass = async (e: React.FormEvent) => {
    e.preventDefault();
    const rawCode = joinCode.trim();
    if (!rawCode) return;

    try {
      const res = await fetch("/api/student/enroll", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: rawCode }),
      });

      const json = await res.json().catch(() => ({}));

      if (res.status === 200) {
        if (json.alreadyEnrolled) {
          setJoinMsg("Bạn đã tham gia lớp này từ trước rồi!");
        } else {
          setJoinMsg(`Đã tham gia lớp "${json.class?.name || ""}" thành công!`);
          setJoinCode("");
          fetchDashboardData();
        }
      } else if (res.status === 404) {
        setJoinMsg("Mã lớp không hợp lệ hoặc không tồn tại!");
      } else if (res.status === 409) {
        setJoinMsg("Lớp học đã đủ chỗ, vui lòng liên hệ giáo viên.");
      } else {
        setJoinMsg(json.error || "Đã xảy ra lỗi khi tham gia lớp.");
      }
    } catch (err: any) {
      console.error(err);
      setJoinMsg("Đã xảy ra lỗi khi tham gia lớp.");
    }

    setTimeout(() => setJoinMsg(null), 4000);
  };

  return (
    <StudentLayout>
      <div className="max-w-[1280px] mx-auto space-y-8 font-sans">
        {/* Stitch Welcome & Daily Streak Widget */}
        <div className="bg-white rounded-2xl p-6 shadow-[0px_4px_20px_rgba(0,0,0,0.02)] border border-line/40 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          <div>
            <h1 className="font-headline text-2xl md:text-3xl font-bold text-brand-600 mb-1">
              Welcome back, {user?.name || "bạn"}!
            </h1>
            <p className="font-body text-sm text-ink-muted">
              Chào mừng bạn đến với hệ thống học tiếng Anh và luyện thi trực tuyến.
            </p>
          </div>

          {/* Daily Streak Widget */}
          <div className="flex items-center gap-4 bg-brand-50 px-5 py-3 rounded-xl border border-brand-300">
            <div className="bg-accent-400/30 p-2.5 rounded-full flex items-center justify-center text-brand-600">
              <Flame className="w-6 h-6 fill-brand-600" />
            </div>
            <div>
              <div className="font-mono text-xs text-ink-muted font-medium">Daily Streak</div>
              <div className="font-headline text-xl text-brand-600 font-bold">14 Days</div>
            </div>
          </div>
        </div>

        {/* Global Error Banner */}
        {error && (
          <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-center space-x-2">
              <AlertCircle className="w-5 h-5 text-red-600 shrink-0" />
              <span className="text-sm font-semibold">{error}</span>
            </div>
            <button
              onClick={fetchDashboardData}
              className="px-4 py-1.5 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-lg transition-colors cursor-pointer shrink-0"
            >
              Thử lại
            </button>
          </div>
        )}

        {joinMsg && (
          <div className="p-4 rounded-xl bg-brand-50 border border-brand-300 text-brand-600 flex items-center space-x-2">
            <CheckCircle2 className="w-5 h-5 text-brand-600" />
            <span className="font-semibold text-sm">{joinMsg}</span>
          </div>
        )}

        {/* Join Class Box */}
        <div className="bg-white p-6 rounded-2xl border border-line/40 shadow-sm max-w-2xl">
          <h2 className="text-base font-bold font-headline text-brand-600 mb-2 flex items-center space-x-2">
            <PlusCircle className="w-5 h-5 text-brand-800" />
            <span>Tham Gia Lớp Học Mới Bằng Mã (Class Code)</span>
          </h2>
          <p className="text-xs text-ink-muted mb-4">
            Nhập mã lớp do Giáo viên cung cấp để tham gia lớp học.
          </p>

          <form onSubmit={handleJoinClass} className="flex space-x-3">
            <input
              type="text"
              required
              placeholder="Nhập Mã Lớp..."
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value)}
              className="flex-1 px-4 py-2.5 bg-surface-alt border border-line rounded-xl text-sm font-mono focus:outline-none focus:border-brand-600 uppercase"
            />
            <button
              type="submit"
              className="px-6 py-2.5 bg-brand-600 hover:bg-brand-700 text-white text-xs font-bold rounded-xl shadow transition-all font-headline shrink-0"
            >
              Tham Gia Lớp
            </button>
          </form>
        </div>

        {/* Stitch Bento Grid Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Classes Column */}
          <div className="lg:col-span-8 space-y-6">
            <div id="classes">
              <div className="flex justify-between items-center mb-4">
                <h2 className="font-headline text-xl text-ink font-bold">Lớp Học Của Tôi ({classes.length})</h2>
              </div>
              {loading ? (
                <div className="flex items-center space-x-2 p-6 bg-white rounded-xl border border-line">
                  <Loader2 className="w-5 h-5 text-brand-600 animate-spin" />
                  <p className="text-xs text-ink-subtle font-mono">Đang tải danh sách lớp học...</p>
                </div>
              ) : classes.length === 0 ? (
                <div className="p-8 text-center bg-white rounded-xl border border-line space-y-2">
                  <p className="text-sm font-bold text-ink">Bạn chưa tham gia lớp học nào.</p>
                  <p className="text-xs text-ink-muted">Hãy nhập mã lớp do giáo viên cung cấp ở trên để tham gia lớp học.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {classes.map((cls) => (
                    <Link
                      key={cls.id}
                      href={`/student/class/${cls.id}`}
                      className="bg-white border border-line rounded-xl p-5 hover:shadow-md transition-all block"
                    >
                      <div className="flex justify-between items-start mb-2">
                        <h3 className="font-headline font-bold text-base text-ink">{cls.name}</h3>
                        <span className="bg-brand-50 text-brand-600 font-mono text-xs font-bold px-2 py-0.5 rounded border border-brand-300">
                          {cls.code}
                        </span>
                      </div>
                      <div className="text-[11px] font-mono text-brand-800 font-bold flex items-center justify-between pt-2 border-t border-line-soft">
                        <span>Lịch: {cls.schedule}</span>
                        <span>Vào Lớp &rarr;</span>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Right Side Column */}
          <div className="lg:col-span-4 space-y-6">
            {/* Recent Submissions & AI Results Widget */}
            <div className="bg-white border border-line rounded-2xl p-5 shadow-2xs space-y-3">
              <div className="flex items-center justify-between border-b border-line/50 pb-2">
                <h2 className="font-headline text-sm font-bold text-ink flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-700" />
                  <span>Bài Thi Đã Nộp ({recentSubmissions.length})</span>
                </h2>
              </div>

              {loading ? (
                <div className="flex items-center space-x-2 py-4">
                  <Loader2 className="w-4 h-4 text-brand-600 animate-spin" />
                  <p className="text-xs text-ink-subtle font-mono">Đang tải bài thi đã nộp...</p>
                </div>
              ) : recentSubmissions.length === 0 ? (
                <div className="p-4 text-center bg-surface-alt rounded-xl border border-line space-y-1">
                  <p className="text-xs font-medium text-ink-muted">Bạn chưa thực hiện bài thi nào gần đây.</p>
                  <p className="text-[11px] text-ink-subtle">Hãy vào lớp học để làm bài thi được giao.</p>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {recentSubmissions.map((sub) => {
                    const scoreInfo = submissionScore(sub);
                    const formatted = formatScore(scoreInfo);
                    const scoreDisplay =
                      scoreInfo.value != null
                        ? scoreInfo.standard_name
                          ? `${formatted} (${scoreInfo.standard_name})`
                          : formatted
                        : scoreInfo.status === "GRADING"
                        ? "Đang chấm"
                        : scoreInfo.status === "NEEDS_REVIEW"
                        ? "Chờ giáo viên chấm"
                        : "Chưa chấm";

                    const statusBadgeLabel =
                      scoreInfo.status === "GRADING"
                        ? "Đang chấm"
                        : scoreInfo.status === "NEEDS_REVIEW"
                        ? "Chờ giáo viên chấm"
                        : scoreInfo.status === "GRADED" || scoreInfo.status === "TEACHER_REVIEWED"
                        ? "Đã Chấm"
                        : scoreInfo.status === "AI_GRADED"
                        ? "Đã Chấm AI"
                        : "Đang Chấm";

                    return (
                      <div key={sub.id} className="p-3 bg-surface-alt rounded-xl border border-line space-y-2">
                        <div className="flex justify-between items-start">
                          <span className="font-bold text-xs text-ink">Mã bài: {sub.id}</span>
                          <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 text-[10px] font-bold rounded-full border border-emerald-300">
                            {statusBadgeLabel}
                          </span>
                        </div>
                        <div className="text-xs text-brand-600 font-bold">
                          Kết quả: <span className="text-emerald-700">{scoreDisplay}</span>
                        </div>
                        <Link
                          href={`/student/exam/review/${sub.id}`}
                          className="w-full py-1.5 bg-white hover:bg-brand-50 border border-line text-brand-600 rounded-lg text-xs font-bold block text-center transition-all shadow-2xs"
                        >
                          Xem Chi Tiết Bài Làm &amp; Đáp Án &rarr;
                        </Link>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Upcoming Classes */}
            <div className="bg-white border border-line rounded-xl p-5">
              <h2 className="font-headline text-base font-bold text-ink mb-4 flex items-center gap-2">
                <Calendar className="w-4 h-4 text-ink-muted" />
                <span>Lịch Học Sắp Tới</span>
              </h2>
              {classes.length === 0 ? (
                <div className="p-4 text-center bg-surface-alt rounded-xl border border-line/30">
                  <p className="text-xs text-ink-muted">Chưa có lịch học sắp tới.</p>
                  <p className="text-[11px] text-ink-subtle mt-1">Lịch học sẽ hiển thị khi bạn tham gia lớp.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {classes.map((cls) => (
                    <div key={cls.id} className="flex gap-3 items-start p-3 bg-surface-alt rounded-xl border border-line/30">
                      <div className="flex flex-col items-center justify-center bg-accent-100 text-ink-muted rounded-lg p-2 min-w-[50px]">
                        <Calendar className="w-5 h-5 text-ink-muted" />
                      </div>
                      <div>
                        <h4 className="font-headline text-xs font-bold text-ink">{cls.name}</h4>
                        <p className="font-mono text-[11px] text-ink-muted">{cls.schedule}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </StudentLayout>
  );
}
