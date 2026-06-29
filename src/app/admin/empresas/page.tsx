"use client";

import { useEffect, useState, useCallback } from "react";
import Sidebar from "@/components/admin/Sidebar";
import CompanyModal, { Company } from "@/components/admin/CompanyModal";
import { format } from "date-fns";

const CONTRACT_STATUS_COLORS: Record<string, string> = {
  ATIVO: "bg-emerald-500/15 text-emerald-300",
  PRESTES_EXPIRAR: "bg-amber-500/15 text-amber-300",
  RENOVADO: "bg-blue-500/15 text-blue-300",
  ENCERRADO: "bg-red-500/15 text-red-300"
};

const PAYMENT_STATUS_COLORS: Record<string, string> = {
  EM_DIA: "bg-emerald-500/15 text-emerald-300",
  A_VENCER: "bg-amber-500/15 text-amber-300",
  EM_ATRASO: "bg-red-500/15 text-red-300"
};

export default function EmpresasPage() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [contractStatus, setContractStatus] = useState("ALL");
  const [paymentStatus, setPaymentStatus] = useState("ALL");
  const [q, setQ] = useState("");
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);
  const [creatingCompany, setCreatingCompany] = useState(false);

  const fetchCompanies = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (contractStatus !== "ALL") params.set("contractStatus", contractStatus);
    if (paymentStatus !== "ALL") params.set("paymentStatus", paymentStatus);
    if (q) params.set("q", q);

    const res = await fetch(`/api/companies?${params.toString()}`);
    if (res.ok) {
      const data = await res.json();
      setCompanies(data.companies);
    }
    setLoading(false);
  }, [contractStatus, paymentStatus, q]);

  useEffect(() => {
    fetchCompanies();
  }, [fetchCompanies]);

  return (
    <div className="flex min-h-screen bg-ink">
      <Sidebar />
      <main className="flex-1 p-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="font-display text-2xl font-bold text-paper">Empresas</h1>
            <p className="mt-1 text-sm text-mist">{companies.length} empresa(s) registadas.</p>
          </div>
          <button
            onClick={() => setCreatingCompany(true)}
            className="focus-ring rounded-lg bg-azul px-4 py-2 text-sm font-medium text-white hover:bg-azul-dim"
          >
            + Nova Empresa
          </button>
        </div>

        {/* Filtros */}
        <div className="mt-5 flex flex-wrap gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Pesquisar por nome, responsável ou e-mail..."
            className="focus-ring min-w-[220px] flex-1 rounded-lg border border-white/10 bg-ink px-3 py-2 text-sm text-paper"
          />
          <select
            value={contractStatus}
            onChange={(e) => setContractStatus(e.target.value)}
            className="focus-ring rounded-lg border border-white/10 bg-ink px-3 py-2 text-sm text-paper"
          >
            <option value="ALL">Estado do contrato</option>
            <option value="ATIVO">Ativo</option>
            <option value="PRESTES_EXPIRAR">Prestes a expirar</option>
            <option value="RENOVADO">Renovado</option>
            <option value="ENCERRADO">Encerrado</option>
          </select>
          <select
            value={paymentStatus}
            onChange={(e) => setPaymentStatus(e.target.value)}
            className="focus-ring rounded-lg border border-white/10 bg-ink px-3 py-2 text-sm text-paper"
          >
            <option value="ALL">Estado de pagamento</option>
            <option value="EM_DIA">Em dia</option>
            <option value="A_VENCER">A vencer</option>
            <option value="EM_ATRASO">Em atraso</option>
          </select>
        </div>

        {/* Tabela */}
        <div className="mt-5 overflow-x-auto rounded-2xl border border-white/10">
          <table className="w-full text-left text-sm">
            <thead className="bg-white/[0.03] text-mist">
              <tr>
                <th className="px-4 py-3 font-medium">Empresa</th>
                <th className="px-4 py-3 font-medium">Responsável</th>
                <th className="px-4 py-3 font-medium">Sala</th>
                <th className="px-4 py-3 font-medium">Plano</th>
                <th className="px-4 py-3 font-medium">Fim contrato</th>
                <th className="px-4 py-3 font-medium">Renda</th>
                <th className="px-4 py-3 font-medium">Contrato</th>
                <th className="px-4 py-3 font-medium">Pagamento</th>
                <th className="px-4 py-3 font-medium" />
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {loading && (
                <tr>
                  <td colSpan={9} className="px-4 py-8 text-center text-mist">A carregar...</td>
                </tr>
              )}
              {!loading && companies.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-4 py-8 text-center text-mist">
                    Nenhuma empresa encontrada.
                  </td>
                </tr>
              )}
              {companies.map((c) => (
                <tr
                  key={c.id}
                  className="cursor-pointer text-paper hover:bg-white/[0.02]"
                  onClick={() => setSelectedCompany(c)}
                >
                  <td className="px-4 py-3 font-medium">{c.name}</td>
                  <td className="px-4 py-3 text-mist">{c.responsible}</td>
                  <td className="px-4 py-3 text-mist">{c.roomNumber}</td>
                  <td className="px-4 py-3 text-mist">{c.planType}</td>
                  <td className="px-4 py-3">{format(new Date(c.contractEnd), "dd/MM/yyyy")}</td>
                  <td className="px-4 py-3">{c.rentAmount.toLocaleString("pt-PT", { style: "currency", currency: "EUR" })}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-3 py-1 text-xs font-medium ${CONTRACT_STATUS_COLORS[c.contractStatus] || "bg-white/10 text-mist"}`}>
                      {c.contractStatus.replace("_", " ")}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-3 py-1 text-xs font-medium ${PAYMENT_STATUS_COLORS[c.paymentStatus] || "bg-white/10 text-mist"}`}>
                      {c.paymentStatus.replace("_", " ")}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={(e) => { e.stopPropagation(); setSelectedCompany(c); }}
                      className="focus-ring rounded-lg border border-white/10 px-3 py-1.5 text-xs hover:bg-white/5"
                    >
                      Editar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </main>

      {selectedCompany && (
        <CompanyModal
          company={selectedCompany}
          onClose={() => setSelectedCompany(null)}
          onSaved={() => { fetchCompanies(); setSelectedCompany(null); }}
        />
      )}
      {creatingCompany && (
        <CompanyModal
          onClose={() => setCreatingCompany(false)}
          onSaved={() => { fetchCompanies(); setCreatingCompany(false); }}
        />
      )}
    </div>
  );
}
