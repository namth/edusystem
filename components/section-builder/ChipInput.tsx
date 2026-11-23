"use client";
// Ô nhập dạng thẻ: Enter hoặc dấu phẩy để thêm, × để bỏ. Thẻ cố định (đáp án) hiện trước, không xoá được.
import { useState } from "react";
import { X, Check } from "lucide-react";

export default function ChipInput({
  value,
  onChange,
  fixed = [],
  placeholder,
  ariaLabel,
}: {
  value: string[];
  onChange: (next: string[]) => void;
  fixed?: string[];
  placeholder?: string;
  ariaLabel: string;
}) {
  const [draft, setDraft] = useState("");
  const commit = (raw: string) => {
    const lower = new Set([...fixed, ...value].map((w) => w.trim().toLowerCase()));
    const add = raw.split(",").map((w) => w.trim()).filter((w) => w && !lower.has(w.toLowerCase()) && lower.add(w.toLowerCase()));
    if (add.length) onChange([...value, ...add]);
    setDraft("");
  };
  return (
    <div className="flex flex-wrap items-center gap-1.5 rounded-xl border border-line bg-white p-1.5 min-h-11 focus-within:border-brand-400 focus-within:ring-2 focus-within:ring-brand-100">
      {fixed.map((w, i) => (
        <span key={`f${i}`} title="Đáp án — lấy từ đoạn văn" className="inline-flex items-center gap-1 rounded-lg border border-emerald-300 bg-emerald-50 px-2.5 py-1 text-sm text-emerald-900">
          <Check className="h-3.5 w-3.5" />
          {w}
        </span>
      ))}
      {value.map((w, i) => (
        <span key={`v${i}`} className="inline-flex items-center gap-1 rounded-lg border border-accent-200 bg-accent-50 py-1 pl-2.5 pr-1 text-sm text-accent-700">
          {w}
          <button type="button" aria-label={`Bỏ ${w}`} onClick={() => onChange(value.filter((_, j) => j !== i))} className="rounded p-0.5 hover:bg-accent-100 cursor-pointer">
            <X className="h-3.5 w-3.5" />
          </button>
        </span>
      ))}
      <input
        aria-label={ariaLabel}
        value={draft}
        placeholder={placeholder}
        onChange={(e) => {
          const v = e.target.value;
          if (v.includes(",")) commit(v);
          else setDraft(v);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            commit(draft);
          } else if (e.key === "Backspace" && !draft && value.length) {
            onChange(value.slice(0, -1));
          }
        }}
        onBlur={() => draft.trim() && commit(draft)}
        className="min-w-36 flex-1 border-0 bg-transparent px-1.5 py-1 text-sm outline-none"
      />
    </div>
  );
}
