"use client";

import { useState, useEffect } from "react";
import AdminLayout from "@/components/AdminLayout";
import Link from "next/link";
import { useParams } from "next/navigation";

import {
  UserCheck,
  Edit3,
  BookOpen,
  Loader2,
  CheckCircle2,
  Award,
  ArrowLeft,
  Cpu,
  X,
  Zap,
} from "lucide-react";

interface TeacherDetail {
  id: string;
  name: string;
  email: string;
  phone?: string;
  target_band?: string;
  created_at: string;
  slot_limit: number;
}

interface ManagedClass {
  id: string;
  name: string;
  code: string;
  schedule: string;
  student_count: number;
}

interface AILogRecord {
  id: string;
  teacher_id: string;
  student_id: string;
  submission_id: string;
  model: string;
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
  cost_usd: number;
  created_at: string;
}

export default function AdminTeacherDetailPage() {
  const params = useParams();
  const rawId = params?.id;
  const teacherId = (Array.isArray(rawId) ? rawId[0] : rawId) || "";

  const [teacher, setTeacher] = useState<TeacherDetail | null>(null);
  const [classes, setClasses] = useState<ManagedClass[]>([]);
  const [aiLogs, setAiLogs] = useState<AILogRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isTestingPortkey, setIsTestingPortkey] = useState(false);

  // Edit Modals
  const [showEditInfoModal, setShowEditInfoModal] = useState(false);
  const [showEditSlotModal, setShowEditSlotModal] = useState(false);

  // Edit Form state
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [qualification, setQualification] = useState("");
  const [slotLimit, setSlotLimit] = useState(250);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchTeacherData = async () => {
    if (!teacherId) return;
    setLoading(true);
    setNotFound(false);
    try {
      const res = await fetch(`/api/admin/teachers/${teacherId}`);
      const data = await res.json();

      if (!res.ok || !data.success || !data.teacher) {
        setNotFound(true);
        setTeacher(null);
        setClasses([]);
        setAiLogs([]);
        return;
      }

      const tObj: TeacherDetail = data.teacher;
      setTeacher(tObj);
      setName(tObj.name);
      setEmail(tObj.email);
      setPhone(tObj.phone || "");
      setQualification(tObj.target_band || "");
      setSlotLimit(tObj.slot_limit || 250);

      setClasses(data.classes || []);
      setAiLogs(data.aiLogs || []);
    } catch (e: any) {
      console.error(e);
      setErrorMsg("Đã xảy ra lỗi khi nạp thông tin giảng viên.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTeacherData();
  }, [teacherId]);

  // Compute 100% REAL totals from PostgreSQL ai_usage_logs
  const totalRealTokens = aiLogs.reduce((sum, log) => sum + log.total_tokens, 0);
  const totalRealRequests = aiLogs.length;
  const totalRealCostUsd = aiLogs.reduce((sum, log) => sum + log.cost_usd, 0);

  const usedSlotsCount = classes.reduce((sum, c) => sum + c.student_count, 0);
  const totalSlotLimit = teacher?.slot_limit || 250;
  const remainingSlots = Math.max(0, totalSlotLimit - usedSlotsCount);

  // Real Portkey Gateway Live Test Call via Server API Route
  const handleTestPortkeyLive = async () => {
    if (!teacher) return;
    setIsTestingPortkey(true);
    try {
      const apiRes = await fetch("/api/admin/test-portkey", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          teacherId: teacher.id,
          userPrompt: "Analyze this sample IELTS essay: 'Task 2: Some people think that universities should provide graduates with knowledge and skills needed in the workplace.'",
          studentId: "student_01",
          submissionId: `test_sub_${Date.now().toString().slice(-4)}`,
        }),
      });

      const res = await apiRes.json();
      if (!apiRes.ok || !res.success) {
        alert("Lỗi kết nối Portkey Gateway: " + (res.error || "Không thể gửi request"));
        return;
      }

      if (res.isSimulated) {
        setSuccessMsg(
          `Đã chạy thử nghiệm Portkey Gateway (Chế độ Simulation)! Tiêu thụ ${res.usage.totalTokens} tokens ($${res.usage.costUsd} USD) và đã ghi nhật ký vào PostgreSQL. (Để kết nối API live thực tế, hãy thêm PORTKEY_API_KEY vào .env.local).`
        );
      } else {
        setSuccessMsg(
          `Đã gọi LIVE Portkey AI Gateway thành công! Tiêu thụ ${res.usage.totalTokens} tokens ($${res.usage.costUsd} USD) và ghi nhật ký trực tiếp vào CSDL.`
        );
      }

      fetchTeacherData();
      setTimeout(() => setSuccessMsg(null), 6000);
    } catch (err: any) {
      console.error(err);
      alert("Lỗi kết nối Portkey Gateway: " + (err.message || err));
    } finally {
      setIsTestingPortkey(false);
    }
  };

  const handleSaveInfo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim()) return;

    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/admin/teachers/${teacherId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          phone: phone.trim(),
          target_band: qualification.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        alert("Lỗi cập nhật: " + (data.error || "Không thể lưu thông tin."));
        return;
      }

      setSuccessMsg("Đã cập nhật thành công thông tin giảng viên!");
      setShowEditInfoModal(false);
      fetchTeacherData();
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (e) {
      console.error(e);
      alert("Lỗi hệ thống khi cập nhật thông tin.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSaveSlotLimit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/admin/teachers/${teacherId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slot_limit: slotLimit,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        alert("Lỗi cập nhật slot: " + (data.error || "Không thể thay đổi slot."));
        return;
      }

      setSuccessMsg(`Đã điều chỉnh hạn mức sĩ số slot thành ${slotLimit} học viên!`);
      setShowEditSlotModal(false);
      fetchTeacherData();
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (e) {
      console.error(e);
      alert("Lỗi hệ thống khi điều chỉnh slot.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center space-x-2 text-xs text-[#52443a] p-12 bg-white rounded-2xl border border-[#d8c2b6] max-w-4xl mx-auto my-8">
          <Loader2 className="w-5 h-5 animate-spin text-[#6d3807]" />
          <span>Đang nạp thông tin giảng viên &amp; Portkey Logs từ PostgreSQL...</span>
        </div>
      </AdminLayout>
    );
  }

  if (notFound || !teacher) {
    return (
      <AdminLayout>
        <div className="max-w-xl mx-auto my-12 p-8 bg-white rounded-3xl border border-[#d8c2b6] text-center space-y-4 shadow-sm font-sans">
          <div className="w-12 h-12 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center mx-auto border border-rose-200">
            <X className="w-6 h-6" />
          </div>
          <h2 className="text-xl font-bold text-[#211a16]">Không tìm thấy thông tin Giảng viên</h2>
          <p className="text-xs text-[#52443a]">
            Tài khoản giảng viên ID <strong className="text-[#6d3807]">{teacherId}</strong> không tồn tại hoặc đã bị xóa khỏi CSDL PostgreSQL.
          </p>
          <Link
            href="/admin/teachers"
            className="inline-flex items-center space-x-2 px-5 py-2.5 bg-[#6d3807] text-white text-xs font-bold rounded-xl hover:bg-[#8a4f1e] transition-all"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Quay lại Danh sách Giáo viên</span>
          </Link>
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
            <Link href="/admin/teachers" className="text-xs text-[#6d3807] hover:underline flex items-center mb-2 font-medium">
              <ArrowLeft className="w-4 h-4 mr-1 text-[#6d3807]" />
              Quay lại Danh sách Giáo viên
            </Link>
            <h1 className="text-3xl font-bold text-[#211a16] tracking-tight flex items-center space-x-3">
              <span>{teacher.name}</span>
              <span className="px-3 py-1 rounded-full bg-[#fff1ea] text-[#6d3807] text-xs font-bold border border-[#ffb782]">
                TEACHER
              </span>
            </h1>
            <p className="text-sm text-[#52443a] mt-1">
              Hồ sơ quản lý giảng viên chi tiết &bull; ID: <strong className="text-[#004d5e]">{teacher.id}</strong>
            </p>
          </div>

          <button
            onClick={handleTestPortkeyLive}
            disabled={isTestingPortkey}
            className="px-5 py-2.5 bg-[#004d5e] hover:bg-[#003845] text-white text-xs font-bold rounded-xl shadow transition-all flex items-center space-x-2 shrink-0 disabled:opacity-50"
          >
            {isTestingPortkey ? (
              <Loader2 className="w-4 h-4 animate-spin text-white" />
            ) : (
              <Zap className="w-4 h-4 text-emerald-300" />
            )}
            <span>Test Portkey Live Call</span>
          </button>
        </div>

        {successMsg && (
          <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 flex items-center space-x-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            <span className="text-xs font-bold">{successMsg}</span>
          </div>
        )}

        {errorMsg && (
          <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 flex items-center space-x-2">
            <X className="w-5 h-5 text-rose-600 shrink-0" />
            <span className="text-xs font-bold">{errorMsg}</span>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column: Basic Info & Slot Capacity */}
          <div className="space-y-6">
            {/* Basic Info Card */}
            <div className="bg-white p-6 rounded-3xl border border-[#d8c2b6] shadow-sm space-y-4">
              <div className="flex justify-between items-center border-b border-[#d8c2b6]/40 pb-3">
                <h2 className="text-base font-bold text-[#6d3807] flex items-center space-x-2">
                  <UserCheck className="w-5 h-5 text-[#6d3807]" />
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
                  <span className="text-[#857469]">Họ &amp; Tên:</span> <strong className="block text-sm text-[#211a16]">{teacher.name}</strong>
                </p>
                <p>
                  <span className="text-[#857469]">Email:</span> <strong className="block text-[#004d5e]">{teacher.email}</strong>
                </p>
                <p>
                  <span className="text-[#857469]">Số điện thoại:</span> <strong className="block">{teacher.phone || "Chưa cập nhật"}</strong>
                </p>
                <p>
                  <span className="text-[#857469]">Bằng cấp / Trình độ:</span> <strong className="block text-[#6d3807]">{teacher.target_band || "Chưa cập nhật"}</strong>
                </p>
                <p>
                  <span className="text-[#857469]">Ngày tham gia:</span> <span className="block text-[#52443a]">{teacher.created_at}</span>
                </p>
              </div>
            </div>

            {/* Slot Capacity Card */}
            <div className="bg-white p-6 rounded-3xl border border-[#d8c2b6] shadow-sm space-y-4">
              <div className="flex justify-between items-center border-b border-[#d8c2b6]/40 pb-3">
                <h2 className="text-base font-bold text-[#6d3807] flex items-center space-x-2">
                  <Award className="w-5 h-5 text-[#6d3807]" />
                  <span>Hạn Mức Sĩ Số Slots</span>
                </h2>
                <button
                  onClick={() => setShowEditSlotModal(true)}
                  className="px-3 py-1.5 bg-[#fff1ea] text-[#6d3807] border border-[#ffb782] rounded-xl text-xs font-bold hover:bg-[#ffdcc5]"
                >
                  Sửa Slot
                </button>
              </div>

              <div className="grid grid-cols-3 gap-3 text-center">
                <div className="p-3 bg-[#fff8f5] rounded-xl border border-[#d8c2b6]">
                  <span className="text-[10px] text-[#857469] font-bold block uppercase">Tổng Slot</span>
                  <span className="text-lg font-bold text-[#6d3807]">{totalSlotLimit}</span>
                </div>
                <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200">
                  <span className="text-[10px] text-emerald-800 font-bold block uppercase">Đã Dùng</span>
                  <span className="text-lg font-bold text-emerald-700">{usedSlotsCount}</span>
                </div>
                <div className="p-3 bg-blue-50 rounded-xl border border-blue-200">
                  <span className="text-[10px] text-blue-800 font-bold block uppercase">Còn Lại</span>
                  <span className="text-lg font-bold text-blue-700">{remainingSlots}</span>
                </div>
              </div>

              {/* Progress bar */}
              <div>
                <div className="flex justify-between text-xs text-[#52443a] mb-1 font-medium">
                  <span>Tỷ lệ sử dụng slot:</span>
                  <span>{Math.round((usedSlotsCount / totalSlotLimit) * 100)}%</span>
                </div>
                <div className="w-full bg-[#fff8f5] h-2.5 rounded-full overflow-hidden border border-[#d8c2b6]">
                  <div
                    className="bg-[#6d3807] h-full rounded-full transition-all"
                    style={{ width: `${Math.min(100, (usedSlotsCount / totalSlotLimit) * 100)}%` }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Real Portkey AI Analytics & Managed Classes */}
          <div className="lg:col-span-2 space-y-6">
            {/* Real Portkey AI Token Usage Analytics Section */}
            <div className="bg-white p-6 rounded-3xl border border-[#d8c2b6] shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-[#d8c2b6]/40 pb-3">
                <div>
                  <h2 className="text-base font-bold text-[#6d3807] flex items-center space-x-2">
                    <Cpu className="w-5 h-5 text-[#6d3807]" />
                    <span>Mức Độ Sử Dụng AI Token (Real PostgreSQL &amp; Portkey Logs)</span>
                  </h2>
                  <p className="text-xs text-[#52443a] mt-0.5">
                    Dữ liệu token tiêu thụ thực tế được gửi qua Portkey Gateway và ghi log trực tiếp vào DB.
                  </p>
                </div>
                <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold">
                  Gateway Live Verified
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="p-4 bg-[#fff1ea] rounded-2xl border border-[#ffb782] space-y-1">
                  <span className="text-xs text-[#52443a] font-medium block">Tổng Real Tokens Đã Dùng:</span>
                  <span className="text-xl font-bold text-[#6d3807] block">{totalRealTokens.toLocaleString("vi-VN")} tokens</span>
                  <span className="text-[10px] text-[#857469] block">Model: Portkey AI Gateway</span>
                </div>

                <div className="p-4 bg-[#fff8f5] rounded-2xl border border-[#d8c2b6] space-y-1">
                  <span className="text-xs text-[#52443a] font-medium block">Tổng Lượt Request Thực Tế:</span>
                  <span className="text-xl font-bold text-[#004d5e] block">{totalRealRequests} Requests</span>
                  <span className="text-[10px] text-[#857469] block">Lưu vết trong PostgreSQL</span>
                </div>

                <div className="p-4 bg-[#fff8f5] rounded-2xl border border-[#d8c2b6] space-y-1">
                  <span className="text-xs text-[#52443a] font-medium block">Tổng Chi Phí Ước Tính:</span>
                  <span className="text-xl font-bold text-[#211a16] block">${totalRealCostUsd.toFixed(4)} USD</span>
                  <span className="text-[10px] text-emerald-700 block font-bold">&check; Portkey Metadata Tracked</span>
                </div>
              </div>

              {/* Real Logs Table */}
              <div className="mt-4 pt-4 border-t border-[#d8c2b6]/30 space-y-3">
                <h3 className="text-xs font-bold text-[#211a16] uppercase tracking-wider">
                  Nhật Ký Gọi Portkey Gateway Thực Tế (PostgreSQL `ai_usage_logs`)
                </h3>

                {aiLogs.length === 0 ? (
                  <div className="p-6 text-center border border-dashed border-[#d8c2b6] rounded-2xl bg-[#fff8f5]">
                    <p className="text-xs text-[#52443a]">Chưa có nhật ký gọi AI Portkey nào cho giáo viên này. Bấm nút <strong>"Test Portkey Live Call"</strong> ở góc trên để chạy thử request live!</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto rounded-xl border border-[#d8c2b6]">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="bg-[#fff8f5] border-b border-[#d8c2b6] font-bold text-[#52443a]">
                          <th className="p-3">Thời Gian Request</th>
                          <th className="p-3">Mô Hình AI (Model)</th>
                          <th className="p-3">Prompt / Completion</th>
                          <th className="p-3">Tổng Tokens</th>
                          <th className="p-3 text-right">Chi Phí (USD)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#d8c2b6]/30">
                        {aiLogs.map((log) => (
                          <tr key={log.id} className="hover:bg-[#fff8f5]">
                            <td className="p-3 font-medium text-[#211a16]">{log.created_at}</td>
                            <td className="p-3 text-[#004d5e] font-semibold">{log.model}</td>
                            <td className="p-3 text-[#857469]">
                              {log.prompt_tokens} in / {log.completion_tokens} out
                            </td>
                            <td className="p-3 font-bold text-[#6d3807]">
                              {log.total_tokens.toLocaleString("vi-VN")} tokens
                            </td>
                            <td className="p-3 text-right font-mono font-bold text-emerald-800">
                              ${log.cost_usd.toFixed(4)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>

            {/* Managed Classes Section */}
            <div className="bg-white p-6 rounded-3xl border border-[#d8c2b6] shadow-sm space-y-4">
              <h2 className="text-base font-bold text-[#6d3807] flex items-center space-x-2 border-b border-[#d8c2b6]/40 pb-3">
                <BookOpen className="w-5 h-5 text-[#6d3807]" />
                <span>Các Lớp Học Đang Quản Lý ({classes.length} Lớp)</span>
              </h2>

              {classes.length === 0 ? (
                <div className="p-6 text-center border border-dashed border-[#d8c2b6] rounded-2xl bg-[#fff8f5]">
                  <p className="text-xs text-[#52443a]">Giảng viên này hiện chưa được phân công quản lý lớp học nào.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {classes.map((c) => (
                    <div key={c.id} className="p-4 rounded-2xl border border-[#d8c2b6] bg-[#fff8f5] flex items-center justify-between">
                      <div>
                        <span className="px-2.5 py-0.5 rounded bg-[#fff1ea] text-[#6d3807] border border-[#ffb782] text-[10px] font-bold">
                          Mã Lớp: {c.code}
                        </span>
                        <h3 className="text-base font-bold text-[#211a16] mt-1">{c.name}</h3>
                        <p className="text-xs text-[#52443a]">Lịch học: {c.schedule}</p>
                      </div>

                      <div className="text-right">
                        <span className="text-xs text-[#52443a] block">Sĩ số học viên:</span>
                        <span className="text-lg font-bold text-[#6d3807]">{c.student_count} Học viên</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Modal: Edit Basic Info */}
        {showEditInfoModal && (
          <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 font-sans">
            <div className="bg-white rounded-3xl p-6 md:p-8 max-w-lg w-full shadow-2xl border border-[#d8c2b6] space-y-6 animate-in fade-in zoom-in-95">
              <div className="flex justify-between items-center border-b border-[#d8c2b6]/40 pb-4">
                <h2 className="text-xl font-bold text-[#6d3807]">Sửa Thông Tin Cơ Bản Giáo Viên</h2>
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
                  <label className="block text-xs font-bold uppercase text-[#211a16] mb-1">Email (*)</label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full px-3 py-2.5 bg-[#fff8f5] border border-[#d8c2b6] rounded-xl text-sm focus:outline-none focus:border-[#6d3807]"
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
                  <label className="block text-xs font-bold uppercase text-[#211a16] mb-1">Trình Độ / Bằng Cấp</label>
                  <input
                    type="text"
                    value={qualification}
                    onChange={(e) => setQualification(e.target.value)}
                    className="w-full px-3 py-2.5 bg-[#fff8f5] border border-[#d8c2b6] rounded-xl text-sm focus:outline-none focus:border-[#6d3807]"
                  />
                </div>

                <div className="pt-2 flex space-x-3">
                  <button type="button" onClick={() => setShowEditInfoModal(false)} className="flex-1 py-3 border border-[#d8c2b6] text-[#52443a] rounded-xl text-xs font-medium">Hủy</button>
                  <button type="submit" disabled={isSubmitting} className="flex-1 py-3 bg-[#6d3807] text-[#ffffff] rounded-xl text-xs font-medium shadow">
                    {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin mx-auto text-white" /> : "Lưu Thay Đổi"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal: Edit Slot Capacity */}
        {showEditSlotModal && (
          <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 font-sans">
            <div className="bg-white rounded-3xl p-6 md:p-8 max-w-md w-full shadow-2xl border border-[#d8c2b6] space-y-6 animate-in fade-in zoom-in-95">
              <div className="flex justify-between items-center border-b border-[#d8c2b6]/40 pb-4">
                <h2 className="text-xl font-bold text-[#6d3807]">Sửa Hạn Mức Slot Giảng Viên</h2>
                <button onClick={() => setShowEditSlotModal(false)} className="text-[#857469]">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSaveSlotLimit} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold uppercase text-[#6d3807] mb-1">
                    Tổng Số Slot Được Cấp (Slots Capacity)
                  </label>
                  <input
                    type="number"
                    min={10}
                    max={2000}
                    step={50}
                    value={slotLimit}
                    onChange={(e) => setSlotLimit(Number(e.target.value))}
                    className="w-full px-4 py-3 bg-[#fff1ea] border border-[#ffb782] rounded-xl text-lg font-bold text-[#6d3807] focus:outline-none"
                  />
                </div>

                <div className="pt-2 flex space-x-3">
                  <button type="button" onClick={() => setShowEditSlotModal(false)} className="flex-1 py-3 border border-[#d8c2b6] text-[#52443a] rounded-xl text-xs font-medium">Hủy</button>
                  <button type="submit" disabled={isSubmitting} className="flex-1 py-3 bg-[#6d3807] text-[#ffffff] rounded-xl text-xs font-medium shadow">
                    {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin mx-auto text-white" /> : "Lưu Số Slot"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
