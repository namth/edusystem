"use client";

import { useState, useEffect, useMemo } from "react";
import AdminLayout from "@/components/AdminLayout";
import {
  Award,
  PlusCircle,
  Edit3,
  Trash2,
  CheckCircle2,
  Loader2,
  X,
  Save,
  Globe,
  Layers,
} from "lucide-react";

interface CriteriaItem {
  key: string;
  label: string;
  weight: number;
  descriptor: string;
}

interface Rubric {
  id: string;
  name: string;
  description?: string;
  skill: "Writing" | "Speaking";
  framework: string;
  language: string;
  scale_min: number;
  scale_max: number;
  scale_step: number;
  criteria: CriteriaItem[];
  output_language: string;
  created_at?: string;
}

const PRESET_FRAMEWORKS = ["IELTS", "TOEIC", "TOEFL", "CEFR", "HSK", "JLPT", "VSTEP", "PTE", "INTERNAL", "DELE", "TestDaF", "TOPIK"];
const PRESET_LANGUAGES = [
  { code: "EN", label: "🇬🇧 Tiếng Anh (English)" },
  { code: "ZH", label: "🇨🇳 Tiếng Trung (Chinese)" },
  { code: "JA", label: "🇯🇵 Tiếng Nhật (Japanese)" },
  { code: "FR", label: "🇫🇷 Tiếng Pháp (French)" },
  { code: "DE", label: "🇩🇪 Tiếng Đức (German)" },
  { code: "ES", label: "🇪🇸 Tiếng Tây Ban Nha (Spanish)" },
  { code: "KO", label: "🇰🇷 Tiếng Hàn (Korean)" },
  { code: "VI", label: "🇻🇳 Tiếng Việt (Vietnamese)" },
];

export default function AdminRubricsPage() {
  const [rubrics, setRubrics] = useState<Rubric[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedFramework, setSelectedFramework] = useState<string>("ALL");
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Modal State
  const [showModal, setShowModal] = useState(false);
  const [editingRubric, setEditingRubric] = useState<Rubric | null>(null);

  // Form State
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [skill, setSkill] = useState<"Writing" | "Speaking">("Writing");
  const [frameworkInput, setFrameworkInput] = useState("IELTS");
  const [languageInput, setLanguageInput] = useState("EN");
  const [scaleMin, setScaleMin] = useState(0);
  const [scaleMax, setScaleMax] = useState(9);
  const [scaleStep, setScaleStep] = useState(0.5);
  const [outputLanguage, setOutputLanguage] = useState("vi");
  const [criteria, setCriteria] = useState<CriteriaItem[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchRubrics = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/exam/rubrics");
      const json = await res.json();

      if (json.success && Array.isArray(json.rubrics)) {
        setRubrics(
          json.rubrics.map((r: any) => ({
            id: r.id,
            name: r.name,
            description: r.description || "",
            skill: r.skill || (r.name.toLowerCase().includes("speaking") ? "Speaking" : "Writing"),
            framework: (r.framework || "IELTS").toUpperCase(),
            language: (r.language || "EN").toUpperCase(),
            scale_min: Number(r.scale_min ?? 0),
            scale_max: Number(r.scale_max ?? 9),
            scale_step: Number(r.scale_step ?? 0.5),
            criteria: Array.isArray(r.criteria) ? r.criteria : [],
            output_language: r.output_language || "vi",
            created_at: r.created_at ? new Date(r.created_at).toLocaleDateString("vi-VN") : "Khởi tạo",
          }))
        );
      }
    } catch (e) {
      console.error("Fetch rubrics error:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRubrics();
  }, []);

  // Compute dynamic Framework Tabs directly from DB records (Only show frameworks that exist in DB)
  const dynamicFrameworkTabs = useMemo(() => {
    const fwSet = new Set<string>();
    rubrics.forEach((r) => {
      if (r.framework) fwSet.add(r.framework.toUpperCase());
    });
    return ["ALL", ...Array.from(fwSet)];
  }, [rubrics]);

  const openCreateModal = () => {
    setEditingRubric(null);
    setName("");
    setDescription("");
    setSkill("Writing");
    setFrameworkInput("IELTS");
    setLanguageInput("EN");
    setScaleMin(0);
    setScaleMax(9);
    setScaleStep(0.5);
    setOutputLanguage("vi");
    setCriteria([
      { key: "task_achievement", label: "Task Achievement", weight: 0.25, descriptor: "Đánh giá mức độ hoàn thành câu hỏi luận" },
      { key: "coherence_cohesion", label: "Coherence & Cohesion", weight: 0.25, descriptor: "Đánh giá tính mạch lạc và liên kết câu" },
      { key: "lexical_resource", label: "Vốn Từ Vựng", weight: 0.25, descriptor: "Đánh giá sự đa dạng và độ chính xác từ vựng" },
      { key: "grammatical_range", label: "Ngữ Pháp", weight: 0.25, descriptor: "Đánh giá đa dạng và chính xác cấu trúc ngữ pháp" },
    ]);
    setShowModal(true);
  };

  const openEditModal = (rubric: Rubric) => {
    setEditingRubric(rubric);
    setName(rubric.name);
    setDescription(rubric.description || "");
    setSkill(rubric.skill);
    setFrameworkInput(rubric.framework);
    setLanguageInput(rubric.language);
    setScaleMin(rubric.scale_min);
    setScaleMax(rubric.scale_max);
    setScaleStep(rubric.scale_step);
    setOutputLanguage(rubric.output_language);
    setCriteria(rubric.criteria || []);
    setShowModal(true);
  };

  const handleAddCriteria = () => {
    setCriteria([
      ...criteria,
      {
        key: `crit_${Date.now().toString().slice(-4)}`,
        label: "Tiêu chí mới",
        weight: 0.25,
        descriptor: "Mô tả tiêu chuẩn chấm cho AI Engine",
      },
    ]);
  };

  const handleRemoveCriteria = (index: number) => {
    setCriteria(criteria.filter((_, i) => i !== index));
  };

  const handleCriteriaChange = (index: number, field: keyof CriteriaItem, value: any) => {
    const updated = [...criteria];
    updated[index] = { ...updated[index], [field]: value };
    setCriteria(updated);
  };

  const handleSaveRubric = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setIsSubmitting(true);
    try {
      const fwClean = frameworkInput.trim().toUpperCase() || "IELTS";
      const langClean = languageInput.trim().toUpperCase() || "EN";

      const payload = {
        id: editingRubric ? editingRubric.id : `rubric_${fwClean.toLowerCase()}_${Date.now().toString().slice(-4)}`,
        name: name.trim(),
        description: description.trim(),
        skill: skill,
        framework: fwClean,
        language: langClean,
        scale_min: scaleMin,
        scale_max: scaleMax,
        scale_step: scaleStep,
        criteria: criteria,
        output_language: outputLanguage,
      };

      const method = editingRubric ? "PUT" : "POST";
      const res = await fetch("/api/exam/rubrics", {
        method: method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      if (json.success) {
        setSuccessMsg(editingRubric ? "Đã cập nhật Bộ Rubric thành công!" : `Đã tạo mới Bộ Rubric [${fwClean}] thành công!`);
        setShowModal(false);
        fetchRubrics();
        setTimeout(() => setSuccessMsg(null), 4000);
      } else {
        alert("Lỗi lưu Rubric: " + json.error);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteRubric = async (id: string, rName: string) => {
    if (!confirm(`Bạn có chắc chắn muốn xóa Bộ Tiêu Chí "${rName}" không?`)) return;

    try {
      const res = await fetch(`/api/exam/rubrics?id=${id}`, { method: "DELETE" });
      const json = await res.json();
      if (json.success) {
        setSuccessMsg(`Đã xóa Bộ Rubric "${rName}" thành công.`);
        fetchRubrics();
        setTimeout(() => setSuccessMsg(null), 4000);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const getLanguageBadge = (lang: string) => {
    const code = (lang || "EN").toUpperCase();
    switch (code) {
      case "ZH":
      case "CN":
        return <span className="px-2 py-0.5 rounded bg-rose-100 text-rose-900 border border-rose-300 font-bold text-[10px]">🇨🇳 Tiếng Trung</span>;
      case "JA":
      case "JP":
        return <span className="px-2 py-0.5 rounded bg-red-100 text-red-900 border border-red-300 font-bold text-[10px]">🇯🇵 Tiếng Nhật</span>;
      case "FR":
        return <span className="px-2 py-0.5 rounded bg-blue-100 text-blue-900 border border-blue-300 font-bold text-[10px]">🇫🇷 Tiếng Pháp</span>;
      case "DE":
        return <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-900 border border-amber-300 font-bold text-[10px]">🇩🇪 Tiếng Đức</span>;
      case "ES":
        return <span className="px-2 py-0.5 rounded bg-orange-100 text-orange-900 border border-orange-300 font-bold text-[10px]">🇪🇸 Tiếng TBN</span>;
      case "KO":
      case "KR":
        return <span className="px-2 py-0.5 rounded bg-sky-100 text-sky-900 border border-sky-300 font-bold text-[10px]">🇰🇷 Tiếng Hàn</span>;
      case "VI":
        return <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-900 border border-emerald-300 font-bold text-[10px]">🇻🇳 Tiếng Việt</span>;
      default:
        return <span className="px-2 py-0.5 rounded bg-indigo-100 text-indigo-900 border border-indigo-300 font-bold text-[10px]">🇬🇧 Tiếng Anh ({code})</span>;
    }
  };

  const getFrameworkTabLabel = (fw: string) => {
    if (fw === "ALL") return "🌐 Tất Cả Chuẩn";
    const upperFw = fw.toUpperCase();

    if (upperFw === "IELTS" || upperFw === "TOEIC") return `🇬🇧 ${upperFw}`;
    if (upperFw === "TOEFL") return `🇺🇸 ${upperFw}`;
    if (upperFw === "CEFR") return `🇪🇺 ${upperFw}`;
    if (upperFw === "HSK") return `🇨🇳 ${upperFw}`;
    if (upperFw === "JLPT") return `🇯🇵 ${upperFw}`;
    if (upperFw === "INTERNAL") return `🇻🇳 ${upperFw} Nội Bổ`;

    const matchingRubric = rubrics.find((r) => r.framework.toUpperCase() === upperFw);
    const langCode = (matchingRubric?.language || "EN").toUpperCase();

    if (langCode === "ZH" || langCode === "CN") return `🇨🇳 ${upperFw}`;
    if (langCode === "JA" || langCode === "JP") return `🇯🇵 ${upperFw}`;
    if (langCode === "FR") return `🇫🇷 ${upperFw}`;
    if (langCode === "DE") return `🇩🇪 ${upperFw}`;
    if (langCode === "ES") return `🇪🇸 ${upperFw}`;
    if (langCode === "KO" || langCode === "KR") return `🇰🇷 ${upperFw}`;
    if (langCode === "VI") return `🇻🇳 ${upperFw}`;

    return `🇬🇧 ${upperFw}`;
  };

  const filteredRubrics = rubrics.filter((r) => {
    const matchFramework = selectedFramework === "ALL" || r.framework.toUpperCase() === selectedFramework.toUpperCase();
    const matchSearch =
      !searchQuery.trim() ||
      r.name.toLowerCase().includes(searchQuery.toLowerCase().trim()) ||
      r.skill.toLowerCase().includes(searchQuery.toLowerCase().trim()) ||
      r.framework.toLowerCase().includes(searchQuery.toLowerCase().trim()) ||
      r.id.toLowerCase().includes(searchQuery.toLowerCase().trim());
    return matchFramework && matchSearch;
  });

  return (
    <AdminLayout
      onSearchChange={setSearchQuery}
      searchPlaceholder="Tìm kiếm Bộ Rubric theo tên, chuẩn (VSTEP, PTE, IELTS...), ID, kỹ năng..."
      searchValue={searchQuery}
    >
      <div className="max-w-[1280px] mx-auto space-y-8 font-sans text-[#211a16]">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#d8c2b6]/40 pb-6">
          <div>
            <div className="flex items-center space-x-2 text-xs text-[#6d3807] uppercase tracking-wider font-bold mb-1">
              <Globe className="w-4 h-4 text-[#6d3807]" />
              <span>Scoring Rubrics System &bull; Dynamic Frameworks</span>
            </div>
            <h1 className="text-3xl font-bold text-[#211a16] tracking-tight font-headline">
              Quản Lý Tiêu Chí Chấm Điểm Linh Hoạt
            </h1>
            <p className="text-sm text-[#52443a] mt-1">
              Tự động hóa 100% Bộ Tiêu Chuẩn (IELTS, TOEIC, TOEFL, CEFR, HSK, JLPT, VSTEP, PTE...) và Ngôn ngữ khảo thí mà không cần sửa mã nguồn.
            </p>
          </div>

          <button
            onClick={openCreateModal}
            className="px-5 py-2.5 bg-[#6d3807] hover:bg-[#8a4f1e] text-white text-xs font-bold rounded-xl shadow transition-all flex items-center space-x-2 shrink-0 font-headline cursor-pointer"
          >
            <PlusCircle className="w-4 h-4 text-[#ffb782]" />
            <span>+ Tạo Bộ Tiêu Chuẩn Mới</span>
          </button>
        </div>

        {successMsg && (
          <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 flex items-center space-x-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            <span className="text-xs font-bold">{successMsg}</span>
          </div>
        )}

        {/* Dynamic Framework Tabs Filter */}
        <div className="flex items-center space-x-2 overflow-x-auto pb-2 border-b border-[#d8c2b6]/40 scrollbar-thin">
          <span className="text-xs font-bold text-[#6d3807] uppercase tracking-wider font-mono mr-2 flex items-center gap-1 shrink-0">
            <Layers className="w-4 h-4" /> Chuẩn:
          </span>
          {dynamicFrameworkTabs.map((fw) => (
            <button
              key={fw}
              onClick={() => setSelectedFramework(fw)}
              className={`px-4 py-2 rounded-xl text-xs font-bold font-headline transition-all cursor-pointer whitespace-nowrap ${
                selectedFramework === fw
                  ? "bg-[#6d3807] text-white shadow-xs"
                  : "bg-white text-[#52443a] hover:bg-[#fff8f5] border border-[#d8c2b6]"
              }`}
            >
              {getFrameworkTabLabel(fw)}
            </button>
          ))}
        </div>

        {/* Rubrics Grid */}
        {loading ? (
          <div className="flex items-center space-x-2 text-xs text-[#52443a] p-12 bg-white rounded-2xl border border-[#d8c2b6]">
            <Loader2 className="w-4 h-4 animate-spin text-[#6d3807]" />
            <span>Đang nạp danh mục Tiêu chí Rubric từ cơ sở dữ liệu...</span>
          </div>
        ) : filteredRubrics.length === 0 ? (
          <div className="p-12 text-center bg-white rounded-2xl border border-[#d8c2b6] space-y-3">
            <Award className="w-12 h-12 text-[#6d3807] mx-auto opacity-50" />
            <p className="text-xs text-[#52443a]">Không tìm thấy Bộ Rubric nào thuộc tiêu chuẩn "{selectedFramework}".</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {filteredRubrics.map((r) => (
              <div
                key={r.id}
                className="bg-white p-6 rounded-3xl border-2 border-[#d8c2b6] shadow-sm flex flex-col justify-between space-y-5 hover:shadow-md transition-all"
              >
                <div className="space-y-3">
                  <div className="flex justify-between items-start">
                    <div className="flex items-center space-x-2">
                      <span className="px-2.5 py-0.5 rounded-full bg-[#6d3807] text-white font-mono text-[11px] font-bold">
                        {r.framework}
                      </span>
                      {getLanguageBadge(r.language)}
                      <span className={`px-2.5 py-0.5 rounded-full text-xs font-mono font-bold ${
                        r.skill === "Writing" ? "bg-purple-100 text-purple-900 border border-purple-300" : "bg-emerald-100 text-emerald-900 border border-emerald-300"
                      }`}>
                        {r.skill}
                      </span>
                    </div>

                    <span className="px-3 py-1 bg-[#fff1ea] text-[#6d3807] text-xs font-bold rounded-lg border border-[#ffb783] font-mono">
                      Thang: {r.scale_min} - {r.scale_max} (Step: {r.scale_step})
                    </span>
                  </div>

                  <h3 className="text-xl font-bold font-headline text-[#211a16]">{r.name}</h3>
                  {r.description && <p className="text-xs text-[#52443a] leading-relaxed">{r.description}</p>}

                  {/* Criteria List Cards */}
                  <div className="space-y-2 pt-2 border-t border-[#d8c2b6]/40">
                    <span className="text-[11px] font-bold text-[#6d3807] uppercase tracking-wider block font-mono">
                      Cấu trúc {r.criteria.length} Tiêu chí đánh giá AI:
                    </span>
                    <div className="grid grid-cols-2 gap-2">
                      {r.criteria.map((c, idx) => (
                        <div key={idx} className="p-2.5 bg-[#fff8f5] rounded-xl border border-[#d8c2b6] text-xs space-y-1">
                          <div className="flex justify-between items-center font-bold text-[#211a16]">
                            <span>{c.label}</span>
                            <span className="text-[10px] text-[#6d3807] font-mono">{(c.weight * 100).toFixed(0)}%</span>
                          </div>
                          <p className="text-[10px] text-[#857469] line-clamp-2">{c.descriptor}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-end space-x-2 pt-3 border-t border-[#d8c2b6]/30">
                  <button
                    onClick={() => openEditModal(r)}
                    className="px-3.5 py-2 bg-[#fff8f5] text-[#6d3807] border border-[#d8c2b6] rounded-xl text-xs font-bold hover:bg-[#fff1ea] flex items-center space-x-1.5 transition-all font-headline cursor-pointer"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                    <span>Chỉnh Sửa</span>
                  </button>

                  <button
                    onClick={() => handleDeleteRubric(r.id, r.name)}
                    className="p-2 text-rose-600 hover:bg-rose-50 border border-rose-200 rounded-xl transition-all cursor-pointer"
                    title="Xóa Rubric"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Modal: Create / Edit Rubric with Dynamic ComboBoxes */}
        {showModal && (
          <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 font-sans">
            <div className="bg-white rounded-3xl p-6 md:p-8 max-w-2xl w-full shadow-2xl border border-[#d8c2b6] space-y-6 max-h-[90vh] overflow-y-auto animate-in fade-in zoom-in-95">
              <div className="flex justify-between items-center border-b border-[#d8c2b6]/40 pb-4">
                <h2 className="text-xl font-bold text-[#6d3807] flex items-center space-x-2 font-headline">
                  <Award className="w-5 h-5 text-[#6d3807]" />
                  <span>{editingRubric ? `Chỉnh Sửa Rubric: ${editingRubric.name}` : "Tạo Mới Bộ Rubric Linh Hoạt Đa Chuẩn"}</span>
                </h2>
                <button onClick={() => setShowModal(false)} className="text-[#857469] cursor-pointer">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSaveRubric} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold uppercase text-[#6d3807] mb-1">
                      Tên Bộ Rubric (*)
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="Ví dụ: VSTEP B2 Writing Task 2"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="w-full p-3 bg-[#fff8f5] border border-[#d8c2b6] rounded-xl text-xs font-bold focus:outline-none focus:border-[#6d3807]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase text-[#6d3807] mb-1">
                      Kỹ Năng Áp Dụng (*)
                    </label>
                    <select
                      value={skill}
                      onChange={(e) => setSkill(e.target.value as any)}
                      className="w-full p-3 bg-[#fff8f5] border border-[#d8c2b6] rounded-xl text-xs font-bold focus:outline-none focus:border-[#6d3807]"
                    >
                      <option value="Writing">Writing (Bài viết tự luận)</option>
                      <option value="Speaking">Speaking (Bài nói thu âm micro)</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Dynamic ComboBox: Framework */}
                  <div>
                    <label className="block text-xs font-bold uppercase text-[#6d3807] mb-1">
                      Bộ Tiêu Chuẩn (Framework) (*)
                    </label>
                    <input
                      type="text"
                      list="framework-options"
                      required
                      placeholder="Chọn hoặc tự nhập (vd: VSTEP, PTE, DELE...)"
                      value={frameworkInput}
                      onChange={(e) => setFrameworkInput(e.target.value)}
                      className="w-full p-3 bg-[#fff8f5] border border-[#d8c2b6] rounded-xl text-xs font-bold focus:outline-none focus:border-[#6d3807]"
                    />
                    <datalist id="framework-options">
                      {PRESET_FRAMEWORKS.map((fw) => (
                        <option key={fw} value={fw} />
                      ))}
                    </datalist>
                    <span className="text-[10px] text-[#857469] mt-0.5 block">💡 Có thể gõ tùy chỉnh chuẩn mới (vd: VSTEP, PTE, TOPIK...)</span>
                  </div>

                  {/* Dynamic ComboBox: Language */}
                  <div>
                    <label className="block text-xs font-bold uppercase text-[#6d3807] mb-1">
                      Ngôn Ngữ Khảo Thí (Language) (*)
                    </label>
                    <input
                      type="text"
                      list="language-options"
                      required
                      placeholder="Chọn mã (EN, ZH, JA, DE, ES, KO, VI...)"
                      value={languageInput}
                      onChange={(e) => setLanguageInput(e.target.value)}
                      className="w-full p-3 bg-[#fff8f5] border border-[#d8c2b6] rounded-xl text-xs font-bold focus:outline-none focus:border-[#6d3807]"
                    />
                    <datalist id="language-options">
                      {PRESET_LANGUAGES.map((l) => (
                        <option key={l.code} value={l.code} label={l.label} />
                      ))}
                    </datalist>
                    <span className="text-[10px] text-[#857469] mt-0.5 block">💡 Mã ngôn ngữ: EN, ZH, JA, FR, DE, ES, KO, VI...</span>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase text-[#52443a] mb-1">
                    Mô Tả Bộ Rubric
                  </label>
                  <input
                    type="text"
                    placeholder="Mô tả mục đích sử dụng cho khóa học..."
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="w-full p-3 bg-[#fff8f5] border border-[#d8c2b6] rounded-xl text-xs font-medium focus:outline-none focus:border-[#6d3807]"
                  />
                </div>

                {/* Scale Configuration */}
                <div className="grid grid-cols-3 gap-3 p-4 bg-[#fff8f5] rounded-2xl border border-[#d8c2b6]">
                  <div>
                    <label className="block text-[11px] font-bold text-[#6d3807]">Scale Min</label>
                    <input
                      type="number"
                      step="0.5"
                      value={scaleMin}
                      onChange={(e) => setScaleMin(Number(e.target.value))}
                      className="w-full p-2 bg-white border border-[#d8c2b6] rounded-lg text-xs font-bold"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-[#6d3807]">Scale Max</label>
                    <input
                      type="number"
                      step="0.5"
                      value={scaleMax}
                      onChange={(e) => setScaleMax(Number(e.target.value))}
                      className="w-full p-2 bg-white border border-[#d8c2b6] rounded-lg text-xs font-bold"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-[#6d3807]">Bước Điểm (Step)</label>
                    <input
                      type="number"
                      step="0.1"
                      value={scaleStep}
                      onChange={(e) => setScaleStep(Number(e.target.value))}
                      className="w-full p-2 bg-white border border-[#d8c2b6] rounded-lg text-xs font-bold"
                    />
                  </div>
                </div>

                {/* Dynamic Criteria List Editor */}
                <div className="space-y-3 pt-2">
                  <div className="flex justify-between items-center">
                    <label className="block text-xs font-bold uppercase text-[#6d3807]">
                      Danh Sách Các Tiêu Chí Thành Phần ({criteria.length})
                    </label>
                    <button
                      type="button"
                      onClick={handleAddCriteria}
                      className="px-3 py-1 bg-[#fff1ea] text-[#6d3807] border border-[#ffb783] rounded-lg text-xs font-bold hover:bg-[#ffdcc5] transition-all cursor-pointer"
                    >
                      + Thêm Tiêu Chí
                    </button>
                  </div>

                  <div className="space-y-3">
                    {criteria.map((crit, idx) => (
                      <div key={idx} className="p-3 bg-[#fff8f5] rounded-xl border border-[#d8c2b6] space-y-2">
                        <div className="grid grid-cols-12 gap-2 items-center">
                          <div className="col-span-6">
                            <input
                              type="text"
                              placeholder="Tên tiêu chí (vd: Task Achievement)"
                              value={crit.label}
                              onChange={(e) => handleCriteriaChange(idx, "label", e.target.value)}
                              className="w-full p-2 bg-white border border-[#d8c2b6] rounded-lg text-xs font-bold"
                            />
                          </div>

                          <div className="col-span-4 flex items-center space-x-1">
                            <span className="text-[10px] font-bold text-[#52443a]">Trọng số:</span>
                            <input
                              type="number"
                              step="0.05"
                              min="0"
                              max="1"
                              value={crit.weight}
                              onChange={(e) => handleCriteriaChange(idx, "weight", Number(e.target.value))}
                              className="w-20 p-2 bg-white border border-[#d8c2b6] rounded-lg text-xs font-bold text-center"
                            />
                          </div>

                          <div className="col-span-2 text-right">
                            <button
                              type="button"
                              onClick={() => handleRemoveCriteria(idx)}
                              className="p-1.5 text-rose-600 hover:bg-rose-100 rounded-lg transition-all cursor-pointer"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>

                        <div>
                          <input
                            type="text"
                            placeholder="Mô tả chi tiết tiêu chuẩn chấm cho AI Engine..."
                            value={crit.descriptor}
                            onChange={(e) => handleCriteriaChange(idx, "descriptor", e.target.value)}
                            className="w-full p-2 bg-white border border-[#d8c2b6] rounded-lg text-xs text-[#52443a]"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="pt-4 flex space-x-3">
                  <button
                    type="button"
                    onClick={() => setShowModal(false)}
                    className="flex-1 py-3 border border-[#d8c2b6] text-[#52443a] rounded-xl text-xs font-medium hover:bg-[#fff8f5] cursor-pointer"
                  >
                    Hủy
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="flex-1 py-3 bg-[#6d3807] hover:bg-[#8a4f1e] text-white rounded-xl text-xs font-bold shadow flex items-center justify-center space-x-2 disabled:opacity-50 font-headline cursor-pointer"
                  >
                    {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin text-white" /> : <Save className="w-4 h-4 text-[#ffb782]" />}
                    <span>Lưu Bộ Rubric</span>
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
