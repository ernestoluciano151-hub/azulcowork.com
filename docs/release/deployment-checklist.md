# Deployment Checklist — VD Platform v1.0

> **Versão:** 1.0.0-rc  
> **Data:** 30 Julho 2026  
> **Sprint:** RC-1  
> **Ambiente:** Produção Vercel + PostgreSQL (Neon)  

---

## Pré-Requisitos

Antes de iniciar qualquer deploy, confirmar:

```
□ Acesso ao painel Vercel com permissão de deploy
□ Acesso ao painel Neon (ou provider PostgreSQL escolhido)
□ Acesso ao painel Cloudinary
□ Acesso ao painel Sentry
□ Conta SMTP configurada (Brevo ou equivalente)
□ Chaves VAPID geradas: npx web-push generate-vapid-keys
□ CRON_SECRET gerado: openssl rand -hex 32
□ JWT_SECRET gerado: openssl rand -base64 64
□ PORTAL_JWT_SECRET gerado: openssl rand -base64 64
□ Senha de admin inicial definida (≥ 12 caracteres, diferente do padrão)
```

---

## Fase 1 — Base de Dados

```
□ 1.1  Criar projecto PostgreSQL no Neon (ou Supabase/Railway)
□ 1.2  Copiar connection string: postgresql://USER:PASS@HOST:5432/DB?sslmode=require
□ 1.3  Adicionar ao Vercel: Settings → Environment Variables → DATABASE_URL
□ 1.4  Verificar que sslmode=require está incluído na URL
□ 1.5  [Opcional] Testar conexão local: DATABASE_URL="..." npx prisma db pull
```

## Fase 2 — Variáveis de Ambiente Vercel

Configurar todas as variáveis do `.env.example` no painel Vercel:

### Obrigatórias (bloqueiam deploy ou funcionalidade crítica)

```
□ 2.1  DATABASE_URL             = postgresql://...
□ 2.2  JWT_SECRET               = [openssl rand -base64 64]  — mínimo 32 chars
□ 2.3  PORTAL_JWT_SECRET        = [openssl rand -base64 64]  — OBRIGATÓRIO separado do JWT_SECRET
□ 2.4  NEXT_PUBLIC_APP_URL      = https://app.azulcowork.com
□ 2.5  CRON_SECRET              = [openssl rand -hex 32]
□ 2.6  SMTP_HOST                = smtp.brevo.com
□ 2.7  SMTP_PORT                = 587
□ 2.8  SMTP_USER                = [email SMTP]
□ 2.9  SMTP_PASS                = [password SMTP]
□ 2.10 SMTP_FROM                = "Azul Coworking" <noreply@azulcowork.com>
□ 2.11 CLOUDINARY_CLOUD_NAME    = [cloud name]
□ 2.12 CLOUDINARY_API_KEY       = [api key]
□ 2.13 CLOUDINARY_API_SECRET    = [api secret]
□ 2.14 VAPID_PUBLIC_KEY         = [gerado com web-push generate-vapid-keys]
□ 2.15 VAPID_PRIVATE_KEY        = [gerado com web-push generate-vapid-keys]
□ 2.16 VAPID_EMAIL              = mailto:geral@azulcowork.com
□ 2.17 SENTRY_DSN               = https://...@....ingest.sentry.io/...
□ 2.18 NEXT_PUBLIC_SENTRY_DSN   = [mesmo valor de SENTRY_DSN]
□ 2.19 SENTRY_AUTH_TOKEN        = sntrys_...
```

### Opcionais (funcionalidade degradada se ausentes)

```
□ 2.20 RESEND_API_KEY           = re_...      [fallback email]
□ 2.21 META_WHATSAPP_TOKEN      = EAA...      [notificações WhatsApp]
□ 2.22 META_WHATSAPP_PHONE_ID   = ...         [notificações WhatsApp]
□ 2.23 ADMIN_EMAIL              = admin@azulcowork.com
□ 2.24 ADMIN_PASSWORD           = [senha admin — mínimo 12 chars, não usar padrão]
□ 2.25 ROOM_DAILY_HOURS         = 10
□ 2.26 NEXT_PUBLIC_SITE_NAME    = Azul Coworking
□ 2.27 NEXT_PUBLIC_SITE_URL     = https://www.azulcowork.com
□ 2.28 NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME = [cloud name]
```

## Fase 3 — Primeiro Deploy

```
□ 3.1  Conectar repositório GitHub ao projecto Vercel
□ 3.2  Build Command: npm run build:prod
        (= prisma migrate deploy && next build)
□ 3.3  Output Directory: .next  [padrão Next.js]
□ 3.4  Node.js Version: 20.x
□ 3.5  Iniciar deploy manual (ou push para branch main)
□ 3.6  Verificar build log: confirmar "prisma migrate deploy" executou sem erros
□ 3.7  Verificar build log: confirmar "next build" completou sem erros TypeScript
□ 3.8  Aguardar URL de produção Vercel
```

## Fase 4 — Seed de Produção

```
□ 4.1  No Vercel → Functions → Run: npm run db:seed
        OU localmente com DATABASE_URL de produção:
        DATABASE_URL="postgresql://..." node prisma/seed.js
□ 4.2  Verificar criação de: AdminUser admin@azulcowork.com
□ 4.3  Verificar criação de: CostCenters (pelo menos 3)
□ 4.4  Verificar criação de: ExpenseCategories (pelo menos 5)
□ 4.5  Verificar criação de: DocumentCounters (FT-SALA, FT-CWORK, REC, NL, RES)
□ 4.6  Verificar criação de: MeetingRoom (pelo menos 1 sala)
□ 4.7  Verificar criação de: MeetingPlan (pelo menos 1 plano)
```

## Fase 5 — Verificação de Crons (11 total)

```
□ 5.1  Vercel → Settings → Crons — verificar 11 entradas activas
□ 5.2  Testar manualmente cada endpoint (com Authorization: Bearer {CRON_SECRET}):
       □ POST /api/cron/erp-daily              (07:00 WAT)
       □ POST /api/cron/communication-daily    (08:00 WAT)
       □ POST /api/cron/portal-rent-due        (08:00 WAT)
       □ POST /api/cron/portal-contract-expiring (08:00 WAT)
       □ POST /api/cron/portal-payment-overdue (09:00 WAT)
       □ POST /api/cron/portal-auto-close-tickets (09:00 WAT)
       □ POST /api/cron/reservations-close     (03:00 WAT)
       □ POST /api/cron/erp-invoice-generate   (07:00 WAT — dia 1)
       □ POST /api/cron/erp-monthly-snapshot   (23:00 WAT — dias 28-31)
       □ POST /api/cron/portal-sla-check       (a cada 2h)
       □ POST /api/cron/portal-notifications-retry (a cada 5min)
□ 5.3  Confirmar resposta HTTP 200 em todos
□ 5.4  Confirmar sem entradas de erro no Sentry
```

## Fase 6 — Smoke Test Manual (30 minutos)

```
□ 6.1  Login admin: /admin/login → admin@azulcowork.com + senha configurada
□ 6.2  TOTP: configurar 2FA no primeiro login (Settings → Segurança)
□ 6.3  Criar empresa de teste
□ 6.4  Criar contrato ERP para empresa de teste
□ 6.5  Emitir fatura manualmente
□ 6.6  Registar despesa e aprovar
□ 6.7  Verificar fluxo de caixa actualizado
□ 6.8  Criar reserva de sala
□ 6.9  Verificar disponibilidade de sala
□ 6.10 Criar utilizador de portal para empresa de teste
□ 6.11 Enviar magic link → verificar email recebido
□ 6.12 Login no portal (/portal/login)
□ 6.13 Verificar dashboard do portal (faturas, contrato)
□ 6.14 Verificar Audit Log em /admin/auditoria
□ 6.15 Verificar Sentry: sem erros críticos no dashboard
```

## Fase 7 — Segurança Pós-Deploy

```
□ 7.1  Alterar senha do admin: /admin/settings → conta admin@azulcowork.com
□ 7.2  Activar TOTP 2FA para a conta admin
□ 7.3  Verificar que /admin/* redireccionam sem sessão (testar em janela privada)
□ 7.4  Verificar que /portal/* redireccionam sem sessão
□ 7.5  Verificar headers de segurança: curl -I https://app.azulcowork.com
        Esperado: Strict-Transport-Security, X-Frame-Options, X-Content-Type-Options
□ 7.6  Verificar que JWT_SECRET não é o valor padrão (auth.ts lança erro se for)
□ 7.7  Confirmar NODE_ENV=production no Vercel (cookies secure: true)
□ 7.8  Revogar qualquer sessão de teste: /admin/settings → Sessões Activas
```

## Fase 8 — Monitorização Inicial (48h pós-deploy)

```
□ 8.1  Sentry: sem erros de nível ERROR ou CRITICAL
□ 8.2  Vercel: analytics de Core Web Vitals activos
□ 8.3  Neon/DB: sem conexões esgotadas, latência < 100ms em p95
□ 8.4  Confirmar primeiro cron diário executado sem erros (dia seguinte ao deploy)
□ 8.5  Confirmar portal-notifications-retry a cada 5min sem falhas
□ 8.6  Email de boas-vindas entregue ao utilizador de teste do portal
```

---

## Revert de Emergência

Se qualquer passo falhar de forma crítica: ver `rollback-checklist.md`

---

*VD Platform — Deployment Checklist v1.0 — 30 Jul 2026*
