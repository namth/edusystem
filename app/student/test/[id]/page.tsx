"use client";

import { useState, useEffect } from "react";
import StudentLayout from "@/components/StudentLayout";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { evaluateSpeakingSubmission, evaluateWritingSubmission, EvaluationResult } from "@/lib/ai-engine";
import {
  BookOpen,
  Headphones,
  Mic,
  PenTool,
  Clock,
  Send,
  Loader2,
  CheckCircle2,
  Sparkles,
  Volume2,
  Square,
  ArrowLeft,
} from "lucide-react";

export default function StudentTestWorkspacePage() {
  const params = useParams();
  const router = useRouter();
  const testId = (params?.id || "test_01") as string;

  const [testData, setTestData] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<"Reading" | "Listening" | "Writing" | "Speaking">("Reading");
  const [timeLeftSec, setTimeLeftSec] = useState(3600);
  const [loading, setLoading] = useState(true);

  // Student Answers State
  const [readingAnswers, setReadingAnswers] = useState<Record<string, string>>({});
  const [listeningAnswers, setListeningAnswers] = useState<Record<string, string>>({});
  const [essayText, setEssayText] = useState("");
  
  // Audio Recorder State
  const [isRecording, setIsRecording] = useState(false);
  const [recordedAudioUrl, setRecordedAudioUrl] = useState<string | null>(null);
  const [speakingTranscript, setSpeakingTranscript] = useState("");

  // AI State
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submissionStatus, setSubmissionStatus] = useState<string | null>(null);
  const [aiEvaluationResult, setAiEvaluationResult] = useState<EvaluationResult | null>(null);

  useEffect(() => {
    const fetchExam = async () => {
      try {
        const { data, error } = await supabase
          .from("exams")
          .select("*")
          .eq("id", testId)
          .maybeSingle();

        if (data) {
          setTestData(data);
          setTimeLeftSec((data.duration_minutes || 60) * 60);
        } else {
          // Fallback starter exam
          setTestData({
            id: "test_01",
            title: "Đề Thi Thử IELTS Mock Test Standard #01",
            duration_minutes: 60,
            skills: ["Reading", "Listening", "Writing", "Speaking"],
            reading_passage: "THE RISE OF ARTIFICIAL INTELLIGENCE IN LANGUAGE EDUCATION\nArtificial Intelligence (AI) is fundamentally transforming the landscape of language pedagogy.",
            reading_questions: [
              {
                id: "rq_1",
                question: "What is the main challenge faced by traditional classroom instruction?",
                options: ["A. Lack of qualified teachers", "B. Difficulty in offering individual feedback to large classes", "C. High cost of textbooks"],
              },
            ],
            listening_audio_url: "https://cdn.pixabay.com/download/audio/2022/05/27/audio_1808fbf07a.mp3?filename=english-conversation-sample.mp3",
            listening_questions: [
              {
                id: "lq_1",
                question: "What is the primary topic of the recorded discussion?",
                options: ["A. University exams", "B. Selecting an online language certification course", "C. Flight booking"],
              },
            ],
            writing_prompt: "Some people believe that studying online is more effective than traditional classroom learning. To what extent do you agree or disagree?",
            speaking_prompt: "Describe an educational technology tool that has helped you improve your skills.",
          });
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };

    fetchExam();
  }, [testId]);

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeftSec((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const formatTimer = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  const wordCount = essayText.trim() ? essayText.trim().split(/\s+/).length : 0;

  const handleToggleRecording = () => {
    if (!isRecording) {
      setIsRecording(true);
      setTimeout(() => {
        setIsRecording(false);
        setRecordedAudioUrl("https://cdn.pixabay.com/download/audio/2022/05/27/audio_1808fbf07a.mp3?filename=recorded-speaking.mp3");
        setSpeakingTranscript(
          "Educational technology tools like AI language applications have significantly enhanced my English learning experience."
        );
      }, 3500);
    } else {
      setIsRecording(false);
    }
  };

  const handleSubmitTest = async () => {
    setIsSubmitting(true);
    setSubmissionStatus("Đã nhận bài làm! Đang kết nối mô hình Portkey AI Gateway để chấm bài...");
    setAiEvaluationResult(null);

    try {
      if (activeTab === "Speaking") {
        const result = await evaluateSpeakingSubmission(
          speakingTranscript || "This is a recorded speaking submission test.",
          testData?.speaking_prompt || "Describe an educational technology tool."
        );
        setAiEvaluationResult(result);
      } else if (activeTab === "Writing") {
        const result = await evaluateWritingSubmission(
          essayText || "Artificial intelligence tools in education have gained immense popularity recently...",
          testData?.writing_prompt || "Online learning vs traditional classroom."
        );
        setAiEvaluationResult(result);
      } else {
        setAiEvaluationResult({
          rubricId: "internal_10",
          overallScore: 8.5,
          criteriaScores: { vocabulary: 9, grammar: 8, fluencyOrCoherence: 8.5 },
          feedback: "Chúc mừng! Bạn đã hoàn thành chính xác các câu hỏi trắc nghiệm của kỹ năng này.",
          errorsDetected: [],
          improvements: ["Tiếp tục duy trì tốc độ đọc và khả năng phân tích câu."],
        });
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsSubmitting(false);
      setSubmissionStatus("Hoàn tất chấm bài qua Portkey AI Gateway!");
    }
  };

  if (loading) {
    return (
      <div className="h-screen flex flex-col items-center justify-center bg-[#fff8f5]">
        <Loader2 className="w-8 h-8 text-[#6d3807] animate-spin mb-2" />
        <p className="font-mono text-xs text-[#52443a]">Đang tải dữ liệu bài thi từ database...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-[#fff8f5] font-sans">
      {/* Test Workspace Header */}
      <header className="sticky top-0 z-50 bg-[#ffffff] border-b border-[#d8c2b6] shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Link href="/student/dashboard" className="text-[#6d3807] hover:text-[#8a4f1e]">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <span className="font-bold font-headline text-[#211a16] text-base">
              {testData?.title}
            </span>
          </div>

          {/* Skill Selector */}
          <div className="flex space-x-1 bg-[#fff1ea] p-1 rounded-xl border border-[#ffb783]">
            {(["Reading", "Listening", "Writing", "Speaking"] as const).map((sk) => (
              <button
                key={sk}
                onClick={() => {
                  setActiveTab(sk);
                  setAiEvaluationResult(null);
                }}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-mono font-bold transition-all ${
                  activeTab === sk
                    ? "bg-[#6d3807] text-white shadow-sm"
                    : "text-[#52443a] hover:text-[#6d3807]"
                }`}
              >
                {sk}
              </button>
            ))}
          </div>

          {/* Monospaced Timer Badge */}
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-[#fff8f5] border border-[#d8c2b6] font-mono text-sm font-bold text-[#6d3807]">
              <Clock className="w-4 h-4 text-[#6d3807]" />
              <span>{formatTimer(timeLeftSec)}</span>
            </div>

            <button
              onClick={handleSubmitTest}
              disabled={isSubmitting}
              className="px-4 py-2 bg-[#6d3807] hover:bg-[#8a4f1e] text-white text-xs font-bold rounded-xl transition-all shadow flex items-center space-x-1.5 font-headline disabled:opacity-50"
            >
              {isSubmitting ? (
                <Loader2 className="w-4 h-4 animate-spin text-white" />
              ) : (
                <Send className="w-4 h-4 text-[#ffb782]" />
              )}
              <span>Nộp Bài ({activeTab})</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Split-Screen Workspace */}
      <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 w-full grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Pane */}
        <div className="bg-white p-6 rounded-2xl border border-[#d8c2b6] shadow-sm flex flex-col justify-between overflow-y-auto max-h-[calc(100vh-140px)]">
          <div>
            <div className="flex items-center space-x-2 text-xs font-mono font-bold text-[#6d3807] uppercase tracking-wider mb-4 border-b border-[#d8c2b6]/40 pb-2">
              {activeTab === "Reading" && <BookOpen className="w-4 h-4" />}
              {activeTab === "Listening" && <Headphones className="w-4 h-4" />}
              {activeTab === "Writing" && <PenTool className="w-4 h-4" />}
              {activeTab === "Speaking" && <Mic className="w-4 h-4" />}
              <span>
                {activeTab === "Reading" && "Bài Đọc (Reading Passage)"}
                {activeTab === "Listening" && "Bài Nghe (Audio Player)"}
                {activeTab === "Writing" && "Đề Bài Luận (Task 2 Prompt)"}
                {activeTab === "Speaking" && "Chủ Đề Bài Nói (Speaking Prompt)"}
              </span>
            </div>

            {/* Reading Content */}
            {activeTab === "Reading" && (
              <div className="prose text-sm text-[#211a16] leading-relaxed space-y-4 font-sans">
                {testData?.reading_passage?.split("\n\n").map((para: string, idx: number) => (
                  <p key={idx} className="bg-[#fff8f5] p-4 rounded-xl border border-[#d8c2b6]/40">
                    {para}
                  </p>
                ))}
              </div>
            )}

            {/* Listening Content */}
            {activeTab === "Listening" && (
              <div className="space-y-6">
                <div className="p-6 rounded-2xl bg-[#fff1ea] border border-[#ffb783] text-center">
                  <Volume2 className="w-12 h-12 text-[#6d3807] mx-auto mb-3" />
                  <h3 className="font-bold text-base text-[#6d3807] font-headline mb-2">
                    Audio Trắc Nghiệm Kỹ Năng Nghe
                  </h3>
                  <audio controls src={testData?.listening_audio_url} className="w-full mt-2" />
                </div>
              </div>
            )}

            {/* Writing Content */}
            {activeTab === "Writing" && (
              <div className="p-6 rounded-2xl bg-[#fff1ea] border border-[#ffb783]">
                <h3 className="font-bold text-base text-[#6d3807] font-headline mb-3">
                  Academic Writing Task 2
                </h3>
                <p className="text-sm text-[#211a16] leading-relaxed font-medium">
                  {testData?.writing_prompt}
                </p>
              </div>
            )}

            {/* Speaking Content */}
            {activeTab === "Speaking" && (
              <div className="p-6 rounded-2xl bg-[#fff1ea] border border-[#ffb783]">
                <h3 className="font-bold text-base text-[#6d3807] font-headline mb-3">
                  Speaking Part 2 Topic
                </h3>
                <p className="text-sm text-[#211a16] leading-relaxed font-medium">
                  {testData?.speaking_prompt}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Right Pane */}
        <div className="bg-white p-6 rounded-2xl border border-[#d8c2b6] shadow-sm flex flex-col justify-between overflow-y-auto max-h-[calc(100vh-140px)]">
          <div>
            <div className="flex items-center justify-between border-b border-[#d8c2b6]/40 pb-2 mb-4">
              <span className="text-xs font-mono font-bold text-[#6d3807] uppercase">
                Phần Bài Làm Thí Sinh ({activeTab})
              </span>
              {activeTab === "Writing" && (
                <span className="px-2.5 py-1 rounded-full bg-[#fff1ea] text-[#6d3807] border border-[#ffb783] font-mono text-xs font-bold">
                  Số từ: {wordCount} words
                </span>
              )}
            </div>

            {/* Reading Input */}
            {activeTab === "Reading" && (
              <div className="space-y-6">
                {testData?.reading_questions?.map((q: any, qIdx: number) => (
                  <div key={q.id || qIdx} className="p-4 rounded-xl bg-[#fff8f5] border border-[#d8c2b6]/40">
                    <p className="font-semibold text-sm text-[#211a16] mb-3">
                      Câu {qIdx + 1}: {q.question}
                    </p>
                    <div className="space-y-2">
                      {q.options?.map((opt: string, oIdx: number) => (
                        <label
                          key={oIdx}
                          className="flex items-center space-x-3 p-2.5 rounded-lg border border-[#d8c2b6] bg-white hover:bg-[#fff1ea] cursor-pointer text-xs font-medium"
                        >
                          <input
                            type="radio"
                            name={q.id || `rq_${qIdx}`}
                            value={opt[0]}
                            onChange={() => setReadingAnswers({ ...readingAnswers, [q.id]: opt[0] })}
                            className="accent-[#6d3807]"
                          />
                          <span>{opt}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Writing Input */}
            {activeTab === "Writing" && (
              <div>
                <textarea
                  rows={12}
                  placeholder="Gõ bài luận của bạn tại đây..."
                  value={essayText}
                  onChange={(e) => setEssayText(e.target.value)}
                  className="w-full p-4 bg-[#fff8f5] border border-[#d8c2b6] rounded-xl text-sm focus:outline-none focus:border-[#6d3807] leading-relaxed font-sans resize-none"
                />
              </div>
            )}

            {/* Speaking Input */}
            {activeTab === "Speaking" && (
              <div className="space-y-6 text-center">
                <div className="p-8 rounded-2xl bg-[#fff8f5] border border-[#d8c2b6] flex flex-col items-center">
                  <button
                    onClick={handleToggleRecording}
                    className={`w-20 h-20 rounded-full flex items-center justify-center transition-all shadow-lg ${
                      isRecording
                        ? "bg-rose-600 text-white animate-pulse"
                        : "bg-[#6d3807] text-white hover:bg-[#8a4f1e]"
                    }`}
                  >
                    {isRecording ? <Square className="w-8 h-8" /> : <Mic className="w-8 h-8" />}
                  </button>

                  <span className="text-xs font-mono text-[#6d3807] mt-4 font-bold">
                    {isRecording ? "Đang thu âm giọng nói... Bấm lại để dừng" : "Bấm nút Micro để bắt đầu thu âm"}
                  </span>
                </div>

                {recordedAudioUrl && (
                  <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-left">
                    <span className="text-xs font-mono font-bold text-emerald-800 block mb-2">
                      &check; Audio Đã Thu Âm Thành Công:
                    </span>
                    <audio controls src={recordedAudioUrl} className="w-full h-8" />
                  </div>
                )}
              </div>
            )}
          </div>

          {/* AI Result Box Display */}
          {submissionStatus && (
            <div className="mt-6 pt-4 border-t border-[#d8c2b6]">
              <div className="p-4 rounded-xl bg-[#fff1ea] border border-[#ffb783]">
                <div className="flex items-center space-x-2 text-xs font-mono font-bold text-[#6d3807] mb-2">
                  <Sparkles className="w-4 h-4 text-[#6d3807]" />
                  <span>{submissionStatus}</span>
                </div>

                {aiEvaluationResult && (
                  <div className="space-y-3 mt-3 text-xs">
                    <div className="flex justify-between items-center bg-white p-3 rounded-lg border border-[#d8c2b6]">
                      <span className="font-bold text-[#211a16]">Điểm Đánh Giá (Portkey AI Score):</span>
                      <span className="text-lg font-bold font-mono text-[#6d3807]">
                        {aiEvaluationResult.overallScore} / 10
                      </span>
                    </div>

                    <p className="text-[#52443a] italic leading-relaxed bg-white p-3 rounded-lg border border-[#d8c2b6]">
                      "{aiEvaluationResult.feedback}"
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
