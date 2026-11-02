import Link from "next/link";
import Image from "next/image";

export default function LandingFooter() {
  return (
    <footer className="relative isolate overflow-hidden bg-gradient-to-br from-brand-900 via-brand-900 to-brand-800 py-14">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
          {/* Brand Info */}
          <div className="md:col-span-2 space-y-4">
            <Link href="/" className="inline-block rounded-xl bg-white px-3 py-2">
              <Image
                src="/brand/kitokit-logo-horizontal-transparent.png"
                alt="KitoKit"
                width={140}
                height={40}
                className="h-8 w-auto object-contain"
              />
            </Link>
            <p className="text-sm text-brand-200 max-w-sm leading-relaxed">
              KitoKit – Hệ sinh thái bài học và thi trực tuyến đa môn thông minh.
              Đồng hành cùng học sinh, phụ huynh và giáo viên trên hành trình chinh phục tri thức.
            </p>
          </div>

          {/* Quick links */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold text-white uppercase tracking-wider">Khám phá</h4>
            <ul className="space-y-2 text-sm text-brand-200">
              <li>
                <a href="#hoc-sinh" className="hover:text-accent-300 transition-colors">
                  Dành cho học sinh
                </a>
              </li>
              <li>
                <a href="#tinh-nang" className="hover:text-accent-300 transition-colors">
                  Tính năng nổi bật
                </a>
              </li>
              <li>
                <a href="#giao-vien" className="hover:text-accent-300 transition-colors">
                  Dành cho giáo viên
                </a>
              </li>
              <li>
                <a href="#faq" className="hover:text-accent-300 transition-colors">
                  Hỏi đáp thường gặp
                </a>
              </li>
            </ul>
          </div>

          {/* Navigation */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold text-white uppercase tracking-wider">Tài khoản</h4>
            <ul className="space-y-2 text-sm text-brand-200">
              <li>
                <Link href="/login" className="hover:text-accent-300 transition-colors">
                  Đăng nhập
                </Link>
              </li>
              <li>
                <Link href="/register" className="hover:text-accent-300 transition-colors">
                  Đăng ký tài khoản
                </Link>
              </li>
              <li>
                <a href="#lien-he" className="hover:text-accent-300 transition-colors">
                  Liên hệ tư vấn
                </a>
              </li>
            </ul>
          </div>
        </div>

        <div className="pt-8 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between text-xs text-brand-300 gap-4">
          <p>
            © {new Date().getFullYear()} KitoKit. Bản quyền thuộc về{" "}
            <a href="https://inova.io.vn" target="_blank" rel="noopener noreferrer" className="font-bold text-white hover:text-accent-300 transition-colors">
              Công ty Công nghệ INOVA
            </a>
            .
          </p>
          <a href="https://inova.io.vn" target="_blank" rel="noopener noreferrer" className="hover:text-accent-300 transition-colors">
            Phát triển bởi INOVA · inova.io.vn
          </a>
        </div>
      </div>
    </footer>
  );
}
