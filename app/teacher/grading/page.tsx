"use client";

import { useState, useEffect } from "react";
import TeacherLayout from "@/components/TeacherLayout";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabase";
import { CheckCircle2, Award, Loader2, Sparkles, User, FileText, Mic, AlertTriangle } from "lucide-react";
import { EvaluationResult } from "@/types/scoring";

interface SubmissionRow {
  id: string;
  exam_id: string;
  exam_title?: string;
  student_id: string;
  answers: Record<string, any>;
  score: number;
  final_score: string;
  ai_feedback: string;
  status: string;
  created_at: string;
  ai_evaluation_details: any;
  final_evaluation_details: any;
  teacher_review: any;
}

export default function TeacherGradingPage() {
  const { user } = useAuth();
  const [submissions, setSubmissions] = useState<SubmissionRow[]>([]);
  const [selectedSub, setSelectedSub] = useState<SubmissionRow | null>(null);
  const [overrideScores, setOverrideScores] = useState<Record<string, EvaluationResult>>({});
  const [teacherNote, setTeacherNote] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchSubmissions = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("submissions")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Submissions load error:", error);
        return;
      }

      // Load exam titles
      const examIds = Array.from(new Set((data || []).map((s: any) => s.exam_id).filter(Boolean)));
      let examMap = new Map<string, string>();
      if (examIds.length > 0) {
        const { data: examRows } = await supabase
          .from("exams")
          .select("id, title")
          .in("id", examIds);
        if (examRows) {
          examMap = new Map(examRows.map((e: any) => [e.id, e.title]));
        }
      }

      const formatted: SubmissionRow[] = (data || []).map((row: any) => {
        let aiDetails: any = row.ai_evaluation_details || {};
        if ((!aiDetails || !aiDetails.aiTasks) && row.ai_feedback) {
          try {
            const parsed = typeof row.ai_feedback === "string" ? JSON.parse(row.ai_feedback) : row.ai_feedback;
            if (parsed) {
              const aiTasksObj: Record<string, any> = {};
              if (parsed.writing) {
                aiTasksObj["q_writing"] = {
                  category: "WRITING_ESSAY",
                  prompt: "IELTS Writing Task",
                  studentAnswer: row.answers?.writing || Object.values(row.answers || {})[0] || "(Nội dung bài viết)",
                  evaluation: parsed.writing,
                };
              }
              if (parsed.speaking) {
                let speakingAudioUrl = row.answers?.speaking || "";
                if (!speakingAudioUrl) {
                  for (const [k, v] of Object.entries(row.answers || {})) {
                    if (typeof v === "string" && (v.startsWith("data:audio") || v.startsWith("http"))) {
                      speakingAudioUrl = v;
                      break;
                    }
                  }
                }
                aiTasksObj["q_speaking"] = {
                  category: "SPEAKING_TOPIC_PROMPT",
                  prompt: "IELTS Speaking Topic",
                  studentAnswer: speakingAudioUrl || "(Bản ghi âm bài nói)",
                  evaluation: parsed.speaking,
                };
              }
              if (Object.keys(aiTasksObj).length > 0) {
                aiDetails = { aiTasks: aiTasksObj };
              }
            }
          } catch (e) {}
        }

        return {
          id: row.id,
          exam_id: row.exam_id,
          exam_title: examMap.get(row.exam_id) || `Đề thi #${row.exam_id}`,
          student_id: row.student_id,
          answers: row.answers || {},
          score: Number(row.score || row.ai_score || 0),
          final_score: `${row.ai_score || row.score || 0}/9.0`,
          ai_feedback: typeof row.ai_feedback === "string" ? row.ai_feedback : JSON.stringify(row.ai_feedback || {}),
          status: row.status || "GRADED",
          created_at: row.created_at ? new Date(row.created_at).toLocaleDateString("vi-VN") : "Hôm nay",
          ai_evaluation_details: aiDetails,
          final_evaluation_details: aiDetails,
          teacher_review: row.teacher_review || null,
        };
      });

      setSubmissions(formatted);

      if (formatted.length > 0) {
        selectSubmission(formatted[0]);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const selectSubmission = (sub: SubmissionRow) => {
    setSelectedSub(sub);
    setSuccessMsg(null);

    const initialOverrides: Record<string, EvaluationResult> = {};
    const aiTasks = sub.final_evaluation_details?.aiTasks || sub.ai_evaluation_details?.aiTasks || {};

    Object.keys(aiTasks).forEach((qId) => {
      const existingEval = sub.teacher_review?.overridden_scores?.[qId] || aiTasks[qId]?.evaluation;
      if (existingEval) {
        initialOverrides[qId] = JSON.parse(JSON.stringify(existingEval));
      }
    });

    setOverrideScores(initialOverrides);
    setTeacherNote(sub.teacher_review?.teacher_note || "");
  };

  useEffect(() => {
    fetchSubmissions();
  }, []);

  const handleCriterionScoreChange = (qId: string, criteriaKey: string, val: number) => {
    setOverrideScores((prev) => {
      const current = prev[qId] || {
        rubricId: "custom",
        overallScore: 7.0,
        criteriaScores: {},
        feedback: "",
        errorsDetected: [],
        improvements: [],
      };

      const updatedScores = { ...current.criteriaScores, [criteriaKey]: val };
      const scoreValues = Object.values(updatedScores);
      const avg = scoreValues.length > 0 ? scoreValues.reduce((a, b) => a + b, 0) / scoreValues.length : val;
      const roundedAvg = Math.round(avg * 2) / 2;

      return {
        ...prev,
        [qId]: {
          ...current,
          overallScore: roundedAvg,
          criteriaScores: updatedScores,
        },
      };
    });
  };

  const handleFeedbackChange = (qId: string, text: string) => {
    setOverrideScores((prev) => ({
      ...prev,
      [qId]: {
        ...(prev[qId] || {
          rubricId: "custom",
          overallScore: 7.0,
          criteriaScores: {},
          feedback: "",
          errorsDetected: [],
          improvements: [],
        }),
        feedback: text,
      },
    }));
  };

  const handleGradingSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSub) return;

    setIsSubmitting(true);
    setSuccessMsg(null);

    try {
      // Save overrides for all AI tasks
      const aiTasks = selectedSub.final_evaluation_details?.aiTasks || selectedSub.ai_evaluation_details?.aiTasks || {};
      const qIds = Object.keys(aiTasks);

      for (const qId of qIds) {
        const overridden = overrideScores[qId];
        if (overridden) {
          await fetch("/api/exam/grade-override", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              submissionId: selectedSub.id,
              questionId: qId,
              overriddenScore: overridden,
              teacherNote,
              teacherId: user?.id || "teacher_01",
            }),
          });
        }
      }

      setSuccessMsg("Điểm & Nhận xét Override của Giáo viên đã được lưu thành công!");
      fetchSubmissions();
    } catch (err) {
      console.error("Save override error:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <TeacherLayout>
      <div className="max-w-[1280px] mx-auto space-y-8 font-sans">
        {/* Header */}
        <div className="border-b border-[#d8c2b6]/40 pb-6">
          <h1 className="font-headline text-3xl font-bold text-[#211a16] tracking-tight">
            Human-in-the-Loop AI Grading &amp; Override Portal
          </h1>
          <p className="text-sm text-[#52443a] mt-1">
            Xem xét chi tiết các bài thi tự luận Writing &amp; Speaking được AI chấm. Giáo viên có quyền điều chỉnh điểm từng tiêu chí (Pronunciation, Task Achievement...) và gửi phản hồi tới học sinh.
          </p>
        </div>

        {successMsg && (
          <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 flex items-center space-x-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 animate-bounce" />
            <span className="font-semibold text-sm">{successMsg}</span>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Left: Submissions List */}
          <div className="lg:col-span-5 bg-white p-6 rounded-2xl border border-[#d8c2b6] shadow-sm space-y-4">
            <h2 className="text-base font-bold font-headline text-[#6d3807]">Danh Sách Bài Nộp ({submissions.length})</h2>

            {loading ? (
              <div className="flex items-center space-x-2 font-mono text-xs text-[#52443a]">
                <Loader2 className="w-4 h-4 animate-spin text-[#6d3807]" />
                <span>Đang nạp bài nộp từ Supabase...</span>
              </div>
            ) : submissions.length === 0 ? (
              <p className="text-xs text-[#52443a]">Chưa có bài thi nào được nộp.</p>
            ) : (
              <div className="space-y-3 max-h-[600px] overflow-y-auto pr-1">
                {submissions.map((sub) => (
                  <div
                    key={sub.id}
                    onClick={() => selectSubmission(sub)}
                    className={`p-4 rounded-xl border transition-all cursor-pointer ${
                      selectedSub?.id === sub.id
                        ? "border-2 border-[#8a4f1e] bg-[#ffdbcc]/30 shadow-sm"
                        : "border-[#d8c2b6] bg-white hover:bg-[#fff8f5]"
                    }`}
                  >
                    <div className="flex justify-between items-start mb-2">
                      <div className="text-xs font-bold text-[#211a16] font-headline">
                        {sub.exam_title}
                      </div>
                      <span className={`px-2 py-0.5 rounded text-[9px] font-mono font-bold ${
                        sub.status === "TEACHER_REVIEWED"
                          ? "bg-emerald-100 text-emerald-800"
                          : sub.status === "AI_GRADING_FAILED"
                          ? "bg-rose-100 text-rose-800"
                          : sub.status === "AI_GRADING_IN_PROGRESS"
                          ? "bg-blue-100 text-blue-800"
                          : "bg-amber-100 text-amber-800"
                      }`}>
                        {sub.status === "TEACHER_REVIEWED"
                          ? "TEACHER REVIEWED"
                          : sub.status === "AI_GRADING_FAILED"
                          ? "GRADING FAILED"
                          : sub.status === "AI_GRADING_IN_PROGRESS"
                          ? "GRADING IN PROGRESS"
                          : "AI GRADED"}
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-[10px] font-mono text-[#52443a]">
                      <span>Mã nộp: {sub.id}</span>
                      <span>Trắc nghiệm: {sub.final_score}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Right: Submission Details & Override Panel */}
          <div className="lg:col-span-7 bg-white p-6 rounded-2xl border border-[#d8c2b6] shadow-sm space-y-6">
            {!selectedSub ? (
              <div className="flex flex-col items-center justify-center p-12 text-center border border-dashed border-[#d8c2b6] rounded-xl bg-[#fff8f5]">
                <Sparkles className="w-10 h-10 text-[#d8c2b6] mb-2" />
                <p className="text-xs text-[#52443a]">Chọn một bài thi ở danh sách bên trái để mở bộ công cụ review.</p>
              </div>
            ) : (
              <form onSubmit={handleGradingSubmit} className="space-y-6">
                <div>
                  <div className="flex items-center justify-between">
                    <h2 className="text-lg font-bold font-headline text-[#211a16]">{selectedSub.exam_title}</h2>
                    <span className="text-xs font-mono font-bold text-[#6d3807] bg-[#fff1ea] px-3 py-1 rounded-full border border-[#d8c2b6]">
                      ID: {selectedSub.id}
                    </span>
                  </div>
                  <p className="text-xs text-[#52443a] mt-1 font-mono">Học viên ID: {selectedSub.student_id} &bull; Ngày nộp: {selectedSub.created_at}</p>
                </div>

                {/* Objective Score Summary */}
                <div className="p-4 bg-[#fff8f5] rounded-xl border border-[#d8c2b6] flex items-center justify-between text-xs">
                  <div>
                    <span className="font-bold text-[#6d3807] block">Điểm Trắc Nghiệm &amp; Điền Từ Auto-Graded:</span>
                    <span className="text-sm font-extrabold text-emerald-700">{selectedSub.final_score} câu đúng</span>
                  </div>
                  <span className="px-3 py-1 bg-white border border-[#d8c2b6] rounded-lg font-mono font-bold text-[#52443a]">
                    Status: {selectedSub.status}
                  </span>
                </div>

                {/* AI Tasks Review & Criteria Override */}
                {(() => {
                  const aiTasks = selectedSub.final_evaluation_details?.aiTasks || selectedSub.ai_evaluation_details?.aiTasks || {};
                  const qIds = Object.keys(aiTasks);

                  if (qIds.length === 0) {
                    return (
                      <div className="p-4 bg-amber-50 rounded-xl border border-amber-200 text-xs text-amber-900 flex items-center space-x-2">
                        <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0" />
                        <span>Bài nộp này không chứa câu hỏi tự luận Writing / Speaking cần chấm AI.</span>
                      </div>
                    );
                  }

                  return (
                    <div className="space-y-6">
                      <h3 className="text-xs font-mono font-bold uppercase text-[#6d3807] border-b border-[#d8c2b6] pb-2">
                        Chi Tiết Chấm Điểm AI &amp; Công Cụ Override Tiêu Chí:
                      </h3>

                      {qIds.map((qId, idx) => {
                        const task = aiTasks[qId];
                        const category = task.category || "AI Task";
                        const isSpeaking = category.startsWith("SPEAKING");
                        const studentAns = selectedSub.answers[qId] || task.studentAnswer;

                        const currentEval: EvaluationResult = overrideScores[qId] || task.evaluation || {
                          rubricId: "default",
                          overallScore: 7.0,
                          criteriaScores: {},
                          feedback: "",
                          errorsDetected: [],
                          improvements: [],
                        };

                        const criteriaKeys = Object.keys(currentEval.criteriaScores || {});

                        return (
                          <div key={qId} className="p-5 bg-white rounded-2xl border-2 border-[#ffb782] space-y-4 shadow-2xs">
                            {/* Question Header */}
                            <div className="flex items-center justify-between border-b border-[#d8c2b6]/60 pb-2">
                              <div className="flex items-center space-x-2">
                                <span className="px-2.5 py-1 bg-[#6d3807] text-white text-xs font-bold rounded-lg">
                                  {isSpeaking ? "Speaking Task" : "Writing Task"}
                                </span>
                                <span className="text-xs font-bold text-[#211a16]">{category}</span>
                              </div>
                              <span className="text-xs font-extrabold text-[#6d3807] bg-[#fff1ea] px-3 py-1 rounded-full border border-[#d8c2b6]">
                                Điểm Hiện Tại: Band {currentEval.overallScore || 7.0}
                              </span>
                            </div>

                            {/* Prompt */}
                            <p className="text-xs font-bold text-[#211a16] leading-relaxed">
                              Đề bài: {task.prompt || "Nội dung câu hỏi..."}
                            </p>

                            {/* Student Answer */}
                            <div className="p-3.5 bg-[#fff8f5] rounded-xl border border-[#d8c2b6] space-y-2">
                              <span className="text-[11px] font-bold text-[#6d3807] block uppercase">Bài làm học sinh:</span>
                              {typeof studentAns === "string" && (studentAns.startsWith("http") || studentAns.startsWith("data:audio")) ? (
                                <div className="space-y-1">
                                  <div className="flex items-center space-x-2 text-xs font-bold text-[#52443a]">
                                    <Mic className="w-4 h-4 text-[#6d3807]" />
                                    <span>Bản ghi âm bài nói:</span>
                                  </div>
                                  <audio controls src={studentAns} className="w-full h-8" />
                                </div>
                              ) : (
                                <p className="text-xs text-[#211a16] font-medium leading-relaxed whitespace-pre-wrap">
                                  {studentAns || "(Không có bài làm)"}
                                </p>
                              )}
                            </div>

                            {/* Criteria Scores Override Sliders / Inputs */}
                            <div className="space-y-3">
                              <span className="text-xs font-bold text-[#6d3807] block uppercase">
                                Chỉnh Sửa Điểm Tiêu Chí (Teacher Override):
                              </span>

                              <div className="grid grid-cols-2 gap-3">
                                {criteriaKeys.map((cKey) => {
                                  const cScore = currentEval.criteriaScores[cKey] || 7.0;
                                  const labelNames: Record<string, string> = {
                                    pronunciation: "Phát Âm (Pronunciation)",
                                    fluency_coherence: "Trôi Chảy & Mạch Lạc",
                                    lexical_resource: "Vốn Từ Vựng",
                                    grammatical_range: "Ngữ Pháp & Độ Chính Xác",
                                    task_achievement: "Task Achievement",
                                    coherence_cohesion: "Coherence & Cohesion",
                                    vocabulary: "Từ Vựng",
                                    grammar: "Ngữ Pháp",
                                  };
                                  const displayLabel = labelNames[cKey] || cKey;

                                  return (
                                    <div key={cKey} className="p-3 bg-[#fff8f5] rounded-xl border border-[#d8c2b6] space-y-1">
                                      <div className="flex justify-between items-center text-xs">
                                        <span className="font-bold text-[#211a16]">{displayLabel}</span>
                                        <span className="font-extrabold text-[#6d3807] text-sm">{cScore}</span>
                                      </div>
                                      <input
                                        type="range"
                                        min={0}
                                        max={9}
                                        step={0.5}
                                        value={cScore}
                                        onChange={(e) => handleCriterionScoreChange(qId, cKey, Number(e.target.value))}
                                        className="w-full accent-[#6d3807] cursor-pointer"
                                      />
                                    </div>
                                  );
                                })}
                              </div>
                            </div>

                            {/* Teacher Feedback Textarea for this Task */}
                            <div className="space-y-1">
                              <label className="block text-xs font-bold text-[#6d3807] uppercase">
                                Nhận xét chi tiết của Giáo viên cho câu hỏi này:
                              </label>
                              <textarea
                                rows={3}
                                value={currentEval.feedback || ""}
                                onChange={(e) => handleFeedbackChange(qId, e.target.value)}
                                className="w-full p-3 bg-white border border-[#d8c2b6] rounded-xl text-xs leading-relaxed focus:outline-none focus:border-[#6d3807]"
                                placeholder="Nhập nhận xét chuyên môn của bạn..."
                              />
                            </div>
                          </div>
                        );
                      })}

                      {/* General Teacher Note */}
                      <div className="space-y-1">
                        <label className="block text-xs font-mono font-bold uppercase text-[#211a16]">
                          Ghi chú chung của Giáo viên (Hiển thị ở đầu bài nộp):
                        </label>
                        <textarea
                          rows={2}
                          value={teacherNote}
                          onChange={(e) => setTeacherNote(e.target.value)}
                          className="w-full p-3 bg-[#fff8f5] border border-[#d8c2b6] rounded-xl text-xs leading-relaxed focus:outline-none focus:border-[#6d3807]"
                          placeholder="Ví dụ: Bài nói có tiến bộ tốt về ngữ điệu, cần rèn luyện thêm phát âm đuôi..."
                        />
                      </div>

                      <button
                        type="submit"
                        disabled={isSubmitting}
                        className="w-full py-3.5 bg-[#6d3807] hover:bg-[#8a4f1e] text-white rounded-xl font-mono text-xs font-bold transition-all shadow-md flex items-center justify-center space-x-2 font-headline disabled:opacity-50 cursor-pointer"
                      >
                        {isSubmitting ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin text-white" />
                            <span>Đang lưu Override lên database...</span>
                          </>
                        ) : (
                          <span>💾 Lưu Phê Duyệt &amp; Override Điểm Giáo Viên &rarr;</span>
                        )}
                      </button>
                    </div>
                  );
                })()}
              </form>
            )}
          </div>
        </div>
      </div>
    </TeacherLayout>
  );
}
