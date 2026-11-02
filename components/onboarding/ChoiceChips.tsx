"use client";

import React, { useRef } from "react";

export interface ChipItem {
  code: string;
  label: string;
}

interface ChoiceChipsProps {
  options: readonly ChipItem[];
  selected: string | string[];
  multiple?: boolean;
  onSelect: (code: string) => void;
  className?: string;
}

export default function ChoiceChips({
  options,
  selected,
  multiple = false,
  onSelect,
  className = "",
}: ChoiceChipsProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  const isSelected = (code: string) => {
    if (Array.isArray(selected)) {
      return selected.includes(code);
    }
    return selected === code;
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>, idx: number) => {
    if (!containerRef.current) return;
    const buttons = Array.from(
      containerRef.current.querySelectorAll<HTMLButtonElement>("button[data-chip='true']")
    );
    if (buttons.length === 0) return;

    if (e.key === "ArrowRight" || e.key === "ArrowDown") {
      e.preventDefault();
      const nextIdx = (idx + 1) % buttons.length;
      buttons[nextIdx]?.focus();
    } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
      e.preventDefault();
      const prevIdx = (idx - 1 + buttons.length) % buttons.length;
      buttons[prevIdx]?.focus();
    }
  };

  return (
    <div
      ref={containerRef}
      role="group"
      className={`flex flex-wrap gap-2.5 ${className}`}
    >
      {options.map((opt, idx) => {
        const active = isSelected(opt.code);
        return (
          <button
            key={opt.code}
            type="button"
            data-chip="true"
            aria-pressed={active}
            onClick={() => onSelect(opt.code)}
            onKeyDown={(e) => handleKeyDown(e, idx)}
            className={`px-4 py-2.5 rounded-2xl text-sm font-bold border-2 transition-all cursor-pointer text-left focus:outline-none focus:ring-2 focus:ring-brand-500 ${
              active
                ? "bg-brand-600 border-brand-600 text-white shadow-sm"
                : "bg-white border-line text-ink hover:border-brand-400 hover:bg-brand-50/60"
            }`}
          >
            <span>{opt.label}</span>
            {multiple && active && (
              <span className="ml-2 inline-block text-xs text-accent-200" aria-hidden="true">
                ✓
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
