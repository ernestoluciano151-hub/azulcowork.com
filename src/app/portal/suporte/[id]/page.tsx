"use client";

/**
 * /portal/suporte/[id] — Detalhe de ticket + conversa (VOL09)
 *
 * Consome:
 *   GET /api/portal/support/tickets/[id]
 *   GET /api/portal/support/tickets/[id]/messages
 *   POST /api/portal/support/tickets/[id]/messages
 *   POST /api/portal/support/tickets/[id]/close
 *   POST /api/portal/support/tickets/[id]/reopen
 */

import { useEffect, useState, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import PortalLayout, { usePortalAuth } from "@/components/portal/PortalLayout";
import Link from "next/link";

interface Ticket {
  id:         string;
  number:     string;
  subject:    string;
  status:     string;
  priority:   string;
  category:   string;
  createdAt:  string;
  resolvedAt: string | null;
  closedAt:   string | null;
}

interface Message {
  id:         string;
  body:       string;
  isFromStaff:boolean;
  authorName: string | null;
  createdAt:  string;
  attachmentUrl: string | null;
}

function fmtDatetime(d: string) {
  return new Date(d).toLocaleString("pt-AO", {
    day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit",
  });
}

const STATUS_STYLE: Record<string, { label: string; cls: string }> = {
  OPEN:         { label: "Aberto",      cls: "bg-blue-100 text-blue-700" },
  IN_PROGRESS:  { label: "Em Curso",    cls: "bg-amber-100 text-amber-700" },
  PENDING_USER: { label: "Aguarda",     cls: "bg-purple-100 text-purple-700" },
  RESOLVED:     { label: "Resolvido",   cls: "bg-green-100 text-green-700" },
  CLOSED:       { label: "Fechado",     cls: "bg-gray-100 text-gray-500" },
  CANCELLED:    { label: "Cancelado",   cls: "bg-gray-100 text-gray-400" },
};

function TicketDetail() {
  const params  = useParams();
  const router  = useRouter();
  const { user } = usePortalAuth();
  const id      = params.id as string;
  const bottomRef = useRef<HTMLDivElement>(null);

  const [ticket,   setTicket]   = useState<Ticket | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState<string | null>(null);
  const [reply,    setReply]    = useState("");
  const [sending,  setSending]  = useState(false);
  const [closing,  setClosing]  = useState(false);

  const loadMessages = useCallback(async () => {
    const res  = await fetch(`/api/portal/support/tickets/${id}/messages`);
    const json = await res.json();
    if (res.ok) setMessages(json.data ?? []);
  }, [id]);

  const load = useCallback(async () => {
    try {
      const res  = await fetch(`/api/portal/support/tickets/${id}`);
      const json = await res.json();
      if (res.status === 404) { router.replace("/portal/suporte"); return; }
      if (!res.ok) throw new Error(json.error ?? "Erro ao carregar ticket.");
      setTicket(json.data);
      await loadMessages();
    } catch {
      setError("Não foi possível carregar o ticket.");
    } finally {
      setLoading(false);
    }
  }, [id, router, loadMessages]);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!reply.trim()) return;
    setSending(true);
    try {
      const res  = await fetch(`/api/portal/support/tickets/${id}/messages`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ body: reply.trim() }),
      });
      if (!res.ok) {
        const json = await res.json();
        alert(json.error ?? "Erro ao enviar mensagem.");
        return;
      }
      setReply("");
      await loadMessages();
    } catch {
      alert("Erro ao enviar mensagem. Tente novamente.");
    } finally {
      setSending(false);
    }
  }

  async function handleClose() {
    if (!confirm("Marcar este ticket como fechado?")) return;
    setClosing(true);
    try {
      await fetch(`/api/portal/support/tickets/${id}/close`, { method: "POST" });
      await load();
    } finally {
      setClosing(false);
    }
  }

  async function handleReopen() {
    setClosing(true);
    try {
      await fetch(`/api/portal/support/tickets/${id}/reopen`, { method: "POST" });
      await load();
    } finally {
      setClosing(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }
  if (error || !ticket) {
    return <div className="p-8 text-center text-red-600 text-sm">{error}</div>;
  }

  const st        = STATUS_STYLE[ticket.status] ?? { label: ticket.status, cls: "bg-gray-100 text-gray-600" };
  const isClosed  = ["CLOSED", "CANCELLED", "RESOLVED"].includes(ticket.status);

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-5">
      <div className="flex items-center gap-3">
        <Link href="/portal/suporte" className="text-sm text-gray-400 hover:text-gray-600">
          ← Suporte
        </Link>
      </div>

      {/* Header */}
      <div className="bg-white rounded-xl border border-gray-100 p-5">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <span className="font-mono text-xs text-gray-400">{ticket.number}</span>
              <span className={`text-xs px-2 py-0.5 rounded-full ${st.cls}`}>{st.label}</span>
              <span className="text-xs text-gray-400">{ticket.category}</span>
            </div>
            <h1 className="font-semibold text-gray-900 text-lg">{ticket.subject}</h1>
            <div className="text-xs text-gray-400 mt-1">
              Aberto em {fmtDatetime(ticket.createdAt)}
              {ticket.resolvedAt && ` · Resolvido em ${fmtDatetime(ticket.resolvedAt)}`}
            </div>
          </div>
          <div>
            {!isClosed ? (
              <button
                onClick={handleClose}
                disabled={closing}
                className="text-sm border border-gray-200 text-gray-600 px-3 py-1.5 rounded-lg hover:bg-gray-50 disabled:opacity-50"
              >
                {closing ? "..." : "Fechar ticket"}
              </button>
            ) : ticket.status !== "CANCELLED" ? (
              <button
                onClick={handleReopen}
                disabled={closing}
                className="text-sm border border-blue-200 text-blue-600 px-3 py-1.5 rounded-lg hover:bg-blue-50 disabled:opacity-50"
              >
                {closing ? "..." : "Reabrir"}
              </button>
            ) : null}
          </div>
        </div>
      </div>

      {/* Mensagens */}
      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
        <div className="p-4 bg-gray-50 border-b border-gray-100 text-xs text-gray-500">
          Conversa · {messages.length} mensagem{messages.length !== 1 ? "s" : ""}
        </div>
        <div className="p-4 space-y-4 max-h-[480px] overflow-y-auto">
          {messages.length === 0 && (
            <div className="text-center text-sm text-gray-400 py-6">
              Ainda não há mensagens neste ticket.
            </div>
          )}
          {messages.map((msg) => {
            const isMe = !msg.isFromStaff;
            return (
              <div key={msg.id} className={`flex ${isMe ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[85%] ${isMe ? "items-end" : "items-start"} flex flex-col gap-1`}>
                  <div className="flex items-center gap-2 text-xs text-gray-400">
                    {!isMe && <span className="font-medium text-gray-600">Azul Coworking</span>}
                    {isMe && <span className="font-medium text-blue-600">{user?.name?.split(" ")[0]}</span>}
                    <span>{fmtDatetime(msg.createdAt)}</span>
                  </div>
                  <div className={`px-4 py-2.5 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap ${
                    isMe
                      ? "bg-blue-600 text-white rounded-br-sm"
                      : "bg-gray-100 text-gray-800 rounded-bl-sm"
                  }`}>
                    {msg.body}
                  </div>
                </div>
              </div>
            );
          })}
          <div ref={bottomRef} />
        </div>

        {/* Reply box */}
        {!isClosed && (
          <div className="border-t border-gray-100 p-4">
            <form onSubmit={handleSend} className="flex gap-3">
              <textarea
                value={reply}
                onChange={(e) => setReply(e.target.value)}
                placeholder="Escreva a sua resposta..."
                rows={2}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    void handleSend(e as unknown as React.FormEvent);
                  }
                }}
                className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 resize-none"
              />
              <button
                type="submit"
                disabled={sending || !reply.trim()}
                className="bg-blue-600 text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-blue-700 disabled:opacity-50 self-end"
              >
                {sending ? "..." : "Enviar"}
              </button>
            </form>
            <p className="text-xs text-gray-400 mt-1">Enter para enviar · Shift+Enter para nova linha</p>
          </div>
        )}

        {isClosed && (
          <div className="border-t border-gray-100 p-4 bg-gray-50 text-center text-sm text-gray-500">
            Este ticket está fechado. Pode reabri-lo se o problema persistir.
          </div>
        )}
      </div>
    </div>
  );
}

export default function PortalTicketDetailPage() {
  return (
    <PortalLayout>
      <TicketDetail />
    </PortalLayout>
  );
}
