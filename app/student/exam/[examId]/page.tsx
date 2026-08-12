"use client";

import { useState, useEffect, useRef, memo } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabase";
import { evaluateWritingSubmission, evaluateSpeakingSubmission } from "@/lib/ai-engine";
import { getMediaStimulusInfo, parseSentenceRewriteCue } from "@/lib/question-content-types";
import { uploadAudioToSupabaseStorage } from "@/lib/audio-storage";
import {
  Timer,
  ArrowLeft,
  Star,
  CheckCircle2,
  Loader2,
  Play,
  Volume2,
  Mic,
  Square,
  MoveUp,
  MoveDown,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  Layers,
  RefreshCw,
  Radio,
  VolumeX,
  User,
  X,
} from "lucide-react";

interface QuestionItem {
  id: string;
  number: number;
  skill: "Reading" | "Listening" | "Writing" | "Speaking";
  category: string;
  prompt?: string;
  stimulus_text?: string;
  stimulus_audio_url?: string;
  flashcard_ids?: string[];
  options?: any;
  passage?: string;
  content: any;
}

// Memoized Stimulus HTML Renderer to prevent re-evaluating HTML on parent renders
const StimulusContentRenderer = memo(function StimulusContentRenderer({ html }: { html: string }) {
  // Replace &nbsp; with regular spaces so the browser can wrap text at word boundaries
  const sanitized = html.replace(/&nbsp;/g, " ").replace(/\u00A0/g, " ");
  return (
    <div
      className="p-6 md:p-8 rounded-2xl bg-white border border-[#d8c2b6] shadow-sm rich-stimulus-content"
      dangerouslySetInnerHTML={{ __html: sanitized }}
    />
  );
});

// Isolated Exam Countdown Timer Component to prevent 1-second parent page re-renders
const ExamCountdownTimer = memo(function ExamCountdownTimer({ initialSeconds }: { initialSeconds: number }) {
  const [secsLeft, setSecsLeft] = useState(initialSeconds);

  useEffect(() => {
    setSecsLeft(initialSeconds);
  }, [initialSeconds]);

  useEffect(() => {
    if (secsLeft <= 0) return;
    const timer = setInterval(() => {
      setSecsLeft((t) => (t > 0 ? t - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [initialSeconds]);

  const m = Math.floor(secsLeft / 60);
  const s = secsLeft % 60;
  const formatted = `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;

  const isWarning = secsLeft < 300;

  return (
    <div className={`flex items-center gap-2 font-mono text-sm font-extrabold px-4 py-2 rounded-xl border shadow-2xs transition-all ${
      isWarning
        ? "bg-rose-600 text-white border-rose-700 animate-pulse"
        : "bg-[#fff1ea] text-[#6d3807] border-2 border-[#ffb782]"
    }`}>
      <Timer className={`w-4 h-4 ${isWarning ? "text-white" : "text-[#6d3807]"}`} />
      <span className="tracking-wider">{formatted}</span>
    </div>
  );
});

interface QuestionItem {
  id: string;
  number: number;
  skill: "Reading" | "Listening" | "Writing" | "Speaking";
  category: string;
  prompt?: string;
  stimulus_text?: string;
  stimulus_audio_url?: string;
  flashcard_ids?: string[];
  content: any;
}

export default function ExamWorkspacePage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuth();
  const examId = params.examId as string;

  const [questions, setQuestions] = useState<QuestionItem[]>([]);
  const [examTitle, setExamTitle] = useState("IELTS Academic Mock Test");
  const [currentIdx, setCurrentIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [flagged, setFlagged] = useState<Record<string, boolean>>({});
  const [timeLeft, setTimeLeft] = useState(2720);
  const [showSidePanel, setShowSidePanel] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [submittedSubId, setSubmittedSubId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Audio Playback Tracking State (loading / playing per button ID)
  const [audioLoadingId, setAudioLoadingId] = useState<string | null>(null);
  const [audioPlayingId, setAudioPlayingId] = useState<string | null>(null);
  const currentAudioRef = useRef<HTMLAudioElement | null>(null);

  // Active Flashcard Index & Slide Direction per question
  const [flashcardIndexMap, setFlashcardIndexMap] = useState<Record<string, number>>({});
  const [slideDirectionMap, setSlideDirectionMap] = useState<Record<string, "next" | "prev">>({});

  // Active Selected Option Chip for Drag & Drop / Click Assignment
  const [activeSelectedChip, setActiveSelectedChip] = useState<string | null>(null);

  // Custom Pointer-Based Drag Engine State (ORDERING)
  const [activePointerDragIdx, setActivePointerDragIdx] = useState<number | null>(null);
  const [pointerHoverIdx, setPointerHoverIdx] = useState<number | null>(null);
  const [pointerPos, setPointerPos] = useState<{ x: number; y: number } | null>(null);
  const [pointerDragItemText, setPointerDragItemText] = useState<string | null>(null);
  const [pointerDragSize, setPointerDragSize] = useState<{ offsetX: number; offsetY: number; width: number; height: number } | null>(null);
  const pointerDragInfoRef = useRef<{ qId: string; startIdx: number; currentHoverIdx: number; items: string[] } | null>(null);
  // Custom Pointer Drag State for MATCHING Questions
  const [matchingDragState, setMatchingDragState] = useState<{
    qId: string;
    sourceSlotIdx: number | null;
    sourceBankWord: string | null;
    dragWordText: string;
  } | null>(null);
  const [matchingHoverSlotIdx, setMatchingHoverSlotIdx] = useState<number | null>(null);
  const [matchingPointerPos, setMatchingPointerPos] = useState<{ x: number; y: number } | null>(null);
  const [matchingDragSize, setMatchingDragSize] = useState<{ offsetX: number; offsetY: number; width: number; height: number } | null>(null);
  const matchingDragRef = useRef<{ qId: string; sourceSlotIdx: number | null; hoverSlotIdx: number | null; dragWordText: string } | null>(null);

  // Custom Pointer Drag State for FILL_IN Questions
  const [fillInDragState, setFillInDragState] = useState<{
    qId: string;
    sourceGapIdx: number | null;
    sourceBankWord: string | null;
    dragWordText: string;
  } | null>(null);
  const [fillInHoverGapIdx, setFillInHoverGapIdx] = useState<number | null>(null);
  const [fillInPointerPos, setFillInPointerPos] = useState<{ x: number; y: number } | null>(null);
  const [fillInDragSize, setFillInDragSize] = useState<{ offsetX: number; offsetY: number; width: number; height: number } | null>(null);
  const fillInDragRef = useRef<{ qId: string; sourceGapIdx: number | null; hoverGapIdx: number | null; dragWordText: string } | null>(null);

  // Microphone Recording State
  const [isRecordingMap, setIsRecordingMap] = useState<Record<string, boolean>>({});
  const [recordingTimerMap, setRecordingTimerMap] = useState<Record<string, number>>({});
  const [recordedAudioMap, setRecordedAudioMap] = useState<Record<string, string>>({});
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const speechRecognitionRef = useRef<any>(null);
  const recordingIntervalRef = useRef<any>(null);

  // ----------------------------------------------------
  // Load Specific Exam and Its Questions from Database
  // ----------------------------------------------------
  useEffect(() => {
    const fetchExamData = async () => {
      try {
        setLoading(true);
        const { data: examData, error: examErr } = await supabase
          .from("exams")
          .select("*")
          .eq("id", examId)
          .maybeSingle();

        if (examErr || !examData) {
          console.error("Exam load error:", examErr);
          setLoading(false);
          return;
        }

        setExamTitle(examData.title || "Đề Thi Thử 4 Kỹ Năng");
        setTimeLeft((examData.duration_minutes || 90) * 60);

        const qList: QuestionItem[] = [];
        let num = 1;

        if (examData.question_ids && Array.isArray(examData.question_ids) && examData.question_ids.length > 0) {
          const { data: qData, error: qErr } = await supabase
            .from("questions")
            .select("*")
            .in("id", examData.question_ids);

          if (!qErr && qData && qData.length > 0) {
            const qMap = new Map(qData.map((q: any) => [q.id, q]));
            examData.question_ids.forEach((id: string) => {
              const qRow = qMap.get(id);
              if (qRow) {
                const fcIds = qRow.flashcard_ids || qRow.content?.flashcard_ids || qRow.content?.flashcardIds || [];
                qList.push({
                  id: qRow.id,
                  number: num++,
                  skill: qRow.skill,
                  category: qRow.category,
                  prompt: qRow.prompt || "",
                  stimulus_text: qRow.stimulus_text || "",
                  stimulus_audio_url: qRow.stimulus_audio_url || "",
                  flashcard_ids: fcIds,
                  content: { ...qRow.content, flashcard_ids: fcIds },
                  options: qRow.options || qRow.content?.options || [],
                  passage: qRow.stimulus_text || "",
                });
              }
            });
          }
        }

        if (qList.length === 0) {
          const { data: qData } = await supabase.from("questions").select("*").order("id", { ascending: true });
          if (qData && qData.length > 0) {
            qData.forEach((qRow: any) => {
              const fcIds = qRow.flashcard_ids || qRow.content?.flashcard_ids || qRow.content?.flashcardIds || [];
              qList.push({
                id: qRow.id,
                number: num++,
                skill: qRow.skill,
                category: qRow.category,
                prompt: qRow.prompt || "",
                stimulus_text: qRow.stimulus_text || "",
                stimulus_audio_url: qRow.stimulus_audio_url || "",
                flashcard_ids: fcIds,
                content: { ...qRow.content, flashcard_ids: fcIds },
                options: qRow.options || qRow.content?.options || [],
                passage: qRow.stimulus_text || "",
              });
            });
          }
        }

        // Resolve Flashcards for any Flashcard questions from 'flashcards' table
        const allFcIds = new Set<string>();
        qList.forEach((q) => {
          if (q.category && q.category.includes("FLASHCARD")) {
            const ids: string[] = (q as any).flashcard_ids || q.content?.flashcard_ids || q.content?.flashcardIds || [];
            ids.forEach((id: string) => { if (id) allFcIds.add(id); });
          }
        });

        if (allFcIds.size > 0) {
          const { data: fcRows } = await supabase.from("flashcards").select("*").in("id", Array.from(allFcIds));
          if (fcRows && fcRows.length > 0) {
            const fcMap = new Map(fcRows.map((f: any) => [f.id, f]));
            qList.forEach((q) => {
              if (q.category && q.category.includes("FLASHCARD")) {
                const ids: string[] = (q as any).flashcard_ids || q.content?.flashcard_ids || q.content?.flashcardIds || [];
                const resolvedCards = ids.map((id: string) => {
                  const row = fcMap.get(id);
                  if (!row) return null;
                  return {
                    id: row.id,
                    vietnamese_name: row.vietnamese_name,
                    correct_english_word: row.correct_english_word,
                    options: row.options || [],
                    image_url: row.image_url,
                    audio_url: row.audio_url,
                  };
                }).filter(Boolean);

                if (resolvedCards.length > 0) {
                  q.content = { ...q.content, flashcard_ids: ids, flashcards_resolved: resolvedCards };
                }
              }
            });
          }
        }

        setQuestions(qList);
      } catch (err) {
        console.error("Exam load exception:", err);
      } finally {
        setLoading(false);
      }
    };

    if (examId) fetchExamData();
  }, [examId]);

  // Custom Pointer Drag Handler for ORDERING Questions
  const handleStartPointerDrag = (
    e: React.PointerEvent,
    qId: string,
    orderedKey: string,
    startIdx: number,
    itemText: string,
    currentOrderedItems: string[]
  ) => {
    if (e.button !== 0) return;
    if ((e.target as HTMLElement).closest("button")) return;

    e.preventDefault();
    e.stopPropagation();

    const targetEl = e.currentTarget as HTMLElement;
    const rect = targetEl.getBoundingClientRect();
    const offsetX = e.clientX - rect.left;
    const offsetY = e.clientY - rect.top;

    setPointerPos({ x: e.clientX, y: e.clientY });
    setActivePointerDragIdx(startIdx);
    setPointerHoverIdx(startIdx);
    setPointerDragItemText(itemText);
    setPointerDragSize({
      offsetX,
      offsetY,
      width: rect.width,
      height: rect.height,
    });

    document.body.style.cursor = "grabbing";
    document.body.style.userSelect = "none";

    pointerDragInfoRef.current = {
      qId,
      startIdx,
      currentHoverIdx: startIdx,
      items: [...currentOrderedItems],
    };

    const handlePointerMove = (moveEvt: PointerEvent) => {
      moveEvt.preventDefault();
      setPointerPos({ x: moveEvt.clientX, y: moveEvt.clientY });

      const el = document.elementFromPoint(moveEvt.clientX, moveEvt.clientY);
      if (el) {
        const orderItemEl = el.closest("[data-order-idx]");
        if (orderItemEl) {
          const targetIdx = parseInt(orderItemEl.getAttribute("data-order-idx") || "-1", 10);
          if (targetIdx >= 0 && pointerDragInfoRef.current) {
            if (pointerDragInfoRef.current.currentHoverIdx !== targetIdx) {
              pointerDragInfoRef.current.currentHoverIdx = targetIdx;
              setPointerHoverIdx(targetIdx);
            }
          }
        }
      }
    };

    const handlePointerUp = (upEvt: PointerEvent) => {
      upEvt.preventDefault();
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);

      document.body.style.cursor = "";
      document.body.style.userSelect = "";

      if (pointerDragInfoRef.current) {
        const { startIdx: sIdx, currentHoverIdx: hIdx, items } = pointerDragInfoRef.current;
        if (sIdx !== hIdx && sIdx >= 0 && hIdx >= 0 && hIdx < items.length) {
          const updated = [...items];
          const moved = updated.splice(sIdx, 1)[0];
          updated.splice(hIdx, 0, moved);
          handleUpdateAnswer(orderedKey, updated);
        }
      }

      setActivePointerDragIdx(null);
      setPointerHoverIdx(null);
      setPointerPos(null);
      setPointerDragItemText(null);
      setPointerDragSize(null);
      pointerDragInfoRef.current = null;
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
  };

  // Custom Pointer Drag Handler for MATCHING Questions (Supports Slot Swapping)
  const handleStartMatchingPointerDrag = (
    e: React.PointerEvent,
    qId: string,
    sourceSlotIdx: number | null,
    sourceBankWord: string | null,
    dragWordText: string
  ) => {
    if (e.button !== 0) return;
    if ((e.target as HTMLElement).closest("button")) return;

    e.preventDefault();
    e.stopPropagation();

    const targetEl = e.currentTarget as HTMLElement;
    const rect = targetEl.getBoundingClientRect();
    const offsetX = e.clientX - rect.left;
    const offsetY = e.clientY - rect.top;

    setMatchingPointerPos({ x: e.clientX, y: e.clientY });
    setMatchingDragState({
      qId,
      sourceSlotIdx,
      sourceBankWord,
      dragWordText,
    });
    setMatchingHoverSlotIdx(sourceSlotIdx);
    setMatchingDragSize({
      offsetX,
      offsetY,
      width: rect.width,
      height: rect.height,
    });

    document.body.style.cursor = "grabbing";
    document.body.style.userSelect = "none";

    matchingDragRef.current = {
      qId,
      sourceSlotIdx,
      hoverSlotIdx: sourceSlotIdx,
      dragWordText,
    };

    const handlePointerMove = (moveEvt: PointerEvent) => {
      moveEvt.preventDefault();
      setMatchingPointerPos({ x: moveEvt.clientX, y: moveEvt.clientY });

      const el = document.elementFromPoint(moveEvt.clientX, moveEvt.clientY);
      if (el) {
        const matchSlotEl = el.closest("[data-match-slot-idx]");
        if (matchSlotEl) {
          const targetIdx = parseInt(matchSlotEl.getAttribute("data-match-slot-idx") || "-1", 10);
          if (targetIdx >= 0 && matchingDragRef.current) {
            if (matchingDragRef.current.hoverSlotIdx !== targetIdx) {
              matchingDragRef.current.hoverSlotIdx = targetIdx;
              setMatchingHoverSlotIdx(targetIdx);
            }
          }
        } else {
          if (matchingDragRef.current && matchingDragRef.current.hoverSlotIdx !== null) {
            matchingDragRef.current.hoverSlotIdx = null;
            setMatchingHoverSlotIdx(null);
          }
        }
      }
    };

    const handlePointerUp = (upEvt: PointerEvent) => {
      upEvt.preventDefault();
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);

      document.body.style.cursor = "";
      document.body.style.userSelect = "";

      if (matchingDragRef.current) {
        const { sourceSlotIdx: sIdx, hoverSlotIdx: hIdx, dragWordText: wText } = matchingDragRef.current;
        if (hIdx !== null && hIdx >= 0) {
          if (sIdx !== null && sIdx !== hIdx) {
            const wordAtSource = answers[`${qId}_match_${sIdx}`];
            const wordAtHover = answers[`${qId}_match_${hIdx}`];
            handleUpdateAnswer(`${qId}_match_${hIdx}`, wordAtSource);
            handleUpdateAnswer(`${qId}_match_${sIdx}`, wordAtHover || null);
          } else if (sIdx === null) {
            handleUpdateAnswer(`${qId}_match_${hIdx}`, wText);
          }
        } else if (sIdx !== null && hIdx === null) {
          handleUpdateAnswer(`${qId}_match_${sIdx}`, "");
        }
      }

      setMatchingDragState(null);
      setMatchingHoverSlotIdx(null);
      setMatchingPointerPos(null);
      setMatchingDragSize(null);
      matchingDragRef.current = null;
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
  };

  // Custom Pointer Drag Handler for FILL_IN Questions (Supports Gap↔Gap Swap and Bank↔Gap)
  const handleStartFillInPointerDrag = (
    e: React.PointerEvent,
    qId: string,
    sourceGapIdx: number | null,
    sourceBankWord: string | null,
    dragWordText: string
  ) => {
    if (e.button !== 0) return;

    e.preventDefault();
    e.stopPropagation();

    const targetEl = e.currentTarget as HTMLElement;
    const rect = targetEl.getBoundingClientRect();
    const offsetX = e.clientX - rect.left;
    const offsetY = e.clientY - rect.top;

    setFillInPointerPos({ x: e.clientX, y: e.clientY });
    setFillInDragState({ qId, sourceGapIdx, sourceBankWord, dragWordText });
    setFillInHoverGapIdx(sourceGapIdx);
    setFillInDragSize({ offsetX, offsetY, width: rect.width, height: rect.height });

    document.body.style.cursor = "grabbing";
    document.body.style.userSelect = "none";

    fillInDragRef.current = { qId, sourceGapIdx, hoverGapIdx: sourceGapIdx, dragWordText };

    const handlePointerMove = (moveEvt: PointerEvent) => {
      moveEvt.preventDefault();
      setFillInPointerPos({ x: moveEvt.clientX, y: moveEvt.clientY });

      const el = document.elementFromPoint(moveEvt.clientX, moveEvt.clientY);
      if (el) {
        const gapEl = el.closest("[data-gap-slot-idx]");
        if (gapEl) {
          const targetIdx = parseInt(gapEl.getAttribute("data-gap-slot-idx") || "-1", 10);
          if (targetIdx >= 0 && fillInDragRef.current) {
            if (fillInDragRef.current.hoverGapIdx !== targetIdx) {
              fillInDragRef.current.hoverGapIdx = targetIdx;
              setFillInHoverGapIdx(targetIdx);
            }
          }
        } else {
          if (fillInDragRef.current && fillInDragRef.current.hoverGapIdx !== null) {
            fillInDragRef.current.hoverGapIdx = null;
            setFillInHoverGapIdx(null);
          }
        }
      }
    };

    const handlePointerUp = (upEvt: PointerEvent) => {
      upEvt.preventDefault();
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);

      document.body.style.cursor = "";
      document.body.style.userSelect = "";

      if (fillInDragRef.current) {
        const { qId: q, sourceGapIdx: sIdx, hoverGapIdx: hIdx, dragWordText: wText } = fillInDragRef.current;
        if (hIdx !== null && hIdx >= 0) {
          // Dropped onto a gap slot
          const sourceKey = sIdx !== null ? `${q}_gap_${sIdx}` : null;
          const targetKey = `${q}_gap_${hIdx}`;
          const wordAtTarget = answers[targetKey] || "";
          if (sIdx !== null && sIdx !== hIdx) {
            // Gap↔Gap swap
            handleUpdateAnswer(targetKey, wText);
            handleUpdateAnswer(sourceKey!, wordAtTarget);
          } else if (sIdx === null) {
            // Bank→Gap place
            handleUpdateAnswer(targetKey, wText);
          }
          // If sIdx === hIdx, dropped back on self — no change
        } else if (sIdx !== null && hIdx === null) {
          // Gap→Bank un-fill: release outside any gap
          handleUpdateAnswer(`${q}_gap_${sIdx}`, "");
        }
      }

      setFillInDragState(null);
      setFillInHoverGapIdx(null);
      setFillInPointerPos(null);
      setFillInDragSize(null);
      fillInDragRef.current = null;
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
  };

  // Timer countdown
  useEffect(() => {
    const timer = setInterval(() => setTimeLeft((t) => (t > 0 ? t - 1 : 0)), 1000);
    return () => clearInterval(timer);
  }, []);

  // Unified Keyboard Navigation: ArrowLeft/Right for question prev/next,
  // with flashcard-slide priority when on a FLASHCARD question
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't hijack arrow keys when user is typing inside text inputs, textareas, or select dropdowns
      const target = e.target as HTMLElement;
      const tag = target ? target.tagName : "";
      const inputType = (target as HTMLInputElement)?.type;

      if (
        (tag === "INPUT" && inputType !== "radio" && inputType !== "checkbox") ||
        tag === "TEXTAREA" ||
        tag === "SELECT"
      ) {
        return;
      }

      const currentQ = questions[currentIdx];
      if (!currentQ) return;

      const isFlashcard = currentQ.category.includes("FLASHCARD");

      if (e.key === "ArrowLeft") {
        if (isFlashcard) {
          const fcList = currentQ.content.flashcards_resolved || [];
          const activeIdx = flashcardIndexMap[currentQ.id] || 0;
          if (activeIdx > 0) {
            // Still have prev cards — navigate card
            e.preventDefault();
            setSlideDirectionMap((prev) => ({ ...prev, [currentQ.id]: "prev" }));
            setFlashcardIndexMap((prev) => ({ ...prev, [currentQ.id]: activeIdx - 1 }));
            return;
          }
        }
        // Fall through to prev question
        if (currentIdx > 0) {
          e.preventDefault();
          setCurrentIdx((i) => i - 1);
        }
      } else if (e.key === "ArrowRight") {
        if (isFlashcard) {
          const fcList = currentQ.content.flashcards_resolved || [];
          const activeIdx = flashcardIndexMap[currentQ.id] || 0;
          if (activeIdx < fcList.length - 1) {
            // Still have next cards — navigate card
            e.preventDefault();
            setSlideDirectionMap((prev) => ({ ...prev, [currentQ.id]: "next" }));
            setFlashcardIndexMap((prev) => ({ ...prev, [currentQ.id]: activeIdx + 1 }));
            return;
          }
        }
        // Fall through to next question
        if (currentIdx < questions.length - 1) {
          e.preventDefault();
          setCurrentIdx((i) => i + 1);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [currentIdx, questions, flashcardIndexMap]);


  const handlePrevFc = (qId: string, activeIdx: number) => {
    if (activeIdx > 0) {
      setSlideDirectionMap((prev) => ({ ...prev, [qId]: "prev" }));
      setFlashcardIndexMap((prev) => ({ ...prev, [qId]: activeIdx - 1 }));
    }
  };

  const handleNextFc = (qId: string, activeIdx: number, maxIdx: number) => {
    if (activeIdx < maxIdx) {
      setSlideDirectionMap((prev) => ({ ...prev, [qId]: "next" }));
      setFlashcardIndexMap((prev) => ({ ...prev, [qId]: activeIdx + 1 }));
    }
  };

  const formatTimer = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  const handleUpdateAnswer = (key: string, val: any) => {
    setAnswers((prev) => ({ ...prev, [key]: val }));
    if (typeof document !== "undefined" && document.activeElement && (document.activeElement as HTMLElement).blur) {
      const tag = document.activeElement.tagName;
      const type = (document.activeElement as HTMLInputElement).type;
      if (tag === "INPUT" && (type === "radio" || type === "checkbox")) {
        (document.activeElement as HTMLElement).blur();
      }
    }
  };

  const toggleFlag = (qId: string) => {
    setFlagged((prev) => ({ ...prev, [qId]: !prev[qId] }));
  };

  const handleNext = () => {
    if (currentIdx < questions.length - 1) setCurrentIdx(currentIdx + 1);
  };

  const handlePrev = () => {
    if (currentIdx > 0) setCurrentIdx(currentIdx - 1);
  };

  // ----------------------------------------------------
  // Audio Player with Loading & Playing States
  // ----------------------------------------------------
  const playSpeechAudio = async (text: string, gender: "Female" | "Male" = "Female", buttonId: string = "default") => {
    if (currentAudioRef.current) {
      currentAudioRef.current.pause();
      currentAudioRef.current = null;
    }

    if (audioPlayingId === buttonId) {
      setAudioPlayingId(null);
      setAudioLoadingId(null);
      return;
    }

    setAudioLoadingId(buttonId);
    setAudioPlayingId(null);

    try {
      const url = text.startsWith("http://") || text.startsWith("https://") || text.startsWith("data:") || text.startsWith("/api/tts")
        ? text
        : `/api/tts?text=${encodeURIComponent(text)}&gender=${gender}`;
      const audio = new Audio(url);
      currentAudioRef.current = audio;

      audio.oncanplay = () => {
        setAudioLoadingId(null);
        setAudioPlayingId(buttonId);
        audio.play();
      };

      audio.onended = () => {
        setAudioPlayingId(null);
        setAudioLoadingId(null);
        currentAudioRef.current = null;
      };

      audio.onerror = () => {
        setAudioLoadingId(null);
        setAudioPlayingId(null);
        currentAudioRef.current = null;
      };
    } catch (e) {
      console.error(e);
      setAudioLoadingId(null);
      setAudioPlayingId(null);
    }
  };

  // ----------------------------------------------------
  // Real Browser Microphone Recording (Direct Audio File Storage)
  // ----------------------------------------------------
  const startRecording = async (qId: string) => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorderRef.current = new MediaRecorder(stream);
      audioChunksRef.current = [];

      mediaRecorderRef.current.ondataavailable = (event) => {
        if (event.data.size > 0) audioChunksRef.current.push(event.data);
      };

      mediaRecorderRef.current.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        const audioUrl = URL.createObjectURL(audioBlob);
        setRecordedAudioMap((prev) => ({ ...prev, [qId]: audioUrl }));

        // Store direct audio file base64 data as student's answer
        const reader = new FileReader();
        reader.readAsDataURL(audioBlob);
        reader.onloadend = () => {
          const base64Audio = reader.result as string;
          handleUpdateAnswer(qId, base64Audio || audioUrl);
        };

        stream.getTracks().forEach((track) => track.stop());
      };

      mediaRecorderRef.current.start();
      setIsRecordingMap((prev) => ({ ...prev, [qId]: true }));
      setRecordingTimerMap((prev) => ({ ...prev, [qId]: 0 }));

      recordingIntervalRef.current = setInterval(() => {
        setRecordingTimerMap((prev) => ({ ...prev, [qId]: (prev[qId] || 0) + 1 }));
      }, 1000);
    } catch (err) {
      console.error("Microphone access error:", err);
      alert("Không thể truy cập Microphone. Vui lòng cho phép quyền sử dụng Micro trên trình duyệt.");
    }
  };

  const stopRecording = (qId: string) => {
    if (recordingIntervalRef.current) {
      clearInterval(recordingIntervalRef.current);
      recordingIntervalRef.current = null;
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
    setIsRecordingMap((prev) => ({ ...prev, [qId]: false }));
  };

  // Helper: Is Question Answered (Checks base & subkeys)
  const isQuestionAnswered = (q: QuestionItem) => {
    if (answers[q.id]) return true;
    return Object.keys(answers).some((key) => {
      if (key.startsWith(`${q.id}_`)) {
        const val = answers[key];
        if (Array.isArray(val)) return val.length > 0;
        return !!val;
      }
      return false;
    });
  };

  // Helper to parse (word) gap positions or _____ blanks from text
  const parseFillInGaps = (rawText: string) => {
    if (!rawText) return { parts: ["Fill in the missing words."], gaps: [] };

    // Check if rawText contains (word) brackets
    if (/\([^)]+\)/.test(rawText)) {
      const parts = rawText.split(/\(([^)]+)\)/g);
      const gaps: string[] = [];
      const textSegments: string[] = [];

      parts.forEach((part, i) => {
        if (i % 2 === 1) gaps.push(part.trim());
        else textSegments.push(part);
      });

      return { parts: textSegments, gaps };
    }

    // Check if rawText contains ______ blanks
    if (/_____+/.test(rawText)) {
      const textSegments = rawText.split(/_____+/g);
      const gaps = Array(textSegments.length - 1).fill("blank");
      return { parts: textSegments, gaps };
    }

    return { parts: [rawText], gaps: [] };
  };

  // ----------------------------------------------------
  // Submit Exam & AI Grading
  // ----------------------------------------------------
  const handleSubmit = async () => {
    if (!user || questions.length === 0) return;
    setIsSubmitting(true);

    try {
      const subId = `sub_${Date.now().toString().slice(-6)}`;
      setSubmittedSubId(subId);

      // 1. Process & Upload Audio Recordings to Supabase Storage
      const finalAnswers: Record<string, any> = { ...answers };
      for (const qId of Object.keys(finalAnswers)) {
        const val = finalAnswers[qId];
        if (typeof val === "string" && val.startsWith("data:audio")) {
          const publicAudioUrl = await uploadAudioToSupabaseStorage(val, subId, qId);
          finalAnswers[qId] = publicAudioUrl;
        }
      }

      // 2. Extract writing essay text if present
      let writingEssay = "";
      let writingPrompt = "";
      for (const q of questions) {
        if (q.category === "WRITING_ESSAY" || q.skill === "Writing") {
          const essayVal = finalAnswers[q.id] || finalAnswers[`${q.id}_essay`];
          if (essayVal && typeof essayVal === "string" && essayVal.trim().length > 10) {
            writingEssay = essayVal;
            writingPrompt = q.prompt || q.stimulus_text || "";
            break;
          }
        }
      }

      // Calculate basic auto graded score for MC questions
      let correctCount = 0;
      let totalAutoGraded = 0;
      for (const q of questions) {
        if (q.category.includes("MC") || q.category.includes("FILL_IN")) {
          totalAutoGraded++;
          const userAns = finalAnswers[q.id];
          const correctAns = q.content?.correctAnswer || q.content?.correct_answer;
          if (userAns && correctAns && String(userAns).trim().toLowerCase() === String(correctAns).trim().toLowerCase()) {
            correctCount++;
          }
        }
      }
      const autoScore = totalAutoGraded > 0 ? Math.round((correctCount / totalAutoGraded) * 9 * 2) / 2 : 7.0;

      // 3. Post to /api/submissions
      const res = await fetch("/api/submissions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          student_id: user.id || "student_01",
          exam_id: examId,
          answers: finalAnswers,
          writing_essay: writingEssay,
          writing_prompt: writingPrompt,
          time_spent_seconds: Math.max(0, 3600 - timeLeft),
          auto_graded_score: autoScore,
        }),
      });

      const resData = await res.json();
      if (resData.success && resData.data?.id) {
        setSubmittedSubId(resData.data.id);
      } else {
        setSubmittedSubId(subId);
      }
      if (!resData.success) {
        console.warn("Submissions API error:", resData.error);
      }

      // 4. Show Submission Modal to student
      setIsSubmitted(true);
    } catch (e) {
      console.error("Submit error:", e);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="h-screen flex flex-col items-center justify-center bg-[#fff8f5]">
        <Loader2 className="w-8 h-8 text-[#6d3807] animate-spin mb-2" />
        <p className="font-mono text-xs text-[#52443a]">Đang nạp dữ liệu bài thi {examId}...</p>
      </div>
    );
  }

  if (questions.length === 0) {
    return (
      <div className="h-screen flex flex-col items-center justify-center bg-[#fff8f5] space-y-4">
        <p className="text-sm text-[#52443a]">Không tìm thấy bài thi hoặc đề thi chưa được nạp.</p>
        <Link href="/student/dashboard" className="px-4 py-2 bg-[#6d3807] text-white rounded-xl text-xs font-bold">
          Quay lại Dashboard
        </Link>
      </div>
    );
  }

  const currentQ = questions[currentIdx];
  const currentSkill = currentQ.skill;

  return (
    <div className="h-screen bg-[#fff8f5] overflow-hidden font-sans text-[#211a16] flex flex-col">
      {/* Top Header */}
      <header className="fixed top-0 w-full z-50 bg-[#fff8f5] border-b border-[#d8c2b6] flex justify-between items-center px-6 h-16 shrink-0 shadow-2xs">
        <div className="flex items-center gap-3">
          <Link href="/student/dashboard" className="p-2 text-[#52443a] hover:text-[#6d3807] transition-all rounded-lg hover:bg-white">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <h1 className="font-headline text-base md:text-lg font-bold truncate max-w-md">{examTitle}</h1>
        </div>

        <div className="flex items-center gap-3 md:gap-4">
          {user?.name && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-[#fff1ea] text-[#6d3807] border border-[#d8c2b6] rounded-xl text-xs font-bold shadow-2xs">
              <User className="w-3.5 h-3.5 text-[#6d3807]" />
              <span>Học sinh: {user.name}</span>
            </div>
          )}

          <ExamCountdownTimer initialSeconds={timeLeft} />

          <button
            onClick={handleSubmit}
            disabled={isSubmitting || isSubmitted}
            className="bg-[#6d3807] text-white hover:bg-[#8a4f1e] transition-all px-5 py-2 rounded-xl font-bold text-xs shadow-sm uppercase tracking-wide disabled:opacity-50 cursor-pointer"
          >
            {isSubmitting ? "Đang Tải Âm Thanh..." : "Nộp Bài Thi"}
          </button>
        </div>
      </header>

      {/* Submission Confirmation Modal Overlay */}
      {isSubmitted && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white p-8 rounded-3xl max-w-md text-center shadow-xl border border-[#d8c2b6] space-y-4 relative">
            {/* Top-Right Dismiss Button */}
            <button
              onClick={() => setIsSubmitted(false)}
              className="absolute top-4 right-4 p-1.5 text-gray-400 hover:text-[#6d3807] hover:bg-[#fff1ea] rounded-full transition-all cursor-pointer"
              title="Đóng thông báo"
            >
              <X className="w-5 h-5" />
            </button>

            <CheckCircle2 className="w-16 h-16 text-emerald-600 mx-auto" />
            <h2 className="text-xl font-bold text-[#6d3807]">🎉 Bài Thi Đã Được Nộp Thành Công!</h2>
            <p className="text-xs text-[#52443a] leading-relaxed">
              Hệ thống đã lưu trữ file âm thanh bài nói và đang tự động chấm điểm bài thi không đồng bộ bằng AI (Gemini Flash Lite).
            </p>
            <div className="p-3 bg-[#fff8f5] rounded-xl border border-[#d8c2b6] text-xs text-[#6d3807] font-bold">
              ⚡ Hệ thống đang chấm điểm ngầm. Kết quả chi tiết sẽ sớm gửi qua thông báo!
            </div>
            <div className="pt-2 flex flex-col gap-2">
              <button
                type="button"
                onClick={() => router.push("/student/dashboard")}
                className="w-full py-3 bg-[#6d3807] hover:bg-[#8a4f1e] text-white rounded-xl text-xs font-bold shadow-md transition-all cursor-pointer"
              >
                Trở Về Dashboard
              </button>

              {submittedSubId && (
                <button
                  type="button"
                  onClick={() => router.push(`/student/exam/review/${submittedSubId}`)}
                  className="w-full py-2.5 bg-[#fff1ea] hover:bg-[#ffb782] text-[#6d3807] rounded-xl text-xs font-bold border border-[#d8c2b6] transition-all cursor-pointer"
                >
                  Xem Bài Thi Vừa Nộp
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Floating Pointer Drag Ghost Image Preview (Preserves Exact Click Offset & Dimensions) */}
      {activePointerDragIdx !== null && pointerPos && pointerDragItemText && pointerDragSize && (
        <div
          style={{
            left: `${pointerPos.x - pointerDragSize.offsetX}px`,
            top: `${pointerPos.y - pointerDragSize.offsetY}px`,
            width: `${pointerDragSize.width}px`,
            height: `${pointerDragSize.height}px`,
          }}
          className="fixed pointer-events-none z-50 p-3 rounded-xl border-2 border-[#6d3807] bg-[#fff1ea] text-[#6d3807] text-xs font-bold shadow-2xl opacity-95 cursor-grabbing flex items-center justify-center text-center"
        >
          <span className="font-bold truncate text-center w-full">{pointerDragItemText}</span>
        </div>
      )}

      {/* Floating MATCHING Drag Ghost Image Preview */}
      {matchingDragState && matchingPointerPos && matchingDragSize && (
        <div
          style={{
            left: `${matchingPointerPos.x - matchingDragSize.offsetX}px`,
            top: `${matchingPointerPos.y - matchingDragSize.offsetY}px`,
            width: `${matchingDragSize.width}px`,
            height: `${matchingDragSize.height}px`,
          }}
          className="fixed pointer-events-none z-50 p-2.5 rounded-xl border-2 border-[#6d3807] bg-[#fff1ea] text-[#6d3807] text-xs font-bold shadow-2xl opacity-95 cursor-grabbing flex items-center justify-center text-center"
        >
          <span className="font-bold truncate text-center w-full">{matchingDragState.dragWordText}</span>
        </div>
      )}

      {/* Floating FILL_IN Drag Ghost Image Preview */}
      {fillInDragState && fillInPointerPos && fillInDragSize && (
        <div
          style={{
            left: `${fillInPointerPos.x - fillInDragSize.offsetX}px`,
            top: `${fillInPointerPos.y - fillInDragSize.offsetY}px`,
            width: `${fillInDragSize.width}px`,
            height: `${fillInDragSize.height}px`,
          }}
          className="fixed pointer-events-none z-50 px-3 rounded-lg border-2 border-[#6d3807] bg-[#fff1ea] text-[#6d3807] text-xs font-bold shadow-2xl opacity-95 cursor-grabbing flex items-center justify-center text-center"
        >
          <span className="font-bold truncate text-center w-full">{fillInDragState.dragWordText}</span>
        </div>
      )}

      {/* Custom Keyframe Animations */}
      <style>{`
        @keyframes slideInNext {
          0% { transform: translateX(45px) scale(0.94); opacity: 0.2; }
          100% { transform: translateX(0) scale(1); opacity: 1; }
        }
        @keyframes slideInPrev {
          0% { transform: translateX(-45px) scale(0.94); opacity: 0.2; }
          100% { transform: translateX(0) scale(1); opacity: 1; }
        }
        @keyframes fcFadeInUp {
          0% { opacity: 0; transform: translateY(10px); }
          100% { opacity: 1; transform: translateY(0); }
        }
        .anim-slide-next {
          animation: slideInNext 0.38s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
        .anim-slide-prev {
          animation: slideInPrev 0.38s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
        .anim-fc-fade {
          animation: fcFadeInUp 0.38s ease-out forwards;
        }
      `}</style>

      {/* Main Workspace (Split Screen) */}
      <main className="flex-1 mt-16 flex w-full h-[calc(100vh-64px)]">
        {/* Left Pane: Passage / Audio Stimulus */}
        <section className="w-1/2 h-full overflow-y-auto bg-[#fffbff] border-r border-[#d8c2b6] p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-[#d8c2b6]/60 pb-3">
            <span className="px-3 py-1 bg-[#fff1ea] text-[#6d3807] text-xs font-bold rounded-lg border border-[#ffb782]/40 uppercase tracking-wide">
              {currentSkill} &bull; Dạng: {currentQ.category}
            </span>
            <span className="text-xs font-bold text-[#857469]">Câu {currentQ.number} / {questions.length}</span>
          </div>

          <div className="space-y-4 text-sm sm:text-base text-[#211a16] leading-relaxed">
            {/* 1. Question Prompt (Short Heading/Instruction) */}
            {currentQ.prompt && (
              <h3 className="text-lg font-bold text-[#6d3807] font-headline">{currentQ.prompt}</h3>
            )}

            {/* 2. Media Stimulus (YouTube Video Embed or Audio Player) */}
            {(() => {
              const mediaUrl = currentQ.stimulus_audio_url || (currentQ.category.startsWith("LISTENING") ? "Welcome to the IELTS test orientation." : "");
              const mediaInfo = getMediaStimulusInfo(mediaUrl);

              if (mediaInfo.type === "YOUTUBE" && mediaInfo.embedUrl) {
                return (
                  <div className="overflow-hidden rounded-2xl border border-[#d8c2b6] shadow-sm aspect-video w-full bg-black">
                    <iframe
                      src={mediaInfo.embedUrl}
                      title="YouTube Video Stimulus"
                      className="w-full h-full border-0"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                    />
                  </div>
                );
              }

              if (mediaInfo.type === "AUDIO" || currentQ.category.startsWith("LISTENING")) {
                const audioBtnId = `stimulus_${currentQ.id}`;
                const isLoading = audioLoadingId === audioBtnId;
                const isPlaying = audioPlayingId === audioBtnId;
                const targetSpeechOrUrl = mediaInfo.rawUrl || "Welcome to the IELTS test orientation.";

                return (
                  <div className="p-4 rounded-2xl bg-[#fff8f5] border border-[#ffb782] space-y-2 shadow-sm">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-[#6d3807] flex items-center space-x-1.5 text-sm">
                        <Volume2 className={`w-4.5 h-4.5 ${isPlaying ? "animate-bounce" : "text-[#6d3807]"}`} />
                        <span>Bài Nghe Audio</span>
                      </span>
                      <button
                        type="button"
                        onClick={() => playSpeechAudio(targetSpeechOrUrl, "Female", audioBtnId)}
                        className="px-4 py-1.5 bg-[#6d3807] text-white rounded-xl text-xs font-bold flex items-center space-x-1.5 hover:bg-[#8a4f1e] shadow-sm transition-all"
                      >
                        {isLoading ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin text-white" />
                        ) : isPlaying ? (
                          <Volume2 className="w-3.5 h-3.5 animate-pulse" />
                        ) : (
                          <Play className="w-3.5 h-3.5 fill-white" />
                        )}
                        <span>{isLoading ? "Đang tải..." : isPlaying ? "Đang phát..." : "Phát Bài Nghe"}</span>
                      </button>
                    </div>
                  </div>
                );
              }

              return null;
            })()}

            {/* 3. Shared Stimulus HTML Text Content */}
            {(() => {
              const stimulusHtml = currentQ.stimulus_text || currentQ.passage || "";

              if (currentQ.category === "WRITING_SHORT_ANSWER" && (currentQ.content.sub_questions || currentQ.content.subQuestions || currentQ.content.shortAnswersList)?.length > 0) {
                return (
                  <div className="p-4.5 rounded-2xl bg-[#fff8f5]/50 border border-[#d8c2b6]/60 text-sm font-medium text-[#52443a] leading-relaxed">
                    <div className="space-y-3">
                      <span className="font-bold text-[#6d3807] block uppercase text-xs">Danh sách câu hỏi cần trả lời:</span>
                      {(currentQ.content.sub_questions || currentQ.content.subQuestions || currentQ.content.shortAnswersList).map((sub: any, idx: number) => (
                        <div key={idx} className="p-3.5 bg-white rounded-xl border border-[#d8c2b6] space-y-1">
                          <span className="font-bold text-[#211a16] block text-sm">
                            Câu {idx + 1}: {sub.text || sub.questionText || sub.subQuestionText || sub.prompt || `Câu hỏi ${idx + 1}`}
                          </span>
                          <span className="text-xs text-[#6d3807] font-bold block">Giới hạn: {sub.max_words || sub.maxWords || 50} từ</span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              }

              if (!stimulusHtml || !stimulusHtml.trim()) return null;

              return <StimulusContentRenderer html={stimulusHtml} />;
            })()}
          </div>
        </section>

        {/* Right Pane: Question Interactive Workspace */}
        <section className="w-1/2 h-full flex flex-col bg-[#fff8f5] relative">
          {/* Top Control Bar with Stepper Buttons & Centered Quick Nav Grid */}
          <div className="p-2.5 bg-white border-b border-[#d8c2b6] flex items-center justify-between gap-2 px-4 shadow-2xs">
            {/* Left: Prev Button & Flag Tag */}
            <div className="flex items-center space-x-1.5 shrink-0">
              <button
                onClick={handlePrev}
                disabled={currentIdx === 0}
                className="px-3 py-1.5 bg-[#fff8f5] hover:bg-[#fff1ea] border border-[#d8c2b6] disabled:opacity-40 text-[#211a16] text-xs font-bold rounded-xl transition-all shadow-2xs"
              >
                ‹ Câu Trước
              </button>

              <button
                onClick={() => toggleFlag(currentQ.id)}
                className={`flex items-center space-x-1 px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
                  flagged[currentQ.id] ? "bg-[#ffb782] text-[#6d3807]" : "bg-gray-100 text-[#52443a] hover:bg-[#fff1ea]"
                }`}
                title={flagged[currentQ.id] ? "Đã Gắn Tag" : "Gắn Tag Cần Xem"}
              >
                <Star className={`w-3.5 h-3.5 ${flagged[currentQ.id] ? "fill-[#6d3807]" : ""}`} />
              </button>
            </div>

            {/* Center: Question Quick Nav Grid */}
            <div className="flex-1 flex items-center justify-center overflow-x-auto py-1 px-2 gap-1.5 max-w-full no-scrollbar">
              {questions.map((q, idx) => {
                const isAnswered = isQuestionAnswered(q);
                const isFlagged = !!flagged[q.id];
                const isCurrent = idx === currentIdx;

                let style = "bg-gray-50 text-[#52443a] border border-[#d8c2b6]";
                if (isAnswered) style = "bg-emerald-700 text-white font-bold border-emerald-800 shadow-2xs";
                if (isFlagged) style = "bg-[#ffb782] text-[#6d3807] font-bold";
                if (isCurrent) style += " ring-2 ring-[#6d3807]";

                return (
                  <button
                    key={q.id}
                    onClick={() => setCurrentIdx(idx)}
                    className={`w-7 h-7 rounded-lg text-xs font-bold shrink-0 flex items-center justify-center transition-all ${style}`}
                  >
                    {q.number}
                  </button>
                );
              })}
            </div>

            {/* Right: Next Button */}
            <div className="shrink-0">
              <button
                onClick={handleNext}
                disabled={currentIdx === questions.length - 1}
                className="px-3.5 py-1.5 bg-[#6d3807] hover:bg-[#8a4f1e] disabled:opacity-40 text-white text-xs font-bold rounded-xl transition-all shadow-2xs"
              >
                Câu Tiếp Theo ›
              </button>
            </div>
          </div>

          {/* Interactive Question Body */}
          <div className="flex-1 p-6 overflow-y-auto space-y-4">
            <div className="bg-white p-6 rounded-2xl border border-[#d8c2b6] shadow-sm space-y-4">

              {/* ========================================================= */}
              {/* 1. MULTIPLE CHOICE (READING_MC & LISTENING_MC) */}
              {/* ========================================================= */}
              {(currentQ.category === "READING_MC" || currentQ.category === "LISTENING_MC") && (
                <div className="space-y-3.5">
                  <span className="text-sm font-bold text-[#6d3807] block uppercase">Chọn đáp án đúng nhất:</span>

                  {/* All cases use sub_questions — single or multiple */}
                  {currentQ.content.sub_questions && (() => {
                    const subQs: any[] = currentQ.content.sub_questions;
                    const isSingle = subQs.length === 1;

                    return subQs.map((sub: any, i: number) => {
                      const subAnsKey = isSingle ? currentQ.id : `${currentQ.id}_sub_${i}`;
                      const audioBtnId = `mc_sub_audio_${currentQ.id}_${i}`;
                      const isAudioLoading = audioLoadingId === audioBtnId;
                      const isAudioPlaying = audioPlayingId === audioBtnId;

                      return (
                        <div key={i} className={`space-y-2.5 ${!isSingle ? "p-4 bg-[#fff8f5] rounded-xl border border-[#d8c2b6]" : ""}`}>
                          {/* Question text */}
                          {sub.text && (
                            <div className="flex items-start gap-2">
                              {!isSingle && (
                                <span className="shrink-0 font-bold text-[#6d3807] text-sm sm:text-base">Câu {i + 1}.</span>
                              )}
                              <span className="font-bold text-[#211a16] text-sm sm:text-base">{sub.text}</span>
                            </div>
                          )}

                          {/* Sub-question audio player (LISTENING_MC) */}
                          {currentQ.category === "LISTENING_MC" && sub.audio_url && (
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => playSpeechAudio(sub.audio_url, "Female", audioBtnId)}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#fff1ea] border border-[#d8c2b6] rounded-lg text-xs font-bold text-[#6d3807] hover:bg-[#ffb782] transition-all"
                              >
                                {isAudioLoading ? (
                                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                ) : isAudioPlaying ? (
                                  <Volume2 className="w-3.5 h-3.5 animate-bounce text-emerald-700" />
                                ) : (
                                  <Volume2 className="w-3.5 h-3.5" />
                                )}
                                <span>{isAudioPlaying ? "Đang phát âm thanh..." : "Nghe âm thanh câu hỏi"}</span>
                              </button>
                            </div>
                          )}

                          {/* Options */}
                          <div className="space-y-2">
                            {[sub.option_a, sub.option_b, sub.option_c, sub.option_d].filter(Boolean).map((optStr: string) => {
                              const isSubSel = answers[subAnsKey] === optStr;
                              return (
                                <label
                                  key={optStr}
                                  onClick={() => handleUpdateAnswer(subAnsKey, optStr)}
                                  className={`flex items-center space-x-3 p-3 rounded-xl border cursor-pointer text-sm font-medium transition-all ${
                                    isSubSel ? "border-2 border-[#6d3807] bg-[#fff1ea] font-bold text-[#6d3807]" : "border-[#d8c2b6] bg-white hover:bg-[#fff8f5]"
                                  }`}
                                >
                                  <input type="radio" checked={isSubSel} onChange={() => {}} className="accent-[#6d3807] w-4 h-4" />
                                  <span>{optStr}</span>
                                </label>
                              );
                            })}
                          </div>
                        </div>
                      );
                    });
                  })()}
                </div>
              )}

              {/* ========================================================= */}
              {/* 2. FILL-IN GAPS (READING_FILL_IN & LISTENING_FILL_IN) */}
              {/* ========================================================= */}
              {(currentQ.category === "READING_FILL_IN" || currentQ.category === "LISTENING_FILL_IN") && (() => {
                const { parts, gaps } = parseFillInGaps(currentQ.content.passage || "");
                const subtype = currentQ.content.fill_subtype || "OPTION_BANK";
                const optionBank = currentQ.content.option_bank || [];

                return (
                  <div className="space-y-4 text-sm">
                    <span className="text-sm font-bold text-[#6d3807] block uppercase">
                      Điền từ vào chỗ khuyết ({subtype === "INLINE_SELECT" ? "Dropdown Select" : subtype === "OPTION_BANK" ? "Ngân Hàng Từ" : "Tự Gõ"}):
                    </span>

                    {/* Text Passage Flow with Embedded Gap Controls (Clean layout with NO guide text) */}
                    <div className="p-4 rounded-xl bg-[#fff8f5] border border-[#d8c2b6] leading-loose font-medium text-[#211a16]">
                      {parts.map((partText, idx) => (
                        <span key={idx}>
                          {partText}
                          {idx < gaps.length && (() => {
                            const gapAnsKey = `${currentQ.id}_gap_${idx}`;
                            const currentAns = answers[gapAnsKey] || "";

                            if (subtype === "INLINE_SELECT") {
                              const gapOptions =
                                currentQ.content.option_banks?.find((g: any) => g.gap_index === idx)?.options ||
                                currentQ.content.inline_options_per_gap?.find((g: any) => g.gap_index === idx)?.options ||
                                Array.from(new Set([gaps[idx], ...optionBank])).slice(0, 4);

                              return (
                                <select
                                  value={currentAns}
                                  onChange={(e) => handleUpdateAnswer(gapAnsKey, e.target.value)}
                                  className="inline-block mx-1 px-3 py-1 bg-white border-2 border-[#6d3807] rounded-lg font-bold text-[#6d3807] focus:outline-none shadow-sm cursor-pointer text-sm"
                                >
                                  <option value="">-- Chọn từ --</option>
                                  {gapOptions.map((optWord: string) => (
                                    <option key={optWord} value={optWord}>
                                      {optWord}
                                    </option>
                                  ))}
                                </select>
                              );
                            }

                            if (subtype === "OPTION_BANK") {
                              const isDraggingFillIn = fillInDragState !== null && fillInDragState.qId === currentQ.id;
                              const isGapSource = isDraggingFillIn && fillInDragState.sourceGapIdx === idx;
                              const isGapHovered = isDraggingFillIn && fillInHoverGapIdx === idx;

                              // Determine display for this gap during drag
                              let gapDisplayVal = currentAns;
                              let gapIsPlaceholder = false;

                              if (isDraggingFillIn) {
                                if (isGapHovered && fillInDragState.sourceGapIdx !== idx) {
                                  // Target gap: show empty dashed
                                  gapIsPlaceholder = true;
                                } else if (isGapSource) {
                                  if (fillInHoverGapIdx !== null && fillInHoverGapIdx !== idx) {
                                    // Source shows temp word from hovered gap
                                    const hoverKey = `${currentQ.id}_gap_${fillInHoverGapIdx}`;
                                    const hoverWord = answers[hoverKey] || "";
                                    gapDisplayVal = hoverWord;
                                    if (!hoverWord) gapIsPlaceholder = true;
                                  } else {
                                    // Source with no hover target: show empty dashed
                                    gapIsPlaceholder = true;
                                  }
                                }
                              }

                              return (
                                <span
                                  data-gap-slot-idx={idx}
                                  onPointerDown={currentAns ? (e) => handleStartFillInPointerDrag(e, currentQ.id, idx, null, currentAns) : undefined}
                                  onClick={() => {
                                    if (fillInDragState) return;
                                    if (currentAns) handleUpdateAnswer(gapAnsKey, "");
                                    else if (activeSelectedChip) {
                                      handleUpdateAnswer(gapAnsKey, activeSelectedChip);
                                      setActiveSelectedChip(null);
                                    }
                                  }}
                                  className={`inline-flex items-center justify-center mx-1 px-3.5 py-1 rounded-lg font-bold transition-all min-w-[90px] h-8 align-middle border-2 ${
                                    gapIsPlaceholder
                                      ? "border-dashed border-[#6d3807] bg-[#fff8f5]"
                                      : gapDisplayVal
                                      ? "border-emerald-700 bg-emerald-50 text-emerald-800 shadow-sm cursor-grab"
                                      : "border-dashed border-[#6d3807] bg-white text-[#6d3807] cursor-pointer"
                                  }`}
                                  style={{ transition: "all 0.9s ease-out" }}
                                >
                                  {gapIsPlaceholder ? null : gapDisplayVal}
                                </span>
                              );
                            }

                            // Free typing input fallback
                            return (
                              <input
                                type="text"
                                value={currentAns}
                                onChange={(e) => handleUpdateAnswer(gapAnsKey, e.target.value)}
                                className="inline-block mx-1 w-32 px-3 py-1 bg-white border-2 border-[#6d3807] rounded-lg text-xs font-bold text-[#6d3807] text-center"
                              />
                            );
                          })()}
                        </span>
                      ))}
                    </div>

                    {/* Option Bank Choice Chips (Fitting text width!) */}
                    {subtype === "OPTION_BANK" && (() => {
                      const perGapBanks: Array<{ gap_index: number; options: string[] }> = currentQ.content.option_banks || [];
                      const hasPerGap = perGapBanks.length > 0;

                      return (
                        <div className="p-3.5 bg-white rounded-xl border border-[#d8c2b6] space-y-3">
                          <span className="font-bold text-[#6d3807] block text-xs">Ngân hàng từ chọn (Click từ hoặc Kéo thả vào ô trống):</span>

                          {hasPerGap ? (
                            <div className="space-y-3">
                              {perGapBanks.map((gb, gIdx) => (
                                <div key={gIdx} className="space-y-1.5 p-2.5 bg-[#fff8f5] rounded-xl border border-[#d8c2b6]/60">
                                  <span className="text-[11px] font-bold text-[#6d3807] block">Chỗ trống {gIdx + 1}:</span>
                                  <div className="flex flex-wrap gap-2">
                                    {gb.options.map((word: string) => {
                                      const isUsed = Object.keys(answers).some(
                                        (k) => k.startsWith(`${currentQ.id}_gap_`) && answers[k] === word
                                      );
                                      const isChipActive = activeSelectedChip === word;
                                      const isDraggingFillIn = fillInDragState !== null && fillInDragState.qId === currentQ.id;
                                      const isBeingDragged = isDraggingFillIn && fillInDragState.dragWordText === word;

                                      return (
                                        <button
                                          key={word}
                                          type="button"
                                          onPointerDown={!isUsed || isBeingDragged ? (e) => handleStartFillInPointerDrag(e, currentQ.id, null, word, word) : undefined}
                                          onClick={() => {
                                            if (fillInDragState) return;
                                            if (isUsed) return;
                                            if (isChipActive) setActiveSelectedChip(null);
                                            else {
                                              const targetGapKey = `${currentQ.id}_gap_${gIdx}`;
                                              handleUpdateAnswer(targetGapKey, word);
                                              setActiveSelectedChip(null);
                                            }
                                          }}
                                          className={`w-auto px-3.5 py-1.5 rounded-lg border text-xs font-bold transition-all ${
                                            isUsed && !isBeingDragged
                                              ? "bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed opacity-30 line-through"
                                              : isChipActive
                                              ? "bg-[#6d3807] text-white border-[#6d3807] shadow-md ring-2 ring-[#ffb782]"
                                              : "bg-white text-[#6d3807] border-[#ffb782] hover:border-[#6d3807] cursor-grab shadow-2xs"
                                          }`}
                                        >
                                          {word}
                                        </button>
                                      );
                                    })}
                                  </div>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div className="flex flex-wrap gap-2">
                              {optionBank.map((word: string) => {
                                const isUsed = Object.keys(answers).some(
                                  (k) => k.startsWith(`${currentQ.id}_gap_`) && answers[k] === word
                                );
                                const isChipActive = activeSelectedChip === word;

                                const isDraggingFillIn = fillInDragState !== null && fillInDragState.qId === currentQ.id;
                                const isBeingDragged = isDraggingFillIn && fillInDragState.dragWordText === word;

                                return (
                                  <button
                                    key={word}
                                    type="button"
                                    onPointerDown={!isUsed || isBeingDragged ? (e) => handleStartFillInPointerDrag(e, currentQ.id, null, word, word) : undefined}
                                    onClick={() => {
                                      if (fillInDragState) return;
                                      if (isUsed) return;
                                      if (isChipActive) setActiveSelectedChip(null);
                                      else {
                                        setActiveSelectedChip(word);
                                        for (let i = 0; i < gaps.length; i++) {
                                          if (!answers[`${currentQ.id}_gap_${i}`]) {
                                            handleUpdateAnswer(`${currentQ.id}_gap_${i}`, word);
                                            setActiveSelectedChip(null);
                                            break;
                                          }
                                        }
                                      }
                                    }}
                                    className={`w-auto px-3.5 py-1.5 rounded-lg border text-xs font-bold transition-all ${
                                      isUsed && !isBeingDragged
                                        ? "bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed opacity-30 line-through"
                                        : isChipActive
                                        ? "bg-[#6d3807] text-white border-[#6d3807] shadow-md ring-2 ring-[#ffb782]"
                                        : "bg-[#fff1ea] text-[#6d3807] border-[#ffb782] hover:border-[#6d3807] cursor-grab"
                                    }`}
                                  >
                                    {word}
                                  </button>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })()}
                  </div>
                );
              })()}

              {/* ========================================================= */}
              {/* 3. ORDERING (UNIFIED DRAG & DROP / REORDERING INSIDE TARGET BOX) */}
              {/* ========================================================= */}
              {(currentQ.category === "READING_ORDERING" || currentQ.category === "LISTENING_ORDERING") && (() => {
                const isWordOrdering = currentQ.content.ordering_type === "WORD_ORDERING";
                const correctText: string = currentQ.content.correct_text || "";
                const rawItems: string[] = isWordOrdering
                  ? correctText.split(/\s+/).filter(Boolean)
                  : correctText.split(/(?<=[.!?])\s+/).map((s: string) => s.trim()).filter(Boolean);

                const orderedKey = `${currentQ.id}_ordered`;
                const orderedItems: string[] = answers[orderedKey] || [];
                const availableItems = rawItems.filter((item) => !orderedItems.includes(item));

                return (
                  <div className="space-y-4 text-xs">
                    <span className="text-xs font-bold text-[#6d3807] block uppercase">
                      Sắp xếp {isWordOrdering ? "các từ" : "các câu"} (Click hoặc Kéo thả để thêm/bớt và thay đổi vị trí):
                    </span>

                    {/* Available Items Bank */}
                    <div
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={(e) => {
                        e.preventDefault();
                        const rawData = e.dataTransfer.getData("text/plain");
                        if (rawData && orderedItems.includes(rawData)) {
                          handleUpdateAnswer(
                            orderedKey,
                            orderedItems.filter((i) => i !== rawData)
                          );
                        }
                      }}
                      className="p-3.5 bg-[#fff8f5] rounded-xl border border-[#d8c2b6] space-y-2"
                    >
                      <span className="font-bold text-[#52443a] block text-[11px]">
                        Danh sách {isWordOrdering ? "từ" : "câu"} sẵn có:
                      </span>

                      {isWordOrdering ? (
                        <div className="flex flex-wrap gap-2">
                          {availableItems.map((w, i) => (
                            <button
                              key={i}
                              type="button"
                              draggable
                              onDragStart={(e) => e.dataTransfer.setData("text/plain", w)}
                              onClick={() => handleUpdateAnswer(orderedKey, [...orderedItems, w])}
                              className="w-auto px-3.5 py-1.5 bg-white border border-[#d8c2b6] rounded-lg text-xs font-bold text-[#6d3807] hover:bg-[#6d3807] hover:text-white transition-all shadow-sm"
                            >
                              {w}
                            </button>
                          ))}
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {availableItems.map((s, i) => (
                            <div
                              key={i}
                              draggable
                              onDragStart={(e) => e.dataTransfer.setData("text/plain", s)}
                              onClick={() => handleUpdateAnswer(orderedKey, [...orderedItems, s])}
                              className="p-3 bg-white rounded-xl border border-[#d8c2b6] text-xs font-medium text-[#211a16] hover:border-[#6d3807] cursor-pointer shadow-sm flex items-center justify-between"
                            >
                              <span>{s}</span>
                              <span className="text-[10px] font-bold text-[#6d3807] bg-[#fff1ea] px-2 py-0.5 rounded border border-[#ffb782]">+ Thêm</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Ordered Workspace Target Drop Zone with Reordering support */}
                    <div
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={(e) => {
                        e.preventDefault();
                        const rawData = e.dataTransfer.getData("text/plain");
                        try {
                          const parsed = JSON.parse(rawData);
                          if (parsed.type === "REORDER_ITEM") return;
                        } catch (err) {}

                        if (rawData && !orderedItems.includes(rawData)) {
                          handleUpdateAnswer(orderedKey, [...orderedItems, rawData]);
                        }
                      }}
                      className="p-4 bg-white rounded-xl border-2 border-dashed border-[#6d3807] space-y-3 min-h-[110px]"
                    >
                      <div className="flex items-center justify-between border-b border-[#d8c2b6] pb-2">
                        <span className="font-bold text-[#6d3807] uppercase">Khu vực đã sắp xếp ({orderedItems.length}/{rawItems.length}):</span>
                        {orderedItems.length > 0 && (
                          <button
                            type="button"
                            onClick={() => handleUpdateAnswer(orderedKey, [])}
                            className="text-[11px] font-bold text-rose-600 hover:underline flex items-center space-x-1"
                          >
                            <RefreshCw className="w-3 h-3" />
                            <span>Xóa làm lại</span>
                          </button>
                        )}
                      </div>

                      {orderedItems.length === 0 ? (
                        <p className="text-center text-[#857469] font-mono text-[11px] py-4">
                          Kéo thả hoặc click các {isWordOrdering ? "từ" : "câu"} vào đây để hoàn thiện thứ tự.
                        </p>
                      ) : isWordOrdering ? (() => {
                        const isDragging = activePointerDragIdx !== null && pointerHoverIdx !== null;
                        let itemsToRender: Array<{ isPlaceholder: boolean; text: string; origIdx: number }> = [];

                        if (isDragging) {
                          const withoutDrag = orderedItems
                            .map((text, i) => ({ text, origIdx: i }))
                            .filter((_, i) => i !== activePointerDragIdx);

                          const clampHover = Math.max(0, Math.min(pointerHoverIdx!, withoutDrag.length));

                          withoutDrag.forEach((item, i) => {
                            if (i === clampHover) {
                              itemsToRender.push({ isPlaceholder: true, text: orderedItems[activePointerDragIdx!], origIdx: activePointerDragIdx! });
                            }
                            itemsToRender.push({ isPlaceholder: false, text: item.text, origIdx: item.origIdx });
                          });
                          if (clampHover >= withoutDrag.length) {
                            itemsToRender.push({ isPlaceholder: true, text: orderedItems[activePointerDragIdx!], origIdx: activePointerDragIdx! });
                          }
                        } else {
                          itemsToRender = orderedItems.map((text, i) => ({ isPlaceholder: false, text, origIdx: i }));
                        }

                        return (
                          <div className="flex flex-wrap gap-2 transition-all duration-900 ease-out relative">
                            {itemsToRender.map((item, displayIdx) => {
                              if (item.isPlaceholder) {
                                return (
                                  <div
                                    key={`word_ph_${displayIdx}`}
                                    data-order-idx={displayIdx}
                                    style={pointerDragSize ? { width: `${pointerDragSize.width}px`, height: `${pointerDragSize.height}px` } : undefined}
                                    className="min-w-[64px] min-h-[28px] border-2 border-dashed border-[#6d3807] bg-[#fff8f5] rounded-lg transition-all duration-900 ease-out shadow-inner"
                                  />
                                );
                              }

                              const idx = item.origIdx;
                              return (
                                <button
                                  key={`word_${item.text}_${idx}`}
                                  type="button"
                                  data-order-idx={displayIdx}
                                  onPointerDown={(e) => handleStartPointerDrag(e, currentQ.id, orderedKey, idx, item.text, orderedItems)}
                                  onClick={() =>
                                    handleUpdateAnswer(
                                      orderedKey,
                                      orderedItems.filter((_, i) => i !== idx)
                                    )
                                  }
                                  className="w-auto px-3.5 py-1.5 bg-[#6d3807] text-white hover:bg-rose-700 rounded-lg text-xs font-bold transition-all duration-900 ease-out transform cursor-grab active:cursor-grabbing shadow-sm touch-none"
                                >
                                  {item.text} &times;
                                </button>
                              );
                            })}
                          </div>
                        );
                      })() : (() => {
                        const isDragging = activePointerDragIdx !== null && pointerHoverIdx !== null;
                        let itemsToRender: Array<{ isPlaceholder: boolean; text: string; origIdx: number }> = [];

                        if (isDragging) {
                          const withoutDrag = orderedItems
                            .map((text, i) => ({ text, origIdx: i }))
                            .filter((_, i) => i !== activePointerDragIdx);

                          const clampHover = Math.max(0, Math.min(pointerHoverIdx!, withoutDrag.length));

                          withoutDrag.forEach((item, i) => {
                            if (i === clampHover) {
                              itemsToRender.push({ isPlaceholder: true, text: orderedItems[activePointerDragIdx!], origIdx: activePointerDragIdx! });
                            }
                            itemsToRender.push({ isPlaceholder: false, text: item.text, origIdx: item.origIdx });
                          });
                          if (clampHover >= withoutDrag.length) {
                            itemsToRender.push({ isPlaceholder: true, text: orderedItems[activePointerDragIdx!], origIdx: activePointerDragIdx! });
                          }
                        } else {
                          itemsToRender = orderedItems.map((text, i) => ({ isPlaceholder: false, text, origIdx: i }));
                        }

                        return (
                          <div className="space-y-2 transition-all duration-900 ease-out relative">
                            {itemsToRender.map((item, displayIdx) => {
                              if (item.isPlaceholder) {
                                return (
                                  <div
                                    key={`sent_ph_${displayIdx}`}
                                    data-order-idx={displayIdx}
                                    style={pointerDragSize ? { height: `${pointerDragSize.height}px` } : undefined}
                                    className="w-full min-h-[44px] border-2 border-dashed border-[#6d3807] bg-[#fff8f5] rounded-xl transition-all duration-900 ease-out shadow-inner"
                                  />
                                );
                              }

                              const idx = item.origIdx;
                              return (
                                <div
                                  key={`sent_${item.text.slice(0, 15)}_${idx}`}
                                  data-order-idx={displayIdx}
                                  onPointerDown={(e) => handleStartPointerDrag(e, currentQ.id, orderedKey, idx, item.text, orderedItems)}
                                  className="p-3 bg-[#fff1ea] border border-[#ffb782] text-[#6d3807] rounded-xl text-xs font-bold flex items-center justify-between shadow-sm cursor-grab active:cursor-grabbing transition-all duration-900 ease-out transform hover:scale-[1.01] touch-none"
                                >
                                  <span className="flex-1 mr-2 font-bold pointer-events-none">
                                    {displayIdx + 1}. {item.text}
                                  </span>
                                  <div className="flex items-center space-x-1">
                                    {idx > 0 && (
                                      <button
                                        type="button"
                                        onClick={() => {
                                          const updated = [...orderedItems];
                                          const temp = updated[idx];
                                          updated[idx] = updated[idx - 1];
                                          updated[idx - 1] = temp;
                                          handleUpdateAnswer(orderedKey, updated);
                                        }}
                                        className="p-1 rounded bg-white border border-[#d8c2b6] text-[#6d3807]"
                                      >
                                        <MoveUp className="w-3.5 h-3.5" />
                                      </button>
                                    )}
                                    {idx < orderedItems.length - 1 && (
                                      <button
                                        type="button"
                                        onClick={() => {
                                          const updated = [...orderedItems];
                                          const temp = updated[idx];
                                          updated[idx] = updated[idx + 1];
                                          updated[idx + 1] = temp;
                                          handleUpdateAnswer(orderedKey, updated);
                                        }}
                                        className="p-1 rounded bg-white border border-[#d8c2b6] text-[#6d3807]"
                                      >
                                        <MoveDown className="w-3.5 h-3.5" />
                                      </button>
                                    )}
                                    <button
                                      type="button"
                                      onClick={() =>
                                        handleUpdateAnswer(
                                          orderedKey,
                                          orderedItems.filter((_, i) => i !== idx)
                                        )
                                      }
                                      className="px-2 py-1 bg-rose-600 text-white rounded text-[10px] font-bold"
                                    >
                                      Bỏ
                                    </button>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        );
                      })()}
                    </div>
                  </div>
                );
              })()}

              {/* ========================================================= */}
              {/* 4. MATCHING PAIRS (BALANCED ALIGNMENT & DIMMED USED ITEMS) */}
              {/* ========================================================= */}
              {(currentQ.category === "READING_MATCHING" ||
                currentQ.category === "LISTENING_MATCHING" ||
                currentQ.category === "WRITING_MATCHING") && (() => {
                const pairs: Array<{ id: string; left: string; right: string }> =
                  currentQ.content.pairs || [];

                const rightOptions = Array.from(new Set(pairs.map((p) => p.right))).sort();
                const isWritingMatching = currentQ.category === "WRITING_MATCHING";

                return (
                  <div className="space-y-4 text-xs">
                    <span className="text-xs font-bold text-[#6d3807] block uppercase">
                      {isWritingMatching
                        ? "Gõ từ tiếng Anh dịch từ tương ứng ở cột trái:"
                        : "Kéo thả hoặc click chọn từ ghép nối đúng vào cột bên dưới:"}
                    </span>

                    {/* Choice Chips Bank for Reading & Listening Matching */}
                    {!isWritingMatching && (
                      <div className="p-3.5 bg-[#fff8f5] rounded-xl border border-[#d8c2b6] space-y-2">
                        <span className="font-bold text-[#6d3807] block text-[11px]">Danh sách từ ghép nối (Cột B):</span>
                        <div className="flex flex-wrap gap-2">
                          {rightOptions.map((optRight) => {
                            const isUsed = pairs.some((_, i) => answers[`${currentQ.id}_match_${i}`] === optRight);
                            const isSelected = activeSelectedChip === optRight;

                            return (
                              <button
                                key={optRight}
                                type="button"
                                onPointerDown={(e) => {
                                  if (isUsed) return;
                                  handleStartMatchingPointerDrag(e, currentQ.id, null, optRight, optRight);
                                }}
                                onClick={() => {
                                  if (isUsed) return;
                                  for (let i = 0; i < pairs.length; i++) {
                                    const slotKey = `${currentQ.id}_match_${i}`;
                                    if (!answers[slotKey]) {
                                      handleUpdateAnswer(slotKey, optRight);
                                      break;
                                    }
                                  }
                                }}
                                className={`w-auto px-3.5 py-1.5 rounded-lg border text-xs font-bold transition-all ${
                                  isUsed
                                    ? "bg-gray-100 text-gray-400 border-gray-200 opacity-30 pointer-events-none cursor-not-allowed line-through"
                                    : isSelected
                                    ? "bg-[#6d3807] text-white border-[#6d3807] shadow-md ring-2 ring-[#ffb782] cursor-grab active:cursor-grabbing touch-none"
                                    : "bg-white text-[#6d3807] border-[#d8c2b6] hover:bg-[#fff1ea] cursor-grab active:cursor-grabbing touch-none"
                                }`}
                              >
                                {optRight}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Perfectly Aligned 3-Column Matching Table */}
                    <div className="space-y-2.5">
                      {pairs.map((pair, idx) => {
                        const matchKey = `${currentQ.id}_match_${idx}`;
                        const currentVal = answers[matchKey] || "";
                        const audioBtnId = `match_audio_${currentQ.id}_${idx}`;
                        const isAudioLoading = audioLoadingId === audioBtnId;
                        const isAudioPlaying = audioPlayingId === audioBtnId;

                        return (
                          <div key={idx} className="flex items-center justify-between p-3 rounded-xl bg-white border border-[#d8c2b6] shadow-sm">
                            {/* Column 1: Left Item (Centered) */}
                            <div className="w-5/12 text-center font-bold text-[#211a16] flex items-center justify-center space-x-2">
                              <span>{pair.left}</span>
                              {currentQ.category === "LISTENING_MATCHING" && (
                                <button
                                  type="button"
                                  onClick={() => playSpeechAudio(pair.left, "Female", audioBtnId)}
                                  className="p-1 rounded bg-[#fff1ea] text-[#6d3807] hover:bg-[#ffb782]"
                                >
                                  {isAudioLoading ? (
                                    <Loader2 className="w-3.5 h-3.5 animate-spin text-[#6d3807]" />
                                  ) : isAudioPlaying ? (
                                    <Volume2 className="w-3.5 h-3.5 animate-bounce" />
                                  ) : (
                                    <Volume2 className="w-3.5 h-3.5 text-[#6d3807]" />
                                  )}
                                </button>
                              )}
                            </div>

                            {/* Column 2: Center Arrow (Straight Vertical Alignment) */}
                            <div className="w-2/12 text-center font-bold text-[#6d3807] text-base">
                              ↔
                            </div>

                            {/* Column 3: Right Target Slot / Input (Centered & Wider Empty Slot) */}
                            <div className="w-5/12 flex items-center justify-center">
                              {isWritingMatching ? (
                                <input
                                  type="text"
                                  placeholder="Gõ từ..."
                                  value={currentVal}
                                  onChange={(e) => handleUpdateAnswer(matchKey, e.target.value)}
                                  className="w-full max-w-[180px] px-3.5 py-1.5 bg-white border border-[#d8c2b6] rounded-lg text-xs font-bold text-[#6d3807] text-center"
                                />
                              ) : (() => {
                                const isHovered = matchingHoverSlotIdx === idx;
                                const isSource = matchingDragState?.sourceSlotIdx === idx;
                                const isDraggingActive = matchingDragState !== null;

                                let displayVal = currentVal;
                                let isPlaceholder = false;

                                if (isDraggingActive) {
                                  if (isHovered) {
                                    isPlaceholder = true;
                                  } else if (isSource) {
                                    if (matchingHoverSlotIdx !== null && matchingHoverSlotIdx !== idx) {
                                      const hoverVal = answers[`${currentQ.id}_match_${matchingHoverSlotIdx}`];
                                      displayVal = hoverVal || "";
                                      if (!hoverVal) isPlaceholder = true;
                                    } else {
                                      isPlaceholder = true;
                                    }
                                  }
                                }

                                if (isPlaceholder) {
                                  return (
                                    <div
                                      data-match-slot-idx={idx}
                                      className="min-w-[130px] h-9 px-4 rounded-xl border-2 border-dashed border-[#6d3807] bg-[#fff8f5] shadow-inner transition-all duration-900 ease-out"
                                    />
                                  );
                                }

                                return (
                                  <div
                                    data-match-slot-idx={idx}
                                    onPointerDown={(e) => {
                                      if (displayVal) {
                                        handleStartMatchingPointerDrag(e, currentQ.id, idx, null, displayVal);
                                      }
                                    }}
                                    onClick={() => {
                                      if (displayVal) handleUpdateAnswer(matchKey, "");
                                      else if (activeSelectedChip) {
                                        handleUpdateAnswer(matchKey, activeSelectedChip);
                                        setActiveSelectedChip(null);
                                      }
                                    }}
                                    className={`min-w-[130px] h-9 px-4 rounded-xl border-2 font-bold inline-flex items-center justify-center transition-all duration-900 ease-out transform ${
                                      displayVal
                                        ? "border-emerald-700 bg-emerald-50 text-emerald-800 shadow-sm cursor-grab active:cursor-grabbing touch-none hover:scale-[1.02]"
                                        : "border-dashed border-[#6d3807] bg-[#fff8f5] text-[#6d3807] cursor-pointer"
                                    }`}
                                  >
                                    {displayVal}
                                  </div>
                                );
                              })()}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}

              {/* ========================================================= */}
              {/* 5. FLASHCARD CAROUSEL SLIDE VIEW (CLICKABLE PREV/NEXT DIMMED IMAGES + ANIMATIONS) */}
              {/* ========================================================= */}
              {(currentQ.category === "READING_FLASHCARD_SET" || currentQ.category === "WRITING_FLASHCARD_SET") && (() => {
                const fcList: any[] = currentQ.content?.flashcards_resolved || currentQ.content?.flashcards || [];
                if (fcList.length === 0) return <p className="text-xs text-[#857469]">Không có thẻ flashcard nào.</p>;

                const activeFcIdx = flashcardIndexMap[currentQ.id] || 0;
                const activeFc = fcList[activeFcIdx];
                const prevFc = activeFcIdx > 0 ? fcList[activeFcIdx - 1] : null;
                const nextFc = activeFcIdx < fcList.length - 1 ? fcList[activeFcIdx + 1] : null;

                const isWritingFc = currentQ.category === "WRITING_FLASHCARD_SET";
                const fcAudioBtnId = `fc_audio_${currentQ.id}_${activeFcIdx}`;

                const slideDir = slideDirectionMap[currentQ.id] || "next";
                const slideAnimClass = slideDir === "next" ? "anim-slide-next" : "anim-slide-prev";

                // Options for READING_FLASHCARD_SET MCQ mode (from flashcards.options column)
                let rawOptionsFromDb: string[] = [];
                if (Array.isArray(activeFc.options) && activeFc.options.length > 0) {
                  rawOptionsFromDb = activeFc.options;
                }

                const mcqOptions = rawOptionsFromDb;
                const showFreeTypingInput = isWritingFc || mcqOptions.length === 0;

                return (
                  <div className="space-y-4 text-xs relative mx-auto">
                    {/* Header counter */}
                    <div className="flex items-center justify-between border-b border-[#d8c2b6] pb-2">
                      <span className="font-bold text-[#6d3807] uppercase">
                        Flashcard {activeFcIdx + 1} / {fcList.length} (Dùng phím ← → trên bàn phím để chuyển thẻ)
                      </span>
                    </div>

                    {/* Active Flashcard Card Container (Restored Warm Background & Outer Padding) */}
                    <div className="relative p-6 rounded-2xl bg-[#fff8f5] border border-[#d8c2b6] space-y-4 shadow-sm text-center">
                      
                      {/* Large Arrow Buttons Aligned Centered to Image Container Height */}
                      <button
                        type="button"
                        disabled={activeFcIdx === 0}
                        onClick={() => handlePrevFc(currentQ.id, activeFcIdx)}
                        className="absolute left-2 top-[204px] -translate-y-1/2 z-20 w-11 h-11 bg-white border-2 border-[#6d3807] text-[#6d3807] rounded-full flex items-center justify-center shadow-lg disabled:opacity-20 hover:bg-[#6d3807] hover:text-white transition-all"
                      >
                        <ChevronLeft className="w-7 h-7 stroke-[3]" />
                      </button>

                      <button
                        type="button"
                        disabled={activeFcIdx === fcList.length - 1}
                        onClick={() => handleNextFc(currentQ.id, activeFcIdx, fcList.length - 1)}
                        className="absolute right-2 top-[204px] -translate-y-1/2 z-20 w-11 h-11 bg-white border-2 border-[#6d3807] text-[#6d3807] rounded-full flex items-center justify-center shadow-lg disabled:opacity-20 hover:bg-[#6d3807] hover:text-white transition-all"
                      >
                        <ChevronRight className="w-7 h-7 stroke-[3]" />
                      </button>

                      {/* Top Image Frame with Clickable Dimmed Side Previews + Main Active Image Slide Animation */}
                      <div className="relative h-90 w-full flex items-center justify-center space-x-3 bg-black/5 rounded-2xl p-2 border border-[#d8c2b6] overflow-hidden">
                        
                        {/* Dimmed Previous Card Image (Clickable Next/Prev Trigger) */}
                        {prevFc ? (
                          <div
                            onClick={() => handlePrevFc(currentQ.id, activeFcIdx)}
                            className="w-1/4 h-44 rounded-xl overflow-hidden opacity-25 hover:opacity-60 blur-[0.5px] scale-90 hover:scale-95 transition-all duration-900 flex items-center justify-center shrink-0 cursor-pointer group"
                            title="Bấm để quay lại thẻ trước"
                          >
                            {prevFc.image_url ? (
                              <img src={prevFc.image_url} alt="" className="max-h-full max-w-full object-contain group-hover:scale-105 transition-transform" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center font-bold text-[#6d3807] text-xs">Thẻ {activeFcIdx}</div>
                            )}
                          </div>
                        ) : (
                          <div className="w-1/4 h-44 opacity-0 shrink-0" />
                        )}

                        {/* Main Active Card Image (Slide Animated) */}
                        <div className="w-2/4 h-81 flex items-center justify-center shrink-0 relative">
                          {activeFc.image_url ? (
                            <img
                              key={`fc_img_${activeFcIdx}`}
                              src={activeFc.image_url}
                              alt={activeFc.vietnamese_name}
                              className={`max-h-full max-w-full object-contain rounded-xl shadow-sm ${slideAnimClass}`}
                            />
                          ) : (
                            <div className="w-full h-full bg-[#fff1ea] flex items-center justify-center font-bold text-[#6d3807] text-base rounded-xl">
                              Thẻ {activeFcIdx + 1}
                            </div>
                          )}
                        </div>

                        {/* Dimmed Next Card Image (Clickable Next Trigger) */}
                        {nextFc ? (
                          <div
                            onClick={() => handleNextFc(currentQ.id, activeFcIdx, fcList.length - 1)}
                            className="w-1/4 h-44 rounded-xl overflow-hidden opacity-25 hover:opacity-60 blur-[0.5px] scale-90 hover:scale-95 transition-all duration-900 flex items-center justify-center shrink-0 cursor-pointer group"
                            title="Bấm để tới thẻ tiếp theo"
                          >
                            {nextFc.image_url ? (
                              <img src={nextFc.image_url} alt="" className="max-h-full max-w-full object-contain group-hover:scale-105 transition-transform" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center font-bold text-[#6d3807] text-xs">Thẻ {activeFcIdx + 2}</div>
                            )}
                          </div>
                        ) : (
                          <div className="w-1/4 h-44 opacity-0 shrink-0" />
                        )}
                      </div>

                      {/* Card Details & Response Controls with Fade In Up Animation */}
                      <div key={`fc_details_${activeFcIdx}`} className="space-y-4 pt-1 anim-fc-fade">
                        <div className="space-y-1.5">
                          <span className="text-base font-bold text-[#6d3807] block">{activeFc.vietnamese_name}</span>
                          {activeFc.correct_english_word && (
                            <button
                              type="button"
                              onClick={() => playSpeechAudio(activeFc.correct_english_word, "Female", fcAudioBtnId)}
                              className="inline-flex items-center space-x-1.5 text-xs font-bold text-[#6d3807] hover:underline bg-white px-3.5 py-1 rounded-full border border-[#d8c2b6] shadow-sm"
                            >
                              {audioLoadingId === fcAudioBtnId ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin text-[#6d3807]" />
                              ) : audioPlayingId === fcAudioBtnId ? (
                                <Volume2 className="w-3.5 h-3.5 animate-bounce" />
                              ) : (
                                <Volume2 className="w-3.5 h-3.5 text-[#6d3807]" />
                              )}
                              <span>Nghe phát âm từ</span>
                            </button>
                          )}
                        </div>

                        {/* READING_FLASHCARD_SET MCQ Chips & Target Drop Slot vs WRITING_FLASHCARD_SET Free Typing Input (With automatic Fallback) */}
                        {showFreeTypingInput ? (
                          <div className="max-w-md mx-auto space-y-2">
                            <label className="block text-[11px] font-bold text-[#52443a]">Gõ chính xác từ tiếng Anh:</label>
                            <input
                              type="text"
                              placeholder="Gõ từ tiếng Anh..."
                              value={answers[`${currentQ.id}_fc_${activeFcIdx}`] || ""}
                              onChange={(e) => handleUpdateAnswer(`${currentQ.id}_fc_${activeFcIdx}`, e.target.value)}
                              className="w-full px-4 py-2 bg-white border-2 border-[#6d3807] rounded-xl text-xs font-bold text-[#6d3807] text-center focus:outline-none"
                            />
                          </div>
                        ) : (
                          <div className="space-y-3">
                            <span className="block text-[11px] font-bold text-[#52443a]">
                              Chọn hoặc Kéo thả từ tiếng Anh chính xác vào thẻ:
                            </span>

                            {/* Drop Target Slot */}
                            <div
                              onClick={() => {
                                const currentAns = answers[`${currentQ.id}_fc_${activeFcIdx}`];
                                if (currentAns) handleUpdateAnswer(`${currentQ.id}_fc_${activeFcIdx}`, "");
                                else if (activeSelectedChip) {
                                  handleUpdateAnswer(`${currentQ.id}_fc_${activeFcIdx}`, activeSelectedChip);
                                  setActiveSelectedChip(null);
                                }
                              }}
                              onDragOver={(e) => e.preventDefault()}
                              onDrop={(e) => {
                                e.preventDefault();
                                const val = e.dataTransfer.getData("text/plain");
                                if (val) handleUpdateAnswer(`${currentQ.id}_fc_${activeFcIdx}`, val);
                              }}
                              className={`min-w-[140px] h-10 px-5 rounded-xl border-2 font-bold inline-flex items-center justify-center transition-all cursor-pointer ${
                                answers[`${currentQ.id}_fc_${activeFcIdx}`]
                                  ? "border-emerald-700 bg-emerald-50 text-emerald-800 shadow-sm"
                                  : "border-dashed border-[#6d3807] bg-white text-[#6d3807]"
                              }`}
                            >
                              {answers[`${currentQ.id}_fc_${activeFcIdx}`]}
                            </div>

                            {/* Choice Chips (Auto-fitting text width!) */}
                            <div className="flex flex-wrap items-center justify-center gap-2 max-w-md mx-auto pt-1">
                              {mcqOptions.map((optWord: string) => {
                                const isSelected = answers[`${currentQ.id}_fc_${activeFcIdx}`] === optWord;
                                return (
                                  <button
                                    key={optWord}
                                    type="button"
                                    draggable
                                    onDragStart={(e) => e.dataTransfer.setData("text/plain", optWord)}
                                    onClick={() => handleUpdateAnswer(`${currentQ.id}_fc_${activeFcIdx}`, optWord)}
                                    className={`w-auto px-4 py-2 rounded-xl border-2 text-xs font-bold transition-all ${
                                      isSelected
                                        ? "border-emerald-700 bg-emerald-700 text-white shadow-sm"
                                        : "border-[#d8c2b6] bg-white text-[#211a16] hover:bg-[#fff1ea] hover:border-[#6d3807]"
                                    }`}
                                  >
                                    {optWord}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Pagination Dots */}
                      <div className="flex justify-center space-x-1.5 pt-2">
                        {fcList.map((_, i) => (
                          <button
                            key={i}
                            type="button"
                            onClick={() => {
                              setSlideDirectionMap((prev) => ({
                                ...prev,
                                [currentQ.id]: i > activeFcIdx ? "next" : "prev",
                              }));
                              setFlashcardIndexMap((prev) => ({ ...prev, [currentQ.id]: i }));
                            }}
                            className={`w-2.5 h-2.5 rounded-full transition-all ${
                              i === activeFcIdx ? "bg-[#6d3807] w-6" : "bg-[#d8c2b6]"
                            }`}
                          />
                        ))}
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* ========================================================= */}
              {/* 6. WRITING ESSAY (WRITING_ESSAY) */}
              {/* ========================================================= */}
              {currentQ.category === "WRITING_ESSAY" && (
                <div className="space-y-2 text-xs">
                  <span className="text-xs font-bold text-[#6d3807] block uppercase">Soạn bài luận Task 2 (Tối thiểu 250 từ):</span>
                  <textarea
                    rows={10}
                    placeholder="Nhập bài luận tiếng Anh của bạn tại đây..."
                    value={answers[currentQ.id] || ""}
                    onChange={(e) => handleUpdateAnswer(currentQ.id, e.target.value)}
                    className="w-full p-4 bg-white border border-[#d8c2b6] rounded-xl text-xs leading-relaxed focus:outline-none focus:border-[#6d3807]"
                  />
                </div>
              )}

              {/* ========================================================= */}
              {/* 7. WRITING FREE TYPING BLANKS */}
              {/* ========================================================= */}
              {currentQ.category === "WRITING_FREE_TYPING_BLANKS" && (() => {
                const passageText = currentQ.content.passage || currentQ.prompt || "";
                const { parts, gaps } = parseFillInGaps(passageText);

                return (
                  <div className="space-y-4 text-xs">
                    <span className="text-xs font-bold text-[#6d3807] block uppercase">
                      Gõ từ chính xác điền vào chỗ trống:
                    </span>

                    {/* Text Passage Flow with Embedded Inline Typing Inputs */}
                    <div className="p-4 rounded-xl bg-[#fff8f5] border border-[#d8c2b6] leading-loose font-medium text-[#211a16]">
                      {parts.map((partText, idx) => (
                        <span key={idx}>
                          {partText}
                          {idx < (gaps.length > 0 ? gaps.length : 1) && (() => {
                            const gapAnsKey = gaps.length > 0 ? `${currentQ.id}_gap_${idx}` : currentQ.id;
                            const currentAns = answers[gapAnsKey] || "";

                            const targetWord = gaps[idx] || "";
                            const wordLen = targetWord.length || 6;
                            const widthCh = Math.max(wordLen + 2.5, 4);

                            return (
                              <input
                                type="text"
                                value={currentAns}
                                onChange={(e) => handleUpdateAnswer(gapAnsKey, e.target.value)}
                                style={{ width: `${widthCh}ch` }}
                                className="inline-block mx-1 px-2.5 py-0.5 bg-white border border-[#d8c2b6] focus:border-[#6d3807] rounded-lg text-xs font-bold text-[#6d3807] text-left focus:outline-none focus:ring-1 focus:ring-[#ffb782] shadow-2xs transition-all"
                              />
                            );
                          })()}
                        </span>
                      ))}
                    </div>
                  </div>
                );
              })()}

              {/* ========================================================= */}
              {/* 8. WRITING SHORT ANSWER (SUB-QUESTIONS WITH MAX WORDS & TEXTAREA) */}
              {/* ========================================================= */}
              {currentQ.category === "WRITING_SHORT_ANSWER" && (() => {
                const rawSubs =
                  currentQ.content.sub_questions ||
                  currentQ.content.subQuestions ||
                  currentQ.content.shortAnswersList ||
                  [];

                const subQs =
                  rawSubs.length > 0
                    ? rawSubs
                    : [
                        {
                          id: currentQ.id,
                          text: currentQ.prompt || "Nội dung câu hỏi...",
                          max_words: currentQ.content.max_words || 50,
                        },
                      ];

                const isSingle = subQs.length === 1;

                return (
                  <div className="space-y-4 text-xs">
                    <div className="flex items-center justify-between border-b border-[#d8c2b6] pb-2">
                      <span className="text-xs font-bold text-[#6d3807] uppercase">
                        Danh Sách Câu Hỏi Trả Lời Ngắn ({subQs.length} câu):
                      </span>
                    </div>

                    <div className="space-y-4">
                      {subQs.map((sub: any, i: number) => {
                        const subAnsKey = isSingle ? currentQ.id : `${currentQ.id}_sub_${i}`;
                        const maxW = sub.max_words || sub.maxWords || 50;
                        const qText =
                          sub.text ||
                          sub.questionText ||
                          sub.subQuestionText ||
                          sub.prompt ||
                          currentQ.prompt ||
                          `Câu hỏi ${i + 1}`;
                        const currentVal = answers[subAnsKey] || (isSingle ? answers[currentQ.id] : "") || "";

                        return (
                          <div key={i} className="p-4 bg-[#fff8f5] rounded-2xl border border-[#d8c2b6] space-y-3 shadow-sm">
                            <div className="flex items-start justify-between gap-3 border-b border-[#d8c2b6]/50 pb-2">
                              <span className="font-bold text-[#211a16] text-xs leading-relaxed">
                                <span className="text-[#6d3807] font-bold mr-1.5">Câu {i + 1}:</span>
                                {qText}
                              </span>
                              <span className="shrink-0 text-[11px] font-bold text-[#6d3807] bg-[#fff1ea] px-3 py-1 rounded-full border border-[#d8c2b6] shadow-2xs">
                                Tối đa {maxW} từ
                              </span>
                            </div>

                            <textarea
                              rows={3}
                              placeholder={`Nhập câu trả lời ngắn cho Câu ${i + 1} (Tối đa ${maxW} từ)...`}
                              value={currentVal}
                              onChange={(e) => {
                                handleUpdateAnswer(subAnsKey, e.target.value);
                                if (isSingle) handleUpdateAnswer(currentQ.id, e.target.value);
                              }}
                              className="w-full p-3.5 bg-white border border-[#d8c2b6] rounded-xl text-xs text-[#211a16] font-medium leading-relaxed focus:outline-none focus:border-[#6d3807] focus:ring-2 focus:ring-[#ffb782]/40 shadow-inner"
                            />
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}

              {/* ========================================================= */}
              {/* 9. WRITING SENTENCE REWRITE */}
              {/* ========================================================= */}
              {currentQ.category === "WRITING_SENTENCE_REWRITE" && (() => {
                const rawSub = currentQ.content.sub_questions || currentQ.content.subQuestions || [];
                const subQuestions = rawSub.length > 0 ? rawSub : [
                  {
                    id: `${currentQ.id}_0`,
                    original_sentence: currentQ.content.original_sentence || currentQ.content.originalSentence || "",
                    correct_answer: currentQ.content.correct_answer || currentQ.content.correctAnswer || "",
                  }
                ];

                return (
                  <div className="space-y-5 text-xs sm:text-sm font-sans">
                    {subQuestions.map((sub: any, idx: number) => {
                      const subKey = subQuestions.length === 1 ? currentQ.id : `${currentQ.id}_sr_${idx}`;
                      const { cue } = parseSentenceRewriteCue(sub.correct_answer || sub.correctAnswer || "");

                      return (
                        <div key={sub.id || idx} className="space-y-2 p-4 bg-[#fff8f5] rounded-2xl border border-[#d8c2b6] shadow-2xs">
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-[#6d3807] text-xs uppercase tracking-wide">
                              Câu {idx + 1}
                            </span>
                            {cue && (
                              <span className="px-2 py-0.5 bg-[#fff1ea] text-[#6d3807] border border-[#ffb782] rounded-md font-bold text-[11px]">
                                Từ gợi ý: "{cue}"
                              </span>
                            )}
                          </div>

                          <div className="p-3 bg-white rounded-xl border border-[#d8c2b6]/60 leading-relaxed font-medium text-[#211a16]">
                            {sub.original_sentence || sub.originalSentence}
                          </div>

                          <div className="flex items-center bg-white border border-[#d8c2b6] rounded-xl overflow-hidden shadow-2xs focus-within:border-[#6d3807] focus-within:ring-1 focus-within:ring-[#ffb782] transition-all">
                            {cue && (
                              <span className="px-3.5 py-2.5 bg-[#fff1ea] text-[#6d3807] font-bold text-xs sm:text-sm border-r border-[#d8c2b6] shrink-0 select-none flex items-center">
                                {cue}
                              </span>
                            )}
                            <input
                              type="text"
                              placeholder={cue ? "gõ tiếp phần còn lại..." : "Nhập câu viết lại hoàn chỉnh..."}
                              value={answers[subKey] || ""}
                              onChange={(e) => handleUpdateAnswer(subKey, e.target.value)}
                              className="w-full px-3.5 py-2.5 text-xs sm:text-sm font-bold placeholder:font-normal placeholder:text-gray-400 text-[#211a16] focus:outline-none bg-transparent"
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })()}

              {/* ========================================================= */}
              {/* 10. REAL SPEAKING RECORDING & DIRECT AUDIO EVALUATION */}
              {/* ========================================================= */}
              {(currentQ.category === "SPEAKING_TOPIC_PROMPT" || currentQ.category === "SPEAKING_READ_ALOUD") && (() => {
                const isRecording = isRecordingMap[currentQ.id];
                const recTime = recordingTimerMap[currentQ.id] || 0;
                const audioBlobUrl = recordedAudioMap[currentQ.id] || (typeof answers[currentQ.id] === "string" ? answers[currentQ.id] : null);

                return (
                  <div className="space-y-4 text-xs text-center font-sans">
                    <span className="text-xs font-bold text-[#6d3807] block uppercase">
                      Ghi Âm Bài Nói Trực Tiếp:
                    </span>

                    {/* Microphone Recording Control Panel */}
                    <div className="p-6 rounded-2xl bg-[#fff8f5] border-2 border-dashed border-[#6d3807] space-y-4 shadow-2xs">
                      <div className="flex items-center justify-center space-x-3">
                        {isRecording ? (
                          <div className="flex items-center space-x-2 text-rose-600 font-bold animate-pulse text-sm">
                            <Radio className="w-5 h-5 text-rose-600 animate-spin" />
                            <span>Đang ghi âm bài nói... ({formatTimer(recTime)})</span>
                          </div>
                        ) : audioBlobUrl ? (
                          <div className="flex items-center space-x-2 text-emerald-700 font-bold text-sm">
                            <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                            <span>Đã hoàn thành ghi âm bài nói! Bạn có thể nghe lại hoặc ghi âm lại bên dưới.</span>
                          </div>
                        ) : (
                          <span className="text-xs font-bold text-[#52443a]">
                            Bấm nút bên dưới để bắt đầu thu âm từ Microphone
                          </span>
                        )}
                      </div>

                      {/* Audio Playback Player if Recorded */}
                      {audioBlobUrl && !isRecording && (
                        <div className="p-4 bg-white rounded-xl border border-[#d8c2b6] space-y-2 text-left shadow-2xs">
                          <span className="font-bold text-[#6d3807] block text-xs">Bản ghi âm giọng nói của bạn:</span>
                          <audio controls src={audioBlobUrl} className="w-full h-9" />
                        </div>
                      )}

                      {/* Control Action Buttons */}
                      <div className="flex justify-center items-center gap-3">
                        {!isRecording ? (
                          <button
                            type="button"
                            onClick={() => startRecording(currentQ.id)}
                            className="px-6 py-3 bg-[#6d3807] hover:bg-[#8a4f1e] text-white rounded-xl text-xs font-bold shadow-md inline-flex items-center space-x-2 transition-all cursor-pointer"
                          >
                            <Mic className="w-4 h-4 text-[#ffb782]" />
                            <span>{audioBlobUrl ? "🔄 Ghi Âm Lại" : "🎙️ Bắt Đầu Ghi Âm"}</span>
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => stopRecording(currentQ.id)}
                            className="px-6 py-3 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold shadow-md inline-flex items-center space-x-2 transition-all animate-bounce cursor-pointer"
                          >
                            <Square className="w-4 h-4 text-white fill-white" />
                            <span>⏹️ Dừng Ghi Âm</span>
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })()}

            </div>
          </div>

        </section>
      </main>
    </div>
  );
}
