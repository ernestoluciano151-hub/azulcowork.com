/**
 * erp-invoice-generate-service.test.ts
 *
 * Testes unitários da lógica de geração automática de faturas mensais.
 *
 * Estratégia: mock completo do prisma e dos serviços dependentes.
 * Foca nos invariantes de negócio:
 *  - Apenas schedules PENDING com dueDate ≤ agora são processados
 *  - Idempotência: schedule com invoiceId existente → status "skipped"
 *  - Erro isolado: falha num schedule não afecta os restantes
 *  - Transacção: invoice criado e schedule actualizado juntos
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ── Mocks ─────────────────────────────────────────────────────────────────────

// Mock do módulo Prisma
vi.mock("@/lib/prisma", () => ({
  prisma: {
    erpRentSchedule: {
      findMany: vi.fn(),
      update:   vi.fn(),
    },
    erpInvoice: {
      findUnique: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

// Mock do erp-billing-service
vi.mock("@/lib/erp-billing-service", () => ({
  createErpInvoice:   vi.fn(),
  issueErpInvoice:    vi.fn(),
  calculateIvaTotals: vi.fn((amount: number) => ({
    subtotal:  Math.round(amount),
    taxRate:   0.14,
    taxAmount: Math.round(Math.round(amount) * 0.14),
    total:     Math.round(amount) + Math.round(Math.round(amount) * 0.14),
  })),
  IVA_RATE: 0.14,
}));

// Mock do communication-service
vi.mock("@/lib/communication-service", () => ({
  sendEmail: vi.fn().mockResolvedValue({ success: true }),
}));

// Mock do bootstrap (sem efeitos laterais)
vi.mock("@/lib/bootstrap", () => ({}));

// Mock de @prisma/client
vi.mock("@prisma/client", () => ({
  ErpInvoiceType:     { COWORKING: "COWORKING" },
  ErpInvoiceStatus:   { DRAFT: "DRAFT", ISSUED: "ISSUED" },
  RentScheduleStatus: { PENDING: "PENDING", INVOICED: "INVOICED" },
}));

// ── Importações após mocks ────────────────────────────────────────────────────

import { prisma }                     from "@/lib/prisma";
import { issueErpInvoice }            from "@/lib/erp-billing-service";
import { generateMonthlyInvoices }    from "@/lib/erp-invoice-generate-service";

// ── Fixtures ──────────────────────────────────────────────────────────────────

const NOW = new Date("2026-07-30T07:00:00Z");

function makeSchedule(overrides: Partial<{
  id:          string;
  companyId:   string;
  contractId:  string;
  invoiceId:   string | null;
  amount:      number;
  dueDate:     Date;
  status:      string;
  companyName: string;
}> = {}) {
  return {
    id:         overrides.id        ?? "sched-001",
    companyId:  overrides.companyId ?? "company-001",
    contractId: overrides.contractId ?? "contract-001",
    invoiceId:  overrides.invoiceId  ?? null,
    amount:     overrides.amount     ?? 50000,
    dueDate:    overrides.dueDate    ?? new Date("2026-07-01T00:00:00Z"),
    status:     overrides.status     ?? "PENDING",
    company: {
      id:           overrides.companyId ?? "company-001",
      name:         overrides.companyName ?? "Tech Lda",
      billingEmail: "billing@tech.ao",
      email:        "geral@tech.ao",
    },
    contract: {
      id:       overrides.contractId ?? "contract-001",
      planName: "Hot Desk",
    },
  };
}

// ── Setup ─────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
});

afterEach(() => {
  vi.useRealTimers();
  vi.clearAllMocks();
});

// ── Testes ────────────────────────────────────────────────────────────────────

describe("generateMonthlyInvoices", () => {

  it("retorna [] quando não há schedules pendentes", async () => {
    vi.mocked(prisma.erpRentSchedule.findMany).mockResolvedValue([]);

    const results = await generateMonthlyInvoices();

    expect(results).toHaveLength(0);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("ignora (skipped) schedule que já tem invoiceId — idempotência", async () => {
    const schedule = makeSchedule({ invoiceId: "existing-invoice-id" });
    vi.mocked(prisma.erpRentSchedule.findMany).mockResolvedValue([schedule as never]);

    const results = await generateMonthlyInvoices();

    expect(results).toHaveLength(1);
    expect(results[0]!.status).toBe("skipped");
    expect(results[0]!.invoiceId).toBe("existing-invoice-id");
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("gera fatura para schedule PENDING vencido", async () => {
    const schedule = makeSchedule({ amount: 50000 });
    vi.mocked(prisma.erpRentSchedule.findMany).mockResolvedValue([schedule as never]);

    // Mock da $transaction: simula criação de invoice e update de schedule
    const fakeInvoice = { id: "invoice-001", number: "DRAFT-CRON-123", total: 57000 };
    vi.mocked(prisma.$transaction).mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
      const mockTx = {
        erpInvoice: {
          create: vi.fn().mockResolvedValue(fakeInvoice),
        },
        erpRentSchedule: {
          update: vi.fn().mockResolvedValue({ ...schedule, status: "INVOICED", invoiceId: fakeInvoice.id }),
        },
      };
      return fn(mockTx);
    });

    vi.mocked(prisma.erpInvoice.findUnique).mockResolvedValue({
      number:  "FT-CWORK-2026-000001",
      total:   57000,
      dueDate: new Date("2026-07-31T00:00:00Z"),
    } as never);

    const results = await generateMonthlyInvoices();

    expect(results).toHaveLength(1);
    expect(results[0]!.status).toBe("generated");
    expect(results[0]!.invoiceId).toBe("invoice-001");
    expect(results[0]!.companyName).toBe("Tech Lda");
    expect(results[0]!.amount).toBe(50000);
  });

  it("processa múltiplos schedules de empresas diferentes", async () => {
    const s1 = makeSchedule({ id: "sched-1", companyId: "co-1", amount: 50000, companyName: "Alpha Lda" });
    const s2 = makeSchedule({ id: "sched-2", companyId: "co-2", amount: 75000, companyName: "Beta SA" });

    vi.mocked(prisma.erpRentSchedule.findMany).mockResolvedValue([s1, s2] as never);

    let callCount = 0;
    vi.mocked(prisma.$transaction).mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
      callCount++;
      const invId = `invoice-${callCount}`;
      const mockTx = {
        erpInvoice:      { create: vi.fn().mockResolvedValue({ id: invId, number: `DRAFT-${callCount}` }) },
        erpRentSchedule: { update: vi.fn().mockResolvedValue({}) },
      };
      return fn(mockTx);
    });

    vi.mocked(prisma.erpInvoice.findUnique).mockResolvedValue({
      number: "FT-CWORK-2026-000001", total: 57000, dueDate: new Date(),
    } as never);

    const results = await generateMonthlyInvoices();

    expect(results).toHaveLength(2);
    expect(results.every(r => r.status === "generated")).toBe(true);
    expect(prisma.$transaction).toHaveBeenCalledTimes(2);
  });

  it("isola erro: falha num schedule não impede os restantes", async () => {
    const s1 = makeSchedule({ id: "sched-ok", companyId: "co-ok" });
    const s2 = makeSchedule({ id: "sched-fail", companyId: "co-fail", amount: 99999 });

    vi.mocked(prisma.erpRentSchedule.findMany).mockResolvedValue([s1, s2] as never);

    let callCount = 0;
    vi.mocked(prisma.$transaction).mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
      callCount++;
      if (callCount === 1) {
        // primeiro schedule OK
        const mockTx = {
          erpInvoice:      { create: vi.fn().mockResolvedValue({ id: "invoice-ok" }) },
          erpRentSchedule: { update: vi.fn().mockResolvedValue({}) },
        };
        return fn(mockTx);
      }
      // segundo schedule falha
      throw new Error("DB constraint error");
    });

    vi.mocked(prisma.erpInvoice.findUnique).mockResolvedValue({
      number: "FT-CWORK-2026-000001", total: 57000, dueDate: new Date(),
    } as never);

    const results = await generateMonthlyInvoices();

    expect(results).toHaveLength(2);
    const ok   = results.find(r => r.scheduleId === "sched-ok");
    const fail = results.find(r => r.scheduleId === "sched-fail");

    expect(ok!.status).toBe("generated");
    expect(fail!.status).toBe("error");
    expect(fail!.error).toBe("DB constraint error");
  });

  it("não chama issueErpInvoice se a $transaction falhar", async () => {
    const schedule = makeSchedule();
    vi.mocked(prisma.erpRentSchedule.findMany).mockResolvedValue([schedule as never]);
    vi.mocked(prisma.$transaction).mockRejectedValue(new Error("tx failed"));

    const results = await generateMonthlyInvoices();

    expect(results[0]!.status).toBe("error");
    // issueErpInvoice é fire-and-forget após tx sucesso — nunca é chamado aqui
    expect(issueErpInvoice).not.toHaveBeenCalled();
  });

  it("processa combinação: skipped + generated + error", async () => {
    const skipped  = makeSchedule({ id: "s1", invoiceId: "existing-inv" });
    const toGen    = makeSchedule({ id: "s2", amount: 60000 });
    const toFail   = makeSchedule({ id: "s3", amount: 80000 });

    vi.mocked(prisma.erpRentSchedule.findMany).mockResolvedValue([skipped, toGen, toFail] as never);

    let txCount = 0;
    vi.mocked(prisma.$transaction).mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
      txCount++;
      if (txCount === 1) {
        const mockTx = {
          erpInvoice:      { create: vi.fn().mockResolvedValue({ id: "inv-gen" }) },
          erpRentSchedule: { update: vi.fn().mockResolvedValue({}) },
        };
        return fn(mockTx);
      }
      throw new Error("Falha");
    });

    vi.mocked(prisma.erpInvoice.findUnique).mockResolvedValue({
      number: "FT-CWORK-2026-000001", total: 68400, dueDate: new Date(),
    } as never);

    const results = await generateMonthlyInvoices();

    expect(results).toHaveLength(3);
    expect(results.find(r => r.scheduleId === "s1")!.status).toBe("skipped");
    expect(results.find(r => r.scheduleId === "s2")!.status).toBe("generated");
    expect(results.find(r => r.scheduleId === "s3")!.status).toBe("error");
  });

});
