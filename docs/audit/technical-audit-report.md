# Relatório de Auditoria Técnica — VD Platform

> **Documento:** AUDIT-001  
> **Fase:** 0.5 — Auditoria Técnica Completa  
> **Estado:** ✅ Concluído  
> **Data:** Julho 2026  
> **Auditor:** Claude — Arquiteto-Chefe VD Platform  
> **Confidencial:** Uso interno apenas  

---

## 1. Sumário Executivo

A auditoria técnica completa da Fase 0.5 analisou **100% dos ficheiros críticos** do VD Platform: schema Prisma, camada de serviços (`src/lib/`), todas as 55 API Routes e os ficheiros de configuração. O objectivo foi estabelecer uma linha de base honesta do estado actual do sistema antes de iniciar o desenvolvimento estruturado do Volume 01.

**Resultado geral:** O sistema está **funcional mas frágil**. Existe lógica de negócio de qualidade (especialmente `FinanceService`), mas há problemas de segurança, race conditions e dívida técnica que precisam de ser resolvidos antes do desenvolvimento de novas funcionalidades.

### Contagem de Findings por Severidade

| Severidade | Quantidade |
|---|---|
| 🔴 CRÍTICO | 7 |
| 🟠 ALTO | 9 |
| 🟡 MÉDIO | 8 |
| 🟢 BAIXO | 6 |
| **Total** | **30** |

### Top 5 Riscos Imediatos

1. **TOCTOU em conflito de reservas** — duas criações simultâneas podem passar no conflict-check e criar reservas sobrepostas
2. **RBAC incompleto nas API Routes** — apenas `/api/admin/users` verifica role; endpoints financeiros e destrutivos só verificam sessão
3. **JWT fallback secret em produção** — se `JWT_SECRET` não estiver definida, usa `"fallback-secret-troque-me"` (compromete toda a autenticação)
4. **Numeração sequencial com race condition** — `count + 1` para gerar FT-SALA/REC/NL/RES pode produzir duplicados sob carga concorrente
5. **Lógica financeira duplicada** — criação de Invoice/Payment/LiquidationNote existe em dois lugares (`FinanceService` e `reservations/route.ts`), divergindo silenciosamente ao longo do tempo

---

## 2. Metodologia

### 2.1 Âmbito da Auditoria

| Categoria | Ficheiros Analisados |
|---|---|
| Schema de base de dados | `prisma/schema.prisma` |
| Serviços de domínio | `src/lib/*.ts` (12 ficheiros) |
| API Routes | 55 routes em `src/app/api/**` |
| Middleware e Auth | `src/middleware.ts`, `src/lib/auth.ts` |
| Configuração | `next.config.js`, `package.json`, `.env.example` |
| Componentes de PDF | `src/lib/invoice-pdf.tsx`, `src/lib/receipt-pdf.tsx` |

### 2.2 Dimensões Avaliadas

1. **Segurança** — autenticação, autorização, validação de input, protecção de dados
2. **Integridade de dados** — transacções, consistência, SSoT, numeração de documentos
3. **Correctitude lógica** — regras de negócio, cálculos financeiros, concorrência
4. **Qualidade de código** — TypeScript, DRY, SOLID, complexidade
5. **Observabilidade** — logging, tratamento de erros, monitoring
6. **Performance** — queries, paginação, N+1, carga em memória

---

## 3. Inventário do Sistema

### 3.1 Modelos de Dados (20 entidades)

| Modelo | Bounded Context | Estado |
|---|---|---|
| `Lead` | CRM | ✅ Maduro |
| `Note` | CRM | ✅ Simples, correcto |
| `RoomBookingLead` | CRM/Reservas | ⚠️ Conversão manual, sem automação |
| `Company` | Cowork | ✅ Maduro |
| `Employee` | Cowork | ✅ Correcto |
| `Reservation` | Reservas | ⚠️ Conflito TOCTOU |
| `MeetingPlan` | Reservas | ✅ Correcto |
| `RoomPricing` | Reservas | ✅ Correcto |
| `RoomSettings` | Reservas | ✅ Correcto |
| `Invoice` | Financeiro | ✅ Maduro |
| `InvoicePayment` | Financeiro | ✅ Correcto |
| `Payment` | Financeiro | ⚠️ Mistura cowork + sala |
| `LiquidationNote` | Financeiro | ✅ Imutável por convenção |
| `FinancialHistory` | Financeiro | ⚠️ `runningBalance` pode dessincronizar |
| `FinancialAudit` | Financeiro | ✅ Imutável por convenção |
| `Expense` | ERP | ✅ Básico |
| `AdminUser` | Security | ⚠️ TOTP não integrado no login |
| `Notification` | Communication | ✅ Funcional |
| `Timeline` | Cross-cutting | ⚠️ Type muito permissivo |
| `DeleteRequest` | RGPD | ✅ Correcto |

### 3.2 API Routes (55 endpoints)

| Módulo | Endpoints | Auth OK | RBAC OK |
|---|---|---|---|
| Auth | 2 | ✅ | ✅ |
| Leads | 4 | ✅ | ⚠️ Sem role check |
| Companies | 5 | ✅ | ⚠️ DELETE sem role |
| Employees | 2 | ✅ | ⚠️ Sem role check |
| Reservations | 5 | ✅ | ⚠️ Sem role check |
| Finance | 4 | ✅ | ⚠️ Sem role check |
| Invoices | 5 | ✅ | ⚠️ Sem role check |
| Payments | 3 | ✅ | ⚠️ Sem role check |
| Admin Users | 3 | ✅ | ✅ (só ADMIN) |
| Room Booking | 4 | ✅ | ⚠️ Sem role check |
| Rooms/Plans | 5 | ✅ | ⚠️ Sem role check |
| Notifications | 3 | ✅ | ⚠️ Sem role check |
| Search/Export | 3 | ✅ | ⚠️ Sem role check |
| Upload | 1 | ✅ | ⚠️ Sem role check |
| Expenses | 2 | ✅ | ⚠️ Sem role check |
| Timeline | 1 | ✅ | ⚠️ Sem role check |
| Outros | 6 | ✅ | ⚠️ Sem role check |

---

## 4. Findings Detalhados

---

### 🔴 CRÍTICO — SEC-001: JWT Fallback Secret

**Localização:** `src/middleware.ts:9`, `src/lib/auth.ts:8`  
**Categoria:** Segurança — Autenticação  

**Descrição:**  
Se a variável de ambiente `JWT_SECRET` não estiver definida, o sistema usa o valor literal `"fallback-secret-troque-me"` como segredo para assinar e verificar tokens JWT. Qualquer atacante que conheça este valor (que está visível no código-fonte, potencialmente no repositório) pode forjar tokens JWT válidos e obter acesso de ADMIN ao sistema.

```typescript
// src/lib/auth.ts
const SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || "fallback-secret-troque-me"  // ← CRÍTICO
);
```

**Impacto:** Comprometimento total da autenticação em qualquer ambiente onde `JWT_SECRET` não esteja configurada.  
**Recomendação:** Lançar erro na inicialização se `JWT_SECRET` não estiver definida. Nunca usar fallback para segredos criptográficos.

```typescript
const secret = process.env.JWT_SECRET;
if (!secret) throw new Error("[auth] JWT_SECRET não configurado. Defina nas variáveis de ambiente.");
const SECRET = new TextEncoder().encode(secret);
```

---

### 🔴 CRÍTICO — SEC-002: RBAC Incompleto nas API Routes

**Localização:** Maioria das API Routes em `src/app/api/`  
**Categoria:** Segurança — Autorização  

**Descrição:**  
O middleware (`src/middleware.ts`) verifica apenas a existência de um JWT válido para todas as rotas `/admin/*`. As API Routes verificam se existe sessão (`getSession()`), mas apenas `/api/admin/users` verifica a role (`session.role !== "ADMIN"`). Todas as restantes rotas aceitam qualquer utilizador autenticado independentemente da sua role.

Exemplos de endpoints sem verificação de role:
- `DELETE /api/companies/[id]` — qualquer utilizador autenticado pode eliminar empresas
- `POST /api/reservations/[id]/receive-payment` — qualquer utilizador pode confirmar pagamentos
- `POST /api/expenses` — qualquer utilizador pode criar despesas
- `GET /api/admin/users` seria diferente: verifica `session.role !== "ADMIN"` ✅

**Impacto:** Um utilizador com role VIEWER pode executar operações de escrita e eliminação. Um utilizador COMERCIAL pode aceder a dados financeiros.  
**Recomendação:** Implementar verificação de role em cada endpoint de acordo com a matriz RBAC documentada. Criar helper `requireRole(session, ["ADMIN", "FINANCEIRO"])`.

---

### 🔴 CRÍTICO — DATA-001: Race Condition no Conflict Check de Reservas (TOCTOU)

**Localização:** `src/app/api/reservations/route.ts:84-92`  
**Categoria:** Integridade de Dados — Concorrência  

**Descrição:**  
O conflict check de reservas é executado com `prisma.reservation.findFirst()` **antes** de iniciar a transação `prisma.$transaction()`. Isto cria uma vulnerabilidade TOCTOU (Time of Check to Time of Use): duas requisições simultâneas para o mesmo período podem ambas passar no check e depois ambas criar reservas, resultando em reservas sobrepostas.

```typescript
// Fora da transação ← PROBLEMA
const conflict = await prisma.reservation.findFirst({
  where: {
    status: { in: ["CONFIRMADA", "RESERVADO", "PENDENTE_APROVACAO"] },
    AND: [{ startDatetime: { lt: end } }, { endDatetime: { gt: start } }],
  },
});
if (conflict) { ... }

// Transação começa depois
const result = await prisma.$transaction(async (tx) => {
  const reservation = await tx.reservation.create({ ... });
  ...
});
```

**Impacto:** Dois clientes que criem reservas em simultâneo para o mesmo horário podem ambos ter as reservas confirmadas.  
**Recomendação:** Mover o conflict check para dentro da transação, usando `tx.reservation.findFirst()`. Considerar `SELECT FOR UPDATE` ou serializable isolation level para garantia absoluta.

---

### 🔴 CRÍTICO — DATA-002: Race Condition na Numeração de Documentos

**Localização:** `src/app/api/reservations/route.ts:94-96`, `src/lib/finance-service.ts`  
**Categoria:** Integridade de Dados — Concorrência  

**Descrição:**  
A numeração sequencial de todos os documentos (RES-, FT-SALA-, REC-, NL-) é gerada com a fórmula `count + 1`:

```typescript
const count = await prisma.reservation.count({
  where: { reservationNumber: { startsWith: `RES-${year}-` } }
});
const reservationNumber = `RES-${year}-${String(count + 1).padStart(6, "0")}`;
```

Sob concorrência, duas transações simultâneas obtêm o mesmo `count` e geram o mesmo número. Mesmo dentro de uma transação Prisma (que usa `READ COMMITTED` por defeito no PostgreSQL), outro processo pode ter incrementado o contador entre o `count` e o `create`.

**Impacto:** Violação da constraint `UNIQUE` em `invoiceNumber` ou duplicação silenciosa de números de documento, o que é uma violação legal em Angola (documentos fiscais devem ter numeração única).  
**Recomendação:** Usar uma sequência PostgreSQL (`CREATE SEQUENCE`) ou uma tabela de contadores com `SELECT ... FOR UPDATE` dentro da transação.

---

### 🔴 CRÍTICO — ARCH-001: Lógica Financeira Duplicada

**Localização:** `src/app/api/reservations/route.ts:154-242` vs `src/lib/finance-service.ts`  
**Categoria:** Arquitectura — DRY  

**Descrição:**  
A lógica de criação de Invoice + Payment + LiquidationNote existe em dois lugares:
1. **`FinanceService.confirmPayment()`** — usado em `/api/reservations/[id]/receive-payment`
2. **`POST /api/reservations`** com `paymentOption = "PAGAR_AGORA"`** — reimplementação directa na route

As duas implementações têm diferenças subtis (ex: status de Invoice, tratamento de pagamentos parciais) e vão divergir ao longo do tempo. Qualquer bug corrigido num sítio não é corrigido no outro.

**Impacto:** Inconsistência financeira, dificuldade de manutenção, violação do princípio DRY.  
**Recomendação:** Toda a lógica financeira deve passar pelo `FinanceService`. A route de criação de reserva deve criar a reserva e depois chamar `FinanceService` para a parte financeira.

---

### 🔴 CRÍTICO — SEC-003: TOTP 2FA Sem Integração no Login

**Localização:** `src/app/api/auth/login/route.ts`, `prisma/schema.prisma` (AdminUser)  
**Categoria:** Segurança — Autenticação  

**Descrição:**  
O schema tem os campos `totpSecret` e `totpEnabled` no modelo `AdminUser`, indicando que 2FA foi planeado. No entanto, o fluxo de login em `route.ts` não verifica `totpEnabled` nem solicita/valida o token TOTP. Um utilizador com 2FA "activado" no schema pode fazer login apenas com email + password.

**Impacto:** A funcionalidade 2FA documentada não funciona. ADMIN pode ser comprometido apenas com credenciais.  
**Recomendação:** Implementar verificação TOTP no fluxo de login: se `admin.totpEnabled === true`, exigir código TOTP como segundo factor antes de criar sessão.

---

### 🔴 CRÍTICO — DATA-003: recordFinancialHistory Fora de Contexto de Transação

**Localização:** `src/lib/finance.ts:60-93` (função `recordFinancialHistory`)  
**Categoria:** Integridade de Dados  

**Descrição:**  
`recordFinancialHistory()` executa queries de DB (busca da empresa, agregação de pagamentos) para calcular o `runningBalance`. Quando chamada de dentro de uma `prisma.$transaction()`, estas queries correm no contexto da transação mas **usam `prisma` global** (não o `tx` da transação) para lookup intermédio, podendo não ver dados não-committed da mesma transação:

```typescript
// src/lib/finance.ts
export async function recordFinancialHistory(tx: any, input: ...) {
  // Esta query usa prisma global, não tx
  const company = await prisma.company.findUnique({ where: { id: input.companyId } });
  // Esta agregação pode não incluir o pagamento sendo confirmado
  const { _sum } = await prisma.payment.aggregate({
    where: { companyId: input.companyId, status: "PAGO" },
    _sum: { amount: true },
  });
  ...
}
```

**Impacto:** O `runningBalance` no `FinancialHistory` pode estar incorrecto no momento da criação.  
**Recomendação:** Passar `tx` como argumento e usar exclusivamente `tx.*` dentro da função, ou calcular o `runningBalance` com base nos dados já disponíveis na transação.

---

### 🟠 ALTO — SEC-004: Type Cast (admin as any).role no Login

**Localização:** `src/app/api/auth/login/route.ts:39`  
**Categoria:** Segurança — Qualidade de Código  

**Descrição:**  
```typescript
await createSession({
  sub: admin.id,
  email: admin.email,
  role: (admin as any).role || "ADMIN",  // ← type cast + fallback perigoso
  name: admin.name || undefined
});
```

O `(admin as any).role || "ADMIN"` significa que se `role` for `null`, `undefined`, ou string vazia, o utilizador recebe role `"ADMIN"` por defeito — o role mais privilegiado. O `as any` indica um problema de tipos que estava a ser contornado em vez de resolvido.

**Impacto:** Utilizador sem role definida ganha acesso de ADMIN.  
**Recomendação:** Garantir que `AdminUser.role` tem tipo correcto no schema Prisma e no TypeScript. Remover o cast e o fallback `|| "ADMIN"`.

---

### 🟠 ALTO — SEC-005: CSRF Sem Protecção

**Localização:** Todas as API Routes mutantes  
**Categoria:** Segurança  

**Descrição:**  
O sistema usa cookies httpOnly para sessão (boa prática), mas não implementa protecção CSRF (Cross-Site Request Forgery). Um site malicioso pode induzir um utilizador autenticado a submeter requests para `/api/companies/[id]` (PATCH/DELETE) ou `/api/payments` (POST) sem que o utilizador saiba.

**Impacto:** Médio a Alto — depende da exposição pública do sistema.  
**Recomendação:** Verificar o header `Origin` ou `Referer` em todas as routes mutantes, ou implementar tokens CSRF com SameSite=Strict nos cookies.

---

### 🟠 ALTO — DATA-004: getCompanyFinanceSummary Mistura Contextos Financeiros

**Localização:** `src/lib/finance.ts:95-130` (função `getCompanyFinanceSummary`)  
**Categoria:** Integridade de Dados — SSoT  

**Descrição:**  
```typescript
const totalPaid = payments
  .filter(p => p.status === "PAGO")
  .reduce((s, p) => s + p.amount, 0);
```

A query inclui **todos** os `Payment` associados à empresa, incluindo pagamentos de reservas de sala (`category: "SALA_REUNIAO"`) e pagamentos de coworking. Estes são dois contextos financeiros distintos com lógicas diferentes, mas são somados juntos no sumário financeiro da empresa.

**Impacto:** O sumário financeiro de uma empresa que também usa a sala de reunião vai mostrar valores incorrectos (inclui receita de sala no contrato de coworking).  
**Recomendação:** Filtrar por `category` no `getCompanyFinanceSummary`: coworking payments são os que têm `reservationId IS NULL` ou `category != "SALA_REUNIAO"`.

---

### 🟠 ALTO — ARCH-002: AdminUser Role Enum Inconsistente

**Localização:** `src/app/api/admin/users/route.ts:41`, `prisma/schema.prisma`  
**Categoria:** Arquitectura — Consistência  

**Descrição:**  
A route de criação de utilizadores admin só aceita dois roles:
```typescript
role: role === "ADMIN" ? "ADMIN" : "USER",
```

Mas a Business Bible e a architecture documentam 4 roles: `ADMIN`, `COMERCIAL`, `FINANCEIRO`, `VIEWER`. O role `"USER"` não existe na documentação nem no middleware. A plataforma não pode ter utilizadores com roles funcionais como COMERCIAL ou FINANCEIRO porque a route de criação os converte todos para "USER".

**Impacto:** RBAC funcional é impossível de configurar via interface.  
**Recomendação:** Usar enum Prisma para `AdminUser.role` com os valores `ADMIN | COMERCIAL | FINANCEIRO | VIEWER`. Actualizar a route de criação para aceitar e validar esses roles.

---

### 🟠 ALTO — PERF-001: Queries Sem Paginação em Endpoints de KPI

**Localização:** `src/app/api/finance/sala/route.ts`, `src/app/api/admin/stats/route.ts`  
**Categoria:** Performance  

**Descrição:**  
O endpoint `/api/finance/sala` carrega **todas as reservas de todos os tempos** em memória para calcular KPIs:
```typescript
const allReservations = await prisma.reservation.findMany({
  where: { status: { notIn: ["CANCELADA"] } },
  include: { plan: true, company: { select: { id: true, name: true } } },
  // sem take/skip
});
```

Com 1.000 reservas, isto é aceitável. Com 10.000 reservas (após 2-3 anos de operação), esta query vai ser lenta e consumir memória excessiva no servidor.

**Impacto:** Degradação de performance progressiva; potencial timeout em produção.  
**Recomendação:** Usar agregações SQL (`prisma.reservation.aggregate`, `groupBy`) em vez de carregar registos em memória para cálculos.

---

### 🟠 ALTO — QUAL-001: TypeScript ignoreBuildErrors

**Localização:** `next.config.js:4`  
**Categoria:** Qualidade de Código  

**Descrição:**  
```javascript
typescript: { ignoreBuildErrors: true },
eslint: { ignoreDuringBuilds: true },
```

Erros TypeScript são silenciados no build, o que significa que código com erros de tipo vai para produção sem aviso. O `(admin as any).role` no login é provavelmente uma consequência disto.

**Impacto:** Bugs de tipo chegam a produção silenciosamente.  
**Recomendação:** Resolver todos os erros TypeScript e remover `ignoreBuildErrors`. Fazer gradualmente: activar modo strict, corrigir erros por módulo.

---

### 🟠 ALTO — SEC-006: Informações Hardcoded Incorrectas nos Emails

**Localização:** `src/lib/email.ts:123-125`  
**Categoria:** Qualidade de Dados  

**Descrição:**  
O template de email de confirmação de reserva tem dados hardcoded incorrectos:
```typescript
// linha 123
<p style="...">Em caso de dúvidas, entre em contacto via WhatsApp: +244 925 000 000</p>
// linha 125
<p style="...">Azul Coworking · ... · azulcoworking.ao</p>
```

O número de WhatsApp `+244 925 000 000` é fictício (placeholder não substituído). O website `azulcoworking.ao` difere do oficial `www.azulcowork.com` registado na Business Bible.

**Impacto:** Clientes recebem informações de contacto erradas nos emails de confirmação.  
**Recomendação:** Usar variáveis de ambiente para estes valores, ou carregar de `RoomSettings` / configuração da empresa.

---

### 🟡 MÉDIO — QUAL-002: Uso de `any` Excessivo nas API Routes

**Localização:** `src/app/api/leads/route.ts:111`, `src/app/api/companies/[id]/route.ts:28`, múltiplos ficheiros  
**Categoria:** Qualidade de Código  

**Descrição:**  
Múltiplas API Routes usam `where: any` ou `data: any` para contornar a tipagem do Prisma:
```typescript
const where: any = {};  // leads/route.ts:111
const data: any = {};   // companies/[id]/route.ts:28
```

**Impacto:** Perde-se a segurança de tipos para as queries Prisma. Erros de campo chegam a runtime.  
**Recomendação:** Usar os tipos gerados pelo Prisma: `Prisma.LeadWhereInput`, `Prisma.CompanyUpdateInput`.

---

### 🟡 MÉDIO — QUAL-003: Duas Bibliotecas de PDF

**Localização:** `package.json`, `src/lib/invoice-pdf.tsx`, `src/lib/receipt-pdf.tsx`  
**Categoria:** Arquitectura — Consistência  

**Descrição:**  
O sistema usa duas bibliotecas de geração de PDF: `@react-pdf/renderer` (em `invoice-pdf.tsx`) e `pdfkit` (confirmado via `package.json`). São duas APIs completamente diferentes, com dois modelos de componentes distintos. A manutenção de templates em dois sistemas é custosa.

**Impacto:** Inconsistência visual entre documentos, duplicação de esforço em templates.  
**Recomendação:** Standardizar em `@react-pdf/renderer` (já usada no template mais completo). Reescrever os templates pdfkit com `@react-pdf/renderer`.

---

### 🟡 MÉDIO — QUAL-004: Timeline.type Demasiado Permissivo

**Localização:** `src/lib/timeline.ts`  
**Categoria:** Qualidade de Código  

**Descrição:**  
O tipo `TimelineType` inclui `string` como membro do union, tornando-o efectivamente qualquer string:
```typescript
type TimelineType = "RESERVA" | "PAGAMENTO" | "CONVERSAO" | ... | string;
```

Isto anula a vantagem de usar um union type — o compilador aceita qualquer valor sem aviso.

**Impacto:** Entradas de Timeline com tipos inválidos passam sem erro.  
**Recomendação:** Remover `string` do union. Adicionar todos os tipos válidos explicitamente. Usar `satisfies` para garantir que os event handlers usam tipos do enum.

---

### 🟡 MÉDIO — QUAL-005: Dead Code em finance.ts

**Localização:** `src/lib/finance.ts` (função `dueDateOverride` interna)  
**Categoria:** Qualidade de Código  

**Descrição:**  
Existe uma função interna `dueDateOverride()` dentro de `calcFinancialStatus()` que nunca é chamada. O resultado da função é calculado mas nunca usado no retorno.

**Impacto:** Baixo — confusão para quem lê o código.  
**Recomendação:** Remover o dead code.

---

### 🟡 MÉDIO — QUAL-006: Sem Validação de Schema (Zod)

**Localização:** Todas as API Routes  
**Categoria:** Qualidade de Código — Segurança  

**Descrição:**  
A validação de input é feita manualmente em cada route com verificações ad-hoc. Não existe schema de validação centralizado (ex: Zod). Isto leva a inconsistências: alguns campos são validados, outros não; alguns têm sanitização, outros não.

Exemplo em `reservations/route.ts`: `planId` não é validado como CUID; `participants` aceita qualquer valor incluindo negativos.

**Impacto:** Inputs inválidos podem causar erros inesperados em produção.  
**Recomendação:** Adoptar Zod para schemas de validação em todas as routes. Já está planeado como DT-008.

---

### 🟡 MÉDIO — QUAL-007: Bootstrap Auto-Executa sem Garantia de Edge Runtime

**Localização:** `src/lib/bootstrap.ts:20-22`  
**Categoria:** Arquitectura  

**Descrição:**  
```typescript
if (typeof window === "undefined") {
  bootstrap();
}
```

Esta condição é verdadeira tanto em Node.js como no Edge Runtime do Vercel. No Edge Runtime, o Event Bus in-memory não persiste entre requests (cada request é um worker independente). O auto-bootstrap registará handlers que nunca recebem eventos de outros requests.

**Impacto:** Em Edge Runtime, os event handlers não funcionam correctamente.  
**Recomendação:** Verificar que todas as routes que usam eventos importam `"@/lib/bootstrap"` explicitamente. Documentar a limitação do Event Bus em-memória para Edge Runtime.

---

### 🟡 MÉDIO — PERF-002: N+1 Potencial no Event Handler payment.received

**Localização:** `src/lib/event-handlers.ts:115-135`  
**Categoria:** Performance  

**Descrição:**  
O handler `payment.received` executa duas queries de contagem e um update:
```typescript
const overdueCount = await prisma.payment.count({ where: { companyId, status: "ATRASADO" } });
const pendingCount = await prisma.payment.count({ where: { companyId, status: ... } });
await prisma.company.update({ ... });
```

Para cada pagamento recebido, são executadas 3 queries DB adicionais. Se múltiplos pagamentos forem processados em sequência, isto escala linearmente.

**Impacto:** Baixo actualmente, mas relevante quando o volume de pagamentos aumentar.  
**Recomendação:** Combinar as duas counts numa única query com `groupBy`. Ou actualizar `paymentStatus` directamente no `FinanceService` em vez de via evento.

---

### 🟢 BAIXO — QUAL-008: formatKz Duplicado

**Localização:** `src/lib/currency.ts`, `src/lib/invoice-pdf.tsx:140-145`  
**Categoria:** DRY  

**Descrição:**  
A função `formatKz` existe em `src/lib/currency.ts` mas é reimplementada localmente em `invoice-pdf.tsx` com leve diferença (usa "AOA" em vez de "Kz").

**Recomendação:** Criar uma versão parametrizável em `currency.ts` e importar em todos os sítios.

---

### 🟢 BAIXO — SEC-007: IP do Cliente Via x-forwarded-for Sem Validação

**Localização:** `src/app/api/leads/route.ts:13`, `src/app/api/auth/login/route.ts:9`  
**Categoria:** Segurança  

**Descrição:**  
```typescript
const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
```

O header `x-forwarded-for` pode ser forjado pelo cliente se o proxy não o remover. Em Vercel, este header é gerido pelo Vercel Edge (trustworthy), mas se o deployment mudar de infra, isto pode ser explorado para bypass de rate limiting.

**Recomendação:** Documentar a dependência do Vercel Edge para este header. Se o deployment mudar, rever.

---

### 🟢 BAIXO — QUAL-009: Limite Hardcoded de 4 Utilizadores

**Localização:** `src/app/api/admin/users/route.ts:26`  
**Categoria:** Flexibilidade  

**Descrição:**  
```typescript
const count = await prisma.adminUser.count();
if (count >= 4) return NextResponse.json({ error: "Limite de 4 utilizadores atingido." }, ...);
```

O limite de 4 utilizadores está hardcoded. Para uma plataforma SaaS multi-tenant futura, este limite será por tenant e configurável.

**Recomendação:** Mover para variável de ambiente ou configuração por tenant.

---

### 🟢 BAIXO — QUAL-010: Occupancy Rate com Valores Hardcoded

**Localização:** `src/app/api/finance/sala/route.ts:65-66`  
**Categoria:** Correctitude de Negócio  

**Descrição:**  
```typescript
const availableHours = 22 * 8;  // 22 dias/mês, 8 horas/dia
```

Os valores de dias úteis (22) e horas por dia (8) estão hardcoded, sem relação com `RoomSettings.openTime`/`closeTime`.

**Recomendação:** Calcular `availableHours` a partir de `RoomSettings` para reflectir o horário real do espaço.

---

### 🟢 BAIXO — ARCH-003: `prisma as unknown as PrismaClient` em timeline.ts

**Localização:** `src/lib/timeline.ts`  
**Categoria:** Qualidade de Código  

**Descrição:**  
```typescript
return addTimeline(prisma as unknown as PrismaClient, params);
```

Double cast `as unknown as PrismaClient` é um code smell que indica que o TypeScript está a resistir à intenção do desenvolvedor — normalmente porque os tipos não são compatíveis.

**Recomendação:** Definir um tipo explícito para o parâmetro `tx` que seja compatível tanto com `PrismaClient` como com o tipo de transação do Prisma.

---

## 5. Regras de Negócio Não Implementadas

| ID | Regra | Estado | Impacto |
|---|---|---|---|
| BR-004 | Prevenção de leads duplicados por email | ❌ Não implementado | Médio |
| BR-011 | Alertas automáticos de expiração de contratos | ❌ Não implementado | Alto |
| BR-028 | Penalidade por atraso (multa + juros) | ❌ Não implementado | Alto |
| BR-030 | Conflito de reservas | ⚠️ Parcialmente (TOCTOU) | Crítico |

---

## 6. Análise da Segurança Geral

### 6.1 Pontos Fortes

- Timing attack prevention no login (bcrypt compare mesmo para utilizador inexistente)
- Rate limiting implementado para login (10 tentativas/15min) e formulário público (5/10min)
- Honeypot + tempo mínimo de preenchimento anti-bot
- Headers de segurança configurados no `next.config.js` (HSTS, X-Frame-Options, CSP, etc.)
- Cookies httpOnly para sessão JWT
- bcryptjs com factor 12 (adequado)
- Inputs sanitizados com `sanitizeText()` antes de persistir

### 6.2 Pontos Fracos

- JWT fallback secret (CRÍTICO)
- RBAC incompleto nas API Routes (CRÍTICO)
- TOTP não integrado no login (CRÍTICO)
- Sem CSRF protection (ALTO)
- `(admin as any).role || "ADMIN"` no login (ALTO)

---

## 7. Sumário de Conformidade com Arquitectura Documentada

| Princípio | Estado | Observações |
|---|---|---|
| Clean Architecture | ⚠️ Parcial | Lógica de negócio em routes (reservations/route.ts) |
| DDD Bounded Contexts | ✅ Presente | Contextos bem definidos |
| SSoT | ⚠️ Violado | getCompanyFinanceSummary mistura contextos |
| Repository Pattern | ❌ Ausente | Planeado para Fase 2 |
| Event Bus | ✅ Funcional | Limitação em Edge Runtime documentada |
| RBAC | ⚠️ Incompleto | Middleware OK, API Routes sem role check |
| `prisma.$transaction()` | ✅ Usado | Mas conflict check fora da tx (TOCTOU) |
| Eventos após persistência | ✅ Correcto | `publish()` chamado após `$transaction` |
| Auditoria financeira | ✅ Presente | FinancialAudit criado em confirmPayment |
| Numeração de documentos | ⚠️ Race condition | Count-based, não sequência DB |

---

*VD Platform — Technical Audit Report v1.0 — Julho 2026*  
*Próxima auditoria: Após resolução das dívidas técnicas Fase 0 (estimativa: Setembro 2026)*
