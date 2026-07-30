# Notificações — Volume 03 — Portal do Cliente

> **Volume:** 03 — Portal do Cliente  
> **Estado:** 📋 Especificação — aguarda aprovação PO  
> **Princípio:** Toda notificação tem estado (pendente → enviada → lida / falhou)

---

## 1. Tipos de Notificação (5 Alertas Automáticos)

| Tipo | Trigger | Canais padrão | Prioridade |
|---|---|---|---|
| `RENT_DUE` | Renda vence em 7 dias | Email + WhatsApp + In-app | NORMAL |
| `CONTRACT_EXPIRING` | Contrato expira em 30/15/7 dias | Email + WhatsApp + In-app | HIGH |
| `PAYMENT_OVERDUE` | Pagamento em atraso (+1d, +7d, +30d) | Email + WhatsApp + In-app + Push | HIGH |
| `BOOKING_CONFIRMED` | Staff confirma reserva de sala | Email + In-app + Push | NORMAL |
| `DOCUMENT_AVAILABLE` | Novo documento disponível | Email + In-app | NORMAL |

### Notificações Adicionais (transaccionais, não apenas alertas)

| Tipo | Trigger | Canal |
|---|---|---|
| `INVOICE_ISSUED` | Fatura emitida | Email + In-app |
| `PAYMENT_CONFIRMED` | Pagamento confirmado | Email + In-app + Push |
| `BOOKING_RECEIVED` | Reserva recebida (aguarda confirmação) | Email + In-app |
| `TICKET_REPLY` | Staff respondeu ao ticket | Email + In-app + Push |
| `WELCOME` | Activação do portal | Email |
| `USER_INVITED` | Novo utilizador convidado | Email |

---

## 2. Estados de Notificação

```
PENDING
  │
  ├─── Enviado com sucesso ──────────► SENT
  │                                      │
  │                                      ├─── Provider confirma entrega ──► DELIVERED
  │                                      │                                      │
  │                                      │                                      └─── Utilizador lê ──► READ
  │                                      │
  │                                      └─── Provider não confirma (SSE/Push sem webhook) → permanece SENT
  │
  └─── Falha no envio ──────────────► re-tentativa (máx 3)
                                          │
                                          └─── 3 falhas ──────────────────► FAILED
                                                                              │
                                                                              └─── fallback canal alternativo
```

### Transições válidas

```
PENDING   → SENT      (envio bem-sucedido)
PENDING   → FAILED    (após 3 tentativas)
SENT      → DELIVERED (webhook do provider — Resend suporta, Meta suporta)
SENT      → READ      (cliente marca como lido no portal)
DELIVERED → READ      (cliente marca como lido)
FAILED    → PENDING   (re-tentativa manual pelo admin — opcional)
```

---

## 3. Motor de Re-tentativas (Cron)

```typescript
// GET /api/cron/portal-notifications-retry
// Schedule: "*/5 * * * *" — a cada 5 minutos

// 1. Buscar PortalNotifications com:
//    status = PENDING
//    attempts < maxAttempts
//    nextRetryAt <= now()

// 2. Para cada uma: tentar enviar
// 3. Sucesso → status: SENT, sentAt: now()
// 4. Falha → attempts++, nextRetryAt: now() + backoff(attempts)

function backoff(attempts: number): number {
  // attempts=1 → 5 min
  // attempts=2 → 30 min
  // attempts=3 → (não vai haver — já falhou)
  return [5, 30][attempts - 1] ?? 60; // minutos
}
```

---

## 4. Preferências de Notificação por Utilizador

Cada `PortalUser` tem preferências independentes:

```typescript
interface NotificationPreferences {
  notifyEmail:    boolean; // default: true
  notifyWhatsapp: boolean; // default: false (requer phone + opt-in explícito)
  notifyPush:     boolean; // default: true (após browser permission)
  notifyInApp:    boolean; // default: true (sempre activo no portal)
}
```

**Nota:** WhatsApp requer opt-in explícito por regulação da Meta.
O cliente deve activar WhatsApp nas preferências do portal.

**Override por tipo:** Certas notificações ignoram preferências individuais:
- `CONTRACT_EXPIRING` → sempre enviado a PORTAL_OWNER independente das preferências
- `PAYMENT_OVERDUE` (+30 dias) → enviado a todos os PORTAL_OWNER e PORTAL_ADMIN

---

## 5. Centro de Notificações (/portal/notificacoes)

### Vista em lista

```
[🔵 não lida] [ícone tipo] [título] [data relativa]  [acção]
[⚪ lida     ] [ícone tipo] [título] [data relativa]  [acção]

Botão: "Marcar todas como lidas" → PATCH /api/portal/notifications/read-all
Filtros: Todas | Não lidas | Por tipo
```

### Badge no nav

- Contagem de notificações com status != READ
- Actualizado em tempo real via SSE
- Reset ao visitar /portal/notificacoes

---

## 6. Regras de Negócio

```
BR-PORT-NOTIF-001 — Toda PortalNotification tem estado final (nunca fica em PENDING indefinidamente)
BR-PORT-NOTIF-002 — Falha em canal não-email → fallback automático para email
BR-PORT-NOTIF-003 — WhatsApp requer opt-in explícito (PortalUser.notifyWhatsapp = true)
BR-PORT-NOTIF-004 — Push Web requer permissão do browser (pushEndpoint registado)
BR-PORT-NOTIF-005 — Toda notificação enviada cria OmnichannelMessage (audit trail)
BR-PORT-NOTIF-006 — Toda notificação enviada cria TimelineEntry na empresa
BR-PORT-NOTIF-007 — Leitura de notificação in-app actualiza: readAt, status=READ
BR-PORT-NOTIF-008 — Máximo 3 re-tentativas por notificação por canal
BR-PORT-NOTIF-009 — Alertas PAYMENT_OVERDUE +30d → enviado sempre, ignorando preferências OWNER/ADMIN
BR-PORT-NOTIF-010 — Histórico de notificações: retido por 12 meses
```

---

## 7. Cron Jobs do Sistema de Notificações

| Endpoint | Schedule | Função |
|---|---|---|
| `/api/cron/portal-rent-due` | `0 8 * * *` — diário 08h | Verifica rendas a vencer em 7 dias → cria notificações RENT_DUE |
| `/api/cron/portal-contract-expiring` | `0 8 * * *` — diário 08h | Verifica contratos a expirar em 30/15/7 dias |
| `/api/cron/portal-payment-overdue` | `0 9 * * *` — diário 09h | Verifica pagamentos em atraso → escala (D+1, D+7, D+30) |
| `/api/cron/portal-notifications-retry` | `*/5 * * * *` — cada 5 min | Re-tentativas de notificações PENDING com falha |

---

*VD Platform — Notifications Spec — Volume 03 — 29 Julho 2026*
