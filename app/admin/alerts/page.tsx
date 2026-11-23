"use client";

// SCR-52 — Cảnh báo hệ thống (FEAT-016, DEC-047/048).
import { useEffect, useState } from "react";
import AdminLayout from "@/components/AdminLayout";
import {
  AlertCircle,
  CheckCircle,
  Filter,
  Loader2,
  RefreshCw,
  Send,
  ShieldCheck,
  X,
  RotateCcw,
} from "lucide-react";

type Level = "ERROR" | "WARN" | "INFO";
type Source = "API" | "SERVER" | "AI" | "WORKER" | "EXAM_IMPORT";

interface AlertItem {
  id: string;
  fingerprint: string;
  level: Level;
  source: Source;
  title: string;
  detail: {
    message?: string;
    route?: string;
    method?: string;
    userId?: string;
    role?: string;
    stack?: string;
    extra?: Record<string, unknown>;
  };
  occurrences: number;
  status: "NEW" | "RESOLVED";
  first_seen_at: string;
  last_seen_at: string;
  last_notified_at: string | null;
  resolved_at: string | null;
  resolved_by: string | null;
}

const LEVEL_BADGE: Record<Level, string> = {
  ERROR: "bg-rose-50 text-rose-700 border-rose-200",
  WARN: "bg-amber-50 text-amber-700 border-amber-200",
  INFO: "bg-sky-50 text-sky-700 border-sky-200",
};
const SOURCE_LABEL: Record<Source, string> = {
  API: "API",
  SERVER: "Server",
  AI: "AI",
  WORKER: "Worker chấm",
  EXAM_IMPORT: "Nhập đề",
};
const STATUS_TABS = [
  { key: "NEW", label: "Mới" },
  { key: "RESOLVED", label: "Đã xử lý" },
  { key: "ALL", label: "Tất cả" },
];

function fmt(ts: string | null): string {
  if (!ts) return "—";
  return new Date(ts).toLocaleString("vi-VN", { dateStyle: "short", timeStyle: "short" });
}

export default function AdminAlertsPage() {
  const [items, setItems] = useState<AlertItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [telegramReady, setTelegramReady] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState("NEW");
  const [level, setLevel] = useState("");
  const [source, setSource] = useState("");
  const [selected, setSelected] = useState<AlertItem | null>(null);
  const [updating, setUpdating] = useState(false);
  const [toast, setToast] = useState<{ ok: boolean; text: string } | null>(null);
  const [testing, setTesting] = useState(false);

  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const q = new URLSearchParams({ status, page: String(page) });
        if (level) q.set("level", level);
        if (source) q.set("source", source);
        const res = await fetch(`/api/admin/alerts?${q.toString()}`);
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data.success) throw new Error(data.error || "Không thể tải danh sách cảnh báo.");
        if (cancelled) return;
        setItems(data.items || []);
        setTotal(Number(data.total) || 0);
        setPageSize(Number(data.pageSize) || 50);
        setTelegramReady(Boolean(data.telegram?.configured));
        setError(null);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Đã xảy ra lỗi khi kết nối máy chủ.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [status, level, source, page, reloadKey]);

  /** Mọi thay đổi bộ lọc / làm mới đi qua đây để bật trạng thái đang tải. */
  const reload = (apply?: () => void) => {
    setLoading(true);
    apply?.();
    setReloadKey((k) => k + 1);
  };

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  const setStatusOf = async (item: AlertItem, next: "RESOLVED" | "NEW") => {
    setUpdating(true);
    try {
      const res = await fetch(`/api/admin/alerts/${encodeURIComponent(item.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: next }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) throw new Error(data.error || "Không cập nhật được cảnh báo.");
      setSelected(null);
      setToast({ ok: true, text: next === "RESOLVED" ? "Đã đánh dấu đã xử lý." : "Đã mở lại cảnh báo." });
      reload();
    } catch (err) {
      setToast({ ok: false, text: err instanceof Error ? err.message : "Không cập nhật được cảnh báo." });
    } finally {
      setUpdating(false);
    }
  };

  const sendTest = async () => {
    setTesting(true);
    try {
      const res = await fetch("/api/admin/alerts/test", { method: "POST" });
      const data = await res.json().catch(() => ({}));
      setToast(res.ok && data.success ? { ok: true, text: "Đã gửi tin thử tới Telegram." } : { ok: false, text: data.error || "Gửi tin thử thất bại." });
    } catch {
      setToast({ ok: false, text: "Gửi tin thử thất bại." });
    } finally {
      setTesting(false);
    }
  };

  const filtered = Boolean(level || source || status !== "NEW");
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <AdminLayout>
      <div className="p-6 md:p-8 space-y-6 max-w-7xl mx-auto w-full">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-ink">Cảnh Báo Hệ Thống</h1>
            <p className="text-sm text-ink-muted mt-1">
              Lỗi API, lỗi AI, worker chấm bài và dạng câu nhập đề chưa hỗ trợ. Cùng một lỗi được gộp lại và đếm số lần.
            </p>
          </div>
          <button
            onClick={() => reload()}
            disabled={loading}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-surface border border-line text-xs font-semibold text-ink-muted hover:text-brand-600 hover:border-brand-300 transition-colors cursor-pointer w-fit"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            Làm mới
          </button>
        </div>

        {/* Trạng thái Telegram */}
        {telegramReady !== null && (
          <div
            className={`rounded-2xl border p-4 flex flex-col sm:flex-row sm:items-center gap-3 justify-between ${
              telegramReady ? "bg-emerald-50 border-emerald-200" : "bg-amber-50 border-amber-200"
            }`}
          >
            <p className={`text-xs font-semibold ${telegramReady ? "text-emerald-800" : "text-amber-800"}`}>
              {telegramReady
                ? "Telegram: đã cấu hình. Cảnh báo mới được gửi về nhóm admin (mỗi lỗi tối đa 1 tin/15 phút)."
                : "Telegram: chưa cấu hình. Đặt TELEGRAM_BOT_TOKEN và TELEGRAM_ALERT_CHAT_ID trên server (docs/15 §4). Cảnh báo vẫn được lưu tại đây."}
            </p>
            {telegramReady && (
              <button
                onClick={sendTest}
                disabled={testing}
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-brand-600 text-white text-xs font-bold hover:bg-brand-700 disabled:opacity-60 cursor-pointer w-fit"
              >
                {testing ? <Loader2 className="w-3.5 h-3.5 animate-spin text-white" /> : <Send className="w-3.5 h-3.5 text-white" />}
                Gửi tin thử
              </button>
            )}
          </div>
        )}

        {/* Bộ lọc */}
        <div className="bg-surface rounded-2xl p-4 border border-line shadow-xs flex flex-col lg:flex-row gap-3 lg:items-center justify-between">
          <div className="flex items-center gap-2 overflow-x-auto">
            <span className="text-xs font-semibold text-ink-muted mr-1 flex items-center gap-1">
              <Filter className="w-3.5 h-3.5" /> Trạng thái:
            </span>
            {STATUS_TABS.map((t) => (
              <button
                key={t.key}
                onClick={() =>
                  reload(() => {
                    setStatus(t.key);
                    setPage(1);
                  })
                }
                className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap cursor-pointer ${
                  status === t.key ? "bg-brand-600 text-white" : "bg-surface-alt text-ink-muted hover:bg-brand-50 hover:text-brand-600"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <select
              aria-label="Lọc theo mức"
              value={level}
              onChange={(e) => {
                const v = e.target.value;
                reload(() => {
                  setLevel(v);
                  setPage(1);
                });
              }}
              className="text-xs px-3 py-1.5 rounded-lg border border-line bg-surface-alt text-ink"
            >
              <option value="">Mọi mức</option>
              <option value="ERROR">ERROR</option>
              <option value="WARN">WARN</option>
              <option value="INFO">INFO</option>
            </select>
            <select
              aria-label="Lọc theo nguồn"
              value={source}
              onChange={(e) => {
                const v = e.target.value;
                reload(() => {
                  setSource(v);
                  setPage(1);
                });
              }}
              className="text-xs px-3 py-1.5 rounded-lg border border-line bg-surface-alt text-ink"
            >
              <option value="">Mọi nguồn</option>
              {(Object.keys(SOURCE_LABEL) as Source[]).map((s) => (
                <option key={s} value={s}>
                  {SOURCE_LABEL[s]}
                </option>
              ))}
            </select>
          </div>
        </div>

        {loading ? (
          <div className="bg-surface rounded-2xl border border-line p-4 space-y-3" aria-busy="true">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="h-8 rounded-lg bg-surface-alt animate-pulse" />
            ))}
          </div>
        ) : error ? (
          <div className="bg-rose-50 border border-rose-200 rounded-2xl p-6 text-rose-800 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-bold">Lỗi tải dữ liệu</p>
              <p className="text-xs mt-1">{error}</p>
              <button onClick={() => reload()} className="mt-3 text-xs font-bold text-rose-700 underline cursor-pointer">
                Thử lại
              </button>
            </div>
          </div>
        ) : items.length === 0 ? (
          <div className="bg-surface rounded-2xl border border-line p-12 text-center text-ink-muted">
            <ShieldCheck className="w-10 h-10 text-emerald-600 mx-auto mb-3" />
            {filtered ? (
              <>
                <p className="text-sm font-bold text-ink">Không có cảnh báo khớp bộ lọc</p>
                <button
                  onClick={() =>
                    reload(() => {
                      setStatus("NEW");
                      setLevel("");
                      setSource("");
                      setPage(1);
                    })
                  }
                  className="mt-3 text-xs font-bold text-brand-600 underline cursor-pointer"
                >
                  Xoá lọc
                </button>
              </>
            ) : (
              <p className="text-sm font-bold text-ink">Chưa có cảnh báo nào. Hệ thống đang chạy ổn.</p>
            )}
          </div>
        ) : (
          <div className="bg-surface rounded-2xl border border-line shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-surface-alt border-b border-line text-ink-muted uppercase font-bold text-[11px]">
                  <tr>
                    <th className="py-3 px-4">Mức</th>
                    <th className="py-3 px-4">Nguồn</th>
                    <th className="py-3 px-4 min-w-[260px]">Tiêu đề</th>
                    <th className="py-3 px-4 text-right">Số lần</th>
                    <th className="py-3 px-4">Lần đầu</th>
                    <th className="py-3 px-4">Lần cuối</th>
                    <th className="py-3 px-4">Telegram</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line text-ink">
                  {items.map((a) => (
                    <tr
                      key={a.id}
                      onClick={() => setSelected(a)}
                      className={`cursor-pointer hover:bg-brand-50/40 transition-colors ${a.status === "RESOLVED" ? "opacity-70" : ""}`}
                    >
                      <td className="py-3 px-4">
                        <span className={`inline-block px-2 py-0.5 rounded-full border text-[11px] font-bold ${LEVEL_BADGE[a.level]}`}>{a.level}</span>
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap text-ink-muted">{SOURCE_LABEL[a.source] || a.source}</td>
                      <td className="py-3 px-4 font-semibold break-words">
                        {a.title}
                        {a.status === "RESOLVED" && (
                          <span className="ml-2 inline-flex items-center gap-1 text-emerald-700 text-[11px] font-semibold">
                            <CheckCircle className="w-3 h-3" /> Đã xử lý
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right font-mono">{a.occurrences}</td>
                      <td className="py-3 px-4 whitespace-nowrap text-ink-subtle">{fmt(a.first_seen_at)}</td>
                      <td className="py-3 px-4 whitespace-nowrap text-ink-subtle">{fmt(a.last_seen_at)}</td>
                      <td className="py-3 px-4 whitespace-nowrap text-ink-subtle">{fmt(a.last_notified_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-line text-xs text-ink-muted">
                <span>
                  Trang {page}/{totalPages} · {total} cảnh báo
                </span>
                <div className="flex gap-2">
                  <button disabled={page <= 1} onClick={() => reload(() => setPage(page - 1))} className="px-3 py-1 rounded-lg border border-line disabled:opacity-40 cursor-pointer">
                    Trước
                  </button>
                  <button disabled={page >= totalPages} onClick={() => reload(() => setPage(page + 1))} className="px-3 py-1 rounded-lg border border-line disabled:opacity-40 cursor-pointer">
                    Sau
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Ngăn chi tiết */}
      {selected && (
        <div className="fixed inset-0 z-40 flex justify-end bg-ink/30" onClick={() => setSelected(null)}>
          <aside
            role="dialog"
            aria-label="Chi tiết cảnh báo"
            className="w-full max-w-xl h-full bg-surface shadow-xl overflow-y-auto p-6 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <span className={`inline-block px-2 py-0.5 rounded-full border text-[11px] font-bold ${LEVEL_BADGE[selected.level]}`}>{selected.level}</span>
                <span className="ml-2 text-xs text-ink-muted">{SOURCE_LABEL[selected.source] || selected.source}</span>
                <h2 className="mt-2 text-base font-bold text-ink break-words">{selected.title}</h2>
              </div>
              <button onClick={() => setSelected(null)} aria-label="Đóng" className="p-1 rounded-lg hover:bg-surface-alt cursor-pointer">
                <X className="w-4 h-4 text-ink-muted" />
              </button>
            </div>
            <dl className="grid grid-cols-2 gap-2 text-xs">
              <dt className="text-ink-muted">Số lần</dt>
              <dd className="font-mono">{selected.occurrences}</dd>
              <dt className="text-ink-muted">Lần đầu / lần cuối</dt>
              <dd>
                {fmt(selected.first_seen_at)} / {fmt(selected.last_seen_at)}
              </dd>
              {selected.detail?.method || selected.detail?.route ? (
                <>
                  <dt className="text-ink-muted">Route</dt>
                  <dd className="font-mono break-all">
                    {selected.detail.method} {selected.detail.route}
                  </dd>
                </>
              ) : null}
              {selected.detail?.userId && (
                <>
                  <dt className="text-ink-muted">Người dùng</dt>
                  <dd className="font-mono">
                    {selected.detail.userId} {selected.detail.role ? `(${selected.detail.role})` : ""}
                  </dd>
                </>
              )}
              {selected.status === "RESOLVED" && (
                <>
                  <dt className="text-ink-muted">Đã xử lý</dt>
                  <dd>
                    {fmt(selected.resolved_at)} {selected.resolved_by ? `· ${selected.resolved_by}` : ""}
                  </dd>
                </>
              )}
            </dl>
            {selected.detail?.message && (
              <div>
                <p className="text-xs font-bold text-ink-muted mb-1">Thông điệp</p>
                <pre className="text-xs bg-surface-alt border border-line rounded-xl p-3 whitespace-pre-wrap break-words">{selected.detail.message}</pre>
              </div>
            )}
            {selected.detail?.stack && (
              <div>
                <p className="text-xs font-bold text-ink-muted mb-1">Stack (10 dòng đầu)</p>
                <pre className="text-[11px] bg-surface-alt border border-line rounded-xl p-3 whitespace-pre-wrap break-words">{selected.detail.stack}</pre>
              </div>
            )}
            {selected.detail?.extra && (
              <div>
                <p className="text-xs font-bold text-ink-muted mb-1">Thông tin thêm</p>
                <pre className="text-[11px] bg-surface-alt border border-line rounded-xl p-3 whitespace-pre-wrap break-words">
                  {JSON.stringify(selected.detail.extra, null, 2)}
                </pre>
              </div>
            )}
            <div className="pt-2">
              {selected.status === "NEW" ? (
                <button
                  onClick={() => void setStatusOf(selected, "RESOLVED")}
                  disabled={updating}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-brand-600 text-white text-xs font-bold hover:bg-brand-700 disabled:opacity-60 cursor-pointer"
                >
                  {updating ? <Loader2 className="w-3.5 h-3.5 animate-spin text-white" /> : <CheckCircle className="w-3.5 h-3.5 text-white" />}
                  Đánh dấu đã xử lý
                </button>
              ) : (
                <button
                  onClick={() => void setStatusOf(selected, "NEW")}
                  disabled={updating}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-line text-xs font-bold text-ink hover:border-brand-300 disabled:opacity-60 cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  Mở lại
                </button>
              )}
            </div>
          </aside>
        </div>
      )}

      {toast && (
        <div
          role="status"
          className={`fixed bottom-6 right-6 z-50 px-4 py-3 rounded-xl shadow-lg text-xs font-semibold border ${
            toast.ok ? "bg-emerald-50 text-emerald-800 border-emerald-200" : "bg-rose-50 text-rose-800 border-rose-200"
          }`}
        >
          {toast.text}
        </div>
      )}
    </AdminLayout>
  );
}
