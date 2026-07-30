"use client";

/**
 * MonthlyReportPdf — VOL06-4
 *
 * Gera e descarrega o Relatório Executivo Mensal em PDF via @react-pdf/renderer.
 * Usado como botão na página do Dashboard.
 *
 * Nota: uses dynamic import com ssr:false para evitar erros de SSR
 * (react-pdf usa APIs de browser que não existem no Node).
 */

import { useState } from "react";

type ReportData = {
  month: string;
  generatedAt: string;
  financial: {
    coworkingRevenue: number;
    coworkingPaidCount: number;
    salaRevenue: number;
    salaHoursBooked: number;
    totalRevenue: number;
    pendingPayments: { count: number; total: number };
    overduePayments: { count: number; total: number };
  };
  sala: {
    reservationsCount: number;
    paidCount: number;
    hoursBooked: number;
    revenue: number;
  };
  crm: {
    newLeads: number;
    convertedLeads: number;
    conversionRate: number;
  };
  operations: {
    activeCompanies: number;
    mrr: number;
  };
};

function fmtKz(v: number): string {
  return v.toLocaleString("pt-AO", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " Kz";
}

function monthLabel(mk: string): string {
  const [year, month] = mk.split("-");
  const d = new Date(parseInt(year), parseInt(month) - 1, 1);
  return d.toLocaleDateString("pt-AO", { month: "long", year: "numeric" });
}

async function generateAndDownload(data: ReportData) {
  // Dynamic import to avoid SSR issues
  const { pdf, Document, Page, View, Text, StyleSheet } = await import(
    "@react-pdf/renderer"
  );

  const styles = StyleSheet.create({
    page: {
      padding: 48,
      fontFamily: "Helvetica",
      backgroundColor: "#ffffff",
      color: "#1e293b",
      fontSize: 10,
    },
    header: { marginBottom: 24 },
    logo: { fontSize: 18, fontFamily: "Helvetica-Bold", color: "#1d4ed8" },
    subtitle: { fontSize: 10, color: "#64748b", marginTop: 2 },
    title: { fontSize: 14, fontFamily: "Helvetica-Bold", marginTop: 16, color: "#0f172a" },
    period: { fontSize: 10, color: "#64748b", marginTop: 2 },
    divider: { height: 1, backgroundColor: "#e2e8f0", marginVertical: 16 },
    sectionTitle: {
      fontSize: 11,
      fontFamily: "Helvetica-Bold",
      color: "#1d4ed8",
      marginBottom: 8,
      marginTop: 16,
    },
    row: { flexDirection: "row", justifyContent: "space-between", marginBottom: 5 },
    label: { color: "#64748b" },
    value: { fontFamily: "Helvetica-Bold", color: "#0f172a" },
    highlight: { fontFamily: "Helvetica-Bold", color: "#059669" },
    warning: { fontFamily: "Helvetica-Bold", color: "#d97706" },
    danger:  { fontFamily: "Helvetica-Bold", color: "#dc2626" },
    footer: {
      position: "absolute",
      bottom: 32,
      left: 48,
      right: 48,
      fontSize: 8,
      color: "#94a3b8",
      borderTopWidth: 1,
      borderTopColor: "#e2e8f0",
      paddingTop: 8,
    },
  });

  const generatedDate = new Date(data.generatedAt).toLocaleString("pt-AO");

  const doc = (
    <Document
      title={`Relatório Executivo — ${monthLabel(data.month)}`}
      author="VD Platform — Azul Coworking"
    >
      <Page size="A4" style={styles.page}>
        {/* Cabeçalho */}
        <View style={styles.header}>
          <Text style={styles.logo}>Azul Coworking</Text>
          <Text style={styles.subtitle}>
            VERSÃO DE NEGÓCIOS - COMÉRCIO GERAL E PRESTAÇÃO DE SERVIÇOS, LDA · NIF: 5002174308
          </Text>
          <Text style={styles.title}>Relatório Executivo Mensal</Text>
          <Text style={styles.period}>
            Período: {monthLabel(data.month)}
          </Text>
        </View>

        <View style={styles.divider} />

        {/* 1. Resumo Financeiro */}
        <Text style={styles.sectionTitle}>1. Resumo Financeiro</Text>

        <View style={styles.row}>
          <Text style={styles.label}>Receita Coworking (pagamentos confirmados)</Text>
          <Text style={styles.highlight}>{fmtKz(data.financial.coworkingRevenue)}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Receita Sala de Reunião</Text>
          <Text style={styles.highlight}>{fmtKz(data.financial.salaRevenue)}</Text>
        </View>
        <View style={styles.divider} />
        <View style={styles.row}>
          <Text style={{ ...styles.label, fontFamily: "Helvetica-Bold", color: "#0f172a" }}>
            Total Recebido
          </Text>
          <Text style={{ ...styles.highlight, fontSize: 12 }}>
            {fmtKz(data.financial.totalRevenue)}
          </Text>
        </View>

        {data.financial.pendingPayments.count > 0 && (
          <View style={styles.row}>
            <Text style={styles.label}>
              Pagamentos Pendentes ({data.financial.pendingPayments.count})
            </Text>
            <Text style={styles.warning}>
              {fmtKz(data.financial.pendingPayments.total)}
            </Text>
          </View>
        )}
        {data.financial.overduePayments.count > 0 && (
          <View style={styles.row}>
            <Text style={styles.label}>
              Pagamentos em Atraso ({data.financial.overduePayments.count})
            </Text>
            <Text style={styles.danger}>
              {fmtKz(data.financial.overduePayments.total)}
            </Text>
          </View>
        )}

        {/* 2. Operações — Sala de Reunião */}
        <Text style={styles.sectionTitle}>2. Operações — Sala de Reunião</Text>

        <View style={styles.row}>
          <Text style={styles.label}>Reservas realizadas no mês</Text>
          <Text style={styles.value}>{data.sala.reservationsCount}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Reservas pagas</Text>
          <Text style={styles.value}>{data.sala.paidCount}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Horas reservadas (total)</Text>
          <Text style={styles.value}>{data.sala.hoursBooked} h</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Receita sala confirmada</Text>
          <Text style={styles.highlight}>{fmtKz(data.sala.revenue)}</Text>
        </View>

        {/* 3. CRM */}
        <Text style={styles.sectionTitle}>3. CRM — Leads e Conversões</Text>

        <View style={styles.row}>
          <Text style={styles.label}>Novos leads no mês</Text>
          <Text style={styles.value}>{data.crm.newLeads}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Leads convertidos no mês</Text>
          <Text style={styles.value}>{data.crm.convertedLeads}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Taxa de conversão do mês</Text>
          <Text style={styles.value}>{data.crm.conversionRate}%</Text>
        </View>

        {/* 4. Estado Operacional */}
        <Text style={styles.sectionTitle}>4. Estado Operacional</Text>

        <View style={styles.row}>
          <Text style={styles.label}>Empresas com contrato activo</Text>
          <Text style={styles.value}>{data.operations.activeCompanies}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>MRR (Receita Mensal Recorrente)</Text>
          <Text style={styles.highlight}>{fmtKz(data.operations.mrr)}</Text>
        </View>

        <View style={styles.divider} />

        {/* Rodapé */}
        <View style={styles.footer} fixed>
          <View style={styles.row}>
            <Text>VD Platform · Azul Coworking · Bairro Azul, Edifício 18, Luanda, Angola</Text>
            <Text>Gerado: {generatedDate}</Text>
          </View>
          <Text style={{ marginTop: 2 }}>geral@azulcowork.com · www.azulcowork.com</Text>
        </View>
      </Page>
    </Document>
  );

  const blob = await pdf(doc).toBlob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `relatorio-executivo-${data.month}.pdf`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

export default function MonthlyReportPdf() {
  const now = new Date();
  const defaultMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  const [month, setMonth] = useState(defaultMonth);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleExport() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/bi/report/monthly?month=${month}`);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      const data: ReportData = await res.json();
      await generateAndDownload(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao gerar PDF.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="flex items-center gap-2">
        <label htmlFor="report-month" className="text-xs text-mist whitespace-nowrap">
          Mês do relatório:
        </label>
        <input
          id="report-month"
          type="month"
          value={month}
          onChange={(e) => setMonth(e.target.value)}
          className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-paper focus:outline-none focus:ring-2 focus:ring-blue-500/50"
        />
      </div>
      <button
        onClick={handleExport}
        disabled={loading}
        className="flex items-center gap-2 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed px-4 py-2 text-sm font-semibold text-white transition-colors"
      >
        {loading ? (
          <>
            <span className="inline-block w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            A gerar…
          </>
        ) : (
          <>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M7 21h10a2 2 0 002-2V9l-5-5H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 13h6m-3-3v6" />
            </svg>
            Exportar PDF
          </>
        )}
      </button>
      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  );
}
