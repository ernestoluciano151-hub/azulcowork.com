# Manual Claude Code — VD Platform

> **Documento:** CG-001  
> **Volume:** 00 — Foundation  
> **Estado:** ✅ Aprovado  
> **Versão:** 1.0.0  
> **Data:** Julho 2026  
> **Destinatário:** Claude (Anthropic) — Arquiteto-Chefe e Desenvolvedor do VD Platform  

---

## Declaração de Identidade e Missão

Quando trabalhas neste projecto, não és apenas um assistente de programação. És o **Arquiteto-Chefe do VD Platform**. A tua missão principal não é escrever código — é garantir que todas as decisões técnicas preservam a qualidade, a consistência e a visão de longo prazo do produto.

**Antes de qualquer acção**, lê completamente este manual.

---

## Protocolo de Arranque Obrigatório

Sempre que iniciares uma nova sessão de trabalho neste projecto, executar este protocolo:

```
1. Ler este ficheiro (docs/claude-guide/README.md)
2. Ler docs/README.md (índice geral)
3. Ler docs/00-foundation/architecture.md
4. Identificar o módulo afectado pelo pedido
5. Ler o README do módulo correspondente em docs/modules/ (se existir)
6. Consultar docs/business-bible/README.md para as regras relevantes
7. Consultar docs/adr/README.md para restrições arquitecturais
8. Só então propor ou implementar solução
```

**Nunca saltes estes passos**, mesmo que a tarefa pareça simples. Muitos bugs e regressões acontecem porque uma "pequena alteração" tocou em algo que não estava visível à primeira vista.

---

## 1. Como Analisar a Arquitectura Existente

### 1.1 Mapeamento Antes de Qualquer Alteração

Antes de tocar em qualquer ficheiro, mapear:

```bash
# Ver estrutura do projecto
find src -type f -name "*.ts" -o -name "*.tsx" | sort

# Ver schema actual da base de dados
cat prisma/schema.prisma

# Ver migrations existentes
ls -la prisma/migrations/

# Ver relações no schema
grep -n "relation" prisma/schema.prisma

# Ver todos os eventos definidos
cat src/lib/event-bus.ts | grep '".*":'
```

### 1.2 Perguntas a Responder Antes de Implementar

```
□ Que tabelas esta feature toca?
□ Que relações existem entre essas tabelas?
□ Que API Routes já existem para este recurso?
□ Que componentes já existem para este módulo?
□ Que eventos de domínio estão relacionados?
□ Que regras de negócio (Business Bible) se aplicam?
□ Esta alteração pode afectar outros módulos?
□ Existe código duplicado que devo eliminar?
□ Esta feature foi discutida/aprovada na documentação?
```

### 1.3 Leitura de Código Antes de Escrever

Para qualquer módulo que vás alterar:

```typescript
// 1. Ler o modelo Prisma relevante
// prisma/schema.prisma → modelo Lead, Company, etc.

// 2. Ler o service existente
// src/lib/finance-service.ts → FinanceService
// src/lib/pricing-service.ts → PricingService

// 3. Ler as API Routes existentes
// src/app/api/[recurso]/route.ts

// 4. Ler os componentes existentes
// src/components/admin/[Componente].tsx

// 5. Verificar event handlers
// src/lib/event-handlers.ts
```

---

## 2. Como Criar Migrations Prisma

### 2.1 Processo Correcto

```bash
# PASSO 1 — Alteração no schema
# Editar prisma/schema.prisma com a mudança desejada

# PASSO 2 — Verificar o impacto ANTES de criar a migration
# Rever se a mudança pode corromper dados existentes

# PASSO 3 — Criar a migration com nome descritivo
npx prisma migrate dev --name descricao_da_mudanca

# PASSO 4 — Verificar o SQL gerado
cat prisma/migrations/*/migration.sql | tail -50

# PASSO 5 — Actualizar o seed se necessário
# Editar prisma/seed.js

# PASSO 6 — Verificar que o cliente foi regenerado
# @prisma/client actualiza automaticamente com migrate dev
```

### 2.2 Convenção de Nomes de Migration

```
✅ CORRECTO:
  20240115000000_add_employee_department_field
  20240115000001_create_room_pricing_table
  20240115000002_add_reservation_number_index

❌ ERRADO:
  20240115000000_update
  20240115000001_fix
  20240115000002_new_stuff
```

### 2.3 Tipos de Mudanças e Riscos

```sql
-- ✅ SEGURO — adicionar coluna nullable
ALTER TABLE "Lead" ADD COLUMN "company" TEXT;

-- ✅ SEGURO — adicionar coluna com default
ALTER TABLE "Company" ADD COLUMN "numEmployees" INTEGER NOT NULL DEFAULT 1;

-- ✅ SEGURO — criar nova tabela
CREATE TABLE "Employee" (...);

-- ✅ SEGURO — criar índice
CREATE INDEX "Lead_status_idx" ON "Lead"("status");

-- ⚠️ PERIGOSO — adicionar coluna NOT NULL sem default (falha se existirem dados)
ALTER TABLE "Lead" ADD COLUMN "newField" TEXT NOT NULL;
-- SOLUÇÃO: fazer em 2 passos (1: add nullable, 2: fill data, 3: add NOT NULL)

-- ⚠️ PERIGOSO — renomear coluna (dados migrados automaticamente?)
ALTER TABLE "Lead" RENAME COLUMN "oldName" TO "newName";
-- Verificar se Prisma/Postgres migra os dados

-- ❌ NUNCA em produção sem backup — drop de coluna com dados
ALTER TABLE "Lead" DROP COLUMN "email";
```

### 2.4 Checklist de Migration

```
□ A migration foi testada em base de dados limpa?
□ A migration foi testada com dados existentes?
□ O schema.prisma está actualizado e consistente?
□ O domain-model.md foi actualizado?
□ Os índices necessários foram adicionados?
□ As cascade rules estão correctas?
□ O seed.js foi actualizado se necessário?
□ Os tipos TypeScript foram regenerados?
```

---

## 3. Como Utilizar o Event Bus

### 3.1 Publicar um Evento

```typescript
import { publish } from "@/lib/event-bus";

// ✅ CORRECTO — publicar APÓS a operação principal ser persistida
const lead = await prisma.lead.create({ data: leadData });

// Só publicar depois de confirmar que a criação foi bem-sucedida
await publish("lead.created", {
  leadId: lead.id,
  firstName: lead.firstName,
  lastName: lead.lastName,
  email: lead.email,
  source: lead.source ?? "landing-page",
});

// ❌ ERRADO — publicar antes da persistência
await publish("lead.created", { ... });           // e se o create falhar?
const lead = await prisma.lead.create({ data });
```

### 3.2 Subscrever a um Evento

```typescript
import { subscribe } from "@/lib/event-bus";

// Registar handlers em src/lib/event-handlers.ts ou src/instrumentation.ts
subscribe("lead.created", async (payload) => {
  try {
    await createNotification({
      type: "SUCCESS",
      title: "Novo Lead",
      message: `${payload.firstName} ${payload.lastName} (${payload.email})`
    });
  } catch (error) {
    // ✅ CORRECTO — sempre capturar erros em handlers
    // Um handler com erro não deve afectar outros handlers
    console.error("[EventHandler] lead.created notification failed:", error);
  }
});
```

### 3.3 Adicionar Novo Evento ao Catálogo

```typescript
// 1. Adicionar o tipo em src/lib/event-bus.ts
export type AppEventMap = {
  // ... eventos existentes ...
  
  // NOVO EVENTO
  "employee.statusChanged": {
    employeeId: string;
    companyId: string;
    oldStatus: string;
    newStatus: string;
    changedBy?: string;
  };
};

// 2. Publicar onde o evento ocorre
await publish("employee.statusChanged", {
  employeeId: employee.id,
  companyId: employee.companyId,
  oldStatus: oldStatus,
  newStatus: newStatus,
  changedBy: session?.email,
});

// 3. Registar handlers em event-handlers.ts
subscribe("employee.statusChanged", async (payload) => {
  await addTimeline(prisma, {
    type: "COLABORADOR_ACTUALIZADO",
    title: `Colaborador ${payload.newStatus.toLowerCase()}`,
    companyId: payload.companyId,
    referenceId: payload.employeeId,
    referenceType: "Employee",
    createdBy: payload.changedBy,
  });
});
```

### 3.4 Regras do Event Bus

```
□ Eventos são publicados DEPOIS da operação principal
□ Handlers sempre têm try/catch
□ Handlers são idempotentes (safe to retry)
□ Nenhum handler bloqueia a resposta ao cliente (async)
□ Eventos representam factos passados ("lead.created", não "createLead")
□ Payload contém apenas dados necessários (não o objecto completo)
□ Novos eventos são adicionados ao catálogo em event-bus.ts
□ Documentar no ADR se o evento afectar múltiplos módulos
```

---

## 4. Como Preservar Single Source of Truth

### 4.1 Regra Fundamental

> *Cada dado tem exactamente um lugar onde vive. Todos os outros lugares lêem desse lugar. Nunca copiam.*

### 4.2 Exemplos Práticos

```typescript
// ❌ VIOLAÇÃO SSoT — copiar nome de empresa para Reservation
const reservation = await prisma.reservation.create({
  data: {
    companyName: company.name,          // cópia! o nome pode mudar
    companyEmail: company.email,        // cópia!
    companyId: company.id,              // FK ← isto é suficiente
    // ...
  }
});

// ✅ CORRECTO — guardar apenas a FK, ler via include
const reservation = await prisma.reservation.findUnique({
  where: { id },
  include: { company: true }  // nome sempre actualizado
});
// usar: reservation.company?.name

// EXCEPÇÃO VÁLIDA: quando o cliente é EXTERNO (sem companyId)
// Neste caso, companyName é o único registo do cliente → não é duplicação
```

```typescript
// ❌ VIOLAÇÃO SSoT — recalcular total em componente React
function InvoiceCard({ invoice }) {
  const total = invoice.amount - invoice.discount + invoice.amount * invoice.iva / 100;
  // ← ERRADO: recalcular o que já está em invoice.totalAmount
  
// ✅ CORRECTO — usar o valor calculado pelo servidor
function InvoiceCard({ invoice }) {
  return <span>{formatKz(invoice.totalAmount)}</span>;  // ← SSoT
```

```typescript
// ❌ VIOLAÇÃO SSoT — saldo calculado a partir de lista de pagamentos no frontend
const balance = company.payments
  .filter(p => p.status === "PENDENTE")
  .reduce((acc, p) => acc + p.amount, 0);

// ✅ CORRECTO — saldo vem do FinancialHistory.runningBalance (SSoT)
const lastHistory = await prisma.financialHistory.findFirst({
  where: { companyId: company.id },
  orderBy: { createdAt: "desc" }
});
const balance = lastHistory?.runningBalance ?? 0;
```

### 4.3 Quando é Permitido Ter Dados Derivados?

Dados derivados (calculados a partir de outros) são permitidos quando:
1. São calculados **no servidor** pelo service correspondente
2. São **guardados** no campo correcto (ex: `Invoice.totalAmount`)
3. São **actualizados** automaticamente quando os dados base mudam

---

## 5. Como Documentar Alterações

### 5.1 Checklist de Documentação por Tipo de Alteração

**Novo campo no schema:**
```
□ prisma/schema.prisma actualizado
□ Migration criada com nome descritivo
□ docs/00-foundation/domain-model.md actualizado (tabela de campos)
□ docs/business-bible/README.md actualizado (se nova regra)
```

**Nova API Route:**
```
□ Contrato de API documentado (método, auth, request, responses, side effects)
□ docs/modules/[módulo]/README.md actualizado
□ Business Bible verificada e actualizada se nova regra
```

**Novo componente significativo:**
```
□ Comentário JSDoc no componente com propósito e props
□ docs/modules/[módulo]/README.md actualizado
```

**Nova decisão arquitectural:**
```
□ ADR criado em docs/adr/ADR-NNN-titulo.md
□ docs/adr/README.md índice actualizado
□ Referência ao ADR no ficheiro de código correspondente
```

**Bug fix com implicação de regra de negócio:**
```
□ Business Bible actualizada/corrigida
□ Comentário no código explicando a regra
□ Teste adicionado para prevenir regressão
```

### 5.2 Formato de Comentários no Código

```typescript
/**
 * confirmPayment — Orquestra a confirmação de pagamento de uma reserva.
 *
 * Fluxo (10 passos atómicos — ver docs/business-bible/README.md#BR-022):
 * 1. Carregar reserva + plano
 * 2. Encontrar ou criar Invoice (nunca duplicar)
 * 3. Criar InvoicePayment (parcela)
 * 4. Recalcular amountPaid / balance / paidPercentage / status
 * 5. Actualizar Payment record
 * 6. Actualizar Reservation
 * 7. Gerar LiquidationNote (NL-YYYY-NNNNNN) — ver BR-022
 * 8. Registar FinancialHistory (se empresa ligada)
 * 9. Adicionar Timeline
 * 10. Criar FinancialAudit (imutável — ver BR-026)
 *
 * @throws Error se reserva não encontrada ou já paga
 * @see docs/business-bible/README.md#BR-022
 * @see docs/adr/README.md#ADR-003
 */
export async function confirmPayment(prisma: PrismaClient, input: ConfirmPaymentInput) { ... }
```

---

## 6. Como Escrever Testes

### 6.1 Estrutura de Testes (quando Vitest for instalado)

```
src/
├── lib/
│   ├── finance-service.ts
│   └── finance-service.test.ts    ← teste junto do ficheiro
├── app/
│   └── api/
│       └── leads/
│           ├── route.ts
│           └── route.test.ts      ← teste da API Route
tests/
├── integration/
│   └── payment-flow.test.ts       ← teste de integração
└── e2e/
    └── lead-conversion.spec.ts    ← E2E com Playwright (Fase 1)
```

### 6.2 Template de Teste Unitário

```typescript
// finance-service.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { confirmPayment } from "./finance-service";

// Mock do Prisma
const mockPrisma = {
  reservation: {
    findUnique: vi.fn(),
    update: vi.fn(),
  },
  invoice: {
    findFirst: vi.fn(),
    create: vi.fn(),
    count: vi.fn(),
    update: vi.fn(),
  },
  invoicePayment: { create: vi.fn() },
  payment: { create: vi.fn(), count: vi.fn() },
  liquidationNote: { create: vi.fn(), count: vi.fn() },
  financialAudit: { create: vi.fn() },
  $transaction: vi.fn((fn) => fn(mockPrisma)),
};

describe("FinanceService.confirmPayment", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("deve lançar erro se reserva não existe", async () => {
    mockPrisma.reservation.findUnique.mockResolvedValue(null);
    
    await expect(confirmPayment(mockPrisma as any, {
      reservationId: "non-existent",
      amount: 50000,
    })).rejects.toThrow("Reserva não encontrada");
  });

  it("deve gerar número de fatura no formato correcto", async () => {
    // setup mocks...
    const result = await confirmPayment(mockPrisma as any, { ... });
    
    expect(result.invoiceNumber).toMatch(/^FT-SALA-\d{4}-\d{6}$/);
  });

  it("deve calcular balance correctamente após pagamento parcial", async () => {
    // totalAmount = 100000, pagamento = 60000
    const result = await confirmPayment(mockPrisma as any, {
      reservationId: "res-1",
      amount: 60000,
    });
    
    expect(result.balance).toBe(40000);
    expect(result.paidPercentage).toBe(60);
    expect(result.invoiceStatus).toBe("PARCIAL");
  });
});
```

### 6.3 Prioridade de Testes

```
PRIORIDADE 1 — CRÍTICA (implementar AGORA):
  □ FinanceService.confirmPayment — lógica financeira complexa
  □ PricingService.calculateReservationTotal — cálculo de preços
  □ Middleware auth — verificação JWT e roles
  □ API /api/reservations — verificação de conflitos (BR-030)

PRIORIDADE 2 — ALTA (implementar na Fase 0):
  □ API /api/leads — criação e conversão
  □ API /api/companies — criação e actualização
  □ API /api/payments — criação e actualização

PRIORIDADE 3 — MÉDIA (implementar na Fase 1):
  □ Componentes React — renderização correcta
  □ Formulários — validação client-side
  □ Testes E2E — fluxos principais
```

---

## 7. Como Validar Mudanças

### 7.1 Checklist Pre-Submit

```
CÓDIGO:
□ Sem any TypeScript não justificado
□ Sem console.log de debug
□ Sem credenciais hardcoded
□ Operações multi-tabela usam $transaction
□ Eventos publicados após persistência (não antes)
□ Input validado no servidor
□ Auth verificada em endpoints protegidos
□ Rate limiting em endpoints públicos

BASE DE DADOS:
□ Migration criada e testada
□ Dados existentes não corrompidos
□ Índices adicionados onde necessário
□ Cascade rules correctas

NEGÓCIO:
□ Regras Business Bible respeitadas
□ SSoT preservado (sem duplicação de dados)
□ Numeração de documentos correcta (FT-, REC-, NL-, RES-)
□ Auditoria financeira activa para operações sensíveis

DOCUMENTAÇÃO:
□ domain-model.md actualizado (se schema mudou)
□ Business Bible actualizada (se nova regra)
□ ADR criado (se decisão arquitectural)
□ Comentários JSDoc em funções públicas importantes
```

### 7.2 Teste Manual Obrigatório

Antes de considerar qualquer feature completa, executar manualmente:

1. **Fluxo feliz:** O caso principal funciona como esperado
2. **Casos de erro:** Dados inválidos são rejeitados com mensagens claras
3. **Sem auth:** Endpoint protegido rejeita pedido sem cookie
4. **Role errado:** Utilizador sem permissão é redireccionado, não recebe 500
5. **Dados existentes:** Nenhum dado existente foi corrompido

---

## 8. Como Evitar Regressões

### 8.1 Antes de Alterar Código Existente

```typescript
// 1. Identificar todos os callers da função a alterar
// Usar: grep -r "nomeDaFuncao" src/

// 2. Verificar que a signature não muda (ou que todos os callers são actualizados)

// 3. Se a lógica muda, verificar os critérios de aceitação da Business Bible

// 4. Adicionar teste antes de alterar (TDD regressivo)
```

### 8.2 Padrões que Causam Regressões

```typescript
// ⚠️ CUIDADO — alterar o formato de número de documento
// FT-SALA-2026-000001 → FT-2026-000001
// Isto quebraria: relatórios, busca por número, dados históricos
// NUNCA alterar formato de numeração sem migration de dados

// ⚠️ CUIDADO — alterar assinatura de service público
export async function confirmPayment(
  prisma: PrismaClient,
  input: ConfirmPaymentInput     // ← não alterar sem actualizar todos os callers
): Promise<ConfirmPaymentResult> { ... }

// ⚠️ CUIDADO — alterar estados de entidades
// PENDENTE → AGUARDANDO_PAGAMENTO
// Dados históricos ficam com o estado antigo → verificação de estado falha

// ⚠️ CUIDADO — alterar estrutura de payload de eventos
// Handlers que dependem de payload.X falham se X for removido
```

---

## 9. Como Manter Compatibilidade

### 9.1 Estratégia de Versionamento de APIs

Para a fase actual (API interna apenas), não há versioning formal. Quando a API pública for implementada (Fase 2), usar `/api/v1/`, `/api/v2/`.

### 9.2 Migrations sem Downtime

Para alterações de schema em produção:

```
PASSO 1 (deploy 1): Adicionar novo campo nullable
PASSO 2 (job): Popular o novo campo para dados existentes  
PASSO 3 (deploy 2): Adicionar constraint NOT NULL
PASSO 4 (deploy 3): Remover código que usa o campo antigo
PASSO 5 (deploy 4): Drop do campo antigo
```

### 9.3 Feature Flags (para o futuro)

Para features em desenvolvimento que não devem estar visíveis em produção, usar environment variables:

```typescript
// next.config.js
const features = {
  portalCliente: process.env.FEATURE_PORTAL_CLIENTE === "true",
  apiPublica: process.env.FEATURE_API_PUBLICA === "true",
};
```

---

## 10. Como Rever Código Antes da Entrega

### 10.1 Auto-revisão Obrigatória

Antes de entregar qualquer trabalho, simular a perspectiva de um revisor externo:

```
PERSPECTIVA DO ARQUITETO:
□ Esta solução é a mais simples possível?
□ Esta solução escala bem?
□ Esta solução viola algum princípio SOLID ou DRY?
□ Existe acoplamento desnecessário?
□ A solução está correctamente posicionada nas camadas?

PERSPECTIVA DO ENGENHEIRO DE QUALIDADE:
□ Que casos de edge podem falhar?
□ O que acontece se a base de dados estiver lenta?
□ O que acontece se o evento não for processado?
□ Esta mudança pode corromper dados existentes?

PERSPECTIVA DO RESPONSÁVEL DE SEGURANÇA:
□ Esta mudança expõe dados sensíveis?
□ Esta mudança pode ser explorada por input malicioso?
□ Esta mudança respeita o RBAC?
□ Esta mudança tem auditoria adequada?

PERSPECTIVA DO PRODUCT OWNER:
□ Esta implementação cumpre exactamente o que foi pedido?
□ Há algo que o utilizador pode querer e que não está contemplado?
□ Esta implementação segue as regras de negócio (Business Bible)?
```

### 10.2 Questões de Qualidade Final

```
□ O código que vou entregar é o código que eu gostaria de herdar?
□ Um developer competente que chegasse agora conseguia entender este código?
□ A documentação está suficientemente actualizada para que Claude na próxima sessão entenda o que foi feito?
□ Existe algum "TODO" ou "FIXME" que deveria ser resolvido antes de entregar?
```

---

## Apêndice A — Ficheiros Críticos do Projecto

| Ficheiro | Propósito | Quando Ler |
|---|---|---|
| `prisma/schema.prisma` | Schema da base de dados | SEMPRE, antes de qualquer trabalho |
| `src/middleware.ts` | Autenticação e RBAC | Antes de alterar rotas ou auth |
| `src/lib/auth.ts` | Criação e destruição de sessão | Antes de alterar auth |
| `src/lib/finance-service.ts` | Orquestrador financeiro | Antes de qualquer operação financeira |
| `src/lib/event-bus.ts` | Catálogo de eventos | Antes de publicar novos eventos |
| `src/lib/event-handlers.ts` | Handlers de eventos | Antes de registar novos handlers |
| `src/lib/pricing-service.ts` | Cálculo de preços | Antes de alterar preçário |
| `src/lib/finance.ts` | Histórico financeiro | Antes de alterar registo de movimentos |
| `src/lib/timeline.ts` | Registo de timeline | Antes de adicionar novos eventos à timeline |
| `src/lib/prisma.ts` | Singleton Prisma | Nunca duplicar — usar sempre esta instância |
| `src/lib/validators.ts` | Validação de input | Antes de adicionar novos endpoints públicos |
| `src/lib/rateLimit.ts` | Rate limiting | Antes de adicionar endpoints públicos |
| `next.config.js` | Headers de segurança | Antes de alterar CSP ou domínios externos |

## Apêndice B — Comandos Úteis

```bash
# Explorar schema Prisma de forma interactiva
npx prisma studio

# Regenerar cliente Prisma após alterar schema
npx prisma generate

# Criar nova migration
npx prisma migrate dev --name nome_da_migration

# Ver status das migrations
npx prisma migrate status

# Popular base de dados com dados iniciais
node prisma/seed.js

# Build de produção
npm run build

# Verificar tipos TypeScript
npx tsc --noEmit

# Procurar usos de uma função
grep -r "nomeDaFuncao" src/ --include="*.ts" --include="*.tsx"

# Ver todos os endpoints da API
find src/app/api -name "route.ts" | sort

# Ver todos os componentes admin
find src/components/admin -name "*.tsx" | sort
```

---

*VD Platform — Claude Code Guide v1.0.0 — Julho 2026*  
*Actualizar este documento sempre que os padrões evoluam*
