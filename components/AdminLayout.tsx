"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import {
  QrCode,
  Award,
  UserCheck,
  GraduationCap,
  Users,
  LogOut,
  Search,
  Bell,
  User,
  ChevronDown,
  Bookmark,
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
  const router = useRouter();
  const { user, logout } = useAuth();
  const [showUserDropdown, setShowUserDropdown] = useState(false);

  const handleLogout = () => {
    logout();
    router.push("/login");
  };

  const navItems = [
    { href: "/admin/requests", label: "Phê Duyệt Thanh Toán", icon: QrCode },
    { href: "/admin/rubrics", label: "Quản Lý Tiêu Chí Chấm Điểm", icon: Award },
    { href: "/admin/teachers", label: "Quản Lý Giáo Viên", icon: UserCheck },
    { href: "/admin/students", label: "Quản Lý Học Sinh", icon: GraduationCap },
    { href: "/admin/accounts", label: "Quản Lý Tài Khoản", icon: Users },
  ];

  return (
    <div className="min-h-screen flex bg-[#fff8f5] font-sans text-[#211a16]">
      {/* Stitch Admin SideNavBar */}
      <nav className="h-screen w-64 fixed left-0 top-0 bg-[#fff8f5] border-r border-[#d8c2b6] shadow-sm flex flex-col py-4 z-30 hidden md:flex">
        {/* Header */}
        <div className="px-6 py-4 mb-4 flex flex-col items-center border-b border-[#ede0d9]">
          <div className="h-12 w-12 rounded-full overflow-hidden mb-3 bg-[#004d5e] text-white flex items-center justify-center font-bold text-xl font-headline shadow">
            AP
          </div>
          <h2 className="font-headline text-lg font-bold text-[#6d3807] text-center">
            Admin Portal
          </h2>
          <p className="text-xs text-[#52443a] text-center font-medium">
            System Administration
          </p>
        </div>

        {/* Navigation Links */}
        <div className="flex-1 overflow-y-auto px-4">
          <ul className="space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive =
                pathname === item.href ||
                (item.href !== "/admin/requests" && pathname.startsWith(item.href));
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className={`flex items-center px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                      isActive
                        ? "text-[#6d3807] bg-[#f9ebe4]"
                        : "text-[#52443a] hover:bg-[#f9ebe4] hover:text-[#6d3807]"
                    }`}
                  >
                    <Icon className="w-5 h-5 mr-3 text-[#6d3807] shrink-0" />
                    <span>{item.label}</span>
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
            className="w-full flex items-center justify-center px-4 py-2.5 rounded-xl text-[#ba1a1a] bg-[#ffdad6]/40 hover:bg-[#ffdad6] transition-colors text-sm font-medium"
          >
            <LogOut className="w-4 h-4 mr-2" />
            <span>Đăng Xuất Admin</span>
          </button>
        </div>
      </nav>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col md:ml-64 w-full md:max-w-[calc(100%-16rem)] min-h-screen bg-[#F8FAFC]">
        {/* Stitch TopAppBar */}
        <header className="flex justify-between items-center w-full px-8 h-16 bg-[#ffffff] shadow-sm border-b border-[#d8c2b6] z-20 sticky top-0">
          <div className="flex items-center gap-6">
            <div className="font-headline text-xl font-bold text-[#6d3807] hidden md:block">
              EduTest Admin Portal
            </div>

            {/* Context-Aware Integrated TopBar Search Bar */}
            {onSearchChange ? (
              <div className="hidden md:flex items-center bg-[#fff8f5] hover:bg-[#f9ebe4] transition-colors rounded-full px-4 py-2 border border-[#d8c2b6] w-80 focus-within:border-[#6d3807]">
                <Search className="w-4 h-4 text-[#857469] mr-2 shrink-0" />
                <input
                  className="bg-transparent border-none focus:outline-none text-xs text-[#211a16] placeholder-[#857469] w-full"
                  placeholder={searchPlaceholder}
                  type="text"
                  value={searchValue}
                  onChange={(e) => onSearchChange(e.target.value)}
                />
              </div>
            ) : null}
          </div>

          <div className="flex items-center gap-4">
            <button className="text-[#52443a] hover:text-[#6d3807] p-2 rounded-full hover:bg-[#f9ebe4]">
              <Bell className="w-5 h-5" />
            </button>

            {/* TopBar Interactive User Dropdown */}
            <div className="relative">
              <button
                onClick={() => setShowUserDropdown(!showUserDropdown)}
                className="flex items-center space-x-3 p-1.5 rounded-xl hover:bg-[#fff8f5] transition-all border border-transparent hover:border-[#d8c2b6]"
              >
                <div className="h-9 w-9 rounded-full overflow-hidden border border-[#d8c2b6] bg-[#004d5e] text-white flex items-center justify-center font-bold text-xs shadow-sm">
                  AD
                </div>
                <div className="hidden sm:block text-left">
                  <span className="font-bold text-xs text-[#211a16] block">{user?.name || "Admin Root"}</span>
                  <span className="text-[10px] text-[#004d5e] block font-medium">Super Admin</span>
                </div>
                <ChevronDown className="w-4 h-4 text-[#857469]" />
              </button>

              {showUserDropdown && (
                <div className="absolute right-0 mt-2 w-56 bg-white rounded-2xl shadow-xl border border-[#d8c2b6] py-2 z-50 animate-in fade-in zoom-in-95 font-sans">
                  <div className="px-4 py-2.5 border-b border-[#d8c2b6]/30">
                    <p className="text-xs font-bold text-[#211a16]">{user?.name || "Admin Root"}</p>
                    <p className="text-[11px] text-[#52443a]">{user?.email || "admin@edtech.edu.vn"}</p>
                  </div>

                  <Link
                    href="/profile"
                    onClick={() => setShowUserDropdown(false)}
                    className="flex items-center px-4 py-2.5 text-xs text-[#211a16] hover:bg-[#fff8f5] hover:text-[#6d3807] transition-colors font-medium"
                  >
                    <User className="w-4 h-4 mr-2.5 text-[#6d3807]" />
                    <span>Thông Tin Cá Nhân</span>
                  </Link>

                  <div className="border-t border-[#d8c2b6]/30 mt-1 pt-1">
                    <button
                      onClick={handleLogout}
                      className="w-full flex items-center px-4 py-2.5 text-xs text-[#ba1a1a] hover:bg-[#ffdad6]/40 transition-colors font-medium text-left"
                    >
                      <LogOut className="w-4 h-4 mr-2.5 text-[#ba1a1a]" />
                      <span>Đăng Xuất (Log Out)</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        <main className="flex-1 p-6 md:p-8 bg-[#F8FAFC]">{children}</main>
      </div>
    </div>
  );
}
