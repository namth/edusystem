"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { Shield, FileText, CreditCard, Building2, ChevronRight, Phone, Mail, Clock, ArrowLeft } from "lucide-react";
import { BRAND } from "@/lib/brand";
import LandingFooter from "@/components/landing/LandingFooter";

interface LegalLayoutProps {
  children: React.ReactNode;
  title: string;
  subtitle: string;
  lastUpdated?: string;
}

const LEGAL_NAV = [
  {
    href: "/terms",
    label: "Điều khoản dịch vụ",
    shortLabel: "Điều khoản",
    icon: FileText,
  },
  {
    href: "/privacy",
    label: "Chính sách bảo mật",
    shortLabel: "Bảo mật",
    icon: Shield,
  },
  {
    href: "/payment-policy",
    label: "Thanh toán & Hoàn tiền",
    shortLabel: "Thanh toán",
    icon: CreditCard,
  },
  {
    href: "/about",
    label: "Đơn vị vận hành",
    shortLabel: "Đơn vị vận hành",
    icon: Building2,
  },
];

export default function LegalLayout({
  children,
  title,
  subtitle,
  lastUpdated = "08/11/2026",
}: LegalLayoutProps) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen flex flex-col bg-surface font-sans text-ink selection:bg-brand-600 selection:text-white">
      {/* Top Header */}
      <header className="sticky top-0 z-40 w-full bg-white/95 backdrop-blur-md border-b border-line shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <Link href="/" className="flex items-center gap-2">
              <Image
                src="/brand/kitokit-logo-ngang.png"
                alt="KitoKit"
                width={160}
                height={66}
                className="h-11 w-auto object-contain"
                priority
              />
            </Link>
            <div className="hidden sm:flex items-center gap-2 text-xs font-semibold text-ink-subtle pl-4 border-l border-line">
              <span className="px-2 py-0.5 rounded-full bg-brand-50 text-brand-700 font-medium">Trung tâm Pháp lý</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-ink-muted hover:text-brand-600 hover:bg-cream transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Trang chủ</span>
            </Link>
            <Link
              href="/login"
              className="px-4 py-2 rounded-xl text-xs font-bold text-brand-600 hover:bg-brand-50 transition-colors"
            >
              Đăng nhập
            </Link>
            <Link
              href="/register"
              className="px-4 py-2 rounded-xl text-xs font-bold bg-brand-600 text-white hover:bg-brand-700 shadow-xs transition-colors"
            >
              Đăng ký
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Banner */}
      <section className="bg-gradient-to-b from-brand-50/70 via-cream/50 to-surface border-b border-line/60 pt-10 pb-8 sm:pt-14 sm:pb-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-accent-100 text-accent-700 text-xs font-bold mb-4">
              <Shield className="w-3.5 h-3.5" />
              <span>Quy chế hoạt động & Tuân thủ Bộ Công Thương</span>
            </div>
            <h1 className="font-display text-2xl sm:text-4xl font-extrabold text-ink tracking-tight">
              {title}
            </h1>
            <p className="mt-3 text-sm sm:text-base text-ink-muted leading-relaxed">
              {subtitle}
            </p>
            <div className="mt-4 flex items-center gap-4 text-xs text-ink-subtle">
              <span className="flex items-center gap-1">
                <Clock className="w-3.5 h-3.5" />
                Cập nhật lần cuối: <strong>{lastUpdated}</strong>
              </span>
              <span>•</span>
              <span>Áp dụng trên toàn bộ hệ thống KitoKit</span>
            </div>
          </div>

          {/* Policy Navigation Tabs */}
          <div className="mt-8 flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
            {LEGAL_NAV.map((nav) => {
              const Icon = nav.icon;
              const isActive = pathname === nav.href;
              return (
                <Link
                  key={nav.href}
                  href={nav.href}
                  className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer ${
                    isActive
                      ? "bg-brand-600 text-white shadow-xs"
                      : "bg-white text-ink-muted hover:text-brand-600 hover:bg-white/80 border border-line"
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{nav.label}</span>
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-14 w-full">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Main Policy Document */}
          <article className="lg:col-span-8 bg-white rounded-3xl p-6 sm:p-10 border border-line shadow-xs">
            {children}
          </article>

          {/* Right Sidebar: Contact & Quick Info */}
          <aside className="lg:col-span-4 space-y-6 lg:sticky lg:top-24">
            {/* Quick Contact Card */}
            <div className="bg-gradient-to-br from-brand-900 to-brand-800 text-white rounded-3xl p-6 shadow-sm">
              <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center mb-4">
                <Phone className="w-5 h-5 text-accent-300" />
              </div>
              <h3 className="font-bold text-base text-white">Bạn cần giải đáp thắc mắc?</h3>
              <p className="mt-1 text-xs text-brand-200 leading-relaxed">
                Bộ phận Pháp lý & Chăm sóc khách hàng KitoKit luôn sẵn sàng hỗ trợ giải đáp mọi điều khoản và chính sách.
              </p>

              <div className="mt-5 space-y-3 pt-4 border-t border-white/10 text-xs">
                <div className="flex items-center gap-2.5">
                  <Phone className="w-4 h-4 text-accent-400 shrink-0" />
                  <div>
                    <span className="block text-brand-300 text-[11px]">Hotline hỗ trợ:</span>
                    <a href={`tel:${BRAND.company.hotline.replace(/\s+/g, "")}`} className="font-bold text-white hover:text-accent-300 transition-colors">
                      {BRAND.company.hotline}
                    </a>
                  </div>
                </div>

                <div className="flex items-center gap-2.5">
                  <Mail className="w-4 h-4 text-accent-400 shrink-0" />
                  <div>
                    <span className="block text-brand-300 text-[11px]">Email hỗ trợ khách hàng:</span>
                    <a href={`mailto:${BRAND.company.email}`} className="font-bold text-white hover:text-accent-300 transition-colors">
                      {BRAND.company.email}
                    </a>
                  </div>
                </div>

                <div className="flex items-center gap-2.5">
                  <Clock className="w-4 h-4 text-accent-400 shrink-0" />
                  <div>
                    <span className="block text-brand-300 text-[11px]">Thời gian làm việc:</span>
                    <span className="font-medium text-brand-100">{BRAND.company.workingHours}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Entity Verification Card */}
            <div className="bg-white rounded-3xl p-6 border border-line shadow-xs text-xs space-y-3">
              <div className="flex items-center gap-2 text-ink font-bold text-sm">
                <Building2 className="w-4 h-4 text-brand-600" />
                <span>Đơn vị sở hữu & vận hành</span>
              </div>
              <div className="space-y-2 text-ink-muted pt-2 border-t border-line/60">
                <p>
                  <strong className="text-ink font-semibold">Tên tổ chức:</strong> {BRAND.company.fullName}
                </p>
                <p>
                  <strong className="text-ink font-semibold">Mã số thuế:</strong> {BRAND.company.taxCode}
                </p>
                <p>
                  <strong className="text-ink font-semibold">Đại diện pháp luật:</strong> {BRAND.company.representative} ({BRAND.company.position})
                </p>
                <p>
                  <strong className="text-ink font-semibold">Trụ sở:</strong> {BRAND.company.address}
                </p>
              </div>

              {/* BCT Notification Badge Mock */}
              <div className="pt-3 border-t border-line/60 flex items-center justify-between">
                <div className="inline-flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-200 font-bold text-[11px]">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span>Hồ sơ thông báo Bộ Công Thương</span>
                </div>
              </div>
            </div>
          </aside>
        </div>
      </main>

      {/* Global Landing Footer */}
      <LandingFooter />
    </div>
  );
}
