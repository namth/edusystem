"use client";

import { useState, useEffect } from "react";
import TeacherLayout from "@/components/TeacherLayout";
import {
  Plus,
  Search,
  Trash2,
  Edit3,
  Volume2,
  Loader2,
  Bookmark,
  CheckCircle2,
  XCircle,
} from "lucide-react";

interface FlashcardItem {
  id: string;
  vietnamese_name: string;
  correct_english_word: string;
  options: string[];
  image_url?: string | null;
  audio_url?: string | null;
  created_at?: string;
  created_by?: string | null;
  can_edit?: boolean;
}

export default function TeacherFlashcardManagerPage() {
  const [flashcards, setFlashcards] = useState<FlashcardItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  // Modal / Form state
  const [showModal, setShowModal] = useState(false);
  const [editingCard, setEditingCard] = useState<FlashcardItem | null>(null);

  // Form Fields
  const [vnName, setVnName] = useState("");
  const [engWord, setEngWord] = useState("");
  const [optionsInput, setOptionsInput] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [audioUrl, setAudioUrl] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");

  // Audio Playback state
  const [playingAudioId, setPlayingAudioId] = useState<string | null>(null);
  const [audioObj, setAudioObj] = useState<HTMLAudioElement | null>(null);

  const fetchFlashcards = async (query = searchQuery) => {
    setLoading(true);
    try {
      const url = query.trim()
        ? `/api/teacher/flashcards?q=${encodeURIComponent(query.trim())}`
        : "/api/teacher/flashcards";
      const res = await fetch(url);
      const data = await res.json();

      if (!res.ok) {
        console.error("Fetch flashcards error:", data?.error);
      } else {
        setFlashcards(
          (data.flashcards || []).map((row: any) => ({
            id: row.id,
            vietnamese_name: row.vietnamese_name || "",
            correct_english_word: row.correct_english_word || "",
            options: Array.isArray(row.options) ? row.options : [],
            image_url: row.image_url || null,
            audio_url: row.audio_url || null,
            created_at: row.created_at,
            created_by: row.created_by,
            can_edit: row.can_edit,
          }))
        );
      }
    } catch (e) {
      console.error("Fetch flashcards error:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchFlashcards(searchQuery);
    }, 250);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const handleOpenCreateModal = () => {
    setEditingCard(null);
    setVnName("");
    setEngWord("");
    setOptionsInput("");
    setImageUrl("");
    setAudioUrl("");
    setShowModal(true);
  };

  const handleOpenEditModal = (card: FlashcardItem) => {
    setEditingCard(card);
    setVnName(card.vietnamese_name);
    setEngWord(card.correct_english_word);
    setOptionsInput(card.options.join(", "));
    setImageUrl(card.image_url || "");
    setAudioUrl(card.audio_url || "");
    setShowModal(true);
  };

  const handleSaveFlashcard = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!vnName.trim() || !engWord.trim()) {
      alert("Vui lòng nhập Nghĩa tiếng Việt và Từ tiếng Anh!");
      return;
    }

    setIsSubmitting(true);

    const opts = optionsInput
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    // Make sure correct_english_word is among options
    const finalOptions = Array.from(new Set([engWord.trim(), ...opts]));

    const payload = {
      vietnamese_name: vnName.trim(),
      correct_english_word: engWord.trim(),
      options: finalOptions,
      image_url: imageUrl.trim() || null,
      audio_url: audioUrl.trim() || null,
    };

    try {
      const url = editingCard
        ? `/api/teacher/flashcards/${editingCard.id}`
        : "/api/teacher/flashcards";
      const method = editingCard ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const resData = await res.json().catch(() => null);

      if (!res.ok || !resData?.success) {
        console.error("Save flashcard error:", resData?.error);
        alert("Lỗi lưu Flashcard: " + (resData?.error || res.statusText));
      } else {
        setSuccessMsg(
          editingCard
            ? "Đã cập nhật flashcard thành công!"
            : "Đã thêm flashcard mới thành công!"
        );
        setShowModal(false);
        fetchFlashcards();
        setTimeout(() => setSuccessMsg(""), 3500);
      }
    } catch (err: any) {
      console.error(err);
      alert("Lỗi hệ thống: " + (err.message || err));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteFlashcard = async (id: string, name: string) => {
    if (!confirm(`Bạn có chắc chắn muốn xóa flashcard "${name}" không?`)) return;

    try {
      const res = await fetch(`/api/teacher/flashcards/${id}`, {
        method: "DELETE",
      });

      const data = await res.json().catch(() => null);

      if (res.status === 409) {
        const count = data?.question_ids?.length || 0;
        alert(`Thẻ đang được dùng trong ${count} câu hỏi`);
        return;
      }

      if (!res.ok || !data?.success) {
        console.error("Delete error:", data?.error);
        alert("Không thể xóa thẻ: " + (data?.error || res.statusText));
      } else {
        setSuccessMsg(`Đã xóa thẻ "${name}" thành công!`);
        fetchFlashcards();
        setTimeout(() => setSuccessMsg(""), 3500);
      }
    } catch (e: any) {
      console.error(e);
      alert("Lỗi hệ thống khi xóa thẻ: " + (e.message || e));
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const fd = new FormData();
      fd.append("kind", "image");
      fd.append("file", file);

      const res = await fetch("/api/uploads", {
        method: "POST",
        body: fd,
      });

      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.success) {
        alert("Lỗi upload ảnh: " + (data?.error || res.statusText));
        return;
      }

      if (data.url) {
        setImageUrl(data.url);
      }
    } catch (err: any) {
      console.error("Upload error:", err);
      alert("Lỗi tải ảnh lên: " + (err.message || err));
    }
  };

  const handlePlayAudio = (card: FlashcardItem) => {
    if (audioObj) {
      audioObj.pause();
    }

    const targetUrl =
      card.audio_url ||
      `/api/tts?text=${encodeURIComponent(card.correct_english_word)}&gender=Female`;
    setPlayingAudioId(card.id);

    const newAudio = new Audio(targetUrl);
    setAudioObj(newAudio);

    newAudio.play().catch((err) => console.warn("Audio play error:", err));
    newAudio.onended = () => setPlayingAudioId(null);
  };

  return (
    <TeacherLayout>
      <div className="max-w-[1280px] mx-auto space-y-8 font-sans text-ink">
        {/* Header Section */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-line/40 pb-6">
          <div>
            <h1 className="font-headline text-3xl font-bold text-brand-600 tracking-tight flex items-center space-x-3">
              <Bookmark className="w-8 h-8 text-brand-600" />
              <span>Quản Lý Thẻ Từ Vựng Flashcards</span>
            </h1>
            <p className="text-sm text-ink-muted mt-1">
              Tạo và quản lý kho thẻ học từ vựng (Hình ảnh, Nghĩa Tiếng Việt, Từ Tiếng Anh và Các lựa chọn gây nhiễu) sử dụng cho đề thi.
            </p>
          </div>

          <button
            onClick={handleOpenCreateModal}
            className="px-5 py-2.5 bg-brand-600 hover:bg-brand-700 text-white text-xs font-bold rounded-xl shadow-sm transition-all flex items-center space-x-2 shrink-0 font-headline"
          >
            <Plus className="w-4.5 h-4.5 text-accent-400" />
            <span>Thêm Flashcard Mới</span>
          </button>
        </div>

        {/* Success Alert Banner */}
        {successMsg && (
          <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-300 text-emerald-800 text-xs font-bold flex items-center space-x-2 shadow-2xs">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Filter and Search Bar */}
        <div className="bg-white p-4 rounded-2xl border border-line shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="relative w-full md:w-96">
            <Search className="w-4 h-4 text-ink-subtle absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Tìm kiếm từ tiếng Anh, tiếng Việt..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-surface-alt border border-line rounded-xl text-xs font-medium focus:outline-none focus:border-brand-600"
            />
          </div>

          <div className="text-xs text-ink-muted font-bold">
            Tổng số thẻ: <span className="text-brand-600 text-sm">{flashcards.length}</span> thẻ từ vựng
          </div>
        </div>

        {/* Grid View of Flashcards */}
        {loading ? (
          <div className="flex items-center justify-center space-x-2 text-xs text-ink-muted py-20 bg-white rounded-3xl border border-line">
            <Loader2 className="w-5 h-5 animate-spin text-brand-600" />
            <span className="font-bold">Đang nạp danh sách thẻ Flashcards từ Database...</span>
          </div>
        ) : flashcards.length === 0 ? (
          <div className="py-16 text-center bg-white rounded-3xl border border-line space-y-4">
            <div className="w-14 h-14 bg-brand-50 rounded-full flex items-center justify-center mx-auto text-brand-600">
              <Bookmark className="w-7 h-7" />
            </div>
            <div className="space-y-1">
              <h3 className="text-base font-bold text-ink">Chưa có thẻ Flashcard nào</h3>
              <p className="text-xs text-ink-muted max-w-md mx-auto">
                {searchQuery ? "Không tìm thấy thẻ phù hợp với từ khóa." : "Hãy bắt đầu tạo thẻ flashcard từ vựng đầu tiên cho học sinh."}
              </p>
            </div>
            {!searchQuery && (
              <button
                onClick={handleOpenCreateModal}
                className="px-4 py-2 bg-brand-600 text-white text-xs font-bold rounded-xl shadow-sm hover:bg-brand-700 transition-all"
              >
                + Tạo Thẻ Đầu Tiên
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {flashcards.map((card) => (
              <div
                key={card.id}
                className="bg-white rounded-2xl border border-line shadow-sm hover:shadow-md transition-all overflow-hidden flex flex-col justify-between group"
              >
                {/* Image Container */}
                <div className="relative aspect-video w-full bg-surface-alt border-b border-line overflow-hidden flex items-center justify-center">
                  {card.image_url ? (
                    <img
                      src={card.image_url}
                      alt={card.vietnamese_name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  ) : (
                    <div className="flex flex-col items-center justify-center text-ink-subtle space-y-1">
                      <Bookmark className="w-8 h-8 opacity-25" />
                      <span className="text-[11px] font-medium text-ink-subtle">Chưa có hình ảnh</span>
                    </div>
                  )}
                  <div className="absolute top-2 right-2 flex space-x-1">
                    <button
                      onClick={() => handlePlayAudio(card)}
                      className="p-2 bg-white/90 backdrop-blur hover:bg-brand-600 hover:text-white text-brand-600 rounded-xl shadow-sm transition-all"
                      title="Nghe phát âm từ vựng"
                    >
                      <Volume2 className={`w-4 h-4 ${playingAudioId === card.id ? "animate-bounce text-amber-500" : ""}`} />
                    </button>
                  </div>
                </div>

                {/* Card Body */}
                <div className="p-4 space-y-3 flex-1 flex flex-col justify-between">
                  <div className="space-y-1">
                    <span className="text-[11px] font-bold text-ink-subtle uppercase tracking-wider block">Nghĩa Tiếng Việt</span>
                    <h3 className="text-base font-bold text-brand-600 leading-snug">{card.vietnamese_name}</h3>
                  </div>

                  <div className="p-2.5 rounded-xl bg-surface-alt border border-brand-300/60 space-y-1">
                    <span className="text-[10px] font-bold text-ink-subtle uppercase tracking-wider block">Từ Tiếng Anh Chuẩn</span>
                    <p className="text-sm font-bold text-ink font-mono tracking-wide flex items-center space-x-1.5">
                      <span>{card.correct_english_word}</span>
                    </p>
                  </div>

                  {/* Options Distractors */}
                  {card.options.length > 0 && (
                    <div className="space-y-1 pt-1">
                      <span className="text-[10px] font-bold text-ink-subtle block">Các lựa chọn trắc nghiệm:</span>
                      <div className="flex flex-wrap gap-1">
                        {card.options.map((opt, i) => (
                          <span
                            key={i}
                            className={`px-2 py-0.5 rounded-md text-[11px] font-bold border ${
                              opt === card.correct_english_word
                                ? "bg-emerald-50 text-emerald-800 border-emerald-300"
                                : "bg-gray-50 text-ink-muted border-gray-200"
                            }`}
                          >
                            {opt}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Footer Action Buttons */}
                {card.can_edit !== false && (
                  <div className="p-3 bg-surface-alt border-t border-line flex items-center justify-end space-x-2">
                    <button
                      onClick={() => handleOpenEditModal(card)}
                      className="px-3 py-1.5 bg-white border border-line hover:bg-brand-50 text-brand-600 rounded-xl text-xs font-bold flex items-center space-x-1 transition-all shadow-2xs"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                      <span>Sửa</span>
                    </button>

                    <button
                      onClick={() => handleDeleteFlashcard(card.id, card.vietnamese_name)}
                      className="p-1.5 text-rose-600 hover:bg-rose-50 border border-rose-200 rounded-xl transition-all"
                      title="Xóa flashcard"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Modal Form Create / Edit */}
        {showModal && (
          <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white w-full max-w-lg rounded-3xl border border-line shadow-2xl overflow-hidden font-sans space-y-0 animate-in zoom-in-95">
              {/* Modal Header */}
              <div className="p-5 bg-surface-alt border-b border-line flex items-center justify-between">
                <h3 className="font-headline text-lg font-bold text-brand-600 flex items-center space-x-2">
                  <Bookmark className="w-5 h-5 text-brand-600" />
                  <span>{editingCard ? "Chỉnh Sửa Flashcard" : "Tạo Thẻ Flashcard Mới"}</span>
                </h3>
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="p-1.5 rounded-full hover:bg-gray-200 text-ink-subtle"
                >
                  <XCircle className="w-5 h-5" />
                </button>
              </div>

              {/* Modal Body Form */}
              <form onSubmit={handleSaveFlashcard} className="p-6 space-y-4">
                <div>
                  <label className="block text-xs font-bold uppercase text-ink mb-1">
                    Nghĩa Tiếng Việt (*)
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ví dụ: Chỗ ở, nơi lưu trú"
                    value={vnName}
                    onChange={(e) => setVnName(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-surface-alt border border-line rounded-xl text-sm font-medium text-ink focus:outline-none focus:border-brand-600"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase text-ink mb-1">
                    Từ Tiếng Anh Chuẩn (*)
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ví dụ: accommodation"
                    value={engWord}
                    onChange={(e) => setEngWord(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-surface-alt border border-line rounded-xl text-sm font-bold text-brand-600 focus:outline-none focus:border-brand-600"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase text-ink mb-1">
                    Danh Sách Lựa Chọn Trắc Nghiệm (Cách nhau bằng dấu phẩy)
                  </label>
                  <input
                    type="text"
                    placeholder="Ví dụ: accommodation, destination, transportation, reservation"
                    value={optionsInput}
                    onChange={(e) => setOptionsInput(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-surface-alt border border-line rounded-xl text-xs font-medium text-ink focus:outline-none focus:border-brand-600"
                  />
                  <span className="text-[11px] text-ink-subtle mt-1 block">
                    Nếu để trống, từ tiếng Anh chuẩn sẽ tự động được làm 1 lựa chọn.
                  </span>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase text-ink mb-1">
                    URL Hình Ảnh Minh Họa
                  </label>
                  <input
                    type="text"
                    placeholder="Ví dụ: https://..."
                    value={imageUrl}
                    onChange={(e) => setImageUrl(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-surface-alt border border-line rounded-xl text-xs font-mono text-brand-600 focus:outline-none focus:border-brand-600"
                  />
                  <div className="flex items-center space-x-2 mt-2">
                    <span className="text-[11px] text-ink-subtle">Hoặc upload file ảnh từ máy tính:</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleFileUpload}
                      className="text-xs text-ink-muted"
                    />
                  </div>
                </div>

                {/* Preview Image */}
                {imageUrl && (
                  <div className="p-3 bg-surface-alt rounded-xl border border-line space-y-1">
                    <span className="text-[11px] font-bold text-brand-600 block">Preview Ảnh Minh Họa:</span>
                    <div className="aspect-video w-full rounded-lg overflow-hidden border border-line">
                      <img src={imageUrl} alt="Preview" className="w-full h-full object-cover" />
                    </div>
                  </div>
                )}

                {/* Actions */}
                <div className="pt-4 border-t border-line flex justify-end space-x-3">
                  <button
                    type="button"
                    onClick={() => setShowModal(false)}
                    className="px-4 py-2.5 bg-gray-100 text-ink-muted hover:bg-gray-200 text-xs font-bold rounded-xl transition-all"
                  >
                    Hủy Bỏ
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="px-5 py-2.5 bg-brand-600 hover:bg-brand-700 text-white text-xs font-bold rounded-xl shadow-sm transition-all flex items-center space-x-2 disabled:opacity-50"
                  >
                    {isSubmitting ? (
                      <Loader2 className="w-4 h-4 animate-spin text-white" />
                    ) : (
                      <Bookmark className="w-4 h-4 text-accent-400" />
                    )}
                    <span>{editingCard ? "Cập Nhật Thẻ" : "Lưu Flashcard Mới"}</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </TeacherLayout>
  );
}
