import Link from "next/link";
import Image from "next/image";
import { ArrowRight } from "lucide-react";

export default function LandingCta() {
  return (
    <section className="relative isolate overflow-hidden bg-gradient-to-br from-brand-900 via-brand-700 to-brand-500 py-16 md:py-20">
      <div className="absolute inset-0 -z-10 kk-grid-dark" aria-hidden />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
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
            <Image src="/brand/mascot/kito-an-mung-chien-thang.png" alt="" width={354} height={511} className="kk-float h-56 sm:h-72 w-auto drop-shadow-[0_20px_30px_rgba(0,0,0,0.3)]" />
          </div>
        </div>
      </div>
    </section>
  );
}
