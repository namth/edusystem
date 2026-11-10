"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { useDismissable } from "@/components/useDismissable";
import NotificationBell from "@/components/NotificationBell";
import {
  LayoutDashboard,
  Users,
  TrendingUp,
  User,
  KeyRound,
  LogOut,
  ChevronDown,
} from "lucide-react";

export default function StudentLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const [showUserDropdown, setShowUserDropdown] = useState(false);
  const [currentHash, setCurrentHash] = useState("");

  useEffect(() => {
    const updateHash = () => {
      setCurrentHash(typeof window !== "undefined" ? window.location.hash : "");
    };
    updateHash();
    window.addEventListener("hashchange", updateHash);
    return () => window.removeEventListener("hashchange", updateHash);
  }, [pathname]);

  // Menu hồ sơ tự đóng khi bấm ra ngoài / nhấn Esc
  const userMenuRef = useRef<HTMLDivElement>(null);
  const closeUserDropdown = useCallback(() => setShowUserDropdown(false), []);
  useDismissable(userMenuRef, showUserDropdown, closeUserDropdown);

  const handleLogout = () => {
    void logout(); // logout() tự tải lại trang /login sau khi xoá phiên
  };

  const navItems = [
    { href: "/student/dashboard", label: "Tổng quan", icon: LayoutDashboard },
    { href: "/student/dashboard#classes", label: "Lớp học của tôi", icon: Users },
    { href: "/student/analytics", label: "Phân tích & báo cáo", icon: TrendingUp },
    { href: "/profile", label: "Hồ sơ", icon: User },
    { href: "/change-password", label: "Đổi mật khẩu", icon: KeyRound },
  ];

  const handleNavClick = (href: string) => {
    if (href.includes("#")) {
      const hash = href.slice(href.indexOf("#"));
      setCurrentHash(hash);
    } else {
      setCurrentHash("");
    }
  };

  const isItemActive = (href: string) => {
    if (href === "/student/dashboard#classes") {
      return pathname === "/student/dashboard" && currentHash === "#classes";
    }
    if (href === "/student/dashboard") {
      return pathname === "/student/dashboard" && currentHash !== "#classes";
    }
    return pathname === href || (href !== "/student/dashboard" && pathname.startsWith(href));
  };

  return (
    <div className="min-h-screen flex bg-surface-alt font-sans text-ink">
      {/* Stitch SideNavBar */}
      <nav
        aria-label="Thanh điều hướng chính"
        className="h-screen w-64 fixed left-0 top-0 bg-surface-alt border-r border-line shadow-sm flex flex-col py-4 z-30 hidden md:flex"
      >
        {/* Header */}
        <div className="px-6 py-4 mb-4 flex flex-col items-center border-b border-line-soft">
          <img src="/brand/kitokit-logo-dung.png" alt="KitoKit" className="h-28 w-auto object-contain mb-1" />
          <p className="text-xs text-ink-muted text-center font-medium">
            Học sinh
          </p>
        </div>

        {/* Navigation Links */}
        <div className="flex-1 overflow-y-auto px-4">
          <ul className="space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = isItemActive(item.href);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={() => handleNavClick(item.href)}
                    className={`flex items-center px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                      isActive
                        ? "text-brand-600 bg-brand-100"
                        : "text-ink-muted hover:bg-brand-100 hover:text-brand-600"
                    }`}
                  >
                    <Icon className="w-5 h-5 mr-3 text-brand-600 shrink-0" />
                    <span>{item.label}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      </nav>

      {/* Main Content Area Wrapper */}
      <div className="flex-1 flex flex-col md:ml-64 w-full md:max-w-[calc(100%-16rem)] min-h-screen bg-surface-alt">
        {/* Stitch TopAppBar */}
        <header className="flex justify-between items-center w-full px-4 md:px-8 h-16 bg-white shadow-sm border-b border-line z-20 sticky top-0">
          <div className="flex items-center gap-3">
            <div className="md:hidden flex items-center gap-2">
              <img src="/brand/kitokit-logo-dung.png" alt="KitoKit" className="h-8 w-auto object-contain" />
              <span className="font-bold text-sm text-brand-600">KitoKit</span>
            </div>
          </div>

          {/* Trailing Profile Actions */}
          <div className="flex items-center gap-4">
            <NotificationBell />

            {/* TopBar Interactive User Dropdown */}
            <div className="relative" ref={userMenuRef}>
              <button
                onClick={() => setShowUserDropdown((v) => !v)}
                aria-haspopup="menu"
                aria-expanded={showUserDropdown}
                className="flex items-center space-x-3 p-1.5 rounded-xl hover:bg-surface-alt transition-all border border-transparent hover:border-line"
              >
                <div className="h-9 w-9 rounded-full overflow-hidden border border-line bg-brand-600 text-white flex items-center justify-center font-bold text-xs shadow-sm">
                  {user?.name?.[0] || "S"}
                </div>
                <div className="hidden sm:block text-left">
                  <span className="font-bold text-xs text-ink block">{user?.name || "Học Viên"}</span>
                  <span className="text-[10px] text-brand-800 block font-medium">Học sinh</span>
                </div>
                <ChevronDown className="w-4 h-4 text-ink-subtle" />
              </button>

              {showUserDropdown && (
                <div className="absolute right-0 mt-2 w-56 bg-white rounded-2xl shadow-xl border border-line py-2 z-50 animate-in fade-in zoom-in-95 font-sans">
                  <div className="px-4 py-2.5 border-b border-line/30">
                    <p className="text-xs font-bold text-ink">{user?.name || "Học Viên"}</p>
                    <p className="text-[11px] text-ink-muted">{user?.email || "student@gmail.com"}</p>
                  </div>

                  <Link
                    href="/profile"
                    onClick={() => setShowUserDropdown(false)}
                    className="flex items-center px-4 py-2.5 text-xs text-ink hover:bg-surface-alt hover:text-brand-600 transition-colors font-medium"
                  >
                    <User className="w-4 h-4 mr-2.5 text-brand-600" />
                    <span>Hồ sơ</span>
                  </Link>

                  <Link
                    href="/change-password"
                    onClick={() => setShowUserDropdown(false)}
                    className="flex items-center px-4 py-2.5 text-xs text-ink hover:bg-surface-alt hover:text-brand-600 transition-colors font-medium"
                  >
                    <KeyRound className="w-4 h-4 mr-2.5 text-brand-600" />
                    <span>Đổi mật khẩu</span>
                  </Link>

                  <div className="border-t border-line/30 mt-1 pt-1">
                    <button
                      onClick={handleLogout}
                      className="w-full flex items-center px-4 py-2.5 text-xs text-red-700 hover:bg-red-100/40 transition-colors font-medium text-left"
                    >
                      <LogOut className="w-4 h-4 mr-2.5 text-red-700" />
                      <span>Đăng xuất</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        <main className="flex-1 p-6 md:p-8 pb-20 md:pb-8 bg-surface-alt">{children}</main>
      </div>

      {/* Mobile Bottom Navigation Bar */}
      <nav
        aria-label="Điều hướng di động"
        className="fixed bottom-0 left-0 right-0 bg-white border-t border-line shadow-lg z-30 flex items-center justify-around py-1.5 px-2 md:hidden"
      >
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = isItemActive(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => handleNavClick(item.href)}
              aria-label={item.label}
              className={`flex flex-col items-center justify-center flex-1 py-1 px-1 rounded-xl text-[10px] font-medium transition-colors ${
                isActive
                  ? "text-brand-600 font-bold bg-brand-50"
                  : "text-ink-muted hover:text-brand-600"
              }`}
            >
              <Icon className="w-5 h-5 mb-0.5 text-current shrink-0" />
              <span className="truncate max-w-[64px] text-center leading-tight">{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
