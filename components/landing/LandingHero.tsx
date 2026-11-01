import Link from "next/link";
import Image from "next/image";
import { ArrowRight, BookOpen, HelpCircle, Users } from "lucide-react";
import type { LandingStats } from "@/lib/landing-stats";

interface LandingHeroProps {
  stats: LandingStats | null;
}

export default function LandingHero({ stats }: LandingHeroProps) {
  return (
    <section className="relative overflow-hidden pt-12 pb-16 md:pt-20 md:pb-24 bg-gradient-to-b from-brand-50/60 to-surface">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          {/* Text Content */}
          <div className="lg:col-span-7 space-y-6 text-center lg:text-left">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-brand-100/70 border border-brand-200 text-brand-700 text-xs font-bold">
              <span>🚀 Nền tảng học & thi thông minh đa môn</span>
            </div>

            <h1 className="font-display text-4xl sm:text-5xl lg:text-6xl font-extrabold text-ink tracking-tight leading-tight">
              Học vui – Thi chắc cùng <span className="text-brand-600">KitoKit</span>
            </h1>

            <p className="text-base sm:text-lg text-ink-muted max-w-2xl mx-auto lg:mx-0 leading-relaxed">
              Cổng bài học và luyện thi chuẩn hoá dành cho học sinh, phụ huynh và thầy cô.
              Luyện tập đa môn, trải nghiệm chấm thi thông minh bằng AI với phản hồi tức thì
              và lộ trình bứt phá tiến độ rõ ràng.
            </p>

            {/* CTAs */}
            <div className="flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-4 pt-2">
              <Link
                href="/register"
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-7 py-3.5 rounded-2xl bg-brand-600 hover:bg-brand-700 text-white font-bold text-base shadow-sm hover:shadow-md transition-all cursor-pointer"
              >
                <span>Làm bài thử miễn phí</span>
                <ArrowRight className="w-5 h-5" />
              </Link>

              <a
                href="#giao-vien"
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-7 py-3.5 rounded-2xl bg-surface border border-line hover:border-brand-300 text-ink-muted hover:text-brand-600 font-bold text-base transition-all cursor-pointer"
              >
                Tôi là giáo viên
              </a>
            </div>

            {/* Real Stats Bar (hidden when null) */}
            {stats && (
              <div className="pt-8 border-t border-line-soft grid grid-cols-3 gap-4 max-w-lg mx-auto lg:mx-0">
                <div className="space-y-1">
                  <div className="flex items-center gap-1.5 text-brand-600 font-extrabold text-2xl sm:text-3xl">
                    <BookOpen className="w-5 h-5 shrink-0" />
                    <span>{stats.exams.toLocaleString("vi-VN")}</span>
                  </div>
                  <p className="text-xs font-semibold text-ink-muted">Đề thi sẵn sàng</p>
                </div>

                <div className="space-y-1">
                  <div className="flex items-center gap-1.5 text-accent-500 font-extrabold text-2xl sm:text-3xl">
                    <HelpCircle className="w-5 h-5 shrink-0" />
                    <span>{stats.questions.toLocaleString("vi-VN")}</span>
                  </div>
                  <p className="text-xs font-semibold text-ink-muted">Câu hỏi thực hành</p>
                </div>

                <div className="space-y-1">
                  <div className="flex items-center gap-1.5 text-brand-700 font-extrabold text-2xl sm:text-3xl">
                    <Users className="w-5 h-5 shrink-0" />
                    <span>{stats.students.toLocaleString("vi-VN")}</span>
                  </div>
                  <p className="text-xs font-semibold text-ink-muted">Học sinh đăng ký</p>
                </div>
              </div>
            )}
          </div>

          {/* Mascot / Visual Graphic */}
          <div className="lg:col-span-5 flex justify-center">
            <div className="relative w-72 h-72 sm:w-80 sm:h-80 lg:w-96 lg:h-96">
              <div className="absolute inset-0 bg-gradient-to-tr from-brand-200/40 via-accent-100/40 to-transparent rounded-full blur-2xl -z-10" />
              <Image
                src="/brand/kitokit-mark.png"
                alt="KitoKit Mascot"
                width={384}
                height={384}
                className="w-full h-full object-contain drop-shadow-md animate-pulse"
                priority
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
