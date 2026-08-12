"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import {
  ArrowLeft,
  CheckCircle2,
  XCircle,
  Sparkles,
  Volume2,
  FileText,
  Mic,
  Award,
  BookOpen,
  Loader2,
  UserCheck,
  AlertCircle,
} from "lucide-react";
import { EvaluationResult } from "@/types/scoring";

export default function ExamSubmissionReviewPage() {
  const params = useParams();
  const router = useRouter();
  const submissionId = params.submissionId as string;

  const [submission, setSubmission] = useState<any>(null);
  const [exam, setExam] = useState<any>(null);
  const [questions, setQuestions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let timerId: any = null;

    const fetchReviewData = async () => {
      try {
        // 1. Load Submission
        let subRecord = null;
        const { data: subData, error: subError } = await supabase
          .from("submissions")
          .select("*")
          .eq("id", submissionId)
          .maybeSingle();

        if (subError) {
          console.warn("Supabase load submission warning:", subError.message);
        }

        if (subData) {
          subRecord = subData;
        } else {
          // Fallback: Fetch latest submission via /api/submissions API
          try {
            const apiRes = await fetch(`/api/submissions?student_id=student_01`);
            const apiJson = await apiRes.json();
            if (apiJson.success && Array.isArray(apiJson.data) && apiJson.data.length > 0) {
              subRecord = apiJson.data.find((s: any) => s.id === submissionId) || apiJson.data[0];
            }
          } catch (e) {
            console.warn("API fallback fetch warning:", e);
          }
        }

        if (!subRecord) {
          setLoading(false);
          return;
        }

        setSubmission(subRecord);

        // 2. Load Exam
        const { data: examData } = await supabase
          .from("exams")
          .select("*")
          .eq("id", subData.exam_id)
          .maybeSingle();

        setExam(examData);

        // 3. Load Questions
        let questionIds: string[] = [];
        if (examData && Array.isArray(examData.question_ids)) {
          questionIds = examData.question_ids;
        }

        let qData: any[] = [];
        if (questionIds.length > 0) {
          const { data } = await supabase
            .from("questions")
            .select("*")
            .in("id", questionIds);
          if (data) qData = data;
        } else {
          const { data } = await supabase.from("questions").select("*");
          if (data) qData = data;
        }

        setQuestions(qData);

        // If still pending or in progress, poll again in 3 seconds
        if (subData.status === "PENDING_GRADING" || subData.status === "AI_GRADING_IN_PROGRESS") {
          timerId = setTimeout(fetchReviewData, 3000);
        }
      } catch (err) {
        console.error("Error loading review:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchReviewData();

    return () => {
      if (timerId) clearTimeout(timerId);
    };
  }, [submissionId]);

  if (loading) {
    return (
      <div className="h-screen flex flex-col items-center justify-center bg-[#fff8f5]">
        <Loader2 className="w-8 h-8 text-[#6d3807] animate-spin mb-2" />
        <p className="font-mono text-xs text-[#52443a]">Đang nạp chi tiết bài nộp {submissionId}...</p>
      </div>
    );
  }

  if (!submission) {
    return (
      <div className="h-screen flex flex-col items-center justify-center bg-[#fff8f5] space-y-4">
        <p className="text-sm text-[#52443a]">Không tìm thấy thông tin bài nộp này.</p>
        <Link href="/student/dashboard" className="px-4 py-2 bg-[#6d3807] text-white rounded-xl text-xs font-bold">
          Quay lại Dashboard
        </Link>
      </div>
    );
  }

  const studentAnswers = submission.answers || {};
  const finalDetails = submission.final_evaluation_details || submission.ai_evaluation_details || {};
  const nonAiDetails = finalDetails.nonAiDetails || {};
  const aiTasks = finalDetails.aiTasks || {};
  const teacherReview = submission.teacher_review || null;

  const rawScore = submission.final_score || finalDetails.rawScore || `${finalDetails.correctNonAiCount || 0}/${finalDetails.totalNonAiCount || 0}`;

  const isTeacherReviewed = submission.status === "TEACHER_REVIEWED" || !!teacherReview;
  const isPending = submission.status === "PENDING_GRADING" || submission.status === "AI_GRADING_IN_PROGRESS";
  const isFailed = submission.status === "AI_GRADING_FAILED";

  // Helper to resolve score for a given question (Teacher override prioritized)
  const resolveEvaluation = (qId: string): EvaluationResult | null => {
    if (teacherReview?.overridden_scores?.[qId]) {
      return { ...teacherReview.overridden_scores[qId], _source: "teacher" };
    }
    if (aiTasks[qId]?.evaluation) {
      return { ...aiTasks[qId].evaluation, _source: "ai" };
    }
    return null;
  };

  return (
    <div className="min-h-screen bg-[#fff8f5] text-[#211a16] font-sans">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-[#fff8f5] border-b border-[#d8c2b6] flex justify-between items-center px-6 h-16 shadow-2xs">
        <div className="flex items-center gap-3">
          <Link href="/student/dashboard" className="p-2 text-[#52443a] hover:text-[#6d3807] transition-all rounded-lg hover:bg-white">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="font-headline text-base font-bold text-[#211a16]">{exam?.title || "Xem Chi Tiết Bài Thi"}</h1>
            <p className="text-[11px] text-[#857469]">Mã bài nộp: {submissionId}</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {isTeacherReviewed ? (
            <span className="px-3 py-1 bg-emerald-100 text-emerald-800 text-xs font-bold rounded-lg border border-emerald-300 flex items-center gap-1.5">
              <UserCheck className="w-4 h-4 text-emerald-700" />
              <span>Đã Được Giáo Viên Review</span>
            </span>
          ) : isPending ? (
            <span className="px-3 py-1 bg-blue-100 text-blue-800 text-xs font-bold rounded-lg border border-blue-300 flex items-center gap-1.5 animate-pulse">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              <span>Đang Chấm AI...</span>
            </span>
          ) : isFailed ? (
            <span className="px-3 py-1 bg-rose-100 text-rose-800 text-xs font-bold rounded-lg border border-rose-300 flex items-center gap-1.5">
              <AlertCircle className="w-3.5 h-3.5 text-rose-700" />
              <span>Cần Chấm Lại</span>
            </span>
          ) : (
            <span className="px-3 py-1 bg-amber-100 text-amber-900 text-xs font-bold rounded-lg border border-amber-300">
              Đã Chấm Điểm AI
            </span>
          )}
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-4xl mx-auto p-6 space-y-6">
        {/* Banner Alert for Status */}
        {isPending && (
          <div className="p-4 bg-blue-50 border border-blue-200 rounded-2xl text-blue-900 text-xs flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Loader2 className="w-4 h-4 animate-spin text-blue-700 shrink-0" />
              <span>Hệ thống AI đang tiến hành phân tích bài thi của bạn. Trang sẽ tự động cập nhật kết quả khi hoàn tất...</span>
            </div>
          </div>
        )}

        {/* Teacher Note Banner */}
        {teacherReview?.teacher_note && (
          <div className="p-5 bg-gradient-to-r from-emerald-50 to-[#fff8f5] rounded-3xl border-2 border-emerald-300 shadow-xs space-y-1">
            <div className="flex items-center space-x-2 text-emerald-800 font-bold text-xs uppercase tracking-wide">
              <UserCheck className="w-4 h-4 text-emerald-700" />
              <span>Ghi Chú Từ Giáo Viên:</span>
            </div>
            <p className="text-xs text-[#211a16] leading-relaxed font-medium bg-white p-3 rounded-xl border border-emerald-200">
              "{teacherReview.teacher_note}"
            </p>
          </div>
        )}

        {/* 4-Skill Score Breakdown Banner */}
        <div className="p-6 bg-white rounded-3xl border border-[#d8c2b6] shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-[#d8c2b6]/60 pb-3">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-[#fff1ea] text-[#6d3807] rounded-full border border-[#d8c2b6] text-xs font-bold">
              <Award className="w-4 h-4 text-[#6d3807]" />
              <span>Bảng Tổng Hợp Kết Quả Thi</span>
            </div>
            <span className="text-xs text-[#857469] font-mono">Tổng câu hỏi: {questions.length}</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Objective Score (Reading / Listening) */}
            <div className="p-4 bg-[#fff8f5] rounded-2xl border border-[#d8c2b6] space-y-1">
              <span className="text-[11px] font-bold text-[#857469] uppercase block">Reading &amp; Listening</span>
              <div className="text-xl font-extrabold text-[#6d3807]">
                {rawScore} <span className="text-xs font-normal text-[#52443a]">câu đúng</span>
              </div>
              <p className="text-[10px] text-[#857469]">Trắc nghiệm, Điền từ, Nối cặp, Sắp xếp</p>
            </div>

            {/* Writing Band Score */}
            {(() => {
              const writingQ = questions.find((q) => q.skill === "Writing" || q.category?.startsWith("WRITING"));
              const writingEval = writingQ ? resolveEvaluation(writingQ.id) : null;

              return (
                <div className="p-4 bg-[#fff8f5] rounded-2xl border border-[#d8c2b6] space-y-1">
                  <span className="text-[11px] font-bold text-[#857469] uppercase block">Writing Task</span>
                  <div className="text-xl font-extrabold text-purple-900">
                    {writingEval ? `Band ${writingEval.overallScore}` : "Chờ Chấm"}
                  </div>
                  <p className="text-[10px] text-[#857469]">
                    {writingEval?._source === "teacher" ? "✏️ Đã được Giáo viên phê duyệt" : "Chấm theo tiêu chí IELTS Writing"}
                  </p>
                </div>
              );
            })()}

            {/* Speaking Band Score */}
            {(() => {
              const speakingQ = questions.find((q) => q.skill === "Speaking" || q.category?.startsWith("SPEAKING"));
              const speakingEval = speakingQ ? resolveEvaluation(speakingQ.id) : null;

              return (
                <div className="p-4 bg-[#fff8f5] rounded-2xl border border-[#d8c2b6] space-y-1">
                  <span className="text-[11px] font-bold text-[#857469] uppercase block">Speaking Task</span>
                  <div className="text-xl font-extrabold text-emerald-900">
                    {speakingEval ? `Band ${speakingEval.overallScore}` : "Chờ Chấm"}
                  </div>
                  <p className="text-[10px] text-[#857469]">
                    {speakingEval?._source === "teacher" ? "✏️ Đã được Giáo viên phê duyệt" : "Multimodal Audio Pronunciation"}
                  </p>
                </div>
              );
            })()}
          </div>
        </div>

        {/* Detailed Questions Review List */}
        <div className="space-y-6">
          <h3 className="text-base font-bold text-[#6d3807] uppercase tracking-wide flex items-center gap-2">
            <BookOpen className="w-5 h-5" />
            <span>Chi Tiết Từng Câu Hỏi &amp; Đánh Giá AI / Giáo Viên:</span>
          </h3>

          {questions.map((q, idx) => {
            const cat = q.category;
            const isAiTask = [
              "WRITING_ESSAY",
              "WRITING_SHORT_ANSWER",
              "WRITING_SENTENCE_REWRITE",
              "SPEAKING_TOPIC_PROMPT",
              "SPEAKING_READ_ALOUD",
            ].includes(cat);

            const evalData = resolveEvaluation(q.id);
            const studentAns = studentAnswers[q.id];

            return (
              <div key={q.id || idx} className="p-6 bg-white rounded-2xl border border-[#d8c2b6] shadow-sm space-y-4">
                {/* Header */}
                <div className="flex items-center justify-between border-b border-[#d8c2b6]/60 pb-3">
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-1 bg-[#6d3807] text-white text-xs font-bold rounded-lg">
                      Câu {idx + 1}
                    </span>
                    <span className="px-2.5 py-1 bg-[#fff1ea] text-[#6d3807] text-xs font-bold rounded-lg border border-[#d8c2b6]">
                      {q.skill} &bull; {cat}
                    </span>
                  </div>

                  {isAiTask ? (
                    evalData?._source === "teacher" ? (
                      <span className="px-3 py-1 bg-emerald-100 text-emerald-800 text-xs font-bold rounded-full border border-emerald-300 flex items-center gap-1">
                        <UserCheck className="w-3.5 h-3.5" />
                        <span>Teacher Override</span>
                      </span>
                    ) : (
                      <span className="px-3 py-1 bg-purple-100 text-purple-800 text-xs font-bold rounded-full border border-purple-300 flex items-center gap-1">
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>Đánh Giá Tiêu Chí AI</span>
                      </span>
                    )
                  ) : (
                    <span className="text-xs font-bold text-[#52443a]">Tự Động So Khớp</span>
                  )}
                </div>

                {/* Question Prompt / Text */}
                {q.prompt && (
                  <p className="font-bold text-[#211a16] text-sm sm:text-base leading-relaxed">{q.prompt}</p>
                )}

                {/* Stimulus Text if available */}
                {q.stimulus_text && (
                  <div className="p-4 bg-[#fff8f5] rounded-xl border border-[#d8c2b6] text-xs leading-relaxed text-[#211a16]">
                    <div dangerouslySetInnerHTML={{ __html: q.stimulus_text }} />
                  </div>
                )}

                {/* NON-AI QUESTIONS REVIEW */}
                {!isAiTask && (
                  <div className="space-y-3 pt-2">
                    {(cat === "READING_MC" || cat === "LISTENING_MC") && q.content?.sub_questions && (
                      <div className="space-y-3">
                        {q.content.sub_questions.map((sub: any, sIdx: number) => {
                          const isSingle = q.content.sub_questions.length === 1;
                          const subKey = isSingle ? q.id : `${q.id}_sub_${sIdx}`;
                          const detail = nonAiDetails[subKey] || {};

                          return (
                            <div key={sIdx} className="p-4 rounded-xl bg-[#fff8f5] border border-[#d8c2b6] space-y-2">
                              {sub.text && <p className="font-bold text-xs text-[#211a16]">Câu {sIdx + 1}: {sub.text}</p>}
                              <div className="flex items-center justify-between text-xs">
                                <div>
                                  <span className="font-medium text-[#52443a]">Đã chọn: </span>
                                  <span className="font-bold text-[#211a16]">{detail.studentChoice || studentAnswers[subKey] || "(Chưa chọn)"}</span>
                                </div>
                                <div>
                                  <span className="font-medium text-[#52443a]">Đáp án đúng: </span>
                                  <span className="font-bold text-emerald-700">{sub.correct_answer || detail.correctAnswer}</span>
                                </div>
                              </div>
                              <div className="pt-1 flex items-center gap-1.5">
                                {detail.isCorrect ? (
                                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold text-xs">
                                    <CheckCircle2 className="w-3.5 h-3.5" /> Đúng (+1đ)
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-rose-100 text-rose-800 font-bold text-xs">
                                    <XCircle className="w-3.5 h-3.5" /> Chưa đúng (0đ)
                                  </span>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {(cat === "READING_FILL_IN" || cat === "LISTENING_FILL_IN" || cat === "WRITING_FREE_TYPING_BLANKS") && (
                      <div className="p-4 rounded-xl bg-[#fff8f5] border border-[#d8c2b6] space-y-2">
                        <span className="text-xs font-bold text-[#6d3807] block">Chi tiết điền chỗ khuyết:</span>
                        <div className="space-y-1.5 text-xs">
                          {Object.keys(nonAiDetails)
                            .filter((k) => k.startsWith(`${q.id}_gap_`))
                            .map((gapKey, gIdx) => {
                              const gDetail = nonAiDetails[gapKey];
                              return (
                                <div key={gapKey} className="flex items-center justify-between p-2 bg-white rounded-lg border border-[#d8c2b6]">
                                  <span>Vị trí {gIdx + 1}: </span>
                                  <span>Học sinh điền: <strong>{gDetail.studentInput || "(Trống)"}</strong> | Đáp án: <strong className="text-emerald-700">{gDetail.correctWord}</strong></span>
                                  {gDetail.isCorrect ? (
                                    <span className="text-emerald-700 font-bold">✅ Đúng (+1đ)</span>
                                  ) : (
                                    <span className="text-rose-600 font-bold">❌ Sai (0đ)</span>
                                  )}
                                </div>
                              );
                            })}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* AI EVALUATED TASKS REVIEW (WRITING & SPEAKING) */}
                {isAiTask && (
                  <div className="space-y-4 pt-2">
                    {/* Student Submission View (Text or Audio Player) */}
                    <div className="p-4 bg-[#fff8f5] rounded-xl border border-[#d8c2b6] space-y-2">
                      <span className="font-bold text-[#6d3807] text-xs block">Bài làm của học sinh:</span>
                      {typeof studentAns === "string" && (studentAns.startsWith("http") || studentAns.startsWith("data:audio")) ? (
                        <div className="space-y-2">
                          <div className="flex items-center gap-2 text-xs font-bold text-[#52443a]">
                            <Mic className="w-4 h-4 text-[#6d3807]" />
                            <span>Bản ghi âm bài nói:</span>
                          </div>
                          <audio controls src={studentAns} className="w-full h-9" />
                        </div>
                      ) : (
                        <p className="text-xs text-[#211a16] font-medium leading-relaxed whitespace-pre-wrap">
                          {studentAns || "(Học sinh không để lại câu trả lời)"}
                        </p>
                      )}
                    </div>

                    {/* Criteria Evaluation Card */}
                    {evalData ? (
                      <div className="p-5 bg-gradient-to-br from-[#fff1ea] to-[#fff8f5] rounded-2xl border-2 border-[#ffb782] space-y-4 shadow-2xs">
                        <div className="flex items-center justify-between border-b border-[#d8c2b6] pb-2">
                          <span className="font-bold text-[#6d3807] flex items-center gap-1.5 text-xs sm:text-sm">
                            <Sparkles className="w-4 h-4 text-[#6d3807]" />
                            <span>
                              {evalData._source === "teacher"
                                ? "Đánh Giá Chi Tiết (Phê Duyệt Bởi Giáo Viên)"
                                : "Đánh Giá Chi Tiết AI (Gemini Multimodal Grader)"}
                            </span>
                          </span>
                          <span className="text-xs font-extrabold text-[#6d3807] bg-white px-3 py-1 rounded-full border border-[#d8c2b6]">
                            Band Score: {evalData.overallScore || 7.0}
                          </span>
                        </div>

                        {/* Criteria Scores Grid */}
                        {evalData.criteriaScores && (
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-center">
                            {Object.entries(evalData.criteriaScores).map(([cKey, scoreVal]) => {
                              const labels: Record<string, string> = {
                                pronunciation: "Phát Âm",
                                fluency_coherence: "Mạch Lạc / Trôi Chảy",
                                lexical_resource: "Từ Vựng",
                                grammatical_range: "Ngữ Pháp",
                                task_achievement: "Task Achievement",
                                coherence_cohesion: "Liên Kết Câu",
                                vocabulary: "Từ Vựng",
                                grammar: "Ngữ Pháp",
                              };
                              return (
                                <div key={cKey} className="p-2.5 bg-white rounded-xl border border-[#d8c2b6]">
                                  <span className="text-[11px] font-bold text-[#857469] block">{labels[cKey] || cKey}</span>
                                  <span className="text-sm font-extrabold text-[#6d3807]">{scoreVal}</span>
                                </div>
                              );
                            })}
                          </div>
                        )}

                        {/* Feedback Text */}
                        {evalData.feedback && (
                          <div className="space-y-1">
                            <span className="text-xs font-bold text-[#6d3807] block">Nhận xét chi tiết:</span>
                            <p className="text-xs text-[#211a16] leading-relaxed bg-white p-3 rounded-xl border border-[#d8c2b6]">
                              {evalData.feedback}
                            </p>
                          </div>
                        )}

                        {/* Errors & Improvements */}
                        {evalData.errorsDetected?.length > 0 && (
                          <div className="space-y-1">
                            <span className="text-xs font-bold text-rose-700 block">Các điểm cần lưu ý / lỗi phát hiện:</span>
                            <ul className="list-disc list-inside text-xs text-rose-900 bg-rose-50 p-3 rounded-xl border border-rose-200 space-y-1">
                              {evalData.errorsDetected.map((errItem: string, eIdx: number) => (
                                <li key={eIdx}>{errItem}</li>
                              ))}
                            </ul>
                          </div>
                        )}

                        {evalData.improvements?.length > 0 && (
                          <div className="space-y-1">
                            <span className="text-xs font-bold text-emerald-800 block">Khuyến nghị cải thiện:</span>
                            <ul className="list-disc list-inside text-xs text-emerald-900 bg-emerald-50 p-3 rounded-xl border border-emerald-200 space-y-1">
                              {evalData.improvements.map((impItem: string, iIdx: number) => (
                                <li key={iIdx}>{impItem}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="p-4 bg-[#fff1ea] rounded-xl border border-[#d8c2b6] text-xs text-[#6d3807] font-bold text-center">
                        ⚡ Bài thi này đang trong tiến trình chấm điểm bất đồng bộ...
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </main>
    </div>
  );
}
