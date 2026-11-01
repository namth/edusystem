"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import NotificationBell from "@/components/NotificationBell";
import {
  Users,
  PlusCircle,
  UserPlus,
  CreditCard,
  CheckSquare,
  LogOut,
  Search,
  Bell,
  BookOpen,
  BookMarked,
  User,
  Settings,
  ChevronDown,
  Layers,
  Bookmark,
} from "lucide-react";

export default function TeacherLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuth();
  const [showUserDropdown, setShowUserDropdown] = useState(false);

  const handleLogout = () => {
    logout();
    router.push("/login");
  };

  const navItems = [
    { href: "/teacher/classes", label: "Quản Lý Lớp Học", icon: BookOpen },
    { href: "/teacher/tests", label: "Quản Lý Lộ Trình & Khóa Học", icon: Layers },
    { href: "/teacher/library", label: "Kho Bài Học & Đề Thi", icon: BookMarked },
    { href: "/teacher/flashcards", label: "Quản Lý Flashcards", icon: Bookmark },
    { href: "/teacher/students/create", label: "Tạo Acc Học Sinh", icon: UserPlus },
    { href: "/teacher/slots", label: "Mua Slot Tài Khoản", icon: CreditCard },
    { href: "/teacher/grading", label: "Duyệt Điểm AI", icon: CheckSquare },
  ];

  return (
    <div className="min-h-screen flex bg-surface-alt font-sans text-ink">
      {/* Stitch Teacher SideNavBar */}
      <nav className="h-screen w-64 fixed left-0 top-0 bg-surface-alt border-r border-line shadow-sm flex flex-col py-4 z-30 hidden md:flex">
        {/* Header */}
        <div className="px-6 py-4 mb-4 flex flex-col items-center border-b border-line-soft">
          <img src="/brand/kitokit-mark.png" alt="KitoKit" className="h-14 w-14 object-contain mb-2" />
          <h2 className="font-headline text-lg font-bold text-brand-600 text-center">
            KitoKit          </h2>
          <p className="text-xs text-ink-muted text-center font-medium">
            Giáo viên
          </p>
        </div>

        {/* Navigation Links */}
        <div className="flex-1 overflow-y-auto px-4">
          <ul className="space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive =
                item.href === "/teacher/library"
                  ? pathname.startsWith("/teacher/library") ||
                    pathname.startsWith("/teacher/lessons") ||
                    pathname.startsWith("/teacher/tests/create")
                  : item.href === "/teacher/tests"
                  ? pathname === "/teacher/tests"
                  : pathname === item.href || (item.href !== "/teacher/classes" && pathname.startsWith(item.href));
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

        {/* Footer */}
        <div className="px-4 mt-auto">
          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center px-4 py-2.5 rounded-xl text-red-700 bg-red-100/40 hover:bg-red-100 transition-colors text-sm font-medium"
          >
            <LogOut className="w-4 h-4 mr-2" />
            <span>Đăng Xuất GV</span>
          </button>
        </div>
      </nav>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col md:ml-64 w-full md:max-w-[calc(100%-16rem)] min-h-screen bg-surface-alt">
        {/* Stitch TopAppBar */}
        <header className="flex justify-between items-center w-full px-8 h-16 bg-white shadow-sm border-b border-line z-20 sticky top-0">
          <div className="flex items-center gap-6">
            <div className="font-headline text-xl font-bold text-brand-600 hidden md:block">
              KitoKit · Giáo viên
            </div>
            <div className="hidden md:flex items-center bg-surface-alt hover:bg-brand-100 transition-colors rounded-full px-4 py-2 border border-line w-64">
              <Search className="w-4 h-4 text-ink-subtle mr-2" />
              <input
                className="bg-transparent border-none focus:outline-none text-xs text-ink placeholder-ink-subtle w-full"
                placeholder="Tìm bài học, lớp học..."
                type="text"
              />
            </div>
          </div>

          <div className="flex items-center gap-4">
            <NotificationBell />

            {/* TopBar Interactive User Dropdown */}
            <div className="relative">
              <button
                onClick={() => setShowUserDropdown(!showUserDropdown)}
                className="flex items-center space-x-3 p-1.5 rounded-xl hover:bg-surface-alt transition-all border border-transparent hover:border-line"
              >
                <div className="h-9 w-9 rounded-full overflow-hidden border border-line bg-ink-muted text-white flex items-center justify-center font-bold text-xs shadow-sm">
                  T
                </div>
                <div className="hidden sm:block text-left">
                  <span className="font-bold text-xs text-ink block">{user?.name || "Thầy Nguyễn Văn Đức"}</span>
                  <span className="text-[10px] text-brand-800 block font-medium">M.A TESOL</span>
                </div>
                <ChevronDown className="w-4 h-4 text-ink-subtle" />
              </button>

              {showUserDropdown && (
                <div className="absolute right-0 mt-2 w-56 bg-white rounded-2xl shadow-xl border border-line py-2 z-50 animate-in fade-in zoom-in-95 font-sans">
                  <div className="px-4 py-2.5 border-b border-line/30">
                    <p className="text-xs font-bold text-ink">{user?.name || "Thầy Nguyễn Văn Đức"}</p>
                    <p className="text-[11px] text-ink-muted">{user?.email || "teacher.duc@edtech.edu.vn"}</p>
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
