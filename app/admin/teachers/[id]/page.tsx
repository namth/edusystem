"use client";

import { useState, useEffect, useCallback } from "react";
import AdminLayout from "@/components/AdminLayout";
import Link from "next/link";
import { useParams } from "next/navigation";
import { SlotLedgerTable } from "@/components/slots/SlotLedgerTable";
import {
  TEACHER_LEVELS,
  WORKPLACE_TYPES,
  STUDENT_COUNTS,
  TEACHER_NEEDS,
  SIGNUP_SOURCES,
  HONORIFICS,
} from "@/lib/onboarding";
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
  ClipboardList,
  ShieldCheck,
  ShieldAlert,
  CreditCard,
  AlertCircle,
  Wallet,
  Sliders,
} from "lucide-react";

interface TeacherProfileData {
  answers: {
    subjects?: string[];
    levels?: string[];
    workplace_type?: string;
    workplace_name?: string;
    student_count?: string;
    honorific?: string;
    needs?: string[];
    source?: string;
  };
  reviewed_by?: string | null;
  reviewed_at: string | null;
  review_note: string | null;
  created_at: string | null;
}

interface TeacherDetail {
  id: string;
  name: string;
  email: string;
  phone?: string;
  target_band?: string;
  created_at: string;
  teacher_status?: "TRIAL" | "VERIFIED" | "REJECTED" | null;
  profile?: TeacherProfileData | null;
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

interface WalletData {
  balance: number;
  unit_price_vnd: number;
  total_next_needed: number;
  classes?: any[];
}

function mapOptionLabel(
  options: readonly { readonly code: string; readonly label: string }[],
  code?: string
): string {
  if (!code) return "Chưa chọn";
  const found = options.find((o) => o.code === code);
  return found ? found.label : code;
}

function mapOptionLabels(
  options: readonly { readonly code: string; readonly label: string }[],
  codes?: string[]
): string[] {
  if (!Array.isArray(codes) || codes.length === 0) return [];
  return codes.map((c) => {
    const found = options.find((o) => o.code === c);
    return found ? found.label : c;
  });
}

function renderStatusBadge(status?: string | null) {
  if (status === "TRIAL") {
    return (
      <span className="px-3 py-1 rounded-full bg-amber-50 text-amber-800 text-xs font-bold border border-amber-300">
        Dùng thử
      </span>
    );
  }
  if (status === "REJECTED") {
    return (
      <span className="px-3 py-1 rounded-full bg-rose-50 text-rose-700 text-xs font-bold border border-rose-200">
        Từ chối
      </span>
    );
  }
  return (
    <span className="px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 text-xs font-bold border border-emerald-200">
      Đã xác minh
    </span>
  );
}

export default function AdminTeacherDetailPage() {
  const params = useParams();
  const rawId = params?.id;
  const teacherId = (Array.isArray(rawId) ? rawId[0] : rawId) || "";

  const [teacher, setTeacher] = useState<TeacherDetail | null>(null);
  const [profile, setProfile] = useState<TeacherProfileData | null>(null);
  const [classes, setClasses] = useState<ManagedClass[]>([]);
  const [aiLogs, setAiLogs] = useState<AILogRecord[]>([]);
  const [aiTotals, setAiTotals] = useState({ requests: 0, total_tokens: 0, cost_vnd: 0 });
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isTestingPortkey, setIsTestingPortkey] = useState(false);

  // Wallet state
  const [wallet, setWallet] = useState<WalletData | null>(null);
  const [walletLoading, setWalletLoading] = useState(false);
  const [delta, setDelta] = useState<string>("");
  const [note, setNote] = useState<string>("");
  const [isAdjusting, setIsAdjusting] = useState<boolean>(false);
  const [adjustMsg, setAdjustMsg] = useState<string | null>(null);
  const [adjustError, setAdjustError] = useState<string | null>(null);

  // Verify states
  const [reviewNote, setReviewNote] = useState("");
  const [isVerifying, setIsVerifying] = useState(false);

  // Edit Modals
  const [showEditInfoModal, setShowEditInfoModal] = useState(false);

  // Edit Form state
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [qualification, setQualification] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Tạo đơn mua slot
  const [requestedSlots, setRequestedSlots] = useState<number>(50);
  const [customTotalCost, setCustomTotalCost] = useState<string>("");
  const [orderNote, setOrderNote] = useState<string>("");
  const [isCreatingOrder, setIsCreatingOrder] = useState<boolean>(false);
  const [createOrderSuccess, setCreateOrderSuccess] = useState<{ id: string; code: string } | null>(null);
  const [createOrderError, setCreateOrderError] = useState<string | null>(null);

  const fetchWalletData = useCallback(async () => {
    if (!teacherId) return;
    try {
      setWalletLoading(true);
      const res = await fetch(`/api/admin/teachers/${teacherId}/slot-wallet`);
      if (res.ok) {
        const data = await res.json();
        setWallet({
          balance: Number(data.balance ?? 0),
          unit_price_vnd: Number(data.unit_price_vnd ?? 0),
          total_next_needed: Number(data.total_next_needed ?? 0),
          classes: data.classes || [],
        });
      }
    } catch (e) {
      console.error("fetchWalletData error:", e);
    } finally {
      setWalletLoading(false);
    }
  }, [teacherId]);

  const handleAdjustSlot = async (e: React.FormEvent) => {
    e.preventDefault();
    const deltaNum = parseInt(delta, 10);
    if (isNaN(deltaNum) || deltaNum === 0) {
      setAdjustError("Số slot điều chỉnh phải là số nguyên khác 0.");
      return;
    }
    if (!note.trim()) {
      setAdjustError("Lý do điều chỉnh không được để trống.");
      return;
    }
    if (note.trim().length > 500) {
      setAdjustError("Lý do điều chỉnh tối đa 500 ký tự.");
      return;
    }

    setIsAdjusting(true);
    setAdjustError(null);
    setAdjustMsg(null);

    try {
      const res = await fetch(`/api/admin/teachers/${teacherId}/slot-adjust`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          delta: deltaNum,
          note: note.trim(),
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) {
        setAdjustError(data.error || "Không thể điều chỉnh ví slot.");
        return;
      }

      setAdjustMsg(`Đã điều chỉnh thành công! Số dư mới: ${Number(data.balance).toLocaleString("vi-VN")} slot.`);
      setDelta("");
      setNote("");
      fetchWalletData();
    } catch (err: any) {
      setAdjustError(err.message || "Lỗi khi gọi API điều chỉnh ví slot.");
    } finally {
      setIsAdjusting(false);
    }
  };

  const handleCreateOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsCreatingOrder(true);
    setCreateOrderError(null);
    setCreateOrderSuccess(null);
    try {
      const payload: {
        teacher_id: string;
        requested_slots: number;
        total_cost?: number;
        note?: string;
      } = {
        teacher_id: teacherId,
        requested_slots: Number(requestedSlots),
      };
      if (customTotalCost.trim() !== "") {
        payload.total_cost = Number(customTotalCost.trim());
      }
      if (orderNote.trim()) {
        payload.note = orderNote.trim();
      }

      const res = await fetch("/api/admin/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok || !data.success || !data.order) {
        setCreateOrderError(data.error || "Không thể tạo đơn mua slot.");
        return;
      }

      setCreateOrderSuccess({
        id: data.order.id,
        code: data.order.code,
      });
      setOrderNote("");
      setCustomTotalCost("");
    } catch (err: any) {
      console.error(err);
      setCreateOrderError(err.message || "Lỗi kết nối khi tạo đơn mua slot.");
    } finally {
      setIsCreatingOrder(false);
    }
  };

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
        setProfile(null);
        setClasses([]);
        setAiLogs([]);
        return;
      }

      const tObj: TeacherDetail = data.teacher;
      const profObj: TeacherProfileData | null = data.profile ?? tObj.profile ?? null;
      setTeacher(tObj);
      setProfile(profObj);
      setReviewNote(profObj?.review_note || "");
      setName(tObj.name);
      setEmail(tObj.email);
      setPhone(tObj.phone || "");
      setQualification(tObj.target_band || "");

      setClasses(data.classes || []);
      setAiLogs(data.aiLogs || []);
      setAiTotals(data.ai_totals || { requests: 0, total_tokens: 0, cost_vnd: 0 });
    } catch (e: any) {
      console.error(e);
      setErrorMsg("Đã xảy ra lỗi khi nạp thông tin giảng viên.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTeacherData();
    fetchWalletData();
  }, [teacherId, fetchWalletData]);

  const handleVerifyDecision = async (decision: "VERIFIED" | "REJECTED") => {
    if (!teacherId) return;
    setIsVerifying(true);
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      const res = await fetch(`/api/admin/teachers/${teacherId}/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          decision,
          note: reviewNote.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setErrorMsg(data.error || "Không thể cập nhật trạng thái xác minh.");
        return;
      }
      setSuccessMsg(
        decision === "VERIFIED"
          ? "Đã xác minh giáo viên thành công! Toàn bộ giới hạn dùng thử đã được mở."
          : "Đã cập nhật trạng thái từ chối xác minh cho giáo viên."
      );
      await fetchTeacherData();
      fetchWalletData();
      setTimeout(() => setSuccessMsg(null), 5000);
    } catch (e: any) {
      console.error(e);
      setErrorMsg(e.message || "Lỗi kết nối khi xác minh giáo viên.");
    } finally {
      setIsVerifying(false);
    }
  };

  // Tổng AI do server tính (SQL SUM toàn bộ log)
  const totalRealTokens = aiTotals.total_tokens;
  const totalRealRequests = aiTotals.requests;
  const totalCostVnd = aiTotals.cost_vnd;

  // Real Portkey Gateway Live Test Call via Server API Route
  const handleTestPortkeyLive = async () => {
    if (!teacher) return;
    setIsTestingPortkey(true);
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      const apiRes = await fetch("/api/admin/test-portkey", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          teacherId: teacher.id,
          userPrompt:
            "Analyze this sample IELTS essay: 'Task 2: Some people think that universities should provide graduates with knowledge and skills needed in the workplace.'",
          submissionId: `test_sub_${Date.now().toString().slice(-4)}`,
        }),
      });

      const res = await apiRes.json();
      if (!apiRes.ok || !res.success) {
        setErrorMsg("Lỗi kết nối Portkey Gateway: " + (res.error || "Không thể gửi request"));
        return;
      }

      setSuccessMsg(
        `Đã gọi LIVE Portkey AI Gateway thành công! Tiêu thụ ${res.usage.totalTokens} tokens ($${res.usage.costUsd} USD) và ghi nhật ký trực tiếp vào CSDL.`
      );

      fetchTeacherData();
      setTimeout(() => setSuccessMsg(null), 6000);
    } catch (err: any) {
      console.error(err);
      setErrorMsg("Lỗi kết nối Portkey Gateway: " + (err.message || err));
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

  if (loading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center space-x-2 text-xs text-ink-muted p-12 bg-white rounded-2xl border border-line max-w-4xl mx-auto my-8">
          <Loader2 className="w-5 h-5 animate-spin text-brand-600" />
          <span>Đang nạp thông tin giảng viên &amp; khảo sát từ PostgreSQL...</span>
        </div>
      </AdminLayout>
    );
  }

  if (notFound || !teacher) {
    return (
      <AdminLayout>
        <div className="max-w-xl mx-auto my-12 p-8 bg-white rounded-3xl border border-line text-center space-y-4 shadow-sm font-sans">
          <div className="w-12 h-12 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center mx-auto border border-rose-200">
            <X className="w-6 h-6" />
          </div>
          <h2 className="text-xl font-bold text-ink">Không tìm thấy thông tin Giảng viên</h2>
          <p className="text-xs text-ink-muted">
            Tài khoản giảng viên ID <strong className="text-brand-600">{teacherId}</strong> không tồn tại hoặc đã bị xóa khỏi CSDL PostgreSQL.
          </p>
          <Link
            href="/admin/teachers"
            className="inline-flex items-center space-x-2 px-5 py-2.5 bg-brand-600 text-white text-xs font-bold rounded-xl hover:bg-brand-700 transition-all"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Quay lại Danh sách Giáo viên</span>
          </Link>
        </div>
      </AdminLayout>
    );
  }

  const answers = profile?.answers || {};
  const levelLabels = mapOptionLabels(TEACHER_LEVELS, answers.levels);
  const needLabels = mapOptionLabels(TEACHER_NEEDS, answers.needs);
  const workplaceLabel = mapOptionLabel(WORKPLACE_TYPES, answers.workplace_type);
  const studentCountLabel = mapOptionLabel(STUDENT_COUNTS, answers.student_count);
  const sourceLabel = mapOptionLabel(SIGNUP_SOURCES, answers.source);
  const honorificLabel = mapOptionLabel(HONORIFICS, answers.honorific);

  return (
    <AdminLayout>
      <div className="max-w-[1280px] mx-auto space-y-8 font-sans">
        {/* Header */}
        <div className="border-b border-line/40 pb-6 flex flex-col md:flex-row justify-between md:items-center gap-4">
          <div>
            <Link href="/admin/teachers" className="text-xs text-brand-600 hover:underline flex items-center mb-2 font-medium">
              <ArrowLeft className="w-4 h-4 mr-1 text-brand-600" />
              Quay lại Danh sách Giáo viên
            </Link>
            <h1 className="text-3xl font-bold text-ink tracking-tight flex flex-wrap items-center gap-3">
              <span>{teacher.name}</span>
              <span className="px-3 py-1 rounded-full bg-brand-50 text-brand-600 text-xs font-bold border border-brand-300">
                TEACHER
              </span>
              {renderStatusBadge(teacher.teacher_status)}
            </h1>
            <p className="text-sm text-ink-muted mt-1">
              Hồ sơ quản lý giảng viên chi tiết &bull; ID: <strong className="text-brand-800">{teacher.id}</strong>
            </p>
          </div>

          <button
            onClick={handleTestPortkeyLive}
            disabled={isTestingPortkey}
            className="px-5 py-2.5 bg-brand-800 hover:bg-brand-900 text-white text-xs font-bold rounded-xl shadow transition-all flex items-center space-x-2 shrink-0 disabled:opacity-50"
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
          {/* Left Column: Basic Info, Verification & Slot Wallet Card */}
          <div className="space-y-6">
            {/* Basic Info Card */}
            <div className="bg-white p-6 rounded-3xl border border-line shadow-sm space-y-4">
              <div className="flex justify-between items-center border-b border-line/40 pb-3">
                <h2 className="text-base font-bold text-brand-600 flex items-center space-x-2">
                  <UserCheck className="w-5 h-5 text-brand-600" />
                  <span>Thông Tin Cơ Bản</span>
                </h2>
                <button
                  onClick={() => setShowEditInfoModal(true)}
                  className="px-3 py-1.5 bg-surface-alt text-brand-600 border border-line rounded-xl text-xs font-medium hover:bg-brand-100"
                >
                  <Edit3 className="w-3.5 h-3.5 inline mr-1" />
                  Sửa
                </button>
              </div>

              <div className="space-y-2.5 text-xs text-ink">
                <p>
                  <span className="text-ink-subtle">Họ &amp; Tên:</span> <strong className="block text-sm text-ink">{teacher.name}</strong>
                </p>
                <p>
                  <span className="text-ink-subtle">Email:</span> <strong className="block text-brand-800">{teacher.email}</strong>
                </p>
                <p>
                  <span className="text-ink-subtle">Số điện thoại:</span> <strong className="block">{teacher.phone || "Chưa cập nhật"}</strong>
                </p>
                <p>
                  <span className="text-ink-subtle">Bằng cấp / Trình độ:</span> <strong className="block text-brand-600">{teacher.target_band || "Chưa cập nhật"}</strong>
                </p>
                <p>
                  <span className="text-ink-subtle">Ngày tham gia:</span> <span className="block text-ink-muted">{teacher.created_at}</span>
                </p>
              </div>
            </div>

            {/* Khảo sát đăng ký & Xác minh */}
            <div className="bg-white p-6 rounded-3xl border border-line shadow-sm space-y-4">
              <div className="flex justify-between items-center border-b border-line/40 pb-3">
                <h2 className="text-base font-bold text-brand-600 flex items-center space-x-2">
                  <ClipboardList className="w-5 h-5 text-brand-600" />
                  <span>Khảo sát đăng ký</span>
                </h2>
                {renderStatusBadge(teacher.teacher_status)}
              </div>

              {profile && Object.keys(answers).length > 0 ? (
                <div className="space-y-3 text-xs text-ink">
                  <div>
                    <span className="text-ink-subtle block">Môn giảng dạy:</span>
                    <strong className="text-ink">
                      {Array.isArray(answers.subjects) && answers.subjects.length > 0
                        ? answers.subjects.join(", ")
                        : "Chưa cung cấp"}
                    </strong>
                  </div>
                  <div>
                    <span className="text-ink-subtle block">Cấp học giảng dạy:</span>
                    <strong className="text-ink">
                      {levelLabels.length > 0 ? levelLabels.join(", ") : "Chưa cung cấp"}
                    </strong>
                  </div>
                  <div>
                    <span className="text-ink-subtle block">Nơi công tác:</span>
                    <strong className="text-ink">
                      {workplaceLabel}
                      {answers.workplace_name ? ` — ${answers.workplace_name}` : ""}
                    </strong>
                  </div>
                  <div>
                    <span className="text-ink-subtle block">Quy mô học sinh:</span>
                    <strong className="text-ink">{studentCountLabel}</strong>
                  </div>
                  <div>
                    <span className="text-ink-subtle block">Danh xưng:</span>
                    <strong className="text-ink">{honorificLabel || "Chưa cung cấp"}</strong>
                  </div>
                  {needLabels.length > 0 && (
                    <div>
                      <span className="text-ink-subtle block">Nhu cầu sử dụng:</span>
                      <strong className="text-ink">{needLabels.join(", ")}</strong>
                    </div>
                  )}
                  <div>
                    <span className="text-ink-subtle block">Nguồn biết đến KitoKit:</span>
                    <strong className="text-ink">{sourceLabel}</strong>
                  </div>
                </div>
              ) : (
                <p className="text-xs text-ink-muted italic">
                  Giáo viên này chưa có dữ liệu khảo sát đăng ký.
                </p>
              )}

              <div className="pt-3 border-t border-line/40 space-y-3">
                <div>
                  <label className="block text-xs font-bold text-ink mb-1">
                    Ghi chú xác minh (tối đa 500 ký tự)
                  </label>
                  <textarea
                    rows={2}
                    maxLength={500}
                    value={reviewNote}
                    onChange={(e) => setReviewNote(e.target.value)}
                    placeholder="Nhập ghi chú xác minh hoặc lý do từ chối..."
                    className="w-full px-3 py-2 bg-surface-alt border border-line rounded-xl text-xs focus:outline-none focus:border-brand-600"
                  />
                </div>

                {profile?.reviewed_at && (
                  <p className="text-[11px] text-ink-subtle">
                    Lần duyệt gần nhất: {new Date(profile.reviewed_at).toLocaleString("vi-VN")}
                  </p>
                )}

                <div className="flex gap-3">
                  <button
                    type="button"
                    disabled={isVerifying}
                    onClick={() => handleVerifyDecision("VERIFIED")}
                    className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 shadow-sm transition-all disabled:opacity-50"
                  >
                    <ShieldCheck className="w-4 h-4" />
                    <span>Xác minh</span>
                  </button>
                  <button
                    type="button"
                    disabled={isVerifying}
                    onClick={() => handleVerifyDecision("REJECTED")}
                    className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 shadow-sm transition-all disabled:opacity-50"
                  >
                    <ShieldAlert className="w-4 h-4" />
                    <span>Từ chối</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Khối Ví slot & Form Điều chỉnh */}
            <div className="bg-white p-6 rounded-3xl border border-line shadow-sm space-y-4">
              <div className="flex justify-between items-center border-b border-line/40 pb-3">
                <h2 className="text-base font-bold text-brand-600 flex items-center space-x-2">
                  <Wallet className="w-5 h-5 text-brand-600" />
                  <span>Ví slot</span>
                </h2>
                {walletLoading && <Loader2 className="w-4 h-4 animate-spin text-brand-600" />}
              </div>

              <div className="p-4 bg-brand-50/50 rounded-2xl border border-brand-200">
                <p className="text-[10px] text-ink-muted font-bold uppercase tracking-wider">
                  Số dư ví slot hiện tại
                </p>
                <div className="text-2xl font-black text-brand-600 mt-1">
                  {wallet ? `${wallet.balance.toLocaleString("vi-VN")} slot` : "0 slot"}
                </div>
                <p className="text-[11px] text-ink-subtle mt-1">
                  Nhu cầu 31 ngày tới: {wallet ? wallet.total_next_needed.toLocaleString("vi-VN") : 0} slot
                </p>
              </div>

              {/* Form Điều chỉnh ví slot */}
              <div className="pt-2 border-t border-line/40 space-y-3">
                <h3 className="text-xs font-bold text-ink uppercase tracking-wider flex items-center space-x-1.5">
                  <Sliders className="w-4 h-4 text-brand-600" />
                  <span>Điều chỉnh ví slot</span>
                </h3>

                {adjustMsg && (
                  <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs font-semibold">
                    {adjustMsg}
                  </div>
                )}

                {adjustError && (
                  <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs font-semibold">
                    {adjustError}
                  </div>
                )}

                <form onSubmit={handleAdjustSlot} className="space-y-3 text-xs">
                  <div>
                    <label className="block font-bold text-ink mb-1">
                      Số slot delta (+ cộng / - trừ) (*)
                    </label>
                    <input
                      type="number"
                      name="delta"
                      required
                      placeholder="Ví dụ: 50 hoặc -20"
                      value={delta}
                      onChange={(e) => setDelta(e.target.value)}
                      className="w-full px-3 py-2 bg-surface-alt border border-line rounded-xl font-bold text-brand-600 focus:outline-none focus:border-brand-600"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-ink mb-1">
                      Lý do điều chỉnh (note, tối đa 500 ký tự) (*)
                    </label>
                    <textarea
                      rows={2}
                      maxLength={500}
                      required
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      placeholder="Nhập lý do bắt buộc (vd: Tặng khuyến mại, điều chỉnh trừ lỗi...)"
                      className="w-full px-3 py-2 bg-surface-alt border border-line rounded-xl focus:outline-none focus:border-brand-600"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={isAdjusting || !note.trim() || !delta}
                    className="w-full py-2.5 bg-brand-600 hover:bg-brand-700 text-white rounded-xl font-bold shadow transition-all flex items-center justify-center space-x-2 disabled:opacity-50 cursor-pointer"
                  >
                    {isAdjusting ? (
                      <Loader2 className="w-4 h-4 animate-spin text-white" />
                    ) : (
                      <span>Điều chỉnh</span>
                    )}
                  </button>
                </form>
              </div>
            </div>

            {/* Khối Tạo đơn mua slot */}
            <div className="bg-white p-6 rounded-3xl border border-line shadow-sm space-y-4">
              <div className="border-b border-line/40 pb-3">
                <h2 className="text-base font-bold text-brand-600 flex items-center space-x-2">
                  <CreditCard className="w-5 h-5 text-brand-600" />
                  <span>Tạo đơn mua slot</span>
                </h2>
                <p className="text-[11px] text-ink-subtle mt-0.5">
                  Tạo đơn mua slot và sinh mã thanh toán VietQR cho giáo viên.
                </p>
              </div>

              {createOrderSuccess && (
                <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs space-y-1">
                  <div className="flex items-center space-x-1.5 font-bold">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>Đã tạo đơn {createOrderSuccess.code} thành công!</span>
                  </div>
                  <p>
                    <Link
                      href={`/admin/orders/${createOrderSuccess.id}`}
                      className="text-brand-600 font-bold underline hover:text-brand-700"
                    >
                      Xem chi tiết đơn {createOrderSuccess.code} &rarr;
                    </Link>
                  </p>
                </div>
              )}

              {createOrderError && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center space-x-2">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>{createOrderError}</span>
                </div>
              )}

              <form onSubmit={handleCreateOrder} className="space-y-3 text-xs">
                <div>
                  <label className="block font-bold text-ink mb-1">Số slot mua (*)</label>
                  <input
                    type="number"
                    min={1}
                    max={10000}
                    required
                    value={requestedSlots}
                    onChange={(e) => setRequestedSlots(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-surface-alt border border-line rounded-xl font-bold text-brand-600 focus:outline-none focus:border-brand-600"
                  />
                </div>

                <div>
                  <label className="block font-bold text-ink mb-1">
                    Giá tiền VND (để trống = giá chuẩn)
                  </label>
                  <input
                    type="number"
                    min={0}
                    placeholder="Mặc định tính theo đơn giá chuẩn"
                    value={customTotalCost}
                    onChange={(e) => setCustomTotalCost(e.target.value)}
                    className="w-full px-3 py-2 bg-surface-alt border border-line rounded-xl focus:outline-none focus:border-brand-600"
                  />
                  <p className="text-[10px] text-ink-subtle mt-0.5">
                    Nếu chỉnh sửa giá khác giá chuẩn, bắt buộc phải có ghi chú.
                  </p>
                </div>

                <div>
                  <label className="block font-bold text-ink mb-1">Ghi chú đơn hàng</label>
                  <textarea
                    rows={2}
                    value={orderNote}
                    onChange={(e) => setOrderNote(e.target.value)}
                    placeholder="Ghi chú (bắt buộc nếu tuỳ chỉnh giá)..."
                    className="w-full px-3 py-2 bg-surface-alt border border-line rounded-xl focus:outline-none focus:border-brand-600"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isCreatingOrder}
                  className="w-full py-2.5 bg-brand-600 hover:bg-brand-700 text-white rounded-xl font-bold shadow transition-all flex items-center justify-center space-x-2 disabled:opacity-50"
                >
                  {isCreatingOrder ? (
                    <Loader2 className="w-4 h-4 animate-spin text-white" />
                  ) : (
                    <span>Tạo đơn mua slot</span>
                  )}
                </button>
              </form>
            </div>
          </div>

          {/* Right Column: Real Portkey AI Analytics, Managed Classes & Slot Ledger */}
          <div className="lg:col-span-2 space-y-6">
            {/* Real Portkey AI Token Usage Analytics Section */}
            <div className="bg-white p-6 rounded-3xl border border-line shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-line/40 pb-3">
                <div>
                  <h2 className="text-base font-bold text-brand-600 flex items-center space-x-2">
                    <Cpu className="w-5 h-5 text-brand-600" />
                    <span>Mức Độ Sử Dụng AI Token (Real PostgreSQL &amp; Portkey Logs)</span>
                  </h2>
                  <p className="text-xs text-ink-muted mt-0.5">
                    Dữ liệu token tiêu thụ thực tế được gửi qua Portkey Gateway và ghi log trực tiếp vào DB.
                  </p>
                </div>
                <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold">
                  Gateway Live Verified
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="p-4 bg-brand-50 rounded-2xl border border-brand-300 space-y-1">
                  <span className="text-xs text-ink-muted font-medium block">Tổng Real Tokens Đã Dùng:</span>
                  <span className="text-xl font-bold text-brand-600 block">{totalRealTokens.toLocaleString("vi-VN")} tokens</span>
                  <span className="text-[10px] text-ink-subtle block">Model: Portkey AI Gateway</span>
                </div>

                <div className="p-4 bg-surface-alt rounded-2xl border border-line space-y-1">
                  <span className="text-xs text-ink-muted font-medium block">Tổng Lượt Request Thực Tế:</span>
                  <span className="text-xl font-bold text-brand-800 block">{totalRealRequests} Requests</span>
                  <span className="text-[10px] text-ink-subtle block">Lưu vết trong PostgreSQL</span>
                </div>

                <div className="p-4 bg-surface-alt rounded-2xl border border-line space-y-1">
                  <span className="text-xs text-ink-muted font-medium block">Tổng Chi Phí Ước Tính:</span>
                  <span className="text-xl font-bold text-ink block">{totalCostVnd.toLocaleString("vi-VN")} đ</span>
                  <span className="text-[10px] text-emerald-700 block font-bold">&check; Portkey Metadata Tracked</span>
                </div>
              </div>

              {/* Real Logs Table */}
              <div className="mt-4 pt-4 border-t border-line/30 space-y-3">
                <h3 className="text-xs font-bold text-ink uppercase tracking-wider">
                  Nhật Ký Gọi Portkey Gateway Thực Tế (PostgreSQL `ai_usage_logs`)
                </h3>

                {aiLogs.length === 0 ? (
                  <div className="p-6 text-center border border-dashed border-line rounded-2xl bg-surface-alt">
                    <p className="text-xs text-ink-muted">Chưa có nhật ký gọi AI Portkey nào cho giáo viên này. Bấm nút <strong>"Test Portkey Live Call"</strong> ở góc trên để chạy thử request live!</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto rounded-xl border border-line">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="bg-surface-alt border-b border-line font-bold text-ink-muted">
                          <th className="p-3">Thời Gian Request</th>
                          <th className="p-3">Mô Hình AI (Model)</th>
                          <th className="p-3">Prompt / Completion</th>
                          <th className="p-3">Tổng Tokens</th>
                          <th className="p-3 text-right">Chi Phí (USD)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-line/30">
                        {aiLogs.map((log) => (
                          <tr key={log.id} className="hover:bg-surface-alt">
                            <td className="p-3 font-medium text-ink">{log.created_at}</td>
                            <td className="p-3 text-brand-800 font-semibold">{log.model}</td>
                            <td className="p-3 text-ink-subtle">
                              {log.prompt_tokens} in / {log.completion_tokens} out
                            </td>
                            <td className="p-3 font-bold text-brand-600">
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
            <div className="bg-white p-6 rounded-3xl border border-line shadow-sm space-y-4">
              <h2 className="text-base font-bold text-brand-600 flex items-center space-x-2 border-b border-line/40 pb-3">
                <BookOpen className="w-5 h-5 text-brand-600" />
                <span>Các Lớp Học Đang Quản Lý ({classes.length} Lớp)</span>
              </h2>

              {classes.length === 0 ? (
                <div className="p-6 text-center border border-dashed border-line rounded-2xl bg-surface-alt">
                  <p className="text-xs text-ink-muted">Giảng viên này hiện chưa được phân công quản lý lớp học nào.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {classes.map((c) => (
                    <div key={c.id} className="p-4 rounded-2xl border border-line bg-surface-alt flex items-center justify-between">
                      <div>
                        <span className="px-2.5 py-0.5 rounded bg-brand-50 text-brand-600 border border-brand-300 text-[10px] font-bold">
                          Mã Lớp: {c.code}
                        </span>
                        <h3 className="text-base font-bold text-ink mt-1">{c.name}</h3>
                        <p className="text-xs text-ink-muted">Lịch học: {c.schedule}</p>
                      </div>

                      <div className="text-right">
                        <span className="text-xs text-ink-muted block">Sĩ số học viên:</span>
                        <span className="text-lg font-bold text-brand-600">{c.student_count} Học viên</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Sổ cái lịch sử ví slot */}
            <div className="bg-white p-6 rounded-3xl border border-line shadow-sm space-y-4">
              <SlotLedgerTable teacherId={teacherId} onRefreshWallet={fetchWalletData} />
            </div>
          </div>
        </div>

        {/* Modal: Edit Basic Info */}
        {showEditInfoModal && (
          <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 font-sans">
            <div className="bg-white rounded-3xl p-6 md:p-8 max-w-lg w-full shadow-2xl border border-line space-y-6 animate-in fade-in zoom-in-95">
              <div className="flex justify-between items-center border-b border-line/40 pb-4">
                <h2 className="text-xl font-bold text-brand-600">Sửa Thông Tin Cơ Bản Giáo Viên</h2>
                <button onClick={() => setShowEditInfoModal(false)} className="text-ink-subtle">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSaveInfo} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold uppercase text-ink mb-1">Họ &amp; Tên (*)</label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full px-3 py-2.5 bg-surface-alt border border-line rounded-xl text-sm focus:outline-none focus:border-brand-600"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase text-ink mb-1">Email (*)</label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full px-3 py-2.5 bg-surface-alt border border-line rounded-xl text-sm focus:outline-none focus:border-brand-600"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase text-ink mb-1">Số Điện Thoại</label>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full px-3 py-2.5 bg-surface-alt border border-line rounded-xl text-sm focus:outline-none focus:border-brand-600"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase text-ink mb-1">Trình Độ / Bằng Cấp</label>
                  <input
                    type="text"
                    value={qualification}
                    onChange={(e) => setQualification(e.target.value)}
                    className="w-full px-3 py-2.5 bg-surface-alt border border-line rounded-xl text-sm focus:outline-none focus:border-brand-600"
                  />
                </div>

                <div className="pt-2 flex space-x-3">
                  <button type="button" onClick={() => setShowEditInfoModal(false)} className="flex-1 py-3 border border-line text-ink-muted rounded-xl text-xs font-medium">Hủy</button>
                  <button type="submit" disabled={isSubmitting} className="flex-1 py-3 bg-brand-600 text-white rounded-xl text-xs font-medium shadow">
                    {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin mx-auto text-white" /> : "Lưu Thay Đổi"}
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
