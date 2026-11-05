"use client";

import Link from "next/link";
import { GraduationCap } from "lucide-react";

export default function Navbar() {
  return (
    <header className="sticky top-0 z-50 bg-white border-b border-brand-100 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo & Platform Brand */}
          <div className="flex items-center space-x-3">
            <Link href="/" className="flex items-center space-x-2">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-brand-800 to-brand-800 text-white flex items-center justify-center font-bold text-lg shadow-md">
                E4
              </div>
              <div>
                <span className="font-bold text-lg text-brand-800 tracking-tight block leading-none font-headline">
                  EDTECH ENGLISH
                </span>
                <span className="text-[10px] font-mono text-emerald-700 uppercase tracking-wider font-medium">
                  4-Skills AI Platform
                </span>
              </div>
            </Link>
          </div>

          {/* Mỗi phân hệ tách biệt: thanh này chỉ dẫn trong phân hệ học sinh, không chuyển sang Giáo viên / Quản trị */}
          <nav className="hidden md:flex items-center bg-brand-50 p-1 rounded-xl border border-brand-100">
            <Link
              href="/student/dashboard"
              className="px-4 py-2 rounded-lg text-sm font-semibold bg-brand-800 text-white shadow-sm flex items-center space-x-2"
            >
              <GraduationCap className="w-4 h-4" />
              <span>Học Viên</span>
            </Link>
          </nav>
        </div>
      </div>
    </header>
  );
}
