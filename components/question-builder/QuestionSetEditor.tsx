"use client";

import { useState, useEffect, useRef } from "react";
import RichTextEditor from "@/components/RichTextEditor";
import AiExamIngestionStudio from "@/components/teacher/AiExamIngestionStudio";
import {
  getMediaStimulusInfo,
  buildStandardQuestionContent,
  parseSentenceRewriteCue,
  parseFillInGaps,
} from "@/lib/question-content-types";
import {
  Sparkles,
  Save,
  BookOpen,
  Loader2,
  Plus,
  Trash2,
  Volume2,
  ArrowUp,
  ArrowDown,
  GripVertical,
  Layers,
  Edit2,
  XCircle,
} from "lucide-react";

export type SkillType = "Reading" | "Listening" | "Writing" | "Speaking";

export type ReadingQType =
  | "READING_MC"
  | "READING_FILL_IN"
  | "READING_ORDERING"
  | "READING_MATCHING"
  | "READING_FLASHCARD_SET";

export type ListeningQType =
  | "LISTENING_MC"
  | "LISTENING_FILL_IN"
  | "LISTENING_ORDERING"
  | "LISTENING_MATCHING";

export type WritingQType =
  | "WRITING_ESSAY"
  | "WRITING_FREE_TYPING_BLANKS"
  | "WRITING_FLASHCARD_SET"
  | "WRITING_SHORT_ANSWER"
  | "WRITING_SENTENCE_REWRITE";

export type SpeakingQType =
  | "SPEAKING_TOPIC_PROMPT"
  | "SPEAKING_READ_ALOUD";

interface MatchingPair {
  id: string;
  left: string;
  right: string;
}

interface FlashcardItem {
  id: string;
  imageUrl: string;
  vietnameseName: string;
  englishOptions?: string[];
  correctEnglishWord: string;
}

interface SubQuestionMC {
  id: string;
  subQuestionText: string;
  audioSource?: "TTS" | "UPLOAD" | "NONE";
  audioText?: string;
  audioVoice?: string;
  audioUrl?: string;
  optA: string;
  optB: string;
  optC: string;
  optD: string;
  correctAnswer: "A" | "B" | "C" | "D";
}

interface ShortAnswerPrompt {
  id: string;
  questionText: string;
  maxWords: number;
}

interface SentenceRewriteSubItem {
  id: string;
  originalSentence: string;
  correctAnswer: string;
}

export interface QuestionSetSavePayload {
  title: string;
  description: string;
  duration_minutes: number;
  course_id: string | null;
  scoring_standard_id?: string | null;
  question_ids: string[];
}

export interface QuestionSetEditorProps {
  mode: "EXAM" | "LESSON";
  initialTitle?: string;
  initialDescription?: string;
  initialDuration?: number;
  initialCourseId?: string | null;
  initialScoringStandardId?: string | null;
  initialQuestions?: any[];
  initialFlashcards?: any[];
  isLoading?: boolean;
  saveLabel?: string;
  onSave: (payload: QuestionSetSavePayload) => Promise<{ ok: boolean; error?: string }>;
  /** Mở sẵn chế độ "Upload đề thi / bài tập" (AI) — dùng cho /teacher/tests/create?mode=ai */
  initialCreationMode?: "manual" | "ai-ingest";
  aiIngestProps?: {
    initialDestinationType?: "standalone" | "curriculum";
    initialCourseId?: string;
    initialUnitId?: string;
  };
}

export default function QuestionSetEditor(props: QuestionSetEditorProps) {
  const {
    mode,
    initialTitle = "",
    initialDescription = "",
    initialDuration = 60,
    initialCourseId = null,
    initialScoringStandardId = null,
    initialQuestions,
    initialFlashcards,
    isLoading = false,
    saveLabel,
    onSave,
    aiIngestProps,
    initialCreationMode,
  } = props;

  const isExamMode = mode === "EXAM";

  const [creationMode, setCreationMode] = useState<"manual" | "ai-ingest">(initialCreationMode || "manual");
  const [testTitle, setTestTitle] = useState(initialTitle);
  const [selectedCourseId, setSelectedCourseId] = useState<string>(initialCourseId || "");
  const [scoringStandards, setScoringStandards] = useState<any[]>([]);
  const [selectedStandardId, setSelectedStandardId] = useState<string | null>(initialScoringStandardId || null);
  const [testDescription, setTestDescription] = useState(initialDescription);
  const [duration, setDuration] = useState(String(initialDuration || 60));
  const [skillType, setSkillType] = useState<SkillType>("Reading");
  const [, setRubricsList] = useState<any[]>([]);
  const [coursesList, setCoursesList] = useState<any[]>([]);

  const [questionsList, setQuestionsList] = useState<any[]>([]);
  const [editingQuestionId, setEditingQuestionId] = useState<string | null>(null);

  // Set of IDs that are already persisted in DB
  const dbQuestionIds = useRef<Set<string>>(new Set());

  // Drag and Drop Reorder State
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  // Parent Stimulus Header State (Text / Audio / Combined)
  const [stimulusType, setStimulusType] = useState<"TEXT_ONLY" | "AUDIO_ONLY" | "COMBINED">("TEXT_ONLY");
  const [stimulusText, setStimulusText] = useState("");
  const [stimulusAudioText, setStimulusAudioText] = useState("");
  const [stimulusAudioSource, setStimulusAudioSource] = useState<"TTS" | "UPLOAD">("UPLOAD");
  const [stimulusAudioGender, setStimulusAudioGender] = useState<"Female" | "Male">("Female");
  const [stimulusAudioUrl, setStimulusAudioUrl] = useState("");

  const [readingCategory, setReadingCategory] = useState<ReadingQType>("READING_MC");
  const [listeningCategory, setListeningCategory] = useState<ListeningQType>("LISTENING_MC");
  const [writingCategory, setWritingCategory] = useState<WritingQType>("WRITING_ESSAY");
  const [speakingCategory, setSpeakingCategory] = useState<SpeakingQType>("SPEAKING_TOPIC_PROMPT");

  // Sub-element states
  const [mcSubQuestions, setMcSubQuestions] = useState<SubQuestionMC[]>([]);
  const [editingSubQId, setEditingSubQId] = useState<string | null>(null);
  const [subQText, setSubQText] = useState("");
  const [subQAudioSource, setSubQAudioSource] = useState<"TTS" | "UPLOAD" | "NONE">("NONE");
  const [subQAudioText, setSubQAudioText] = useState("");
  const [subQAudioGender, setSubQAudioGender] = useState<"Female" | "Male">("Female");
  const [subQAudioUrl, setSubQAudioUrl] = useState("");
  const [subQOptA, setSubQOptA] = useState("");
  const [subQOptB, setSubQOptB] = useState("");
  const [subQOptC, setSubQOptC] = useState("");
  const [subQOptD, setSubQOptD] = useState("");
  const [subQCorrect, setSubQCorrect] = useState<"A" | "B" | "C" | "D">("A");

  const [questionPrompt, setQuestionPrompt] = useState("");

  const [parenthesesRawText, setParenthesesRawText] = useState(
    "Artificial Intelligence is [slowly] transforming the landscape of language teaching. Students can learn [flexibly]."
  );
  const [fillInSubtype, setFillInSubtype] = useState<"OPTION_BANK" | "INLINE_SELECT">("OPTION_BANK");
  const [optionBankWords, setOptionBankWords] = useState<string[]>(["slowly", "flexibly", "rarely", "rigidly", "poorly"]);
  const [gapDistractorInputs, setGapDistractorInputs] = useState<Record<number, string>>({});

  const [orderingType, setOrderingType] = useState<"SENTENCE_ORDERING" | "WORD_ORDERING">("SENTENCE_ORDERING");
  const [orderingRawText, setOrderingRawText] = useState(
    "Firstly, online education provides flexibility for students. However, face-to-face interaction remains crucial for collaborative learning. Therefore, a blended learning approach is recommended."
  );
  const [orderingItems, setOrderingItems] = useState<string[]>([]);

  useEffect(() => {
    if (!orderingRawText.trim()) {
      setOrderingItems([]);
      return;
    }
    if (orderingType === "SENTENCE_ORDERING") {
      const sentences = orderingRawText
        .split(".")
        .map((s) => s.trim())
        .filter(Boolean)
        .map((s) => (s.endsWith(".") ? s : `${s}.`));
      setOrderingItems(sentences);
    } else {
      const words = orderingRawText
        .split(/\s+/)
        .map((s) => s.trim().replace(/^[\.,!\?]+|[\.,!\?]+$/g, ""))
        .filter(Boolean);
      setOrderingItems(words);
    }
  }, [orderingRawText, orderingType]);

  const [matchingPairs, setMatchingPairs] = useState<MatchingPair[]>([]);
  const [editingPairId, setEditingPairId] = useState<string | null>(null);
  const [matchLeft, setMatchLeft] = useState("");
  const [matchRight, setMatchRight] = useState("");

  const [flashcardsList, setFlashcardsList] = useState<FlashcardItem[]>([]);
  const [editingFcId, setEditingFcId] = useState<string | null>(null);
  const [fcImageUrl, setFcImageUrl] = useState("https://images.unsplash.com/photo-1566073771259-6a8506099945?q=80&w=800&auto=format&fit=crop");
  const [fcVnName, setFcVnName] = useState("");
  const [fcEngWord, setFcEngWord] = useState("");
  const [fcOptionsInput, setFcOptionsInput] = useState("accommodation, destination, transportation, reservation");
  const [fcSearchQuery, setFcSearchQuery] = useState("");
  const [fcSearchResults, setFcSearchResults] = useState<any[]>([]);
  const [isSearchingFc, setIsSearchingFc] = useState(false);

  const [shortAnswersList, setShortAnswersList] = useState<ShortAnswerPrompt[]>([]);
  const [editingSaId, setEditingSaId] = useState<string | null>(null);
  const [saQuestionText, setSaQuestionText] = useState("");
  const [saMaxWords, setSaMaxWords] = useState(50);

  const [essayPromptText, setEssayPromptText] = useState(
    "Write an essay (at least 250 words) discussing the advantages and disadvantages of online education compared to traditional schooling."
  );

  const [rewriteSubQuestions, setRewriteSubQuestions] = useState<Array<{ id: string; originalSentence: string; correctAnswer: string }>>([
    {
      id: "sr_init_1",
      originalSentence: "It is impossible to finish this project without team collaboration.",
      correctAnswer: "[Unless] you collaborate with your team, it is impossible to finish this project.",
    },
  ]);
  const [editingSrId, setEditingSrId] = useState<string | null>(null);
  const [srOriginalSentence, setSrOriginalSentence] = useState("");
  const [srCorrectAnswer, setSrCorrectAnswer] = useState("");

  const [speakingCuePrompt, setSpeakingCuePrompt] = useState(
    "Describe an educational experience that inspired you. You should say: where it happened, who was involved, and why it was memorable."
  );
  const [readAloudPassage, setReadAloudPassage] = useState(
    "Artificial Intelligence in education provides personalized learning pathways for students around the globe."
  );

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSavedMsg, setShowSavedMsg] = useState(false);

  // Audio preview states
  const [isAudioLoading, setIsAudioLoading] = useState(false);
  const [showAudioPopup, setShowAudioPopup] = useState(false);
  const [audioPopupSrc, setAudioPopupSrc] = useState<string | null>(null);
  const [audioPopupText, setAudioPopupText] = useState("");
  const [audioPreviewSrc] = useState("");
  const [ttsErrorModal, setTtsErrorModal] = useState<{
    show: boolean;
    audioUrl?: string;
    fallbackText?: string;
    gender: "Female" | "Male";
  } | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const popupAudioRef = useRef<HTMLAudioElement | null>(null);

  const [subQAudioState, setSubQAudioState] = useState<{
    playingSubQId: string | null;
    status: "IDLE" | "LOADING" | "PLAYING";
  }>({ playingSubQId: null, status: "IDLE" });
  const subQAudioRef = useRef<HTMLAudioElement | null>(null);

  // Sync state from props when they arrive/change
  useEffect(() => {
    if (initialTitle !== undefined) setTestTitle(initialTitle);
  }, [initialTitle]);

  useEffect(() => {
    if (initialDescription !== undefined) setTestDescription(initialDescription);
  }, [initialDescription]);

  useEffect(() => {
    if (initialDuration !== undefined) setDuration(String(initialDuration));
  }, [initialDuration]);

  useEffect(() => {
    if (initialCourseId !== undefined && initialCourseId !== null) {
      setSelectedCourseId(initialCourseId);
    }
  }, [initialCourseId]);

  useEffect(() => {
    if (initialScoringStandardId !== undefined) {
      setSelectedStandardId(initialScoringStandardId);
    }
  }, [initialScoringStandardId]);

  // Load initial courses and rubrics
  useEffect(() => {
    fetch("/api/teacher/courses")
      .then((res) => res.json())
      .then((json) => {
        if (json.success && Array.isArray(json.courses)) {
          setCoursesList(json.courses);
          if (json.courses.length > 0 && !selectedCourseId) {
            setSelectedCourseId(json.courses[0].id);
          }
        }
      })
      .catch((e) => console.warn("Load courses error:", e));

    if (isExamMode) {
      fetch("/api/scoring-standards")
        .then((res) => res.json())
        .then((json) => {
          if (json.standards && Array.isArray(json.standards)) {
            setScoringStandards(json.standards);
          }
        })
        .catch((e) => console.warn("Load scoring standards error:", e));
    }

    fetch("/api/exam/rubrics")
      .then((res) => res.json())
      .then((json) => {
        if (json.success && Array.isArray(json.rubrics)) {
          setRubricsList(json.rubrics);
        }
      })
      .catch((e) => console.warn("Load rubrics error:", e));
  }, [isExamMode]);

  // Hydrate questions from initialQuestions
  useEffect(() => {
    if (!initialQuestions || initialQuestions.length === 0) return;

    dbQuestionIds.current = new Set(initialQuestions.map((q) => q.id));

    const fcMap = new Map((initialFlashcards || []).map((fc: any) => [fc.id, fc]));
    const loadedQuestions: any[] = [];

    for (const qRow of initialQuestions) {
      const c = (typeof qRow.content === "string" ? JSON.parse(qRow.content) : qRow.content) || {};
      const fcIds = c.flashcard_ids || c.flashcardIds || qRow.flashcard_ids || [];

      const hydratedFlashcards: FlashcardItem[] = [];
      if (Array.isArray(fcIds) && fcIds.length > 0) {
        for (const fid of fcIds) {
          const fc = fcMap.get(fid);
          if (fc) {
            hydratedFlashcards.push({
              id: fc.id,
              imageUrl: fc.image_url || fc.imageUrl || "",
              vietnameseName: fc.vietnamese_name || fc.vietnameseName || "",
              correctEnglishWord: fc.correct_english_word || fc.correctEnglishWord || "",
              englishOptions: Array.isArray(fc.options) ? fc.options : (fc.englishOptions || []),
            });
          }
        }
      }

      const sText = qRow.stimulus_text || c.stimulus_text || c.stimulusText || "";
      const sAudio = qRow.stimulus_audio_url || c.stimulus_audio_url || c.stimulusAudioUrl || "";
      const savedType = c.stimulus_type || c.stimulusType;

      let computedType = "TEXT_ONLY";
      if (savedType === "AUDIO_ONLY" || savedType === "COMBINED" || savedType === "TEXT_ONLY") {
        computedType = savedType;
      } else if (sAudio && sText) {
        computedType = "COMBINED";
      } else if (sAudio) {
        computedType = "AUDIO_ONLY";
      }

      loadedQuestions.push({
        id: qRow.id,
        skill: qRow.skill,
        category: qRow.category,
        questionTitle: qRow.prompt || c.questionTitle || "Nội dung câu hỏi",
        prompt: qRow.prompt || "",
        stimulus_text: sText,
        stimulusText: sText,
        stimulus_audio_url: sAudio,
        stimulusAudioUrl: sAudio,
        stimulusType: computedType,
        stimulus_type: computedType,
        ...c,
        flashcardsList: hydratedFlashcards,
        flashcards: hydratedFlashcards,
        flashcard_ids: fcIds,
      });
    }

    setQuestionsList(loadedQuestions);
  }, [initialQuestions, initialFlashcards]);

  const cleanHtmlText = (str?: string | null): string => {
    if (!str) return "";
    const trimmed = str.trim();
    const strippedText = trimmed
      .replace(/<[^>]*>/g, "")
      .replace(/&nbsp;/gi, " ")
      .trim();
    if (!strippedText) return "";
    return trimmed;
  };

  const handleStimulusAudioTextChange = (val: string) => {
    const trimmed = val.trim();
    const isUrl =
      /^(https?:\/\/|blob:|data:audio|\/storage\/|\/uploads\/)/i.test(trimmed) ||
      /(?:youtube\.com|youtu\.be)/i.test(trimmed) ||
      /\.(mp3|wav|ogg|m4a|aac|flac)(\?.*)?$/i.test(trimmed);

    if (isUrl) {
      setStimulusAudioSource("UPLOAD");
      setStimulusAudioUrl(trimmed);
      setStimulusAudioText("");
    } else {
      setStimulusAudioText(val);
    }
  };

  const getTtsHdUrl = (word: string, gender: "Female" | "Male" = "Female", useFallback: boolean = false) => {
    const cleanWord = encodeURIComponent((word || "accommodation").trim());
    return `/api/tts?text=${cleanWord}&gender=${gender}${useFallback ? "&fallback=true" : ""}`;
  };

  const handleToggleSubQAudioInline = (sub: any, fallbackText?: string, gender: "Female" | "Male" = "Female") => {
    const targetId = sub?.id || "temp_form_subq";

    if (subQAudioState.playingSubQId === targetId && subQAudioState.status === "PLAYING") {
      if (subQAudioRef.current) {
        subQAudioRef.current.pause();
      }
      setSubQAudioState({ playingSubQId: null, status: "IDLE" });
      return;
    }

    if (subQAudioRef.current) {
      subQAudioRef.current.pause();
      subQAudioRef.current.src = "";
    }

    const audioUrl = sub?.audioUrl || getTtsHdUrl(fallbackText || sub?.subQuestionText || "Listening question", gender);
    setSubQAudioState({ playingSubQId: targetId, status: "LOADING" });

    try {
      const audio = new Audio(audioUrl);
      subQAudioRef.current = audio;

      audio.oncanplaythrough = () => {
        audio.play().catch(() => {});
        setSubQAudioState({ playingSubQId: targetId, status: "PLAYING" });
      };

      audio.onplay = () => {
        setSubQAudioState({ playingSubQId: targetId, status: "PLAYING" });
      };

      audio.onended = () => {
        setSubQAudioState({ playingSubQId: null, status: "IDLE" });
      };

      audio.onerror = () => {
        setSubQAudioState({ playingSubQId: null, status: "IDLE" });
      };

      audio.load();
    } catch (err) {
      console.error("Inline audio play error:", err);
      setSubQAudioState({ playingSubQId: null, status: "IDLE" });
    }
  };

  const handlePlayPreviewAudio = async (
    audioUrl?: string,
    fallbackText?: string,
    gender: "Female" | "Male" = "Female",
    useFallback: boolean = false
  ) => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    if (popupAudioRef.current) {
      popupAudioRef.current.pause();
      popupAudioRef.current.src = "";
    }

    if (audioPopupSrc) {
      URL.revokeObjectURL(audioPopupSrc);
      setAudioPopupSrc(null);
    }

    const textToRead = fallbackText || "This is a test audio preview from Google Gemini";
    setAudioPopupText(textToRead);
    setShowAudioPopup(true);
    setIsAudioLoading(true);

    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      const targetUrl = audioUrl || getTtsHdUrl(textToRead, gender, useFallback);
      const res = await fetch(targetUrl, { signal: controller.signal });
      if (!res.ok) throw new Error("Audio generation failed");

      const blob = await res.blob();
      const objectUrl = URL.createObjectURL(blob);
      setAudioPopupSrc(objectUrl);
      setIsAudioLoading(false);

      setTimeout(() => {
        if (popupAudioRef.current) {
          popupAudioRef.current.play().catch((err) => console.warn("Auto-play blocked:", err));
        }
      }, 200);
    } catch (err: any) {
      if (err.name === "AbortError") return;
      setIsAudioLoading(false);
      setShowAudioPopup(false);
      setTtsErrorModal({
        show: true,
        audioUrl,
        fallbackText: textToRead,
        gender,
      });
    }
  };

  const handleCloseAudioPopup = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    if (popupAudioRef.current) {
      popupAudioRef.current.pause();
      popupAudioRef.current.src = "";
    }
    if (audioPopupSrc) {
      URL.revokeObjectURL(audioPopupSrc);
      setAudioPopupSrc(null);
    }
    setShowAudioPopup(false);
    setIsAudioLoading(false);
  };

  const resetCategoryStates = () => {
    setMcSubQuestions([]);
    setEditingSubQId(null);
    setSubQText("");
    setSubQOptA("");
    setSubQOptB("");
    setSubQOptC("");
    setSubQOptD("");
    setSubQCorrect("A");
    setSubQAudioSource("NONE");
    setSubQAudioText("");
    setSubQAudioUrl("");

    setParenthesesRawText("Artificial Intelligence is [slowly] transforming the landscape of language teaching. Students can learn [flexibly].");
    setOptionBankWords(["slowly", "flexibly", "rarely", "rigidly", "poorly"]);
    setGapDistractorInputs({});

    setOrderingRawText("Firstly, online education provides flexibility for students. However, face-to-face interaction remains crucial for collaborative learning. Therefore, a blended learning approach is recommended.");
    setMatchingPairs([]);
    setEditingPairId(null);
    setMatchLeft("");
    setMatchRight("");

    setFlashcardsList([]);
    setEditingFcId(null);
    setFcImageUrl("https://images.unsplash.com/photo-1566073771259-6a8506099945?q=80&w=800&auto=format&fit=crop");
    setFcVnName("");
    setFcEngWord("");

    setShortAnswersList([]);
    setEditingSaId(null);
    setSaQuestionText("");
    setSaMaxWords(50);

    setEssayPromptText("Write an essay (at least 250 words) discussing the advantages and disadvantages of online education compared to traditional schooling.");
    setRewriteSubQuestions([
      {
        id: "sr_init_1",
        originalSentence: "It is impossible to finish this project without team collaboration.",
        correctAnswer: "[Unless] you collaborate with your team, it is impossible to finish this project.",
      },
    ]);
    setEditingSrId(null);
    setSrOriginalSentence("");
    setSrCorrectAnswer("");

    setSpeakingCuePrompt("Describe an educational experience that inspired you. You should say: where it happened, who was involved, and why it was memorable.");
    setReadAloudPassage("Artificial Intelligence in education provides personalized learning pathways for students around the globe.");
  };

  const handleSwitchSkill = (sk: SkillType) => {
    setSkillType(sk);
    resetCategoryStates();
    setQuestionPrompt("");
    setStimulusText("");
    setStimulusAudioText("");
    setStimulusAudioUrl("");
    setStimulusType(sk === "Listening" ? "AUDIO_ONLY" : "TEXT_ONLY");
    setStimulusAudioSource(sk === "Listening" ? "UPLOAD" : "UPLOAD");
    setStimulusAudioGender("Female");
    setEditingQuestionId(null);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, setter: (val: string) => void) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const fd = new FormData();
      fd.append("kind", "audio");
      fd.append("file", file);

      const res = await fetch("/api/uploads", {
        method: "POST",
        body: fd,
      });

      const resData = await res.json().catch(() => null);
      if (!res.ok || !resData?.success) {
        alert("Lỗi upload audio: " + (resData?.error || res.statusText));
        return;
      }

      if (resData.url) {
        setter(resData.url);
        return;
      }
    } catch (err: any) {
      console.error("Audio upload error:", err);
      alert("Lỗi tải file âm thanh");
    }
  };

  // SubQ Handlers
  const handleAddOrUpdateMcSubQ = () => {
    if (!subQText.trim()) return;

    const item: SubQuestionMC = {
      id: editingSubQId || `subq_${Date.now()}`,
      subQuestionText: subQText.trim(),
      optA: subQOptA.trim() || "Option A",
      optB: subQOptB.trim() || "Option B",
      optC: subQOptC.trim() || "Option C",
      optD: subQOptD.trim() || "Option D",
      correctAnswer: subQCorrect,
      audioSource: subQAudioSource,
      audioText: subQAudioSource === "TTS" ? subQAudioText.trim() : undefined,
      audioVoice: subQAudioSource === "TTS" ? subQAudioGender : undefined,
      audioUrl: subQAudioSource === "UPLOAD" ? subQAudioUrl.trim() : undefined,
    };

    if (editingSubQId) {
      setMcSubQuestions(mcSubQuestions.map((q) => (q.id === editingSubQId ? item : q)));
      setEditingSubQId(null);
    } else {
      setMcSubQuestions([...mcSubQuestions, item]);
    }

    setSubQText("");
    setSubQOptA("");
    setSubQOptB("");
    setSubQOptC("");
    setSubQOptD("");
    setSubQCorrect("A");
    setSubQAudioSource("NONE");
    setSubQAudioText("");
    setSubQAudioUrl("");
  };

  const handleEditMcSubQ = (sub: SubQuestionMC) => {
    setEditingSubQId(sub.id);
    setSubQText(sub.subQuestionText);
    setSubQOptA(sub.optA);
    setSubQOptB(sub.optB);
    setSubQOptC(sub.optC);
    setSubQOptD(sub.optD);
    setSubQCorrect(sub.correctAnswer);
    setSubQAudioSource(sub.audioSource || "NONE");
    setSubQAudioText(sub.audioText || "");
    setSubQAudioGender((sub.audioVoice as any) || "Female");
    setSubQAudioUrl(sub.audioUrl || "");
  };

  const handleDeleteMcSubQ = (id: string) => {
    setMcSubQuestions(mcSubQuestions.filter((q) => q.id !== id));
  };

  const handleAddOrUpdateMatchingPair = () => {
    if (!matchLeft.trim() || !matchRight.trim()) return;
    const pair: MatchingPair = {
      id: editingPairId || `pair_${Date.now()}`,
      left: matchLeft.trim(),
      right: matchRight.trim(),
    };
    if (editingPairId) {
      setMatchingPairs(matchingPairs.map((p) => (p.id === editingPairId ? pair : p)));
      setEditingPairId(null);
    } else {
      setMatchingPairs([...matchingPairs, pair]);
    }
    setMatchLeft("");
    setMatchRight("");
  };

  const handleEditMatchingPair = (pair: MatchingPair) => {
    setEditingPairId(pair.id);
    setMatchLeft(pair.left);
    setMatchRight(pair.right);
  };

  const handleDeleteMatchingPair = (id: string) => {
    setMatchingPairs(matchingPairs.filter((p) => p.id !== id));
  };

  // Flashcards search & management
  const handleSearchFlashcards = async (query: string) => {
    setFcSearchQuery(query);
    if (!query.trim()) {
      setFcSearchResults([]);
      return;
    }
    setIsSearchingFc(true);
    try {
      const res = await fetch(`/api/teacher/flashcards?q=${encodeURIComponent(query.trim())}`);
      const resData = await res.json().catch(() => null);
      const data = resData?.flashcards || [];

      const existingIds = new Set(flashcardsList.map((fc) => fc.id));
      const existingEngWords = new Set(flashcardsList.map((fc) => (fc.correctEnglishWord || "").toLowerCase().trim()));

      const filtered = (data || []).slice(0, 12).filter((fcRow: any) => {
        const isIdMatch = existingIds.has(fcRow.id);
        const isWordMatch = existingEngWords.has((fcRow.correct_english_word || "").toLowerCase().trim());
        return !isIdMatch && !isWordMatch;
      });

      setFcSearchResults(filtered);
    } catch (err) {
      console.error("Search fc err:", err);
    } finally {
      setIsSearchingFc(false);
    }
  };

  const handleSelectExistingFc = (fcRow: any) => {
    const isAlreadyAdded = flashcardsList.some(
      (fc) => fc.id === fcRow.id || fc.correctEnglishWord.toLowerCase().trim() === fcRow.correct_english_word.toLowerCase().trim()
    );

    if (!isAlreadyAdded) {
      const item: FlashcardItem = {
        id: fcRow.id,
        imageUrl: fcRow.image_url || "",
        vietnameseName: fcRow.vietnamese_name,
        correctEnglishWord: fcRow.correct_english_word,
        englishOptions: fcRow.options || [],
      };
      setFlashcardsList([...flashcardsList, item]);
    }
  };

  const handleAddOrUpdateFlashcard = async () => {
    if (!fcVnName.trim() || !fcEngWord.trim()) return;

    let fcId = editingFcId;
    const parsedOptions = fcOptionsInput
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    if (!parsedOptions.includes(fcEngWord.trim())) {
      parsedOptions.push(fcEngWord.trim());
    }

    try {
      const payload = {
        vietnamese_name: fcVnName.trim(),
        correct_english_word: fcEngWord.trim(),
        options: parsedOptions,
        image_url: fcImageUrl.trim() || null,
        audio_url: getTtsHdUrl(fcEngWord.trim(), "Female"),
      };

      if (editingFcId) {
        await fetch(`/api/teacher/flashcards/${editingFcId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      } else {
        const res = await fetch("/api/teacher/flashcards", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const resData = await res.json().catch(() => null);
        if (resData?.flashcard?.id) {
          fcId = resData.flashcard.id;
        }
      }
    } catch (err) {
      console.warn("Save flashcard entity error:", err);
    }

    const item: FlashcardItem = {
      id: fcId || `fc_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
      imageUrl: fcImageUrl.trim(),
      vietnameseName: fcVnName.trim(),
      correctEnglishWord: fcEngWord.trim(),
      englishOptions: parsedOptions,
    };

    if (editingFcId) {
      setFlashcardsList(flashcardsList.map((fc) => (fc.id === editingFcId ? item : fc)));
      setEditingFcId(null);
    } else {
      setFlashcardsList([...flashcardsList, item]);
    }

    setFcVnName("");
    setFcEngWord("");
    setFcOptionsInput("");
  };

  const handleEditFlashcard = (fc: FlashcardItem) => {
    setEditingFcId(fc.id);
    setFcImageUrl(fc.imageUrl);
    setFcVnName(fc.vietnameseName);
    setFcEngWord(fc.correctEnglishWord);
    setFcOptionsInput((fc.englishOptions || []).join(", "));
  };

  const handleDeleteFlashcard = (id: string) => {
    setFlashcardsList(flashcardsList.filter((fc) => fc.id !== id));
  };

  const handleAddOrUpdateShortAnswer = () => {
    if (!saQuestionText.trim()) return;
    const item: ShortAnswerPrompt = {
      id: editingSaId || `sa_${Date.now()}`,
      questionText: saQuestionText.trim(),
      maxWords: Number(saMaxWords) || 50,
    };
    if (editingSaId) {
      setShortAnswersList(shortAnswersList.map((sa) => (sa.id === editingSaId ? item : sa)));
      setEditingSaId(null);
    } else {
      setShortAnswersList([...shortAnswersList, item]);
    }
    setSaQuestionText("");
    setSaMaxWords(50);
  };

  const handleEditShortAnswer = (sa: ShortAnswerPrompt) => {
    setEditingSaId(sa.id);
    setSaQuestionText(sa.questionText);
    setSaMaxWords(sa.maxWords);
  };

  const handleDeleteShortAnswer = (id: string) => {
    setShortAnswersList(shortAnswersList.filter((sa) => sa.id !== id));
  };

  const handleAddOrUpdateSentenceRewrite = () => {
    if (!srOriginalSentence.trim() || !srCorrectAnswer.trim()) return;
    const item = {
      id: editingSrId || `sr_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
      originalSentence: srOriginalSentence.trim(),
      correctAnswer: srCorrectAnswer.trim(),
    };
    if (editingSrId) {
      setRewriteSubQuestions(rewriteSubQuestions.map((q) => (q.id === editingSrId ? item : q)));
      setEditingSrId(null);
    } else {
      setRewriteSubQuestions([...rewriteSubQuestions, item]);
    }
    setSrOriginalSentence("");
    setSrCorrectAnswer("");
  };

  const handleEditSentenceRewrite = (sr: { id: string; originalSentence: string; correctAnswer: string }) => {
    setEditingSrId(sr.id);
    setSrOriginalSentence(sr.originalSentence);
    setSrCorrectAnswer(sr.correctAnswer);
  };

  const handleDeleteSentenceRewrite = (id: string) => {
    setRewriteSubQuestions(rewriteSubQuestions.filter((q) => q.id !== id));
  };

  // Drag and drop
  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (dragOverIndex !== index) {
      setDragOverIndex(index);
    }
  };

  const handleDrop = (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === dropIndex) return;

    const updated = [...questionsList];
    const [draggedItem] = updated.splice(draggedIndex, 1);
    updated.splice(dropIndex, 0, draggedItem);

    setQuestionsList(updated);
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  const handleMoveQuestionUp = (idx: number) => {
    if (idx <= 0) return;
    const list = [...questionsList];
    const temp = list[idx - 1];
    list[idx - 1] = list[idx];
    list[idx] = temp;
    setQuestionsList(list);
  };

  const handleMoveQuestionDown = (idx: number) => {
    if (idx >= questionsList.length - 1) return;
    const list = [...questionsList];
    const temp = list[idx + 1];
    list[idx + 1] = list[idx];
    list[idx] = temp;
    setQuestionsList(list);
  };

  const handleDeleteQuestion = (idx: number) => {
    setQuestionsList(questionsList.filter((_, i) => i !== idx));
  };

  const handleAddOrUpdateQuestion = (e: React.FormEvent) => {
    e.preventDefault();

    const cleanText = cleanHtmlText(stimulusText);

    let finalStimulusText: string | null = null;
    let finalStimulusAudioUrl: string | null = null;
    let finalStimulusAudioText: string | null = null;

    if (stimulusType === "TEXT_ONLY") {
      finalStimulusText = cleanText || null;
      finalStimulusAudioUrl = null;
      finalStimulusAudioText = null;
    } else if (stimulusType === "AUDIO_ONLY") {
      finalStimulusText = null;
      if (stimulusAudioSource === "TTS") {
        finalStimulusAudioText = stimulusAudioText.trim() || null;
        finalStimulusAudioUrl = stimulusAudioText.trim() ? getTtsHdUrl(stimulusAudioText.trim(), stimulusAudioGender) : null;
      } else {
        finalStimulusAudioText = null;
        finalStimulusAudioUrl = stimulusAudioUrl.trim() || null;
      }
    } else if (stimulusType === "COMBINED") {
      finalStimulusText = cleanText || null;
      if (stimulusAudioSource === "TTS") {
        finalStimulusAudioText = stimulusAudioText.trim() || null;
        finalStimulusAudioUrl = stimulusAudioText.trim() ? getTtsHdUrl(stimulusAudioText.trim(), stimulusAudioGender) : null;
      } else {
        finalStimulusAudioText = null;
        finalStimulusAudioUrl = stimulusAudioUrl.trim() || null;
      }
    }

    const payload: any = {
      id: editingQuestionId || `q_${Date.now()}`,
      skill: skillType,
      stimulusType,
      stimulus_type: stimulusType,
      stimulusText: finalStimulusText || "",
      stimulus_text: finalStimulusText,
      prompt: questionPrompt.trim() || undefined,
      stimulusAudioText: finalStimulusAudioText || "",
      stimulusAudioUrl: finalStimulusAudioUrl,
      stimulus_audio_url: finalStimulusAudioUrl,
    };

    const formattedSubQuestions = mcSubQuestions.map((sq) => {
      let correctVal = sq.optA;
      if (sq.correctAnswer === "B") correctVal = sq.optB;
      if (sq.correctAnswer === "C") correctVal = sq.optC;
      if (sq.correctAnswer === "D") correctVal = sq.optD;
      return {
        id: sq.id,
        text: sq.subQuestionText,
        option_a: sq.optA,
        option_b: sq.optB,
        option_c: sq.optC,
        option_d: sq.optD,
        correct_answer: correctVal,
        audio_url: sq.audioUrl || null,
      };
    });

    if (skillType === "Reading") {
      payload.category = readingCategory;
      if (readingCategory === "READING_MC") {
        payload.questionTitle = "Đọc đoạn văn và trả lời các câu hỏi trắc nghiệm sau:";
        payload.sub_questions = formattedSubQuestions;
        payload.subQuestions = mcSubQuestions;
      } else if (readingCategory === "READING_FILL_IN") {
        payload.questionTitle = "Đọc đoạn văn và điền từ thích hợp vào các chỗ trống:";
        payload.passage = parenthesesRawText;
        payload.fillInSubtype = fillInSubtype;
        payload.fill_subtype = fillInSubtype;
        if (fillInSubtype === "OPTION_BANK") {
          payload.optionBank = optionBankWords;
          payload.option_bank = optionBankWords;
        } else {
          const { gaps } = parseFillInGaps(parenthesesRawText);
          const optionBanks = gaps.map((correctVal: string, gIdx: number) => {
            const rawDistStr = gapDistractorInputs[gIdx] || "";
            const dists = rawDistStr.split(",").map((s) => s.trim()).filter(Boolean);
            const combinedOptions = Array.from(new Set([correctVal, ...dists]));
            return {
              gap_index: gIdx,
              correct_answer: correctVal,
              options: combinedOptions,
            };
          });
          payload.option_banks = optionBanks;
          payload.optionBanks = optionBanks;
        }
      } else if (readingCategory === "READING_ORDERING") {
        payload.questionTitle = "Sắp xếp lại các câu/đoạn sau theo thứ tự đúng logic:";
        payload.orderingType = orderingType;
        payload.ordering_type = orderingType;
        payload.items = orderingItems;
        payload.correct_text = orderingRawText.trim();
      } else if (readingCategory === "READING_MATCHING") {
        payload.questionTitle = "Nối các từ ở Cột A với định nghĩa phù hợp ở Cột B:";
        payload.pairs = matchingPairs;
      } else if (readingCategory === "READING_FLASHCARD_SET") {
        payload.questionTitle = "Chọn từ tiếng Anh chính xác tương ứng với thẻ từ vựng:";
        payload.flashcardsList = flashcardsList;
        payload.flashcards = flashcardsList;
        payload.flashcard_ids = flashcardsList.map((fc) => fc.id);
      }
    } else if (skillType === "Listening") {
      payload.category = listeningCategory;
      if (listeningCategory === "LISTENING_MC") {
        payload.questionTitle = "Nghe đoạn băng và trả lời các câu hỏi trắc nghiệm sau:";
        payload.sub_questions = formattedSubQuestions;
        payload.subQuestions = mcSubQuestions;
      } else if (listeningCategory === "LISTENING_FILL_IN") {
        payload.questionTitle = "Nghe đoạn băng và điền từ thích hợp vào các chỗ trống:";
        payload.passage = parenthesesRawText;
        payload.fillInSubtype = fillInSubtype;
        payload.fill_subtype = fillInSubtype;
        if (fillInSubtype === "OPTION_BANK") {
          payload.optionBank = optionBankWords;
          payload.option_bank = optionBankWords;
        } else {
          const { gaps } = parseFillInGaps(parenthesesRawText);
          const optionBanks = gaps.map((correctVal: string, gIdx: number) => {
            const rawDistStr = gapDistractorInputs[gIdx] || "";
            const dists = rawDistStr.split(",").map((s) => s.trim()).filter(Boolean);
            const combinedOptions = Array.from(new Set([correctVal, ...dists]));
            return {
              gap_index: gIdx,
              correct_answer: correctVal,
              options: combinedOptions,
            };
          });
          payload.option_banks = optionBanks;
          payload.optionBanks = optionBanks;
        }
      } else if (listeningCategory === "LISTENING_ORDERING") {
        payload.questionTitle = "Nghe đoạn âm thanh và sắp xếp các câu theo thứ tự đã nghe:";
        payload.orderingType = orderingType;
        payload.ordering_type = orderingType;
        payload.items = orderingItems;
        payload.correct_text = orderingRawText.trim();
      } else if (listeningCategory === "LISTENING_MATCHING") {
        payload.questionTitle = "Nghe và nối thông tin tương ứng ở hai cột:";
        payload.pairs = matchingPairs;
      }
    } else if (skillType === "Writing") {
      payload.category = writingCategory;
      if (writingCategory === "WRITING_ESSAY") {
        payload.questionTitle = "Bài viết luận IELTS Writing:";
        payload.prompt = essayPromptText.trim();
      } else if (writingCategory === "WRITING_FREE_TYPING_BLANKS") {
        payload.questionTitle = "Điền từ thích hợp vào các chỗ trống (tự gõ từ):";
        payload.passage = parenthesesRawText;
      } else if (writingCategory === "WRITING_FLASHCARD_SET") {
        payload.questionTitle = "Quan sát hình ảnh / nghĩa tiếng Việt và gõ từ tiếng Anh tương ứng:";
        payload.flashcardsList = flashcardsList;
        payload.flashcards = flashcardsList;
        payload.flashcard_ids = flashcardsList.map((fc) => fc.id);
      } else if (writingCategory === "WRITING_SHORT_ANSWER") {
        payload.questionTitle = "Trả lời các câu hỏi ngắn sau:";
        payload.sub_questions = shortAnswersList.map((sa) => ({
          id: sa.id,
          question_text: sa.questionText,
          max_words: sa.maxWords,
        }));
        payload.subQuestions = shortAnswersList;
      } else if (writingCategory === "WRITING_SENTENCE_REWRITE") {
        payload.questionTitle = "Viết lại các câu sau sử dụng từ gợi ý được cho sẵn trong ngoặc vuông:";
        const formattedRewriteSubs = rewriteSubQuestions.map((sr) => ({
          id: sr.id,
          original_sentence: sr.originalSentence,
          correct_answer: sr.correctAnswer,
        }));
        payload.sub_questions = formattedRewriteSubs;
        payload.subQuestions = rewriteSubQuestions;
      }
    } else if (skillType === "Speaking") {
      payload.category = speakingCategory;
      if (speakingCategory === "SPEAKING_TOPIC_PROMPT") {
        payload.questionTitle = "Bài nói theo chủ đề Cue Card:";
        payload.prompt = speakingCuePrompt.trim();
      } else if (speakingCategory === "SPEAKING_READ_ALOUD") {
        payload.questionTitle = "Đọc thành tiếng đoạn văn mẫu và thu âm phát âm:";
        payload.passage = readAloudPassage.trim();
      }
    }

    if (editingQuestionId) {
      setQuestionsList(questionsList.map((q) => (q.id === editingQuestionId ? payload : q)));
      setEditingQuestionId(null);
    } else {
      setQuestionsList([...questionsList, payload]);
    }

    // Reset Form Fields
    setStimulusText("");
    setStimulusAudioText("");
    setStimulusAudioUrl("");
    setMcSubQuestions([]);
    setMatchingPairs([]);
    setFlashcardsList([]);
    setShortAnswersList([]);
    setRewriteSubQuestions([
      {
        id: "sr_init_1",
        originalSentence: "It is impossible to finish this project without team collaboration.",
        correctAnswer: "[Unless] you collaborate with your team, it is impossible to finish this project.",
      },
    ]);
  };

  const handleEditMainQuestion = async (q: any) => {
    const sText = q.stimulusText || q.stimulus_text || (q.content && (q.content.stimulus_text || q.content.stimulusText)) || "";
    const sAudio = q.stimulusAudioUrl || q.stimulus_audio_url || (q.content && (q.content.stimulus_audio_url || q.content.stimulusAudioUrl)) || "";

    let derivedType = q.stimulusType || q.stimulus_type || (q.content && (q.content.stimulus_type || q.content.stimulusType));
    if (!derivedType || (derivedType !== "AUDIO_ONLY" && derivedType !== "COMBINED" && derivedType !== "TEXT_ONLY")) {
      if (sAudio && sText) derivedType = "COMBINED";
      else if (sAudio) derivedType = "AUDIO_ONLY";
      else derivedType = "TEXT_ONLY";
    }

    setEditingQuestionId(q.id);
    setSkillType(q.skill);
    setStimulusType(derivedType);
    setStimulusText(sText);
    setStimulusAudioText(q.stimulusAudioText || "");
    setStimulusAudioUrl(sAudio);
    setQuestionPrompt(q.prompt || q.customPrompt || q.questionTitle || "");

    let fcList: FlashcardItem[] = q.flashcardsList || q.flashcards || q.flashcards_resolved || [];
    const fcIds: string[] = q.flashcard_ids || q.flashcardIds || (q.content && (q.content.flashcard_ids || q.content.flashcardIds)) || [];

    if (fcList.length === 0 && fcIds.length > 0) {
      try {
        const res = await fetch("/api/teacher/flashcards");
        const resData = await res.json().catch(() => null);
        const fcRows = (resData?.flashcards || []).filter((fc: any) => fcIds.includes(fc.id));

        if (fcRows.length > 0) {
          fcList = fcRows.map((fc: any) => ({
            id: fc.id,
            imageUrl: fc.image_url || "",
            vietnameseName: fc.vietnamese_name || "",
            correctEnglishWord: fc.correct_english_word || "",
            englishOptions: fc.options || [],
          }));
        }
      } catch (err) {
        console.error("Error fetching flashcards on edit:", err);
      }
    }

    if (q.skill === "Reading") {
      setReadingCategory(q.category);
      if (q.category === "READING_MC") setMcSubQuestions(q.subQuestions || q.sub_questions || []);
      if (q.category === "READING_FILL_IN") {
        const pText = q.passage || (q.content && q.content.passage) || "";
        setParenthesesRawText(pText);
        const subType = q.fillInSubtype || q.fill_subtype || (q.content && q.content.fill_subtype) || "OPTION_BANK";
        setFillInSubtype(subType);
        setOptionBankWords(q.optionBank || q.option_bank || (q.content && q.content.option_bank) || []);

        const rawOptionBanks = q.option_banks || q.optionBanks || (q.content && q.content.option_banks) || [];
        const distMap: Record<number, string> = {};
        if (Array.isArray(rawOptionBanks)) {
          const { gaps } = parseFillInGaps(pText);
          rawOptionBanks.forEach((item: any) => {
            const gIdx = item.gap_index;
            const opts: string[] = item.options || [];
            const correctVal = gaps[gIdx] || "";
            const distractors = opts.filter((o) => o !== correctVal);
            distMap[gIdx] = distractors.join(", ");
          });
        }
        setGapDistractorInputs(distMap);
      }
      if (q.category === "READING_ORDERING") setOrderingRawText(q.items?.join(". ") || q.correct_text || "");
      if (q.category === "READING_MATCHING") setMatchingPairs(q.pairs || []);
      if (q.category === "READING_FLASHCARD_SET") setFlashcardsList(fcList);
    } else if (q.skill === "Listening") {
      setListeningCategory(q.category);
      if (q.category === "LISTENING_MC") setMcSubQuestions(q.subQuestions || q.sub_questions || []);
      if (q.category === "LISTENING_FILL_IN") {
        const pText = q.passage || (q.content && q.content.passage) || "";
        setParenthesesRawText(pText);
        const subType = q.fillInSubtype || q.fill_subtype || (q.content && q.content.fill_subtype) || "OPTION_BANK";
        setFillInSubtype(subType);
        setOptionBankWords(q.optionBank || q.option_bank || (q.content && q.content.option_bank) || []);

        const rawOptionBanks = q.option_banks || q.optionBanks || (q.content && q.content.option_banks) || [];
        const distMap: Record<number, string> = {};
        if (Array.isArray(rawOptionBanks)) {
          const { gaps } = parseFillInGaps(pText);
          rawOptionBanks.forEach((item: any) => {
            const gIdx = item.gap_index;
            const opts: string[] = item.options || [];
            const correctVal = gaps[gIdx] || "";
            const distractors = opts.filter((o) => o !== correctVal);
            distMap[gIdx] = distractors.join(", ");
          });
        }
        setGapDistractorInputs(distMap);
      }
    } else if (q.skill === "Writing") {
      setWritingCategory(q.category);
      if (q.category === "WRITING_ESSAY") setEssayPromptText(q.prompt || "");
      if (q.category === "WRITING_FREE_TYPING_BLANKS") setParenthesesRawText(q.passage || "");
      if (q.category === "WRITING_FLASHCARD_SET") setFlashcardsList(fcList);
      if (q.category === "WRITING_SHORT_ANSWER") setShortAnswersList(q.subQuestions || q.sub_questions || []);
      if (q.category === "WRITING_SENTENCE_REWRITE") {
        const rawSub = q.subQuestions || q.sub_questions || (q.content && q.content.sub_questions) || [];
        let formattedSub: SentenceRewriteSubItem[] = [];

        if (Array.isArray(rawSub) && rawSub.length > 0) {
          formattedSub = rawSub.map((sr: any) => ({
            id: sr.id || `sr_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
            originalSentence: sr.original_sentence || sr.originalSentence || "",
            correctAnswer: sr.correct_answer || sr.correctAnswer || "",
          }));
        } else if (q.original_sentence || q.originalSentence || (q.content && q.content.original_sentence)) {
          const orig = q.original_sentence || q.originalSentence || (q.content && q.content.original_sentence) || "";
          const oldCue = q.starting_cue || q.startingCue || (q.content && q.content.starting_cue) || "";
          let ans = q.correct_answer || q.correctAnswer || (q.content && q.content.correct_answer) || "";
          if (oldCue && !ans.includes("[")) {
            ans = `[${oldCue.replace(/\.+$/, "").trim()}] ${ans.replace(new RegExp(`^${oldCue.replace(/\.+$/, "").trim()}\\s*`, "i"), "")}`;
          }
          formattedSub = [
            {
              id: `sr_${Date.now()}`,
              originalSentence: orig,
              correctAnswer: ans,
            },
          ];
        }

        setRewriteSubQuestions(formattedSub);
      }
    } else if (q.skill === "Speaking") {
      setSpeakingCategory(q.category);
      if (q.category === "SPEAKING_TOPIC_PROMPT") setSpeakingCuePrompt(q.prompt || "");
      if (q.category === "SPEAKING_READ_ALOUD") setReadAloudPassage(q.passage || "");
    }
  };

  const handleSave = async () => {
    if (!testTitle.trim()) {
      alert("Vui lòng nhập tiêu đề!");
      return;
    }
    setIsSubmitting(true);

    try {
      let currentQuestionsList = [...questionsList];
      if (editingQuestionId) {
        const cleanText = cleanHtmlText(stimulusText);

        let finalStimulusText: string | null = null;
        let finalStimulusAudioUrl: string | null = null;
        let finalStimulusAudioText: string | null = null;

        if (stimulusType === "TEXT_ONLY") {
          finalStimulusText = cleanText || null;
          finalStimulusAudioUrl = null;
          finalStimulusAudioText = null;
        } else if (stimulusType === "AUDIO_ONLY") {
          finalStimulusText = null;
          if (stimulusAudioSource === "TTS") {
            finalStimulusAudioText = stimulusAudioText.trim() || null;
            finalStimulusAudioUrl = stimulusAudioText.trim() ? getTtsHdUrl(stimulusAudioText.trim(), stimulusAudioGender) : null;
          } else {
            finalStimulusAudioText = null;
            finalStimulusAudioUrl = stimulusAudioUrl.trim() || null;
          }
        } else if (stimulusType === "COMBINED") {
          finalStimulusText = cleanText || null;
          if (stimulusAudioSource === "TTS") {
            finalStimulusAudioText = stimulusAudioText.trim() || null;
            finalStimulusAudioUrl = stimulusAudioText.trim() ? getTtsHdUrl(stimulusAudioText.trim(), stimulusAudioGender) : null;
          } else {
            finalStimulusAudioText = null;
            finalStimulusAudioUrl = stimulusAudioUrl.trim() || null;
          }
        }

        const formattedSubQuestions = mcSubQuestions.map((sq) => {
          let correctVal = sq.optA;
          if (sq.correctAnswer === "B") correctVal = sq.optB;
          if (sq.correctAnswer === "C") correctVal = sq.optC;
          if (sq.correctAnswer === "D") correctVal = sq.optD;
          return {
            id: sq.id,
            text: sq.subQuestionText,
            option_a: sq.optA,
            option_b: sq.optB,
            option_c: sq.optC,
            option_d: sq.optD,
            correct_answer: correctVal,
            audio_url: sq.audioUrl || null,
          };
        });

        const activeQ = currentQuestionsList.find((q) => q.id === editingQuestionId);
        if (activeQ) {
          const updatedActiveQ = {
            ...activeQ,
            stimulusType,
            stimulus_type: stimulusType,
            stimulusText: finalStimulusText || "",
            stimulus_text: finalStimulusText,
            prompt: questionPrompt.trim() || activeQ.prompt || activeQ.questionTitle || "",
            stimulusAudioText: finalStimulusAudioText || "",
            stimulusAudioUrl: finalStimulusAudioUrl,
            stimulus_audio_url: finalStimulusAudioUrl,
            sub_questions: formattedSubQuestions,
            subQuestions: mcSubQuestions,
          };
          currentQuestionsList = currentQuestionsList.map((q) => (q.id === editingQuestionId ? updatedActiveQ : q));
        }
      }

      const savedIdByLocalId = new Map<string, string>();
      const qIdsArray: string[] = [];
      for (let i = 0; i < currentQuestionsList.length; i++) {
        const q = currentQuestionsList[i];

        const rawFcList: FlashcardItem[] = q.flashcardsList || q.flashcards || [];
        const flashcardIds: string[] = [];
        if (rawFcList.length > 0) {
          for (const fc of rawFcList) {
            const fcId = fc.id;
            const payload = {
              vietnamese_name: (fc as any).vietnameseName || (fc as any).vietnamese_name || "Nghĩa TV",
              correct_english_word: (fc as any).correctEnglishWord || (fc as any).correct_english_word || "English Word",
              options: (fc as any).englishOptions || (fc as any).options || [],
              image_url: (fc as any).imageUrl || (fc as any).image_url || null,
              audio_url: (fc as any).audioUrl || (fc as any).audio_url || null,
            };

            let savedFcId = fcId;
            if (fcId && !fcId.startsWith("temp_") && !fcId.startsWith("fc_tmp")) {
              const res = await fetch(`/api/teacher/flashcards/${fcId}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
              });
              if (res.ok) {
                savedFcId = fcId;
              } else if (res.status === 404) {
                const postRes = await fetch("/api/teacher/flashcards", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify(payload),
                });
                const postData = await postRes.json().catch(() => null);
                if (postData?.flashcard?.id) savedFcId = postData.flashcard.id;
              }
            } else {
              const postRes = await fetch("/api/teacher/flashcards", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
              });
              const postData = await postRes.json().catch(() => null);
              if (postData?.flashcard?.id) savedFcId = postData.flashcard.id;
            }

            if (savedFcId) {
              flashcardIds.push(savedFcId);
            }
          }
        }

        const finalFcIds = flashcardIds.length > 0 ? flashcardIds : (q.flashcard_ids || []);

        const sType = q.stimulusType || q.stimulus_type || "TEXT_ONLY";
        const cText = cleanHtmlText(q.stimulusText || q.stimulus_text);
        const cAudio = q.stimulusAudioUrl || q.stimulus_audio_url;

        let dbStimulusText: string | null = null;
        let dbStimulusAudioUrl: string | null = null;

        if (sType === "TEXT_ONLY") {
          dbStimulusText = cText || null;
          dbStimulusAudioUrl = null;
        } else if (sType === "AUDIO_ONLY") {
          dbStimulusText = null;
          dbStimulusAudioUrl = cAudio || null;
        } else if (sType === "COMBINED") {
          dbStimulusText = cText || null;
          dbStimulusAudioUrl = cAudio || null;
        }

        const qWithStimulus = {
          ...q,
          stimulusType: sType,
          stimulus_type: sType,
          stimulusText: dbStimulusText || "",
          stimulus_text: dbStimulusText,
          stimulusAudioUrl: dbStimulusAudioUrl,
          stimulus_audio_url: dbStimulusAudioUrl,
          flashcard_ids: finalFcIds,
        };
        const standardizedContent = buildStandardQuestionContent(qWithStimulus);

        const questionPayload = {
          skill: q.skill,
          category: q.category,
          prompt: q.prompt || q.customPrompt || q.questionTitle || "",
          stimulus_text: dbStimulusText,
          stimulus_audio_url: dbStimulusAudioUrl,
          content: standardizedContent,
        };

        const isExisting = dbQuestionIds.current.has(q.id);
        let savedId: string;

        if (isExisting) {
          const res = await fetch(`/api/teacher/questions/${q.id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(questionPayload),
          });
          const resData = await res.json().catch(() => null);
          if (!res.ok || !resData?.success) {
            alert(`Lỗi cập nhật câu hỏi: ${resData?.error || res.statusText}`);
            setIsSubmitting(false);
            return;
          }
          savedId = q.id;
        } else {
          const res = await fetch("/api/teacher/questions", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(questionPayload),
          });
          const resData = await res.json().catch(() => null);
          if (!res.ok || !resData?.success || !resData?.question?.id) {
            alert(`Lỗi tạo mới câu hỏi: ${resData?.error || res.statusText}`);
            setIsSubmitting(false);
            return;
          }
          savedId = resData.question.id;
          savedIdByLocalId.set(q.id, savedId);
          dbQuestionIds.current.add(savedId);
        }

        qIdsArray.push(savedId);
      }

      if (savedIdByLocalId.size > 0) {
        setQuestionsList((prev) =>
          prev.map((item) =>
            savedIdByLocalId.has(item.id)
              ? { ...item, id: savedIdByLocalId.get(item.id)! }
              : item
          )
        );
      }

      const savePayload: QuestionSetSavePayload = {
        title: testTitle.trim(),
        description: testDescription.trim(),
        duration_minutes: Number(duration) || 60,
        course_id: isExamMode ? (selectedCourseId || null) : null,
        scoring_standard_id: isExamMode ? (selectedStandardId || null) : null,
        question_ids: qIdsArray,
      };

      const result = await onSave(savePayload);
      if (!result.ok) {
        alert(result.error || "Lỗi lưu bộ dữ liệu.");
        setIsSubmitting(false);
        return;
      }

      setShowSavedMsg(true);
      setTimeout(() => setShowSavedMsg(false), 4000);
    } catch (err: any) {
      console.error("Save error:", err);
      alert("Đã xảy ra lỗi khi lưu: " + (err.message || err));
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-xs font-bold text-brand-600 space-y-2">
        <Loader2 className="w-6 h-6 animate-spin text-brand-600" />
        <span>Đang nạp dữ liệu chỉnh sửa...</span>
      </div>
    );
  }

  const editingIndex = questionsList.findIndex((q) => q.id === editingQuestionId);
  const editingQuestionNumber = editingIndex !== -1 ? editingIndex + 1 : null;

  const currentCourse = coursesList.find((c) => c.id === selectedCourseId);
  const currentCourseDefaultStd = currentCourse?.default_scoring_standard_id
    ? scoringStandards.find((s) => s.id === currentCourse.default_scoring_standard_id)
    : null;

  return (
    <div className="max-w-[1280px] mx-auto space-y-8 font-sans text-ink">
      {audioPreviewSrc ? (
        <audio controls src={audioPreviewSrc} className="hidden" autoPlay onError={(e) => console.warn(e)} />
      ) : null}

      {/* Creation Mode Tabs (Only for EXAM mode) */}
      {isExamMode && (
        <div className="flex items-center gap-3 border-b border-line pb-3">
          <button
            type="button"
            onClick={() => setCreationMode("manual")}
            className={`px-4 py-2.5 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
              creationMode === "manual"
                ? "bg-brand-600 text-white shadow-xs"
                : "bg-white text-ink-muted hover:bg-brand-50 border border-line"
            }`}
          >
            <BookOpen className="w-4 h-4" />
            <span>Soạn Đề Thủ Công (Manual Editor)</span>
          </button>

          <button
            type="button"
            onClick={() => setCreationMode("ai-ingest")}
            className={`px-4 py-2.5 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
              creationMode === "ai-ingest"
                ? "bg-brand-600 text-white shadow-xs"
                : "bg-white text-ink-muted hover:bg-brand-50 border border-line"
            }`}
          >
            <Sparkles className="w-4 h-4 text-accent-400" />
            <span>Upload đề thi / bài tập</span>
            <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-emerald-100 text-emerald-800 font-bold uppercase">
              Mới
            </span>
          </button>
        </div>
      )}

      {isExamMode && creationMode === "ai-ingest" ? (
        <AiExamIngestionStudio
          initialDestinationType={aiIngestProps?.initialDestinationType || "standalone"}
          initialCourseId={aiIngestProps?.initialCourseId}
          initialUnitId={aiIngestProps?.initialUnitId}
        />
      ) : (
        <>
          {/* Header */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-line/40 pb-6">
            <div>
              <h1 className="font-headline text-3xl font-bold text-brand-600 tracking-tight">
                {isExamMode
                  ? (initialQuestions && initialQuestions.length > 0 ? "Chỉnh Sửa Bộ Đề Thi" : "Soạn Bộ Đề Thi Mới")
                  : (initialQuestions && initialQuestions.length > 0 ? "Chỉnh Sửa Bài Học" : "Soạn Bài Học Mới")}
              </h1>
              <p className="text-sm text-ink-muted mt-1">
                {isExamMode
                  ? "Chỉnh sửa thông tin bộ đề, bài đọc/ngữ cảnh HTML phong phú, thêm/bớt và sửa trực tiếp từng câu hỏi trong đề."
                  : "Chỉnh sửa nội dung bài học, bài đọc/ngữ cảnh HTML phong phú, thêm/bớt và sửa trực tiếp từng câu hỏi trong bài."}
              </p>
            </div>

            <button
              onClick={handleSave}
              disabled={Boolean(isSubmitting || !testTitle.trim())}
              className="px-5 py-2.5 bg-brand-600 hover:bg-brand-700 text-white text-xs font-bold rounded-xl shadow transition-all flex items-center space-x-2 font-headline disabled:opacity-50 shrink-0 cursor-pointer"
            >
              {isSubmitting ? (
                <Loader2 className="w-4 h-4 animate-spin text-white" />
              ) : (
                <Save className="w-4 h-4 text-white" />
              )}
              <span>
                {saveLabel ||
                  (isExamMode
                    ? (initialQuestions && initialQuestions.length > 0 ? "Cập Nhật Bộ Đề Thi" : "Lưu Bộ Đề Thi Mới")
                    : (initialQuestions && initialQuestions.length > 0 ? "Cập Nhật Bài Học" : "Lưu Bài Học Mới"))}
              </span>
            </button>
          </div>

          {showSavedMsg && (
            <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 flex items-center space-x-2">
              <span className="text-xs font-bold">Đã lưu dữ liệu thành công!</span>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            {/* Main Question Authoring Form Pane */}
            <div className="lg:col-span-8 space-y-6">
              {/* Metadata */}
              <div className="bg-white p-6 rounded-3xl border border-line shadow-sm space-y-4">
                <h2 className="text-base font-bold text-brand-600">
                  {isExamMode ? "Thông Tin Tổng Quan Đề Thi" : "Thông Tin Tổng Quan Bài Học"}
                </h2>
                <div className={`grid grid-cols-1 ${isExamMode ? "md:grid-cols-4" : "md:grid-cols-1"} gap-4`}>
                  <div className={isExamMode ? "md:col-span-2" : ""}>
                    <label className="block text-xs font-bold uppercase text-ink mb-1">
                      {isExamMode ? "Tên Đề Thi / Bài Tập (*)" : "Tên Bài Học (*)"}
                    </label>
                    <input
                      type="text"
                      required
                      placeholder={isExamMode ? "Ví dụ: IELTS Vocabulary & Grammar Mastery #05" : "Ví dụ: Bài 01 - Từ vựng chủ đề Môi trường"}
                      value={testTitle}
                      onChange={(e) => setTestTitle(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-surface-alt border border-line rounded-xl text-sm focus:outline-none focus:border-brand-600"
                    />
                  </div>
                  {isExamMode && (
                    <>
                      <div>
                        <label className="block text-xs font-bold uppercase text-ink mb-1">
                          Khóa Học / Category (*)
                        </label>
                        <select
                          value={selectedCourseId}
                          onChange={(e) => setSelectedCourseId(e.target.value)}
                          className="w-full px-3.5 py-2.5 bg-surface-alt border border-line rounded-xl text-sm focus:outline-none focus:border-brand-600 font-medium text-brand-600"
                        >
                          {coursesList.map((course) => (
                            <option key={course.id} value={course.id}>
                              {course.title}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-bold uppercase text-ink mb-1">
                          Thời Gian (Phút)
                        </label>
                        <input
                          type="number"
                          value={duration}
                          onChange={(e) => setDuration(e.target.value)}
                          className="w-full px-3.5 py-2.5 bg-surface-alt border border-line rounded-xl text-sm focus:outline-none focus:border-brand-600"
                        />
                      </div>
                    </>
                  )}
                </div>

                {isExamMode && (
                  <div>
                    <label className="block text-xs font-bold uppercase text-ink mb-1">
                      Chuẩn chấm điểm
                    </label>
                    <select
                      value={selectedStandardId || ""}
                      onChange={(e) => setSelectedStandardId(e.target.value ? e.target.value : null)}
                      className="w-full px-3.5 py-2.5 bg-surface-alt border border-line rounded-xl text-sm focus:outline-none focus:border-brand-600 font-medium text-brand-600"
                    >
                      <option value="">— Theo khóa học / mặc định —</option>
                      {scoringStandards.map((std) => (
                        <option key={std.id} value={std.id}>
                          {std.name} {std.framework ? `(${std.framework})` : ""}
                        </option>
                      ))}
                    </select>
                    {!selectedStandardId && currentCourseDefaultStd && (
                      <p className="text-[11px] text-ink-subtle mt-1">
                        Gợi ý chuẩn mặc định của khóa: <strong className="text-brand-600">{currentCourseDefaultStd.name} {currentCourseDefaultStd.framework ? `(${currentCourseDefaultStd.framework})` : ""}</strong>
                      </p>
                    )}
                  </div>
                )}

                <div>
                  <label className="block text-xs font-bold uppercase text-ink mb-1">
                    {isExamMode ? "Mô Tả / Hướng Dẫn Tổng Quan Bài Thi" : "Mô Tả / Hướng Dẫn Tổng Quan Bài Học"}
                  </label>
                  <textarea
                    rows={2}
                    placeholder="Nhập mô tả hoặc hướng dẫn tổng quan..."
                    value={testDescription}
                    onChange={(e) => setTestDescription(e.target.value)}
                    className="w-full p-3.5 bg-surface-alt border border-line rounded-xl text-xs focus:outline-none focus:border-brand-600"
                  />
                </div>
              </div>

              {/* Question Authoring Widget */}
              <div className={`bg-white p-6 rounded-3xl border transition-all space-y-5 ${editingQuestionNumber ? "border-brand-600 ring-2 ring-brand-300/40 shadow-md" : "border-line shadow-sm"}`}>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-line/40 pb-4">
                  <div className="flex items-center space-x-2">
                    <h2 className="text-base font-bold text-brand-600 flex items-center space-x-2">
                      <Layers className="w-5 h-5 text-brand-600" />
                      <span>{editingQuestionNumber ? `✏️ Đang Chỉnh Sửa Câu Hỏi Số ${editingQuestionNumber}` : "Biên Soạn Câu Hỏi Mới"}</span>
                    </h2>
                  </div>

                  <div className="flex bg-surface-alt p-1 rounded-xl border border-line">
                    {(["Reading", "Listening", "Writing", "Speaking"] as const).map((sk) => (
                      <button
                        key={sk}
                        type="button"
                        onClick={() => handleSwitchSkill(sk)}
                        className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center space-x-1 ${
                          skillType === sk ? "bg-brand-600 text-white shadow-sm" : "text-ink-muted hover:text-brand-600"
                        }`}
                      >
                        <span>{sk}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Parent Stimulus Header Builder */}
                <div className="p-4 rounded-2xl bg-brand-50/60 border border-brand-300 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-brand-600 uppercase flex items-center space-x-1.5">
                      <Sparkles className="w-4 h-4 text-brand-600" />
                      <span>Phần Ngữ Cảnh Bài Tập</span>
                    </span>
                    <select
                      value={stimulusType}
                      onChange={(e: any) => setStimulusType(e.target.value)}
                      className="px-2.5 py-1 bg-white border border-line rounded-lg text-xs font-bold text-brand-600"
                    >
                      <option value="TEXT_ONLY">Văn bản (Text Only)</option>
                      <option value="AUDIO_ONLY">Âm thanh (Audio Only)</option>
                      <option value="COMBINED">Kết hợp (Text + Audio)</option>
                    </select>
                  </div>

                  {/* Question Prompt */}
                  <div>
                    <label className="block text-[12px] font-bold text-brand-600 mb-1">
                      Chỉ Dẫn / Hướng Dẫn Bài Tập
                    </label>
                    <input
                      type="text"
                      placeholder="Ví dụ: Đọc đoạn văn sau và hoàn thành các câu hỏi trắc nghiệm..."
                      value={questionPrompt}
                      onChange={(e) => setQuestionPrompt(e.target.value)}
                      className="w-full px-3.5 py-2 bg-white border border-line rounded-xl text-xs font-bold text-brand-600 focus:outline-none focus:border-brand-600 shadow-2xs"
                    />
                  </div>

                  {(stimulusType === "TEXT_ONLY" || stimulusType === "COMBINED") && (
                    <div className="space-y-2 pt-1 border-t border-brand-300/40">
                      <label className="block text-[12px] font-bold text-brand-600">
                        Nội Dung Ngữ Cảnh
                      </label>
                      <RichTextEditor
                        value={stimulusText}
                        onChange={setStimulusText}
                        placeholder="Nhập nội dung đề bài tập ở đây..."
                      />
                    </div>
                  )}

                  {(stimulusType === "AUDIO_ONLY" || stimulusType === "COMBINED") && (
                    <div className="space-y-2 pt-1 border-t border-brand-300/40 text-xs">
                      <div className="flex items-center justify-between font-bold text-brand-600">
                        <span>Âm Thanh Ngữ Cảnh</span>
                        <div className="flex space-x-2">
                          <label className="flex items-center space-x-1 cursor-pointer">
                            <input
                              type="radio"
                              checked={stimulusAudioSource === "UPLOAD"}
                              onChange={() => setStimulusAudioSource("UPLOAD")}
                              className="accent-brand-600"
                            />
                            <span>Upload File / Link URL</span>
                          </label>
                          <label className="flex items-center space-x-1 cursor-pointer">
                            <input
                              type="radio"
                              checked={stimulusAudioSource === "TTS"}
                              onChange={() => setStimulusAudioSource("TTS")}
                              className="accent-brand-600"
                            />
                            <span>Giọng đọc AI</span>
                          </label>
                        </div>
                      </div>

                      {stimulusAudioSource === "UPLOAD" ? (
                        <div className="space-y-2">
                          <input
                            type="text"
                            placeholder="Dán link URL âm thanh (.mp3, .wav) hoặc link Video YouTube..."
                            value={stimulusAudioUrl}
                            onChange={(e) => setStimulusAudioUrl(e.target.value)}
                            className="w-full px-3.5 py-2 bg-white border border-line rounded-xl text-xs font-mono text-brand-600 focus:outline-none focus:border-brand-600 shadow-2xs"
                          />
                          <div className="flex items-center space-x-2">
                            <span className="text-[11px] text-ink-subtle">Hoặc upload file trực tiếp:</span>
                            <input
                              type="file"
                              accept="audio/*"
                              onChange={(e) => handleFileUpload(e, setStimulusAudioUrl)}
                              className="text-xs text-ink-muted"
                            />
                          </div>

                          {(() => {
                            const info = getMediaStimulusInfo(stimulusAudioUrl);
                            if (info.type === "YOUTUBE" && info.embedUrl) {
                              return (
                                <div className="p-3 bg-emerald-50 border border-emerald-300 rounded-xl space-y-2 shadow-2xs">
                                  <span className="text-[11px] font-bold text-emerald-800 block">Đã nhận diện Link YouTube Video:</span>
                                  <div className="aspect-video w-full max-w-sm rounded-lg overflow-hidden border border-emerald-200">
                                    <iframe src={info.embedUrl} title="YouTube Preview" className="w-full h-full" allowFullScreen />
                                  </div>
                                </div>
                              );
                            }
                            if (info.type === "AUDIO" && info.rawUrl) {
                              return (
                                <div className="p-2.5 bg-white border border-line rounded-xl flex items-center justify-between shadow-2xs">
                                  <span className="text-[11px] font-bold text-brand-600">🎵 Preview File Âm Thanh</span>
                                  <audio controls src={info.rawUrl} className="h-7 max-w-xs" />
                                </div>
                              );
                            }
                            return null;
                          })()}
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <div className="flex items-center space-x-2">
                            <span className="text-[11px] font-bold text-ink-muted">Chọn giọng đọc AI:</span>
                            <select
                              value={stimulusAudioGender}
                              onChange={(e: any) => setStimulusAudioGender(e.target.value)}
                              className="px-2 py-1 bg-white border border-line rounded-lg text-xs text-brand-600 font-bold"
                            >
                              <option value="Female">♀ Giọng Nữ</option>
                              <option value="Male">♂ Giọng Nam</option>
                            </select>
                          </div>

                          <textarea
                            rows={2}
                            placeholder="Nhập nội dung để AI đọc..."
                            value={stimulusAudioText}
                            onChange={(e) => handleStimulusAudioTextChange(e.target.value)}
                            className="w-full p-2.5 bg-white border border-line rounded-xl text-xs focus:outline-none"
                          />

                          {stimulusAudioText.trim() && (
                            <div className="p-2.5 bg-white border border-line rounded-xl flex items-center justify-between shadow-2xs">
                              <span className="text-[11px] font-bold text-brand-600 flex items-center gap-1">
                                <Volume2 className="w-3.5 h-3.5" />
                                <span>Preview Âm Thanh AI ({stimulusAudioGender === "Female" ? "Giọng Nữ" : "Giọng Nam"}):</span>
                              </span>
                              <audio
                                controls
                                key={`${stimulusAudioText.trim()}_${stimulusAudioGender}`}
                                src={getTtsHdUrl(stimulusAudioText.trim(), stimulusAudioGender)}
                                className="h-7 max-w-xs"
                              />
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Sub-Category Forms per Skill */}
                <div className="space-y-4">
                  {/* READING */}
                  {skillType === "Reading" && (
                    <div className="space-y-4 font-sans">
                      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                        {[
                          { id: "READING_MC", label: "Trắc Nghiệm" },
                          { id: "READING_FILL_IN", label: "Điền Ô Trống" },
                          { id: "READING_ORDERING", label: "Sắp Xếp" },
                          { id: "READING_MATCHING", label: "Nối Cặp Từ" },
                          { id: "READING_FLASHCARD_SET", label: "Flashcards Set" },
                        ].map((c) => (
                          <button
                            key={c.id}
                            type="button"
                            onClick={() => { setReadingCategory(c.id as ReadingQType); resetCategoryStates(); }}
                            className={`p-2.5 rounded-xl border text-xs font-bold transition-all ${
                              readingCategory === c.id
                                ? "bg-brand-50 border-brand-300 text-brand-600"
                                : "bg-surface-alt border-line text-ink-muted"
                            }`}
                          >
                            {c.label}
                          </button>
                        ))}
                      </div>

                      {readingCategory === "READING_MC" && (
                        <div className="space-y-3 p-4 rounded-2xl bg-surface-alt border border-line">
                          <span className="text-xs font-bold text-brand-600 block">Câu Hỏi Trắc Nghiệm Con ({mcSubQuestions.length})</span>
                          <div className="space-y-2">
                            {mcSubQuestions.map((sub, idx) => (
                              <div key={sub.id} className="p-3 bg-white rounded-xl border border-line text-xs flex justify-between items-center">
                                <div>
                                  <span className="font-bold text-brand-600">Câu {idx + 1}: {sub.subQuestionText}</span>
                                  <div className="text-[11px] text-ink-muted mt-0.5">Đáp án đúng: <strong>{sub.correctAnswer}</strong></div>
                                </div>
                                <div className="flex space-x-2">
                                  <button type="button" onClick={() => handleEditMcSubQ(sub)} className="p-1 text-brand-600 hover:bg-brand-50 rounded"><Edit2 className="w-4 h-4" /></button>
                                  <button type="button" onClick={() => handleDeleteMcSubQ(sub.id)} className="p-1 text-rose-600 hover:bg-rose-50 rounded"><Trash2 className="w-4 h-4" /></button>
                                </div>
                              </div>
                            ))}
                          </div>

                          <div className="pt-2 border-t border-line space-y-2">
                            <input type="text" placeholder="Nội dung câu hỏi con..." value={subQText} onChange={(e) => setSubQText(e.target.value)} className="w-full px-3 py-2 bg-white border border-line rounded-xl text-xs" />
                            <div className="grid grid-cols-2 gap-2">
                              <input type="text" placeholder="A" value={subQOptA} onChange={(e) => setSubQOptA(e.target.value)} className="px-3 py-1.5 bg-white border border-line rounded-lg text-xs" />
                              <input type="text" placeholder="B" value={subQOptB} onChange={(e) => setSubQOptB(e.target.value)} className="px-3 py-1.5 bg-white border border-line rounded-lg text-xs" />
                              <input type="text" placeholder="C" value={subQOptC} onChange={(e) => setSubQOptC(e.target.value)} className="px-3 py-1.5 bg-white border border-line rounded-lg text-xs" />
                              <input type="text" placeholder="D" value={subQOptD} onChange={(e) => setSubQOptD(e.target.value)} className="px-3 py-1.5 bg-white border border-line rounded-lg text-xs" />
                            </div>
                            <div>
                              <label className="block text-[11px] font-bold text-ink mb-1">Đáp Án Đúng:</label>
                              <select value={subQCorrect} onChange={(e: any) => setSubQCorrect(e.target.value)} className="px-3 py-1.5 bg-white border border-line rounded-lg text-xs font-bold text-emerald-800">
                                <option value="A">Lựa chọn A</option>
                                <option value="B">Lựa chọn B</option>
                                <option value="C">Lựa chọn C</option>
                                <option value="D">Lựa chọn D</option>
                              </select>
                            </div>
                            <button type="button" onClick={handleAddOrUpdateMcSubQ} className="w-full py-2.5 bg-brand-600 text-white rounded-xl text-xs font-bold flex items-center justify-center space-x-1.5">
                              <Plus className="w-4 h-4 text-white" />
                              <span>{editingSubQId ? "Cập Nhật Câu Hỏi Con" : "Thêm Câu Hỏi Con"}</span>
                            </button>
                          </div>
                        </div>
                      )}

                      {readingCategory === "READING_FILL_IN" && (
                        <div className="space-y-4">
                          <div className="flex space-x-4 p-2 bg-surface-alt rounded-xl border border-line text-xs font-bold">
                            <label className="flex items-center space-x-1.5 cursor-pointer">
                              <input type="radio" checked={fillInSubtype === "OPTION_BANK"} onChange={() => setFillInSubtype("OPTION_BANK")} className="accent-brand-600" />
                              <span>Ngân hàng từ chung (Option Bank)</span>
                            </label>
                            <label className="flex items-center space-x-1.5 cursor-pointer">
                              <input type="radio" checked={fillInSubtype === "INLINE_SELECT"} onChange={() => setFillInSubtype("INLINE_SELECT")} className="accent-brand-600" />
                              <span>Dropdown riêng từng ô (Inline Select)</span>
                            </label>
                          </div>

                          <div>
                            <label className="block text-xs font-bold uppercase text-brand-600 mb-1">
                              Soạn Đoạn Văn Chứa Đáp Án Trong Ngoặc Vuông <code>[đáp_án_đúng]</code>
                            </label>
                            <textarea
                              rows={3}
                              value={parenthesesRawText}
                              onChange={(e) => setParenthesesRawText(e.target.value)}
                              placeholder="Ví dụ: Artificial Intelligence is [slowly] transforming... Students learn [flexibly]."
                              className="w-full p-3.5 bg-surface-alt border border-line rounded-xl text-xs font-bold text-brand-600"
                            />
                          </div>

                          {fillInSubtype === "OPTION_BANK" ? (
                            <div>
                              <label className="block text-xs font-bold uppercase text-ink mb-1">
                                Ngân Hàng Từ Dùng Chung (Phân cách bằng dấu phẩy)
                              </label>
                              <input
                                type="text"
                                value={optionBankWords.join(", ")}
                                onChange={(e) => setOptionBankWords(e.target.value.split(",").map((s) => s.trim()).filter(Boolean))}
                                className="w-full px-3 py-2 bg-surface-alt border border-line rounded-xl text-xs font-medium"
                              />
                            </div>
                          ) : (
                            <div className="p-3.5 rounded-2xl bg-surface-alt border border-line space-y-3">
                              <div className="flex justify-between items-center border-b border-line/40 pb-2">
                                <span className="text-xs font-bold text-brand-600">
                                  Cấu Hình Bộ Từ Nhiễu Riêng Cho Từng Vị Trí Dropdown ({parseFillInGaps(parenthesesRawText).gaps.length} chỗ trống)
                                </span>
                              </div>

                              {parseFillInGaps(parenthesesRawText).gaps.length === 0 ? (
                                <p className="text-xs text-amber-800 bg-amber-50 p-2.5 rounded-xl border border-amber-200">
                                  ⚠️ Hãy nhập ít nhất 1 đáp án trong ngoặc vuông <code>[đáp_án_đúng]</code> ở đoạn văn trên để cấu hình bộ từ nhiễu.
                                </p>
                              ) : (
                                <div className="space-y-2.5">
                                  {parseFillInGaps(parenthesesRawText).gaps.map((correctVal: string, idx: number) => (
                                    <div key={idx} className="p-3 bg-white rounded-xl border border-line space-y-2 text-xs">
                                      <div className="flex items-center justify-between">
                                        <span className="font-bold text-brand-600">
                                          📍 Vị trí chỗ trống #{idx + 1}
                                        </span>
                                        <span className="px-2.5 py-0.5 bg-emerald-100 text-emerald-900 border border-emerald-300 rounded-lg font-bold text-[11px]">
                                          Đáp án đúng: "{correctVal}"
                                        </span>
                                      </div>
                                      <div className="flex items-center space-x-2">
                                        <span className="px-3 py-2 bg-brand-50 text-brand-600 font-bold text-xs border border-brand-300 rounded-xl shrink-0 select-none">
                                          ✓ {correctVal}
                                        </span>
                                        <input
                                          type="text"
                                          placeholder="Nhập các từ gây nhiễu bổ sung (Phân cách bằng dấu phẩy)..."
                                          value={gapDistractorInputs[idx] || ""}
                                          onChange={(e) => setGapDistractorInputs({ ...gapDistractorInputs, [idx]: e.target.value })}
                                          className="w-full px-3 py-2 bg-white border border-line rounded-xl text-xs focus:outline-none focus:border-brand-600"
                                        />
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      )}

                      {readingCategory === "READING_ORDERING" && (
                        <div className="space-y-3">
                          <select value={orderingType} onChange={(e: any) => setOrderingType(e.target.value)} className="w-full px-3 py-2 bg-brand-50 border border-brand-300 rounded-xl text-xs font-bold text-brand-600">
                            <option value="SENTENCE_ORDERING">Sắp xếp CÂU (Tách theo dấu chấm .)</option>
                            <option value="WORD_ORDERING">Sắp xếp TỪ (Tách theo khoảng trắng Space)</option>
                          </select>
                          <textarea rows={3} value={orderingRawText} onChange={(e) => setOrderingRawText(e.target.value)} className="w-full p-3 bg-surface-alt border border-line rounded-xl text-xs" />
                          <div className="p-3.5 rounded-2xl bg-brand-50/60 border border-brand-300/60 space-y-1.5">
                            <span className="text-[11px] font-bold text-brand-600 uppercase block">Kết Quả Tách Câu/Từ Preview:</span>
                            <div className="flex flex-wrap gap-1.5">
                              {orderingItems.map((item, i) => (
                                <span key={i} className="px-2.5 py-1 bg-white border border-line rounded-lg text-xs text-ink font-medium shadow-sm">
                                  #{i + 1}: {item}
                                </span>
                              ))}
                            </div>
                          </div>
                        </div>
                      )}

                      {readingCategory === "READING_MATCHING" && (
                        <div className="space-y-3 p-4 rounded-2xl bg-surface-alt border border-line">
                          <span className="text-xs font-bold text-brand-600 block">Cặp Từ Đã Nhập ({matchingPairs.length})</span>
                          <div className="space-y-2">
                            {matchingPairs.map((pair) => (
                              <div key={pair.id} className="flex items-center justify-between p-2.5 rounded-xl border border-brand-300 bg-white text-xs">
                                <span className="font-bold text-ink">{pair.left} ↔ {pair.right}</span>
                                <div className="flex space-x-2">
                                  <button type="button" onClick={() => handleEditMatchingPair(pair)} className="text-brand-600"><Edit2 className="w-3.5 h-3.5" /></button>
                                  <button type="button" onClick={() => handleDeleteMatchingPair(pair.id)} className="text-rose-600"><Trash2 className="w-3.5 h-3.5" /></button>
                                </div>
                              </div>
                            ))}
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <input type="text" placeholder="Cột A" value={matchLeft} onChange={(e) => setMatchLeft(e.target.value)} className="px-3 py-1.5 bg-white border border-line rounded-lg text-xs" />
                            <input type="text" placeholder="Cột B" value={matchRight} onChange={(e) => setMatchRight(e.target.value)} className="px-3 py-1.5 bg-white border border-line rounded-lg text-xs" />
                          </div>
                          <button type="button" onClick={handleAddOrUpdateMatchingPair} className="w-full py-2 bg-brand-600 text-white rounded-xl text-xs font-bold">
                            {editingPairId ? "Cập Nhật Cặp Nối" : "Thêm Cặp Nối"}
                          </button>
                        </div>
                      )}

                      {readingCategory === "READING_FLASHCARD_SET" && (
                        <div className="space-y-3 p-4 rounded-2xl bg-surface-alt border border-line">
                          <span className="text-xs font-bold text-brand-600 block">Tập Hợp Flashcards ({flashcardsList.length})</span>
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                            {flashcardsList.map((fc) => (
                              <div key={fc.id} className="p-3 bg-white rounded-2xl border border-line text-xs flex flex-col space-y-2 relative">
                                {fc.imageUrl && (
                                  <div className="w-full h-28 rounded-xl overflow-hidden border border-line/60 relative">
                                    <img src={fc.imageUrl} alt={fc.vietnameseName} className="w-full h-full object-cover" />
                                  </div>
                                )}
                                <div className="flex-1 space-y-1">
                                  <span className="font-bold text-ink block">{fc.vietnameseName}</span>
                                  <span className="text-[10px] text-emerald-800 font-bold block">Từ TA đúng: {fc.correctEnglishWord}</span>
                                </div>
                                <div className="flex justify-end space-x-1.5 pt-1.5 border-t border-line/40">
                                  <button type="button" onClick={() => handleEditFlashcard(fc)} className="p-1.5 rounded-lg bg-gray-50 border border-line text-brand-600 hover:bg-brand-50"><Edit2 className="w-3.5 h-3.5" /></button>
                                  <button type="button" onClick={() => handleDeleteFlashcard(fc.id)} className="p-1.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-600 hover:bg-rose-100"><Trash2 className="w-3.5 h-3.5" /></button>
                                </div>
                              </div>
                            ))}
                          </div>

                          <div className="p-3 bg-white rounded-xl border border-line space-y-2">
                            <span className="font-bold text-brand-600 block text-[11px]">🔍 Tìm Kiếm Flashcard Đã Có Trong Database:</span>
                            <input
                              type="text"
                              placeholder="Gõ từ tiếng Anh hoặc tiếng Việt để tìm..."
                              value={fcSearchQuery}
                              onChange={(e) => handleSearchFlashcards(e.target.value)}
                              className="w-full px-3 py-1.5 bg-surface-alt border border-line rounded-lg text-xs font-medium focus:outline-none focus:border-brand-600"
                            />
                            {isSearchingFc && <p className="text-[10px] text-ink-subtle">Đang tìm kiếm...</p>}
                            {fcSearchResults.length > 0 && (
                              <div className="flex flex-wrap gap-1.5 pt-1">
                                {fcSearchResults.map((fc) => (
                                  <button
                                    key={fc.id}
                                    type="button"
                                    onClick={() => handleSelectExistingFc(fc)}
                                    className="px-2.5 py-1 bg-brand-50 border border-brand-300 rounded-lg text-xs font-bold text-brand-600 hover:bg-brand-600 hover:text-white transition-all flex items-center space-x-1"
                                  >
                                    <span>+ {fc.vietnamese_name} ({fc.correct_english_word})</span>
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>

                          <div className="pt-2 border-t border-line space-y-2 text-xs">
                            <span className="font-bold text-brand-600 block">Tạo Mới Flashcard:</span>
                            {fcImageUrl && (
                              <div className="w-24 h-24 rounded-xl border border-line overflow-hidden bg-black/5">
                                <img src={fcImageUrl} alt="Flashcard preview" className="w-full h-full object-cover" />
                              </div>
                            )}
                            <input type="text" placeholder="URL Ảnh minh họa..." value={fcImageUrl} onChange={(e) => setFcImageUrl(e.target.value)} className="w-full px-3 py-1.5 bg-white border border-line rounded-lg text-xs" />
                            <div className="grid grid-cols-2 gap-2">
                              <input type="text" placeholder="Nghĩa TV" value={fcVnName} onChange={(e) => setFcVnName(e.target.value)} className="px-3 py-1.5 bg-white border border-line rounded-lg text-xs" />
                              <input type="text" placeholder="Từ TA đúng" value={fcEngWord} onChange={(e) => setFcEngWord(e.target.value)} className="px-3 py-1.5 bg-white border border-line rounded-lg text-xs" />
                            </div>
                            <input type="text" placeholder="Các lựa chọn trắc nghiệm (phân cách bằng dấu phẩy)..." value={fcOptionsInput} onChange={(e) => setFcOptionsInput(e.target.value)} className="w-full px-3 py-1.5 bg-white border border-line rounded-lg text-xs" />
                            <button type="button" onClick={handleAddOrUpdateFlashcard} className="w-full py-2 bg-brand-600 text-white rounded-xl text-xs font-bold">
                              {editingFcId ? "Cập Nhật Card" : "Lưu Flashcard Mới Vào Database & Thêm Vào Đề"}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* LISTENING */}
                  {skillType === "Listening" && (
                    <div className="space-y-4 font-sans">
                      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                        {[
                          { id: "LISTENING_MC", label: "Trắc Nghiệm" },
                          { id: "LISTENING_FILL_IN", label: "Điền Ô Trống" },
                          { id: "LISTENING_ORDERING", label: "Sắp Xếp" },
                          { id: "LISTENING_MATCHING", label: "Nối Cặp Từ" },
                        ].map((c) => (
                          <button
                            key={c.id}
                            type="button"
                            onClick={() => { setListeningCategory(c.id as ListeningQType); resetCategoryStates(); }}
                            className={`p-2.5 rounded-xl border text-xs font-bold transition-all ${
                              listeningCategory === c.id
                                ? "bg-brand-50 border-brand-300 text-brand-600"
                                : "bg-surface-alt border-line text-ink-muted"
                            }`}
                          >
                            {c.label}
                          </button>
                        ))}
                      </div>

                      {listeningCategory === "LISTENING_MC" && (
                        <div className="space-y-3 p-4 rounded-2xl bg-surface-alt border border-line">
                          <span className="text-xs font-bold text-brand-600 block">Danh Sách Câu Hỏi Trắc Nghiệm Audio Con ({mcSubQuestions.length})</span>
                          <div className="space-y-2">
                            {mcSubQuestions.map((sub, idx) => {
                              const isThisSubQ = subQAudioState.playingSubQId === sub.id;
                              const isLoadingThis = isThisSubQ && subQAudioState.status === "LOADING";
                              const isPlayingThis = isThisSubQ && subQAudioState.status === "PLAYING";

                              return (
                                <div key={sub.id} className="p-3 bg-white rounded-xl border border-line text-xs flex justify-between items-center">
                                  <div>
                                    <span className="font-bold text-ink">Câu {idx + 1}: {sub.subQuestionText}</span>
                                    <div className="pt-1.5">
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleToggleSubQAudioInline(sub);
                                        }}
                                        className="text-[11px] text-brand-600 font-bold border border-line bg-brand-50 hover:bg-brand-300 px-2.5 py-1 rounded-lg flex items-center space-x-1.5 transition-all shadow-2xs cursor-pointer"
                                      >
                                        {isLoadingThis ? (
                                          <>
                                            <Loader2 className="w-3.5 h-3.5 text-brand-600 animate-spin" />
                                            <span>Đang nạp audio...</span>
                                          </>
                                        ) : isPlayingThis ? (
                                          <>
                                            <Volume2 className="w-3.5 h-3.5 text-brand-600 animate-bounce" />
                                            <span>Đang phát bài nghe...</span>
                                          </>
                                        ) : (
                                          <>
                                            <Volume2 className="w-3.5 h-3.5 text-brand-600" />
                                            <span>Nghe âm thanh</span>
                                          </>
                                        )}
                                      </button>
                                    </div>
                                  </div>
                                  <div className="flex space-x-2">
                                    <button type="button" onClick={() => handleEditMcSubQ(sub)} className="text-brand-600"><Edit2 className="w-3.5 h-3.5" /></button>
                                    <button type="button" onClick={() => handleDeleteMcSubQ(sub.id)} className="text-rose-600"><Trash2 className="w-3.5 h-3.5" /></button>
                                  </div>
                                </div>
                              );
                            })}
                          </div>

                          <div className="pt-2 border-t border-line space-y-2">
                            <input type="text" placeholder="Câu hỏi trắc nghiệm con..." value={subQText} onChange={(e) => setSubQText(e.target.value)} className="w-full px-3 py-2 bg-white border border-line rounded-xl text-xs" />
                            <div className="p-2.5 rounded-xl bg-white border border-line space-y-2 text-xs">
                              <span className="font-bold text-brand-600 block">Âm thanh cho câu hỏi con này (Tùy chọn)</span>
                              <div className="flex space-x-3">
                                <label className="flex items-center space-x-1.5">
                                  <input type="radio" checked={subQAudioSource === "NONE"} onChange={() => setSubQAudioSource("NONE")} className="accent-brand-600" />
                                  <span>Không dùng</span>
                                </label>
                                <label className="flex items-center space-x-1.5">
                                  <input type="radio" checked={subQAudioSource === "TTS"} onChange={() => setSubQAudioSource("TTS")} className="accent-brand-600" />
                                  <span>Giọng đọc AI</span>
                                </label>
                              </div>
                              {subQAudioSource === "TTS" && (
                                <div className="space-y-1.5">
                                  <div className="flex items-center space-x-2">
                                    <span className="text-[11px] font-bold text-ink-muted">Chọn giọng đọc AI:</span>
                                    <select value={subQAudioGender} onChange={(e: any) => setSubQAudioGender(e.target.value)} className="px-2 py-0.5 bg-white border border-line rounded text-xs text-brand-600 font-bold">
                                      <option value="Female">♀ Giọng Nữ</option>
                                      <option value="Male">♂ Giọng Nam</option>
                                    </select>
                                  </div>
                                  <div className="flex space-x-2">
                                    <input type="text" placeholder="Văn bản AI đọc..." value={subQAudioText} onChange={(e) => setSubQAudioText(e.target.value)} className="flex-1 px-3 py-1.5 bg-gray-50 border border-line rounded-lg text-xs" />
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleToggleSubQAudioInline(null, subQAudioText || subQText, subQAudioGender);
                                      }}
                                      className="px-2.5 py-1 bg-brand-600 text-white rounded-lg text-xs font-bold flex items-center space-x-1 shrink-0 cursor-pointer"
                                    >
                                      {subQAudioState.playingSubQId === "temp_form_subq" && subQAudioState.status === "LOADING" ? (
                                        <>
                                          <Loader2 className="w-3 h-3 animate-spin text-white" />
                                          <span>Đang Tải...</span>
                                        </>
                                      ) : subQAudioState.playingSubQId === "temp_form_subq" && subQAudioState.status === "PLAYING" ? (
                                        <>
                                          <Volume2 className="w-3 h-3 animate-bounce text-white" />
                                          <span>Đang Phát...</span>
                                        </>
                                      ) : (
                                        <>
                                          <Volume2 className="w-3 h-3 text-white" />
                                          <span>Phát Thử</span>
                                        </>
                                      )}
                                    </button>
                                  </div>
                                </div>
                              )}

                              {subQAudioSource === "UPLOAD" && (
                                <div className="space-y-1">
                                  <span className="text-[10px] text-ink-muted block">Tải file âm thanh lên cho câu hỏi con:</span>
                                  <input type="file" accept="audio/*" onChange={(e) => handleFileUpload(e, setSubQAudioUrl)} className="text-xs text-ink-muted" />
                                </div>
                              )}
                            </div>

                            <div className="grid grid-cols-2 gap-2">
                              <input type="text" placeholder="A" value={subQOptA} onChange={(e) => setSubQOptA(e.target.value)} className="px-3 py-1.5 bg-white border border-line rounded-lg text-xs" />
                              <input type="text" placeholder="B" value={subQOptB} onChange={(e) => setSubQOptB(e.target.value)} className="px-3 py-1.5 bg-white border border-line rounded-lg text-xs" />
                              <input type="text" placeholder="C" value={subQOptC} onChange={(e) => setSubQOptC(e.target.value)} className="px-3 py-1.5 bg-white border border-line rounded-lg text-xs" />
                              <input type="text" placeholder="D" value={subQOptD} onChange={(e) => setSubQOptD(e.target.value)} className="px-3 py-1.5 bg-white border border-line rounded-lg text-xs" />
                            </div>

                            <button type="button" onClick={handleAddOrUpdateMcSubQ} className="w-full py-2 bg-brand-600 text-white rounded-xl text-xs font-bold">
                              {editingSubQId ? "Cập Nhật Câu Con" : "Thêm Câu Con"}
                            </button>
                          </div>
                        </div>
                      )}

                      {listeningCategory === "LISTENING_FILL_IN" && (
                        <div className="space-y-4 font-sans">
                          <div className="flex space-x-4 p-2 bg-surface-alt rounded-xl border border-line text-xs font-bold">
                            <label className="flex items-center space-x-1.5 cursor-pointer">
                              <input type="radio" checked={fillInSubtype === "OPTION_BANK"} onChange={() => setFillInSubtype("OPTION_BANK")} className="accent-brand-600" />
                              <span>Ngân hàng từ chung (Option Bank)</span>
                            </label>
                            <label className="flex items-center space-x-1.5 cursor-pointer">
                              <input type="radio" checked={fillInSubtype === "INLINE_SELECT"} onChange={() => setFillInSubtype("INLINE_SELECT")} className="accent-brand-600" />
                              <span>Dropdown riêng từng ô (Inline Select)</span>
                            </label>
                          </div>

                          <div>
                            <label className="block text-xs font-bold uppercase text-brand-600 mb-1">
                              Soạn Đoạn Văn Chứa Đáp Án Trong Ngoặc Vuông <code>[đáp_án_đúng]</code>
                            </label>
                            <textarea
                              rows={3}
                              value={parenthesesRawText}
                              onChange={(e) => setParenthesesRawText(e.target.value)}
                              placeholder="Ví dụ: Artificial Intelligence is [slowly] transforming..."
                              className="w-full p-3.5 bg-surface-alt border border-line rounded-xl text-xs font-bold text-brand-600"
                            />
                          </div>

                          {fillInSubtype === "OPTION_BANK" ? (
                            <div>
                              <label className="block text-xs font-bold uppercase text-ink mb-1">
                                Ngân Hàng Từ Dùng Chung
                              </label>
                              <input
                                type="text"
                                value={optionBankWords.join(", ")}
                                onChange={(e) => setOptionBankWords(e.target.value.split(",").map((s) => s.trim()).filter(Boolean))}
                                className="w-full px-3 py-2 bg-surface-alt border border-line rounded-xl text-xs font-medium"
                              />
                            </div>
                          ) : (
                            <div className="p-3.5 rounded-2xl bg-surface-alt border border-line space-y-3">
                              {parseFillInGaps(parenthesesRawText).gaps.map((correctVal: string, idx: number) => (
                                <div key={idx} className="p-3 bg-white rounded-xl border border-line space-y-2 text-xs">
                                  <div className="flex items-center justify-between">
                                    <span className="font-bold text-brand-600">📍 Vị trí #{idx + 1}</span>
                                    <span className="px-2.5 py-0.5 bg-emerald-100 text-emerald-900 border border-emerald-300 rounded-lg font-bold text-[11px]">
                                      Đáp án: "{correctVal}"
                                    </span>
                                  </div>
                                  <div className="flex items-center space-x-2">
                                    <span className="px-3 py-2 bg-brand-50 text-brand-600 font-bold text-xs border border-brand-300 rounded-xl shrink-0 select-none">
                                      ✓ {correctVal}
                                    </span>
                                    <input
                                      type="text"
                                      placeholder="Từ gây nhiễu..."
                                      value={gapDistractorInputs[idx] || ""}
                                      onChange={(e) => setGapDistractorInputs({ ...gapDistractorInputs, [idx]: e.target.value })}
                                      className="w-full px-3 py-2 bg-white border border-line rounded-xl text-xs focus:outline-none focus:border-brand-600"
                                    />
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}

                      {listeningCategory === "LISTENING_ORDERING" && (
                        <textarea rows={3} value={orderingRawText} onChange={(e) => setOrderingRawText(e.target.value)} className="w-full p-3 bg-surface-alt border border-line rounded-xl text-xs" />
                      )}

                      {listeningCategory === "LISTENING_MATCHING" && (
                        <div className="space-y-3 p-4 rounded-2xl bg-surface-alt border border-line">
                          <span className="text-xs font-bold text-brand-600 block">Cặp Nối Từ Listening</span>
                          <div className="grid grid-cols-2 gap-2">
                            <input type="text" placeholder="Cột A" value={matchLeft} onChange={(e) => setMatchLeft(e.target.value)} className="px-3 py-1.5 bg-white border border-line rounded-lg text-xs" />
                            <input type="text" placeholder="Cột B" value={matchRight} onChange={(e) => setMatchRight(e.target.value)} className="px-3 py-1.5 bg-white border border-line rounded-lg text-xs" />
                          </div>
                          <button type="button" onClick={handleAddOrUpdateMatchingPair} className="w-full py-2 bg-brand-600 text-white rounded-xl text-xs font-bold">
                            Thêm Cặp Nối
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                  {/* WRITING */}
                  {skillType === "Writing" && (
                    <div className="space-y-4 font-sans">
                      <div className="grid grid-cols-3 gap-2">
                        {[
                          { id: "WRITING_ESSAY", label: "Bài Viết Essay" },
                          { id: "WRITING_FREE_TYPING_BLANKS", label: "Điền Chỗ Trống Tự Gõ" },
                          { id: "WRITING_FLASHCARD_SET", label: "Flashcards Set" },
                          { id: "WRITING_SHORT_ANSWER", label: "Trả Lời Câu Hỏi Ngắn" },
                          { id: "WRITING_SENTENCE_REWRITE", label: "Viết Lại Câu" },
                        ].map((c) => (
                          <button key={c.id} type="button" onClick={() => { setWritingCategory(c.id as WritingQType); resetCategoryStates(); }} className={`p-2.5 rounded-xl border text-xs font-bold transition-all ${writingCategory === c.id ? "bg-brand-50 border-brand-300 text-brand-600" : "bg-surface-alt border-line text-ink-muted"}`}>
                            {c.label}
                          </button>
                        ))}
                      </div>

                      {writingCategory === "WRITING_ESSAY" && (
                        <textarea rows={3} value={essayPromptText} onChange={(e) => setEssayPromptText(e.target.value)} className="w-full p-3 bg-surface-alt border border-line rounded-xl text-xs" />
                      )}

                      {writingCategory === "WRITING_FREE_TYPING_BLANKS" && (
                        <div>
                          <label className="block text-xs font-bold uppercase text-brand-600 mb-1">
                            Soạn Đoạn Văn Chứa Đáp Án Trong Ngoặc Vuông <code>[đáp_án_đúng]</code>
                          </label>
                          <textarea
                            rows={3}
                            value={parenthesesRawText}
                            onChange={(e) => setParenthesesRawText(e.target.value)}
                            placeholder="Ví dụ: To achieve success in IELTS, one must practice [consistently] every day."
                            className="w-full p-3.5 bg-surface-alt border border-line rounded-xl text-xs font-bold text-brand-600"
                          />
                        </div>
                      )}

                      {writingCategory === "WRITING_FLASHCARD_SET" && (
                        <div className="space-y-3 p-4 rounded-2xl bg-surface-alt border border-line">
                          <span className="text-xs font-bold text-brand-600 block">Tập Hợp Flashcards Tự Gõ Từ ({flashcardsList.length})</span>
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                            {flashcardsList.map((fc) => (
                              <div key={fc.id} className="p-3 bg-white rounded-2xl border border-line text-xs flex flex-col space-y-2 relative">
                                {fc.imageUrl && (
                                  <div className="w-full h-28 rounded-xl overflow-hidden border border-line/60 relative">
                                    <img src={fc.imageUrl} alt={fc.vietnameseName} className="w-full h-full object-cover" />
                                  </div>
                                )}
                                <div className="flex-1 space-y-1">
                                  <span className="font-bold text-ink block">{fc.vietnameseName}</span>
                                  <span className="text-[10px] text-emerald-800 font-bold block">Từ khóa: {fc.correctEnglishWord}</span>
                                </div>
                                <div className="flex justify-end space-x-1.5 pt-1.5 border-t border-line/40">
                                  <button type="button" onClick={() => handleEditFlashcard(fc)} className="p-1.5 rounded-lg bg-gray-50 border border-line text-brand-600 hover:bg-brand-50"><Edit2 className="w-3.5 h-3.5" /></button>
                                  <button type="button" onClick={() => handleDeleteFlashcard(fc.id)} className="p-1.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-600 hover:bg-rose-100"><Trash2 className="w-3.5 h-3.5" /></button>
                                </div>
                              </div>
                            ))}
                          </div>

                          <div className="p-3 bg-white rounded-xl border border-line space-y-2">
                            <span className="font-bold text-brand-600 block text-[11px]">🔍 Tìm Kiếm Flashcard Đã Có Trong Database:</span>
                            <input
                              type="text"
                              placeholder="Gõ từ tiếng Anh hoặc tiếng Việt để tìm..."
                              value={fcSearchQuery}
                              onChange={(e) => handleSearchFlashcards(e.target.value)}
                              className="w-full px-3 py-1.5 bg-surface-alt border border-line rounded-lg text-xs font-medium focus:outline-none focus:border-brand-600"
                            />
                            {isSearchingFc && <p className="text-[10px] text-ink-subtle">Đang tìm kiếm...</p>}
                            {fcSearchResults.length > 0 && (
                              <div className="flex flex-wrap gap-1.5 pt-1">
                                {fcSearchResults.map((fc) => (
                                  <button
                                    key={fc.id}
                                    type="button"
                                    onClick={() => handleSelectExistingFc(fc)}
                                    className="px-2.5 py-1 bg-brand-50 border border-brand-300 rounded-lg text-xs font-bold text-brand-600 hover:bg-brand-600 hover:text-white transition-all flex items-center space-x-1 cursor-pointer"
                                  >
                                    <span>+ {fc.vietnamese_name} ({fc.correct_english_word})</span>
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>

                          <div className="pt-2 border-t border-line space-y-2 text-xs">
                            <span className="font-bold text-brand-600 block">Xem Trước Ảnh Minh Họa Đang Biên Soạn:</span>
                            {fcImageUrl && (
                              <div className="w-24 h-24 rounded-xl border border-line overflow-hidden bg-black/5">
                                <img src={fcImageUrl} alt="Flashcard preview" className="w-full h-full object-cover" />
                              </div>
                            )}
                            <input type="text" placeholder="URL Ảnh minh họa..." value={fcImageUrl} onChange={(e) => setFcImageUrl(e.target.value)} className="w-full px-3 py-1.5 bg-white border border-line rounded-lg text-xs" />
                            <div className="grid grid-cols-2 gap-2">
                              <input type="text" placeholder="Nghĩa TV" value={fcVnName} onChange={(e) => setFcVnName(e.target.value)} className="px-3 py-1.5 bg-white border border-line rounded-lg text-xs" />
                              <input type="text" placeholder="Từ TA đúng để gõ" value={fcEngWord} onChange={(e) => setFcEngWord(e.target.value)} className="px-3 py-1.5 bg-white border border-line rounded-lg text-xs" />
                            </div>
                            <button type="button" onClick={handleAddOrUpdateFlashcard} className="w-full py-2 bg-brand-600 text-white rounded-xl text-xs font-bold">
                              Thêm Card
                            </button>
                          </div>
                        </div>
                      )}

                      {writingCategory === "WRITING_SHORT_ANSWER" && (
                        <div className="space-y-3 p-4 rounded-2xl bg-surface-alt border border-line">
                          <span className="text-xs font-bold text-brand-600 block">Danh Sách Câu Hỏi Tự Luận Ngắn ({shortAnswersList.length})</span>
                          <div className="space-y-2">
                            {shortAnswersList.map((sa, idx) => (
                              <div key={sa.id} className="p-3 bg-white rounded-xl border border-line text-xs flex justify-between items-center">
                                <div>
                                  <span className="font-bold text-ink">Q{idx + 1}: {sa.questionText}</span>
                                  <span className="text-[10px] text-ink-subtle block">Giới hạn: {sa.maxWords} từ</span>
                                </div>
                                <div className="flex space-x-2">
                                  <button type="button" onClick={() => handleEditShortAnswer(sa)} className="text-brand-600"><Edit2 className="w-3.5 h-3.5" /></button>
                                  <button type="button" onClick={() => handleDeleteShortAnswer(sa.id)} className="text-rose-600"><Trash2 className="w-3.5 h-3.5" /></button>
                                </div>
                              </div>
                            ))}
                          </div>

                          <div className="pt-2 border-t border-line space-y-2">
                            <input type="text" placeholder="Câu hỏi tự luận ngắn..." value={saQuestionText} onChange={(e) => setSaQuestionText(e.target.value)} className="w-full px-3 py-2 bg-white border border-line rounded-xl text-xs" />
                            <div>
                              <label className="block text-[11px] font-bold text-ink mb-1">Giới hạn tối đa số từ:</label>
                              <input type="number" value={saMaxWords} onChange={(e) => setSaMaxWords(Number(e.target.value))} className="w-24 px-3 py-1.5 bg-white border border-line rounded-lg text-xs" />
                            </div>
                            <button type="button" onClick={handleAddOrUpdateShortAnswer} className="w-full py-2 bg-brand-600 text-white rounded-xl text-xs font-bold">
                              {editingSaId ? "Cập Nhật Câu Hỏi Tự Luận" : "Thêm Câu Hỏi Tự Luận"}
                            </button>
                          </div>
                        </div>
                      )}

                      {writingCategory === "WRITING_SENTENCE_REWRITE" && (
                        <div className="space-y-4 p-4 rounded-2xl bg-surface-alt border border-line">
                          <div className="flex justify-between items-center border-b border-line/40 pb-2">
                            <span className="text-xs font-bold text-brand-600">
                              Danh Sách Câu Hỏi Viết Lại ({rewriteSubQuestions.length})
                            </span>
                            <span className="text-[10px] text-ink-subtle">
                              Đặt từ gợi ý trong ngoặc: <code>[Unless] ...</code>
                            </span>
                          </div>

                          {rewriteSubQuestions.length > 0 && (
                            <div className="space-y-2">
                              {rewriteSubQuestions.map((sr, idx) => {
                                const { cue } = parseSentenceRewriteCue(sr.correctAnswer);
                                return (
                                  <div key={sr.id} className="p-3 bg-white rounded-xl border border-line text-xs flex justify-between items-center">
                                    <div className="space-y-1">
                                      <span className="font-bold text-brand-600">Câu {idx + 1}: {sr.originalSentence}</span>
                                      <p className="text-[11px] text-ink-muted">
                                        ➔ {sr.correctAnswer} {cue && <span className="px-2 py-0.5 bg-amber-100 text-amber-900 rounded font-bold text-[10px] ml-2">Gợi ý: "{cue}"</span>}
                                      </p>
                                    </div>
                                    <div className="flex space-x-1 shrink-0 ml-2">
                                      <button
                                        type="button"
                                        onClick={() => handleEditSentenceRewrite(sr)}
                                        className="p-1.5 rounded-lg bg-gray-50 border border-line text-brand-600 hover:bg-brand-50 cursor-pointer"
                                      >
                                        <Edit2 className="w-3.5 h-3.5" />
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => handleDeleteSentenceRewrite(sr.id)}
                                        className="p-1.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-600 hover:bg-rose-100 cursor-pointer"
                                      >
                                        <Trash2 className="w-3.5 h-3.5" />
                                      </button>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}

                          <div className="pt-2 border-t border-line space-y-2">
                            <span className="text-[11px] font-bold text-brand-600 block">
                              {editingSrId ? "Chỉnh Sửa Câu Viết Lại Con:" : "Thêm Câu Viết Lại Con Mới:"}
                            </span>
                            <input
                              type="text"
                              placeholder="Câu gốc..."
                              value={srOriginalSentence}
                              onChange={(e) => setSrOriginalSentence(e.target.value)}
                              className="w-full px-3 py-2 bg-white border border-line rounded-xl text-xs focus:outline-none focus:border-brand-600"
                            />
                            <input
                              type="text"
                              placeholder="Câu viết lại có [từ gợi ý]..."
                              value={srCorrectAnswer}
                              onChange={(e) => setSrCorrectAnswer(e.target.value)}
                              className="w-full px-3 py-2 bg-white border border-line rounded-xl text-xs focus:outline-none focus:border-brand-600"
                            />
                            <button
                              type="button"
                              onClick={handleAddOrUpdateSentenceRewrite}
                              disabled={!srOriginalSentence.trim() || !srCorrectAnswer.trim()}
                              className="w-full py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-xl text-xs font-bold transition-all disabled:opacity-50 cursor-pointer"
                            >
                              {editingSrId ? "Cập Nhật Câu Viết Lại Này" : "Thêm Câu Viết Lại Này"}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* SPEAKING */}
                  {skillType === "Speaking" && (
                    <div className="space-y-4">
                      {speakingCategory === "SPEAKING_TOPIC_PROMPT" && (
                        <textarea rows={3} value={speakingCuePrompt} onChange={(e) => setSpeakingCuePrompt(e.target.value)} className="w-full p-3 bg-surface-alt border border-line rounded-xl text-xs" />
                      )}

                      {speakingCategory === "SPEAKING_READ_ALOUD" && (
                        <textarea rows={3} value={readAloudPassage} onChange={(e) => setReadAloudPassage(e.target.value)} className="w-full p-3 bg-surface-alt border border-line rounded-xl text-xs font-medium" />
                      )}
                    </div>
                  )}

                  <div className="flex items-center space-x-2">
                    <button
                      onClick={handleAddOrUpdateQuestion}
                      className="flex-1 py-3.5 bg-brand-600 hover:bg-brand-700 text-white rounded-xl text-xs font-bold transition-all shadow flex items-center justify-center space-x-2 font-headline cursor-pointer"
                    >
                      <Plus className="w-4 h-4 text-white" />
                      <span>
                        {editingQuestionNumber
                          ? `Cập Nhật Câu Hỏi Số ${editingQuestionNumber}`
                          : (isExamMode ? "Thêm Nhóm Câu Hỏi Vào Đề Thi" : "Thêm Nhóm Câu Hỏi Vào Bài Học")}
                      </span>
                    </button>

                    {editingQuestionId && (
                      <button
                        type="button"
                        onClick={() => {
                          setEditingQuestionId(null);
                          resetCategoryStates();
                          setQuestionPrompt("");
                          setStimulusText("");
                          setStimulusAudioUrl("");
                        }}
                        className="px-4 py-3.5 bg-gray-100 hover:bg-rose-50 border border-gray-300 hover:border-rose-300 text-ink-muted hover:text-rose-600 rounded-xl text-xs font-bold transition-all flex items-center space-x-1.5 shrink-0 cursor-pointer"
                      >
                        <XCircle className="w-4 h-4" />
                        <span>Hủy Sửa Câu {editingQuestionNumber}</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Right Question List Preview Pane */}
            <div className="lg:col-span-4 bg-white p-6 rounded-3xl border border-line shadow-sm flex flex-col font-sans text-xs h-full min-h-[500px]">
              <h2 className="text-base font-bold text-brand-600 flex items-center justify-between border-b border-line/40 pb-3 mb-4 shrink-0">
                <span>Danh Sách Câu Hỏi Đã Tạo ({questionsList.length})</span>
              </h2>

              {questionsList.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center p-6 text-center border-2 border-dashed border-line rounded-2xl bg-surface-alt min-h-[300px]">
                  <p className="text-xs text-ink-muted">Chưa có câu hỏi nào. Biên soạn ở bên trái để thêm mới.</p>
                </div>
              ) : (
                <div className="space-y-3 flex-1 overflow-y-auto pr-1 max-h-[calc(100vh-200px)]">
                  {questionsList.map((q, idx) => {
                    const isEditingThis = q.id === editingQuestionId;
                    return (
                      <div
                        key={q.id}
                        draggable
                        onDragStart={(e) => handleDragStart(e, idx)}
                        onDragOver={(e) => handleDragOver(e, idx)}
                        onDrop={(e) => handleDrop(e, idx)}
                        onDragEnd={handleDragEnd}
                        className={`p-4 rounded-2xl border transition-all duration-150 space-y-2.5 group cursor-grab active:cursor-grabbing ${
                          isEditingThis
                            ? "border-brand-600 bg-brand-50 ring-2 ring-brand-300 shadow-md"
                            : dragOverIndex === idx
                            ? "border-brand-600 bg-brand-50 ring-2 ring-brand-300"
                            : draggedIndex === idx
                            ? "opacity-40 border-dashed border-brand-600 bg-gray-50"
                            : "border-line bg-surface-alt hover:border-brand-600"
                        }`}
                      >
                        <div className="flex justify-between items-center text-xs">
                          <div className="flex items-center space-x-1.5">
                            <GripVertical className="w-4 h-4 text-ink-subtle group-hover:text-brand-600 shrink-0" />
                            <span className="font-bold text-brand-600">Câu {idx + 1} ({q.skill})</span>
                          </div>

                          <div className="flex items-center space-x-1">
                            <button type="button" onClick={() => handleEditMainQuestion(q)} className={`p-1.5 rounded-lg border transition-all cursor-pointer ${isEditingThis ? "bg-brand-600 text-white border-brand-600" : "bg-white border-line text-brand-600 hover:bg-brand-50"}`} title="Chỉnh sửa câu hỏi này"><Edit2 className="w-3.5 h-3.5" /></button>
                            <button type="button" onClick={() => handleMoveQuestionUp(idx)} disabled={idx === 0} className="p-1.5 rounded-lg bg-white border border-line text-brand-600 disabled:opacity-30 cursor-pointer"><ArrowUp className="w-3.5 h-3.5" /></button>
                            <button type="button" onClick={() => handleMoveQuestionDown(idx)} disabled={idx === questionsList.length - 1} className="p-1.5 rounded-lg bg-white border border-line text-brand-600 disabled:opacity-30 cursor-pointer"><ArrowDown className="w-3.5 h-3.5" /></button>
                            <button type="button" onClick={() => handleDeleteQuestion(idx)} className="p-1.5 rounded-lg bg-white border border-rose-200 text-rose-600 hover:bg-rose-50 cursor-pointer"><Trash2 className="w-3.5 h-3.5" /></button>
                          </div>
                        </div>

                        <span className="px-2 py-0.5 rounded-full bg-brand-50 text-brand-600 border border-brand-300 text-[10px] font-bold inline-block">{q.category}</span>
                        <p className="text-xs text-ink font-bold">{q.questionTitle}</p>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Audio Synthesizing & Playback Modal Popup */}
          {showAudioPopup && (
            <div
              className="fixed inset-0 bg-ink/60 backdrop-blur-sm flex items-center justify-center z-[100] transition-opacity p-4"
              onClick={handleCloseAudioPopup}
            >
              <div
                className="w-full max-w-md bg-white rounded-3xl border border-line shadow-xl p-6 relative overflow-hidden flex flex-col space-y-4"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex justify-between items-center pb-2 border-b border-line/30">
                  <h3 className="font-headline font-bold text-sm text-brand-600 flex items-center space-x-1.5">
                    <Volume2 className="w-4 h-4 text-brand-700" />
                    <span>Nghe Thử Giọng Đọc AI</span>
                  </h3>
                  <button
                    type="button"
                    onClick={handleCloseAudioPopup}
                    className="p-1.5 rounded-full hover:bg-surface-alt text-ink-subtle hover:text-brand-600 transition-all"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                  </button>
                </div>

                <div className="text-xs text-ink-muted leading-relaxed bg-surface-alt p-3 rounded-xl border border-line/30 max-h-24 overflow-y-auto">
                  <span className="font-bold block text-[10px] text-ink-subtle mb-0.5">VĂN BẢN ĐỌC:</span>
                  "{audioPopupText}"
                </div>

                {isAudioLoading ? (
                  <div className="flex flex-col items-center justify-center py-6 space-y-3">
                    <Loader2 className="w-8 h-8 text-brand-700 animate-spin" />
                    <span className="text-[11px] text-ink-subtle font-medium animate-pulse">Đang kết nối Gemini và tổng hợp giọng nói...</span>
                  </div>
                ) : (
                  <div className="py-2 space-y-2">
                    <audio
                      ref={popupAudioRef}
                      src={audioPopupSrc || undefined}
                      controls
                      className="w-full focus:outline-none custom-audio-player"
                    />
                    <p className="text-[10px] text-ink-subtle text-center italic">
                      * Click ra ngoài vùng xám hoặc bấm nút đóng để tắt popup
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Gemini TTS Failure Dialog */}
          {ttsErrorModal?.show && (
            <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
              <div className="bg-white p-6 rounded-3xl max-w-md text-center shadow-xl border border-line space-y-4">
                <div className="w-12 h-12 rounded-full bg-amber-100 text-amber-800 flex items-center justify-center mx-auto">
                  <Volume2 className="w-6 h-6" />
                </div>
                <h3 className="text-base font-bold text-brand-600">⚠️ Không Thể Kết Nối AI Giọng Nói Gemini</h3>
                <p className="text-xs text-ink-muted leading-relaxed">
                  Hệ thống không thể kết nối tới dịch vụ Gemini TTS lúc này. Bạn muốn thử kết nối lại hay chuyển sang sử dụng giọng đọc mặc định?
                </p>
                <div className="pt-2 flex flex-col gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      const currentModal = ttsErrorModal;
                      setTtsErrorModal(null);
                      handlePlayPreviewAudio(currentModal.audioUrl, currentModal.fallbackText, currentModal.gender, false);
                    }}
                    className="w-full py-2.5 bg-brand-600 hover:bg-brand-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm cursor-pointer"
                  >
                    🔄 Thử Kết Nối Lại Gemini
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const currentModal = ttsErrorModal;
                      setTtsErrorModal(null);
                      handlePlayPreviewAudio(currentModal.audioUrl, currentModal.fallbackText, currentModal.gender, true);
                    }}
                    className="w-full py-2.5 bg-brand-50 hover:bg-brand-300 text-brand-600 rounded-xl text-xs font-bold border border-line transition-all cursor-pointer"
                  >
                    🗣️ Sử Dụng Âm Thanh Mặc Định (Fallback)
                  </button>
                  <button
                    type="button"
                    onClick={() => setTtsErrorModal(null)}
                    className="text-xs text-ink-subtle hover:underline pt-1 cursor-pointer"
                  >
                    Hủy bỏ
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
