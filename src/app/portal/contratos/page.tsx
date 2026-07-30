"use client";

/**
 * /portal/contratos — Vista de contratos (VOL09)
 *
 * Consome: GET /api/portal/contracts
 */

import { useEffect, useState } from "react";
import PortalLayout from "@/components/portal/PortalLayout";

interface Contract {
  id:           string;
  planType:     string;
  status:       string;
  startDate:    string;
  endDate:      string | null;
  monthlyValue: number;
  rentDay:      number;
  notes:        string | null;
  createdAt:    string;
}

function fmtKz(n: number) {
  return new Intl.NumberFormat("pt-AO", {
    style: "currency", currency: "AOA", minimumFractionDigits: 2,
  }).format(n);
}

function fmtDate(d: string | null) {
  if (!d) return "Indeterminado";
  return new Date(d).toLocaleDateString("pt-AO", {
    day: "2-digit", month: "long", year: "numeric",
  });
}

const PLAN_LABEL: Record<string, string> = {
  HOT_DESK:     "Hot Desk",
  DEDICATED:    "Mesa Dedicada",
  PRIVATE:      "Escritório Privado",
  VIRTUAL:      "Escritório Virtual",
  MEETING_ROOM: "Sala de Reunião",
};

const STATUS_STYLE: Record<string, { label: string; cls: string; dot: string }> = {
  ACTIVE:     { label: "Activo",     cls: "bg-green-50 border-green-200", dot: "bg-green-400" },
  SUSPENDED:  { label: "Suspenso",   cls: "bg-yellow-50 border-yellow-200", dot: "bg-yellow-400" },
  TERMINATED: { label: "Terminado",  cls: "bg-gray-50 border-gray-200", dot: "bg-gray-400" },
  EXPIRED:    { label: "Expirado",   cls: "bg-red-50 border-red-200", dot: "bg-red-400" },
  PENDING:    { label: "Pendente",   cls: "bg-blue-50 border-blue-200", dot: "bg-blue-400" },
};

function ContratosContent() {
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const res  = await fetch("/api/portal/contracts");
        const json = await res.json();
        if (!res.ok) throw new Error(json.error ?? "Erro ao carregar contratos.");
        setContracts(json.data ?? []);
      } catch {
        setError("Não foi possível carregar os contratos.");
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }
  if (error) {
    return <div className="p-8 text-center text-red-600 text-sm">{error}</div>;
  }

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-5">
      <h1 className="text-2xl font-bold text-gray-900">Contratos</h1>

      {contracts.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-100 p-12 text-center">
          <div className="text-4xl mb-3">📄</div>
          <div className="text-gray-500 text-sm">Nenhum contrato encontrado.</div>
        </div>
      ) : (
        <div className="space-y-4">
          {contracts.map((c) => {
            const st = STATUS_STYLE[c.status] ?? STATUS_STYLE.TERMINATED;
            return (
              <div
                key={c.id}
                className={`bg-white rounded-xl border p-5 ${st.cls}`}
              >
                <div className="flex items-start justify-between gap-4 mb-4">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${st.dot}`} />
                      <span className="font-semibold text-gray-900">
                        {PLAN_LABEL[c.planType] ?? c.planType}
                      </span>
                    </div>
                    <div className="text-xs text-gray-500 ml-4">{st.label}</div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div className="font-bold text-gray-900">{fmtKz(c.monthlyValue)}</div>
                    <div className="text-xs text-gray-500">por mês</div>
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                  <div>
                    <div className="text-xs text-gray-400 mb-0.5">Início</div>
                    <div className="font-medium">{fmtDate(c.startDate)}</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-400 mb-0.5">Término</div>
                    <div className="font-medium">{fmtDate(c.endDate)}</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-400 mb-0.5">Dia de vencimento</div>
                    <div className="font-medium">Dia {c.rentDay} de cada mês</div>
                  </div>
                </div>

                {c.notes && (
                  <div className="mt-3 pt-3 border-t border-gray-100 text-xs text-gray-500">
                    {c.notes}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Contacto para renovação */}
      <div className="bg-blue-50 rounded-xl border border-blue-100 p-4 text-sm text-blue-800">
        <strong>Pretende renovar ou alterar o seu contrato?</strong>{" "}
        Contacte-nos em{" "}
        <a href="mailto:geral@azulcowork.com" className="underline">geral@azulcowork.com</a>
        {" "}ou pelo 976 467 124.
      </div>
    </div>
  );
}

export default function PortalContratosPage() {
  return (
    <PortalLayout>
      <ContratosContent />
    </PortalLayout>
  );
}
