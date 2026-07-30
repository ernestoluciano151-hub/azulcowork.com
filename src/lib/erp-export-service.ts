/**
 * erp-export-service.ts — Exportação de relatórios ERP (Volume 02 — Sprint ERP-9)
 *
 * Gera ficheiros .xlsx ou .csv para:
 *   exportPnl(period, format)          — R-02 Demonstração de Resultados
 *   exportAgingAr(opts, format)        — R-03 Aging AR
 *   exportMrrBreakdown(months, format) — R-04 MRR Breakdown
 *   exportVatReport(period, format)    — R-07 Relatório de IVA
 *   exportCostCenters(period, format)  — R-06 Centros de Custo
 *   exportDelinquency(format)          — R-08 Inadimplência
 *
 * Motor: exceljs (já instalado — "^4.4.0")
 * Output: Buffer + content-type correcto
 *
 * Docs: docs/05-erp/reports.md#exportação
 */

import ExcelJS                         from "exceljs";
import { getPnl, getMrrBreakdown,
         getCostCenterReport, getDelinquencyReport }  from "@/lib/erp-dashboard-service";
import { getArAging }                  from "@/lib/erp-receivables-service";
import { getVatReport }                from "@/lib/erp-vat-report-service";

// ── Tipos ─────────────────────────────────────────────────────────────────────

export type ExportFormat = "xlsx" | "csv";

export interface ExportResult {
  buffer:      Buffer;
  contentType: string;
  filename:    string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const BLUE_FILL: ExcelJS.Fill = {
  type:    "pattern",
  pattern: "solid",
  fgColor: { argb: "FF1E4D91" },
};
const HEADER_FONT: Partial<ExcelJS.Font>      = { color: { argb: "FFFFFFFF" }, bold: true };
const ALT_FILL: ExcelJS.Fill = {
  type:    "pattern",
  pattern: "solid",
  fgColor: { argb: "FFF0F4FF" },
};

function fmtKz(v: number): string {
  return v.toLocaleString("pt-PT", { maximumFractionDigits: 0 });
}

function applyHeader(
  row: ExcelJS.Row,
  cols: string[]
): void {
  row.values = ["", ...cols]; // ExcelJS usa índice 1-based, col 0 vazia
  row.eachCell((cell, colNum) => {
    if (colNum === 1) return;
    cell.fill   = BLUE_FILL;
    cell.font   = HEADER_FONT;
    cell.border = {
      bottom: { style: "thin", color: { argb: "FFFFFFFF" } },
    };
    cell.alignment = { horizontal: "center" };
  });
}

function addAltRow(
  sheet: ExcelJS.Worksheet,
  values: (string | number)[],
  rowIdx: number
): void {
  const row = sheet.addRow(values);
  if (rowIdx % 2 === 0) {
    row.eachCell((cell) => { cell.fill = ALT_FILL; });
  }
}

async function toBuffer(wb: ExcelJS.Workbook, fmt: ExportFormat): Promise<Buffer> {
  if (fmt === "csv") {
    // CSV: usa a primeira sheet
    return Buffer.from(await wb.csv.writeBuffer());
  }
  return Buffer.from(await wb.xlsx.writeBuffer());
}

function contentType(fmt: ExportFormat): string {
  return fmt === "csv"
    ? "text/csv; charset=utf-8"
    : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
}

function ext(fmt: ExportFormat): string {
  return fmt === "csv" ? "csv" : "xlsx";
}

// ── exportPnl ─────────────────────────────────────────────────────────────────

/**
 * R-02 — Demonstração de Resultados (P&L) mensal.
 */
export async function exportPnl(
  period?: string,
  fmt: ExportFormat = "xlsx"
): Promise<ExportResult> {
  const pnl = await getPnl(period);
  const wb  = new ExcelJS.Workbook();
  const ws  = wb.addWorksheet("Demonstração de Resultados");

  // Colunas
  ws.columns = [
    { width: 40 }, // Descrição
    { width: 18 }, // Valor (Kz)
    { width: 10 }, // %
  ];

  // Título
  const titleRow = ws.addRow([`Demonstração de Resultados — ${pnl.period}`]);
  titleRow.getCell(1).font = { bold: true, size: 13, color: { argb: "FF1E4D91" } };
  ws.addRow([]);

  const addSection = (title: string, lines: { description: string; amount: number }[], total: number) => {
    const hRow = ws.addRow([title, "Kz", "%"]);
    hRow.eachCell((c) => { c.fill = BLUE_FILL; c.font = HEADER_FONT; });

    lines.forEach((l, i) => addAltRow(ws, [l.description, fmtKz(l.amount), ""], i));

    const totRow = ws.addRow([`TOTAL ${title}`, fmtKz(total), ""]);
    totRow.getCell(1).font = { bold: true };
    totRow.getCell(2).font = { bold: true };
    ws.addRow([]);
  };

  addSection("PROVEITOS", pnl.revenue.lines, pnl.revenue.total);
  addSection("CUSTOS OPERACIONAIS", pnl.operationalCosts.lines, pnl.operationalCosts.total);

  const mgRow = ws.addRow(["MARGEM BRUTA", fmtKz(pnl.grossMargin), `${pnl.grossMarginPct}%`]);
  mgRow.eachCell((c) => { c.font = { bold: true }; c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE8F5E9" } }; });
  ws.addRow([]);

  addSection("CUSTOS COM PESSOAL", pnl.personnelCosts.lines, pnl.personnelCosts.total);
  addSection("DESPESAS GERAIS", pnl.generalExpenses.lines, pnl.generalExpenses.total);

  const ebitRow = ws.addRow(["EBIT (Lucro Operacional)", fmtKz(pnl.ebit), ""]);
  ebitRow.eachCell((c) => {
    c.font = { bold: true, size: 11 };
    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: pnl.ebit >= 0 ? "FFE8F5E9" : "FFFDECEA" } };
  });

  const buf = await toBuffer(wb, fmt);
  return {
    buffer:      buf,
    contentType: contentType(fmt),
    filename:    `pnl-${pnl.period}.${ext(fmt)}`,
  };
}

// ── exportAgingAr ─────────────────────────────────────────────────────────────

/**
 * R-03 — Aging AR detalhado por empresa.
 */
export async function exportAgingAr(
  opts: { companyId?: string; asOf?: Date } = {},
  fmt: ExportFormat = "xlsx"
): Promise<ExportResult> {
  const aging = await getArAging(opts);
  const today = opts.asOf ? new Date(opts.asOf) : new Date();
  const period = today.toISOString().slice(0, 7);

  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Aging AR");

  ws.columns = [
    { width: 30 }, // Empresa
    { width: 18 }, // Corrente
    { width: 18 }, // 1-30d
    { width: 18 }, // 31-60d
    { width: 18 }, // 61-90d
    { width: 18 }, // +90d
    { width: 18 }, // Total
  ];

  const hRow = ws.getRow(1);
  applyHeader(hRow, ["Empresa", "Corrente", "1-30 dias", "31-60 dias", "61-90 dias", "+90 dias", "Total"]);

  let idx = 0;
  for (const entry of aging.byCompany) {
    addAltRow(ws, [
      entry.companyName,
      fmtKz(entry.buckets.CURRENT    ?? 0),
      fmtKz(entry.buckets.OVERDUE_30 ?? 0),
      fmtKz(entry.buckets.OVERDUE_60 ?? 0),
      fmtKz(entry.buckets.OVERDUE_90 ?? 0),
      fmtKz(entry.buckets.OVERDUE_90P ?? 0),
      fmtKz(entry.total),
    ], idx++);
  }

  // Linha de totais
  const totalRow = ws.addRow([
    "TOTAL",
    fmtKz(aging.totals.CURRENT    ?? 0),
    fmtKz(aging.totals.OVERDUE_30 ?? 0),
    fmtKz(aging.totals.OVERDUE_60 ?? 0),
    fmtKz(aging.totals.OVERDUE_90 ?? 0),
    fmtKz(aging.totals.OVERDUE_90P ?? 0),
    fmtKz(aging.grandTotal),
  ]);
  totalRow.eachCell((c) => { c.font = { bold: true }; c.fill = BLUE_FILL; c.font = HEADER_FONT; });

  const buf = await toBuffer(wb, fmt);
  return {
    buffer:      buf,
    contentType: contentType(fmt),
    filename:    `aging-ar-${period}.${ext(fmt)}`,
  };
}

// ── exportMrrBreakdown ────────────────────────────────────────────────────────

/**
 * R-04 — MRR Breakdown mensal.
 */
export async function exportMrrBreakdown(
  months: number = 6,
  fmt: ExportFormat = "xlsx"
): Promise<ExportResult> {
  const breakdown = await getMrrBreakdown(months);
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("MRR Breakdown");

  ws.columns = [
    { width: 12 }, // Período
    { width: 18 }, // Novo MRR
    { width: 18 }, // Churn MRR
    { width: 18 }, // Net MRR
    { width: 18 }, // MRR Total
  ];

  const hRow = ws.getRow(1);
  applyHeader(hRow, ["Período", "Novo MRR (Kz)", "Churn MRR (Kz)", "Net MRR (Kz)", "MRR Total (Kz)"]);

  breakdown.forEach((p, i) => {
    addAltRow(ws, [
      p.period,
      fmtKz(p.newMrr),
      fmtKz(p.churnMrr),
      fmtKz(p.netMrr),
      fmtKz(p.totalMrr),
    ], i);
  });

  const buf = await toBuffer(wb, fmt);
  const period = new Date().toISOString().slice(0, 7);
  return {
    buffer:      buf,
    contentType: contentType(fmt),
    filename:    `mrr-breakdown-${period}.${ext(fmt)}`,
  };
}

// ── exportVatReport ───────────────────────────────────────────────────────────

/**
 * R-07 — Relatório de IVA mensal.
 */
export async function exportVatReport(
  period?: string,
  fmt: ExportFormat = "xlsx"
): Promise<ExportResult> {
  const vat = await getVatReport(period);
  const wb  = new ExcelJS.Workbook();

  // Sheet 1: Resumo
  const summary = wb.addWorksheet("Resumo IVA");
  summary.columns = [{ width: 35 }, { width: 20 }];

  const titleRow = summary.addRow([`Apuramento de IVA — ${vat.period}`]);
  titleRow.getCell(1).font = { bold: true, size: 13, color: { argb: "FF1E4D91" } };
  summary.addRow([]);

  const rows: [string, string][] = [
    ["IVA Liquidado (cobrado a clientes)",   `Kz ${fmtKz(vat.outputVat)}`],
    ["IVA Dedutível (pago a fornecedores)", `Kz ${fmtKz(vat.inputVat)}`],
    ["APURAMENTO (a pagar / a recuperar)",  `Kz ${fmtKz(Math.abs(vat.vatBalance))} ${vat.status === "CREDIT" ? "(crédito)" : vat.status === "ZERO" ? "" : "(a pagar)"}`],
  ];
  rows.forEach(([label, value], i) => {
    const row = summary.addRow([label, value]);
    if (i % 2 === 0) row.eachCell((c) => { c.fill = ALT_FILL; });
    if (i === rows.length - 1) row.eachCell((c) => { c.font = { bold: true }; });
  });

  // Sheet 2: Linhas Output
  const wsOut = wb.addWorksheet("IVA Liquidado");
  wsOut.columns = [{ width: 40 }, { width: 15 }, { width: 18 }, { width: 18 }];
  applyHeader(wsOut.getRow(1), ["Descrição", "Data", "Base (Kz)", "IVA (Kz)"]);
  vat.outputLines.forEach((l, i) => {
    addAltRow(wsOut, [
      l.description,
      new Date(l.date).toLocaleDateString("pt-AO"),
      fmtKz(l.baseAmount),
      fmtKz(l.vatAmount),
    ], i);
  });

  // Sheet 3: Linhas Input
  const wsIn = wb.addWorksheet("IVA Dedutível");
  wsIn.columns = [{ width: 40 }, { width: 15 }, { width: 18 }, { width: 18 }];
  applyHeader(wsIn.getRow(1), ["Fornecedor / Descrição", "Data", "Base (Kz)", "IVA (Kz)"]);
  vat.inputLines.forEach((l, i) => {
    addAltRow(wsIn, [
      l.description,
      new Date(l.date).toLocaleDateString("pt-AO"),
      fmtKz(l.baseAmount),
      fmtKz(l.vatAmount),
    ], i);
  });

  const buf = await toBuffer(wb, fmt);
  return {
    buffer:      buf,
    contentType: contentType(fmt),
    filename:    `iva-${vat.period}.${ext(fmt)}`,
  };
}

// ── exportCostCenters ─────────────────────────────────────────────────────────

/**
 * R-06 — Despesas por Centro de Custo vs. Orçamento.
 */
export async function exportCostCenters(
  period?: string,
  fmt: ExportFormat = "xlsx"
): Promise<ExportResult> {
  const report = await getCostCenterReport(period);
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Centros de Custo");

  ws.columns = [
    { width: 6 },  // Código
    { width: 28 }, // Nome
    { width: 18 }, // Orçamento
    { width: 18 }, // Real
    { width: 18 }, // Variação
    { width: 10 }, // Status
  ];

  applyHeader(ws.getRow(1), ["Código", "Centro de Custo", "Orçamento (Kz)", "Real (Kz)", "Variação", "Status"]);

  report.centers.forEach((c, i) => {
    const variance = c.variance >= 0 ? `+${fmtKz(c.variance)}` : `-${fmtKz(Math.abs(c.variance))}`;
    const row = ws.addRow([
      c.code,
      c.name,
      c.budget !== null ? fmtKz(c.budget) : "Sem orçamento",
      fmtKz(c.actual),
      variance,
      c.status,
    ]);
    if (i % 2 === 0) row.eachCell((cell) => { cell.fill = ALT_FILL; });
    // Colorir status
    const statusCell = row.getCell(6);
    if (c.status === "CRITICAL") statusCell.font = { color: { argb: "FFDC2626" }, bold: true };
    else if (c.status === "WARNING") statusCell.font = { color: { argb: "FFD97706" }, bold: true };
    else if (c.status === "OK")   statusCell.font = { color: { argb: "FF16A34A" } };
  });

  const buf = await toBuffer(wb, fmt);
  return {
    buffer:      buf,
    contentType: contentType(fmt),
    filename:    `cost-centers-${report.period}.${ext(fmt)}`,
  };
}

// ── exportDelinquency ─────────────────────────────────────────────────────────

/**
 * R-08 — Inadimplência por empresa.
 */
export async function exportDelinquency(
  fmt: ExportFormat = "xlsx"
): Promise<ExportResult> {
  const report = await getDelinquencyReport();
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Inadimplência");

  ws.columns = [
    { width: 30 }, // Empresa
    { width: 18 }, // Em aberto (Kz)
    { width: 15 }, // Faturas
    { width: 15 }, // Dias mais antigo
  ];

  applyHeader(ws.getRow(1), ["Empresa", "Em Aberto (Kz)", "N.º Faturas", "Dias (mais antigo)"]);

  report.lines.forEach((l, i) => {
    addAltRow(ws, [
      l.companyName,
      fmtKz(l.outstanding),
      l.invoiceCount,
      l.oldestDays,
    ], i);
  });

  const totalRow = ws.addRow(["TOTAL", fmtKz(report.totalOutstanding), "", ""]);
  totalRow.eachCell((c) => { c.font = { bold: true }; c.fill = BLUE_FILL; c.font = HEADER_FONT; });

  const period = new Date().toISOString().slice(0, 7);
  const buf = await toBuffer(wb, fmt);
  return {
    buffer:      buf,
    contentType: contentType(fmt),
    filename:    `delinquency-${period}.${ext(fmt)}`,
  };
}
