// Bộ icon động cho landing KitoKit: mỗi icon là một "giao diện thu nhỏ" chạy bằng CSS (keyframes kk-* trong app/globals.css).
// Không dùng JS → render được ở Server Component; tự tắt khi người dùng bật giảm chuyển động.
import type { CSSProperties, ReactNode } from "react";

const delay = (s: number): CSSProperties => ({ animationDelay: `${s}s` });

function Stage({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div aria-hidden className={`relative h-44 overflow-hidden rounded-2xl border border-line-soft bg-surface-alt kk-grid-bg flex items-center justify-center ${className}`}>
      {children}
    </div>
  );
}

function Line({ w, tone = "bg-line" }: { w: string; tone?: string }) {
  return <div className={`h-1.5 rounded-full ${tone}`} style={{ width: w }} />;
}

// 01 — AI chấm bài Viết/Nói cho học sinh: quét bài làm → vòng điểm chạy lên → nhận xét hiện ra
export function AiGradingMotion() {
  return (
    <Stage>
      <div className="flex items-center gap-5">
        <div className="relative w-28 rounded-xl bg-white border border-line shadow-xs p-3 space-y-2 overflow-hidden">
          <div className="text-[9px] font-bold text-ink-subtle uppercase tracking-wider">Bài viết</div>
          <Line w="100%" />
          <Line w="85%" />
          <Line w="92%" />
          <Line w="60%" />
          <Line w="78%" />
          <div className="kk-scan absolute inset-x-0 top-0 h-6 bg-gradient-to-b from-transparent via-brand-400/30 to-transparent" />
        </div>
        <div className="flex flex-col items-center gap-2">
          <div className="relative w-20 h-20">
            <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90">
              <circle cx="18" cy="18" r="15.9" fill="none" className="stroke-line" strokeWidth="3" />
              <circle cx="18" cy="18" r="15.9" fill="none" className="stroke-brand-600 kk-ring" strokeWidth="3" strokeLinecap="round" pathLength={100} />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="kk-pop font-display text-xl font-extrabold text-ink" style={delay(1.4)}>8.5</span>
              <span className="text-[8px] font-bold text-ink-subtle">AI chấm</span>
            </div>
          </div>
          <div className="flex gap-1">
            <span className="kk-pop rounded-full bg-emerald-100 text-emerald-700 text-[9px] font-bold px-2 py-0.5" style={delay(1.8)}>Ngữ pháp ✓</span>
            <span className="kk-pop rounded-full bg-accent-100 text-ink text-[9px] font-bold px-2 py-0.5" style={delay(2.1)}>Từ vựng ✓</span>
          </div>
        </div>
      </div>
    </Stage>
  );
}

// 02 — Trình soạn thảo cho thầy cô: gõ câu hỏi, con trỏ nhấp nháy, đáp án đúng được đánh dấu
export function EditorMotion() {
  return (
    <Stage>
      <div className="w-60 rounded-xl bg-white border border-line shadow-xs overflow-hidden">
        <div className="flex items-center gap-1.5 px-3 py-2 border-b border-line-soft">
          <span className="w-2 h-2 rounded-full bg-rose-300" />
          <span className="w-2 h-2 rounded-full bg-accent-300" />
          <span className="w-2 h-2 rounded-full bg-emerald-300" />
          <div className="ml-auto flex gap-1">
            {["B", "I", "∑", "🖼"].map((t) => (
              <span key={t} className="w-4 h-4 rounded bg-surface-alt text-[8px] font-bold text-ink-muted flex items-center justify-center">{t}</span>
            ))}
          </div>
        </div>
        <div className="p-3 space-y-2">
          <div className="flex items-center text-[10px] font-semibold text-ink">
            <span className="kk-type inline-block" style={{ ["--kk-w" as string]: "11.5em" }}>Câu 1. Chọn đáp án đúng:</span>
            <span className="kk-blink ml-0.5 w-px h-3 bg-brand-600" />
          </div>
          {["A", "B", "C"].map((o, i) => (
            <div key={o} className={`flex items-center gap-2 rounded-lg border px-2 py-1 ${i === 1 ? "border-brand-300" : "border-line-soft"}`}>
              <span className={`w-4 h-4 rounded-full text-[8px] font-bold flex items-center justify-center ${i === 1 ? "bg-brand-600 text-white kk-pop" : "bg-surface-alt text-ink-muted"}`} style={i === 1 ? delay(1.6) : undefined}>{o}</span>
              <Line w={i === 1 ? "60%" : i === 0 ? "70%" : "50%"} tone={i === 1 ? "bg-brand-200" : "bg-line"} />
            </div>
          ))}
        </div>
      </div>
    </Stage>
  );
}

// 03 — AI nhập đề thi: tài liệu Word/PDF được quét → dòng chảy dữ liệu → câu hỏi bật ra
export function AiImportMotion() {
  return (
    <Stage>
      <div className="flex items-center gap-2">
        <div className="relative w-16 h-20 rounded-lg bg-white border border-line shadow-xs p-2 space-y-1.5 overflow-hidden">
          <span className="absolute top-1 right-1 rounded bg-brand-600 text-white text-[7px] font-bold px-1">DOCX</span>
          <div className="pt-3 space-y-1.5">
            <Line w="100%" /><Line w="80%" /><Line w="90%" /><Line w="65%" />
          </div>
          <div className="kk-scan absolute inset-x-0 top-0 h-4 bg-gradient-to-b from-transparent via-accent-400/40 to-transparent" />
        </div>
        <svg width="56" height="20" viewBox="0 0 56 20" className="text-brand-400">
          <path d="M2 10 H50" stroke="currentColor" strokeWidth="2" className="kk-dash" fill="none" strokeLinecap="round" />
          <path d="M46 5 L52 10 L46 15" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" />
        </svg>
        <div className="relative w-14 h-14 rounded-2xl bg-brand-600 text-white flex items-center justify-center shadow-sm">
          <span className="font-display text-sm font-extrabold">AI</span>
          <span className="kk-ping absolute inset-0 rounded-2xl border-2 border-brand-400" />
        </div>
        <svg width="40" height="20" viewBox="0 0 40 20" className="text-brand-400">
          <path d="M2 10 H34" stroke="currentColor" strokeWidth="2" className="kk-dash" fill="none" strokeLinecap="round" />
        </svg>
        <div className="space-y-1.5">
          {[0, 1, 2].map((i) => (
            <div key={i} className="kk-pop flex items-center gap-1.5 rounded-lg bg-white border border-line shadow-xs px-2 py-1" style={delay(0.8 + i * 0.45)}>
              <span className="text-[8px] font-bold text-brand-600">Câu {i + 1}</span>
              <Line w="34px" />
            </div>
          ))}
        </div>
      </div>
    </Stage>
  );
}

// 04 — Tạo lộ trình học: kéo bài vào lộ trình, chấm tiến độ chạy qua từng chặng
export function RoadmapMotion() {
  const nodes = ["Unit 1", "Unit 2", "Kiểm tra", "Unit 3"];
  return (
    <Stage>
      <div className="w-64">
        <div className="flex justify-center mb-4">
          <div className="kk-drop rounded-lg bg-white border border-brand-300 shadow-sm px-2.5 py-1 text-[9px] font-bold text-brand-700">+ Bài học mới</div>
        </div>
        <div className="relative mx-3">
          <div className="absolute top-1/2 inset-x-0 h-1 -translate-y-1/2 rounded-full bg-line" />
          <div className="kk-fill absolute top-1/2 left-0 h-1 -translate-y-1/2 rounded-full bg-gradient-to-r from-brand-500 to-accent-400" />
          <div className="kk-travel absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-3 h-3 rounded-full bg-accent-400 ring-4 ring-accent-100" />
          <div className="relative flex justify-between">
            {nodes.map((n, i) => (
              <span key={n} className={`w-4 h-4 rounded-full border-2 bg-white ${i === 2 ? "border-accent-400" : "border-brand-500"}`} />
            ))}
          </div>
        </div>
        <div className="mt-2 flex justify-between text-[8px] font-bold text-ink-muted">
          {nodes.map((n) => <span key={n}>{n}</span>)}
        </div>
      </div>
    </Stage>
  );
}

// 05 — Chấm tức thì: từng câu hiện đúng/sai, điểm tổng bật ra ngay khi nộp
export function InstantResultMotion() {
  const rows = [true, true, false, true];
  return (
    <Stage>
      <div className="flex items-center gap-4">
        <div className="w-36 rounded-xl bg-white border border-line shadow-xs p-3 space-y-1.5">
          {rows.map((ok, i) => (
            <div key={i} className="flex items-center gap-2">
              <span className="text-[9px] font-bold text-ink-muted w-8">Câu {i + 1}</span>
              <Line w="40%" />
              <span className={`kk-pop ml-auto w-4 h-4 rounded-full text-[9px] font-bold flex items-center justify-center ${ok ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-600"}`} style={delay(0.5 + i * 0.35)}>
                {ok ? "✓" : "✕"}
              </span>
            </div>
          ))}
        </div>
        <div className="kk-pop text-center rounded-2xl bg-brand-600 text-white px-3 py-2 shadow-sm" style={delay(2)}>
          <div className="text-[8px] font-bold uppercase tracking-wider opacity-80">Điểm</div>
          <div className="font-display text-2xl font-extrabold leading-none">7.5</div>
          <div className="text-[8px] font-semibold opacity-80">ngay khi nộp</div>
        </div>
      </div>
    </Stage>
  );
}

// 06 — Thông báo & tiến bộ: chuông rung báo có điểm, biểu đồ tiến bộ lớn dần
export function ProgressNotifyMotion() {
  const bars = [35, 50, 45, 70, 85];
  return (
    <Stage>
      <div className="relative flex items-end gap-6">
        <div className="flex items-end gap-1.5 h-20">
          {bars.map((h, i) => (
            <div key={i} className="kk-bar w-4 rounded-t-md bg-gradient-to-t from-brand-600 to-brand-400" style={{ height: `${h}%`, ...delay(i * 0.18) }} />
          ))}
        </div>
        <div className="relative mb-6">
          <div className="relative w-11 h-11 rounded-full bg-white border border-line shadow-xs flex items-center justify-center">
            <span className="kk-ping absolute inset-0 rounded-full border-2 border-accent-400" />
            <svg viewBox="0 0 24 24" className="kk-swing w-5 h-5 text-brand-600" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
              <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
            </svg>
            <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-rose-500 text-white text-[8px] font-bold flex items-center justify-center">1</span>
          </div>
        </div>
        <div className="kk-slide absolute -top-9 right-0 rounded-xl bg-white border border-line shadow-sm px-2.5 py-1.5 text-[9px] font-bold text-ink whitespace-nowrap" style={delay(0.6)}>
          🎉 Bài Writing đã có điểm!
        </div>
      </div>
    </Stage>
  );
}
