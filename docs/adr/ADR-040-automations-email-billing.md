# ADR-040 — Automações: Email Portal + Faturação Mensal Automática (VOL10)

> **Estado:** ✅ ACEITE  
> **Data:** 30 Julho 2026  
> **Contexto:** VOL10 — Automações: Email Portal + Faturação Mensal  
> **Autor:** Claude (Arquiteto-Chefe VD Platform)

---

## Contexto

Dois gaps críticos foram identificados após a conclusão do VOL09:

1. **Magic link não enviava email** — `POST /api/portal/auth/magic-link` gerava o token mas o envio estava comentado com `TODO`. O Portal era inutilizável em produção.
2. **`ErpRentSchedule` PENDING acumulavam sem faturação** — entradas com `dueDate <= hoje` ficavam indefinidamente em `PENDING` sem gerar `ErpInvoice`, bloqueando o ciclo de receitas do Azul Coworking.

O VOL10 resolve ambos com 4 decisões arquitecturais.

---

## Decisão 1: `sendEmail()` como SSoT para todos os emails do portal

**Problema:** O `TODO` em `magic-link/route.ts` referia `sendPortalEmail()` (função que nunca existiu). Havia tentação de criar um serviço separado de email para o portal.

**Solução adoptada:** Integrar directamente `sendEmail()` de `@/lib/communication-service`, o SSoT já existente para todos os emails do sistema (VOL07).

**Alternativas consideradas:**
- Criar `portal-email-service.ts` com wrapper dedicado → duplicação; viola DRY
- Usar `nodemailer` directamente no route → viola SSoT; bypassa `CommunicationLog`

**Consequências:**
- Todos os emails do portal ficam registados em `CommunicationLog` (auditabilidade)
- Template DB (`EmailTemplate`) funciona para portal; inline HTML como fallback automático
- Zero novo serviço; zero nova dependência

---

## Decisão 2: Fire-and-forget obrigatório para emails em routes de auth

**Problema:** A segurança do endpoint `/api/portal/auth/magic-link` exige resposta `200 OK` independentemente de o email existir ou não (não revelar se email está registado). Uma falha SMTP não pode retornar `500`.

**Solução adoptada:** `void sendEmail(...).catch(err => console.error(...))` — a chamada ao `sendEmail` é disparada sem `await` e erros são apenas logados.

**Extensão:** O mesmo padrão é aplicado ao email de boas-vindas em `POST /api/admin/portal/users`. Falha de email nunca impede a criação do utilizador (201).

**Consequências:** Falhas SMTP são visíveis nos logs e no `CommunicationLog` (status `FAILED`) mas nunca afectam a experiência do utilizador nem a integridade de dados.

---

## Decisão 3: Serviço dedicado para auto-faturação (`erp-invoice-generate-service.ts`)

**Problema:** A lógica de auto-invoicing poderia ter sido adicionada ao `erp-billing-service.ts` ou directamente no cron. Qual a melhor localização?

**Solução adoptada:** Serviço próprio `erp-invoice-generate-service.ts` que orquestra:
- Query de `ErpRentSchedule` pendentes
- Criação de `ErpInvoice` via Prisma directamente (não `createErpInvoice()` — ver Decisão 4)
- Update atómico `schedule.status = INVOICED + invoiceId` na mesma `$transaction`
- Fire-and-forget: `issueErpInvoice()` + email após persistência

**Alternativas consideradas:**
- Adicionar a `erp-billing-service.ts` → viola SRP; o serviço já é grande
- Lógica no cron route → viola Clean Architecture; cron deve apenas orquestrar

**Consequências:** Cron route é thin; serviço é testável isoladamente; SRP respeitado.

---

## Decisão 4: `$transaction` com `tx.erpInvoice.create` directo (sem `createErpInvoice()`)

**Problema:** `createErpInvoice()` usa `prisma.$transaction()` internamente. Prisma não suporta transacções aninhadas (nested `$transaction`). Se chamado dentro do `$transaction` do update do schedule, causa erro de runtime.

**Solução adoptada:** No serviço de auto-invoicing, o `DRAFT` é criado directamente via `tx.erpInvoice.create` dentro da `$transaction` que também actualiza o schedule. A emissão definitiva (`issueErpInvoice`) — que inclui numeração atómica — é feita em fire-and-forget após commit.

**Consequências:**
- Atomicidade garantida: invoice DRAFT e schedule INVOICED nunca ficam dessincronizados
- Numeração definitiva (`FT-CWORK-YYYY-NNNNNN`) apenas em `issueErpInvoice` (fire-and-forget)
- Risco aceitável: se `issueErpInvoice` falhar após commit, a invoice fica em DRAFT — detectável via cron de alertas (`erp-daily`) e resolvível manualmente

**Pattern:** Este é o padrão `$transaction + post-commit fire-and-forget` já estabelecido em ADR-033.

---

## Impacto

| Ficheiro | Alteração |
|---|---|
| `src/app/api/portal/auth/magic-link/route.ts` | TODO removido; `sendEmail()` integrado |
| `src/app/api/admin/portal/users/route.ts` | Email boas-vindas adicionado (fire-and-forget) |
| `src/lib/erp-invoice-generate-service.ts` | **Novo** — lógica de auto-invoicing |
| `src/app/api/cron/erp-invoice-generate/route.ts` | **Novo** — cron mensal (1.º dia, 08:00 Luanda) |
| `src/__tests__/unit/erp-invoice-generate-service.test.ts` | **Novo** — 6 testes (idempotência, isolamento, happy path) |
| `docs/13-automacoes/README.md` | **Novo** — documentação VOL10 |
| `docs/adr/README.md` | +ADR-040 |
| `CLAUDE.md` | +VOL10 CONCLUÍDO |

---

## Configuração Vercel (vercel.json)

```json
{
  "crons": [
    { "path": "/api/cron/erp-invoice-generate", "schedule": "0 6 1 * *" }
  ]
}
```

`0 6 1 * *` = 06:00 UTC = 07:00 Africa/Luanda, no 1.º dia de cada mês.

---

## Referências

- ADR-033 — Post-commit pattern (fire-and-forget após persistência)
- ADR-037 — `communication-service.ts` como SSoT de email (VOL07)
- VOL03 — Magic Link backend (`createMagicLink`, `portal-auth-service.ts`)
- VOL07 — `sendEmail()`, `CommunicationLog`, `EmailTemplate`

---

*VD Platform — ADR-040 — 30 Julho 2026*
