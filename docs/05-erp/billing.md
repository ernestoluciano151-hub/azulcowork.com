# ERP — Faturação (Billing)

> **Volume:** 02 — ERP  
> **Documento:** billing.md  
> **Estado:** ✅ Implementado — Sprint ERP-2 (28 Jul 2026)

---

## 1. Visão

O módulo de faturação é responsável pela emissão, numeração, geração de PDF e envio de faturas para todos os tipos de serviço do Azul Coworking.

**Tipos de fatura:**
- `COWORKING` — mensalidades de contratos de coworking
- `ROOM` — reservas de salas de reunião
- `SERVICE` — serviços adicionais (impressão, café, domiciliação)
- `MIXED` — combinação de serviços na mesma fatura
- `EXPENSE_REIMBURSEMENT` — reembolso de despesas a clientes

---

## 2. Numeração de Faturas

Segue o sistema `DocumentCounter` já implementado (ADR-007):

| Tipo | Formato | Exemplo |
|---|---|---|
| Coworking | `FT-CWORK-YYYY-NNNNNN` | FT-CWORK-2026-000001 |
| Salas | `FT-SALA-YYYY-NNNNNN` | FT-SALA-2026-000001 |
| Serviços | `FT-SERV-YYYY-NNNNNN` | FT-SERV-2026-000001 |
| Recibos | `REC-YYYY-NNNNNN` | REC-2026-000001 |
| Notas de Liquidação | `NL-YYYY-NNNNNN` | NL-2026-000001 |

A geração do número ocorre dentro de `$transaction` com `SELECT ... FOR UPDATE` no `DocumentCounter`.

---

## 3. Ciclo de Vida da Fatura

```
DRAFT → ISSUED → SENT → PAID
              → OVERDUE (dueDate passada sem pagamento)
              → PARTIALLY_PAID
              → CANCELLED
              → VOID (anulada com estorno)
```

**Transições válidas:**

| De | Para | Condição |
|---|---|---|
| `DRAFT` | `ISSUED` | Todos os items preenchidos, total > 0 |
| `ISSUED` | `SENT` | PDF gerado e email enviado |
| `ISSUED/SENT` | `PAID` | Payment.amount = Invoice.total e confirmado |
| `ISSUED/SENT` | `PARTIALLY_PAID` | Payment.amount < Invoice.total |
| `ISSUED/SENT` | `OVERDUE` | dueDate < today (cron diário) |
| `ISSUED/SENT/OVERDUE` | `VOID` | ADMIN, sem pagamentos confirmados |
| `DRAFT/ISSUED` | `CANCELLED` | ADMIN |

---

## 4. Estrutura da Fatura

### Cabeçalho (Emitente)
```
VERSÃO DE NEGÓCIOS - COMÉRCIO GERAL E PRESTAÇÃO DE SERVIÇOS, LDA
NIF: 5002174308
Bairro Azul, Edifício 18, Luanda, Angola
Tel: 976 467 124 | geral@azulcowork.com | www.azulcowork.com
```

### Dados do Cliente
```
Nome / Razão Social: [Company.name]
NIF: [Company.nif]
Endereço: [Company.address]
Email de faturação: [Company.billingEmail || Company.email]
```

### Items da Fatura
```
Descrição              | Qtd | Preço Unit. | Total
-----------------------|-----|-------------|--------
Mensalidade Hot Desk   |  1  | Kz 45.000   | Kz 45.000
Sala Reunião (2h)      |  1  | Kz  8.000   | Kz  8.000
-----------------------|-----|-------------|--------
Subtotal               |     |             | Kz 53.000
IVA 14%                |     |             | Kz  7.420
Total                  |     |             | Kz 60.420
```

### Dados de Pagamento
```
IBAN: AO06007000000212870210113
SWIFT: CDTSAOLU
Banco: BCS
Referência: [Invoice.number]
Prazo: [Invoice.dueDate]
```

---

## 5. Geração de PDF

**Biblioteca:** `@react-pdf/renderer` ou `puppeteer` (a definir no Sprint ERP-2)

**Processo:**
1. Template React → HTML → PDF
2. Upload para Cloudinary (`/invoices/YYYY/MM/[number].pdf`)
3. Actualizar `Invoice.pdfUrl`
4. Disponível para download no portal do cliente

**Decisão arquitectural (a formalizar em ADR):**
- Opção A: Puppeteer (headless Chrome) — rendering fiel ao HTML
- Opção B: react-pdf — library dedicada, sem browser headless
- Recomendação: **react-pdf** (sem dependência de Chrome em produção)

---

## 6. Envio por Email (Resend)

**Template de email (fatura):**
```
Assunto: Fatura [number] — Azul Coworking — Kz [total]
Remetente: financeiro@azulcowork.com
Destinatário: Company.billingEmail || Company.email || Contact.email (primary)

Conteúdo:
- Nome do cliente
- Número da fatura
- Valor total
- Data de vencimento
- Dados bancários
- Link de download do PDF
- Botão "Ver Fatura"
```

**Template de lembrete (3 dias antes do vencimento):**
```
Assunto: Lembrete: Fatura [number] vence em 3 dias
```

**Template de fatura vencida:**
```
Assunto: ⚠ Fatura [number] vencida — Azul Coworking
```

---

## 7. Regras de Negócio

### BR-BILL-001 — IVA Obrigatório
Toda fatura emitida a empresas com NIF angolano inclui IVA a 14%. Isenções apenas com documento de suporte aprovado por ADMIN.

### BR-BILL-002 — Fatura VOID
Uma fatura só pode ser anulada se não tiver pagamentos com `status=CONFIRMED`. A anulação gera estorno no `FinancialLedger` (lançamentos reversivos) e `TimelineEntry`.

### BR-BILL-003 — Prazo Padrão
O prazo padrão de pagamento é **30 dias** a partir da data de emissão, salvo acordo diferente no contrato.

### BR-BILL-004 — Fatura de Sala Automática
Uma `Invoice` do tipo `ROOM` é gerada automaticamente quando uma `RoomBooking` transita para `CONFIRMED`. O sistema não deve exigir acção manual.

### BR-BILL-005 — Fatura Mista
Se uma empresa recebe serviços de coworking e reservou uma sala no mesmo mês, o sistema pode (opcionalmente) consolidar numa `Invoice` do tipo `MIXED`, reduzindo o número de documentos.

### BR-BILL-006 — Email de Faturação
O email de envio da fatura usa `Company.billingEmail` se definido; caso contrário usa `Company.email`; caso contrário usa o email do `CrmContact` com `isPrimary=true`.

---

## 8. Faturação Manual (ADMIN)

Para casos não cobertos pela automação:

```
POST /api/erp/invoices
{
  type:       "MIXED",
  companyId:  "...",
  dueDate:    "2026-08-31",
  items: [
    { description: "Mensalidade Agosto", quantity: 1, unitPrice: 45000, accountCode: "7111" },
    { description: "Sala 2h extra",      quantity: 1, unitPrice:  8000, accountCode: "7121" }
  ]
}
```

O sistema calcula automaticamente `subtotal`, `taxAmount` e `total`.

---

*VD Platform — ERP — Faturação — Sprint ERP-0*
