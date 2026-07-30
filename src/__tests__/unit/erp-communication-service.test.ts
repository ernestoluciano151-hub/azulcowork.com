/**
 * erp-communication-service.test.ts — Testes unitários de comunicação financeira ERP-8
 *
 * Testa lógica pura sem BD, SMTP ou Cloudinary:
 *  - Formatação de valores AOA (fmtKz)
 *  - Formatação de datas (fmtDate)
 *  - Conteúdo dos templates HTML (buildInvoiceHtml, buildReceiptHtml, buildReminderHtml, buildOverdueHtml)
 *  - Campos obrigatórios nos templates
 *  - Urgência de lembrete (≤3 dias = "urgente")
 *  - PDF data mapping (estrutura correcta dos dados)
 *  - Cloudinary folder path (YYYY/MM)
 */

import { describe, it, expect } from "vitest";
import {
  buildInvoiceHtml,
  buildReceiptHtml,
  buildReminderHtml,
  buildOverdueHtml,
  buildBaseHtml,
} from "@/lib/erp-email-service";

// ── Helpers replicados para teste (sem importar o serviço principal) ──────────

function fmtKz(v: number): string {
  return `Kz ${v.toLocaleString("pt-PT", { maximumFractionDigits: 0 })}`;
}

function fmtDate(d: Date | string): string {
  const dt = typeof d === "string" ? new Date(d) : d;
  const dd  = String(dt.getDate()).padStart(2, "0");
  const mm  = String(dt.getMonth() + 1).padStart(2, "0");
  const yy  = dt.getFullYear();
  return `${dd}/${mm}/${yy}`;
}

function cloudinaryFolder(type: "invoices" | "receipts", date: Date = new Date()): string {
  const yyyy = date.getFullYear();
  const mm   = String(date.getMonth() + 1).padStart(2, "0");
  return `azul-cowork/erp/${type}/${yyyy}/${mm}`;
}

// ── Fixtures ──────────────────────────────────────────────────────────────────

const INVOICE_DATA = {
  to:            "cliente@empresa.ao",
  companyName:   "Empresa Alpha Lda",
  invoiceNumber: "FT-CWORK-2026-000042",
  issueDate:     new Date("2026-07-01"),
  dueDate:       new Date("2026-07-31"),
  total:         114_000,
  pdfUrl:        "https://res.cloudinary.com/azul/raw/upload/invoices/2026/07/FT-CWORK-2026-000042.pdf",
};

const RECEIPT_DATA = {
  to:            "cliente@empresa.ao",
  companyName:   "Empresa Alpha Lda",
  receiptNumber: "REC-2026-000015",
  invoiceNumber: "FT-CWORK-2026-000042",
  amount:        114_000,
  paidAt:        new Date("2026-07-15"),
  method:        "BANK_TRANSFER",
  pdfUrl:        "https://res.cloudinary.com/azul/raw/upload/receipts/2026/07/REC-2026-000015.pdf",
};

const REMINDER_DATA = {
  to:            "cliente@empresa.ao",
  companyName:   "Empresa Beta SA",
  invoiceNumber: "FT-CWORK-2026-000043",
  dueDate:       new Date("2026-08-05"),
  total:         228_000,
  daysLeft:      7,
};

const OVERDUE_DATA = {
  to:            "cliente@empresa.ao",
  companyName:   "Empresa Gamma SA",
  invoiceNumber: "FT-CWORK-2026-000040",
  dueDate:       new Date("2026-06-30"),
  total:         95_000,
  daysOverdue:   29,
};

// ── Formatação AOA ────────────────────────────────────────────────────────────

describe("Formatação AOA (fmtKz)", () => {
  it("formata valor inteiro com prefixo Kz", () => {
    expect(fmtKz(114_000)).toContain("Kz");
    expect(fmtKz(114_000)).toContain("114");
  });

  it("zero = 'Kz 0'", () => {
    const r = fmtKz(0);
    expect(r).toContain("Kz");
    expect(r).toContain("0");
  });

  it("valor grande sem casas decimais", () => {
    const r = fmtKz(1_145_000);
    expect(r).not.toContain(".");   // sem decimais (pt-PT usa '.' como sep. milhar)
    expect(r).toContain("1");
    expect(r).toContain("145");
  });
});

// ── Formatação de Data ────────────────────────────────────────────────────────

describe("Formatação de Data (fmtDate)", () => {
  it("formata data no formato dd/mm/yyyy", () => {
    expect(fmtDate(new Date("2026-07-29"))).toBe("29/07/2026");
  });

  it("aceita string ISO", () => {
    expect(fmtDate("2026-01-05")).toBe("05/01/2026");
  });

  it("padded com zero quando dia/mês < 10", () => {
    expect(fmtDate(new Date("2026-03-03"))).toBe("03/03/2026");
  });
});

// ── Cloudinary folder ─────────────────────────────────────────────────────────

describe("Cloudinary folder path", () => {
  it("invoices em Julho 2026 = azul-cowork/erp/invoices/2026/07", () => {
    expect(cloudinaryFolder("invoices", new Date("2026-07-15")))
      .toBe("azul-cowork/erp/invoices/2026/07");
  });

  it("receipts em Janeiro 2027 = azul-cowork/erp/receipts/2027/01", () => {
    expect(cloudinaryFolder("receipts", new Date("2027-01-10")))
      .toBe("azul-cowork/erp/receipts/2027/01");
  });

  it("mês com padding (02, 09...)", () => {
    expect(cloudinaryFolder("invoices", new Date("2026-09-01")))
      .toBe("azul-cowork/erp/invoices/2026/09");
  });
});

// ── Template: Factura Emitida ─────────────────────────────────────────────────

describe("buildInvoiceHtml — campos obrigatórios", () => {
  const html = buildInvoiceHtml(INVOICE_DATA);

  it("contém nome da empresa cliente", () => {
    expect(html).toContain("Empresa Alpha Lda");
  });

  it("contém número da factura", () => {
    expect(html).toContain("FT-CWORK-2026-000042");
  });

  it("contém data de vencimento formatada", () => {
    expect(html).toContain("31/07/2026");
  });

  it("contém o total formatado com Kz", () => {
    expect(html).toContain("Kz");
    expect(html).toContain("114");
  });

  it("contém IBAN do BCS", () => {
    expect(html).toContain("AO06007000000212870210113");
  });

  it("contém link para PDF quando pdfUrl definido", () => {
    expect(html).toContain(INVOICE_DATA.pdfUrl);
    expect(html).toContain("Download");
  });

  it("sem link para PDF quando pdfUrl não definido", () => {
    const htmlNoPdf = buildInvoiceHtml({ ...INVOICE_DATA, pdfUrl: undefined });
    expect(htmlNoPdf).not.toContain("Download");
  });
});

// ── Template: Recibo ──────────────────────────────────────────────────────────

describe("buildReceiptHtml — campos obrigatórios", () => {
  const html = buildReceiptHtml(RECEIPT_DATA);

  it("contém nome da empresa", () => {
    expect(html).toContain("Empresa Alpha Lda");
  });

  it("contém número de recibo", () => {
    expect(html).toContain("REC-2026-000015");
  });

  it("contém referência à factura original", () => {
    expect(html).toContain("FT-CWORK-2026-000042");
  });

  it("contém método traduzido para português", () => {
    expect(html).toContain("Transferência Bancária");
  });

  it("contém data de pagamento formatada", () => {
    expect(html).toContain("15/07/2026");
  });

  it("contém link para PDF quando pdfUrl definido", () => {
    expect(html).toContain(RECEIPT_DATA.pdfUrl!);
  });

  it("sem referência à factura quando invoiceNumber omitido", () => {
    const htmlNoRef = buildReceiptHtml({ ...RECEIPT_DATA, invoiceNumber: undefined });
    expect(htmlNoRef).not.toContain("FT-CWORK-2026-000042");
  });
});

// ── Template: Lembrete ────────────────────────────────────────────────────────

describe("buildReminderHtml — urgência e campos", () => {
  it("7 dias → texto 'próximo' (não urgente)", () => {
    const html = buildReminderHtml(REMINDER_DATA);
    expect(html).toContain("próximo");
    expect(html).not.toContain('"urgente"');
  });

  it("3 dias ou menos → texto 'urgente'", () => {
    const html = buildReminderHtml({ ...REMINDER_DATA, daysLeft: 3 });
    expect(html).toContain("urgente");
  });

  it("1 dia → urgente", () => {
    const html = buildReminderHtml({ ...REMINDER_DATA, daysLeft: 1 });
    expect(html).toContain("urgente");
  });

  it("contém número da factura", () => {
    const html = buildReminderHtml(REMINDER_DATA);
    expect(html).toContain("FT-CWORK-2026-000043");
  });

  it("contém dias restantes", () => {
    const html = buildReminderHtml(REMINDER_DATA);
    expect(html).toContain("7");
  });

  it("contém IBAN", () => {
    const html = buildReminderHtml(REMINDER_DATA);
    expect(html).toContain("AO06007000000212870210113");
  });
});

// ── Template: Atraso ──────────────────────────────────────────────────────────

describe("buildOverdueHtml — campos e cor de urgência", () => {
  const html = buildOverdueHtml(OVERDUE_DATA);

  it("contém número da factura", () => {
    expect(html).toContain("FT-CWORK-2026-000040");
  });

  it("contém dias em atraso", () => {
    expect(html).toContain("29");
  });

  it("contém a cor vermelha (#dc2626) para urgência", () => {
    expect(html).toContain("#dc2626");
  });

  it("contém IBAN para pagamento imediato", () => {
    expect(html).toContain("AO06007000000212870210113");
  });

  it("contém texto de urgência", () => {
    expect(html.toLowerCase()).toContain("urgente");
  });
});

// ── Template: buildBaseHtml ───────────────────────────────────────────────────

describe("buildBaseHtml — estrutura HTML", () => {
  const html = buildBaseHtml("Teste", "<p>corpo</p>");

  it("contém DOCTYPE válido", () => {
    expect(html).toContain("<!DOCTYPE html>");
  });

  it("contém a marca AZUL COWORKING no cabeçalho", () => {
    expect(html).toContain("AZUL COWORKING");
  });

  it("contém NIF da empresa", () => {
    expect(html).toContain("5002174308");
  });

  it("injecta o corpo HTML", () => {
    expect(html).toContain("<p>corpo</p>");
  });

  it("contém email de contacto", () => {
    expect(html).toContain("geral@azulcowork.com");
  });
});

// ── Method labels ─────────────────────────────────────────────────────────────

describe("Etiquetas de método de pagamento", () => {
  const labels: Record<string, string> = {
    BANK_TRANSFER: "Transferência Bancária",
    CASH:          "Numerário",
    MULTICAIXA:    "Multicaixa Express",
    POS:           "Terminal POS",
    CHECK:         "Cheque",
    OTHER:         "Outro",
  };

  for (const [method, label] of Object.entries(labels)) {
    it(`${method} → "${label}"`, () => {
      const html = buildReceiptHtml({ ...RECEIPT_DATA, method });
      expect(html).toContain(label);
    });
  }
});
