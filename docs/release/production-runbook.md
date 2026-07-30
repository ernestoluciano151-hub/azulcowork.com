# Production Runbook — VD Platform v1.0

> **Versão:** 1.0.0-rc  
> **Data:** 30 Julho 2026  
> **Sprint:** RC-1  
> **Audiência:** Administradores técnicos e Product Owner

---

## Visão Geral da Infraestrutura

```
Frontend + API:  Vercel (Edge Network)
Base de dados:   PostgreSQL (Neon — serverless)
Ficheiros/PDFs:  Cloudinary
Email:           SMTP via Brevo (nodemailer)
Monitoring:      Sentry
Push Notif.:     Web Push VAPID
Cron Jobs:       Vercel Cron (11 jobs)
Auth:            JWT HS256 (jose) + TOTP (otpauth)
```

---

## Operações de Rotina

### Verificação Diária (5 minutos)

```
□ Sentry dashboard: sem alertas críticos
□ Vercel Logs: sem erros 5xx recorrentes
□ Verificar cron erp-daily executou (07:00 WAT): Vercel → Logs → /api/cron/erp-daily
□ Verificar cron portal-notifications-retry: sem falhas acumuladas
□ Neon dashboard: conexões activas < 80% do máximo
```

### Verificação Semanal (15 minutos)

```
□ Audit Log (/admin/auditoria): revisar eventos LOGIN_FAILED e acções ADMIN
□ Sessões activas (/admin/settings): revogar sessões suspeitas ou antigas
□ Alertas ERP (/admin/erp/contratos): contratos a expirar no próximo mês
□ Despesas pendentes (/admin/erp/despesas): aprovação de despesas em PENDING
□ Tickets de suporte portal: verificar tickets OPEN há > 3 dias
□ Backup BD: confirmar backup automático Neon (ou executar manualmente)
```

### Verificação Mensal (1 hora)

```
□ Confirmar cron erp-invoice-generate executou no dia 1 (faturas mensais geradas)
□ Confirmar cron erp-monthly-snapshot executou nos dias 28-31 (snapshot BI)
□ Mapa IVA (/admin/erp/relatorios → IVA): validar com contabilidade
□ Reconciliação bancária (/admin/erp/relatorios → Reconciliação)
□ Export XLSX para contabilidade
□ Rever métricas Sentry: top 10 errors do mês
□ Rever score da plataforma: docs/audit/metrics-dashboard.md
```

---

## Operações de Gestão de Utilizadores

### Criar novo utilizador admin

```bash
# Via API (requer sessão ADMIN):
curl -X POST https://app.azulcowork.com/api/admin/users \
  -H "Cookie: vd_admin_session=TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"email":"novo@azulcowork.com","name":"Nome","role":"COMERCIAL","password":"SenhaSegura123!"}'
```

### Revogar sessão de utilizador suspeito

```
1. /admin/settings → Sessões Activas
2. Identificar sessão pelo IP ou User-Agent suspeito
3. Clicar "Revogar"
4. O utilizador é desligado no próximo request
5. Registar evento em /admin/auditoria
```

### Criar utilizador de portal para empresa

```
1. /admin/portal/utilizadores → "+ Novo Utilizador"
2. Preencher: Nome, Email, ID da Empresa, Papel
3. Email de boas-vindas enviado automaticamente
4. Enviar magic link adicional se necessário: botão "🔗 Link"
```

---

## Operações de Base de Dados

### Backup manual

```bash
# Exportar dump completo (executar no terminal local com acesso à BD de produção)
DATABASE_URL="postgresql://USER:PASS@HOST:5432/DB?sslmode=require"
pg_dump -Fc -f "backup_$(date +%Y%m%d_%H%M%S).dump" "$DATABASE_URL"

# Verificar integridade do backup
pg_restore --list backup_*.dump | head -20
```

### Restore de backup

```bash
# ATENÇÃO: esta operação sobrescreve a BD actual
pg_restore -d "$DATABASE_URL" --clean --no-acl --no-owner backup_*.dump
```

### Aplicar migrations pendentes (sem re-deploy)

```bash
# Raramente necessário — o build:prod já aplica automaticamente
DATABASE_URL="postgresql://..." npx prisma migrate deploy
```

### Verificar estado das migrations

```bash
DATABASE_URL="postgresql://..." npx prisma migrate status
```

### Re-executar seed (safe — upsert idempotente)

```bash
DATABASE_URL="postgresql://..." node prisma/seed.js
```

---

## Operações de Cron

### Executar cron manualmente

```bash
# Substitituir {URL} e {CRON_SECRET}
curl -X POST https://app.azulcowork.com/api/cron/erp-daily \
  -H "Authorization: Bearer {CRON_SECRET}"
```

### Verificar logs de cron

```
Vercel Dashboard → Deployments → Functions → /api/cron/{nome} → Logs
```

### Suspender um cron temporariamente

```
Vercel Dashboard → Settings → Crons → Desactivar toggle do cron específico
```

---

## Operações de Incidente

### Nível 1 — Erro isolado (utilizador reporta erro pontual)

```
1. Verificar Sentry: procurar erro no timeline
2. Identificar stack trace e contexto (utilizador, URL, parâmetros)
3. Se reproduzível: criar issue com reprodução mínima
4. Corrigir no branch → PR → deploy
5. Fechar issue com referência ao commit
```

### Nível 2 — Degradação parcial (módulo inoperacional)

```
1. Identificar módulo afectado
2. Verificar se é problema de BD, API externa, ou código
3. Implementar workaround manual se possível (ex: processar fatura manualmente)
4. Notificar utilizadores afectados via email
5. Corrigir e re-deploy
```

### Nível 3 — Falha total (sistema inoperacional)

```
1. Activar rollback imediatamente: ver rollback-checklist.md
2. Notificar utilizadores (mensagem WhatsApp / email)
3. Investigar causa raiz
4. Documentar incidente
```

---

## Gestão de Certificados e Segredos

### Rotação de JWT_SECRET (cuidado: invalida todas as sessões activas)

```
1. Gerar novo segredo: openssl rand -base64 64
2. Actualizar em Vercel → Settings → Environment Variables → JWT_SECRET
3. Igual para PORTAL_JWT_SECRET
4. Re-deploy (não é necessário — a variável é lida em runtime)
5. Todos os utilizadores serão desligados automaticamente
6. Notificar utilizadores admin se a rotação for planeada
```

### Rotação de CRON_SECRET

```
1. Gerar novo: openssl rand -hex 32
2. Actualizar em Vercel → Settings → CRON_SECRET
3. Os crons usarão o novo segredo no próximo ciclo
```

### Rotação de chaves VAPID (invalida todas as subscriptions push)

```
1. npx web-push generate-vapid-keys
2. Actualizar VAPID_PUBLIC_KEY e VAPID_PRIVATE_KEY no Vercel
3. Todos os utilizadores do portal terão de re-subscrever notificações push
4. Cron portal-notifications-retry tentará reenvio — subscriptions inválidas serão removidas
```

---

## Painel de Saúde — URLs de Verificação Rápida

| URL | Esperado | Módulo |
|---|---|---|
| `/admin/login` | HTTP 200, formulário | Auth |
| `/admin/dashboard` | HTTP 200 (com sessão) | Dashboard |
| `/api/health` | HTTP 200 `{"ok":true}` | API |
| `/portal/login` | HTTP 200, formulário | Portal |
| `/api/cron/erp-daily` | HTTP 200 (com Bearer) | Crons |

---

## Escalada

| Situação | Acção |
|---|---|
| BD inacessível | Contactar Neon support + activar rollback |
| Email não entregue | Verificar painel Brevo → SMTP logs |
| Cloudinary falha | Documentos não geram PDF — alertar PO |
| Sentry offline | Monitorar Vercel Logs manualmente |
| Vercel offline | Verificar status.vercel.com |

---

*VD Platform — Production Runbook v1.0 — 30 Jul 2026*
