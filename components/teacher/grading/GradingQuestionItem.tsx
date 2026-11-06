"use client";

import { CheckCircle2, X, Volume2 } from "lucide-react";

interface QuestionItemProps {
  question: any;
  qIndex: number;
  kind: "lesson" | "exam";
  isLocked: boolean;
  scoreMap: Record<string, string>;
  feedbackMap: Record<string, string>;
  errors: Record<string, string>;
  onScoreChange: (key: string, val: string, min: number, max: number, step: number) => void;
  onFeedbackChange: (key: string, val: string) => void;
}

export default function GradingQuestionItem({
  question: q,
  qIndex,
  kind,
  isLocked,
  scoreMap,
  feedbackMap,
  errors,
  onScoreChange,
  onFeedbackChange,
}: QuestionItemProps) {
  const r = q.result;
  const isObj = r?.kind === "OBJECTIVE";
  const isAI = r?.kind === "AI";
  const audioUrl =
    q.answer?.speaking_audio_url ||
    (typeof q.answer === "string" && q.answer.endsWith(".mp3") ? q.answer : null) ||
    q.stimulus?.audio_url;

  return (
    <div className="p-5 rounded-2xl border border-line bg-surface-alt/30 space-y-3 font-sans">
      <div className="flex justify-between items-start">
        <div>
          <span className="text-[11px] font-bold text-brand-600 uppercase font-mono mr-2">
            Câu {qIndex + 1}
          </span>
          <span className="text-xs font-bold text-ink">
            {q.prompt || "Nội dung câu hỏi"}
          </span>
        </div>
        <span
          className={`px-2 py-0.5 rounded text-[10px] font-bold font-mono ${
            isAI
              ? "bg-purple-100 text-purple-900 border border-purple-200"
              : "bg-emerald-50 text-emerald-800 border border-emerald-200"
          }`}
        >
          {isAI ? "AI" : "Khách quan"}
        </span>
      </div>

      {/* Câu khách quan: chỉ xem */}
      {isObj && (
        <div className="space-y-2 text-xs pt-1">
          <div className="p-3 bg-white rounded-xl border border-line space-y-1">
            <div className="text-ink-muted text-[11px]">Đáp án học sinh:</div>
            <div className="font-bold text-ink">
              {typeof q.answer === "object"
                ? JSON.stringify(q.answer)
                : String(q.answer || "(Trống)")}
            </div>
          </div>
          <div className="flex items-center space-x-2 text-[11px]">
            {r?.correct ? (
              <span className="text-emerald-700 font-bold flex items-center">
                <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> Đúng (+
                {r?.score ?? 1}đ)
              </span>
            ) : (
              <span className="text-rose-700 font-bold flex items-center">
                <X className="w-3.5 h-3.5 mr-1" /> Sai
              </span>
            )}
          </div>
        </div>
      )}

      {/* Speaking Audio Player */}
      {audioUrl && (
        <div className="p-3 bg-white rounded-xl border border-line space-y-1.5">
          <div className="flex items-center space-x-2 text-brand-600 text-xs font-bold">
            <Volume2 className="w-4 h-4 text-brand-600" />
            <span>Bản thu âm bài nói của học sinh:</span>
          </div>
          <audio controls src={audioUrl} className="w-full h-9" />
        </div>
      )}

      {/* Câu AI: bài làm, AI feedback, ô điểm và nhận xét GV */}
      {isAI && (
        <div className="space-y-3 pt-1">
          {/* Student answer text */}
          <div className="p-3 bg-white rounded-xl border border-line text-xs font-serif leading-relaxed text-ink whitespace-pre-wrap">
            {typeof q.answer === "object"
              ? q.answer?.essay_text ||
                q.answer?.writing_essay ||
                JSON.stringify(q.answer)
              : String(q.answer || "(Không có nội dung bài nộp)")}
          </div>

          {/* AI original feedback (chỉ đọc) */}
          <div className="p-3 rounded-xl bg-purple-50/70 border border-purple-200 text-xs space-y-1">
            <div className="flex justify-between items-center text-purple-900 font-bold font-mono text-[11px]">
              <span>⚡ ĐIỂM &amp; NHẬN XÉT AI GỐC</span>
              <span>Điểm: {r.ai_score ?? r.score ?? "—"}</span>
            </div>
            <p className="text-purple-950 text-xs leading-relaxed">
              {r.ai_feedback || r.feedback || "AI không có nhận xét bổ sung."}
            </p>
          </div>

          {/* Teacher Score & Feedback Inputs */}
          <div className="space-y-3 pt-2 border-t border-line/60">
            {kind === "lesson" && Array.isArray(r.items) && r.items.length > 0 ? (
              r.items.map((it: any) => {
                const k = `${q.id}:${it.key ?? ""}`;
                return (
                  <div key={k} className="space-y-1.5">
                    <label className="text-[11px] font-bold text-brand-700 uppercase">
                      Điểm giáo viên (Mục {it.key}, thang 0–9, bước 0.5):
                    </label>
                    <input
                      type="number"
                      min={0}
                      max={9}
                      step={0.5}
                      disabled={isLocked}
                      value={scoreMap[k] ?? ""}
                      onChange={(e) =>
                        onScoreChange(k, e.target.value, 0, 9, 0.5)
                      }
                      placeholder="0-9 (bước 0.5)"
                      className="w-32 p-2 bg-white border border-line rounded-lg text-xs font-bold text-brand-600 focus:outline-none"
                    />
                    {errors[k] && (
                      <div className="text-[11px] text-rose-600 font-medium">
                        {errors[k]}
                      </div>
                    )}

                    <textarea
                      rows={2}
                      disabled={isLocked}
                      value={feedbackMap[k] ?? ""}
                      onChange={(e) => onFeedbackChange(k, e.target.value)}
                      placeholder="Nhận xét của giáo viên cho mục này (tối đa 2000 ký tự)..."
                      className="w-full p-2 bg-white border border-line rounded-lg text-xs text-ink focus:outline-none"
                    />
                    {errors[`fb_${k}`] && (
                      <div className="text-[11px] text-rose-600 font-medium">
                        {errors[`fb_${k}`]}
                      </div>
                    )}
                  </div>
                );
              })
            ) : (
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-brand-700 uppercase">
                  Điểm giáo viên (min: 0, max: 9, bước: 0.5):
                </label>
                <input
                  type="number"
                  min={0}
                  max={9}
                  step={0.5}
                  disabled={isLocked}
                  value={scoreMap[q.id] ?? ""}
                  onChange={(e) =>
                    onScoreChange(q.id, e.target.value, 0, 9, 0.5)
                  }
                  placeholder="0-9 (bước 0.5)"
                  className="w-32 p-2 bg-white border border-line rounded-lg text-xs font-bold text-brand-600 focus:outline-none"
                />
                {errors[q.id] && (
                  <div className="text-[11px] text-rose-600 font-medium">
                    {errors[q.id]}
                  </div>
                )}

                <textarea
                  rows={2}
                  disabled={isLocked}
                  value={feedbackMap[q.id] ?? ""}
                  onChange={(e) => onFeedbackChange(q.id, e.target.value)}
                  placeholder="Nhận xét của giáo viên cho câu này (tối đa 2000 ký tự)..."
                  className="w-full p-2 bg-white border border-line rounded-lg text-xs text-ink focus:outline-none"
                />
                {errors[`fb_${q.id}`] && (
                  <div className="text-[11px] text-rose-600 font-medium">
                    {errors[`fb_${q.id}`]}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
