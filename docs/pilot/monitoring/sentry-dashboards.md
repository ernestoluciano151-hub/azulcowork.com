# Sentry Dashboards — VD Platform v1.0.0-rc1

> **Data:** 30 Julho 2026  
> **Sprint:** RC-1 Piloto  
> **URL Sentry:** https://sentry.io/organizations/azul-coworking/projects/vd-platform/  

---

## Configuração Inicial

### Acesso ao Projecto Sentry

```
Organização: azul-coworking
Projecto:    vd-platform
DSN:         [SENTRY_DSN configurada nas env vars]
```

### Alertas a Configurar (Sentry → Alerts → Create Alert)

Configurar antes de iniciar o piloto:

```
Alerta 1: Erro crítico em 5 minutos
  Condition: Number of events > 10 in 5 minutes
  Level: error
  Notificar: versaodigitallda@gmail.com

Alerta 2: Taxa de erro elevada
  Condition: Percent of sessions with errors > 5%
  Notificar: versaodigitallda@gmail.com

Alerta 3: Performance — P95 > 3s
  Condition: p95 transaction duration > 3000ms
  Transactions: /api/*
  Notificar: versaodigitallda@gmail.com
```

---

## Dashboard 1 — Auth & Segurança

**Nome:** `VD Platform — Auth`

**Widgets a adicionar (Sentry → Dashboards → Create Dashboard):**

| Widget | Query | Tipo |
|---|---|---|
| Erros de autenticação | `transaction:/api/admin/auth* error` | Linha temporal |
| Falhas de login | `message:"login failed" OR message:"LOGIN_FAILED"` | Contador |
| JWT inválidos | `message:"jwt" OR message:"unauthorized"` | Contador |
| TOTP failures | `message:"totp" OR message:"TOTP_VERIFY_FAILED"` | Contador |
| Taxa de erro auth | `transaction:/api/admin/auth*` | Taxa de erro % |
| Sessões revogadas | `message:"SESSION_REVOKED"` | Contador |

**Queries Sentry úteis:**

```
# Erros de login nas últimas 24h
event.type:error transaction:/api/admin/auth/login

# Tentativas de acesso não autorizado
http.status_code:401 OR http.status_code:403

# JWT expirado ou inválido
message:"JWTExpired" OR message:"JWSInvalid"
```

---

## Dashboard 2 — Pagamentos & ERP

**Nome:** `VD Platform — Payments & ERP`

| Widget | Query | Tipo |
|---|---|---|
| Erros em confirmação pagamento | `transaction:/api/erp/payments*` | Taxa de erro |
| Erros em geração de fatura | `transaction:/api/erp/invoices*` | Taxa de erro |
| Falhas em cron faturação | `transaction:/api/cron/erp-invoice-generate` | Erro/sucesso |
| Erros em relatórios | `transaction:/api/erp/reports*` | Contador |
| Latência média ERP | `transaction:/api/erp/*` | P50/P95 ms |
| Erros de IVA/cálculo | `message:"finance" OR message:"IVA" OR message:"invoice"` | Contador |

**Alertas específicos:**

```
CRÍTICO: Qualquer erro em /api/erp/payments/* → alerta imediato
ALTO: Taxa de erro > 1% em /api/erp/invoices/* → alerta em 5 min
```

---

## Dashboard 3 — Reservas

**Nome:** `VD Platform — Reservations`

| Widget | Query | Tipo |
|---|---|---|
| Erros em criação de reserva | `transaction:/api/reservations POST` | Taxa de erro |
| Conflitos detectados | `message:"conflito" OR message:"conflict"` | Contador |
| Falhas no cron de encerramento | `transaction:/api/cron/reservations-close` | Erro/sucesso |
| Latência do conflict check | `transaction:/api/reservations` | P95 ms |
| Erros de preço/cálculo | `message:"pricing" OR message:"calcPrice"` | Contador |

---

## Dashboard 4 — ERP Contratos & Alertas

**Nome:** `VD Platform — Contracts & Alerts`

| Widget | Query | Tipo |
|---|---|---|
| Erros em activação de contrato | `transaction:/api/erp/contracts/*/activate` | Contador |
| Cron erp-daily: sucesso/falha | `transaction:/api/cron/erp-daily` | Erro/sucesso |
| Alertas disparados | `message:"alert" OR message:"alerta"` | Contador |
| Contratos expirados não processados | `message:"EXPIRED" AND message:"contract"` | Contador |
| Latência cron diário | `transaction:/api/cron/erp-daily` | Duração ms |

---

## Dashboard 5 — Portal do Cliente

**Nome:** `VD Platform — Portal`

| Widget | Query | Tipo |
|---|---|---|
| Erros de autenticação portal | `transaction:/api/portal/auth*` | Taxa de erro |
| Magic links enviados | `message:"magic link" OR message:"magic-link"` | Contador |
| Falhas de magic link | `transaction:/api/portal/auth/magic-link error` | Contador |
| Erros de notificação push | `transaction:/api/portal/notifications*` | Taxa de erro |
| Cron notifications-retry | `transaction:/api/cron/portal-notifications-retry` | Erro/sucesso |
| Latência portal P95 | `transaction:/portal/*` | P95 ms |
| Erros de suporte/tickets | `transaction:/api/portal/support*` | Taxa de erro |
| Isolamento multi-tenant | `message:"tenant" OR message:"unauthorized company"` | Contador |

**Alerta crítico:**

```
CRÍTICO: Qualquer erro de isolamento multi-tenant (empresa aceder a dados de outra)
Query: message:"unauthorized company" OR message:"tenant isolation"
Threshold: > 0 em qualquer período
```

---

## Dashboard 6 — Geração de Documentos

**Nome:** `VD Platform — Documents`

| Widget | Query | Tipo |
|---|---|---|
| Erros em geração de PDF | `transaction:/api/admin/documents*` | Taxa de erro |
| Falhas de upload Cloudinary | `message:"cloudinary" AND error` | Contador |
| Erros de template | `message:"template" AND (error OR failed)` | Contador |
| Latência de geração de PDF | `transaction:/api/admin/documents/*/generate` | P95 ms |
| Downloads assinados falhados | `message:"signed" AND (error OR failed)` | Contador |

---

## Queries de Investigação Rápida

Durante o piloto, usar estas queries no Sentry Search quando reportado um incidente:

```
# Tudo nos últimos 30 min
timestamp:>-30m

# Erros de um utilizador específico (substituir email)
user.email:cliente@empresa.com

# Erros numa rota específica
transaction:/api/erp/contracts

# Erros críticos sem resolução
is:unresolved level:error

# Erros nas últimas 24h ordenados por frequência
timestamp:>-24h sort:events desc

# Performance lenta
transaction.duration:>2000
```

---

## Métricas de Baseline (Registar D+1)

Registar estas métricas no primeiro dia completo de produção como baseline:

```
□ P50 latência /api/*         = _____ ms
□ P95 latência /api/*         = _____ ms
□ P99 latência /api/*         = _____ ms
□ Taxa de erro global          = _____  %
□ Apdex score                  = _____
□ Taxa de sucesso cron diário  = _____ %
□ Sessões de portal (D+1)      = _____
```

---

## Processo de Triagem de Erros

```
Sentry → Issues → Unresolved

Para cada issue novo:
1. Ler stack trace — qual ficheiro, qual linha
2. Classificar: P0 (prod down) / P1 (funcional crítico) / P2 (cosmético)
3. P0/P1: criar fix imediato + PR
4. P2: adicionar a known-issues.md → resolver em v1.1
5. Marcar issue como "In Progress" ou "Ignored" conforme decisão
```

---

*VD Platform — Sentry Dashboards v1.0.0-rc1 — 30 Jul 2026*
