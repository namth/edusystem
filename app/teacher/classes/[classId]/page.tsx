"use client";

import { useState, useEffect } from "react";
import TeacherLayout from "@/components/TeacherLayout";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabase";
import {
  BookOpen,
  UserPlus,
  Users,
  ArrowLeft,
  Loader2,
  CheckCircle2,
  Clock,
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
} from "lucide-react";

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
  created_at: string;
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
  const router = useRouter();
  const classId = (params?.classId || "cls_101") as string;
  const { user } = useAuth();

  const [activeTab, setActiveTab] = useState<"gradebook" | "students">("gradebook");
  const [cls, setCls] = useState<ClassDetail | null>(null);
  const [students, setStudents] = useState<StudentInClass[]>([]);
  const [assignedExams, setAssignedExams] = useState<AssignedExamItem[]>([]);
  const [allExamsRepo, setAllExamsRepo] = useState<any[]>([]);
  const [submissionsMap, setSubmissionsMap] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  const [copiedCode, setCopiedCode] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Assign Exam Modal State
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [selectedExamId, setSelectedExamId] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [maxAttempts, setMaxAttempts] = useState("1");

  // Create Student Modal State
  const [showCreateStudentModal, setShowCreateStudentModal] = useState(false);
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [defaultPassword, setDefaultPassword] = useState("123456");

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

      // 1. Fetch Class Detail directly from PostgreSQL `classes` table
      const { data: clsData } = await supabase
        .from("classes")
        .select("*")
        .eq("id", classId)
        .maybeSingle();

      if (clsData) {
        setCls({
          id: clsData.id,
          name: clsData.name,
          code: clsData.code,
          teacher_id: clsData.teacher_id,
          schedule: clsData.schedule || "Thứ 2 - Thứ 4 - Thứ 6 (18:00 - 20:00)",
          description: clsData.description || "Lớp luyện thi IELTS chuyên sâu target 7.5+",
          max_slots: clsData.max_slots || 30,
        });
      } else {
        setCls({
          id: classId,
          name: `Lớp ${classId}`,
          code: `CODE_${classId.slice(-4)}`,
          teacher_id: user?.id || "teacher_01",
          schedule: "Thứ 2 - Thứ 4 - Thứ 6 (19:30 - 21:30)",
          description: "Lớp chuyên sâu tổng lực 4 kỹ năng IELTS target 7.5+",
          max_slots: 30,
        });
      }

      // 2. Fetch Enrollments & Students directly from PostgreSQL DB
      const { data: enrData } = await supabase
        .from("enrollments")
        .select("*")
        .eq("class_id", classId);

      const studentIds = (enrData || []).map((e: any) => e.student_id);

      if (studentIds.length > 0) {
        const { data: userData } = await supabase
          .from("users")
          .select("*")
          .in("id", studentIds);

        setStudents(
          (userData || []).map((u: any) => ({
            id: u.id,
            name: u.name,
            email: u.email,
            username: u.username || u.id,
            phone: u.phone || "0912345678",
            created_at: new Date(u.created_at || Date.now()).toLocaleDateString("vi-VN"),
          }))
        );
      } else {
        setStudents([]);
      }

      // 3. Fetch All Exams from Repository directly from PostgreSQL `exams` table
      const { data: examData } = await supabase
        .from("exams")
        .select("*")
        .order("created_at", { ascending: false });

      setAllExamsRepo(examData || []);

      const examDict: Record<string, any> = {};
      (examData || []).forEach((ex: any) => {
        examDict[ex.id] = ex;
      });

      // 4. Fetch Assigned Exams directly from PostgreSQL `class_assignments` table
      const { data: assignData, error: assignErr } = await supabase
        .from("class_assignments")
        .select("*")
        .eq("class_id", classId);

      if (assignErr) {
        console.error("Fetch class_assignments error:", assignErr);
      }

      if (assignData && assignData.length > 0) {
        setAssignedExams(
          assignData.map((a: any) => {
            const exInfo = examDict[a.exam_id] || {};
            return {
              id: a.exam_id,
              assignment_id: a.id,
              exam_id: a.exam_id,
              title: exInfo.title || `Đề Thi #${a.exam_id}`,
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

      // 5. Fetch Submissions directly from PostgreSQL `submissions` table
      const { data: subData } = await supabase.from("submissions").select("*");
      const subMap: Record<string, any> = {};
      (subData || []).forEach((s: any) => {
        const key = `${s.student_id}_${s.exam_id}`;
        subMap[key] = s;
      });
      setSubmissionsMap(subMap);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchClassData();
  }, [classId]);

  // Insert assigned exam directly into PostgreSQL `class_assignments` table
  const handleAssignExamToClass = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedExamId) return;

    setIsSubmitting(true);
    try {
      const assignmentId = `asg_${Date.now().toString().slice(-4)}`;
      const dueTimestamp = dueDate ? new Date(dueDate).toISOString() : new Date(Date.now() + 7 * 86400000).toISOString();

      const { error } = await supabase.from("class_assignments").insert([
        {
          id: assignmentId,
          class_id: classId,
          exam_id: selectedExamId,
          due_date: dueTimestamp,
          max_attempts: Number(maxAttempts) || 1,
        },
      ]);

      if (error) {
        alert("Lỗi giao bài thi vào PostgreSQL DB: " + error.message);
        return;
      }

      setSuccessMsg("Đã giao bài thi thành công vào CSDL PostgreSQL!");
      setShowAssignModal(false);
      fetchClassData();
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err: any) {
      console.error(err);
      alert("Lỗi giao bài thi: " + (err.message || err));
    } finally {
      setIsSubmitting(false);
    }
  };

  // Delete assigned exam directly from PostgreSQL `class_assignments` table
  const handleUnassignExam = async (assignmentId: string, examTitle: string) => {
    if (!confirm(`Bạn có chắc chắn muốn hủy giao bài thi "${examTitle}" khỏi lớp này không?`)) return;

    try {
      const { error } = await supabase.from("class_assignments").delete().eq("id", assignmentId);
      if (error) {
        alert("Lỗi hủy giao bài thi khỏi PostgreSQL DB: " + error.message);
        return;
      }
      setSuccessMsg(`Đã hủy giao bài thi "${examTitle}" khỏi CSDL!`);
      fetchClassData();
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err: any) {
      console.error(err);
      alert("Lỗi hủy giao bài thi: " + (err.message || err));
    }
  };

  const handleCreateStudentForThisClass = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !defaultPassword.trim()) return;

    setIsSubmitting(true);
    try {
      const studentId = `student_${Date.now().toString().slice(-4)}`;
      const studentUsername = username.trim() || `st_${Date.now().toString().slice(-4)}`;
      const studentEmail = email.trim() || `${studentUsername}@student.edu.vn`;

      const { error: userErr } = await supabase.from("users").insert([
        {
          id: studentId,
          name: name.trim(),
          username: studentUsername,
          email: studentEmail,
          password: defaultPassword.trim(),
          role: "STUDENT",
          phone: phone.trim() || "0912345678",
          target_band: "IELTS 7.0",
          must_change_password: true,
        },
      ]);

      if (userErr) {
        alert("Lỗi tạo tài khoản học sinh: " + userErr.message);
        return;
      }

      await supabase.from("enrollments").insert([
        {
          id: `enr_${Date.now().toString().slice(-4)}`,
          student_id: studentId,
          class_id: classId,
        },
      ]);

      setSuccessMsg(`Đã tạo học sinh "${name}" và gán vào lớp này thành công!`);
      setShowCreateStudentModal(false);
      setName("");
      setUsername("");
      setEmail("");
      setPhone("");
      fetchClassData();
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (e) {
      console.error(e);
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
      const existingFeedback = selectedSubmission.ai_feedback || {};
      const updatedFeedback = {
        ...existingFeedback,
        teacher_note: teacherNote.trim(),
        overridden_score: overrideScore,
        reviewed_at: new Date().toISOString(),
        reviewed_by: user?.name || "Giáo Viên Phụ Trách",
      };

      const { error } = await supabase
        .from("submissions")
        .update({
          score: overrideScore,
          final_score: overrideScore,
          ai_feedback: updatedFeedback,
          status: "TEACHER_REVIEWED",
        })
        .eq("id", selectedSubmission.id);

      if (error) {
        alert("Lỗi lưu nhận xét: " + error.message);
        return;
      }

      setSuccessMsg("Đã phê duyệt & lưu điểm cho học viên thành công!");
      setSelectedSubmission(null);
      fetchClassData();
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err) {
      console.error(err);
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
          <span>Đang nạp dữ liệu Lớp học &amp; Sổ điểm Gradebook từ PostgreSQL...</span>
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
            <h1 className="text-3xl font-bold text-[#211a16] tracking-tight flex items-center space-x-3 font-headline">
              <span>{cls?.name}</span>
              <span className="px-3 py-1 rounded-lg bg-[#fff1ea] text-[#6d3807] text-xs font-mono font-bold border border-[#ffb782]">
                Mã: {cls?.code}
              </span>
            </h1>
            <p className="text-sm text-[#52443a] mt-1">{cls?.description}</p>
          </div>

          <div className="flex items-center space-x-3">
            <button
              onClick={() => setShowAssignModal(true)}
              className="px-4 py-2.5 bg-[#6d3807] hover:bg-[#8a4f1e] text-white rounded-xl text-xs font-bold flex items-center space-x-2 transition-all shadow cursor-pointer font-headline"
            >
              <PlusCircle className="w-4 h-4 text-[#ffb782]" />
              <span>+ Giao Bài Thi Mới Cho Lớp</span>
            </button>

            <button
              onClick={copyInviteLink}
              className="px-4 py-2.5 bg-[#fff8f5] border border-[#d8c2b6] hover:bg-[#f9ebe4] text-[#6d3807] rounded-xl text-xs font-bold flex items-center space-x-2 transition-all cursor-pointer font-headline"
            >
              {copiedCode ? <CheckCircle2 className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4 text-[#6d3807]" />}
              <span>{copiedCode ? "Đã Copy!" : "Copy Mã Lớp"}</span>
            </button>
          </div>
        </div>

        {successMsg && (
          <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 flex items-center space-x-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            <span className="text-xs font-bold">{successMsg}</span>
          </div>
        )}

        {/* LMS Class Overview Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white p-5 rounded-2xl border border-[#d8c2b6] shadow-sm flex items-center space-x-4">
            <div className="p-3 rounded-xl bg-[#fff1ea] text-[#6d3807] border border-[#ffb782]">
              <Users className="w-6 h-6" />
            </div>
            <div>
              <span className="text-xs text-[#52443a] font-medium block">Sĩ Số Học Viên</span>
              <span className="text-xl font-bold text-[#6d3807]">{students.length} / {cls?.max_slots} Học sinh</span>
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-[#d8c2b6] shadow-sm flex items-center space-x-4">
            <div className="p-3 rounded-xl bg-[#fff1ea] text-[#6d3807] border border-[#ffb782]">
              <FileText className="w-6 h-6" />
            </div>
            <div>
              <span className="text-xs text-[#52443a] font-medium block">Đề Thi Đã Giao</span>
              <span className="text-xl font-bold text-[#6d3807]">{assignedExams.length} Bài thi</span>
            </div>
          </div>

          <div className="bg-[#ffffff] p-5 rounded-2xl border border-[#d8c2b6] shadow-sm flex items-center space-x-4">
            <div className="p-3 rounded-xl bg-emerald-50 text-emerald-800 border border-emerald-200">
              <Clock className="w-6 h-6" />
            </div>
            <div>
              <span className="text-xs text-[#52443a] font-medium block">Lịch Học Lớp</span>
              <span className="text-xs font-bold text-[#211a16]">{cls?.schedule}</span>
            </div>
          </div>
        </div>

        {/* LMS Tabs */}
        <div className="flex border-b border-[#d8c2b6] space-x-2">
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
                  Dữ liệu được lưu trực tiếp 100% trong PostgreSQL DB <code>public.class_assignments</code>.
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
                    <th className="p-3.5">Username Đăng Nhập</th>
                    <th className="p-3.5">Email</th>
                    <th className="p-3.5">Số Điện Thoại</th>
                    <th className="p-3.5 text-right">Trạng Thái Mật Khẩu</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#d8c2b6]/30">
                  {students.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="p-8 text-center text-xs text-[#857469]">
                        Chưa có học sinh nào trong lớp. Nhấp "+ Thêm Học Viên" để tạo tài khoản mới.
                      </td>
                    </tr>
                  ) : (
                    students.map((st) => (
                      <tr key={st.id} className="hover:bg-[#fff8f5] transition-colors">
                        <td className="p-3.5 font-bold text-[#211a16]">{st.name}</td>
                        <td className="p-3.5 font-mono font-bold text-[#6d3807]">{st.username}</td>
                        <td className="p-3.5 text-[#004d5e]">{st.email}</td>
                        <td className="p-3.5 text-[#52443a]">{st.phone}</td>
                        <td className="p-3.5 text-right">
                          <span className="px-2.5 py-1 rounded-full bg-amber-50 text-amber-800 border border-amber-200 text-[10px] font-bold">
                            Mật khẩu mặc định (123456)
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
                  <span>Tạo Tài Khoản Học Viên Lớp {cls?.name}</span>
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
                    className="w-full p-3 bg-[#fff8f5] border border-[#d8c2b6] rounded-xl text-xs font-medium focus:outline-none focus:border-[#6d3807]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase text-[#6d3807] mb-1">
                    Username Đăng Nhập (*)
                  </label>
                  <input
                    type="text"
                    required
                    value={username}
                    onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""))}
                    className="w-full p-3 bg-[#fff1ea] border border-[#ffb782] rounded-xl text-xs font-bold text-[#6d3807] focus:outline-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold uppercase text-[#211a16] mb-1">Email</label>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full p-3 bg-[#fff8f5] border border-[#d8c2b6] rounded-xl text-xs font-medium"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold uppercase text-[#211a16] mb-1">SĐT</label>
                    <input
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="w-full p-3 bg-[#fff8f5] border border-[#d8c2b6] rounded-xl text-xs font-medium"
                    />
                  </div>
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
                    <span>Tạo &amp; Gán Lớp</span>
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
