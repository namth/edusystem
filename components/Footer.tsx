import Link from "next/link";
import { BRAND } from "@/lib/brand";

export default function Footer() {
  return (
    <footer className="bg-white border-t border-brand-100 py-6 mt-auto">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row justify-between items-center text-xs text-ink-subtle gap-3">
        <div>
          <p className="font-medium text-ink-muted">
            &copy; {new Date().getFullYear()} {BRAND.name} — Vận hành bởi{" "}
            <Link href="/about" className="font-semibold text-brand-700 hover:underline">
              {BRAND.company.fullName}
            </Link>
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-ink-muted">
          <Link href="/terms" className="hover:text-brand-800 transition-colors">
            Điều khoản dịch vụ
          </Link>
          <span>&bull;</span>
          <Link href="/privacy" className="hover:text-brand-800 transition-colors">
            Chính sách bảo mật
          </Link>
          <span>&bull;</span>
          <Link href="/payment-policy" className="hover:text-brand-800 transition-colors">
            Thanh toán & Hoàn tiền
          </Link>
          <span>&bull;</span>
          <Link href="/about" className="hover:text-brand-800 transition-colors">
            Đơn vị vận hành
          </Link>
        </div>
      </div>
    </footer>
  );
}
