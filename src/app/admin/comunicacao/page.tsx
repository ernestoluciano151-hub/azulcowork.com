"use client";

/**
 * /admin/comunicacao — Centro de Comunicação
 *
 * Histórico paginado de CommunicationLog com filtros por tipo, estado e canal.
 * VOL07 — Sprint VOL07-3
 */

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";

type CommLog = {
  id:           string;
  type:         string;
  channel:      string;
  templateSlug: string | null;
  to:           string;
  subject:      string | null;
  status:       string;
  attempts:     number;
  sentAt:       string | null;
  lastAttemptAt: string | null;
  errorMsg:     string | null;
  entityType:   string | null;
  entityId:     string | null;
  triggeredBy:  string;
  createdAt:    string;
};

type Pagination = {
  page:  number;
  limit: number;
  total: number;
  pages: number;
};

const STATUS_COLORS: Record<string, string> = {
  SENT:     "bg-emerald-500/20 text-emerald-300",
  FAILED:   "bg-red-500/20 text-red-300",
  PENDING:  "bg-yellow-500/20 text-yellow-300",
  RETRYING: "bg-blue-500/20 text-blue-300",
};

const TYPE_ICONS: Record<string, string> = {
  EMAIL:             "✉️",
  WHATSAPP:          "💬",
  WHATSAPP_DEEPLINK: "🔗",
};

function fmtDate(d: string | null): string {
  if (!d) return "—";
  return new Date(d).toLocaleString("pt-PT", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
    timeZone: "Africa/Luanda",
  });
}

export default function ComunicacaoPage() {
  const router = useRouter();

  const [logs, setLogs]           = useState<CommLog[]>([]);
  const [pagination, setPagination] = useState<Pagination>({ page: 1, limit: 20, total: 0, pages: 1 });
  const [loading, setLoading]     = useState(true);
  const [retrying, setRetrying]   = useState<string | null>(null);

  // Filtros
  const [statusFilter, setStatusFilter]   = useState("");
  const [typeFilter, setTypeFilter]       = useState("");
  const [channelFilter, setChannelFilter] = useState("");
  const [q, setQ]                         = useState("");
  const [page, setPage]                   = useState(1);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const sp = new URLSearchParams({ page: String(page), limit: "20" });
      if (statusFilter)  sp.set("status",  statusFilter);
      if (typeFilter)    sp.set("type",    typeFilter);
      if (channelFilter) sp.set("channel", channelFilter);
      if (q)             sp.set("q",       q);

      const res = await fetch(`/api/communication?${sp}`);
      if (!res.ok) throw new Error("Erro ao carregar logs");
      const data = await res.json() as { logs: CommLog[]; pagination: Pagination };
      setLogs(data.logs);
      setPagination(data.pagination);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter, typeFilter, channelFilter, q]);

  useEffect(() => { void fetchLogs(); }, [fetchLogs]);

  async function handleRetry(id: string) {
    setRetrying(id);
    try {
      const res = await fetch(`/api/communication/${id}/retry`, { method: "POST" });
      const data = await res.json() as { success: boolean; error?: string };
      if (data.success) {
        void fetchLogs();
      } else {
        alert(`Erro ao retentar: ${data.error ?? "desconhecido"}`);
      }
    } finally {
      setRetrying(null);
    }
  }

  return (
    <div className="min-h-screen bg-gray-950 text-slate-200 p-6">
      {/* Cabeçalho */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">📨 Histórico de Comunicação</h1>
          <p className="text-slate-400 text-sm mt-1">
            Todos os emails e mensagens WhatsApp enviados pelo sistema.
          </p>
        </div>
        <button
          onClick={() => router.push("/admin/configuracoes/email-templates")}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition"
        >
          ✉️ Templates Email
        </button>
      </div>

      {/* Filtros */}
      <div className="bg-gray-900 rounded-xl p-4 mb-6 flex flex-wrap gap-3">
        <input
          type="text"
          placeholder="Pesquisar por destinatário..."
          value={q}
          onChange={(e) => { setQ(e.target.value); setPage(1); }}
          className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 flex-1 min-w-[200px]"
        />
        <select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
          className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white"
        >
          <option value="">Todos os estados</option>
          <option value="SENT">Enviado</option>
          <option value="FAILED">Falhou</option>
          <option value="PENDING">Pendente</option>
          <option value="RETRYING">A retentar</option>
        </select>
        <select
          value={typeFilter}
          onChange={(e) => { setTypeFilter(e.target.value); setPage(1); }}
          className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white"
        >
          <option value="">Todos os tipos</option>
          <option value="EMAIL">Email</option>
          <option value="WHATSAPP">WhatsApp</option>
          <option value="WHATSAPP_DEEPLINK">Deep-link WA</option>
        </select>
        <select
          value={channelFilter}
          onChange={(e) => { setChannelFilter(e.target.value); setPage(1); }}
          className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white"
        >
          <option value="">Todos os canais</option>
          <option value="transactional">Transaccional</option>
          <option value="financial">Financeiro</option>
          <option value="receipt">Recibo</option>
          <option value="reminder">Lembrete</option>
          <option value="alert">Alerta</option>
        </select>
        <button
          onClick={() => { setStatusFilter(""); setTypeFilter(""); setChannelFilter(""); setQ(""); setPage(1); }}
          className="bg-gray-700 hover:bg-gray-600 text-white px-4 py-2 rounded-lg text-sm"
        >
          Limpar
        </button>
      </div>

      {/* Totais */}
      <p className="text-slate-400 text-sm mb-3">
        {pagination.total} {pagination.total === 1 ? "registo" : "registos"} encontrados
      </p>

      {/* Tabela */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <span className="text-slate-500">A carregar...</span>
        </div>
      ) : logs.length === 0 ? (
        <div className="bg-gray-900 rounded-xl p-12 text-center">
          <p className="text-4xl mb-3">📭</p>
          <p className="text-slate-400">Nenhum registo de comunicação encontrado.</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-800">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-900 text-slate-400 text-xs uppercase tracking-wider">
                <th className="px-4 py-3 text-left">Tipo</th>
                <th className="px-4 py-3 text-left">Para</th>
                <th className="px-4 py-3 text-left">Assunto / Template</th>
                <th className="px-4 py-3 text-left">Canal</th>
                <th className="px-4 py-3 text-left">Estado</th>
                <th className="px-4 py-3 text-left">Tentativas</th>
                <th className="px-4 py-3 text-left">Enviado em</th>
                <th className="px-4 py-3 text-left">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {logs.map((log) => (
                <tr key={log.id} className="bg-gray-900/50 hover:bg-gray-800/50 transition">
                  <td className="px-4 py-3">
                    <span title={log.type}>{TYPE_ICONS[log.type] ?? "📩"}</span>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-slate-300 max-w-[180px] truncate">
                    {log.to}
                  </td>
                  <td className="px-4 py-3 max-w-[240px]">
                    {log.subject && (
                      <p className="text-white truncate">{log.subject}</p>
                    )}
                    {log.templateSlug && (
                      <p className="text-slate-500 text-xs">{log.templateSlug}</p>
                    )}
                    {log.errorMsg && (
                      <p className="text-red-400 text-xs mt-1 truncate" title={log.errorMsg}>
                        ⚠ {log.errorMsg}
                      </p>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-slate-400 text-xs">{log.channel}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[log.status] ?? "bg-gray-700 text-gray-300"}`}>
                      {log.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center text-slate-400">
                    {log.attempts}
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-400">
                    {fmtDate(log.sentAt ?? log.createdAt)}
                  </td>
                  <td className="px-4 py-3">
                    {log.status === "FAILED" && log.type === "EMAIL" && (
                      <button
                        onClick={() => void handleRetry(log.id)}
                        disabled={retrying === log.id}
                        className="bg-blue-600/80 hover:bg-blue-600 disabled:opacity-50 text-white text-xs px-3 py-1 rounded-lg transition"
                      >
                        {retrying === log.id ? "..." : "Retentar"}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Paginação */}
      {pagination.pages > 1 && (
        <div className="flex items-center justify-center gap-3 mt-6">
          <button
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1}
            className="bg-gray-800 hover:bg-gray-700 disabled:opacity-40 text-white px-4 py-2 rounded-lg text-sm"
          >
            ← Anterior
          </button>
          <span className="text-slate-400 text-sm">
            Página {page} de {pagination.pages}
          </span>
          <button
            onClick={() => setPage(p => Math.min(pagination.pages, p + 1))}
            disabled={page === pagination.pages}
            className="bg-gray-800 hover:bg-gray-700 disabled:opacity-40 text-white px-4 py-2 rounded-lg text-sm"
          >
            Seguinte →
          </button>
        </div>
      )}
    </div>
  );
}
