"use client";

import React, { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Eye,
  EyeOff,
  Copy,
  Check,
  Sparkles,
  Loader2,
  RotateCcw,
  School,
  CheckCircle2,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import {
  GRADE_LEVELS,
  ENGLISH_GOALS,
  PLACEHOLDER_EMAIL_DOMAIN,
  placeholderEmail,
  validateUsername,
  usernameBaseFromName,
  normalizeUsername,
  isPlaceholderEmail,
  suggestUsernames,
} from "@/lib/onboarding";
import InterviewShell from "@/components/onboarding/InterviewShell";
import StepActions from "@/components/onboarding/StepActions";
import { useEmailAvailability, EmailAvailabilityHint } from "@/components/onboarding/useEmailAvailability";
import ChoiceChips from "@/components/onboarding/ChoiceChips";
import Mascot, { type MascotMood } from "@/components/onboarding/Mascot";
import Confetti from "@/components/onboarding/Confetti";
import { useInterviewDraft } from "@/components/onboarding/useInterviewDraft";

type StudentStep =
  | "intro"
  | "name"
  | "grade"
  | "subjects"
  | "englishGoal"
  | "hasClassCode"
  | "classCode"
  | "hasEmail"
  | "email"
  | "username"
  | "password"
  | "done";

interface StudentDraft {
  step: StudentStep;
  name: string;
  gradeLevel: string;
  subjects: string[];
  englishGoal: string;
  targetScore: string;
  wantsClassCode: boolean | null;
  classCode: string;
  hasEmail: boolean | null;
  email: string;
  username: string;
}

interface SubjectOption {
  id: string;
  name: string;
}

interface ClassPreview {
  id: string;
  name: string;
  code: string;
  teacher_name: string | null;
}

const INITIAL_DRAFT: StudentDraft = {
  step: "intro",
  name: "",
  gradeLevel: "",
  subjects: [],
  englishGoal: "",
  targetScore: "",
  wantsClassCode: null,
  classCode: "",
  hasEmail: null,
  email: "",
  username: "",
};

function computePasswordStrength(pw: string): { level: number; label: string } {
  if (!pw) return { level: 0, label: "Chưa nhập mật khẩu" };
  if (pw.length < 6) return { level: 1, label: "Cần ít nhất 6 ký tự" };
  let score = 2;
  if (pw.length >= 8 && /[0-9]/.test(pw) && /[a-zA-Z]/.test(pw)) score = 3;
  if (pw.length >= 10 && /[^a-zA-Z0-9]/.test(pw)) score = 4;
  const labels = ["", "Quá ngắn", "Đủ dùng", "Khá mạnh", "Rất mạnh"];
  return { level: score, label: labels[score] || "Đủ dùng" };
}

export default function StudentRegisterPage() {
  const { registerStudent } = useAuth();
  const router = useRouter();
  const { draft, updateDraft, clearDraft } = useInterviewDraft<StudentDraft>(
    "kitokit-signup-student",
    INITIAL_DRAFT
  );

  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [website, setWebsite] = useState("");
  const [mood, setMood] = useState<MascotMood>("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [networkFailed, setNetworkFailed] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Danh sách môn từ API
  const [subjectOptions, setSubjectOptions] = useState<SubjectOption[]>([
    { id: "english", name: "Tiếng Anh" },
  ]);

  // Tra cứu mã lớp (Câu 4a): lưu kết quả kèm mã đã tra; mã đổi mà chưa có kết quả → đang tra
  const [classLookup, setClassLookup] = useState<{
    code: string;
    preview: ClassPreview | null;
    error: string | null;
  } | null>(null);
  const lookupCode = draft.classCode.trim();
  const classLookupDone = classLookup && classLookup.code === lookupCode ? classLookup : null;
  const classPreview = classLookupDone?.preview ?? null;
  const classLookupError = classLookupDone?.error ?? null;
  const classLookupLoading = !!lookupCode && !classLookupDone; // chỉ hiển thị ở màn nhập mã lớp

  // Kiểm tra tên đăng nhập (Câu 5b): kiểm tra định dạng ngay khi render, kết quả server lưu kèm tên đã kiểm
  const [usernameCheck, setUsernameCheck] = useState<{
    username: string;
    status: "available" | "taken" | "idle";
    message: string | null;
    suggestions: string[];
  } | null>(null);
  const normalizedUsername = normalizeUsername(draft.username);
  const usernameLocalError = validateUsername(normalizedUsername);
  const nameSuggestions = useMemo(() => suggestUsernames(usernameBaseFromName(draft.name), 3), [draft.name]);
  const usernameCheckDone =
    usernameCheck && usernameCheck.username === normalizedUsername ? usernameCheck : null;
  const usernameStatus: "idle" | "checking" | "available" | "taken" | "invalid" = usernameLocalError
    ? "invalid"
    : usernameCheckDone?.status ?? "checking";
  const usernameMessage = usernameLocalError ?? usernameCheckDone?.message ?? null;
  const usernameSuggestions = usernameLocalError ? nameSuggestions : usernameCheckDone?.suggestions ?? [];

  // Dữ liệu sau khi hoàn tất
  const [completedData, setCompletedData] = useState<{
    username: string;
    enrolled: { classId: string; className: string } | null;
    enrollError?: string;
  } | null>(null);
  const [copied, setCopied] = useState(false);

  const step: StudentStep = draft.step || "intro";
  const emailCheck = useEmailAvailability(draft.email, step === "email");
  // Gọi bằng tên riêng (từ cuối của họ tên) cho thân thiện: "Nguyễn Văn An" → "An"
  const displayName = draft.name.trim().split(/\s+/).pop() || "bạn";

  // Tải môn học hệ thống
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

  // Tra cứu lớp học khi ở màn classCode
  useEffect(() => {
    if (step !== "classCode") return;
    const code = draft.classCode.trim();
    if (!code) return;

    let cancelled = false;
    const timer = window.setTimeout(async () => {
      try {
        const res = await fetch(`/api/classes/lookup/${encodeURIComponent(code)}`);
        const data = await res.json().catch(() => ({}));
        if (cancelled) return;
        if (res.ok && data.success && data.class) {
          setClassLookup({ code, preview: data.class, error: null });
          setMood("happy");
        } else {
          setClassLookup({
            code,
            preview: null,
            error: data.error || "Mình chưa tìm thấy lớp với mã này. Bạn kiểm tra lại hoặc bỏ qua nhé.",
          });
          setMood("oops");
        }
      } catch {
        if (!cancelled) {
          setClassLookup({
            code,
            preview: null,
            error: "Không kiểm tra được mã lớp lúc này. Bạn có thể thử lại hoặc bỏ qua.",
          });
        }
      }
    }, 150);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [step, draft.classCode]);

  // Kiểm tra tên đăng nhập với server khi ở màn username (chờ 400ms); lỗi định dạng đã tính lúc render
  useEffect(() => {
    if (step !== "username") return;
    const normalized = normalizeUsername(draft.username);
    if (validateUsername(normalized)) {
      const t = window.setTimeout(() => setMood("oops"), 0);
      return () => window.clearTimeout(t);
    }

    let cancelled = false;
    const timer = window.setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/auth/username-available?u=${encodeURIComponent(normalized)}`
        );
        const data = await res.json().catch(() => ({}));
        if (cancelled) return;
        if (res.ok && data.available) {
          setUsernameCheck({ username: normalized, status: "available", message: "Tên này dùng được", suggestions: [] });
          setMood("happy");
        } else {
          setUsernameCheck({
            username: normalized,
            status: "taken",
            message: data.error || "Tên đăng nhập này đã được đặt trước, bạn chọn tên khác nhé.",
            suggestions:
              Array.isArray(data.suggestions) && data.suggestions.length > 0
                ? data.suggestions
                : suggestUsernames(normalized, 3),
          });
          setMood("oops");
        }
      } catch {
        if (!cancelled) {
          setUsernameCheck({ username: normalized, status: "idle", message: null, suggestions: [] });
        }
      }
    }, 400);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [step, draft.username]);

  const goToStep = (nextStep: StudentStep, nextMood: MascotMood = "think") => {
    setErrorMsg(null);
    setNetworkFailed(false);
    setMood(nextMood);
    updateDraft({ step: nextStep });
  };

  const handleBack = () => {
    setErrorMsg(null);
    setNetworkFailed(false);
    switch (step) {
      case "name":
        goToStep("intro", "idle");
        break;
      case "grade":
        goToStep("name");
        break;
      case "subjects":
        goToStep("grade");
        break;
      case "englishGoal":
        goToStep("subjects");
        break;
      case "hasClassCode":
        if (draft.subjects.includes("english")) {
          goToStep("englishGoal");
        } else {
          goToStep("subjects");
        }
        break;
      case "classCode":
        goToStep("hasClassCode");
        break;
      case "hasEmail":
        if (draft.wantsClassCode) {
          goToStep("classCode");
        } else {
          goToStep("hasClassCode");
        }
        break;
      case "email":
      case "username":
        goToStep("hasEmail");
        break;
      case "password":
        if (draft.hasEmail === false) {
          goToStep("username");
        } else {
          goToStep("email");
        }
        break;
      default:
        break;
    }
  };

  const handleNameNext = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmed = draft.name.trim();
    if (trimmed.length < 2 || trimmed.length > 100) {
      setMood("oops");
      setErrorMsg("Bạn nhập tên từ 2 đến 100 ký tự nhé.");
      return;
    }
    goToStep("grade", "happy");
  };

  const handleGradeSelect = (code: string) => {
    updateDraft({ gradeLevel: code, step: "subjects" });
    setErrorMsg(null);
    setMood("happy");
  };

  const handleToggleSubject = (code: string) => {
    setErrorMsg(null);
    const current = draft.subjects || [];
    const exists = current.includes(code);
    const next = exists ? current.filter((x) => x !== code) : [...current, code];
    updateDraft({ subjects: next });
  };

  const handleSubjectsNext = () => {
    if (!draft.subjects || draft.subjects.length === 0) {
      setMood("oops");
      setErrorMsg("Bạn chọn ít nhất một môn muốn học nhé.");
      return;
    }
    if (draft.subjects.includes("english")) {
      goToStep("englishGoal", "happy");
    } else {
      goToStep("hasClassCode", "happy");
    }
  };

  const handleEnglishGoalSelect = (code: string) => {
    updateDraft({ englishGoal: code, step: "hasClassCode" });
    setErrorMsg(null);
    setMood("happy");
  };

  const handleClassCodeNext = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    goToStep("hasEmail", "happy");
  };

  const handleChooseNoEmail = () => {
    let defaultU = draft.username.trim();
    if (!defaultU) {
      const base = usernameBaseFromName(draft.name);
      const suffix = Math.floor(10 + Math.random() * 89);
      defaultU = `${base}${suffix}`.slice(0, 30);
    }
    updateDraft({
      hasEmail: false,
      username: defaultU,
      step: "username",
    });
    setErrorMsg(null);
    setMood("think");
  };

  const handleChooseHasEmail = () => {
    updateDraft({
      hasEmail: true,
      step: "email",
    });
    setErrorMsg(null);
    setMood("think");
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
      setErrorMsg("Bạn nhập địa chỉ email hợp lệ nhé.");
      return;
    }
    if (isPlaceholderEmail(clean)) {
      setMood("oops");
      setErrorMsg(
        `Đuôi @${PLACEHOLDER_EMAIL_DOMAIN} dành cho email tạm của hệ thống. Bạn hãy nhập email thật nhé.`
      );
      return;
    }
    goToStep("password", "happy");
  };

  const handleUsernameNext = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const normalized = normalizeUsername(draft.username);
    const err = validateUsername(normalized);
    if (err) {
      setMood("oops");
      setErrorMsg(err);
      return;
    }
    if (usernameStatus === "taken") {
      setMood("oops");
      setErrorMsg("Tên đăng nhập này đã có bạn khác dùng, bạn chọn tên khác nhé.");
      return;
    }
    updateDraft({ username: normalized });
    goToStep("password", "happy");
  };

  const handleSubmitRegistration = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setErrorMsg(null);
    setNetworkFailed(false);

    if (password.trim().length < 6) {
      setMood("oops");
      setErrorMsg("Mật khẩu cần có ít nhất 6 ký tự nhé.");
      return;
    }

    setSubmitting(true);
    setMood("think");

    const res = await registerStudent({
      name: draft.name.trim(),
      gradeLevel: draft.gradeLevel || null,
      goals: {
        subjects: draft.subjects,
        ...(draft.subjects.includes("english") && draft.englishGoal
          ? { englishGoal: draft.englishGoal }
          : {}),
        ...(draft.targetScore.trim() ? { targetScore: draft.targetScore.trim() } : {}),
      },
      hasEmail: draft.hasEmail !== false,
      ...(draft.hasEmail === false
        ? { username: normalizeUsername(draft.username) }
        : { email: draft.email.trim().toLowerCase() }),
      password: password.trim(),
      ...(draft.wantsClassCode && draft.classCode.trim()
        ? { classCode: draft.classCode.trim() }
        : {}),
      website,
    });

    setSubmitting(false);

    if (res.success) {
      clearDraft();
      setCompletedData({
        username: res.username || normalizeUsername(draft.username) || res.user?.username || "",
        enrolled: res.enrolled || null,
        enrollError: res.enrollError,
      });
      setMood("celebrate");
      updateDraft({ step: "done" });
      return;
    }

    setMood("oops");

    if (res.networkError) {
      setNetworkFailed(true);
      setErrorMsg(res.error || "Lỗi kết nối mạng. Câu trả lời của bạn vẫn được giữ nguyên.");
      return;
    }

    if (res.status === 429) {
      const mins = res.retryAfterSeconds ? Math.max(1, Math.ceil(res.retryAfterSeconds / 60)) : 60;
      setErrorMsg(`Bạn thao tác quá nhanh. Vui lòng chờ khoảng ${mins} phút rồi thử lại nhé.`);
      return;
    }

    if (Array.isArray(res.suggestions) && res.suggestions.length > 0) {
      setUsernameCheck({
        username: normalizedUsername,
        status: "taken",
        message: res.error || "Tên đăng nhập này đã có bạn khác dùng rồi.",
        suggestions: res.suggestions,
      });
    }

    if (res.field) {
      const fieldStepMap: Record<string, StudentStep> = {
        name: "name",
        gradeLevel: "grade",
        goals: "subjects",
        subjects: "subjects",
        englishGoal: "englishGoal",
        targetScore: "englishGoal",
        email: "email",
        username: "username",
        password: "password",
      };
      const targetStep = fieldStepMap[res.field];
      if (targetStep) {
        updateDraft({ step: targetStep });
      }
    }

    setErrorMsg(res.error || "Đăng ký chưa thành công, bạn kiểm tra lại thông tin nhé.");
  };

  const handleCopyUsername = async (u: string) => {
    try {
      await navigator.clipboard.writeText(u);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // Bỏ qua nếu trình duyệt chặn clipboard
    }
  };

  // Màn hoàn tất
  if (step === "done" || completedData) {
    const finalUsername = completedData?.username || normalizeUsername(draft.username);
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
              Hoàn tất đăng ký
            </span>
            <h1 className="font-display text-2xl sm:text-3xl font-extrabold text-ink">
              Xong rồi! Chào mừng {displayName} đến với KitoKit 🎉
            </h1>
          </div>

          {finalUsername && (
            <div className="p-4 sm:p-5 rounded-2xl bg-brand-50 border border-brand-200 space-y-2">
              <p className="text-xs font-bold uppercase tracking-wider text-brand-700">
                Tên đăng nhập của bạn
              </p>
              <div className="flex items-center justify-center gap-3 flex-wrap">
                <span className="font-display text-2xl font-extrabold text-brand-800 tracking-tight">
                  {finalUsername}
                </span>
                <button
                  type="button"
                  onClick={() => handleCopyUsername(finalUsername)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border border-brand-200 hover:bg-brand-100 text-xs font-bold text-brand-700 transition-colors cursor-pointer"
                >
                  {copied ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Đã chép</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Sao chép</span>
                    </>
                  )}
                </button>
              </div>
              <p className="text-xs font-semibold text-brand-700">
                Nhớ tên đăng nhập này nhé!
              </p>
            </div>
          )}

          {completedData?.enrolled && (
            <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-900 flex items-center justify-center gap-2.5 text-sm font-bold">
              <School className="w-5 h-5 text-emerald-600 shrink-0" />
              <span>Đã vào lớp: {completedData.enrolled.className}</span>
            </div>
          )}

          {completedData?.enrollError && !completedData?.enrolled && (
            <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 text-xs sm:text-sm font-semibold">
              Tài khoản đã tạo xong! Tuy nhiên bạn chưa vào được lớp ({completedData.enrollError}). Bạn nhờ thầy cô kiểm tra lại nhé.
            </div>
          )}

          <button
            type="button"
            onClick={() => router.push("/student/dashboard")}
            className="w-full py-3.5 px-6 rounded-2xl bg-gradient-to-r from-accent-400 to-accent-500 hover:from-accent-500 hover:to-accent-600 text-white font-bold text-base shadow-md transition-all cursor-pointer"
          >
            Vào học thôi
          </button>
        </div>
      </div>
    );
  }

  // Xác định chỉ số tiến độ và câu hỏi của Mascot
  const stepOrder: StudentStep[] = [
    "intro",
    "name",
    "grade",
    "subjects",
    "englishGoal",
    "hasClassCode",
    "classCode",
    "hasEmail",
    "email",
    "username",
    "password",
  ];
  const stepIdx = Math.max(0, stepOrder.indexOf(step));

  let question = "Chào bạn! Mình là Kito, mình sẽ giúp bạn tạo tài khoản trong 1 phút nhé.";
  let subtext: string | null = null;

  switch (step) {
    case "intro":
      question = "Chào bạn! Mình là Kito, mình sẽ giúp bạn tạo tài khoản trong 1 phút nhé.";
      subtext = "Chỉ vài câu hỏi ngắn gọn là mình bắt đầu học được ngay.";
      break;
    case "name":
      question = "Bạn tên là gì?";
      subtext = "Cho mình biết tên để tiện xưng hô nhé.";
      break;
    case "grade":
      question = `Rất vui được gặp ${displayName}! ${displayName} đang học lớp mấy?`;
      break;
    case "subjects":
      question = `${displayName} muốn học gì cùng Kito?`;
      subtext = "Bạn có thể chọn một hoặc nhiều môn học.";
      break;
    case "englishGoal":
      question = `Mục tiêu tiếng Anh của ${displayName} là gì?`;
      break;
    case "hasClassCode":
      question = `Thầy cô có cho ${displayName} mã lớp không?`;
      break;
    case "classCode":
      question = `${displayName} nhập mã lớp vào đây nhé.`;
      break;
    case "hasEmail":
      question = `${displayName} ơi, Bạn có email không?`;
      subtext = "Nếu chưa có email cá nhân, mình sẽ tạo tên đăng nhập cực dễ nhớ cho bạn.";
      break;
    case "email":
      question = `Email của ${displayName} là gì?`;
      break;
    case "username":
      question = `Không sao! Mình cùng tạo một tên đăng nhập nhé. ${displayName} sẽ dùng nó để đăng nhập.`;
      break;
    case "password":
      question = `Giờ đặt mật khẩu bí mật cho ${displayName} nhé. Ít nhất 6 ký tự.`;
      break;
  }

  const chipSubjects = [
    ...subjectOptions.map((s) => ({ code: s.id, label: s.name })),
    ...(subjectOptions.some((s) => s.id === "other") ? [] : [{ code: "other", label: "Khác" }]),
  ];

  const pwStrength = computePasswordStrength(password);
  const currentPlaceholderEmail = placeholderEmail(draft.username || "ten.ban");

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
      audience="student"
    >
      {/* Màn 0: Bắt đầu */}
      {step === "intro" && (
        <div className="space-y-6 text-center sm:text-left">
          <p className="text-sm text-ink-muted leading-relaxed">
            Kito sẽ hỏi bạn vài câu ngắn gọn để chuẩn bị bài tập và lộ trình phù hợp nhất với bạn.
          </p>
          <button
            type="button"
            onClick={() => goToStep("name", "happy")}
            className="w-full sm:w-auto px-8 py-3.5 rounded-2xl bg-gradient-to-r from-accent-400 to-accent-500 hover:from-accent-500 hover:to-accent-600 text-white font-bold text-base shadow-md transition-all cursor-pointer"
          >
            Bắt đầu
          </button>
          <div className="pt-2 text-xs text-ink-subtle">
            Bạn là giáo viên?{" "}
            <Link href="/register/teacher" className="font-bold text-brand-600 hover:underline">
              Đăng ký giáo viên dùng thử
            </Link>
          </div>
        </div>
      )}

      {/* Màn 1: Tên của bạn */}
      {step === "name" && (
        <form onSubmit={handleNameNext} className="space-y-4">
          <label htmlFor="student-name" className="block text-xs font-bold uppercase text-brand-700">
            Tên của bạn
          </label>
          <input
            id="student-name"
            type="text"
            autoFocus
            aria-label="Tên của bạn"
            value={draft.name}
            onChange={(e) => updateDraft({ name: e.target.value })}
            placeholder="Ví dụ: Nguyễn Minh An"
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

      {/* Màn 2: Lớp mấy */}
      {step === "grade" && (
        <div className="space-y-4">
          <ChoiceChips
            options={GRADE_LEVELS}
            selected={draft.gradeLevel}
            onSelect={handleGradeSelect}
          />
          <StepActions />
        </div>
      )}

      {/* Màn 3: Môn học */}
      {step === "subjects" && (
        <div className="space-y-5">
          <ChoiceChips
            options={chipSubjects}
            selected={draft.subjects}
            multiple
            onSelect={handleToggleSubject}
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

      {/* Màn 3b: Mục tiêu tiếng Anh */}
      {step === "englishGoal" && (
        <div className="space-y-5">
          <ChoiceChips
            options={ENGLISH_GOALS}
            selected={draft.englishGoal}
            onSelect={handleEnglishGoalSelect}
          />
          {(draft.englishGoal === "IELTS" || draft.englishGoal === "TOEIC") && (
            <div className="pt-2 space-y-2 border-t border-line">
              <label
                htmlFor="student-target-score"
                className="block text-xs font-bold text-ink-muted"
              >
                Điểm mục tiêu (tuỳ chọn)
              </label>
              <div className="flex gap-2">
                <input
                  id="student-target-score"
                  type="text"
                  aria-label="Điểm mục tiêu"
                  value={draft.targetScore}
                  onChange={(e) => updateDraft({ targetScore: e.target.value })}
                  placeholder={draft.englishGoal === "IELTS" ? "Ví dụ: 6.5" : "Ví dụ: 750"}
                  className="flex-1 px-4 py-2.5 rounded-xl border border-line bg-surface-alt text-sm font-semibold text-ink"
                />
                <button
                  type="button"
                  onClick={() => goToStep("hasClassCode", "happy")}
                  className="px-5 py-2.5 rounded-xl bg-brand-600 text-white text-xs font-bold cursor-pointer"
                >
                  Tiếp
                </button>
              </div>
            </div>
          )}
          <StepActions />
        </div>
      )}

      {/* Màn 4: Có mã lớp không? */}
      {step === "hasClassCode" && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => {
              updateDraft({ wantsClassCode: true, step: "classCode" });
              setErrorMsg(null);
              setMood("think");
            }}
            className="p-4 rounded-2xl border-2 border-brand-200 bg-brand-50/50 hover:bg-brand-100/60 hover:border-brand-500 text-sm font-bold text-brand-800 transition-all cursor-pointer"
          >
            Có mã lớp
          </button>
          <button
            type="button"
            onClick={() => {
              updateDraft({ wantsClassCode: false, classCode: "", step: "hasEmail" });
              setErrorMsg(null);
              setMood("think");
            }}
            className="p-4 rounded-2xl border-2 border-line bg-white hover:border-brand-400 text-sm font-bold text-ink transition-all cursor-pointer"
          >
            Chưa có, bỏ qua
          </button>
          </div>
          <StepActions />
        </div>
      )}

      {/* Màn 4a: Nhập mã lớp */}
      {step === "classCode" && (
        <form onSubmit={handleClassCodeNext} className="space-y-4">
          <label htmlFor="student-class-code" className="block text-xs font-bold uppercase text-brand-700">
            Mã lớp
          </label>
          <input
            id="student-class-code"
            type="text"
            autoFocus
            aria-label="Mã lớp"
            value={draft.classCode}
            onChange={(e) => updateDraft({ classCode: e.target.value.toUpperCase() })}
            placeholder="Ví dụ: E2E3A"
            className="w-full px-4 py-3 rounded-2xl border border-line bg-surface-alt text-base font-extrabold uppercase tracking-wider text-brand-700 focus:outline-none focus:ring-2 focus:ring-brand-600"
          />

          {classLookupLoading && (
            <p className="text-xs font-semibold text-ink-muted flex items-center gap-1.5">
              <Loader2 className="w-3.5 h-3.5 animate-spin text-brand-600" />
              <span>Đang tìm lớp học…</span>
            </p>
          )}

          {classPreview && (
            <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-900 space-y-1">
              <div className="flex items-center gap-2 font-extrabold text-sm">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>{classPreview.name}</span>
              </div>
              {classPreview.teacher_name && (
                <p className="text-xs font-medium text-emerald-800">
                  Giáo viên: {classPreview.teacher_name}
                </p>
              )}
            </div>
          )}

          {classLookupError && (
            <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 text-xs font-semibold">
              {classLookupError}
            </div>
          )}

          <StepActions>
            <button
              type="button"
              onClick={() => {
                updateDraft({ wantsClassCode: false, classCode: "", step: "hasEmail" });
                setErrorMsg(null);
              }}
              className="px-4 py-2.5 rounded-xl border border-line text-xs font-bold text-ink-muted hover:text-ink cursor-pointer"
            >
              Chưa có, bỏ qua
            </button>
            <button
              type="submit"
              className="px-6 py-3 rounded-2xl bg-brand-600 hover:bg-brand-700 text-white font-bold text-sm transition-colors cursor-pointer"
            >
              Tiếp
            </button>
          </StepActions>
        </form>
      )}

      {/* Màn 5: Bạn có email không? */}
      {step === "hasEmail" && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <button
            type="button"
            onClick={handleChooseHasEmail}
            className="p-4 rounded-2xl border-2 border-brand-200 bg-brand-50/50 hover:bg-brand-100/60 hover:border-brand-500 text-sm font-bold text-brand-800 transition-all cursor-pointer"
          >
            Có
          </button>
          <button
            type="button"
            onClick={handleChooseNoEmail}
            className="p-4 rounded-2xl border-2 border-line bg-white hover:border-brand-400 text-sm font-bold text-ink transition-all cursor-pointer"
          >
            Không có
          </button>
          </div>
          <StepActions />
        </div>
      )}

      {/* Màn 5a: Nhập Email thật */}
      {step === "email" && (
        <form onSubmit={handleEmailNext} className="space-y-4">
          <label htmlFor="student-email" className="block text-xs font-bold uppercase text-brand-700">
            Email
          </label>
          <input
            id="student-email"
            type="email"
            autoFocus
            aria-label="Email"
            value={draft.email}
            onChange={(e) => updateDraft({ email: e.target.value })}
            placeholder="ten.ban@gmail.com"
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

      {/* Màn 5b: Tạo tên đăng nhập */}
      {step === "username" && (
        <form onSubmit={handleUsernameNext} className="space-y-4">
          <label htmlFor="student-username" className="block text-xs font-bold uppercase text-brand-700">
            Tên đăng nhập
          </label>
          <input
            id="student-username"
            type="text"
            autoFocus
            aria-label="Tên đăng nhập"
            value={draft.username}
            onChange={(e) => updateDraft({ username: e.target.value.toLowerCase() })}
            placeholder="an.nguyen24"
            className="w-full px-4 py-3 rounded-2xl border border-line bg-surface-alt text-base font-extrabold text-brand-700 focus:outline-none focus:ring-2 focus:ring-brand-600"
          />

          {usernameStatus === "checking" && (
            <p className="text-xs font-semibold text-ink-muted">Đang kiểm tra tên đăng nhập…</p>
          )}

          {usernameStatus === "available" && usernameMessage && (
            <p className="text-xs font-bold text-emerald-700 flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{usernameMessage}</span>
            </p>
          )}

          {(usernameStatus === "taken" || usernameStatus === "invalid") && usernameMessage && (
            <div className="space-y-2">
              <p className="text-xs font-bold text-rose-700">{usernameMessage}</p>
              {usernameSuggestions.length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-xs text-ink-muted font-medium">
                    Gợi ý tên còn trống (bấm để chọn):
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {usernameSuggestions.map((sug) => (
                      <button
                        key={sug}
                        type="button"
                        onClick={() => updateDraft({ username: sug })}
                        className="px-3 py-1.5 rounded-xl bg-brand-50 border border-brand-200 hover:bg-brand-100 text-xs font-bold text-brand-700 cursor-pointer"
                      >
                        {sug}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          <p className="text-xs text-ink-muted bg-surface-alt p-3 rounded-xl border border-line">
            Email tạm của bạn: <u className="font-bold text-ink">{currentPlaceholderEmail}</u> — bạn đổi được sau
          </p>

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

      {/* Màn 6: Mật khẩu */}
      {step === "password" && (
        <form onSubmit={handleSubmitRegistration} className="space-y-4">
          {/* Bẫy bot ẩn */}
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

          <label htmlFor="student-password" className="block text-xs font-bold uppercase text-brand-700">
            Mật khẩu
          </label>
          <div className="relative">
            <input
              id="student-password"
              type={showPassword ? "text" : "password"}
              autoFocus
              aria-label="Mật khẩu"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Ít nhất 6 ký tự"
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

          {/* Vạch báo độ mạnh mật khẩu */}
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
                onClick={() => handleSubmitRegistration()}
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
