/**
 * erp-pdf-service.tsx — Geração de PDFs financeiros (Volume 02 — Sprint ERP-8)
 *
 * Gera PDFs de:
 *   generateInvoicePdf(data)  — Factura (FT-CWORK / FT-SALA / FT-SERV)
 *   generateReceiptPdf(data)  — Recibo de pagamento (REC-*)
 *
 * Motor: @react-pdf/renderer v4 (já instalado)
 * Output: Buffer → para upload ao Cloudinary via erp-communication-service
 *
 * Design: cabeçalho Azul Coworking · NIF emitente · dados cliente · IVA 14%
 *         tabela de itens · totais · dados bancários BCS
 *
 * Docs: docs/05-erp/communication.md
 */

import React from "react";
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  renderToBuffer,
} from "@react-pdf/renderer";

// ── Identidade da Empresa ──────────────────────────────────────────────────────

const CO_NAME   = "VERSÃO DE NEGÓCIOS - COMÉRCIO GERAL E PRESTAÇÃO DE SERVIÇOS, LDA";
const CO_BRAND  = "AZUL COWORKING";
const CO_NIF    = "5002174308";
const CO_ADDR   = "Bairro Azul, Edifício 18, Luanda, Angola";
const CO_EMAIL  = "geral@azulcowork.com";
const CO_PHONE  = "+244 976 467 124";
const CO_WEB    = "www.azulcowork.com";

const BANK_NAME  = "BCS";
const BANK_IBAN  = "AO06007000000212870210113";
const BANK_SWIFT = "CDTSAOLU";

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtKz(v: number): string {
  return `Kz ${v.toLocaleString("pt-PT", { maximumFractionDigits: 0 })}`;
}

function fmtDate(d: Date | string): string {
  const dt = typeof d === "string" ? new Date(d) : d;
  const dd = String(dt.getDate()).padStart(2, "0");
  const mm  = String(dt.getMonth() + 1).padStart(2, "0");
  const yy  = dt.getFullYear();
  return `${dd}/${mm}/${yy}`;
}

// ── Estilos ───────────────────────────────────────────────────────────────────

const BLUE   = "#1e4d91";
const BLUE_L = "#f0f4ff";
const GRAY   = "#666666";
const LINE   = "#dddddd";
const RED    = "#cc0000";

const S = StyleSheet.create({
  page:         { padding: 36, fontFamily: "Helvetica", fontSize: 9, color: "#222" },
  brand:        { fontSize: 18, fontFamily: "Helvetica-Bold", color: BLUE, marginBottom: 2 },
  coMeta:       { fontSize: 7, color: GRAY, marginBottom: 1 },
  divider:      { borderBottomColor: LINE, borderBottomWidth: 1, marginVertical: 10 },
  docTitle:     { fontSize: 13, fontFamily: "Helvetica-Bold", marginTop: 12, marginBottom: 6 },
  row:          { flexDirection: "row", marginBottom: 2 },
  label:        { color: GRAY, width: 90 },
  value:        { flex: 1 },
  bold:         { fontFamily: "Helvetica-Bold" },
  section:      { marginBottom: 10 },
  sectionTitle: { fontFamily: "Helvetica-Bold", fontSize: 8, marginBottom: 4, color: "#444" },
  tHead:        { flexDirection: "row", backgroundColor: BLUE, color: "#fff",
                  paddingVertical: 5, paddingHorizontal: 5,
                  fontFamily: "Helvetica-Bold", fontSize: 8 },
  tRow:         { flexDirection: "row", paddingVertical: 4, paddingHorizontal: 5,
                  borderBottomColor: LINE, borderBottomWidth: 1 },
  tRowAlt:      { flexDirection: "row", paddingVertical: 4, paddingHorizontal: 5,
                  borderBottomColor: LINE, borderBottomWidth: 1, backgroundColor: "#f9f9f9" },
  cDesc:        { flex: 3 },
  cQty:         { width: 40, textAlign: "right" },
  cUnit:        { width: 75, textAlign: "right" },
  cTotal:       { width: 75, textAlign: "right" },
  totRow:       { flexDirection: "row", justifyContent: "flex-end", marginTop: 2 },
  totLabel:     { width: 130, textAlign: "right", color: GRAY, paddingRight: 8 },
  totValue:     { width: 80, textAlign: "right" },
  grandLabel:   { width: 130, textAlign: "right", fontFamily: "Helvetica-Bold",
                  fontSize: 10, paddingRight: 8 },
  grandValue:   { width: 80, textAlign: "right", fontFamily: "Helvetica-Bold", fontSize: 10 },
  bankBox:      { backgroundColor: BLUE_L, padding: 10, marginTop: 12, borderRadius: 4 },
  bankTitle:    { fontFamily: "Helvetica-Bold", marginBottom: 5, color: BLUE, fontSize: 9 },
  notesBox:     { marginTop: 10, padding: 8, backgroundColor: "#fffbf0",
                  borderLeftColor: "#f59e0b", borderLeftWidth: 3 },
  footer:       { position: "absolute", bottom: 20, left: 36, right: 36,
                  color: "#999", fontSize: 6.5,
                  borderTopColor: LINE, borderTopWidth: 1, paddingTop: 4 },
  amountBox:    { backgroundColor: BLUE, padding: 16, borderRadius: 4,
                  marginTop: 16, alignItems: "center" },
  amountLabel:  { color: "#b3c8f0", fontSize: 9, marginBottom: 4 },
  amountValue:  { color: "#ffffff", fontFamily: "Helvetica-Bold", fontSize: 22 },
});

// ── Tipos de Dados ─────────────────────────────────────────────────────────────

export interface InvoicePdfData {
  number:    string;
  issueDate: Date | string;
  dueDate:   Date | string;
  subtotal:  number;
  taxRate:   number;
  taxAmount: number;
  total:     number;
  notes?:    string;
  items: {
    description: string;
    quantity:    number;
    unitPrice:   number;
    total:       number;
  }[];
  company?: {
    name:        string;
    nif?:        string;
    email:       string;
    responsible: string;
  };
}

export interface ReceiptPdfData {
  receiptNumber:  string;
  invoiceNumber?: string;
  amount:         number;
  method:         string;
  paidAt:         Date | string;
  reference?:     string;
  notes?:         string;
  company?: {
    name:  string;
    email: string;
  };
}

// ── Componentes internos ───────────────────────────────────────────────────────

function HeaderBlock() {
  return (
    <View>
      <Text style={S.brand}>{CO_BRAND}</Text>
      <Text style={S.coMeta}>{CO_NAME}</Text>
      <Text style={S.coMeta}>NIF: {CO_NIF}  ·  {CO_ADDR}</Text>
      <Text style={S.coMeta}>{CO_EMAIL}  ·  {CO_PHONE}  ·  {CO_WEB}</Text>
    </View>
  );
}

// ── Documento Factura ──────────────────────────────────────────────────────────

function InvoiceDoc({ data }: { data: InvoicePdfData }) {
  const taxPct = Math.round((data.taxRate ?? 0.14) * 100);
  return (
    <Document>
      <Page size="A4" style={S.page}>
        {/* Cabeçalho */}
        <HeaderBlock />
        <View style={S.divider} />

        {/* Título + Meta */}
        <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
          <Text style={S.docTitle}>FACTURA</Text>
          <View style={{ alignItems: "flex-end", marginTop: 12 }}>
            <View style={S.row}>
              <Text style={S.label}>N.º Factura:</Text>
              <Text style={[S.value, S.bold]}>{data.number}</Text>
            </View>
            <View style={S.row}>
              <Text style={S.label}>Data Emissão:</Text>
              <Text style={S.value}>{fmtDate(data.issueDate)}</Text>
            </View>
            <View style={S.row}>
              <Text style={S.label}>Vencimento:</Text>
              <Text style={[S.value, { color: RED }]}>{fmtDate(data.dueDate)}</Text>
            </View>
          </View>
        </View>

        {/* Cliente */}
        {data.company && (
          <View style={S.section}>
            <Text style={S.sectionTitle}>FACTURADO A</Text>
            <Text style={S.bold}>{data.company.name}</Text>
            {data.company.nif ? <Text>NIF: {data.company.nif}</Text> : null}
            <Text>{data.company.responsible}  ·  {data.company.email}</Text>
          </View>
        )}

        <View style={S.divider} />

        {/* Tabela de itens */}
        <View style={S.section}>
          <View style={S.tHead}>
            <Text style={S.cDesc}>Descrição</Text>
            <Text style={S.cQty}>Qtd.</Text>
            <Text style={S.cUnit}>Preço Unit.</Text>
            <Text style={S.cTotal}>Total</Text>
          </View>
          {data.items.map((it, i) => (
            <View key={i} style={i % 2 === 0 ? S.tRow : S.tRowAlt}>
              <Text style={S.cDesc}>{it.description}</Text>
              <Text style={S.cQty}>{it.quantity}</Text>
              <Text style={S.cUnit}>{fmtKz(it.unitPrice)}</Text>
              <Text style={S.cTotal}>{fmtKz(it.total)}</Text>
            </View>
          ))}
        </View>

        {/* Totais */}
        <View>
          <View style={S.totRow}>
            <Text style={S.totLabel}>Subtotal:</Text>
            <Text style={S.totValue}>{fmtKz(data.subtotal)}</Text>
          </View>
          <View style={S.totRow}>
            <Text style={S.totLabel}>IVA ({taxPct}%):</Text>
            <Text style={S.totValue}>{fmtKz(data.taxAmount)}</Text>
          </View>
          <View style={[S.totRow, {
            borderTopColor: BLUE, borderTopWidth: 1, paddingTop: 4, marginTop: 2,
          }]}>
            <Text style={S.grandLabel}>TOTAL:</Text>
            <Text style={S.grandValue}>{fmtKz(data.total)}</Text>
          </View>
        </View>

        {/* Dados Bancários */}
        <View style={S.bankBox}>
          <Text style={S.bankTitle}>Dados para Transferência Bancária</Text>
          <View style={S.row}><Text style={S.label}>Banco:</Text><Text style={S.value}>{BANK_NAME}</Text></View>
          <View style={S.row}><Text style={S.label}>IBAN:</Text><Text style={[S.value, S.bold]}>{BANK_IBAN}</Text></View>
          <View style={S.row}><Text style={S.label}>SWIFT/BIC:</Text><Text style={S.value}>{BANK_SWIFT}</Text></View>
          <View style={S.row}><Text style={S.label}>Referência:</Text><Text style={[S.value, S.bold]}>{data.number}</Text></View>
        </View>

        {/* Notas */}
        {data.notes ? (
          <View style={S.notesBox}>
            <Text style={S.sectionTitle}>OBSERVAÇÕES</Text>
            <Text>{data.notes}</Text>
          </View>
        ) : null}

        {/* Rodapé */}
        <View style={S.footer} fixed>
          <Text>{CO_NAME}  |  NIF: {CO_NIF}  |  {CO_ADDR}</Text>
          <Text>Este documento não é válido como recibo de pagamento.  |  IVA 14% — Lei n.º 17/19 Angola</Text>
        </View>
      </Page>
    </Document>
  );
}

// ── Documento Recibo ──────────────────────────────────────────────────────────

const METHOD_PT: Record<string, string> = {
  BANK_TRANSFER: "Transferência Bancária",
  CASH:          "Numerário",
  MULTICAIXA:    "Multicaixa Express",
  POS:           "Terminal POS",
  CHECK:         "Cheque",
  OTHER:         "Outro",
};

function ReceiptDoc({ data }: { data: ReceiptPdfData }) {
  return (
    <Document>
      <Page size="A4" style={S.page}>
        <HeaderBlock />
        <View style={S.divider} />

        <Text style={S.docTitle}>RECIBO DE PAGAMENTO</Text>

        {/* Meta */}
        <View style={S.section}>
          <View style={S.row}>
            <Text style={S.label}>N.º Recibo:</Text>
            <Text style={[S.value, S.bold]}>{data.receiptNumber}</Text>
          </View>
          <View style={S.row}>
            <Text style={S.label}>Data:</Text>
            <Text style={S.value}>{fmtDate(data.paidAt)}</Text>
          </View>
          {data.invoiceNumber ? (
            <View style={S.row}>
              <Text style={S.label}>Factura Ref.:</Text>
              <Text style={S.value}>{data.invoiceNumber}</Text>
            </View>
          ) : null}
        </View>

        <View style={S.divider} />

        {/* Cliente */}
        {data.company ? (
          <View style={S.section}>
            <Text style={S.sectionTitle}>RECEBIDO DE</Text>
            <Text style={S.bold}>{data.company.name}</Text>
            <Text>{data.company.email}</Text>
          </View>
        ) : null}

        {/* Forma de pagamento */}
        <View style={S.section}>
          <Text style={S.sectionTitle}>FORMA DE PAGAMENTO</Text>
          <View style={S.row}>
            <Text style={S.label}>Método:</Text>
            <Text style={S.value}>{METHOD_PT[data.method] ?? data.method}</Text>
          </View>
          {data.reference ? (
            <View style={S.row}>
              <Text style={S.label}>Referência:</Text>
              <Text style={S.value}>{data.reference}</Text>
            </View>
          ) : null}
        </View>

        {/* Valor */}
        <View style={S.amountBox}>
          <Text style={S.amountLabel}>VALOR RECEBIDO</Text>
          <Text style={S.amountValue}>{fmtKz(data.amount)}</Text>
        </View>

        {/* Notas */}
        {data.notes ? (
          <View style={S.notesBox}>
            <Text>{data.notes}</Text>
          </View>
        ) : null}

        {/* Mensagem */}
        <View style={{ marginTop: 28, alignItems: "center" }}>
          <Text style={{ color: GRAY, fontSize: 9 }}>
            Obrigado pela preferência. Azul Coworking agradece a sua confiança.
          </Text>
        </View>

        {/* Rodapé */}
        <View style={S.footer} fixed>
          <Text>{CO_NAME}  |  NIF: {CO_NIF}  |  {CO_ADDR}</Text>
          <Text>Este recibo é válido como comprovativo de pagamento.</Text>
        </View>
      </Page>
    </Document>
  );
}

// ── API Pública ───────────────────────────────────────────────────────────────

/**
 * Gera PDF de factura. Retorna Buffer para upload ao Cloudinary.
 */
export async function generateInvoicePdf(data: InvoicePdfData): Promise<Buffer> {
  return renderToBuffer(<InvoiceDoc data={data} />);
}

/**
 * Gera PDF de recibo. Retorna Buffer para upload ao Cloudinary.
 */
export async function generateReceiptPdf(data: ReceiptPdfData): Promise<Buffer> {
  return renderToBuffer(<ReceiptDoc data={data} />);
}
