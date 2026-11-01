import Link from "next/link";
import Image from "next/image";
import { ArrowRight, Sparkles, Route, FileUp, Zap } from "lucide-react";
import type { LandingStats } from "@/lib/landing-stats";

interface LandingHeroProps {
  stats: LandingStats | null;
}

// Các nhãn bay quanh mascot (vòng quỹ đạo quay, nhãn quay ngược để luôn thẳng đứng)
const ORBIT = [
  { label: "AI chấm Viết & Nói", Icon: Sparkles, pos: "top-0 left-1/2 -translate-x-1/2 -translate-y-1/2" },
  { label: "Điểm tức thì", Icon: Zap, pos: "top-1/2 right-0 translate-x-1/2 -translate-y-1/2" },
  { label: "Lộ trình kéo thả", Icon: Route, pos: "bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2" },
  { label: "AI nhập đề", Icon: FileUp, pos: "top-1/2 left-0 -translate-x-1/2 -translate-y-1/2" },
];

export default function LandingHero({ stats }: LandingHeroProps) {
  // Chỉ khoe số liệu khi đủ lớn, tránh con số lèo tèo lúc mới vận hành
  const showStats = stats && stats.questions >= 100 && stats.exams >= 10;
  return (
    <section className="relative overflow-hidden pt-12 pb-16 md:pt-20 md:pb-24 bg-gradient-to-b from-brand-50 via-surface to-surface">
      <div className="absolute inset-0 kk-grid-bg opacity-60 [mask-image:radial-gradient(ellipse_at_top,black,transparent_70%)]" aria-hidden />
      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          <div className="lg:col-span-6 space-y-6 text-center lg:text-left">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white border border-line text-ink-muted text-xs font-mono font-bold uppercase tracking-wider shadow-xs">
              <span className="w-2 h-2 rounded-full bg-accent-400" />
              AI · Nền tảng học & thi
            </div>

            <h1 className="font-display text-4xl sm:text-5xl lg:text-6xl font-extrabold text-ink tracking-tight leading-[1.1]">
              Học vui. Thi chắc.
              <br />
              <span className="text-brand-600">Có <span className="relative isolate inline-block">AI<span className="absolute -bottom-1 left-0 right-0 h-2 rounded-full bg-accent-400/70 -z-10" /></span> đồng hành.</span>
            </h1>

            <p className="text-base sm:text-lg text-ink-muted max-w-xl mx-auto lg:mx-0 leading-relaxed">
              Học sinh làm bài là có điểm, bài Viết và Nói có AI nhận xét. Thầy cô soạn đề nhanh, nhập đề bằng AI,
              kéo thả lộ trình cho từng lớp.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-3 pt-2">
              <Link
                href="/register"
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-7 py-3.5 rounded-2xl bg-brand-600 hover:bg-brand-700 text-white font-bold text-base shadow-sm hover:shadow-md transition-all"
              >
                Làm bài thử miễn phí
                <ArrowRight className="w-5 h-5" />
              </Link>
              <a
                href="#giao-vien"
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-7 py-3.5 rounded-2xl bg-white border border-line hover:border-brand-300 text-ink hover:text-brand-600 font-bold text-base transition-all"
              >
                Tôi là giáo viên
              </a>
            </div>

            {showStats && (
              <div className="pt-6 flex flex-wrap justify-center lg:justify-start gap-x-8 gap-y-3 text-sm">
                <div><span className="font-display text-2xl font-extrabold text-brand-600">{stats.exams.toLocaleString("vi-VN")}</span> <span className="text-ink-muted font-semibold">đề thi</span></div>
                <div><span className="font-display text-2xl font-extrabold text-accent-500">{stats.questions.toLocaleString("vi-VN")}</span> <span className="text-ink-muted font-semibold">câu hỏi</span></div>
                <div><span className="font-display text-2xl font-extrabold text-brand-700">{stats.students.toLocaleString("vi-VN")}</span> <span className="text-ink-muted font-semibold">học sinh</span></div>
              </div>
            )}
          </div>

          {/* Quỹ đạo tính năng quanh mascot */}
          <div className="lg:col-span-6 flex justify-center py-10">
            <div className="relative w-72 h-72 sm:w-96 sm:h-96" aria-hidden>
              <div className="absolute inset-6 rounded-full bg-gradient-to-tr from-brand-200/50 via-accent-100/60 to-transparent blur-2xl" />
              <div className="absolute inset-0 rounded-full border-2 border-dashed border-brand-200 kk-orbit">
                {ORBIT.map(({ label, Icon, pos }) => (
                  <div key={label} className={`absolute ${pos}`}>
                    <div className="kk-orbit-rev">
                      <div className="flex items-center gap-1.5 rounded-full bg-white border border-line shadow-sm px-3 py-1.5 text-[11px] sm:text-xs font-bold text-ink whitespace-nowrap">
                        <Icon className="w-3.5 h-3.5 text-brand-600" />
                        {label}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <div className="absolute inset-14 sm:inset-16 rounded-full border border-line kk-orbit-rev">
                <span className="absolute -top-1.5 left-1/2 w-3 h-3 rounded-full bg-accent-400 ring-4 ring-accent-100" />
              </div>
              <Image
                src="/brand/kitokit-mark.png"
                alt="Mascot KitoKit"
                width={260}
                height={240}
                className="kk-float absolute inset-0 m-auto w-40 sm:w-52 h-auto mix-blend-multiply"
                priority
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
