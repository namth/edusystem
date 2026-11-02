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
  const [visibleChars, setVisibleChars] = useState<number>(text.length);

  useEffect(() => {
    if (typeof window === "undefined") {
      setVisibleChars(text.length);
      return;
    }
    const reduced =
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) {
      setVisibleChars(text.length);
      return;
    }

    setVisibleChars(0);
    let current = 0;
    const timer = window.setInterval(() => {
      current += 1;
      if (current >= text.length) {
        setVisibleChars(text.length);
        window.clearInterval(timer);
      } else {
        setVisibleChars(current);
      }
    }, 25);

    return () => window.clearInterval(timer);
  }, [text]);

  const handleRevealAll = () => {
    setVisibleChars(text.length);
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
