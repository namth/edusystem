"use client";

import { useState, useEffect } from "react";
import {
  X,
  Loader2,
  Send,
  Lock,
} from "lucide-react";
import type { StudentRowItem } from "./GradingItemTable";
import GradingQuestionItem from "./GradingQuestionItem";

interface DrawerProps {
  isOpen: boolean;
  onClose: () => void;
  kind: "lesson" | "exam";
  classId: string;
  itemId: string;
  studentRow: StudentRowItem | null;
  finalizedAt: string | null;
  onAttemptSaved: () => void;
  onStudentUpdated: () => void;
  showToast: (msg: string, type?: "success" | "error") => void;
}

export default function GradingDrawer({
  isOpen,
  onClose,
  kind,
  classId,
  itemId,
  studentRow,
  finalizedAt,
  onAttemptSaved,
  onStudentUpdated,
  showToast,
}: DrawerProps) {
  const [selectedAttemptId, setSelectedAttemptId] = useState<string | null>(null);
  const [attemptData, setAttemptData] = useState<any | null>(null);
  const [loadingAttempt, setLoadingAttempt] = useState(false);
  const [attemptError, setAttemptError] = useState<string | null>(null);

  // Form states cho câu hỏi AI
  const [scoreMap, setScoreMap] = useState<Record<string, string>>({});
  const [feedbackMap, setFeedbackMap] = useState<Record<string, string>>({});
  const [generalFeedback, setGeneralFeedback] = useState<string>("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [isChoosingAttempt, setIsChoosingAttempt] = useState(false);

  useEffect(() => {
    if (studentRow && studentRow.attempts.length > 0) {
      const initId = studentRow.counted_attempt_id || studentRow.attempts[0]?.id;
      setSelectedAttemptId(initId);
    } else {
      setSelectedAttemptId(null);
      setAttemptData(null);
    }
  }, [studentRow]);

  useEffect(() => {
    if (!isOpen || !selectedAttemptId) return;

    let mounted = true;
    const fetchAttempt = async () => {
      setLoadingAttempt(true);
      setAttemptError(null);
      try {
        const attemptId = selectedAttemptId;
        const res = await fetch(
          `/api/teacher/grading/attempts/${kind}/${attemptId}`
        );
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error || "Không thể tải chi tiết lượt làm bài.");
        }
        const data = await res.json();
        if (!mounted) return;

        setAttemptData(data);
        setGeneralFeedback(data.attempt?.teacher_feedback || "");

        // Khởi tạo điểm và nhận xét giáo viên
        const initScores: Record<string, string> = {};
        const initFeedbacks: Record<string, string> = {};

        for (const q of data.questions || []) {
          const r = q.result;
          if (!r || r.kind !== "AI") continue;

          if (kind === "lesson" && Array.isArray(r.items) && r.items.length > 0) {
            for (const it of r.items) {
              const k = `${q.id}:${it.key ?? ""}`;
              const s = it.teacher_score ?? it.ai_score ?? it.band;
              initScores[k] = s !== undefined && s !== null ? String(s) : "";
              initFeedbacks[k] = it.teacher_feedback || "";
            }
          } else {
            const k = q.id;
            const s = r.teacher_score ?? r.ai_score ?? r.score;
            initScores[k] = s !== undefined && s !== null ? String(s) : "";
            initFeedbacks[k] = r.teacher_feedback || "";
          }
        }

        setScoreMap(initScores);
        setFeedbackMap(initFeedbacks);
        setErrors({});
      } catch (e: any) {
        if (mounted) setAttemptError(e.message || "Lỗi nạp bài làm");
      } finally {
        if (mounted) setLoadingAttempt(false);
      }
    };

    fetchAttempt();
    return () => {
      mounted = false;
    };
  }, [isOpen, selectedAttemptId, kind]);

  if (!isOpen || !studentRow) return null;

  const isLocked = !!attemptData?.locked || !!finalizedAt;

  // Validate một ô điểm [min, max], đúng bước (step)
  const validateScore = (val: string, min: number, max: number, step: number): string | null => {
    if (!val.trim()) return null;
    const num = Number(val);
    if (isNaN(num)) return "Điểm phải là số";
    if (num < min || num > max) {
      return `Điểm phải nằm trong khoảng [${min}, ${max}]`;
    }
    if (step > 0) {
      const k = (num - min) / step;
      if (Math.abs(k - Math.round(k)) > 1e-6) {
        return `Điểm phải đúng bước (step) nhảy ${step}`;
      }
    }
    return null;
  };

  const handleScoreChange = (
    key: string,
    val: string,
    min: number,
    max: number,
    step: number
  ) => {
    setScoreMap((prev) => ({ ...prev, [key]: val }));
    const err = validateScore(val, min, max, step);
    setErrors((prev) => ({ ...prev, [key]: err || "" }));
  };

  const handleFeedbackChange = (key: string, val: string) => {
    setFeedbackMap((prev) => ({ ...prev, [key]: val }));
    const err = val.length > 2000 ? "Nhận xét tối đa 2000 ký tự" : "";
    setErrors((prev) => ({ ...prev, [`fb_${key}`]: err }));
  };

  const handleGeneralFeedbackChange = (val: string) => {
    setGeneralFeedback(val);
    const err = val.length > 2000 ? "Nhận xét chung tối đa 2000 ký tự" : "";
    setErrors((prev) => ({ ...prev, general: err }));
  };

  // Chọn lượt được tính / Bỏ chọn lượt
  const handleToggleChosenAttempt = async (attemptId: string | null) => {
    setIsChoosingAttempt(true);
    try {
      const res = await fetch(
        `/api/teacher/grading/classes/${classId}/items/${kind}/${itemId}/students/${studentRow.student.id}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ chosen_attempt_id: attemptId }),
        }
      );
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Không thể đổi lượt tính điểm.");
      }
      showToast(
        attemptId ? "Đã chọn tính điểm cho lượt này!" : "Đã chuyển về tự chọn lượt cao nhất!",
        "success"
      );
      onStudentUpdated();
    } catch (e: any) {
      showToast(e.message, "error");
    } finally {
      setIsChoosingAttempt(false);
    }
  };

  // Lưu điểm & đánh dấu đã duyệt
  const handleSaveAttempt = async () => {
    if (!selectedAttemptId || isLocked) return;

    // Kiểm tra validate
    const hasAnyError = Object.values(errors).some((e) => !!e);
    if (hasAnyError) {
      showToast("Vui lòng sửa các ô điểm hoặc nhận xét chưa hợp lệ.", "error");
      return;
    }

    const itemsPayload: any[] = [];
    for (const q of attemptData?.questions || []) {
      const r = q.result;
      if (!r || r.kind !== "AI") continue;

      if (kind === "lesson" && Array.isArray(r.items) && r.items.length > 0) {
        for (const it of r.items) {
          const k = `${q.id}:${it.key ?? ""}`;
          const raw = scoreMap[k];
          const tScore = raw !== undefined && raw.trim() !== "" ? Number(raw) : null;
          itemsPayload.push({
            question_id: q.id,
            item_key: it.key,
            teacher_score: tScore,
            teacher_feedback: feedbackMap[k] || undefined,
          });
        }
      } else {
        const k = q.id;
        const raw = scoreMap[k];
        const tScore = raw !== undefined && raw.trim() !== "" ? Number(raw) : null;
        itemsPayload.push({
          question_id: q.id,
          teacher_score: tScore,
          teacher_feedback: feedbackMap[k] || undefined,
        });
      }
    }

    setIsSaving(true);
    try {
      const attemptId = selectedAttemptId;
      const res = await fetch(
        `/api/teacher/grading/attempts/${kind}/${attemptId}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            items: itemsPayload,
            feedback: generalFeedback.trim() || undefined,
          }),
        }
      );

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Lỗi lưu điểm bài thi.");
      }

      showToast("Lưu & đánh dấu đã duyệt bài thành công!", "success");
      onAttemptSaved();
      onStudentUpdated();
    } catch (e: any) {
      showToast(e.message || "Lỗi khi lưu điểm", "error");
    } finally {
      setIsSaving(false);
    }
  };

  const isChosen = studentRow.chosen_attempt_id === selectedAttemptId;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden font-sans">
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-2xs transition-opacity"
        onClick={onClose}
      />

      <div className="fixed inset-y-0 right-0 max-w-2xl w-full bg-white shadow-2xl flex flex-col z-10 animate-in slide-in-from-right duration-200">
        {/* Drawer Header */}
        <div className="p-6 border-b border-line flex justify-between items-start bg-surface-alt/40">
          <div className="space-y-1">
            <div className="text-[10px] font-bold uppercase font-mono tracking-wider text-brand-600">
              Ngăn Chấm Điểm &bull; {kind === "lesson" ? "Bài học" : "Đề thi"}
            </div>
            <h2 className="text-xl font-bold text-ink font-headline">
              {studentRow.student.name}
            </h2>
            <div className="text-xs text-ink-muted font-mono">{studentRow.student.id}</div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-ink-muted hover:text-ink hover:bg-surface-alt cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Attempt Selector List */}
        <div className="p-4 border-b border-line bg-surface-alt/20">
          <div className="text-xs font-bold text-ink-muted mb-2">Danh sách các lượt làm bài:</div>
          <div className="flex flex-wrap gap-2">
            {studentRow.attempts.map((att, idx) => {
              const isCurrent = att.id === selectedAttemptId;
              const isCounted = att.id === studentRow.counted_attempt_id;
              return (
                <button
                  key={att.id}
                  onClick={() => setSelectedAttemptId(att.id)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center space-x-1.5 cursor-pointer ${
                    isCurrent
                      ? "bg-brand-600 text-white shadow-xs"
                      : "bg-white border border-line text-ink hover:bg-surface-alt"
                  }`}
                >
                  <span>Lượt {idx + 1}</span>
                  {isCounted && <span className="text-amber-400 font-bold">★</span>}
                  <span className="font-mono text-[11px] opacity-80">
                    ({att.score10 !== null ? `${att.score10}đ` : "—"})
                  </span>
                </button>
              );
            })}
          </div>

          {selectedAttemptId && (
            <div className="mt-3 flex items-center space-x-2">
              {isChosen ? (
                <button
                  onClick={() => handleToggleChosenAttempt(null)}
                  disabled={isChoosingAttempt || isLocked}
                  className="px-3 py-1 bg-amber-50 border border-amber-300 text-amber-900 rounded-lg text-xs font-bold hover:bg-amber-100 transition-colors disabled:opacity-50 cursor-pointer"
                >
                  Bỏ chọn (Tự lấy điểm cao nhất)
                </button>
              ) : (
                <button
                  onClick={() => handleToggleChosenAttempt(selectedAttemptId)}
                  disabled={isChoosingAttempt || isLocked}
                  className="px-3 py-1 bg-brand-50 border border-brand-300 text-brand-700 rounded-lg text-xs font-bold hover:bg-brand-100 transition-colors disabled:opacity-50 cursor-pointer"
                >
                  Tính lượt này
                </button>
              )}
            </div>
          )}
        </div>

        {/* Content Body: Questions list */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {loadingAttempt ? (
            <div className="py-12 flex flex-col items-center justify-center space-y-3 text-ink-muted">
              <Loader2 className="w-6 h-6 animate-spin text-brand-600" />
              <span className="text-xs">Đang nạp bài làm chi tiết của học sinh...</span>
            </div>
          ) : attemptError ? (
            <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-medium">
              {attemptError}
            </div>
          ) : !attemptData ? (
            <div className="text-center py-12 text-xs text-ink-muted">Chưa chọn lượt làm bài</div>
          ) : (
            <>
              {isLocked && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800 flex items-center space-x-2">
                  <Lock className="w-4 h-4 shrink-0 text-amber-600" />
                  <span>Bài làm này đã bị khoá do bảng điểm đã chốt. Mở chốt để chỉnh sửa.</span>
                </div>
              )}

              {/* Questions */}
              <div className="space-y-6">
                {attemptData.questions?.map((q: any, qIdx: number) => (
                  <GradingQuestionItem
                    key={q.id}
                    question={q}
                    qIndex={qIdx}
                    kind={kind}
                    isLocked={isLocked}
                    scoreMap={scoreMap}
                    feedbackMap={feedbackMap}
                    errors={errors}
                    onScoreChange={handleScoreChange}
                    onFeedbackChange={handleFeedbackChange}
                  />
                ))}
              </div>

              {/* General feedback */}
              <div className="p-4 bg-surface-alt/40 rounded-2xl border border-line space-y-2">
                <label className="block text-xs font-bold text-ink uppercase font-mono">
                  Nhận xét chung cho cả bài nộp:
                </label>
                <textarea
                  rows={3}
                  disabled={isLocked}
                  value={generalFeedback}
                  onChange={(e) => handleGeneralFeedbackChange(e.target.value)}
                  placeholder="Ghi chú tổng quan hoặc lời nhận xét chung cho học sinh (tối đa 2000 ký tự)..."
                  className="w-full p-3 bg-white border border-line rounded-xl text-xs text-ink focus:outline-none"
                />
                {errors.general && (
                  <div className="text-[11px] text-rose-600 font-medium">{errors.general}</div>
                )}
              </div>
            </>
          )}
        </div>

        {/* Drawer Footer Actions */}
        <div className="p-4 border-t border-line flex justify-end space-x-3 bg-white">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 border border-line text-ink-muted rounded-xl text-xs font-bold hover:bg-surface-alt cursor-pointer"
          >
            Đóng
          </button>

          <button
            type="button"
            onClick={handleSaveAttempt}
            disabled={isSaving || isLocked}
            className="px-5 py-2.5 bg-brand-600 hover:bg-brand-700 text-white rounded-xl text-xs font-bold flex items-center space-x-2 shadow-xs transition-colors disabled:opacity-50 cursor-pointer font-headline"
          >
            {isSaving ? (
              <Loader2 className="w-4 h-4 animate-spin text-white" />
            ) : (
              <Send className="w-4 h-4 text-white" />
            )}
            <span>Lưu &amp; đánh dấu đã duyệt</span>
          </button>
        </div>
      </div>
    </div>
  );
}
