"use client";

import { useState, useEffect, useRef, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import TeacherLayout from "@/components/TeacherLayout";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { INITIAL_COURSES } from "@/lib/mock-data";
import RichTextEditor from "@/components/RichTextEditor";
import { getMediaStimulusInfo, buildStandardQuestionContent, parseSentenceRewriteCue, parseFillInGaps } from "@/lib/question-content-types";
import {
  PlusCircle,
  Sparkles,
  CheckCircle2,
  Save,
  BookOpen,
  Clock,
  Loader2,
  Type,
  ListOrdered,
  FileText,
  Plus,
  Trash2,
  Scissors,
  Link2,
  Volume2,
  Image as ImageIcon,
  ArrowUp,
  ArrowDown,
  Play,
  ArrowLeftRight,
  Upload,
  GripVertical,
  Headphones,
  PenTool,
  Mic,
  Layers,
  Edit2,
  CheckSquare,
  Edit3,
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
  englishOptions?: string[]; // Optional for writing
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

function TeacherTestCreatorInner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const editId = searchParams.get("editId");
  const [isLoadingEditData, setIsLoadingEditData] = useState(false);

  // Global Exam Fields
  const [testTitle, setTestTitle] = useState("");
  const [selectedCourseId, setSelectedCourseId] = useState("crs_01");
  const [testDescription, setTestDescription] = useState("");
  const [duration, setDuration] = useState("60");
  const [skillType, setSkillType] = useState<SkillType>("Reading");
  const [rubricsList, setRubricsList] = useState<any[]>([]);
  const [selectedRubricId, setSelectedRubricId] = useState<string>("rubric_ielts_writing");

  useEffect(() => {
    fetch("/api/exam/rubrics")
      .then((res) => res.json())
      .then((json) => {
        if (json.success && Array.isArray(json.rubrics)) {
          setRubricsList(json.rubrics);
        }
      })
      .catch((e) => console.warn("Load rubrics error:", e));
  }, []);

  // Global Questions List & Edit Question Tracker
  const [questionsList, setQuestionsList] = useState<any[]>([]);
  const [editingQuestionId, setEditingQuestionId] = useState<string | null>(null);

  // Drag and Drop Reorder State
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  // Global Parent Stimulus Header State (Text / Audio / Combined)
  const [stimulusType, setStimulusType] = useState<"TEXT_ONLY" | "AUDIO_ONLY" | "COMBINED">("TEXT_ONLY");
  const [stimulusText, setStimulusText] = useState("");
  const [stimulusAudioText, setStimulusAudioText] = useState("");
  const [stimulusAudioSource, setStimulusAudioSource] = useState<"TTS" | "UPLOAD">("UPLOAD");
  const [stimulusAudioGender, setStimulusAudioGender] = useState<"Female" | "Male">("Female");
  const [stimulusAudioUrl, setStimulusAudioUrl] = useState("");

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

  // Load Exam and Questions when editing an existing test (editId)
  useEffect(() => {
    if (!editId) return;
    const loadExamForEditing = async () => {
      setIsLoadingEditData(true);
      try {
        const { data: examData, error: examErr } = await supabase
          .from("exams")
          .select("*")
          .eq("id", editId)
          .single();

        if (examErr || !examData) {
          console.error("Error loading exam for editing:", examErr);
          return;
        }

        setTestTitle(examData.title || "");
        setDuration(String(examData.duration_minutes || 60));
        setTestDescription(examData.reading_passage || examData.description || "");

        // Fetch Neo4j course mapping if available
        try {
          const { getExamCourseMapping } = await import("@/lib/neo4j");
          const mappings = await getExamCourseMapping();
          const mapObj = mappings.find((m) => m.examId === editId);
          if (mapObj) setSelectedCourseId(mapObj.courseId);
        } catch (e) {}

        // Fetch questions
        let qIds = examData.question_ids || [];
        let qRows: any[] = [];

        if (qIds.length > 0) {
          const { data, error: qErr } = await supabase
            .from("questions")
            .select("*")
            .in("id", qIds);
          if (!qErr && data) qRows = data;
        } else {
          // Fallback for legacy seed exams with empty question_ids array
          const { data } = await supabase.from("questions").select("*").order("id", { ascending: true });
          if (data) {
            qRows = data;
            qIds = data.map((q) => q.id);
          }
        }

        if (qRows.length > 0) {
          const qMap = new Map(qRows.map((q: any) => [q.id, q]));
          const loadedQuestions: any[] = [];

          for (const id of qIds) {
            const qRow = qMap.get(id);
            if (qRow) {
              const c = qRow.content || {};

              // Hydrate flashcards list if question is a flashcard set
              const fcIds = c.flashcard_ids || c.flashcardIds || qRow.flashcard_ids || [];
              let hydratedFlashcards: FlashcardItem[] = [];
              if (Array.isArray(fcIds) && fcIds.length > 0) {
                const { data: fcRows } = await supabase
                  .from("flashcards")
                  .select("*")
                  .in("id", fcIds);

                if (fcRows) {
                  hydratedFlashcards = fcRows.map((fc: any) => ({
                    id: fc.id,
                    imageUrl: fc.image_url || "",
                    vietnameseName: fc.vietnamese_name || "",
                    correctEnglishWord: fc.correct_english_word || "",
                    englishOptions: fc.options || [],
                  }));
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
          }

          setQuestionsList(loadedQuestions);
        }
      } catch (err) {
        console.error("Load edit exam error:", err);
      } finally {
        setIsLoadingEditData(false);
      }
    };

    loadExamForEditing();
  }, [editId]);

  // ==========================================
  // SKILL SPECIFIC SUB-CATEGORIES
  // ==========================================
  const [readingCategory, setReadingCategory] = useState<ReadingQType>("READING_MC");
  const [listeningCategory, setListeningCategory] = useState<ListeningQType>("LISTENING_MC");
  const [writingCategory, setWritingCategory] = useState<WritingQType>("WRITING_ESSAY");
  const [speakingCategory, setSpeakingCategory] = useState<SpeakingQType>("SPEAKING_TOPIC_PROMPT");

  // ==========================================
  // SHARED SUB-ELEMENT STATES & BUILDERS
  // ==========================================
  
  // 1. Multiple Choice Sub-Questions State (Reading & Listening MC)
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
  const [stimulusTab, setStimulusTab] = useState<"EDIT" | "PREVIEW">("EDIT");

  // 2. Bracket `[correctAnswer]` Paragraphs & Gaps (Option Bank / Inline Dropdown)
  const [parenthesesRawText, setParenthesesRawText] = useState(
    "Artificial Intelligence is [slowly] transforming the landscape of language teaching. Students can learn [flexibly]."
  );
  const [fillInSubtype, setFillInSubtype] = useState<"OPTION_BANK" | "INLINE_SELECT">("OPTION_BANK");
  const [optionBankWords, setOptionBankWords] = useState<string[]>(["slowly", "flexibly", "rarely", "rigidly", "poorly"]);
  const [gapDistractorInputs, setGapDistractorInputs] = useState<Record<number, string>>({});

  // 3. Ordering State
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

  // 4. Matching Pairs State
  const [matchingPrompt, setMatchingPrompt] = useState("Nối từ Cột A với nghĩa ở Cột B:");
  const [matchingPairs, setMatchingPairs] = useState<MatchingPair[]>([]);
  const [editingPairId, setEditingPairId] = useState<string | null>(null);
  const [matchLeft, setMatchLeft] = useState("");
  const [matchRight, setMatchRight] = useState("");

  // 5. Flashcards State (Reading & Writing Flashcard Sets)
  const [flashcardSetPrompt, setFlashcardSetPrompt] = useState("Quan sát hình ảnh / nghĩa tiếng Việt và chọn từ tiếng Anh tương ứng:");
  const [flashcardsList, setFlashcardsList] = useState<FlashcardItem[]>([]);
  const [editingFcId, setEditingFcId] = useState<string | null>(null);
  const [fcImageUrl, setFcImageUrl] = useState("https://images.unsplash.com/photo-1566073771259-6a8506099945?q=80&w=800&auto=format&fit=crop");
  const [fcVnName, setFcVnName] = useState("");
  const [fcEngWord, setFcEngWord] = useState("");
  const [fcOptionsInput, setFcOptionsInput] = useState("accommodation, destination, transportation, reservation");
  const [fcSearchQuery, setFcSearchQuery] = useState("");
  const [fcSearchResults, setFcSearchResults] = useState<any[]>([]);
  const [isSearchingFc, setIsSearchingFc] = useState(false);

  // 6. Short Answer Questions State (Writing)
  const [shortAnswersList, setShortAnswersList] = useState<ShortAnswerPrompt[]>([]);
  const [editingSaId, setEditingSaId] = useState<string | null>(null);
  const [saQuestionText, setSaQuestionText] = useState("");
  const [saMaxWords, setSaMaxWords] = useState(50);

  // 7. Writing Essay State
  const [essayPromptText, setEssayPromptText] = useState(
    "Write an essay (at least 250 words) discussing the advantages and disadvantages of online education compared to traditional schooling."
  );
  const [essayMinWords, setEssayMinWords] = useState("250");
  const [essayRubric, setEssayRubric] = useState("Task Achievement (25%), Coherence & Cohesion (25%), Lexical Resource (25%), Grammatical Range (25%)");

  // 8. Writing Sentence Rewrite State
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

  // 9. Speaking Cue Card / Topic Prompt State
  const [speakingCuePrompt, setSpeakingCuePrompt] = useState(
    "Describe an educational experience that inspired you. You should say: where it happened, who was involved, and why it was memorable."
  );
  const [speakingPrepTime, setSpeakingPrepTime] = useState("60");
  const [speakingRecordTime, setSpeakingRecordTime] = useState("120");

  // 10. Speaking Read Aloud State
  const [readAloudPassage, setReadAloudPassage] = useState(
    "Artificial Intelligence in education provides personalized learning pathways for students around the globe."
  );

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSavedMsg, setShowSavedMsg] = useState(false);

  // ==========================================
  // UNIFIED AUDIO SYNTHESIS & PLAYBACK WITH ACCENTS
  // ==========================================
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isAudioLoading, setIsAudioLoading] = useState(false);
  const [showAudioPopup, setShowAudioPopup] = useState(false);
  const [audioPopupSrc, setAudioPopupSrc] = useState<string | null>(null);
  const [audioPopupText, setAudioPopupText] = useState("");
  const [audioPreviewSrc, setAudioPreviewSrc] = useState("");
  const [ttsErrorModal, setTtsErrorModal] = useState<{
    show: boolean;
    audioUrl?: string;
    fallbackText?: string;
    gender: "Female" | "Male";
  } | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const popupAudioRef = useRef<HTMLAudioElement | null>(null);

  // Inline Sub-Question Audio Player State (No Popup Modal)
  const [subQAudioState, setSubQAudioState] = useState<{
    playingSubQId: string | null;
    status: "IDLE" | "LOADING" | "PLAYING";
  }>({ playingSubQId: null, status: "IDLE" });
  const subQAudioRef = useRef<HTMLAudioElement | null>(null);

  const handleToggleSubQAudioInline = (sub: any, fallbackText?: string, gender: "Female" | "Male" = "Female") => {
    const targetId = sub?.id || "temp_form_subq";
    
    // If currently playing this sub-question audio, pause it!
    if (subQAudioState.playingSubQId === targetId && subQAudioState.status === "PLAYING") {
      if (subQAudioRef.current) {
        subQAudioRef.current.pause();
      }
      setSubQAudioState({ playingSubQId: null, status: "IDLE" });
      return;
    }

    // Stop any existing playing sub-question audio
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

  const getTtsHdUrl = (word: string, gender: "Female" | "Male" = "Female", useFallback: boolean = false) => {
    const cleanWord = encodeURIComponent((word || "accommodation").trim());
    return `/api/tts?text=${cleanWord}&gender=${gender}${useFallback ? "&fallback=true" : ""}`;
  };

  const handlePlayPreviewAudio = async (
    audioUrl?: string,
    fallbackText?: string,
    gender: "Female" | "Male" = "Female",
    useFallback: boolean = false
  ) => {
    // 1. Cancel previous loading request if any
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    
    // 2. Pause and reset popup audio if already playing
    if (popupAudioRef.current) {
      popupAudioRef.current.pause();
      popupAudioRef.current.src = "";
    }
    
    if (audioPopupSrc) {
      URL.revokeObjectURL(audioPopupSrc);
      setAudioPopupSrc(null);
    }

    const src = audioUrl || getTtsHdUrl(fallbackText || "accommodation", gender, useFallback);
    setAudioPreviewSrc(src);
    setAudioPopupText(fallbackText || (audioUrl ? "Audio File Preview" : "accommodation"));
    
    setIsAudioLoading(true);
    setShowAudioPopup(true);

    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      const response = await fetch(src, { signal: controller.signal });
      if (!response.ok) {
        if (response.status === 503 && !useFallback) {
          setIsAudioLoading(false);
          setShowAudioPopup(false);
          setTtsErrorModal({ show: true, audioUrl, fallbackText, gender });
          return;
        }
        throw new Error("Failed to fetch audio");
      }
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      
      setAudioPopupSrc(blobUrl);
      setIsAudioLoading(false);

      // Play programmatically once audio is set to prevent duplicate audio playback
      setTimeout(() => {
        if (popupAudioRef.current) {
          popupAudioRef.current.play().catch(() => {});
        }
      }, 100);
    } catch (e: any) {
      if (e.name !== "AbortError") {
        console.error(e);
        setIsAudioLoading(false);
        setShowAudioPopup(false);
        if (!useFallback) {
          setTtsErrorModal({ show: true, audioUrl, fallbackText, gender });
        }
      }
    }
  };

  const handleCloseAudioPopup = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
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
    // 1. Multiple Choice Sub-Questions
    setMcSubQuestions([]);
    setEditingSubQId(null);
    setSubQText("");
    setSubQAudioSource("NONE");
    setSubQAudioText("");
    setSubQAudioGender("Female");
    setSubQAudioUrl("");
    setSubQOptA("");
    setSubQOptB("");
    setSubQOptC("");
    setSubQOptD("");
    setSubQCorrect("A");

    // 2. Fill in blanks
    setParenthesesRawText("");
    setOptionBankWords([]);
    setGapDistractorInputs({});

    // 3. Ordering
    setOrderingRawText("");
    setOrderingItems([]);

    // 4. Matching
    setMatchingPairs([]);
    setEditingPairId(null);
    setMatchLeft("");
    setMatchRight("");

    // 5. Flashcards
    setFlashcardsList([]);
    setEditingFcId(null);
    setFcImageUrl("");
    setFcVnName("");
    setFcEngWord("");
    setFcOptionsInput("");

    // 6. Short Answer
    setShortAnswersList([]);
    setEditingSaId(null);
    setSaQuestionText("");
    setSaMaxWords(50);

    // 7. Writing Essay
    setEssayPromptText("");

    // 8. Rewrite
    setRewriteSubQuestions([]);
    setEditingSrId(null);
    setSrOriginalSentence("");
    setSrCorrectAnswer("");

    // 9. Speaking Cue
    setSpeakingCuePrompt("");

    // 10. Read Aloud
    setReadAloudPassage("");
  };

  const handleSwitchSkill = (sk: SkillType) => {
    setSkillType(sk);
    resetCategoryStates();
    // Also reset shared stimulus states
    setStimulusText("");
    setQuestionPrompt("");
    setStimulusAudioText("");
    setStimulusAudioUrl("");
    setStimulusType("TEXT_ONLY");
    setStimulusAudioSource("TTS");
    setStimulusAudioGender("Female");
    setEditingQuestionId(null);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, setter: (val: string) => void) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const fileExt = file.name.split(".").pop() || "mp3";
      const fileName = `audio_${Date.now()}_${Math.random().toString(36).substring(2, 6)}.${fileExt}`;
      const { data, error } = await supabase.storage.from("audio-assets").upload(fileName, file, {
        cacheControl: "3600",
        upsert: true,
      });

      if (!error && data) {
        const { data: publicData } = supabase.storage.from("audio-assets").getPublicUrl(fileName);
        if (publicData?.publicUrl) {
          setter(publicData.publicUrl);
          return;
        }
      }
    } catch (err) {
      console.warn("Storage upload fallback to Base64:", err);
    }

    const reader = new FileReader();
    reader.onload = (evt) => {
      if (evt.target?.result) setter(evt.target.result as string);
    };
    reader.readAsDataURL(file);
  };

  // Parentheses Parser Helper
  const parseParentheses = (text: string) => {
    const regex = /\(([^)]+)\)/g;
    const answers: string[] = [];
    let match;
    while ((match = regex.exec(text)) !== null) {
      answers.push(match[1].trim());
    }
    const parsedText = text.replace(/\(([^)]+)\)/g, "______");
    return { parsedText, answers };
  };

  // ==========================================
  // SUB-ELEMENT BUILDER ACTIONS
  // ==========================================

  // MC Subquestions Add/Update/Delete/Edit
  const handleAddOrUpdateMcSubQ = () => {
    if (!subQText.trim()) return;

    let subAudioUrlFinal = subQAudioUrl;
    if (subQAudioSource === "TTS") {
      subAudioUrlFinal = getTtsHdUrl(subQAudioText || subQText, subQAudioGender);
    }

    const payload: SubQuestionMC = {
      id: editingSubQId || `sub_${Date.now()}`,
      subQuestionText: subQText.trim(),
      audioSource: subQAudioSource,
      audioText: subQAudioText.trim(),
      audioVoice: subQAudioGender,
      audioUrl: subQAudioSource !== "NONE" ? subAudioUrlFinal : undefined,
      optA: subQOptA.trim() || "Option A",
      optB: subQOptB.trim() || "Option B",
      optC: subQOptC.trim() || "Option C",
      optD: subQOptD.trim() || "Option D",
      correctAnswer: subQCorrect,
    };

    if (editingSubQId) {
      setMcSubQuestions(mcSubQuestions.map((q) => (q.id === editingSubQId ? payload : q)));
      setEditingSubQId(null);
    } else {
      setMcSubQuestions([...mcSubQuestions, payload]);
    }

    setSubQText("");
    setSubQAudioText("");
    setSubQAudioUrl("");
    setSubQAudioSource("NONE");
    setSubQOptA("");
    setSubQOptB("");
    setSubQOptC("");
    setSubQOptD("");
    setSubQCorrect("A");
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
    setSubQAudioGender(sub.audioVoice as "Female" | "Male" || "Female");
    setSubQAudioUrl(sub.audioUrl || "");
  };

  const handleDeleteMcSubQ = (id: string) => {
    setMcSubQuestions(mcSubQuestions.filter((q) => q.id !== id));
  };

  // Matching Pairs Add/Update/Delete/Edit
  const handleAddOrUpdateMatchingPair = () => {
    if (!matchLeft.trim() || !matchRight.trim()) return;
    const payload = {
      id: editingPairId || `mp_${Date.now()}`,
      left: matchLeft.trim(),
      right: matchRight.trim(),
    };

    if (editingPairId) {
      setMatchingPairs(matchingPairs.map((p) => (p.id === editingPairId ? payload : p)));
      setEditingPairId(null);
    } else {
      setMatchingPairs([...matchingPairs, payload]);
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

  // Flashcards Set Add/Update/Delete/Edit & Search
  const handleSearchFlashcards = async (query: string) => {
    setFcSearchQuery(query);
    if (!query.trim()) {
      setFcSearchResults([]);
      return;
    }
    setIsSearchingFc(true);
    try {
      const { data } = await supabase
        .from("flashcards")
        .select("*")
        .or(`vietnamese_name.ilike.%${query.trim()}%,correct_english_word.ilike.%${query.trim()}%`)
        .limit(12);

      // Exclude flashcards already added in current flashcardsList
      const existingIds = new Set(flashcardsList.map((fc) => fc.id));
      const existingEngWords = new Set(flashcardsList.map((fc) => (fc.correctEnglishWord || "").toLowerCase().trim()));

      const filtered = (data || []).filter((fcRow: any) => {
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

    setFcSearchResults(fcSearchResults.filter((f) => f.id !== fcRow.id));
  };

  const handleAddOrUpdateFlashcard = async () => {
    if (!fcVnName.trim() || !fcEngWord.trim()) return;
    const opts = fcOptionsInput.split(",").map((s) => s.trim()).filter(Boolean);
    const finalOpts = opts;

    const fcId = editingFcId || `fc_${Date.now()}`;
    const payload: FlashcardItem = {
      id: fcId,
      imageUrl: fcImageUrl,
      vietnameseName: fcVnName.trim(),
      englishOptions: finalOpts,
      correctEnglishWord: fcEngWord.trim(),
    };

    try {
      await supabase.from("flashcards").upsert({
        id: fcId,
        vietnamese_name: fcVnName.trim(),
        correct_english_word: fcEngWord.trim(),
        options: finalOpts,
        image_url: fcImageUrl,
      });
    } catch (err) {
      console.error("Supabase flashcard upsert error:", err);
    }

    if (editingFcId) {
      setFlashcardsList(flashcardsList.map((fc) => (fc.id === editingFcId ? payload : fc)));
      setEditingFcId(null);
    } else {
      setFlashcardsList([...flashcardsList, payload]);
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
    setFcOptionsInput(fc.englishOptions?.join(", ") || "");
  };

  const handleDeleteFlashcard = (id: string) => {
    setFlashcardsList(flashcardsList.filter((fc) => fc.id !== id));
  };

  // Writing Short Answers Add/Update/Delete/Edit
  const handleAddOrUpdateShortAnswer = () => {
    if (!saQuestionText.trim()) return;
    const payload = {
      id: editingSaId || `sa_${Date.now()}`,
      questionText: saQuestionText.trim(),
      maxWords: Number(saMaxWords) || 50,
    };

    if (editingSaId) {
      setShortAnswersList(shortAnswersList.map((s) => (s.id === editingSaId ? payload : s)));
      setEditingSaId(null);
    } else {
      setShortAnswersList([...shortAnswersList, payload]);
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
    setShortAnswersList(shortAnswersList.filter((s) => s.id !== id));
  };

  // Writing Sentence Rewrite Sub-Questions Handlers
  const handleAddOrUpdateSentenceRewrite = () => {
    if (!srOriginalSentence.trim() || !srCorrectAnswer.trim()) return;
    const payload = {
      id: editingSrId || `sr_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
      originalSentence: srOriginalSentence.trim(),
      correctAnswer: srCorrectAnswer.trim(),
    };

    if (editingSrId) {
      setRewriteSubQuestions(rewriteSubQuestions.map((s) => (s.id === editingSrId ? payload : s)));
      setEditingSrId(null);
    } else {
      setRewriteSubQuestions([...rewriteSubQuestions, payload]);
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
    setRewriteSubQuestions(rewriteSubQuestions.filter((s) => s.id !== id));
  };

  // ==========================================
  // DRAG & DROP EVENT HANDLERS
  // ==========================================
  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (dragOverIndex !== index) setDragOverIndex(index);
  };

  const handleDrop = (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === dropIndex) {
      setDraggedIndex(null);
      setDragOverIndex(null);
      return;
    }
    const updated = [...questionsList];
    const draggedItem = updated[draggedIndex];
    updated.splice(draggedIndex, 1);
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
    const temp = list[idx];
    list[idx] = list[idx - 1];
    list[idx - 1] = temp;
    setQuestionsList(list);
  };

  const handleMoveQuestionDown = (idx: number) => {
    if (idx >= questionsList.length - 1) return;
    const list = [...questionsList];
    const temp = list[idx];
    list[idx] = list[idx + 1];
    list[idx + 1] = temp;
    setQuestionsList(list);
  };

  const handleDeleteQuestion = (idx: number) => {
    setQuestionsList(questionsList.filter((_, i) => i !== idx));
  };

  // ==========================================
  // MAIN QUESTION ACTIONS (ADD & UPDATE & EDIT)
  // ==========================================
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

    let payload: any = {
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
        payload.questionTitle = "Đọc đoạn văn và chọn đáp án trắc nghiệm:";
        payload.sub_questions = formattedSubQuestions;
        payload.subQuestions = mcSubQuestions;
      } else if (readingCategory === "READING_FILL_IN") {
        const { gaps } = parseFillInGaps(parenthesesRawText);
        const option_banks = gaps.map((correctVal: string, idx: number) => {
          const distractorStr = gapDistractorInputs[idx] || "";
          const distractors = distractorStr
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean);
          const options = Array.from(new Set([correctVal, ...distractors]));
          return { gap_index: idx, options };
        });

        payload.questionTitle = fillInSubtype === "OPTION_BANK" 
          ? "Chọn từ trong ngân hàng từ chung điền chỗ trống:" 
          : "Chọn từ trong Dropdown Inline điền vào chỗ trống:";
        payload.passage = parenthesesRawText.trim();
        payload.correctAnswers = gaps;
        payload.fillInSubtype = fillInSubtype;
        payload.optionBank = fillInSubtype === "OPTION_BANK" ? optionBankWords : [];
        payload.option_banks = option_banks;
        payload.optionBanks = option_banks;
      } else if (readingCategory === "READING_ORDERING") {
        payload.questionTitle = orderingType === "SENTENCE_ORDERING" ? "Sắp xếp các câu thành đoạn văn:" : "Sắp xếp các từ thành câu:";
        payload.orderingType = orderingType;
        payload.items = orderingItems;
      } else if (readingCategory === "READING_MATCHING") {
        payload.questionTitle = matchingPrompt.trim();
        payload.pairs = matchingPairs;
      } else if (readingCategory === "READING_FLASHCARD_SET") {
        payload.questionTitle = flashcardSetPrompt.trim();
        payload.flashcards = flashcardsList;
        payload.content = flashcardsList.map((fc) => fc.id);
        payload.flashcard_ids = flashcardsList.map((fc) => fc.id);
      }
    } else if (skillType === "Listening") {
      payload.category = listeningCategory;
      if (listeningCategory === "LISTENING_MC") {
        payload.questionTitle = "Nghe đoạn âm thanh và trả lời các câu hỏi trắc nghiệm con:";
        payload.sub_questions = formattedSubQuestions;
        payload.subQuestions = mcSubQuestions;
      } else if (listeningCategory === "LISTENING_FILL_IN") {
        const { gaps } = parseFillInGaps(parenthesesRawText);
        const option_banks = gaps.map((correctVal: string, idx: number) => {
          const distractorStr = gapDistractorInputs[idx] || "";
          const distractors = distractorStr
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean);
          const options = Array.from(new Set([correctVal, ...distractors]));
          return { gap_index: idx, options };
        });

        payload.questionTitle = fillInSubtype === "OPTION_BANK" 
          ? "Nghe âm thanh và điền từ khuyết chọn từ ngân hàng chung:" 
          : "Nghe âm thanh và chọn đáp án khuyết bằng Select Box:";
        payload.passage = parenthesesRawText.trim();
        payload.correctAnswers = gaps;
        payload.fillInSubtype = fillInSubtype;
        payload.optionBank = fillInSubtype === "OPTION_BANK" ? optionBankWords : [];
        payload.option_banks = option_banks;
        payload.optionBanks = option_banks;
      } else if (listeningCategory === "LISTENING_ORDERING") {
        payload.questionTitle = "Sắp xếp thứ tự các câu nghe được:";
        payload.orderingType = "SENTENCE_ORDERING";
        payload.items = orderingItems;
      } else if (listeningCategory === "LISTENING_MATCHING") {
        payload.questionTitle = "Nghe âm thanh và nối các cặp từ chính xác:";
        payload.pairs = matchingPairs;
      }
    } else if (skillType === "Writing") {
      payload.category = writingCategory;
      if (writingCategory === "WRITING_ESSAY") {
        payload.questionTitle = "Bài Viết Tự Luận / Essay Prompt:";
        payload.prompt = essayPromptText.trim();
        payload.minWords = essayMinWords;
        payload.rubric = essayRubric;
      } else if (writingCategory === "WRITING_FREE_TYPING_BLANKS") {
        payload.questionTitle = "Tự gõ từ thích hợp điền vào chỗ trống:";
        payload.passage = parenthesesRawText.trim();
      } else if (writingCategory === "WRITING_FLASHCARD_SET") {
        payload.questionTitle = "Quan sát hình ảnh & nghĩa tiếng Việt tự gõ từ chính xác:";
        payload.flashcards = flashcardsList;
        payload.content = flashcardsList.map((fc) => fc.id);
        payload.flashcard_ids = flashcardsList.map((fc) => fc.id);
      } else if (writingCategory === "WRITING_SHORT_ANSWER") {
        payload.questionTitle = "Trả lời câu hỏi tự luận ngắn dựa trên ngữ cảnh bài viết:";
        const formattedShortAnswers = shortAnswersList.map((sa) => ({
          id: sa.id,
          text: sa.questionText,
          max_words: Number(sa.maxWords) || 50,
        }));
        payload.sub_questions = formattedShortAnswers;
        payload.subQuestions = shortAnswersList;
      } else if (writingCategory === "WRITING_SENTENCE_REWRITE") {
        payload.questionTitle = "Viết lại các câu sau giữ nguyên nghĩa:";
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
        payload.prepTimeSeconds = speakingPrepTime;
        payload.recordTimeSeconds = speakingRecordTime;
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

    // Extract existing flashcard items or fetch them on-demand by flashcard_ids
    let fcList: FlashcardItem[] = q.flashcardsList || q.flashcards || q.flashcards_resolved || [];
    const fcIds: string[] = q.flashcard_ids || q.flashcardIds || (q.content && (q.content.flashcard_ids || q.content.flashcardIds)) || [];

    if (fcList.length === 0 && fcIds.length > 0) {
      try {
        const { data: fcRows } = await supabase
          .from("flashcards")
          .select("*")
          .in("id", fcIds);

        if (fcRows) {
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
            ans = `[${oldCue.replace(/\.+$/, "").trim()}] ${ans.replace(new RegExp(`^${oldCue.replace(/\.+$/, "").trim()}\\s*`, 'i'), "")}`;
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

  const handleSaveTest = async () => {
    if (!testTitle.trim()) return;
    setIsSubmitting(true);

    try {
      // Sync form fields of active editing question if teacher directly clicks Save Test Header Button
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

      const testId = editId || `test_${Date.now().toString().slice(-4)}`;
      const skills = Array.from(new Set(currentQuestionsList.map((q) => q.skill)));
      const finalSkills = skills.length > 0 ? skills : [skillType];

      const readingQs = currentQuestionsList
        .filter((q) => q.skill === "Reading")
        .map((q, i) => ({
          id: `rq_${i + 1}`,
          type: q.category,
          question: q.questionTitle || "Reading Question",
          details: q,
        }));

      const listeningQs = currentQuestionsList
        .filter((q) => q.skill === "Listening")
        .map((q, i) => ({
          id: `lq_${i + 1}`,
          type: q.category,
          question: q.questionTitle || "Listening Question",
          details: q,
        }));

      const writingPrompt =
        currentQuestionsList.find((q) => q.skill === "Writing")?.prompt ||
        "Write an essay (at least 250 words) discussing whether study online is better than offline.";
      const speakingPrompt =
        currentQuestionsList.find((q) => q.skill === "Speaking")?.prompt ||
        "Describe an educational experience that inspired you.";

      // 1. Save individual questions & flashcards to Postgres pure entity tables
      const qIdsArray: string[] = [];
      for (let i = 0; i < currentQuestionsList.length; i++) {
        const q = currentQuestionsList[i];
        const qId = q.id || `q_${Date.now()}_${i}`;
        qIdsArray.push(qId);

        // Insert flashcards if question is a Flashcard Set
        const rawFcList: FlashcardItem[] = q.flashcardsList || q.flashcards || [];
        const flashcardIds: string[] = [];
        if (rawFcList.length > 0) {
          for (const fc of rawFcList) {
            const fcId = fc.id || `fc_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`;
            flashcardIds.push(fcId);
            await supabase.from("flashcards").upsert([
              {
                id: fcId,
                vietnamese_name: (fc as any).vietnameseName || (fc as any).vietnamese_name || "Nghĩa TV",
                correct_english_word: (fc as any).correctEnglishWord || (fc as any).correct_english_word || "English Word",
                options: (fc as any).englishOptions || (fc as any).options || [],
                image_url: (fc as any).imageUrl || (fc as any).image_url || "",
                audio_url: (fc as any).audioUrl || (fc as any).audio_url || "",
              },
            ]);
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

        // Prepare clean content JSONB formatted strictly per SYSTEM_ARCHITECTURE.md
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

        // Insert question entity into questions table
        const { error: qSaveErr } = await supabase.from("questions").upsert([
          {
            id: qId,
            skill: q.skill,
            category: q.category,
            prompt: q.prompt || q.customPrompt || q.questionTitle || "",
            stimulus_text: dbStimulusText,
            stimulus_audio_url: dbStimulusAudioUrl,
            content: standardizedContent,
          },
        ]);

        if (qSaveErr) {
          console.error("Error saving question to database:", qSaveErr);
          alert("Lỗi lưu câu hỏi vào Database: " + qSaveErr.message);
          setIsSubmitting(false);
          return;
        }

        // Emit Redis Streams event via Server API endpoint to bind question to exam in Neo4j Graph
        try {
          fetch("/api/events", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              streamKey: "stream:learning:exams",
              eventType: "QUESTION_BOUND",
              payload: {
                examId: testId,
                questionId: qId,
                orderIndex: i + 1,
                skill: q.skill,
                category: q.category,
              },
            }),
          }).catch((err) => console.warn("Event fetch error:", err));
        } catch (kErr) {
          console.warn("Event emit warning:", kErr);
        }
      }

      // 2. Save/Update Exam pure entity to Postgres
      const { error } = await supabase.from("exams").upsert([
        {
          id: testId,
          title: testTitle.trim(),
          duration_minutes: Number(duration) || 60,
          skills: finalSkills,
          question_ids: qIdsArray,
          scoring_rubric_id: selectedRubricId || null,
        },
      ]);

      if (error) {
        console.error("Save exam error:", error);
        alert("Lỗi lưu bộ đề thi: " + error.message);
        return;
      }

      // 3. Directly sync Course <-> Exam relationship in Neo4j Graph DB
      try {
        const { syncCourseExam, runCypherQuery } = await import("@/lib/neo4j");
        const course = INITIAL_COURSES.find((c) => c.id === selectedCourseId) || INITIAL_COURSES[0];

        // Clean existing course relationship for this exam
        await runCypherQuery(
          "MATCH (c:Course)-[r:HAS_EXAM]->(e:Exam {id: $examId}) DELETE r",
          { examId: testId }
        );

        // Bind exam to current selected course
        await syncCourseExam(course.id, course.title, testId, testTitle.trim());
      } catch (neoErr) {
        console.warn("Neo4j course sync warning:", neoErr);
      }

      // 4. Emit Redis Streams event for Exam creation & Course binding
      try {
        const course = INITIAL_COURSES.find((c) => c.id === selectedCourseId) || INITIAL_COURSES[0];
        fetch("/api/events", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            streamKey: "stream:learning:exams",
            eventType: "EXAM_CREATED",
            payload: {
              courseId: course.id,
              exam: {
                id: testId,
                title: testTitle.trim(),
                duration_minutes: Number(duration) || 60,
                skills: finalSkills,
              },
            },
          }),
        }).catch((err) => console.warn("Event fetch error:", err));
      } catch (kafkaErr) {
        console.warn("Event EXAM_CREATED emit warning:", kafkaErr);
      }

      setIsSubmitting(false);
      alert(editId ? "Đã cập nhật bộ đề thi & danh sách câu hỏi thành công!" : "Đã lưu bộ đề thi mới thành công!");
      router.push("/teacher/tests");
      setStimulusText("");
      setQuestionsList([]);
      setTimeout(() => setShowSavedMsg(false), 4000);
    } catch (e) {
      console.error(e);
    } finally {
      setIsSubmitting(false);
    }
  };

  const editingIndex = questionsList.findIndex((q) => q.id === editingQuestionId);
  const editingQuestionNumber = editingIndex !== -1 ? editingIndex + 1 : null;

  return (
    <TeacherLayout>
      <div className="max-w-[1280px] mx-auto space-y-8 font-sans text-[#211a16]">
        {/* Audio Player for HD Preview */}
        {audioPreviewSrc ? (
          <audio controls src={audioPreviewSrc} className="hidden" autoPlay onError={(e) => console.warn(e)} />
        ) : null}

        {/* Edit Mode Banner */}
        {editId && (
          <div className="p-4 rounded-2xl bg-amber-50 border border-amber-300 text-amber-900 flex items-center justify-between shadow-2xs">
            <div className="flex items-center space-x-2 text-xs font-bold">
              <Edit3 className="w-4 h-4 text-amber-700" />
              <span>Chế độ Chỉnh Sửa Bộ Đề: <strong className="text-[#6d3807]">{testTitle || editId}</strong> (ID: {editId})</span>
            </div>
            <Link
              href="/teacher/tests/create"
              className="text-xs font-bold text-amber-800 hover:underline bg-white px-3 py-1 rounded-lg border border-amber-200"
            >
              + Soạn Bộ Đề Mới Khác
            </Link>
          </div>
        )}

        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#d8c2b6]/40 pb-6">
          <div>
            <h1 className="font-headline text-3xl font-bold text-[#6d3807] tracking-tight">
              {editId ? "Chỉnh Sửa Bộ Đề Thi" : "Soạn Bộ Đề Thi Mới"}
            </h1>
            <p className="text-sm text-[#52443a] mt-1">
              Chỉnh sửa thông tin bộ đề, bài đọc/ngữ cảnh HTML phong phú, thêm/bớt và sửa trực tiếp từng câu hỏi trong đề.
            </p>
          </div>

          <button
            onClick={handleSaveTest}
            disabled={Boolean(isSubmitting || !testTitle.trim())}
            suppressHydrationWarning
            className="px-5 py-2.5 bg-[#6d3807] hover:bg-[#8a4f1e] text-white text-xs font-bold rounded-xl shadow transition-all flex items-center space-x-2 font-headline disabled:opacity-50 shrink-0 cursor-pointer"
          >
            {isSubmitting ? (
              <Loader2 className="w-4 h-4 animate-spin text-white" />
            ) : (
              <Save className="w-4 h-4 text-[#ffb782]" />
            )}
            <span>{editId ? "Cập Nhật Bộ Đề Thi" : "Lưu Bộ Đề Thi Mới"}</span>
          </button>
        </div>

        {showSavedMsg && (
          <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 flex items-center space-x-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-600" />
            <span className="text-xs font-bold">Đã lưu bộ đề thi mới thành công vào PostgreSQL Database!</span>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Main Question Authoring Form Pane */}
          <div className="lg:col-span-8 space-y-6">
            {/* Exam Metadata */}
            <div className="bg-[#ffffff] p-6 rounded-3xl border border-[#d8c2b6] shadow-sm space-y-4">
              <h2 className="text-base font-bold text-[#6d3807]">Thông Tin Tổng Quan Đề Thi</h2>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="md:col-span-2">
                  <label className="block text-xs font-bold uppercase text-[#211a16] mb-1">
                    Tên Đề Thi / Bài Tập (*)
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ví dụ: IELTS Vocabulary &amp; Grammar Mastery #05"
                    value={testTitle}
                    onChange={(e) => setTestTitle(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-[#fff8f5] border border-[#d8c2b6] rounded-xl text-sm focus:outline-none focus:border-[#6d3807]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase text-[#211a16] mb-1">
                    Khóa Học / Category (*)
                  </label>
                  <select
                    value={selectedCourseId}
                    onChange={(e) => setSelectedCourseId(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-[#fff8f5] border border-[#d8c2b6] rounded-xl text-sm focus:outline-none focus:border-[#6d3807] font-medium text-[#6d3807]"
                  >
                    {INITIAL_COURSES.map((course) => (
                      <option key={course.id} value={course.id}>
                        {course.title}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase text-[#211a16] mb-1">
                    Thời Gian (Phút)
                  </label>
                  <input
                    type="number"
                    value={duration}
                    onChange={(e) => setDuration(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-[#fff8f5] border border-[#d8c2b6] rounded-xl text-sm focus:outline-none focus:border-[#6d3807]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-[#211a16] mb-1">
                  Mô Tả / Hướng Dẫn Tổng Quan Bài Thi
                </label>
                <textarea
                  rows={2}
                  placeholder="Nhập mô tả hoặc hướng dẫn tổng quan bài thi..."
                  value={testDescription}
                  onChange={(e) => setTestDescription(e.target.value)}
                  className="w-full p-3.5 bg-[#fff8f5] border border-[#d8c2b6] rounded-xl text-xs focus:outline-none focus:border-[#6d3807]"
                />
              </div>
            </div>

            {/* Question Authoring Widget */}
            <div className={`bg-[#ffffff] p-6 rounded-3xl border transition-all space-y-5 ${editingQuestionNumber ? "border-[#6d3807] ring-2 ring-[#ffb782]/40 shadow-md" : "border-[#d8c2b6] shadow-sm"}`}>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#d8c2b6]/40 pb-4">
                <div className="flex items-center space-x-2">
                  <h2 className="text-base font-bold text-[#6d3807] flex items-center space-x-2">
                    <Layers className="w-5 h-5 text-[#6d3807]" />
                    <span>{editingQuestionNumber ? `✏️ Đang Chỉnh Sửa Câu Hỏi Số ${editingQuestionNumber}` : "Biên Soạn Câu Hỏi Mới"}</span>
                  </h2>
                </div>

                <div className="flex bg-[#fff8f5] p-1 rounded-xl border border-[#d8c2b6]">
                  {(["Reading", "Listening", "Writing", "Speaking"] as const).map((sk) => (
                    <button
                      key={sk}
                      type="button"
                      onClick={() => handleSwitchSkill(sk)}
                      className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center space-x-1 ${
                        skillType === sk ? "bg-[#6d3807] text-white shadow-sm" : "text-[#52443a] hover:text-[#6d3807]"
                      }`}
                    >
                      <span>{sk}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* 1. Parent Stimulus Header Builder (with dynamic Google voice select box) */}
              <div className="p-4 rounded-2xl bg-[#fff1ea]/60 border border-[#ffb782] space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-[#6d3807] uppercase flex items-center space-x-1.5">
                    <Sparkles className="w-4 h-4 text-[#6d3807]" />
                    <span>Phần Ngữ Cảnh Bài Tập</span>
                  </span>
                  <select
                    value={stimulusType}
                    onChange={(e: any) => setStimulusType(e.target.value)}
                    className="px-2.5 py-1 bg-white border border-[#d8c2b6] rounded-lg text-xs font-bold text-[#6d3807]"
                  >
                    <option value="TEXT_ONLY">Văn bản (Text Only)</option>
                    <option value="AUDIO_ONLY">Âm thanh (Audio Only)</option>
                    <option value="COMBINED">Kết hợp (Text + Audio)</option>
                  </select>
                </div>

                {/* Question Prompt (Short Instruction Title) */}
                <div>
                  <label className="block text-[12px] font-bold text-[#6d3807] mb-1">
                    Chỉ Dẫn / Hướng Dẫn Bài Tập
                  </label>
                  <input
                    type="text"
                    placeholder="Ví dụ: Đọc đoạn văn sau và hoàn thành các câu hỏi trắc nghiệm..."
                    value={questionPrompt}
                    onChange={(e) => setQuestionPrompt(e.target.value)}
                    className="w-full px-3.5 py-2 bg-white border border-[#d8c2b6] rounded-xl text-xs font-bold text-[#6d3807] focus:outline-none focus:border-[#6d3807] shadow-2xs"
                  />
                </div>

                {(stimulusType === "TEXT_ONLY" || stimulusType === "COMBINED") && (
                  <div className="space-y-2 pt-1 border-t border-[#ffb782]/40">
                    <label className="block text-[12px] font-bold text-[#6d3807]">
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
                  <div className="space-y-2 pt-1 border-t border-[#ffb782]/40 text-xs">
                    <div className="flex items-center justify-between font-bold text-[#6d3807]">
                      <span>Âm Thanh Ngữ Cảnh</span>
                      <div className="flex space-x-2">
                        <label className="flex items-center space-x-1 cursor-pointer">
                          <input
                            type="radio"
                            checked={stimulusAudioSource === "UPLOAD"}
                            onChange={() => setStimulusAudioSource("UPLOAD")}
                            className="accent-[#6d3807]"
                          />
                          <span>Upload File / Link URL</span>
                        </label>
                        <label className="flex items-center space-x-1 cursor-pointer">
                          <input
                            type="radio"
                            checked={stimulusAudioSource === "TTS"}
                            onChange={() => setStimulusAudioSource("TTS")}
                            className="accent-[#6d3807]"
                          />
                          <span>Giọng đọc AI</span>
                        </label>
                      </div>
                    </div>

                    {stimulusAudioSource === "UPLOAD" ? (
                      <div className="space-y-2">
                        <input
                          type="text"
                          placeholder="Dán link URL âm thanh (.mp3, .wav) hoặc link Video YouTube (Ví dụ: https://www.youtube.com/watch?v=...)..."
                          value={stimulusAudioUrl}
                          onChange={(e) => setStimulusAudioUrl(e.target.value)}
                          className="w-full px-3.5 py-2 bg-white border border-[#d8c2b6] rounded-xl text-xs font-mono text-[#6d3807] focus:outline-none focus:border-[#6d3807] shadow-2xs"
                        />
                        <div className="flex items-center space-x-2">
                          <span className="text-[11px] text-[#857469]">Hoặc upload file trực tiếp:</span>
                          <input
                            type="file"
                            accept="audio/*"
                            onChange={(e) => handleFileUpload(e, setStimulusAudioUrl)}
                            className="text-xs text-[#52443a]"
                          />
                        </div>

                        {/* Live Media Preview (YouTube vs Audio) */}
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
                              <div className="p-2.5 bg-white border border-[#d8c2b6] rounded-xl flex items-center justify-between shadow-2xs">
                                <span className="text-[11px] font-bold text-[#6d3807]">🎵 Preview File Âm Thanh</span>
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
                          <span className="text-[11px] font-bold text-[#52443a]">Chọn giọng đọc AI:</span>
                          <select
                            value={stimulusAudioGender}
                            onChange={(e: any) => setStimulusAudioGender(e.target.value)}
                            className="px-2 py-1 bg-white border border-[#d8c2b6] rounded-lg text-xs text-[#6d3807] font-bold"
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
                          className="w-full p-2.5 bg-white border border-[#d8c2b6] rounded-xl text-xs focus:outline-none"
                        />

                        {/* Single Live Audio Player Preview for TTS */}
                        {stimulusAudioText.trim() && (
                          <div className="p-2.5 bg-white border border-[#d8c2b6] rounded-xl flex items-center justify-between shadow-2xs">
                            <span className="text-[11px] font-bold text-[#6d3807] flex items-center gap-1">
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

              {/* 2. Sub-Category Forms per Skill */}
              <div className="space-y-4">
                {/* ==================================================== */}
                {/* READING SKILL */}
                {/* ==================================================== */}
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
                              ? "bg-[#fff1ea] border-[#ffb782] text-[#6d3807]"
                              : "bg-[#fff8f5] border-[#d8c2b6] text-[#52443a]"
                          }`}
                        >
                          {c.label}
                        </button>
                      ))}
                    </div>

                    {/* Reading MC Form */}
                    {readingCategory === "READING_MC" && (
                      <div className="space-y-3 p-4 rounded-2xl bg-[#fff8f5] border border-[#d8c2b6]">
                        <span className="text-xs font-bold text-[#6d3807] block">Câu Hỏi Trắc Nghiệm Con ({mcSubQuestions.length})</span>
                        <div className="space-y-2">
                          {mcSubQuestions.map((sub, idx) => (
                            <div key={sub.id} className="p-3 bg-white rounded-xl border border-[#d8c2b6] text-xs flex justify-between items-center">
                              <div>
                                <span className="font-bold text-[#6d3807]">Câu {idx + 1}: {sub.subQuestionText}</span>
                                <div className="text-[11px] text-[#52443a] mt-0.5">Đáp án đúng: <strong>{sub.correctAnswer}</strong></div>
                              </div>
                              <div className="flex space-x-2">
                                <button type="button" onClick={() => handleEditMcSubQ(sub)} className="p-1 text-[#6d3807] hover:bg-[#fff1ea] rounded"><Edit2 className="w-4 h-4" /></button>
                                <button type="button" onClick={() => handleDeleteMcSubQ(sub.id)} className="p-1 text-rose-600 hover:bg-rose-50 rounded"><Trash2 className="w-4 h-4" /></button>
                              </div>
                            </div>
                          ))}
                        </div>

                        <div className="pt-2 border-t border-[#d8c2b6] space-y-2">
                          <input type="text" placeholder="Nội dung câu hỏi con..." value={subQText} onChange={(e) => setSubQText(e.target.value)} className="w-full px-3 py-2 bg-white border border-[#d8c2b6] rounded-xl text-xs" />
                          <div className="grid grid-cols-2 gap-2">
                            <input type="text" placeholder="A" value={subQOptA} onChange={(e) => setSubQOptA(e.target.value)} className="px-3 py-1.5 bg-white border border-[#d8c2b6] rounded-lg text-xs" />
                            <input type="text" placeholder="B" value={subQOptB} onChange={(e) => setSubQOptB(e.target.value)} className="px-3 py-1.5 bg-white border border-[#d8c2b6] rounded-lg text-xs" />
                            <input type="text" placeholder="C" value={subQOptC} onChange={(e) => setSubQOptC(e.target.value)} className="px-3 py-1.5 bg-white border border-[#d8c2b6] rounded-lg text-xs" />
                            <input type="text" placeholder="D" value={subQOptD} onChange={(e) => setSubQOptD(e.target.value)} className="px-3 py-1.5 bg-white border border-[#d8c2b6] rounded-lg text-xs" />
                          </div>
                          <div>
                            <label className="block text-[11px] font-bold text-[#211a16] mb-1">Đáp Án Đúng:</label>
                            <select value={subQCorrect} onChange={(e: any) => setSubQCorrect(e.target.value)} className="px-3 py-1.5 bg-white border border-[#d8c2b6] rounded-lg text-xs font-bold text-emerald-800">
                              <option value="A">Lựa chọn A</option>
                              <option value="B">Lựa chọn B</option>
                              <option value="C">Lựa chọn C</option>
                              <option value="D">Lựa chọn D</option>
                            </select>
                          </div>
                          <button type="button" onClick={handleAddOrUpdateMcSubQ} className="w-full py-2.5 bg-[#6d3807] text-white rounded-xl text-xs font-bold flex items-center justify-center space-x-1.5">
                            <Plus className="w-4 h-4 text-[#ffb782]" />
                            <span>{editingSubQId ? "Cập Nhật Câu Hỏi Con" : "Thêm Câu Hỏi Con"}</span>
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Reading Merged Fill-in Category */}
                    {readingCategory === "READING_FILL_IN" && (
                      <div className="space-y-4">
                        <div className="flex space-x-4 p-2 bg-[#fff8f5] rounded-xl border border-[#d8c2b6] text-xs font-bold">
                          <label className="flex items-center space-x-1.5 cursor-pointer">
                            <input type="radio" checked={fillInSubtype === "OPTION_BANK"} onChange={() => setFillInSubtype("OPTION_BANK")} className="accent-[#6d3807]" />
                            <span>Ngân hàng từ chung (Option Bank)</span>
                          </label>
                          <label className="flex items-center space-x-1.5 cursor-pointer">
                            <input type="radio" checked={fillInSubtype === "INLINE_SELECT"} onChange={() => setFillInSubtype("INLINE_SELECT")} className="accent-[#6d3807]" />
                            <span>Dropdown riêng từng ô (Inline Select)</span>
                          </label>
                        </div>

                        <div>
                          <label className="block text-xs font-bold uppercase text-[#6d3807] mb-1">
                            Soạn Đoạn Văn Chứa Đáp Án Trong Ngoặc Vuông <code>[đáp_án_đúng]</code>
                          </label>
                          <textarea
                            rows={3}
                            value={parenthesesRawText}
                            onChange={(e) => setParenthesesRawText(e.target.value)}
                            placeholder="Ví dụ: Artificial Intelligence is [slowly] transforming... Students learn [flexibly]."
                            className="w-full p-3.5 bg-[#fff8f5] border border-[#d8c2b6] rounded-xl text-xs font-bold text-[#6d3807]"
                          />
                        </div>

                        {fillInSubtype === "OPTION_BANK" ? (
                          <div>
                            <label className="block text-xs font-bold uppercase text-[#211a16] mb-1">
                              Ngân Hàng Từ Dùng Chung (Phân cách bằng dấu phẩy)
                            </label>
                            <input
                              type="text"
                              value={optionBankWords.join(", ")}
                              onChange={(e) => setOptionBankWords(e.target.value.split(",").map((s) => s.trim()).filter(Boolean))}
                              className="w-full px-3 py-2 bg-[#fff8f5] border border-[#d8c2b6] rounded-xl text-xs font-medium"
                            />
                          </div>
                        ) : (
                          <div className="p-3.5 rounded-2xl bg-[#fff8f5] border border-[#d8c2b6] space-y-3">
                            <div className="flex justify-between items-center border-b border-[#d8c2b6]/40 pb-2">
                              <span className="text-xs font-bold text-[#6d3807]">
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
                                  <div key={idx} className="p-3 bg-white rounded-xl border border-[#d8c2b6] space-y-2 text-xs">
                                    <div className="flex items-center justify-between">
                                      <span className="font-bold text-[#6d3807]">
                                        📍 Vị trí chỗ trống #{idx + 1}
                                      </span>
                                      <span className="px-2.5 py-0.5 bg-emerald-100 text-emerald-900 border border-emerald-300 rounded-lg font-bold text-[11px]">
                                        Đáp án đúng (Cố định): "{correctVal}"
                                      </span>
                                    </div>
                                    <div className="flex items-center space-x-2">
                                      <span className="px-3 py-2 bg-[#fff1ea] text-[#6d3807] font-bold text-xs border border-[#ffb782] rounded-xl shrink-0 select-none">
                                        ✓ {correctVal}
                                      </span>
                                      <input
                                        type="text"
                                        placeholder="Nhập các từ gây nhiễu bổ sung (Phân cách bằng dấu phẩy, VD: rapidly, rarely, rigidly)..."
                                        value={gapDistractorInputs[idx] || ""}
                                        onChange={(e) => setGapDistractorInputs({ ...gapDistractorInputs, [idx]: e.target.value })}
                                        className="w-full px-3 py-2 bg-white border border-[#d8c2b6] rounded-xl text-xs focus:outline-none focus:border-[#6d3807]"
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

                    {/* Reading Ordering */}
                    {readingCategory === "READING_ORDERING" && (
                      <div className="space-y-3">
                        <select value={orderingType} onChange={(e: any) => setOrderingType(e.target.value)} className="w-full px-3 py-2 bg-[#fff1ea] border border-[#ffb782] rounded-xl text-xs font-bold text-[#6d3807]">
                          <option value="SENTENCE_ORDERING">Sắp xếp CÂU (Tách theo dấu chấm .)</option>
                          <option value="WORD_ORDERING">Sắp xếp TỪ (Tách theo khoảng trắng Space)</option>
                        </select>
                        <textarea rows={3} value={orderingRawText} onChange={(e) => setOrderingRawText(e.target.value)} className="w-full p-3 bg-[#fff8f5] border border-[#d8c2b6] rounded-xl text-xs" />
                        
                        {/* Instant Split Preview */}
                        <div className="p-3.5 rounded-2xl bg-[#fff1ea]/60 border border-[#ffb782]/60 space-y-1.5">
                          <span className="text-[11px] font-bold text-[#6d3807] uppercase block">Kết Quả Tách Câu/Từ Preview:</span>
                          <div className="flex flex-wrap gap-1.5">
                            {orderingItems.map((item, i) => (
                              <span key={i} className="px-2.5 py-1 bg-white border border-[#d8c2b6] rounded-lg text-xs text-[#211a16] font-medium shadow-sm">
                                #{i+1}: {item}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Reading Matching Pairs */}
                    {readingCategory === "READING_MATCHING" && (
                      <div className="space-y-3 p-4 rounded-2xl bg-[#fff8f5] border border-[#d8c2b6]">
                        <span className="text-xs font-bold text-[#6d3807] block">Cặp Từ Đã Nhập ({matchingPairs.length})</span>
                        <div className="space-y-2">
                          {matchingPairs.map((pair) => (
                            <div key={pair.id} className="flex items-center justify-between p-2.5 rounded-xl border border-[#ffb782] bg-white text-xs">
                              <span className="font-bold text-[#211a16]">{pair.left} ↔ {pair.right}</span>
                              <div className="flex space-x-2">
                                <button type="button" onClick={() => handleEditMatchingPair(pair)} className="text-[#6d3807]"><Edit2 className="w-3.5 h-3.5" /></button>
                                <button type="button" onClick={() => handleDeleteMatchingPair(pair.id)} className="text-rose-600"><Trash2 className="w-3.5 h-3.5" /></button>
                              </div>
                            </div>
                          ))}
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <input type="text" placeholder="Cột A" value={matchLeft} onChange={(e) => setMatchLeft(e.target.value)} className="px-3 py-1.5 bg-white border border-[#d8c2b6] rounded-lg text-xs" />
                          <input type="text" placeholder="Cột B" value={matchRight} onChange={(e) => setMatchRight(e.target.value)} className="px-3 py-1.5 bg-white border border-[#d8c2b6] rounded-lg text-xs" />
                        </div>
                        <button type="button" onClick={handleAddOrUpdateMatchingPair} className="w-full py-2 bg-[#6d3807] text-white rounded-xl text-xs font-bold">
                          {editingPairId ? "Cập Nhật Cặp Nối" : "Thêm Cặp Nối"}
                        </button>
                      </div>
                    )}

                    {/* Reading Flashcard Set */}
                    {readingCategory === "READING_FLASHCARD_SET" && (
                      <div className="space-y-3 p-4 rounded-2xl bg-[#fff8f5] border border-[#d8c2b6]">
                        <span className="text-xs font-bold text-[#6d3807] block">Tập Hợp Flashcards ({flashcardsList.length})</span>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                          {flashcardsList.map((fc) => (
                            <div key={fc.id} className="p-3 bg-white rounded-2xl border border-[#d8c2b6] text-xs flex flex-col space-y-2 relative">
                              {fc.imageUrl && (
                                <div className="w-full h-28 rounded-xl overflow-hidden border border-[#d8c2b6]/60 relative">
                                  <img src={fc.imageUrl} alt={fc.vietnameseName} className="w-full h-full object-cover" />
                                </div>
                              )}
                              <div className="flex-1 space-y-1">
                                <span className="font-bold text-[#211a16] block">{fc.vietnameseName}</span>
                                <span className="text-[10px] text-emerald-800 font-bold block">Từ TA đúng: {fc.correctEnglishWord}</span>
                              </div>
                              <div className="flex justify-end space-x-1.5 pt-1.5 border-t border-[#d8c2b6]/40">
                                <button type="button" onClick={() => handleEditFlashcard(fc)} className="p-1.5 rounded-lg bg-gray-50 border border-[#d8c2b6] text-[#6d3807] hover:bg-[#fff1ea]"><Edit2 className="w-3.5 h-3.5" /></button>
                                <button type="button" onClick={() => handleDeleteFlashcard(fc.id)} className="p-1.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-600 hover:bg-rose-100"><Trash2 className="w-3.5 h-3.5" /></button>
                              </div>
                            </div>
                          ))}
                        </div>

                        {/* Search Existing Flashcards in Database */}
                        <div className="p-3 bg-white rounded-xl border border-[#d8c2b6] space-y-2">
                          <span className="font-bold text-[#6d3807] block text-[11px]">🔍 Tìm Kiếm Flashcard Đã Có Trong Database:</span>
                          <input
                            type="text"
                            placeholder="Gõ từ tiếng Anh hoặc tiếng Việt để tìm flashcard đã tạo..."
                            value={fcSearchQuery}
                            onChange={(e) => handleSearchFlashcards(e.target.value)}
                            className="w-full px-3 py-1.5 bg-[#fff8f5] border border-[#d8c2b6] rounded-lg text-xs font-medium focus:outline-none focus:border-[#6d3807]"
                          />
                          {isSearchingFc && <p className="text-[10px] text-[#857469]">Đang tìm kiếm...</p>}
                          {fcSearchResults.length > 0 && (
                            <div className="flex flex-wrap gap-1.5 pt-1">
                              {fcSearchResults.map((fc) => (
                                <button
                                  key={fc.id}
                                  type="button"
                                  onClick={() => handleSelectExistingFc(fc)}
                                  className="px-2.5 py-1 bg-[#fff1ea] border border-[#ffb782] rounded-lg text-xs font-bold text-[#6d3807] hover:bg-[#6d3807] hover:text-white transition-all flex items-center space-x-1"
                                >
                                  <span>+ {fc.vietnamese_name} ({fc.correct_english_word})</span>
                                </button>
                              ))}
                            </div>
                          )}
                        </div>

                        <div className="pt-2 border-t border-[#d8c2b6] space-y-2 text-xs">
                          <span className="font-bold text-[#6d3807] block">Tạo Mới Flashcard (Tự động lưu vào Bảng flashcards):</span>
                          {fcImageUrl && (
                            <div className="w-24 h-24 rounded-xl border border-[#d8c2b6] overflow-hidden bg-black/5">
                              <img src={fcImageUrl} alt="Flashcard preview" className="w-full h-full object-cover" />
                            </div>
                          )}
                          <input type="text" placeholder="URL Ảnh minh họa..." value={fcImageUrl} onChange={(e) => setFcImageUrl(e.target.value)} className="w-full px-3 py-1.5 bg-white border border-[#d8c2b6] rounded-lg text-xs" />
                          <div className="grid grid-cols-2 gap-2">
                            <input type="text" placeholder="Nghĩa TV" value={fcVnName} onChange={(e) => setFcVnName(e.target.value)} className="px-3 py-1.5 bg-white border border-[#d8c2b6] rounded-lg text-xs" />
                            <input type="text" placeholder="Từ TA đúng" value={fcEngWord} onChange={(e) => setFcEngWord(e.target.value)} className="px-3 py-1.5 bg-white border border-[#d8c2b6] rounded-lg text-xs" />
                          </div>
                          <input type="text" placeholder="Các lựa chọn trắc nghiệm (phân cách bằng dấu phẩy, để trống nếu dạng điền)..." value={fcOptionsInput} onChange={(e) => setFcOptionsInput(e.target.value)} className="w-full px-3 py-1.5 bg-white border border-[#d8c2b6] rounded-lg text-xs" />
                          <button type="button" onClick={handleAddOrUpdateFlashcard} className="w-full py-2 bg-[#6d3807] text-white rounded-xl text-xs font-bold">
                            {editingFcId ? "Cập Nhật Card" : "Lưu Flashcard Mới Vào Database & Thêm Vào Đề"}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* ==================================================== */}
                {/* LISTENING SKILL */}
                {/* ==================================================== */}
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
                              ? "bg-[#fff1ea] border-[#ffb782] text-[#6d3807]"
                              : "bg-[#fff8f5] border-[#d8c2b6] text-[#52443a]"
                          }`}
                        >
                          {c.label}
                        </button>
                      ))}
                    </div>

                    {/* Listening MC Form */}
                    {listeningCategory === "LISTENING_MC" && (
                      <div className="space-y-3 p-4 rounded-2xl bg-[#fff8f5] border border-[#d8c2b6]">
                        <span className="text-xs font-bold text-[#6d3807] block">Danh Sách Câu Hỏi Trắc Nghiệm Audio Con ({mcSubQuestions.length})</span>
                        <div className="space-y-2">
                          {mcSubQuestions.map((sub, idx) => {
                            const isThisSubQ = subQAudioState.playingSubQId === sub.id;
                            const isLoadingThis = isThisSubQ && subQAudioState.status === "LOADING";
                            const isPlayingThis = isThisSubQ && subQAudioState.status === "PLAYING";

                            return (
                              <div key={sub.id} className="p-3 bg-white rounded-xl border border-[#d8c2b6] text-xs flex justify-between items-center">
                                <div>
                                  <span className="font-bold text-[#211a16]">Câu {idx + 1}: {sub.subQuestionText}</span>
                                  
                                  {/* Direct Inline Audio Preview Button (No Popup Modal) */}
                                  <div className="pt-1.5">
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleToggleSubQAudioInline(sub);
                                      }}
                                      className="text-[11px] text-[#6d3807] font-bold border border-[#d8c2b6] bg-[#fff1ea] hover:bg-[#ffb783] px-2.5 py-1 rounded-lg flex items-center space-x-1.5 transition-all shadow-2xs cursor-pointer"
                                    >
                                      {isLoadingThis ? (
                                        <>
                                          <Loader2 className="w-3.5 h-3.5 text-[#6d3807] animate-spin" />
                                          <span>Đang nạp audio...</span>
                                        </>
                                      ) : isPlayingThis ? (
                                        <>
                                          <Volume2 className="w-3.5 h-3.5 text-[#6d3807] animate-bounce" />
                                          <span>Đang phát bài nghe...</span>
                                        </>
                                      ) : (
                                        <>
                                          <Volume2 className="w-3.5 h-3.5 text-[#6d3807]" />
                                          <span>Nghe âm thanh</span>
                                        </>
                                      )}
                                    </button>
                                  </div>
                                </div>
                                <div className="flex space-x-2">
                                  <button type="button" onClick={() => handleEditMcSubQ(sub)} className="text-[#6d3807]"><Edit2 className="w-3.5 h-3.5" /></button>
                                  <button type="button" onClick={() => handleDeleteMcSubQ(sub.id)} className="text-rose-600"><Trash2 className="w-3.5 h-3.5" /></button>
                                </div>
                              </div>
                            );
                          })}
                        </div>

                        <div className="pt-2 border-t border-[#d8c2b6] space-y-2">
                          <input type="text" placeholder="Câu hỏi trắc nghiệm con..." value={subQText} onChange={(e) => setSubQText(e.target.value)} className="w-full px-3 py-2 bg-white border border-[#d8c2b6] rounded-xl text-xs" />
                          
                          {/* Audio config with voice accents for sub-question */}
                          <div className="p-2.5 rounded-xl bg-white border border-[#d8c2b6] space-y-2 text-xs">
                            <span className="font-bold text-[#6d3807] block">Âm thanh cho câu hỏi con này (Tùy chọn)</span>
                            <div className="flex space-x-3">
                              <label className="flex items-center space-x-1.5">
                                <input type="radio" checked={subQAudioSource === "NONE"} onChange={() => setSubQAudioSource("NONE")} className="accent-[#6d3807]" />
                                <span>Không dùng</span>
                              </label>
                              <label className="flex items-center space-x-1.5">
                                <input type="radio" checked={subQAudioSource === "TTS"} onChange={() => setSubQAudioSource("TTS")} className="accent-[#6d3807]" />
                                <span>Giọng đọc AI</span>
                              </label>
                            </div>
                            {subQAudioSource === "TTS" && (
                              <div className="space-y-1.5">
                                <div className="flex items-center space-x-2">
                                  <span className="text-[11px] font-bold text-[#52443a]">Chọn giọng đọc AI:</span>
                                  <select value={subQAudioGender} onChange={(e: any) => setSubQAudioGender(e.target.value)} className="px-2 py-0.5 bg-white border border-[#d8c2b6] rounded text-xs text-[#6d3807] font-bold">
                                    <option value="Female">♀ Giọng Nữ</option>
                                    <option value="Male">♂ Giọng Nam</option>
                                  </select>
                                </div>
                                <div className="flex space-x-2">
                                  <input type="text" placeholder="Văn bản AI đọc..." value={subQAudioText} onChange={(e) => setSubQAudioText(e.target.value)} className="flex-1 px-3 py-1.5 bg-gray-50 border border-[#d8c2b6] rounded-lg text-xs" />
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleToggleSubQAudioInline(null, subQAudioText || subQText, subQAudioGender);
                                    }}
                                    className="px-2.5 py-1 bg-[#6d3807] text-white rounded-lg text-xs font-bold flex items-center space-x-1 shrink-0 cursor-pointer"
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
                                <span className="text-[10px] text-[#52443a] block">Tải file âm thanh lên cho câu hỏi con:</span>
                                <input type="file" accept="audio/*" onChange={(e) => handleFileUpload(e, setSubQAudioUrl)} className="text-xs text-[#52443a]" />
                              </div>
                            )}
                          </div>

                          <div className="grid grid-cols-2 gap-2">
                            <input type="text" placeholder="A" value={subQOptA} onChange={(e) => setSubQOptA(e.target.value)} className="px-3 py-1.5 bg-white border border-[#d8c2b6] rounded-lg text-xs" />
                            <input type="text" placeholder="B" value={subQOptB} onChange={(e) => setSubQOptB(e.target.value)} className="px-3 py-1.5 bg-white border border-[#d8c2b6] rounded-lg text-xs" />
                            <input type="text" placeholder="C" value={subQOptC} onChange={(e) => setSubQOptC(e.target.value)} className="px-3 py-1.5 bg-white border border-[#d8c2b6] rounded-lg text-xs" />
                            <input type="text" placeholder="D" value={subQOptD} onChange={(e) => setSubQOptD(e.target.value)} className="px-3 py-1.5 bg-white border border-[#d8c2b6] rounded-lg text-xs" />
                          </div>

                          <button type="button" onClick={handleAddOrUpdateMcSubQ} className="w-full py-2 bg-[#6d3807] text-white rounded-xl text-xs font-bold">
                            {editingSubQId ? "Cập Nhật Câu Con" : "Thêm Câu Con"}
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Listening Merged Fill-in Category */}
                    {listeningCategory === "LISTENING_FILL_IN" && (
                      <div className="space-y-4 font-sans">
                        <div className="flex space-x-4 p-2 bg-[#fff8f5] rounded-xl border border-[#d8c2b6] text-xs font-bold">
                          <label className="flex items-center space-x-1.5 cursor-pointer">
                            <input type="radio" checked={fillInSubtype === "OPTION_BANK"} onChange={() => setFillInSubtype("OPTION_BANK")} className="accent-[#6d3807]" />
                            <span>Ngân hàng từ chung (Option Bank)</span>
                          </label>
                          <label className="flex items-center space-x-1.5 cursor-pointer">
                            <input type="radio" checked={fillInSubtype === "INLINE_SELECT"} onChange={() => setFillInSubtype("INLINE_SELECT")} className="accent-[#6d3807]" />
                            <span>Dropdown riêng từng ô (Inline Select)</span>
                          </label>
                        </div>

                        <div>
                          <label className="block text-xs font-bold uppercase text-[#6d3807] mb-1">
                            Soạn Đoạn Văn Chứa Đáp Án Trong Ngoặc Vuông <code>[đáp_án_đúng]</code>
                          </label>
                          <textarea
                            rows={3}
                            value={parenthesesRawText}
                            onChange={(e) => setParenthesesRawText(e.target.value)}
                            placeholder="Ví dụ: Artificial Intelligence is [slowly] transforming... Students learn [flexibly]."
                            className="w-full p-3.5 bg-[#fff8f5] border border-[#d8c2b6] rounded-xl text-xs font-bold text-[#6d3807]"
                          />
                        </div>

                        {fillInSubtype === "OPTION_BANK" ? (
                          <div>
                            <label className="block text-xs font-bold uppercase text-[#211a16] mb-1">
                              Ngân Hàng Từ Dùng Chung (Phân cách bằng dấu phẩy)
                            </label>
                            <input
                              type="text"
                              value={optionBankWords.join(", ")}
                              onChange={(e) => setOptionBankWords(e.target.value.split(",").map((s) => s.trim()).filter(Boolean))}
                              className="w-full px-3 py-2 bg-[#fff8f5] border border-[#d8c2b6] rounded-xl text-xs font-medium"
                            />
                          </div>
                        ) : (
                          <div className="p-3.5 rounded-2xl bg-[#fff8f5] border border-[#d8c2b6] space-y-3">
                            <div className="flex justify-between items-center border-b border-[#d8c2b6]/40 pb-2">
                              <span className="text-xs font-bold text-[#6d3807]">
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
                                  <div key={idx} className="p-3 bg-white rounded-xl border border-[#d8c2b6] space-y-2 text-xs">
                                    <div className="flex items-center justify-between">
                                      <span className="font-bold text-[#6d3807]">
                                        📍 Vị trí chỗ trống #{idx + 1}
                                      </span>
                                      <span className="px-2.5 py-0.5 bg-emerald-100 text-emerald-900 border border-emerald-300 rounded-lg font-bold text-[11px]">
                                        Đáp án đúng (Cố định): "{correctVal}"
                                      </span>
                                    </div>
                                    <div className="flex items-center space-x-2">
                                      <span className="px-3 py-2 bg-[#fff1ea] text-[#6d3807] font-bold text-xs border border-[#ffb782] rounded-xl shrink-0 select-none">
                                        ✓ {correctVal}
                                      </span>
                                      <input
                                        type="text"
                                        placeholder="Nhập các từ gây nhiễu bổ sung (Phân cách bằng dấu phẩy, VD: rapidly, rarely, rigidly)..."
                                        value={gapDistractorInputs[idx] || ""}
                                        onChange={(e) => setGapDistractorInputs({ ...gapDistractorInputs, [idx]: e.target.value })}
                                        className="w-full px-3 py-2 bg-white border border-[#d8c2b6] rounded-xl text-xs focus:outline-none focus:border-[#6d3807]"
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

                    {/* Listening Ordering & Matching */}
                    {listeningCategory === "LISTENING_ORDERING" && (
                      <textarea rows={3} value={orderingRawText} onChange={(e) => setOrderingRawText(e.target.value)} className="w-full p-3 bg-[#fff8f5] border border-[#d8c2b6] rounded-xl text-xs" />
                    )}

                    {listeningCategory === "LISTENING_MATCHING" && (
                      <div className="space-y-3 p-4 rounded-2xl bg-[#fff8f5] border border-[#d8c2b6]">
                        <span className="text-xs font-bold text-[#6d3807] block">Cặp Nối Từ Listening</span>
                        <div className="grid grid-cols-2 gap-2">
                          <input type="text" placeholder="Cột A" value={matchLeft} onChange={(e) => setMatchLeft(e.target.value)} className="px-3 py-1.5 bg-white border border-[#d8c2b6] rounded-lg text-xs" />
                          <input type="text" placeholder="Cột B" value={matchRight} onChange={(e) => setMatchRight(e.target.value)} className="px-3 py-1.5 bg-white border border-[#d8c2b6] rounded-lg text-xs" />
                        </div>
                        <button type="button" onClick={handleAddOrUpdateMatchingPair} className="w-full py-2 bg-[#6d3807] text-white rounded-xl text-xs font-bold">
                          Thêm Cặp Nối
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {/* ==================================================== */}
                {/* WRITING SKILL */}
                {/* ==================================================== */}
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
                        <button key={c.id} type="button" onClick={() => { setWritingCategory(c.id as WritingQType); resetCategoryStates(); }} className={`p-2.5 rounded-xl border text-xs font-bold transition-all ${writingCategory === c.id ? "bg-[#fff1ea] border-[#ffb782] text-[#6d3807]" : "bg-[#fff8f5] border-[#d8c2b6] text-[#52443a]"}`}>
                          {c.label}
                        </button>
                      ))}
                    </div>

                    {writingCategory === "WRITING_ESSAY" && (
                      <textarea rows={3} value={essayPromptText} onChange={(e) => setEssayPromptText(e.target.value)} className="w-full p-3 bg-[#fff8f5] border border-[#d8c2b6] rounded-xl text-xs" />
                    )}

                    {writingCategory === "WRITING_FREE_TYPING_BLANKS" && (
                      <div>
                        <label className="block text-xs font-bold uppercase text-[#6d3807] mb-1">
                          Soạn Đoạn Văn Chứa Đáp Án Trong Ngoặc Vuông <code>[đáp_án_đúng]</code>
                        </label>
                        <textarea
                          rows={3}
                          value={parenthesesRawText}
                          onChange={(e) => setParenthesesRawText(e.target.value)}
                          placeholder="Ví dụ: To achieve success in IELTS, one must practice [consistently] every day."
                          className="w-full p-3.5 bg-[#fff8f5] border border-[#d8c2b6] rounded-xl text-xs font-bold text-[#6d3807]"
                        />
                      </div>
                    )}

                    {/* Writing Flashcard Set */}
                    {writingCategory === "WRITING_FLASHCARD_SET" && (
                      <div className="space-y-3 p-4 rounded-2xl bg-[#fff8f5] border border-[#d8c2b6]">
                        <span className="text-xs font-bold text-[#6d3807] block">Tập Hợp Flashcards Tự Gõ Từ ({flashcardsList.length})</span>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                          {flashcardsList.map((fc) => (
                            <div key={fc.id} className="p-3 bg-white rounded-2xl border border-[#d8c2b6] text-xs flex flex-col space-y-2 relative">
                              {fc.imageUrl && (
                                <div className="w-full h-28 rounded-xl overflow-hidden border border-[#d8c2b6]/60 relative">
                                  <img src={fc.imageUrl} alt={fc.vietnameseName} className="w-full h-full object-cover" />
                                </div>
                              )}
                              <div className="flex-1 space-y-1">
                                <span className="font-bold text-[#211a16] block">{fc.vietnameseName}</span>
                                <span className="text-[10px] text-emerald-800 font-bold block">Từ khóa: {fc.correctEnglishWord}</span>
                              </div>
                              <div className="flex justify-end space-x-1.5 pt-1.5 border-t border-[#d8c2b6]/40">
                                <button type="button" onClick={() => handleEditFlashcard(fc)} className="p-1.5 rounded-lg bg-gray-50 border border-[#d8c2b6] text-[#6d3807] hover:bg-[#fff1ea]"><Edit2 className="w-3.5 h-3.5" /></button>
                                <button type="button" onClick={() => handleDeleteFlashcard(fc.id)} className="p-1.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-600 hover:bg-rose-100"><Trash2 className="w-3.5 h-3.5" /></button>
                              </div>
                            </div>
                          ))}
                        </div>

                        {/* Search Existing Flashcards in Database */}
                        <div className="p-3 bg-white rounded-xl border border-[#d8c2b6] space-y-2">
                          <span className="font-bold text-[#6d3807] block text-[11px]">🔍 Tìm Kiếm Flashcard Đã Có Trong Database:</span>
                          <input
                            type="text"
                            placeholder="Gõ từ tiếng Anh hoặc tiếng Việt để tìm flashcard đã tạo..."
                            value={fcSearchQuery}
                            onChange={(e) => handleSearchFlashcards(e.target.value)}
                            className="w-full px-3 py-1.5 bg-[#fff8f5] border border-[#d8c2b6] rounded-lg text-xs font-medium focus:outline-none focus:border-[#6d3807]"
                          />
                          {isSearchingFc && <p className="text-[10px] text-[#857469]">Đang tìm kiếm...</p>}
                          {fcSearchResults.length > 0 && (
                            <div className="flex flex-wrap gap-1.5 pt-1">
                              {fcSearchResults.map((fc) => (
                                <button
                                  key={fc.id}
                                  type="button"
                                  onClick={() => handleSelectExistingFc(fc)}
                                  className="px-2.5 py-1 bg-[#fff1ea] border border-[#ffb782] rounded-lg text-xs font-bold text-[#6d3807] hover:bg-[#6d3807] hover:text-white transition-all flex items-center space-x-1 cursor-pointer"
                                >
                                  <span>+ {fc.vietnamese_name} ({fc.correct_english_word})</span>
                                </button>
                              ))}
                            </div>
                          )}
                        </div>

                        <div className="pt-2 border-t border-[#d8c2b6] space-y-2 text-xs">
                          <span className="font-bold text-[#6d3807] block">Xem Trước Ảnh Minh Họa Đang Biên Soạn:</span>
                          {fcImageUrl && (
                            <div className="w-24 h-24 rounded-xl border border-[#d8c2b6] overflow-hidden bg-black/5">
                              <img src={fcImageUrl} alt="Flashcard preview" className="w-full h-full object-cover" />
                            </div>
                          )}
                          <input type="text" placeholder="URL Ảnh minh họa..." value={fcImageUrl} onChange={(e) => setFcImageUrl(e.target.value)} className="w-full px-3 py-1.5 bg-white border border-[#d8c2b6] rounded-lg text-xs" />
                          <div className="grid grid-cols-2 gap-2">
                            <input type="text" placeholder="Nghĩa TV" value={fcVnName} onChange={(e) => setFcVnName(e.target.value)} className="px-3 py-1.5 bg-white border border-[#d8c2b6] rounded-lg text-xs" />
                            <input type="text" placeholder="Từ TA đúng để gõ" value={fcEngWord} onChange={(e) => setFcEngWord(e.target.value)} className="px-3 py-1.5 bg-white border border-[#d8c2b6] rounded-lg text-xs" />
                          </div>
                          <button type="button" onClick={handleAddOrUpdateFlashcard} className="w-full py-2 bg-[#6d3807] text-white rounded-xl text-xs font-bold">
                            Thêm Card
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Writing Short Answer Questions with Word Limits */}
                    {writingCategory === "WRITING_SHORT_ANSWER" && (
                      <div className="space-y-3 p-4 rounded-2xl bg-[#fff8f5] border border-[#d8c2b6]">
                        <span className="text-xs font-bold text-[#6d3807] block">Danh Sách Câu Hỏi Tự Luận Ngắn ({shortAnswersList.length})</span>
                        <div className="space-y-2">
                          {shortAnswersList.map((sa, idx) => (
                            <div key={sa.id} className="p-3 bg-white rounded-xl border border-[#d8c2b6] text-xs flex justify-between items-center">
                              <div>
                                <span className="font-bold text-[#211a16]">Q{idx + 1}: {sa.questionText}</span>
                                <span className="text-[10px] text-[#857469] block">Giới hạn: {sa.maxWords} từ</span>
                              </div>
                              <div className="flex space-x-2">
                                <button type="button" onClick={() => handleEditShortAnswer(sa)} className="text-[#6d3807]"><Edit2 className="w-3.5 h-3.5" /></button>
                                <button type="button" onClick={() => handleDeleteShortAnswer(sa.id)} className="text-rose-600"><Trash2 className="w-3.5 h-3.5" /></button>
                              </div>
                            </div>
                          ))}
                        </div>

                        <div className="pt-2 border-t border-[#d8c2b6] space-y-2">
                          <input type="text" placeholder="Câu hỏi tự luận ngắn..." value={saQuestionText} onChange={(e) => setSaQuestionText(e.target.value)} className="w-full px-3 py-2 bg-white border border-[#d8c2b6] rounded-xl text-xs" />
                          <div>
                            <label className="block text-[11px] font-bold text-[#211a16] mb-1">Giới hạn tối đa số từ:</label>
                            <input type="number" value={saMaxWords} onChange={(e) => setSaMaxWords(Number(e.target.value))} className="w-24 px-3 py-1.5 bg-white border border-[#d8c2b6] rounded-lg text-xs" />
                          </div>
                          <button type="button" onClick={handleAddOrUpdateShortAnswer} className="w-full py-2 bg-[#6d3807] text-white rounded-xl text-xs font-bold">
                            {editingSaId ? "Cập Nhật Câu Hỏi Tự Luận" : "Thêm Câu Hỏi Tự Luận"}
                          </button>
                        </div>
                      </div>
                    )}

                    {writingCategory === "WRITING_SENTENCE_REWRITE" && (
                      <div className="space-y-4 p-4 rounded-2xl bg-[#fff8f5] border border-[#d8c2b6]">
                        <div className="flex justify-between items-center border-b border-[#d8c2b6]/40 pb-2">
                          <span className="text-xs font-bold text-[#6d3807]">
                            Danh Sách Câu Hỏi Viết Lại ({rewriteSubQuestions.length})
                          </span>
                          <span className="text-[10px] text-[#857469]">
                            Đặt từ gợi ý trong ngoặc: <code>[Unless] ...</code>
                          </span>
                        </div>

                        {rewriteSubQuestions.length > 0 && (
                          <div className="space-y-2">
                            {rewriteSubQuestions.map((sr, idx) => {
                              const { cue } = parseSentenceRewriteCue(sr.correctAnswer);
                              return (
                                <div key={sr.id} className="p-3 bg-white rounded-xl border border-[#d8c2b6] text-xs flex justify-between items-center">
                                  <div className="space-y-1">
                                    <span className="font-bold text-[#6d3807]">Câu {idx + 1}: {sr.originalSentence}</span>
                                    <p className="text-[11px] text-[#52443a]">
                                      ➔ {sr.correctAnswer} {cue && <span className="px-2 py-0.5 bg-amber-100 text-amber-900 rounded font-bold text-[10px] ml-2">Gợi ý: "{cue}"</span>}
                                    </p>
                                  </div>
                                  <div className="flex space-x-1 shrink-0 ml-2">
                                    <button
                                      type="button"
                                      onClick={() => handleEditSentenceRewrite(sr)}
                                      className="p-1.5 rounded-lg bg-gray-50 border border-[#d8c2b6] text-[#6d3807] hover:bg-[#fff1ea] cursor-pointer"
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

                        <div className="pt-2 border-t border-[#d8c2b6] space-y-2">
                          <span className="text-[11px] font-bold text-[#6d3807] block">
                            {editingSrId ? "Chỉnh Sửa Câu Viết Lại Con:" : "Thêm Câu Viết Lại Con Mới:"}
                          </span>
                          <input
                            type="text"
                            placeholder="Câu gốc (Ví dụ: It is impossible to finish this project without collaboration...)"
                            value={srOriginalSentence}
                            onChange={(e) => setSrOriginalSentence(e.target.value)}
                            className="w-full px-3 py-2 bg-white border border-[#d8c2b6] rounded-xl text-xs focus:outline-none focus:border-[#6d3807]"
                          />
                          <input
                            type="text"
                            placeholder="Câu viết lại có từ gợi ý trong ngoặc vuông (Ví dụ: [Unless] you collaborate with your team...)"
                            value={srCorrectAnswer}
                            onChange={(e) => setSrCorrectAnswer(e.target.value)}
                            className="w-full px-3 py-2 bg-white border border-[#d8c2b6] rounded-xl text-xs focus:outline-none focus:border-[#6d3807]"
                          />
                          <button
                            type="button"
                            onClick={handleAddOrUpdateSentenceRewrite}
                            disabled={!srOriginalSentence.trim() || !srCorrectAnswer.trim()}
                            className="w-full py-2 bg-[#6d3807] hover:bg-[#8a4f1e] text-white rounded-xl text-xs font-bold transition-all disabled:opacity-50 cursor-pointer"
                          >
                            {editingSrId ? "Cập Nhật Câu Viết Lại Này" : "+ Thêm Câu Viết Lại Này Này"}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* ==================================================== */}
                {/* SPEAKING SKILL */}
                {/* ==================================================== */}
                {skillType === "Speaking" && (
                  <div className="space-y-4">
                    {speakingCategory === "SPEAKING_TOPIC_PROMPT" && (
                      <textarea rows={3} value={speakingCuePrompt} onChange={(e) => setSpeakingCuePrompt(e.target.value)} className="w-full p-3 bg-[#fff8f5] border border-[#d8c2b6] rounded-xl text-xs" />
                    )}

                    {speakingCategory === "SPEAKING_READ_ALOUD" && (
                      <textarea rows={3} value={readAloudPassage} onChange={(e) => setReadAloudPassage(e.target.value)} className="w-full p-3 bg-[#fff8f5] border border-[#d8c2b6] rounded-xl text-xs font-medium" />
                    )}
                  </div>
                )}

                <div className="flex items-center space-x-2">
                  <button
                    onClick={handleAddOrUpdateQuestion}
                    className="flex-1 py-3.5 bg-[#6d3807] hover:bg-[#8a4f1e] text-white rounded-xl text-xs font-bold transition-all shadow flex items-center justify-center space-x-2 font-headline cursor-pointer"
                  >
                    <Plus className="w-4 h-4 text-[#ffb782]" />
                    <span>
                      {editingQuestionNumber
                        ? `Cập Nhật Câu Hỏi Số ${editingQuestionNumber}`
                        : "Thêm Nhóm Câu Hỏi Vào Đề Thi"}
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
                      className="px-4 py-3.5 bg-gray-100 hover:bg-rose-50 border border-gray-300 hover:border-rose-300 text-[#52443a] hover:text-rose-600 rounded-xl text-xs font-bold transition-all flex items-center space-x-1.5 shrink-0 cursor-pointer"
                    >
                      <XCircle className="w-4 h-4" />
                      <span>Hủy Sửa Câu {editingQuestionNumber}</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Right Question List Preview Pane with Edit & Delete Controls */}
          <div className="lg:col-span-4 bg-[#ffffff] p-6 rounded-3xl border border-[#d8c2b6] shadow-sm flex flex-col font-sans text-xs h-full min-h-[500px]">
            <h2 className="text-base font-bold text-[#6d3807] flex items-center justify-between border-b border-[#d8c2b6]/40 pb-3 mb-4 shrink-0">
              <span>Danh Sách Câu Hỏi Đã Tạo ({questionsList.length})</span>
            </h2>

            {questionsList.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center p-6 text-center border-2 border-dashed border-[#d8c2b6] rounded-2xl bg-[#fff8f5] min-h-[300px]">
                <p className="text-xs text-[#52443a]">Chưa có câu hỏi nào. Biên soạn ở bên trái để thêm mới.</p>
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
                          ? "border-[#6d3807] bg-[#fff1ea] ring-2 ring-[#ffb782] shadow-md"
                          : dragOverIndex === idx
                          ? "border-[#6d3807] bg-[#fff1ea] ring-2 ring-[#ffb782]"
                          : draggedIndex === idx
                          ? "opacity-40 border-dashed border-[#6d3807] bg-gray-50"
                          : "border-[#d8c2b6] bg-[#fff8f5] hover:border-[#6d3807]"
                      }`}
                    >
                      <div className="flex justify-between items-center text-xs">
                        <div className="flex items-center space-x-1.5">
                          <GripVertical className="w-4 h-4 text-[#857469] group-hover:text-[#6d3807] shrink-0" />
                          <span className="font-bold text-[#6d3807]">Câu {idx + 1} ({q.skill})</span>
                        </div>

                        <div className="flex items-center space-x-1">
                          <button type="button" onClick={() => handleEditMainQuestion(q)} className={`p-1.5 rounded-lg border transition-all cursor-pointer ${isEditingThis ? "bg-[#6d3807] text-white border-[#6d3807]" : "bg-white border-[#d8c2b6] text-[#6d3807] hover:bg-[#fff1ea]"}`} title="Chỉnh sửa câu hỏi này"><Edit2 className="w-3.5 h-3.5" /></button>
                          <button type="button" onClick={() => handleMoveQuestionUp(idx)} disabled={idx === 0} className="p-1.5 rounded-lg bg-white border border-[#d8c2b6] text-[#6d3807] disabled:opacity-30 cursor-pointer"><ArrowUp className="w-3.5 h-3.5" /></button>
                          <button type="button" onClick={() => handleMoveQuestionDown(idx)} disabled={idx === questionsList.length - 1} className="p-1.5 rounded-lg bg-white border border-[#d8c2b6] text-[#6d3807] disabled:opacity-30 cursor-pointer"><ArrowDown className="w-3.5 h-3.5" /></button>
                          <button type="button" onClick={() => handleDeleteQuestion(idx)} className="p-1.5 rounded-lg bg-white border border-rose-200 text-rose-600 hover:bg-rose-50 cursor-pointer"><Trash2 className="w-3.5 h-3.5" /></button>
                        </div>
                      </div>

                      <span className="px-2 py-0.5 rounded-full bg-[#fff1ea] text-[#6d3807] border border-[#ffb782] text-[10px] font-bold inline-block">{q.category}</span>
                      <p className="text-xs text-[#211a16] font-bold">{q.questionTitle}</p>
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
              className="fixed inset-0 bg-[#211a16]/60 backdrop-blur-sm flex items-center justify-center z-[100] transition-opacity p-4"
              onClick={handleCloseAudioPopup}
            >
              <div 
                className="w-full max-w-md bg-white rounded-3xl border border-[#d8c2b6] shadow-xl p-6 relative overflow-hidden flex flex-col space-y-4"
                onClick={(e) => e.stopPropagation()}
              >
                {/* Header */}
                <div className="flex justify-between items-center pb-2 border-b border-[#d8c2b6]/30">
                  <h3 className="font-headline font-bold text-sm text-[#6d3807] flex items-center space-x-1.5">
                    <Volume2 className="w-4 h-4 text-[#8a4f1e]" />
                    <span>Nghe Thử Giọng Đọc AI</span>
                  </h3>
                  <button 
                    type="button" 
                    onClick={handleCloseAudioPopup}
                    className="p-1.5 rounded-full hover:bg-[#fff8f5] text-[#857469] hover:text-[#6d3807] transition-all"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                  </button>
                </div>

                {/* Content */}
                <div className="text-xs text-[#52443a] leading-relaxed bg-[#fff8f5] p-3 rounded-xl border border-[#d8c2b6]/30 max-h-24 overflow-y-auto">
                  <span className="font-bold block text-[10px] text-[#857469] mb-0.5">VĂN BẢN ĐỌC:</span>
                  "{audioPopupText}"
                </div>

                {isAudioLoading ? (
                  <div className="flex flex-col items-center justify-center py-6 space-y-3">
                    <Loader2 className="w-8 h-8 text-[#8a4f1e] animate-spin" />
                    <span className="text-[11px] text-[#857469] font-medium animate-pulse">Đang kết nối Gemini và tổng hợp giọng nói...</span>
                  </div>
                ) : (
                  <div className="py-2 space-y-2">
                    <audio 
                      ref={popupAudioRef}
                      src={audioPopupSrc || undefined} 
                      controls 
                      className="w-full focus:outline-none custom-audio-player" 
                    />
                    <p className="text-[10px] text-[#857469] text-center italic">
                      * Click ra ngoài vùng xám hoặc bấm nút đóng để tắt popup
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Gemini TTS Connection Failure Dialog */}
          {ttsErrorModal?.show && (
            <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
              <div className="bg-white p-6 rounded-3xl max-w-md text-center shadow-xl border border-[#d8c2b6] space-y-4">
                <div className="w-12 h-12 rounded-full bg-amber-100 text-amber-800 flex items-center justify-center mx-auto">
                  <Volume2 className="w-6 h-6" />
                </div>
                <h3 className="text-base font-bold text-[#6d3807]">⚠️ Không Thể Kết Nối AI Giọng Nói Gemini</h3>
                <p className="text-xs text-[#52443a] leading-relaxed">
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
                    className="w-full py-2.5 bg-[#6d3807] hover:bg-[#8a4f1e] text-white rounded-xl text-xs font-bold transition-all shadow-sm cursor-pointer"
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
                    className="w-full py-2.5 bg-[#fff1ea] hover:bg-[#ffb782] text-[#6d3807] rounded-xl text-xs font-bold border border-[#d8c2b6] transition-all cursor-pointer"
                  >
                    🗣️ Sử Dụng Âm Thanh Mặc Định (Fallback)
                  </button>
                  <button
                    type="button"
                    onClick={() => setTtsErrorModal(null)}
                    className="text-xs text-[#857469] hover:underline pt-1 cursor-pointer"
                  >
                    Hủy bỏ
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </TeacherLayout>
    );
}

export default function TeacherTestCreatorPage() {
  return (
    <Suspense
      fallback={
        <TeacherLayout>
          <div className="flex items-center justify-center py-20 text-xs font-bold text-[#6d3807] space-x-2">
            <Loader2 className="w-5 h-5 animate-spin text-[#6d3807]" />
            <span>Đang tải trình biên soạn &amp; chỉnh sửa đề thi...</span>
          </div>
        </TeacherLayout>
      }
    >
      <TeacherTestCreatorInner />
    </Suspense>
  );
}
