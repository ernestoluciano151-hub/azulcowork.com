"use client";

/**
 * /portal/empresa — Dados da empresa + utilizadores do portal (VOL09)
 *
 * Consome:
 *   GET /api/portal/company
 *   GET /api/portal/users
 */

import { useEffect, useState, useCallback } from "react";
import PortalLayout, { usePortalAuth } from "@/components/portal/PortalLayout";

interface PortalCompanyData {
  id:              string;
  name:            string;
  nif:             string | null;
  email:           string | null;
  whatsapp:        string | null;
  responsible:     string | null;
  contractStatus:  string;
  paymentStatus:   string;
  address:         string | null;
  createdAt:       string;
}

interface PortalUserItem {
  id:        string;
  name:      string;
  email:     string;
  role:      string;
  phone:     string | null;
  isActive:  boolean;
  lastLoginAt: string | null;
}

const ROLE_LABEL: Record<string, string> = {
  PORTAL_OWNER:  "Proprietário",
  PORTAL_ADMIN:  "Administrador",
  PORTAL_MEMBER: "Membro",
  PORTAL_VIEWER: "Visualizador",
};

function fmtDate(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("pt-AO", {
    day: "2-digit", month: "short", year: "numeric",
  });
}

function EmpresaContent() {
  const { user: me }       = usePortalAuth();
  const [company, setCompany] = useState<PortalCompanyData | null>(null);
  const [users,   setUsers]   = useState<PortalUserItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [cRes, uRes] = await Promise.all([
        fetch("/api/portal/company"),
        fetch("/api/portal/users"),
      ]);
      if (!cRes.ok) throw new Error("Erro ao carregar empresa.");
      const cJson = await cRes.json();
      setCompany(cJson.data);
      if (uRes.ok) {
        const uJson = await uRes.json();
        setUsers(uJson.data ?? []);
      }
    } catch {
      setError("Não foi possível carregar os dados. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }
  if (error || !company) {
    return <div className="p-8 text-center text-red-600 text-sm">{error}</div>;
  }

  const canManageUsers = me?.role === "PORTAL_OWNER" || me?.role === "PORTAL_ADMIN";

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">A Minha Empresa</h1>

      {/* Dados da empresa */}
      <div className="bg-white rounded-xl border border-gray-100 p-6">
        <h2 className="font-semibold text-gray-800 mb-4">Informações</h2>
        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
          {[
            { label: "Nome",            value: company.name },
            { label: "NIF",             value: company.nif ?? "—" },
            { label: "Email",           value: company.email ?? "—" },
            { label: "WhatsApp",        value: company.whatsapp ?? "—" },
            { label: "Responsável",     value: company.responsible ?? "—" },
            { label: "Morada",          value: company.address ?? "—" },
            { label: "Estado contrato", value: company.contractStatus },
            { label: "Estado pagamento",value: company.paymentStatus },
            { label: "Cliente desde",   value: fmtDate(company.createdAt) },
          ].map(({ label, value }) => (
            <div key={label}>
              <dt className="text-xs text-gray-400 mb-0.5">{label}</dt>
              <dd className="font-medium text-gray-900">{value}</dd>
            </div>
          ))}
        </dl>
      </div>

      {/* Utilizadores */}
      <div className="bg-white rounded-xl border border-gray-100 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-gray-800">Utilizadores do Portal</h2>
          {canManageUsers && (
            <span className="text-xs text-gray-400">
              Gestão de utilizadores disponível em breve
            </span>
          )}
        </div>
        {users.length === 0 ? (
          <p className="text-sm text-gray-400">Nenhum utilizador registado.</p>
        ) : (
          <div className="divide-y divide-gray-50">
            {users.map((u) => (
              <div key={u.id} className="py-3 flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-900 truncate">{u.name}</span>
                    {u.id === me?.id && (
                      <span className="text-xs bg-blue-100 text-blue-600 px-2 py-0.5 rounded-full">
                        Você
                      </span>
                    )}
                    {!u.isActive && (
                      <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">
                        Inactivo
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-gray-500 mt-0.5 truncate">{u.email}</div>
                </div>
                <div className="text-right flex-shrink-0">
                  <div className="text-xs font-medium text-gray-700">
                    {ROLE_LABEL[u.role] ?? u.role}
                  </div>
                  <div className="text-xs text-gray-400 mt-0.5">
                    Último login: {fmtDate(u.lastLoginAt)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Info de contacto Azul */}
      <div className="bg-blue-50 rounded-xl border border-blue-100 p-5 text-sm">
        <div className="font-semibold text-blue-800 mb-2">Azul Coworking</div>
        <div className="text-blue-700 space-y-1">
          <div>📧 <a href="mailto:geral@azulcowork.com" className="underline">geral@azulcowork.com</a></div>
          <div>📞 976 467 124</div>
          <div>📍 Bairro Azul, Edifício 18, Luanda, Angola</div>
        </div>
      </div>
    </div>
  );
}

export default function PortalEmpresaPage() {
  return (
    <PortalLayout>
      <EmpresaContent />
    </PortalLayout>
  );
}
