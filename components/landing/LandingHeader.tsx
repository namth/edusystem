"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Menu, X } from "lucide-react";

export default function LandingHeader() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navLinks = [
    { href: "/pricing", label: "Bảng giá" },
    { href: "#tinh-nang", label: "Tính năng" },
    { href: "#hoc-sinh", label: "Học sinh" },
    { href: "/for-teachers", label: "Dành cho Giáo viên" },
    { href: "/guideline/index.html", label: "Cẩm nang sử dụng" },
    { href: "#faq", label: "Hỏi đáp" },
  ];

  return (
    <header className="sticky top-0 z-40 w-full bg-white/95 backdrop-blur-md border-b border-line shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Brand Logo */}
        <Link href="/" className="flex items-center gap-2">
          <Image
            src="/brand/kitokit-logo-ngang.png"
            alt="KitoKit"
            width={194}
            height={80}
            className="h-14 w-auto object-contain"
            priority
          />
        </Link>

        {/* Desktop Navigation */}
        <nav className="hidden md:flex items-center gap-8">
          {navLinks.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="text-sm font-semibold text-ink-muted hover:text-brand-600 transition-colors"
            >
              {link.label}
            </a>
          ))}
        </nav>

        {/* Desktop Actions */}
        <div className="hidden md:flex items-center gap-3">
          <Link
            href="/login"
            className="px-4 py-2 rounded-xl text-sm font-bold text-brand-600 hover:bg-brand-50 transition-colors"
          >
            Đăng nhập
          </Link>
          <Link
            href="/register"
            className="px-4 py-2 rounded-xl text-sm font-bold bg-brand-600 text-white hover:bg-brand-700 shadow-xs transition-colors"
          >
            Đăng ký
          </Link>
        </div>

        {/* Mobile Menu Button */}
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="md:hidden p-2 rounded-xl text-ink-muted hover:text-brand-600 hover:bg-brand-50"
          aria-label="Toggle Menu"
        >
          {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </div>

      {/* Mobile Dropdown */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t border-line bg-white px-4 pt-3 pb-6 space-y-3 animate-in slide-in-from-top-2">
          <nav className="flex flex-col space-y-2">
            {navLinks.map((link) => (
              <a
                key={link.href}
                href={link.href}
                onClick={() => setMobileMenuOpen(false)}
                className="px-3 py-2 rounded-lg text-sm font-semibold text-ink hover:bg-brand-50 hover:text-brand-600 transition-colors"
              >
                {link.label}
              </a>
            ))}
          </nav>
          <div className="pt-3 border-t border-line flex flex-col gap-2">
            <Link
              href="/login"
              onClick={() => setMobileMenuOpen(false)}
              className="w-full text-center py-2.5 rounded-xl text-sm font-bold border border-line text-brand-600 hover:bg-brand-50"
            >
              Đăng nhập
            </Link>
            <Link
              href="/register"
              onClick={() => setMobileMenuOpen(false)}
              className="w-full text-center py-2.5 rounded-xl text-sm font-bold bg-brand-600 text-white hover:bg-brand-700 shadow-xs"
            >
              Đăng ký
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}
