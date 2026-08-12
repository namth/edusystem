"use client";

import { useState, useEffect } from "react";
import StudentLayout from "@/components/StudentLayout";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabase";
import { Flame, Clock, ArrowRight, PlusCircle, CheckCircle2, Calendar } from "lucide-react";

interface UserClass {
  id: string;
  name: string;
  code: string;
  teacherName: string;
  studentCount: number;
  schedule: string;
}

export default function StudentDashboardPage() {
  const { user } = useAuth();
  const [classes, setClasses] = useState<UserClass[]>([]);
  const [recentSubmissions, setRecentSubmissions] = useState<any[]>([]);
  const [joinCode, setJoinCode] = useState("");
  const [joinMsg, setJoinMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchDashboardData = async () => {
    if (!user) return;
    try {
      // 1. Fetch Enrolled Classes
      const { data: enrollmentData } = await supabase
        .from("enrollments")
        .select("class_id")
        .eq("student_id", user.id);

      if (enrollmentData && enrollmentData.length > 0) {
        const classIds = enrollmentData.map((e) => e.class_id);
        const { data: classData } = await supabase
          .from("classes")
          .select("*")
          .in("id", classIds);

        const mappedClasses = (classData || []).map((c: any) => ({
          id: c.id,
          name: c.name,
          code: c.code,
          teacherName: "Thầy Nguyễn Văn Đức (M.A TESOL)",
          studentCount: 25,
          schedule: c.schedule || "Thứ 2 - Thứ 4 - Thứ 6 (19:30 - 21:30)",
        }));

        setClasses(mappedClasses);
      }

      // 2. Fetch Recent Submissions
      const { data: subData } = await supabase
        .from("submissions")
        .select("*")
        .eq("student_id", user.id)
        .order("created_at", { ascending: false })
        .limit(5);

      if (subData) {
        setRecentSubmissions(subData);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      fetchDashboardData();
    }
  }, [user]);

  const handleJoinClass = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!joinCode.trim() || !user) return;

    try {
      // Find class in PostgreSQL via Supabase
      const { data: classData, error: classError } = await supabase
        .from("classes")
        .select("*")
        .eq("code", joinCode.trim().toUpperCase())
        .maybeSingle();

      if (classError || !classData) {
        setJoinMsg("Mã lớp không hợp lệ hoặc không tồn tại!");
        setTimeout(() => setJoinMsg(null), 4000);
        return;
      }

      // Add enrollment record
      const enrollmentId = `enr_${Date.now().toString().slice(-4)}`;
      const { error: enrollError } = await supabase
        .from("enrollments")
        .insert([
          {
            id: enrollmentId,
            student_id: user.id,
            class_id: classData.id,
          },
        ]);

      if (enrollError) {
        if (enrollError.code === "23505") {
          setJoinMsg("Bạn đã tham gia lớp này từ trước rồi!");
        } else {
          setJoinMsg("Đã xảy ra lỗi khi tham gia lớp.");
        }
        setTimeout(() => setJoinMsg(null), 4000);
        return;
      }

      // Sync user relationship to Neo4j graph
      try {
        const { syncStudentEnrolledInClass } = await import("@/lib/neo4j");
        await syncStudentEnrolledInClass(user.id, classData.id);
      } catch (err) {
        console.warn("Neo4j enrollment sync warning:", err);
      }

      setJoinMsg(`Đã tham gia lớp "${classData.name}" thành công!`);
      setJoinCode("");
      fetchDashboardData();
    } catch (err) {
      console.error(err);
      setJoinMsg("Đã có lỗi hệ thống xảy ra.");
    }

    setTimeout(() => setJoinMsg(null), 4000);
  };

  return (
    <StudentLayout>
      <div className="max-w-[1280px] mx-auto space-y-8 font-sans">
        {/* Stitch Welcome & Daily Streak Widget */}
        <div className="bg-[#ffffff] rounded-2xl p-6 shadow-[0px_4px_20px_rgba(0,0,0,0.02)] border border-[#d8c2b6]/40 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          <div>
            <h1 className="font-headline text-2xl md:text-3xl font-bold text-[#6d3807] mb-1">
              Welcome back, {user?.name || "Sarah"}!
            </h1>
            <p className="font-body text-sm text-[#52443a]">
              Bạn có 2 bài thi đến hạn trong tuần này. Hãy tiếp tục duy trì phong độ làm bài.
            </p>
          </div>

          {/* Daily Streak Widget */}
          <div className="flex items-center gap-4 bg-[#fff1ea] px-5 py-3 rounded-xl border border-[#ffb783]">
            <div className="bg-[#FFD426]/30 p-2.5 rounded-full flex items-center justify-center text-[#6d3807]">
              <Flame className="w-6 h-6 fill-[#6d3807]" />
            </div>
            <div>
              <div className="font-mono text-xs text-[#52443a] font-medium">Daily Streak</div>
              <div className="font-headline text-xl text-[#6d3807] font-bold">14 Days</div>
            </div>
          </div>
        </div>

        {joinMsg && (
          <div className="p-4 rounded-xl bg-[#fff1ea] border border-[#ffb783] text-[#6d3807] flex items-center space-x-2">
            <CheckCircle2 className="w-5 h-5 text-[#6d3807]" />
            <span className="font-semibold text-sm">{joinMsg}</span>
          </div>
        )}

        {/* Join Class Box */}
        <div className="bg-[#ffffff] p-6 rounded-2xl border border-[#d8c2b6]/40 shadow-sm max-w-2xl">
          <h2 className="text-base font-bold font-headline text-[#6d3807] mb-2 flex items-center space-x-2">
            <PlusCircle className="w-5 h-5 text-[#004d5e]" />
            <span>Tham Gia Lớp Học Mới Bằng Mã (Class Code)</span>
          </h2>
          <p className="text-xs text-[#52443a] mb-4">
            Nhập mã lớp do Giáo viên cung cấp (ví dụ: <code className="font-mono text-[#6d3807] font-bold">IELTS75K24</code>) để vào lớp.
          </p>

          <form onSubmit={handleJoinClass} className="flex space-x-3">
            <input
              type="text"
              required
              placeholder="Nhập Mã Lớp (ví dụ: IELTS75K24)..."
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value)}
              className="flex-1 px-4 py-2.5 bg-[#fff8f5] border border-[#d8c2b6] rounded-xl text-sm font-mono focus:outline-none focus:border-[#6d3807] uppercase"
            />
            <button
              type="submit"
              className="px-6 py-2.5 bg-[#6d3807] hover:bg-[#8a4f1e] text-white text-xs font-bold rounded-xl shadow transition-all font-headline shrink-0"
            >
              Tham Gia Lớp
            </button>
          </form>
        </div>

        {/* Stitch Bento Grid Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Assigned Tests & Classes */}
          <div className="lg:col-span-8 space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="font-headline text-xl text-[#211a16] font-bold">Bài Thi Được Giao (Assigned Tests)</h2>
              <Link href="/student/class/cls_101" className="text-[#6d3807] font-mono text-xs font-bold hover:underline flex items-center">
                Xem Tất Cả <ArrowRight className="w-3.5 h-3.5 ml-1" />
              </Link>
            </div>

            {/* Test Cards Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-[#ffffff] border border-[#d8c2b6] rounded-xl p-5 hover:shadow-md transition-all relative overflow-hidden group">
                <div className="absolute top-0 left-0 w-1 h-full bg-[#ba1a1a]" />
                <div className="flex justify-between items-start mb-4">
                  <span className="bg-[#ffdad6] text-[#93000a] font-mono text-xs font-bold px-2 py-1 rounded">
                    Due Today
                  </span>
                </div>
                <h3 className="font-headline text-base font-bold text-[#211a16] mb-1">
                  IELTS Academic Reading Mock 4
                </h3>
                <p className="font-sans text-xs text-[#52443a] mb-6 flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 text-[#6d3807]" /> 60 Mins &bull; 40 Questions
                </p>
                <Link
                  href="/student/exam/test_01"
                  className="w-full bg-[#6d3807] text-white font-mono text-xs font-bold py-2.5 rounded-xl hover:bg-[#8a4f1e] transition-colors shadow-sm block text-center"
                >
                  Vào Làm Bài Thi
                </Link>
              </div>

              <div className="bg-[#ffffff] border border-[#d8c2b6] rounded-xl p-5 hover:shadow-md transition-all relative overflow-hidden group">
                <div className="absolute top-0 left-0 w-1 h-full bg-[#FFD426]" />
                <div className="flex justify-between items-start mb-4">
                  <span className="bg-[#FEFBEA] text-[#6d3807] font-mono text-xs font-bold px-2 py-1 rounded border border-[#ffdcc5]">
                    Due in 3 days
                  </span>
                </div>
                <h3 className="font-headline text-base font-bold text-[#211a16] mb-1">
                  Listening Practice Section 2
                </h3>
                <p className="font-sans text-xs text-[#52443a] mb-6 flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 text-[#6d3807]" /> 30 Mins &bull; 20 Questions
                </p>
                <Link
                  href="/student/exam/test_01"
                  className="w-full bg-[#fff8f5] text-[#6d3807] border border-[#6d3807]/30 font-mono text-xs font-bold py-2.5 rounded-xl hover:bg-[#f9ebe4] transition-colors block text-center"
                >
                  Vào Làm Bài Thi
                </Link>
              </div>
            </div>

            {/* My Classes Grid */}
            <div className="pt-4" id="classes">
              <h2 className="font-headline text-xl text-[#211a16] font-bold mb-4">Lớp Học Của Tôi ({classes.length})</h2>
              {loading ? (
                <p className="text-xs text-[#857469] font-mono">Đang tải lớp học...</p>
              ) : classes.length === 0 ? (
                <p className="text-xs text-[#52443a]">Bạn chưa tham gia lớp học nào. Hãy nhập mã lớp ở trên.</p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {classes.map((cls) => (
                    <Link
                      key={cls.id}
                      href={`/student/class/${cls.id}`}
                      className="bg-[#ffffff] border border-[#d8c2b6] rounded-xl p-5 hover:shadow-md transition-all block"
                    >
                      <div className="flex justify-between items-start mb-2">
                        <h3 className="font-headline font-bold text-base text-[#211a16]">{cls.name}</h3>
                        <span className="bg-[#fff1ea] text-[#6d3807] font-mono text-xs font-bold px-2 py-0.5 rounded border border-[#ffb783]">
                          {cls.code}
                        </span>
                      </div>
                      <p className="text-xs text-[#52443a] mb-3">GV: {cls.teacherName}</p>
                      <div className="text-[11px] font-mono text-[#004d5e] font-bold flex items-center justify-between pt-2 border-t border-[#ede0d9]">
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
            <div className="bg-[#ffffff] border border-[#d8c2b6] rounded-2xl p-5 shadow-2xs space-y-3">
              <div className="flex items-center justify-between border-b border-[#d8c2b6]/50 pb-2">
                <h2 className="font-headline text-sm font-bold text-[#211a16] flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-700" />
                  <span>Bài Thi Đã Nộp ({recentSubmissions.length})</span>
                </h2>
              </div>

              {recentSubmissions.length === 0 ? (
                <p className="text-xs text-[#857469] py-2">Bạn chưa thực hiện bài thi nào gần đây.</p>
              ) : (
                <div className="space-y-2.5">
                  {recentSubmissions.map((sub) => {
                    const rawScore = sub.final_score || (sub.ai_evaluation_details?.rawScore) || `${sub.score || 0} điểm`;
                    return (
                      <div key={sub.id} className="p-3 bg-[#fff8f5] rounded-xl border border-[#d8c2b6] space-y-2">
                        <div className="flex justify-between items-start">
                          <span className="font-bold text-xs text-[#211a16]">Mã bài: {sub.id}</span>
                          <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 text-[10px] font-bold rounded-full border border-emerald-300">
                            {sub.status === "GRADED" ? "Đã Chấm AI" : "Đang Chấm"}
                          </span>
                        </div>
                        <div className="text-xs text-[#6d3807] font-bold">
                          Kết quả: <span className="text-emerald-700">{rawScore}</span>
                        </div>
                        <Link
                          href={`/student/exam/review/${sub.id}`}
                          className="w-full py-1.5 bg-white hover:bg-[#fff1ea] border border-[#d8c2b6] text-[#6d3807] rounded-lg text-xs font-bold block text-center transition-all shadow-2xs"
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
            <div className="bg-[#ffffff] border border-[#d8c2b6] rounded-xl p-5">
              <h2 className="font-headline text-base font-bold text-[#211a16] mb-4 flex items-center gap-2">
                <Calendar className="w-4 h-4 text-[#785841]" />
                <span>Lịch Học Sắp Tới</span>
              </h2>
              <div className="space-y-3">
                <div className="flex gap-3 items-start p-3 bg-[#fff8f5] rounded-xl border border-[#d8c2b6]/30">
                  <div className="flex flex-col items-center justify-center bg-[#fdd1b4] text-[#785841] rounded-lg p-2 min-w-[50px]">
                    <span className="font-mono text-[10px] uppercase font-bold">OCT</span>
                    <span className="font-headline text-base font-bold leading-none">24</span>
                  </div>
                  <div>
                    <h4 className="font-headline text-xs font-bold text-[#211a16]">Advanced Grammar Review</h4>
                    <p className="font-mono text-[11px] text-[#52443a]">10:00 AM - Zoom Class</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </StudentLayout>
  );
}
