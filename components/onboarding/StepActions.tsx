"use client";

import React, { createContext, useContext } from "react";
import { ArrowLeft } from "lucide-react";

// InterviewShell cấp hàm quay lại; mỗi màn đặt StepActions ở cuối để nút Quay lại nằm cùng hàng nút Tiếp
export const InterviewNavContext = createContext<{ canGoBack: boolean; onBack: () => void }>({
  canGoBack: false,
  onBack: () => {},
});

export default function StepActions({ children }: { children?: React.ReactNode }) {
  const { canGoBack, onBack } = useContext(InterviewNavContext);
  if (!canGoBack && !children) return null;

  return (
    <div className="flex items-center justify-between gap-3 pt-2">
      {canGoBack ? (
        <button
          type="button"
          aria-label="Quay lại"
          onClick={onBack}
          className="inline-flex items-center gap-1.5 px-4 py-3 rounded-2xl border border-line bg-surface-alt hover:bg-brand-50 text-sm font-bold text-ink-muted hover:text-ink transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Quay lại</span>
        </button>
      ) : (
        <span />
      )}
      {children && <div className="flex items-center gap-3">{children}</div>}
    </div>
  );
}
