# ERP — Comunicação Financeira

> **Volume:** 02 — ERP  
> **Estado:** ✅ Implementado — Sprint ERP-8 (29 Jul 2026)

---

## 1. Visão Geral

O módulo de comunicação financeira gera PDFs de documentos fiscais e envia-os por email ao cliente. É composto por três serviços:

| Serviço | Responsabilidade |
|---|---|
| `erp-pdf-service.tsx` | Geração de PDFs com `@react-pdf/renderer` |
| `erp-email-service.ts` | Templates HTML + envio SMTP via `nodemailer` |
| `erp-communication-service.ts` | Orquestrador: PDF → Cloudinary → BD → Email → Evento |

---

## 2. Documentos Gerados

### 2.1 Factura (FT-*)

**Template:** `InvoiceDoc` em `erp-pdf-service.tsx`

Conteúdo:
- Cabeçalho: AZUL COWORKING · NIF 5002174308 · Bairro Azul, Edifício 18, Luanda
- Identificação: n.º factura, data emissão, data vencimento (em vermelho)
- Dados do cliente: nome, NIF, email, responsável
- Tabela de itens: descrição, quantidade, preço unitário, total
- Totais: subtotal, IVA 14% (Lei n.º 17/19), **TOTAL**
- Dados bancários: BCS · IBAN AO06007000000212870210113 · SWIFT CDTSAOLU
- Rodapé: "Este documento não é válido como recibo de pagamento."

### 2.2 Recibo (REC-*)

**Template:** `ReceiptDoc` em `erp-pdf-service.tsx`

Conteúdo:
- Cabeçalho idêntico ao da factura
- N.º recibo, data, referência à factura original
- "Recebido de": nome + email da empresa
- Forma de pagamento + referência bancária
- Bloco azul com valor recebido em destaque
- Mensagem de agradecimento

---

## 3. Templates de Email

| Função | Assunto | Trigger |
|---|---|---|
| `sendInvoiceEmail` | `Factura FT-* — Azul Coworking` | `POST /api/erp/invoices/[id]/send` |
| `sendReceiptEmail` | `Recibo de Pagamento REC-* — Azul Coworking` | `POST /api/erp/payments/[id]/receipt` |
| `sendReminderEmail` | `Lembrete: Factura FT-* vence em N dia(s)` | `POST /api/erp/invoices/[id]/remind` |
| `sendOverdueEmail` | `⚠ URGENTE: Factura FT-* em atraso (N dias)` | Manual ou cron futuro |

Todos os templates usam `buildBaseHtml(title, body)` — estrutura HTML responsiva com cabeçalho azul Azul Coworking e rodapé com NIF.

---

## 4. Fluxo `sendInvoice`

```
POST /api/erp/invoices/[id]/send
  ↓
sendInvoice(invoiceId, actorId)
  ↓ validar: status = ISSUED + company.email definido
  ↓ generateInvoicePdf(data) → Buffer
  ↓ uploadPdfToCloudinary → /invoices/YYYY/MM/<number>.pdf
  ↓ prisma.erpInvoice.update: status=SENT, sentAt, sentTo, pdfUrl
  ↓ sendInvoiceEmail(to, invoiceData, pdfUrl)
  ↓ publish('erp.invoice.sent', {...})
```

### Resposta

```json
{
  "ok": true,
  "pdfGenerated": true,
  "pdfUrl": "https://res.cloudinary.com/azul/raw/upload/azul-cowork/erp/invoices/2026/07/FT-CWORK-2026-000042.pdf",
  "emailSent": true
}
```

---

## 5. Fluxo `sendReceipt`

```
POST /api/erp/payments/[id]/receipt
  ↓
sendReceipt(paymentId)
  ↓ validar: receiptNumber definido
  ↓ generateReceiptPdf(data) → Buffer
  ↓ uploadPdfToCloudinary → /receipts/YYYY/MM/<receiptNumber>.pdf
  ↓ prisma.erpPayment.update: receiptUrl
  ↓ sendReceiptEmail(to, receiptData, pdfUrl)
```

---

## 6. Cloudinary

| Tipo | Pasta |
|---|---|
| Facturas | `azul-cowork/erp/invoices/YYYY/MM/` |
| Recibos | `azul-cowork/erp/receipts/YYYY/MM/` |

`resource_type: "raw"` — PDFs armazenados como ficheiros raw (não imagem).  
`overwrite: true` — re-envio regenera o PDF sem criar duplicados.

---

## 7. Graceful Degradation

| Condição | Comportamento |
|---|---|
| Cloudinary não configurado | PDF gerado mas não uploaded; `pdfUrl = null`; operação continua |
| SMTP não configurado | PDF gerado e uploaded; email não enviado; aviso em `warnings[]` |
| Ambos não configurados | BD actualizada; `warnings[]` com ambos os avisos |

O campo `warnings` na resposta da API lista os problemas não fatais.

---

## 8. Env Vars

```env
# Cloudinary
CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=

# SMTP (nodemailer)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=geral@azulcowork.com
SMTP_PASS=
SMTP_FROM=Azul Coworking <geral@azulcowork.com>
```

---

## 9. RBAC

| Endpoint | ADMIN | FINANCEIRO | COMERCIAL | VIEWER |
|---|---|---|---|---|
| `POST /api/erp/invoices/[id]/send` | ✅ | ✅ | ❌ | ❌ |
| `POST /api/erp/payments/[id]/receipt` | ✅ | ✅ | ❌ | ❌ |
| `POST /api/erp/invoices/[id]/remind` | ✅ | ✅ | ❌ | ❌ |

---

## 10. Testes Unitários

`src/__tests__/unit/erp-communication-service.test.ts` — 33 testes:
- Formatação AOA (`fmtKz`)
- Formatação de data (`fmtDate`)
- Cloudinary folder path (YYYY/MM com padding)
- `buildInvoiceHtml`: campos obrigatórios, IBAN, link PDF
- `buildReceiptHtml`: método traduzido, referência factura opcional
- `buildReminderHtml`: urgência ≤3 dias vs. >3 dias
- `buildOverdueHtml`: cor vermelha, texto urgente
- `buildBaseHtml`: DOCTYPE, cabeçalho, NIF, corpo injectado
- Todas as etiquetas de método de pagamento (6 métodos)

---

*VD Platform — ERP — Comunicação Financeira — Sprint ERP-8 — 29 Jul 2026*
