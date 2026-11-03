"use client";

import { useCallback, useMemo, useSyncExternalStore } from "react";

export type SignupDraftKey = "kitokit-signup-student" | "kitokit-signup-teacher";

// Nháp phỏng vấn lưu ở sessionStorage (không bao giờ lưu mật khẩu), đọc qua useSyncExternalStore:
// server và lượt hydrate dùng giá trị rỗng, sau đó mới lấy nháp → không lệch HTML khi tải lại giữa chừng.
// Trình duyệt chặn sessionStorage thì giữ nháp trong bộ nhớ.
const memory = new Map<string, string | null>();
const listeners = new Map<string, Set<() => void>>();

function readRaw(key: string): string | null {
  try {
    return window.sessionStorage.getItem(key);
  } catch {
    return memory.get(key) ?? null;
  }
}

function writeRaw(key: string, value: string | null) {
  try {
    if (value === null) window.sessionStorage.removeItem(key);
    else window.sessionStorage.setItem(key, value);
  } catch {
    memory.set(key, value);
  }
  listeners.get(key)?.forEach((fn) => fn());
}

function sanitizeDraft(data: object) {
  const clone: Record<string, unknown> = { ...data };
  delete clone.password;
  return clone;
}

function parseDraft<T extends object>(raw: string | null, initialValue: T): T {
  if (!raw) return initialValue;
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object") {
      delete parsed.password;
      return { ...initialValue, ...parsed };
    }
  } catch {
    // Nháp hỏng → bắt đầu lại
  }
  return initialValue;
}

export function useInterviewDraft<T extends object>(storageKey: SignupDraftKey, initialValue: T) {
  const subscribe = useCallback(
    (fn: () => void) => {
      const set = listeners.get(storageKey) ?? new Set();
      set.add(fn);
      listeners.set(storageKey, set);
      return () => set.delete(fn);
    },
    [storageKey]
  );
  const raw = useSyncExternalStore(
    subscribe,
    () => readRaw(storageKey),
    () => null
  );
  const draft = useMemo(() => parseDraft(raw, initialValue), [raw, initialValue]);

  const updateDraft = useCallback(
    (patch: Partial<T> | ((prev: T) => T)) => {
      const prev = parseDraft(readRaw(storageKey), initialValue);
      const next = typeof patch === "function" ? patch(prev) : { ...prev, ...patch };
      writeRaw(storageKey, JSON.stringify(sanitizeDraft(next)));
    },
    [storageKey, initialValue]
  );

  const clearDraft = useCallback(() => writeRaw(storageKey, null), [storageKey]);

  return { draft, updateDraft, clearDraft };
}
