"use client";

import { useState, useEffect, useCallback } from "react";
import AdminLayout from "@/components/admin/AdminLayout";

type AuditLog = {
  id: string;
  actorId: string;
  actorRole: string;
  actorEmail: string;
  action: string;
  entity: string;
  entityId: string;
  entityRef: string | null;
  before: unknown;
  after: unknown;
  ipAddress: string | null;
  userAgent: string | null;
  metadata: unknown;
  createdAt: string;
};

const ACTION_LABELS: Record<string, string> = {
  LOGIN_SUCCESS:              "Login OK",
  LOGIN_FAILED:               "Login falhado",
  LOGOUT:                     "Logout",
  TOTP_ENABLED:               "TOTP activado",
  TOTP_DISABLED:              "TOTP desactivado",
  TOTP_VERIFY_FAILED:         "TOTP falhou",
  SESSION_REVOKED:            "Sessão revogada",
  ADMIN_USER_CREATED:         "Utilizador criado",
  ADMIN_USER_UPDATED:         "Utilizador editado",
  ADMIN_USER_DELETED:         "Utilizador eliminado",
  ADMIN_USER_DEACTIVATED:     "Conta desactivada",
  ADMIN_USER_REACTIVATED:     "Conta reactivada",
  ADMIN_PASSWORD_CHANGED:     "Senha alterada",
  PAYMENT_CREATED:            "Pagamento criado",
  PAYMENT_CONFIRMED:          "Pagamento confirmado",
  PAYMENT_UPDATED:            "Pagamento editado",
  PAYMENT_CANCELLED:          "Pagamento cancelado",
  INVOICE_CREATED:            "Factura criada",
  INVOICE_SENT:               "Factura enviada",
  INVOICE_CANCELLED:          "Factura cancelada",
  RESERVATION_CREATED:        "Reserva criada",
  RESERVATION_UPDATED:        "Reserva editada",
  RESERVATION_STATUS_CHANGED: "Estado de reserva alterado",
  RESERVATION_CANCELLED:      "Reserva cancelada",
  ROOM_SETTINGS_UPDATED:      "Config. sala actualizada",
  PLAN_CREATED:               "Plano criado",
  PLAN_UPDATED:               "Plano editado",
  PLAN_DELETED:               "Plano eliminado",
  PRICING_UPDATED:            "Preçário actualizado",
};

const ACTION_COLORS: Record<string, string> = {
  LOGIN_FAILED:           "text-red-300 bg-red-500/10",
  ADMIN_USER_DELETED:     "text-red-300 bg-red-500/10",
  ADMIN_USER_DEACTIVATED: "text-amber-300 bg-amber-500/10",
  SESSION_REVOKED:        "text-amber-300 bg-amber-500/10",
  LOGIN_SUCCESS:          "text-emerald-300 bg-emerald-500/10",
  PAYMENT_CREATED:        "text-blue-300 bg-blue-500/10",
  RESERVATION_CREATED:    "text-blue-300 bg-blue-500/10",
};

function ActionBadge({ action }: { action: string }) {
  const color = ACTION_COLORS[action] ?? "text-mist bg-white/10";
  return (
    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${color}`}>
      {ACTION_LABELS[action] ?? action}
    </span>
  );
}

export default function AuditoriaPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const limit = 50;

  const [filters, setFilters] = useState({
    action: "",
    entity: "",
    actorId: "",
    from: "",
    to: "",
  });

  const [expanded, setExpanded] = useState<string | null>(null);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), limit: String(limit) });
    if (filters.action)  params.set("action",  filters.action);
    if (filters.entity)  params.set("entity",  filters.entity);
    if (filters.actorId) params.set("actorId", filters.actorId);
    if (filters.from)    params.set("from",    filters.from);
    if (filters.to)      params.set("to",      filters.to);

    const res = await fetch(`/api/admin/audit?${params}`);
    if (res.ok) {
      const d = await res.json();
      setLogs(d.logs);
      setTotal(d.total);
    }
    setLoading(false);
  }, [page, filters]);

  useEffect(() => { fetchLogs(); }, [fetchLogs]);

  const totalPages = Math.ceil(total / limit);

  return (
    <AdminLayout>
      <div className="flex items-start justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-paper">Log de Auditoria</h1>
          <p className="mt-1 text-sm text-mist">Registo imutável de todas as operações críticas do sistema.</p>
        </div>
        <button
          onClick={() => { setPage(1); fetchLogs(); }}
          className="rounded-lg border border-white/10 px-4 py-2 text-sm text-mist hover:text-paper"
        >
          ↻ Actualizar
        </button>
      </div>

      {/* Filtros */}
      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <select
          className="rounded-lg border border-white/10 bg-ink px-3 py-2 text-sm text-paper"
          value={filters.action}
          onChange={(e) => { setFilters(f => ({ ...f, action: e.target.value })); setPage(1); }}
        >
          <option value="">Todas as acções</option>
          {Object.entries(ACTION_LABELS).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>

        <select
          className="rounded-lg border border-white/10 bg-ink px-3 py-2 text-sm text-paper"
          value={filters.entity}
          onChange={(e) => { setFilters(f => ({ ...f, entity: e.target.value })); setPage(1); }}
        >
          <option value="">Todas as entidades</option>
          {["AdminUser", "AdminSession", "Payment", "Reservation", "Invoice"].map(e => (
            <option key={e} value={e}>{e}</option>
          ))}
        </select>

        <input
          type="text"
          placeholder="Actor ID"
          className="rounded-lg border border-white/10 bg-ink px-3 py-2 text-sm text-paper placeholder:text-mist/60"
          value={filters.actorId}
          onChange={(e) => { setFilters(f => ({ ...f, actorId: e.target.value })); setPage(1); }}
        />

        <input
          type="datetime-local"
          className="rounded-lg border border-white/10 bg-ink px-3 py-2 text-sm text-paper"
          value={filters.from}
          onChange={(e) => { setFilters(f => ({ ...f, from: e.target.value })); setPage(1); }}
        />

        <input
          type="datetime-local"
          className="rounded-lg border border-white/10 bg-ink px-3 py-2 text-sm text-paper"
          value={filters.to}
          onChange={(e) => { setFilters(f => ({ ...f, to: e.target.value })); setPage(1); }}
        />
      </div>

      {/* Tabela */}
      <div className="mt-4 rounded-2xl border border-white/10 overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="bg-white/[0.03] text-mist">
            <tr>
              <th className="px-4 py-3 font-medium">Data</th>
              <th className="px-4 py-3 font-medium">Actor</th>
              <th className="px-4 py-3 font-medium">Acção</th>
              <th className="px-4 py-3 font-medium">Entidade</th>
              <th className="px-4 py-3 font-medium">IP</th>
              <th className="px-4 py-3 font-medium">Detalhes</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {loading && (
              <tr><td colSpan={6} className="px-4 py-10 text-center text-mist">A carregar...</td></tr>
            )}
            {!loading && logs.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-10 text-center text-mist">Nenhum registo encontrado.</td></tr>
            )}
            {!loading && logs.map((log) => (
              <>
                <tr key={log.id} className="text-paper hover:bg-white/[0.02]">
                  <td className="px-4 py-3 text-xs text-mist whitespace-nowrap">
                    {new Date(log.createdAt).toLocaleString("pt-PT")}
                  </td>
                  <td className="px-4 py-3">
                    <p className="text-xs font-medium">{log.actorEmail}</p>
                    <p className="text-xs text-mist">{log.actorRole}</p>
                  </td>
                  <td className="px-4 py-3">
                    <ActionBadge action={log.action} />
                  </td>
                  <td className="px-4 py-3">
                    <p className="text-xs font-medium">{log.entity}</p>
                    {log.entityRef && <p className="text-xs text-mist font-mono">{log.entityRef}</p>}
                  </td>
                  <td className="px-4 py-3 text-xs text-mist font-mono">
                    {log.ipAddress || "—"}
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => setExpanded(expanded === log.id ? null : log.id)}
                      className="rounded-lg border border-white/10 px-3 py-1 text-xs text-mist hover:text-paper"
                    >
                      {expanded === log.id ? "Fechar" : "Ver"}
                    </button>
                  </td>
                </tr>
                {expanded === log.id && (
                  <tr key={`${log.id}-detail`} className="bg-white/[0.01]">
                    <td colSpan={6} className="px-6 py-4">
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 text-xs font-mono">
                        {log.before && (
                          <div>
                            <p className="text-mist mb-1 font-sans font-medium">Antes:</p>
                            <pre className="text-paper whitespace-pre-wrap break-all bg-white/5 rounded-lg p-3">
                              {JSON.stringify(log.before, null, 2)}
                            </pre>
                          </div>
                        )}
                        {log.after && (
                          <div>
                            <p className="text-mist mb-1 font-sans font-medium">Depois:</p>
                            <pre className="text-paper whitespace-pre-wrap break-all bg-white/5 rounded-lg p-3">
                              {JSON.stringify(log.after, null, 2)}
                            </pre>
                          </div>
                        )}
                        {log.metadata && (
                          <div>
                            <p className="text-mist mb-1 font-sans font-medium">Metadata:</p>
                            <pre className="text-paper whitespace-pre-wrap break-all bg-white/5 rounded-lg p-3">
                              {JSON.stringify(log.metadata, null, 2)}
                            </pre>
                          </div>
                        )}
                        {log.userAgent && (
                          <div>
                            <p className="text-mist mb-1 font-sans font-medium">User-Agent:</p>
                            <p className="text-paper break-all bg-white/5 rounded-lg p-3">{log.userAgent}</p>
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                )}
              </>
            ))}
          </tbody>
        </table>
      </div>

      {/* Paginação */}
      {totalPages > 1 && (
        <div className="mt-4 flex items-center gap-3">
          <button
            disabled={page <= 1}
            onClick={() => setPage(p => p - 1)}
            className="rounded-lg border border-white/10 px-4 py-2 text-sm text-mist hover:text-paper disabled:opacity-40"
          >
            ← Anterior
          </button>
          <span className="text-sm text-mist">Página {page} / {totalPages} · {total} registos</span>
          <button
            disabled={page >= totalPages}
            onClick={() => setPage(p => p + 1)}
            className="rounded-lg border border-white/10 px-4 py-2 text-sm text-mist hover:text-paper disabled:opacity-40"
          >
            Seguinte →
          </button>
        </div>
      )}
    </AdminLayout>
  );
}
