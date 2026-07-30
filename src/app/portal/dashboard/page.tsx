"use client";

/**
 * /portal/dashboard — Dashboard principal do Portal do Cliente (VOL09)
 *
 * Mostra: contrato activo, saldo pendente, próxima renda,
 * notificações não lidas, actividade recente.
 *
 * Consome: GET /api/portal/dashboard
 */

import { useEffect, useState } from "react";
import PortalLayout, { usePortalAuth } from "@/components/portal/PortalLayout";
import Link from "next/link";

// ── Tipos ─────────────────────────────────────────────────────────────────────

interface DashboardData {
  company: {
    id:             string;
    name:           string;
    contractStatus: string;
    paymentStatus:  string;
  };
  activeContract: {
    id:           string;
    planType:     string;
    startDate:    string;
    endDate:      string | null;
    monthlyValue: number;
    status:       string;
    daysUntilEnd: number | null;
  } | null;
  financials: {
    pendingAmount:  number;
    overdueAmount:  number;
    pendingCount:   number;
    overdueCount:   number;
  };
  nextRent: {
    dueDate:   string;
    amount:    number;
    status:    string;
    daysUntil: number;
  } | null;
  unreadNotificationsCount: number;
  recentActivity: {
    id:          string;
    eventType:   string;
    title:       string;
    description: string | null;
    occurredAt:  string;
  }[];
}

// ── Utilitários ───────────────────────────────────────────────────────────────

function fmtKz(n: number) {
  return new Intl.NumberFormat("pt-AO", {
    style:    "currency",
    currency: "AOA",
    minimumFractionDigits: 2,
  }).format(n);
}

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString("pt-AO", {
    day: "2-digit", month: "short", year: "numeric",
  });
}

const CONTRACT_STATUS_LABEL: Record<string, { label: string; color: string }> = {
  ACTIVE:       { label: "Activo",     color: "bg-green-100 text-green-700" },
  SUSPENDED:    { label: "Suspenso",   color: "bg-yellow-100 text-yellow-700" },
  TERMINATED:   { label: "Terminado",  color: "bg-red-100 text-red-700" },
  PENDING:      { label: "Pendente",   color: "bg-blue-100 text-blue-700" },
};

const PLAN_LABEL: Record<string, string> = {
  HOT_DESK:     "Hot Desk",
  DEDICATED:    "Mesa Dedicada",
  PRIVATE:      "Escritório Privado",
  VIRTUAL:      "Escritório Virtual",
  MEETING_ROOM: "Sala de Reunião",
};

const EVENT_ICON: Record<string, string> = {
  INVOICE_ISSUED:      "📋",
  PAYMENT_CONFIRMED:   "✅",
  CONTRACT_STARTED:    "📄",
  CONTRACT_RENEWED:    "🔄",
  CONTRACT_TERMINATED: "❌",
  BOOKING_CREATED:     "🗓️",
  BOOKING_CONFIRMED:   "✔️",
  TICKET_CREATED:      "💬",
  TICKET_RESOLVED:     "🎉",
  NOTE_ADDED:          "📝",
};

// ── Inner Dashboard (usa context) ─────────────────────────────────────────────

function DashboardContent() {
  const { user } = usePortalAuth();
  const [data,    setData]    = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/portal/dashboard");
        if (!res.ok) throw new Error("Erro ao carregar dados.");
        const json = await res.json();
        setData(json.data);
      } catch {
        setError("Não foi possível carregar o dashboard. Tente novamente.");
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-8 text-center text-red-600 text-sm">{error}</div>
    );
  }

  const { activeContract, financials, nextRent, recentActivity, unreadNotificationsCount } = data;

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">

      {/* Cabeçalho */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">
          Olá, {user?.name?.split(" ")[0] ?? "cliente"} 👋
        </h1>
        <p className="text-gray-500 text-sm mt-0.5">{data.company.name}</p>
      </div>

      {/* Alertas */}
      {financials.overdueAmount > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3">
          <span className="text-xl">⚠️</span>
          <div>
            <div className="font-semibold text-red-800 text-sm">Pagamento em atraso</div>
            <div className="text-red-700 text-sm">
              Tem {financials.overdueCount} fatura{financials.overdueCount !== 1 ? "s" : ""}{" "}
              em atraso totalizando <strong>{fmtKz(financials.overdueAmount)}</strong>.
            </div>
            <Link href="/portal/faturas" className="text-red-600 underline text-xs mt-1 inline-block">
              Ver faturas
            </Link>
          </div>
        </div>
      )}

      {activeContract?.daysUntilEnd !== null &&
       activeContract?.daysUntilEnd !== undefined &&
       activeContract.daysUntilEnd <= 30 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 flex items-start gap-3">
          <span className="text-xl">📅</span>
          <div>
            <div className="font-semibold text-yellow-800 text-sm">Contrato a expirar</div>
            <div className="text-yellow-700 text-sm">
              O seu contrato expira em <strong>{activeContract.daysUntilEnd} dias</strong>.
              Contacte-nos para renovar.
            </div>
          </div>
        </div>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Saldo Pendente */}
        <div className="bg-white rounded-xl border border-gray-100 p-4">
          <div className="text-xs text-gray-500 mb-1">Em Aberto</div>
          <div className={`text-xl font-bold ${financials.pendingAmount > 0 ? "text-amber-600" : "text-gray-900"}`}>
            {fmtKz(financials.pendingAmount)}
          </div>
          <div className="text-xs text-gray-400 mt-0.5">
            {financials.pendingCount} fatura{financials.pendingCount !== 1 ? "s" : ""}
          </div>
        </div>

        {/* Próxima Renda */}
        <div className="bg-white rounded-xl border border-gray-100 p-4">
          <div className="text-xs text-gray-500 mb-1">Próxima Renda</div>
          {nextRent ? (
            <>
              <div className="text-xl font-bold text-gray-900">{fmtKz(nextRent.amount)}</div>
              <div className="text-xs text-gray-400 mt-0.5">
                {fmtDate(nextRent.dueDate)}
                {nextRent.daysUntil <= 7 && (
                  <span className="ml-1 text-amber-500">({nextRent.daysUntil}d)</span>
                )}
              </div>
            </>
          ) : (
            <div className="text-sm text-gray-400 mt-1">—</div>
          )}
        </div>

        {/* Plano */}
        <div className="bg-white rounded-xl border border-gray-100 p-4">
          <div className="text-xs text-gray-500 mb-1">Plano</div>
          {activeContract ? (
            <>
              <div className="text-base font-semibold text-gray-900 leading-tight">
                {PLAN_LABEL[activeContract.planType] ?? activeContract.planType}
              </div>
              <span className={`inline-block text-xs px-2 py-0.5 rounded-full mt-1 ${
                CONTRACT_STATUS_LABEL[activeContract.status]?.color ?? "bg-gray-100 text-gray-600"
              }`}>
                {CONTRACT_STATUS_LABEL[activeContract.status]?.label ?? activeContract.status}
              </span>
            </>
          ) : (
            <div className="text-sm text-gray-400 mt-1">Sem contrato activo</div>
          )}
        </div>

        {/* Notificações */}
        <div className="bg-white rounded-xl border border-gray-100 p-4">
          <div className="text-xs text-gray-500 mb-1">Notificações</div>
          <div className="text-xl font-bold text-gray-900">{unreadNotificationsCount}</div>
          <div className="text-xs text-gray-400 mt-0.5">não lidas</div>
        </div>
      </div>

      {/* Contrato activo */}
      {activeContract && (
        <div className="bg-white rounded-xl border border-gray-100 p-5">
          <h2 className="font-semibold text-gray-800 mb-3">Contrato Activo</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <div className="text-xs text-gray-400">Plano</div>
              <div className="font-medium">{PLAN_LABEL[activeContract.planType] ?? activeContract.planType}</div>
            </div>
            <div>
              <div className="text-xs text-gray-400">Renda Mensal</div>
              <div className="font-medium">{fmtKz(activeContract.monthlyValue)}</div>
            </div>
            <div>
              <div className="text-xs text-gray-400">Início</div>
              <div className="font-medium">{fmtDate(activeContract.startDate)}</div>
            </div>
            <div>
              <div className="text-xs text-gray-400">Término</div>
              <div className="font-medium">
                {activeContract.endDate ? fmtDate(activeContract.endDate) : "Indeterminado"}
              </div>
            </div>
          </div>
          <Link
            href="/portal/contratos"
            className="text-xs text-blue-600 hover:underline mt-3 inline-block"
          >
            Ver detalhes do contrato →
          </Link>
        </div>
      )}

      {/* Acções rápidas */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { href: "/portal/faturas",    icon: "📋", label: "Faturas" },
          { href: "/portal/reservas/nova", icon: "🗓️", label: "Reservar Sala" },
          { href: "/portal/suporte/novo",  icon: "💬", label: "Suporte" },
          { href: "/portal/documentos",    icon: "📁", label: "Documentos" },
        ].map((a) => (
          <Link
            key={a.href}
            href={a.href}
            className="bg-white border border-gray-100 rounded-xl p-4 flex flex-col items-center gap-2 hover:border-blue-200 hover:bg-blue-50 transition-colors text-center"
          >
            <span className="text-2xl">{a.icon}</span>
            <span className="text-sm font-medium text-gray-700">{a.label}</span>
          </Link>
        ))}
      </div>

      {/* Actividade recente */}
      {recentActivity.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-100 p-5">
          <h2 className="font-semibold text-gray-800 mb-4">Actividade Recente</h2>
          <div className="space-y-3">
            {recentActivity.slice(0, 6).map((ev) => (
              <div key={ev.id} className="flex items-start gap-3">
                <span className="text-lg flex-shrink-0 mt-0.5">
                  {EVENT_ICON[ev.eventType] ?? "📌"}
                </span>
                <div className="min-w-0">
                  <div className="text-sm font-medium text-gray-900 leading-tight">{ev.title}</div>
                  {ev.description && (
                    <div className="text-xs text-gray-500 mt-0.5 truncate">{ev.description}</div>
                  )}
                  <div className="text-xs text-gray-400 mt-0.5">
                    {fmtDate(ev.occurredAt)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Page export ───────────────────────────────────────────────────────────────

export default function PortalDashboardPage() {
  return (
    <PortalLayout>
      <DashboardContent />
    </PortalLayout>
  );
}
