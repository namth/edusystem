"use client";

// SCR-24 / SCR-23 — AI nhập đề (FEAT-009) + chuyển dạng câu giấy → dạng hệ thống (FEAT-015, DEC-042 → DEC-046).
// Studio giữ DỮ LIỆU GỐC (RawGroup) và chuyển đổi lại ngay trên trình duyệt mỗi khi giáo viên sửa / đổi dạng.
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  UploadCloud,
  FileText,
  CheckCircle2,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Sparkles,
  Trash2,
  Edit3,
  Plus,
  BookOpen,
  Loader2,
  Layers,
  Save,
  Check,
  X,
  Eye,
  ArrowRight,
} from "lucide-react";
import LessonPlayer from "@/components/lesson-player/LessonPlayer";
import {
  CATEGORY_LABELS,
  PAPER_FORMAT_LABELS,
  convertGroup,
  countScoreItems,
  switchableFormats,
  type ConvertedQuestion,
  type GroupConversion,
  type PaperFormat,
  type RawGroup,
  type RawSubQuestion,
} from "@/lib/question-conversion";
import { sanitizeQuestionForStudent } from "@/lib/grading";
import { splitOrderingItems } from "@/lib/question-content-types";
import { sanitizeInlineHtml, stripHtml } from "@/lib/stimulus-html";

export interface AiExamIngestionStudioProps {
  initialDestinationType?: "standalone" | "curriculum";
  initialCourseId?: string;
  initialUnitId?: string;
}

interface CourseLite {
  id: string;
  name?: string;
  title?: string;
  curriculum?: { id: string; title?: string }[];
}

interface InvalidItem {
  index: number;
  tempId?: string;
  reason: string;
}

/** Đáp án đúng theo dạng câu, để "Xem như học sinh" hiện sẵn đáp án. */
function answerFor(q: ConvertedQuestion): unknown {
  const c = q.content as Record<string, unknown>;
  if (q.category.endsWith("_MC")) {
    const out: Record<string, string> = {};
    for (const s of (c.sub_questions as { id: string; correct_answer: string | null }[]) || []) if (s.correct_answer) out[s.id] = s.correct_answer;
    return out;
  }
  if (q.category.endsWith("_FILL_IN")) return c.correct_answers || [];
  if (q.category.endsWith("_ORDERING")) return splitOrderingItems(String(c.correct_text || ""), c.ordering_type as "WORD_ORDERING" | "SENTENCE_ORDERING");
  if (q.category.endsWith("_MATCHING")) {
    const out: Record<string, string> = {};
    for (const p of (c.pairs as { id: string; right: string }[]) || []) out[p.id] = p.right;
    return out;
  }
  if (q.category === "WRITING_SENTENCE_REWRITE") return String(c.correct_answer || "").replace(/\[(.*?)\]/, "$1");
  return undefined;
}

const newSub = (number: number): RawSubQuestion => ({
  id: `sub_${Date.now()}_${number}`,
  number,
  text_html: `Câu ${number}`,
  options: ["A", "B", "C", "D"].map((key) => ({ key, text_html: `Lựa chọn ${key}` })),
  correct_answer: null,
  answer_source: "NONE",
  paper_format: "GENERAL_MC",
  confidence: 1,
});

export default function AiExamIngestionStudio({ initialDestinationType, initialCourseId, initialUnitId }: AiExamIngestionStudioProps = {}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const querySource = searchParams?.get("source");
  const queryCourseId = searchParams?.get("courseId");
  const queryUnitId = searchParams?.get("unitId");

  const destinationType: "standalone" | "curriculum" =
    initialDestinationType || (querySource === "course" || queryCourseId ? "curriculum" : "standalone");
  const wantedCourseId = initialCourseId || queryCourseId || "";
  const wantedUnitId = initialUnitId || queryUnitId || "";

  const fileInputRef = useRef<HTMLInputElement>(null);

  const [studioState, setStudioState] = useState<"empty" | "loading" | "success" | "error">("empty");
  const [errorMessage, setErrorMessage] = useState("");
  const [currentFile, setCurrentFile] = useState<File | null>(null);
  const [loadingStep, setLoadingStep] = useState(1);
  const [loadingPercent, setLoadingPercent] = useState(15);

  const [examTitle, setExamTitle] = useState("");
  const [durationMinutes, setDurationMinutes] = useState(60);
  const [groups, setGroups] = useState<RawGroup[]>([]);
  const [overrides, setOverrides] = useState<Record<string, PaperFormat | undefined>>({});
  const [expandedPassages, setExpandedPassages] = useState<Record<string, boolean>>({});
  const [previewing, setPreviewing] = useState<Record<string, boolean>>({});
  const [invalidGroups, setInvalidGroups] = useState<Record<string, string>>({});

  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editDraft, setEditDraft] = useState<RawGroup | null>(null);

  const [coursesList, setCoursesList] = useState<CourseLite[]>([]);
  const [isImporting, setIsImporting] = useState(false);
  const [importSuccess, setImportSuccess] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/teacher/courses")
      .then((res) => res.json())
      .then((json) => {
        if (!cancelled && json.success && Array.isArray(json.courses)) setCoursesList(json.courses as CourseLite[]);
      })
      .catch((err) => console.warn("Load courses error:", err));
    return () => {
      cancelled = true;
    };
  }, []);

  const targetCourse = coursesList.find((c) => c.id === wantedCourseId) || coursesList[0];
  const units = Array.isArray(targetCourse?.curriculum) ? targetCourse!.curriculum! : [];
  const targetUnit = units.find((u) => u.id === wantedUnitId) || units[0];

  // ── Chuyển đổi (thuần, chạy lại khi dữ liệu gốc / dạng đổi) ──────────────
  const conversions: GroupConversion[] = useMemo(
    () => groups.map((g) => convertGroup(g, { override: overrides[g.tempId] })),
    [groups, overrides]
  );
  const allQuestions = useMemo(() => conversions.flatMap((c) => c.questions), [conversions]);
  const paperQuestions = groups.reduce((n, g) => n + g.sub_questions.length, 0);
  const scoreItems = allQuestions.reduce((n, q) => n + countScoreItems(q), 0);
  const warnedNumbers = new Set<string>();
  const blockingNumbers = new Set<string>();
  conversions.forEach((c, i) =>
    c.warnings.forEach((w) =>
      (w.numbers || [0]).forEach((n) => {
        const key = `${groups[i]?.tempId}:${n}`;
        warnedNumbers.add(key);
        if (w.code === "NO_ANSWER") blockingNumbers.add(key);
      })
    )
  );

  // ── Tải file ─────────────────────────────────────────────────────────────
  const processUploadFile = async (file: File) => {
    setCurrentFile(file);
    setStudioState("loading");
    setLoadingStep(1);
    setLoadingPercent(20);
    setErrorMessage("");
    setImportSuccess(null);
    setInvalidGroups({});
    const timers = [
      setTimeout(() => (setLoadingStep(2), setLoadingPercent(40)), 800),
      setTimeout(() => (setLoadingStep(3), setLoadingPercent(65)), 2000),
      setTimeout(() => (setLoadingStep(4), setLoadingPercent(85)), 5000),
    ];
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/teacher/exams/ai-parse", { method: "POST", body: formData });
      timers.forEach(clearTimeout);
      const contentType = res.headers.get("content-type") || "";
      if (!contentType.includes("application/json")) {
        const text = await res.text();
        throw new Error(text || `Lỗi máy chủ (${res.status}). Vui lòng kiểm tra lại tệp tin.`);
      }
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || "Không thể bóc tách tài liệu.");
      setLoadingStep(5);
      setLoadingPercent(100);
      const ext = data.extractedData || {};
      const list: RawGroup[] = Array.isArray(ext.groups) ? ext.groups : [];
      setExamTitle(ext.examTitle || file.name.replace(/\.[^/.]+$/, ""));
      setDurationMinutes(ext.suggestedDurationMinutes || 60);
      setGroups(list);
      setOverrides({});
      setPreviewing({});
      setExpandedPassages(Object.fromEntries(list.map((g) => [g.tempId, true])));
      setTimeout(() => setStudioState("success"), 300);
    } catch (err) {
      timers.forEach(clearTimeout);
      setErrorMessage(err instanceof Error ? err.message : "Đã xảy ra sự cố khi tải lên tệp.");
      setStudioState("error");
    }
  };

  // ── Sửa dữ liệu gốc ──────────────────────────────────────────────────────
  const updateGroup = (index: number, next: RawGroup) => {
    setGroups((prev) => prev.map((g, i) => (i === index ? next : g)));
    setInvalidGroups((prev) => {
      const copy = { ...prev };
      delete copy[next.tempId];
      return copy;
    });
  };

  const setSubAnswer = (gIdx: number, sIdx: number, answer: string) => {
    const g = groups[gIdx];
    const subs = g.sub_questions.map((s, i) => (i === sIdx ? { ...s, correct_answer: answer || null, answer_source: answer ? ("TEACHER" as const) : ("NONE" as const) } : s));
    updateGroup(gIdx, { ...g, sub_questions: subs });
  };

  const handleDeleteGroup = (index: number) => {
    if (confirm("Bạn có chắc chắn muốn bỏ toàn bộ nhóm câu hỏi này khỏi đề thi không?")) {
      setGroups((prev) => prev.filter((_, i) => i !== index));
    }
  };

  const handleAddManualGroup = () => {
    const next = paperQuestions + 1;
    setGroups((prev) => [
      ...prev,
      {
        tempId: `group_${Date.now()}`,
        groupNumber: prev.length + 1,
        skill: "Reading",
        prompt: "Mark the letter A, B, C, or D to indicate the correct answer to each of the following questions.",
        stimulus_html: null,
        sub_questions: [newSub(next)],
      },
    ]);
  };

  // ── Nhập đề ──────────────────────────────────────────────────────────────
  const doImport = async () => {
    setConfirmOpen(false);
    setIsImporting(true);
    setErrorMessage("");
    try {
      const res = await fetch("/api/teacher/exams/ai-import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          examTitle,
          durationMinutes,
          destination: {
            type: destinationType === "curriculum" ? "COURSE_CURRICULUM" : "STANDALONE_EXAM",
            courseId: destinationType === "curriculum" ? targetCourse?.id : undefined,
            unitId: destinationType === "curriculum" ? targetUnit?.id : undefined,
          },
          questions: allQuestions,
        }),
      });
      const result = await res.json();
      if (!res.ok || !result.success) {
        if (result.code === "INVALID_CONTENT" && Array.isArray(result.invalid)) {
          const map: Record<string, string> = {};
          for (const it of result.invalid as InvalidItem[]) {
            const g = groups.find((x) => it.tempId?.startsWith(`${x.tempId}_`));
            if (g) map[g.tempId] = it.reason;
          }
          setInvalidGroups(map);
          const first = Object.keys(map)[0];
          if (first) document.getElementById(`group-card-${first}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
        }
        throw new Error(result.error || "Lỗi khi lưu đề thi vào cơ sở dữ liệu.");
      }
      setImportSuccess(result.message || "Tạo đề thi thành công!");
      setTimeout(() => router.push("/teacher/tests"), 1500);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Không thể lưu đề thi.");
    } finally {
      setIsImporting(false);
    }
  };

  const handleConfirmImport = () => {
    if (!examTitle.trim()) return alert("Vui lòng nhập tên đề thi.");
    if (allQuestions.length === 0) return alert("Đề thi chưa có câu hỏi nào.");
    if (blockingNumbers.size > 0) return;
    if (warnedNumbers.size > 0) {
      setConfirmOpen(true);
      return;
    }
    void doImport();
  };

  return (
    <div className="w-full space-y-6 font-sans text-ink">
      <div className="bg-white border border-line rounded-2xl p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold text-brand-800 uppercase tracking-wider mb-1">
            <Sparkles className="w-4 h-4 text-brand-800" />
            <span>Upload đề thi / bài tập • Tự động bóc tách AI</span>
          </div>
          <h2 className="text-xl md:text-2xl font-bold text-ink tracking-tight">Upload Đề Thi / Bài Tập &amp; Bóc Tách Tự Động</h2>
          <p className="text-xs md:text-sm text-ink-muted mt-1">
            Hỗ trợ file Word (.docx), PDF số hóa, hoặc ảnh chụp đề thi. Câu trắc nghiệm trên giấy được tự chuyển sang dạng phù hợp của hệ thống (điền ô trống, sắp xếp, ghép nối…).
          </p>
        </div>
        <span className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold bg-brand-50 text-brand-600 border border-brand-300">
          <Layers className="w-3.5 h-3.5" />
          <span>Dual-Engine Vision OCR</span>
        </span>
      </div>

      {importSuccess && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-300 text-emerald-900 text-sm font-bold flex items-center gap-3">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          <span>{importSuccess} Đang chuyển hướng về danh sách bài thi...</span>
        </div>
      )}
      {errorMessage && studioState !== "error" && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-300 text-rose-900 text-sm font-semibold flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {studioState === "empty" && (
        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            const f = e.dataTransfer.files?.[0];
            if (f) void processUploadFile(f);
          }}
          onClick={() => fileInputRef.current?.click()}
          className="border-2 border-dashed border-brand-300 hover:border-brand-600 bg-surface-alt/60 hover:bg-surface-alt transition-all rounded-3xl p-12 text-center cursor-pointer flex flex-col items-center justify-center gap-4 group"
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".docx,.pdf,image/png,image/jpeg,image/webp"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void processUploadFile(f);
            }}
            className="hidden"
          />
          <div className="w-16 h-16 rounded-2xl bg-brand-50 border border-brand-300 flex items-center justify-center text-brand-600 group-hover:scale-110 transition-transform shadow-xs">
            <UploadCloud className="w-8 h-8 text-brand-600" />
          </div>
          <div className="max-w-md space-y-1">
            <h3 className="text-base md:text-lg font-bold text-ink">Kéo thả tệp đề thi hoặc Click để chọn tệp từ máy tính</h3>
            <p className="text-xs text-ink-muted">
              Hỗ trợ Microsoft Word (.docx), .pdf (văn bản &amp; bản scan), hoặc ảnh chụp (.png, .jpg, .jpeg). Dung lượng tối đa 15MB.
            </p>
          </div>
          <span className="mt-2 px-6 py-2.5 rounded-xl bg-brand-600 text-white text-xs font-bold shadow-xs flex items-center gap-2">
            <FileText className="w-4 h-4 text-white" />
            <span>Chọn Tệp Đề Thi Để Bóc Tách Ngay</span>
          </span>
        </div>
      )}

      {studioState === "loading" && (
        <div className="bg-white border border-line rounded-2xl p-8 shadow-xs text-center space-y-6">
          <div className="flex justify-center">
            <div className="relative w-20 h-20 flex items-center justify-center">
              <div className="absolute inset-0 rounded-full border-4 border-brand-300/40 animate-pulse"></div>
              <div className="w-16 h-16 rounded-full border-4 border-t-brand-600 border-r-transparent border-b-transparent border-l-transparent animate-spin"></div>
              <Sparkles className="w-6 h-6 text-brand-600 absolute" />
            </div>
          </div>
          <div className="space-y-1">
            <h3 className="text-lg font-bold text-ink">Đang bóc tách dữ liệu từ tệp: {currentFile?.name}</h3>
            <p className="text-xs text-ink-muted">AI đang gom nhóm câu hỏi, đọc bảng đáp án và nhận diện dạng câu trên giấy...</p>
          </div>
          <div className="max-w-md mx-auto space-y-2">
            <div className="flex justify-between text-xs font-bold text-brand-600">
              <span>Tiến trình hoàn thành:</span>
              <span>{loadingPercent}%</span>
            </div>
            <div className="w-full bg-surface-alt rounded-full h-2.5 border border-line overflow-hidden">
              <div className="bg-brand-600 h-2.5 rounded-full transition-all duration-500" style={{ width: `${loadingPercent}%` }}></div>
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 max-w-3xl mx-auto text-xs text-left">
            {["Tải Lên Tệp", "Trích Xuất Chữ", "Gom Nhóm Ngữ Cảnh", "Đang chuyển đổi dạng câu…", "Bảng Duyệt"].map((label, i) => (
              <div
                key={label}
                className={`p-2.5 rounded-xl border flex items-center gap-2 ${loadingStep >= i + 1 ? "bg-emerald-50 border-emerald-300 text-emerald-900 font-bold" : "bg-surface-alt border-line text-ink-muted"}`}
              >
                <span>{loadingStep >= i + 1 ? "✓" : i + 1}</span>
                <span>
                  {i + 1}. {label}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {studioState === "error" && (
        <div className="bg-white border-2 border-rose-200 rounded-2xl p-8 shadow-xs text-center space-y-4">
          <div className="w-14 h-14 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mx-auto">
            <AlertTriangle className="w-7 h-7" />
          </div>
          <h3 className="text-xl font-bold text-rose-700">Không thể bóc tách tài liệu</h3>
          <p className="text-sm text-ink-muted leading-relaxed">
            {errorMessage || "Tệp tải lên không hợp lệ, bị khóa mật khẩu hoặc vượt quá giới hạn 15MB cho phép."}
          </p>
          <button onClick={() => setStudioState("empty")} className="px-5 py-2.5 rounded-xl bg-brand-600 text-white text-xs font-bold hover:bg-brand-700 transition cursor-pointer">
            Thử Lại Với Tệp Khác
          </button>
        </div>
      )}

      {studioState === "success" && (
        <div className="space-y-6">
          {/* Thanh tóm tắt */}
          <div className="bg-white border border-line rounded-2xl p-4 md:p-5 shadow-xs space-y-3">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-center gap-3 flex-wrap">
                <span className="font-bold text-sm text-ink">Kết quả bóc tách:</span>
                <span className="font-mono text-xs font-bold bg-emerald-50 text-emerald-800 px-3 py-1 rounded-full border border-emerald-300">
                  {groups.length} nhóm · {paperQuestions} câu gốc
                </span>
                {warnedNumbers.size > 0 && (
                  <span className="text-xs font-bold bg-amber-50 text-amber-800 px-3 py-1 rounded-full border border-amber-300">
                    {warnedNumbers.size} câu còn cảnh báo
                  </span>
                )}
                <span className="text-xs text-ink-muted">
                  Tệp: <strong className="text-ink">{currentFile?.name}</strong>
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setStudioState("empty")}
                  className="px-3 py-1.5 bg-surface-alt hover:bg-line-soft border border-line rounded-xl text-xs font-semibold text-ink-muted transition cursor-pointer"
                >
                  Upload Tệp Khác
                </button>
                <button
                  type="button"
                  onClick={handleAddManualGroup}
                  className="px-3 py-1.5 bg-brand-50 hover:bg-brand-100 border border-brand-300 rounded-xl text-xs font-bold text-brand-600 transition cursor-pointer flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Thêm Nhóm Câu Hỏi</span>
                </button>
              </div>
            </div>
            {scoreItems !== paperQuestions && (
              <p className="text-xs text-ink-muted bg-surface-alt border border-line rounded-xl px-3 py-2">
                <strong className="text-ink">
                  Tổng điểm: {scoreItems} mục chấm (đề giấy: {paperQuestions} câu)
                </strong>{" "}
                — câu có nhiều ô trống được chấm mỗi ô 1 điểm; tự luận / sắp xếp tính 1 mục.
              </p>
            )}
          </div>

          <div className="bg-white border border-line rounded-2xl p-6 shadow-xs grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-2">
              <label className="block text-xs font-bold uppercase text-brand-600 mb-1">Tên Bộ Đề Thi:</label>
              <input
                type="text"
                value={examTitle}
                onChange={(e) => setExamTitle(e.target.value)}
                className="w-full p-2.5 rounded-xl border border-line bg-surface-alt text-sm font-semibold focus:outline-none focus:border-brand-600"
              />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase text-brand-600 mb-1">Thời Gian Làm Bài (Phút):</label>
              <input
                type="number"
                value={durationMinutes}
                onChange={(e) => setDurationMinutes(Number(e.target.value) || 60)}
                className="w-full p-2.5 rounded-xl border border-line bg-surface-alt text-sm font-semibold focus:outline-none focus:border-brand-600"
              />
            </div>
          </div>

          {/* Các nhóm câu */}
          <div className="space-y-5">
            {groups.map((group, gIdx) => {
              const conv = conversions[gIdx];
              const formats = [...new Set(group.sub_questions.map((s) => overrides[group.tempId] ?? s.paper_format))];
              const categories = [...new Set(conv.questions.map((q) => q.category))];
              const confidence = Math.min(...group.sub_questions.map((s) => s.confidence ?? 1));
              const hasBlocking = conv.warnings.some((w) => w.code === "NO_ANSWER");
              const nums = group.sub_questions.map((s) => s.number);
              const open = expandedPassages[group.tempId];
              return (
                <div
                  id={`group-card-${group.tempId}`}
                  key={group.tempId}
                  className={`bg-white border-2 transition rounded-2xl p-5 shadow-xs space-y-4 ${invalidGroups[group.tempId] ? "border-rose-400" : "border-line hover:border-brand-600"}`}
                >
                  <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-3 pb-3 border-b border-line">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2.5 flex-wrap">
                        <span className="px-3 py-1 rounded-lg bg-brand-600 text-white font-mono font-bold text-xs">Nhóm {gIdx + 1}</span>
                        <span className="text-xs font-semibold text-ink-muted">
                          Câu {Math.min(...nums)}
                          {nums.length > 1 ? `–${Math.max(...nums)}` : ""} · {group.skill || "Reading"}
                        </span>
                        <span className="text-xs text-ink-muted">Độ tin cậy {Math.round(confidence * 100)}%</span>
                      </div>
                      <div className="flex items-center gap-2 flex-wrap text-xs">
                        <span className="font-semibold text-ink-muted">Trên giấy:</span>
                        <span className="font-bold text-ink bg-surface-alt px-2.5 py-0.5 rounded-full border border-line">
                          {formats.map((f) => PAPER_FORMAT_LABELS[f] || f).join(" + ")}
                        </span>
                        <ArrowRight className="w-3.5 h-3.5 text-ink-subtle" />
                        <span className="font-semibold text-ink-muted">Hệ thống:</span>
                        <span className="font-bold text-brand-800 bg-sky-50 px-2.5 py-0.5 rounded-full border border-sky-200">
                          {categories.map((c) => CATEGORY_LABELS[c] || c).join(" + ")}
                        </span>
                        {conv.warnings.length > 0 && (
                          <span
                            className={`font-bold px-2.5 py-0.5 rounded-full border ${hasBlocking ? "bg-rose-50 text-rose-700 border-rose-300" : "bg-amber-50 text-amber-800 border-amber-300"}`}
                          >
                            {conv.warnings.length} cảnh báo
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0 flex-wrap">
                      <label className="text-xs font-semibold text-ink-muted flex items-center gap-1.5">
                        Đổi dạng
                        <select
                          aria-label={`Đổi dạng nhóm ${gIdx + 1}`}
                          value={overrides[group.tempId] ?? ""}
                          onChange={(e) => setOverrides((prev) => ({ ...prev, [group.tempId]: (e.target.value || undefined) as PaperFormat | undefined }))}
                          className="p-1.5 rounded-lg border border-line text-xs font-bold text-brand-800 bg-sky-50 focus:outline-none"
                        >
                          <option value="">Tự động (AI nhận diện)</option>
                          {switchableFormats(group).map((f) => (
                            <option key={f} value={f}>
                              {PAPER_FORMAT_LABELS[f]}
                            </option>
                          ))}
                        </select>
                      </label>
                      <button
                        type="button"
                        onClick={() => setPreviewing((p) => ({ ...p, [group.tempId]: !p[group.tempId] }))}
                        className="px-3 py-1.5 bg-surface-alt hover:bg-line-soft text-ink border border-line rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>{previewing[group.tempId] ? "Ẩn xem trước" : "Xem như học sinh"}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setEditingIndex(gIdx);
                          setEditDraft(JSON.parse(JSON.stringify(group)));
                        }}
                        className="px-3 py-1.5 bg-brand-50 hover:bg-brand-100 text-brand-600 border border-brand-300 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                        <span>Sửa</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteGroup(gIdx)}
                        className="px-2.5 py-1.5 text-rose-600 hover:text-rose-800 hover:bg-rose-50 rounded-xl text-xs font-semibold transition cursor-pointer flex items-center gap-1"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Xóa</span>
                      </button>
                    </div>
                  </div>

                  {invalidGroups[group.tempId] && (
                    <p className="text-xs font-semibold text-rose-700 bg-rose-50 border border-rose-200 rounded-xl px-3 py-2">
                      Không lưu được nhóm này: {invalidGroups[group.tempId]}
                    </p>
                  )}

                  {conv.warnings.length > 0 && (
                    <ul className="space-y-1">
                      {conv.warnings.map((w, i) => (
                        <li
                          key={`${w.code}-${i}`}
                          className={`text-xs rounded-lg px-3 py-1.5 border flex items-start gap-2 ${w.code === "NO_ANSWER" ? "bg-rose-50 text-rose-800 border-rose-200" : "bg-amber-50 text-amber-900 border-amber-200"}`}
                        >
                          <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                          <span>{w.message}</span>
                        </li>
                      ))}
                    </ul>
                  )}

                  <div className="bg-surface-alt border border-brand-300/40 rounded-xl p-3.5">
                    <div className="text-[11px] font-bold text-brand-600 uppercase tracking-wide mb-1">Chỉ dẫn chung:</div>
                    <p className="text-sm font-semibold text-ink leading-relaxed">{group.prompt}</p>
                  </div>

                  {group.stimulus_html && (
                    <div className="bg-surface-alt border border-line rounded-xl overflow-hidden">
                      <button
                        type="button"
                        className="w-full p-3 flex items-center justify-between cursor-pointer hover:bg-line-soft/60 transition"
                        onClick={() => setExpandedPassages((p) => ({ ...p, [group.tempId]: !p[group.tempId] }))}
                      >
                        <span className="flex items-center gap-2 text-xs font-bold text-brand-600">
                          <BookOpen className="w-4 h-4 text-brand-600" /> Đoạn văn / ngữ cảnh gốc
                        </span>
                        {open ? <ChevronUp className="w-3.5 h-3.5 text-brand-600" /> : <ChevronDown className="w-3.5 h-3.5 text-brand-600" />}
                      </button>
                      {open && (
                        <div
                          className="p-4 text-xs text-ink leading-relaxed max-h-56 overflow-y-auto border-t border-line bg-white whitespace-pre-line font-serif"
                          dangerouslySetInnerHTML={{ __html: sanitizeInlineHtml(group.stimulus_html) }}
                        />
                      )}
                    </div>
                  )}

                  {previewing[group.tempId] ? (
                    <div className="border border-brand-300 rounded-xl p-3 bg-white">
                      <p className="text-[11px] font-bold text-brand-600 uppercase mb-2">Học sinh sẽ thấy (đã điền sẵn đáp án đúng):</p>
                      <LessonPlayer
                        questions={conv.questions.map((q) => sanitizeQuestionForStudent({ ...q, id: q.tempId }))}
                        flashcards={[]}
                        answers={Object.fromEntries(conv.questions.map((q) => [q.tempId, answerFor(q)]))}
                        onChange={() => {}}
                        disabled
                      />
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {group.sub_questions.map((sub, sIdx) => (
                        <div key={sub.id || sIdx} className="bg-surface-alt border border-line rounded-xl p-3.5 space-y-2.5">
                          <div className="flex items-start justify-between gap-2">
                            <span className="text-xs text-ink">
                              <strong className="text-brand-600">Câu {sub.number}. </strong>
                              <span dangerouslySetInnerHTML={{ __html: sanitizeInlineHtml(sub.text_html) }} />
                            </span>
                            <span
                              className={`shrink-0 text-[11px] font-bold px-2 py-0.5 rounded-md border ${sub.correct_answer ? "text-emerald-800 bg-emerald-100 border-emerald-300" : "text-rose-700 bg-rose-50 border-rose-300"}`}
                            >
                              {sub.correct_answer ? `Đáp án: ${sub.correct_answer}` : "Chưa có đáp án"}
                            </span>
                          </div>
                          {sub.options.length > 0 ? (
                            <div className="grid grid-cols-2 gap-2 text-xs">
                              {sub.options.map((opt) => {
                                const isCorrect = (sub.correct_answer || "").toUpperCase() === opt.key.toUpperCase();
                                return (
                                  <button
                                    type="button"
                                    key={opt.key}
                                    onClick={() => setSubAnswer(gIdx, sIdx, opt.key)}
                                    className={`p-2 rounded-lg border text-left flex items-center gap-1.5 transition cursor-pointer ${
                                      isCorrect ? "border-emerald-600 bg-emerald-50 text-emerald-950 font-bold" : "border-line bg-white text-ink-muted hover:border-brand-600"
                                    }`}
                                  >
                                    <span
                                      className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ${isCorrect ? "bg-emerald-600 text-white" : "bg-line-soft text-ink-muted"}`}
                                    >
                                      {opt.key}
                                    </span>
                                    <span className="flex-1" title={stripHtml(opt.text_html)} dangerouslySetInnerHTML={{ __html: sanitizeInlineHtml(opt.text_html) }} />
                                    {isCorrect && <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />}
                                  </button>
                                );
                              })}
                            </div>
                          ) : (
                            <input
                              type="text"
                              value={sub.correct_answer || ""}
                              onChange={(e) => setSubAnswer(gIdx, sIdx, e.target.value)}
                              placeholder="Nhập đáp án / bài mẫu…"
                              className="w-full p-1.5 rounded-lg border border-line bg-white text-xs text-ink focus:outline-none focus:border-brand-600"
                            />
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Chốt nhập */}
          <div className="bg-white border-2 border-brand-600/30 rounded-2xl p-6 shadow-md flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-brand-50 text-brand-600 border border-brand-300 flex items-center justify-center shrink-0">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold uppercase tracking-wide text-brand-600">Điểm Đến Tự Động:</span>
                  <span className="text-xs font-bold bg-brand-50 text-brand-600 px-2.5 py-0.5 rounded-full border border-brand-300">
                    {destinationType === "curriculum" ? "Lộ trình khóa học" : "Kho Đề Thi Độc Lập"}
                  </span>
                </div>
                <p className="text-xs text-ink-muted mt-0.5">
                  {destinationType === "curriculum"
                    ? `Đề thi sẽ được thêm vào khóa học: "${targetCourse?.name || targetCourse?.title || "Khóa học hiện tại"}" (${targetUnit?.title || "Unit 1"}).`
                    : "Đề thi sẽ được lưu vào Kho Đề Thi để dùng cho mọi lớp học."}
                </p>
                {blockingNumbers.size > 0 && (
                  <p className="text-xs font-bold text-rose-700 mt-1">Chọn đáp án cho {blockingNumbers.size} câu trước khi nhập.</p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-3 w-full md:w-auto">
              <button
                type="button"
                onClick={() => setStudioState("empty")}
                className="w-full md:w-auto px-5 py-3 rounded-xl border border-line text-xs font-bold text-ink-muted hover:bg-line-soft transition cursor-pointer"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                onClick={handleConfirmImport}
                disabled={isImporting || blockingNumbers.size > 0}
                className="w-full md:w-auto px-7 py-3 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-xs font-bold transition shadow-sm cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isImporting ? <Loader2 className="w-4 h-4 animate-spin text-white" /> : <Save className="w-4 h-4 text-white" />}
                <span>Xác Nhận &amp; Tạo Đề</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Hộp thoại xác nhận khi còn cảnh báo (BR-I08) */}
      {confirmOpen && (
        <div className="fixed inset-0 z-50 bg-ink/40 flex items-center justify-center p-4" role="dialog" aria-modal="true">
          <div className="bg-white rounded-2xl border border-line max-w-md w-full p-6 space-y-4 shadow-xl">
            <h3 className="text-base font-bold text-ink flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-600" /> Còn {warnedNumbers.size} câu cảnh báo
            </h3>
            <p className="text-sm text-ink-muted">
              Còn {warnedNumbers.size} câu cảnh báo sẽ được nhập dưới dạng tạm. Vẫn tạo đề? Bạn có thể sửa lại sau trong trình soạn câu hỏi.
            </p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmOpen(false)}
                className="px-4 py-2 rounded-xl border border-line text-xs font-bold text-ink-muted hover:bg-line-soft cursor-pointer"
              >
                Quay lại sửa
              </button>
              <button type="button" onClick={() => void doImport()} className="px-4 py-2 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-xs font-bold cursor-pointer">
                Vẫn tạo đề
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Sửa dữ liệu gốc của nhóm */}
      {editingIndex !== null && editDraft && (
        <div className="fixed inset-0 z-50 bg-ink/50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl border-2 border-brand-300 max-w-3xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
            <div className="p-5 bg-surface-alt border-b border-brand-300 flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-ink">Sửa nhóm câu hỏi {editingIndex + 1}</h3>
                <span className="text-xs text-ink-muted">Sửa dữ liệu gốc theo đề giấy; hệ thống tự chuyển dạng lại.</span>
              </div>
              <button
                type="button"
                aria-label="Đóng"
                onClick={() => (setEditingIndex(null), setEditDraft(null))}
                className="w-8 h-8 rounded-full bg-white hover:bg-line-soft border border-line flex items-center justify-center text-ink-muted cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-6 overflow-y-auto space-y-5 flex-1">
              <div className="space-y-1">
                <label className="text-xs font-bold uppercase text-brand-600">Chỉ dẫn chung:</label>
                <textarea
                  rows={2}
                  value={editDraft.prompt}
                  onChange={(e) => setEditDraft({ ...editDraft, prompt: e.target.value })}
                  className="w-full p-3 rounded-xl border border-line bg-surface-alt text-xs focus:outline-none focus:border-brand-600"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold uppercase text-brand-600">Đoạn văn / ngữ cảnh (giữ nguyên dấu ô như &ldquo;(25) ____&rdquo;):</label>
                <textarea
                  rows={5}
                  value={editDraft.stimulus_html || ""}
                  onChange={(e) => setEditDraft({ ...editDraft, stimulus_html: e.target.value || null })}
                  className="w-full p-3 rounded-xl border border-line bg-white text-xs font-serif leading-relaxed focus:outline-none focus:border-brand-600"
                  placeholder="Không có đoạn văn chung"
                />
              </div>
              <div className="space-y-3 pt-3 border-t border-line">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold uppercase text-brand-600">Câu hỏi ({editDraft.sub_questions.length}):</label>
                  <button
                    type="button"
                    onClick={() =>
                      setEditDraft({
                        ...editDraft,
                        sub_questions: [...editDraft.sub_questions, newSub(Math.max(0, ...editDraft.sub_questions.map((s) => s.number)) + 1)],
                      })
                    }
                    className="px-2.5 py-1 bg-brand-50 text-brand-600 border border-brand-300 rounded-lg text-xs font-bold hover:bg-brand-100 cursor-pointer flex items-center gap-1"
                  >
                    <Plus className="w-3 h-3" />
                    <span>Thêm câu</span>
                  </button>
                </div>
                {editDraft.sub_questions.map((sub, sIdx) => {
                  const patch = (p: Partial<RawSubQuestion>) =>
                    setEditDraft({ ...editDraft, sub_questions: editDraft.sub_questions.map((s, i) => (i === sIdx ? { ...s, ...p } : s)) });
                  return (
                    <div key={sub.id || sIdx} className="p-3.5 bg-surface-alt border border-line rounded-xl space-y-2.5">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-brand-600 shrink-0">Câu {sub.number}</span>
                        <input
                          type="text"
                          value={sub.text_html}
                          onChange={(e) => patch({ text_html: e.target.value })}
                          className="p-1.5 rounded-lg border border-line bg-white text-xs flex-1 focus:outline-none"
                        />
                        <button
                          type="button"
                          title="Xóa câu này"
                          onClick={() => setEditDraft({ ...editDraft, sub_questions: editDraft.sub_questions.filter((_, i) => i !== sIdx) })}
                          className="text-rose-600 hover:text-rose-800 p-1 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                        {sub.options.map((opt, oIdx) => (
                          <div key={opt.key} className="flex items-center gap-1.5">
                            <button
                              type="button"
                              title="Chọn làm đáp án"
                              onClick={() => patch({ correct_answer: opt.key, answer_source: "TEACHER" })}
                              className={`w-6 h-6 rounded-md text-[11px] font-bold shrink-0 cursor-pointer ${
                                (sub.correct_answer || "").toUpperCase() === opt.key ? "bg-emerald-600 text-white" : "bg-white text-ink-muted border border-line"
                              }`}
                            >
                              {opt.key}
                            </button>
                            <input
                              type="text"
                              value={opt.text_html}
                              onChange={(e) => patch({ options: sub.options.map((o, i) => (i === oIdx ? { ...o, text_html: e.target.value } : o)) })}
                              className="p-1.5 rounded-lg border border-line bg-white text-xs flex-1 focus:outline-none"
                            />
                          </div>
                        ))}
                      </div>
                      {sub.options.length === 0 && (
                        <input
                          type="text"
                          value={sub.correct_answer || ""}
                          onChange={(e) => patch({ correct_answer: e.target.value || null, answer_source: e.target.value ? "TEACHER" : "NONE" })}
                          placeholder="Đáp án / bài mẫu"
                          className="w-full p-1.5 rounded-lg border border-line bg-white text-xs focus:outline-none"
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
            <div className="p-4 bg-surface-alt border-t border-brand-300 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => (setEditingIndex(null), setEditDraft(null))}
                className="px-4 py-2 rounded-xl border border-line text-xs font-bold text-ink-muted hover:bg-line-soft cursor-pointer"
              >
                Hủy Bỏ
              </button>
              <button
                type="button"
                onClick={() => {
                  updateGroup(editingIndex, editDraft);
                  setEditingIndex(null);
                  setEditDraft(null);
                }}
                className="px-5 py-2 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-xs font-bold shadow-xs cursor-pointer flex items-center gap-1.5"
              >
                <Check className="w-4 h-4 text-white" />
                <span>Lưu Thay Đổi</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
