"use client";
// FEAT-017 TASK-058 — form sửa tại chỗ của từng dạng câu (docs/features/phan-bai-hoc-de-thi.md §4.1, bảng "Form từng dạng câu").
// Sửa thẳng content JSONB; server chuẩn hoá lại khi lưu (buildStandardQuestionContent).
import { useState } from "react";
import { ArrowDown, ArrowUp, Plus, Search, Trash2, X, Loader2 } from "lucide-react";
import ChipInput from "./ChipInput";
import {
  acceptedForms, bankDistractors, gapsOf, inlineDistractors, newKey, orderingPieces, previewShuffle, rewriteCue,
  sentenceList, withBankDistractors, withInlineDistractors, withSentenceList, moveItem, type EdQuestion,
} from "@/lib/section-editor";

type Rec = Record<string, unknown>;
export interface FlashcardInfo {
  id: string;
  vietnamese_name?: string;
  correct_english_word?: string;
  image_url?: string | null;
}

const str = (v: unknown) => (typeof v === "string" ? v : v == null ? "" : String(v));
const lbl = "text-xs font-semibold uppercase tracking-wide text-ink-muted";
const fld = "w-full rounded-xl border border-line bg-white px-3 py-2.5 text-sm text-ink outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100";
const hint = "text-[13px] leading-relaxed text-ink-muted";
const box = "flex flex-col gap-2.5 rounded-2xl border border-line bg-surface-alt p-3.5";

function Seg<T extends string>({ value, options, onChange, ariaLabel }: { value: T; options: [T, string][]; onChange: (v: T) => void; ariaLabel: string }) {
  return (
    <div role="group" aria-label={ariaLabel} className="inline-flex flex-wrap gap-1 rounded-xl bg-line-soft p-1">
      {options.map(([v, l]) => (
        <button
          key={v}
          type="button"
          aria-pressed={value === v}
          onClick={() => onChange(v)}
          className={`cursor-pointer rounded-lg px-3.5 py-2 text-sm ${value === v ? "bg-white font-semibold text-brand-700 shadow-xs" : "font-medium text-ink-muted hover:text-ink"}`}
        >
          {l}
        </button>
      ))}
    </div>
  );
}

export default function QuestionForm({
  question: q,
  numberFrom,
  isListeningSection,
  flashcards,
  onFlashcard,
  onChange,
  onUploadAudio,
}: {
  question: EdQuestion;
  numberFrom: number;
  isListeningSection: boolean;
  flashcards: Record<string, FlashcardInfo>;
  onFlashcard: (fc: FlashcardInfo) => void;
  onChange: (q: EdQuestion) => void;
  onUploadAudio: (file: File) => Promise<string | null>;
}) {
  const c = q.content;
  const set = (patch: Rec) => onChange({ ...q, content: { ...c, ...patch } });
  const cat = q.category;

  // ───── trắc nghiệm ─────
  if (cat.endsWith("_MC")) {
    const ans = str(c.correct_answer).toUpperCase() || "A";
    const audioMode = c.audio_url ? (str(c.audio_url).startsWith("/api/tts") ? "TTS" : "UPLOAD") : str(c._audio_mode) || "SECTION";
    return (
      <div className="flex flex-col gap-3.5">
        <label className="flex flex-col gap-1.5">
          <span className={lbl}>Câu hỏi</span>
          <textarea rows={2} className={fld} value={str(c.text)} onChange={(e) => set({ text: e.target.value })} placeholder="Để trống được với câu ngữ âm / trọng âm" />
        </label>
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
          {(["A", "B", "C", "D"] as const).map((L, i) => {
            const key = `option_${L.toLowerCase()}`;
            const on = ans === L;
            return (
              <div key={L} className="flex items-center gap-2">
                <button
                  type="button"
                  aria-pressed={on}
                  aria-label={`Đáp án đúng ${L}`}
                  onClick={() => set({ correct_answer: L })}
                  className={`h-10 w-10 shrink-0 cursor-pointer rounded-xl font-bold ${on ? "bg-brand-600 text-white" : "border border-line bg-white text-ink-muted hover:border-brand-300"}`}
                >
                  {L}
                </button>
                <input aria-label={`Phương án ${L}`} className={fld} value={str(c[key])} onChange={(e) => set({ [key]: e.target.value })} placeholder={i >= 2 ? "Để trống nếu không có" : ""} />
              </div>
            );
          })}
        </div>
        <span className={hint}>Bấm chữ cái để chọn đáp án đúng (đang chọn <b>{ans}</b>). Đề chỉ có 3 phương án thì để trống D.</span>
        {isListeningSection && (
          <div className={box}>
            <span className={lbl}>Audio riêng của câu (tuỳ chọn — mặc định dùng audio của phần)</span>
            <Seg
              ariaLabel="Audio câu"
              value={audioMode as "SECTION" | "UPLOAD" | "TTS"}
              options={[["SECTION", "Dùng audio của phần"], ["UPLOAD", "Tải lên"], ["TTS", "Giọng AI"]]}
              onChange={(v) => set({ _audio_mode: v, audio_url: v === "SECTION" ? null : c.audio_url ?? null })}
            />
            {audioMode === "UPLOAD" && (
              <div className="flex flex-wrap items-center gap-2">
                {c.audio_url ? <audio controls src={str(c.audio_url)} className="h-9" /> : <span className={hint}>Chưa có file.</span>}
                <input
                  type="file"
                  accept="audio/*"
                  aria-label="Tải audio của câu"
                  onChange={async (e) => {
                    const f = e.target.files?.[0];
                    if (!f) return;
                    const url = await onUploadAudio(f);
                    if (url) set({ audio_url: url, _audio_mode: "UPLOAD" });
                  }}
                  className="text-sm"
                />
              </div>
            )}
            {audioMode === "TTS" && (
              <textarea
                rows={2}
                className={fld}
                value={decodeURIComponent((str(c.audio_url).match(/text=([^&]*)/) || [])[1] || "")}
                onChange={(e) => set({ audio_url: e.target.value.trim() ? `/api/tts?text=${encodeURIComponent(e.target.value)}&gender=Female` : null, _audio_mode: "TTS" })}
                placeholder="Nội dung để AI đọc…"
              />
            )}
          </div>
        )}
      </div>
    );
  }

  // ───── điền ô ─────
  if (cat.endsWith("_FILL_IN") || cat === "WRITING_FREE_TYPING_BLANKS") {
    const kind = cat === "WRITING_FREE_TYPING_BLANKS" ? "FREE_TYPING" : (str(c.fill_subtype) || "OPTION_BANK");
    const gaps = gapsOf(c.passage);
    const range = gaps.length <= 1 ? `câu ${numberFrom}` : `câu ${numberFrom}–${numberFrom + gaps.length - 1}`;
    return (
      <div className="flex flex-col gap-3.5">
        {cat !== "WRITING_FREE_TYPING_BLANKS" && (
          <div className="flex flex-col gap-1.5">
            <span className={lbl}>Học sinh trả lời bằng</span>
            <Seg
              ariaLabel="Kiểu điền ô"
              value={kind as "OPTION_BANK" | "INLINE_SELECT" | "FREE_TYPING"}
              options={[["OPTION_BANK", "Kho từ chung"], ["INLINE_SELECT", "Chọn trong từng ô"], ["FREE_TYPING", "Tự gõ"]]}
              onChange={(v) => set({ fill_subtype: v })}
            />
          </div>
        )}
        <label className="flex flex-col gap-1.5">
          <span className={lbl}>Đoạn văn — đặt đáp án đúng trong [ngoặc vuông]</span>
          <textarea rows={4} className={fld} value={str(c.passage)} onChange={(e) => set({ passage: e.target.value })} placeholder="Ví dụ: Students who [join] a club often [feel] happier." />
        </label>
        <span className={hint}>{gaps.length} ô → chiếm {Math.max(1, gaps.length)} số ({range})</span>

        {kind === "OPTION_BANK" && (
          <div className={box}>
            <span className={lbl}>Kho từ dùng chung</span>
            <ChipInput
              ariaLabel="Thêm từ nhiễu vào kho"
              fixed={gaps}
              value={bankDistractors(c)}
              onChange={(list) => onChange({ ...q, content: withBankDistractors(c, list) })}
              placeholder="Thêm từ nhiễu, Enter hoặc dấu phẩy"
            />
            <span className={hint}>Đáp án (xanh) tự lấy từ đoạn văn. Học sinh thấy {gaps.length + bankDistractors(c).length} từ, xáo trộn.</span>
          </div>
        )}
        {kind === "INLINE_SELECT" && (
          <div className={box}>
            <span className={lbl}>Danh sách chọn của từng ô</span>
            {gaps.length === 0 && <span className={hint}>Nhập ít nhất một [đáp án] trong đoạn văn.</span>}
            {gaps.map((g, gi) => (
              <div key={gi} className="flex flex-wrap items-center gap-2 rounded-xl border border-line bg-white px-2.5 py-2">
                <b className="min-w-14 text-[13px] text-brand-700">Ô {numberFrom + gi}</b>
                <div className="min-w-64 flex-1">
                  <ChipInput
                    ariaLabel={`Từ nhiễu ô ${numberFrom + gi}`}
                    fixed={[g]}
                    value={inlineDistractors(c, gi)}
                    onChange={(list) => onChange({ ...q, content: withInlineDistractors(c, gi, list) })}
                    placeholder="Từ nhiễu của ô này…"
                  />
                </div>
              </div>
            ))}
            <span className={hint}>Mỗi ô có danh sách riêng: đáp án + từ nhiễu, học sinh chọn trong ô thả xuống.</span>
          </div>
        )}
        {kind === "FREE_TYPING" && (
          <div className={box}>
            <span className={lbl}>Đáp án được chấp nhận</span>
            {gaps.map((g, gi) => {
              const f = acceptedForms(g);
              return (
                <div key={gi} className="flex flex-wrap items-center gap-1.5">
                  <b className="min-w-14 text-[13px] text-brand-700">Ô {numberFrom + gi}</b>
                  {f.forms.map((w, wi) => (
                    <span key={wi} className="rounded-lg border border-emerald-300 bg-emerald-50 px-2.5 py-1 text-sm text-emerald-900">{w}</span>
                  ))}
                  {f.optional && <span className={hint}>· có thể bỏ: {f.optional}</span>}
                </div>
              );
            })}
            <span className={hint}>
              Nhiều đáp án đúng: <code>[river / stream]</code>. Từ có thể bỏ: <code>[(the) park]</code>. Không phân biệt hoa thường.
            </span>
          </div>
        )}
      </div>
    );
  }

  // ───── sắp xếp ─────
  if (cat.endsWith("_ORDERING")) {
    const type = c.ordering_type === "SENTENCE_ORDERING" ? "SENTENCE_ORDERING" : "WORD_ORDERING";
    const sents: string[] = Array.isArray(c._sentences) ? (c._sentences as string[]) : sentenceList(c);
    const pieces = orderingPieces(c);
    return (
      <div className="flex flex-col gap-3.5">
        <Seg
          ariaLabel="Kiểu sắp xếp"
          value={type}
          options={[["WORD_ORDERING", "Sắp xếp từ"], ["SENTENCE_ORDERING", "Sắp xếp câu"]]}
          onChange={(v) => set({ ordering_type: v })}
        />
        {type === "WORD_ORDERING" ? (
          <>
            <label className="flex flex-col gap-1.5">
              <span className={lbl}>Câu đúng</span>
              <input className={fld} value={str(c.correct_text)} onChange={(e) => set({ correct_text: e.target.value })} placeholder="People thought the story was written by the princess herself." />
            </label>
            <span className={hint}>
              Mặc định tách theo khoảng trắng. Muốn giữ cụm từ thì ngăn bằng dấu <code>/</code>, ví dụ <code>People thought / the story / was written by / the princess herself.</code>
            </span>
            <label className="flex flex-col gap-1.5">
              <span className={lbl}>Gợi ý hiện cho học sinh (tuỳ chọn)</span>
              <input className={fld} value={q.prompt} onChange={(e) => onChange({ ...q, prompt: e.target.value })} placeholder="Ví dụ: People / thought / story / written / the / princess / herself." />
            </label>
          </>
        ) : (
          <div className={box}>
            <span className={lbl}>Các câu theo thứ tự đúng</span>
            {sents.map((v, i) => (
              <div key={i} className="flex items-center gap-1.5">
                <b className="w-6 text-center text-[13px] text-brand-700">{i + 1}</b>
                <input aria-label={`Câu ${i + 1}`} className={fld} value={v} onChange={(e) => { const a = sents.slice(); a[i] = e.target.value; onChange({ ...q, content: withSentenceList(c, a) }); }} />
                <button type="button" aria-label="Lên" onClick={() => onChange({ ...q, content: withSentenceList(c, moveItem(sents, i, i - 1)) })} className="cursor-pointer rounded-lg p-2 text-ink-muted hover:bg-line-soft"><ArrowUp className="h-4 w-4" /></button>
                <button type="button" aria-label="Xuống" onClick={() => onChange({ ...q, content: withSentenceList(c, moveItem(sents, i, i + 1)) })} className="cursor-pointer rounded-lg p-2 text-ink-muted hover:bg-line-soft"><ArrowDown className="h-4 w-4" /></button>
                <button type="button" aria-label={`Xoá câu ${i + 1}`} onClick={() => onChange({ ...q, content: withSentenceList(c, sents.filter((_, j) => j !== i)) })} className="cursor-pointer rounded-lg p-2 text-rose-600 hover:bg-rose-50"><X className="h-4 w-4" /></button>
              </div>
            ))}
            <button type="button" onClick={() => onChange({ ...q, content: withSentenceList(c, [...sents, ""]) })} className="inline-flex w-fit cursor-pointer items-center gap-1.5 rounded-xl border border-line bg-white px-3 py-2 text-sm font-medium hover:bg-surface-alt">
              <Plus className="h-4 w-4" /> Thêm câu
            </button>
          </div>
        )}
        <div className="flex flex-col gap-1.5">
          <span className={lbl}>Học sinh sẽ thấy ({pieces.length} mảnh, xáo trộn)</span>
          <div className="flex flex-wrap gap-1.5">
            {previewShuffle(pieces).map((w, i) => (
              <span key={i} className="rounded-lg border border-brand-200 bg-brand-50 px-2.5 py-1 text-sm text-brand-800">{w}</span>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // ───── nối cặp ─────
  if (cat.endsWith("_MATCHING")) {
    const pairs = (Array.isArray(c.pairs) ? (c.pairs as Rec[]) : []).map((p) => ({ id: str(p.id) || newKey("mp"), left: str(p.left), right: str(p.right) }));
    const setPairs = (next: typeof pairs) => set({ pairs: next });
    return (
      <div className={box}>
        <div className="grid grid-cols-[28px_minmax(0,1fr)_minmax(0,1fr)_36px] items-center gap-1.5">
          <span /><span className={lbl}>Cột A</span><span className={lbl}>Cột B (đáp án)</span><span />
        </div>
        {pairs.map((p, i) => (
          <div key={p.id} className="grid grid-cols-[28px_minmax(0,1fr)_minmax(0,1fr)_36px] items-center gap-1.5">
            <b className="text-center text-[13px] text-brand-700">{numberFrom + i}</b>
            <input aria-label={`Cột A dòng ${numberFrom + i}`} className={fld} value={p.left} onChange={(e) => setPairs(pairs.map((x, j) => (j === i ? { ...x, left: e.target.value } : x)))} />
            <input aria-label={`Cột B dòng ${numberFrom + i}`} className={fld} value={p.right} onChange={(e) => setPairs(pairs.map((x, j) => (j === i ? { ...x, right: e.target.value } : x)))} />
            <button type="button" aria-label={`Xoá cặp ${numberFrom + i}`} onClick={() => setPairs(pairs.filter((_, j) => j !== i))} className="cursor-pointer rounded-lg p-2 text-rose-600 hover:bg-rose-50"><X className="h-4 w-4" /></button>
          </div>
        ))}
        <button type="button" onClick={() => setPairs([...pairs, { id: newKey("mp"), left: "", right: "" }])} className="inline-flex w-fit cursor-pointer items-center gap-1.5 rounded-xl border border-line bg-white px-3 py-2 text-sm font-medium hover:bg-surface-alt">
          <Plus className="h-4 w-4" /> Thêm cặp
        </button>
        <span className={hint}>{pairs.length} cặp → chiếm {Math.max(1, pairs.length)} số. Học sinh thấy cột B xáo trộn.</span>
      </div>
    );
  }

  // ───── bộ flashcard ─────
  if (cat.endsWith("_FLASHCARD_SET")) return <FlashcardSetForm q={q} flashcards={flashcards} onFlashcard={onFlashcard} onChange={onChange} />;

  // ───── bài luận ─────
  if (cat === "WRITING_ESSAY") {
    return (
      <div className="flex flex-col gap-3.5">
        <label className="flex flex-col gap-1.5">
          <span className={lbl}>Đề bài</span>
          <textarea rows={4} className={fld} value={q.prompt} onChange={(e) => onChange({ ...q, prompt: e.target.value })} />
        </label>
        <div className="flex flex-wrap items-end gap-4">
          <div className="flex flex-col gap-1.5">
            <span className={lbl}>Loại bài</span>
            <Seg ariaLabel="Loại bài" value={(str(c.task_type) || "Task 2") as "Task 1" | "Task 2"} options={[["Task 1", "Task 1 / đoạn văn, thư"], ["Task 2", "Task 2 / bài luận"]]} onChange={(v) => set({ task_type: v })} />
          </div>
          <label className="flex flex-col gap-1.5">
            <span className={lbl}>Số từ tối thiểu</span>
            <input type="number" min={0} className={`${fld} w-28`} value={str(c.min_words)} onChange={(e) => set({ min_words: Number(e.target.value) || 0 })} />
          </label>
        </div>
        <span className={hint}>Chấm bằng AI theo bộ tiêu chí của chuẩn chấm đề.</span>
      </div>
    );
  }

  // ───── trả lời ngắn ─────
  if (cat === "WRITING_SHORT_ANSWER") {
    return (
      <div className="flex flex-col gap-3.5">
        <label className="flex flex-col gap-1.5">
          <span className={lbl}>Câu hỏi</span>
          <input className={fld} value={str(c.text)} onChange={(e) => set({ text: e.target.value })} />
        </label>
        <div className="flex flex-wrap gap-3">
          <label className="flex flex-col gap-1.5">
            <span className={lbl}>Tối đa (từ)</span>
            <input type="number" min={1} className={`${fld} w-28`} value={str(c.max_words)} onChange={(e) => set({ max_words: Number(e.target.value) || 1 })} />
          </label>
          <label className="flex min-w-60 flex-1 flex-col gap-1.5">
            <span className={lbl}>Đáp án mẫu (giúp AI chấm, tuỳ chọn)</span>
            <input className={fld} value={str(c.sample_answer)} onChange={(e) => set({ sample_answer: e.target.value })} />
          </label>
        </div>
      </div>
    );
  }

  // ───── viết lại câu ─────
  if (cat === "WRITING_SENTENCE_REWRITE") {
    const cue = rewriteCue(c.correct_answer);
    return (
      <div className="flex flex-col gap-3.5">
        <label className="flex flex-col gap-1.5">
          <span className={lbl}>Câu gốc</span>
          <input className={fld} value={str(c.original_sentence)} onChange={(e) => set({ original_sentence: e.target.value })} />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className={lbl}>Câu viết lại đúng — đặt phần gợi ý trong [ngoặc vuông]</span>
          <input className={fld} value={str(c.correct_answer)} onChange={(e) => set({ correct_answer: e.target.value })} placeholder="[Unless] you hurry, you will miss the bus." />
        </label>
        <div className={box}>
          <span className={lbl}>Học sinh thấy</span>
          <span className="text-[15px]">{str(c.original_sentence)}</span>
          <span className="text-[15px]">→ <b className="text-accent-700">{cue || "(chưa có gợi ý)"}</b> ______________________</span>
        </div>
        <span className={hint}>Nhiều cách viết đúng: ngăn bằng <code> / </code>.</span>
      </div>
    );
  }

  // ───── Speaking ─────
  if (cat === "SPEAKING_READ_ALOUD") {
    return (
      <label className="flex flex-col gap-1.5">
        <span className={lbl}>Đoạn học sinh đọc to</span>
        <textarea rows={4} className={fld} value={str(c.passage)} onChange={(e) => set({ passage: e.target.value })} />
      </label>
    );
  }
  return (
    <label className="flex flex-col gap-1.5">
      <span className={lbl}>Chủ đề / câu hỏi nói</span>
      <textarea rows={4} className={fld} value={q.prompt} onChange={(e) => onChange({ ...q, prompt: e.target.value })} />
      <span className={hint}>Học sinh ghi âm câu trả lời, AI chấm phát âm và nội dung.</span>
    </label>
  );
}

function FlashcardSetForm({ q, flashcards, onFlashcard, onChange }: {
  q: EdQuestion;
  flashcards: Record<string, FlashcardInfo>;
  onFlashcard: (fc: FlashcardInfo) => void;
  onChange: (q: EdQuestion) => void;
}) {
  const ids: string[] = Array.isArray(q.content.flashcard_ids) ? (q.content.flashcard_ids as string[]) : [];
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<FlashcardInfo[]>([]);
  const [busy, setBusy] = useState(false);
  const [vi, setVi] = useState("");
  const [en, setEn] = useState("");
  const [img, setImg] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const setIds = (next: string[]) => onChange({ ...q, content: { ...q.content, flashcard_ids: next } });

  const search = async (v: string) => {
    setQuery(v);
    if (!v.trim()) return setResults([]);
    setBusy(true);
    try {
      const res = await fetch(`/api/teacher/flashcards?q=${encodeURIComponent(v.trim())}`);
      const data = await res.json().catch(() => null);
      setResults(((data?.flashcards || []) as FlashcardInfo[]).filter((f) => !ids.includes(f.id)).slice(0, 12));
    } finally {
      setBusy(false);
    }
  };
  const create = async () => {
    setErr(null);
    if (!vi.trim() || !en.trim()) return setErr("Nhập đủ từ tiếng Anh và nghĩa tiếng Việt.");
    const res = await fetch("/api/teacher/flashcards", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        vietnamese_name: vi.trim(), correct_english_word: en.trim(), options: [en.trim()], image_url: img.trim() || null,
        audio_url: `/api/tts?text=${encodeURIComponent(en.trim())}&gender=Female`,
      }),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok || !data?.flashcard?.id) return setErr(data?.error || "Không lưu được thẻ.");
    onFlashcard(data.flashcard);
    setIds([...ids, data.flashcard.id]);
    setVi(""); setEn(""); setImg("");
  };

  return (
    <div className="flex flex-col gap-3.5">
      <label className="flex flex-col gap-1.5">
        <span className={lbl}>Tên bộ thẻ</span>
        <input className={fld} value={q.prompt} onChange={(e) => onChange({ ...q, prompt: e.target.value })} placeholder="Ví dụ: Từ vựng chủ đề Gia đình" />
      </label>
      <div className="grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-2.5">
        {ids.map((id) => {
          const f = flashcards[id];
          return (
            <div key={id} className="flex flex-col overflow-hidden rounded-2xl border border-line bg-white">
              {f?.image_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={f.image_url} alt={f.vietnamese_name || ""} className="h-20 w-full object-cover" />
              ) : (
                <div className="flex h-20 items-center justify-center bg-accent-50 font-display text-2xl font-bold text-accent-600">
                  {(f?.correct_english_word || "?").slice(0, 1).toUpperCase()}
                </div>
              )}
              <div className="flex flex-col gap-0.5 px-2.5 py-2">
                <b className="text-sm">{f?.correct_english_word || id}</b>
                <span className="text-[13px] text-ink-muted">{f?.vietnamese_name || ""}</span>
              </div>
              <button type="button" onClick={() => setIds(ids.filter((x) => x !== id))} className="cursor-pointer border-t border-line-soft py-2 text-[13px] text-rose-700 hover:bg-rose-50">
                Bỏ khỏi bộ
              </button>
            </div>
          );
        })}
      </div>
      <div className={box}>
        <span className={lbl}>Thêm từ thư viện flashcard</span>
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-subtle" />
          <input aria-label="Tìm flashcard" className={`${fld} pl-9`} value={query} onChange={(e) => search(e.target.value)} placeholder="Gõ từ tiếng Anh hoặc tiếng Việt…" />
          {busy && <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-brand-600" />}
        </div>
        <div className="flex flex-wrap gap-1.5">
          {results.map((f) => (
            <button key={f.id} type="button" onClick={() => { onFlashcard(f); setIds([...ids, f.id]); setResults(results.filter((x) => x.id !== f.id)); }} className="inline-flex cursor-pointer items-center gap-1 rounded-xl border border-line bg-white px-3 py-1.5 text-[13px] hover:border-brand-300">
              <Plus className="h-3.5 w-3.5" /> {f.correct_english_word} · {f.vietnamese_name}
            </button>
          ))}
        </div>
        <span className={`${lbl} pt-1.5`}>Hoặc tạo thẻ mới</span>
        <div className="grid grid-cols-[repeat(auto-fit,minmax(160px,1fr))] gap-2">
          <input aria-label="Từ tiếng Anh" className={fld} value={en} onChange={(e) => setEn(e.target.value)} placeholder="Từ tiếng Anh" />
          <input aria-label="Nghĩa tiếng Việt" className={fld} value={vi} onChange={(e) => setVi(e.target.value)} placeholder="Nghĩa tiếng Việt" />
          <input aria-label="Link ảnh minh hoạ" className={fld} value={img} onChange={(e) => setImg(e.target.value)} placeholder="Link ảnh minh hoạ (tuỳ chọn)" />
        </div>
        {err && <span className="text-[13px] text-rose-700">{err}</span>}
        <button type="button" onClick={create} className="w-fit cursor-pointer rounded-xl border border-line bg-white px-3 py-2 text-[13px] font-medium hover:bg-surface-alt">
          Lưu vào thư viện và thêm vào bộ
        </button>
      </div>
      <span className={hint}>{ids.length} thẻ · chiếm 1 số, mỗi thẻ 1 điểm</span>
      {ids.length === 0 && <span className="inline-flex items-center gap-1 text-[13px] text-amber-800"><Trash2 className="h-3.5 w-3.5" /> Bộ thẻ chưa có thẻ nào.</span>}
    </div>
  );
}
