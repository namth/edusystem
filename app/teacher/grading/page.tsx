"use client";

import { useState, useEffect } from "react";
import TeacherLayout from "@/components/TeacherLayout";
import { useAuth } from "@/context/AuthContext";
import {
  CheckCircle2,
  AlertCircle,
  Loader2,
  Sparkles,
  User,
  FileText,
  Award,
  Filter,
  Save,
} from "lucide-react";

interface SubmissionRow {
  id: string;
  exam_id: string;
  exam_title: string | null;
  student_id: string;
  student_name: string | null;
  status: string;
  class_ref: string | null;
  section_scores: Record<string, any>;
  total_score: number | null;
  passed: boolean | null;
  is_late: boolean;
  submitted_at: string | null;
  created_at: string;
}

export default function TeacherGradingPage() {
  const { user } = useAuth();
  const [submissions, setSubmissions] = useState<SubmissionRow[]>([]);
  const [selectedSub, setSelectedSub] = useState<SubmissionRow | null>(null);

  // Status filter: "" (all) | "NEEDS_REVIEW" | "GRADING" | "GRADED"
  const [statusFilter, setStatusFilter] = useState<string>("");

  // Grade override inputs per skill
  const [skillScores, setSkillScores] = useState<Record<string, string>>({});
  const [teacherFeedback, setTeacherFeedback] = useState("");

  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const fetchSubmissions = async (filter = statusFilter) => {
    try {
      setLoading(true);
      const query = filter ? `?status=${encodeURIComponent(filter)}` : "";
      const res = await fetch(`/api/teacher/submissions${query}`);
      if (res.ok) {
        const data = await res.json();
        const list: SubmissionRow[] = data.submissions || [];
        setSubmissions(list);

        // Keep or select first submission
        if (list.length > 0) {
          const currentStillExists = selectedSub
            ? list.find((s) => s.id === selectedSub.id)
            : null;
          selectSubmission(currentStillExists || list[0]);
        } else {
          setSelectedSub(null);
        }
      }
    } catch (e) {
      console.error("Failed to load submissions:", e);
    } finally {
      setLoading(false);
    }
  };

  const selectSubmission = (sub: SubmissionRow) => {
    setSelectedSub(sub);
    setSuccessMsg(null);
    setErrorMsg(null);

    const scoresObj = sub.section_scores || {};
    const existingSkills = Object.keys(scoresObj);
    const defaultSkills = ["Writing", "Speaking"];
    const allSkills = Array.from(new Set([...defaultSkills, ...existingSkills]));

    const initialMap: Record<string, string> = {};
    for (const skill of allSkills) {
      const entry = scoresObj[skill];
      const val = typeof entry === "number" ? entry : entry?.score;
      initialMap[skill] = val !== undefined && val !== null ? String(val) : "";
    }

    setSkillScores(initialMap);
    setTeacherFeedback("");
  };

  useEffect(() => {
    fetchSubmissions(statusFilter);
  }, [statusFilter]);

  const handleScoreChange = (skill: string, val: string) => {
    setSkillScores((prev) => ({
      ...prev,
      [skill]: val,
    }));
  };

  const handleGradingSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSub) return;

    setIsSubmitting(true);
    setSuccessMsg(null);
    setErrorMsg(null);

    try {
      const scoresToSubmit: Record<string, number> = {};
      for (const [skill, val] of Object.entries(skillScores)) {
        if (val.trim() !== "") {
          const num = Number(val);
          if (isNaN(num)) {
            setErrorMsg(`Điểm phần ${skill} phải là số hợp lệ.`);
            setIsSubmitting(false);
            return;
          }
          scoresToSubmit[skill] = num;
        }
      }

      if (Object.keys(scoresToSubmit).length === 0) {
        setErrorMsg("Vui lòng nhập điểm cho ít nhất một kỹ năng.");
        setIsSubmitting(false);
        return;
      }

      const res = await fetch("/api/exam/grade-override", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          submissionId: selectedSub.id,
          section_scores: scoresToSubmit,
          feedback: teacherFeedback.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        setErrorMsg(data.error || "Lỗi khi lưu điểm bài thi.");
      } else {
        setSuccessMsg("Cập nhật điểm và nhận xét thành công!");
        fetchSubmissions(statusFilter);
      }
    } catch (err: any) {
      setErrorMsg(err.message || "Lỗi kết nối khi gọi API chấm điểm.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const allRelevantSkills = Array.from(
    new Set(["Writing", "Speaking", ...Object.keys(selectedSub?.section_scores || {})])
  );

  return (
    <TeacherLayout>
      <div className="max-w-[1280px] mx-auto space-y-8 font-sans">
        {/* Header */}
        <div className="border-b border-line/40 pb-6">
          <h1 className="font-headline text-3xl font-bold text-ink tracking-tight">
            Human-in-the-Loop AI Grading &amp; Override Portal
          </h1>
          <p className="text-sm text-ink-muted mt-1">
            Xem xét chi tiết các bài thi tự luận Writing &amp; Speaking được AI chấm. Giáo viên có quyền điều chỉnh điểm từng kỹ năng và gửi phản hồi tới học sinh.
          </p>
        </div>

        {/* Filter Bar */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-bold text-ink-muted uppercase mr-2 flex items-center space-x-1">
            <Filter className="w-3.5 h-3.5 text-brand-600" />
            <span>Trạng thái:</span>
          </span>
          {[
            { label: "Tất cả", value: "" },
            { label: "Chờ chấm", value: "NEEDS_REVIEW" },
            { label: "Đang chấm AI", value: "GRADING" },
            { label: "Đã chấm", value: "GRADED" },
          ].map((tab) => (
            <button
              key={tab.value}
              type="button"
              onClick={() => setStatusFilter(tab.value)}
              className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer ${
                statusFilter === tab.value
                  ? "bg-brand-600 text-white shadow-sm"
                  : "bg-white text-ink-muted border border-line hover:bg-surface-alt"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {successMsg && (
          <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 flex items-center space-x-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            <span className="font-semibold text-xs leading-relaxed">{successMsg}</span>
          </div>
        )}

        {errorMsg && (
          <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 flex items-center space-x-2">
            <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
            <span className="font-semibold text-xs leading-relaxed">{errorMsg}</span>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Left: Submissions List */}
          <div className="lg:col-span-5 bg-white p-6 rounded-2xl border border-line shadow-sm space-y-4">
            <h2 className="text-base font-bold font-headline text-brand-600">
              Danh Sách Bài Nộp ({submissions.length})
            </h2>

            {loading ? (
              <div className="flex items-center space-x-2 text-xs text-ink-muted">
                <Loader2 className="w-4 h-4 animate-spin text-brand-600" />
                <span>Đang tải danh sách bài nộp...</span>
              </div>
            ) : submissions.length === 0 ? (
              <p className="text-xs text-ink-muted">Chưa có bài thi nào phù hợp với bộ lọc.</p>
            ) : (
              <div className="space-y-3 max-h-[600px] overflow-y-auto pr-1">
                {submissions.map((sub) => (
                  <div
                    key={sub.id}
                    onClick={() => selectSubmission(sub)}
                    className={`p-4 rounded-xl border transition-all cursor-pointer ${
                      selectedSub?.id === sub.id
                        ? "border-2 border-brand-700 bg-accent-100/30 shadow-sm"
                        : "border-line bg-white hover:bg-surface-alt"
                    }`}
                  >
                    <div className="flex justify-between items-start mb-2">
                      <div className="text-xs font-bold text-ink font-headline line-clamp-1">
                        {sub.exam_title || `Đề thi #${sub.exam_id}`}
                      </div>
                      <span
                        className={`px-2 py-0.5 rounded text-[9px] font-mono font-bold shrink-0 ${
                          sub.status === "GRADED"
                            ? "bg-emerald-100 text-emerald-800"
                            : sub.status === "NEEDS_REVIEW"
                            ? "bg-amber-100 text-amber-800"
                            : sub.status === "GRADING"
                            ? "bg-blue-100 text-blue-800"
                            : "bg-stone-100 text-stone-800"
                        }`}
                      >
                        {sub.status === "NEEDS_REVIEW"
                          ? "Chờ chấm"
                          : sub.status === "GRADING"
                          ? "Đang chấm AI"
                          : sub.status === "GRADED"
                          ? "Đã chấm"
                          : sub.status}
                      </span>
                    </div>

                    <div className="text-[11px] text-ink-muted mb-1">
                      Học sinh: <strong className="text-ink">{sub.student_name || sub.student_id}</strong>
                    </div>

                    <div className="flex justify-between items-center text-[10px] text-ink-subtle">
                      <span>Mã: {sub.id}</span>
                      <span>
                        {sub.total_score !== null
                          ? `Điểm: ${sub.total_score}`
                          : "Chưa có điểm"}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Right: Submission Details & Override Panel */}
          <div className="lg:col-span-7 bg-white p-6 rounded-2xl border border-line shadow-sm space-y-6">
            {!selectedSub ? (
              <div className="flex flex-col items-center justify-center p-12 text-center border border-dashed border-line rounded-xl bg-surface-alt">
                <Sparkles className="w-10 h-10 text-line mb-2" />
                <p className="text-xs text-ink-muted">
                  Chọn một bài thi ở danh sách bên trái để mở bảng chấm và điều chỉnh điểm.
                </p>
              </div>
            ) : (
              <form onSubmit={handleGradingSubmit} className="space-y-6">
                <div>
                  <div className="flex items-center justify-between">
                    <h2 className="text-lg font-bold font-headline text-ink">
                      {selectedSub.exam_title || `Đề thi #${selectedSub.exam_id}`}
                    </h2>
                    <span className="text-xs font-mono font-bold text-brand-600 bg-brand-50 px-3 py-1 rounded-full border border-line">
                      ID: {selectedSub.id}
                    </span>
                  </div>
                  <p className="text-xs text-ink-muted mt-1">
                    Học sinh: <strong className="text-ink">{selectedSub.student_name || selectedSub.student_id}</strong> &bull; Trạng thái: {selectedSub.status}
                    {selectedSub.total_score !== null && ` &bull; Tổng điểm: ${selectedSub.total_score}`}
                  </p>
                </div>

                {/* Section Scores Display & Edit */}
                <div className="space-y-4">
                  <h3 className="text-xs font-bold uppercase text-brand-600 border-b border-line pb-2 flex items-center space-x-2">
                    <Award className="w-4 h-4 text-brand-600" />
                    <span>Điểm Từng Kỹ Năng (Section Scores &amp; Teacher Override):</span>
                  </h3>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {allRelevantSkills.map((skill) => {
                      const entry = selectedSub.section_scores?.[skill];
                      const currentScore =
                        typeof entry === "number" ? entry : entry?.score;
                      const hasEarned =
                        typeof entry === "object" && entry?.earned !== undefined;

                      return (
                        <div
                          key={skill}
                          className="p-4 bg-surface-alt rounded-xl border border-line space-y-2"
                        >
                          <div className="flex justify-between items-center text-xs font-bold text-ink">
                            <span>{skill}</span>
                            <span className="text-brand-600 text-[11px]">
                              {currentScore !== undefined
                                ? `Hiện tại: ${currentScore}`
                                : "Chưa chấm"}
                              {hasEarned && ` (${entry.earned}/${entry.max})`}
                            </span>
                          </div>

                          <div>
                            <label className="block text-[11px] text-ink-muted mb-1">
                              Điểm giáo viên chấm:
                            </label>
                            <input
                              type="number"
                              step="0.25"
                              min="0"
                              max="100"
                              value={skillScores[skill] || ""}
                              onChange={(e) => handleScoreChange(skill, e.target.value)}
                              placeholder={`Nhập điểm ${skill}...`}
                              className="w-full px-3 py-2 bg-white border border-line rounded-lg text-xs focus:outline-none focus:border-brand-600"
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Feedback textarea */}
                <div className="space-y-1">
                  <label className="block text-xs font-bold uppercase text-ink">
                    Nhận xét của Giáo viên (Feedback gửi học sinh):
                  </label>
                  <textarea
                    rows={3}
                    value={teacherFeedback}
                    onChange={(e) => setTeacherFeedback(e.target.value)}
                    className="w-full p-3 bg-surface-alt border border-line rounded-xl text-xs leading-relaxed focus:outline-none focus:border-brand-600"
                    placeholder="Nhập nhận xét chuyên môn, hướng dẫn cải thiện cho bài thi..."
                  />
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full py-3.5 bg-brand-600 hover:bg-brand-700 text-white rounded-xl text-xs font-bold transition-all shadow-md flex items-center justify-center space-x-2 disabled:opacity-50 cursor-pointer"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin text-white" />
                      <span>Đang lưu điểm bài nộp...</span>
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4 text-white" />
                      <span>Lưu Phê Duyệt &amp; Cập Nhật Điểm Giáo Viên</span>
                    </>
                  )}
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    </TeacherLayout>
  );
}
