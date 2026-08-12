"use client";

import { useState, useEffect } from "react";
import TeacherLayout from "@/components/TeacherLayout";
import { supabase } from "@/lib/supabase";
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
  image_url?: string;
  audio_url?: string;
  created_at?: string;
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

  const fetchFlashcards = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("flashcards")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Fetch flashcards error:", error);
      } else {
        setFlashcards(
          (data || []).map((row: any) => ({
            id: row.id,
            vietnamese_name: row.vietnamese_name || "",
            correct_english_word: row.correct_english_word || "",
            options: Array.isArray(row.options) ? row.options : [],
            image_url: row.image_url || "",
            audio_url: row.audio_url || "",
            created_at: row.created_at,
          }))
        );
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFlashcards();
  }, []);

  const handleOpenCreateModal = () => {
    setEditingCard(null);
    setVnName("");
    setEngWord("");
    setOptionsInput("");
    setImageUrl("https://images.unsplash.com/photo-1566073771259-6a8506099945?q=80&w=800&auto=format&fit=crop");
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

    // Make sure correct_english_word is among options or format options
    const finalOptions = Array.from(new Set([engWord.trim(), ...opts]));

    const cardId = editingCard ? editingCard.id : `fc_${Date.now()}`;

    const payload = {
      id: cardId,
      vietnamese_name: vnName.trim(),
      correct_english_word: engWord.trim(),
      options: finalOptions,
      image_url: imageUrl.trim() || "https://images.unsplash.com/photo-1566073771259-6a8506099945?q=80&w=800&auto=format&fit=crop",
      audio_url: audioUrl.trim() || null,
    };

    try {
      const { error } = await supabase.from("flashcards").upsert([payload]);

      if (error) {
        console.error("Save flashcard error:", error);
        alert("Lỗi lưu Flashcard: " + error.message);
      } else {
        setSuccessMsg(editingCard ? "Đã cập nhật flashcard thành công!" : "Đã thêm flashcard mới thành công!");
        setShowModal(false);
        fetchFlashcards();
        setTimeout(() => setSuccessMsg(""), 3500);
      }
    } catch (err: any) {
      console.error(err);
      alert("Lỗi hệ thống: " + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteFlashcard = async (id: string, name: string) => {
    if (!confirm(`Bạn có chắc chắn muốn xóa flashcard "${name}" không?`)) return;

    try {
      const { error } = await supabase.from("flashcards").delete().eq("id", id);
      if (error) {
        console.error("Delete error:", error);
        alert("Không thể xóa thẻ: " + error.message);
      } else {
        setSuccessMsg(`Đã xóa thẻ "${name}" thành công!`);
        fetchFlashcards();
        setTimeout(() => setSuccessMsg(""), 3500);
      }
    } catch (e: any) {
      console.error(e);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const fileExt = file.name.split(".").pop() || "jpg";
      const fileName = `fc_img_${Date.now()}_${Math.random().toString(36).substring(2, 6)}.${fileExt}`;
      const { data, error } = await supabase.storage.from("flashcard-assets").upload(fileName, file, {
        cacheControl: "3600",
        upsert: true,
      });

      if (!error && data) {
        const { data: publicData } = supabase.storage.from("flashcard-assets").getPublicUrl(fileName);
        if (publicData?.publicUrl) {
          setImageUrl(publicData.publicUrl);
          return;
        }
      }
    } catch (err) {
      console.warn("Storage upload fallback:", err);
    }

    const reader = new FileReader();
    reader.onload = (evt) => {
      if (evt.target?.result) setImageUrl(evt.target.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handlePlayAudio = (card: FlashcardItem) => {
    if (audioObj) {
      audioObj.pause();
    }

    const targetUrl = card.audio_url || `/api/tts?text=${encodeURIComponent(card.correct_english_word)}&gender=Female`;
    setPlayingAudioId(card.id);

    const newAudio = new Audio(targetUrl);
    setAudioObj(newAudio);

    newAudio.play().catch((err) => console.warn("Audio play error:", err));
    newAudio.onended = () => setPlayingAudioId(null);
  };

  const filteredCards = flashcards.filter((fc) => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;
    return (
      fc.vietnamese_name.toLowerCase().includes(q) ||
      fc.correct_english_word.toLowerCase().includes(q) ||
      fc.options.some((opt) => opt.toLowerCase().includes(q))
    );
  });

  return (
    <TeacherLayout>
      <div className="max-w-[1280px] mx-auto space-y-8 font-sans text-[#211a16]">
        {/* Header Section */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#d8c2b6]/40 pb-6">
          <div>
            <h1 className="font-headline text-3xl font-bold text-[#6d3807] tracking-tight flex items-center space-x-3">
              <Bookmark className="w-8 h-8 text-[#6d3807]" />
              <span>Quản Lý Thẻ Từ Vựng Flashcards</span>
            </h1>
            <p className="text-sm text-[#52443a] mt-1">
              Tạo và quản lý kho thẻ học từ vựng (Hình ảnh, Nghĩa Tiếng Việt, Từ Tiếng Anh và Các lựa chọn gây nhiễu) sử dụng cho đề thi.
            </p>
          </div>

          <button
            onClick={handleOpenCreateModal}
            className="px-5 py-2.5 bg-[#6d3807] hover:bg-[#8a4f1e] text-white text-xs font-bold rounded-xl shadow-sm transition-all flex items-center space-x-2 shrink-0 font-headline"
          >
            <Plus className="w-4.5 h-4.5 text-[#ffb782]" />
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
        <div className="bg-white p-4 rounded-2xl border border-[#d8c2b6] shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="relative w-full md:w-96">
            <Search className="w-4 h-4 text-[#857469] absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Tìm kiếm từ tiếng Anh, tiếng Việt..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-[#fff8f5] border border-[#d8c2b6] rounded-xl text-xs font-medium focus:outline-none focus:border-[#6d3807]"
            />
          </div>

          <div className="text-xs text-[#52443a] font-bold">
            Tổng số thẻ: <span className="text-[#6d3807] text-sm">{filteredCards.length}</span> / {flashcards.length} thẻ từ vựng
          </div>
        </div>

        {/* Grid View of Flashcards */}
        {loading ? (
          <div className="flex items-center justify-center space-x-2 text-xs text-[#52443a] py-20 bg-white rounded-3xl border border-[#d8c2b6]">
            <Loader2 className="w-5 h-5 animate-spin text-[#6d3807]" />
            <span className="font-bold">Đang nạp danh sách thẻ Flashcards từ Database...</span>
          </div>
        ) : filteredCards.length === 0 ? (
          <div className="py-16 text-center bg-white rounded-3xl border border-[#d8c2b6] space-y-4">
            <div className="w-14 h-14 bg-[#fff1ea] rounded-full flex items-center justify-center mx-auto text-[#6d3807]">
              <Bookmark className="w-7 h-7" />
            </div>
            <div className="space-y-1">
              <h3 className="text-base font-bold text-[#211a16]">Chưa có thẻ Flashcard nào</h3>
              <p className="text-xs text-[#52443a] max-w-md mx-auto">
                {searchQuery ? "Không tìm thấy thẻ phù hợp với từ khóa." : "Hãy bắt đầu tạo thẻ flashcard từ vựng đầu tiên cho học sinh."}
              </p>
            </div>
            {!searchQuery && (
              <button
                onClick={handleOpenCreateModal}
                className="px-4 py-2 bg-[#6d3807] text-white text-xs font-bold rounded-xl shadow-sm hover:bg-[#8a4f1e] transition-all"
              >
                + Tạo Thẻ Đầu Tiên
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {filteredCards.map((card) => (
              <div
                key={card.id}
                className="bg-white rounded-2xl border border-[#d8c2b6] shadow-sm hover:shadow-md transition-all overflow-hidden flex flex-col justify-between group"
              >
                {/* Image Container */}
                <div className="relative aspect-video w-full bg-[#fff8f5] border-b border-[#d8c2b6] overflow-hidden">
                  <img
                    src={card.image_url || "https://images.unsplash.com/photo-1566073771259-6a8506099945?q=80&w=800&auto=format&fit=crop"}
                    alt={card.vietnamese_name}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src =
                        "https://images.unsplash.com/photo-1566073771259-6a8506099945?q=80&w=800&auto=format&fit=crop";
                    }}
                  />
                  <div className="absolute top-2 right-2 flex space-x-1">
                    <button
                      onClick={() => handlePlayAudio(card)}
                      className="p-2 bg-white/90 backdrop-blur hover:bg-[#6d3807] hover:text-white text-[#6d3807] rounded-xl shadow-sm transition-all"
                      title="Nghe phát âm từ vựng"
                    >
                      <Volume2 className={`w-4 h-4 ${playingAudioId === card.id ? "animate-bounce text-amber-500" : ""}`} />
                    </button>
                  </div>
                </div>

                {/* Card Body */}
                <div className="p-4 space-y-3 flex-1 flex flex-col justify-between">
                  <div className="space-y-1">
                    <span className="text-[11px] font-bold text-[#857469] uppercase tracking-wider block">Nghĩa Tiếng Việt</span>
                    <h3 className="text-base font-bold text-[#6d3807] leading-snug">{card.vietnamese_name}</h3>
                  </div>

                  <div className="p-2.5 rounded-xl bg-[#fff8f5] border border-[#ffb782]/60 space-y-1">
                    <span className="text-[10px] font-bold text-[#857469] uppercase tracking-wider block">Từ Tiếng Anh Chuẩn</span>
                    <p className="text-sm font-bold text-[#211a16] font-mono tracking-wide flex items-center space-x-1.5">
                      <span>{card.correct_english_word}</span>
                    </p>
                  </div>

                  {/* Options Distractors */}
                  {card.options.length > 0 && (
                    <div className="space-y-1 pt-1">
                      <span className="text-[10px] font-bold text-[#857469] block">Các lựa chọn trắc nghiệm:</span>
                      <div className="flex flex-wrap gap-1">
                        {card.options.map((opt, i) => (
                          <span
                            key={i}
                            className={`px-2 py-0.5 rounded-md text-[11px] font-bold border ${
                              opt === card.correct_english_word
                                ? "bg-emerald-50 text-emerald-800 border-emerald-300"
                                : "bg-gray-50 text-[#52443a] border-gray-200"
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
                <div className="p-3 bg-[#fff8f5] border-t border-[#d8c2b6] flex items-center justify-end space-x-2">
                  <button
                    onClick={() => handleOpenEditModal(card)}
                    className="px-3 py-1.5 bg-white border border-[#d8c2b6] hover:bg-[#fff1ea] text-[#6d3807] rounded-xl text-xs font-bold flex items-center space-x-1 transition-all shadow-2xs"
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
              </div>
            ))}
          </div>
        )}

        {/* Modal Form Create / Edit */}
        {showModal && (
          <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white w-full max-w-lg rounded-3xl border border-[#d8c2b6] shadow-2xl overflow-hidden font-sans space-y-0 animate-in zoom-in-95">
              {/* Modal Header */}
              <div className="p-5 bg-[#fff8f5] border-b border-[#d8c2b6] flex items-center justify-between">
                <h3 className="font-headline text-lg font-bold text-[#6d3807] flex items-center space-x-2">
                  <Bookmark className="w-5 h-5 text-[#6d3807]" />
                  <span>{editingCard ? "Chỉnh Sửa Flashcard" : "Tạo Thẻ Flashcard Mới"}</span>
                </h3>
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="p-1.5 rounded-full hover:bg-gray-200 text-[#857469]"
                >
                  <XCircle className="w-5 h-5" />
                </button>
              </div>

              {/* Modal Body Form */}
              <form onSubmit={handleSaveFlashcard} className="p-6 space-y-4">
                <div>
                  <label className="block text-xs font-bold uppercase text-[#211a16] mb-1">
                    Nghĩa Tiếng Việt (*)
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ví dụ: Chỗ ở, nơi lưu trú"
                    value={vnName}
                    onChange={(e) => setVnName(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-[#fff8f5] border border-[#d8c2b6] rounded-xl text-sm font-medium text-[#211a16] focus:outline-none focus:border-[#6d3807]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase text-[#211a16] mb-1">
                    Từ Tiếng Anh Chuẩn (*)
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ví dụ: accommodation"
                    value={engWord}
                    onChange={(e) => setEngWord(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-[#fff8f5] border border-[#d8c2b6] rounded-xl text-sm font-bold text-[#6d3807] focus:outline-none focus:border-[#6d3807]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase text-[#211a16] mb-1">
                    Danh Sách Lựa Chọn Trắc Nghiệm (Cách nhau bằng dấu phẩy)
                  </label>
                  <input
                    type="text"
                    placeholder="Ví dụ: accommodation, destination, transportation, reservation"
                    value={optionsInput}
                    onChange={(e) => setOptionsInput(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-[#fff8f5] border border-[#d8c2b6] rounded-xl text-xs font-medium text-[#211a16] focus:outline-none focus:border-[#6d3807]"
                  />
                  <span className="text-[11px] text-[#857469] mt-1 block">
                    Nếu để trống, từ tiếng Anh chuẩn sẽ tự động được làm 1 lựa chọn.
                  </span>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase text-[#211a16] mb-1">
                    URL Hình Ảnh Minh Họa
                  </label>
                  <input
                    type="text"
                    placeholder="Ví dụ: https://images.unsplash.com/photo-..."
                    value={imageUrl}
                    onChange={(e) => setImageUrl(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-[#fff8f5] border border-[#d8c2b6] rounded-xl text-xs font-mono text-[#6d3807] focus:outline-none focus:border-[#6d3807]"
                  />
                  <div className="flex items-center space-x-2 mt-2">
                    <span className="text-[11px] text-[#857469]">Hoặc upload file ảnh từ máy tính:</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleFileUpload}
                      className="text-xs text-[#52443a]"
                    />
                  </div>
                </div>

                {/* Preview Image */}
                {imageUrl && (
                  <div className="p-3 bg-[#fff8f5] rounded-xl border border-[#d8c2b6] space-y-1">
                    <span className="text-[11px] font-bold text-[#6d3807] block">Preview Ảnh Minh Họa:</span>
                    <div className="aspect-video w-full rounded-lg overflow-hidden border border-[#d8c2b6]">
                      <img src={imageUrl} alt="Preview" className="w-full h-full object-cover" />
                    </div>
                  </div>
                )}

                {/* Actions */}
                <div className="pt-4 border-t border-[#d8c2b6] flex justify-end space-x-3">
                  <button
                    type="button"
                    onClick={() => setShowModal(false)}
                    className="px-4 py-2.5 bg-gray-100 text-[#52443a] hover:bg-gray-200 text-xs font-bold rounded-xl transition-all"
                  >
                    Hủy Bỏ
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="px-5 py-2.5 bg-[#6d3807] hover:bg-[#8a4f1e] text-white text-xs font-bold rounded-xl shadow-sm transition-all flex items-center space-x-2 disabled:opacity-50"
                  >
                    {isSubmitting ? (
                      <Loader2 className="w-4 h-4 animate-spin text-white" />
                    ) : (
                      <Bookmark className="w-4 h-4 text-[#ffb782]" />
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
