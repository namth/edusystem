"use client";

import { useMemo } from "react";
import { emptyAnswerFor, setAnswerPart } from "@/lib/lesson-player";
import SpeakingRecorder from "./SpeakingRecorder";
import { sanitizeStimulusHtml } from "@/lib/stimulus-html";
import {
  Volume2,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Sparkles,
  HelpCircle,
  RotateCcw,
  BookOpen,
} from "lucide-react";

export interface GradeItem {
  key: string;
  correct: boolean;
  given: unknown;
  expected: unknown;
  band?: number;
  score?: number;
  teacher_score?: number | null;
  teacher_feedback?: string | null;
}

export interface GradeResult {
  question_id: string;
  category: string;
  kind: "OBJECTIVE" | "AI" | "UNSUPPORTED";
  earned: number;
  max: number;
  items: GradeItem[];
}

export interface FlashcardItem {
  id: string;
  vietnamese_name?: string;
  image_url?: string | null;
  audio_url?: string | null;
  options?: string[];
}

export interface LessonPlayerProps {
  questions: any[];
  flashcards: FlashcardItem[];
  answers: Record<string, unknown>;
  onChange: (questionId: string, answer: unknown) => void;
  results?: GradeResult[] | null;
  disabled?: boolean;
  allowSpeaking?: boolean;
  hideStimulus?: boolean;
  startNumber?: number;
}

export default function LessonPlayer({
  questions,
  flashcards,
  answers,
  onChange,
  results,
  disabled = false,
  allowSpeaking = false,
  hideStimulus = false,
  startNumber = 1,
}: LessonPlayerProps) {
  const isReadonly = Boolean(results || disabled);

  const resultsMap = useMemo(() => {
    const map = new Map<string, GradeResult>();
    if (results && Array.isArray(results)) {
      for (const r of results) {
        if (r && r.question_id) {
          map.set(r.question_id, r);
        }
      }
    }
    return map;
  }, [results]);

  const flashcardMap = useMemo(() => {
    const map = new Map<string, FlashcardItem>();
    if (flashcards && Array.isArray(flashcards)) {
      for (const fc of flashcards) {
        if (fc && fc.id) {
          map.set(fc.id, fc);
        }
      }
    }
    return map;
  }, [flashcards]);

  const skillBadgeColor = (skill?: string) => {
    switch (skill) {
      case "Reading":
        return "bg-sky-100 text-sky-800 border-sky-300";
      case "Listening":
        return "bg-amber-100 text-amber-800 border-amber-300";
      case "Writing":
        return "bg-emerald-100 text-emerald-800 border-emerald-300";
      case "Speaking":
        return "bg-purple-100 text-purple-800 border-purple-300";
      default:
        return "bg-orange-100 text-orange-800 border-orange-300";
    }
  };

  return (
    <div className="space-y-6">
      {questions.map((q, qIndex) => {
        const qResult = resultsMap.get(q.id);
        const category = q.category || "";
        const content = q.content || {};

        return (
          <div
            key={q.id || qIndex}
            className={`rounded-2xl border bg-white p-6 md:p-8 shadow-xs transition-all ${
              qResult
                ? qResult.earned === qResult.max && qResult.max > 0
                  ? "border-emerald-300 bg-emerald-50/20"
                  : qResult.kind === "AI"
                  ? "border-amber-300 bg-amber-50/20"
                  : "border-rose-300 bg-rose-50/20"
                : "border-line"
            }`}
          >
            {/* Header: Khối số thứ tự, Kỹ năng, Điểm số */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line-soft pb-4 mb-5">
              <div className="flex items-center gap-2.5">
                <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-brand-600 text-sm font-bold text-white shadow-2xs">
                  {startNumber + qIndex}
                </span>
                <span className="font-headline font-bold text-ink text-base md:text-lg">
                  Câu {startNumber + qIndex}
                </span>
                {q.skill && (
                  <span
                    className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold ${skillBadgeColor(
                      q.skill
                    )}`}
                  >
                    {q.skill}
                  </span>
                )}
              </div>

              {/* Kết quả chấm (nếu có results) */}
              {qResult && (
                <div className="flex items-center gap-2">
                  {qResult.kind === "AI" ? (
                    (() => {
                      const firstItem = qResult.items?.[0];
                      const hasBand =
                        firstItem && typeof firstItem.band === "number";
                      const hasTeacherReview =
                        firstItem &&
                        (firstItem.teacher_score !== undefined && firstItem.teacher_score !== null ||
                          Boolean(firstItem.teacher_feedback));
                      return hasBand ? (
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="inline-flex items-center gap-1 rounded-xl bg-purple-100 border border-purple-300 px-3 py-1 text-xs font-extrabold text-purple-800">
                            <Sparkles className="w-3.5 h-3.5" />
                            Band {firstItem.band}/9
                          </span>
                          {hasTeacherReview && (
                            <span className="inline-flex items-center gap-1 rounded-xl bg-emerald-100 border border-emerald-300 px-2.5 py-0.5 text-xs font-bold text-emerald-800">
                              Giáo viên chấm
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-xl bg-amber-100 border border-amber-300 px-3 py-1 text-xs font-extrabold text-amber-800 animate-pulse">
                          <Sparkles className="w-3.5 h-3.5" />
                          AI đang chấm…
                        </span>
                      );
                    })()
                  ) : (
                    <span
                      className={`inline-flex items-center gap-1 rounded-xl border px-3 py-1 text-xs font-extrabold ${
                        qResult.earned === qResult.max && qResult.max > 0
                          ? "bg-emerald-100 border-emerald-300 text-emerald-800"
                          : "bg-rose-100 border-rose-300 text-rose-800"
                      }`}
                    >
                      {qResult.earned === qResult.max && qResult.max > 0 ? (
                        <CheckCircle2 className="w-3.5 h-3.5" />
                      ) : (
                        <XCircle className="w-3.5 h-3.5" />
                      )}
                      {qResult.earned} / {qResult.max} điểm
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* Prompt (Chỉ dẫn) */}
            {q.prompt && (
              <p className="text-sm font-semibold text-brand-600 mb-3 italic">
                {q.prompt}
              </p>
            )}

            {/* Stimulus text (Ngữ cảnh văn bản) */}
            {!hideStimulus && q.stimulus_text && (
              <div
                className="mb-4 rounded-xl border border-line bg-surface-alt p-4 text-sm leading-relaxed text-ink [&_img]:max-w-full [&_img]:h-auto [&_img]:mx-auto [&_img]:rounded-lg [&_p]:my-1"
                dangerouslySetInnerHTML={{ __html: sanitizeStimulusHtml(q.stimulus_text) }}
              />
            )}

            {/* Stimulus audio (Ngữ cảnh âm thanh) */}
            {!hideStimulus && q.stimulus_audio_url && (
              <div className="mb-4 flex items-center gap-3 rounded-xl border border-line bg-surface-alt p-3">
                <Volume2 className="h-5 w-5 text-brand-600 shrink-0" />
                <audio
                  controls
                  src={q.stimulus_audio_url}
                  className="w-full h-8"
                />
              </div>
            )}

            {/* Nội dung tương tác theo dạng câu hỏi */}
            <div className="mt-4">
              {/* 1. *_MC */}
              {category.endsWith("_MC") && (
                <div className="space-y-4">
                  {(Array.isArray(content.sub_questions)
                    ? content.sub_questions
                    : []
                  ).map((sub: any, subIndex: number) => {
                    const subId = String(sub.id);
                    const currentAnswer = (
                      (answers[q.id] as Record<string, string>) || {}
                    )[subId];
                    const itemResult = qResult?.items?.find(
                      (it) => it.key === subId
                    );

                    return (
                      <div
                        key={subId || subIndex}
                        className={`rounded-xl border p-4 transition-all ${
                          itemResult
                            ? itemResult.correct
                              ? "border-emerald-300 bg-emerald-50/40"
                              : "border-rose-300 bg-rose-50/40"
                            : "border-line-soft bg-surface-alt"
                        }`}
                      >
                        {/* Sub question text */}
                        <div className="flex items-start gap-2 mb-3">
                          <span className="font-bold text-brand-600 text-sm">
                            {subIndex + 1}.
                          </span>
                          <span className="font-medium text-ink text-sm">
                            {sub.text}
                          </span>
                        </div>

                        {/* Sub audio if exists */}
                        {sub.audio_url && (
                          <div className="mb-3 flex items-center gap-2">
                            <Volume2 className="h-4 w-4 text-brand-600" />
                            <audio
                              controls
                              src={sub.audio_url}
                              className="w-full h-7"
                            />
                          </div>
                        )}

                        {/* 4 options A-D */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                          {["A", "B", "C", "D"].map((optKey) => {
                            const optText =
                              sub[`option_${optKey.toLowerCase()}`];
                            if (!optText) return null;
                            const isSelected = currentAnswer === optKey;
                            const isExpected =
                              itemResult &&
                              String(itemResult.expected).toUpperCase() ===
                                optKey;

                            let optBorder = "border-line bg-white";
                            if (isSelected) {
                              optBorder =
                                itemResult
                                  ? itemResult.correct
                                    ? "border-2 border-emerald-600 bg-emerald-100/60 font-bold text-emerald-900"
                                    : "border-2 border-rose-600 bg-rose-100/60 font-bold text-rose-900"
                                  : "border-2 border-brand-600 bg-brand-50 font-bold text-brand-600";
                            } else if (isExpected && !itemResult.correct) {
                              optBorder =
                                "border-2 border-dashed border-emerald-600 bg-emerald-50 font-bold text-emerald-800";
                            }

                            return (
                              <button
                                key={optKey}
                                type="button"
                                disabled={isReadonly}
                                onClick={() => {
                                  if (isReadonly) return;
                                  const updated = setAnswerPart(
                                    (answers[q.id] as Record<string, unknown>) ||
                                      {},
                                    subId,
                                    optKey
                                  );
                                  onChange(q.id, updated);
                                }}
                                className={`flex items-center gap-3 rounded-xl border p-3 text-left text-sm transition-all ${optBorder} ${
                                  !isReadonly ? "hover:border-brand-600 cursor-pointer" : ""
                                }`}
                              >
                                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border border-current font-bold text-xs">
                                  {optKey}
                                </span>
                                <span className="flex-1">{optText}</span>
                                {itemResult && (
                                  <>
                                    {isSelected && itemResult.correct && (
                                      <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
                                    )}
                                    {isSelected && !itemResult.correct && (
                                      <XCircle className="w-4 h-4 text-rose-700 shrink-0" />
                                    )}
                                    {!isSelected && isExpected && (
                                      <span className="text-xs font-bold text-emerald-700 shrink-0">
                                        (Đáp án đúng)
                                      </span>
                                    )}
                                  </>
                                )}
                              </button>
                            );
                          })}
                        </div>

                        {/* Expected text if student answered wrongly */}
                        {itemResult && !itemResult.correct && (
                          <div className="mt-2.5 flex items-center gap-1.5 text-xs font-bold text-rose-700">
                            <AlertCircle className="w-4 h-4 shrink-0" />
                            <span>
                              Đáp án đúng: {String(itemResult.expected)}
                            </span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* 2. *_FILL_IN */}
              {category.endsWith("_FILL_IN") && (
                <div className="space-y-4">
                  {/* Option Bank Preview if applicable */}
                  {content.fill_subtype === "OPTION_BANK" &&
                    Array.isArray(content.option_bank) &&
                    content.option_bank.length > 0 && (
                      <div className="rounded-xl border border-line bg-surface-alt p-3">
                        <span className="text-xs font-bold uppercase tracking-wider text-brand-600 block mb-2">
                          Ngân hàng từ:
                        </span>
                        <div className="flex flex-wrap gap-2">
                          {content.option_bank.map((word: string, wIdx: number) => (
                            <span
                              key={wIdx}
                              className="rounded-lg border border-line bg-white px-2.5 py-1 text-xs font-semibold text-brand-600 shadow-2xs"
                            >
                              {word}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                  {/* Passage with gaps */}
                  <div className="rounded-xl border border-line-soft bg-surface-alt p-4 text-sm leading-loose text-ink">
                    {(Array.isArray(content.passage_parts)
                      ? content.passage_parts
                      : []
                    ).map((part: string, pIdx: number) => {
                      const gapIdx = pIdx;
                      const hasGap = gapIdx < (content.gap_count || 0);
                      const currentAnswers = Array.isArray(answers[q.id])
                        ? (answers[q.id] as string[])
                        : [];
                      const gapVal = currentAnswers[gapIdx] || "";
                      const gapResult = qResult?.items?.find(
                        (it) => it.key === `gap_${gapIdx}`
                      ) || qResult?.items?.[gapIdx];

                      return (
                        <span key={pIdx}>
                          {part}
                          {hasGap && (
                            <span className="inline-block mx-1.5 my-1 align-middle">
                              {content.fill_subtype === "INLINE_SELECT" ? (
                                <select
                                  disabled={isReadonly}
                                  value={gapVal}
                                  onChange={(e) => {
                                    const next = setAnswerPart(
                                      currentAnswers,
                                      gapIdx,
                                      e.target.value
                                    );
                                    onChange(q.id, next);
                                  }}
                                  className={`rounded-lg border px-2.5 py-1 text-xs font-bold transition-all ${
                                    gapResult
                                      ? gapResult.correct
                                        ? "border-emerald-600 bg-emerald-100 text-emerald-900"
                                        : "border-rose-600 bg-rose-100 text-rose-900"
                                      : "border-brand-600 bg-white text-brand-600"
                                  }`}
                                >
                                  <option value="">-- Chọn ô {gapIdx + 1} --</option>
                                  {(
                                    content.inline_options_per_gap?.find(
                                      (g: any) => g.gap_index === gapIdx
                                    )?.options || []
                                  ).map((opt: string, oIdx: number) => (
                                    <option key={oIdx} value={opt}>
                                      {opt}
                                    </option>
                                  ))}
                                </select>
                              ) : content.fill_subtype === "OPTION_BANK" ? (
                                <select
                                  disabled={isReadonly}
                                  value={gapVal}
                                  onChange={(e) => {
                                    const next = setAnswerPart(
                                      currentAnswers,
                                      gapIdx,
                                      e.target.value
                                    );
                                    onChange(q.id, next);
                                  }}
                                  className={`rounded-lg border px-2.5 py-1 text-xs font-bold transition-all ${
                                    gapResult
                                      ? gapResult.correct
                                        ? "border-emerald-600 bg-emerald-100 text-emerald-900"
                                        : "border-rose-600 bg-rose-100 text-rose-900"
                                      : "border-brand-600 bg-white text-brand-600"
                                  }`}
                                >
                                  <option value="">-- Chọn từ --</option>
                                  {(content.option_bank || []).map(
                                    (opt: string, oIdx: number) => (
                                      <option key={oIdx} value={opt}>
                                        {opt}
                                      </option>
                                    )
                                  )}
                                </select>
                              ) : (
                                <input
                                  type="text"
                                  disabled={isReadonly}
                                  value={gapVal}
                                  onChange={(e) => {
                                    const next = setAnswerPart(
                                      currentAnswers,
                                      gapIdx,
                                      e.target.value
                                    );
                                    onChange(q.id, next);
                                  }}
                                  placeholder={`[Ô ${gapIdx + 1}]`}
                                  className={`w-32 rounded-lg border px-2.5 py-1 text-xs font-medium transition-all ${
                                    gapResult
                                      ? gapResult.correct
                                        ? "border-emerald-600 bg-emerald-100 text-emerald-900"
                                        : "border-rose-600 bg-rose-100 text-rose-900"
                                      : "border-line bg-white text-ink focus:border-brand-600"
                                  }`}
                                />
                              )}

                              {gapResult && !gapResult.correct && (
                                <span className="ml-1 inline-block text-xs font-bold text-rose-700 bg-rose-50 border border-rose-200 rounded px-1.5 py-0.5">
                                  Đáp án: {String(gapResult.expected)}
                                </span>
                              )}
                            </span>
                          )}
                        </span>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* 3. *_ORDERING */}
              {category.endsWith("_ORDERING") && (() => {
                const currentOrder = Array.isArray(answers[q.id])
                  ? (answers[q.id] as string[])
                  : [];
                const allItems = Array.isArray(content.items)
                  ? (content.items as string[])
                  : [];
                const itemResult = qResult?.items?.[0];

                return (
                  <div className="space-y-4">
                    {/* Dòng kết quả sắp xếp của học sinh */}
                    <div className="rounded-xl border border-line-soft bg-surface-alt p-4">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-bold uppercase tracking-wider text-brand-600">
                          Dòng đáp án của bạn:
                        </span>
                        {!isReadonly && currentOrder.length > 0 && (
                          <button
                            type="button"
                            onClick={() => onChange(q.id, [])}
                            className="inline-flex items-center gap-1 text-xs font-semibold text-brand-700 hover:underline cursor-pointer"
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                            Làm lại / Xoá hết
                          </button>
                        )}
                      </div>

                      <div className="min-h-12 flex flex-wrap gap-2 items-center rounded-lg border-2 border-dashed border-line bg-white p-2.5">
                        {currentOrder.length === 0 ? (
                          <span className="text-xs text-ink-muted italic">
                            (Bấm vào các mảnh phía dưới để xếp theo thứ tự)
                          </span>
                        ) : (
                          currentOrder.map((piece, pIdx) => (
                            <button
                              key={pIdx}
                              type="button"
                              disabled={isReadonly}
                              onClick={() => {
                                if (isReadonly) return;
                                const next = [...currentOrder];
                                next.splice(pIdx, 1);
                                onChange(q.id, next);
                              }}
                              className={`rounded-lg border px-3 py-1.5 text-xs font-bold transition-all ${
                                !isReadonly
                                  ? "bg-brand-50 border-brand-600 text-brand-600 hover:bg-rose-100 hover:border-rose-400 hover:text-rose-800 cursor-pointer"
                                  : "bg-gray-100 border-gray-300 text-gray-700"
                              }`}
                              title={!isReadonly ? "Bấm để gỡ mảnh này" : undefined}
                            >
                              {piece}
                            </button>
                          ))
                        )}
                      </div>
                    </div>

                    {/* Danh sách các mảnh để bấm chọn */}
                    {!isReadonly && (
                      <div className="rounded-xl border border-line-soft bg-surface-alt p-4">
                        <span className="text-xs font-bold uppercase tracking-wider text-ink-muted block mb-2.5">
                          Các mảnh có sẵn (bấm để thêm vào dòng đáp án):
                        </span>
                        <div className="flex flex-wrap gap-2">
                          {allItems.map((itemStr, itIdx) => {
                            const countInItems = allItems.filter(
                              (x) => x === itemStr
                            ).length;
                            const countInAnswer = currentOrder.filter(
                              (x) => x === itemStr
                            ).length;
                            const isAvailable = countInAnswer < countInItems;

                            return (
                              <button
                                key={itIdx}
                                type="button"
                                disabled={!isAvailable}
                                onClick={() => {
                                  if (!isAvailable) return;
                                  onChange(q.id, [...currentOrder, itemStr]);
                                }}
                                className={`rounded-lg border px-3 py-1.5 text-xs font-bold transition-all ${
                                  isAvailable
                                    ? "bg-white border-line text-ink hover:border-brand-600 hover:bg-surface-alt cursor-pointer shadow-2xs"
                                    : "bg-gray-100 border-gray-200 text-gray-400 opacity-50 cursor-not-allowed"
                                }`}
                              >
                                {itemStr}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Hiển thị kết quả đúng/sai */}
                    {itemResult && (
                      <div
                        className={`rounded-xl border p-3 text-xs font-semibold ${
                          itemResult.correct
                            ? "border-emerald-300 bg-emerald-50 text-emerald-800"
                            : "border-rose-300 bg-rose-50 text-rose-800"
                        }`}
                      >
                        {itemResult.correct ? (
                          <div className="flex items-center gap-1.5">
                            <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
                            <span>Chính xác! Thứ tự đúng.</span>
                          </div>
                        ) : (
                          <div className="space-y-1">
                            <div className="flex items-center gap-1.5 font-bold">
                              <XCircle className="w-4 h-4 text-rose-700 shrink-0" />
                              <span>Thứ tự chưa chính xác.</span>
                            </div>
                            <div className="font-bold text-rose-900">
                              Đáp án đúng:{" "}
                              {Array.isArray(itemResult.expected)
                                ? itemResult.expected.join(" ")
                                : String(itemResult.expected)}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* 4. *_MATCHING */}
              {category.endsWith("_MATCHING") && (() => {
                const currentPairs = (answers[q.id] as Record<string, string>) || {};
                const leftItems: any[] = Array.isArray(content.left)
                  ? content.left
                  : [];
                const rightOptions: string[] = Array.isArray(content.right)
                  ? content.right
                  : [];

                return (
                  <div className="space-y-3">
                    {leftItems.map((leftObj: any, lIdx: number) => {
                      const leftId = String(leftObj.id);
                      const currentRight = currentPairs[leftId] || "";
                      const itemResult = qResult?.items?.find(
                        (it) => it.key === leftId
                      );

                      return (
                        <div
                          key={leftId || lIdx}
                          className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border p-3.5 transition-all ${
                            itemResult
                              ? itemResult.correct
                                ? "border-emerald-300 bg-emerald-50/40"
                                : "border-rose-300 bg-rose-50/40"
                              : "border-line-soft bg-surface-alt"
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-line-soft text-xs font-bold text-brand-600">
                              {lIdx + 1}
                            </span>
                            <span className="font-semibold text-sm text-ink">
                              {leftObj.text}
                            </span>
                          </div>

                          <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                            <select
                              disabled={isReadonly}
                              value={currentRight}
                              onChange={(e) => {
                                const next = setAnswerPart(
                                  currentPairs,
                                  leftId,
                                  e.target.value
                                );
                                onChange(q.id, next);
                              }}
                              className={`rounded-lg border px-3 py-1.5 text-xs font-bold transition-all ${
                                itemResult
                                  ? itemResult.correct
                                    ? "border-emerald-600 bg-emerald-100 text-emerald-900"
                                    : "border-rose-600 bg-rose-100 text-rose-900"
                                  : "border-brand-600 bg-white text-brand-600"
                              }`}
                            >
                              <option value="">-- Chọn ghép cặp --</option>
                              {rightOptions.map((rOpt: string, rIdx: number) => (
                                <option key={rIdx} value={rOpt}>
                                  {rOpt}
                                </option>
                              ))}
                            </select>

                            {itemResult && !itemResult.correct && (
                              <span className="text-xs font-bold text-rose-700 bg-rose-50 border border-rose-200 rounded px-2 py-1">
                                Đáp án đúng: {String(itemResult.expected)}
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })()}

              {/* 5. *_FLASHCARD_SET */}
              {category.endsWith("_FLASHCARD_SET") && (() => {
                const currentFlash =
                  (answers[q.id] as Record<string, string>) || {};
                const fcIds: string[] = Array.isArray(content.flashcard_ids)
                  ? content.flashcard_ids
                  : [];
                const isReading = category.startsWith("READING_");

                return (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {fcIds.map((fcId, fcIdx) => {
                      const card = flashcardMap.get(fcId);
                      const currentVal = currentFlash[fcId] || "";
                      const itemResult = qResult?.items?.find(
                        (it) => it.key === fcId
                      );

                      return (
                        <div
                          key={fcId || fcIdx}
                          className={`flex flex-col justify-between rounded-xl border p-4 transition-all ${
                            itemResult
                              ? itemResult.correct
                                ? "border-emerald-300 bg-emerald-50/40"
                                : "border-rose-300 bg-rose-50/40"
                              : "border-line-soft bg-surface-alt"
                          }`}
                        >
                          <div>
                            {card?.image_url && (
                              <div className="mb-3 flex justify-center">
                                <img
                                  src={card.image_url}
                                  alt={card.vietnamese_name || "Flashcard"}
                                  className="h-32 object-contain rounded-lg border border-line-soft"
                                />
                              </div>
                            )}

                            {card?.vietnamese_name && (
                              <div className="mb-2 text-center">
                                <span className="font-headline font-bold text-base text-ink">
                                  {card.vietnamese_name}
                                </span>
                              </div>
                            )}

                            {card?.audio_url && (
                              <div className="mb-3 flex justify-center">
                                <audio
                                  controls
                                  src={card.audio_url}
                                  className="w-full h-7"
                                />
                              </div>
                            )}
                          </div>

                          <div className="mt-3 pt-3 border-t border-line-soft">
                            {isReading &&
                            Array.isArray(card?.options) &&
                            card.options.length > 0 ? (
                              <select
                                disabled={isReadonly}
                                value={currentVal}
                                onChange={(e) => {
                                  const next = setAnswerPart(
                                    currentFlash,
                                    fcId,
                                    e.target.value
                                  );
                                  onChange(q.id, next);
                                }}
                                className={`w-full rounded-lg border px-3 py-1.5 text-xs font-bold transition-all ${
                                  itemResult
                                    ? itemResult.correct
                                      ? "border-emerald-600 bg-emerald-100 text-emerald-900"
                                      : "border-rose-600 bg-rose-100 text-rose-900"
                                    : "border-brand-600 bg-white text-brand-600"
                                }`}
                              >
                                <option value="">-- Chọn từ tiếng Anh --</option>
                                {card.options.map((opt: string, oIdx: number) => (
                                  <option key={oIdx} value={opt}>
                                    {opt}
                                  </option>
                                ))}
                              </select>
                            ) : (
                              <input
                                type="text"
                                disabled={isReadonly}
                                value={currentVal}
                                onChange={(e) => {
                                  const next = setAnswerPart(
                                    currentFlash,
                                    fcId,
                                    e.target.value
                                  );
                                  onChange(q.id, next);
                                }}
                                placeholder="Gõ từ tiếng Anh..."
                                className={`w-full rounded-lg border px-3 py-1.5 text-xs font-medium transition-all ${
                                  itemResult
                                    ? itemResult.correct
                                      ? "border-emerald-600 bg-emerald-100 text-emerald-900 font-bold"
                                      : "border-rose-600 bg-rose-100 text-rose-900 font-bold"
                                    : "border-line bg-white text-ink focus:border-brand-600"
                                }`}
                              />
                            )}

                            {itemResult && !itemResult.correct && (
                              <div className="mt-2 text-xs font-bold text-rose-700">
                                Đáp án đúng: {String(itemResult.expected)}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })()}

              {/* 6. WRITING_FREE_TYPING_BLANKS */}
              {category === "WRITING_FREE_TYPING_BLANKS" && (() => {
                const currentAnswers = Array.isArray(answers[q.id])
                  ? (answers[q.id] as string[])
                  : [];
                const parts: string[] = Array.isArray(content.passage_parts)
                  ? content.passage_parts
                  : [];
                const gapCount: number = Number(content.gap_count) || 0;

                return (
                  <div className="rounded-xl border border-line-soft bg-surface-alt p-4 text-sm leading-loose text-ink">
                    {parts.map((part: string, pIdx: number) => {
                      const gapIdx = pIdx;
                      const hasGap = gapIdx < gapCount;
                      const gapVal = currentAnswers[gapIdx] || "";
                      const gapResult = qResult?.items?.find(
                        (it) => it.key === `gap_${gapIdx}`
                      ) || qResult?.items?.[gapIdx];

                      return (
                        <span key={pIdx}>
                          {part}
                          {hasGap && (
                            <span className="inline-block mx-1.5 my-1 align-middle">
                              <input
                                type="text"
                                disabled={isReadonly}
                                value={gapVal}
                                onChange={(e) => {
                                  const next = setAnswerPart(
                                    currentAnswers,
                                    gapIdx,
                                    e.target.value
                                  );
                                  onChange(q.id, next);
                                }}
                                placeholder={`[Ô ${gapIdx + 1}]`}
                                className={`w-32 rounded-lg border px-2.5 py-1 text-xs font-medium transition-all ${
                                  gapResult
                                    ? gapResult.correct
                                      ? "border-emerald-600 bg-emerald-100 text-emerald-900 font-bold"
                                      : "border-rose-600 bg-rose-100 text-rose-900 font-bold"
                                    : "border-line bg-white text-ink focus:border-brand-600"
                                }`}
                              />
                              {gapResult && !gapResult.correct && (
                                <span className="ml-1 inline-block text-xs font-bold text-rose-700 bg-rose-50 border border-rose-200 rounded px-1.5 py-0.5">
                                  Đáp án: {String(gapResult.expected)}
                                </span>
                              )}
                            </span>
                          )}
                        </span>
                      );
                    })}
                  </div>
                );
              })()}

              {/* 7. WRITING_SENTENCE_REWRITE */}
              {category === "WRITING_SENTENCE_REWRITE" && (() => {
                const currentVal =
                  typeof answers[q.id] === "string"
                    ? (answers[q.id] as string)
                    : "";
                const itemResult = qResult?.items?.[0];

                return (
                  <div className="space-y-3">
                    {content.original_sentence && (
                      <div className="rounded-xl border border-line-soft bg-surface-alt p-3 text-sm font-medium text-ink">
                        <span className="text-xs font-bold uppercase text-brand-600 block mb-1">
                          Câu gốc:
                        </span>
                        {content.original_sentence}
                      </div>
                    )}

                    <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                      {content.starting_cue && (
                        <span className="shrink-0 font-bold text-sm text-brand-600 bg-brand-50 px-3 py-2 rounded-xl border border-brand-300">
                          {content.starting_cue}
                        </span>
                      )}
                      <input
                        type="text"
                        disabled={isReadonly}
                        value={currentVal}
                        onChange={(e) => onChange(q.id, e.target.value)}
                        placeholder="Viết lại câu tiếp theo gợi ý..."
                        className={`flex-1 rounded-xl border p-2.5 text-sm transition-all ${
                          itemResult
                            ? itemResult.correct
                              ? "border-emerald-600 bg-emerald-50 text-emerald-900 font-bold"
                              : "border-rose-600 bg-rose-50 text-rose-900 font-bold"
                            : "border-line bg-white text-ink focus:border-brand-600"
                        }`}
                      />
                    </div>

                    {itemResult && !itemResult.correct && (
                      <div className="flex items-center gap-1.5 text-xs font-bold text-rose-700">
                        <AlertCircle className="w-4 h-4 shrink-0" />
                        <span>Đáp án đúng: {String(itemResult.expected)}</span>
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* 8. WRITING_ESSAY */}
              {category === "WRITING_ESSAY" && (() => {
                const currentVal =
                  typeof answers[q.id] === "string"
                    ? (answers[q.id] as string)
                    : "";
                const words = currentVal.trim()
                  ? currentVal.trim().split(/\s+/).length
                  : 0;
                const minWords = Number(content.min_words) || 0;
                const itemResult = qResult?.items?.[0];

                return (
                  <div className="space-y-3">
                    <textarea
                      rows={7}
                      disabled={isReadonly}
                      value={currentVal}
                      onChange={(e) => onChange(q.id, e.target.value)}
                      placeholder="Nhập bài viết tự luận của bạn..."
                      className={`w-full rounded-xl border p-3.5 text-sm leading-relaxed transition-all ${
                        isReadonly
                          ? "bg-gray-50 border-gray-300 text-gray-800"
                          : "border-line bg-white text-ink focus:border-brand-600"
                      }`}
                    />

                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs font-semibold">
                      <span
                        className={
                          minWords > 0 && words >= minWords
                            ? "text-emerald-700 font-bold"
                            : "text-ink-muted"
                        }
                      >
                        Số từ: {words}
                        {minWords > 0 && ` / tối thiểu ${minWords} từ`}
                      </span>

                      {itemResult && (
                        <div className="space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            {typeof itemResult.band === "number" ? (
                              <span className="font-bold text-purple-700">
                                Band {itemResult.band}/9
                              </span>
                            ) : (
                              <span className="font-bold text-amber-700">
                                AI đang chấm…
                              </span>
                            )}
                            {(itemResult.teacher_score !== undefined && itemResult.teacher_score !== null || itemResult.teacher_feedback) && (
                              <span className="inline-block px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                                Giáo viên chấm
                              </span>
                            )}
                          </div>
                          {itemResult.teacher_feedback && (
                            <div className="text-xs bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-lg p-2.5">
                              <span className="font-bold block">Nhận xét của giáo viên:</span>
                              <span className="whitespace-pre-wrap">{itemResult.teacher_feedback}</span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })()}

              {/* 9. WRITING_SHORT_ANSWER */}
              {category === "WRITING_SHORT_ANSWER" && (() => {
                const currentShort =
                  (answers[q.id] as Record<string, string>) || {};
                const subs: any[] = Array.isArray(content.sub_questions)
                  ? content.sub_questions
                  : [];

                return (
                  <div className="space-y-3.5">
                    {subs.map((sub: any, sIdx: number) => {
                      const subId = String(sub.id);
                      const currentVal = currentShort[subId] || "";
                      const itemResult = qResult?.items?.find(
                        (it) => it.key === subId
                      );

                      return (
                        <div
                          key={subId || sIdx}
                          className="rounded-xl border border-line-soft bg-surface-alt p-3.5 space-y-2"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <span className="font-semibold text-sm text-ink">
                              {sIdx + 1}. {sub.text}
                            </span>
                            {sub.max_words && (
                              <span className="text-xs text-ink-muted">
                                Tối đa {sub.max_words} từ
                              </span>
                            )}
                          </div>

                          <input
                            type="text"
                            disabled={isReadonly}
                            value={currentVal}
                            onChange={(e) => {
                              const next = setAnswerPart(
                                currentShort,
                                subId,
                                e.target.value
                              );
                              onChange(q.id, next);
                            }}
                            placeholder="Nhập câu trả lời ngắn..."
                            className={`w-full rounded-lg border p-2 text-xs font-medium transition-all ${
                              isReadonly
                                ? "bg-gray-50 border-gray-300 text-gray-800"
                                : "border-line bg-white text-ink focus:border-brand-600"
                            }`}
                          />

                          {itemResult && (
                            <div className="text-xs space-y-1">
                              <div className="flex items-center gap-2 flex-wrap font-bold">
                                {typeof itemResult.band === "number" ? (
                                  <span className="text-purple-700">
                                    Band {itemResult.band}/9
                                  </span>
                                ) : (
                                  <span className="text-amber-700">
                                    AI đang chấm…
                                  </span>
                                )}
                                {(itemResult.teacher_score !== undefined && itemResult.teacher_score !== null || itemResult.teacher_feedback) && (
                                  <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                                    Giáo viên chấm
                                  </span>
                                )}
                              </div>
                              {itemResult.teacher_feedback && (
                                <div className="text-xs bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-lg p-2">
                                  <span className="font-bold block">Nhận xét của giáo viên:</span>
                                  <span className="whitespace-pre-wrap">{itemResult.teacher_feedback}</span>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                );
              })()}

              {/* Speaking Questions */}
              {allowSpeaking && category.startsWith("SPEAKING_") && (
                <div className="space-y-4">
                  <SpeakingRecorder
                    value={typeof answers[q.id] === "string" ? (answers[q.id] as string) : ""}
                    onChange={(url) => onChange(q.id, url)}
                    disabled={isReadonly}
                    prepSeconds={content.prep_time_seconds}
                    speakingSeconds={content.speaking_time_seconds}
                    readAloudText={content.read_aloud_text}
                    topicHints={content.topic_hints}
                  />

                  {/* Ở chế độ kết quả: hiện audio đã nộp + điểm AI (items[0].score) nếu có */}
                  {qResult && (
                    <div className="rounded-xl border border-line-soft bg-surface-alt p-3 space-y-2">
                      <div className="text-xs font-bold text-brand-600">Bản ghi âm bài làm:</div>
                      {Boolean(answers[q.id] || qResult.items?.[0]?.given) ? (
                        <audio
                          controls
                          src={String(answers[q.id] || qResult.items?.[0]?.given)}
                          className="w-full h-8"
                        />
                      ) : (
                        <p className="text-xs text-ink-subtle italic">Không có bản ghi âm.</p>
                      )}
                      {qResult.items?.[0] && (
                        <div className="text-xs space-y-1 mt-1">
                          <div className="flex items-center gap-2 flex-wrap font-bold">
                            {(qResult.items[0] as any).score !== undefined ? (
                              <span className="text-purple-700">
                                Điểm: {(qResult.items[0] as any).score}
                              </span>
                            ) : typeof qResult.items[0].band === "number" ? (
                              <span className="text-purple-700">
                                Band: {qResult.items[0].band}/9
                              </span>
                            ) : (
                              <span className="text-amber-700">AI đang chấm…</span>
                            )}
                            {((qResult.items[0] as any).teacher_score !== undefined && (qResult.items[0] as any).teacher_score !== null || (qResult.items[0] as any).teacher_feedback) && (
                              <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                                Giáo viên chấm
                              </span>
                            )}
                          </div>
                          {(qResult.items[0] as any).teacher_feedback && (
                            <div className="text-xs bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-lg p-2">
                              <span className="font-bold block">Nhận xét của giáo viên:</span>
                              <span className="whitespace-pre-wrap">{(qResult.items[0] as any).teacher_feedback}</span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Dạng khác không hỗ trợ */}
              {![
                "_MC",
                "_FILL_IN",
                "_ORDERING",
                "_MATCHING",
                "_FLASHCARD_SET",
                "WRITING_FREE_TYPING_BLANKS",
                "WRITING_SENTENCE_REWRITE",
                "WRITING_ESSAY",
                "WRITING_SHORT_ANSWER",
              ].some((pattern) =>
                pattern.startsWith("_")
                  ? category.endsWith(pattern)
                  : category === pattern
              ) && !(allowSpeaking && category.startsWith("SPEAKING_")) && (
                <div className="rounded-xl border border-dashed border-amber-300 bg-amber-50 p-4 text-center text-xs font-semibold text-amber-800">
                  Dạng câu hỏi chưa hỗ trợ
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
