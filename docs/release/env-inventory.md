# Environment Variables Inventory — VD Platform v1.0.0-rc1

> **Data:** 30 Julho 2026  
> **Usar antes de cada deploy para verificar que todas as variáveis estão configuradas.**  
> **NUNCA guardar valores reais neste ficheiro — apenas estado (✅/❌)**

---

## Instrução de Uso

1. Abrir painel Vercel → Settings → Environment Variables
2. Para cada variável, marcar ✅ se configurada ou ❌ se ausente
3. Nenhum deploy pode avançar com qualquer variável CRÍTICA marcada ❌

---

## Variáveis Críticas (P0 — bloqueiam funcionalidade core)

| Variável | Configurada | Observações |
|---|---|---|
| `DATABASE_URL` | ☐ | PostgreSQL com `sslmode=require` obrigatório |
| `JWT_SECRET` | ☐ | Mínimo 32 chars — `openssl rand -base64 64` |
| `PORTAL_JWT_SECRET` | ☐ | **OBRIGATÓRIO** — nunca usar fallback em produção |
| `NEXT_PUBLIC_APP_URL` | ☐ | URL pública de produção (ex: https://app.azulcowork.com) |
| `CRON_SECRET` | ☐ | `openssl rand -hex 32` — autentica os 11 crons |
| `SMTP_HOST` | ☐ | ex: smtp.brevo.com |
| `SMTP_PORT` | ☐ | ex: 587 |
| `SMTP_USER` | ☐ | Email SMTP |
| `SMTP_PASS` | ☐ | Password SMTP |
| `SMTP_FROM` | ☐ | ex: "Azul Coworking" <noreply@azulcowork.com> |
| `CLOUDINARY_CLOUD_NAME` | ☐ | Cloud name do painel Cloudinary |
| `CLOUDINARY_API_KEY` | ☐ | API Key do painel Cloudinary |
| `CLOUDINARY_API_SECRET` | ☐ | API Secret do painel Cloudinary |
| `VAPID_PUBLIC_KEY` | ☐ | `npx web-push generate-vapid-keys` |
| `VAPID_PRIVATE_KEY` | ☐ | `npx web-push generate-vapid-keys` |
| `VAPID_EMAIL` | ☐ | ex: mailto:geral@azulcowork.com |
| `SENTRY_DSN` | ☐ | DSN do projecto Sentry |
| `NEXT_PUBLIC_SENTRY_DSN` | ☐ | Mesmo valor de SENTRY_DSN |
| `SENTRY_AUTH_TOKEN` | ☐ | Token para upload de source maps |

**Total críticas: 19 — todas devem estar ✅ antes de deploy**

---

## Variáveis Importantes (P1 — funcionalidade degradada se ausentes)

| Variável | Configurada | Observações |
|---|---|---|
| `ADMIN_EMAIL` | ☐ | Email do admin inicial (seed) — ex: admin@azulcowork.com |
| `ADMIN_PASSWORD` | ☐ | Senha admin inicial — mínimo 12 chars, não usar padrão |
| `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME` | ☐ | Para uploads directos no frontend |
| `NEXT_PUBLIC_SITE_NAME` | ☐ | Nome exibido em emails — ex: Azul Coworking |
| `NEXT_PUBLIC_SITE_URL` | ☐ | URL do site marketing — ex: https://www.azulcowork.com |
| `ROOM_DAILY_HOURS` | ☐ | Horas de operação diária — ex: 10 (08:00–18:00) |

---

## Variáveis Opcionais (P2 — funcionalidade adicional)

| Variável | Configurada | Observações |
|---|---|---|
| `RESEND_API_KEY` | ☐ | Fallback email — não usado activamente pelo sistema |
| `RESEND_FROM_EMAIL` | ☐ | Fallback email from |
| `META_WHATSAPP_TOKEN` | ☐ | WhatsApp Business (não implementado v1.0) |
| `META_WHATSAPP_PHONE_ID` | ☐ | WhatsApp Business (não implementado v1.0) |
| `WHATSAPP_API_URL` | ☐ | WhatsApp API URL |
| `WHATSAPP_API_TOKEN` | ☐ | WhatsApp API Token (duplicado do META_WHATSAPP_TOKEN) |

---

## Checklist de Segurança das Variáveis

```
□ JWT_SECRET ≠ "troque-este-segredo-..." (valor padrão)
□ JWT_SECRET ≥ 64 caracteres
□ PORTAL_JWT_SECRET ≠ JWT_SECRET (secretos distintos)
□ PORTAL_JWT_SECRET ≠ "" (não vazio)
□ ADMIN_PASSWORD ≠ "MudeEstaSenha123!" (valor padrão do .env.example)
□ CRON_SECRET ≠ "gerar-um-segredo-aleatorio-aqui" (valor padrão)
□ DATABASE_URL contém ?sslmode=require
□ DATABASE_URL é PostgreSQL, não SQLite (file:./dev.db)
□ SENTRY_DSN é real (não contém xxxx)
□ CLOUDINARY_API_SECRET é real (não contém xxxx)
□ VAPID chaves geradas com npx web-push generate-vapid-keys
```

---

## Procedimento de Geração de Secretos

```bash
# JWT_SECRET (64 bytes base64)
openssl rand -base64 64

# PORTAL_JWT_SECRET (deve ser diferente do JWT_SECRET)
openssl rand -base64 64

# CRON_SECRET (32 bytes hex)
openssl rand -hex 32

# VAPID keys (par público/privado)
npx web-push generate-vapid-keys

# Verificar se dois secretos são diferentes
echo "JWT:    $(openssl rand -base64 64)"
echo "PORTAL: $(openssl rand -base64 64)"
```

---

## Auditoria Pós-Deploy

Depois de configurar e fazer deploy, verificar no terminal:

```bash
# Verificar que a aplicação rejeita JWT_SECRET padrão
# (deve ver erro se JWT_SECRET for o valor padrão)

# Verificar headers de segurança
curl -I https://app.azulcowork.com | grep -E "Strict-Transport|X-Frame|X-Content"

# Verificar que /admin redireciona sem sessão
curl -L -I https://app.azulcowork.com/admin/dashboard
# Esperado: redirect para /admin/login

# Verificar que /portal redireciona sem sessão
curl -L -I https://app.azulcowork.com/portal/dashboard
# Esperado: redirect para /portal/login
```

---

## Rotação de Secretos (Recorrência Recomendada)

| Variável | Rotação recomendada | Impacto da rotação |
|---|---|---|
| `JWT_SECRET` | 90 dias | Invalida todas as sessões admin — agendar manutenção |
| `PORTAL_JWT_SECRET` | 90 dias | Invalida todas as sessões de portal — utilizadores re-login |
| `CRON_SECRET` | 6 meses | Nenhum — crons usam novo secret no ciclo seguinte |
| `CLOUDINARY_API_SECRET` | Anual | Regenerar no painel Cloudinary |
| `VAPID keys` | Anual | Invalida todas as subscriptions push — utilizadores re-subscrevem |
| `SENTRY_AUTH_TOKEN` | 6 meses | Regenerar em Sentry → Settings → Auth Tokens |

---

*VD Platform — Env Inventory v1.0.0-rc1 — 30 Jul 2026*  
*Actualizar após cada rotação de secretos*
