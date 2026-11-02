"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Bell, CheckCheck } from "lucide-react";

interface NotificationItem {
  id: string;
  type: string;
  title: string;
  body: string | null;
  link: string | null;
  ref_id: string;
  read_at: string | null;
  created_at: string;
}

function formatRelativeTime(dateStr: string): string {
  try {
    const date = new Date(dateStr);
    const now = new Date();
    const diffSec = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (diffSec < 60) return "Vừa xong";
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `${diffMin} phút trước`;
    const diffHour = Math.floor(diffMin / 60);
    if (diffHour < 24) return `${diffHour} giờ trước`;
    const diffDay = Math.floor(diffHour / 24);
    if (diffDay < 30) return `${diffDay} ngày trước`;
    const diffMonth = Math.floor(diffDay / 30);
    if (diffMonth < 12) return `${diffMonth} tháng trước`;
    return `${Math.floor(diffMonth / 12)} năm trước`;
  } catch {
    return "";
  }
}

export default function NotificationBell() {
  const router = useRouter();
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [unread, setUnread] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await fetch("/api/notifications");
      if (!res.ok) return;
      const data = await res.json();
      if (data.success) {
        setItems(data.items || []);
        setUnread(typeof data.unread === "number" ? data.unread : 0);
      }
    } catch {
      // lỗi tải → im lặng giữ dữ liệu cũ
    }
  }, []);

  useEffect(() => {
    fetchNotifications();

    const interval = setInterval(() => {
      if (typeof document !== "undefined" && document.hidden) {
        return;
      }
      fetchNotifications();
    }, 60000);

    return () => clearInterval(interval);
  }, [fetchNotifications]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("keydown", handleKeyDown);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  const handleMarkAllRead = async () => {
    try {
      await fetch("/api/notifications/read", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      setItems((prev) =>
        prev.map((i) => ({ ...i, read_at: i.read_at || new Date().toISOString() }))
      );
      setUnread(0);
    } catch {
      // ignore
    }
  };

  const handleItemClick = async (item: NotificationItem) => {
    if (!item.read_at) {
      try {
        await fetch("/api/notifications/read", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ids: [item.id] }),
        });
        setItems((prev) =>
          prev.map((i) =>
            i.id === item.id ? { ...i, read_at: new Date().toISOString() } : i
          )
        );
        setUnread((prev) => Math.max(0, prev - 1));
      } catch {
        // ignore
      }
    }
    if (item.link) {
      setIsOpen(false);
      router.push(item.link);
    }
  };

  return (
    <div className="relative" ref={containerRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="text-ink-muted hover:text-brand-600 p-2 rounded-full hover:bg-brand-100 relative transition-colors"
        aria-label="Thông báo"
        type="button"
      >
        <Bell className="w-5 h-5" />
        {unread > 0 && (
          <span className="absolute -top-1 -right-1 flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[10px] font-bold text-white bg-red-700 rounded-full shadow-sm animate-in zoom-in-75">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white rounded-2xl shadow-xl border border-line py-2 z-50 animate-in fade-in zoom-in-95 font-sans">
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-line/30">
            <h3 className="font-bold text-sm text-ink">Thông báo</h3>
            {unread > 0 && (
              <button
                onClick={handleMarkAllRead}
                className="text-xs text-brand-600 hover:underline font-medium flex items-center gap-1"
                type="button"
              >
                <CheckCheck className="w-3.5 h-3.5" />
                <span>Đánh dấu đã đọc tất cả</span>
              </button>
            )}
          </div>

          <div className="max-h-96 overflow-y-auto divide-y divide-line/20">
            {items.length === 0 ? (
              <div className="py-8 text-center text-sm text-ink-subtle">
                Chưa có thông báo
              </div>
            ) : (
              items.map((item) => {
                const isUnread = !item.read_at;
                return (
                  <div
                    key={item.id}
                    onClick={() => handleItemClick(item)}
                    className={`px-4 py-3 cursor-pointer transition-colors ${
                      isUnread
                        ? "bg-surface-alt hover:bg-brand-100"
                        : "bg-white hover:bg-surface-alt/60"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p
                        className={`text-xs ${
                          isUnread
                            ? "font-bold text-ink"
                            : "font-medium text-ink-muted"
                        }`}
                      >
                        {item.title}
                      </p>
                      {isUnread && (
                        <span className="w-2 h-2 rounded-full bg-brand-600 shrink-0 mt-1" />
                      )}
                    </div>
                    {item.body && (
                      <p className="text-[11px] text-ink-muted mt-0.5 line-clamp-2">
                        {item.body}
                      </p>
                    )}
                    <p className="text-[10px] text-ink-subtle mt-1">
                      {formatRelativeTime(item.created_at)}
                    </p>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export { NotificationBell };
