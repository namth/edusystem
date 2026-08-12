"use client";

import { useState, useEffect } from "react";
import StudentLayout from "@/components/StudentLayout";
import Link from "next/link";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";
import {
  BookOpen,
  Clock,
  ArrowRight,
  FileText,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Award,
  Sparkles,
  Calendar,
  Layers,
  ChevronRight,
  ShieldCheck,
  Eye,
} from "lucide-react";

interface UserClass {
  id: string;
  name: string;
  code: string;
  teacher_id: string;
  schedule: string;
}

interface AssignedExam {
  id: string;
  assignment_id: string;
  exam_id: string;
  title: string;
  duration_minutes: number;
  skills: string[];
  due_date?: string;
  max_attempts: number;
  isOverdue?: boolean;
}

interface GradedSubmission {
  id: string;
  exam_id: string;
  exam_title: string;
  ai_score: number;
  final_score?: number;
  status: string;
  created_at: string;
  ai_feedback?: any;
}

export default function StudentClassDetailPage() {
  const params = useParams();
  const classId = (params?.classId || "cls_101") as string;
  const { user } = useAuth();

  const [activeTab, setActiveTab] = useState<"pending" | "graded" | "practice">("pending");
  const [classDetail, setClassDetail] = useState<UserClass | null>(null);
  const [assignedExams, setAssignedExams] = useState<AssignedExam[]>([]);
  const [gradedSubmissions, setGradedSubmissions] = useState<GradedSubmission[]>([]);
  const [practiceExams, setPracticeExams] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchLmsClassData = async () => {
      try {
        setLoading(true);
        // 1. Fetch Class Info
        const { data: clsData } = await supabase
          .from("classes")
          .select("*")
          .eq("id", classId)
          .maybeSingle();

        if (clsData) {
          setClassDetail(clsData);
        } else {
          setClassDetail({
            id: classId,
            name: "IELTS Master 7.5 - K24",
            code: "IELTS75K24",
            teacher_id: "teacher_01",
            schedule: "Thứ 2 - Thứ 4 - Thứ 6 (19:30 - 21:30)",
          });
        }

        // 2. Fetch Class Assignments from `class_assignments`
        const { data: assignRows } = await supabase
          .from("class_assignments")
          .select("*")
          .eq("class_id", classId);

        // Fetch Exam Details for assigned exams
        const { data: allExams } = await supabase
          .from("exams")
          .select("*")
          .order("created_at", { ascending: false });

        const examsMap: Record<string, any> = {};
        (allExams || []).forEach((e: any) => {
          examsMap[e.id] = e;
        });

        if (assignRows && assignRows.length > 0) {
          const list: AssignedExam[] = assignRows.map((a: any) => {
            const ex = examsMap[a.exam_id] || {};
            const dueDate = a.due_date ? new Date(a.due_date) : null;
            const isOverdue = dueDate ? dueDate.getTime() < Date.now() : false;
            return {
              id: a.exam_id,
              assignment_id: a.id,
              exam_id: a.exam_id,
              title: ex.title || "Bài Thi Được Giao",
              duration_minutes: ex.duration_minutes || 60,
              skills: ex.skills || ["Reading", "Writing", "Speaking"],
              due_date: a.due_date ? new Date(a.due_date).toLocaleDateString("vi-VN") : "Hạn linh hoạt",
              max_attempts: a.max_attempts || 1,
              isOverdue,
            };
          });
          setAssignedExams(list);
        } else {
          // Fallback starter assignments
          setAssignedExams([
            {
              id: "test_01",
              assignment_id: "asg_starter_01",
              exam_id: "test_01",
              title: "Đề Thi Thử IELTS Mock Test Standard #01",
              duration_minutes: 60,
              skills: ["Reading", "Listening", "Writing", "Speaking"],
              due_date: "25/08/2026",
              max_attempts: 2,
              isOverdue: false,
            },
            {
              id: "test_02",
              assignment_id: "asg_starter_02",
              exam_id: "test_02",
              title: "IELTS Academic Writing Task 2 & Speaking Challenge",
              duration_minutes: 45,
              skills: ["Writing", "Speaking"],
              due_date: "28/08/2026",
              max_attempts: 1,
              isOverdue: false,
            },
          ]);
        }

        // 3. Fetch Graded Submissions for this student & class
        const { data: subRows } = await supabase
          .from("submissions")
          .select("*")
          .eq("student_id", user?.id || "student_01")
          .order("created_at", { ascending: false });

        if (subRows && subRows.length > 0) {
          setGradedSubmissions(
            subRows.map((s: any) => ({
              id: s.id,
              exam_id: s.exam_id,
              exam_title: examsMap[s.exam_id]?.title || "Bài Thi IELTS Standard #01",
              ai_score: Number(s.ai_score || s.final_score || 7.0),
              final_score: s.final_score ? Number(s.final_score) : undefined,
              status: s.status || "AI_GRADED",
              created_at: new Date(s.created_at).toLocaleDateString("vi-VN"),
              ai_feedback: s.ai_feedback,
            }))
          );
        } else {
          setGradedSubmissions([
            {
              id: "sub_demo_01",
              exam_id: "test_01",
              exam_title: "Đề Thi Thử IELTS Mock Test Standard #01",
              ai_score: 7.5,
              final_score: 7.5,
              status: "TEACHER_REVIEWED",
              created_at: "18/07/2026",
            },
          ]);
        }

        // 4. Practice Bank Exams
        setPracticeExams(allExams || []);
      } catch (e) {
        console.error("LMS class data load error:", e);
      } finally {
        setLoading(false);
      }
    };

    fetchLmsClassData();
  }, [classId, user]);

  if (loading) {
    return (
      <StudentLayout>
        <div className="flex flex-col items-center justify-center p-12 bg-white rounded-2xl border border-[#d8c2b6] max-w-7xl mx-auto my-8">
          <Loader2 className="w-8 h-8 text-[#6d3807] animate-spin mb-2" />
          <p className="font-mono text-xs text-[#52443a]">Đang nạp hệ thống bài tập &amp; sổ điểm LMS...</p>
        </div>
      </StudentLayout>
    );
  }

  return (
    <StudentLayout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full space-y-8 font-sans text-[#211a16]">
        {/* Class Banner Header */}
        <div className="p-6 rounded-3xl bg-white border border-[#d8c2b6] shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center">
          <div>
            <div className="flex items-center space-x-2 text-xs font-mono text-[#6d3807] uppercase tracking-wider mb-2 font-bold">
              <BookOpen className="w-4 h-4 text-[#6d3807]" />
              <span>Modern LMS &bull; Student Class Assessment Center</span>
            </div>
            <h1 className="text-3xl font-bold font-headline text-[#211a16]">
              {classDetail?.name}
            </h1>
            <p className="text-sm text-[#52443a] mt-1">
              Giáo viên phụ trách: <span className="font-semibold text-[#6d3807]">Thầy Nguyễn Văn Đức (M.A TESOL)</span> &bull; Lịch học: {classDetail?.schedule}
            </p>
          </div>

          <div className="mt-4 md:mt-0">
            <span className="px-3.5 py-1.5 rounded-xl bg-[#fff1ea] text-[#6d3807] font-mono text-sm font-bold border border-[#ffb783]">
              Mã Lớp: {classDetail?.code}
            </span>
          </div>
        </div>

        {/* Modern LMS 3 Tabs Navigation */}
        <div className="flex border-b border-[#d8c2b6] space-x-2">
          <button
            onClick={() => setActiveTab("pending")}
            className={`px-5 py-3 rounded-t-2xl font-headline text-xs font-bold transition-all flex items-center space-x-2 cursor-pointer ${
              activeTab === "pending"
                ? "bg-[#6d3807] text-white shadow-sm"
                : "bg-white text-[#52443a] hover:bg-[#fff8f5] border-t border-x border-[#d8c2b6]"
            }`}
          >
            <AlertCircle className="w-4 h-4" />
            <span>1. Bài Thi Cần Làm Ngay ({assignedExams.length})</span>
          </button>

          <button
            onClick={() => setActiveTab("graded")}
            className={`px-5 py-3 rounded-t-2xl font-headline text-xs font-bold transition-all flex items-center space-x-2 cursor-pointer ${
              activeTab === "graded"
                ? "bg-[#6d3807] text-white shadow-sm"
                : "bg-white text-[#52443a] hover:bg-[#fff8f5] border-t border-x border-[#d8c2b6]"
            }`}
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>2. Bài Thi Đã Nộp &amp; Đã Chấm ({gradedSubmissions.length})</span>
          </button>

          <button
            onClick={() => setActiveTab("practice")}
            className={`px-5 py-3 rounded-t-2xl font-headline text-xs font-bold transition-all flex items-center space-x-2 cursor-pointer ${
              activeTab === "practice"
                ? "bg-[#6d3807] text-white shadow-sm"
                : "bg-white text-[#52443a] hover:bg-[#fff8f5] border-t border-x border-[#d8c2b6]"
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>3. Kho Đề Ôn Luyện Tự Do ({practiceExams.length})</span>
          </button>
        </div>

        {/* TAB 1: PENDING ASSIGNMENTS */}
        {activeTab === "pending" && (
          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold font-headline text-[#6d3807] flex items-center space-x-2">
                <FileText className="w-5 h-5 text-[#6d3807]" />
                <span>Nhiệm Vụ Bài Thi Giáo Viên Đã Giao Cho Lớp</span>
              </h2>
              <span className="text-xs text-[#857469] font-mono">
                Số lần làm bài tối đa: 1 - 2 lượt
              </span>
            </div>

            {assignedExams.length === 0 ? (
              <div className="p-8 text-center bg-white rounded-2xl border border-[#d8c2b6] space-y-2">
                <CheckCircle2 className="w-10 h-10 text-emerald-600 mx-auto" />
                <p className="text-sm font-bold text-[#211a16]">Tuyệt vời! Bạn đã hoàn thành tất cả bài thi trong lớp này.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {assignedExams.map((asg) => (
                  <div
                    key={asg.assignment_id}
                    className="bg-white p-6 rounded-2xl border-2 border-[#d8c2b6] shadow-sm hover:shadow-md transition-all flex flex-col md:flex-row justify-between items-start md:items-center gap-4"
                  >
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        {asg.isOverdue ? (
                          <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-bold bg-rose-100 text-rose-800 border border-rose-300">
                            🚨 Quá Hạn Nộp Bài
                          </span>
                        ) : (
                          <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-bold bg-amber-100 text-amber-900 border border-amber-300 flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5 text-amber-800" />
                            <span>Hạn Nộp: {asg.due_date}</span>
                          </span>
                        )}

                        {asg.skills.map((sk) => (
                          <span
                            key={sk}
                            className="px-2.5 py-0.5 rounded-full text-xs font-mono font-bold bg-[#fff1ea] text-[#6d3807] border border-[#ffb783]"
                          >
                            {sk}
                          </span>
                        ))}

                        <span className="text-xs font-mono text-[#857469]">
                          Thời lượng: <strong>{asg.duration_minutes} phút</strong>
                        </span>
                      </div>

                      <h3 className="text-lg font-bold font-headline text-[#211a16]">
                        {asg.title}
                      </h3>
                      <p className="text-xs text-[#52443a]">
                        Bài thi được giao chính thức cho lớp. AI sẽ tự động chấm điểm và chuyển bài cho Giáo viên duyệt kết quả.
                      </p>
                    </div>

                    <div className="shrink-0 w-full md:w-auto text-right">
                      <Link
                        href={`/student/exam/${asg.exam_id}`}
                        className="w-full md:w-auto px-6 py-3 bg-[#6d3807] hover:bg-[#8a4f1e] text-white text-xs font-bold rounded-xl transition-all shadow-md flex items-center justify-center space-x-2 font-headline uppercase tracking-wider"
                      >
                        <span>Vào Làm Bài Thi Ngay</span>
                        <ArrowRight className="w-4 h-4 text-[#ffb782]" />
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {/* TAB 2: GRADED SUBMISSIONS */}
        {activeTab === "graded" && (
          <section className="space-y-4">
            <h2 className="text-lg font-bold font-headline text-[#6d3807] flex items-center space-x-2">
              <Award className="w-5 h-5 text-[#6d3807]" />
              <span>Sổ Điểm &amp; Lịch Sử Bài Nộp Trong Lớp Học</span>
            </h2>

            <div className="space-y-4">
              {gradedSubmissions.map((sub) => (
                <div
                  key={sub.id}
                  className="bg-white p-6 rounded-2xl border border-[#d8c2b6] shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4"
                >
                  <div className="space-y-1.5">
                    <div className="flex items-center space-x-2">
                      <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-xs font-bold border border-emerald-300">
                        {sub.status === "TEACHER_REVIEWED" ? "✅ Đã Giáo Viên Review" : "⚡ Đã Chấm AI"}
                      </span>
                      <span className="text-xs font-mono text-[#857469]">Ngày nộp: {sub.created_at}</span>
                    </div>

                    <h3 className="text-base font-bold font-headline text-[#211a16]">
                      {sub.exam_title}
                    </h3>
                    <p className="text-xs text-[#52443a]">
                      Mã bài nộp: <strong className="font-mono text-[#6d3807]">{sub.id}</strong>
                    </p>
                  </div>

                  <div className="flex items-center space-x-4 shrink-0">
                    <div className="text-right">
                      <span className="text-[10px] font-mono text-[#857469] block uppercase">Band Score</span>
                      <span className="text-xl font-extrabold text-[#6d3807] font-headline">
                        Band {sub.final_score || sub.ai_score}
                      </span>
                    </div>

                    <Link
                      href={`/student/exam/review/${sub.id}`}
                      className="px-4 py-2.5 bg-[#fff8f5] hover:bg-[#fff1ea] text-[#6d3807] border border-[#d8c2b6] text-xs font-bold rounded-xl transition-all flex items-center space-x-1.5 font-headline"
                    >
                      <Eye className="w-4 h-4 text-[#6d3807]" />
                      <span>Xem Review Chi Tiết</span>
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* TAB 3: PRACTICE BANK */}
        {activeTab === "practice" && (
          <section className="space-y-4">
            <h2 className="text-lg font-bold font-headline text-[#6d3807] flex items-center space-x-2">
              <Sparkles className="w-5 h-5 text-[#6d3807]" />
              <span>Kho Đề Thi Mở Tự Ôn Luyện (Self-Study Practice Bank)</span>
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {practiceExams.map((ex) => (
                <div
                  key={ex.id}
                  className="bg-white p-5 rounded-2xl border border-[#d8c2b6] shadow-sm hover:shadow-md transition-all flex flex-col justify-between"
                >
                  <div className="space-y-2">
                    <div className="flex items-center space-x-2">
                      {(ex.skills || ["Reading"]).map((sk: string) => (
                        <span key={sk} className="px-2 py-0.5 bg-[#fff1ea] text-[#6d3807] text-[10px] font-bold rounded border border-[#ffb783]">
                          {sk}
                        </span>
                      ))}
                    </div>
                    <h3 className="font-bold text-sm text-[#211a16] font-headline">{ex.title}</h3>
                  </div>

                  <div className="pt-4 border-t border-[#d8c2b6]/40 mt-3 flex items-center justify-between">
                    <span className="text-xs text-[#857469] font-mono">{ex.duration_minutes || 60} Phút</span>
                    <Link
                      href={`/student/exam/${ex.id}`}
                      className="px-4 py-2 bg-[#6d3807] text-white text-xs font-bold rounded-xl hover:bg-[#8a4f1e] transition-all"
                    >
                      Thi Thử Tự Do
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </StudentLayout>
  );
}
