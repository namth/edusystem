"use client";

import { useState, useEffect, useCallback } from "react";

export type SignupDraftKey = "kitokit-signup-student" | "kitokit-signup-teacher";

function sanitizeDraft<T extends Record<string, any>>(data: T): Omit<T, "password"> {
  const clone: Record<string, any> = { ...data };
  delete clone.password;
  return clone as Omit<T, "password">;
}

export function useInterviewDraft<T extends Record<string, any>>(
  storageKey: SignupDraftKey,
  initialValue: T
) {
  const [draft, setDraftState] = useState<T>(() => {
    if (typeof window === "undefined") return initialValue;
    try {
      const raw = window.sessionStorage.getItem(storageKey);
      if (!raw) return initialValue;
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object") {
        delete parsed.password;
        return { ...initialValue, ...parsed };
      }
    } catch {
      // Bỏ qua lỗi đọc sessionStorage
    }
    return initialValue;
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const safe = sanitizeDraft(draft);
      window.sessionStorage.setItem(storageKey, JSON.stringify(safe));
    } catch {
      // Bỏ qua lỗi ghi sessionStorage
    }
  }, [storageKey, draft]);

  const updateDraft = useCallback((patch: Partial<T> | ((prev: T) => T)) => {
    setDraftState((prev) => {
      const next = typeof patch === "function" ? patch(prev) : { ...prev, ...patch };
      if (typeof window !== "undefined") {
        try {
          const safe = sanitizeDraft(next);
          window.sessionStorage.setItem(storageKey, JSON.stringify(safe));
        } catch {
          // Bỏ qua lỗi ghi sessionStorage
        }
      }
      return next;
    });
  }, [storageKey]);

  const clearDraft = useCallback(() => {
    if (typeof window === "undefined") return;
    try {
      window.sessionStorage.removeItem(storageKey);
    } catch {
      // Bỏ qua lỗi xoá sessionStorage
    }
  }, [storageKey]);

  return { draft, updateDraft, clearDraft };
}
