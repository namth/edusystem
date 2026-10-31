"use client";

import { useState, useEffect } from "react";
import StudentLayout from "@/components/StudentLayout";
import Link from "next/link";
import { FileText, ChevronDown, MessageSquare, Loader2, AlertCircle } from "lucide-react";
import {
  submissionScore,
  submissionSkillScores,
  formatScore,
  SubmissionScoreResult,
  SkillScoreItem,
} from "@/lib/score-display";

interface SubItem {
  id: string;
  exam_id: string;
  title: string;
  date: string;
  scoreInfo: SubmissionScoreResult;
  skills: Record<"Listening" | "Reading" | "Writing" | "Speaking", SkillScoreItem>;
  feedback: string;
}

export default function StudentAnalyticsPage() {
  const [submissions, setSubmissions] = useState<SubItem[]>([]);
  const [expandedTest, setExpandedTest] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [avgScore, setAvgScore] = useState<number | null>(null);

  const fetchAnalyticsData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [subsRes, examsRes] = await Promise.all([
        fetch("/api/submissions"),
        fetch("/api/exams"),
      ]);

      if (!subsRes.ok) {
        const j = await subsRes.json().catch(() => ({}));
        throw new Error(j.error || "Không thể tải danh sách bài nộp.");
      }
      if (!examsRes.ok) {
        const j = await examsRes.json().catch(() => ({}));
        throw new Error(j.error || "Không thể tải danh sách đề thi.");
      }

      const subsJson = await subsRes.json();
      const examsJson = await examsRes.json();

      if (!subsJson.success) throw new Error(subsJson.error || "Lỗi tải bài nộp.");
      if (!examsJson.success) throw new Error(examsJson.error || "Lỗi tải đề thi.");

      const examsMap: Record<string, string> = {};
      for (const e of (examsJson.exams || [])) {
        examsMap[e.id] = e.title;
      }

      const rawSubs: any[] = subsJson.data || [];
      const list: SubItem[] = rawSubs.map((sub: any) => {
        const dateStr = sub.created_at ? new Date(sub.created_at).toLocaleDateString("vi-VN") : "";
        const scoreInfo = submissionScore(sub);
        const skillScores = submissionSkillScores(sub);

        let feedbackText = "Chưa có nhận xét.";
        if (sub.final_feedback) {
          feedbackText = sub.final_feedback;
        } else if (sub.ai_feedback) {
          if (typeof sub.ai_feedback === "string") {
            try {
              const parsed = JSON.parse(sub.ai_feedback);
              feedbackText = parsed.writing?.feedback || parsed.speaking?.feedback || sub.ai_feedback;
            } catch {
              feedbackText = sub.ai_feedback;
            }
          } else {
            feedbackText = JSON.stringify(sub.ai_feedback);
          }
        }

        return {
          id: sub.id,
          exam_id: sub.exam_id,
          title: examsMap[sub.exam_id] || "Đề thi đã xoá",
          date: dateStr,
          scoreInfo,
          skills: skillScores,
          feedback: feedbackText,
        };
      });

      setSubmissions(list);
      if (list.length > 0) {
        setExpandedTest(list[0].id);
        const scoredItems = list.filter((s) => s.scoreInfo.percent != null);
        if (scoredItems.length > 0) {
          const sum = scoredItems.reduce((acc, curr) => acc + (curr.scoreInfo.percent as number), 0);
          setAvgScore(Math.round((sum / scoredItems.length) * 10) / 10);
        } else {
          setAvgScore(null);
        }
      } else {
        setAvgScore(null);
      }
    } catch (err: any) {
      console.error("Analytics fetch error:", err);
      setError(err.message || "Đã xảy ra lỗi khi tải dữ liệu phân tích.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalyticsData();
  }, []);

  const toggleExpand = (id: string) => {
    setExpandedTest(expandedTest === id ? null : id);
  };

  const getSkillsBreakdown = () => {
    if (submissions.length === 0) {
      return {
        Listening: { score: null, min: 0, max: 9 },
        Reading: { score: null, min: 0, max: 9 },
        Writing: { score: null, min: 0, max: 9 },
        Speaking: { score: null, min: 0, max: 9 },
      };
    }
    const target = submissions.find((s) => s.id === expandedTest) || submissions[0];
    return target.skills;
  };

  const currentSkills = getSkillsBreakdown();

  const getSkillPercent = (item: SkillScoreItem) => {
    if (item.score == null || item.max <= item.min) return 0;
    const pct = ((item.score - item.min) / (item.max - item.min)) * 100;
    return Math.max(0, Math.min(100, pct));
  };

  const rPercent = getSkillPercent(currentSkills.Reading);
  const lPercent = getSkillPercent(currentSkills.Listening);
  const wPercent = getSkillPercent(currentSkills.Writing);
  const sPercent = getSkillPercent(currentSkills.Speaking);

  const p1y = 50 - rPercent * 0.45;
  const p2x = 50 + lPercent * 0.45;
  const p3y = 50 + wPercent * 0.45;
  const p4x = 50 - sPercent * 0.45;

  return (
    <StudentLayout>
      <div className="max-w-[1280px] mx-auto space-y-8 font-sans">
        {/* Page Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-[#d8c2b6]/40 pb-6">
          <div>
            <h1 className="font-headline text-3xl font-bold text-[#211a16] tracking-tight">
              Test History &amp; Analytics
            </h1>
            <p className="text-sm text-[#52443a] mt-1">
              Theo dõi tiến độ học tập, biểu đồ năng lực 4 kỹ năng và xem nhận xét chi tiết từ Giáo viên &amp; AI.
            </p>
          </div>
        </div>

        {/* Error State */}
        {error && (
          <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-center space-x-2">
              <AlertCircle className="w-5 h-5 text-red-600 shrink-0" />
              <span className="text-sm font-semibold">{error}</span>
            </div>
            <button
              onClick={fetchAnalyticsData}
              className="px-4 py-1.5 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-lg transition-colors cursor-pointer shrink-0"
            >
              Thử lại
            </button>
          </div>
        )}

        {loading ? (
          <div className="flex flex-col items-center justify-center p-12 bg-white rounded-2xl border border-[#d8c2b6] shadow-sm">
            <Loader2 className="w-8 h-8 text-[#6d3807] animate-spin mb-2" />
            <p className="font-mono text-xs text-[#52443a]">Đang lấy kết quả phân tích học tập từ database...</p>
          </div>
        ) : submissions.length === 0 ? (
          /* Empty State */
          <div className="p-12 text-center bg-white rounded-2xl border border-[#d8c2b6] space-y-4 shadow-sm">
            <FileText className="w-12 h-12 text-[#6d3807] mx-auto opacity-40" />
            <div className="space-y-1">
              <p className="text-base font-bold text-[#211a16]">Bạn chưa làm bài thi nào.</p>
              <p className="text-xs text-[#52443a]">
                Hãy tham gia lớp học và hoàn thành bài thi để xem kết quả phân tích năng lực.
              </p>
            </div>
            <Link
              href="/student/dashboard"
              className="inline-block px-6 py-2.5 bg-[#6d3807] hover:bg-[#8a4f1e] text-white text-xs font-bold rounded-xl transition-all shadow-sm"
            >
              Về trang chủ học sinh
            </Link>
          </div>
        ) : (
          /* Data State */
          <div className="grid grid-cols-12 gap-6">
            {/* Analytics Overview Card */}
            <div className="col-span-12 lg:col-span-4 bg-[#ffffff] rounded-2xl border border-[#d8c2b6] p-6 flex flex-col shadow-sm">
              <h3 className="font-headline text-lg font-bold text-[#211a16] mb-6">Overall Performance</h3>

              <div className="flex-1 flex flex-col items-center justify-center relative min-h-[260px] py-4">
                <div className="relative w-56 h-56 rounded-full border border-[#d8c2b6]/40 flex items-center justify-center">
                  <div className="absolute w-40 h-40 rounded-full border border-[#d8c2b6]/30" />
                  <div className="absolute w-24 h-24 rounded-full border border-[#d8c2b6]/20" />
                  <div className="absolute w-full h-px bg-[#d8c2b6]/40" />
                  <div className="absolute w-full h-px bg-[#d8c2b6]/40 rotate-90" />

                  {/* SVG Polygon */}
                  <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 100">
                    <polygon
                      points={`50,${p1y} ${p2x},50 50,${p3y} ${p4x},50`}
                      fill="#ffdcc5"
                      fillOpacity="0.5"
                      stroke="#6d3807"
                      strokeWidth="2"
                    />
                  </svg>

                  <span className="absolute -top-5 left-1/2 -translate-x-1/2 font-mono text-[11px] font-bold text-[#6d3807]">
                    Reading ({formatScore({ value: currentSkills.Reading.score, max: currentSkills.Reading.max })})
                  </span>
                  <span className="absolute top-1/2 -right-8 -translate-y-1/2 font-mono text-[11px] font-bold text-[#6d3807]">
                    Listening ({formatScore({ value: currentSkills.Listening.score, max: currentSkills.Listening.max })})
                  </span>
                  <span className="absolute -bottom-5 left-1/2 -translate-x-1/2 font-mono text-[11px] font-bold text-[#6d3807]">
                    Writing ({formatScore({ value: currentSkills.Writing.score, max: currentSkills.Writing.max })})
                  </span>
                  <span className="absolute top-1/2 -left-8 -translate-y-1/2 font-mono text-[11px] font-bold text-[#6d3807]">
                    Speaking ({formatScore({ value: currentSkills.Speaking.score, max: currentSkills.Speaking.max })})
                  </span>
                </div>
              </div>

              <div className="mt-6 grid grid-cols-2 gap-4">
                <div className="bg-[#fff8f5] p-4 rounded-xl border border-[#d8c2b6] text-center">
                  <p className="font-mono text-xs text-[#52443a] mb-1">Avg. Score</p>
                  <p className="font-headline text-3xl font-bold text-[#6d3807]">
                    {avgScore != null ? `${avgScore}%` : "—"}
                  </p>
                </div>
                <div className="bg-[#fff8f5] p-4 rounded-xl border border-[#d8c2b6] text-center">
                  <p className="font-mono text-xs text-[#52443a] mb-1">Tests Taken</p>
                  <p className="font-headline text-3xl font-bold text-[#6d3807]">{submissions.length}</p>
                </div>
              </div>
            </div>

            {/* Test List */}
            <div className="col-span-12 lg:col-span-8 space-y-4">
              <div className="grid grid-cols-12 gap-4 px-6 py-3 border-b border-[#d8c2b6] font-mono text-xs text-[#52443a]">
                <div className="col-span-5 font-bold">Test Name</div>
                <div className="col-span-3">Date</div>
                <div className="col-span-2 text-center">Score</div>
                <div className="col-span-2 text-right">Chi Tiết</div>
              </div>

              {submissions.map((sub) => {
                const scoreText = formatScore(sub.scoreInfo);
                const scoreBadgeLabel =
                  sub.scoreInfo.value != null
                    ? sub.scoreInfo.standard_name
                      ? `${scoreText} (${sub.scoreInfo.standard_name})`
                      : scoreText
                    : sub.scoreInfo.status === "GRADING"
                    ? "Đang chấm"
                    : sub.scoreInfo.status === "NEEDS_REVIEW"
                    ? "Chờ giáo viên chấm"
                    : "—";

                return (
                  <div key={sub.id} className="bg-[#ffffff] rounded-2xl border border-[#d8c2b6] shadow-sm overflow-hidden transition-all">
                    <div
                      onClick={() => toggleExpand(sub.id)}
                      className="grid grid-cols-12 gap-4 px-6 py-4 items-center cursor-pointer hover:bg-[#fff1ea] transition-colors"
                    >
                      <div className="col-span-5 flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-[#ffb782] flex items-center justify-center text-[#6d3807]">
                          <FileText className="w-5 h-5" />
                        </div>
                        <div>
                          <p className="font-headline text-sm font-bold text-[#211a16]">{sub.title}</p>
                        </div>
                      </div>
                      <div className="col-span-3 font-mono text-xs text-[#52443a]">{sub.date}</div>
                      <div className="col-span-2 text-center">
                        <span className="inline-flex items-center justify-center px-3 py-1 rounded-full bg-[#DCFCE7] text-emerald-800 font-mono text-xs font-bold">
                          {scoreBadgeLabel}
                        </span>
                      </div>
                      <div className="col-span-2 text-right flex justify-end">
                        <ChevronDown
                          className={`w-5 h-5 text-[#6d3807] transition-transform ${
                            expandedTest === sub.id ? "rotate-180" : ""
                          }`}
                        />
                      </div>
                    </div>

                    {expandedTest === sub.id && (
                      <div className="border-t border-[#d8c2b6] bg-[#fff8f5] p-6 space-y-6">
                        {/* Skill Breakdown */}
                        <div className="grid grid-cols-4 gap-4">
                          <div className="flex flex-col items-center p-3 bg-white rounded-xl border border-[#d8c2b6]">
                            <span className="font-mono text-[10px] uppercase text-[#52443a]">Listening</span>
                            <span className="font-headline text-xl font-bold text-[#211a16]">
                              {formatScore({ value: sub.skills.Listening.score, max: sub.skills.Listening.max })}
                            </span>
                          </div>
                          <div className="flex flex-col items-center p-3 bg-white rounded-xl border border-[#d8c2b6]">
                            <span className="font-mono text-[10px] uppercase text-[#52443a]">Reading</span>
                            <span className="font-headline text-xl font-bold text-[#211a16]">
                              {formatScore({ value: sub.skills.Reading.score, max: sub.skills.Reading.max })}
                            </span>
                          </div>
                          <div className="flex flex-col items-center p-3 bg-white rounded-xl border border-[#d8c2b6]">
                            <span className="font-mono text-[10px] uppercase text-[#52443a]">Writing</span>
                            <span className="font-headline text-xl font-bold text-[#211a16]">
                              {formatScore({ value: sub.skills.Writing.score, max: sub.skills.Writing.max })}
                            </span>
                          </div>
                          <div className="flex flex-col items-center p-3 bg-white rounded-xl border border-[#d8c2b6]">
                            <span className="font-mono text-[10px] uppercase text-[#52443a]">Speaking</span>
                            <span className="font-headline text-xl font-bold text-[#211a16]">
                              {formatScore({ value: sub.skills.Speaking.score, max: sub.skills.Speaking.max })}
                            </span>
                          </div>
                        </div>

                        {/* Feedback */}
                        <div className="space-y-3">
                          <h4 className="font-headline text-xs font-bold text-[#6d3807] uppercase flex items-center space-x-2">
                            <MessageSquare className="w-4 h-4 text-[#6d3807]" />
                            <span>Nhận Xét Chi Tiết Từ Giáo Viên / AI</span>
                          </h4>
                          <div className="p-4 rounded-xl bg-[#fff1ea] border border-[#ffb783] text-xs text-[#52443a] leading-relaxed">
                            "{sub.feedback}"
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </StudentLayout>
  );
}
