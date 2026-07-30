# Variáveis de Ambiente — Volume 03 Portal do Cliente

> **Volume:** 03  
> **Estado:** ✅ Produzido em VOL03-10D — 29 Jul 2026  
> **Tipo:** Checklist de hardening — obrigatório antes de qualquer deploy do portal

---

## Variáveis Obrigatórias

Todas as variáveis abaixo devem estar definidas no ambiente de produção antes de activar o portal.
Ausência de qualquer variável obrigatória impede o arranque seguro do portal.

### Auth do Portal

| Variável | Obrigatória | Descrição |
|---|---|---|
| `PORTAL_JWT_SECRET` | Recomendada | Secret JWT exclusivo do portal. Se ausente, usa `JWT_SECRET + ":portal"` |
| `JWT_SECRET` | Obrigatória | Secret base para todo o sistema. Mínimo 32 caracteres aleatórios |

**Nota de segurança:**  
`PORTAL_JWT_SECRET` e `JWT_SECRET` devem ser strings diferentes e geradas de forma independente.  
Nunca usar a mesma string para ambas — elimina a separação de contexto entre admin e portal.

```bash
# Gerar secrets seguros (Linux/Mac)
openssl rand -hex 32   # para JWT_SECRET
openssl rand -hex 32   # para PORTAL_JWT_SECRET
```

### Base de Dados

| Variável | Obrigatória | Descrição |
|---|---|---|
| `DATABASE_URL` | Obrigatória | URL PostgreSQL (Neon) com SSL. Formato: `postgresql://user:pass@host/db?sslmode=require` |

### Email — Resend

| Variável | Obrigatória | Descrição |
|---|---|---|
| `RESEND_API_KEY` | Obrigatória | API key do Resend para envio de emails transaccionais |
| `RESEND_FROM_EMAIL` | Obrigatória | Endereço remetente verificado. Ex: `portal@azulcowork.com` |

### WhatsApp — Meta Cloud API

| Variável | Condicional | Descrição |
|---|---|---|
| `META_WHATSAPP_TOKEN` | Obrigatória se `notifyWhatsapp=true` | Token de acesso Meta Business API |
| `META_WHATSAPP_PHONE_ID` | Obrigatória se WhatsApp activo | Phone Number ID do Business Account |

### Web Push — VAPID

| Variável | Condicional | Descrição |
|---|---|---|
| `VAPID_PUBLIC_KEY` | Obrigatória se `notifyPush=true` | Chave pública VAPID (base64url) |
| `VAPID_PRIVATE_KEY` | Obrigatória se Push activo | Chave privada VAPID (nunca expor ao cliente) |
| `VAPID_EMAIL` | Obrigatória se Push activo | Email de contacto para os push servers. Ex: `mailto:admin@azulcowork.com` |

```bash
# Gerar par de chaves VAPID
npx web-push generate-vapid-keys
```

### Cloudinary — Documentos e Faturas

| Variável | Obrigatória | Descrição |
|---|---|---|
| `CLOUDINARY_CLOUD_NAME` | Obrigatória | Nome da cloud Cloudinary |
| `CLOUDINARY_API_KEY` | Obrigatória | API Key Cloudinary |
| `CLOUDINARY_API_SECRET` | Obrigatória | API Secret Cloudinary (usado para assinar URLs) |

### Cron Jobs

| Variável | Obrigatória | Descrição |
|---|---|---|
| `CRON_SECRET` | Obrigatória | Secret para autenticar endpoints `/api/cron/*`. Mínimo 32 caracteres |

Todos os 6 endpoints de cron do portal verificam `Authorization: Bearer ${CRON_SECRET}`.  
Ausência desta variável bloqueia todos os cron jobs.

### Monitorização — Sentry

| Variável | Recomendada | Descrição |
|---|---|---|
| `SENTRY_DSN` | Recomendada | DSN do Sentry para captura de erros em produção |
| `NEXT_PUBLIC_SENTRY_DSN` | Recomendada | DSN público (client-side error tracking) |

---

## Template `.env` para o Portal

```env
# ── Auth ──────────────────────────────────────────────
JWT_SECRET=<32+ chars aleatórios>
PORTAL_JWT_SECRET=<32+ chars aleatórios, DIFERENTE de JWT_SECRET>

# ── Base de dados ──────────────────────────────────────
DATABASE_URL=postgresql://user:pass@host/db?sslmode=require

# ── Email (Resend) ─────────────────────────────────────
RESEND_API_KEY=re_xxxxxxxxxxxxxxxxxxxx
RESEND_FROM_EMAIL=portal@azulcowork.com

# ── WhatsApp (Meta Cloud API) ──────────────────────────
META_WHATSAPP_TOKEN=EAAxxxxxxxxxxxxxxxx
META_WHATSAPP_PHONE_ID=123456789012345

# ── Web Push (VAPID) ───────────────────────────────────
VAPID_PUBLIC_KEY=Bxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
VAPID_PRIVATE_KEY=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
VAPID_EMAIL=mailto:admin@azulcowork.com

# ── Cloudinary ─────────────────────────────────────────
CLOUDINARY_CLOUD_NAME=azul-cowork
CLOUDINARY_API_KEY=123456789012345
CLOUDINARY_API_SECRET=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# ── Cron Jobs ──────────────────────────────────────────
CRON_SECRET=<32+ chars aleatórios>

# ── Sentry ─────────────────────────────────────────────
SENTRY_DSN=https://xxxxx@oxxxx.ingest.sentry.io/xxxxx
NEXT_PUBLIC_SENTRY_DSN=https://xxxxx@oxxxx.ingest.sentry.io/xxxxx
```

---

## Checklist de Deploy VOL03

```
□ JWT_SECRET definido e com ≥ 32 chars
□ PORTAL_JWT_SECRET definido (diferente de JWT_SECRET)
□ DATABASE_URL com ?sslmode=require
□ RESEND_API_KEY válido e domínio remetente verificado no Resend
□ CLOUDINARY_API_SECRET definido (necessário para signed URLs)
□ CRON_SECRET definido (bloqueia cron sem este valor)
□ Cron jobs registados no Vercel (ou provider equivalente):
    - /api/cron/portal-notifications-retry  → */5 * * * *
    - /api/cron/portal-sla-check            → 0 */2 * * *
    - /api/cron/portal-auto-close-tickets   → 0 9 * * *
    - /api/cron/portal-rent-due             → 0 7 * * *
    - /api/cron/portal-contract-expiring    → 0 7 * * *
    - /api/cron/portal-payment-overdue      → 0 8 * * *
□ VAPID keys geradas e configuradas (se Push activo)
□ Variáveis WhatsApp configuradas (se WhatsApp activo)
□ SENTRY_DSN configurado em produção
□ next.config.js CSP não inclui domínios não autorizados
□ Smoke test: POST /api/portal/auth/login → 200 ou 401 (não 500)
□ Smoke test: cron auth → POST com header errado retorna 401
```

---

## Variáveis que NUNCA devem aparecer em logs

As seguintes variáveis são secretas e nunca devem ser logadas, mesmo em contexto de debug:

- `JWT_SECRET`
- `PORTAL_JWT_SECRET`
- `CLOUDINARY_API_SECRET`
- `RESEND_API_KEY`
- `META_WHATSAPP_TOKEN`
- `VAPID_PRIVATE_KEY`
- `CRON_SECRET`
- `DATABASE_URL` (contém credenciais)

Verificar periodicamente que nenhum `console.log(process.env)` ou equivalente existe no código.

---

## N+1 Detectados — Dívida Técnica VOL03-10C

Os seguintes padrões N+1 foram identificados no portal-alerts-service durante VOL03-10C:

| Função | Padrão | Impacto |
|---|---|---|
| `checkRentDue` | `findMany(portalUser)` dentro de loop `for (const rent of due)` | Baixo (< 10 empresas típico) |
| `checkContractExpiring` | `findMany(portalUser)` dentro de loop por `CONTRACT_ALERT_DAYS` × por contrato | Médio |
| `checkPaymentOverdue` | `findMany(portalUser)` dentro de loop por `OVERDUE_ALERT_DAYS` × por fatura | Médio |

**Mitigação actual:** estes cron jobs correm em horários de baixa carga (08h-09h WAT) e o volume de empresas é reduzido (< 50 na beta).

**Solução futura (VOL03-11 ou posterior):**  
Refactoring para carregar todos os utilizadores ADMIN/OWNER das empresas afectadas numa única query `findMany` agrupada por `companyId`, eliminando o N+1.

---

*VD Platform — Volume 03 — env-vars.md — 29 Julho 2026*
