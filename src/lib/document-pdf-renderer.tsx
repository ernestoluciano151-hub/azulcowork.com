/**
 * document-pdf-renderer.tsx — Componentes React-PDF para Gestão Documental (VOL08)
 *
 * Exporta:
 *   renderProposalPdf(data)  → Buffer  — Proposta comercial
 *   renderContractPdf(data)  → Buffer  — Contrato de alocação
 *
 * Motor: @react-pdf/renderer (já instalado — VOL02/ERP)
 * Output: Buffer em memória — sem escrita em disco
 *
 * Padrão: segue erp-pdf-service.tsx (mesma identidade visual Azul Coworking)
 * Docs: docs/11-gestao-documental/README.md · ADR-038
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

// ── Identidade Azul Coworking ──────────────────────────────────────────────────

const CO_NAME   = "VERSÃO DE NEGÓCIOS - COMÉRCIO GERAL E PRESTAÇÃO DE SERVIÇOS, LDA";
const CO_BRAND  = "AZUL COWORKING";
const CO_NIF    = "5002174308";
const CO_ADDR   = "Bairro Azul, Edifício 18, Luanda, Angola";
const CO_EMAIL  = "geral@azulcowork.com";
const CO_PHONE  = "+244 976 467 124";
const CO_WEB    = "www.azulcowork.com";
const BANK_IBAN = "AO06007000000212870210113";
const BANK_NAME = "BCS";
const BANK_SWIFT = "CDTSAOLU";

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtDate(d: Date | string | undefined): string {
  if (!d) return "—";
  const dt = typeof d === "string" ? new Date(d) : d;
  if (isNaN(dt.getTime())) return String(d);
  return `${String(dt.getDate()).padStart(2,"0")}/${String(dt.getMonth()+1).padStart(2,"0")}/${dt.getFullYear()}`;
}

function fmtKz(v: number | string | undefined): string {
  if (!v && v !== 0) return "—";
  const n = typeof v === "string" ? parseFloat(v.replace(/[^0-9.]/g, "")) : v;
  if (isNaN(n)) return String(v);
  return `Kz ${n.toLocaleString("pt-PT", { maximumFractionDigits: 0 })}`;
}

// ── Estilos partilhados ───────────────────────────────────────────────────────

const BLUE   = "#1e4d91";
const BLUE_L = "#f0f4ff";
const GRAY   = "#666666";
const LINE   = "#dddddd";
const WHITE  = "#ffffff";

const S = StyleSheet.create({
  page:         { padding: 40, fontFamily: "Helvetica", fontSize: 9, color: "#222", lineHeight: 1.4 },
  // Cabeçalho
  headerRow:    { flexDirection: "row", borderBottomWidth: 2, borderBottomColor: BLUE, paddingBottom: 10, marginBottom: 16 },
  brand:        { fontSize: 18, fontFamily: "Helvetica-Bold", color: BLUE, marginBottom: 2 },
  coMeta:       { fontSize: 7, color: GRAY, marginBottom: 1 },
  docTitle:     { fontSize: 13, fontFamily: "Helvetica-Bold", color: BLUE, textAlign: "right" },
  docMeta:      { fontSize: 7.5, color: GRAY, textAlign: "right", marginTop: 2 },
  // Blocos
  boxBlue:      { backgroundColor: BLUE_L, padding: 10, marginBottom: 12 },
  boxGray:      { backgroundColor: "#f9f9f9", padding: 10, marginBottom: 12 },
  boxLabel:     { fontFamily: "Helvetica-Bold", color: BLUE, fontSize: 8, marginBottom: 5 },
  row:          { flexDirection: "row", marginBottom: 2 },
  col2:         { flex: 1 },
  // Secções
  sectionTitle: { fontFamily: "Helvetica-Bold", fontSize: 9, color: BLUE,
                  borderBottomWidth: 1, borderBottomColor: LINE,
                  paddingBottom: 3, marginBottom: 6, marginTop: 12 },
  // Tabelas
  tHead:        { flexDirection: "row", backgroundColor: BLUE,
                  paddingVertical: 5, paddingHorizontal: 6,
                  fontFamily: "Helvetica-Bold", fontSize: 8, color: WHITE },
  tRow:         { flexDirection: "row", paddingVertical: 5, paddingHorizontal: 6,
                  borderBottomColor: LINE, borderBottomWidth: 1 },
  tRowAlt:      { flexDirection: "row", paddingVertical: 5, paddingHorizontal: 6,
                  backgroundColor: BLUE_L,
                  borderBottomColor: LINE, borderBottomWidth: 1 },
  // Texto
  bold:         { fontFamily: "Helvetica-Bold" },
  small:        { fontSize: 7.5, color: GRAY },
  // Assinatura
  sigLine:      { borderTopWidth: 1, borderTopColor: "#333", paddingTop: 6,
                  textAlign: "center", fontSize: 8, width: "45%" },
  footer:       { fontSize: 7, color: "#aaa", textAlign: "center",
                  borderTopWidth: 1, borderTopColor: LINE,
                  paddingTop: 6, marginTop: 20 },
});

// ═══════════════════════════════════════════════════════════════════════════════
// PROPOSTA COMERCIAL
// ═══════════════════════════════════════════════════════════════════════════════

export type ProposalData = {
  // Identificação
  numeroDocumento: string;
  dataDocumento:   string;
  dataValidade:    string;
  // Cliente
  nomeEmpresa:     string;
  nifEmpresa?:     string;
  moradaEmpresa?:  string;
  nomeContacto:    string;
  emailContacto?:  string;
  telefoneContacto?: string;
  // Plano
  planoDescricao:  string;
  valorMensal:     number | string;
  duracao?:        string;
  dataInicio?:     string;
  // Comercial
  nomeComercial?:  string;
  observacoes?:    string;
};

function ProposalPdfDocument({ d }: { d: ProposalData }) {
  return (
    <Document title={`Proposta ${d.numeroDocumento}`} author={CO_BRAND} creator="VD Platform">
      <Page size="A4" style={S.page}>

        {/* Cabeçalho */}
        <View style={S.headerRow}>
          <View style={{ flex: 1 }}>
            <Text style={S.brand}>{CO_BRAND}</Text>
            <Text style={S.coMeta}>{CO_NAME}</Text>
            <Text style={S.coMeta}>NIF: {CO_NIF} | {CO_ADDR}</Text>
            <Text style={S.coMeta}>Tel: {CO_PHONE} | {CO_EMAIL} | {CO_WEB}</Text>
          </View>
          <View style={{ width: 160, paddingLeft: 12 }}>
            <Text style={S.docTitle}>PROPOSTA COMERCIAL</Text>
            <Text style={S.docMeta}>Nº: {d.numeroDocumento}</Text>
            <Text style={S.docMeta}>Data: {fmtDate(d.dataDocumento)}</Text>
            <Text style={S.docMeta}>Válida até: {fmtDate(d.dataValidade)}</Text>
          </View>
        </View>

        {/* Destinatário + Comercial */}
        <View style={S.row}>
          <View style={[S.boxBlue, { flex: 1, marginRight: 8 }]}>
            <Text style={S.boxLabel}>DESTINATÁRIO</Text>
            <Text style={S.bold}>{d.nomeEmpresa}</Text>
            {d.nifEmpresa     && <Text>NIF: {d.nifEmpresa}</Text>}
            {d.moradaEmpresa  && <Text>{d.moradaEmpresa}</Text>}
            <Text>Atenção: {d.nomeContacto}</Text>
            {d.emailContacto      && <Text>{d.emailContacto}</Text>}
            {d.telefoneContacto   && <Text>{d.telefoneContacto}</Text>}
          </View>
          <View style={[S.boxGray, { flex: 1, marginLeft: 8 }]}>
            <Text style={S.boxLabel}>COMERCIAL RESPONSÁVEL</Text>
            <Text style={S.bold}>{d.nomeComercial ?? "Equipa Comercial"}</Text>
            <Text>{CO_EMAIL}</Text>
            <Text>{CO_PHONE}</Text>
          </View>
        </View>

        {/* Serviço */}
        <Text style={S.sectionTitle}>DESCRIÇÃO DO SERVIÇO</Text>
        <View style={S.tHead}>
          <Text style={{ flex: 3 }}>Plano</Text>
          <Text style={{ flex: 1, textAlign: "center" }}>Duração</Text>
          <Text style={{ flex: 1, textAlign: "right" }}>Valor Mensal</Text>
        </View>
        <View style={S.tRow}>
          <Text style={{ flex: 3 }}>{d.planoDescricao}</Text>
          <Text style={{ flex: 1, textAlign: "center" }}>{d.duracao ?? "—"}</Text>
          <Text style={[{ flex: 1, textAlign: "right" }, S.bold]}>{fmtKz(d.valorMensal)}</Text>
        </View>

        {d.dataInicio && (
          <Text style={{ marginTop: 6, fontSize: 8 }}>
            <Text style={S.bold}>Data de início prevista: </Text>{fmtDate(d.dataInicio)}
          </Text>
        )}

        {/* Incluído */}
        <Text style={S.sectionTitle}>O QUE ESTÁ INCLUÍDO</Text>
        <View style={S.boxBlue}>
          {[
            "Espaço de trabalho partilhado no Bairro Azul, Edifício 18",
            "Internet de alta velocidade (fibra óptica)",
            "Acesso a salas de reunião (mediante reserva)",
            "Recepção e morada comercial",
            "Café e ambiente profissional",
          ].map((item, i) => (
            <View key={i} style={{ flexDirection: "row", marginBottom: 2 }}>
              <Text style={{ marginRight: 6, color: BLUE }}>•</Text>
              <Text>{item}</Text>
            </View>
          ))}
        </View>

        {/* Pagamento */}
        <Text style={S.sectionTitle}>CONDIÇÕES DE PAGAMENTO</Text>
        <Text style={{ marginBottom: 3 }}>Pagamento mensal antecipado, vencível no dia 1 de cada mês.</Text>
        <Text style={S.small}>IBAN: {BANK_IBAN} ({BANK_NAME}) | SWIFT: {BANK_SWIFT}</Text>

        {/* Observações */}
        {d.observacoes && (
          <>
            <Text style={S.sectionTitle}>OBSERVAÇÕES</Text>
            <Text>{d.observacoes}</Text>
          </>
        )}

        {/* Rodapé */}
        <Text style={S.footer}>
          Esta proposta é válida até {fmtDate(d.dataValidade)}.{"\n"}
          Para aceitar, responda a este email ou contacte o seu comercial.{"\n"}
          {CO_BRAND} | {CO_ADDR} | {CO_EMAIL}
        </Text>

      </Page>
    </Document>
  );
}

/**
 * Gera o buffer PDF de uma proposta comercial.
 * Sem escrita em disco — retorna Buffer directamente.
 */
export async function renderProposalPdf(data: ProposalData): Promise<Buffer> {
  return renderToBuffer(<ProposalPdfDocument d={data} />);
}

// ═══════════════════════════════════════════════════════════════════════════════
// CONTRATO DE ALOCAÇÃO
// ═══════════════════════════════════════════════════════════════════════════════

export type ContractData = {
  // Identificação
  numeroContrato:       string;
  dataDocumento:        string;
  // Empresa cliente
  nomeEmpresa:          string;
  nifEmpresa?:          string;
  moradaEmpresa?:       string;
  representanteLegal:   string;
  cargoRepresentante?:  string;
  // Plano
  planoDescricao:       string;
  valorMensal:          number | string;
  dataInicio:           string;
  dataFim?:             string;
  duracao?:             string;
  depositoGarantia?:    number | string;
  formaPagamento?:      string;
  diaVencimento?:       number | string;
  renovacaoAutomatica?: string;
  // Extra
  clausulasEspeciais?:  string;
};

function ContractPdfDocument({ d }: { d: ContractData }) {
  return (
    <Document title={`Contrato ${d.numeroContrato}`} author={CO_BRAND} creator="VD Platform">
      <Page size="A4" style={S.page}>

        {/* Cabeçalho */}
        <View style={S.headerRow}>
          <View style={{ flex: 1 }}>
            <Text style={S.brand}>{CO_BRAND}</Text>
            <Text style={S.coMeta}>{CO_NAME}</Text>
            <Text style={S.coMeta}>NIF: {CO_NIF} | {CO_ADDR}</Text>
          </View>
          <View style={{ width: 160, paddingLeft: 12 }}>
            <Text style={S.docTitle}>CONTRATO DE ALOCAÇÃO</Text>
            <Text style={S.docMeta}>Nº: {d.numeroContrato}</Text>
            <Text style={S.docMeta}>Data: {fmtDate(d.dataDocumento)}</Text>
          </View>
        </View>

        {/* Título */}
        <Text style={{ textAlign: "center", fontFamily: "Helvetica-Bold", fontSize: 11, marginBottom: 12 }}>
          CONTRATO DE PRESTAÇÃO DE SERVIÇOS DE COWORKING
        </Text>
        <Text style={{ marginBottom: 10, fontSize: 9 }}>
          Entre as partes abaixo identificadas, é celebrado o presente Contrato de Prestação de Serviços de Coworking,
          que se rege pelas cláusulas seguintes:
        </Text>

        {/* Partes */}
        <View style={S.row}>
          <View style={[S.boxBlue, { flex: 1, marginRight: 8 }]}>
            <Text style={S.boxLabel}>PRIMEIRA PARTE (PRESTADOR)</Text>
            <Text style={S.bold}>{CO_NAME}</Text>
            <Text>NIF: {CO_NIF}</Text>
            <Text>{CO_ADDR}</Text>
            <Text style={{ marginTop: 4, color: BLUE }}>Doravante: <Text style={S.bold}>"AZUL COWORKING"</Text></Text>
          </View>
          <View style={[S.boxGray, { flex: 1, marginLeft: 8 }]}>
            <Text style={S.boxLabel}>SEGUNDA PARTE (CLIENTE)</Text>
            <Text style={S.bold}>{d.nomeEmpresa}</Text>
            {d.nifEmpresa      && <Text>NIF: {d.nifEmpresa}</Text>}
            {d.moradaEmpresa   && <Text>{d.moradaEmpresa}</Text>}
            <Text>Repr.: {d.representanteLegal}{d.cargoRepresentante ? `, ${d.cargoRepresentante}` : ""}</Text>
            <Text style={{ marginTop: 4, color: BLUE }}>Doravante: <Text style={S.bold}>"CLIENTE"</Text></Text>
          </View>
        </View>

        {/* Cláusulas */}
        <Text style={S.sectionTitle}>CLÁUSULA 1.ª — OBJECTO</Text>
        <Text style={{ marginBottom: 8 }}>
          O AZUL COWORKING compromete-se a prestar ao CLIENTE serviços de espaço de trabalho partilhado
          (coworking), incluindo acesso às instalações, internet de alta velocidade, recepção e serviços
          associados, conforme o plano: <Text style={S.bold}>{d.planoDescricao}</Text>.
        </Text>

        <Text style={S.sectionTitle}>CLÁUSULA 2.ª — PRAZO</Text>
        <Text style={{ marginBottom: 8 }}>
          O presente contrato tem início em <Text style={S.bold}>{fmtDate(d.dataInicio)}</Text>
          {d.dataFim ? ` e término em ${fmtDate(d.dataFim)}` : ""}
          {d.duracao ? `, com duração de ${d.duracao}` : ""}.
          {"\n"}Renovação automática: <Text style={S.bold}>{d.renovacaoAutomatica ?? "Não"}</Text> (aviso prévio de 30 dias).
        </Text>

        <Text style={S.sectionTitle}>CLÁUSULA 3.ª — VALOR E PAGAMENTO</Text>
        <Text style={{ marginBottom: 3 }}>
          Valor mensal: <Text style={S.bold}>{fmtKz(d.valorMensal)}</Text>,
          pago por <Text style={S.bold}>{d.formaPagamento ?? "transferência bancária"}</Text>,
          vencível no dia <Text style={S.bold}>{d.diaVencimento ?? "1"}</Text> de cada mês.
        </Text>
        {d.depositoGarantia && (
          <Text style={{ marginBottom: 3 }}>
            Depósito de garantia: <Text style={S.bold}>{fmtKz(d.depositoGarantia)}</Text> (reembolsável no término, se sem débitos).
          </Text>
        )}
        <Text style={S.small}>IBAN: {BANK_IBAN} ({BANK_NAME}) | SWIFT: {BANK_SWIFT}</Text>

        <Text style={S.sectionTitle}>CLÁUSULA 4.ª — OBRIGAÇÕES DO CLIENTE</Text>
        <Text style={{ marginBottom: 8 }}>
          O CLIENTE obriga-se a: (a) utilizar as instalações de forma adequada e respeitosa;
          (b) cumprir o regulamento interno do AZUL COWORKING; (c) efectuar os pagamentos nas datas acordadas;
          (d) comunicar com antecedência mínima de 30 dias a intenção de não renovar.
        </Text>

        <Text style={S.sectionTitle}>CLÁUSULA 5.ª — RESOLUÇÃO</Text>
        <Text style={{ marginBottom: 8 }}>
          O contrato pode ser resolvido por incumprimento grave de qualquer das partes, com aviso prévio de 15 dias.
          O atraso de pagamento superior a 30 dias constitui justa causa de resolução imediata.
        </Text>

        {/* Cláusulas especiais */}
        {d.clausulasEspeciais && (
          <>
            <Text style={S.sectionTitle}>CLÁUSULAS ESPECIAIS</Text>
            <Text style={{ marginBottom: 8 }}>{d.clausulasEspeciais}</Text>
          </>
        )}

        {/* Assinaturas */}
        <View style={[S.row, { marginTop: 24, justifyContent: "space-between" }]}>
          <View style={S.sigLine}>
            <Text style={S.bold}>AZUL COWORKING</Text>
            <Text style={S.small}>Data: {fmtDate(d.dataDocumento)}</Text>
          </View>
          <View style={S.sigLine}>
            <Text style={S.bold}>{d.nomeEmpresa}</Text>
            <Text style={S.small}>{d.representanteLegal}</Text>
            <Text style={S.small}>Data: ___/___/______</Text>
          </View>
        </View>

        {/* Rodapé */}
        <Text style={S.footer}>
          Contrato Nº {d.numeroContrato} | Gerado em {fmtDate(d.dataDocumento)} pelo Sistema VD Platform | {CO_BRAND}
        </Text>

      </Page>
    </Document>
  );
}

/**
 * Gera o buffer PDF de um contrato de alocação.
 * Sem escrita em disco — retorna Buffer directamente.
 */
export async function renderContractPdf(data: ContractData): Promise<Buffer> {
  return renderToBuffer(<ContractPdfDocument d={data} />);
}
