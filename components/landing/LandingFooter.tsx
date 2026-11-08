import Link from "next/link";
import Image from "next/image";
import { BRAND } from "@/lib/brand";
import { Phone, Mail, MapPin, Building2, BookOpen, Sparkles } from "lucide-react";

export default function LandingFooter() {
  return (
    <footer className="relative isolate overflow-hidden bg-gradient-to-br from-brand-900 via-brand-800 to-brand-600 py-14 text-brand-100">
      {/* Nền lưới mờ đồng bộ với Hero section và các dải màu xanh khác */}
      <div className="absolute inset-0 -z-10 kk-grid-dark [mask-image:radial-gradient(ellipse_at_center,black,transparent_85%)]" aria-hidden />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Main Grid: 5 columns on lg */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-8 mb-10">
          {/* Brand & Corporate Summary (2 cols) */}
          <div className="lg:col-span-2 space-y-4">
            <Link href="/" className="inline-block">
              <Image
                src="/brand/kitokit-logo-ngang.png"
                alt="KitoKit"
                width={194}
                height={80}
                className="h-14 w-auto object-contain drop-shadow-md"
              />
            </Link>
            <p className="text-sm text-brand-100/90 max-w-sm leading-relaxed">
              KitoKit – Nền tảng bài học và khảo thí trực tuyến đa môn thông minh có trợ lý AI đồng hành. Giải pháp toàn diện cho Học sinh, Giáo viên và Nhà trường.
            </p>

            {/* Corporate Info Block */}
            <div className="pt-3 text-xs text-brand-100/85 space-y-1.5 border-t border-white/15">
              <p className="font-bold text-white text-[13px]">
                {BRAND.company.fullName}
              </p>
              <p className="flex items-start gap-1.5">
                <Building2 className="w-3.5 h-3.5 text-accent-300 shrink-0 mt-0.5" />
                <span>MST / ĐKKD: <strong className="text-white">{BRAND.company.taxCode}</strong> do {BRAND.company.licensePlace} cấp</span>
              </p>
              <p className="flex items-start gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-accent-300 shrink-0 mt-0.5" />
                <span className="leading-snug">{BRAND.company.address}</span>
              </p>
              <p className="flex flex-wrap items-center gap-x-2 gap-y-1 pt-0.5">
                <span className="inline-flex items-center gap-1.5">
                  <Phone className="w-3.5 h-3.5 text-accent-300 shrink-0" />
                  <span>Hotline: <a href={`tel:${BRAND.company.hotlineRaw}`} className="text-white font-bold hover:text-accent-300 transition-colors">{BRAND.company.hotline}</a></span>
                </span>
                <span className="text-white/40">•</span>
                <span className="inline-flex items-center gap-1.5">
                  <Mail className="w-3.5 h-3.5 text-accent-300 shrink-0" />
                  <a href={`mailto:${BRAND.company.email}`} className="text-white hover:text-accent-300 transition-colors">{BRAND.company.email}</a>
                </span>
              </p>
            </div>
          </div>

          {/* Quick links: Khám phá */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold text-white uppercase tracking-wider">Khám phá</h4>
            <ul className="space-y-2.5 text-sm text-brand-100">
              <li>
                <a href="/#hoc-sinh" className="hover:text-accent-300 transition-colors">
                  Dành cho học sinh
                </a>
              </li>
              <li>
                <a href="/#tinh-nang" className="hover:text-accent-300 transition-colors">
                  Tính năng nổi bật
                </a>
              </li>
              <li>
                <Link href="/for-teachers" className="hover:text-accent-300 transition-colors inline-flex items-center gap-1.5 font-semibold text-white">
                  <Sparkles className="w-3.5 h-3.5 text-accent-300" />
                  <span>Giới thiệu cho Giáo viên</span>
                </Link>
              </li>
              <li>
                <a href="/guideline/index.html" className="hover:text-accent-300 transition-colors inline-flex items-center gap-1.5">
                  <BookOpen className="w-3.5 h-3.5 text-brand-200" />
                  <span>Cẩm nang hướng dẫn (HTML)</span>
                </a>
              </li>
              <li>
                <a href="/#faq" className="hover:text-accent-300 transition-colors">
                  Hỏi đáp thường gặp
                </a>
              </li>
            </ul>
          </div>

          {/* Policy & Legal */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold text-white uppercase tracking-wider">Chính sách & Pháp lý</h4>
            <ul className="space-y-2.5 text-sm text-brand-100">
              <li>
                <Link href="/terms" className="hover:text-accent-300 transition-colors">
                  Điều khoản dịch vụ
                </Link>
              </li>
              <li>
                <Link href="/privacy" className="hover:text-accent-300 transition-colors">
                  Chính sách bảo mật
                </Link>
              </li>
              <li>
                <Link href="/payment-policy" className="hover:text-accent-300 transition-colors">
                  Thanh toán & Hoàn tiền
                </Link>
              </li>
              <li>
                <Link href="/about" className="hover:text-accent-300 transition-colors">
                  Đơn vị vận hành
                </Link>
              </li>
            </ul>
          </div>

          {/* Navigation & Account */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold text-white uppercase tracking-wider">Bắt đầu ngay</h4>
            <ul className="space-y-2.5 text-sm text-brand-100">
              <li>
                <Link href="/login" className="hover:text-accent-300 transition-colors">
                  Đăng nhập hệ thống
                </Link>
              </li>
              <li>
                <Link href="/register" className="hover:text-accent-300 transition-colors">
                  Đăng ký Học sinh (Miễn phí)
                </Link>
              </li>
              <li>
                <Link href="/register/teacher" className="hover:text-accent-300 transition-colors font-semibold text-accent-300">
                  Đăng ký Giáo viên dùng thử
                </Link>
              </li>
              <li>
                <a href="/#lien-he" className="hover:text-accent-300 transition-colors">
                  Liên hệ tư vấn trung tâm
                </a>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom Bar — Bản quyền thuộc Công ty Công nghệ INOVA */}
        <div className="pt-8 border-t border-white/15 flex flex-col sm:flex-row items-center justify-between text-xs text-brand-200 gap-4">
          <p>
            © {new Date().getFullYear()} KitoKit. Bản quyền thuộc về{" "}
            <Link href="/about" className="font-bold text-white hover:text-accent-300 transition-colors">
              {BRAND.company.fullName} (Công ty Công nghệ INOVA)
            </Link>
            .
          </p>
          <div className="flex flex-wrap items-center justify-center gap-4 text-brand-100">
            <Link href="/for-teachers" className="hover:text-white transition-colors">Dành cho Giáo viên</Link>
            <span>•</span>
            <a href="/guideline/index.html" className="hover:text-white transition-colors">Cẩm nang sử dụng</a>
            <span>•</span>
            <Link href="/terms" className="hover:text-white transition-colors">Điều khoản</Link>
            <span>•</span>
            <Link href="/privacy" className="hover:text-white transition-colors">Bảo mật</Link>
            <span>•</span>
            <Link href="/payment-policy" className="hover:text-white transition-colors">Thanh toán</Link>
            <span>•</span>
            <a href="https://inova.io.vn" target="_blank" rel="noopener noreferrer" className="hover:text-accent-300 transition-colors">
              inova.io.vn
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
