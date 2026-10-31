"use client";

import { useState, useEffect } from "react";
import TeacherLayout from "@/components/TeacherLayout";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import {
  BookOpen,
  UserPlus,
  Users,
  ArrowLeft,
  Loader2,
  CheckCircle2,
  X,
  Save,
  Copy,
  PlusCircle,
  FileText,
  Award,
  Edit3,
  Eye,
  Trash2,
  Volume2,
  Send,
  Route,
  AlertCircle,
  RefreshCw,
  KeyRound,
} from "lucide-react";
import TeacherClassRoadmap from "@/components/class-roadmap/TeacherClassRoadmap";

interface ClassDetail {
  id: string;
  name: string;
  code: string;
  teacher_id: string;
  schedule: string;
  description: string;
  max_slots: number;
}

interface StudentInClass {
  id: string;
  name: string;
  email: string;
  username?: string;
  phone?: string;
  status?: string;
  submission_count?: number;
  latest_total?: number | null;
}

interface AssignedExamItem {
  id: string;
  assignment_id: string;
  exam_id: string;
  title: string;
  duration_minutes: number;
  skills: string[];
  due_date?: string;
  max_attempts: number;
}

export default function TeacherClassDetailPage() {
  const params = useParams();
  const classId = (params?.classId || "cls_101") as string;
  const { user } = useAuth();

  const [activeTab, setActiveTab] = useState<"gradebook" | "students" | "roadmap">("gradebook");
  const [cls, setCls] = useState<ClassDetail | null>(null);
  const [students, setStudents] = useState<StudentInClass[]>([]);
  const [assignedExams, setAssignedExams] = useState<AssignedExamItem[]>([]);
  const [allExamsRepo, setAllExamsRepo] = useState<any[]>([]);
  const [submissionsMap, setSubmissionsMap] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [copiedCode, setCopiedCode] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [newStudentTempPassword, setNewStudentTempPassword] = useState<{ name: string; password: string } | null>(null);

  // Assign Exam Modal State
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [selectedExamId, setSelectedExamId] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [maxAttempts, setMaxAttempts] = useState("1");

  // Create Student Modal State
  const [showCreateStudentModal, setShowCreateStudentModal] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");

  // Exam Preview Modal State
  const [previewExam, setPreviewExam] = useState<any | null>(null);

  // Live Submission Review Modal State
  const [selectedSubmission, setSelectedSubmission] = useState<any | null>(null);
  const [reviewStudentName, setReviewStudentName] = useState("");
  const [reviewExamTitle, setReviewExamTitle] = useState("");
  const [overrideScore, setOverrideScore] = useState<number>(7.5);
  const [teacherNote, setTeacherNote] = useState("");
  const [isSavingReview, setIsSavingReview] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchClassData = async () => {
    try {
      setLoading(true);
      setErrorMessage(null);

      // 1. Fetch Class Detail from API
      const classRes = await fetch(`/api/teacher/classes/${classId}`);
      if (!classRes.ok) {
        const errData = await classRes.json().catch(() => ({}));
        throw new Error(errData.error || "Không thể tải thông tin lớp học.");
      }
      const classData = await classRes.json();
      if (classData.class) {
        setCls({
          id: classData.class.id,
          name: classData.class.name,
          code: classData.class.code,
          teacher_id: classData.class.teacher_id,
          schedule: classData.class.schedule || "Thứ 2 - Thứ 4 - Thứ 6 (18:00 - 20:00)",
          description: classData.class.description || "Lớp luyện thi IELTS chuyên sâu target 7.5+",
          max_slots: classData.class.max_slots || 30,
        });
      }

      // 2. Fetch Members (Students & Assignments) from API
      const membersRes = await fetch(`/api/teacher/classes/${classId}/members`);
      if (!membersRes.ok) {
        const errData = await membersRes.json().catch(() => ({}));
        throw new Error(errData.error || "Không thể tải danh sách thành viên.");
      }
      const membersData = await membersRes.json();

      setStudents(
        (membersData.students || []).map((u: any) => ({
          id: u.id,
          name: u.name,
          email: u.email,
          username: u.id,
          phone: u.phone || "",
          status: u.status || "ACTIVE",
          submission_count: u.submission_count ?? 0,
          latest_total: u.latest_total ?? null,
        }))
      );

      // 3. Fetch All Exams from Repository
      const examsRes = await fetch("/api/teacher/exams");
      let examDict: Record<string, any> = {};
      if (examsRes.ok) {
        const examsData = await examsRes.json();
        const exList = examsData.exams || [];
        setAllExamsRepo(exList);
        exList.forEach((ex: any) => {
          examDict[ex.id] = ex;
        });
      }

      if (membersData.assignments && membersData.assignments.length > 0) {
        setAssignedExams(
          membersData.assignments.map((a: any) => {
            const exInfo = examDict[a.exam_id] || {};
            return {
              id: a.exam_id,
              assignment_id: a.id,
              exam_id: a.exam_id,
              title: a.exam_title || exInfo.title || `Đề Thi #${a.exam_id}`,
              duration_minutes: exInfo.duration_minutes || 60,
              skills: exInfo.skills || ["Reading", "Writing", "Speaking"],
              due_date: a.due_date ? new Date(a.due_date).toLocaleDateString("vi-VN") : "Linh hoạt",
              max_attempts: a.max_attempts || 1,
            };
          })
        );
      } else {
        setAssignedExams([]);
      }
    } catch (e: any) {
      console.error(e);
      setErrorMessage(e.message || "Lỗi tải dữ liệu lớp học.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchClassData();
  }, [classId]);

  // Assign exam to class via API
  const handleAssignExamToClass = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedExamId) return;

    setIsSubmitting(true);
    try {
      const dueTimestamp = dueDate ? new Date(dueDate).toISOString() : new Date(Date.now() + 7 * 86400000).toISOString();

      const res = await fetch(`/api/teacher/classes/${classId}/assignments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          exam_id: selectedExamId,
          due_date: dueTimestamp,
          max_attempts: Number(maxAttempts) || 1,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        alert("Lỗi giao bài thi: " + (data.error || "Không thể giao bài"));
        return;
      }

      setSuccessMsg("Đã giao bài thi thành công vào lớp!");
      setShowAssignModal(false);
      setSelectedExamId("");
      fetchClassData();
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err: any) {
      console.error(err);
      alert("Lỗi giao bài thi: " + (err.message || err));
    } finally {
      setIsSubmitting(false);
    }
  };

  // Delete assigned exam via API
  const handleUnassignExam = async (assignmentId: string, examTitle: string) => {
    if (!confirm(`Bạn có chắc chắn muốn hủy giao bài thi "${examTitle}" khỏi lớp này không?`)) return;

    try {
      const res = await fetch(`/api/teacher/classes/${classId}/assignments?id=${assignmentId}`, {
        method: "DELETE",
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        alert("Lỗi hủy giao bài thi: " + (data.error || "Không thể hủy"));
        return;
      }

      setSuccessMsg(`Đã hủy giao bài thi "${examTitle}" thành công!`);
      fetchClassData();
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err: any) {
      console.error(err);
      alert("Lỗi hủy giao bài thi: " + (err.message || err));
    }
  };

  // Create student / enroll in class via API
  const handleCreateStudentForThisClass = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim()) return;

    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/teacher/classes/${classId}/students`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          phone: phone.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        alert("Lỗi thêm học sinh: " + (data.error || "Không thể thêm vào lớp"));
        return;
      }

      if (data.temp_password) {
        setNewStudentTempPassword({ name: name.trim(), password: data.temp_password });
        setSuccessMsg(
          `Đã tạo tài khoản học sinh "${name}" thành công! Mật khẩu tạm thời: "${data.temp_password}". Vui lòng lưu lại mật khẩu này.`
        );
      } else {
        setSuccessMsg(`Học sinh "${name}" (${email}) đã có tài khoản và đã được ghi danh vào lớp!`);
      }

      setShowCreateStudentModal(false);
      setName("");
      setEmail("");
      setPhone("");
      fetchClassData();
    } catch (e: any) {
      console.error(e);
      alert("Đã xảy ra lỗi khi thêm học sinh: " + e.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const openPreviewExamModal = (examId: string) => {
    const found = allExamsRepo.find((ex) => ex.id === examId);
    if (found) {
      setPreviewExam(found);
    } else {
      alert("Không tìm thấy thông tin đề thi.");
    }
  };

  const openSubmissionReviewModal = (student: StudentInClass, exam: AssignedExamItem, sub: any) => {
    setReviewStudentName(student.name);
    setReviewExamTitle(exam.title);
    setSelectedSubmission(sub);
    setOverrideScore(Number(sub?.final_score || sub?.score || sub?.ai_score || 7.5));
    setTeacherNote(sub?.teacher_review?.teacher_note || sub?.ai_feedback?.teacher_note || "");
  };

  const handleSaveTeacherReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSubmission) return;

    setIsSavingReview(true);
    try {
      const res = await fetch("/api/exam/grade-override", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          submissionId: selectedSubmission.id,
          feedback: teacherNote.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        alert("Lỗi lưu nhận xét: " + (data.error || "Không thể cập nhật"));
        return;
      }

      setSuccessMsg("Đã phê duyệt & lưu điểm cho học viên thành công!");
      setSelectedSubmission(null);
      fetchClassData();
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err: any) {
      console.error(err);
      alert("Lỗi lưu nhận xét: " + err.message);
    } finally {
      setIsSavingReview(false);
    }
  };

  const copyInviteLink = () => {
    if (!cls) return;
    navigator.clipboard.writeText(`http://localhost:3000/login?code=${cls.code}`);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 3000);
  };

  if (loading) {
    return (
      <TeacherLayout>
        <div className="flex items-center space-x-2 text-xs text-[#52443a] p-12 bg-white rounded-2xl border border-[#d8c2b6] max-w-4xl mx-auto my-8">
          <Loader2 className="w-4 h-4 animate-spin text-[#6d3807]" />
          <span>Đang nạp dữ liệu Lớp học &amp; Sổ điểm Gradebook từ API PostgreSQL...</span>
        </div>
      </TeacherLayout>
    );
  }

  return (
    <TeacherLayout>
      <div className="max-w-[1280px] mx-auto space-y-8 font-sans text-[#211a16]">
        {/* Top Header Navigation */}
        <div className="border-b border-[#d8c2b6]/40 pb-6 flex flex-col md:flex-row justify-between md:items-center gap-4">
          <div>
            <Link href="/teacher/classes" className="text-xs text-[#6d3807] hover:underline flex items-center mb-2 font-medium">
              <ArrowLeft className="w-4 h-4 mr-1 text-[#6d3807]" />
              Quay lại Danh sách Lớp học
            </Link>
            <div className="flex items-center space-x-3">
              <h1 className="font-headline text-3xl font-bold text-[#211a16] tracking-tight">{cls?.name}</h1>
              <span className="px-2.5 py-1 bg-[#fff1ea] text-[#6d3807] border border-[#ffb782] text-xs font-bold rounded-lg font-mono">
                Mã: {cls?.code}
              </span>
            </div>
            <p className="text-xs text-[#52443a] mt-1 flex items-center gap-4">
              <span>{cls?.description}</span>
              <span className="text-[#857469] font-mono">&bull; {cls?.schedule}</span>
            </p>
          </div>

          <div className="flex items-center space-x-2 shrink-0">
            <button
              onClick={copyInviteLink}
              className="px-4 py-2 bg-white border border-[#d8c2b6] hover:bg-[#fff8f5] text-[#6d3807] rounded-xl text-xs font-bold flex items-center space-x-1.5 transition-all shadow-xs cursor-pointer font-headline"
            >
              {copiedCode ? <CheckCircle2 className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4 text-[#6d3807]" />}
              <span>{copiedCode ? "Đã copy link mời!" : "Copy Link Mời Lớp"}</span>
            </button>

            <button
              onClick={() => setShowCreateStudentModal(true)}
              className="px-4 py-2 bg-[#6d3807] hover:bg-[#8a4f1e] text-white rounded-xl text-xs font-bold flex items-center space-x-1.5 transition-all shadow-xs cursor-pointer font-headline"
            >
              <UserPlus className="w-4 h-4 text-[#ffb782]" />
              <span>+ Thêm Học Viên</span>
            </button>
          </div>
        </div>

        {/* Error Notification with Retry */}
        {errorMessage && (
          <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
              <span className="text-xs font-bold">{errorMessage}</span>
            </div>
            <button
              onClick={fetchClassData}
              className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold flex items-center space-x-1 cursor-pointer transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Thử lại</span>
            </button>
          </div>
        )}

        {/* Success / Notification Banner */}
        {successMsg && (
          <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
              <span className="text-xs font-bold">{successMsg}</span>
            </div>
            <button onClick={() => setSuccessMsg(null)} className="text-emerald-700 hover:text-emerald-900 cursor-pointer text-xs font-bold">
              ✕
            </button>
          </div>
        )}

        {/* New Student Password Modal/Banner One-time Display */}
        {newStudentTempPassword && (
          <div className="p-5 rounded-2xl bg-amber-50 border-2 border-amber-300 text-amber-950 space-y-2">
            <div className="flex items-center space-x-2">
              <KeyRound className="w-5 h-5 text-amber-700 shrink-0" />
              <span className="text-xs font-bold uppercase tracking-wider">
                Mật Khẩu Tạm Thời Khởi Tạo Cho Học Sinh (Chỉ Hiện 1 Lần)
              </span>
            </div>
            <p className="text-xs">
              Học sinh: <strong>{newStudentTempPassword.name}</strong> &bull; Mật khẩu đăng nhập lần đầu:{" "}
              <code className="px-2 py-0.5 bg-white border border-amber-300 rounded font-mono font-bold text-sm text-[#6d3807]">
                {newStudentTempPassword.password}
              </code>
            </p>
            <p className="text-[11px] text-amber-800 italic">
              Vui lòng copy hoặc gửi lại cho học sinh ngay. Hệ thống không lưu trữ mật khẩu ở dạng thô và sẽ yêu cầu học sinh đổi mật khẩu trong lần đăng nhập đầu tiên.
            </p>
            <button
              onClick={() => setNewStudentTempPassword(null)}
              className="mt-1 px-3 py-1 bg-amber-200 hover:bg-amber-300 rounded-lg text-xs font-bold text-amber-900 cursor-pointer"
            >
              Đã ghi lại
            </button>
          </div>
        )}

        {/* Tab Navigation Controls */}
        <div className="flex space-x-2 border-b border-[#d8c2b6]/40">
          <button
            onClick={() => setActiveTab("gradebook")}
            className={`px-5 py-3 rounded-t-2xl font-headline text-xs font-bold transition-all flex items-center space-x-2 cursor-pointer ${
              activeTab === "gradebook"
                ? "bg-[#6d3807] text-white shadow-sm"
                : "bg-white text-[#52443a] hover:bg-[#fff8f5] border-t border-x border-[#d8c2b6]"
            }`}
          >
            <Award className="w-4 h-4" />
            <span>1. Sổ Điểm Bài Thi &amp; Quản Lý Bài Tập (Gradebook Matrix)</span>
          </button>

          <button
            onClick={() => setActiveTab("students")}
            className={`px-5 py-3 rounded-t-2xl font-headline text-xs font-bold transition-all flex items-center space-x-2 cursor-pointer ${
              activeTab === "students"
                ? "bg-[#6d3807] text-white shadow-sm"
                : "bg-white text-[#52443a] hover:bg-[#fff8f5] border-t border-x border-[#d8c2b6]"
            }`}
          >
            <Users className="w-4 h-4" />
            <span>2. Danh Sách Học Viên Trong Lớp ({students.length})</span>
          </button>

          <button
            onClick={() => setActiveTab("roadmap")}
            className={`px-5 py-3 rounded-t-2xl font-headline text-xs font-bold transition-all flex items-center space-x-2 cursor-pointer ${
              activeTab === "roadmap"
                ? "bg-[#6d3807] text-white shadow-sm"
                : "bg-white text-[#52443a] hover:bg-[#fff8f5] border-t border-x border-[#d8c2b6]"
            }`}
          >
            <Route className="w-4 h-4" />
            <span>3. Lộ trình &amp; Mở bài</span>
          </button>
        </div>

        {/* TAB 1: GRADEBOOK MATRIX WITH EXAM ACTION CONTROLS */}
        {activeTab === "gradebook" && (
          <div className="bg-white rounded-3xl border border-[#d8c2b6] shadow-sm overflow-hidden p-6 space-y-6">
            <div className="flex justify-between items-center border-b border-[#d8c2b6]/40 pb-4">
              <div>
                <h2 className="text-lg font-bold text-[#6d3807] flex items-center space-x-2 font-headline">
                  <Award className="w-5 h-5 text-[#6d3807]" />
                  <span>Ma Trận Sổ Điểm Lớp Học (Class Gradebook Matrix)</span>
                </h2>
                <p className="text-xs text-[#52443a] mt-0.5">
                  Dữ liệu bài tập &amp; học viên được đồng bộ trực tiếp qua API PostgreSQL.
                </p>
              </div>

              <button
                onClick={() => setShowAssignModal(true)}
                className="px-4 py-2 bg-[#6d3807] text-white rounded-xl text-xs font-bold hover:bg-[#8a4f1e] transition-all flex items-center space-x-1.5 font-headline cursor-pointer"
              >
                <PlusCircle className="w-4 h-4 text-[#ffb782]" />
                <span>+ Giao Bài Thi Mới</span>
              </button>
            </div>

            {assignedExams.length === 0 ? (
              <div className="p-12 text-center bg-[#fff8f5] rounded-2xl border border-[#d8c2b6] space-y-3">
                <FileText className="w-12 h-12 text-[#6d3807] mx-auto opacity-40" />
                <p className="text-xs text-[#52443a]">Lớp học này chưa được giao bài thi nào. Nhấp nút <strong>"+ Giao Bài Thi Mới"</strong> ở trên để giao bài vào CSDL.</p>
              </div>
            ) : (
              /* Matrix Table */
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-[#fff8f5] border-b border-[#d8c2b6] text-[#52443a]">
                      <th className="p-3.5 font-bold border-r border-[#d8c2b6]/40 min-w-[200px]">Học Viên</th>
                      {assignedExams.map((ex) => (
                        <th key={ex.assignment_id} className="p-3.5 font-bold text-center border-r border-[#d8c2b6]/40 min-w-[220px]">
                          <div className="font-headline text-xs font-bold text-[#211a16] truncate max-w-[200px] mx-auto">
                            {ex.title}
                          </div>
                          <div className="text-[10px] font-mono text-[#857469] mt-0.5">
                            Hạn: {ex.due_date} ({ex.duration_minutes} phút)
                          </div>

                          {/* 1-Click Action Controls for Assigned Exams */}
                          <div className="flex items-center justify-center space-x-1 mt-2 pt-2 border-t border-[#d8c2b6]/40">
                            <button
                              onClick={() => openPreviewExamModal(ex.exam_id)}
                              className="px-2 py-1 bg-white border border-[#d8c2b6] hover:bg-[#fff1ea] text-[#6d3807] rounded text-[10px] font-bold flex items-center space-x-1 transition-all cursor-pointer"
                              title="Xem Nhanh Nội Dung Đề Thi"
                            >
                              <Eye className="w-3 h-3" />
                              <span>Xem Đề</span>
                            </button>

                            <Link
                              href={`/teacher/tests/create?editId=${ex.exam_id}`}
                              className="px-2 py-1 bg-white border border-[#d8c2b6] hover:bg-[#fff1ea] text-[#6d3807] rounded text-[10px] font-bold flex items-center space-x-1 transition-all cursor-pointer"
                              title="Sửa Đề Thi Trong Exam Builder"
                            >
                              <Edit3 className="w-3 h-3" />
                              <span>Sửa Đề</span>
                            </Link>

                            <button
                              onClick={() => handleUnassignExam(ex.assignment_id, ex.title)}
                              className="p-1 bg-white border border-rose-200 hover:bg-rose-50 text-rose-600 rounded text-[10px] transition-all cursor-pointer"
                              title="Hủy Giao Đề Thi Khỏi Lớp"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#d8c2b6]/30">
                    {students.length === 0 ? (
                      <tr>
                        <td colSpan={assignedExams.length + 1} className="p-8 text-center text-xs text-[#857469]">
                          Chưa có học sinh nào được gán vào lớp học này. Vui lòng chuyển sang Tab "Danh Sách Học Viên" để thêm.
                        </td>
                      </tr>
                    ) : (
                      students.map((st) => (
                        <tr key={st.id} className="hover:bg-[#fff8f5] transition-colors">
                          <td className="p-3.5 border-r border-[#d8c2b6]/40">
                            <div className="font-bold text-[#211a16]">{st.name}</div>
                            <div className="text-[10px] font-mono text-[#857469]">{st.email}</div>
                          </td>

                          {assignedExams.map((ex) => {
                            const subKey = `${st.id}_${ex.exam_id}`;
                            const sub = submissionsMap[subKey];

                            return (
                              <td key={ex.assignment_id} className="p-3.5 text-center border-r border-[#d8c2b6]/40">
                                {sub ? (
                                  <div className="space-y-1">
                                    <span className={`inline-block px-2.5 py-1 rounded-full font-mono text-[11px] font-bold ${
                                      sub.status === "TEACHER_REVIEWED"
                                        ? "bg-emerald-100 text-emerald-900 border border-emerald-300"
                                        : "bg-purple-100 text-purple-900 border border-purple-300"
                                    }`}>
                                      Band {sub.score || sub.final_score || sub.ai_score || 7.5}
                                    </span>

                                    <button
                                      onClick={() => openSubmissionReviewModal(st, ex, sub)}
                                      className="block w-full text-[10px] text-[#6d3807] font-bold hover:underline cursor-pointer"
                                    >
                                      Review &amp; Duyệt &rarr;
                                    </button>
                                  </div>
                                ) : st.latest_total !== null && st.latest_total !== undefined ? (
                                  <span className="inline-block px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 font-mono text-[11px] font-bold">
                                    Band {st.latest_total}
                                  </span>
                                ) : (
                                  <span className="inline-block px-2.5 py-1 rounded-full bg-gray-100 text-gray-500 font-mono text-[10px]">
                                    Chưa Nộp Bài
                                  </span>
                                )}
                              </td>
                            );
                          })}
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* TAB 2: ROSTER STUDENTS */}
        {activeTab === "students" && (
          <div className="bg-white rounded-3xl border border-[#d8c2b6] shadow-sm overflow-hidden p-6 space-y-4">
            <div className="flex justify-between items-center border-b border-[#d8c2b6]/40 pb-4">
              <h2 className="text-lg font-bold text-[#6d3807] flex items-center space-x-2 font-headline">
                <Users className="w-5 h-5 text-[#6d3807]" />
                <span>Danh Sách Học Viên Trong Lớp ({students.length})</span>
              </h2>

              <button
                onClick={() => setShowCreateStudentModal(true)}
                className="px-4 py-2 bg-[#6d3807] text-white rounded-xl text-xs font-bold hover:bg-[#8a4f1e] transition-all flex items-center space-x-1.5 cursor-pointer font-headline"
              >
                <UserPlus className="w-4 h-4 text-[#ffb782]" />
                <span>+ Thêm Học Viên</span>
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-[#fff8f5] border-b border-[#d8c2b6] text-[#52443a] font-bold">
                    <th className="p-3.5">Họ &amp; Tên Học Viên</th>
                    <th className="p-3.5">Email</th>
                    <th className="p-3.5">Số Điện Thoại</th>
                    <th className="p-3.5 text-center">Số Bài Nộp</th>
                    <th className="p-3.5 text-center">Điểm Gần Nhất</th>
                    <th className="p-3.5 text-right">Trạng Thái</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#d8c2b6]/30">
                  {students.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="p-8 text-center text-xs text-[#857469]">
                        Chưa có học sinh nào trong lớp. Nhấp "+ Thêm Học Viên" để thêm hoặc ghi danh học sinh.
                      </td>
                    </tr>
                  ) : (
                    students.map((st) => (
                      <tr key={st.id} className="hover:bg-[#fff8f5] transition-colors">
                        <td className="p-3.5 font-bold text-[#211a16]">{st.name}</td>
                        <td className="p-3.5 text-[#004d5e]">{st.email}</td>
                        <td className="p-3.5 text-[#52443a]">{st.phone || "—"}</td>
                        <td className="p-3.5 text-center font-mono font-bold text-[#6d3807]">
                          {st.submission_count ?? 0}
                        </td>
                        <td className="p-3.5 text-center">
                          {st.latest_total !== null && st.latest_total !== undefined ? (
                            <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-mono font-bold text-[11px]">
                              {st.latest_total}
                            </span>
                          ) : (
                            <span className="text-[#857469]">—</span>
                          )}
                        </td>
                        <td className="p-3.5 text-right">
                          <span className="px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 text-[10px] font-bold">
                            {st.status || "ACTIVE"}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 3: ROADMAP & UNLOCKS */}
        {activeTab === "roadmap" && (
          <TeacherClassRoadmap classId={classId} />
        )}

        {/* Modal 1: Assign Exam to Class */}
        {showAssignModal && (
          <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 font-sans">
            <div className="bg-white rounded-3xl p-6 md:p-8 max-w-lg w-full shadow-2xl border border-[#d8c2b6] space-y-6 animate-in fade-in zoom-in-95">
              <div className="flex justify-between items-center border-b border-[#d8c2b6]/40 pb-4">
                <h2 className="text-xl font-bold text-[#6d3807] flex items-center space-x-2 font-headline">
                  <PlusCircle className="w-5 h-5 text-[#6d3807]" />
                  <span>Giao Bài Thi Vào Lớp {cls?.name}</span>
                </h2>
                <button onClick={() => setShowAssignModal(false)} className="text-[#857469] cursor-pointer">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleAssignExamToClass} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold uppercase text-[#6d3807] mb-1">
                    Chọn Đề Thi Từ Kho Đề (*)
                  </label>
                  <select
                    required
                    value={selectedExamId}
                    onChange={(e) => setSelectedExamId(e.target.value)}
                    className="w-full p-3 bg-[#fff8f5] border border-[#d8c2b6] rounded-xl text-xs font-bold text-[#211a16] focus:outline-none focus:border-[#6d3807]"
                  >
                    <option value="">-- Chọn bài thi trong kho đề --</option>
                    {allExamsRepo.map((ex) => (
                      <option key={ex.id} value={ex.id}>
                        {ex.title} ({ex.duration_minutes || 60} phút)
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase text-[#211a16] mb-1">
                    Hạn Nộp Bài (Due Date) (*)
                  </label>
                  <input
                    type="date"
                    required
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    className="w-full p-3 bg-[#fff8f5] border border-[#d8c2b6] rounded-xl text-xs font-bold text-[#211a16] focus:outline-none focus:border-[#6d3807]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase text-[#211a16] mb-1">
                    Số Lượt Nộp Bài Tối Đa
                  </label>
                  <select
                    value={maxAttempts}
                    onChange={(e) => setMaxAttempts(e.target.value)}
                    className="w-full p-3 bg-[#fff8f5] border border-[#d8c2b6] rounded-xl text-xs font-bold text-[#211a16] focus:outline-none focus:border-[#6d3807]"
                  >
                    <option value="1">1 Lượt (Đề thi chính thức)</option>
                    <option value="2">2 Lượt làm lại</option>
                    <option value="99">Không giới hạn (Luyện tập)</option>
                  </select>
                </div>

                <div className="pt-2 flex space-x-3">
                  <button
                    type="button"
                    onClick={() => setShowAssignModal(false)}
                    className="flex-1 py-3 border border-[#d8c2b6] text-[#52443a] rounded-xl text-xs font-medium hover:bg-[#fff8f5] cursor-pointer"
                  >
                    Hủy
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="flex-1 py-3 bg-[#6d3807] hover:bg-[#8a4f1e] text-white rounded-xl text-xs font-bold shadow flex items-center justify-center space-x-2 disabled:opacity-50 cursor-pointer font-headline"
                  >
                    {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin text-white" /> : <Save className="w-4 h-4 text-[#ffb782]" />}
                    <span>Xác Nhận Giao Bài Vào DB</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal 2: Create Student */}
        {showCreateStudentModal && (
          <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 font-sans">
            <div className="bg-white rounded-3xl p-6 md:p-8 max-w-lg w-full shadow-2xl border border-[#d8c2b6] space-y-6 animate-in fade-in zoom-in-95">
              <div className="flex justify-between items-center border-b border-[#d8c2b6]/40 pb-4">
                <h2 className="text-xl font-bold text-[#6d3807] flex items-center space-x-2 font-headline">
                  <UserPlus className="w-5 h-5 text-[#6d3807]" />
                  <span>Thêm Học Viên Vào Lớp {cls?.name}</span>
                </h2>
                <button onClick={() => setShowCreateStudentModal(false)} className="text-[#857469] cursor-pointer">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleCreateStudentForThisClass} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold uppercase text-[#211a16] mb-1">
                    Họ &amp; Tên Học Sinh (*)
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Nguyễn Văn An"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full p-3 bg-[#fff8f5] border border-[#d8c2b6] rounded-xl text-xs font-medium focus:outline-none focus:border-[#6d3807]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase text-[#211a16] mb-1">Email (*)</label>
                  <input
                    type="email"
                    required
                    placeholder="hocsinh@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full p-3 bg-[#fff8f5] border border-[#d8c2b6] rounded-xl text-xs font-medium focus:outline-none focus:border-[#6d3807]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase text-[#211a16] mb-1">Số Điện Thoại (Tùy chọn)</label>
                  <input
                    type="tel"
                    placeholder="0912345678"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full p-3 bg-[#fff8f5] border border-[#d8c2b6] rounded-xl text-xs font-medium focus:outline-none focus:border-[#6d3807]"
                  />
                </div>

                <div className="pt-2 flex space-x-3">
                  <button
                    type="button"
                    onClick={() => setShowCreateStudentModal(false)}
                    className="flex-1 py-3 border border-[#d8c2b6] text-[#52443a] rounded-xl text-xs font-medium hover:bg-[#fff8f5] cursor-pointer"
                  >
                    Hủy
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="flex-1 py-3 bg-[#6d3807] hover:bg-[#8a4f1e] text-white rounded-xl text-xs font-medium shadow flex items-center justify-center space-x-2 disabled:opacity-50 cursor-pointer font-headline"
                  >
                    {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin text-white" /> : <Save className="w-4 h-4 text-[#ffb782]" />}
                    <span>Thêm / Ghi Danh Học Sinh</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal 3: Exam Preview Modal */}
        {previewExam && (
          <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 font-sans">
            <div className="bg-white rounded-3xl p-6 md:p-8 max-w-2xl w-full shadow-2xl border border-[#d8c2b6] space-y-6 max-h-[85vh] overflow-y-auto animate-in fade-in zoom-in-95">
              <div className="flex justify-between items-center border-b border-[#d8c2b6]/40 pb-4">
                <h2 className="text-xl font-bold text-[#6d3807] flex items-center space-x-2 font-headline">
                  <Eye className="w-5 h-5 text-[#6d3807]" />
                  <span>Xem Nhanh Đề Thi: {previewExam.title}</span>
                </h2>
                <button onClick={() => setPreviewExam(null)} className="text-[#857469] cursor-pointer">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-4 text-xs">
                <div className="flex items-center space-x-3">
                  <span className="px-3 py-1 bg-[#fff1ea] text-[#6d3807] border border-[#ffb782] rounded-lg font-mono font-bold">
                    Thời gian: {previewExam.duration_minutes || 60} phút
                  </span>
                  <span className="px-3 py-1 bg-purple-100 text-purple-900 border border-purple-300 rounded-lg font-mono font-bold">
                    Kỹ năng: {(previewExam.skills || ["Writing", "Speaking"]).join(", ")}
                  </span>
                </div>

                <div className="p-4 bg-[#fff8f5] rounded-2xl border border-[#d8c2b6] space-y-2">
                  <h4 className="font-bold text-[#6d3807] uppercase text-[11px] tracking-wider">Cấu trúc bài thi:</h4>
                  <p className="text-[#52443a] leading-relaxed">
                    Bài thi bao gồm các phần tự luận Writing và ghi âm trực tiếp Speaking được liên kết với tiêu chí chấm điểm AI chuẩn quốc tế.
                  </p>
                </div>
              </div>

              <div className="pt-4 flex justify-between items-center border-t border-[#d8c2b6]/40">
                <button
                  onClick={() => setPreviewExam(null)}
                  className="px-5 py-2.5 border border-[#d8c2b6] text-[#52443a] rounded-xl text-xs font-bold hover:bg-[#fff8f5] cursor-pointer"
                >
                  Đóng
                </button>

                <Link
                  href={`/teacher/tests/create?editId=${previewExam.id}`}
                  className="px-5 py-2.5 bg-[#6d3807] text-white hover:bg-[#8a4f1e] rounded-xl text-xs font-bold flex items-center space-x-1.5 transition-all shadow cursor-pointer font-headline"
                >
                  <Edit3 className="w-4 h-4 text-[#ffb782]" />
                  <span>Mở Trình Sửa Đề Thi trong Exam Builder &rarr;</span>
                </Link>
              </div>
            </div>
          </div>
        )}

        {/* Modal 4: Live Submission Review & Teacher Grading Modal */}
        {selectedSubmission && (
          <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 font-sans">
            <div className="bg-white rounded-3xl p-6 md:p-8 max-w-2xl w-full shadow-2xl border border-[#d8c2b6] space-y-6 max-h-[90vh] overflow-y-auto animate-in fade-in zoom-in-95">
              <div className="flex justify-between items-center border-b border-[#d8c2b6]/40 pb-4">
                <div>
                  <div className="text-[10px] text-[#6d3807] uppercase font-mono font-bold tracking-wider mb-1">
                    Cổng Chấm Điểm Lớp Học &bull; Teacher Review
                  </div>
                  <h2 className="text-xl font-bold text-[#211a16] font-headline">
                    Bài Làm: {reviewStudentName} - {reviewExamTitle}
                  </h2>
                </div>
                <button onClick={() => setSelectedSubmission(null)} className="text-[#857469] cursor-pointer">
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Student Answers Content View */}
              <div className="space-y-4 text-xs">
                <div className="p-4 bg-[#fff8f5] rounded-2xl border border-[#d8c2b6] space-y-3">
                  <span className="text-[11px] font-bold text-[#6d3807] uppercase tracking-wider block font-mono">
                    Nội dung bài nộp tự luận / âm thanh:
                  </span>
                  
                  {selectedSubmission.answers?.speaking_audio_url ? (
                    <div className="space-y-2 p-3 bg-white rounded-xl border border-[#d8c2b6]">
                      <div className="flex items-center space-x-2 text-[#6d3807] font-bold">
                        <Volume2 className="w-4 h-4 text-[#6d3807]" />
                        <span>Bài thu âm micro học viên:</span>
                      </div>
                      <audio controls src={selectedSubmission.answers.speaking_audio_url} className="w-full h-9" />
                    </div>
                  ) : (
                    <div className="p-3 bg-white rounded-xl border border-[#d8c2b6] font-serif leading-relaxed text-[#211a16] max-h-40 overflow-y-auto whitespace-pre-wrap">
                      {selectedSubmission.answers?.essay_text || selectedSubmission.answers?.writing_essay || "Học viên đã nộp câu trả lời tự luận trực tuyến."}
                    </div>
                  )}
                </div>

                {/* AI Rubric Score Breakdown */}
                {selectedSubmission.ai_feedback && (
                  <div className="p-4 bg-purple-50 rounded-2xl border border-purple-200 space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-bold text-purple-900 uppercase font-mono">⚡ Kết Quả AI Evaluation:</span>
                      <span className="text-sm font-bold text-purple-900 font-mono">Band {selectedSubmission.ai_feedback.overallBand || selectedSubmission.ai_score || 7.5}</span>
                    </div>
                    <p className="text-xs text-purple-950 leading-relaxed">
                      {selectedSubmission.ai_feedback.summary || selectedSubmission.ai_feedback.feedback || "Bài làm thể hiện khả năng sử dụng ngữ pháp & từ vựng tốt."}
                    </p>
                  </div>
                )}

                {/* Teacher Override Form */}
                <form onSubmit={handleSaveTeacherReview} className="space-y-4 pt-2 border-t border-[#d8c2b6]/40">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold uppercase text-[#6d3807] mb-1">
                        Chấm Điểm Band Score (*)
                      </label>
                      <input
                        type="number"
                        step="0.5"
                        min="0"
                        max="9"
                        required
                        value={overrideScore}
                        onChange={(e) => setOverrideScore(Number(e.target.value))}
                        className="w-full p-3 bg-[#fff8f5] border border-[#d8c2b6] rounded-xl text-xs font-bold text-[#6d3807] font-mono focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold uppercase text-[#52443a] mb-1">
                        Trạng Thái Phê Duyệt
                      </label>
                      <span className="px-3 py-3 block bg-emerald-50 text-emerald-900 border border-emerald-200 rounded-xl text-xs font-bold font-mono">
                        🟢 TEACHER_REVIEWED (Đã duyệt)
                      </span>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase text-[#6d3807] mb-1">
                      Nhận Xét &amp; Góp Ý Của Giáo Viên
                    </label>
                    <textarea
                      rows={3}
                      placeholder="Nhập lời khen hoặc hướng dẫn sửa bài chi tiết cho học viên..."
                      value={teacherNote}
                      onChange={(e) => setTeacherNote(e.target.value)}
                      className="w-full p-3 bg-[#fff8f5] border border-[#d8c2b6] rounded-xl text-xs text-[#211a16] focus:outline-none focus:border-[#6d3807]"
                    />
                  </div>

                  <div className="pt-2 flex space-x-3">
                    <button
                      type="button"
                      onClick={() => setSelectedSubmission(null)}
                      className="flex-1 py-3 border border-[#d8c2b6] text-[#52443a] rounded-xl text-xs font-medium hover:bg-[#fff8f5] cursor-pointer"
                    >
                      Hủy
                    </button>
                    <button
                      type="submit"
                      disabled={isSavingReview}
                      className="flex-1 py-3 bg-[#6d3807] hover:bg-[#8a4f1e] text-white rounded-xl text-xs font-bold shadow flex items-center justify-center space-x-2 disabled:opacity-50 cursor-pointer font-headline"
                    >
                      {isSavingReview ? <Loader2 className="w-4 h-4 animate-spin text-white" /> : <Send className="w-4 h-4 text-[#ffb782]" />}
                      <span>Phê Duyệt &amp; Lưu Điểm</span>
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        )}
      </div>
    </TeacherLayout>
  );
}
