# Modelo de Domínio — VD Platform

> **Documento:** 00-DM-001  
> **Volume:** 00 — Foundation  
> **Estado:** ✅ Aprovado  
> **Versão:** 1.0.0  
> **Data:** Julho 2026  

---

## 1. Introdução ao Modelo de Domínio

O Modelo de Domínio é a **representação formal** de todas as entidades, relações, regras e eventos do negócio. Este documento é a **fonte de verdade** para qualquer decisão sobre o schema da base de dados, as interfaces TypeScript e as regras de validação.

Nenhuma tabela, campo ou relação pode ser adicionada ao schema Prisma sem que este documento seja actualizado primeiro.

---

## 2. Mapa de Entidades e Relações

```
┌──────────────────────────────────────────────────────────────────┐
│                    DIAGRAMA ENTIDADE-RELAÇÃO                     │
│                                                                  │
│  Lead ─────────────────────────────────────────────► Company    │
│   │  (convertedTo / leadCompanyId)                    │         │
│   │                                                   │ 1:N     │
│  Note (N:1)                                      Employee       │
│  Timeline (N:1)                                       │         │
│                                              Timeline (N:1)     │
│                                         FinancialHistory (N:1)  │
│                                              Payment (N:1)      │
│                                              Invoice (N:1)      │
│                                          Reservation (N:1)      │
│                                         LiquidationNote (N:1)   │
│                                                                  │
│  RoomBookingLead ──────────────────────────────► Company        │
│       │ (companyId)                                             │
│       │                                                         │
│       └──────────────────────────────────────► Reservation      │
│              (reservationId)                        │           │
│                                                     │ N:1       │
│                                                MeetingPlan      │
│                                                     │           │
│                                               RoomPricing       │
│                                               RoomSettings      │
│                                                                  │
│  Invoice ─────────────────────────────────────────────────────  │
│    │ (1:N)                                                       │
│  InvoicePayment                                                  │
│                                                                  │
│  AdminUser  DeleteRequest  Notification  FinancialAudit         │
│  (independentes — sem FK directas às entidades de negócio)      │
└──────────────────────────────────────────────────────────────────┘
```

---

## 3. Entidades do Domínio

### 3.1 Lead

**Bounded Context:** CRM  
**Aggregate Root:** Sim  
**Descrição:** Representa um potencial cliente que expressou interesse nos serviços do Azul Coworking, seja através da landing page, telefone, ou referência.

#### Campos

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `id` | CUID | ✅ | Identificador único |
| `firstName` | String | ✅ | Primeiro nome |
| `lastName` | String | ✅ | Apelido |
| `email` | String | ✅ | Email de contacto |
| `whatsapp` | String | ✅ | Número WhatsApp com código de país |
| `scheduledDate` | DateTime | ✅ | Data de visita/contacto agendado |
| `status` | LeadStatus | ✅ | Estado no pipeline (ver abaixo) |
| `source` | String | ❌ | Origem do lead (landing-page, referência, etc.) |
| `ip` | String | ❌ | IP de origem do formulário web |
| `appointmentTime` | String | ❌ | Hora do agendamento (HH:MM) |
| `appointmentType` | String | ❌ | Tipo: "Visita", "Pedido de contacto", etc. |
| `company` | String | ❌ | Nome da empresa do lead |
| `spaceType` | String | ❌ | Tipo de espaço de interesse |
| `planName` | String | ❌ | Plano de interesse |
| `convertedAt` | DateTime | ❌ | Data de conversão para cliente |
| `convertedBy` | String | ❌ | Email do utilizador que converteu |
| `leadCompanyId` | String (FK) | ❌ | Empresa criada após conversão |
| `createdAt` | DateTime | ✅ | Data de criação (auto) |
| `updatedAt` | DateTime | ✅ | Data de última actualização (auto) |

#### Estados do Lead (LeadStatus)

```
NOVO → CONTACTADO → QUALIFICADO → PROPOSTA_ENVIADA → NEGOCIACAO
                                                           │
                                          ┌────────────────┘
                                          ▼
                                    CONVERTIDO  ou  PERDIDO
```

| Estado | Descrição | Acção esperada |
|---|---|---|
| `NOVO` | Lead recém-captado, sem contacto | Contactar em < 24h |
| `CONTACTADO` | Primeiro contacto realizado | Qualificar necessidade |
| `QUALIFICADO` | Necessidade confirmada | Enviar proposta |
| `PROPOSTA_ENVIADA` | Proposta comercial enviada | Aguardar resposta |
| `NEGOCIACAO` | Em negociação de condições | Fechar acordo |
| `CONVERTIDO` | Tornou-se cliente activo | Criar Empresa |
| `PERDIDO` | Não avançou | Registar motivo |

#### Invariantes de Negócio

- Um Lead `CONVERTIDO` DEVE ter `convertedAt` e `convertedBy` preenchidos
- Um Lead `CONVERTIDO` DEVE ter uma `Company` associada (`leadCompanyId`)
- `email` deve ser único por lead activo (não duplicar captação)
- `scheduledDate` não pode ser no passado aquando da criação (validar no form)

#### Relações

- `notes: Note[]` — notas internas sobre o lead
- `timeline: Timeline[]` — eventos cronológicos do lead
- `companyRef: Company?` — empresa criada na conversão

---

### 3.2 RoomBookingLead

**Bounded Context:** Reservas  
**Aggregate Root:** Sim (no seu contexto)  
**Descrição:** Lead específico para reserva de sala de reunião. Captado via formulário público `/salas`.

#### Campos

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `id` | CUID | ✅ | Identificador único |
| `firstName` | String | ✅ | Primeiro nome |
| `lastName` | String | ✅ | Apelido |
| `company` | String | ❌ | Nome da empresa |
| `email` | String | ✅ | Email de contacto |
| `whatsapp` | String | ✅ | WhatsApp |
| `planName` | String | ✅ | Plano de sala desejado |
| `participants` | Int | ❌ | Número de participantes |
| `preferredDate` | DateTime | ❌ | Data preferencial |
| `preferredTime` | String | ❌ | Hora preferencial (HH:MM) |
| `observations` | String | ❌ | Observações adicionais |
| `coffeeBreak` | Boolean | ✅ | Coffee break desejado (default: false) |
| `status` | RoomLeadStatus | ✅ | Estado no pipeline |
| `source` | String | ✅ | Origem (default: "landing-sala") |
| `ip` | String | ❌ | IP de origem |
| `companyId` | String (FK) | ❌ | Empresa associada (se cliente existente) |
| `reservationId` | String | ❌ | Reserva criada a partir deste lead |
| `convertedAt` | DateTime | ❌ | Data de conversão |
| `convertedBy` | String | ❌ | Utilizador que converteu |

#### Estados do RoomBookingLead

| Estado | Descrição |
|---|---|
| `NOVO` | Pedido recebido, sem resposta |
| `CONTACTADO` | Contacto efectuado |
| `CONVERTIDO` | Transformado em Reserva ou Company |
| `PERDIDO` | Não avançou |

---

### 3.3 Company

**Bounded Context:** Cowork  
**Aggregate Root:** Sim  
**Descrição:** Empresa cliente com contrato activo de utilização de espaço no Azul Coworking.

#### Campos

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `id` | CUID | ✅ | Identificador único |
| `name` | String | ✅ | Nome da empresa |
| `nif` | String | ❌ | NIF da empresa |
| `responsible` | String | ✅ | Nome do responsável principal |
| `email` | String | ✅ | Email de contacto |
| `whatsapp` | String | ✅ | WhatsApp do responsável |
| `roomNumber` | String | ✅ | Sala/espaço atribuído |
| `numEmployees` | Int | ✅ | Número de colaboradores (default: 1) |
| `planType` | String | ✅ | Tipo de plano (SALA_PRIVADA, OPEN_SPACE, etc.) |
| `contractStart` | DateTime | ✅ | Início do contrato |
| `contractEnd` | DateTime | ✅ | Fim do contrato |
| `rentAmount` | Float | ✅ | Valor da renda mensal (AOA) |
| `paymentFrequency` | String | ✅ | Frequência de pagamento (MENSAL, TRIMESTRAL, etc.) |
| `contractStatus` | ContractStatus | ✅ | Estado do contrato |
| `paymentStatus` | PaymentStatus | ✅ | Estado do pagamento |
| `contractFileUrl` | String | ❌ | URL do contrato digitalizado (Cloudinary) |
| `notes` | String | ❌ | Notas internas |
| `leadSourceId` | String | ❌ | ID do Lead que originou esta empresa |

#### Estados do Contrato (ContractStatus)

| Estado | Descrição | Transição Automática |
|---|---|---|
| `ATIVO` | Contrato vigente | — |
| `PRESTES_EXPIRAR` | Expira em ≤ 60 dias | Automático via job |
| `RENOVADO` | Renovado com novos termos | Manual |
| `ENCERRADO` | Contrato terminado | Automático (data fim passada) |
| `SUSPENSO` | Suspenso por incumprimento | Manual pelo ADMIN |

#### Estados de Pagamento (PaymentStatus)

| Estado | Descrição |
|---|---|
| `EM_DIA` | Sem pagamentos em atraso |
| `ATRASADO` | Pelo menos um pagamento vencido |
| `SUSPENSO` | Suspenso por falta de pagamento |

#### Invariantes de Negócio

- `contractEnd` deve ser posterior a `contractStart`
- `rentAmount` deve ser > 0
- Uma empresa com `contractStatus = ENCERRADO` não pode fazer novas reservas
- Uma empresa com `paymentStatus = SUSPENSO` deve gerar alerta imediato

---

### 3.4 Payment

**Bounded Context:** Financeiro  
**Aggregate Root:** Não (pertence a Company ou Reservation)  
**Descrição:** Registo de um pagamento recebido ou a receber.

#### Campos Críticos

| Campo | Tipo | Descrição |
|---|---|---|
| `receiptNumber` | String | REC-YYYY-NNNNNN — número de recibo |
| `companyId` | FK | Empresa que pagou (se coworking) |
| `reservationId` | FK | Reserva que originou (se sala) |
| `amount` | Float | Valor do pagamento (AOA) |
| `dueDate` | DateTime | Data de vencimento |
| `paidDate` | DateTime | Data efectiva de pagamento |
| `status` | PaymentItemStatus | PENDENTE / PAGO / CANCELADO |
| `paymentMethod` | String | BCS_TRANSFERENCIA, MULTICAIXA, NUMERARIO, etc. |
| `operationRef` | String | Referência bancária / POS / Multicaixa |
| `receiptUrl` | String | URL do comprovativo (Cloudinary) |
| `previousBalance` | Float | Saldo antes do pagamento (auditoria) |

#### Métodos de Pagamento Suportados

| Código | Descrição |
|---|---|
| `BCS_TRANSFERENCIA` | Transferência bancária BCS |
| `MULTICAIXA` | Pagamento via Multicaixa |
| `POS` | Terminal POS |
| `NUMERARIO` | Pagamento em numerário |
| `CHEQUE` | Cheque bancário |

---

### 3.5 Invoice

**Bounded Context:** Financeiro  
**Aggregate Root:** Sim (no contexto financeiro)  
**Descrição:** Fatura emitida a um cliente, podendo ser de coworking ou de sala de reunião.

#### Campos Críticos

| Campo | Tipo | Descrição |
|---|---|---|
| `invoiceNumber` | String UNIQUE | FT-SALA-YYYY-NNNNNN ou FT-CWORK-YYYY-NNNNNN |
| `serviceType` | String | Descrição do serviço |
| `amount` | Float | Valor base (sem desconto/IVA) |
| `discount` | Float | Desconto em AOA |
| `iva` | Float | Percentagem de IVA (ex: 14 para 14%) |
| `totalAmount` | Float | Valor final calculado |
| `amountPaid` | Float | Total pago até ao momento |
| `balance` | Float | Saldo em dívida (totalAmount - amountPaid) |
| `paidPercentage` | Float | Percentagem paga (0-100) |
| `status` | InvoiceStatus | Estado da fatura |

#### Estados da Fatura (InvoiceStatus)

| Estado | Condição | Próximo Estado |
|---|---|---|
| `PENDENTE` | amountPaid = 0 | `PARCIAL` ou `LIQUIDADA` |
| `PARCIAL` | 0 < amountPaid < totalAmount | `LIQUIDADA` ou `EM_ATRASO` |
| `LIQUIDADA` | amountPaid >= totalAmount | — (terminal) |
| `EM_ATRASO` | balance > 0 e dueDate < hoje | `LIQUIDADA` (após pagamento) |

#### Fórmula de Cálculo

```
totalAmount = amount - discount + (amount * iva / 100)
balance = max(0, totalAmount - amountPaid)
paidPercentage = min(100, (amountPaid / totalAmount) * 100)
```

---

### 3.6 Reservation

**Bounded Context:** Reservas  
**Aggregate Root:** Sim  
**Descrição:** Reserva confirmada da sala de reunião.

#### Campos Críticos

| Campo | Tipo | Descrição |
|---|---|---|
| `reservationNumber` | String | RES-YYYY-NNNNNN |
| `eventName` | String | Nome do evento/reunião |
| `companyId` | FK | Empresa cliente (membro do coworking) |
| `companyName` | String | Nome para clientes externos |
| `planId` | FK | Plano de reunião escolhido |
| `participants` | Int | Número de participantes |
| `startDatetime` | DateTime | Início da reserva |
| `endDatetime` | DateTime | Fim da reserva |
| `totalHours` | Float | Duração em horas |
| `coffeeBreak` | Boolean | Coffee break incluído |
| `status` | ReservationStatus | Estado da reserva |
| `paymentOption` | PaymentOption | Como o pagamento será feito |
| `amount` | Float | Valor base |
| `discount` | Float | Desconto aplicado (AOA) |
| `iva` | Float | IVA (%) |
| `totalAmount` | Float | Valor final |
| `paymentStatus` | String | Estado do pagamento |
| `amountPaid` | Float | Total pago |

#### Estados da Reserva (ReservationStatus)

| Estado | Descrição |
|---|---|
| `PENDENTE_APROVACAO` | Aguarda confirmação do admin |
| `RESERVADO` | Reservado mas não confirmado oficialmente |
| `CONFIRMADA` | Confirmada e activa |
| `CONCLUIDA` | Aconteceu, terminada |
| `CANCELADA` | Cancelada |

#### Opções de Pagamento (PaymentOption)

| Opção | Descrição |
|---|---|
| `PAGAR_NO_DIA` | Pagar na chegada (default) |
| `PAGAR_AGORA` | Pagar antecipadamente |
| `FACTURAR` | Emitir fatura para pagamento posterior |
| `ISENTO` | Isento de pagamento |

---

### 3.7 MeetingPlan

**Bounded Context:** Reservas  
**Descrição:** Planos de reserva de sala com preçário associado.

#### Campos Críticos

| Campo | Tipo | Descrição |
|---|---|---|
| `name` | String | Nome do plano |
| `maxPeople` | Int | Capacidade máxima |
| `pricePerHour` | Float | Preço por hora (AOA) |
| `halfDayPrice` | Float | Preço meio dia (4h) (AOA) |
| `fullDayPrice` | Float | Preço dia inteiro (8h) (AOA) |
| `weekendPrice` | Float | Preço fim de semana (AOA) |
| `coffeeBreakPrice` | Float | Preço coffee break (AOA) |
| `coffeeBreakAvailable` | Boolean | Se coffee break disponível |
| `customPricingAllowed` | Boolean | Se permite preço personalizado |

#### Regras de Preços

- Se `totalHours >= 4` e existe `halfDayPrice > 0` → aplicar preço meio dia
- Se `totalHours >= 8` e existe `fullDayPrice > 0` → aplicar preço dia inteiro
- Coffee break soma ao preço base
- Desconto é aplicado ao `totalAmount` final
- IVA é aplicado após desconto: `(amount - discount) * (1 + iva/100)`

---

### 3.8 Employee

**Bounded Context:** Cowork  
**Descrição:** Colaborador de uma empresa cliente do coworking.

| Campo | Tipo | Descrição |
|---|---|---|
| `name` | String | Nome completo |
| `role` | String | Cargo/função |
| `department` | String | Departamento |
| `status` | EmployeeStatus | ATIVO / INATIVO / AFASTADO |
| `startDate` | DateTime | Data de início |
| `photoUrl` | String | Foto (Cloudinary) |

---

### 3.9 AdminUser

**Bounded Context:** Segurança  
**Descrição:** Utilizador do painel de administração.

| Campo | Tipo | Descrição |
|---|---|---|
| `email` | String UNIQUE | Email (login) |
| `passwordHash` | String | Hash bcrypt da password |
| `name` | String | Nome de exibição |
| `role` | UserRole | ADMIN / COMERCIAL / FINANCEIRO / VIEWER |
| `totpSecret` | String | Secret TOTP para 2FA |
| `totpEnabled` | Boolean | 2FA activado? |
| `active` | Boolean | Conta activa? |

---

### 3.10 Notification

**Bounded Context:** Comunicação  
**Descrição:** Notificação interna gerada pelo sistema para a equipa.

| Campo | Tipo | Descrição |
|---|---|---|
| `type` | NotifType | INFO / WARNING / ERROR / SUCCESS |
| `title` | String | Título curto da notificação |
| `message` | String | Mensagem completa |
| `entityType` | String | Tipo da entidade relacionada |
| `entityId` | String | ID da entidade relacionada |
| `priority` | Priority | LOW / NORMAL / HIGH / URGENT |
| `read` | Boolean | Se foi lida |
| `readAt` | DateTime | Quando foi lida |

---

### 3.11 Timeline

**Bounded Context:** Transversal  
**Descrição:** Registo cronológico de eventos de negócio associados a uma Company ou Lead. É a "memória" do sistema sobre cada entidade.

| Campo | Tipo | Descrição |
|---|---|---|
| `companyId` | FK | Empresa relacionada (ou null) |
| `leadId` | FK | Lead relacionado (ou null) |
| `type` | String | Tipo de evento (PAGAMENTO_RECEBIDO, CONTRATO_CRIADO, etc.) |
| `title` | String | Título do evento |
| `description` | String | Descrição detalhada |
| `amount` | Float | Valor monetário (se aplicável) |
| `referenceId` | String | ID da entidade referenciada |
| `referenceType` | String | Tipo da entidade referenciada |
| `createdBy` | String | Email do utilizador que criou |

---

### 3.12 FinancialAudit

**Bounded Context:** Financeiro / Segurança  
**Descrição:** Log imutável de todas as operações financeiras. **Nunca deve ser alterado ou eliminado.**

| Campo | Descrição |
|---|---|
| `action` | Acção realizada (CONFIRM_PAYMENT, CREATE_INVOICE, etc.) |
| `entityType` | Tipo da entidade (Reservation, Invoice, Payment) |
| `entityId` | ID da entidade |
| `companyId` | Empresa relacionada |
| `amount` | Valor da operação |
| `method` | Método de pagamento |
| `reference` | Número de fatura/recibo |
| `createdBy` | Utilizador que realizou a operação |
| `ip` | IP da solicitação |

---

## 4. Value Objects

Value Objects são objectos imutáveis que representam conceitos do domínio sem identidade própria.

### 4.1 Money (a implementar)

```typescript
// Valor monetário em AOA com precisão inteira (centavos)
interface Money {
  amount: number;    // em kwanzas (inteiro, sem decimais na apresentação)
  currency: "AOA";  // apenas AOA actualmente
}

// Formatação sempre via: formatKz(value) → "1.250.000,00 Kz"
```

### 4.2 DateRange (a implementar)

```typescript
interface DateRange {
  start: Date;
  end: Date;
  // Invariante: end > start
}
```

### 4.3 ContactInfo (a implementar)

```typescript
interface ContactInfo {
  email: string;    // deve ser válido
  whatsapp: string; // deve incluir código de país
  name: string;
}
```

---

## 5. Eventos de Domínio (Domain Events)

Eventos de domínio são factos que **já aconteceram** no negócio. São registados em `src/lib/event-bus.ts`.

### 5.1 Catálogo Completo

Ver ficheiro `src/lib/event-bus.ts` para a lista completa com tipos TypeScript.

### 5.2 Convenção de Nomenclatura

```
[aggregate].[verbo-passado]

Exemplos:
  lead.created
  lead.converted
  company.contractExpiringSoon
  reservation.paymentReceived
  invoice.paid
  payment.overdue
```

### 5.3 Princípios dos Domain Events

- Eventos são **imutáveis** — representam factos que aconteceram
- Eventos são publicados **depois** da operação principal ter sido persistida com sucesso
- Handlers de eventos **nunca** lançam excepções que afectem o publicador
- Se um handler falhar, o facto de negócio já ocorreu — o handler deve ter mecanismos de retry

---

## 6. Índices da Base de Dados

Todos os campos usados frequentemente em `WHERE`, `ORDER BY` e `JOIN` devem ter índices:

| Tabela | Campos indexados | Justificação |
|---|---|---|
| Lead | status, scheduledDate, createdAt, leadCompanyId | Filtros frequentes no CRM |
| RoomBookingLead | status, createdAt, planName, companyId | Pipeline de leads sala |
| Company | contractStatus, contractEnd | Alertas de expiração |
| Payment | companyId, status, dueDate, receiptNumber, reservationId | Relatórios financeiros |
| Invoice | companyId, status, dueDate, reservationId | Dashboard financeiro |
| Reservation | planId, companyId, startDatetime, status, paymentStatus | Calendário e relatórios |
| Timeline | companyId, leadId, createdAt | Vista cronológica |
| FinancialAudit | entityId, companyId, createdAt | Auditoria |
| Notification | read, createdAt, companyId, priority | Bell de notificações |

---

## 7. Restrições e Integridade Referencial

| Relação | Cascade | Justificação |
|---|---|---|
| Lead → Note | CASCADE DELETE | Notas são parte do lead |
| Lead → Timeline | SET NULL | Timeline mantém-se para auditoria |
| Company → Payment | CASCADE DELETE | Impede orphaned payments |
| Company → Invoice | CASCADE DELETE | Impede orphaned invoices |
| Company → Employee | CASCADE DELETE | Colaboradores dependem da empresa |
| Company → FinancialHistory | CASCADE DELETE | Histórico ligado à empresa |
| Company → Reservation | SET NULL | Reservas mantêm-se mesmo sem empresa |
| Invoice → InvoicePayment | CASCADE DELETE | Parcelas são parte da fatura |
| LiquidationNote → Company | SET NULL | Nota mantém-se para auditoria |

---

*VD Platform — Domain Model v1.0.0 — Julho 2026*
