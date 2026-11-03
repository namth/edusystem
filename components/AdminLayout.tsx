"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import {
  LayoutDashboard,
  Receipt,
  Scale,
  UserCheck,
  Inbox,
  GraduationCap,
  Users,
  LogOut,
  Search,
  Bell,
  User,
  ChevronDown,
  Bookmark,
  Settings,
} from "lucide-react";

interface AdminLayoutProps {
  children: React.ReactNode;
  onSearchChange?: (query: string) => void;
  searchPlaceholder?: string;
  searchValue?: string;
}

export default function AdminLayout({
  children,
  onSearchChange,
  searchPlaceholder = "Tìm kiếm...",
  searchValue = "",
}: AdminLayoutProps) {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const [showUserDropdown, setShowUserDropdown] = useState(false);
  const [pendingOrdersCount, setPendingOrdersCount] = useState<number>(0);

  useEffect(() => {
    let unmounted = false;
    fetch("/api/admin/orders?status=PENDING")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!unmounted && data?.counts?.PENDING) {
          setPendingOrdersCount(Number(data.counts.PENDING) || 0);
        }
      })
      .catch(() => {});
    return () => {
      unmounted = true;
    };
  }, []);

  const handleLogout = () => {
    void logout(); // logout() tự tải lại trang /login sau khi xoá phiên
  };

  const navItems = [
    { href: "/admin", label: "Tổng quan", icon: LayoutDashboard },
    { href: "/admin/orders", label: "Đơn hàng", icon: Receipt },
    { href: "/admin/teachers", label: "Quản Lý Giáo Viên", icon: UserCheck },
    { href: "/admin/students", label: "Quản Lý Học Sinh", icon: GraduationCap },
    { href: "/admin/accounts", label: "Quản Lý Tài Khoản", icon: Users },
    { href: "/admin/scoring-standards", label: "Chuẩn Chấm Điểm", icon: Scale },
    { href: "/admin/leads", label: "Liên Hệ Từ Website", icon: Inbox },
    { href: "/admin/settings", label: "Cấu Hình AI & Hệ Thống", icon: Settings },
  ];

  return (
    <div className="min-h-screen flex bg-surface-alt font-sans text-ink">
      {/* Stitch Admin SideNavBar */}
      <nav className="h-screen w-64 fixed left-0 top-0 bg-surface-alt border-r border-line shadow-sm flex flex-col py-4 z-30 hidden md:flex">
        {/* Header */}
        <div className="px-6 py-4 mb-4 flex flex-col items-center border-b border-line-soft">
          <img src="/brand/kitokit-mark.png" alt="KitoKit" className="h-14 w-14 object-contain mb-2" />
          <h2 className="font-headline text-lg font-bold text-brand-600 text-center">
            KitoKit
          </h2>
          <p className="text-xs text-ink-muted text-center font-medium">
            Quản trị hệ thống
          </p>
        </div>

        {/* Navigation Links */}
        <div className="flex-1 overflow-y-auto px-4">
          <ul className="space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive =
                item.href === "/admin"
                  ? pathname === "/admin"
                  : pathname === item.href || pathname.startsWith(item.href);
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
                    {item.href === "/admin/orders" && pendingOrdersCount > 0 && (
                      <span className="ml-auto bg-amber-500 text-white text-xs font-semibold px-2 py-0.5 rounded-full">
                        {pendingOrdersCount}
                      </span>
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>

        {/* Footer Logout */}
        <div className="px-4 mt-auto">
          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center px-4 py-2.5 rounded-xl text-red-700 bg-red-100/40 hover:bg-red-100 transition-colors text-sm font-medium"
          >
            <LogOut className="w-4 h-4 mr-2" />
            <span>Đăng Xuất Admin</span>
          </button>
        </div>
      </nav>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col md:ml-64 w-full md:max-w-[calc(100%-16rem)] min-h-screen bg-surface-alt">
        {/* Stitch TopAppBar */}
        <header className="flex justify-between items-center w-full px-8 h-16 bg-white shadow-sm border-b border-line z-20 sticky top-0">
          <div className="flex items-center gap-6">
            <div className="font-headline text-xl font-bold text-brand-600 hidden md:block">
              KitoKit · Quản trị
            </div>

            {/* Context-Aware Integrated TopBar Search Bar */}
            {onSearchChange ? (
              <div className="hidden md:flex items-center bg-surface-alt hover:bg-brand-100 transition-colors rounded-full px-4 py-2 border border-line w-80 focus-within:border-brand-600">
                <Search className="w-4 h-4 text-ink-subtle mr-2 shrink-0" />
                <input
                  className="bg-transparent border-none focus:outline-none text-xs text-ink placeholder-ink-subtle w-full"
                  placeholder={searchPlaceholder}
                  type="text"
                  value={searchValue}
                  onChange={(e) => onSearchChange(e.target.value)}
                />
              </div>
            ) : null}
          </div>

          <div className="flex items-center gap-4">
            <button className="text-ink-muted hover:text-brand-600 p-2 rounded-full hover:bg-brand-100">
              <Bell className="w-5 h-5" />
            </button>

            {/* TopBar Interactive User Dropdown */}
            <div className="relative">
              <button
                onClick={() => setShowUserDropdown(!showUserDropdown)}
                className="flex items-center space-x-3 p-1.5 rounded-xl hover:bg-surface-alt transition-all border border-transparent hover:border-line"
              >
                <div className="h-9 w-9 rounded-full overflow-hidden border border-line bg-brand-800 text-white flex items-center justify-center font-bold text-xs shadow-sm">
                  AD
                </div>
                <div className="hidden sm:block text-left">
                  <span className="font-bold text-xs text-ink block">{user?.name || "Admin Root"}</span>
                  <span className="text-[10px] text-brand-800 block font-medium">Super Admin</span>
                </div>
                <ChevronDown className="w-4 h-4 text-ink-subtle" />
              </button>

              {showUserDropdown && (
                <div className="absolute right-0 mt-2 w-56 bg-white rounded-2xl shadow-xl border border-line py-2 z-50 animate-in fade-in zoom-in-95 font-sans">
                  <div className="px-4 py-2.5 border-b border-line/30">
                    <p className="text-xs font-bold text-ink">{user?.name || "Admin Root"}</p>
                    <p className="text-[11px] text-ink-muted">{user?.email || "admin@edtech.edu.vn"}</p>
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
