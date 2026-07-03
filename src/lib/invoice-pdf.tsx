/**
 * InvoiceTemplate — gera o PDF oficial da Azul Coworking
 * Usa @react-pdf/renderer (renderização server-side).
 */

import React from "react";
import {
  Document,
  Page,
  Text,
  View,
  Image,
  StyleSheet,
  Font,
} from "@react-pdf/renderer";

// ── tipos ────────────────────────────────────────────────────────────────────
export type InvoiceData = {
  invoiceNumber: string;
  receiptRef: string;
  issueDate: string;
  dueDate: string;
  status: string;
  paymentMethod: string;
  serviceType: string;
  amount: number;
  notes?: string | null;
  // contrato
  totalContracted?: number;
  totalPaid?: number;
  balance?: number;
  months?: number;
  company: {
    name: string;
    nif?: string | null;
    email: string;
    whatsapp: string;
    responsible: string;
    roomNumber: string;
    planType: string;
  };
  logoBase64: string;        // data:image/jpeg;base64,...
};

// ── cores (template oficial) ─────────────────────────────────────────────────
const C = {
  navy:   "#003366",
  blue:   "#2F6FED",
  grey1:  "#666666",
  grey2:  "#777777",
  grey3:  "#333333",
  light:  "#CCCCCC",
  bg:     "#F4F7FB",
  white:  "#FFFFFF",
  green:  "#16a34a",
  amber:  "#d97706",
  red:    "#dc2626",
};

// ── estilos ──────────────────────────────────────────────────────────────────
const S = StyleSheet.create({
  page: {
    backgroundColor: C.white,
    paddingTop: 36,
    paddingBottom: 50,
    paddingHorizontal: 44,
    fontFamily: "Helvetica",
    fontSize: 9,
    color: C.grey3,
  },

  /* cabeçalho */
  header: { flexDirection: "row", alignItems: "flex-end", marginBottom: 4 },
  logo: { width: 72, height: 54, objectFit: "contain" },
  headerText: { flex: 1, paddingLeft: 14, paddingBottom: 4 },
  companyName: { fontSize: 18, fontFamily: "Helvetica-Bold", color: C.navy, marginBottom: 3 },
  companyMeta: { fontSize: 7, color: C.grey1 },
  headerLine: { borderBottomWidth: 2, borderBottomColor: C.navy, marginTop: 2 },

  /* bloco morada cliente */
  sectionGap: { marginTop: 16 },
  labelItalic: { fontSize: 9, fontFamily: "Helvetica-Oblique", color: C.grey2, marginBottom: 4 },
  clientName: { fontSize: 13, fontFamily: "Helvetica-Bold", color: C.navy, marginBottom: 3 },
  clientMeta: { fontSize: 9, color: C.grey3, marginBottom: 2 },

  /* tabela de referência */
  refTable: { flexDirection: "row", marginTop: 18, borderBottomWidth: 0.5, borderBottomColor: C.light, paddingBottom: 6 },
  refCol: { flex: 1 },
  refLabel: { fontSize: 7.5, color: C.grey2, marginBottom: 3 },
  refValue: { fontSize: 9.5, fontFamily: "Helvetica-Bold", color: C.grey3 },

  /* badge de estado */
  badgeWrap: { alignSelf: "flex-start", borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2, marginTop: 2 },
  badgeText: { fontSize: 8, fontFamily: "Helvetica-Bold" },

  /* secção detalhe */
  sectionTitle: { fontSize: 10.5, fontFamily: "Helvetica-Bold", color: C.navy, marginBottom: 4, marginTop: 18 },
  divider: { borderBottomWidth: 1, borderBottomColor: C.navy, marginBottom: 10 },

  descBox: { backgroundColor: C.bg, borderRadius: 4, padding: 9, marginBottom: 12 },
  descText: { fontSize: 9, color: C.grey3, lineHeight: 1.55 },

  /* grelha de campos */
  fieldRow: { flexDirection: "row", marginBottom: 2, paddingBottom: 6, borderBottomWidth: 0.4, borderBottomColor: C.light },
  fieldLabel: { width: 130, fontSize: 8.5, color: C.grey2 },
  fieldValue: { flex: 1, fontSize: 9, fontFamily: "Helvetica-Bold", color: C.grey3 },

  /* total */
  totalBox: { backgroundColor: C.navy, borderRadius: 4, padding: 10, flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 18 },
  totalLabel: { fontSize: 9, color: C.white, fontFamily: "Helvetica" },
  totalValue: { fontSize: 15, fontFamily: "Helvetica-Bold", color: C.white },

  /* nota de rodapé */
  disclaimer: { fontSize: 7.5, color: C.grey2, fontFamily: "Helvetica-Oblique", marginTop: 14 },
  closing: { fontSize: 9, color: C.grey3, marginTop: 20 },
  closingBold: { fontSize: 9, fontFamily: "Helvetica-Bold", color: C.navy, marginTop: 3 },

  /* rodapé */
  footer: { position: "absolute", bottom: 20, left: 44, right: 44 },
  footerLine: { borderTopWidth: 0.5, borderTopColor: C.light, paddingTop: 7 },
  footerBrand: { fontSize: 9, fontFamily: "Helvetica-Bold", color: C.navy, marginBottom: 2 },
  footerMeta: { fontSize: 7.5, color: C.grey2 },
  footerElec: { fontSize: 6.5, color: C.light, textAlign: "right", marginTop: 3 },
});

// ── helpers ──────────────────────────────────────────────────────────────────
function formatKz(v: number) {
  return (
    new Intl.NumberFormat("pt-AO", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v) +
    " AOA"
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { bg: string; color: string; label: string }> = {
    PAGO:      { bg: "#dcfce7", color: C.green,  label: "PAGO" },
    PENDENTE:  { bg: "#fef9c3", color: C.amber,  label: "PENDENTE" },
    CANCELADO: { bg: "#fee2e2", color: C.red,    label: "CANCELADO" },
  };
  const s = map[status] ?? { bg: "#f1f5f9", color: C.grey2, label: status };
  return (
    <View style={[S.badgeWrap, { backgroundColor: s.bg }]}>
      <Text style={[S.badgeText, { color: s.color }]}>{s.label}</Text>
    </View>
  );
}

// ── componente principal ─────────────────────────────────────────────────────
export function InvoiceDocument({ inv }: { inv: InvoiceData }) {
  return (
    <Document
      title={`Recibo ${inv.receiptRef}`}
      author="Azul Coworking"
      subject={`Fatura de serviços – ${inv.company.name}`}
    >
      <Page size="A4" style={S.page}>

        {/* ── CABEÇALHO ──────────────────────────────────────────────── */}
        <View style={S.header}>
          <Image src={inv.logoBase64} style={S.logo} />
          <View style={S.headerText}>
            <Text style={S.companyName}>AZUL COWORKING</Text>
            <Text style={S.companyMeta}>
              VERSÃO DE NEGÓCIOS - COMÉRCIO GERAL E PRESTAÇÃO DE SERVIÇOS, LDA  |  NIF: 5002174308
            </Text>
            <View style={S.headerLine} />
          </View>
        </View>

        {/* ── DESTINATÁRIO ───────────────────────────────────────────── */}
        <View style={S.sectionGap}>
          <Text style={S.labelItalic}>Exmo(s) Senhor(es)</Text>
          <Text style={S.clientName}>{inv.company.name}</Text>
          <Text style={S.clientMeta}>NIF: {inv.company.nif || "N/D"}</Text>
          <Text style={S.clientMeta}>{inv.company.email}</Text>
          <Text style={S.clientMeta}>LUANDA</Text>
        </View>

        {/* ── TABELA DE REFERÊNCIA ───────────────────────────────────── */}
        <View style={S.refTable}>
          <View style={S.refCol}>
            <Text style={S.refLabel}>Referência</Text>
            <Text style={S.refValue}>{inv.receiptRef}</Text>
          </View>
          <View style={S.refCol}>
            <Text style={S.refLabel}>Tipo de Pagamento</Text>
            <Text style={S.refValue}>{inv.paymentMethod}</Text>
          </View>
          <View style={S.refCol}>
            <Text style={S.refLabel}>Data de Emissão</Text>
            <Text style={S.refValue}>{inv.issueDate}</Text>
          </View>
          <View style={S.refCol}>
            <Text style={S.refLabel}>Estado</Text>
            <StatusBadge status={inv.status} />
          </View>
        </View>

        {/* ── DETALHE DO PAGAMENTO ───────────────────────────────────── */}
        <Text style={S.sectionTitle}>Detalhe do Pagamento</Text>
        <View style={S.divider} />

        <View style={S.descBox}>
          <Text style={S.descText}>
            Recibo de pagamento referente a {inv.serviceType} no Azul Coworking,
            com início em {inv.issueDate} e vencimento em {inv.dueDate}.
          </Text>
        </View>

        {/* campos */}
        <View style={S.fieldRow}>
          <Text style={S.fieldLabel}>Serviço / Plano:</Text>
          <Text style={S.fieldValue}>{inv.serviceType}</Text>
        </View>
        <View style={S.fieldRow}>
          <Text style={S.fieldLabel}>Plano contratado:</Text>
          <Text style={S.fieldValue}>{inv.company.planType}</Text>
        </View>
        <View style={S.fieldRow}>
          <Text style={S.fieldLabel}>Sala / Escritório:</Text>
          <Text style={S.fieldValue}>{inv.company.roomNumber}</Text>
        </View>
        <View style={S.fieldRow}>
          <Text style={S.fieldLabel}>Período:</Text>
          <Text style={S.fieldValue}>{inv.issueDate}  –  {inv.dueDate}</Text>
        </View>
        <View style={S.fieldRow}>
          <Text style={S.fieldLabel}>Responsável:</Text>
          <Text style={S.fieldValue}>{inv.company.responsible}</Text>
        </View>
        <View style={S.fieldRow}>
          <Text style={S.fieldLabel}>Beneficiário:</Text>
          <Text style={S.fieldValue}>VERSÃO DE NEGÓCIOS - COM. GERAL E PREST. SERV., LDA</Text>
        </View>
        <View style={S.fieldRow}>
          <Text style={S.fieldLabel}>Conta / Ref. pagamento:</Text>
          <Text style={S.fieldValue}>212870210001 AKZ  |  Banco BCS</Text>
        </View>
        <View style={S.fieldRow}>
          <Text style={S.fieldLabel}>Montante:</Text>
          <Text style={S.fieldValue}>{formatKz(inv.amount)}</Text>
        </View>
        <View style={S.fieldRow}>
          <Text style={S.fieldLabel}>Moeda:</Text>
          <Text style={S.fieldValue}>AOA (Kwanzas angolanos)</Text>
        </View>
        {inv.notes && (
          <View style={S.fieldRow}>
            <Text style={S.fieldLabel}>Observações:</Text>
            <Text style={S.fieldValue}>{inv.notes}</Text>
          </View>
        )}

        {/* ── RESUMO DO CONTRATO (se disponível) ─────────────────────── */}
        {inv.totalContracted != null && (
          <>
            <Text style={[S.sectionTitle, { marginTop: 14 }]}>Resumo do Contrato</Text>
            <View style={[S.divider, { marginBottom: 8 }]} />
            <View style={S.fieldRow}>
              <Text style={S.fieldLabel}>Valor contratado:</Text>
              <Text style={S.fieldValue}>{formatKz(inv.totalContracted!)}</Text>
            </View>
            <View style={S.fieldRow}>
              <Text style={S.fieldLabel}>Total recebido:</Text>
              <Text style={[S.fieldValue, { color: C.green }]}>{formatKz(inv.totalPaid ?? 0)}</Text>
            </View>
            <View style={S.fieldRow}>
              <Text style={S.fieldLabel}>Meses contratados:</Text>
              <Text style={S.fieldValue}>{inv.months}</Text>
            </View>
          </>
        )}

        {/* ── TOTAL ──────────────────────────────────────────────────── */}
        <View style={S.totalBox}>
          <Text style={S.totalLabel}>Total pago nesta fatura</Text>
          <Text style={S.totalValue}>{formatKz(inv.amount)}</Text>
        </View>

        {/* ── SALDO / LIQUIDADO ───────────────────────────────────────── */}
        {inv.balance != null && (
          <View style={{
            marginTop: 8,
            borderRadius: 4,
            padding: 10,
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
            backgroundColor: (inv.balance ?? 0) <= 0 ? "#dcfce7" : "#fee2e2",
          }}>
            <Text style={{ fontSize: 9, fontFamily: "Helvetica-Bold", color: (inv.balance ?? 0) <= 0 ? C.green : C.red }}>
              {(inv.balance ?? 0) <= 0 ? "✓ TOTALMENTE LIQUIDADO" : "SALDO EM DÍVIDA"}
            </Text>
            <Text style={{ fontSize: 13, fontFamily: "Helvetica-Bold", color: (inv.balance ?? 0) <= 0 ? C.green : C.red }}>
              {formatKz(Math.abs(inv.balance ?? 0))}
            </Text>
          </View>
        )}

        {/* ── FECHO ──────────────────────────────────────────────────── */}
        <Text style={S.disclaimer}>
          * Este documento serve como comprovativo de pagamento e deve ser assinado pelo cliente aquando da recepção.
        </Text>
        <Text style={S.closing}>Com os nossos melhores cumprimentos,</Text>
        <Text style={S.closingBold}>Equipa Azul Coworking</Text>

        {/* ── RODAPÉ ─────────────────────────────────────────────────── */}
        <View style={S.footer} fixed>
          <View style={S.footerLine}>
            <Text style={S.footerBrand}>Azul Coworking</Text>
            <Text style={S.footerMeta}>
              Bairro Azul, Edifício 18, Luanda, Angola  (perto do Cine Tivoli)
            </Text>
            <Text style={S.footerMeta}>
              976 467 124  |  geral@azulcowork.com  |  azulcowork.com
            </Text>
          </View>
          <Text style={S.footerElec}>
            (documento emitido electronicamente — não carece de assinatura)
          </Text>
        </View>

      </Page>
    </Document>
  );
}
