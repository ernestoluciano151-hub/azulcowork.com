"use client";

/**
 * /admin/portal/utilizadores — Gestão de Utilizadores do Portal do Cliente
 *
 * Lista utilizadores do portal por empresa.
 * Permite criar utilizadores, enviar magic link e revogar acesso.
 * Consome /api/admin/portal/users + /api/admin/portal/magic-link
 * VOL12 — Sprint VOL12-4
 */

import { useEffect, useState, useCallback } from "react";
import AdminLayout from "@/components/admin/AdminLayout";

type PortalUser = {
  id:           string;
  name:         string;
  email:        string;
  role:         string;
  isActive:     boolean;
  lastLoginAt:  string | null;
  createdAt:    string;
  company: { id: string; name: string };
};

type Pagination = { page: number; limit: number; total: number; pages: number };

const ROLE_PT: Record<string, string> = {
  OWNER: "Proprietário", ADMIN: "Admin", MEMBER: "Membro", VIEWER: "Visualizador",
};

function fmtDate(d: string | null): string {
  if (!d) return "Nunca";
  return new Date(d).toLocaleDateString("pt-PT", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "Africa/Luanda" });
}

function PortalUtilizadoresPageInner() {
  const [users, setUsers]           = useState<PortalUser[]>([]);
  const [pagination, setPagination] = useState<Pagination>({ page: 1, limit: 20, total: 0, pages: 1 });
  const [loading, setLoading]       = useState(true);
  const [acting, setActing]         = useState<string | null>(null);
  const [q, setQ]                   = useState("");
  const [page, setPage]             = useState(1);

  // Form para novo utilizador
  const [showForm, setShowForm]     = useState(false);
  const [form, setForm]             = useState({ name: "", email: "", companyId: "", role: "MEMBER" });
  const [creating, setCreating]     = useState(false);
  const [companies, setCompanies]   = useState<{ id: string; name: string }[]>([]);

  // Modal do magic link gerado — o admin pode copiar o link (ex: WhatsApp)
  // e/ou pedir para o sistema o enviar directamente por email.
  const [linkModal, setLinkModal] = useState<{
    userId: string; url: string; userName: string; userEmail: string; ttlMinutes: number;
  } | null>(null);
  const [copied, setCopied]           = useState(false);
  const [sendingEmail, setSendingEmail] = useState(false);
  const [emailStatus, setEmailStatus]   = useState<{ ok: boolean; msg: string } | null>(null);

  // Carregar lista de empresas para o dropdown (apenas quando o form abre)
  useEffect(() => {
    if (!showForm) return;
    void (async () => {
      try {
        const res = await fetch("/api/companies");
        if (!res.ok) return;
        const data = await res.json() as { companies: { id: string; name: string }[] };
        setCompanies(data.companies ?? []);
      } catch { /* noop */ }
    })();
  }, [showForm]);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const sp = new URLSearchParams({ page: String(page), limit: "20" });
      if (q) sp.set("q", q);
      const res = await fetch(`/api/admin/portal/users?${sp}`);
      if (!res.ok) throw new Error();
      const data = await res.json() as { users: PortalUser[]; pagination: Pagination };
      setUsers(data.users ?? []);
      setPagination(data.pagination ?? { page: 1, limit: 20, total: 0, pages: 1 });
    } catch { /* noop */ }
    finally { setLoading(false); }
  }, [page, q]);

  useEffect(() => { void fetchUsers(); }, [fetchUsers]);

  async function sendMagicLink(user: PortalUser) {
    setActing("magic-" + user.id);
    try {
      const res = await fetch(`/api/admin/portal/magic-link`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // A API espera "portalUserId" (não "userId").
        body: JSON.stringify({ portalUserId: user.id }),
      });
      const data = await res.json() as {
        ok?: boolean; error?: string; magicLinkUrl?: string; ttlMinutes?: number;
      };
      if (!res.ok || !data.magicLinkUrl) { alert(data.error ?? "Erro ao gerar link."); return; }
      // O link pode ser copiado manualmente (WhatsApp, presencial, etc.) ou
      // enviado por email através do botão no modal.
      setCopied(false);
      setEmailStatus(null);
      setLinkModal({
        userId: user.id, url: data.magicLinkUrl, userName: user.name,
        userEmail: user.email, ttlMinutes: data.ttlMinutes ?? 15,
      });
    } catch { alert("Erro de rede"); }
    finally { setActing(null); }
  }

  async function copyLink() {
    if (!linkModal) return;
    try {
      await navigator.clipboard.writeText(linkModal.url);
      setCopied(true);
    } catch { /* clipboard indisponível — o link continua visível para copiar manualmente */ }
  }

  async function emailLink() {
    if (!linkModal) return;
    setSendingEmail(true);
    setEmailStatus(null);
    try {
      const res = await fetch(`/api/admin/portal/magic-link`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ portalUserId: linkModal.userId, sendEmail: true }),
      });
      const data = await res.json() as {
        ok?: boolean; error?: string; magicLinkUrl?: string; ttlMinutes?: number;
        emailResult?: { attempted: boolean; success: boolean; error?: string };
      };
      if (!res.ok || !data.magicLinkUrl) {
        setEmailStatus({ ok: false, msg: data.error ?? "Erro ao gerar novo link." });
        return;
      }
      // Reenviar gera um novo token — o anterior fica inválido, por isso
      // actualizamos o link mostrado no modal para o que foi de facto enviado.
      setCopied(false);
      setLinkModal(m => m ? { ...m, url: data.magicLinkUrl! } : m);
      if (data.emailResult?.success) {
        setEmailStatus({ ok: true, msg: `Email enviado para ${linkModal.userEmail}.` });
      } else {
        setEmailStatus({
          ok: false,
          msg: `Não foi possível enviar por email (${data.emailResult?.error ?? "erro desconhecido"}). Usa "Copiar" e envia manualmente.`,
        });
      }
    } catch { setEmailStatus({ ok: false, msg: "Erro de rede." }); }
    finally { setSendingEmail(false); }
  }

  async function toggleActive(user: PortalUser) {
    setActing("toggle-" + user.id);
    try {
      const res = await fetch(`/api/admin/portal/users/${user.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !user.isActive }),
      });
      const data = await res.json().catch(() => ({})) as { error?: string };
      // A API tinha um motivo específico (ex: "não é possível desactivar o
      // único PORTAL_OWNER da empresa") que estava a ser escondido por uma
      // mensagem genérica — agora mostramos o erro real.
      if (!res.ok) { alert(data.error ?? "Erro ao alterar estado."); return; }
      void fetchUsers();
    } catch { alert("Erro de rede"); }
    finally { setActing(null); }
  }

  async function createUser() {
    if (!form.name || !form.email || !form.companyId) {
      alert("Nome, email e empresa são obrigatórios.");
      return;
    }
    setCreating(true);
    try {
      const res = await fetch("/api/admin/portal/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json() as { ok?: boolean; user?: PortalUser; error?: string };
      if (!res.ok) { alert(data.error ?? "Erro"); return; }
      setShowForm(false);
      setForm({ name: "", email: "", companyId: "", role: "MEMBER" });
      void fetchUsers();
    } catch { alert("Erro de rede"); }
    finally { setCreating(false); }
  }

  return (
    <div className="bg-gray-950 text-slate-200 p-6">
      {/* Cabeçalho */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">🔑 Utilizadores do Portal</h1>
          <p className="text-slate-400 text-sm mt-1">
            Gerir acessos ao Portal do Cliente por empresa.
          </p>
        </div>
        <button
          onClick={() => setShowForm(s => !s)}
          className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium transition"
        >
          {showForm ? "Cancelar" : "+ Novo Utilizador"}
        </button>
      </div>

      {/* Formulário de criação */}
      {showForm && (
        <div className="bg-gray-900 rounded-xl p-5 mb-6 border border-blue-500/30">
          <h2 className="text-white font-semibold mb-4">Novo utilizador do portal</h2>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-xs text-slate-400 mb-1">Nome</label>
              <input
                type="text"
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white"
                placeholder="Nome completo"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Email</label>
              <input
                type="email"
                value={form.email}
                onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white"
                placeholder="email@empresa.com"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Empresa</label>
              <select
                value={form.companyId}
                onChange={e => setForm(f => ({ ...f, companyId: e.target.value }))}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white"
              >
                <option value="">— Seleccionar empresa —</option>
                {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              {companies.length === 0 && (
                <p className="text-xs text-amber-400 mt-1">
                  Sem empresas registadas. Crie primeiro a empresa em Empresas.
                </p>
              )}
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Papel</label>
              <select
                value={form.role}
                onChange={e => setForm(f => ({ ...f, role: e.target.value }))}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white"
              >
                {Object.entries(ROLE_PT).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
          </div>
          <div className="flex gap-3">
            <button
              onClick={createUser}
              disabled={creating}
              className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium transition disabled:opacity-50"
            >
              {creating ? "A criar…" : "Criar Utilizador"}
            </button>
            <p className="text-slate-500 text-xs self-center">
              Tentamos enviar um email de boas-vindas automaticamente — se o cliente não o
              receber, usa o botão 🔗 Link na tabela para gerar e enviar o acesso manualmente.
            </p>
          </div>
        </div>
      )}

      {/* Filtro */}
      <div className="bg-gray-900 rounded-xl p-4 mb-6 flex gap-3">
        <input
          type="text"
          placeholder="Pesquisar por nome ou email…"
          value={q}
          onChange={e => { setQ(e.target.value); setPage(1); }}
          className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white flex-1"
        />
        <span className="text-slate-400 text-sm self-center">
          {pagination.total} utilizador{pagination.total !== 1 ? "es" : ""}
        </span>
      </div>

      {/* Tabela */}
      <div className="bg-gray-900 rounded-xl overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-40 text-slate-400">A carregar...</div>
        ) : users.length === 0 ? (
          <div className="flex items-center justify-center h-40 text-slate-400">Nenhum utilizador encontrado.</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-800 text-slate-400">
              <tr>
                <th className="px-4 py-3 text-left">Nome</th>
                <th className="px-4 py-3 text-left">Email</th>
                <th className="px-4 py-3 text-left">Empresa</th>
                <th className="px-4 py-3 text-left">Papel</th>
                <th className="px-4 py-3 text-center">Activo</th>
                <th className="px-4 py-3 text-left">Último Login</th>
                <th className="px-4 py-3 text-center">Acções</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {users.map(u => (
                <tr key={u.id} className="hover:bg-gray-800/50 transition">
                  <td className="px-4 py-3 font-medium text-white">{u.name}</td>
                  <td className="px-4 py-3 text-slate-300 text-xs">{u.email}</td>
                  <td className="px-4 py-3 text-slate-300">{u.company.name}</td>
                  <td className="px-4 py-3 text-slate-400">{ROLE_PT[u.role] ?? u.role}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={u.isActive ? "text-emerald-400" : "text-red-400"}>
                      {u.isActive ? "✓" : "✗"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-400 text-xs">{fmtDate(u.lastLoginAt)}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1 justify-center">
                      <button
                        onClick={() => sendMagicLink(u)}
                        disabled={acting === "magic-" + u.id || !u.isActive}
                        className="px-2 py-1 rounded text-xs bg-indigo-600/30 text-indigo-300 hover:bg-indigo-600/50 transition disabled:opacity-40"
                        title="Gerar link de acesso para copiar e enviar ao cliente"
                      >
                        {acting === "magic-" + u.id ? "…" : "🔗 Link"}
                      </button>
                      <button
                        onClick={() => toggleActive(u)}
                        disabled={acting === "toggle-" + u.id}
                        className={[
                          "px-2 py-1 rounded text-xs transition disabled:opacity-50",
                          u.isActive
                            ? "bg-red-600/20 text-red-400 hover:bg-red-600/40"
                            : "bg-emerald-600/20 text-emerald-400 hover:bg-emerald-600/40",
                        ].join(" ")}
                      >
                        {acting === "toggle-" + u.id ? "…" : u.isActive ? "Revogar" : "Activar"}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Paginação */}
      {pagination.pages > 1 && (
        <div className="flex items-center justify-between mt-4 text-sm text-slate-400">
          <span>Página {pagination.page} de {pagination.pages}</span>
          <div className="flex gap-2">
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1}
              className="px-3 py-1 rounded bg-gray-800 hover:bg-gray-700 disabled:opacity-40 transition">← Anterior</button>
            <button onClick={() => setPage(p => Math.min(pagination.pages, p + 1))} disabled={page >= pagination.pages}
              className="px-3 py-1 rounded bg-gray-800 hover:bg-gray-700 disabled:opacity-40 transition">Seguinte →</button>
          </div>
        </div>
      )}

      {/* Modal: link de acesso gerado */}
      {linkModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg rounded-2xl border border-indigo-500/30 bg-gray-900 p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-white font-semibold">🔗 Link de acesso — {linkModal.userName}</h2>
              <button onClick={() => setLinkModal(null)} className="text-slate-400 hover:text-white text-xl">✕</button>
            </div>
            <p className="text-sm text-slate-400 mb-3">
              Válido por {linkModal.ttlMinutes} minutos e só pode ser usado uma vez.
              Copia-o para enviar manualmente (WhatsApp, presencial) ou pede ao sistema
              para o enviar por email para <span className="text-slate-200">{linkModal.userEmail}</span>.
            </p>
            <div className="flex gap-2 mb-3">
              <input
                readOnly
                value={linkModal.url}
                onFocus={e => e.currentTarget.select()}
                className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-xs text-white font-mono"
              />
              <button
                onClick={copyLink}
                className="px-3 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium transition whitespace-nowrap"
              >
                {copied ? "Copiado ✓" : "Copiar"}
              </button>
            </div>

            <button
              onClick={emailLink}
              disabled={sendingEmail}
              className="w-full px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium transition disabled:opacity-50"
            >
              {sendingEmail ? "A enviar…" : `✉️ Enviar por email para ${linkModal.userEmail}`}
            </button>
            {emailStatus && (
              <p className={`text-xs mt-2 ${emailStatus.ok ? "text-emerald-400" : "text-amber-400"}`}>
                {emailStatus.ok ? "✓" : "⚠"} {emailStatus.msg}
              </p>
            )}

            <div className="flex justify-end mt-4">
              <button onClick={() => setLinkModal(null)} className="px-4 py-2 rounded-lg border border-gray-700 text-slate-300 hover:bg-gray-800 text-sm">
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Navegação consistente: sidebar persistente à esquerda, conteúdo à direita
export default function PortalUtilizadoresPage() {
  return (
    <AdminLayout>
      <PortalUtilizadoresPageInner />
    </AdminLayout>
  );
}
