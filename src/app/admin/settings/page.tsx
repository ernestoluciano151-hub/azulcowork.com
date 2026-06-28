"use client";

import { useState } from "react";
import Sidebar from "@/components/admin/Sidebar";

export default function SettingsPage() {
  const [current, setCurrent] = useState("");
  const [newPass, setNewPass] = useState("");
  const [confirm, setConfirm] = useState("");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  async function changePassword(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    if (newPass !== confirm) {
      setMsg({ type: "err", text: "As senhas não coincidem." });
      return;
    }
    if (newPass.length < 8) {
      setMsg({ type: "err", text: "A nova senha deve ter pelo menos 8 caracteres." });
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/admin/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword: current, newPassword: newPass })
      });
      const data = await res.json();
      if (res.ok) {
        setMsg({ type: "ok", text: "Senha alterada com sucesso!" });
        setCurrent(""); setNewPass(""); setConfirm("");
      } else {
        setMsg({ type: "err", text: data.error || "Erro ao alterar a senha." });
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex min-h-screen bg-ink">
      <Sidebar />
      <main className="flex-1 p-8">
        <h1 className="font-display text-2xl font-bold text-paper">Definições</h1>
        <p className="mt-1 text-sm text-mist">Gerir a sua conta de administrador.</p>

        {/* Alterar senha */}
        <div className="mt-8 max-w-md rounded-2xl border border-white/10 bg-white/[0.03] p-6">
          <h2 className="font-display text-lg font-bold text-paper">Alterar senha</h2>
          <p className="mt-1 text-sm text-mist">Use uma senha forte com pelo menos 8 caracteres.</p>

          <form onSubmit={changePassword} className="mt-5 space-y-4">
            <Field label="Senha atual">
              <input
                type="password"
                value={current}
                onChange={(e) => setCurrent(e.target.value)}
                className={input}
                placeholder="••••••••"
              />
            </Field>
            <Field label="Nova senha">
              <input
                type="password"
                value={newPass}
                onChange={(e) => setNewPass(e.target.value)}
                className={input}
                placeholder="••••••••"
              />
            </Field>
            <Field label="Confirmar nova senha">
              <input
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                className={input}
                placeholder="••••••••"
              />
            </Field>

            {msg && (
              <p className={`rounded-lg px-4 py-3 text-sm ${
                msg.type === "ok"
                  ? "bg-emerald-500/10 text-emerald-300"
                  : "bg-red-500/10 text-red-300"
              }`}>
                {msg.text}
              </p>
            )}

            <button
              type="submit"
              disabled={saving}
              className="focus-ring w-full rounded-xl bg-azul px-6 py-3 text-sm font-semibold text-white hover:bg-azul-dim disabled:opacity-60"
            >
              {saving ? "A guardar..." : "Alterar senha"}
            </button>
          </form>
        </div>

        {/* Info 2FA */}
        <div className="mt-6 max-w-md rounded-2xl border border-white/10 bg-white/[0.03] p-6">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🔐</span>
            <div>
              <h2 className="font-display text-base font-bold text-paper">Autenticação em dois fatores</h2>
              <p className="mt-0.5 text-sm text-mist">
                Para maior segurança, use uma senha forte e não a partilhe com ninguém.
                O acesso admin está protegido por JWT com expiração de 12 horas.
              </p>
            </div>
          </div>
          <div className="mt-4 rounded-lg bg-amber-500/10 px-4 py-3 text-sm text-amber-300">
            💡 Recomendamos alterar a senha padrão imediatamente após o primeiro acesso.
          </div>
        </div>
      </main>
    </div>
  );
}

const input = "focus-ring w-full rounded-lg border border-white/10 bg-ink px-4 py-3 text-sm text-paper placeholder:text-mist/60";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1.5 block text-sm font-medium text-paper">{label}</label>
      {children}
    </div>
  );
}
