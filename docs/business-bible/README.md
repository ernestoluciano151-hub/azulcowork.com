# Business Bible — VD Platform

> **Documento:** BB-INDEX-001  
> **Volume:** 00 — Foundation  
> **Estado:** ✅ Aprovado v1.0  
> **Data:** Julho 2026  

---

## O que é a Business Bible?

A Business Bible é o **repositório oficial de todas as regras de negócio** do VD Platform. Nenhuma regra de negócio pode existir apenas no código. Toda regra deve estar aqui documentada com contexto, impacto e critérios de validação.

> *Se uma regra de negócio não está na Business Bible, ela não existe oficialmente. Se o código implementa algo que não está aqui, o código está errado ou incompleto.*

---

## Estrutura de uma Regra de Negócio

Cada regra segue obrigatoriamente este formato:

```markdown
## BR-NNN — Nome Descritivo

**ID:** BR-NNN  
**Módulo:** [CRM / Cowork / Financeiro / Reservas / Segurança / Comunicação]  
**Prioridade:** [CRÍTICA / ALTA / MÉDIA / BAIXA]  
**Estado:** [ACTIVA / DEPRECIADA / EM_REVISÃO]  
**Implementada:** [Sim / Não / Parcial]  

### Objetivo
O que esta regra garante.

### Descrição
Explicação detalhada da regra.

### Condição de Activação
Quando esta regra é aplicada.

### Impacto
O que acontece se esta regra for violada.

### Módulos Afectados
- Módulo A
- Módulo B

### Permissões
Quem pode executar / contornar esta regra.

### Eventos Relacionados
- evento.publicado quando esta regra é activada

### Critérios de Aceitação
- [ ] Critério 1
- [ ] Critério 2

### Exemplos
Exemplo concreto de aplicação da regra.

### Excepções
Casos onde esta regra não se aplica.
```

---

## Índice de Regras por Módulo

### CRM — Leads

| ID | Regra | Prioridade | Estado | Impl. |
|---|---|---|---|---|
| [BR-001](./BR-001-lead-criacao.md) | Criação de Lead | ALTA | ACTIVA | ✅ |
| [BR-002](./BR-002-lead-conversao.md) | Conversão de Lead em Empresa | CRÍTICA | ACTIVA | ✅ |
| [BR-003](./BR-003-lead-status.md) | Transições de Estado de Lead | ALTA | ACTIVA | ✅ |
| [BR-004](./BR-004-lead-duplicado.md) | Prevenção de Leads Duplicados | MÉDIA | ACTIVA | ❌ |

### Cowork — Empresas e Contratos

| ID | Regra | Prioridade | Estado | Impl. |
|---|---|---|---|---|
| [BR-010](./BR-010-contrato-status.md) | Estados de Contrato | CRÍTICA | ACTIVA | ✅ |
| [BR-011](./BR-011-contrato-alerta.md) | Alertas de Expiração de Contrato | ALTA | ACTIVA | ❌ |
| [BR-012](./BR-012-pagamento-status.md) | Estado de Pagamento da Empresa | ALTA | ACTIVA | ✅ |
| [BR-013](./BR-013-colaboradores.md) | Gestão de Colaboradores | MÉDIA | ACTIVA | ✅ |

### Financeiro

| ID | Regra | Prioridade | Estado | Impl. |
|---|---|---|---|---|
| [BR-020](./BR-020-fatura-numeracao.md) | Numeração de Faturas | CRÍTICA | ACTIVA | ✅ |
| [BR-021](./BR-021-recibo-numeracao.md) | Numeração de Recibos | CRÍTICA | ACTIVA | ✅ |
| [BR-022](./BR-022-nota-liquidacao.md) | Nota de Liquidação | CRÍTICA | ACTIVA | ✅ |
| [BR-023](./BR-023-pagamento-parcial.md) | Pagamento Parcial | ALTA | ACTIVA | ✅ |
| [BR-024](./BR-024-iva-calculo.md) | Cálculo de IVA | CRÍTICA | ACTIVA | ✅ |
| [BR-025](./BR-025-desconto.md) | Aplicação de Desconto | ALTA | ACTIVA | ✅ |
| [BR-026](./BR-026-auditoria.md) | Auditoria Financeira | CRÍTICA | ACTIVA | ✅ |
| [BR-027](./BR-027-historico.md) | Histórico Financeiro | ALTA | ACTIVA | ✅ |
| [BR-028](./BR-028-mora.md) | Penalidade por Atraso | ALTA | ACTIVA | ❌ |

### Reservas — Sala de Reunião

| ID | Regra | Prioridade | Estado | Impl. |
|---|---|---|---|---|
| [BR-030](./BR-030-reserva-conflito.md) | Prevenção de Conflito de Reservas | CRÍTICA | ACTIVA | ❌ |
| [BR-031](./BR-031-reserva-status.md) | Estados de Reserva | ALTA | ACTIVA | ✅ |
| [BR-032](./BR-032-preco-calculo.md) | Cálculo de Preço de Reserva | CRÍTICA | ACTIVA | ✅ |
| [BR-033](./BR-033-coffee-break.md) | Coffee Break | MÉDIA | ACTIVA | ✅ |
| [BR-034](./BR-034-pagamento-opcoes.md) | Opções de Pagamento | ALTA | ACTIVA | ✅ |
| [BR-035](./BR-035-cancelamento.md) | Política de Cancelamento | MÉDIA | ACTIVA | ❌ |

### Segurança

| ID | Regra | Prioridade | Estado | Impl. |
|---|---|---|---|---|
| [BR-040](./BR-040-rbac.md) | RBAC — Controlo de Acesso | CRÍTICA | ACTIVA | ✅ |
| [BR-041](./BR-041-sessao.md) | Gestão de Sessão | ALTA | ACTIVA | ✅ |
| [BR-042](./BR-042-delete-request.md) | Pedido de Eliminação de Dados | ALTA | ACTIVA | ✅ |
| [BR-043](./BR-043-password.md) | Política de Passwords | ALTA | ACTIVA | ✅ |
| [BR-044](./BR-044-2fa.md) | 2FA TOTP | ALTA | ACTIVA | ✅ (opcional) |

---

## Regras Críticas — Resumo Executivo

As seguintes regras são **CRÍTICAS**: a sua violação pode causar danos financeiros, legais ou de segurança.

### BR-002 — Conversão de Lead
Uma lead só pode ser convertida uma vez. A conversão cria obrigatoriamente uma Company. O lead fica no estado CONVERTIDO de forma permanente.

### BR-020 — Numeração de Faturas
O número de fatura é único, sequencial e nunca pode ser reutilizado. Formato: `FT-SALA-YYYY-NNNNNN`. A sequência nunca pode ter lacunas.

### BR-022 — Nota de Liquidação
Cada confirmação de pagamento gera obrigatoriamente uma Nota de Liquidação (NL-YYYY-NNNNNN). Nunca pode ser apagada.

### BR-024 — Cálculo de IVA
`totalAmount = (amount - discount) × (1 + iva/100)`. Este cálculo é executado pelo PricingService e nunca directamente na UI.

### BR-026 — Auditoria Financeira
Cada operação financeira cria um registo em FinancialAudit. Estes registos são **imutáveis** — nunca podem ser alterados ou apagados.

### BR-030 — Conflito de Reservas
Duas reservas não podem ocupar a mesma sala no mesmo período. A verificação de conflito é obrigatória antes de qualquer confirmação de reserva.

### BR-040 — RBAC
Nenhum utilizador acede a recursos fora do seu role. A verificação é feita no middleware E na API Route. Nunca apenas num dos dois.

---

## Regras de Negócio em Detalhe

---

## BR-001 — Criação de Lead

**ID:** BR-001  
**Módulo:** CRM  
**Prioridade:** ALTA  
**Estado:** ACTIVA  
**Implementada:** Sim  

### Objetivo
Garantir que todos os leads captados têm informação mínima suficiente para contacto.

### Descrição
Um Lead é criado quando um potencial cliente submete um formulário de contacto (landing page) ou é registado manualmente por um comercial. O lead representa o momento de primeiro contacto.

### Campos Obrigatórios
- `firstName` — mínimo 2 caracteres
- `lastName` — mínimo 2 caracteres
- `email` — formato válido de email
- `whatsapp` — número com código de país (ex: +244 976...)
- `scheduledDate` — data de visita/contacto agendado

### Condição de Activação
Quando o formulário público ou o admin cria um novo lead.

### Impacto
Um lead com dados incompletos não pode ser contactado. Leads sem data agendada ficam "perdidos" no sistema.

### Módulos Afectados
- CRM (proprietário)
- Comunicação (envio de email de confirmação ao lead)
- Dashboard (contador de leads)

### Eventos Relacionados
- `lead.created` → publica após criação bem-sucedida

### Critérios de Aceitação
- [ ] Lead com email inválido é rejeitado com mensagem clara
- [ ] Lead com campos obrigatórios em falta é rejeitado
- [ ] Lead criado com sucesso aparece na lista do admin
- [ ] Evento `lead.created` é publicado
- [ ] Notificação interna é criada para o admin

---

## BR-002 — Conversão de Lead em Empresa

**ID:** BR-002  
**Módulo:** CRM → Cowork  
**Prioridade:** CRÍTICA  
**Estado:** ACTIVA  
**Implementada:** Sim  

### Objetivo
Garantir que um lead se torna cliente de forma rastreável, criando todos os registos necessários.

### Descrição
A conversão é o processo pelo qual um Lead qualificado se torna uma Company activa no sistema. É uma operação **atómica** e **irreversível**.

### Processo de Conversão

```
Lead (status: QUALIFICADO ou outro)
    │
    ▼
Admin clica "Converter"
    │
    ▼
[Validações]
    ├── Lead não foi convertido antes (convertedAt == null)
    ├── Dados da empresa preenchidos
    └── Data de início do contrato válida
    │
    ▼
[Operação Atómica]
    ├── Criar Company com dados fornecidos
    ├── Actualizar Lead: status=CONVERTIDO, convertedAt=now(), convertedBy=user, leadCompanyId=company.id
    └── Publicar: lead.converted + company.created
    │
    ▼
Resultado: Company criada, Lead marcado como CONVERTIDO
```

### Invariantes
- Um Lead só pode ser convertido **uma vez**
- `convertedAt` e `convertedBy` são obrigatórios na conversão
- A Company criada deve referenciar o Lead de origem (`leadSourceId`)
- O Lead deve ter `leadCompanyId` apontando para a Company criada

### Impacto de Violação
- Lead convertido duas vezes → duas companies para o mesmo cliente → duplicação de dados → cobrança duplicada
- Conversão sem rastreabilidade → impossível auditar a origem dos clientes

### Critérios de Aceitação
- [ ] Um Lead CONVERTIDO não pode ser convertido novamente
- [ ] A Company criada aparece na lista de empresas
- [ ] O Lead fica marcado como CONVERTIDO com data e utilizador
- [ ] A Company tem `leadSourceId` preenchido
- [ ] A operação é atómica (se criar Company falhar, Lead não muda)

---

## BR-020 — Numeração de Faturas

**ID:** BR-020  
**Módulo:** Financeiro  
**Prioridade:** CRÍTICA  
**Estado:** ACTIVA  
**Implementada:** Sim  

### Objetivo
Garantir que cada fatura tem um número único, sequencial e auditável, conforme exigências fiscais angolanas.

### Formato
```
FT-SALA-YYYY-NNNNNN    → Faturas de sala de reunião
FT-CWORK-YYYY-NNNNNN   → Faturas de coworking (a implementar)
```

Onde:
- `FT` = Fatura
- `SALA` / `CWORK` = Tipo de serviço
- `YYYY` = Ano de 4 dígitos
- `NNNNNN` = Número sequencial de 6 dígitos com zeros à esquerda

### Algoritmo de Geração
```typescript
const year = new Date().getFullYear();
const count = await tx.invoice.count({
  where: { invoiceNumber: { startsWith: `FT-SALA-${year}-` } }
});
const invoiceNumber = `FT-SALA-${year}-${String(count + 1).padStart(6, "0")}`;
```

### Invariantes
- O número é gerado **dentro da transacção** para evitar race conditions
- Um número nunca pode ser reutilizado
- A sequência recomeça em `000001` a cada ano
- O campo `invoiceNumber` tem constraint `UNIQUE` na base de dados

### Impacto de Violação
- Faturas com números duplicados → ilegalidade fiscal → problemas com autoridades tributárias angolanas

### Critérios de Aceitação
- [ ] Duas faturas criadas em simultâneo têm números diferentes
- [ ] A sequência é contínua (sem lacunas em condições normais)
- [ ] O número é criado dentro da transacção, não antes

---

## BR-022 — Nota de Liquidação

**ID:** BR-022  
**Módulo:** Financeiro  
**Prioridade:** CRÍTICA  
**Estado:** ACTIVA  
**Implementada:** Sim  

### Objetivo
Registar de forma permanente e auditável cada confirmação de pagamento.

### Descrição
Cada vez que um pagamento é confirmado (total ou parcial), é gerada uma **Nota de Liquidação** (NL). Este documento comprova a operação e não pode ser apagado.

### Formato
```
NL-YYYY-NNNNNN
```

### Conteúdo Obrigatório
- Referência à fatura (invoiceId)
- Referência à reserva (reservationId) se aplicável
- Empresa (companyId) se aplicável
- Valor facturado (amountBilled)
- Valor pago nesta operação (amountPaid)
- Saldo remanescente (balance)
- Método de pagamento
- Referência bancária/POS
- Utilizador que registou

### Invariantes
- A Nota de Liquidação é **criada mas nunca apagada**
- Mesmo um pagamento parcial gera uma NL
- Uma NL incorrecta deve ser **anulada por uma NL de estorno**, nunca editada

### Critérios de Aceitação
- [ ] Cada `confirmPayment()` cria exactamente uma NL
- [ ] NLs são visíveis no histórico financeiro da empresa
- [ ] NLs não podem ser eliminadas via API

---

## BR-024 — Cálculo de IVA e Total

**ID:** BR-024  
**Módulo:** Financeiro  
**Prioridade:** CRÍTICA  
**Estado:** ACTIVA  
**Implementada:** Sim  

### Fórmula Obrigatória

```
totalAmount = (amount - discount) + (amount - discount) × (iva / 100)
           = (amount - discount) × (1 + iva / 100)
```

### Exemplo

```
amount = 50.000 AOA
discount = 5.000 AOA
iva = 14%

totalAmount = (50.000 - 5.000) × (1 + 0.14)
            = 45.000 × 1.14
            = 51.300 AOA
```

### Onde É Calculado

**Exclusivamente** em `src/lib/pricing-service.ts`. Nunca:
- Na UI (componentes React)
- Inline nas API Routes
- Em múltiplos sítios diferentes

### Verificação de Integridade
Ao persistir uma Reservation ou Invoice, verificar que `totalAmount` corresponde à fórmula. Rejeitar se não corresponder.

### Critérios de Aceitação
- [ ] O cálculo é consistente entre frontend e backend
- [ ] Desconto nunca excede o valor base
- [ ] IVA de 0% resulta em totalAmount = amount - discount
- [ ] Arredondamento é consistente (2 casas decimais)

---

## BR-026 — Auditoria Financeira

**ID:** BR-026  
**Módulo:** Financeiro / Segurança  
**Prioridade:** CRÍTICA  
**Estado:** ACTIVA  
**Implementada:** Sim  

### Objetivo
Manter um log imutável de todas as operações financeiras para fins de auditoria e responsabilização.

### Operações Auditadas
- Confirmação de pagamento (`CONFIRM_PAYMENT`)
- Criação de fatura (`CREATE_INVOICE`)
- Criação de nota de liquidação (`CREATE_LIQUIDATION_NOTE`)
- Eliminação de pagamento (`DELETE_PAYMENT`) — quando implementado
- Ajuste financeiro (`FINANCIAL_ADJUSTMENT`) — quando implementado

### Dados Registados
```typescript
{
  action: string,          // CONFIRM_PAYMENT, etc.
  entityType: string,      // Reservation, Invoice, etc.
  entityId: string,        // ID da entidade
  companyId?: string,      // Empresa relacionada
  amount?: number,         // Valor da operação
  method?: string,         // Método de pagamento
  reference?: string,      // Número de fatura/recibo
  createdBy?: string,      // Email do utilizador
  ip?: string,             // IP do pedido
  createdAt: DateTime      // Timestamp automático
}
```

### Invariantes
- Registos de auditoria são **imutáveis** — sem UPDATE, sem DELETE
- Toda operação financeira cria um registo, mesmo que falhe (registar a tentativa)
- O IP é sempre registado para pedidos via API

### Critérios de Aceitação
- [ ] Cada `confirmPayment()` cria um registo de auditoria
- [ ] Registos de auditoria são visíveis para ADMIN
- [ ] Não existe endpoint de DELETE para FinancialAudit
- [ ] O utilizador que realizou a operação é sempre registado

---

## BR-030 — Prevenção de Conflito de Reservas

**ID:** BR-030  
**Módulo:** Reservas  
**Prioridade:** CRÍTICA  
**Estado:** ACTIVA  
**Implementada:** ❌ PENDENTE  

### Objetivo
Garantir que nunca existam duas reservas para a mesma sala no mesmo período.

### Algoritmo de Verificação

```typescript
// Antes de criar/confirmar uma reserva:
const conflict = await prisma.reservation.findFirst({
  where: {
    status: { notIn: ["CANCELADA"] },
    startDatetime: { lt: newReservation.endDatetime },
    endDatetime:   { gt: newReservation.startDatetime },
    // Para sala específica quando houver múltiplas salas:
    // roomId: newReservation.roomId
  }
});

if (conflict) {
  throw new Error(`Conflito com a reserva ${conflict.reservationNumber}`);
}
```

### Invariantes
- A verificação é feita no servidor, nunca apenas no cliente
- A verificação é feita dentro de uma transacção com `SELECT FOR UPDATE` quando possível
- Reservas `CANCELADA` não contam para verificação de conflitos

### Impacto de Violação
- Dois clientes reservam a mesma sala no mesmo período → embaraço operacional → perda de confiança → possíveis implicações contratuais

### ⚠️ Estado Actual
Esta regra **NÃO está implementada** no código actual. É uma dívida técnica crítica. Deve ser implementada antes de qualquer aumento de volume de reservas.

### Critérios de Aceitação
- [ ] Tentar criar reserva no mesmo período que outra → erro claro
- [ ] Calendário mostra visualmente os períodos ocupados
- [ ] Reservas canceladas não bloqueiam novos períodos
- [ ] Verificação funciona para reservas parcialmente sobrepostas

---

## BR-040 — RBAC — Controlo de Acesso por Role

**ID:** BR-040  
**Módulo:** Segurança  
**Prioridade:** CRÍTICA  
**Estado:** ACTIVA  
**Implementada:** Sim (parcial)  

### Roles Existentes

| Role | Descrição | Acesso |
|---|---|---|
| `ADMIN` | Acesso total | Tudo |
| `COMERCIAL` | Gestão operacional | CRM, Reservas, Comunicação |
| `FINANCEIRO` | Gestão financeira | Financeiro, Relatórios |
| `VIEWER` | Só leitura | Dashboard, listas |

### Dupla Verificação Obrigatória

```
Pedido HTTP → Middleware (verifica JWT + role básico)
                    ↓
              API Route (reavalia role para a operação específica)
                    ↓
              Executar operação
```

Ambas as verificações são obrigatórias. A verificação apenas no middleware não é suficiente.

### Critérios de Aceitação
- [ ] Utilizador COMERCIAL não consegue aceder a `/admin/financeiro`
- [ ] Utilizador VIEWER não consegue criar leads, empresas ou pagamentos
- [ ] Acesso indevido redireciona para dashboard, não para erro 500
- [ ] Token expirado redireciona para login
- [ ] TOTP expirado invalida a sessão

---

*Business Bible VD Platform — v1.0.0 — Julho 2026*  
*VERSÃO DE NEGÓCIOS - COMÉRCIO GERAL E PRESTAÇÃO DE SERVIÇOS, LDA*
