"use client";

import { Loader2, AlertTriangle, X } from "lucide-react";

interface FinalizeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  unreviewedCount: number;
  isConfirming: boolean;
}

export default function GradingFinalizeModal({
  isOpen,
  onClose,
  onConfirm,
  unreviewedCount,
  isConfirming,
}: FinalizeModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 font-sans animate-in fade-in">
      <div className="bg-white rounded-3xl p-6 md:p-8 max-w-md w-full shadow-2xl border border-line space-y-5 animate-in zoom-in-95">
        <div className="flex justify-between items-start">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-700">
              <AlertTriangle className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <h3 className="text-base font-bold text-ink font-headline">
                Xác nhận chốt bảng điểm
              </h3>
              <p className="text-xs text-ink-muted">Cảnh báo bài chưa xem</p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isConfirming}
            className="text-ink-muted hover:text-ink cursor-pointer p-1 rounded-lg"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 rounded-2xl bg-amber-50/60 border border-amber-200 text-xs text-amber-950 leading-relaxed font-medium">
          {`Còn ${unreviewedCount} bài AI chưa xem. Vẫn chốt theo điểm hiện tại?`}
        </div>

        <p className="text-xs text-ink-muted leading-relaxed">
          Sau khi chốt, các bài làm này sẽ tự động được đánh dấu đã duyệt và điểm chính thức sẽ được chụp lại để công bố cho học viên.
        </p>

        <div className="pt-2 flex space-x-3">
          <button
            type="button"
            onClick={onClose}
            disabled={isConfirming}
            className="flex-1 py-2.5 border border-line text-ink-muted rounded-xl text-xs font-bold hover:bg-surface-alt transition-colors cursor-pointer"
          >
            Hủy bỏ
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isConfirming}
            className="flex-1 py-2.5 bg-brand-600 hover:bg-brand-700 text-white rounded-xl text-xs font-bold shadow-xs flex items-center justify-center space-x-1.5 disabled:opacity-50 transition-colors cursor-pointer font-headline"
          >
            {isConfirming && <Loader2 className="w-4 h-4 animate-spin text-white" />}
            <span>Đồng ý chốt điểm</span>
          </button>
        </div>
      </div>
    </div>
  );
}
