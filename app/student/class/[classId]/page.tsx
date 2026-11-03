"use client";

import { useState, useEffect } from "react";
import StudentLayout from "@/components/StudentLayout";
import Link from "next/link";
import { useParams } from "next/navigation";
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
  Layers,
  Eye,
  Route,
} from "lucide-react";
import StudentRoadmap from "@/components/class-roadmap/StudentRoadmap";
import { submissionScore, formatScore, SubmissionScoreResult } from "@/lib/score-display";

interface UserClass {
  id: string;
  name: string;
  code: string;
  schedule?: string;
}

interface AssignedExam {
  id: string;
  assignment_id: string;
  exam_id: string;
  title: string;
  duration_minutes: number;
  skills: string[];
  due_date: string;
  max_attempts: number;
  isOverdue: boolean;
  hasExam: boolean;
}

interface GradedSubmission {
  id: string;
  exam_id: string;
  exam_title: string;
  scoreInfo: SubmissionScoreResult;
  status: string;
  created_at: string;
  ai_feedback?: any;
}

interface PracticeExam {
  id: string;
  title: string;
  duration_minutes: number;
  skills: string[];
}

export default function StudentClassDetailPage() {
  const params = useParams();
  const classId = (params?.classId || "") as string;

  const [activeTab, setActiveTab] = useState<"roadmap" | "pending" | "graded" | "practice">("roadmap");
  const [classDetail, setClassDetail] = useState<UserClass | null>(null);
  const [assignedExams, setAssignedExams] = useState<AssignedExam[]>([]);
  const [gradedSubmissions, setGradedSubmissions] = useState<GradedSubmission[]>([]);
  const [practiceExams, setPracticeExams] = useState<PracticeExam[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState(false);
  const [notFound, setNotFound] = useState(false);

  const fetchClassData = async () => {
    if (!classId) return;
    setLoading(true);
    setError(null);
    setForbidden(false);
    setNotFound(false);

    try {
      const [classRes, examsRes] = await Promise.all([
        fetch(`/api/student/classes/${classId}`),
        fetch("/api/exams"),
      ]);

      if (classRes.status === 403) {
        setForbidden(true);
        return;
      }
      if (classRes.status === 404) {
        setNotFound(true);
        return;
      }

      if (!classRes.ok) {
        const j = await classRes.json().catch(() => ({}));
        throw new Error(j.error || "Không thể tải thông tin lớp học.");
      }

      const classJson = await classRes.json();
      if (!classJson.success) {
        throw new Error(classJson.error || "Không thể tải thông tin lớp học.");
      }

      setClassDetail(classJson.class);

      const list: AssignedExam[] = (classJson.assignments || []).map((a: any) => {
        const hasExam = a.exam !== null && a.exam !== undefined;
        const dueDate = a.due_date ? new Date(a.due_date) : null;
        const isOverdue = dueDate ? dueDate.getTime() < Date.now() : false;
        return {
          id: a.exam_id,
          assignment_id: a.id,
          exam_id: a.exam_id,
          title: hasExam ? a.exam.title : "Đề thi không còn tồn tại",
          duration_minutes: hasExam ? (a.exam.duration_minutes || 60) : 0,
          skills: hasExam ? (a.exam.skills ?? []) : [],
          due_date: a.due_date ? new Date(a.due_date).toLocaleDateString("vi-VN") : "Hạn linh hoạt",
          max_attempts: a.max_attempts || 1,
          isOverdue,
          hasExam,
        };
      });
      setAssignedExams(list);

      const examTitleMap: Record<string, string> = {};
      for (const a of (classJson.assignments || [])) {
        if (a.exam?.title) {
          examTitleMap[a.exam_id] = a.exam.title;
        }
      }

      const gradedList: GradedSubmission[] = (classJson.submissions || []).map((s: any) => {
        const scoreInfo = submissionScore(s);
        return {
          id: s.id,
          exam_id: s.exam_id,
          exam_title: examTitleMap[s.exam_id] || "Đề thi không còn tồn tại",
          scoreInfo,
          status: s.status || "AI_GRADED",
          created_at: s.created_at ? new Date(s.created_at).toLocaleDateString("vi-VN") : "",
          ai_feedback: s.ai_feedback,
        };
      });
      setGradedSubmissions(gradedList);

      if (examsRes.ok) {
        const examsJson = await examsRes.json().catch(() => ({}));
        if (examsJson.success) {
          setPracticeExams(examsJson.exams || []);
        }
      }
    } catch (e: any) {
      console.error("LMS class data load error:", e);
      setError(e.message || "Đã xảy ra lỗi khi tải dữ liệu lớp học.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchClassData();
  }, [classId]);

  if (loading) {
    return (
      <StudentLayout>
        <div className="flex flex-col items-center justify-center p-12 bg-white rounded-2xl border border-line max-w-7xl mx-auto my-8">
          <Loader2 className="w-8 h-8 text-brand-600 animate-spin mb-2" />
          <p className="font-mono text-xs text-ink-muted">Đang nạp hệ thống bài tập &amp; sổ điểm LMS...</p>
        </div>
      </StudentLayout>
    );
  }

  if (forbidden) {
    return (
      <StudentLayout>
        <div className="max-w-2xl mx-auto my-12 p-8 bg-white rounded-2xl border border-amber-200 text-center space-y-4">
          <AlertCircle className="w-12 h-12 text-amber-600 mx-auto" />
          <h2 className="text-xl font-bold font-headline text-ink">
            Bạn chưa tham gia lớp học này.
          </h2>
          <p className="text-sm text-ink-muted">
            Vui lòng kiểm tra lại mã lớp hoặc tham gia lớp học từ Dashboard.
          </p>
          <Link
            href="/student/dashboard"
            className="inline-block px-6 py-2.5 bg-brand-600 hover:bg-brand-700 text-white text-xs font-bold rounded-xl transition-all shadow-sm"
          >
            Quay lại Dashboard
          </Link>
        </div>
      </StudentLayout>
    );
  }

  if (notFound) {
    return (
      <StudentLayout>
        <div className="max-w-2xl mx-auto my-12 p-8 bg-white rounded-2xl border border-red-200 text-center space-y-4">
          <AlertCircle className="w-12 h-12 text-red-600 mx-auto" />
          <h2 className="text-xl font-bold font-headline text-ink">
            Không tìm thấy lớp học.
          </h2>
          <p className="text-sm text-ink-muted">
            Lớp học này không tồn tại hoặc đã bị xoá.
          </p>
          <Link
            href="/student/dashboard"
            className="inline-block px-6 py-2.5 bg-brand-600 hover:bg-brand-700 text-white text-xs font-bold rounded-xl transition-all shadow-sm"
          >
            Quay lại Dashboard
          </Link>
        </div>
      </StudentLayout>
    );
  }

  return (
    <StudentLayout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full space-y-8 font-sans text-ink">
        {/* Global Error Banner */}
        {error && (
          <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-center space-x-2">
              <AlertCircle className="w-5 h-5 text-red-600 shrink-0" />
              <span className="text-sm font-semibold">{error}</span>
            </div>
            <button
              onClick={fetchClassData}
              className="px-4 py-1.5 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-lg transition-colors cursor-pointer shrink-0"
            >
              Thử lại
            </button>
          </div>
        )}

        {/* Class Banner Header */}
        <div className="p-6 rounded-3xl bg-white border border-line shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center">
          <div>
            <div className="flex items-center space-x-2 text-xs font-mono text-brand-600 uppercase tracking-wider mb-2 font-bold">
              <BookOpen className="w-4 h-4 text-brand-600" />
              <span>Modern LMS &bull; Student Class Assessment Center</span>
            </div>
            <h1 className="text-3xl font-bold font-headline text-ink">
              {classDetail?.name}
            </h1>
            {classDetail?.schedule && (
              <p className="text-sm text-ink-muted mt-1">
                Lịch học: <span className="font-semibold text-brand-600">{classDetail.schedule}</span>
              </p>
            )}
          </div>

          <div className="mt-4 md:mt-0">
            <span className="px-3.5 py-1.5 rounded-xl bg-brand-50 text-brand-600 font-mono text-sm font-bold border border-brand-300">
              Mã Lớp: {classDetail?.code}
            </span>
          </div>
        </div>

        {/* Modern LMS Tabs Navigation */}
        <div className="flex border-b border-line space-x-2">
          <button
            onClick={() => setActiveTab("roadmap")}
            className={`px-5 py-3 rounded-t-2xl font-headline text-xs font-bold transition-all flex items-center space-x-2 cursor-pointer ${
              activeTab === "roadmap"
                ? "bg-brand-600 text-white shadow-sm"
                : "bg-white text-ink-muted hover:bg-surface-alt border-t border-x border-line"
            }`}
          >
            <Route className="w-4 h-4" />
            <span>Lộ trình</span>
          </button>

          <button
            onClick={() => setActiveTab("pending")}
            className={`px-5 py-3 rounded-t-2xl font-headline text-xs font-bold transition-all flex items-center space-x-2 cursor-pointer ${
              activeTab === "pending"
                ? "bg-brand-600 text-white shadow-sm"
                : "bg-white text-ink-muted hover:bg-surface-alt border-t border-x border-line"
            }`}
          >
            <AlertCircle className="w-4 h-4" />
            <span>1. Bài Thi Cần Làm Ngay ({assignedExams.length})</span>
          </button>

          <button
            onClick={() => setActiveTab("graded")}
            className={`px-5 py-3 rounded-t-2xl font-headline text-xs font-bold transition-all flex items-center space-x-2 cursor-pointer ${
              activeTab === "graded"
                ? "bg-brand-600 text-white shadow-sm"
                : "bg-white text-ink-muted hover:bg-surface-alt border-t border-x border-line"
            }`}
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>2. Bài Thi Đã Nộp &amp; Đã Chấm ({gradedSubmissions.length})</span>
          </button>

          <button
            onClick={() => setActiveTab("practice")}
            className={`px-5 py-3 rounded-t-2xl font-headline text-xs font-bold transition-all flex items-center space-x-2 cursor-pointer ${
              activeTab === "practice"
                ? "bg-brand-600 text-white shadow-sm"
                : "bg-white text-ink-muted hover:bg-surface-alt border-t border-x border-line"
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>3. Kho Đề Ôn Luyện Tự Do ({practiceExams.length})</span>
          </button>
        </div>

        {/* TAB 0: ROADMAP */}
        {activeTab === "roadmap" && (
          <StudentRoadmap classId={classId} />
        )}

        {/* TAB 1: PENDING ASSIGNMENTS */}
        {activeTab === "pending" && (
          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold font-headline text-brand-600 flex items-center space-x-2">
                <FileText className="w-5 h-5 text-brand-600" />
                <span>Nhiệm Vụ Bài Thi Giáo Viên Đã Giao Cho Lớp</span>
              </h2>
              <span className="text-xs text-ink-subtle font-mono">
                Số lần làm bài tối đa: 1 - 2 lượt
              </span>
            </div>

            {assignedExams.length === 0 ? (
              <div className="p-8 text-center bg-white rounded-2xl border border-line space-y-2">
                <CheckCircle2 className="w-10 h-10 text-emerald-600 mx-auto" />
                <p className="text-sm font-bold text-ink">Giáo viên chưa giao bài nào cho lớp này.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {assignedExams.map((asg) => (
                  <div
                    key={asg.assignment_id}
                    className="bg-white p-6 rounded-2xl border-2 border-line shadow-sm hover:shadow-md transition-all flex flex-col md:flex-row justify-between items-start md:items-center gap-4"
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
                            className="px-2.5 py-0.5 rounded-full text-xs font-mono font-bold bg-brand-50 text-brand-600 border border-brand-300"
                          >
                            {sk}
                          </span>
                        ))}

                        <span className="text-xs font-mono text-ink-subtle">
                          Thời lượng: <strong>{asg.duration_minutes} phút</strong>
                        </span>
                      </div>

                      <h3 className="text-lg font-bold font-headline text-ink">
                        {asg.title}
                      </h3>
                      <p className="text-xs text-ink-muted">
                        Bài thi được giao chính thức cho lớp. AI sẽ tự động chấm điểm và chuyển bài cho Giáo viên duyệt kết quả.
                      </p>
                    </div>

                    <div className="shrink-0 w-full md:w-auto text-right">
                      {asg.hasExam ? (
                        <Link
                          href={`/student/exam/${asg.exam_id}`}
                          className="w-full md:w-auto px-6 py-3 bg-brand-600 hover:bg-brand-700 text-white text-xs font-bold rounded-xl transition-all shadow-md flex items-center justify-center space-x-2 font-headline uppercase tracking-wider"
                        >
                          <span>Vào Làm Bài Thi Ngay</span>
                          <ArrowRight className="w-4 h-4 text-white" />
                        </Link>
                      ) : (
                        <span className="text-xs font-mono text-ink-subtle italic">
                          Đề thi không khả dụng
                        </span>
                      )}
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
            <h2 className="text-lg font-bold font-headline text-brand-600 flex items-center space-x-2">
              <Award className="w-5 h-5 text-brand-600" />
              <span>Sổ Điểm &amp; Lịch Sử Bài Nộp Trong Lớp Học</span>
            </h2>

            {gradedSubmissions.length === 0 ? (
              <div className="p-8 text-center bg-white rounded-2xl border border-line space-y-2">
                <CheckCircle2 className="w-10 h-10 text-emerald-600 mx-auto" />
                <p className="text-sm font-bold text-ink">Bạn chưa có bài nào được chấm.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {gradedSubmissions.map((sub) => {
                  const formatted = formatScore(sub.scoreInfo);
                  const scoreDisplay =
                    sub.scoreInfo.value != null
                      ? sub.scoreInfo.standard_name
                        ? `${formatted} (${sub.scoreInfo.standard_name})`
                        : formatted
                      : sub.scoreInfo.status === "GRADING"
                      ? "Đang chấm"
                      : sub.scoreInfo.status === "NEEDS_REVIEW"
                      ? "Chờ giáo viên chấm"
                      : "Chưa chấm";

                  const statusBadgeLabel =
                    sub.scoreInfo.status === "GRADING"
                      ? "⚡ Đang Chấm"
                      : sub.scoreInfo.status === "NEEDS_REVIEW"
                      ? "⏳ Chờ giáo viên chấm"
                      : sub.status === "TEACHER_REVIEWED"
                      ? "✅ Đã Giáo Viên Review"
                      : sub.status === "GRADED"
                      ? "✅ Đã Chấm"
                      : "⚡ Đã Chấm AI";

                  return (
                    <div
                      key={sub.id}
                      className="bg-white p-6 rounded-2xl border border-line shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4"
                    >
                      <div className="space-y-1.5">
                        <div className="flex items-center space-x-2">
                          <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-xs font-bold border border-emerald-300">
                            {statusBadgeLabel}
                          </span>
                          <span className="text-xs font-mono text-ink-subtle">Ngày nộp: {sub.created_at}</span>
                        </div>

                        <h3 className="text-base font-bold font-headline text-ink">
                          {sub.exam_title}
                        </h3>
                        <p className="text-xs text-ink-muted">
                          Mã bài nộp: <strong className="font-mono text-brand-600">{sub.id}</strong>
                        </p>
                      </div>

                      <div className="flex items-center space-x-4 shrink-0">
                        <div className="text-right">
                          <span className="text-[10px] font-mono text-ink-subtle block uppercase">
                            {sub.scoreInfo.standard_name ? sub.scoreInfo.standard_name : "Điểm Số"}
                          </span>
                          <span className="text-xl font-extrabold text-brand-600 font-headline">
                            {scoreDisplay}
                          </span>
                        </div>

                        <Link
                          href={`/student/exam/review/${sub.id}`}
                          className="px-4 py-2.5 bg-surface-alt hover:bg-brand-50 text-brand-600 border border-line text-xs font-bold rounded-xl transition-all flex items-center space-x-1.5 font-headline"
                        >
                          <Eye className="w-4 h-4 text-brand-600" />
                          <span>Xem Review Chi Tiết</span>
                        </Link>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        )}

        {/* TAB 3: PRACTICE BANK */}
        {activeTab === "practice" && (
          <section className="space-y-4">
            <h2 className="text-lg font-bold font-headline text-brand-600 flex items-center space-x-2">
              <Sparkles className="w-5 h-5 text-brand-600" />
              <span>Kho Đề Thi Mở Tự Ôn Luyện (Self-Study Practice Bank)</span>
            </h2>

            {practiceExams.length === 0 ? (
              <div className="p-8 text-center bg-white rounded-2xl border border-line space-y-2">
                <p className="text-sm font-bold text-ink">Chưa có đề thi luyện tập nào.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {practiceExams.map((ex) => (
                  <div
                    key={ex.id}
                    className="bg-white p-5 rounded-2xl border border-line shadow-sm hover:shadow-md transition-all flex flex-col justify-between"
                  >
                    <div className="space-y-2">
                      <div className="flex items-center space-x-2">
                        {(ex.skills || []).map((sk: string) => (
                          <span key={sk} className="px-2 py-0.5 bg-brand-50 text-brand-600 text-[10px] font-bold rounded border border-brand-300">
                            {sk}
                          </span>
                        ))}
                      </div>
                      <h3 className="font-bold text-sm text-ink font-headline">{ex.title}</h3>
                    </div>

                    <div className="pt-4 border-t border-line/40 mt-3 flex items-center justify-between">
                      <span className="text-xs text-ink-subtle font-mono">{ex.duration_minutes || 60} Phút</span>
                      <Link
                        href={`/student/exam/${ex.id}`}
                        className="px-4 py-2 bg-brand-600 text-white text-xs font-bold rounded-xl hover:bg-brand-700 transition-all"
                      >
                        Thi Thử Tự Do
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}
      </div>
    </StudentLayout>
  );
}
