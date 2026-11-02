"use client";

import React, { useState, useEffect } from "react";

interface SpeechBubbleProps {
  text: string;
  subtext?: string | null;
  variant?: "default" | "error" | "dark";
  className?: string;
}

export default function SpeechBubble({
  text,
  subtext,
  variant = "default",
  className = "",
}: SpeechBubbleProps) {
  // Số ký tự đã gõ lưu kèm câu thoại; câu thoại đổi → bắt đầu gõ lại từ 0
  const [typed, setTyped] = useState({ text: "", chars: 0 });

  useEffect(() => {
    const reduced =
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let current = 0;
    const timer = window.setInterval(
      () => {
        current = reduced ? text.length : current + 1;
        setTyped({ text, chars: Math.min(current, text.length) });
        if (current >= text.length) window.clearInterval(timer);
      },
      reduced ? 0 : 25
    );
    return () => window.clearInterval(timer);
  }, [text]);

  const visibleChars = typed.text === text ? typed.chars : 0;

  const handleRevealAll = () => {
    setTyped({ text, chars: text.length });
  };

  const shown = text.slice(0, visibleChars);
  const rest = text.slice(visibleChars);

  const boxStyle =
    variant === "error"
      ? "bg-rose-50 border-rose-200 text-rose-900"
      : variant === "dark"
        ? "bg-white/10 border-white/20 text-white backdrop-blur-md"
        : "bg-white border-brand-200 text-ink shadow-sm";

  return (
    <div
      role="status"
      aria-live="polite"
      onClick={handleRevealAll}
      className={`relative rounded-2xl border px-4 py-3.5 sm:px-5 sm:py-4 transition-colors cursor-pointer ${boxStyle} ${className}`}
      title="Bấm để hiện toàn bộ câu thoại"
    >
      <p className="font-display text-base sm:text-lg font-bold leading-snug">
        <span>{shown}</span>
        {rest && <span className="opacity-0">{rest}</span>}
      </p>
      {subtext && (
        <p
          className={`mt-1.5 text-xs sm:text-sm font-medium ${
            variant === "error"
              ? "text-rose-700"
              : variant === "dark"
                ? "text-brand-100"
                : "text-ink-muted"
          }`}
        >
          {subtext}
        </p>
      )}
    </div>
  );
}
