import Link from "next/link";
import Image from "next/image";
import { BRAND } from "@/lib/brand";
import { ShieldCheck, Phone, Mail, MapPin, Building2 } from "lucide-react";

export default function LandingFooter() {
  return (
    <footer className="relative isolate overflow-hidden bg-gradient-to-br from-brand-950 via-brand-900 to-brand-850 py-14 text-brand-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Main Grid: 4 columns */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-8 mb-10">
          {/* Brand & Corporate Summary (2 cols) */}
          <div className="lg:col-span-2 space-y-4">
            <Link href="/" className="inline-block">
              <Image
                src="/brand/kitokit-logo-ngang.png"
                alt="KitoKit"
                width={194}
                height={80}
                className="h-14 w-auto object-contain"
              />
            </Link>
            <p className="text-sm text-brand-200/90 max-w-sm leading-relaxed">
              KitoKit – Nền tảng bài học và khảo thí trực tuyến đa môn thông minh có trợ lý AI đồng hành. Giải pháp toàn diện cho Học sinh, Giáo viên và Nhà trường.
            </p>

            {/* Corporate Info Block - Chuẩn quy định BCT */}
            <div className="pt-2 text-xs text-brand-300/80 space-y-1.5 border-t border-white/10">
              <p className="font-bold text-white text-[13px]">
                {BRAND.company.fullName}
              </p>
              <p className="flex items-start gap-1.5">
                <Building2 className="w-3.5 h-3.5 text-accent-400 shrink-0 mt-0.5" />
                <span>MST / ĐKKD: <strong>{BRAND.company.taxCode}</strong> do Sở KH&ĐT TP. Hà Nội cấp</span>
              </p>
              <p className="flex items-start gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-accent-400 shrink-0 mt-0.5" />
                <span className="leading-snug">{BRAND.company.address}</span>
              </p>
              <p className="flex items-center gap-1.5 pt-0.5">
                <Phone className="w-3.5 h-3.5 text-accent-400 shrink-0" />
                <span>Hotline: <a href={`tel:${BRAND.company.hotline.replace(/\s+/g, "")}`} className="text-white font-bold hover:text-accent-300 transition-colors">{BRAND.company.hotline}</a></span>
                <span className="mx-1">•</span>
                <Mail className="w-3.5 h-3.5 text-accent-400 shrink-0" />
                <span><a href={`mailto:${BRAND.company.email}`} className="text-white hover:text-accent-300 transition-colors">{BRAND.company.email}</a></span>
              </p>
            </div>
          </div>

          {/* Quick links: Khám phá */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold text-white uppercase tracking-wider">Khám phá</h4>
            <ul className="space-y-2 text-sm text-brand-200">
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
                <a href="/#giao-vien" className="hover:text-accent-300 transition-colors">
                  Dành cho giáo viên
                </a>
              </li>
              <li>
                <a href="/#faq" className="hover:text-accent-300 transition-colors">
                  Hỏi đáp thường gặp
                </a>
              </li>
            </ul>
          </div>

          {/* Policy & Legal - Chính sách Bộ Công Thương */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold text-white uppercase tracking-wider">Chính sách & Pháp lý</h4>
            <ul className="space-y-2 text-sm text-brand-200">
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

          {/* Navigation & BCT Seal */}
          <div className="space-y-4">
            <h4 className="text-xs font-bold text-white uppercase tracking-wider">Đăng ký & Chứng nhận</h4>
            <ul className="space-y-2 text-sm text-brand-200">
              <li>
                <Link href="/login" className="hover:text-accent-300 transition-colors">
                  Đăng nhập hệ thống
                </Link>
              </li>
              <li>
                <Link href="/register" className="hover:text-accent-300 transition-colors">
                  Đăng ký tài khoản mới
                </Link>
              </li>
              <li>
                <a href="/#lien-he" className="hover:text-accent-300 transition-colors">
                  Liên hệ tư vấn
                </a>
              </li>
            </ul>

            {/* BCT Badge Badge Container */}
            <div className="pt-2">
              <a
                href="http://online.gov.vn"
                target="_blank"
                rel="noopener noreferrer"
                title="Website đã thông báo với Bộ Công Thương"
                className="inline-flex items-center gap-2 p-2 rounded-xl bg-white/10 hover:bg-white/15 border border-white/20 transition-all text-xs text-white"
              >
                <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
                  <ShieldCheck className="w-5 h-5 text-emerald-300" />
                </div>
                <div className="text-[11px] leading-tight">
                  <span className="block font-bold text-emerald-300">ĐÃ THÔNG BÁO</span>
                  <span className="text-brand-200">BỘ CÔNG THƯƠNG</span>
                </div>
              </a>
            </div>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="pt-8 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between text-xs text-brand-300 gap-4">
          <p>
            © {new Date().getFullYear()} KitoKit. Bản quyền thuộc về{" "}
            <Link href="/about" className="font-bold text-white hover:text-accent-300 transition-colors">
              {BRAND.company.fullName}
            </Link>
            .
          </p>
          <div className="flex items-center gap-4 text-brand-300">
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
