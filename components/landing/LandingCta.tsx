import Link from "next/link";
import Image from "next/image";
import { ArrowRight } from "lucide-react";

export default function LandingCta() {
  return (
    <section className="px-4 sm:px-6 lg:px-8 py-16 md:py-20 bg-surface">
      <div className="relative isolate overflow-hidden max-w-7xl mx-auto rounded-[2rem] bg-gradient-to-br from-brand-700 via-brand-600 to-accent-500 px-6 sm:px-12 py-12 shadow-2xl shadow-brand-700/25">
        <div className="absolute inset-0 -z-10 kk-grid-dark" aria-hidden />
        <div className="absolute -top-20 left-1/3 -z-10 w-96 h-96 rounded-full bg-brand-400/40 blur-3xl" aria-hidden />
        <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-center">
          <div className="md:col-span-8 text-center md:text-left">
            <h2 className="font-display text-3xl sm:text-4xl lg:text-5xl font-extrabold text-white tracking-tight leading-tight">
              Bắt đầu ngay hôm nay — <br className="hidden sm:block" />miễn phí cho học sinh.
            </h2>
            <p className="mt-4 text-brand-50 text-base sm:text-lg max-w-xl mx-auto md:mx-0">
              Tạo tài khoản trong một phút. Thầy cô và trung tâm để lại thông tin để được hỗ trợ thiết lập lớp học.
            </p>
            <div className="mt-7 flex flex-col sm:flex-row gap-3 justify-center md:justify-start">
              <Link href="/register" className="inline-flex items-center justify-center gap-2 rounded-2xl bg-white text-brand-700 hover:bg-brand-50 font-bold px-7 py-3.5 shadow-lg transition-colors">
                Làm bài thử miễn phí <ArrowRight className="w-5 h-5" />
              </Link>
              <a href="#lien-he" className="inline-flex items-center justify-center rounded-2xl border border-white/40 bg-white/10 hover:bg-white/20 text-white font-bold px-7 py-3.5 backdrop-blur-sm transition-colors">
                Tư vấn cho trung tâm
              </a>
            </div>
          </div>
          <div className="md:col-span-4 flex justify-center">
            <Image src="/brand/kitokit-mark-transparent.png" alt="" width={430} height={400} className="kk-float w-48 sm:w-60 h-auto drop-shadow-[0_20px_30px_rgba(0,0,0,0.3)]" />
          </div>
        </div>
      </div>
    </section>
  );
}
