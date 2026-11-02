"use client";

import React from "react";

export type MascotMood = "idle" | "think" | "happy" | "oops" | "celebrate";

const MOOD_CLASS_MAP: Record<MascotMood, string> = {
  idle: "mascot-idle",
  think: "mascot-think",
  happy: "mascot-happy",
  oops: "mascot-oops",
  celebrate: "mascot-celebrate",
};

interface MascotProps {
  mood?: MascotMood;
  size?: "sm" | "md" | "lg";
  className?: string;
}

export default function Mascot({ mood = "idle", size = "md", className = "" }: MascotProps) {
  const sizeClasses =
    size === "sm"
      ? "w-20 h-20 sm:w-24 sm:h-24"
      : size === "lg"
        ? "w-36 h-36 sm:w-44 sm:h-44"
        : "w-24 h-24 sm:w-32 sm:h-32";

  const moodClass = MOOD_CLASS_MAP[mood] || "mascot-idle";

  return (
    <div className={`relative inline-flex items-center justify-center select-none ${sizeClasses} ${className}`}>
      <div
        className="absolute inset-2 rounded-full bg-brand-400/25 blur-2xl pointer-events-none"
        aria-hidden="true"
      />
      <img
        src="/brand/kitokit-mark-transparent.png"
        alt="Mascot Kito"
        className={`relative z-10 w-full h-full object-contain drop-shadow-md ${moodClass}`}
      />
    </div>
  );
}
