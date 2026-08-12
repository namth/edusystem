"use client";

import { useState, useEffect } from "react";
import StudentLayout from "@/components/StudentLayout";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabase";
import { FileText, ChevronDown, MessageSquare, Loader2 } from "lucide-react";

interface SubItem {
  id: string;
  title: string;
  date: string;
  score: number;
  skills: {
    listening: number;
    reading: number;
    writing: number;
    speaking: number;
  };
  feedback: string;
}

export default function StudentAnalyticsPage() {
  const { user } = useAuth();
  const [submissions, setSubmissions] = useState<SubItem[]>([]);
  const [expandedTest, setExpandedTest] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [avgScore, setAvgScore] = useState(7.0);

  useEffect(() => {
    const fetchSubmissions = async () => {
      if (!user) return;

      try {
        const { data, error } = await supabase
          .from("submissions")
          .select("*")
          .eq("student_id", user.id)
          .order("created_at", { ascending: false });

        if (error) {
          console.error("Submissions load error:", error);
          return;
        }

        if (data && data.length > 0) {
          const list: SubItem[] = data.map((sub: any) => {
            const dateStr = new Date(sub.created_at).toLocaleDateString("vi-VN");
            // Standard IELTS scoring breakdown simulation based on AI Score
            const ai = Number(sub.ai_score || 7.0);
            return {
              id: sub.id,
              title: "IELTS Academic Mock Test #01",
              date: dateStr,
              score: ai,
              skills: {
                listening: Math.min(9.0, Math.round((ai + 0.5) * 2) / 2),
                reading: Math.min(9.0, Math.round((ai + 0.2) * 2) / 2),
                writing: Math.min(9.0, Math.round((ai - 0.5) * 2) / 2),
                speaking: Math.min(9.0, Math.round((ai - 0.2) * 2) / 2),
              },
              feedback: sub.ai_feedback || "AI review comments pending.",
            };
          });

          setSubmissions(list);
          setExpandedTest(list[0].id);

          const sum = list.reduce((acc, curr) => acc + curr.score, 0);
          setAvgScore(Math.round((sum / list.length) * 10) / 10);
        } else {
          // If no custom submissions, use standard starter set
          const starterList: SubItem[] = [
            {
              id: "sub_starter_01",
              title: "IELTS Mock Final - Alpha",
              date: "18/07/2026",
              score: 7.5,
              skills: {
                listening: 8.0,
                reading: 7.5,
                writing: 6.5,
                speaking: 7.0,
              },
              feedback: "Bài luận Writing Task 2 có cấu trúc luận điểm rõ ràng. Phần Speaking phát âm tự nhiên, cần mở rộng thêm các từ nối học thuật ở Part 3.",
            },
          ];
          setSubmissions(starterList);
          setExpandedTest("sub_starter_01");
          setAvgScore(7.5);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchSubmissions();
  }, [user]);

  const toggleExpand = (id: string) => {
    setExpandedTest(expandedTest === id ? null : id);
  };

  const getSkillsBreakdown = () => {
    if (submissions.length === 0) {
      return { listening: 8.0, reading: 7.5, writing: 6.5, speaking: 7.0 };
    }
    const target = submissions.find((s) => s.id === expandedTest) || submissions[0];
    return target.skills;
  };

  const currentSkills = getSkillsBreakdown();

  // Radar points rendering based on current selected test skills
  const scale = 45 / 9;
  const p1y = 50 - currentSkills.reading * scale;
  const p2x = 50 + currentSkills.listening * scale;
  const p3y = 50 + currentSkills.writing * scale;
  const p4x = 50 - currentSkills.speaking * scale;

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

        {loading ? (
          <div className="flex flex-col items-center justify-center p-12 bg-white rounded-2xl border border-[#d8c2b6] shadow-sm">
            <Loader2 className="w-8 h-8 text-[#6d3807] animate-spin mb-2" />
            <p className="font-mono text-xs text-[#52443a]">Đang lấy kết quả phân tích học tập từ database...</p>
          </div>
        ) : (
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

                  <span className="absolute -top-5 left-1/2 -translate-x-1/2 font-mono text-[11px] font-bold text-[#6d3807]">Reading ({currentSkills.reading})</span>
                  <span className="absolute top-1/2 -right-8 -translate-y-1/2 font-mono text-[11px] font-bold text-[#6d3807]">Listening ({currentSkills.listening})</span>
                  <span className="absolute -bottom-5 left-1/2 -translate-x-1/2 font-mono text-[11px] font-bold text-[#6d3807]">Writing ({currentSkills.writing})</span>
                  <span className="absolute top-1/2 -left-8 -translate-y-1/2 font-mono text-[11px] font-bold text-[#6d3807]">Speaking ({currentSkills.speaking})</span>
                </div>
              </div>

              <div className="mt-6 grid grid-cols-2 gap-4">
                <div className="bg-[#fff8f5] p-4 rounded-xl border border-[#d8c2b6] text-center">
                  <p className="font-mono text-xs text-[#52443a] mb-1">Avg. Band Score</p>
                  <p className="font-headline text-3xl font-bold text-[#6d3807]">{avgScore}</p>
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
                <div className="col-span-2 text-center">Band Score</div>
                <div className="col-span-2 text-right">Chi Tiết</div>
              </div>

              {submissions.map((sub) => (
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
                        <p className="text-xs text-[#52443a]">Academic Module</p>
                      </div>
                    </div>
                    <div className="col-span-3 font-mono text-xs text-[#52443a]">{sub.date}</div>
                    <div className="col-span-2 text-center">
                      <span className="inline-flex items-center justify-center px-3 py-1 rounded-full bg-[#DCFCE7] text-emerald-800 font-mono text-xs font-bold">
                        {sub.score}
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
                          <span className="font-headline text-xl font-bold text-[#211a16]">{sub.skills.listening}</span>
                        </div>
                        <div className="flex flex-col items-center p-3 bg-white rounded-xl border border-[#d8c2b6]">
                          <span className="font-mono text-[10px] uppercase text-[#52443a]">Reading</span>
                          <span className="font-headline text-xl font-bold text-[#211a16]">{sub.skills.reading}</span>
                        </div>
                        <div className="flex flex-col items-center p-3 bg-white rounded-xl border border-[#d8c2b6]">
                          <span className="font-mono text-[10px] uppercase text-[#52443a]">Writing</span>
                          <span className="font-headline text-xl font-bold text-[#211a16]">{sub.skills.writing}</span>
                        </div>
                        <div className="flex flex-col items-center p-3 bg-white rounded-xl border border-[#d8c2b6]">
                          <span className="font-mono text-[10px] uppercase text-[#52443a]">Speaking</span>
                          <span className="font-headline text-xl font-bold text-[#211a16]">{sub.skills.speaking}</span>
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
              ))}
            </div>
          </div>
        )}
      </div>
    </StudentLayout>
  );
}
