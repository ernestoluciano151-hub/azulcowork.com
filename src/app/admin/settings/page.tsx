"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Sidebar from "@/components/admin/Sidebar";

type User = {
  id: string;
  email: string;
  name: string | null;
  role: string;
  active: boolean;
  createdAt: string;
};

const input = "focus-ring w-full rounded-lg border border-white/10 bg-ink px-4 py-3 text-sm text-paper placeholder:text-mist/60";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1.5 block text-sm font-medium text-paper">{label}</label>
      {children}
    </div>
  );
}

export default function SettingsPage() {
  const router = useRouter();
  const [tab, setTab] = useState<"seguranca" | "utilizadores">("seguranca");
  const [me, setMe] = useState<{ role?: string } | null>(null);

  // Password change
  const [current, setCurrent] = useState("");
  const [newPass, setNewPass] = useState("");
  const [confirm, setConfirm] = useState("");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  // Users
  const [users, setUsers] = useState<User[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [showAddUser, setShowAddUser] = useState(false);
  const [addForm, setAddForm] = useState({ email: "", name: "", password: "", role: "USER" });
  const [addError, setAddError] = useState("");
  const [addSaving, setAddSaving] = useState(false);

  // Reset password modal
  const [resetUser, setResetUser] = useState<User | null>(null);
  const [resetPass, setResetPass] = useState("");
  const [resetSaving, setResetSaving] = useState(false);
  const [resetMsg, setResetMsg] = useState("");

  useEffect(() => {
    fetch("/api/admin/me")
      .then((r) => r.ok ? r.json() : null)
      .then((d) => {
        if (!d) { router.push("/admin/dashboard"); return; }
        if (d.role !== "ADMIN") { router.push("/admin/dashboard"); return; }
        setMe(d);
      });
  }, [router]);

  useEffect(() => {
    if (tab === "utilizadores" && me?.role === "ADMIN") fetchUsers();
  }, [tab, me]);

  async function fetchUsers() {
    setUsersLoading(true);
    const res = await fetch("/api/admin/users");
    if (res.ok) { const d = await res.json(); setUsers(d.users); }
    setUsersLoading(false);
  }

  async function changePassword(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    if (newPass !== confirm) { setMsg({ type: "err", text: "As senhas não coincidem." }); return; }
    if (newPass.length < 8) { setMsg({ type: "err", text: "A nova senha deve ter pelo menos 8 caracteres." }); return; }
    setSaving(true);
    try {
      const res = await fetch("/api/admin/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword: current, newPassword: newPass })
      });
      const data = await res.json();
      if (res.ok) { setMsg({ type: "ok", text: "Senha alterada com sucesso!" }); setCurrent(""); setNewPass(""); setConfirm(""); }
      else setMsg({ type: "err", text: data.error || "Erro ao alterar a senha." });
    } finally { setSaving(false); }
  }

  async function handleAddUser(e: React.FormEvent) {
    e.preventDefault();
    setAddError(""); setAddSaving(true);
    const res = await fetch("/api/admin/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(addForm),
    });
    const d = await res.json();
    if (res.ok) { setShowAddUser(false); setAddForm({ email: "", name: "", password: "", role: "USER" }); fetchUsers(); }
    else setAddError(d.error || "Erro ao criar utilizador.");
    setAddSaving(false);
  }

  async function toggleActive(user: User) {
    await fetch(`/api/admin/users/${user.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: !user.active }),
    });
    fetchUsers();
  }

  async function toggleRole(user: User) {
    await fetch(`/api/admin/users/${user.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role: user.role === "ADMIN" ? "USER" : "ADMIN" }),
    });
    fetchUsers();
  }

  async function handleResetPassword(e: React.FormEvent) {
    e.preventDefault();
    if (!resetUser) return;
    setResetSaving(true); setResetMsg("");
    const res = await fetch(`/api/admin/users/${resetUser.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ newPassword: resetPass }),
    });
    if (res.ok) { setResetMsg("Senha reposta com sucesso!"); setResetPass(""); setTimeout(() => { setResetUser(null); setResetMsg(""); }, 2000); }
    else { const d = await res.json().catch(() => ({})); setResetMsg(d.error || "Erro."); }
    setResetSaving(false);
  }

  if (!me) return (
    <div className="flex min-h-screen bg-ink">
      <Sidebar />
      <main className="flex-1 p-8"><p className="text-mist text-sm">A verificar permissões...</p></main>
    </div>
  );

  return (
    <div className="flex min-h-screen bg-ink">
      <Sidebar />
      <main className="flex-1 p-8">
        <h1 className="font-display text-2xl font-bold text-paper">Definições</h1>
        <p className="mt-1 text-sm text-mist">Gerir a conta e os utilizadores do sistema.</p>

        {/* Tabs */}
        <div className="mt-6 flex gap-1 rounded-xl border border-white/10 bg-white/[0.03] p-1 w-fit">
          {(["seguranca", "utilizadores"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={[
                "rounded-lg px-5 py-2 text-sm font-medium transition",
                tab === t ? "bg-azul text-white" : "text-mist hover:text-paper"
              ].join(" ")}
            >
              {t === "seguranca" ? "🔒 Segurança" : "👥 Utilizadores"}
            </button>
          ))}
        </div>

        {tab === "seguranca" && (
          <div className="mt-6 space-y-6 max-w-md">
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
              <h2 className="font-display text-lg font-bold text-paper">Alterar senha</h2>
              <p className="mt-1 text-sm text-mist">Use uma senha forte com pelo menos 8 caracteres.</p>
              <form onSubmit={changePassword} className="mt-5 space-y-4">
                <Field label="Senha atual">
                  <input type="password" value={current} onChange={(e) => setCurrent(e.target.value)} className={input} placeholder="••••••••" />
                </Field>
                <Field label="Nova senha">
                  <input type="password" value={newPass} onChange={(e) => setNewPass(e.target.value)} className={input} placeholder="••••••••" />
                </Field>
                <Field label="Confirmar nova senha">
                  <input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} className={input} placeholder="••••••••" />
                </Field>
                {msg && (
                  <p className={`rounded-lg px-4 py-3 text-sm ${msg.type === "ok" ? "bg-emerald-500/10 text-emerald-300" : "bg-red-500/10 text-red-300"}`}>
                    {msg.text}
                  </p>
                )}
                <button type="submit" disabled={saving} className="focus-ring w-full rounded-xl bg-azul px-6 py-3 text-sm font-semibold text-white hover:bg-azul-dim disabled:opacity-60">
                  {saving ? "A guardar..." : "Alterar senha"}
                </button>
              </form>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
              <div className="flex items-center gap-3">
                <span className="text-2xl">🔐</span>
                <div>
                  <h2 className="font-display text-base font-bold text-paper">Autenticação TOTP (Google Authenticator)</h2>
                  <p className="mt-0.5 text-sm text-mist">Adicione uma camada extra de segurança à sua conta.</p>
                </div>
              </div>
              <div className="mt-4 rounded-lg bg-amber-500/10 px-4 py-3 text-sm text-amber-300">
                🚧 Em breve — funcionalidade TOTP em desenvolvimento.
              </div>
              <p className="mt-3 text-xs text-mist">
                Quando disponível, poderá ligar a autenticação de dois fatores usando apps como Google Authenticator ou Authy.
              </p>
            </div>
          </div>
        )}

        {tab === "utilizadores" && (
          <div className="mt-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="font-display text-lg font-bold text-paper">Gestão de Utilizadores</h2>
                <p className="text-sm text-mist mt-1">Máximo de 4 utilizadores. {users.length}/4 em uso.</p>
              </div>
              {users.length < 4 && (
                <button
                  onClick={() => setShowAddUser(true)}
                  className="rounded-lg bg-azul px-4 py-2 text-sm font-medium text-white hover:bg-azul-dim"
                >
                  + Adicionar utilizador
                </button>
              )}
              {users.length >= 4 && (
                <span className="rounded-lg bg-amber-500/10 px-4 py-2 text-sm text-amber-300">
                  Limite atingido (4/4)
                </span>
              )}
            </div>

            <div className="rounded-2xl border border-white/10 overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-white/[0.03] text-mist">
                  <tr>
                    <th className="px-4 py-3 font-medium">Nome / Email</th>
                    <th className="px-4 py-3 font-medium">Papel</th>
                    <th className="px-4 py-3 font-medium">Estado</th>
                    <th className="px-4 py-3 font-medium">Criado em</th>
                    <th className="px-4 py-3 font-medium">Acções</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {usersLoading && (
                    <tr><td colSpan={5} className="px-4 py-8 text-center text-mist">A carregar...</td></tr>
                  )}
                  {!usersLoading && users.map((u) => (
                    <tr key={u.id} className="text-paper hover:bg-white/[0.02]">
                      <td className="px-4 py-3">
                        <p className="font-medium">{u.name || "—"}</p>
                        <p className="text-xs text-mist">{u.email}</p>
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => toggleRole(u)}
                          className={`rounded-full px-3 py-1 text-xs font-medium cursor-pointer transition hover:opacity-80 ${
                            u.role === "ADMIN"
                              ? "bg-azul/15 text-azul-glow"
                              : "bg-white/10 text-mist"
                          }`}
                          title="Clique para alternar papel"
                        >
                          {u.role}
                        </button>
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => toggleActive(u)}
                          className={`rounded-full px-3 py-1 text-xs font-medium transition hover:opacity-80 ${
                            u.active
                              ? "bg-emerald-500/15 text-emerald-300"
                              : "bg-red-500/15 text-red-300"
                          }`}
                        >
                          {u.active ? "Activo" : "Inactivo"}
                        </button>
                      </td>
                      <td className="px-4 py-3 text-mist text-xs">
                        {new Date(u.createdAt).toLocaleDateString("pt-PT")}
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => setResetUser(u)}
                          className="rounded-lg border border-white/10 px-3 py-1.5 text-xs text-paper hover:bg-white/5"
                        >
                          Repor senha
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-4 rounded-lg bg-amber-500/10 px-4 py-3 text-sm text-amber-300">
              ℹ️ Utilizadores com papel USER não têm acesso às páginas de Pagamentos e Definições.
            </div>
          </div>
        )}
      </main>

      {/* Add User Modal */}
      {showAddUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl border border-white/10 bg-ink2 p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-6">
              <h2 className="font-display text-lg font-bold text-paper">Adicionar utilizador</h2>
              <button onClick={() => { setShowAddUser(false); setAddError(""); }} className="text-mist hover:text-paper text-xl">✕</button>
            </div>
            <form onSubmit={handleAddUser} className="space-y-4">
              <Field label="Nome">
                <input className={input} placeholder="Nome completo" value={addForm.name} onChange={(e) => setAddForm((f) => ({ ...f, name: e.target.value }))} />
              </Field>
              <Field label="Email *">
                <input required type="email" className={input} placeholder="email@exemplo.com" value={addForm.email} onChange={(e) => setAddForm((f) => ({ ...f, email: e.target.value }))} />
              </Field>
              <Field label="Senha *">
                <input required type="password" className={input} placeholder="Min. 8 caracteres" value={addForm.password} onChange={(e) => setAddForm((f) => ({ ...f, password: e.target.value }))} />
              </Field>
              <Field label="Papel">
                <select className={input} value={addForm.role} onChange={(e) => setAddForm((f) => ({ ...f, role: e.target.value }))}>
                  <option value="USER">USER</option>
                  <option value="ADMIN">ADMIN</option>
                </select>
              </Field>
              {addError && <p className="rounded-lg bg-red-500/10 px-4 py-3 text-sm text-red-300">{addError}</p>}
              <div className="flex gap-3 justify-end pt-2">
                <button type="button" onClick={() => { setShowAddUser(false); setAddError(""); }} className="rounded-xl border border-white/10 px-5 py-2.5 text-sm text-mist hover:text-paper">Cancelar</button>
                <button type="submit" disabled={addSaving} className="rounded-xl bg-azul px-5 py-2.5 text-sm font-semibold text-white hover:bg-azul-dim disabled:opacity-60">
                  {addSaving ? "A criar..." : "Criar utilizador"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Reset Password Modal */}
      {resetUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-ink2 p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-6">
              <h2 className="font-display text-base font-bold text-paper">Repor senha — {resetUser.name || resetUser.email}</h2>
              <button onClick={() => { setResetUser(null); setResetPass(""); setResetMsg(""); }} className="text-mist hover:text-paper text-xl">✕</button>
            </div>
            <form onSubmit={handleResetPassword} className="space-y-4">
              <Field label="Nova senha *">
                <input required type="password" className={input} placeholder="Min. 8 caracteres" value={resetPass} onChange={(e) => setResetPass(e.target.value)} />
              </Field>
              {resetMsg && (
                <p className={`rounded-lg px-4 py-3 text-sm ${resetMsg.includes("sucesso") ? "bg-emerald-500/10 text-emerald-300" : "bg-red-500/10 text-red-300"}`}>
                  {resetMsg}
                </p>
              )}
              <div className="flex gap-3 justify-end">
                <button type="button" onClick={() => { setResetUser(null); setResetPass(""); setResetMsg(""); }} className="rounded-xl border border-white/10 px-5 py-2.5 text-sm text-mist hover:text-paper">Cancelar</button>
                <button type="submit" disabled={resetSaving} className="rounded-xl bg-azul px-5 py-2.5 text-sm font-semibold text-white hover:bg-azul-dim disabled:opacity-60">
                  {resetSaving ? "A guardar..." : "Repor"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
