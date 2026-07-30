# Referência de APIs — Volume 03 — Portal do Cliente

> **Volume:** 03 — Portal do Cliente  
> **Estado:** 📋 Especificação — aguarda aprovação PO  
> **Base:** `/api/portal/*`  
> **Auth:** Cookie `portal-session` (JWT separado do admin)  
> **Isolamento:** Todas as routes verificam `companyId = portalUser.companyId`

---

## Legenda

| Símbolo | Significado |
|---|---|
| 🔓 | Público (sem autenticação) |
| 🔐 | Requer portal-session válida |
| 👑 | PORTAL_OWNER only |
| 🛠️ | PORTAL_OWNER ou PORTAL_ADMIN |
| 👥 | PORTAL_OWNER, PORTAL_ADMIN ou PORTAL_MEMBER |
| 👁️ | Qualquer role (incluindo PORTAL_VIEWER) |

---

## 1. Autenticação do Portal

| Método | Rota | Auth | Descrição |
|---|---|---|---|
| POST | `/api/portal/auth/magic-link` | 🔓 | Solicitar magic link. Body: `{ email }`. Rate limit: 3/hora. |
| GET  | `/api/portal/auth/magic` | 🔓 | Validar token magic link. Query: `?token=`. Cria sessão. |
| POST | `/api/portal/auth/login` | 🔓 | Login por credenciais (alternativa). Body: `{ email, password }`. |
| POST | `/api/portal/auth/logout` | 🔐 | Revogar sessão actual. Remove cookie. |
| GET  | `/api/portal/auth/me` | 🔐 | Dados do PortalUser autenticado + empresa. |
| PATCH | `/api/portal/auth/preferences` | 🔐 | Actualizar preferências de notificação. |

---

## 2. Dashboard

| Método | Rota | Auth | Descrição |
|---|---|---|---|
| GET | `/api/portal/dashboard` | 👁️ | Resumo: contrato activo, saldo pendente, próxima renda, notificações recentes, actividade recente. |

---

## 3. Perfil da Empresa

| Método | Rota | Auth | Descrição |
|---|---|---|---|
| GET  | `/api/portal/company` | 👁️ | Dados da empresa (apenas da empresa do utilizador autenticado). |
| PATCH | `/api/portal/company` | 🛠️ | Actualizar campos editáveis (telefone, email facturação, contacto). |

---

## 4. Gestão de Utilizadores do Portal

| Método | Rota | Auth | Descrição |
|---|---|---|---|
| GET  | `/api/portal/users` | 🛠️ | Listar utilizadores do portal da empresa. |
| POST | `/api/portal/users` | 🛠️ | Criar utilizador. Envia email de convite. Body: `{ name, email, role, phone? }`. |
| GET  | `/api/portal/users/[id]` | 🛠️ | Detalhes de utilizador. |
| PATCH | `/api/portal/users/[id]` | 🛠️ | Actualizar utilizador (nome, role, telefone). |
| DELETE | `/api/portal/users/[id]` | 🛠️ | Desactivar utilizador. Revoga sessões. |
| POST | `/api/portal/users/transfer-ownership` | 👑 | Transferir role PORTAL_OWNER para outro utilizador. |

---

## 5. Contratos

| Método | Rota | Auth | Descrição |
|---|---|---|---|
| GET | `/api/portal/contracts` | 👁️ | Listar contratos da empresa (activos e histórico). |
| GET | `/api/portal/contracts/[id]` | 👁️ | Detalhe do contrato: info geral + RentSchedules + documentos associados. |

---

## 6. Faturas

| Método | Rota | Auth | Descrição |
|---|---|---|---|
| GET  | `/api/portal/invoices` | 👁️ | Listar faturas da empresa. Query: `?status=&period=&page=&limit=`. |
| GET  | `/api/portal/invoices/[id]` | 👁️ | Detalhe de fatura (items, totais, estado, dados bancários). |
| POST | `/api/portal/invoices/[id]/download` | 👁️ | Gerar URL assinada (TTL 15 min). Regista PortalDocumentAccess + TimelineEntry. |

---

## 7. Pagamentos e Recibos

| Método | Rota | Auth | Descrição |
|---|---|---|---|
| GET  | `/api/portal/payments` | 👁️ | Listar pagamentos da empresa. Query: `?period=&page=&limit=`. |
| GET  | `/api/portal/payments/[id]` | 👁️ | Detalhe de pagamento (valor, método, data, referência). |
| POST | `/api/portal/payments/[id]/receipt` | 👁️ | Gerar URL assinada do recibo PDF (TTL 15 min). |

---

## 8. Reservas de Sala

| Método | Rota | Auth | Descrição |
|---|---|---|---|
| GET  | `/api/portal/bookings` | 👥 | Listar reservas da empresa. Query: `?status=&from=&to=`. |
| POST | `/api/portal/bookings` | 👥 | Criar reserva. Body: `{ roomId, date, startTime, endTime, participants?, notes? }`. |
| GET  | `/api/portal/bookings/[id]` | 👥 | Detalhe de reserva. |
| DELETE | `/api/portal/bookings/[id]` | 👥 | Cancelar reserva (mín 24h de antecedência). |
| GET  | `/api/portal/rooms/availability` | 👥 | Disponibilidade de salas. Query: `?date=&roomId?=`. |

---

## 9. Documentos

| Método | Rota | Auth | Descrição |
|---|---|---|---|
| GET  | `/api/portal/documents` | 👁️ | Listar documentos da empresa. Query: `?category=`. |
| POST | `/api/portal/documents` | 🛠️ | Upload de documento pelo cliente. Body: multipart/form-data. |
| GET  | `/api/portal/documents/[id]` | 👁️ | Detalhe de documento (versões, metadata). Regista VIEW. |
| POST | `/api/portal/documents/[id]/download` | 👁️ | Gerar URL assinada (TTL 15 min). Regista DOWNLOAD + TimelineEntry. |
| GET  | `/api/portal/documents/[id]/versions` | 👁️ | Listar versões do documento. |
| POST | `/api/portal/documents/[id]/download-version` | 👁️ | Download de versão específica. Body: `{ versionId }`. |

---

## 10. Notificações

| Método | Rota | Auth | Descrição |
|---|---|---|---|
| GET   | `/api/portal/notifications` | 🔐 | Listar notificações do utilizador. Query: `?status=&type=&page=`. |
| PATCH | `/api/portal/notifications/[id]/read` | 🔐 | Marcar como lida (status → READ, readAt = now()). |
| POST  | `/api/portal/notifications/read-all` | 🔐 | Marcar todas como lidas. |
| GET   | `/api/portal/notifications/stream` | 🔐 | SSE stream para notificações em tempo real. `Content-Type: text/event-stream`. |
| POST  | `/api/portal/notifications/subscribe-push` | 🔐 | Registar subscrição Web Push. Body: `{ endpoint, p256dh, auth }`. |
| DELETE | `/api/portal/notifications/subscribe-push` | 🔐 | Cancelar subscrição Web Push. |

---

## 11. Suporte

| Método | Rota | Auth | Descrição |
|---|---|---|---|
| GET  | `/api/portal/support/tickets` | 👥 | Listar tickets da empresa. Query: `?status=`. |
| POST | `/api/portal/support/tickets` | 👥 | Criar ticket. Body: `{ subject, category, priority, description, attachments? }`. |
| GET  | `/api/portal/support/tickets/[id]` | 👥 | Detalhe do ticket + mensagens (excl. notas internas). |
| POST | `/api/portal/support/tickets/[id]/messages` | 👥 | Responder ao ticket. Body: `{ body, attachments? }`. |
| POST | `/api/portal/support/tickets/[id]/close` | 👥 | Fechar ticket (cliente pode fechar o seu próprio). |
| POST | `/api/portal/support/tickets/[id]/reopen` | 👥 | Reabrir ticket RESOLVED (dentro de 30 dias). |

---

## 12. Cron Jobs do Portal

| Método | Rota | Auth | Schedule | Descrição |
|---|---|---|---|---|
| GET | `/api/cron/portal-rent-due` | CRON_SECRET | `0 8 * * *` | Alertas de renda a vencer em 7 dias. |
| GET | `/api/cron/portal-contract-expiring` | CRON_SECRET | `0 8 * * *` | Alertas de contrato a expirar (D-30, D-15, D-7). |
| GET | `/api/cron/portal-payment-overdue` | CRON_SECRET | `0 9 * * *` | Alertas de pagamento em atraso (D+1, D+7, D+30). |
| GET | `/api/cron/portal-notifications-retry` | CRON_SECRET | `*/5 * * * *` | Re-tentativas de notificações PENDING. |
| GET | `/api/cron/portal-sla-check` | CRON_SECRET | `0 */2 * * *` | Verificar tickets próximos de violar SLA. |
| GET | `/api/cron/portal-auto-close-tickets` | CRON_SECRET | `0 10 * * *` | Fechar tickets WAITING há +7 dias. |

---

## 13. Padrões de Resposta

### Sucesso

```json
// GET lista
{
  "data": [...],
  "pagination": { "page": 1, "limit": 20, "total": 47 }
}

// GET item único
{
  "data": { ... }
}

// POST / PATCH
{
  "ok": true,
  "data": { ... }
}
```

### Erro

```json
// 401 Unauthorized
{ "error": "Sessão expirada. Por favor faça login novamente." }

// 403 Forbidden
{ "error": "Não tem permissão para esta acção." }

// 404 Not Found (isolamento — não revelar se existe mas não pertence)
{ "error": "Recurso não encontrado." }

// 409 Conflict
{ "error": "Este horário já está reservado." }

// 429 Rate Limit
{ "error": "Demasiados pedidos. Por favor aguarde alguns minutos." }

// 500 Internal Server Error
{ "error": "Ocorreu um erro interno. Por favor tente novamente." }
```

---

## 14. Headers de Segurança nas Respostas

```
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
Cache-Control: no-store, no-cache (para dados sensíveis)
```

---

## 15. Sumário de Endpoints

| Categoria | Endpoints |
|---|---|
| Autenticação | 6 |
| Dashboard | 1 |
| Perfil da empresa | 2 |
| Utilizadores | 6 |
| Contratos | 2 |
| Faturas | 3 |
| Pagamentos | 3 |
| Reservas | 5 |
| Documentos | 6 |
| Notificações | 6 |
| Suporte | 6 |
| Cron Jobs | 6 |
| **TOTAL** | **52** |

---

*VD Platform — Portal API Reference — Volume 03 — 29 Julho 2026*
