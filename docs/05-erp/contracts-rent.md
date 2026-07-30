# ERP — Contratos de Aluguer

> **Volume:** 02 — ERP  
> **Documento:** contracts-rent.md  
> **Estado:** ✅ Implementado — Sprint ERP-2 (28 Jul 2026)

---

## 1. Visão

Os contratos de aluguer são o núcleo do modelo de receita recorrente do Azul Coworking. Cada contrato liga uma empresa (`Company`) a um plano de coworking com valor mensal, prazo e condições de renovação.

---

## 2. Ciclo de Vida do Contrato

```
DRAFT → ACTIVE → SUSPENDED → TERMINATED
                           → EXPIRED (endDate atingida sem rescisão)
DRAFT → CANCELLED (antes de activação)
```

**Transições permitidas:**

| De | Para | Quem | Evento |
|---|---|---|---|
| `DRAFT` | `ACTIVE` | ADMIN | `erp.contract.activated` |
| `DRAFT` | `CANCELLED` | ADMIN | `erp.contract.cancelled` |
| `ACTIVE` | `SUSPENDED` | ADMIN | `erp.contract.suspended` |
| `ACTIVE` | `TERMINATED` | ADMIN | `erp.contract.terminated` |
| `ACTIVE` | `EXPIRED` | SYSTEM (cron) | `erp.contract.expired` |
| `SUSPENDED` | `ACTIVE` | ADMIN | `erp.contract.reactivated` |
| `SUSPENDED` | `TERMINATED` | ADMIN | `erp.contract.terminated` |

---

## 3. Planos de Coworking

| Plano | Descrição | Exemplo de Valor |
|---|---|---|
| `FLEX` | Acesso flexível por dias/horas | Kz 15.000–25.000/mês |
| `HOT_DESK` | Mesa partilhada, horário fixo | Kz 35.000–55.000/mês |
| `DEDICATED` | Mesa dedicada, 24/7 | Kz 65.000–95.000/mês |
| `PRIVATE_OFFICE` | Escritório privado | Kz 120.000–250.000/mês |
| `VIRTUAL` | Endereço comercial + domiciliação | Kz 15.000–25.000/mês |
| `CUSTOM` | Pacote personalizado | Negociado |

---

## 4. Geração de RentSchedule

Quando um contrato transita para `ACTIVE`, o sistema gera automaticamente todas as parcelas mensais (`RentSchedule`) em `$transaction`:

```
Para cada mês de startDate até endDate (ou +12 meses se autoRenew):
  criar RentSchedule {
    contractId,
    companyId,
    dueDate: primeiro dia do mês (dia 1),
    amount:  contract.monthlyValue,
    status:  PENDING
  }
```

**Regras:**
- BR-CONT-001: O primeiro `RentSchedule` vence no dia 1 do mês seguinte à assinatura (se assinado após dia 15) ou no dia 1 do mês corrente (se assinado antes do dia 15).
- BR-CONT-002: Parcelas com `status=PENDING` e `dueDate < today` são marcadas `OVERDUE` pelo cron diário.
- BR-CONT-003: A geração de novas parcelas para contratos `autoRenew=true` ocorre 30 dias antes do fim.

---

## 5. Faturação Automática

O cron de faturação (executado no **dia 25 de cada mês**) faz:

```
1. Seleccionar todos os RentSchedule com:
   - status = PENDING
   - dueDate = primeiro dia do mês seguinte

2. Para cada schedule:
   a. Gerar Invoice (type=COWORKING, status=DRAFT)
   b. Adicionar InvoiceItem com accountCode correcto
   c. Calcular IVA (14%)
   d. Emitir Invoice (status=ISSUED)
   e. Actualizar RentSchedule.status = INVOICED
   f. Enviar PDF por email via Resend
   g. Publicar evento erp.invoice.issued
   h. Criar TimelineEntry na Company
```

Toda esta operação ocorre dentro de `$transaction`.

---

## 6. Caução

**Campos relevantes:**
- `Contract.depositAmount` — valor da caução acordada
- `Contract.depositStatus` — PENDING | PAID | RETURNED | FORFEITED
- `Contract.depositPaidAt` — data de recepção

**Regras financeiras:**
- A caução é registada como passivo (conta `1401`) no momento da recepção. **Nunca como receita.**
- Na devolução: débito em `1401`, crédito em `1201` (banco).
- Em caso de retenção (FORFEITED): débito em `1401`, crédito em `7311` (outros proveitos).
- `FinancialAlert` é criado automaticamente se a caução não for paga em 15 dias após assinatura.

---

## 7. Reajuste de Valor

Os contratos podem incluir regras de reajuste automático (`adjustmentRules`):

```json
{
  "type": "IPC",
  "rate": 0.08,
  "frequency": "ANNUAL",
  "applyOn": "CONTRACT_ANNIVERSARY",
  "minRate": 0.05,
  "maxRate": 0.15
}
```

**Tipos de reajuste suportados:**
- `IPC` — Índice de Preços ao Consumidor (Angola)
- `FIXED_RATE` — taxa fixa definida no contrato
- `NEGOTIATED` — acordo manual entre as partes

O reajuste requer aprovação do ADMIN antes de ser aplicado. Após aprovação, gera novo `RentSchedule` com valor actualizado e `TimelineEntry`.

---

## 8. Alertas Automáticos de Contrato

| Trigger | Tipo de Alerta | Severidade |
|---|---|---|
| `endDate - 60 dias` | `CONTRACT_EXPIRING` | INFO |
| `endDate - 30 dias` | `CONTRACT_EXPIRING` | WARNING |
| `endDate - 7 dias` | `CONTRACT_EXPIRING` | CRITICAL |
| `endDate` atingida | `CONTRACT_EXPIRED` | CRITICAL |
| `depositPaidAt` > 15 dias após assinatura | `DEPOSIT_DUE` | WARNING |
| `RentSchedule.dueDate` + 1 dia sem Invoice | `PAYMENT_OVERDUE` (aviso) | INFO |

---

## 9. Rescisão de Contrato

**Processo de rescisão (ADMIN):**

```
1. Definir terminationReason e terminatedAt
2. Calcular meses remanescentes
3. Cancelar RentSchedules PENDING futuros (status=CANCELLED)
4. Verificar Invoices pendentes → manter ou anular conforme política
5. Calcular devolução de caução (ou retenção parcial)
6. Publicar erp.contract.terminated
7. Actualizar Company.contractStatus = "TERMINATED"
8. Gerar TimelineEntry
```

A rescisão NÃO cancela automaticamente faturas já emitidas com `status=ISSUED` ou `SENT`.

---

## 10. Renovação Automática

Contratos com `autoRenew=true`:
1. Cron executa 30 dias antes de `endDate`
2. Gera novo `endDate = endDate + 12 meses`
3. Gera RentSchedules para o novo período
4. Envia email de notificação ao cliente
5. Publica `erp.contract.renewed`
6. Cria `FinancialAlert` tipo INFO para o ADMIN revisar

---

*VD Platform — ERP — Contratos de Aluguer — Sprint ERP-0*
