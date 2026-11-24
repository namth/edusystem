"use client";
// FEAT-017 BR-P15 — kéo thả bằng Pointer Events: chạy cả chuột lẫn cảm ứng (HTML5 drag-and-drop không chạy trên điện thoại).
// Bấm (không di chuyển quá 6px) vẫn là click bình thường, nên cách bấm để chọn giữ nguyên.
// Đích thả đánh dấu bằng thuộc tính data-drop="<khoá>"; ô đang được rê qua có data-drop-over.
import { useCallback, useEffect, useRef, useState } from "react";

export interface DragState<P> {
  payload: P;
  label: string;
  x: number;
  y: number;
  over: string | null;
}

export function usePointerDrag<P>(onDrop: (payload: P, target: string) => void) {
  const [drag, setDrag] = useState<DragState<P> | null>(null);
  const pending = useRef<{ payload: P; label: string; x0: number; y0: number; id: number } | null>(null);
  const suppressClick = useRef(false);
  const dropRef = useRef(onDrop);
  useEffect(() => {
    dropRef.current = onDrop;
  }, [onDrop]);

  const targetAt = (x: number, y: number): string | null => {
    const el = typeof document !== "undefined" ? document.elementFromPoint(x, y) : null;
    const hit = el ? (el as HTMLElement).closest("[data-drop]") : null;
    return hit ? hit.getAttribute("data-drop") : null;
  };

  useEffect(() => {
    const move = (e: PointerEvent) => {
      const p = pending.current;
      if (!p || e.pointerId !== p.id) return;
      if (!drag && Math.hypot(e.clientX - p.x0, e.clientY - p.y0) < 6) return;
      e.preventDefault();
      setDrag({ payload: p.payload, label: p.label, x: e.clientX, y: e.clientY, over: targetAt(e.clientX, e.clientY) });
    };
    const up = (e: PointerEvent) => {
      const p = pending.current;
      if (!p || e.pointerId !== p.id) return;
      pending.current = null;
      if (drag) {
        suppressClick.current = true; // nhả sau khi kéo: không coi là bấm
        const t = targetAt(e.clientX, e.clientY);
        if (t) dropRef.current(p.payload, t);
        setDrag(null);
        setTimeout(() => (suppressClick.current = false), 0);
      }
    };
    const cancel = () => {
      pending.current = null;
      setDrag(null);
    };
    window.addEventListener("pointermove", move, { passive: false });
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", cancel);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", cancel);
    };
  }, [drag]);

  /** Gắn vào phần tử kéo được. */
  const dragProps = useCallback(
    (payload: P, label: string, enabled = true) =>
      enabled
        ? {
            onPointerDown: (e: React.PointerEvent) => {
              if (e.button !== 0) return;
              pending.current = { payload, label, x0: e.clientX, y0: e.clientY, id: e.pointerId };
            },
            onClickCapture: (e: React.MouseEvent) => {
              if (suppressClick.current) {
                e.preventDefault();
                e.stopPropagation();
              }
            },
            style: { touchAction: "none" as const },
          }
        : {},
    []
  );

  const ghost = drag ? (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed z-[100] -translate-x-1/2 -translate-y-1/2 rounded-lg border border-brand-400 bg-white px-3 py-1.5 text-sm font-semibold text-brand-700 shadow-lg"
      style={{ left: drag.x, top: drag.y }}
    >
      {drag.label}
    </div>
  ) : null;

  return { drag, dragProps, ghost, overKey: drag?.over ?? null };
}
