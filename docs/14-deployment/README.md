# VOL11 — Deployment & Infraestrutura de Produção

> **Volume:** 11  
> **Estado:** ✅ CONCLUÍDO — Sprint VOL11-4 (30 Jul 2026)  
> **ADR:** ADR-041  
> **Pasta:** `docs/14-deployment/`

---

## Problema Resolvido

Após a conclusão de VOL10, a plataforma tinha código completo mas dois bloqueadores de produção críticos:

1. **`vercel.json` com zero crons** — 11 endpoints de cron implementados, nenhum configurado no Vercel → automações nunca corriam em produção
2. **`.env.example` incompleto** — 18 de 28 variáveis de ambiente em falta → qualquer novo deploy falhava por variáveis não configuradas

VOL11 resolve ambos e adiciona seed de produção completo + documentação de deploy.

---

## Arquitetura

```
vercel.json          ← 11 cron schedules (UTC → Africa/Luanda)
.env.example         ← 28 variáveis documentadas em 11 secções
prisma/seed.js       ← seed idempotente completo (counters + templates)
docs/14-deployment/
  ├── README.md      ← este ficheiro (runbook)
  └── migration.md   ← guia PostgreSQL + checklist pré-go-live
```

---

## Sprints

### VOL11-1 — `vercel.json` com 11 crons ✅

Ficheiro reescrito com todos os 11 cron jobs e `buildCommand: "npm run build:prod"`.

| Endpoint | Schedule UTC | Hora Luanda | Função |
|---|---|---|---|
| `/api/cron/erp-daily` | `0 6 * * *` | 07:00 | Alertas ERP diários |
| `/api/cron/communication-daily` | `0 7 * * *` | 08:00 | Comunicações agendadas |
| `/api/cron/portal-rent-due` | `0 7 * * *` | 08:00 | Alertas renda a vencer |
| `/api/cron/portal-contract-expiring` | `0 7 * * *` | 08:00 | Alertas contrato a expirar |
| `/api/cron/portal-payment-overdue` | `0 8 * * *` | 09:00 | Alertas pagamento em atraso |
| `/api/cron/portal-auto-close-tickets` | `0 8 * * *` | 09:00 | Auto-encerrar tickets |
| `/api/cron/reservations-close` | `0 2 * * *` | 03:00 | Encerrar reservas passadas |
| `/api/cron/erp-invoice-generate` | `0 6 1 * *` | 07:00 dia 1 | Faturação mensal auto |
| `/api/cron/erp-monthly-snapshot` | `0 22 28-31 * *` | 23:00 fim mês | Snapshot BI mensal |
| `/api/cron/portal-sla-check` | `0 */2 * * *` | de 2h em 2h | SLA tickets |
| `/api/cron/portal-notifications-retry` | `*/5 * * * *` | cada 5 min | Retry notificações |

Autenticação de todos os crons: `Authorization: Bearer ${CRON_SECRET}`.

### VOL11-2 — `.env.example` completo ✅

28 variáveis documentadas, organizadas em 11 secções:

1. Base de Dados (SQLite dev / PostgreSQL prod)
2. Autenticação Admin (JWT_SECRET, ADMIN_EMAIL, ADMIN_PASSWORD)
3. Portal do Cliente (PORTAL_JWT_SECRET)
4. URL da Aplicação (NEXT_PUBLIC_APP_URL, NEXT_PUBLIC_SITE_URL)
5. Cron Jobs (CRON_SECRET)
6. Email SMTP (SMTP_HOST, PORT, SECURE, USER, PASS, FROM + RESEND fallback)
7. Cloudinary (uploads e PDFs)
8. Web Push VAPID (notificações push)
9. WhatsApp Business API (Meta)
10. Configurações de Operação (ROOM_DAILY_HOURS)
11. Sentry (error monitoring)

### VOL11-3 — Seed de produção + Guia PostgreSQL ✅

**`prisma/seed.js`** — adicionados:
- `DocumentCounter` FT-CWORK (faturas coworking)
- `DocumentCounter` FT-SALA (faturas sala reunião)
- `DocumentCounter` REC (recibos)
- `DocumentCounter` RES (reservas)
- `EmailTemplate` `portal-magic-link` (VOL10)
- `EmailTemplate` `portal-welcome` (VOL10)
- `EmailTemplate` `erp-invoice-issued` (VOL10)

**`docs/14-deployment/migration.md`** — guia passo-a-passo:
- Escolha de provider PostgreSQL (Neon recomendado)
- Setup variáveis Vercel
- `prisma migrate deploy` vs `prisma migrate dev`
- Execução do seed em produção
- Verificação dos 11 crons
- Rollback de código e de migration
- Checklist pré-go-live (15 itens)

### VOL11-4 — Documentação e encerramento ✅

- `docs/14-deployment/README.md` (este ficheiro)
- ADR-041 criado
- `CLAUDE.md` actualizado: VOL11 CONCLUÍDO
- `docs/README.md` actualizado: VOL11 CONCLUÍDO

---

## Runbook de Deploy (Resumo Executivo)

```
1. Criar BD PostgreSQL (Neon recomendado)
2. Configurar todas as variáveis em Vercel → Settings → Env Vars
3. git push → Vercel faz: prisma migrate deploy && next build
4. Executar seed: DATABASE_URL="..." node prisma/seed.js
5. Verificar 11 crons em Vercel → Cron Jobs
6. Fazer login admin + alterar password + activar 2FA
7. Testar magic link (cliente recebe email)
8. Verificar Sentry captura erros
```

Guia completo: `docs/14-deployment/migration.md`

---

## Decisões Arquitecturais

Ver: `docs/adr/ADR-041-deployment-infrastructure.md`

---

## Ficheiros Modificados

| Ficheiro | Tipo | Acção |
|---|---|---|
| `vercel.json` | Config | Reescrito — 11 crons adicionados |
| `.env.example` | Config | Reescrito — 28 variáveis documentadas |
| `prisma/seed.js` | Seed | 4 DocumentCounters + 3 EmailTemplates adicionados |
| `docs/14-deployment/migration.md` | Docs | Criado |
| `docs/14-deployment/README.md` | Docs | Criado |
| `docs/adr/ADR-041-deployment-infrastructure.md` | ADR | Criado |

---

*VD Platform — VOL11 — 30 Jul 2026*
