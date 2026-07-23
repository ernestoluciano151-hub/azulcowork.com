"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { format, formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  entityType: string | null;
  entityId: string | null;
  read: boolean;
  priority: string;
  createdAt: string;
}

const TYPE_ICONS: Record<string, string> = {
  SUCCESS: "✅",
  INFO:    "ℹ️",
  WARNING: "⚠️",
  ERROR:   "🔴",
};

const PRIORITY_STYLES: Record<string, string> = {
  URGENT: "border-l-2 border-red-500",
  HIGH:   "border-l-2 border-amber-500",
  NORMAL: "",
  LOW:    "",
};

export default function NotificationBell() {
  const [open, setOpen]               = useState(false);
  const [notifications, setNotifs]    = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading]         = useState(false);
  const ref                           = useRef<HTMLDivElement>(null);

  const fetchNotifs = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/notifications?limit=30");
      if (res.ok) {
        const data = await res.json();
        setNotifs(data.notifications || []);
        setUnreadCount(data.unreadCount || 0);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  // Poll every 30s for new notifications
  useEffect(() => {
    fetchNotifs();
    const interval = setInterval(fetchNotifs, 30_000);
    return () => clearInterval(interval);
  }, [fetchNotifs]);

  // Close on outside click
  useEffect(() => {
    function handle(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, []);

  async function markAllRead() {
    await fetch("/api/notifications/read-all", { method: "POST" });
    setNotifs(n => n.map(x => ({ ...x, read: true })));
    setUnreadCount(0);
  }

  async function markRead(id: string) {
    await fetch(`/api/notifications/${id}`, { method: "PATCH" });
    setNotifs(n => n.map(x => x.id === id ? { ...x, read: true } : x));
    setUnreadCount(c => Math.max(0, c - 1));
  }

  return (
    <div ref={ref} className="relative">
      {/* Bell button */}
      <button
        onClick={() => { setOpen(o => !o); if (!open) fetchNotifs(); }}
        className="relative flex h-9 w-9 items-center justify-center rounded-lg hover:bg-white/5 transition-colors"
        aria-label="Notificações"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} className="text-mist">
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
        </svg>
        {unreadCount > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white leading-none">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown panel */}
      {open && (
        <div className="absolute right-0 top-11 z-50 w-96 rounded-xl border border-white/10 bg-[#0d1829] shadow-2xl">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
            <h3 className="font-semibold text-paper text-sm">Notificações</h3>
            {unreadCount > 0 && (
              <button
                onClick={markAllRead}
                className="text-xs text-azul hover:underline"
              >
                Marcar todas como lidas
              </button>
            )}
          </div>

          {/* List */}
          <div className="max-h-96 overflow-y-auto">
            {loading && notifications.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-mist">A carregar…</p>
            ) : notifications.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-mist">
                Sem notificações.
              </p>
            ) : (
              <div className="divide-y divide-white/5">
                {notifications.map((n) => (
                  <div
                    key={n.id}
                    onClick={() => !n.read && markRead(n.id)}
                    className={[
                      "flex gap-3 px-4 py-3 transition-colors",
                      n.read ? "opacity-60" : "cursor-pointer hover:bg-white/3",
                      PRIORITY_STYLES[n.priority] || "",
                    ].join(" ")}
                  >
                    <span className="mt-0.5 flex-shrink-0 text-base">
                      {TYPE_ICONS[n.type] ?? "🔔"}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <p className={`text-xs font-semibold ${n.read ? "text-mist" : "text-paper"}`}>
                          {n.title}
                        </p>
                        {!n.read && (
                          <span className="mt-1 flex-shrink-0 h-1.5 w-1.5 rounded-full bg-azul" />
                        )}
                      </div>
                      <p className="mt-0.5 text-xs text-mist leading-relaxed">{n.message}</p>
                      <p className="mt-1 text-[10px] text-mist/60">
                        {formatDistanceToNow(new Date(n.createdAt), { addSuffix: true, locale: ptBR })}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Footer */}
          {notifications.length > 0 && (
            <div className="border-t border-white/10 px-4 py-2.5 text-center">
              <span className="text-xs text-mist">
                {unreadCount} não lida(s) · {notifications.length} total
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
