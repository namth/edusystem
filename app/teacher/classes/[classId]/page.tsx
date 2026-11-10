"use client";

import { useState, useEffect } from "react";
import TeacherLayout from "@/components/TeacherLayout";
import ResetPasswordButton from "@/components/ResetPasswordButton";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { ClassBillingBanner } from "@/components/slots/ClassBillingBanner";
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
  Route,
  AlertCircle,
  RefreshCw,
  KeyRound,
  Calendar,
  AlertTriangle,
  StopCircle,
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
  billing_status?: "ACTIVE" | "GRACE" | "LOCKED" | "ENDED" | string;
  start_date?: string | null;
  next_charge_at?: string | null;
  grace_until?: string | null;
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
  const classId = params.classId as string;
  const { user } = useAuth();

  const [activeTab, setActiveTab] = useState<"assignments" | "students" | "roadmap">("assignments");
  const [cls, setCls] = useState<ClassDetail | null>(null);
  const [students, setStudents] = useState<StudentInClass[]>([]);
  const [assignedExams, setAssignedExams] = useState<AssignedExamItem[]>([]);
  const [allExamsRepo, setAllExamsRepo] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [copiedCode, setCopiedCode] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [newStudentTempPassword, setNewStudentTempPassword] = useState<{ name: string; password: string } | null>(null);

  // Billing State
  const [startDate, setStartDate] = useState("");
  const [nextChargeAt, setNextChargeAt] = useState<string | null>(null);
  const [billingMsg, setBillingMsg] = useState<string | null>(null);
  const [billingError, setBillingError] = useState<string | null>(null);
  const [isUpdatingBilling, setIsUpdatingBilling] = useState(false);
  const [isEndingClass, setIsEndingClass] = useState(false);

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
  const [studentErrorMsg, setStudentErrorMsg] = useState<string | null>(null);
  const [isSlotError, setIsSlotError] = useState(false);

  // Exam Preview Modal State
  const [previewExam, setPreviewExam] = useState<any | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const formatDateVN = (dateStr?: string | null) => {
    if (!dateStr) return "—";
    try {
      const parts = dateStr.split("T")[0].split("-");
      if (parts.length === 3) {
        return `${parts[2]}/${parts[1]}/${parts[0]}`;
      }
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      const day = String(d.getDate()).padStart(2, "0");
      const month = String(d.getMonth() + 1).padStart(2, "0");
      const year = d.getFullYear();
      return `${day}/${month}/${year}`;
    } catch {
      return dateStr;
    }
  };

  const fetchClassData = async () => {
    try {
      setLoading(true);
      setErrorMessage(null);

      // 1. Fetch Class Detail & Wallet data in parallel
      const [classRes, walletRes] = await Promise.all([
        fetch(`/api/teacher/classes/${classId}`),
        fetch("/api/teacher/slot-wallet").catch(() => null),
      ]);

      if (!classRes.ok) {
        const errData = await classRes.json().catch(() => ({}));
        throw new Error(errData.error || "Không thể tải thông tin lớp học.");
      }
      const classData = await classRes.json();

      let billingInfo: any = {};
      if (walletRes && walletRes.ok) {
        const walletData = await walletRes.json().catch(() => ({}));
        const found = (walletData.classes || []).find((c: any) => c.id === classId);
        if (found) {
          billingInfo = found;
        }
      }

      if (classData.class) {
        const clsBillingStatus = billingInfo.billing_status || classData.class.billing_status || "ACTIVE";
        const clsStartDate = billingInfo.start_date || classData.class.start_date || null;
        const clsNextCharge = billingInfo.next_charge_at || classData.class.next_charge_at || null;
        const clsGraceUntil = billingInfo.grace_until || classData.class.grace_until || null;

        setCls({
          id: classData.class.id,
          name: classData.class.name,
          code: classData.class.code,
          teacher_id: classData.class.teacher_id,
          schedule: classData.class.schedule || "Thứ 2 - Thứ 4 - Thứ 6 (18:00 - 20:00)",
          description: classData.class.description || "Lớp luyện thi IELTS chuyên sâu target 7.5+",
          max_slots: classData.class.max_slots || 30,
          billing_status: clsBillingStatus,
          start_date: clsStartDate,
          next_charge_at: clsNextCharge,
          grace_until: clsGraceUntil,
        });

        if (clsStartDate) {
          setStartDate(clsStartDate.split("T")[0]);
        }
        if (clsNextCharge) {
          setNextChargeAt(clsNextCharge.split("T")[0]);
        }
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

  // Billing: Update start_date via PUT
  const handleUpdateBilling = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!startDate) return;

    setIsUpdatingBilling(true);
    setBillingMsg(null);
    setBillingError(null);

    try {
      const res = await fetch(`/api/teacher/classes/${classId}/billing`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ start_date: startDate }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (res.status === 409) {
          setBillingError(
            data.error || "Lớp học đã bắt đầu chu kỳ tính phí, không thể thay đổi ngày khai giảng."
          );
        } else {
          setBillingError(data.error || "Không thể cập nhật ngày khai giảng.");
        }
        return;
      }

      setBillingMsg("Cập nhật ngày khai giảng thành công!");
      if (data.start_date) setStartDate(data.start_date);
      if (data.next_charge_at) setNextChargeAt(data.next_charge_at);
      fetchClassData();
    } catch (err: any) {
      setBillingError(err.message || "Lỗi khi cập nhật ngày khai giảng.");
    } finally {
      setIsUpdatingBilling(false);
    }
  };

  // Billing: End class via POST
  const handleEndClass = async () => {
    const confirmed = window.confirm(
      "Bạn có chắc chắn muốn kết thúc lớp học này? Lưu ý: Không hoàn tác được, không hoàn slot."
    );
    if (!confirmed) return;

    setIsEndingClass(true);
    setBillingError(null);
    try {
      const res = await fetch(`/api/teacher/classes/${classId}/end`, {
        method: "POST",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert("Lỗi khi kết thúc lớp: " + (data.error || "Không thể kết thúc lớp"));
        return;
      }
      setSuccessMsg("Lớp học đã kết thúc thành công.");
      fetchClassData();
    } catch (err: any) {
      alert("Lỗi kết nối: " + (err.message || err));
    } finally {
      setIsEndingClass(false);
    }
  };

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
    setStudentErrorMsg(null);
    setIsSlotError(false);

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

      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) {
        if (res.status === 409) {
          setStudentErrorMsg(
            data.error || "Thầy cô không đủ slot học sinh để ghi danh vào lớp."
          );
          setIsSlotError(true);
        } else {
          setStudentErrorMsg(data.error || "Không thể thêm vào lớp.");
          setIsSlotError(false);
        }
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
      setStudentErrorMsg("Đã xảy ra lỗi khi thêm học sinh: " + e.message);
      setIsSlotError(false);
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

  const copyInviteLink = () => {
    if (!cls) return;
    navigator.clipboard.writeText(`http://localhost:3000/login?code=${cls.code}`);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 3000);
  };

  if (loading) {
    return (
      <TeacherLayout>
        <div className="flex items-center space-x-2 text-xs text-ink-muted p-12 bg-white rounded-2xl border border-line max-w-4xl mx-auto my-8">
          <Loader2 className="w-4 h-4 animate-spin text-brand-600" />
          <span>Đang nạp dữ liệu Lớp học &amp; Sổ điểm Gradebook từ API PostgreSQL...</span>
        </div>
      </TeacherLayout>
    );
  }

  return (
    <TeacherLayout>
      <div className="max-w-[1280px] mx-auto space-y-8 font-sans text-ink">
        {/* Banner trạng thái ví slot của lớp */}
        <ClassBillingBanner
          billing_status={cls?.billing_status}
          grace_until={cls?.grace_until}
        />

        {/* Top Header Navigation */}
        <div className="border-b border-line/40 pb-6 flex flex-col md:flex-row justify-between md:items-center gap-4">
          <div>
            <Link href="/teacher/classes" className="text-xs text-brand-600 hover:underline flex items-center mb-2 font-medium">
              <ArrowLeft className="w-4 h-4 mr-1 text-brand-600" />
              Quay lại Danh sách Lớp học
            </Link>
            <div className="flex items-center space-x-3">
              <h1 className="font-headline text-3xl font-bold text-ink tracking-tight">{cls?.name}</h1>
              <span className="px-2.5 py-1 bg-brand-50 text-brand-600 border border-brand-300 text-xs font-bold rounded-lg font-mono">
                Mã: {cls?.code}
              </span>
            </div>
            <p className="text-xs text-ink-muted mt-1 flex items-center gap-4">
              <span>{cls?.description}</span>
              <span className="text-ink-subtle font-mono">&bull; {cls?.schedule}</span>
            </p>
          </div>

          <div className="flex items-center space-x-2 shrink-0">
            <Link
              href={`/teacher/grading?class=${classId}`}
              className="px-4 py-2 bg-brand-50 border border-brand-300 hover:bg-brand-100 text-brand-600 rounded-xl text-xs font-bold flex items-center space-x-1.5 transition-all shadow-xs cursor-pointer font-headline"
            >
              <Award className="w-4 h-4 text-brand-600" />
              <span>Mở bảng điểm</span>
            </Link>

            <button
              onClick={copyInviteLink}
              className="px-4 py-2 bg-white border border-line hover:bg-surface-alt text-brand-600 rounded-xl text-xs font-bold flex items-center space-x-1.5 transition-all shadow-xs cursor-pointer font-headline"
            >
              {copiedCode ? <CheckCircle2 className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4 text-brand-600" />}
              <span>{copiedCode ? "Đã copy link mời!" : "Copy Link Mời Lớp"}</span>
            </button>

            <button
              onClick={() => {
                setStudentErrorMsg(null);
                setIsSlotError(false);
                setShowCreateStudentModal(true);
              }}
              className="px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-xl text-xs font-bold flex items-center space-x-1.5 transition-all shadow-xs cursor-pointer font-headline"
            >
              <UserPlus className="w-4 h-4 text-white" />
              <span>Thêm Học Viên</span>
            </button>
          </div>
        </div>

        {/* Khối Khai giảng & Tính phí */}
        <div className="bg-white rounded-3xl border border-line p-6 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3 border-b border-line/40 pb-4">
            <div className="flex items-center space-x-2">
              <Calendar className="w-5 h-5 text-brand-600" />
              <h2 className="text-base font-bold text-ink">Khai giảng &amp; Tính phí</h2>
            </div>
            {cls?.billing_status !== "ENDED" && (
              <button
                type="button"
                onClick={handleEndClass}
                disabled={isEndingClass}
                className="inline-flex items-center px-3.5 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl text-xs font-bold transition-all cursor-pointer disabled:opacity-50"
              >
                <StopCircle className="w-4 h-4 mr-1.5 text-rose-600" />
                <span>{isEndingClass ? "Đang xử lý..." : "Kết thúc lớp"}</span>
              </button>
            )}
          </div>

          {billingMsg && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs font-semibold">
              {billingMsg}
            </div>
          )}

          {billingError && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs font-semibold">
              {billingError}
            </div>
          )}

          <form onSubmit={handleUpdateBilling} className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
            <div>
              <label htmlFor="start_date_input" className="block text-xs font-bold text-ink-muted mb-1">
                Ngày khai giảng (start_date)
              </label>
              <input
                id="start_date_input"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                disabled={cls?.billing_status === "ENDED"}
                className="w-full p-2.5 bg-surface-alt border border-line rounded-xl text-xs font-medium text-ink focus:outline-none focus:border-brand-600 disabled:opacity-50"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-ink-muted mb-1">
                Ngày trừ tới (next_charge_at)
              </label>
              <div className="p-2.5 bg-surface-alt border border-line rounded-xl text-xs font-medium text-ink">
                {formatDateVN(nextChargeAt)}
              </div>
            </div>

            <div>
              <button
                type="submit"
                disabled={isUpdatingBilling || cls?.billing_status === "ENDED"}
                className="w-full py-2.5 px-4 bg-brand-600 hover:bg-brand-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm disabled:opacity-50 cursor-pointer flex items-center justify-center space-x-2"
              >
                {isUpdatingBilling ? (
                  <Loader2 className="w-4 h-4 animate-spin text-white" />
                ) : (
                  <Save className="w-4 h-4 text-white" />
                )}
                <span>Lưu ngày khai giảng</span>
              </button>
            </div>
          </form>
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
              <code className="px-2 py-0.5 bg-white border border-amber-300 rounded font-mono font-bold text-sm text-brand-600">
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
        <div className="flex space-x-2 border-b border-line/40">
          <button
            onClick={() => setActiveTab("assignments")}
            className={`px-5 py-3 rounded-t-2xl font-headline text-xs font-bold transition-all flex items-center space-x-2 cursor-pointer ${
              activeTab === "assignments"
                ? "bg-brand-600 text-white shadow-sm"
                : "bg-white text-ink-muted hover:bg-surface-alt border-t border-x border-line"
            }`}
          >
            <FileText className="w-4 h-4" />
            <span>1. Đề giao ({assignedExams.length})</span>
          </button>

          <button
            onClick={() => setActiveTab("students")}
            className={`px-5 py-3 rounded-t-2xl font-headline text-xs font-bold transition-all flex items-center space-x-2 cursor-pointer ${
              activeTab === "students"
                ? "bg-brand-600 text-white shadow-sm"
                : "bg-white text-ink-muted hover:bg-surface-alt border-t border-x border-line"
            }`}
          >
            <Users className="w-4 h-4" />
            <span>2. Danh Sách Học Viên Trong Lớp ({students.length})</span>
          </button>

          <button
            onClick={() => setActiveTab("roadmap")}
            className={`px-5 py-3 rounded-t-2xl font-headline text-xs font-bold transition-all flex items-center space-x-2 cursor-pointer ${
              activeTab === "roadmap"
                ? "bg-brand-600 text-white shadow-sm"
                : "bg-white text-ink-muted hover:bg-surface-alt border-t border-x border-line"
            }`}
          >
            <Route className="w-4 h-4" />
            <span>3. Lộ trình &amp; Mở bài</span>
          </button>
        </div>

        {/* TAB 1: ASSIGNED EXAMS */}
        {activeTab === "assignments" && (
          <div className="bg-white rounded-3xl border border-line shadow-sm overflow-hidden p-6 space-y-6">
            <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 border-b border-line/40 pb-4">
              <div>
                <h2 className="text-lg font-bold text-brand-600 flex items-center space-x-2 font-headline">
                  <FileText className="w-5 h-5 text-brand-600" />
                  <span>Danh Sách Đề Giao Cho Lớp</span>
                </h2>
                <p className="text-xs text-ink-muted mt-0.5">
                  Quản lý các đề thi được giao cho lớp. Xem điểm và chấm bài tại{" "}
                  <Link href={`/teacher/grading?class=${classId}`} className="text-brand-600 font-bold hover:underline">
                    Mở bảng điểm
                  </Link>
                  .
                </p>
              </div>

              <div className="flex items-center space-x-2 shrink-0">
                <Link
                  href={`/teacher/grading?class=${classId}`}
                  className="px-4 py-2 bg-brand-50 border border-brand-300 hover:bg-brand-100 text-brand-600 rounded-xl text-xs font-bold flex items-center space-x-1.5 transition-all cursor-pointer font-headline"
                >
                  <Award className="w-4 h-4 text-brand-600" />
                  <span>Mở bảng điểm</span>
                </Link>

                <button
                  onClick={() => setShowAssignModal(true)}
                  className="px-4 py-2 bg-brand-600 text-white rounded-xl text-xs font-bold hover:bg-brand-700 transition-all flex items-center space-x-1.5 font-headline cursor-pointer"
                >
                  <PlusCircle className="w-4 h-4 text-white" />
                  <span>Giao Bài Thi Mới</span>
                </button>
              </div>
            </div>

            {assignedExams.length === 0 ? (
              <div className="p-12 text-center bg-surface-alt rounded-2xl border border-line space-y-3">
                <FileText className="w-12 h-12 text-brand-600 mx-auto opacity-40" />
                <p className="text-xs text-ink-muted">
                  Lớp học này chưa được giao bài thi nào. Nhấp nút <strong>"Giao Bài Thi Mới"</strong> ở trên để giao bài.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-surface-alt border-b border-line text-ink-muted">
                      <th className="p-3.5 font-bold">Tên Đề Thi</th>
                      <th className="p-3.5 font-bold">Kỹ Năng</th>
                      <th className="p-3.5 font-bold">Thời Gian</th>
                      <th className="p-3.5 font-bold">Hạn Nộp</th>
                      <th className="p-3.5 font-bold">Số Lần Làm</th>
                      <th className="p-3.5 font-bold text-right">Thao Tác</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line/30">
                    {assignedExams.map((ex) => (
                      <tr key={ex.assignment_id} className="hover:bg-surface-alt transition-colors">
                        <td className="p-3.5 font-bold text-ink">
                          <div className="text-sm font-headline text-brand-600">{ex.title}</div>
                          <div className="text-[10px] text-ink-subtle font-mono">ID: {ex.exam_id}</div>
                        </td>
                        <td className="p-3.5">
                          <div className="flex flex-wrap gap-1">
                            {ex.skills.map((s) => (
                              <span key={s} className="px-2 py-0.5 bg-brand-50 text-brand-600 rounded text-[10px] font-mono font-medium">
                                {s}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className="p-3.5 font-mono text-ink-muted">{ex.duration_minutes} phút</td>
                        <td className="p-3.5 font-mono text-ink-muted">{ex.due_date}</td>
                        <td className="p-3.5 font-mono text-ink-muted">{ex.max_attempts} lần</td>
                        <td className="p-3.5 text-right">
                          <div className="flex items-center justify-end space-x-2">
                            <button
                              onClick={() => openPreviewExamModal(ex.exam_id)}
                              className="px-2.5 py-1.5 bg-white border border-line hover:bg-brand-50 text-brand-600 rounded-lg text-xs font-bold flex items-center space-x-1 transition-all cursor-pointer"
                              title="Xem Nhanh Nội Dung Đề Thi"
                            >
                              <Eye className="w-3.5 h-3.5" />
                              <span>Xem Đề</span>
                            </button>

                            <Link
                              href={`/teacher/tests/create?editId=${ex.exam_id}`}
                              className="px-2.5 py-1.5 bg-white border border-line hover:bg-brand-50 text-brand-600 rounded-lg text-xs font-bold flex items-center space-x-1 transition-all cursor-pointer"
                              title="Sửa Đề Thi Trong Exam Builder"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                              <span>Sửa Đề</span>
                            </Link>

                            <button
                              onClick={() => handleUnassignExam(ex.assignment_id, ex.title)}
                              className="p-1.5 bg-white border border-rose-200 hover:bg-rose-50 text-rose-600 rounded-lg text-xs transition-all cursor-pointer"
                              title="Hủy Giao Đề Thi Khỏi Lớp"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* TAB 2: ROSTER STUDENTS */}
        {activeTab === "students" && (
          <div className="bg-white rounded-3xl border border-line shadow-sm overflow-hidden p-6 space-y-4">
            <div className="flex justify-between items-center border-b border-line/40 pb-4">
              <h2 className="text-lg font-bold text-brand-600 flex items-center space-x-2 font-headline">
                <Users className="w-5 h-5 text-brand-600" />
                <span>Danh Sách Học Viên Trong Lớp ({students.length})</span>
              </h2>

              <button
                onClick={() => {
                  setStudentErrorMsg(null);
                  setIsSlotError(false);
                  setShowCreateStudentModal(true);
                }}
                className="px-4 py-2 bg-brand-600 text-white rounded-xl text-xs font-bold hover:bg-brand-700 transition-all flex items-center space-x-1.5 cursor-pointer font-headline"
              >
                <UserPlus className="w-4 h-4 text-white" />
                <span>Thêm Học Viên</span>
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-surface-alt border-b border-line text-ink-muted font-bold">
                    <th className="p-3.5">Họ &amp; Tên Học Viên</th>
                    <th className="p-3.5">Email</th>
                    <th className="p-3.5">Số Điện Thoại</th>
                    <th className="p-3.5 text-center">Số Bài Nộp</th>
                    <th className="p-3.5 text-center">Điểm Gần Nhất</th>
                    <th className="p-3.5 text-right">Trạng Thái</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line/30">
                  {students.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="p-8 text-center text-xs text-ink-subtle">
                        Chưa có học sinh nào trong lớp. Nhấp "Thêm Học Viên" để thêm hoặc ghi danh học sinh.
                      </td>
                    </tr>
                  ) : (
                    students.map((st) => (
                      <tr key={st.id} className="hover:bg-surface-alt transition-colors">
                        <td className="p-3.5 font-bold text-ink">{st.name}</td>
                        <td className="p-3.5 text-brand-800">{st.email}</td>
                        <td className="p-3.5 text-ink-muted">{st.phone || "—"}</td>
                        <td className="p-3.5 text-center font-mono font-bold text-brand-600">
                          {st.submission_count ?? 0}
                        </td>
                        <td className="p-3.5 text-center">
                          {st.latest_total !== null && st.latest_total !== undefined ? (
                            <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-mono font-bold text-[11px]">
                              {st.latest_total}
                            </span>
                          ) : (
                            <span className="text-ink-subtle">—</span>
                          )}
                        </td>
                        <td className="p-3.5 text-right">
                          <div className="flex items-center justify-end space-x-2">
                            <span className="px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 text-[10px] font-bold">
                              {st.status || "ACTIVE"}
                            </span>
                            <ResetPasswordButton
                              userId={st.id}
                              userName={st.name}
                              role="TEACHER"
                            />
                          </div>
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
            <div className="bg-white rounded-3xl p-6 md:p-8 max-w-lg w-full shadow-2xl border border-line space-y-6 animate-in fade-in zoom-in-95">
              <div className="flex justify-between items-center border-b border-line/40 pb-4">
                <h2 className="text-xl font-bold text-brand-600 flex items-center space-x-2 font-headline">
                  <PlusCircle className="w-5 h-5 text-brand-600" />
                  <span>Giao Bài Thi Vào Lớp {cls?.name}</span>
                </h2>
                <button onClick={() => setShowAssignModal(false)} className="text-ink-subtle cursor-pointer">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleAssignExamToClass} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold uppercase text-brand-600 mb-1">
                    Chọn Đề Thi Từ Kho Đề (*)
                  </label>
                  <select
                    required
                    value={selectedExamId}
                    onChange={(e) => setSelectedExamId(e.target.value)}
                    className="w-full p-3 bg-surface-alt border border-line rounded-xl text-xs font-bold text-ink focus:outline-none focus:border-brand-600"
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
                  <label className="block text-xs font-bold uppercase text-ink mb-1">
                    Hạn Nộp Bài (Due Date) (*)
                  </label>
                  <input
                    type="date"
                    required
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    className="w-full p-3 bg-surface-alt border border-line rounded-xl text-xs font-bold text-ink focus:outline-none focus:border-brand-600"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase text-ink mb-1">
                    Số Lượt Nộp Bài Tối Đa
                  </label>
                  <select
                    value={maxAttempts}
                    onChange={(e) => setMaxAttempts(e.target.value)}
                    className="w-full p-3 bg-surface-alt border border-line rounded-xl text-xs font-bold text-ink focus:outline-none focus:border-brand-600"
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
                    className="flex-1 py-3 border border-line text-ink-muted rounded-xl text-xs font-medium hover:bg-surface-alt cursor-pointer"
                  >
                    Hủy
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="flex-1 py-3 bg-brand-600 hover:bg-brand-700 text-white rounded-xl text-xs font-bold shadow flex items-center justify-center space-x-2 disabled:opacity-50 cursor-pointer font-headline"
                  >
                    {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin text-white" /> : <Save className="w-4 h-4 text-white" />}
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
            <div className="bg-white rounded-3xl p-6 md:p-8 max-w-lg w-full shadow-2xl border border-line space-y-6 animate-in fade-in zoom-in-95">
              <div className="flex justify-between items-center border-b border-line/40 pb-4">
                <h2 className="text-xl font-bold text-brand-600 flex items-center space-x-2 font-headline">
                  <UserPlus className="w-5 h-5 text-brand-600" />
                  <span>Thêm Học Viên Vào Lớp {cls?.name}</span>
                </h2>
                <button onClick={() => setShowCreateStudentModal(false)} className="text-ink-subtle cursor-pointer">
                  <X className="w-5 h-5" />
                </button>
              </div>

              {studentErrorMsg && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs">
                  <p className="font-semibold">{studentErrorMsg}</p>
                  {isSlotError && (
                    <p className="mt-1">
                      <Link href="/teacher/slots" className="font-bold underline text-brand-600 hover:text-brand-700">
                        Mua slot
                      </Link>
                    </p>
                  )}
                </div>
              )}

              <form onSubmit={handleCreateStudentForThisClass} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold uppercase text-ink mb-1">
                    Họ &amp; Tên Học Sinh (*)
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Nguyễn Văn An"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full p-3 bg-surface-alt border border-line rounded-xl text-xs font-medium focus:outline-none focus:border-brand-600"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase text-ink mb-1">Email (*)</label>
                  <input
                    type="email"
                    required
                    placeholder="hocsinh@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full p-3 bg-surface-alt border border-line rounded-xl text-xs font-medium focus:outline-none focus:border-brand-600"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase text-ink mb-1">Số Điện Thoại (Tùy chọn)</label>
                  <input
                    type="tel"
                    placeholder="0912345678"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full p-3 bg-surface-alt border border-line rounded-xl text-xs font-medium focus:outline-none focus:border-brand-600"
                  />
                </div>

                <div className="pt-2 flex space-x-3">
                  <button
                    type="button"
                    onClick={() => setShowCreateStudentModal(false)}
                    className="flex-1 py-3 border border-line text-ink-muted rounded-xl text-xs font-medium hover:bg-surface-alt cursor-pointer"
                  >
                    Hủy
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="flex-1 py-3 bg-brand-600 hover:bg-brand-700 text-white rounded-xl text-xs font-medium shadow flex items-center justify-center space-x-2 disabled:opacity-50 cursor-pointer font-headline"
                  >
                    {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin text-white" /> : <Save className="w-4 h-4 text-white" />}
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
            <div className="bg-white rounded-3xl p-6 md:p-8 max-w-2xl w-full shadow-2xl border border-line space-y-6 max-h-[85vh] overflow-y-auto animate-in fade-in zoom-in-95">
              <div className="flex justify-between items-center border-b border-line/40 pb-4">
                <h2 className="text-xl font-bold text-brand-600 flex items-center space-x-2 font-headline">
                  <Eye className="w-5 h-5 text-brand-600" />
                  <span>Xem Nhanh Đề Thi: {previewExam.title}</span>
                </h2>
                <button onClick={() => setPreviewExam(null)} className="text-ink-subtle cursor-pointer">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-4 text-xs">
                <div className="flex items-center space-x-3">
                  <span className="px-3 py-1 bg-brand-50 text-brand-600 border border-brand-300 rounded-lg font-mono font-bold">
                    Thời gian: {previewExam.duration_minutes || 60} phút
                  </span>
                  <span className="px-3 py-1 bg-purple-100 text-purple-900 border border-purple-300 rounded-lg font-mono font-bold">
                    Kỹ năng: {(previewExam.skills || ["Writing", "Speaking"]).join(", ")}
                  </span>
                </div>

                <div className="p-4 bg-surface-alt rounded-2xl border border-line space-y-2">
                  <h4 className="font-bold text-brand-600 uppercase text-[11px] tracking-wider">Cấu trúc bài thi:</h4>
                  <p className="text-ink-muted leading-relaxed">
                    Bài thi bao gồm các phần tự luận Writing và ghi âm trực tiếp Speaking được liên kết với tiêu chí chấm điểm AI chuẩn quốc tế.
                  </p>
                </div>
              </div>

              <div className="pt-4 flex justify-between items-center border-t border-line/40">
                <button
                  onClick={() => setPreviewExam(null)}
                  className="px-5 py-2.5 border border-line text-ink-muted rounded-xl text-xs font-bold hover:bg-surface-alt cursor-pointer"
                >
                  Đóng
                </button>

                <Link
                  href={`/teacher/tests/create?editId=${previewExam.id}`}
                  className="px-5 py-2.5 bg-brand-600 text-white hover:bg-brand-700 rounded-xl text-xs font-bold flex items-center space-x-1.5 transition-all shadow cursor-pointer font-headline"
                >
                  <Edit3 className="w-4 h-4 text-white" />
                  <span>Mở Trình Sửa Đề Thi trong Exam Builder &rarr;</span>
                </Link>
              </div>
            </div>
          </div>
        )}
      </div>
    </TeacherLayout>
  );
}
