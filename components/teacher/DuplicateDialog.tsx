"use client";

import { useState, useEffect, useRef } from "react";
import { Copy, Loader2, AlertCircle, X } from "lucide-react";

export interface DuplicateDialogProps {
  open: boolean;
  kind: "lesson" | "exam";
  sourceId?: string;
  sourceTitle: string;
  endpoint?: string;
  onClose: () => void;
  onDone: (newItem: any) => void;
}

export default function DuplicateDialog({
  open,
  kind,
  sourceId,
  sourceTitle,
  endpoint,
  onClose,
  onDone,
}: DuplicateDialogProps) {
  const [title, setTitle] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (open) {
      const initialTitle = `${sourceTitle} (bản sao)`;
      setTitle(initialTitle);
      setError(null);
      setSubmitting(false);
      const timer = setTimeout(() => {
        if (inputRef.current) {
          inputRef.current.focus();
          inputRef.current.select();
        }
      }, 20);
      return () => clearTimeout(timer);
    }
  }, [open, sourceTitle]);

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !submitting) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, submitting, onClose]);

  if (!open) return null;

  const label = kind === "lesson" ? "bài học" : "đề thi";
  const targetUrl =
    endpoint ||
    (kind === "lesson"
      ? `/api/teacher/lessons/${sourceId}/duplicate`
      : `/api/teacher/exams/${sourceId}/duplicate`);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = title.trim();
    if (!clean) {
      setError(`Vui lòng nhập tên mới cho ${label}.`);
      return;
    }
    if (clean.length > 255) {
      setError(`Tên ${label} không được vượt quá 255 ký tự.`);
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(targetUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: clean }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.success) {
        setError(json?.error || `Không thể nhân bản ${label}.`);
        return;
      }
      const created = kind === "lesson" ? json.lesson : json.exam;
      onDone(created);
    } catch (err: any) {
      setError(err.message || `Lỗi kết nối khi nhân bản ${label}.`);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-line space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-brand-50 text-brand-600 flex items-center justify-center shrink-0">
              <Copy className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-ink">Nhân bản {label}</h3>
              <p className="text-xs text-ink-muted mt-0.5">
                Đặt tên mới cho bản sao. Toàn bộ câu hỏi sẽ được sao chép độc lập.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="p-1 text-ink-subtle hover:text-ink rounded-lg transition-colors disabled:opacity-40"
            aria-label="Đóng"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-ink mb-1.5">
              Tên {label} mới
            </label>
            <input
              ref={inputRef}
              type="text"
              value={title}
              onChange={(e) => {
                setTitle(e.target.value);
                if (error) setError(null);
              }}
              disabled={submitting}
              placeholder={`Nhập tên ${label} mới...`}
              className="w-full px-3.5 py-2.5 bg-surface-alt border border-line rounded-xl text-xs text-ink placeholder-ink-subtle focus:outline-none focus:border-brand-600 transition-all"
            />
          </div>

          {error && (
            <div className="flex items-start space-x-2 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600" />
              <span>{error}</span>
            </div>
          )}

          <div className="flex items-center justify-end space-x-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="px-4 py-2 bg-surface-alt hover:bg-line/50 text-ink rounded-xl text-xs font-bold border border-line transition-all disabled:opacity-40"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={submitting || !title.trim()}
              className="inline-flex items-center space-x-1.5 px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs disabled:opacity-50"
            >
              {submitting ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Copy className="w-3.5 h-3.5" />
              )}
              <span>Nhân bản</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
