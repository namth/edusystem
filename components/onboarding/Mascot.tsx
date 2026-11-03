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

// Mỗi cảm xúc một biểu cảm mascot 3D (public/brand/mascot-3d/)
const MOOD_IMAGE_MAP: Record<MascotMood, string> = {
  idle: "/brand/mascot-3d/kito-3d-khen-ngon-cai.png",
  think: "/brand/mascot-3d/kito-3d-viet-bai.png",
  happy: "/brand/mascot-3d/kito-3d-chien-thang.png",
  oops: "/brand/mascot-3d/kito-3d-thac-mac.png",
  celebrate: "/brand/mascot-3d/kito-3d-vui-mung.png",
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
        key={mood}
        src={MOOD_IMAGE_MAP[mood] || MOOD_IMAGE_MAP.idle}
        alt="Mascot Kito"
        className={`relative z-10 w-full h-full object-contain drop-shadow-md ${moodClass}`}
      />
    </div>
  );
}
