"use client";

import { useState, useEffect } from "react";
import AdminLayout from "@/components/AdminLayout";
import Link from "next/link";
import { useParams } from "next/navigation";
import { GraduationCap, Edit3, BookOpen, Loader2, CheckCircle2, ArrowLeft, FileText, X, Clock, AlertCircle } from "lucide-react";
import { submissionScore, formatScore, SubmissionScoreResult } from "@/lib/score-display";

interface StudentDetail {
  id: string;
  name: string;
  email: string;
  phone?: string;
  target_band?: string;
  created_at: string;
}

interface EnrolledClass {
  id: string;
  name: string;
  code: string;
  teacher_name: string;
}

interface SubmissionItem {
  id: string;
  exam_title: string;
  scoreInfo: SubmissionScoreResult;
  submitted_at: string;
  status: string;
}

export default function AdminStudentDetailPage() {
  const params = useParams();
  const studentId = (params?.id || "student_01") as string;

  const [student, setStudent] = useState<StudentDetail | null>(null);
  const [enrolledClasses, setEnrolledClasses] = useState<EnrolledClass[]>([]);
  const [submissions, setSubmissions] = useState<SubmissionItem[]>([]);
  const [classList, setClassList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Edit Modals
  const [showEditInfoModal, setShowEditInfoModal] = useState(false);
  const [showEditClassesModal, setShowEditClassesModal] = useState(false);

  // Form State
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [targetBand, setTargetBand] = useState("IELTS 7.5");
  const [selectedClassIds, setSelectedClassIds] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchStudentData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [resUser, resClasses] = await Promise.all([
        fetch(`/api/admin/users/${studentId}`),
        fetch("/api/admin/classes"),
      ]);

      const dataUser = await resUser.json();
      const dataClasses = await resClasses.json();

      if (!resUser.ok || !dataUser.user) {
        setError(dataUser.error || "Không thể tải thông tin học sinh.");
        return;
      }

      const allClasses = dataClasses.classes || [];
      setClassList(allClasses);

      const u = dataUser.user;
      const sObj: StudentDetail = {
        id: u.id,
        name: u.name,
        email: u.email,
        phone: u.phone || "0912345678",
        target_band: u.target_band || "IELTS 7.5",
        created_at: new Date(u.created_at).toLocaleDateString("vi-VN"),
      };
      setStudent(sObj);
      setName(sObj.name);
      setEmail(sObj.email);
      setPhone(sObj.phone || "");
      setTargetBand(sObj.target_band || "IELTS 7.5");

      const userClasses = dataUser.classes || [];
      const enrolledIds = userClasses.map((c: any) => c.id);
      setSelectedClassIds(enrolledIds);

      const classTeacherMap: Record<string, string> = {};
      allClasses.forEach((c: any) => {
        classTeacherMap[c.id] = c.teacher_name || "Giảng viên phụ trách";
      });

      setEnrolledClasses(
        userClasses.map((c: any) => ({
          id: c.id,
          name: c.name,
          code: c.code,
          teacher_name: classTeacherMap[c.id] || "Giảng viên phụ trách",
        }))
      );

      setSubmissions(
        (dataUser.submissions || []).map((s: any) => ({
          id: s.id,
          exam_title: s.exam_title || s.title || "Đề thi IELTS Mock Test",
          scoreInfo: submissionScore(s),
          submitted_at: new Date(s.submitted_at || s.created_at || Date.now()).toLocaleDateString("vi-VN"),
          status: s.status || "TEACHER_VERIFIED",
        }))
      );
    } catch (e: any) {
      console.error(e);
      setError(e.message || "Lỗi hệ thống khi tải thông tin học sinh.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStudentData();
  }, [studentId]);

  const toggleClassSelection = (classId: string) => {
    if (selectedClassIds.includes(classId)) {
      setSelectedClassIds(selectedClassIds.filter((id) => id !== classId));
    } else {
      setSelectedClassIds([...selectedClassIds, classId]);
    }
  };

  const handleSaveInfo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/admin/users/${studentId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          phone: phone.trim(),
          target_band: targetBand.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        alert("Lỗi khi cập nhật thông tin: " + (data.error || "Không rõ lỗi"));
        return;
      }

      setSuccessMsg("Đã cập nhật thông tin cá nhân học viên!");
      setShowEditInfoModal(false);
      fetchStudentData();
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (e: any) {
      console.error(e);
      alert("Lỗi kết nối khi cập nhật thông tin học sinh.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSaveClasses = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/admin/users/${studentId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          class_ids: selectedClassIds,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        alert("Lỗi khi gán lớp học: " + (data.error || "Không rõ lỗi"));
        return;
      }

      setSuccessMsg("Đã cập nhật danh sách lớp học ghi danh!");
      setShowEditClassesModal(false);
      fetchStudentData();
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (e: any) {
      console.error(e);
      alert("Lỗi kết nối khi gán lớp học.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <AdminLayout>
        <div className="flex items-center space-x-2 text-xs text-[#52443a] p-12 bg-white rounded-2xl border border-[#d8c2b6] max-w-4xl mx-auto my-8">
          <Loader2 className="w-4 h-4 animate-spin text-[#6d3807]" />
          <span>Đang nạp thông tin học sinh từ PostgreSQL...</span>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="max-w-[1280px] mx-auto space-y-8 font-sans">
        {/* Header */}
        <div className="border-b border-[#d8c2b6]/40 pb-6 flex flex-col md:flex-row justify-between md:items-center gap-4">
          <div>
            <Link href="/admin/students" className="text-xs text-[#6d3807] hover:underline flex items-center mb-2 font-medium">
              <ArrowLeft className="w-4 h-4 mr-1 text-[#6d3807]" />
               Quay lại Danh sách Học sinh
            </Link>
            <h1 className="text-3xl font-bold text-[#211a16] tracking-tight flex items-center space-x-3">
              <span>{student?.name}</span>
              <span className="px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 text-xs font-bold">
                STUDENT
              </span>
            </h1>
            <p className="text-sm text-[#52443a] mt-1">
              Hồ sơ học viên chi tiết &bull; ID: <strong className="text-[#004d5e]">{student?.id}</strong>
            </p>
          </div>
        </div>

        {successMsg && (
          <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 flex items-center space-x-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-600" />
            <span className="text-xs font-bold">{successMsg}</span>
          </div>
        )}

        {error && (
          <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
              <span className="text-xs font-bold">{error}</span>
            </div>
            <button
              onClick={fetchStudentData}
              className="px-3 py-1.5 bg-rose-600 text-white rounded-lg text-xs font-medium hover:bg-rose-700"
            >
              Thử lại
            </button>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column: Basic Info Card */}
          <div className="space-y-6">
            <div className="bg-white p-6 rounded-3xl border border-[#d8c2b6] shadow-sm space-y-4">
              <div className="flex justify-between items-center border-b border-[#d8c2b6]/40 pb-3">
                <h2 className="text-base font-bold text-[#6d3807] flex items-center space-x-2">
                  <GraduationCap className="w-5 h-5 text-[#6d3807]" />
                  <span>Thông Tin Cơ Bản</span>
                </h2>
                <button
                  onClick={() => setShowEditInfoModal(true)}
                  className="px-3 py-1.5 bg-[#fff8f5] text-[#6d3807] border border-[#d8c2b6] rounded-xl text-xs font-medium hover:bg-[#f9ebe4]"
                >
                  <Edit3 className="w-3.5 h-3.5 inline mr-1" />
                  Sửa
                </button>
              </div>

              <div className="space-y-2.5 text-xs text-[#211a16]">
                <p>
                  <span className="text-[#857469]">Họ &amp; Tên:</span> <strong className="block text-sm text-[#211a16]">{student?.name}</strong>
                </p>
                <p>
                  <span className="text-[#857469]">Email Đăng Nhập:</span> <strong className="block text-[#004d5e]">{student?.email}</strong>
                </p>
                <p>
                  <span className="text-[#857469]">Số Điện Thoại:</span> <strong className="block">{student?.phone}</strong>
                </p>
                <p>
                  <span className="text-[#857469]">Mục Tiêu Band Điểm:</span> <strong className="block text-[#6d3807]">{student?.target_band}</strong>
                </p>
                <p>
                  <span className="text-[#857469]">Ngày Tham Gia:</span> <span className="block text-[#52443a]">{student?.created_at}</span>
                </p>
              </div>
            </div>
          </div>

          {/* Right Column: Enrolled Courses/Classes & Exam Submissions */}
          <div className="lg:col-span-2 space-y-6">
            {/* Enrolled Courses / Classes List */}
            <div className="bg-white p-6 rounded-3xl border border-[#d8c2b6] shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-[#d8c2b6]/40 pb-3">
                <h2 className="text-base font-bold text-[#6d3807] flex items-center space-x-2">
                  <BookOpen className="w-5 h-5 text-[#6d3807]" />
                  <span>Các Khóa Học / Lớp Học Đã Tham Gia ({enrolledClasses.length} Lớp)</span>
                </h2>
                <button
                  onClick={() => setShowEditClassesModal(true)}
                  className="px-3 py-1.5 bg-[#fff1ea] text-[#6d3807] border border-[#ffb782] rounded-xl text-xs font-bold hover:bg-[#ffdcc5]"
                >
                  Gán / Sửa Lớp
                </button>
              </div>

              <div className="space-y-3">
                {enrolledClasses.length === 0 ? (
                  <p className="text-xs text-[#52443a] italic p-4 bg-[#fff8f5] rounded-2xl border border-[#d8c2b6]">Học viên chưa ghi danh vào lớp học nào.</p>
                ) : (
                  enrolledClasses.map((c) => (
                    <div key={c.id} className="p-4 rounded-2xl border border-[#d8c2b6] bg-[#fff8f5] flex items-center justify-between">
                      <div>
                        <span className="px-2.5 py-0.5 rounded bg-[#fff1ea] text-[#6d3807] border border-[#ffb782] text-[10px] font-bold">
                          Mã Lớp: {c.code}
                        </span>
                        <h3 className="text-base font-bold text-[#211a16] mt-1">{c.name}</h3>
                        <p className="text-xs text-[#52443a]">Giảng viên: {c.teacher_name}</p>
                      </div>

                      <span className="text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-1 rounded-full">
                        Đang Học Active
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Exam Submissions & Band Scores History */}
            <div className="bg-white p-6 rounded-3xl border border-[#d8c2b6] shadow-sm space-y-4">
              <h2 className="text-base font-bold text-[#6d3807] flex items-center space-x-2 border-b border-[#d8c2b6]/40 pb-3">
                <FileText className="w-5 h-5 text-[#6d3807]" />
                <span>Lịch Sử Bài Thi &amp; Điểm Số ({submissions.length} Bài)</span>
              </h2>

              <div className="space-y-3">
                {submissions.length === 0 ? (
                  <p className="text-xs text-[#52443a] italic p-4 bg-[#fff8f5] rounded-2xl border border-[#d8c2b6]">Học viên chưa nộp bài thi nào.</p>
                ) : (
                  submissions.map((sub) => {
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

                    return (
                      <div key={sub.id} className="p-4 rounded-2xl border border-[#d8c2b6] bg-white flex items-center justify-between">
                        <div>
                          <h3 className="text-sm font-bold text-[#211a16]">{sub.exam_title}</h3>
                          <p className="text-xs text-[#857469] flex items-center mt-1">
                            <Clock className="w-3.5 h-3.5 mr-1" /> Nộp bài: {sub.submitted_at}
                          </p>
                        </div>

                        <div className="text-right">
                          <span className="text-xs text-[#52443a] block">Điểm số:</span>
                          <span className="text-xl font-bold text-[#6d3807]">{scoreDisplay}</span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Modal: Edit Student Info */}
        {showEditInfoModal && (
          <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 font-sans">
            <div className="bg-white rounded-3xl p-6 md:p-8 max-w-lg w-full shadow-2xl border border-[#d8c2b6] space-y-6 animate-in fade-in zoom-in-95">
              <div className="flex justify-between items-center border-b border-[#d8c2b6]/40 pb-4">
                <h2 className="text-xl font-bold text-[#6d3807]">Sửa Thông Tin Cơ Bản Học Sinh</h2>
                <button onClick={() => setShowEditInfoModal(false)} className="text-[#857469]">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSaveInfo} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold uppercase text-[#211a16] mb-1">Họ &amp; Tên (*)</label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full px-3 py-2.5 bg-[#fff8f5] border border-[#d8c2b6] rounded-xl text-sm focus:outline-none focus:border-[#6d3807]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase text-[#211a16] mb-1">Email Đăng Nhập</label>
                  <input
                    type="email"
                    disabled
                    value={email}
                    className="w-full px-3 py-2.5 bg-[#f0eae5] border border-[#d8c2b6] rounded-xl text-sm opacity-70 cursor-not-allowed"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase text-[#211a16] mb-1">Số Điện Thoại</label>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full px-3 py-2.5 bg-[#fff8f5] border border-[#d8c2b6] rounded-xl text-sm focus:outline-none focus:border-[#6d3807]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase text-[#211a16] mb-1">Mục Tiêu Band Điểm</label>
                  <input
                    type="text"
                    value={targetBand}
                    onChange={(e) => setTargetBand(e.target.value)}
                    className="w-full px-3 py-2.5 bg-[#fff8f5] border border-[#d8c2b6] rounded-xl text-sm focus:outline-none focus:border-[#6d3807]"
                  />
                </div>

                <div className="pt-2 flex space-x-3">
                  <button type="button" onClick={() => setShowEditInfoModal(false)} className="flex-1 py-3 border border-[#d8c2b6] text-[#52443a] rounded-xl text-xs font-medium">Hủy</button>
                  <button type="submit" disabled={isSubmitting} className="flex-1 py-3 bg-[#6d3807] text-white rounded-xl text-xs font-medium shadow">Lưu Thay Đổi</button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal: Edit Enrolled Classes */}
        {showEditClassesModal && (
          <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 font-sans">
            <div className="bg-white rounded-3xl p-6 md:p-8 max-w-lg w-full shadow-2xl border border-[#d8c2b6] space-y-6 animate-in fade-in zoom-in-95">
              <div className="flex justify-between items-center border-b border-[#d8c2b6]/40 pb-4">
                <h2 className="text-xl font-bold text-[#6d3807]">Gán Danh Sách Lớp Học Ghi Danh</h2>
                <button onClick={() => setShowEditClassesModal(false)} className="text-[#857469]">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSaveClasses} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold uppercase text-[#6d3807] mb-2">
                    Chọn Các Lớp Học Học Sinh Tham Gia Học
                  </label>
                  <div className="space-y-2 max-h-52 overflow-y-auto p-3 bg-[#fff1ea] border border-[#ffb782] rounded-xl">
                    {classList.map((cls) => (
                      <label key={cls.id} className="flex items-center space-x-2 text-xs font-medium cursor-pointer p-1.5 rounded hover:bg-white">
                        <input
                          type="checkbox"
                          checked={selectedClassIds.includes(cls.id)}
                          onChange={() => toggleClassSelection(cls.id)}
                          className="accent-[#6d3807] rounded"
                        />
                        <span className="text-[#211a16]">{cls.name} ({cls.code})</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div className="pt-2 flex space-x-3">
                  <button type="button" onClick={() => setShowEditClassesModal(false)} className="flex-1 py-3 border border-[#d8c2b6] text-[#52443a] rounded-xl text-xs font-medium">Hủy</button>
                  <button type="submit" disabled={isSubmitting} className="flex-1 py-3 bg-[#6d3807] text-white rounded-xl text-xs font-medium shadow">Lưu Ghi Danh</button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
