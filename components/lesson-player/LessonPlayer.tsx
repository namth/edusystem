"use client";

import { useMemo } from "react";
import { emptyAnswerFor, setAnswerPart } from "@/lib/lesson-player";
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
}

export default function LessonPlayer({
  questions,
  flashcards,
  answers,
  onChange,
  results,
  disabled = false,
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
                : "border-[#d8c2b6]"
            }`}
          >
            {/* Header: Khối số thứ tự, Kỹ năng, Điểm số */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#ede0d9] pb-4 mb-5">
              <div className="flex items-center gap-2.5">
                <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#6d3807] text-sm font-bold text-white shadow-2xs">
                  {qIndex + 1}
                </span>
                <span className="font-headline font-bold text-[#211a16] text-base md:text-lg">
                  Khối {qIndex + 1}
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
                      return hasBand ? (
                        <span className="inline-flex items-center gap-1 rounded-xl bg-purple-100 border border-purple-300 px-3 py-1 text-xs font-extrabold text-purple-800">
                          <Sparkles className="w-3.5 h-3.5" />
                          Band {firstItem.band}/9
                        </span>
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
              <p className="text-sm font-semibold text-[#6d3807] mb-3 italic">
                {q.prompt}
              </p>
            )}

            {/* Stimulus text (Ngữ cảnh văn bản) */}
            {q.stimulus_text && (
              <div className="mb-4 rounded-xl border border-[#d8c2b6] bg-[#fff8f5] p-4 text-sm leading-relaxed text-[#211a16] whitespace-pre-wrap">
                {q.stimulus_text}
              </div>
            )}

            {/* Stimulus audio (Ngữ cảnh âm thanh) */}
            {q.stimulus_audio_url && (
              <div className="mb-4 flex items-center gap-3 rounded-xl border border-[#d8c2b6] bg-[#fff8f5] p-3">
                <Volume2 className="h-5 w-5 text-[#6d3807] shrink-0" />
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
                            : "border-[#ede0d9] bg-[#fffdfc]"
                        }`}
                      >
                        {/* Sub question text */}
                        <div className="flex items-start gap-2 mb-3">
                          <span className="font-bold text-[#6d3807] text-sm">
                            {subIndex + 1}.
                          </span>
                          <span className="font-medium text-[#211a16] text-sm">
                            {sub.text}
                          </span>
                        </div>

                        {/* Sub audio if exists */}
                        {sub.audio_url && (
                          <div className="mb-3 flex items-center gap-2">
                            <Volume2 className="h-4 w-4 text-[#6d3807]" />
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

                            let optBorder = "border-[#d8c2b6] bg-white";
                            if (isSelected) {
                              optBorder =
                                itemResult
                                  ? itemResult.correct
                                    ? "border-2 border-emerald-600 bg-emerald-100/60 font-bold text-emerald-900"
                                    : "border-2 border-rose-600 bg-rose-100/60 font-bold text-rose-900"
                                  : "border-2 border-[#6d3807] bg-[#fff1ea] font-bold text-[#6d3807]";
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
                                  !isReadonly ? "hover:border-[#6d3807] cursor-pointer" : ""
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
                      <div className="rounded-xl border border-[#d8c2b6] bg-[#fff8f5] p-3">
                        <span className="text-xs font-bold uppercase tracking-wider text-[#6d3807] block mb-2">
                          Ngân hàng từ:
                        </span>
                        <div className="flex flex-wrap gap-2">
                          {content.option_bank.map((word: string, wIdx: number) => (
                            <span
                              key={wIdx}
                              className="rounded-lg border border-[#d8c2b6] bg-white px-2.5 py-1 text-xs font-semibold text-[#6d3807] shadow-2xs"
                            >
                              {word}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                  {/* Passage with gaps */}
                  <div className="rounded-xl border border-[#ede0d9] bg-[#fffdfc] p-4 text-sm leading-loose text-[#211a16]">
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
                                      : "border-[#6d3807] bg-white text-[#6d3807]"
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
                                      : "border-[#6d3807] bg-white text-[#6d3807]"
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
                                      : "border-[#d8c2b6] bg-white text-[#211a16] focus:border-[#6d3807]"
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
                    <div className="rounded-xl border border-[#ede0d9] bg-[#fff8f5] p-4">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-bold uppercase tracking-wider text-[#6d3807]">
                          Dòng đáp án của bạn:
                        </span>
                        {!isReadonly && currentOrder.length > 0 && (
                          <button
                            type="button"
                            onClick={() => onChange(q.id, [])}
                            className="inline-flex items-center gap-1 text-xs font-semibold text-[#8a4f1e] hover:underline cursor-pointer"
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                            Làm lại / Xoá hết
                          </button>
                        )}
                      </div>

                      <div className="min-h-12 flex flex-wrap gap-2 items-center rounded-lg border-2 border-dashed border-[#d8c2b6] bg-white p-2.5">
                        {currentOrder.length === 0 ? (
                          <span className="text-xs text-[#52443a] italic">
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
                                  ? "bg-[#fff1ea] border-[#6d3807] text-[#6d3807] hover:bg-rose-100 hover:border-rose-400 hover:text-rose-800 cursor-pointer"
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
                      <div className="rounded-xl border border-[#ede0d9] bg-[#fffdfc] p-4">
                        <span className="text-xs font-bold uppercase tracking-wider text-[#52443a] block mb-2.5">
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
                                    ? "bg-white border-[#d8c2b6] text-[#211a16] hover:border-[#6d3807] hover:bg-[#fff8f5] cursor-pointer shadow-2xs"
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
                              : "border-[#ede0d9] bg-[#fffdfc]"
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#ede0d9] text-xs font-bold text-[#6d3807]">
                              {lIdx + 1}
                            </span>
                            <span className="font-semibold text-sm text-[#211a16]">
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
                                  : "border-[#6d3807] bg-white text-[#6d3807]"
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
                              : "border-[#ede0d9] bg-[#fffdfc]"
                          }`}
                        >
                          <div>
                            {card?.image_url && (
                              <div className="mb-3 flex justify-center">
                                <img
                                  src={card.image_url}
                                  alt={card.vietnamese_name || "Flashcard"}
                                  className="h-32 object-contain rounded-lg border border-[#ede0d9]"
                                />
                              </div>
                            )}

                            {card?.vietnamese_name && (
                              <div className="mb-2 text-center">
                                <span className="font-headline font-bold text-base text-[#211a16]">
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

                          <div className="mt-3 pt-3 border-t border-[#ede0d9]">
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
                                    : "border-[#6d3807] bg-white text-[#6d3807]"
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
                                    : "border-[#d8c2b6] bg-white text-[#211a16] focus:border-[#6d3807]"
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
                  <div className="rounded-xl border border-[#ede0d9] bg-[#fffdfc] p-4 text-sm leading-loose text-[#211a16]">
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
                                    : "border-[#d8c2b6] bg-white text-[#211a16] focus:border-[#6d3807]"
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
                      <div className="rounded-xl border border-[#ede0d9] bg-[#fff8f5] p-3 text-sm font-medium text-[#211a16]">
                        <span className="text-xs font-bold uppercase text-[#6d3807] block mb-1">
                          Câu gốc:
                        </span>
                        {content.original_sentence}
                      </div>
                    )}

                    <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                      {content.starting_cue && (
                        <span className="shrink-0 font-bold text-sm text-[#6d3807] bg-[#fff1ea] px-3 py-2 rounded-xl border border-[#ffb782]">
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
                            : "border-[#d8c2b6] bg-white text-[#211a16] focus:border-[#6d3807]"
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
                          : "border-[#d8c2b6] bg-white text-[#211a16] focus:border-[#6d3807]"
                      }`}
                    />

                    <div className="flex items-center justify-between text-xs font-semibold">
                      <span
                        className={
                          minWords > 0 && words >= minWords
                            ? "text-emerald-700 font-bold"
                            : "text-[#52443a]"
                        }
                      >
                        Số từ: {words}
                        {minWords > 0 && ` / tối thiểu ${minWords} từ`}
                      </span>

                      {itemResult && (
                        <span>
                          {typeof itemResult.band === "number" ? (
                            <span className="font-bold text-purple-700">
                              Band {itemResult.band}/9
                            </span>
                          ) : (
                            <span className="font-bold text-amber-700">
                              AI đang chấm…
                            </span>
                          )}
                        </span>
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
                          className="rounded-xl border border-[#ede0d9] bg-[#fffdfc] p-3.5 space-y-2"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <span className="font-semibold text-sm text-[#211a16]">
                              {sIdx + 1}. {sub.text}
                            </span>
                            {sub.max_words && (
                              <span className="text-xs text-[#52443a]">
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
                                : "border-[#d8c2b6] bg-white text-[#211a16] focus:border-[#6d3807]"
                            }`}
                          />

                          {itemResult && (
                            <div className="text-xs font-bold">
                              {typeof itemResult.band === "number" ? (
                                <span className="text-purple-700">
                                  Band {itemResult.band}/9
                                </span>
                              ) : (
                                <span className="text-amber-700">
                                  AI đang chấm…
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                );
              })()}

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
              ) && (
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
