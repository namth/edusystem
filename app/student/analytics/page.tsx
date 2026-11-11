"use client";

import * as React from "react";
const { useState, useEffect } = React;
// @ts-ignore
import StudentLayout from "@/components/StudentLayout";
// @ts-ignore
import { FileText, ChevronDown, MessageSquare, Loader2, AlertCircle } from "lucide-react";
// @ts-ignore
import { submissionScore, submissionSkillScores, formatScore, SubmissionScoreResult, SkillScoreItem } from "@/lib/score-display";

interface SubItem {
  id: string;
  exam_id: string;
  title: string;
  date: string;
  scoreInfo: SubmissionScoreResult;
  skills: Record<"Listening" | "Reading" | "Writing" | "Speaking", SkillScoreItem>;
  feedback: string;
}

function formatFeedbackValue(val: any): string {
  if (!val) return "";
  if (typeof val === "string") return val;
  if (Array.isArray(val)) {
    return val
      .map((item) => (typeof item === "string" ? item : formatFeedbackValue(item)))
      .filter(Boolean)
      .join("\n• ");
  }
  if (typeof val === "object") {
    if (val.feedback && typeof val.feedback === "string") {
      return val.feedback;
    }
    const lines: string[] = [];
    for (const [k, v] of Object.entries(val)) {
      if (!v) continue;
      const formatted = formatFeedbackValue(v);
      if (formatted) {
        lines.push(`${k}: ${formatted}`);
      }
    }
    return lines.join("\n");
  }
  return String(val);
}

export default function StudentAnalyticsPage() {
  const [submissions, setSubmissions] = useState<SubItem[]>([]);
  const [expandedTest, setExpandedTest] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [examsWarning, setExamsWarning] = useState<string | null>(null);
  const [avgScore, setAvgScore] = useState<number | null>(null);

  const fetchAnalyticsData = async () => {
    setLoading(true);
    setError(null);
    setExamsWarning(null);
    try {
      const subsRes = await fetch("/api/submissions");
      if (!subsRes.ok) {
        const j = await subsRes.json().catch(() => ({}));
        throw new Error(j.error || "Không thể tải danh sách bài nộp.");
      }
      const subsJson = await subsRes.json();
      if (!subsJson.success) throw new Error(subsJson.error || "Lỗi tải bài nộp.");

      const examsMap: Record<string, string> = {};
      let examsFailed = false;

      try {
        const examsRes = await fetch("/api/exams");
        if (examsRes.ok) {
          const examsJson = await examsRes.json().catch(() => null);
          if (examsJson && examsJson.success && Array.isArray(examsJson.exams)) {
            for (const e of examsJson.exams) {
              examsMap[e.id] = e.title;
            }
          } else {
            examsFailed = true;
          }
        } else {
          examsFailed = true;
        }
      } catch {
        examsFailed = true;
      }

      if (examsFailed) {
        setExamsWarning("Không tải được tên đề thi đầy đủ. Tên bài thi sẽ dùng tên mặc định.");
      }

      const rawSubs: any[] = (subsJson.data || []).filter(
        (sub: any) => sub.status !== "IN_PROGRESS"
      );
      const list: SubItem[] = rawSubs.map((sub: any) => {
        const dateStr = sub.created_at ? new Date(sub.created_at).toLocaleDateString("vi-VN") : "";
        const scoreInfo = submissionScore(sub);
        const skillScores = submissionSkillScores(sub);

        let feedbackText = "Chưa có nhận xét.";
        if (sub.final_feedback) {
          feedbackText =
            typeof sub.final_feedback === "string"
              ? sub.final_feedback
              : formatFeedbackValue(sub.final_feedback);
        } else if (sub.ai_feedback) {
          if (typeof sub.ai_feedback === "string") {
            try {
              const parsed = JSON.parse(sub.ai_feedback);
              if (typeof parsed === "object" && parsed !== null) {
                const formatted = formatFeedbackValue(parsed);
                feedbackText = formatted || sub.ai_feedback;
              } else {
                feedbackText = sub.ai_feedback;
              }
            } catch {
              feedbackText = sub.ai_feedback;
            }
          } else if (typeof sub.ai_feedback === "object" && sub.ai_feedback !== null) {
            if (Array.isArray(sub.ai_feedback)) {
              feedbackText = sub.ai_feedback
                .map((item: any) => (typeof item === "string" ? item : formatFeedbackValue(item)))
                .filter(Boolean)
                .join("\n• ");
            } else {
              const formatted = formatFeedbackValue(sub.ai_feedback);
              feedbackText = formatted || "Chưa có nhận xét.";
            }
          } else {
            feedbackText = "Chưa có nhận xét.";
          }
        }

        return {
          id: sub.id,
          exam_id: sub.exam_id,
          title: examsFailed ? "Đề thi" : (examsMap[sub.exam_id] || "Đề thi đã gỡ"),
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

  const h = React.createElement;

  return h(
    StudentLayout,
    null,
    h(
      "div",
      { className: "max-w-[1280px] mx-auto space-y-8 font-sans" },
      /* Page Header */
      h(
        "div",
        { className: "flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-line/40 pb-6" },
        h(
          "div",
          null,
          h("h1", { className: "font-headline text-3xl font-bold text-ink tracking-tight" }, "Test History & Analytics"),
          h("p", { className: "text-sm text-ink-muted mt-1" }, "Theo dõi tiến độ học tập, biểu đồ năng lực 4 kỹ năng và xem nhận xét chi tiết từ Giáo viên & AI.")
        )
      ),

      /* Error State */
      error &&
        h(
          "div",
          { className: "p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3" },
          h(
            "div",
            { className: "flex items-center space-x-2" },
            h(AlertCircle, { className: "w-5 h-5 text-red-600 shrink-0" }),
            h("span", { className: "text-sm font-semibold" }, error)
          ),
          h(
            "button",
            {
              onClick: fetchAnalyticsData,
              className: "px-4 py-1.5 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-lg transition-colors cursor-pointer shrink-0",
            },
            "Thử lại"
          )
        ),

      /* Exams Warning Banner */
      examsWarning &&
        h(
          "div",
          { className: "p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 flex items-center space-x-2" },
          h(AlertCircle, { className: "w-5 h-5 text-amber-600 shrink-0" }),
          h("span", { className: "text-sm font-semibold" }, examsWarning)
        ),

      loading
        ? h(
            "div",
            { className: "flex flex-col items-center justify-center p-12 bg-white rounded-2xl border border-line shadow-sm" },
            h(Loader2, { className: "w-8 h-8 text-brand-600 animate-spin mb-2" }),
            h("p", { className: "font-mono text-xs text-ink-muted" }, "Đang lấy kết quả phân tích học tập từ database...")
          )
        : submissions.length === 0
        ? /* Empty State */
          h(
            "div",
            { className: "p-12 text-center bg-white rounded-2xl border border-line space-y-4 shadow-sm" },
            h(FileText, { className: "w-12 h-12 text-brand-600 mx-auto opacity-40" }),
            h(
              "div",
              { className: "space-y-1" },
              h("p", { className: "text-base font-bold text-ink" }, "Bạn chưa làm bài thi nào."),
              h("p", { className: "text-xs text-ink-muted" }, "Hãy tham gia lớp học và hoàn thành bài thi để xem kết quả phân tích năng lực.")
            ),
            h(
              "a",
              {
                href: "/student/dashboard",
                className: "inline-block px-6 py-2.5 bg-brand-600 hover:bg-brand-700 text-white text-xs font-bold rounded-xl transition-all shadow-sm",
              },
              "Về trang chủ học sinh"
            )
          )
        : /* Data State */
          h(
            "div",
            { className: "grid grid-cols-12 gap-6" },
            /* Analytics Overview Card */
            h(
              "div",
              { className: "col-span-12 lg:col-span-4 bg-white rounded-2xl border border-line p-6 flex flex-col shadow-sm" },
              h("h3", { className: "font-headline text-lg font-bold text-ink mb-6" }, "Overall Performance"),
              h(
                "div",
                { className: "flex-1 flex flex-col items-center justify-center relative min-h-[260px] py-4" },
                h(
                  "div",
                  { className: "relative w-56 h-56 rounded-full border border-line/40 flex items-center justify-center" },
                  h("div", { className: "absolute w-40 h-40 rounded-full border border-line/30" }),
                  h("div", { className: "absolute w-24 h-24 rounded-full border border-line/20" }),
                  h("div", { className: "absolute w-full h-px bg-line/40" }),
                  h("div", { className: "absolute w-full h-px bg-line/40 rotate-90" }),

                  /* SVG Polygon */
                  h(
                    "svg",
                    { className: "absolute inset-0 w-full h-full", viewBox: "0 0 100 100" },
                    h("polygon", {
                      points: `50,${p1y} ${p2x},50 50,${p3y} ${p4x},50`,
                      fill: "#dce7ff",
                      fillOpacity: "0.5",
                      stroke: "#1453e0",
                      strokeWidth: "2",
                    })
                  ),

                  h(
                    "span",
                    { className: "absolute -top-5 left-1/2 -translate-x-1/2 font-mono text-[11px] font-bold text-brand-600" },
                    `Reading (${formatScore({ value: currentSkills.Reading.score, max: currentSkills.Reading.max })})`
                  ),
                  h(
                    "span",
                    { className: "absolute top-1/2 -right-8 -translate-y-1/2 font-mono text-[11px] font-bold text-brand-600" },
                    `Listening (${formatScore({ value: currentSkills.Listening.score, max: currentSkills.Listening.max })})`
                  ),
                  h(
                    "span",
                    { className: "absolute -bottom-5 left-1/2 -translate-x-1/2 font-mono text-[11px] font-bold text-brand-600" },
                    `Writing (${formatScore({ value: currentSkills.Writing.score, max: currentSkills.Writing.max })})`
                  ),
                  h(
                    "span",
                    { className: "absolute top-1/2 -left-8 -translate-y-1/2 font-mono text-[11px] font-bold text-brand-600" },
                    `Speaking (${formatScore({ value: currentSkills.Speaking.score, max: currentSkills.Speaking.max })})`
                  )
                )
              ),

              h(
                "div",
                { className: "mt-6 grid grid-cols-2 gap-4" },
                h(
                  "div",
                  { className: "bg-surface-alt p-4 rounded-xl border border-line text-center" },
                  h("p", { className: "font-mono text-xs text-ink-muted mb-1" }, "Avg. Score"),
                  h("p", { className: "font-headline text-3xl font-bold text-brand-600" }, avgScore != null ? `${avgScore}%` : "—")
                ),
                h(
                  "div",
                  { className: "bg-surface-alt p-4 rounded-xl border border-line text-center" },
                  h("p", { className: "font-mono text-xs text-ink-muted mb-1" }, "Tests Taken"),
                  h("p", { className: "font-headline text-3xl font-bold text-brand-600" }, submissions.length)
                )
              )
            ),

            /* Test List */
            h(
              "div",
              { className: "col-span-12 lg:col-span-8 space-y-4" },
              h(
                "div",
                { className: "grid grid-cols-12 gap-4 px-6 py-3 border-b border-line font-mono text-xs text-ink-muted" },
                h("div", { className: "col-span-5 font-bold" }, "Test Name"),
                h("div", { className: "col-span-3" }, "Date"),
                h("div", { className: "col-span-2 text-center" }, "Score"),
                h("div", { className: "col-span-2 text-right" }, "Chi Tiết")
              ),

              submissions.map((sub) => {
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

                return h(
                  "div",
                  { key: sub.id, className: "bg-white rounded-2xl border border-line shadow-sm overflow-hidden transition-all" },
                  h(
                    "div",
                    {
                      onClick: () => toggleExpand(sub.id),
                      className: "grid grid-cols-12 gap-4 px-6 py-4 items-center cursor-pointer hover:bg-brand-50 transition-colors",
                    },
                    h(
                      "div",
                      { className: "col-span-5 flex items-center gap-3" },
                      h(
                        "div",
                        { className: "w-10 h-10 rounded-xl bg-brand-300 flex items-center justify-center text-brand-600" },
                        h(FileText, { className: "w-5 h-5" })
                      ),
                      h("div", null, h("p", { className: "font-headline text-sm font-bold text-ink" }, sub.title))
                    ),
                    h("div", { className: "col-span-3 font-mono text-xs text-ink-muted" }, sub.date),
                    h(
                      "div",
                      { className: "col-span-2 text-center" },
                      h("span", { className: "inline-flex items-center justify-center px-3 py-1 rounded-full bg-green-100 text-emerald-800 font-mono text-xs font-bold" }, scoreBadgeLabel)
                    ),
                    h(
                      "div",
                      { className: "col-span-2 text-right flex justify-end" },
                      h(ChevronDown, {
                        className: `w-5 h-5 text-brand-600 transition-transform ${expandedTest === sub.id ? "rotate-180" : ""}`,
                      })
                    )
                  ),

                  expandedTest === sub.id &&
                    h(
                      "div",
                      { className: "border-t border-line bg-surface-alt p-6 space-y-6" },
                      /* Skill Breakdown */
                      h(
                        "div",
                        { className: "grid grid-cols-4 gap-4" },
                        h(
                          "div",
                          { className: "flex flex-col items-center p-3 bg-white rounded-xl border border-line" },
                          h("span", { className: "font-mono text-[10px] uppercase text-ink-muted" }, "Listening"),
                          h("span", { className: "font-headline text-xl font-bold text-ink" }, formatScore({ value: sub.skills.Listening.score, max: sub.skills.Listening.max }))
                        ),
                        h(
                          "div",
                          { className: "flex flex-col items-center p-3 bg-white rounded-xl border border-line" },
                          h("span", { className: "font-mono text-[10px] uppercase text-ink-muted" }, "Reading"),
                          h("span", { className: "font-headline text-xl font-bold text-ink" }, formatScore({ value: sub.skills.Reading.score, max: sub.skills.Reading.max }))
                        ),
                        h(
                          "div",
                          { className: "flex flex-col items-center p-3 bg-white rounded-xl border border-line" },
                          h("span", { className: "font-mono text-[10px] uppercase text-ink-muted" }, "Writing"),
                          h("span", { className: "font-headline text-xl font-bold text-ink" }, formatScore({ value: sub.skills.Writing.score, max: sub.skills.Writing.max }))
                        ),
                        h(
                          "div",
                          { className: "flex flex-col items-center p-3 bg-white rounded-xl border border-line" },
                          h("span", { className: "font-mono text-[10px] uppercase text-ink-muted" }, "Speaking"),
                          h("span", { className: "font-headline text-xl font-bold text-ink" }, formatScore({ value: sub.skills.Speaking.score, max: sub.skills.Speaking.max }))
                        )
                      ),

                      /* Feedback */
                      h(
                        "div",
                        { className: "space-y-3" },
                        h(
                          "h4",
                          { className: "font-headline text-xs font-bold text-brand-600 uppercase flex items-center space-x-2" },
                          h(MessageSquare, { className: "w-4 h-4 text-brand-600" }),
                          h("span", null, "Nhận Xét Chi Tiết Từ Giáo Viên / AI")
                        ),
                        h(
                          "div",
                          { className: "p-4 rounded-xl bg-brand-50 border border-brand-300 text-xs text-ink-muted leading-relaxed whitespace-pre-line" },
                          sub.feedback
                        )
                      )
                    )
                );
              })
            )
          )
    )
  );
}
