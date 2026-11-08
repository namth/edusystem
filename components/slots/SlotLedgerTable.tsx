"use client";

import { useState, useEffect, useCallback } from "react";
import { Loader2, AlertCircle, RefreshCw } from "lucide-react";

export interface LedgerItem {
  id: string;
  delta: number;
  balance_after: number;
  reason: "PURCHASE" | "ADMIN_ADJUST" | "ENROLL" | "CYCLE" | "MIGRATION" | string;
  class_id?: string | null;
  class_name?: string | null;
  period?: number | null;
  student_count?: number | null;
  note?: string | null;
  created_at: string;
}

export interface ClassOption {
  id: string;
  name: string;
}

interface SlotLedgerTableProps {
  teacherId?: string;
  classes?: ClassOption[];
  onRefreshWallet?: () => void;
}

const REASON_LABELS: Record<string, string> = {
  PURCHASE: "Mua slot",
  ADMIN_ADJUST: "Admin điều chỉnh",
  ENROLL: "Học sinh vào lớp",
  CYCLE: "Trừ theo tháng",
  MIGRATION: "Chuyển đổi",
};

export function SlotLedgerTable({
  teacherId,
  classes: initialClasses,
}: SlotLedgerTableProps) {
  const [ledger, setLedger] = useState<LedgerItem[]>([]);
  const [classes, setClasses] = useState<ClassOption[]>(initialClasses || []);
  const [classFilter, setClassFilter] = useState<string>("");
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [loadingMore, setLoadingMore] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const formatDateTime = (isoStr: string) => {
    try {
      const d = new Date(isoStr);
      if (isNaN(d.getTime())) return isoStr;
      const day = String(d.getDate()).padStart(2, "0");
      const month = String(d.getMonth() + 1).padStart(2, "0");
      const year = d.getFullYear();
      const hours = String(d.getHours()).padStart(2, "0");
      const minutes = String(d.getMinutes()).padStart(2, "0");
      return `${hours}:${minutes} ${day}/${month}/${year}`;
    } catch {
      return isoStr;
    }
  };

  const fetchLedger = useCallback(
    async (cursor?: string | null, isAppend = false) => {
      try {
        if (isAppend) {
          setLoadingMore(true);
        } else {
          setLoading(true);
          setError(null);
        }

        const endpoint = teacherId
          ? `/api/admin/teachers/${teacherId}/slot-wallet`
          : `/api/teacher/slot-wallet`;

        const params = new URLSearchParams();
        if (classFilter) {
          params.set("class_id", classFilter);
        }
        if (cursor) {
          params.set("cursor", cursor);
        }

        const queryString = params.toString() ? `?${params.toString()}` : "";
        const res = await fetch(`${endpoint}${queryString}`);

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error || "Không thể tải lịch sử ví slot.");
        }

        const data = await res.json();
        const items: LedgerItem[] = data.ledger || [];

        if (isAppend) {
          setLedger((prev) => [...prev, ...items]);
        } else {
          setLedger(items);
        }

        setNextCursor(data.next_cursor || null);

        if (data.classes && (!classes || classes.length === 0)) {
          setClasses(
            data.classes.map((c: any) => ({
              id: c.id,
              name: c.name,
            }))
          );
        }
      } catch (err: any) {
        console.error("fetchLedger error:", err);
        setError(err.message || "Lỗi khi tải dữ liệu.");
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [teacherId, classFilter]
  );

  useEffect(() => {
    fetchLedger(null, false);
  }, [fetchLedger]);

  const handleClassChange = (newClassId: string) => {
    setClassFilter(newClassId);
  };

  const handleLoadMore = () => {
    if (nextCursor && !loadingMore) {
      fetchLedger(nextCursor, true);
    }
  };

  return (
    <div className="space-y-4">
      {/* Bộ lọc theo lớp */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <h3 className="text-base font-bold text-ink">Lịch sử giao dịch ví slot</h3>
        <div className="flex items-center space-x-2">
          <label htmlFor="class-filter" className="text-xs font-medium text-ink-muted">
            Lọc theo lớp:
          </label>
          <select
            id="class-filter"
            value={classFilter}
            onChange={(e) => handleClassChange(e.target.value)}
            className="text-xs border border-line rounded-xl px-3 py-1.5 bg-white text-ink focus:outline-none focus:ring-2 focus:ring-brand-500"
          >
            <option value="">Tất cả các lớp</option>
            {classes.map((cls) => (
              <option key={cls.id} value={cls.id}>
                {cls.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Trạng thái 1: Đang tải ban đầu */}
      {loading && (
        <div className="flex flex-col items-center justify-center p-12 bg-white rounded-2xl border border-line">
          <Loader2 className="w-6 h-6 animate-spin text-brand-600 mb-2" />
          <span className="text-xs text-ink-muted">Đang tải lịch sử giao dịch...</span>
        </div>
      )}

      {/* Trạng thái 2: Lỗi + nút Thử lại */}
      {!loading && error && (
        <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
            <span className="text-xs font-semibold">{error}</span>
          </div>
          <button
            onClick={() => fetchLedger(null, false)}
            className="px-3 py-1.5 bg-rose-600 text-white rounded-xl text-xs font-medium hover:bg-rose-700 transition-colors"
          >
            Thử lại
          </button>
        </div>
      )}

      {/* Trạng thái 3: Rỗng */}
      {!loading && !error && ledger.length === 0 && (
        <div className="p-12 text-center border border-dashed border-line rounded-2xl bg-surface-alt">
          <p className="text-sm font-medium text-ink-muted">Chưa có giao dịch</p>
        </div>
      )}

      {/* Trạng thái 4: Có dữ liệu */}
      {!loading && !error && ledger.length > 0 && (
        <div className="bg-white rounded-2xl border border-line shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-surface-alt border-b border-line text-ink-muted font-bold uppercase text-[10px] tracking-wider">
                <tr>
                  <th className="px-4 py-3">Thời gian</th>
                  <th className="px-4 py-3">Loại</th>
                  <th className="px-4 py-3">Lớp</th>
                  <th className="px-4 py-3 text-right">Thay đổi</th>
                  <th className="px-4 py-3 text-right">Số dư sau</th>
                  <th className="px-4 py-3">Ghi chú</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line/60">
                {ledger.map((item) => {
                  const isPositive = item.delta > 0;
                  const formattedDelta = isPositive
                    ? `+${item.delta.toLocaleString("vi-VN")}`
                    : item.delta.toLocaleString("vi-VN");
                  const formattedBalance = item.balance_after.toLocaleString("vi-VN");
                  const reasonLabel = REASON_LABELS[item.reason] || item.reason;

                  return (
                    <tr key={item.id} className="hover:bg-brand-50/20 transition-colors">
                      <td className="px-4 py-3 text-ink-muted whitespace-nowrap">
                        {formatDateTime(item.created_at)}
                      </td>
                      <td className="px-4 py-3 font-medium text-ink whitespace-nowrap">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-surface-alt border border-line text-ink">
                          {reasonLabel}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-ink whitespace-nowrap">
                        {item.class_name || (item.class_id ? item.class_id : "—")}
                      </td>
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        <span
                          className={`font-bold ${
                            isPositive ? "text-emerald-600" : "text-rose-600"
                          }`}
                        >
                          {formattedDelta}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right font-medium text-ink whitespace-nowrap">
                        {formattedBalance}
                      </td>
                      <td className="px-4 py-3 text-ink-muted max-w-xs truncate">
                        {item.note || "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Phân trang: Xem thêm */}
          {nextCursor && (
            <div className="p-4 border-t border-line text-center bg-surface-alt/40">
              <button
                onClick={handleLoadMore}
                disabled={loadingMore}
                className="inline-flex items-center space-x-2 px-4 py-2 bg-white hover:bg-surface-alt border border-line rounded-xl text-xs font-semibold text-ink shadow-sm transition-all disabled:opacity-50"
              >
                {loadingMore ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-brand-600" />
                    <span>Đang nạp thêm...</span>
                  </>
                ) : (
                  <span>Xem thêm</span>
                )}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default SlotLedgerTable;
