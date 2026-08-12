"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BookOpen, GraduationCap, ShieldCheck, Sparkles, UserCheck } from "lucide-react";

export default function Navbar() {
  const pathname = usePathname();

  const getPortalType = () => {
    if (pathname.startsWith("/admin")) return "admin";
    if (pathname.startsWith("/teacher")) return "teacher";
    return "student";
  };

  const currentPortal = getPortalType();

  return (
    <header className="sticky top-0 z-50 bg-[#ffffff] border-b border-[#e5eeff] shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo & Platform Brand */}
          <div className="flex items-center space-x-3">
            <Link href="/" className="flex items-center space-x-2">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-[#00236f] to-[#1e3a8a] text-white flex items-center justify-center font-bold text-lg shadow-md">
                E4
              </div>
              <div>
                <span className="font-bold text-lg text-[#00236f] tracking-tight block leading-none font-headline">
                  EDTECH ENGLISH
                </span>
                <span className="text-[10px] font-mono text-[#006a61] uppercase tracking-wider font-medium">
                  4-Skills AI Platform
                </span>
              </div>
            </Link>
          </div>

          {/* Portal Switcher & Navigation */}
          <nav className="hidden md:flex items-center space-x-1 bg-[#f8f9ff] p-1 rounded-xl border border-[#d3e4fe]">
            <Link
              href="/student"
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center space-x-2 ${
                currentPortal === "student"
                  ? "bg-[#00236f] text-white shadow-sm font-semibold"
                  : "text-[#444651] hover:text-[#00236f] hover:bg-white"
              }`}
            >
              <GraduationCap className="w-4 h-4" />
              <span>Học Viên</span>
            </Link>

            <Link
              href="/teacher/classes"
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center space-x-2 ${
                currentPortal === "teacher"
                  ? "bg-[#00236f] text-white shadow-sm font-semibold"
                  : "text-[#444651] hover:text-[#00236f] hover:bg-white"
              }`}
            >
              <UserCheck className="w-4 h-4" />
              <span>Giáo Viên</span>
            </Link>

            <Link
              href="/admin/requests"
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center space-x-2 ${
                currentPortal === "admin"
                  ? "bg-[#00236f] text-white shadow-sm font-semibold"
                  : "text-[#444651] hover:text-[#00236f] hover:bg-white"
              }`}
            >
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>Admin Portal</span>
            </Link>
          </nav>

          {/* Quick AI Import Badge */}
          <div className="flex items-center space-x-3">
            <Link
              href="/admin/tests/import"
              className="hidden sm:inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-full text-xs font-mono font-medium bg-[#86f2e4]/30 text-[#005049] border border-[#006a61]/30 hover:bg-[#86f2e4]/50 transition-all"
            >
              <Sparkles className="w-3.5 h-3.5 text-[#006a61]" />
              <span>AI Exam Importer</span>
            </Link>
          </div>
        </div>
      </div>
    </header>
  );
}
