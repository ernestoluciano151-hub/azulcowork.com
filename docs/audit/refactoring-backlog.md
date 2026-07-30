# Refactoring Backlog — VD Platform

> **Documento:** AUDIT-003  
> **Fase:** 0.5 → Fase 0 (resolução)  
> **Estado:** ✅ Concluído (backlog definido)  
> **Data:** Julho 2026  
> **Referência:** AUDIT-001, AUDIT-002  

---

## 1. Princípios deste Backlog

1. **Segurança primeiro** — todos os itens críticos de segurança resolvem antes de qualquer nova feature
2. **Integridade de dados** — race conditions e inconsistências financeiras resolvem antes de ir para produção com volume elevado
3. **Sem regressões** — cada refactor deve ter testes antes de ser feito (test-first quando possível)
4. **Um item de cada vez** — cada item desta lista é um PR independente com scope claro
5. **Documentar após implementar** — actualizar docs relevantes após cada resolução

---

## 2. Backlog Priorizado

### SPRINT 0-A — Segurança Imediata (Bloqueante)
*Estimar: 2-3 dias. Deve ser feito antes de qualquer outra coisa.*

---

#### RFT-001 — Remover JWT Fallback Secret
**Referência:** AUDIT-001/SEC-001 · DT-011  
**Prioridade:** 🔴 P0 — CRÍTICO  
**Esforço estimado:** 30 minutos  
**Ficheiros afectados:** `src/lib/auth.ts`, `src/middleware.ts`  

**O que fazer:**
```typescript
// ANTES (src/lib/auth.ts)
const SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || "fallback-secret-troque-me"
);

// DEPOIS
if (!process.env.JWT_SECRET) {
  throw new Error(
    "[auth] CRITICAL: JWT_SECRET não configurado. " +
    "Defina JWT_SECRET nas variáveis de ambiente antes de iniciar o servidor."
  );
}
const SECRET = new TextEncoder().encode(process.env.JWT_SECRET);
```

Aplicar o mesmo padrão em `src/middleware.ts`.

**Critério de aceitação:**
- [ ] Servidor não inicia sem `JWT_SECRET` definido
- [ ] Erro de startup é claro e indica o que configurar
- [ ] `.env.example` actualizado com instrução
- [ ] Documentação de deployment actualizada

---

#### RFT-002 — Corrigir Login: Remover (admin as any).role e Fallback ADMIN
**Referência:** AUDIT-001/SEC-004 · DT-011  
**Prioridade:** 🔴 P0 — CRÍTICO  
**Esforço estimado:** 1 hora  
**Ficheiros afectados:** `src/app/api/auth/login/route.ts`, `prisma/schema.prisma`  

**Causa raiz:** `AdminUser.role` não tem tipo correcto gerado pelo Prisma.

**O que fazer:**
1. Verificar `prisma/schema.prisma` — o campo `role` deve ter tipo `String` com default definido
2. Adicionar enum Prisma `AdminRole` com valores `ADMIN | COMERCIAL | FINANCEIRO | VIEWER`
3. Alterar `AdminUser.role` para usar o enum
4. Correr `npx prisma generate` para regenerar os tipos
5. No `login/route.ts`, substituir:

```typescript
// ANTES
role: (admin as any).role || "ADMIN",

// DEPOIS
role: admin.role,  // tipo correcto após regeneração
```

**Critério de aceitação:**
- [ ] Sem cast `as any` no login
- [ ] Sem fallback `|| "ADMIN"`
- [ ] TypeScript compila sem erros neste ficheiro
- [ ] Migration Prisma criada se schema alterado

---

#### RFT-003 — Corrigir AdminUser.role Enum e Route de Criação
**Referência:** AUDIT-001/ARCH-002 · DT-018  
**Prioridade:** 🔴 P0 — CRÍTICO (depende de RFT-002)  
**Esforço estimado:** 2 horas  
**Ficheiros afectados:** `src/app/api/admin/users/route.ts`, `src/app/api/admin/users/[id]/route.ts`  

**O que fazer:**
```typescript
// ANTES
role: role === "ADMIN" ? "ADMIN" : "USER",

// DEPOIS
const VALID_ROLES = ["ADMIN", "COMERCIAL", "FINANCEIRO", "VIEWER"] as const;
type AdminRole = typeof VALID_ROLES[number];

function isValidRole(r: unknown): r is AdminRole {
  return VALID_ROLES.includes(r as AdminRole);
}

const assignedRole: AdminRole = isValidRole(role) ? role : "VIEWER";
```

**Critério de aceitação:**
- [ ] Criação de utilizador aceita roles ADMIN, COMERCIAL, FINANCEIRO, VIEWER
- [ ] Role inválido resulta em 400 com mensagem clara
- [ ] Role "USER" não existe no sistema
- [ ] Testes manuais: criar utilizador com cada role

---

#### RFT-004 — Implementar RBAC nas API Routes
**Referência:** AUDIT-001/SEC-002 · DT-012  
**Prioridade:** 🔴 P0 — CRÍTICO  
**Esforço estimado:** 4 horas  
**Ficheiros afectados:** Todos os `src/app/api/**/*.ts`  

**O que fazer:**

Primeiro, criar helper em `src/lib/auth.ts`:
```typescript
export function requireRole(
  session: Session | null,
  allowedRoles: AdminRole[]
): { error: NextResponse } | { session: Session } {
  if (!session) {
    return { error: NextResponse.json({ error: "Não autorizado." }, { status: 401 }) };
  }
  if (!allowedRoles.includes(session.role as AdminRole)) {
    return { error: NextResponse.json({ error: "Sem permissão." }, { status: 403 }) };
  }
  return { session };
}
```

Depois, aplicar a cada route seguindo a matriz RBAC documentada:

| Operação | Roles permitidas |
|---|---|
| Leitura geral (GET) | ADMIN, COMERCIAL, FINANCEIRO, VIEWER |
| Escrita CRM (POST, PATCH) | ADMIN, COMERCIAL |
| Eliminação CRM (DELETE) | ADMIN |
| Operações financeiras | ADMIN, FINANCEIRO |
| Configurações do sistema | ADMIN |
| Gestão de utilizadores | ADMIN |

**Critério de aceitação:**
- [ ] Todos os endpoints têm verificação de role
- [ ] 401 para não autenticado, 403 para role insuficiente
- [ ] Role VIEWER não consegue modificar dados
- [ ] Role COMERCIAL não consegue aceder a `/api/finance/*`
- [ ] Testes manuais com cada role

---

#### RFT-005 — Corrigir Contact Info nos Templates de Email
**Referência:** AUDIT-001/SEC-006 · DT-020  
**Prioridade:** 🟠 P1 — ALTO (afecta clientes já hoje)  
**Esforço estimado:** 30 minutos  
**Ficheiros afectados:** `src/lib/email.ts`  

**O que fazer:**
```typescript
// ANTES (linha 123)
<p>Em caso de dúvidas, entre em contacto via WhatsApp: +244 925 000 000</p>
// linha 125
<p>Azul Coworking · ... · azulcoworking.ao</p>

// DEPOIS
<p>Em caso de dúvidas, entre em contacto via WhatsApp: +244 976 467 124</p>
<p>Azul Coworking · Bairro Azul, Edifício 18, Luanda · azulcowork.com</p>
```

**Critério de aceitação:**
- [ ] Número de WhatsApp correcto: 976 467 124
- [ ] URL correcto: www.azulcowork.com
- [ ] Teste de envio de email de confirmação de reserva

---

### SPRINT 0-B — Integridade de Dados (Crítico)
*Estimar: 3-4 dias.*

---

#### RFT-006 — Mover Conflict Check para Dentro da Transação
**Referência:** AUDIT-001/DATA-001 · DT-003 / DT-013  
**Prioridade:** 🔴 P0 — CRÍTICO  
**Esforço estimado:** 2 horas  
**Ficheiros afectados:** `src/app/api/reservations/route.ts`  

**O que fazer:**

```typescript
// ANTES: conflict check FORA da transação
const conflict = await prisma.reservation.findFirst({ ... });
if (conflict) { return 409; }

const result = await prisma.$transaction(async (tx) => {
  const reservation = await tx.reservation.create({ ... });
  ...
});

// DEPOIS: conflict check DENTRO da transação
const result = await prisma.$transaction(async (tx) => {
  // Primeiro: verificar conflito
  const conflict = await tx.reservation.findFirst({
    where: {
      status: { in: ["CONFIRMADA", "RESERVADO", "PENDENTE_APROVACAO"] },
      AND: [
        { startDatetime: { lt: end } },
        { endDatetime: { gt: start } },
      ],
    },
  });
  if (conflict) {
    throw new Error("CONFLICT: Já existe uma reserva neste período.");
  }

  // Só então criar
  const reservation = await tx.reservation.create({ ... });
  ...
});
```

Na route, tratar o erro específico:
```typescript
} catch (err) {
  if (err instanceof Error && err.message.startsWith("CONFLICT:")) {
    return NextResponse.json({ error: "Conflito: já existe uma reserva neste período." }, { status: 409 });
  }
  ...
}
```

**Critério de aceitação:**
- [ ] Conflict check está dentro do `prisma.$transaction()`
- [ ] Teste com duas criações simultâneas (ex: via `Promise.all`) — apenas uma deve ser criada
- [ ] Resposta 409 correcta quando há conflito

---

#### RFT-007 — Implementar Numeração de Documentos com Sequência Atómica
**Referência:** AUDIT-001/DATA-002 · DT-014  
**Prioridade:** 🔴 P0 — CRÍTICO  
**Esforço estimado:** 4 horas  
**Ficheiros afectados:** `prisma/schema.prisma`, `src/lib/finance-service.ts`, `src/app/api/reservations/route.ts`  

**O que fazer:**

Opção recomendada — tabela de contadores com `SELECT FOR UPDATE`:

```sql
-- Migration Prisma
model DocumentCounter {
  id     String @id @default(cuid())
  type   String @unique  // "FT-SALA", "REC", "NL", "RES", "FT-CWORK"
  year   Int
  lastSeq Int   @default(0)
  
  @@unique([type, year])
}
```

```typescript
// src/lib/document-numbering.ts
export async function nextDocumentNumber(
  tx: Prisma.TransactionClient,
  type: "FT-SALA" | "REC" | "NL" | "RES" | "FT-CWORK",
  year: number = new Date().getFullYear()
): Promise<string> {
  const counter = await tx.documentCounter.upsert({
    where: { type_year: { type, year } },
    update: { lastSeq: { increment: 1 } },
    create: { type, year, lastSeq: 1 },
  });
  return `${type}-${year}-${String(counter.lastSeq).padStart(6, "0")}`;
}
```

O `upsert` do Prisma em PostgreSQL é atómico e garante que `lastSeq` é único.

**Critério de aceitação:**
- [ ] Modelo `DocumentCounter` no schema Prisma
- [ ] Função `nextDocumentNumber()` testada com chamadas concorrentes
- [ ] Sem duplicação de números em testes de stress
- [ ] Substituir todos os `count + 1` existentes pela nova função

---

#### RFT-008 — Corrigir recordFinancialHistory para Usar tx Consistentemente
**Referência:** AUDIT-001/DATA-003 · DT-017  
**Prioridade:** 🔴 P0 — CRÍTICO  
**Esforço estimado:** 3 horas  
**Ficheiros afectados:** `src/lib/finance.ts`  

**O que fazer:**

A função actualmente usa `prisma` global para algumas queries internas. Deve usar exclusivamente o `tx` passado como argumento:

```typescript
// ANTES: usa prisma global dentro da função
export async function recordFinancialHistory(tx: any, input: FinancialHistoryInput) {
  const company = await prisma.company.findUnique(...);  // ← prisma global!
  const { _sum } = await prisma.payment.aggregate(...);  // ← prisma global!
  ...
}

// DEPOIS: usa apenas tx
export async function recordFinancialHistory(
  tx: Prisma.TransactionClient,
  input: FinancialHistoryInput
) {
  // Calcular runningBalance sem query extra:
  // O chamador deve fornecer o runningBalance anterior, 
  // ou calcular baseado no input.amount
  const lastEntry = await tx.financialHistory.findFirst({
    where: { companyId: input.companyId },
    orderBy: { createdAt: "desc" },
  });
  const previousBalance = lastEntry?.runningBalance ?? 0;
  const runningBalance = input.type === "PAGAMENTO"
    ? previousBalance + input.amount
    : previousBalance - input.amount;

  return tx.financialHistory.create({
    data: {
      companyId:    input.companyId,
      type:         input.type,
      description:  input.description,
      amount:       input.amount,
      runningBalance,
      method:       input.method    || null,
      reference:    input.reference || null,
      createdBy:    input.createdBy || null,
    },
  });
}
```

**Critério de aceitação:**
- [ ] Sem referências a `prisma` (global) dentro de `recordFinancialHistory`
- [ ] Usa exclusivamente `tx.*`
- [ ] `runningBalance` calculado correctamente dentro do contexto da transação
- [ ] Testes unitários para a função

---

#### RFT-009 — Separar Contextos Financeiros em getCompanyFinanceSummary
**Referência:** AUDIT-001/DATA-004 · DT-019  
**Prioridade:** 🟠 P1 — ALTO  
**Esforço estimado:** 2 horas  
**Ficheiros afectados:** `src/lib/finance.ts` (função `getCompanyFinanceSummary`)  

**O que fazer:**

```typescript
// ANTES: soma todos os pagamentos independentemente da categoria
const totalPaid = payments
  .filter(p => p.status === "PAGO")
  .reduce((s, p) => s + p.amount, 0);

// DEPOIS: separar coworking de sala
const coworkPayments = payments.filter(
  p => p.status === "PAGO" && p.category !== "SALA_REUNIAO"
);
const salaPayments = payments.filter(
  p => p.status === "PAGO" && p.category === "SALA_REUNIAO"
);

const totalPaidCowork = coworkPayments.reduce((s, p) => s + p.amount, 0);
const totalPaidSala   = salaPayments.reduce((s, p) => s + p.amount, 0);
const totalPaid       = totalPaidCowork; // sumário de cowork só inclui cowork
```

Actualizar a interface de retorno para expor ambos os valores.

**Critério de aceitação:**
- [ ] `totalPaid` no sumário financeiro de cowork não inclui pagamentos de sala
- [ ] Novo campo `totalPaidSala` disponível para relatórios
- [ ] Verificar com empresa que tem reservas de sala + contrato coworking

---

### SPRINT 0-C — Qualidade de Código (Importante)
*Estimar: 3-4 dias.*

---

#### RFT-010 — Eliminar Lógica Financeira Duplicada em reservations/route.ts
**Referência:** AUDIT-001/ARCH-001 · DT-015  
**Prioridade:** 🟠 P1 — ALTO  
**Esforço estimado:** 4 horas  
**Ficheiros afectados:** `src/app/api/reservations/route.ts`, `src/lib/finance-service.ts`  

**O que fazer:**

A route `POST /api/reservations` com `paymentOption = "PAGAR_AGORA"` implementa directamente a criação de Invoice/Payment/LiquidationNote. Esta lógica deve ser movida para o `FinanceService`.

Abordagem recomendada:
1. Criar uma nova função `FinanceService.processInitialPayment(tx, {...})` que aceita os dados da reserva recém-criada e processa o pagamento inicial
2. Simplificar `reservations/route.ts` para: (a) criar a reserva dentro da tx, (b) chamar `processInitialPayment` se `PAGAR_AGORA`

```typescript
// Na route, dentro da tx:
const reservation = await tx.reservation.create({ ... });

if (opt === "PAGAR_AGORA" && finalTotal > 0) {
  await processInitialPayment(tx, {
    reservationId: reservation.id,
    reservationNumber,
    plan,
    companyId,
    amount: finalAmount,
    discount: finalDisc,
    iva: finalIva,
    totalAmount: finalTotal,
    amountPaid: Number(amountPaid) || finalTotal,
    paymentMethod,
    operationRef,
    receiptUrl,
    paidDate,
    createdBy: session.name || session.email,
    isPartial: paymentTiming === "PARCIAL",
  });
}
```

**Critério de aceitação:**
- [ ] Lógica de criação de Invoice/Payment/LiquidationNote existe apenas no `FinanceService`
- [ ] `reservations/route.ts` simplificado
- [ ] Comportamento idêntico ao anterior (testes manuais com todos os paymentOptions)

---

#### RFT-011 — Corrigir TimelineType — Remover bare string
**Referência:** AUDIT-001/QUAL-004  
**Prioridade:** 🟡 P2 — MÉDIO  
**Esforço estimado:** 1 hora  
**Ficheiros afectados:** `src/lib/timeline.ts`  

**O que fazer:**
```typescript
// ANTES
type TimelineType = "RESERVA" | "PAGAMENTO" | ... | string;

// DEPOIS — lista completa de todos os tipos válidos
type TimelineType =
  | "RESERVA"
  | "RESERVA_CRIADA"
  | "RESERVA_CANCELADA"
  | "PAGAMENTO"
  | "CONVERSAO"
  | "COLABORADOR"
  | "CONTRATO"
  | "NOTA"
  | "EMAIL"
  | "WHATSAPP"
  | "EMPRESA_CRIADA"
  | "EMPRESA_ACTUALIZADA";
  // adicionar conforme necessário — sem | string
```

**Critério de aceitação:**
- [ ] Sem `string` no union type
- [ ] TypeScript reporta erro se tipo inválido for usado
- [ ] Todos os event handlers usando tipos válidos

---

#### RFT-012 — Corrigir Double Cast em timeline.ts
**Referência:** AUDIT-001/ARCH-003  
**Prioridade:** 🟡 P2 — MÉDIO  
**Esforço estimado:** 1 hora  
**Ficheiros afectados:** `src/lib/timeline.ts`  

**O que fazer:**
```typescript
// ANTES
return addTimeline(prisma as unknown as PrismaClient, params);

// DEPOIS — definir tipo union
type PrismaOrTx = PrismaClient | Prisma.TransactionClient;

export async function addTimeline(
  dbOrParams: PrismaOrTx | TimelineParams,
  params?: TimelineParams
): Promise<...>
```

**Critério de aceitação:**
- [ ] Sem `as unknown as` casts
- [ ] TypeScript aceita tanto `prisma` como `tx` como primeiro argumento

---

#### RFT-013 — Remover Dead Code em finance.ts
**Referência:** AUDIT-001/QUAL-005  
**Prioridade:** 🟢 P3 — BAIXO  
**Esforço estimado:** 15 minutos  
**Ficheiros afectados:** `src/lib/finance.ts`  

**O que fazer:**
Remover a função interna `dueDateOverride()` em `calcFinancialStatus()` que nunca é chamada.

---

#### RFT-014 — Substituir any em API Routes por Tipos Prisma
**Referência:** AUDIT-001/QUAL-002  
**Prioridade:** 🟡 P2 — MÉDIO  
**Esforço estimado:** 3 horas  
**Ficheiros afectados:** Múltiplas API Routes  

**O que fazer:**
```typescript
// ANTES
const where: any = {};
const data: any = {};

// DEPOIS
import { Prisma } from "@prisma/client";
const where: Prisma.LeadWhereInput = {};
const data: Prisma.CompanyUpdateInput = {};
```

**Critério de aceitação:**
- [ ] Zero uso de `where: any` ou `data: any` em todas as API Routes
- [ ] TypeScript reporta erro em campos inválidos

---

### SPRINT 0-D — Implementações Ausentes Críticas
*Estimar: 5-7 dias.*

---

#### RFT-015 — Implementar TOTP 2FA no Fluxo de Login
**Referência:** AUDIT-001/SEC-003 · DT-016  
**Prioridade:** 🔴 P0 — CRÍTICO  
**Esforço estimado:** 8 horas  
**Dependências:** RFT-001, RFT-002  
**Ficheiros afectados:** `src/app/api/auth/login/route.ts`, nova route `/api/auth/totp/verify`, UI de login  

**O que fazer:**

1. Instalar `otpauth` ou `totp-generator` (ou usar a lib já disponível)
2. Modificar o fluxo de login para dois passos:
   - Passo 1: verificar email + password → se `totpEnabled`, retornar `{ requiresTotp: true, tempToken: ... }`
   - Passo 2: verificar código TOTP → criar sessão JWT completa
3. Criar endpoint `POST /api/auth/totp/verify` para o passo 2
4. Criar endpoint `POST /api/admin/totp/setup` para activar/desactivar 2FA

**Critério de aceitação:**
- [ ] Login com 2FA activo exige código TOTP
- [ ] Código TOTP inválido retorna 401
- [ ] Código TOTP expirado (>30s) retorna 401
- [ ] Compatível com Google Authenticator / Authy

---

#### RFT-016 — Implementar Testes Unitários para Módulos Críticos
**Referência:** DT-002  
**Prioridade:** 🔴 P0 — CRÍTICO  
**Esforço estimado:** 16 horas  
**Ficheiros afectados:** Novos ficheiros `src/lib/__tests__/*.test.ts`  

**Setup:**
```bash
npm install -D vitest @vitest/coverage-v8
```

**Testes prioritários:**

1. **PricingService** — todos os cálculos de preço (halfDay, fullDay, desconto, IVA)
2. **FinanceService** — confirmPayment (com mock do Prisma)
3. **finance.ts** — calcFinancialStatus, calcContractMonths, calcTotalContracted
4. **validators.ts** — isValidEmail, isValidWhatsapp, sanitizeText
5. **rateLimit.ts** — isRateLimited, isLoginRateLimited, looksLikeBot
6. **document-numbering.ts** (após RFT-007) — geração atómica de números

**Target de cobertura:** 60% para módulos listados acima.

**Critério de aceitação:**
- [ ] Vitest configurado
- [ ] Testes correm com `npm test`
- [ ] Cobertura reportada com `npm run test:coverage`
- [ ] PricingService: 100% cobertura
- [ ] FinanceService: >70% cobertura
- [ ] CI/CD não passa se testes falham

---

#### RFT-017 — Implementar BR-004: Prevenção de Leads Duplicados
**Referência:** Business Bible BR-004  
**Prioridade:** 🟠 P1 — ALTO  
**Esforço estimado:** 2 horas  
**Ficheiros afectados:** `src/app/api/leads/route.ts`  

**O que fazer:**
```typescript
// Antes de criar o lead, verificar email duplicado
const existing = await prisma.lead.findFirst({
  where: {
    email: sanitizeText(email).toLowerCase(),
    status: { notIn: ["CONVERTIDO", "PERDIDO"] },  // leads activos
  },
});

if (existing && !_adminCreate) {
  // Silenciosamente retornar OK para não revelar ao bot
  // Mas registar internamente
  return NextResponse.json({ ok: true, id: existing.id }, { status: 201 });
}
```

Para criação pelo admin, mostrar aviso mas permitir criação (pode ser lead diferente com mesmo email de empresa).

**Critério de aceitação:**
- [ ] Email duplicado no formulário público não cria novo registo
- [ ] Admin vê aviso de lead duplicado mas pode prosseguir
- [ ] Sem revelação de informação ao formulário público

---

#### RFT-018 — Implementar Occupancy Rate Dinâmico baseado em RoomSettings
**Referência:** AUDIT-001/QUAL-010  
**Prioridade:** 🟡 P2 — MÉDIO  
**Esforço estimado:** 1 hora  
**Ficheiros afectados:** `src/app/api/finance/sala/route.ts`  

**O que fazer:**
```typescript
// ANTES
const availableHours = 22 * 8;

// DEPOIS
const settings = await prisma.roomSettings.findFirst();
const openHour  = parseInt(settings?.openTime  || "08:00");
const closeHour = parseInt(settings?.closeTime || "18:00");
const hoursPerDay = closeHour - openHour;
// Calcular dias úteis no mês actual (excluindo fins-de-semana)
const workingDays = countWorkingDaysInMonth(monthStart, monthEnd);
const availableHours = workingDays * hoursPerDay;
```

---

### SPRINT 1 — Qualidade e Monitoring
*Para Fase 1, após resolver todos os itens P0 e P1.*

---

#### RFT-019 — Activar TypeScript Strict Mode
**Referência:** DT-001  
**Prioridade:** 🟠 P1 → Sprint 1  
**Esforço estimado:** 8 horas  
**Dependências:** RFT-014 (eliminar `any` primeiro)  

**O que fazer:**
1. Remover `ignoreBuildErrors: true` de `next.config.js`
2. Correr `npx tsc --noEmit` e catalogar todos os erros
3. Resolver erros por módulo, do mais simples ao mais complexo
4. Activar `strict: true` no `tsconfig.json`

---

#### RFT-020 — Instalar e Configurar Sentry
**Referência:** DT-009  
**Prioridade:** 🟠 P1 → Sprint 1  
**Esforço estimado:** 2 horas  

**O que fazer:**
```bash
npm install @sentry/nextjs
npx @sentry/wizard@latest -i nextjs
```

Configurar: alertas para erros 5xx, performance monitoring, breadcrumbs para operações financeiras.

---

#### RFT-021 — Migrar Rate Limiting para Redis (Upstash)
**Referência:** DT-010  
**Prioridade:** 🟠 P1 → Sprint 1  
**Esforço estimado:** 3 horas  

O rate limiting actual é in-memory e não funciona em múltiplas instâncias (Vercel serverless). Migrar para `@upstash/ratelimit` com a mesma interface.

---

#### RFT-022 — Standardizar PDF em @react-pdf/renderer
**Referência:** DT-005  
**Prioridade:** 🟢 P3 → Sprint 1  
**Esforço estimado:** 4 horas  

Identificar todos os usos de `pdfkit` e reescrever como componentes React PDF.

---

#### RFT-023 — Implementar Zod para Validação de Schema
**Referência:** DT-008  
**Prioridade:** 🟡 P2 → Sprint 1  
**Esforço estimado:** 8 horas  

```bash
npm install zod
```

Criar schemas Zod para cada endpoint e validar no início de cada route handler.

---

## 3. Sequência de Implementação Recomendada

```
SPRINT 0-A (Semana 1) — Segurança Imediata
  RFT-001 (30min) → RFT-005 (30min) → RFT-002 (1h) → RFT-003 (2h) → RFT-004 (4h)

SPRINT 0-B (Semana 2) — Integridade de Dados
  RFT-007 (4h) → RFT-006 (2h) → RFT-008 (3h) → RFT-009 (2h)

SPRINT 0-C (Semana 3) — Qualidade de Código
  RFT-016 setup (2h) → RFT-011 (1h) → RFT-012 (1h) → RFT-013 (15min)
  → RFT-014 (3h) → RFT-016 testes (14h) → RFT-010 (4h)

SPRINT 0-D (Semana 4) — Features Ausentes Críticas
  RFT-015 (8h) → RFT-017 (2h) → RFT-018 (1h)

SPRINT 1 (Setembro 2026) — Qualidade Avançada
  RFT-019 → RFT-020 → RFT-021 → RFT-023 → RFT-022
```

---

## 4. Métricas de Conclusão do Refactoring

### Critérios para Transição Fase 0 → Fase 1

Todos os itens P0 devem estar resolvidos e verificados:

```
□ RFT-001 — JWT fallback removido
□ RFT-002 — Login sem (any) cast e sem fallback ADMIN
□ RFT-003 — Enum roles consistente
□ RFT-004 — RBAC em 100% das routes
□ RFT-005 — Contactos correctos nos emails
□ RFT-006 — Conflict check dentro da tx
□ RFT-007 — Numeração atómica de documentos
□ RFT-008 — recordFinancialHistory usa tx
□ RFT-015 — TOTP integrado no login
□ RFT-016 — Testes unitários com cobertura >40% módulos críticos
□ Zero findings P0 em nova auditoria
```

### Depois do Sprint 0 Completo

- Score global esperado: 72/100 (de 58/100)
- Segurança: 75% (de 42%)
- Qualidade Código: 65% (de 58%)
- Cobertura Testes: 40% (de 0%)

---

## 5. Regras de Execução do Refactoring

1. **Antes de cada RFT:** ler os ficheiros afectados e confirmar que o finding ainda existe
2. **Testes manuais mínimos:** cada RFT deve incluir checklist de testes manuais
3. **Um RFT por PR:** nunca misturar múltiplos refactors no mesmo commit
4. **Sem remoção de funcionalidade:** refactors não devem alterar comportamento observável (excepto quando o comportamento era um bug)
5. **Documentar após cada RFT:** actualizar o ficheiro relevante em `docs/` se o refactor alterar arquitectura ou regras de negócio
6. **Comunicar ao Product Owner** antes de iniciar qualquer RFT que altere schema de DB

---

*VD Platform — Refactoring Backlog v1.0 — Julho 2026*  
*Próxima revisão: Após Sprint 0-A (Semana 1 de Agosto 2026)*
