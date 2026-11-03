"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Eye,
  EyeOff,
  Sparkles,
  Loader2,
  RotateCcw,
  CheckCircle2,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import {
  TEACHER_LEVELS,
  WORKPLACE_TYPES,
  STUDENT_COUNTS,
  HONORIFICS,
  SIGNUP_SOURCES,
  PLACEHOLDER_EMAIL_DOMAIN,
  isPlaceholderEmail,
} from "@/lib/onboarding";
import InterviewShell from "@/components/onboarding/InterviewShell";
import StepActions from "@/components/onboarding/StepActions";
import { useEmailAvailability, EmailAvailabilityHint } from "@/components/onboarding/useEmailAvailability";
import ChoiceChips from "@/components/onboarding/ChoiceChips";
import Mascot, { type MascotMood } from "@/components/onboarding/Mascot";
import Confetti from "@/components/onboarding/Confetti";
import { useInterviewDraft } from "@/components/onboarding/useInterviewDraft";

type TeacherStep =
  | "intro"
  | "name"
  | "subjects"
  | "levels"
  | "workplace"
  | "studentCount"
  | "source"
  | "phone"
  | "email"
  | "password"
  | "done";

interface TeacherDraft {
  step: TeacherStep;
  honorific: "" | "THAY" | "CO";
  name: string;
  subjects: string[];
  levels: string[];
  workplaceType: string;
  workplaceName: string;
  studentCount: string;
  source: string;
  phone: string;
  email: string;
}

interface SubjectOption {
  id: string;
  name: string;
}

const INITIAL_DRAFT: TeacherDraft = {
  step: "intro",
  honorific: "",
  name: "",
  subjects: [],
  levels: [],
  workplaceType: "",
  workplaceName: "",
  studentCount: "",
  source: "",
  phone: "",
  email: "",
};

function computeTeacherPasswordStrength(pw: string): { level: number; label: string } {
  if (!pw) return { level: 0, label: "Chưa nhập mật khẩu" };
  if (pw.length < 8) return { level: 1, label: "Cần ít nhất 8 ký tự" };
  let score = 2;
  if (pw.length >= 10 && /[0-9]/.test(pw) && /[a-zA-Z]/.test(pw)) score = 3;
  if (pw.length >= 12 && /[^a-zA-Z0-9]/.test(pw)) score = 4;
  const labels = ["", "Quá ngắn", "Đủ dùng", "Khá mạnh", "Rất mạnh"];
  return { level: score, label: labels[score] || "Đủ dùng" };
}

export default function TeacherRegisterPage() {
  const { registerTeacher } = useAuth();
  const router = useRouter();
  const { draft, updateDraft, clearDraft } = useInterviewDraft<TeacherDraft>(
    "kitokit-signup-teacher",
    INITIAL_DRAFT
  );

  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [website, setWebsite] = useState("");
  const [mood, setMood] = useState<MascotMood>("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [networkFailed, setNetworkFailed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [isDone, setIsDone] = useState(false);

  const [subjectOptions, setSubjectOptions] = useState<SubjectOption[]>([
    { id: "english", name: "Tiếng Anh" },
  ]);

  const step: TeacherStep = draft.step || "intro";
  const emailCheck = useEmailAvailability(draft.email, step === "email");
  // Danh xưng: câu ngay sau màn tên gọi "thầy/cô + tên riêng", các câu sau chỉ gọi "thầy"/"cô"
  const xung = draft.honorific === "THAY" ? "thầy" : draft.honorific === "CO" ? "cô" : "thầy cô";
  const Xung = xung.charAt(0).toUpperCase() + xung.slice(1);
  const givenName = draft.name.trim().split(/\s+/).pop() || "";
  const displayName = givenName ? `${xung} ${givenName}` : xung;

  useEffect(() => {
    let active = true;
    async function loadSubjects() {
      try {
        const res = await fetch("/api/auth/signup-options");
        if (!res.ok) throw new Error("failed");
        const data = await res.json();
        if (active && Array.isArray(data.subjects) && data.subjects.length > 0) {
          setSubjectOptions(data.subjects);
        }
      } catch {
        if (active) {
          setSubjectOptions([{ id: "english", name: "Tiếng Anh" }]);
        }
      }
    }
    loadSubjects();
    return () => {
      active = false;
    };
  }, []);

  const goToStep = (nextStep: TeacherStep, nextMood: MascotMood = "think") => {
    setErrorMsg(null);
    setNetworkFailed(false);
    setMood(nextMood);
    updateDraft({ step: nextStep });
  };

  const handleBack = () => {
    setErrorMsg(null);
    setNetworkFailed(false);
    const order: TeacherStep[] = [
      "intro",
      "name",
      "subjects",
      "levels",
      "workplace",
      "studentCount",
      "source",
      "phone",
      "email",
      "password",
    ];
    const idx = order.indexOf(step);
    if (idx > 0) {
      goToStep(order[idx - 1], "idle");
    }
  };

  const handleNameNext = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!draft.honorific) {
      setMood("oops");
      setErrorMsg("Kito nên gọi là thầy hay cô ạ? Vui lòng chọn danh xưng.");
      return;
    }
    const trimmed = draft.name.trim();
    if (trimmed.length < 2 || trimmed.length > 100) {
      setMood("oops");
      setErrorMsg("Thầy cô vui lòng nhập họ tên từ 2 đến 100 ký tự ạ.");
      return;
    }
    goToStep("subjects", "happy");
  };

  const toggleMulti = (field: "subjects" | "levels", code: string) => {
    setErrorMsg(null);
    const list = draft[field] || [];
    const next = list.includes(code) ? list.filter((x) => x !== code) : [...list, code];
    updateDraft({ [field]: next } as Partial<TeacherDraft>);
  };

  const handleSubjectsNext = () => {
    if (!draft.subjects || draft.subjects.length === 0) {
      setMood("oops");
      setErrorMsg(`${Xung} vui lòng chọn ít nhất một môn giảng dạy ạ.`);
      return;
    }
    goToStep("levels", "happy");
  };

  const handleLevelsNext = () => {
    if (!draft.levels || draft.levels.length === 0) {
      setMood("oops");
      setErrorMsg(`${Xung} vui lòng chọn ít nhất một cấp học ạ.`);
      return;
    }
    goToStep("workplace", "happy");
  };

  const handleWorkplaceTypeSelect = (code: string) => {
    setErrorMsg(null);
    setMood("happy");
    updateDraft({ workplaceType: code });
  };

  const handleWorkplaceNext = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!draft.workplaceType) {
      setMood("oops");
      setErrorMsg(`${Xung} vui lòng chọn nơi công tác ạ.`);
      return;
    }
    goToStep("studentCount", "happy");
  };

  const handleStudentCountSelect = (code: string) => {
    setErrorMsg(null);
    setMood("happy");
    updateDraft({ studentCount: code, step: "source" });
  };


  const handleSourceSelect = (code: string) => {
    setErrorMsg(null);
    setMood("happy");
    updateDraft({ source: code, step: "phone" });
  };

  const handlePhoneNext = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const cleaned = draft.phone.trim().replace(/[\s.\-]/g, "");
    if (!/^(\+84|0)\d{9,10}$/.test(cleaned)) {
      setMood("oops");
      setErrorMsg(`${Xung} vui lòng nhập số điện thoại Việt Nam hợp lệ (9–11 chữ số) ạ.`);
      return;
    }
    goToStep("email", "happy");
  };

  const handleEmailNext = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const clean = draft.email.trim().toLowerCase();
    if (emailCheck.status === "taken") {
      setMood("oops");
      setErrorMsg(emailCheck.message || "Email này đã được dùng để đăng ký.");
      return;
    }
    if (!clean || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean)) {
      setMood("oops");
      setErrorMsg(`${Xung} vui lòng nhập địa chỉ email hợp lệ ạ.`);
      return;
    }
    if (isPlaceholderEmail(clean)) {
      setMood("oops");
      setErrorMsg(
        `Giáo viên cần sử dụng email thật để đăng ký (không dùng đuôi @${PLACEHOLDER_EMAIL_DOMAIN}).`
      );
      return;
    }
    goToStep("password", "happy");
  };

  const handleSubmitTeacher = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setErrorMsg(null);
    setNetworkFailed(false);

    if (password.trim().length < 8) {
      setMood("oops");
      setErrorMsg("Mật khẩu dành cho giáo viên cần có ít nhất 8 ký tự ạ.");
      return;
    }

    setSubmitting(true);
    setMood("think");

    const res = await registerTeacher({
      name: draft.name.trim(),
      subjects: draft.subjects,
      levels: draft.levels,
      workplaceType: draft.workplaceType,
      workplaceName: draft.workplaceName.trim() || null,
      studentCount: draft.studentCount,
      honorific: draft.honorific,
      source: draft.source || null,
      phone: draft.phone.trim(),
      email: draft.email.trim().toLowerCase(),
      password: password.trim(),
      website,
    });

    setSubmitting(false);

    if (res.success) {
      clearDraft();
      setIsDone(true);
      setMood("celebrate");
      updateDraft({ step: "done" });
      return;
    }

    setMood("oops");

    if (res.networkError) {
      setNetworkFailed(true);
      setErrorMsg(res.error || `Lỗi kết nối mạng. Thông tin của ${xung} vẫn được giữ nguyên.`);
      return;
    }

    if (res.status === 429) {
      const mins = res.retryAfterSeconds ? Math.max(1, Math.ceil(res.retryAfterSeconds / 60)) : 60;
      setErrorMsg(`${Xung} thao tác quá nhiều lần. Vui lòng chờ khoảng ${mins} phút rồi thử lại ạ.`);
      return;
    }

    if (res.field) {
      const fieldStepMap: Record<string, TeacherStep> = {
        name: "name",
        subjects: "subjects",
        levels: "levels",
        workplaceType: "workplace",
        workplaceName: "workplace",
        studentCount: "studentCount",
        source: "source",
        phone: "phone",
        email: "email",
        password: "password",
      };
      const targetStep = fieldStepMap[res.field];
      if (targetStep) {
        updateDraft({ step: targetStep });
      }
    }

    setErrorMsg(res.error || `Đăng ký chưa thành công, ${xung} vui lòng kiểm tra lại thông tin ạ.`);
  };

  // Màn hoàn tất dùng thử giáo viên
  if (step === "done" || isDone) {
    return (
      <div className="min-h-screen w-full overflow-x-hidden bg-surface-alt flex flex-col items-center justify-center px-4 py-10 font-sans text-ink">
        <Confetti />
        <div className="w-full max-w-lg bg-white rounded-3xl border border-line p-6 sm:p-10 shadow-sm text-center space-y-6">
          <div className="flex justify-center">
            <Mascot mood="celebrate" size="lg" />
          </div>

          <div className="space-y-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-brand-50 text-brand-700 text-xs font-bold">
              <Sparkles className="w-3.5 h-3.5 text-accent-500" />
              Chế độ dùng thử giáo viên
            </span>
            <h1 className="font-display text-2xl sm:text-3xl font-extrabold text-ink">
              Tài khoản dùng thử đã sẵn sàng!
            </h1>
            <p className="text-sm text-ink-muted">
              Chào mừng {displayName} đến với không gian giảng dạy KitoKit.
            </p>
          </div>

          {/* Thẻ tóm tắt giới hạn dùng thử */}
          <div className="p-5 rounded-2xl bg-brand-50 border border-brand-200 text-left space-y-3">
            <p className="text-xs font-extrabold uppercase tracking-wider text-brand-700">
              Quyền lợi gói dùng thử hiện tại
            </p>
            <p className="text-sm font-extrabold text-brand-900">
              1 lớp · 3 bài học/đề · 3 học sinh · mỗi học sinh nộp 1 lần mỗi bài
            </p>
            <ul className="space-y-2 text-xs font-medium text-ink-muted">
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-brand-600 shrink-0" />
                <span>Tạo tối đa 1 lớp học và mời tối đa 3 học sinh tham gia</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-brand-600 shrink-0" />
                <span>Soạn tay hoặc AI nhập tối đa 3 bài học/đề thi</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-brand-600 shrink-0" />
                <span>Mỗi học sinh nộp 1 lần mỗi bài kèm 9 lượt AI chấm thử</span>
              </li>
            </ul>
            <p className="pt-2 border-t border-brand-200 text-xs font-bold text-brand-800">
              Kito sẽ liên hệ xác minh trong 1–2 ngày làm việc để mở đủ tính năng cho {xung}.
            </p>
          </div>

          <button
            type="button"
            onClick={() => router.push("/teacher/classes")}
            className="w-full py-3.5 px-6 rounded-2xl bg-gradient-to-r from-accent-400 to-accent-500 hover:from-accent-500 hover:to-accent-600 text-white font-bold text-base shadow-md transition-all cursor-pointer"
          >
            Vào không gian dạy học
          </button>
        </div>
      </div>
    );
  }

  const stepOrder: TeacherStep[] = [
    "intro",
    "name",
    "subjects",
    "levels",
    "workplace",
    "studentCount",
    "source",
    "phone",
    "email",
    "password",
  ];
  const stepIdx = Math.max(0, stepOrder.indexOf(step));

  let question =
    "Chào thầy cô! Kito sẽ hỏi vài câu để chuẩn bị không gian dạy học phù hợp nhất.";
  let subtext: string | null = null;

  switch (step) {
    case "intro":
      question =
        "Chào thầy cô! Kito sẽ hỏi vài câu để chuẩn bị không gian dạy học phù hợp nhất.";
      subtext = "Tài khoản dùng thử được kích hoạt ngay sau khi hoàn tất.";
      break;
    case "name":
      question = "Kito nên gọi thầy hay cô, và tên của mình là gì ạ?";
      break;
    case "subjects":
      question = `Rất vui được đồng hành cùng ${displayName}! ${Xung} dạy môn gì ạ?`;
      subtext = `${Xung} có thể chọn một hoặc nhiều môn.`;
      break;
    case "levels":
      question = `Học sinh của ${xung} ở cấp nào ạ?`;
      subtext = "Có thể chọn nhiều cấp học.";
      break;
    case "workplace":
      question = `${Xung} đang dạy ở đâu ạ?`;
      break;
    case "studentCount":
      question = `${Xung} dạy khoảng bao nhiêu học sinh ạ?`;
      break;
    case "source":
      question = `${Xung} biết KitoKit qua đâu ạ?`;
      break;
    case "phone":
      question = `Số điện thoại / Zalo để Kito liên hệ xác minh cho ${xung} ạ?`;
      break;
    case "email":
      question = `Email đăng nhập của ${xung} là gì ạ?`;
      break;
    case "password":
      question = `Cuối cùng, ${xung} đặt mật khẩu nhé (ít nhất 8 ký tự).`;
      break;
  }

  const chipSubjects = [
    ...subjectOptions.map((s) => ({ code: s.id, label: s.name })),
    ...(subjectOptions.some((s) => s.id === "other") ? [] : [{ code: "other", label: "Khác" }]),
  ];

  const pwStrength = computeTeacherPasswordStrength(password);

  return (
    <InterviewShell
      stepIndex={stepIdx}
      totalSteps={stepOrder.length - 1}
      canGoBack={step !== "intro"}
      onBack={handleBack}
      mood={mood}
      question={question}
      subtext={subtext}
      errorMessage={errorMsg}
      audience="teacher"
    >
      {/* Màn 0: Bắt đầu */}
      {step === "intro" && (
        <div className="space-y-6 text-center sm:text-left">
          <p className="text-sm text-ink-muted leading-relaxed">
            Hoàn tất khảo sát ngắn (khoảng 1 phút) để mở ngay không gian dạy học dùng thử miễn phí cùng trợ lý AI.
          </p>
          <button
            type="button"
            onClick={() => goToStep("name", "happy")}
            className="w-full sm:w-auto px-8 py-3.5 rounded-2xl bg-gradient-to-r from-accent-400 to-accent-500 hover:from-accent-500 hover:to-accent-600 text-white font-bold text-base shadow-md transition-all cursor-pointer"
          >
            Bắt đầu
          </button>
          <div className="pt-2 text-xs text-ink-subtle">
            Bạn là học sinh?{" "}
            <Link href="/register" className="font-bold text-brand-600 hover:underline">
              Chuyển sang đăng ký học sinh
            </Link>
          </div>
        </div>
      )}

      {/* Màn 1: Họ tên */}
      {step === "name" && (
        <form onSubmit={handleNameNext} className="space-y-4">
          <div className="flex gap-3" role="group" aria-label="Danh xưng">
            {HONORIFICS.map(({ code, label }) => (
              <button
                key={code}
                type="button"
                aria-pressed={draft.honorific === code}
                onClick={() => {
                  setErrorMsg(null);
                  updateDraft({ honorific: code });
                }}
                className={`flex-1 px-4 py-3 rounded-2xl border-2 text-base font-extrabold transition-colors cursor-pointer ${
                  draft.honorific === code
                    ? "border-brand-600 bg-brand-600 text-white"
                    : "border-line bg-white text-ink hover:border-brand-300 hover:bg-brand-50"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          <label htmlFor="teacher-name" className="block text-xs font-bold uppercase text-brand-700">
            Họ tên
          </label>
          <input
            id="teacher-name"
            type="text"
            autoFocus
            aria-label="Họ tên"
            value={draft.name}
            onChange={(e) => updateDraft({ name: e.target.value })}
            placeholder="Ví dụ: Nguyễn Thanh Hoa"
            className="w-full px-4 py-3 rounded-2xl border border-line bg-surface-alt text-base font-bold text-ink focus:outline-none focus:ring-2 focus:ring-brand-600"
          />
          <StepActions>
            <button
              type="submit"
              className="px-6 py-3 rounded-2xl bg-brand-600 hover:bg-brand-700 text-white font-bold text-sm transition-colors cursor-pointer"
            >
              Tiếp
            </button>
          </StepActions>
        </form>
      )}

      {/* Màn 2: Môn dạy */}
      {step === "subjects" && (
        <div className="space-y-5">
          <ChoiceChips
            options={chipSubjects}
            selected={draft.subjects}
            multiple
            onSelect={(code) => toggleMulti("subjects", code)}
          />
          <StepActions>
            <button
              type="button"
              onClick={handleSubjectsNext}
              className="px-6 py-3 rounded-2xl bg-brand-600 hover:bg-brand-700 text-white font-bold text-sm transition-colors cursor-pointer"
            >
              Tiếp
            </button>
          </StepActions>
        </div>
      )}

      {/* Màn 3: Cấp học */}
      {step === "levels" && (
        <div className="space-y-5">
          <ChoiceChips
            options={TEACHER_LEVELS}
            selected={draft.levels}
            multiple
            onSelect={(code) => toggleMulti("levels", code)}
          />
          <StepActions>
            <button
              type="button"
              onClick={handleLevelsNext}
              className="px-6 py-3 rounded-2xl bg-brand-600 hover:bg-brand-700 text-white font-bold text-sm transition-colors cursor-pointer"
            >
              Tiếp
            </button>
          </StepActions>
        </div>
      )}

      {/* Màn 4: Nơi dạy + tên trường/trung tâm */}
      {step === "workplace" && (
        <form onSubmit={handleWorkplaceNext} className="space-y-5">
          <ChoiceChips
            options={WORKPLACE_TYPES}
            selected={draft.workplaceType}
            onSelect={handleWorkplaceTypeSelect}
          />
          <div className="space-y-1.5 pt-2 border-t border-line">
            <label
              htmlFor="teacher-workplace-name"
              className="block text-xs font-bold uppercase text-brand-700"
            >
              Tên trường hoặc trung tâm (tuỳ chọn)
            </label>
            <input
              id="teacher-workplace-name"
              type="text"
              aria-label="Tên trường hoặc trung tâm"
              value={draft.workplaceName}
              onChange={(e) => updateDraft({ workplaceName: e.target.value })}
              placeholder="Ví dụ: Trung tâm Anh ngữ Kito"
              className="w-full px-4 py-3 rounded-2xl border border-line bg-surface-alt text-sm font-bold text-ink focus:outline-none focus:ring-2 focus:ring-brand-600"
            />
          </div>
          <StepActions>
            <button
              type="submit"
              className="px-6 py-3 rounded-2xl bg-brand-600 hover:bg-brand-700 text-white font-bold text-sm transition-colors cursor-pointer"
            >
              Tiếp
            </button>
          </StepActions>
        </form>
      )}

      {/* Màn 5: Quy mô học sinh */}
      {step === "studentCount" && (
        <div className="space-y-4">
          <ChoiceChips
            options={STUDENT_COUNTS}
            selected={draft.studentCount}
            onSelect={handleStudentCountSelect}
          />
          <StepActions />
        </div>
      )}


      {/* Màn 7: Nguồn biết đến */}
      {step === "source" && (
        <div className="space-y-5">
          <ChoiceChips
            options={SIGNUP_SOURCES}
            selected={draft.source}
            onSelect={handleSourceSelect}
          />
          <StepActions>
            <button
              type="button"
              onClick={() => goToStep("phone", "think")}
              className="px-5 py-2.5 rounded-xl border border-line text-xs font-bold text-ink-muted hover:text-ink cursor-pointer"
            >
              Tiếp
            </button>
          </StepActions>
        </div>
      )}

      {/* Màn 8: Số điện thoại */}
      {step === "phone" && (
        <form onSubmit={handlePhoneNext} className="space-y-4">
          <label htmlFor="teacher-phone" className="block text-xs font-bold uppercase text-brand-700">
            Số điện thoại
          </label>
          <input
            id="teacher-phone"
            type="tel"
            autoFocus
            aria-label="Số điện thoại"
            value={draft.phone}
            onChange={(e) => updateDraft({ phone: e.target.value })}
            placeholder="0912345678"
            className="w-full px-4 py-3 rounded-2xl border border-line bg-surface-alt text-base font-bold text-ink focus:outline-none focus:ring-2 focus:ring-brand-600"
          />
          <StepActions>
            <button
              type="submit"
              className="px-6 py-3 rounded-2xl bg-brand-600 hover:bg-brand-700 text-white font-bold text-sm transition-colors cursor-pointer"
            >
              Tiếp
            </button>
          </StepActions>
        </form>
      )}

      {/* Màn 9: Email */}
      {step === "email" && (
        <form onSubmit={handleEmailNext} className="space-y-4">
          <label htmlFor="teacher-email" className="block text-xs font-bold uppercase text-brand-700">
            Email
          </label>
          <input
            id="teacher-email"
            type="email"
            autoFocus
            aria-label="Email"
            value={draft.email}
            onChange={(e) => updateDraft({ email: e.target.value })}
            placeholder="thayco@truong.edu.vn"
            className="w-full px-4 py-3 rounded-2xl border border-line bg-surface-alt text-base font-bold text-ink focus:outline-none focus:ring-2 focus:ring-brand-600"
          />
          <EmailAvailabilityHint status={emailCheck.status} message={emailCheck.message} />
          <StepActions>
            <button
              type="submit"
              className="px-6 py-3 rounded-2xl bg-brand-600 hover:bg-brand-700 text-white font-bold text-sm transition-colors cursor-pointer"
            >
              Tiếp
            </button>
          </StepActions>
        </form>
      )}

      {/* Màn 10: Mật khẩu */}
      {step === "password" && (
        <form onSubmit={handleSubmitTeacher} className="space-y-4">
          <input
            type="text"
            name="website"
            tabIndex={-1}
            autoComplete="off"
            value={website}
            onChange={(e) => setWebsite(e.target.value)}
            className="hidden"
            aria-hidden="true"
          />

          <label htmlFor="teacher-password" className="block text-xs font-bold uppercase text-brand-700">
            Mật khẩu
          </label>
          <div className="relative">
            <input
              id="teacher-password"
              type={showPassword ? "text" : "password"}
              autoFocus
              aria-label="Mật khẩu"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Ít nhất 8 ký tự"
              className="w-full pl-4 pr-11 py-3 rounded-2xl border border-line bg-surface-alt text-base font-bold text-ink focus:outline-none focus:ring-2 focus:ring-brand-600"
            />
            <button
              type="button"
              aria-label={showPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
              onClick={() => setShowPassword((v) => !v)}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-ink-subtle hover:text-ink cursor-pointer"
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>

          <div className="space-y-1.5">
            <div className="grid grid-cols-4 gap-1.5 h-1.5">
              {[1, 2, 3, 4].map((bar) => (
                <div
                  key={bar}
                  className={`rounded-full transition-colors ${
                    pwStrength.level >= bar
                      ? pwStrength.level === 1
                        ? "bg-rose-500"
                        : pwStrength.level === 2
                          ? "bg-amber-400"
                          : "bg-emerald-500"
                      : "bg-line"
                  }`}
                />
              ))}
            </div>
            <p className="text-xs font-medium text-ink-muted">{pwStrength.label}</p>
          </div>

          <StepActions>
            {networkFailed && (
              <button
                type="button"
                onClick={() => handleSubmitTeacher()}
                className="inline-flex items-center gap-1.5 px-4 py-3 rounded-2xl border border-brand-300 bg-brand-50 text-brand-700 font-bold text-sm cursor-pointer"
              >
                <RotateCcw className="w-4 h-4" />
                <span>Thử lại</span>
              </button>
            )}
            <button
              type="submit"
              disabled={submitting}
              className="px-6 py-3 rounded-2xl bg-gradient-to-r from-accent-400 to-accent-500 hover:from-accent-500 hover:to-accent-600 text-white font-bold text-sm shadow-md transition-all cursor-pointer inline-flex items-center gap-2 disabled:opacity-50"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Đang chuẩn bị…</span>
                </>
              ) : (
                <span>Tiếp</span>
              )}
            </button>
          </StepActions>
        </form>
      )}
    </InterviewShell>
  );
}
