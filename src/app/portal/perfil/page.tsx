"use client";

/**
 * /portal/perfil — Perfil do utilizador + preferências (VOL09)
 *
 * Consome:
 *   GET /api/portal/auth/me
 *   PATCH /api/portal/auth/preferences
 */

import { useState, useCallback } from "react";
import PortalLayout, { usePortalAuth } from "@/components/portal/PortalLayout";

function PerfilContent() {
  const { user, refresh } = usePortalAuth();

  const [notifyEmail,    setNotifyEmail]    = useState(user?.notifyInApp ?? true);
  const [saving,         setSaving]         = useState(false);
  const [saveMsg,        setSaveMsg]        = useState<string | null>(null);

  const handleSavePrefs = useCallback(async () => {
    setSaving(true);
    setSaveMsg(null);
    try {
      const res = await fetch("/api/portal/auth/preferences", {
        method:  "PATCH",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          notifyEmail,
          notifyInApp: notifyEmail,
        }),
      });
      if (!res.ok) {
        const json = await res.json();
        setSaveMsg(`Erro: ${json.error ?? "Tente novamente."}`);
        return;
      }
      await refresh();
      setSaveMsg("Preferências guardadas.");
      setTimeout(() => setSaveMsg(null), 3000);
    } catch {
      setSaveMsg("Erro ao guardar. Tente novamente.");
    } finally {
      setSaving(false);
    }
  }, [notifyEmail, refresh]);

  if (!user) return null;

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-5">
      <h1 className="text-2xl font-bold text-gray-900">Perfil</h1>

      {/* Dados pessoais (read-only — alteração via admin) */}
      <div className="bg-white rounded-xl border border-gray-100 p-6">
        <h2 className="font-semibold text-gray-800 mb-4">Informações Pessoais</h2>
        <dl className="space-y-3 text-sm">
          {[
            { label: "Nome",     value: user.name },
            { label: "Email",    value: user.email },
            { label: "Telefone", value: user.phone ?? "—" },
            { label: "Empresa",  value: user.company.name },
            { label: "Função",   value: user.role.replace("PORTAL_", "") },
          ].map(({ label, value }) => (
            <div key={label} className="flex items-center gap-4">
              <dt className="w-24 text-gray-400 flex-shrink-0">{label}</dt>
              <dd className="font-medium text-gray-900">{value}</dd>
            </div>
          ))}
        </dl>
        <p className="text-xs text-gray-400 mt-4">
          Para alterar dados pessoais, contacte o Azul Coworking em{" "}
          <a href="mailto:geral@azulcowork.com" className="underline">geral@azulcowork.com</a>.
        </p>
      </div>

      {/* Notificações */}
      <div className="bg-white rounded-xl border border-gray-100 p-6">
        <h2 className="font-semibold text-gray-800 mb-4">Preferências de Notificação</h2>

        <label className="flex items-center gap-3 cursor-pointer">
          <div className="relative">
            <input
              type="checkbox"
              checked={notifyEmail}
              onChange={(e) => setNotifyEmail(e.target.checked)}
              className="sr-only"
            />
            <div
              onClick={() => setNotifyEmail(!notifyEmail)}
              className={`w-11 h-6 rounded-full transition-colors cursor-pointer ${
                notifyEmail ? "bg-blue-600" : "bg-gray-200"
              }`}
            >
              <div className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                notifyEmail ? "translate-x-5" : "translate-x-0"
              }`} />
            </div>
          </div>
          <div>
            <div className="text-sm font-medium text-gray-900">Notificações por email</div>
            <div className="text-xs text-gray-500">
              Faturas, lembretes de pagamento, actualizações de tickets
            </div>
          </div>
        </label>

        {saveMsg && (
          <div className={`mt-3 text-sm ${saveMsg.startsWith("Erro") ? "text-red-600" : "text-green-600"}`}>
            {saveMsg}
          </div>
        )}

        <button
          onClick={handleSavePrefs}
          disabled={saving}
          className="mt-4 bg-blue-600 text-white text-sm px-4 py-2 rounded-xl hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          {saving ? "A guardar..." : "Guardar preferências"}
        </button>
      </div>

      {/* Segurança */}
      <div className="bg-white rounded-xl border border-gray-100 p-6">
        <h2 className="font-semibold text-gray-800 mb-3">Acesso e Segurança</h2>
        <p className="text-sm text-gray-500 mb-4">
          Este portal usa links de acesso por email (magic link) para autenticação
          segura, sem password para memorizar.
        </p>
        <div className="text-xs text-gray-400 space-y-1">
          <div>• Links de acesso válidos por 15 minutos</div>
          <div>• Sessão válida por 8 horas após autenticação</div>
          <div>• Máximo 3 pedidos de link por hora</div>
        </div>
      </div>
    </div>
  );
}

export default function PortalPerfilPage() {
  return (
    <PortalLayout>
      <PerfilContent />
    </PortalLayout>
  );
}
