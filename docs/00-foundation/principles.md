# Princípios de Engenharia — VD Platform

> **Documento:** 00-PRINC-001  
> **Volume:** 00 — Foundation  
> **Estado:** ✅ Aprovado  
> **Versão:** 1.0.0  
> **Data:** Julho 2026  

---

## Declaração de Princípios

Os princípios aqui definidos são **invioláveis**. Qualquer decisão técnica que os contradiga exige uma justificação formal documentada num ADR e aprovação explícita do Arquiteto-Chefe. Nenhum argumento de "velocidade de entrega" justifica violar estes princípios.

---

## 1. SOLID

### S — Single Responsibility Principle

> *Cada módulo, classe ou função tem uma única razão para mudar.*

**No VD Platform:**

```typescript
// ✅ CORRECTO — FinanceService faz apenas uma coisa: orquestrar pagamentos
export async function confirmPayment(prisma, input): Promise<ConfirmPaymentResult> {
  // Apenas a lógica de confirmação de pagamento
}

// ❌ ERRADO — mistura de responsabilidades
export async function confirmPaymentAndSendEmailAndUpdateDashboard(...) {
  // Viola SRP — três responsabilidades numa função
}
```

**Aplicação:**
- Cada ficheiro em `src/lib/` tem uma única responsabilidade
- Cada API Route trata apenas o seu recurso
- Cada componente React tem uma única responsabilidade de UI

### O — Open/Closed Principle

> *Entidades devem ser abertas para extensão mas fechadas para modificação.*

**No VD Platform:**

O Event Bus implementa este princípio: para adicionar um novo comportamento quando um lead é criado, basta registar um novo handler — não é necessário modificar a função que cria leads.

```typescript
// ✅ CORRECTO — adicionar comportamento sem modificar código existente
subscribe("lead.created", async (payload) => {
  // Novo comportamento: enviar SMS (novo handler)
  await sendSMS(payload.phone, "Olá! Recebemos o seu pedido...");
});
// A função createLead() não foi alterada
```

### L — Liskov Substitution Principle

> *Subtipos devem ser substituíveis pelos seus tipos base.*

**Aplicação futura:** Quando o Repository Pattern for implementado, qualquer implementação de `LeadRepository` (Prisma, em memória para testes) deve ser intercambiável.

### I — Interface Segregation Principle

> *Interfaces específicas são melhores que uma interface geral.*

**No VD Platform:**

```typescript
// ✅ CORRECTO — interfaces específicas
export interface ConfirmPaymentInput { ... }
export interface ConfirmPaymentResult { ... }

// ❌ ERRADO — interface genérica "faz tudo"
export interface FinancialOperation {
  type: "payment" | "invoice" | "expense" | "refund";
  data: Record<string, unknown>; // any implícito
}
```

### D — Dependency Inversion Principle

> *Módulos de alto nível não dependem de módulos de baixo nível. Ambos dependem de abstrações.*

**No VD Platform:**

```typescript
// ✅ CORRECTO — FinanceService recebe prisma como parâmetro (injecção)
export async function confirmPayment(
  prisma: PrismaClient,  // injectado, não importado directamente
  input: ConfirmPaymentInput
) { ... }

// ❌ ERRADO — dependência directa de infraestrutura
import { prisma } from "@/lib/prisma"; // acoplamento directo

export async function confirmPayment(input: ConfirmPaymentInput) {
  const reservation = await prisma.reservation.findUnique(...);
}
```

---

## 2. DRY — Don't Repeat Yourself

> *Todo conhecimento deve ter uma representação única, inequívoca e autoritativa no sistema.*

### Aplicações no VD Platform

**Formatação de moeda:**
```typescript
// ✅ Um único ponto — src/lib/currency.ts
export function formatKz(value: number): string {
  return new Intl.NumberFormat("pt-AO", { minimumFractionDigits: 2 }).format(value) + " Kz";
}
// Usado em: components, PDFs, relatórios — nunca duplicado
```

**Fórmulas de cálculo financeiro:**
```typescript
// ✅ Um único ponto — src/lib/pricing-service.ts
export function calculateReservationTotal(
  baseAmount: number,
  discount: number,
  ivaPct: number,
  coffeeBreakAmount: number
): { amount: number; totalAmount: number } { ... }
// Nunca recalculado inline — sempre via PricingService
```

**Tipos de estados:**
```typescript
// ✅ Definidos uma vez no schema Prisma, gerados automaticamente
// Nunca redefinir manualmente: "PENDENTE" | "PAGO" | ...
```

### Anti-Padrões DRY Proibidos

```typescript
// ❌ PROIBIDO — calcular total em múltiplos sítios
// Em ReservationModal.tsx:
const total = hours * pricePerHour + coffeeBreak * cbPrice;
// Em reservations/route.ts:
const total = hours * pricePerHour + coffeeBreak * cbPrice;
// Em invoice-pdf.tsx:
const total = hours * pricePerHour + coffeeBreak * cbPrice;
```

---

## 3. KISS — Keep It Simple, Stupid

> *A solução mais simples que funciona correctamente é sempre preferível a uma solução elegante e complexa.*

### Aplicação no VD Platform

**Autenticação:**
JWT em cookies httpOnly é a solução mais simples para o problema. Não há necessidade de OAuth2, SAML, ou sessões em Redis para o estado actual do projecto.

**Event Bus:**
Um Map em memória é suficientemente simples para o estado actual. Não começar com Kafka, RabbitMQ ou NATS.

**PDF Generation:**
`@react-pdf/renderer` permite criar PDFs com componentes React familiares. Não há necessidade de LaTeX ou ferramentas complexas.

### Quando KISS encontra DDD

DDD pode parecer complexo, mas a sua aplicação no VD Platform deve ser **pragmática**:
- Não implementar `AggregateRoot` como classe abstracta — usar directamente os tipos Prisma
- Não criar `DomainEvent` como objecto formal — usar o Event Bus tipado
- Não criar `ValueObject` como classe — usar interfaces simples
- À medida que a complexidade cresce, refactorar gradualmente

---

## 4. YAGNI — You Aren't Gonna Need It

> *Não implementar funcionalidades que não são necessárias agora.*

### Aplicação Prática

| Tentação | Decisão Correcta |
|---|---|
| Implementar multi-tenancy agora | Aguardar Fase 2 — o Azul Coworking é o único cliente |
| Implementar OAuth2 para API pública | Aguardar Fase 2 — não há terceiros a consumir a API |
| Implementar Kafka para eventos | O Event Bus em memória é suficiente para Fase 0-1 |
| Implementar cache Redis agora | Aguardar métricas de performance que justifiquem |
| Implementar testes E2E completos | Começar com unitários — E2E em Fase 1 |
| Implementar mobile app | Aguardar Fase 3 — foco no web admin primeiro |

### YAGNI ≠ Não planear

YAGNI não significa não arquitectar para o futuro. Significa não **implementar** o que não é necessário agora. A arquitectura deve ser extensível, mas a implementação deve ser minimal e focada.

---

## 5. Single Source of Truth (SSoT)

> *Cada pedaço de informação tem exactamente um proprietário. Cópias são uma fonte de inconsistência.*

### Regras SSoT no VD Platform

| Informação | Proprietário | Outros módulos... |
|---|---|---|
| Nome de uma empresa | `Company.name` | ...lêem via JOIN/include |
| Total de uma fatura | `Invoice.totalAmount` | ...nunca recalculam |
| Saldo de pagamento | `Invoice.balance` | ...lêem este campo |
| Estado de pagamento | `Invoice.status` ou `Reservation.paymentStatus` | ...sincronizados pelo FinanceService |
| Preço de um plano | `MeetingPlan.pricePerHour` + `RoomSettings` | ...calculados via PricingService |
| Histórico financeiro | `FinancialHistory` | ...nunca reconstruído |

### Anti-Padrão Proibido

```typescript
// ❌ PROIBIDO — calcular balanço financeiro no frontend
const balance = payments.reduce((acc, p) => acc + p.amount, 0);
// Este valor já existe em Invoice.balance — não recalcular

// ✅ CORRECTO — ler o valor autoritativo
const invoice = await prisma.invoice.findUnique({
  where: { id },
  select: { balance: true }
});
```

---

## 6. Security by Design

> *Segurança não é uma camada — é um requisito transversal de todo o sistema.*

### Princípios de Segurança

**1. Least Privilege (Privilégio Mínimo)**  
Cada utilizador tem apenas as permissões de que necessita. O role `COMERCIAL` não acede ao módulo financeiro. O role `VIEWER` não escreve nada.

**2. Defence in Depth (Defesa em Profundidade)**  
Múltiplas camadas de segurança: headers HTTP → middleware JWT → verificação de role na API Route → validação de input → Prisma (previne SQL injection).

**3. Fail Secure (Falhar com Segurança)**  
Em caso de erro de autenticação/autorização, o sistema nega o acesso e redireciona para login. Nunca "assume" permissão.

**4. Input Validation (Validação de Input)**  
Todo input vindo do cliente é tratado como não confiável e validado antes de qualquer operação.

**5. Audit Everything (Auditar Tudo)**  
Operações financeiras e alterações sensíveis são sempre registadas em `FinancialAudit` com utilizador, IP e timestamp.

**6. No Secrets in Code**  
Nenhuma credencial, secret ou API key pode aparecer no código ou no repositório. Sempre usar variáveis de ambiente.

### Checklist de Segurança por Feature

Antes de fazer deploy de qualquer nova feature:
- [ ] Input validado no servidor (não apenas no cliente)
- [ ] Autenticação verificada na API Route
- [ ] Role do utilizador verificado antes de operações sensíveis
- [ ] Operações sensíveis registadas em auditoria
- [ ] Dados pessoais tratados segundo LGPD/RGPD
- [ ] URLs de Cloudinary não expostos se privados
- [ ] Rate limiting aplicado em endpoints públicos

---

## 7. Observabilidade

> *Um sistema não observável não pode ser operado com confiança.*

### Dimensões de Observabilidade

**Logs:** Todo erro deve ser logado com contexto suficiente para diagnóstico. `console.error` em produção (capturado pelo Vercel Logs). Futuro: Sentry para error tracking.

**Métricas:** KPIs de negócio visíveis no Dashboard. Futuro: métricas de sistema (latência, erros, throughput) via Vercel Analytics.

**Traces:** A `Timeline` por entidade e o `FinancialAudit` funcionam como traces de negócio. Futuro: distributed tracing para APIs.

**Alertas:** Notificações internas para eventos críticos (contrato a expirar, pagamento em atraso). Futuro: alertas de sistema (uptime, erro rate > threshold).

---

## 8. Escalabilidade por Design

> *A arquitectura deve suportar crescimento de 10x sem reescrita.*

### Princípios de Escalabilidade

**1. Stateless API**  
As API Routes não guardam estado em memória. A sessão é no cookie JWT. Isto permite escalar horizontalmente.

**2. Paginação Obrigatória**  
Nenhum endpoint devolve listas ilimitadas. Todas as listagens têm `take/skip` ou cursor-based pagination.

**3. Índices de Base de Dados**  
Todo campo usado em `WHERE` ou `ORDER BY` tem índice. Ver `domain-model.md` para a lista completa.

**4. Lazy Loading**  
Relations só são carregadas com `include` explícito — nunca carregamento automático de toda a hierarquia.

**5. Async First**  
Operações demoradas (envio de email, geração de PDF) são realizadas após a resposta ao cliente (background, via Event Bus handlers).

---

## 9. Manutenibilidade

> *O código mais fácil de manter é o código que não precisa de ser mantido.*

### Práticas de Manutenibilidade

**Código autodocumentado:** Nomes de variáveis, funções e tipos devem ser suficientemente claros para dispensar comentários. Comentários explicam *porquê*, não *o quê*.

**Tamanho de ficheiros:** Ficheiros com mais de 300 linhas são candidatos a refactoring. Funções com mais de 50 linhas são candidatas a decomposição.

**Consistência:** O mesmo padrão é usado em todo o código. Se uma coisa é feita de uma forma num módulo, é feita da mesma forma em todos.

**Dependências mínimas:** Cada nova dependência é uma dívida de manutenção. Toda dependência adicionada deve ser justificada. Verificar frequência de actualizações e saúde do ecosistema.

---

## 10. Qualidade como Cultura

> *Qualidade não é uma fase — é um modo de trabalhar.*

### O Que Não É Negociável

- **Código revisado:** Toda alteração significativa deve ser revisada (pelo menos auto-revisada contra esta lista de princípios)
- **Testes:** Funcionalidades críticas (especialmente financeiras) têm testes. Sem excepção.
- **Documentação actualizada:** Toda alteração actualiza a documentação correspondente
- **ADR criado:** Toda decisão arquitectural tem um ADR
- **Business Bible consultada:** Toda funcionalidade verifica as regras de negócio relevantes

### O Que Não Se Faz

- Não se comita código com `console.log` de debug
- Não se ignora um erro — trata-se ou documenta-se o porquê de não tratar
- Não se usa `any` TypeScript sem comentário justificativo
- Não se faz bypass de autenticação "temporariamente"
- Não se escreve a mesma lógica em dois sítios
- Não se implanta sem testar o fluxo principal manualmente

---

*VD Platform — Engineering Principles v1.0.0 — Julho 2026*
