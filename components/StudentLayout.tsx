"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import NotificationBell from "@/components/NotificationBell";
import {
  LayoutDashboard,
  FileQuestion,
  Users,
  TrendingUp,
  LogOut,
  Search,
  Bell,
  Mail,
  User,
  Settings,
  ChevronDown,
} from "lucide-react";

export default function StudentLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const [showUserDropdown, setShowUserDropdown] = useState(false);

  const handleLogout = () => {
    void logout(); // logout() tự tải lại trang /login sau khi xoá phiên
  };

  const navItems = [
    { href: "/student/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { href: "/student/dashboard#classes", label: "Lớp Học Của Tôi", icon: Users },
    { href: "/student/class/cls_101", label: "Đề Thi & Bài Tập", icon: FileQuestion },
    { href: "/student/analytics", label: "Analytics & Báo Cáo", icon: TrendingUp },
  ];

  return (
    <div className="min-h-screen flex bg-surface-alt font-sans text-ink">
      {/* Stitch SideNavBar */}
      <nav className="h-screen w-64 fixed left-0 top-0 bg-surface-alt border-r border-line shadow-sm flex flex-col py-4 z-30 hidden md:flex">
        {/* Header */}
        <div className="px-6 py-4 mb-4 flex flex-col items-center border-b border-line-soft">
          <img src="/brand/kitokit-mark.png" alt="KitoKit" className="h-14 w-14 object-contain mb-2" />
          <h2 className="font-headline text-xl font-bold text-brand-600 text-center">
            KitoKit          </h2>
          <p className="text-xs text-ink-muted text-center font-medium">
            Học sinh
          </p>
        </div>

        {/* Navigation Links */}
        <div className="flex-1 overflow-y-auto px-4">
          <ul className="space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href || (item.href !== "/student/dashboard" && pathname.startsWith(item.href));
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
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

        {/* Footer Actions */}
        <div className="px-4 mt-auto space-y-2">
          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center px-4 py-2.5 rounded-xl text-red-700 bg-red-100/40 hover:bg-red-100 transition-colors text-sm font-medium"
          >
            <LogOut className="w-4 h-4 mr-2" />
            <span>Đăng Xuất</span>
          </button>
        </div>
      </nav>

      {/* Main Content Area Wrapper */}
      <div className="flex-1 flex flex-col md:ml-64 w-full md:max-w-[calc(100%-16rem)] min-h-screen bg-surface-alt">
        {/* Stitch TopAppBar */}
        <header className="flex justify-between items-center w-full px-8 h-16 bg-white shadow-sm border-b border-line z-20 sticky top-0">
          <div className="flex items-center gap-6">
            <div className="font-headline text-xl font-bold text-brand-600 hidden md:block">
              KitoKit · Học sinh
            </div>

            {/* Search Bar */}
            <div className="hidden md:flex items-center bg-surface-alt hover:bg-brand-100 transition-colors rounded-full px-4 py-2 border border-line w-64 focus-within:border-brand-600">
              <Search className="w-4 h-4 text-ink-subtle mr-2" />
              <input
                className="bg-transparent border-none focus:outline-none text-xs text-ink placeholder-ink-subtle w-full"
                placeholder="Tìm đề thi, lớp học..."
                type="text"
              />
            </div>
          </div>

          {/* Trailing Profile Actions */}
          <div className="flex items-center gap-4">
            <NotificationBell />

            {/* TopBar Interactive User Dropdown */}
            <div className="relative">
              <button
                onClick={() => setShowUserDropdown(!showUserDropdown)}
                className="flex items-center space-x-3 p-1.5 rounded-xl hover:bg-surface-alt transition-all border border-transparent hover:border-line"
              >
                <div className="h-9 w-9 rounded-full overflow-hidden border border-line bg-brand-600 text-white flex items-center justify-center font-bold text-xs shadow-sm">
                  {user?.name?.[0] || "S"}
                </div>
                <div className="hidden sm:block text-left">
                  <span className="font-bold text-xs text-ink block">{user?.name || "Học Viên"}</span>
                  <span className="text-[10px] text-brand-800 block font-medium">IELTS Student</span>
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
                    <span>Thông Tin Cá Nhân</span>
                  </Link>



                  <div className="border-t border-line/30 mt-1 pt-1">
                    <button
                      onClick={handleLogout}
                      className="w-full flex items-center px-4 py-2.5 text-xs text-red-700 hover:bg-red-100/40 transition-colors font-medium text-left"
                    >
                      <LogOut className="w-4 h-4 mr-2.5 text-red-700" />
                      <span>Đăng Xuất (Log Out)</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        <main className="flex-1 p-6 md:p-8 bg-surface-alt">{children}</main>
      </div>
    </div>
  );
}
