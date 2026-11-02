"use client";

import React, { useState, useEffect, useRef } from "react";
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
  ArrowRight,
  RefreshCw,
  Loader2,
  Layers,
  Save,
  Check,
  X,
  HelpCircle
} from "lucide-react";

export interface OptionItem {
  key: string;
  text: string;
}

export interface SubQuestionDraft {
  id: string;
  number: number;
  text?: string;
  options: OptionItem[];
  correct_answer: string;
}

export interface QuestionGroupDraft {
  tempId: string;
  groupNumber: number;
  skill: string;
  category: string;
  prompt: string;
  stimulus_text?: string;
  sub_questions: SubQuestionDraft[];
}

export interface AiExamIngestionStudioProps {
  initialDestinationType?: "standalone" | "curriculum";
  initialCourseId?: string;
  initialUnitId?: string;
}

export default function AiExamIngestionStudio({
  initialDestinationType,
  initialCourseId,
  initialUnitId,
}: AiExamIngestionStudioProps = {}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const querySource = searchParams?.get("source");
  const queryCourseId = searchParams?.get("courseId");
  const queryUnitId = searchParams?.get("unitId");

  const resolvedDestType =
    initialDestinationType ||
    (querySource === "course" || queryCourseId ? "curriculum" : "standalone");
  const resolvedCourseId = initialCourseId || queryCourseId || "";
  const resolvedUnitId = initialUnitId || queryUnitId || "";

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Workflow States: "empty" | "loading" | "success" | "error"
  const [studioState, setStudioState] = useState<"empty" | "loading" | "success" | "error">("empty");
  const [errorMessage, setErrorMessage] = useState("");
  const [currentFile, setCurrentFile] = useState<File | null>(null);

  // Stepper progress for loading state
  const [loadingStep, setLoadingStep] = useState(1);
  const [loadingPercent, setLoadingPercent] = useState(15);

  // Extracted Data
  const [examTitle, setExamTitle] = useState("");
  const [durationMinutes, setDurationMinutes] = useState(60);
  const [questions, setQuestions] = useState<QuestionGroupDraft[]>([]);
  const [passagesCount, setPassagesCount] = useState(0);

  // Accordion state for reading passages
  const [expandedPassages, setExpandedPassages] = useState<Record<string, boolean>>({});

  // Edit Modal State
  const [editingGroupIndex, setEditingGroupIndex] = useState<number | null>(null);
  const [editGroupModalData, setEditGroupModalData] = useState<QuestionGroupDraft | null>(null);

  // Destination Options - automatically selected based on origin
  const [destinationType, setDestinationType] = useState<"standalone" | "curriculum">(resolvedDestType);
  const [coursesList, setCoursesList] = useState<any[]>([]);
  const [selectedCourseId, setSelectedCourseId] = useState(resolvedCourseId);
  const [availableUnits, setAvailableUnits] = useState<any[]>([]);
  const [selectedUnitId, setSelectedUnitId] = useState(resolvedUnitId);

  // Submit status
  const [isImporting, setIsImporting] = useState(false);
  const [importSuccess, setImportSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (initialDestinationType) {
      setDestinationType(initialDestinationType);
    }
  }, [initialDestinationType]);

  useEffect(() => {
    if (initialCourseId) {
      setSelectedCourseId(initialCourseId);
    }
  }, [initialCourseId]);

  useEffect(() => {
    if (initialUnitId) {
      setSelectedUnitId(initialUnitId);
    }
  }, [initialUnitId]);

  // Load available courses
  useEffect(() => {
    fetch("/api/teacher/courses")
      .then((res) => res.json())
      .then((json) => {
        if (json.success && Array.isArray(json.courses)) {
          setCoursesList(json.courses);
          if (resolvedCourseId && json.courses.some((c: any) => c.id === resolvedCourseId)) {
            setSelectedCourseId(resolvedCourseId);
          } else if (json.courses.length > 0 && !selectedCourseId) {
            setSelectedCourseId(json.courses[0].id);
          }
        }
      })
      .catch((err) => console.warn("Load courses error:", err));
  }, [resolvedCourseId]);

  // Update units when selected course changes
  useEffect(() => {
    if (!selectedCourseId) return;
    const course = coursesList.find((c) => c.id === selectedCourseId);
    if (course && Array.isArray(course.curriculum)) {
      setAvailableUnits(course.curriculum);
      if (resolvedUnitId && course.curriculum.some((u: any) => u.id === resolvedUnitId)) {
        setSelectedUnitId(resolvedUnitId);
      } else if (course.curriculum.length > 0) {
        setSelectedUnitId(course.curriculum[0].id);
      } else {
        setSelectedUnitId("");
      }
    } else {
      setAvailableUnits([]);
      setSelectedUnitId("");
    }
  }, [selectedCourseId, coursesList, resolvedUnitId]);

  // Handle File Selection
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processUploadFile(file);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) processUploadFile(file);
  };

  const processUploadFile = async (file: File) => {
    setCurrentFile(file);
    setStudioState("loading");
    setLoadingStep(1);
    setLoadingPercent(20);
    setErrorMessage("");
    setImportSuccess(null);

    const t1 = setTimeout(() => {
      setLoadingStep(2);
      setLoadingPercent(45);
    }, 800);

    const t2 = setTimeout(() => {
      setLoadingStep(3);
      setLoadingPercent(75);
    }, 1800);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/teacher/exams/ai-parse", {
        method: "POST",
        body: formData,
      });

      clearTimeout(t1);
      clearTimeout(t2);

      let data: any = {};
      const contentType = res.headers.get("content-type") || "";
      if (contentType.includes("application/json")) {
        data = await res.json();
      } else {
        const text = await res.text();
        throw new Error(text || `Lỗi máy chủ (${res.status}). Vui lòng kiểm tra lại tệp tin.`);
      }

      if (!res.ok || !data.success) {
        throw new Error(data.error || "Không thể bóc tách tài liệu.");
      }

      setLoadingStep(4);
      setLoadingPercent(100);

      const extData = data.extractedData;
      setExamTitle(extData.examTitle || file.name.replace(/\.[^/.]+$/, ""));
      setDurationMinutes(extData.suggestedDurationMinutes || 60);

      const qList: QuestionGroupDraft[] = extData.questions || [];
      setQuestions(qList);

      const uniquePassages = new Set(qList.map((q) => q.stimulus_text).filter(Boolean));
      setPassagesCount(uniquePassages.size);

      const expMap: Record<string, boolean> = {};
      qList.forEach((_, idx) => {
        expMap[`pass_${idx}`] = true;
      });
      setExpandedPassages(expMap);

      setTimeout(() => {
        setStudioState("success");
      }, 500);
    } catch (err: any) {
      clearTimeout(t1);
      clearTimeout(t2);
      console.error("Upload error:", err);
      setErrorMessage(err.message || "Đã xảy ra sự cố khi tải lên tệp.");
      setStudioState("error");
    }
  };

  // Sub-question quick answer toggle
  const handleSelectSubCorrectAnswer = (groupIndex: number, subIndex: number, key: string) => {
    const next = [...questions];
    const group = { ...next[groupIndex] };
    const nextSubs = [...group.sub_questions];
    nextSubs[subIndex] = {
      ...nextSubs[subIndex],
      correct_answer: key,
    };
    group.sub_questions = nextSubs;
    next[groupIndex] = group;
    setQuestions(next);
  };

  // Group editing modal openers
  const handleOpenEditModal = (groupIndex: number) => {
    setEditingGroupIndex(groupIndex);
    setEditGroupModalData(JSON.parse(JSON.stringify(questions[groupIndex])));
  };

  const handleCloseEditModal = () => {
    setEditingGroupIndex(null);
    setEditGroupModalData(null);
  };

  const handleSaveModalData = () => {
    if (editingGroupIndex === null || !editGroupModalData) return;
    const next = [...questions];
    next[editingGroupIndex] = editGroupModalData;
    setQuestions(next);
    handleCloseEditModal();
  };

  // Delete question group
  const handleDeleteGroup = (index: number) => {
    if (confirm("Bạn có chắc chắn muốn bỏ toàn bộ nhóm câu hỏi này khỏi đề thi không?")) {
      const next = questions.filter((_, idx) => idx !== index);
      setQuestions(next);
    }
  };

  // Add a new question group
  const handleAddManualGroup = () => {
    const newGroup: QuestionGroupDraft = {
      tempId: `group_${Date.now()}`,
      groupNumber: questions.length + 1,
      skill: "Reading",
      category: "READING_MC",
      prompt: "Mark the letter A, B, C, or D to indicate the correct answer to each of the following questions.",
      stimulus_text: "",
      sub_questions: [
        {
          id: `sub_${Date.now()}_1`,
          number: questions.reduce((acc, g) => acc + g.sub_questions.length, 0) + 1,
          text: `Câu ${questions.reduce((acc, g) => acc + g.sub_questions.length, 0) + 1}`,
          options: [
            { key: "A", text: "Lựa chọn A" },
            { key: "B", text: "Lựa chọn B" },
            { key: "C", text: "Lựa chọn C" },
            { key: "D", text: "Lựa chọn D" },
          ],
          correct_answer: "A",
        },
      ],
    };
    setQuestions([...questions, newGroup]);
  };

  const handleTogglePassage = (passKey: string) => {
    setExpandedPassages((prev) => ({
      ...prev,
      [passKey]: !prev[passKey],
    }));
  };

  // Calculate total sub-questions
  const totalSubQuestionsCount = questions.reduce(
    (acc, g) => acc + (Array.isArray(g.sub_questions) ? g.sub_questions.length : 1),
    0
  );

  // Final Commit Import to Database
  const handleConfirmImport = async () => {
    if (!examTitle.trim()) {
      alert("Vui lòng nhập tên đề thi.");
      return;
    }
    if (questions.length === 0) {
      alert("Đề thi chưa có câu hỏi nào.");
      return;
    }

    setIsImporting(true);
    setErrorMessage("");

    try {
      const payload = {
        examTitle,
        durationMinutes,
        destination: {
          type: destinationType === "curriculum" ? "COURSE_CURRICULUM" : "STANDALONE_EXAM",
          courseId: destinationType === "curriculum" ? selectedCourseId : undefined,
          unitId: destinationType === "curriculum" ? selectedUnitId : undefined,
        },
        questions,
      };

      const res = await fetch("/api/teacher/exams/ai-import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const result = await res.json();
      if (!res.ok || !result.success) {
        throw new Error(result.error || "Lỗi khi lưu đề thi vào cơ sở dữ liệu.");
      }

      setImportSuccess(result.message || "Tạo đề thi thành công!");
      setTimeout(() => {
        router.push("/teacher/tests");
      }, 1500);
    } catch (err: any) {
      console.error("Import error:", err);
      setErrorMessage(err.message || "Không thể lưu đề thi.");
    } finally {
      setIsImporting(false);
    }
  };

  const targetCourse = coursesList.find((c) => c.id === selectedCourseId);
  const targetUnit = availableUnits.find((u) => u.id === selectedUnitId);

  return (
    <div className="w-full space-y-6 font-sans text-ink">
      {/* Header Info */}
      <div className="bg-white border border-line rounded-2xl p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold text-brand-800 uppercase tracking-wider mb-1">
            <Sparkles className="w-4 h-4 text-brand-800" />
            <span>Upload đề thi / bài tập • Tự động bóc tách AI</span>
          </div>
          <h2 className="text-xl md:text-2xl font-bold text-ink tracking-tight">
            Upload Đề Thi / Bài Tập &amp; Bóc Tách Tự Động
          </h2>
          <p className="text-xs md:text-sm text-ink-muted mt-1">
            Hỗ trợ file Word (.docx), PDF số hóa, hoặc ảnh chụp tài liệu/bản scan đề thi. Tự động bóc tách các nhóm câu hỏi chung ngữ cảnh và trích xuất đáp án trực tiếp từ tệp.
          </p>
        </div>
        <div className="shrink-0 flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold bg-brand-50 text-brand-600 border border-brand-300">
            <Layers className="w-3.5 h-3.5" />
            <span>Dual-Engine Vision OCR</span>
          </span>
        </div>
      </div>

      {/* Global Success Notification */}
      {importSuccess && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-300 text-emerald-900 text-sm font-bold flex items-center gap-3 animate-in fade-in duration-300">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          <span>{importSuccess} Đang chuyển hướng về danh sách bài thi...</span>
        </div>
      )}

      {/* Global Error Notification */}
      {errorMessage && studioState !== "error" && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-300 text-rose-900 text-sm font-semibold flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* ========================================================================= */}
      {/* STATE 1: EMPTY / FILE DROPZONE STATE                                      */}
      {/* ========================================================================= */}
      {studioState === "empty" && (
        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className="border-2 border-dashed border-brand-300 hover:border-brand-600 bg-surface-alt/60 hover:bg-surface-alt transition-all rounded-3xl p-12 text-center cursor-pointer flex flex-col items-center justify-center gap-4 group"
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".docx,.pdf,image/png,image/jpeg,image/webp"
            onChange={handleFileChange}
            className="hidden"
          />
          <div className="w-16 h-16 rounded-2xl bg-brand-50 border border-brand-300 flex items-center justify-center text-brand-600 group-hover:scale-110 transition-transform shadow-xs">
            <UploadCloud className="w-8 h-8 text-brand-600" />
          </div>
          <div className="max-w-md space-y-1">
            <h3 className="text-base md:text-lg font-bold text-ink">
              Kéo thả tệp đề thi hoặc Click để chọn tệp từ máy tính
            </h3>
            <p className="text-xs text-ink-muted">
              Hỗ trợ tài liệu Microsoft Word (.docx), tài liệu .pdf (văn bản &amp; bản scan ảnh), hoặc ảnh chụp bài thi (.png, .jpg, .jpeg). Dung lượng tối đa 15MB.
            </p>
          </div>
          <button
            type="button"
            className="mt-2 px-6 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-xs font-bold transition shadow-xs flex items-center gap-2 pointer-events-none"
          >
            <FileText className="w-4 h-4" />
            <span>Chọn Tệp Đề Thi Để Bóc Tách Ngay</span>
          </button>
        </div>
      )}

      {/* ========================================================================= */}
      {/* STATE 2: LOADING / AI OCR INGESTION PROGRESS STATE                        */}
      {/* ========================================================================= */}
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
            <h3 className="text-lg font-bold text-ink">
              Đang bóc tách dữ liệu từ tệp: {currentFile?.name}
            </h3>
            <p className="text-xs text-ink-muted">
              Mô hình AI đang gom nhóm câu hỏi chung ngữ cảnh, trích xuất bài đọc và đọc bảng đáp án...
            </p>
          </div>

          {/* Stepper progress */}
          <div className="max-w-md mx-auto space-y-2">
            <div className="flex justify-between text-xs font-bold text-brand-600">
              <span>Tiến trình hoàn thành:</span>
              <span>{loadingPercent}%</span>
            </div>
            <div className="w-full bg-surface-alt rounded-full h-2.5 border border-line overflow-hidden">
              <div
                className="bg-brand-600 h-2.5 rounded-full transition-all duration-500"
                style={{ width: `${loadingPercent}%` }}
              ></div>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 max-w-xl mx-auto text-xs text-left">
            <div className={`p-2.5 rounded-xl border flex items-center gap-2 ${loadingStep >= 1 ? "bg-emerald-50 border-emerald-300 text-emerald-900 font-bold" : "bg-surface-alt border-line text-ink-muted"}`}>
              <span>{loadingStep >= 1 ? "✓" : "1"}</span>
              <span>1. Tải Lên Tệp</span>
            </div>
            <div className={`p-2.5 rounded-xl border flex items-center gap-2 ${loadingStep >= 2 ? "bg-emerald-50 border-emerald-300 text-emerald-900 font-bold" : "bg-surface-alt border-line text-ink-muted"}`}>
              <span>{loadingStep >= 2 ? "✓" : "2"}</span>
              <span>2. Trích Xuất Chữ</span>
            </div>
            <div className={`p-2.5 rounded-xl border flex items-center gap-2 ${loadingStep >= 3 ? "bg-emerald-50 border-emerald-300 text-emerald-900 font-bold" : "bg-surface-alt border-line text-ink-muted"}`}>
              <span>{loadingStep >= 3 ? "✓" : "3"}</span>
              <span>3. Gom Nhóm Ngữ Cảnh</span>
            </div>
            <div className={`p-2.5 rounded-xl border flex items-center gap-2 ${loadingStep >= 4 ? "bg-emerald-50 border-emerald-300 text-emerald-900 font-bold" : "bg-surface-alt border-line text-ink-muted"}`}>
              <span>{loadingStep >= 4 ? "✓" : "4"}</span>
              <span>4. Bảng Duyệt</span>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* STATE 3: ERROR STATE                                                      */}
      {/* ========================================================================= */}
      {studioState === "error" && (
        <div className="bg-white border-2 border-rose-200 rounded-2xl p-8 shadow-xs text-center space-y-4">
          <div className="w-14 h-14 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mx-auto">
            <AlertTriangle className="w-7 h-7" />
          </div>
          <h3 className="text-xl font-bold text-red-700">Không thể bóc tách tài liệu</h3>
          <p className="text-sm text-ink-muted leading-relaxed">
            {errorMessage || "Tệp tải lên không hợp lệ, bị khóa mật khẩu hoặc vượt quá giới hạn 15MB cho phép."}
          </p>
          <button
            onClick={() => setStudioState("empty")}
            className="px-5 py-2.5 rounded-xl bg-brand-600 text-white text-xs font-bold hover:bg-brand-700 transition cursor-pointer"
          >
            Thử Lại Với Tệp Khác
          </button>
        </div>
      )}

      {/* ========================================================================= */}
      {/* STATE 4: SUCCESS / REVIEW MATRIX STATE (GROUPED QUESTIONS)                */}
      {/* ========================================================================= */}
      {studioState === "success" && (
        <div className="space-y-6 animate-in fade-in duration-300">
          {/* Statistics Bar */}
          <div className="bg-white border border-line rounded-2xl p-4 md:p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-3 flex-wrap">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-emerald-500 animate-pulse"></span>
                <span className="font-bold text-sm text-ink">Kết quả bóc tách:</span>
              </div>
              <span className="font-mono text-xs font-bold bg-emerald-50 text-emerald-800 px-3 py-1 rounded-full border border-emerald-300">
                {questions.length} Nhóm Câu Hỏi ({totalSubQuestionsCount} Câu Hỏi Con)
              </span>
              {passagesCount > 0 && (
                <span className="text-xs font-medium bg-brand-50 text-brand-600 px-3 py-1 rounded-full border border-brand-300">
                  {passagesCount} Bài Đọc Kèm Theo
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

          {/* Exam Title & Duration Inputs */}
          <div className="bg-white border border-line rounded-2xl p-6 shadow-xs grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-2">
              <label className="block text-xs font-bold uppercase text-brand-600 mb-1">
                Tên Bộ Đề Thi:
              </label>
              <input
                type="text"
                value={examTitle}
                onChange={(e) => setExamTitle(e.target.value)}
                className="w-full p-2.5 rounded-xl border border-line bg-surface-alt text-sm font-semibold focus:outline-none focus:border-brand-600"
              />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase text-brand-600 mb-1">
                Thời Gian Làm Bài (Phút):
              </label>
              <input
                type="number"
                value={durationMinutes}
                onChange={(e) => setDurationMinutes(Number(e.target.value) || 60)}
                className="w-full p-2.5 rounded-xl border border-line bg-surface-alt text-sm font-semibold focus:outline-none focus:border-brand-600"
              />
            </div>
          </div>

          {/* Question Groups Review Matrix */}
          <div className="space-y-5">
            {questions.map((group, gIdx) => (
              <div
                key={group.tempId || gIdx}
                className="bg-white border-2 border-line hover:border-brand-600 transition rounded-2xl p-5 shadow-xs space-y-4"
              >
                {/* Group Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-line">
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <span className="px-3 py-1 rounded-lg bg-brand-600 text-white font-mono font-bold text-xs flex items-center justify-center shrink-0">
                      Nhóm {gIdx + 1}
                    </span>
                    <span className="text-xs uppercase font-bold text-brand-800 bg-sky-50 px-2.5 py-0.5 rounded-full border border-sky-200">
                      {group.category === "READING_FILL_IN" ? "Điền Ô Trống (Cloze)" : "Trắc Nghiệm (MC)"}
                    </span>
                    <span className="text-xs font-semibold text-ink-muted">({group.skill || "Reading"})</span>
                    <span className="text-xs font-bold text-amber-800 bg-amber-50 px-2.5 py-0.5 rounded-full border border-amber-200">
                      {group.sub_questions.length} câu hỏi con
                    </span>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleOpenEditModal(gIdx)}
                      className="px-3 py-1.5 bg-brand-50 hover:bg-brand-100 text-brand-600 border border-brand-300 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5 shadow-2xs"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                      <span>Sửa nhóm &amp; câu hỏi</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteGroup(gIdx)}
                      className="px-2.5 py-1.5 text-rose-600 hover:text-rose-800 hover:bg-rose-50 rounded-xl text-xs font-semibold transition cursor-pointer flex items-center gap-1"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Xóa nhóm</span>
                    </button>
                  </div>
                </div>

                {/* Shared Instructions / Prompt */}
                <div className="bg-surface-alt border border-brand-300/40 rounded-xl p-3.5">
                  <div className="text-[11px] font-bold text-brand-600 uppercase tracking-wide mb-1 flex items-center gap-1.5">
                    <Sparkles className="w-3 h-3 text-brand-600" />
                    <span>Chỉ dẫn / Ngữ cảnh chung:</span>
                  </div>
                  <p className="text-sm font-semibold text-ink leading-relaxed">
                    {group.prompt}
                  </p>
                </div>

                {/* Stimulus Reading Passage Accordion (if group has reading passage) */}
                {group.stimulus_text && (
                  <div className="bg-surface-alt border border-line rounded-xl overflow-hidden">
                    <div
                      className="p-3 bg-surface-alt flex items-center justify-between cursor-pointer hover:bg-line-soft/60 transition"
                      onClick={() => handleTogglePassage(`pass_${gIdx}`)}
                    >
                      <div className="flex items-center gap-2">
                        <BookOpen className="w-4 h-4 text-brand-600" />
                        <span className="text-xs font-bold text-brand-600">Đoạn Văn Đọc Hiểu / Ngữ Cảnh:</span>
                      </div>
                      <button className="text-xs text-brand-600 flex items-center gap-1 font-semibold">
                        <span>{expandedPassages[`pass_${gIdx}`] ? "Thu gọn" : "Xem đoạn văn"}</span>
                        {expandedPassages[`pass_${gIdx}`] ? (
                          <ChevronUp className="w-3.5 h-3.5" />
                        ) : (
                          <ChevronDown className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>
                    {expandedPassages[`pass_${gIdx}`] && (
                      <div className="p-4 text-xs text-ink leading-relaxed max-h-56 overflow-y-auto border-t border-line bg-white whitespace-pre-line font-serif">
                        {group.stimulus_text}
                      </div>
                    )}
                  </div>
                )}

                {/* Sub-questions List */}
                <div className="space-y-3 pt-2">
                  <div className="text-xs font-bold text-ink-muted uppercase tracking-wider">
                    Các câu hỏi con trong nhóm:
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {group.sub_questions.map((sub, sIdx) => (
                      <div
                        key={sub.id || sIdx}
                        className="bg-surface-alt border border-line rounded-xl p-3.5 space-y-2.5"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-bold text-xs text-brand-600">
                            {sub.text || `Câu ${sub.number || sIdx + 1}`}
                          </span>
                          <span className="text-[11px] font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-md border border-emerald-300">
                            Đáp án: {sub.correct_answer}
                          </span>
                        </div>

                        {/* Options Grid */}
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          {sub.options.map((opt) => {
                            const isCorrect = sub.correct_answer === opt.key;
                            return (
                              <button
                                type="button"
                                key={opt.key}
                                onClick={() => handleSelectSubCorrectAnswer(gIdx, sIdx, opt.key)}
                                className={`p-2 rounded-lg border text-left flex items-center gap-1.5 transition cursor-pointer ${
                                  isCorrect
                                    ? "border-emerald-600 bg-emerald-50 text-emerald-950 font-bold shadow-2xs"
                                    : "border-line bg-white text-ink-muted hover:border-brand-600"
                                }`}
                              >
                                <span
                                  className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ${
                                    isCorrect ? "bg-emerald-600 text-white" : "bg-line-soft text-ink-muted"
                                  }`}
                                >
                                  {opt.key}
                                </span>
                                <span className="truncate flex-1" title={opt.text}>{opt.text}</span>
                                {isCorrect && <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Bottom Bar: Automatic Destination Indicator & Confirm Save Button */}
          <div className="bg-white border-2 border-brand-600/30 rounded-2xl p-6 shadow-md flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-brand-50 text-brand-600 border border-brand-300 flex items-center justify-center shrink-0">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold uppercase tracking-wide text-brand-600">
                    Điểm Đến Tự Động:
                  </span>
                  <span className="text-xs font-bold bg-brand-50 text-brand-600 px-2.5 py-0.5 rounded-full border border-brand-300">
                    {destinationType === "curriculum" ? "Lộ trình khóa học" : "Kho Đề Thi Độc Lập"}
                  </span>
                </div>
                <p className="text-xs text-ink-muted mt-0.5">
                  {destinationType === "curriculum"
                    ? `Đề thi sẽ được thêm vào khóa học: "${targetCourse?.name || targetCourse?.title || "Khóa học hiện tại"}" (${targetUnit?.title || "Unit 1"}).`
                    : "Đề thi sẽ được lưu vào Kho Đề Thi (`exams`) để sử dụng cho mọi lớp học."}
                </p>
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
                disabled={isImporting}
                className="w-full md:w-auto px-7 py-3 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-xs font-bold transition shadow-sm cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {isImporting ? (
                  <Loader2 className="w-4 h-4 animate-spin text-white" />
                ) : (
                  <Save className="w-4 h-4" />
                )}
                <span>Xác Nhận &amp; Lưu Đề Thi Vào Hệ Thống</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: CHỈNH SỬA CHI TIẾT NHÓM CÂU HỎI & NGỮ CẢNH                         */}
      {/* ========================================================================= */}
      {editingGroupIndex !== null && editGroupModalData && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl border-2 border-brand-300 max-w-3xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
            {/* Modal Header */}
            <div className="p-5 bg-surface-alt border-b border-brand-300 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-brand-600 text-white flex items-center justify-center font-bold text-xs">
                  {editingGroupIndex + 1}
                </div>
                <div>
                  <h3 className="text-base font-bold text-ink">
                    Chỉnh Sửa Nhóm Câu Hỏi {editingGroupIndex + 1}
                  </h3>
                  <span className="text-xs text-ink-muted">
                    Chỉnh sửa chỉ dẫn chung, đoạn văn đọc hiểu và các câu hỏi con
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={handleCloseEditModal}
                className="w-8 h-8 rounded-full bg-white hover:bg-line-soft border border-line flex items-center justify-center text-ink-muted transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-5 flex-1">
              {/* Category & Group Prompt */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold uppercase text-brand-600">
                    Chỉ Dẫn Chung / Tiêu Đề Nhóm:
                  </label>
                  <select
                    value={editGroupModalData.category}
                    onChange={(e) =>
                      setEditGroupModalData({ ...editGroupModalData, category: e.target.value })
                    }
                    className="p-1.5 rounded-lg border border-line text-xs font-bold text-brand-800 bg-sky-50 focus:outline-none"
                  >
                    <option value="READING_MC">Trắc nghiệm (READING_MC)</option>
                    <option value="READING_FILL_IN">Điền ô trống (READING_FILL_IN)</option>
                    <option value="WRITING_ESSAY">Tự luận (WRITING_ESSAY)</option>
                  </select>
                </div>
                <textarea
                  rows={3}
                  value={editGroupModalData.prompt}
                  onChange={(e) =>
                    setEditGroupModalData({ ...editGroupModalData, prompt: e.target.value })
                  }
                  className="w-full p-3 rounded-xl border border-line bg-surface-alt text-xs font-medium focus:outline-none focus:border-brand-600"
                  placeholder="Nhập câu chỉ dẫn chung của nhóm (ví dụ: Mark the letter A, B, C, or D...)"
                />
              </div>

              {/* Shared Context / Stimulus Text */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold uppercase text-brand-600 flex items-center gap-1.5">
                    <BookOpen className="w-3.5 h-3.5" />
                    <span>Đoạn Văn Đọc Hiểu / Ngữ Cảnh Chung (Tùy chọn):</span>
                  </label>
                  {!editGroupModalData.stimulus_text && (
                    <button
                      type="button"
                      onClick={() =>
                        setEditGroupModalData({
                          ...editGroupModalData,
                          stimulus_text: "Đoạn văn đọc hiểu mới...",
                        })
                      }
                      className="text-xs font-bold text-brand-600 hover:underline cursor-pointer"
                    >
                      + Thêm đoạn văn
                    </button>
                  )}
                </div>
                {typeof editGroupModalData.stimulus_text === "string" && (
                  <textarea
                    rows={5}
                    value={editGroupModalData.stimulus_text}
                    onChange={(e) =>
                      setEditGroupModalData({
                        ...editGroupModalData,
                        stimulus_text: e.target.value,
                      })
                    }
                    className="w-full p-3 rounded-xl border border-line bg-white text-xs font-medium focus:outline-none focus:border-brand-600 font-serif leading-relaxed"
                    placeholder="Dán hoặc nhập nội dung đoạn văn bài đọc tại đây..."
                  />
                )}
              </div>

              {/* Sub-questions Manager */}
              <div className="space-y-3 pt-3 border-t border-line">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold uppercase text-brand-600">
                    Danh Sách Câu Hỏi Con ({editGroupModalData.sub_questions.length} câu):
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      const nextSubs = [...editGroupModalData.sub_questions];
                      const newSub: SubQuestionDraft = {
                        id: `sub_${Date.now()}_${nextSubs.length + 1}`,
                        number: nextSubs.length + 1,
                        text: `Câu ${nextSubs.length + 1}`,
                        options: [
                          { key: "A", text: "Lựa chọn A" },
                          { key: "B", text: "Lựa chọn B" },
                          { key: "C", text: "Lựa chọn C" },
                          { key: "D", text: "Lựa chọn D" },
                        ],
                        correct_answer: "A",
                      };
                      setEditGroupModalData({
                        ...editGroupModalData,
                        sub_questions: [...nextSubs, newSub],
                      });
                    }}
                    className="px-2.5 py-1 bg-brand-50 text-brand-600 border border-brand-300 rounded-lg text-xs font-bold hover:bg-brand-100 transition cursor-pointer flex items-center gap-1"
                  >
                    <Plus className="w-3 h-3" />
                    <span>Thêm câu hỏi con</span>
                  </button>
                </div>

                <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
                  {editGroupModalData.sub_questions.map((sub, sIdx) => (
                    <div
                      key={sub.id || sIdx}
                      className="p-3.5 bg-surface-alt border border-line rounded-xl space-y-2.5"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 flex-1">
                          <span className="w-6 h-6 rounded-md bg-brand-600 text-white flex items-center justify-center font-bold text-[10px]">
                            {sIdx + 1}
                          </span>
                          <input
                            type="text"
                            value={sub.text || `Câu ${sIdx + 1}`}
                            onChange={(e) => {
                              const nextSubs = [...editGroupModalData.sub_questions];
                              nextSubs[sIdx] = { ...nextSubs[sIdx], text: e.target.value };
                              setEditGroupModalData({ ...editGroupModalData, sub_questions: nextSubs });
                            }}
                            className="p-1 rounded-lg border border-line bg-white text-xs font-bold text-ink flex-1 max-w-xs focus:outline-none"
                            placeholder="Tiêu đề câu hỏi..."
                          />
                        </div>

                        {/* Correct Answer Selector */}
                        <div className="flex items-center gap-1.5">
                          <span className="text-[11px] font-bold text-ink-muted">Đáp án:</span>
                          {(["A", "B", "C", "D"] as const).map((key) => (
                            <button
                              type="button"
                              key={key}
                              onClick={() => {
                                const nextSubs = [...editGroupModalData.sub_questions];
                                nextSubs[sIdx] = { ...nextSubs[sIdx], correct_answer: key };
                                setEditGroupModalData({ ...editGroupModalData, sub_questions: nextSubs });
                              }}
                              className={`w-6 h-6 rounded-md text-[11px] font-bold transition cursor-pointer ${
                                sub.correct_answer === key
                                  ? "bg-emerald-600 text-white shadow-2xs"
                                  : "bg-white text-ink-muted border border-line hover:bg-line-soft"
                              }`}
                            >
                              {key}
                            </button>
                          ))}
                          <button
                            type="button"
                            onClick={() => {
                              const nextSubs = editGroupModalData.sub_questions.filter((_, idx) => idx !== sIdx);
                              setEditGroupModalData({ ...editGroupModalData, sub_questions: nextSubs });
                            }}
                            className="ml-2 text-rose-600 hover:text-rose-800 p-1 cursor-pointer"
                            title="Xóa câu hỏi con này"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      {/* Options inputs */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                        {sub.options.map((opt, oIdx) => (
                          <div key={opt.key} className="flex items-center gap-1.5">
                            <span className="w-5 h-5 rounded-full bg-line-soft text-brand-600 font-bold text-[10px] flex items-center justify-center shrink-0">
                              {opt.key}
                            </span>
                            <input
                              type="text"
                              value={opt.text}
                              onChange={(e) => {
                                const nextSubs = [...editGroupModalData.sub_questions];
                                const nextOpts = [...nextSubs[sIdx].options];
                                nextOpts[oIdx] = { ...nextOpts[oIdx], text: e.target.value };
                                nextSubs[sIdx] = { ...nextSubs[sIdx], options: nextOpts };
                                setEditGroupModalData({ ...editGroupModalData, sub_questions: nextSubs });
                              }}
                              className="p-1.5 rounded-lg border border-line bg-white text-xs text-ink flex-1 focus:outline-none"
                              placeholder={`Lựa chọn ${opt.key}...`}
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-surface-alt border-t border-brand-300 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={handleCloseEditModal}
                className="px-4 py-2 rounded-xl border border-line text-xs font-bold text-ink-muted hover:bg-line-soft transition cursor-pointer"
              >
                Hủy Bỏ
              </button>
              <button
                type="button"
                onClick={handleSaveModalData}
                className="px-5 py-2 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-xs font-bold transition shadow-xs cursor-pointer flex items-center gap-1.5"
              >
                <Check className="w-4 h-4" />
                <span>Lưu Thay Đổi Nhóm</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
