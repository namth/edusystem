"use client";

import React, { useEffect, useState } from "react";

const PIECES = [
  { left: "8%", delay: "0s", bg: "bg-brand-500", rotate: "rotate-12" },
  { left: "16%", delay: "0.15s", bg: "bg-accent-400", rotate: "-rotate-12" },
  { left: "25%", delay: "0.05s", bg: "bg-emerald-500", rotate: "rotate-45" },
  { left: "34%", delay: "0.25s", bg: "bg-amber-400", rotate: "-rotate-45" },
  { left: "44%", delay: "0.1s", bg: "bg-rose-400", rotate: "rotate-12" },
  { left: "54%", delay: "0.2s", bg: "bg-brand-400", rotate: "-rotate-12" },
  { left: "64%", delay: "0.08s", bg: "bg-accent-500", rotate: "rotate-45" },
  { left: "74%", delay: "0.18s", bg: "bg-emerald-400", rotate: "-rotate-12" },
  { left: "84%", delay: "0.12s", bg: "bg-amber-500", rotate: "rotate-12" },
  { left: "92%", delay: "0.22s", bg: "bg-brand-600", rotate: "-rotate-45" },
];

export default function Confetti() {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined" && typeof window.matchMedia === "function") {
      setReduced(window.matchMedia("(prefers-reduced-motion: reduce)").matches);
    }
  }, []);

  if (reduced) return null;

  return (
    <div
      className="pointer-events-none fixed inset-0 overflow-hidden z-40"
      aria-hidden="true"
    >
      {PIECES.map((p, idx) => (
        <span
          key={idx}
          style={{ left: p.left, animationDelay: p.delay }}
          className={`absolute top-6 w-3 h-3 rounded-sm ${p.bg} ${p.rotate} kk-drop opacity-90`}
        />
      ))}
    </div>
  );
}
