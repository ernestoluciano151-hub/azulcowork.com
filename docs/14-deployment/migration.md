# Guia de Migração para Produção — VD Platform

> **Documento:** VOL11-MIGRATION  
> **Estado:** ✅ Aprovado  
> **Data:** 30 Julho 2026

---

## Visão Geral

Este documento descreve o processo de migração da base de dados de desenvolvimento (SQLite) para produção (PostgreSQL) e o setup inicial da plataforma num ambiente Vercel.

---

## Passo 1 — Escolher o Provider PostgreSQL

Recomendações por custo/facilidade:

| Provider | Free tier | Integração Vercel | URL |
|---|---|---|---|
| **Neon** (recomendado) | 0.5 GB | Nativa | neon.tech |
| Supabase | 500 MB | Via URL | supabase.com |
| Railway | 1 GB trial | Via URL | railway.app |

### Neon (setup em 5 minutos)

1. Criar conta em [neon.tech](https://neon.tech)
2. Criar novo projecto: nome `vd-platform`, região `EU-West` (mais próxima de Angola)
3. Copiar a `Connection String` do painel → usar como `DATABASE_URL`

Formato:
```
postgresql://USER:PASSWORD@ep-xxx.eu-west-2.aws.neon.tech/neondb?sslmode=require
```

---

## Passo 2 — Configurar Variáveis de Ambiente na Vercel

No painel Vercel → Settings → Environment Variables, configurar **todas** as variáveis do `.env.example`:

**Críticas (plataforma não funciona sem estas):**
```
DATABASE_URL           — PostgreSQL connection string
JWT_SECRET             — openssl rand -base64 64
PORTAL_JWT_SECRET      — openssl rand -base64 64
CRON_SECRET            — openssl rand -hex 32
NEXT_PUBLIC_APP_URL    — https://seu-dominio.vercel.app
```

**Email (magic link e faturas não funcionam sem estas):**
```
SMTP_HOST, SMTP_PORT, SMTP_SECURE, SMTP_USER, SMTP_PASS, SMTP_FROM
```

**Uploads/PDFs:**
```
CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET
NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME
```

---

## Passo 3 — Executar Migrations em Produção

**NUNCA usar `prisma migrate dev` em produção.** Usar sempre `prisma migrate deploy`.

### Via Vercel Build (automático)

Adicionar ao `package.json` o script de build de produção:

```json
{
  "scripts": {
    "build:prod": "prisma migrate deploy && next build"
  }
}
```

O `vercel.json` já configura `"buildCommand": "npm run build:prod"`, por isso as migrations correm automaticamente a cada deploy.

### Manual (se necessário)

```bash
# Apontar para a BD de produção
DATABASE_URL="postgresql://..." npx prisma migrate deploy

# Verificar estado das migrations
DATABASE_URL="postgresql://..." npx prisma migrate status
```

---

## Passo 4 — Executar o Seed de Produção

Após o primeiro deploy com migrations aplicadas:

```bash
# Via Vercel CLI
DATABASE_URL="postgresql://..." npx prisma db seed

# Ou localmente com BD de produção
DATABASE_URL="postgresql://..." node prisma/seed.js
```

O seed cria:
- Utilizador admin (ADMIN_EMAIL / ADMIN_PASSWORD)
- 5 MeetingPlans (Alpha, Beta, Gamma, Easy, Personalizado)
- 9 CostCenters ERP
- 22 ExpenseCategories ERP
- 6 DocumentCounters (FT-CWORK, FT-SALA, FT-SERV, REC, NL, RES)
- 1 DocumentCounter Portal (ST)
- 8 EmailTemplates VOL07 (leads, reservas, faturas, recibos, alertas)
- 2 DocumentTemplates VOL08 (proposta, contrato)
- 3 EmailTemplates VOL10 (portal-magic-link, portal-welcome, erp-invoice-issued)

**ATENÇÃO:** O seed é idempotente — pode ser re-executado sem duplicar dados.

---

## Passo 5 — Verificar Crons na Vercel

Após o deploy, verificar no painel Vercel → Cron Jobs que os 11 crons aparecem:

| Cron | Schedule (UTC) | Hora Luanda |
|---|---|---|
| erp-daily | `0 6 * * *` | 07:00 |
| communication-daily | `0 7 * * *` | 08:00 |
| portal-rent-due | `0 7 * * *` | 08:00 |
| portal-contract-expiring | `0 7 * * *` | 08:00 |
| portal-payment-overdue | `0 8 * * *` | 09:00 |
| portal-auto-close-tickets | `0 8 * * *` | 09:00 |
| reservations-close | `0 2 * * *` | 03:00 |
| erp-invoice-generate | `0 6 1 * *` | 07:00 (dia 1) |
| erp-monthly-snapshot | `0 22 28-31 * *` | 23:00 (fim mês) |
| portal-sla-check | `0 0,2,4,...,22 * * *` | de 2 em 2 horas |
| portal-notifications-retry | `*/5 * * * *` | cada 5 min |

---

## Passo 6 — Alterar Password do Admin

Imediatamente após o primeiro deploy:

1. Fazer login em `/admin/login` com ADMIN_EMAIL / ADMIN_PASSWORD do `.env`
2. Ir a Configurações → Conta → Alterar Password
3. Definir uma password segura (mínimo 16 chars, alfanumérico + especiais)
4. Activar 2FA TOTP (obrigatório para ADMIN)

---

## Rollback

### Rollback de Código

Via Vercel Dashboard → Deployments → seleccionar deploy anterior → Promote to Production.

### Rollback de Migration

```bash
# Identificar a migration anterior
DATABASE_URL="postgresql://..." npx prisma migrate status

# Reverter manualmente (Prisma não tem rollback automático)
# 1. Ligar à BD via psql ou ferramenta gráfica
# 2. Executar o SQL inverso da migration mais recente
# 3. Apagar o registo em _prisma_migrations
```

**Prevenção:** Testar sempre em staging antes de promover para produção.

---

## Checklist Pré-Go-Live

```
□ DATABASE_URL aponta para PostgreSQL (não SQLite)
□ JWT_SECRET e PORTAL_JWT_SECRET são únicos e seguros (≥ 32 chars)
□ CRON_SECRET configurado
□ NEXT_PUBLIC_APP_URL é o URL correcto de produção
□ SMTP configurado e testado (enviar email de teste)
□ Cloudinary configurado e testado (upload de teste)
□ Migrations aplicadas com sucesso (prisma migrate status → all applied)
□ Seed executado (admin criado, MeetingPlans, CostCenters, EmailTemplates)
□ Login admin funciona
□ 2FA TOTP activado para admin
□ Password admin alterada
□ 11 crons aparecem no painel Vercel
□ Primeiro magic link testado (cliente recebe email)
□ Sentry DSN configurado e erro de teste capturado
```

---

*VD Platform — Guia de Migração — 30 Jul 2026*
