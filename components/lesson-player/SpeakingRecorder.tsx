"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Mic, Square, Play, RotateCcw, Loader2, AlertCircle, Volume2, Sparkles, CheckCircle2 } from "lucide-react";

export interface SpeakingRecorderProps {
  value?: string;
  onChange: (url: string) => void;
  disabled?: boolean;
  prepSeconds?: number;
  speakingSeconds?: number;
  readAloudText?: string;
  topicHints?: string[];
}

export default function SpeakingRecorder({
  value = "",
  onChange,
  disabled = false,
  prepSeconds = 0,
  speakingSeconds = 60,
  readAloudText,
  topicHints,
}: SpeakingRecorderProps) {
  const [phase, setPhase] = useState<"idle" | "prep" | "recording" | "uploading" | "done">("idle");
  const [prepTimeLeft, setPrepTimeLeft] = useState(prepSeconds);
  const [speakingTimeLeft, setSpeakingTimeLeft] = useState(speakingSeconds);
  const [error, setError] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const prepTimerRef = useRef<NodeJS.Timeout | null>(null);
  const recordTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Dọn dẹp stream & timers khi unmount
  const cleanup = useCallback(() => {
    if (prepTimerRef.current) {
      clearInterval(prepTimerRef.current);
      prepTimerRef.current = null;
    }
    if (recordTimerRef.current) {
      clearInterval(recordTimerRef.current);
      recordTimerRef.current = null;
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      try {
        mediaRecorderRef.current.stop();
      } catch {
        // bỏ qua
      }
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => {
      cleanup();
    };
  }, [cleanup]);

  // Upload file ghi âm lên server
  const uploadRecording = async (blob: Blob) => {
    setPhase("uploading");
    setError(null);

    try {
      const formData = new FormData();
      formData.append("kind", "speaking");
      formData.append("file", blob, "speaking.webm");

      const res = await fetch("/api/uploads", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || "Không thể tải lên file ghi âm");
      }

      const data = await res.json();
      if (!data.url) {
        throw new Error("Không nhận được URL sau khi tải lên");
      }

      onChange(data.url);
      setPhase("done");
    } catch (err: any) {
      console.error("Lỗi upload speaking:", err);
      setError(err.message || "Tải lên bản ghi âm thất bại. Vui lòng ghi âm lại.");
      setPhase("idle");
    }
  };

  // Dừng ghi âm
  const stopRecording = useCallback(() => {
    if (recordTimerRef.current) {
      clearInterval(recordTimerRef.current);
      recordTimerRef.current = null;
    }

    if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
      mediaRecorderRef.current.stop();
    }
  }, []);

  // Bắt đầu ghi âm thật sự
  const startRecording = useCallback(async () => {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = () => {
        const mimeType = mediaRecorder.mimeType || "audio/webm";
        const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });
        if (streamRef.current) {
          streamRef.current.getTracks().forEach((track) => track.stop());
          streamRef.current = null;
        }
        uploadRecording(audioBlob);
      };

      mediaRecorder.start();
      setPhase("recording");
      const duration = speakingSeconds > 0 ? speakingSeconds : 60;
      setSpeakingTimeLeft(duration);

      recordTimerRef.current = setInterval(() => {
        setSpeakingTimeLeft((prev) => {
          if (prev <= 1) {
            stopRecording();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } catch (err: any) {
      console.error("Lỗi truy cập microphone:", err);
      setError("Không thể truy cập microphone. Vui lòng kiểm tra quyền truy cập microphone trên trình duyệt.");
      setPhase("idle");
    }
  }, [speakingSeconds, stopRecording]);

  // Bắt đầu luồng: nếu có prepSeconds thì đếm ngược chuẩn bị trước
  const handleStartProcess = () => {
    setError(null);
    if (prepSeconds && prepSeconds > 0) {
      setPhase("prep");
      setPrepTimeLeft(prepSeconds);
      prepTimerRef.current = setInterval(() => {
        setPrepTimeLeft((prev) => {
          if (prev <= 1) {
            if (prepTimerRef.current) {
              clearInterval(prepTimerRef.current);
              prepTimerRef.current = null;
            }
            startRecording();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      startRecording();
    }
  };

  // Bỏ qua thời gian chuẩn bị để nói ngay
  const handleSkipPrep = () => {
    if (prepTimerRef.current) {
      clearInterval(prepTimerRef.current);
      prepTimerRef.current = null;
    }
    startRecording();
  };

  // Ghi âm lại
  const handleRecordAgain = () => {
    cleanup();
    setPhase("idle");
    setError(null);
  };

  return (
    <div className="rounded-2xl border border-[#ede0d9] bg-[#fffdfc] p-4 md:p-5 space-y-4">
      {/* Văn bản đọc to (nếu có) */}
      {readAloudText && (
        <div className="rounded-xl border border-sky-200 bg-sky-50/50 p-4 space-y-1.5">
          <div className="flex items-center gap-2 text-xs font-bold text-sky-800 uppercase tracking-wide">
            <Volume2 className="w-4 h-4 text-sky-700" />
            <span>Đoạn văn cần đọc:</span>
          </div>
          <p className="text-sm font-medium text-[#211a16] leading-relaxed whitespace-pre-wrap">
            {readAloudText}
          </p>
        </div>
      )}

      {/* Gợi ý chủ đề (nếu có) */}
      {Array.isArray(topicHints) && topicHints.length > 0 && (
        <div className="rounded-xl border border-purple-200 bg-purple-50/40 p-4 space-y-2">
          <div className="flex items-center gap-2 text-xs font-bold text-purple-800 uppercase tracking-wide">
            <Sparkles className="w-4 h-4 text-purple-700" />
            <span>Gợi ý triển khai câu trả lời:</span>
          </div>
          <ul className="list-disc list-inside text-xs font-medium text-[#52443a] space-y-1">
            {topicHints.map((hint, idx) => (
              <li key={idx}>{hint}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Thông báo lỗi */}
      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 flex items-start gap-2.5 text-xs text-rose-800 font-medium">
          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {/* Vùng điều khiển ghi âm */}
      <div className="flex flex-col items-center justify-center p-4 rounded-xl border border-[#ede0d9] bg-[#fff8f5] space-y-3">
        {/* Trạng thái 1: Chưa ghi âm (hoặc đã xong nhưng chưa có bản ghi) */}
        {phase === "idle" && !value && (
          <div className="flex flex-col items-center space-y-3 text-center">
            <div className="text-xs text-[#52443a]">
              {prepSeconds > 0
                ? `Thời gian chuẩn bị: ${prepSeconds}s · Thời gian nói: ${speakingSeconds}s`
                : `Thời gian nói: ${speakingSeconds}s`}
            </div>
            <button
              type="button"
              disabled={disabled}
              onClick={handleStartProcess}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#6d3807] hover:bg-[#8a4f1e] disabled:opacity-50 text-white rounded-xl text-sm font-bold shadow-xs transition-all cursor-pointer"
            >
              <Mic className="w-4 h-4" />
              <span>Bắt đầu ghi âm</span>
            </button>
          </div>
        )}

        {/* Trạng thái 2: Đang chuẩn bị (Prep countdown) */}
        {phase === "prep" && (
          <div className="flex flex-col items-center space-y-3 text-center">
            <div className="text-xs font-bold uppercase tracking-wider text-amber-700">
              Chuẩn bị câu trả lời
            </div>
            <div className="text-4xl font-extrabold font-mono text-amber-800 animate-pulse">
              {prepTimeLeft}s
            </div>
            <button
              type="button"
              onClick={handleSkipPrep}
              className="px-4 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-bold transition-all cursor-pointer"
            >
              Bắt đầu nói ngay
            </button>
          </div>
        )}

        {/* Trạng thái 3: Đang ghi âm (Recording) */}
        {phase === "recording" && (
          <div className="flex flex-col items-center space-y-3 text-center">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-rose-600">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-600 animate-ping" />
              <span>Đang ghi âm...</span>
            </div>
            <div className="text-4xl font-extrabold font-mono text-rose-700">
              {speakingTimeLeft}s
            </div>
            <button
              type="button"
              onClick={stopRecording}
              className="inline-flex items-center gap-2 px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-sm font-bold shadow-xs transition-all cursor-pointer"
            >
              <Square className="w-4 h-4 fill-white" />
              <span>Hoàn thành ghi âm</span>
            </button>
          </div>
        )}

        {/* Trạng thái 4: Đang tải lên server (Uploading) */}
        {phase === "uploading" && (
          <div className="flex flex-col items-center space-y-2 text-center py-2">
            <Loader2 className="w-8 h-8 text-[#6d3807] animate-spin" />
            <p className="text-xs font-bold text-[#6d3807]">Đang tải lên máy chủ...</p>
          </div>
        )}

        {/* Trạng thái 5: Đã có file ghi âm (value) */}
        {value && phase !== "prep" && phase !== "recording" && phase !== "uploading" && (
          <div className="w-full space-y-3">
            <div className="flex items-center justify-between">
              <div className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-800">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>Đã ghi âm thành công</span>
              </div>
              {!disabled && (
                <button
                  type="button"
                  onClick={handleRecordAgain}
                  className="inline-flex items-center gap-1.5 px-3 py-1 bg-white hover:bg-[#fff1ea] text-[#6d3807] border border-[#d8c2b6] rounded-lg text-xs font-bold transition-all cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Ghi âm lại</span>
                </button>
              )}
            </div>
            <audio controls src={value} className="w-full h-9 rounded-lg" />
          </div>
        )}
      </div>
    </div>
  );
}
