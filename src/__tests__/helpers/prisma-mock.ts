/**
 * prisma-mock.ts — Mock tipado do DbClient para testes unitários.
 *
 * Fornece um objecto que implementa a interface DbClient com vi.fn()
 * em todos os métodos relevantes. Permite interceptar chamadas Prisma
 * sem necessitar de base de dados real.
 *
 * Uso:
 *   const db = createPrismaMock();
 *   db.company.findUnique.mockResolvedValue(fixtures.company);
 *   const result = await getCompanyFinanceSummary(db, "id-123");
 */

import { vi } from "vitest";
import type { DbClient } from "@/lib/finance";

// Cria um mock de um model Prisma com os métodos mais comuns
function modelMock() {
  return {
    findUnique:   vi.fn(),
    findFirst:    vi.fn(),
    findMany:     vi.fn(),
    create:       vi.fn(),
    update:       vi.fn(),
    upsert:       vi.fn(),
    delete:       vi.fn(),
    count:        vi.fn(),
    aggregate:    vi.fn(),
    updateMany:   vi.fn(),
    deleteMany:   vi.fn(),
    createMany:   vi.fn(),
  };
}

export function createPrismaMock(): DbClient {
  return {
    company:          modelMock(),
    payment:          modelMock(),
    invoice:          modelMock(),
    invoicePayment:   modelMock(),
    liquidationNote:  modelMock(),
    financialHistory: modelMock(),
    financialAudit:   modelMock(),
    reservation:      modelMock(),
    meetingPlan:      modelMock(),
    lead:             modelMock(),
    roomBookingLead:  modelMock(),
    adminUser:        modelMock(),
    employee:         modelMock(),
    note:             modelMock(),
    deleteRequest:    modelMock(),
    timeline:         modelMock(),
    notification:     modelMock(),
    expense:          modelMock(),
    revenueCategory:  modelMock(),
    roomPricing:      modelMock(),
    roomSettings:     modelMock(),
    documentCounter:  modelMock(),
  } as unknown as DbClient;
}
