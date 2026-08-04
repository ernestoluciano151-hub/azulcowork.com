/**
 * ReceiptDocument — Recibo de pagamento simplificado
 * Documento separado da fatura, confirma apenas o valor recebido.
 * Usa @react-pdf/renderer (server-side).
 */

import React from "react";
import {
  Document,
  Page,
  Text,
  View,
  Image,
  StyleSheet,
} from "@react-pdf/renderer";

// ── tipos ────────────────────────────────────────────────────────────────────
export type ReceiptData = {
  receiptNumber: string;     // ex: "REC-2025-0047"
  paymentDate: string;       // ex: "13/07/2025"
  paymentMethod: string;     // ex: "Transferência Bancária"
  operationRef?: string;     // referência da operação bancária
  amount: number;            // valor pago nesta transação
  invoiceRef?: string;       // nº da fatura associada
  description: string;       // descrição do serviço pago
  // cliente
  clientName: string;
  clientNif?: string | null;
  clientEmail?: string;
  // emitente
  logoBase64: string;
};

// ── cores ────────────────────────────────────────────────────────────────────
const C = {
  navy:  "#003366",
  blue:  "#2F6FED",
  grey1: "#666666",
  grey3: "#333333",
  light: "#CCCCCC",
  bg:    "#F4F7FB",
  white: "#FFFFFF",
  green: "#16a34a",
};

// ── utilitários ───────────────────────────────────────────────────────────────
const formatKz = (v: number) =>
  new Intl.NumberFormat("pt-AO", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    .format(v) + " Kz";

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
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 20,
    borderBottomWidth: 2,
    borderBottomColor: C.blue,
    paddingBottom: 12,
  },
  logo: { width: 80, height: 40, objectFit: "contain" },
  headerRight: { alignItems: "flex-end" },
  docTitle: { fontSize: 20, fontFamily: "Helvetica-Bold", color: C.navy, letterSpacing: 1 },
  docSubtitle: { fontSize: 9, color: C.grey1, marginTop: 2 },
  receiptNum: { fontSize: 11, fontFamily: "Helvetica-Bold", color: C.blue, marginTop: 4 },

  // cliente
  sectionGap: { marginTop: 12, marginBottom: 8 },
  labelItalic: { fontFamily: "Helvetica-Oblique", color: C.grey1, fontSize: 8, marginBottom: 3 },
  clientName: { fontSize: 13, fontFamily: "Helvetica-Bold", color: C.navy },
  clientMeta: { fontSize: 8, color: C.grey1, marginTop: 1 },

  // tabela de referência
  refTable: {
    flexDirection: "row",
    backgroundColor: C.bg,
    borderRadius: 4,
    padding: 10,
    marginTop: 10,
    marginBottom: 16,
  },
  refCol: { flex: 1 },
  refLabel: { fontSize: 7, color: C.grey1, marginBottom: 2, textTransform: "uppercase" },
  refValue: { fontSize: 9, fontFamily: "Helvetica-Bold", color: C.navy },

  // campo-valor
  fieldRow: {
    flexDirection: "row",
    paddingVertical: 5,
    borderBottomWidth: 0.5,
    borderBottomColor: C.light,
  },
  fieldLabel: { width: 140, color: C.grey1, fontSize: 8 },
  fieldValue: { flex: 1, fontFamily: "Helvetica-Bold", color: C.grey3, fontSize: 9 },

  // total em destaque
  totalBox: {
    backgroundColor: C.navy,
    borderRadius: 6,
    padding: 14,
    marginTop: 18,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  totalLabel: { fontSize: 11, color: C.white, fontFamily: "Helvetica-Bold" },
  totalValue: { fontSize: 16, color: "#7EC8FF", fontFamily: "Helvetica-Bold" },

  // assinatura
  sigBox: {
    marginTop: 30,
    borderTopWidth: 0.5,
    borderTopColor: C.light,
    paddingTop: 12,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  sigCol: { alignItems: "center", width: 160 },
  sigLine: { width: 140, borderBottomWidth: 1, borderBottomColor: C.grey1, marginBottom: 4 },
  sigLabel: { fontSize: 7, color: C.grey1 },

  // rodapé
  footer: {
    position: "absolute",
    bottom: 20,
    left: 44,
    right: 44,
    borderTopWidth: 0.5,
    borderTopColor: C.light,
    paddingTop: 6,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  footerText: { fontSize: 7, color: C.grey1 },

  sectionTitle: { fontSize: 10, fontFamily: "Helvetica-Bold", color: C.navy, marginTop: 14 },
  divider: { borderBottomWidth: 1, borderBottomColor: C.blue, marginBottom: 8 },
});

// ── componente principal ──────────────────────────────────────────────────────
export function ReceiptDocument({ rec }: { rec: ReceiptData }) {
  return (
    <Document
      title={`Recibo ${rec.receiptNumber}`}
      author="Azul Coworking"
      subject="Recibo de Pagamento"
    >
      <Page size="A4" style={S.page}>

        {/* ── CABEÇALHO ─────────────────────────────────────────────────── */}
        <View style={S.header}>
          <View>
            {rec.logoBase64 ? (
              <Image src={rec.logoBase64} style={S.logo} />
            ) : (
              <Text style={{ fontSize: 14, fontFamily: "Helvetica-Bold", color: C.navy }}>
                AZUL COWORKING
              </Text>
            )}
            <Text style={{ fontSize: 7, color: C.grey1, marginTop: 4 }}>
              VERSÃO DE NEGÓCIOS - COM. GERAL E PREST. SERV., LDA
            </Text>
            <Text style={{ fontSize: 7, color: C.grey1 }}>
              NIF: 5002174308 · Luanda, Angola
            </Text>
          </View>
          <View style={S.headerRight}>
            <Text style={S.docTitle}>RECIBO</Text>
            <Text style={S.docSubtitle}>Comprovativo de Pagamento</Text>
            <Text style={S.receiptNum}>{rec.receiptNumber}</Text>
            <Text style={{ fontSize: 8, color: C.grey1, marginTop: 2 }}>
              Data: {rec.paymentDate}
            </Text>
          </View>
        </View>

        {/* ── DESTINATÁRIO ───────────────────────────────────────────────── */}
        <View style={S.sectionGap}>
          <Text style={S.labelItalic}>Recebemos de</Text>
          <Text style={S.clientName}>{rec.clientName}</Text>
          {rec.clientNif && (
            <Text style={S.clientMeta}>NIF: {rec.clientNif}</Text>
          )}
          {rec.clientEmail && (
            <Text style={S.clientMeta}>{rec.clientEmail}</Text>
          )}
        </View>

        {/* ── TABELA DE REFERÊNCIA ───────────────────────────────────────── */}
        <View style={S.refTable}>
          <View style={S.refCol}>
            <Text style={S.refLabel}>Nº Recibo</Text>
            <Text style={S.refValue}>{rec.receiptNumber}</Text>
          </View>
          <View style={S.refCol}>
            <Text style={S.refLabel}>Forma de Pagamento</Text>
            <Text style={S.refValue}>{rec.paymentMethod}</Text>
          </View>
          {rec.invoiceRef && (
            <View style={S.refCol}>
              <Text style={S.refLabel}>Fatura Referenciada</Text>
              <Text style={S.refValue}>{rec.invoiceRef}</Text>
            </View>
          )}
          {rec.operationRef && (
            <View style={S.refCol}>
              <Text style={S.refLabel}>Ref. Operação</Text>
              <Text style={S.refValue}>{rec.operationRef}</Text>
            </View>
          )}
        </View>

        {/* ── DETALHE ─────────────────────────────────────────────────────── */}
        <Text style={S.sectionTitle}>Descrição do Pagamento</Text>
        <View style={S.divider} />

        <View style={S.fieldRow}>
          <Text style={S.fieldLabel}>Descrição / Serviço:</Text>
          <Text style={S.fieldValue}>{rec.description}</Text>
        </View>
        <View style={S.fieldRow}>
          <Text style={S.fieldLabel}>Data de Pagamento:</Text>
          <Text style={S.fieldValue}>{rec.paymentDate}</Text>
        </View>
        <View style={S.fieldRow}>
          <Text style={S.fieldLabel}>Beneficiário:</Text>
          <Text style={S.fieldValue}>VERSÃO DE NEGÓCIOS - COM. GERAL E PREST. SERV., LDA</Text>
        </View>
        <View style={S.fieldRow}>
          <Text style={S.fieldLabel}>Conta / IBAN:</Text>
          <Text style={S.fieldValue}>212870210001 AKZ  |  Banco BCS</Text>
        </View>
        <View style={S.fieldRow}>
          <Text style={S.fieldLabel}>Moeda:</Text>
          <Text style={S.fieldValue}>AOA (Kwanzas angolanos)</Text>
        </View>

        {/* ── TOTAL EM DESTAQUE ─────────────────────────────────────────── */}
        <View style={S.totalBox}>
          <Text style={S.totalLabel}>VALOR RECEBIDO</Text>
          <Text style={S.totalValue}>{formatKz(rec.amount)}</Text>
        </View>

        {/* ── ASSINATURAS ───────────────────────────────────────────────── */}
        <View style={S.sigBox}>
          <View style={S.sigCol}>
            <View style={S.sigLine} />
            <Text style={S.sigLabel}>Responsável pela Cobrança</Text>
            <Text style={[S.sigLabel, { marginTop: 2 }]}>Azul Coworking</Text>
          </View>
          <View style={S.sigCol}>
            <View style={S.sigLine} />
            <Text style={S.sigLabel}>Assinatura do Pagador</Text>
            <Text style={[S.sigLabel, { marginTop: 2 }]}>{rec.clientName}</Text>
          </View>
        </View>

        {/* ── RODAPÉ ────────────────────────────────────────────────────── */}
        <View style={S.footer}>
          <Text style={S.footerText}>
            Azul Coworking · Luanda, Angola · azulcoworking.ao
          </Text>
          <Text style={S.footerText}>
            Documento emitido electronicamente — válido sem assinatura autógrafa
          </Text>
        </View>

      </Page>
    </Document>
  );
}
