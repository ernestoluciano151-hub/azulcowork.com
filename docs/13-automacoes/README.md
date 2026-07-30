# Volume 10 — Automações: Email Portal + Faturação Mensal

> **Documento:** VOL10-README  
> **Estado:** ✅ **CONCLUÍDO — Sprint VOL10-4 (30 Jul 2026)**  
> **Pasta:** `docs/13-automacoes/`  
> **Arquiteto:** Claude (Arquiteto-Chefe VD Platform)

---

## Contexto

Dois gaps críticos de produção resolvidos neste volume:

**Gap 1 — Magic Link não enviava email**  
O `POST /api/portal/auth/magic-link` tinha o envio de email comentado com `TODO` desde o VOL03. O Portal do Cliente era inutilizável em produção (nenhum utilizador recebia o link de acesso).

**Gap 2 — Rendas sem faturação automática**  
As entradas `ErpRentSchedule` acumulavam indefinidamente com `status=PENDING`. Não existia nenhum mecanismo que gerasse automaticamente `ErpInvoice` no vencimento de cada renda.

---

## Arquitectura

```
VOL10-1: Magic Link Email
  POST /api/portal/auth/magic-link
    → createMagicLink() [portal-auth-service]
    → sendEmail() [communication-service]     ← fire-and-forget
    → CommunicationLog (SENT | FAILED)
    → 200 OK (sempre — não revela se email existe)

VOL10-2: Email Boas-Vindas
  POST /api/admin/portal/users
    → prisma.portalUser.create()
    → sendEmail() [communication-service]     ← fire-and-forget
    → 201 Created

VOL10-3: Cron Faturação Mensal
  GET /api/cron/erp-invoice-generate
    → ErpRentSchedule.findMany(PENDING, dueDate ≤ now)
    → para cada schedule:
        $transaction {
          tx.erpInvoice.create(DRAFT)
          tx.erpRentSchedule.update(INVOICED + invoiceId)
        }
        void issueErpInvoice()               ← fire-and-forget
        void sendEmail(erp-invoice-issued)   ← fire-and-forget
    → { summary: { generated, skipped, errors } }
```

---

## Ficheiros

| Ficheiro | Tipo | Descrição |
|---|---|---|
| `src/app/api/portal/auth/magic-link/route.ts` | Modificado | TODO removido → `sendEmail()` integrado |
| `src/app/api/admin/portal/users/route.ts` | Modificado | Email boas-vindas adicionado |
| `src/lib/erp-invoice-generate-service.ts` | Criado | Lógica de auto-invoicing |
| `src/app/api/cron/erp-invoice-generate/route.ts` | Criado | Cron mensal de faturação |
| `src/__tests__/unit/erp-invoice-generate-service.test.ts` | Criado | 6 testes unitários |

**Total:** 5 ficheiros (2 modificados, 3 criados)

---

## Templates de Email

Os templates são resolvidos por slug em `EmailTemplate` (Prisma). Se não existirem, o `sendEmail()` utiliza o `html` inline como fallback (graceful degradation do VOL07).

| Slug | Trigger | Destinatário |
|---|---|---|
| `portal-magic-link` | Pedido de magic link | Cliente (email inserido no form) |
| `portal-welcome` | Admin cria PortalUser | Novo utilizador do portal |
| `erp-invoice-issued` | Cron gera fatura | `company.billingEmail ?? company.email` |

---

## Cron — Configuração Vercel

```json
{
  "crons": [
    { "path": "/api/cron/erp-invoice-generate", "schedule": "0 6 1 * *" }
  ]
}
```

`0 6 1 * *` = UTC 06:00 = Africa/Luanda 07:00 — 1.º dia de cada mês.

### Variáveis de ambiente necessárias

```
CRON_SECRET=<secret>          — obrigatório (header Authorization: Bearer)
NEXT_PUBLIC_APP_URL=https://... — para construir URLs nos emails
SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS — configuração nodemailer
```

---

## Garantias de Idempotência

O campo `ErpRentSchedule.invoiceId` é `@unique`. Se o cron correr duas vezes no mesmo mês (ex: retry após falha), o segundo ciclo detecta `invoiceId != null` e retorna `status: "skipped"` sem criar duplicado.

---

## Isolamento de Erros

Cada `ErpRentSchedule` é processado de forma independente. Uma falha de BD num schedule não impede os restantes. O resultado inclui `status: "error"` com a mensagem de erro para cada falha isolada.

---

## DoD Checklist

```
✅ VOL10-1: sendEmail() integrado no magic-link route (TODO removido)
✅ VOL10-2: Email boas-vindas no POST /api/admin/portal/users
✅ VOL10-3: erp-invoice-generate-service.ts criado com $transaction + fire-and-forget
✅ VOL10-3: /api/cron/erp-invoice-generate criado com autenticação CRON_SECRET
✅ VOL10-4: 6 testes unitários (idempotência, isolamento, happy path, mixed)
✅ VOL10-4: ADR-040 criado
✅ VOL10-4: CLAUDE.md actualizado (VOL10 CONCLUÍDO)
✅ VOL10-4: docs/README.md actualizado
✅ Fire-and-forget em todos os emails — falha SMTP nunca bloqueia resposta HTTP
✅ Sem alterações ao schema Prisma
✅ Sem regressões nos módulos existentes (VOL03, VOL07, ERP)
```

---

## Sprint Log

| Sprint | Data | Conteúdo |
|---|---|---|
| VOL10-1 | 30 Jul 2026 | sendEmail() no magic-link route |
| VOL10-2 | 30 Jul 2026 | Email boas-vindas no admin portal/users |
| VOL10-3 | 30 Jul 2026 | erp-invoice-generate-service + cron |
| VOL10-4 | 30 Jul 2026 | Testes + ADR-040 + DoD |

---

*VD Platform — VOL10 Automações — 30 Jul 2026*
