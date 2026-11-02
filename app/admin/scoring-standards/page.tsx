"use client";

import { useState, useEffect, useMemo, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import AdminLayout from "@/components/AdminLayout";
import RubricManager from "@/components/admin/RubricManager";
import {
  Scale,
  PlusCircle,
  Edit3,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  X,
  Save,
  Layers,
  BookOpen,
  Info,
} from "lucide-react";

interface TableRow {
  min_correct: number;
  score: number;
}

interface SectionItem {
  skill: "Reading" | "Listening" | "Writing" | "Speaking";
  min: number;
  max: number;
  step: number;
  conversion: "LINEAR" | "TABLE";
  table_question_count?: number;
  table?: TableRow[];
  rubric_id?: string;
}

interface AggregationConfig {
  method: "AVERAGE" | "SUM" | "WEIGHTED";
  round_step: number;
  weights?: Record<string, number>;
  pass_score?: number;
  section_min?: Record<string, number>;
}

interface ScoringStandard {
  id: string;
  name: string;
  framework?: string | null;
  description?: string | null;
  sections: SectionItem[];
  aggregation: AggregationConfig;
  is_system: boolean;
  created_by?: string | null;
  created_at?: string;
  updated_at?: string;
}

interface ScoringRubricOption {
  id: string;
  name: string;
  skill?: string;
  framework?: string;
}

const PRESET_FRAMEWORKS = ["IELTS", "TOEIC", "HSK", "INTERNAL", "TOEFL", "CEFR", "VSTEP", "JLPT", "PTE"];
const SKILLS: Array<"Reading" | "Listening" | "Writing" | "Speaking"> = [
  "Reading",
  "Listening",
  "Writing",
  "Speaking",
];

export default function AdminScoringStandardsPage() {
  return (
    <Suspense fallback={null}>
      <ScoringStandardsContent />
    </Suspense>
  );
}

function ScoringStandardsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tab: "standards" | "rubrics" = searchParams.get("tab") === "rubrics" ? "rubrics" : "standards";
  const switchTab = (next: "standards" | "rubrics") => {
    router.replace(`/admin/scoring-standards?tab=${next}`);
  };
  const [standards, setStandards] = useState<ScoringStandard[]>([]);
  const [rubrics, setRubrics] = useState<ScoringRubricOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedFramework, setSelectedFramework] = useState<string>("ALL");
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  // Modal State
  const [showModal, setShowModal] = useState(false);
  const [editingStandard, setEditingStandard] = useState<ScoringStandard | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form Fields
  const [name, setName] = useState("");
  const [framework, setFramework] = useState("INTERNAL");
  const [description, setDescription] = useState("");
  const [sections, setSections] = useState<SectionItem[]>([]);
  const [aggMethod, setAggMethod] = useState<"AVERAGE" | "SUM" | "WEIGHTED">("AVERAGE");
  const [aggRoundStep, setAggRoundStep] = useState(0.25);
  const [aggPassScore, setAggPassScore] = useState<string>("");
  const [aggWeights, setAggWeights] = useState<Record<string, number>>({});
  const [aggSectionMin, setAggSectionMin] = useState<Record<string, string>>({});

  const fetchStandards = async () => {
    try {
      setLoading(true);
      setLoadError(null);
      const res = await fetch("/api/scoring-standards");
      if (!res.ok) {
        throw new Error(`Lỗi tải dữ liệu (${res.status})`);
      }
      const json = await res.json();
      setStandards(json.standards || []);
    } catch (err: any) {
      console.error("Fetch scoring standards error:", err);
      setLoadError(err.message || "Không thể tải danh sách chuẩn chấm.");
    } finally {
      setLoading(false);
    }
  };

  const fetchRubrics = async () => {
    try {
      const res = await fetch("/api/exam/rubrics");
      if (res.ok) {
        const json = await res.json();
        if (json.success && Array.isArray(json.rubrics)) {
          setRubrics(json.rubrics);
        }
      }
    } catch (e) {
      console.warn("Could not fetch rubrics for dropdown:", e);
    }
  };

  useEffect(() => {
    fetchStandards();
    fetchRubrics();
  }, []);

  const dynamicFrameworkTabs = useMemo(() => {
    const set = new Set<string>();
    standards.forEach((s) => {
      if (s.framework) set.add(s.framework.toUpperCase());
    });
    return ["ALL", ...Array.from(set)];
  }, [standards]);

  const openCreateModal = () => {
    setEditingStandard(null);
    setName("");
    setFramework("INTERNAL");
    setDescription("");
    setSections([
      { skill: "Reading", min: 0, max: 10, step: 0.25, conversion: "LINEAR" },
      { skill: "Listening", min: 0, max: 10, step: 0.25, conversion: "LINEAR" },
      { skill: "Writing", min: 0, max: 10, step: 0.25, conversion: "LINEAR", rubric_id: "" },
      { skill: "Speaking", min: 0, max: 10, step: 0.25, conversion: "LINEAR", rubric_id: "" },
    ]);
    setAggMethod("AVERAGE");
    setAggRoundStep(0.25);
    setAggPassScore("");
    setAggWeights({ Reading: 1, Listening: 1, Writing: 1, Speaking: 1 });
    setAggSectionMin({});
    setFormError(null);
    setShowModal(true);
  };

  const openEditModal = (std: ScoringStandard) => {
    setEditingStandard(std);
    setName(std.name);
    setFramework(std.framework || "INTERNAL");
    setDescription(std.description || "");
    setSections(JSON.parse(JSON.stringify(std.sections || [])));
    setAggMethod(std.aggregation?.method || "AVERAGE");
    setAggRoundStep(std.aggregation?.round_step ?? 0.25);
    setAggPassScore(
      std.aggregation?.pass_score !== undefined && std.aggregation?.pass_score !== null
        ? String(std.aggregation.pass_score)
        : ""
    );
    setAggWeights(std.aggregation?.weights ? { ...std.aggregation.weights } : {});
    const minObj: Record<string, string> = {};
    if (std.aggregation?.section_min) {
      for (const [k, v] of Object.entries(std.aggregation.section_min)) {
        minObj[k] = String(v);
      }
    }
    setAggSectionMin(minObj);
    setFormError(null);
    setShowModal(true);
  };

  const handleAddSection = () => {
    const usedSkills = new Set(sections.map((s) => s.skill));
    const nextSkill = SKILLS.find((s) => !usedSkills.has(s)) || "Reading";
    setSections([
      ...sections,
      { skill: nextSkill, min: 0, max: 10, step: 0.25, conversion: "LINEAR" },
    ]);
  };

  const handleRemoveSection = (idx: number) => {
    const updated = sections.filter((_, i) => i !== idx);
    setSections(updated);
  };

  const handleSectionChange = (idx: number, field: keyof SectionItem, val: any) => {
    const updated = [...sections];
    updated[idx] = { ...updated[idx], [field]: val };
    if (field === "conversion" && val === "TABLE") {
      if (!updated[idx].table_question_count) {
        updated[idx].table_question_count = 40;
      }
      if (!updated[idx].table || updated[idx].table!.length === 0) {
        updated[idx].table = [
          { min_correct: 0, score: updated[idx].min },
          { min_correct: updated[idx].table_question_count || 40, score: updated[idx].max },
        ];
      }
    }
    setSections(updated);
  };

  const handleAddTableRow = (secIdx: number) => {
    const updated = [...sections];
    const sec = updated[secIdx];
    const currentTable = sec.table || [];
    const lastMin = currentTable.length > 0 ? currentTable[currentTable.length - 1].min_correct + 1 : 0;
    sec.table = [...currentTable, { min_correct: lastMin, score: sec.min }];
    setSections(updated);
  };

  const handleRemoveTableRow = (secIdx: number, rowIdx: number) => {
    const updated = [...sections];
    const sec = updated[secIdx];
    sec.table = (sec.table || []).filter((_, i) => i !== rowIdx);
    setSections(updated);
  };

  const handleTableRowChange = (
    secIdx: number,
    rowIdx: number,
    field: "min_correct" | "score",
    val: number
  ) => {
    const updated = [...sections];
    const table = [...(updated[secIdx].table || [])];
    table[rowIdx] = { ...table[rowIdx], [field]: val };
    updated[secIdx].table = table;
    setSections(updated);
  };

  const handleDeleteStandard = async (std: ScoringStandard) => {
    if (std.is_system) {
      alert("Chuẩn chấm hệ thống không thể xóa.");
      return;
    }

    if (!confirm(`Bạn có chắc chắn muốn xóa chuẩn chấm "${std.name}" không?`)) {
      return;
    }

    try {
      setActionError(null);
      const res = await fetch(`/api/scoring-standards/${std.id}`, { method: "DELETE" });
      const json = await res.json().catch(() => ({}));

      if (res.status === 409) {
        const usageExams = json.usage?.exams ?? 0;
        const usageCourses = json.usage?.courses ?? 0;
        const errMsg = `${json.error || "Chuẩn đang được sử dụng, không thể xóa."} (Đang dùng: ${usageExams} đề thi, ${usageCourses} khóa học)`;
        setActionError(errMsg);
        return;
      }

      if (res.ok && json.success) {
        setSuccessMsg(`Đã xóa chuẩn chấm "${std.name}" thành công.`);
        fetchStandards();
        setTimeout(() => setSuccessMsg(null), 4000);
      } else {
        setActionError(json.error || "Lỗi khi xóa chuẩn chấm.");
      }
    } catch (err: any) {
      setActionError(err.message || "Lỗi kết nối khi xóa chuẩn chấm.");
    }
  };

  const handleSaveStandard = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!name.trim()) {
      setFormError("Vui lòng nhập tên chuẩn chấm.");
      return;
    }

    if (sections.length === 0) {
      setFormError("Chuẩn chấm phải có ít nhất 1 phần thi (sections).");
      return;
    }

    // Build aggregation
    const aggregationPayload: AggregationConfig = {
      method: aggMethod,
      round_step: Number(aggRoundStep),
    };

    if (aggPassScore.trim() !== "") {
      const num = Number(aggPassScore);
      if (!Number.isNaN(num)) {
        aggregationPayload.pass_score = num;
      }
    }

    if (aggMethod === "WEIGHTED") {
      const weightsObj: Record<string, number> = {};
      sections.forEach((sec) => {
        weightsObj[sec.skill] = aggWeights[sec.skill] !== undefined ? Number(aggWeights[sec.skill]) : 1;
      });
      aggregationPayload.weights = weightsObj;
    }

    const sectionMinObj: Record<string, number> = {};
    for (const [k, v] of Object.entries(aggSectionMin)) {
      if (v !== "" && sections.some((s) => s.skill === k)) {
        const num = Number(v);
        if (!Number.isNaN(num)) {
          sectionMinObj[k] = num;
        }
      }
    }
    if (Object.keys(sectionMinObj).length > 0) {
      aggregationPayload.section_min = sectionMinObj;
    }

    // Format sections
    const formattedSections = sections.map((sec) => {
      const s: SectionItem = {
        skill: sec.skill,
        min: Number(sec.min),
        max: Number(sec.max),
        step: Number(sec.step),
        conversion: sec.conversion,
      };
      if (sec.conversion === "TABLE") {
        s.table_question_count = Number(sec.table_question_count || 40);
        s.table = (sec.table || []).map((t) => ({
          min_correct: Number(t.min_correct),
          score: Number(t.score),
        }));
      }
      if ((sec.skill === "Writing" || sec.skill === "Speaking") && sec.rubric_id && sec.rubric_id.trim()) {
        s.rubric_id = sec.rubric_id.trim();
      }
      return s;
    });

    const payload = {
      name: name.trim(),
      framework: framework.trim().toUpperCase() || "INTERNAL",
      description: description.trim() || null,
      sections: formattedSections,
      aggregation: aggregationPayload,
    };

    setIsSubmitting(true);
    try {
      const url = editingStandard ? `/api/scoring-standards/${editingStandard.id}` : "/api/scoring-standards";
      const method = editingStandard ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const json = await res.json().catch(() => ({}));

      if (res.ok && json.success) {
        setSuccessMsg(
          editingStandard
            ? `Đã cập nhật chuẩn chấm "${name}" thành công!`
            : `Đã tạo mới chuẩn chấm "${name}" thành công!`
        );
        setShowModal(false);
        fetchStandards();
        setTimeout(() => setSuccessMsg(null), 4000);
      } else {
        setFormError(json.error || "Lỗi lưu chuẩn chấm điểm.");
      }
    } catch (err: any) {
      setFormError(err.message || "Lỗi kết nối khi lưu chuẩn chấm.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredStandards = standards.filter((s) => {
    const matchFw =
      selectedFramework === "ALL" || (s.framework || "").toUpperCase() === selectedFramework.toUpperCase();
    const q = searchQuery.toLowerCase().trim();
    const matchSearch =
      !q ||
      s.name.toLowerCase().includes(q) ||
      (s.framework || "").toLowerCase().includes(q) ||
      (s.description || "").toLowerCase().includes(q) ||
      s.id.toLowerCase().includes(q) ||
      s.sections.some((sec) => sec.skill.toLowerCase().includes(q));
    return matchFw && matchSearch;
  });

  return (
    <AdminLayout
      onSearchChange={tab === "standards" ? setSearchQuery : undefined}
      searchPlaceholder="Tìm kiếm chuẩn chấm theo tên, khung (IELTS, TOEIC...), kỹ năng..."
      searchValue={searchQuery}
    >
      <div className="max-w-[1280px] mx-auto space-y-8 font-sans text-ink">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-line/40 pb-6">
          <div>
            <div className="flex items-center space-x-2 text-xs text-brand-600 uppercase tracking-wider font-bold mb-1">
              <Scale className="w-4 h-4 text-brand-600" />
              <span>Scoring Standards &bull; Multi-Framework</span>
            </div>
            <h1 className="text-3xl font-bold text-ink tracking-tight font-headline">
              Chuẩn chấm điểm
            </h1>
            <p className="text-sm text-ink-muted mt-1">
              Chuẩn chấm quy đổi điểm từng kỹ năng; bộ tiêu chí AI dùng cho Writing/Speaking và được nhiều chuẩn dùng chung.
            </p>
          </div>

          {tab === "standards" && (
            <button
              onClick={openCreateModal}
              className="px-5 py-2.5 bg-brand-600 hover:bg-brand-700 text-white text-xs font-bold rounded-xl shadow transition-all flex items-center space-x-2 shrink-0 font-headline cursor-pointer"
            >
              <PlusCircle className="w-4 h-4 text-white" />
              <span>Tạo Chuẩn Chấm Mới</span>
            </button>
          )}
        </div>

        {/* Tabs */}
        <div className="flex items-center space-x-2 border-b border-line/40 pb-2">
          {([
            ["standards", "Chuẩn chấm"],
            ["rubrics", "Bộ tiêu chí AI"],
          ] as const).map(([key, label]) => (
            <button
              key={key}
              onClick={() => switchTab(key)}
              className={`px-4 py-2 rounded-xl text-xs font-bold font-headline transition-all cursor-pointer whitespace-nowrap ${
                tab === key
                  ? "bg-brand-600 text-white shadow-xs"
                  : "bg-white text-ink-muted hover:bg-surface-alt border border-line"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {tab === "rubrics" ? (
          <RubricManager initialRubricId={searchParams.get("rubric")} />
        ) : (
          <>

        {/* Feedback messages */}
        {successMsg && (
          <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 flex items-center space-x-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            <span className="text-xs font-bold">{successMsg}</span>
          </div>
        )}

        {actionError && (
          <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 flex items-center space-x-2">
            <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0" />
            <span className="text-xs font-bold">{actionError}</span>
          </div>
        )}

        {/* Framework Tabs Filter */}
        <div className="flex items-center space-x-2 overflow-x-auto pb-2 border-b border-line/40 scrollbar-thin">
          <span className="text-xs font-bold text-brand-600 uppercase tracking-wider font-mono mr-2 flex items-center gap-1 shrink-0">
            <Layers className="w-4 h-4" /> Khung:
          </span>
          {dynamicFrameworkTabs.map((fw) => (
            <button
              key={fw}
              onClick={() => setSelectedFramework(fw)}
              className={`px-4 py-2 rounded-xl text-xs font-bold font-headline transition-all cursor-pointer whitespace-nowrap ${
                selectedFramework === fw
                  ? "bg-brand-600 text-white shadow-xs"
                  : "bg-white text-ink-muted hover:bg-surface-alt border border-line"
              }`}
            >
              {fw === "ALL" ? "🌐 Tất Cả Chuẩn" : fw}
            </button>
          ))}
        </div>

        {/* List Content */}
        {loading ? (
          <div className="flex items-center justify-center space-x-2 text-xs text-ink-muted p-12 bg-white rounded-2xl border border-line">
            <Loader2 className="w-5 h-5 animate-spin text-brand-600" />
            <span>Đang tải danh sách chuẩn chấm điểm...</span>
          </div>
        ) : loadError ? (
          <div className="p-12 text-center bg-white rounded-2xl border border-rose-200 space-y-3">
            <AlertTriangle className="w-10 h-10 text-rose-500 mx-auto" />
            <p className="text-sm font-bold text-rose-700">{loadError}</p>
            <button
              onClick={fetchStandards}
              className="px-4 py-2 bg-brand-600 text-white rounded-xl text-xs font-bold hover:bg-brand-700 transition-all cursor-pointer"
            >
              Thử lại
            </button>
          </div>
        ) : filteredStandards.length === 0 ? (
          <div className="p-12 text-center bg-white rounded-2xl border border-line space-y-3">
            <Scale className="w-12 h-12 text-brand-600 mx-auto opacity-40" />
            <p className="text-sm text-ink-muted">Không tìm thấy chuẩn chấm điểm nào phù hợp.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {filteredStandards.map((std) => (
              <div
                key={std.id}
                className="bg-white p-6 rounded-3xl border-2 border-line shadow-sm flex flex-col justify-between space-y-5 hover:shadow-md transition-all"
              >
                <div className="space-y-4">
                  {/* Card Header */}
                  <div className="flex justify-between items-start gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="px-2.5 py-0.5 rounded-full bg-brand-600 text-white font-mono text-[11px] font-bold">
                        {std.framework || "OTHER"}
                      </span>
                      {std.is_system && (
                        <span className="px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-300 font-bold text-[10px]">
                          Hệ thống
                        </span>
                      )}
                    </div>

                    <span className="px-2.5 py-1 bg-brand-50 text-brand-600 text-[11px] font-bold rounded-lg border border-brand-300 font-mono">
                      {std.aggregation?.method || "AVERAGE"} (bước: {std.aggregation?.round_step ?? 0.25})
                      {std.aggregation?.pass_score !== undefined && (
                        <span className="ml-1 text-emerald-700">| Đạt: {std.aggregation.pass_score}</span>
                      )}
                    </span>
                  </div>

                  {/* Title & Description */}
                  <div>
                    <h3 className="text-xl font-bold font-headline text-ink">{std.name}</h3>
                    {std.description && (
                      <p className="text-xs text-ink-muted mt-1 leading-relaxed">{std.description}</p>
                    )}
                  </div>

                  {/* Sections List */}
                  <div className="space-y-2 pt-3 border-t border-line/40">
                    <span className="text-[11px] font-bold text-brand-600 uppercase tracking-wider block font-mono">
                      Cấu trúc phần thi ({std.sections?.length || 0} phần):
                    </span>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {std.sections?.map((sec, idx) => (
                        <div
                          key={idx}
                          className="p-3 bg-surface-alt rounded-xl border border-line text-xs space-y-1.5"
                        >
                          <div className="flex justify-between items-center font-bold text-ink">
                            <span className="text-sm font-headline text-brand-600">{sec.skill}</span>
                            <span className="px-1.5 py-0.5 rounded bg-white border border-line text-[10px] font-mono text-ink-muted">
                              {sec.conversion}
                            </span>
                          </div>

                          <div className="text-[11px] text-ink-muted">
                            Thang: <strong className="font-mono">{sec.min} – {sec.max}</strong> (step {sec.step})
                          </div>

                          {sec.conversion === "TABLE" && sec.table && (
                            <div className="text-[10px] text-ink-subtle">
                              Tra bảng ({sec.table_question_count || 40} câu, {sec.table.length} mốc)
                            </div>
                          )}

                          {sec.rubric_id && (
                            <div className="text-[10px] text-purple-700 truncate font-mono">
                              Rubric: {sec.rubric_id}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Card Actions */}
                <div className="flex items-center justify-end space-x-2 pt-3 border-t border-line/30">
                  <button
                    onClick={() => openEditModal(std)}
                    className="px-3.5 py-2 bg-surface-alt text-brand-600 border border-line rounded-xl text-xs font-bold hover:bg-brand-50 flex items-center space-x-1.5 transition-all font-headline cursor-pointer"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                    <span>Chỉnh Sửa</span>
                  </button>

                  {!std.is_system && (
                    <button
                      onClick={() => handleDeleteStandard(std)}
                      className="p-2 text-rose-600 hover:bg-rose-50 border border-rose-200 rounded-xl transition-all cursor-pointer"
                      title="Xóa Chuẩn Chấm"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Create / Edit Modal */}
        {showModal && (
          <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 font-sans">
            <div className="bg-white rounded-3xl p-6 md:p-8 max-w-3xl w-full shadow-2xl border border-line space-y-6 max-h-[90vh] overflow-y-auto animate-in fade-in zoom-in-95">
              <div className="flex justify-between items-center border-b border-line/40 pb-4">
                <h2 className="text-xl font-bold text-brand-600 flex items-center space-x-2 font-headline">
                  <Scale className="w-5 h-5 text-brand-600" />
                  <span>
                    {editingStandard
                      ? `Chỉnh Sửa Chuẩn Chấm: ${editingStandard.name}`
                      : "Tạo Mới Chuẩn Chấm Điểm"}
                  </span>
                </h2>
                <button
                  onClick={() => setShowModal(false)}
                  className="text-ink-subtle hover:text-ink cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {formError && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-bold flex items-center space-x-2">
                  <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              <form onSubmit={handleSaveStandard} className="space-y-6">
                {/* General Info */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold uppercase text-brand-600 mb-1">
                      Tên Chuẩn Chấm (*)
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="Ví dụ: IELTS Academic, TOEIC 2 Kỹ Năng..."
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="w-full p-3 bg-surface-alt border border-line rounded-xl text-xs font-bold focus:outline-none focus:border-brand-600"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase text-brand-600 mb-1">
                      Khung Tiêu Chuẩn (Framework)
                    </label>
                    <input
                      type="text"
                      list="framework-options"
                      placeholder="IELTS, TOEIC, HSK, INTERNAL..."
                      value={framework}
                      onChange={(e) => setFramework(e.target.value)}
                      className="w-full p-3 bg-surface-alt border border-line rounded-xl text-xs font-bold focus:outline-none focus:border-brand-600"
                    />
                    <datalist id="framework-options">
                      {PRESET_FRAMEWORKS.map((fw) => (
                        <option key={fw} value={fw} />
                      ))}
                    </datalist>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase text-ink-muted mb-1">
                    Mô Tả Chuẩn Chấm
                  </label>
                  <input
                    type="text"
                    placeholder="Mô tả thang điểm, cách quy đổi và mục đích sử dụng..."
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="w-full p-3 bg-surface-alt border border-line rounded-xl text-xs font-medium focus:outline-none focus:border-brand-600"
                  />
                </div>

                {/* Sections Editor */}
                <div className="space-y-3 pt-2 border-t border-line/40">
                  <div className="flex justify-between items-center">
                    <div>
                      <label className="block text-xs font-bold uppercase text-brand-600">
                        Danh Sách Phần Thi Theo Kỹ Năng ({sections.length})
                      </label>
                      <span className="text-[10px] text-ink-subtle">
                        Mỗi kỹ năng chỉ xuất hiện 1 lần. Chọn thang điểm và cách quy đổi (LINEAR hoặc TABLE).
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={handleAddSection}
                      className="px-3 py-1.5 bg-brand-50 text-brand-600 border border-brand-300 rounded-lg text-xs font-bold hover:bg-brand-100 transition-all cursor-pointer"
                    >
                      + Thêm Phần Thi
                    </button>
                  </div>

                  <div className="space-y-4">
                    {sections.map((sec, secIdx) => (
                      <div
                        key={secIdx}
                        className="p-4 bg-surface-alt rounded-2xl border border-line space-y-3"
                      >
                        <div className="flex justify-between items-center">
                          <div className="flex items-center space-x-2">
                            <span className="text-xs font-bold font-mono text-brand-600">#{secIdx + 1}</span>
                            <select
                              value={sec.skill}
                              onChange={(e) => handleSectionChange(secIdx, "skill", e.target.value)}
                              className="p-2 bg-white border border-line rounded-lg text-xs font-bold"
                            >
                              {SKILLS.map((s) => (
                                <option key={s} value={s}>
                                  {s}
                                </option>
                              ))}
                            </select>

                            <select
                              value={sec.conversion}
                              onChange={(e) => handleSectionChange(secIdx, "conversion", e.target.value)}
                              className="p-2 bg-white border border-line rounded-lg text-xs font-bold"
                            >
                              <option value="LINEAR">LINEAR (Tuyến tính)</option>
                              <option value="TABLE">TABLE (Bảng tra điểm)</option>
                            </select>
                          </div>

                          <button
                            type="button"
                            onClick={() => handleRemoveSection(secIdx)}
                            className="p-1.5 text-rose-600 hover:bg-rose-100 rounded-lg transition-all cursor-pointer"
                            title="Xóa phần thi"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>

                        {/* Min / Max / Step */}
                        <div className="grid grid-cols-3 gap-2">
                          <div>
                            <label className="block text-[10px] font-bold text-brand-600">Min</label>
                            <input
                              type="number"
                              step="any"
                              value={sec.min}
                              onChange={(e) => handleSectionChange(secIdx, "min", Number(e.target.value))}
                              className="w-full p-2 bg-white border border-line rounded-lg text-xs font-bold"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] font-bold text-brand-600">Max</label>
                            <input
                              type="number"
                              step="any"
                              value={sec.max}
                              onChange={(e) => handleSectionChange(secIdx, "max", Number(e.target.value))}
                              className="w-full p-2 bg-white border border-line rounded-lg text-xs font-bold"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] font-bold text-brand-600">Bước điểm (Step)</label>
                            <input
                              type="number"
                              step="any"
                              value={sec.step}
                              onChange={(e) => handleSectionChange(secIdx, "step", Number(e.target.value))}
                              className="w-full p-2 bg-white border border-line rounded-lg text-xs font-bold"
                            />
                          </div>
                        </div>

                        {/* Writing / Speaking rubric selector */}
                        {(sec.skill === "Writing" || sec.skill === "Speaking") && (
                          <div>
                            <label className="block text-[10px] font-bold text-brand-600 mb-1">
                              Tiêu Chí AI Rubric (rubric_id cho {sec.skill})
                            </label>
                            <select
                              value={sec.rubric_id || ""}
                              onChange={(e) => handleSectionChange(secIdx, "rubric_id", e.target.value)}
                              className="w-full p-2 bg-white border border-line rounded-lg text-xs font-bold"
                            >
                              <option value="">(Mặc định hệ thống / Không chọn)</option>
                              {rubrics.map((r) => (
                                <option key={r.id} value={r.id}>
                                  {r.name} [{r.framework || "RUBRIC"}] ({r.id})
                                </option>
                              ))}
                            </select>
                            {sec.rubric_id && (
                              <a
                                href={`/admin/scoring-standards?tab=rubrics&rubric=${encodeURIComponent(sec.rubric_id)}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-block mt-1 text-[11px] font-bold text-brand-600 hover:underline"
                              >
                                Sửa tiêu chí này
                              </a>
                            )}
                          </div>
                        )}

                        {/* TABLE Conversion: table_question_count + rows */}
                        {sec.conversion === "TABLE" && (
                          <div className="p-3 bg-white rounded-xl border border-line space-y-2">
                            <div className="flex justify-between items-center">
                              <div className="flex items-center space-x-2">
                                <label className="text-[10px] font-bold text-brand-600">
                                  Số câu chuẩn bảng tra:
                                </label>
                                <input
                                  type="number"
                                  min="1"
                                  value={sec.table_question_count || 40}
                                  onChange={(e) =>
                                    handleSectionChange(secIdx, "table_question_count", Number(e.target.value))
                                  }
                                  className="w-20 p-1 border border-line rounded text-xs font-bold text-center"
                                />
                              </div>

                              <button
                                type="button"
                                onClick={() => handleAddTableRow(secIdx)}
                                className="px-2 py-1 bg-surface-alt text-brand-600 border border-line rounded text-[11px] font-bold hover:bg-brand-50 cursor-pointer"
                              >
                                + Thêm Mốc Điểm
                              </button>
                            </div>

                            <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                              {(sec.table || []).map((row, rIdx) => (
                                <div key={rIdx} className="flex items-center space-x-2 text-xs">
                                  <span className="text-[10px] text-ink-subtle w-6 text-right">#{rIdx + 1}</span>
                                  <span className="text-[10px] font-bold text-ink-muted">Từ số câu đúng:</span>
                                  <input
                                    type="number"
                                    min="0"
                                    value={row.min_correct}
                                    onChange={(e) =>
                                      handleTableRowChange(secIdx, rIdx, "min_correct", Number(e.target.value))
                                    }
                                    className="w-16 p-1 border border-line rounded text-center text-xs font-bold"
                                    placeholder="min_correct"
                                  />
                                  <span className="text-[10px] font-bold text-ink-muted">→ Điểm:</span>
                                  <input
                                    type="number"
                                    step="any"
                                    value={row.score}
                                    onChange={(e) =>
                                      handleTableRowChange(secIdx, rIdx, "score", Number(e.target.value))
                                    }
                                    className="w-20 p-1 border border-line rounded text-center text-xs font-bold"
                                  />
                                  <button
                                    type="button"
                                    onClick={() => handleRemoveTableRow(secIdx, rIdx)}
                                    className="p-1 text-rose-600 hover:bg-rose-50 rounded cursor-pointer"
                                    title="Xóa mốc"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Aggregation Config */}
                <div className="p-4 bg-surface-alt rounded-2xl border border-line space-y-4">
                  <div className="flex items-center space-x-2">
                    <BookOpen className="w-4 h-4 text-brand-600" />
                    <h4 className="text-xs font-bold uppercase text-brand-600">
                      Quy Tắc Tính Điểm Tổng (Aggregation)
                    </h4>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-[11px] font-bold text-brand-600 mb-1">Phương pháp</label>
                      <select
                        value={aggMethod}
                        onChange={(e) => setAggMethod(e.target.value as any)}
                        className="w-full p-2 bg-white border border-line rounded-lg text-xs font-bold"
                      >
                        <option value="AVERAGE">AVERAGE (Trung bình cộng)</option>
                        <option value="SUM">SUM (Tổng các phần)</option>
                        <option value="WEIGHTED">WEIGHTED (Trung bình có trọng số)</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-brand-600 mb-1">Làm tròn (round_step)</label>
                      <input
                        type="number"
                        step="any"
                        value={aggRoundStep}
                        onChange={(e) => setAggRoundStep(Number(e.target.value))}
                        className="w-full p-2 bg-white border border-line rounded-lg text-xs font-bold"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-brand-600 mb-1">
                        Điểm đạt (pass_score - tùy chọn)
                      </label>
                      <input
                        type="number"
                        step="any"
                        placeholder="Để trống nếu không xét"
                        value={aggPassScore}
                        onChange={(e) => setAggPassScore(e.target.value)}
                        className="w-full p-2 bg-white border border-line rounded-lg text-xs font-bold"
                      />
                    </div>
                  </div>

                  {/* WEIGHTED Weights inputs */}
                  {aggMethod === "WEIGHTED" && (
                    <div className="pt-2 border-t border-line/40 space-y-2">
                      <span className="text-[11px] font-bold text-brand-600 block">
                        Trọng số theo kỹ năng (weights):
                      </span>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        {sections.map((sec) => (
                          <div key={sec.skill} className="flex items-center space-x-1">
                            <span className="text-xs font-bold text-ink-muted w-20">{sec.skill}:</span>
                            <input
                              type="number"
                              step="any"
                              min="0"
                              value={aggWeights[sec.skill] !== undefined ? aggWeights[sec.skill] : 1}
                              onChange={(e) =>
                                setAggWeights({ ...aggWeights, [sec.skill]: Number(e.target.value) })
                              }
                              className="w-16 p-1 bg-white border border-line rounded text-xs font-bold text-center"
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Section Min scores */}
                  <div className="pt-2 border-t border-line/40 space-y-2">
                    <span className="text-[11px] font-bold text-brand-600 block">
                      Điểm sàn từng phần thi (section_min - tùy chọn):
                    </span>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      {sections.map((sec) => (
                        <div key={sec.skill} className="flex items-center space-x-1">
                          <span className="text-xs font-bold text-ink-muted w-20">{sec.skill}:</span>
                          <input
                            type="number"
                            step="any"
                            placeholder="Sàn"
                            value={aggSectionMin[sec.skill] || ""}
                            onChange={(e) =>
                              setAggSectionMin({ ...aggSectionMin, [sec.skill]: e.target.value })
                            }
                            className="w-16 p-1 bg-white border border-line rounded text-xs font-bold text-center"
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Form Buttons */}
                <div className="pt-4 flex space-x-3">
                  <button
                    type="button"
                    onClick={() => setShowModal(false)}
                    className="flex-1 py-3 border border-line text-ink-muted rounded-xl text-xs font-medium hover:bg-surface-alt cursor-pointer"
                  >
                    Hủy
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="flex-1 py-3 bg-brand-600 hover:bg-brand-700 text-white rounded-xl text-xs font-bold shadow flex items-center justify-center space-x-2 disabled:opacity-50 font-headline cursor-pointer"
                  >
                    {isSubmitting ? (
                      <Loader2 className="w-4 h-4 animate-spin text-white" />
                    ) : (
                      <Save className="w-4 h-4 text-white" />
                    )}
                    <span>{editingStandard ? "Cập Nhật Chuẩn Chấm" : "Lưu Chuẩn Chấm Mới"}</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
          </>
        )}
      </div>
    </AdminLayout>
  );
}
