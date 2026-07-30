# Estratégia de Testes — VD Platform

> **Documento:** P0-003  
> **Fase:** P0 — Estabilização da Plataforma  
> **Estado:** ✅ Aprovado  
> **Data:** Julho 2026  

---

## 1. Filosofia

> *Testes não são burocracia — são a rede de segurança que nos permite refactorizar, evoluir e corrigir com confiança. No VD Platform, um teste que falha é um bug apanhado antes de chegar ao cliente.*

A estratégia de testes do VD Platform segue três princípios:

1. **Testar onde a falha dói mais** — `FinanceService`, `PricingService` e lógica de segurança são os módulos com maior impacto se falharem. Têm prioridade máxima.
2. **Testes como documentação** — um teste bem escrito descreve o comportamento esperado melhor do que um comentário. O nome do teste é a especificação.
3. **Velocidade sustentável** — a suite de testes deve correr em < 30 segundos. Testes lentos não são executados, e não executados é como não existir.

---

## 2. Pirâmide de Testes

```
                    ╔═══════════╗
                    ║  E2E (0)  ║   ← Fase 2+ (Playwright)
                   ╔═══════════════╗
                   ║ Integração(5) ║  ← Fase 1 (API Routes com DB real)
                  ╔═════════════════════╗
                  ║   Unitários (70%)   ║  ← Fase P0 — FOCO ACTUAL
                 ╔═══════════════════════════╗
                 ║    Tipos / Compilador     ║  ← TypeScript strict (já em P0)
                 ╚═══════════════════════════╝
```

**Fase P0:** Foco exclusivo em testes **unitários** e verificação de **tipos**.  
**Fase 1:** Adicionar testes de **integração** para API Routes críticas.  
**Fase 2+:** Adicionar testes **E2E** com Playwright para fluxos de utilizador.

---

## 3. Setup e Configuração

### 3.1 Instalação

```bash
npm install -D vitest @vitest/coverage-v8 @vitest/ui @types/node
```

### 3.2 Configuração Vitest

```typescript
// vitest.config.ts (raiz do projecto)
import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    globals:     true,
    environment: "node",
    setupFiles:  ["./src/lib/__tests__/setup.ts"],
    coverage: {
      provider:  "v8",
      reporter:  ["text", "json", "html", "lcov"],
      reportsDirectory: "./coverage",
      include:   ["src/lib/**/*.ts"],
      exclude: [
        "src/lib/__tests__/**",
        "src/lib/invoice-pdf.tsx",
        "src/lib/receipt-pdf.tsx",
        "src/lib/bootstrap.ts",
      ],
      thresholds: {
        global: {
          lines:     60,
          functions: 65,
          branches:  55,
          statements: 60,
        },
        perFile: false,  // thresholds por módulo definidos no Quality Gate
      },
    },
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
});
```

### 3.3 Scripts no package.json

```json
{
  "scripts": {
    "test":          "vitest run",
    "test:watch":    "vitest --watch",
    "test:coverage": "vitest run --coverage",
    "test:ui":       "vitest --ui",
    "test:related":  "vitest related"
  }
}
```

### 3.4 Ficheiro de Setup Global

```typescript
// src/lib/__tests__/setup.ts
import { vi, afterEach } from "vitest";

// Limpar todos os mocks entre testes
afterEach(() => {
  vi.clearAllMocks();
});

// Definir variáveis de ambiente para testes
process.env.JWT_SECRET = "test-secret-for-unit-tests-only-32chars";
process.env.NODE_ENV   = "test";
```

### 3.5 Estrutura de Pastas

```
src/lib/__tests__/
├── setup.ts                        ← configuração global
├── mocks/
│   ├── prisma.ts                   ← mock do PrismaClient
│   └── event-bus.ts                ← mock do Event Bus
├── pricing-service.test.ts
├── finance.test.ts
├── finance-service.test.ts
├── document-numbering.test.ts
├── validators.test.ts
├── rateLimit.test.ts
└── auth.test.ts
```

---

## 4. Mocks e Utilitários

### 4.1 Mock do Prisma

```typescript
// src/lib/__tests__/mocks/prisma.ts
import { vi } from "vitest";
import type { PrismaClient } from "@prisma/client";

// Mock de um cliente de transação Prisma
export function createMockTx(): jest.Mocked<Parameters<Parameters<PrismaClient["$transaction"]>[0]>[0]> {
  return {
    reservation:      createModelMock(),
    invoice:          createModelMock(),
    invoicePayment:   createModelMock(),
    payment:          createModelMock(),
    liquidationNote:  createModelMock(),
    financialHistory: createModelMock(),
    financialAudit:   createModelMock(),
    timeline:         createModelMock(),
    documentCounter:  createModelMock(),
    company:          createModelMock(),
    notification:     createModelMock(),
  } as any;
}

function createModelMock() {
  return {
    create:     vi.fn(),
    findFirst:  vi.fn(),
    findUnique: vi.fn(),
    findMany:   vi.fn(),
    update:     vi.fn(),
    upsert:     vi.fn(),
    count:      vi.fn(),
    aggregate:  vi.fn(),
    delete:     vi.fn(),
  };
}

// Mock do prisma global
vi.mock("@/lib/prisma", () => ({
  prisma: createModelMock(),
}));
```

### 4.2 Mock do Event Bus

```typescript
// src/lib/__tests__/mocks/event-bus.ts
import { vi } from "vitest";

vi.mock("@/lib/event-bus", () => ({
  publish:   vi.fn().mockResolvedValue(undefined),
  subscribe: vi.fn(),
}));
```

---

## 5. Testes por Módulo

### 5.1 PricingService — Especificação Completa

```typescript
// src/lib/__tests__/pricing-service.test.ts
import { describe, it, expect } from "vitest";
import { calcPrice, matchTier, calcPriceFromTier } from "@/lib/pricing-service";

describe("calcPrice — cálculo de preço sem tiers", () => {

  describe("preço base por horas", () => {
    it("aplica pricePerHour para sessão < 3h", () => {
      const result = calcPrice({
        totalHours:      2,
        pricePerHour:    10000,
        halfDayPrice:    30000,
        fullDayPrice:    50000,
        coffeeBreak:     false,
        coffeeBreakPrice: 0,
        discount:        0,
        iva:             0,
      });
      expect(result.subtotal).toBe(20000);
      expect(result.totalAmount).toBe(20000);
    });

    it("aplica halfDayPrice para sessão exactamente 3h", () => {
      const result = calcPrice({
        totalHours:      3,
        pricePerHour:    10000,
        halfDayPrice:    25000,
        fullDayPrice:    45000,
        coffeeBreak:     false,
        coffeeBreakPrice: 0,
        discount:        0,
        iva:             0,
      });
      expect(result.subtotal).toBe(25000);
    });

    it("aplica halfDayPrice para sessão de 4h", () => {
      const result = calcPrice({
        totalHours:      4,
        pricePerHour:    10000,
        halfDayPrice:    25000,
        fullDayPrice:    45000,
        coffeeBreak:     false,
        coffeeBreakPrice: 0,
        discount:        0,
        iva:             0,
      });
      expect(result.subtotal).toBe(25000);
    });

    it("aplica fullDayPrice para sessão exactamente 6h", () => {
      const result = calcPrice({
        totalHours:      6,
        pricePerHour:    10000,
        halfDayPrice:    25000,
        fullDayPrice:    45000,
        coffeeBreak:     false,
        coffeeBreakPrice: 0,
        discount:        0,
        iva:             0,
      });
      expect(result.subtotal).toBe(45000);
    });

    it("aplica fullDayPrice para sessão de 8h", () => {
      const result = calcPrice({
        totalHours:      8,
        pricePerHour:    10000,
        halfDayPrice:    25000,
        fullDayPrice:    45000,
        coffeeBreak:     false,
        coffeeBreakPrice: 0,
        discount:        0,
        iva:             0,
      });
      expect(result.subtotal).toBe(45000);
    });
  });

  describe("coffee break", () => {
    it("adiciona coffeeBreakPrice ao subtotal quando coffeeBreak = true", () => {
      const result = calcPrice({
        totalHours:      2,
        pricePerHour:    10000,
        halfDayPrice:    25000,
        fullDayPrice:    45000,
        coffeeBreak:     true,
        coffeeBreakPrice: 5000,
        discount:        0,
        iva:             0,
      });
      expect(result.subtotal).toBe(25000);  // 20000 + 5000
    });

    it("não adiciona coffeeBreakPrice quando coffeeBreak = false", () => {
      const result = calcPrice({
        totalHours:      2,
        pricePerHour:    10000,
        halfDayPrice:    25000,
        fullDayPrice:    45000,
        coffeeBreak:     false,
        coffeeBreakPrice: 5000,
        discount:        0,
        iva:             0,
      });
      expect(result.subtotal).toBe(20000);
    });
  });

  describe("desconto e IVA", () => {
    it("aplica desconto antes do IVA", () => {
      // Base: 20000, Desconto: 2000, IVA: 14%
      // afterDiscount = 18000
      // totalAmount = 18000 * 1.14 = 20520
      const result = calcPrice({
        totalHours:      2,
        pricePerHour:    10000,
        halfDayPrice:    25000,
        fullDayPrice:    45000,
        coffeeBreak:     false,
        coffeeBreakPrice: 0,
        discount:        2000,
        iva:             14,
      });
      expect(result.discount).toBe(2000);
      expect(result.ivaAmount).toBeCloseTo(2520, 0);
      expect(result.totalAmount).toBeCloseTo(20520, 0);
    });

    it("IVA = 0 não altera o valor", () => {
      const result = calcPrice({
        totalHours:      2,
        pricePerHour:    10000,
        halfDayPrice:    25000,
        fullDayPrice:    45000,
        coffeeBreak:     false,
        coffeeBreakPrice: 0,
        discount:        0,
        iva:             0,
      });
      expect(result.totalAmount).toBe(20000);
      expect(result.ivaAmount).toBe(0);
    });

    it("desconto não pode resultar em subtotal negativo", () => {
      const result = calcPrice({
        totalHours:      1,
        pricePerHour:    10000,
        halfDayPrice:    25000,
        fullDayPrice:    45000,
        coffeeBreak:     false,
        coffeeBreakPrice: 0,
        discount:        15000,  // desconto > subtotal
        iva:             0,
      });
      expect(result.totalAmount).toBeGreaterThanOrEqual(0);
    });
  });
});

describe("matchTier", () => {
  const tiers = [
    { durationMinutes: 60,  price: 8000  },
    { durationMinutes: 180, price: 20000 },
    { durationMinutes: 360, price: 35000 },
  ];

  it("escolhe o tier com menor duração que cobre a sessão", () => {
    const tier = matchTier(tiers, 90);  // 90 min → tier de 180min
    expect(tier?.price).toBe(20000);
  });

  it("retorna o tier exacto quando duração bate certo", () => {
    const tier = matchTier(tiers, 60);
    expect(tier?.price).toBe(8000);
  });

  it("retorna null se nenhum tier cobre a duração", () => {
    const tier = matchTier(tiers, 500);
    expect(tier).toBeNull();
  });

  it("retorna null para lista de tiers vazia", () => {
    const tier = matchTier([], 60);
    expect(tier).toBeNull();
  });
});
```

### 5.2 finance.ts — Especificação Completa

```typescript
// src/lib/__tests__/finance.test.ts
import { describe, it, expect } from "vitest";
import {
  calcFinancialStatus,
  calcContractMonths,
  calcTotalContracted,
} from "@/lib/finance";

describe("calcFinancialStatus", () => {
  const now = new Date();
  const pastDate   = new Date(now.getTime() - 30 * 86400000);
  const futureDate = new Date(now.getTime() + 30 * 86400000);

  it("retorna LIQUIDADO quando balance = 0", () => {
    const status = calcFinancialStatus({
      totalAmount: 100000,
      amountPaid:  100000,
      balance:     0,
      dueDate:     pastDate,
    });
    expect(status).toBe("LIQUIDADO");
  });

  it("retorna PAGO_PARCIALMENTE quando amountPaid > 0 e balance > 0", () => {
    const status = calcFinancialStatus({
      totalAmount: 100000,
      amountPaid:  50000,
      balance:     50000,
      dueDate:     futureDate,
    });
    expect(status).toBe("PAGO_PARCIALMENTE");
  });

  it("retorna EM_ATRASO quando dueDate no passado e balance > 0 e sem pagamento", () => {
    const status = calcFinancialStatus({
      totalAmount: 100000,
      amountPaid:  0,
      balance:     100000,
      dueDate:     pastDate,
    });
    expect(status).toBe("EM_ATRASO");
  });

  it("retorna PENDENTE quando dueDate no futuro e sem pagamento", () => {
    const status = calcFinancialStatus({
      totalAmount: 100000,
      amountPaid:  0,
      balance:     100000,
      dueDate:     futureDate,
    });
    expect(status).toBe("PENDENTE");
  });
});

describe("calcContractMonths", () => {
  it("retorna 1 para contrato dentro do mesmo mês", () => {
    const start = new Date("2026-07-01");
    const end   = new Date("2026-07-31");
    expect(calcContractMonths(start, end)).toBe(1);
  });

  it("retorna 12 para contrato de 1 ano", () => {
    const start = new Date("2026-01-01");
    const end   = new Date("2026-12-31");
    expect(calcContractMonths(start, end)).toBe(12);
  });

  it("retorna 3 para contrato de 3 meses", () => {
    const start = new Date("2026-07-01");
    const end   = new Date("2026-09-30");
    expect(calcContractMonths(start, end)).toBe(3);
  });
});

describe("calcTotalContracted", () => {
  it("multiplica rentAmount pelos meses do contrato", () => {
    const start = new Date("2026-01-01");
    const end   = new Date("2026-12-31");
    expect(calcTotalContracted(100000, start, end)).toBe(1200000);
  });
});
```

### 5.3 validators.ts — Especificação Completa

```typescript
// src/lib/__tests__/validators.test.ts
import { describe, it, expect } from "vitest";
import { isValidEmail, isValidWhatsapp, sanitizeText } from "@/lib/validators";

describe("isValidEmail", () => {
  it("aceita email válido simples", ()       => expect(isValidEmail("user@domain.com")).toBe(true));
  it("aceita email com subdomínio", ()       => expect(isValidEmail("user@mail.domain.co.ao")).toBe(true));
  it("rejeita email sem @", ()               => expect(isValidEmail("userdomain.com")).toBe(false));
  it("rejeita email sem domínio", ()         => expect(isValidEmail("user@")).toBe(false));
  it("rejeita email sem TLD", ()             => expect(isValidEmail("user@domain")).toBe(false));
  it("rejeita string vazia", ()              => expect(isValidEmail("")).toBe(false));
  it("rejeita email com espaço", ()          => expect(isValidEmail("us er@domain.com")).toBe(false));
});

describe("isValidWhatsapp", () => {
  it("aceita número com 9 dígitos", ()  => expect(isValidWhatsapp("976467124")).toBe(true));
  it("aceita número com código (+244)", () => expect(isValidWhatsapp("+244976467124")).toBe(true));
  it("aceita número com espaços", ()    => expect(isValidWhatsapp("+244 976 467 124")).toBe(true));
  it("rejeita número com < 9 dígitos", () => expect(isValidWhatsapp("12345")).toBe(false));
  it("rejeita string vazia", ()         => expect(isValidWhatsapp("")).toBe(false));
});

describe("sanitizeText", () => {
  it("remove < e >", ()            => expect(sanitizeText("<script>")).toBe("script"));
  it("faz trim", ()                => expect(sanitizeText("  hello  ")).toBe("hello"));
  it("preserva caracteres normais", () => expect(sanitizeText("Ernesto Pinto")).toBe("Ernesto Pinto"));
  it("preserva acentos angolanos", () => expect(sanitizeText("Bairro Azul — Luanda")).toBe("Bairro Azul — Luanda"));
});
```

### 5.4 document-numbering.ts — Especificação

```typescript
// src/lib/__tests__/document-numbering.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { nextDocumentNumber } from "@/lib/document-numbering";
import { createMockTx } from "./mocks/prisma";

describe("nextDocumentNumber", () => {
  let mockTx: ReturnType<typeof createMockTx>;

  beforeEach(() => {
    mockTx = createMockTx();
  });

  it("gera número com formato correcto para FT-SALA", async () => {
    mockTx.documentCounter.upsert.mockResolvedValue({ id: "1", type: "FT-SALA", year: 2026, lastSeq: 1 });

    const num = await nextDocumentNumber(mockTx, "FT-SALA", 2026);
    expect(num).toBe("FT-SALA-2026-000001");
  });

  it("incrementa lastSeq a cada chamada", async () => {
    mockTx.documentCounter.upsert
      .mockResolvedValueOnce({ lastSeq: 1 })
      .mockResolvedValueOnce({ lastSeq: 2 });

    const n1 = await nextDocumentNumber(mockTx, "REC", 2026);
    const n2 = await nextDocumentNumber(mockTx, "REC", 2026);

    expect(n1).toBe("REC-2026-000001");
    expect(n2).toBe("REC-2026-000002");
  });

  it("usa o ano corrente por defeito", async () => {
    const currentYear = new Date().getFullYear();
    mockTx.documentCounter.upsert.mockResolvedValue({ lastSeq: 1 });

    const num = await nextDocumentNumber(mockTx, "NL");
    expect(num).toContain(`NL-${currentYear}-`);
  });

  it("zero-pad até 6 dígitos", async () => {
    mockTx.documentCounter.upsert.mockResolvedValue({ lastSeq: 42 });

    const num = await nextDocumentNumber(mockTx, "RES", 2026);
    expect(num).toBe("RES-2026-000042");
  });
});
```

---

## 6. Padrões de Escrita de Testes

### 6.1 Convenções de Nomenclatura

```typescript
// Estrutura: describe → it → expect
// Padrão do 'it': "deve [comportamento] quando [condição]"

describe("NomeDoMódulo", () => {
  describe("nomeDaFunção", () => {
    it("deve retornar X quando Y", () => { ... });
    it("deve lançar erro quando Z", () => { ... });
    it("não deve fazer W quando V", () => { ... });
  });
});
```

### 6.2 Padrão AAA (Arrange-Act-Assert)

```typescript
it("deve calcular totalAmount correctamente com IVA", () => {
  // ARRANGE — preparar dados
  const input = {
    totalHours:      2,
    pricePerHour:    50000,
    coffeeBreak:     false,
    coffeeBreakPrice: 0,
    discount:        0,
    iva:             14,
    halfDayPrice:    80000,
    fullDayPrice:    140000,
  };

  // ACT — executar a função
  const result = calcPrice(input);

  // ASSERT — verificar resultado
  expect(result.totalAmount).toBeCloseTo(114000, 0);  // 100000 * 1.14
});
```

### 6.3 Testar Casos de Erro

```typescript
// Para funções que lançam erros:
it("deve lançar erro quando reserva não existe", async () => {
  mockTx.reservation.findUnique.mockResolvedValue(null);

  await expect(
    confirmPayment(mockTx, { reservationId: "non-existent", amount: 1000 })
  ).rejects.toThrow("Reserva não encontrada");
});

// Para funções que retornam null/undefined:
it("deve retornar null quando nenhum tier cobre a duração", () => {
  const result = matchTier([], 120);
  expect(result).toBeNull();
});
```

### 6.4 Mocking de Data/Hora

```typescript
import { vi } from "vitest";

it("considera data actual para calcular atraso", () => {
  // Fixar data actual
  vi.setSystemTime(new Date("2026-08-01"));

  const status = calcFinancialStatus({
    dueDate:     new Date("2026-07-01"),  // 31 dias no passado
    balance:     50000,
    amountPaid:  0,
    totalAmount: 50000,
  });

  expect(status).toBe("EM_ATRASO");

  vi.useRealTimers();  // restaurar sempre após o teste
});
```

---

## 7. Execução e CI

### 7.1 Durante Desenvolvimento

```bash
# Modo watch — re-executa ao salvar ficheiros
npm run test:watch

# Só testes afectados por ficheiros alterados
npm run test:related src/lib/pricing-service.ts

# Interface visual (browser)
npm run test:ui
```

### 7.2 Pre-Commit (local)

```bash
npm test  # suite completa — deve passar antes de cada commit
```

### 7.3 CI (GitHub Actions / Vercel)

```yaml
# .github/workflows/test.yml (sugestão futura)
name: Quality Gate
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: "20" }
      - run: npm ci
      - run: npm run build
      - run: npx tsc --noEmit
      - run: npm run test:coverage
      - run: npm run lint
```

---

## 8. Roadmap de Testes por Fase

| Fase | Tipo | Módulos | Meta de Cobertura |
|---|---|---|---|
| **P0** | Unitários | PricingService, FinanceService, finance.ts, validators, rateLimit, document-numbering | 60% global |
| **Vol 01** | Unitários + Integração | CRM APIs, conversão Lead→Company | + 10% |
| **Vol 02** | Integração | Cowork APIs, gestão de contratos | + 5% |
| **Vol 03** | Integração | Reservas (conflict check integrado) | + 5% |
| **Vol 04** | Integração | Financeiro (FinanceService integration) | + 5% |
| **Fase 1** | E2E | Fluxo principal login → reserva → pagamento | Playwright |
| **Fase 2** | E2E | Multi-tenant, isolamento de dados | + Playwright |

---

## 9. O Que NÃO testar (Fase P0)

Para não desperdiçar tempo com testes de baixo valor:

- **Componentes React/PDF** — `invoice-pdf.tsx`, `receipt-pdf.tsx` — testados via snapshot visual, não unitário
- **Configuração do Prisma** — `prisma.ts` — é configuração, não lógica
- **Bootstrap** — `bootstrap.ts` — é inicialização, não lógica de negócio
- **Email templates** — `email.ts` — testar via integração manual ou snapshot; templates HTML são difíceis de testar de forma útil
- **Event Bus** — `event-bus.ts` — infraestrutura genérica; os handlers testam-se via testes de integração futuros

---

*VD Platform — Testing Strategy v1.0 — Julho 2026*  
*Próxima actualização: Após Fase P0, com adição de testes de integração para Vol 01*
