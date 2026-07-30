/**
 * fixtures.ts — Dados de teste reutilizáveis (padrão AAA — Arrange).
 *
 * Todos os valores são realistas para o contexto Azul Coworking / Angola.
 * Moeda: AOA (Kz). Datas: fuso Africa/Luanda.
 */

import { AdminRole } from "@prisma/client";

// ── Empresa base ──────────────────────────────────────────────────────────────
export const company = {
  id:              "cmp-001",
  name:            "Empresa Teste Lda",
  nif:             "5001234567",
  responsible:     "João Silva",
  email:           "empresa@teste.ao",
  whatsapp:        "923456789",
  roomNumber:      "101",
  numEmployees:    5,
  planType:        "MENSAL",
  contractStart:   new Date("2026-01-01"),
  contractEnd:     new Date("2026-12-31"),
  rentAmount:      150000,        // 150.000 AOA/mês
  paymentFrequency: "MENSAL",
  contractStatus:  "ATIVO",
  paymentStatus:   "EM_DIA",
  contractFileUrl: null,
  notes:           null,
  leadSourceId:    null,
  createdAt:       new Date("2026-01-01"),
  updatedAt:       new Date("2026-01-01"),
  payments:        [] as Payment[],
  invoices:        [] as Invoice[],
  financialHistory: [] as FinancialHistory[],
};

// ── Pagamentos ────────────────────────────────────────────────────────────────
export type Payment = {
  id: string; companyId: string | null; reservationId: string | null;
  dueDate: Date; paidDate: Date | null; amount: number; status: string;
  notes: string | null; invoiceId: string | null; paymentMethod: string | null;
  receiptUrl: string | null; doc2Url: string | null; category: string | null;
  receiptNumber: string | null; operationRef: string | null;
  previousBalance: number | null; createdAt: Date;
};

export type Invoice = {
  id: string; invoiceNumber: string; companyId: string | null;
  reservationId: string | null; serviceType: string; amount: number;
  discount: number; iva: number; totalAmount: number; amountPaid: number;
  balance: number; paidPercentage: number; issueDate: Date; dueDate: Date;
  paymentMethod: string | null; status: string; receiptUrl: string | null;
  notes: string | null; createdAt: Date; updatedAt: Date;
};

export type FinancialHistory = {
  id: string; companyId: string; type: string; description: string;
  amount: number; runningBalance: number; method: string | null;
  reference: string | null; createdBy: string | null; createdAt: Date;
};

export function makeCoworkPayment(overrides: Partial<Payment> = {}): Payment {
  return {
    id:              "pay-001",
    companyId:       "cmp-001",
    reservationId:   null,
    dueDate:         new Date("2026-01-31"),
    paidDate:        new Date("2026-01-28"),
    amount:          150000,
    status:          "PAGO",
    notes:           "Janeiro 2026",
    invoiceId:       null,
    paymentMethod:   "TRANSFERENCIA",
    receiptUrl:      null,
    doc2Url:         null,
    category:        "COWORK",        // ← categoria coworking
    receiptNumber:   "REC-2026-000001",
    operationRef:    null,
    previousBalance: null,
    createdAt:       new Date("2026-01-28"),
    ...overrides,
  };
}

export function makeSalaPayment(overrides: Partial<Payment> = {}): Payment {
  return {
    id:              "pay-002",
    companyId:       "cmp-001",
    reservationId:   "res-001",
    dueDate:         new Date("2026-02-15"),
    paidDate:        new Date("2026-02-15"),
    amount:          75000,
    status:          "PAGO",
    notes:           "Sala RES-2026-000001",
    invoiceId:       null,
    paymentMethod:   "NUMERARIO",
    receiptUrl:      null,
    doc2Url:         null,
    category:        "SALA_REUNIAO",  // ← categoria sala
    receiptNumber:   "REC-2026-000002",
    operationRef:    null,
    previousBalance: null,
    createdAt:       new Date("2026-02-15"),
    ...overrides,
  };
}

// ── Sessões JWT ───────────────────────────────────────────────────────────────
export const sessions = {
  admin: {
    sub:   "usr-001",
    email: "admin@azulcowork.com",
    name:  "Admin Azul",
    role:  AdminRole.ADMIN,
  },
  comercial: {
    sub:   "usr-002",
    email: "comercial@azulcowork.com",
    name:  "Comercial Azul",
    role:  AdminRole.COMERCIAL,
  },
  financeiro: {
    sub:   "usr-003",
    email: "financeiro@azulcowork.com",
    name:  "Financeiro Azul",
    role:  AdminRole.FINANCEIRO,
  },
  viewer: {
    sub:   "usr-004",
    email: "viewer@azulcowork.com",
    name:  "Viewer Azul",
    role:  AdminRole.VIEWER,
  },
};

// ── Plano de sala ─────────────────────────────────────────────────────────────
export const meetingPlan = {
  id:                   "plan-001",
  name:                 "Sala Premium",
  maxPeople:            20,
  description:          "Sala de reunião premium com projectores",
  coffeeBreakAvailable: true,
  customPricingAllowed: false,
  minHoursForCustom:    16,
  pricePerHour:         15000,
  coffeeBreakPrice:     5000,
  halfDayPrice:         50000,
  fullDayPrice:         90000,
  weekendPrice:         120000,
  promoPrice:           0,
  active:               true,
  createdAt:            new Date("2026-01-01"),
};
