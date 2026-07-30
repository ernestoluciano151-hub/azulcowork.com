# Referência de APIs — VD Platform v1.0.0

> **Total de endpoints:** 123 route handlers  
> **Autenticação:** JWT via cookie `session` (HttpOnly)  
> **RBAC:** `requireRole(ADMIN | COMERCIAL | FINANCEIRO | VIEWER)`  
> **Base URL produção:** `https://[dominio-vercel].vercel.app`  
> **Data:** 29 Julho 2026

---

## Legenda

| Símbolo | Significado |
|---|---|
| 🔓 | Público (sem autenticação) |
| 🔐 | Requer sessão válida |
| 👑 | ADMIN only |
| 💼 | ADMIN ou FINANCEIRO |
| 📊 | ADMIN, FINANCEIRO ou VIEWER |
| 🤝 | ADMIN ou COMERCIAL |

---

## 1. Autenticação

| Método | Rota | Auth | Descrição |
|---|---|---|---|
| POST | `/api/auth/login` | 🔓 | Login com email + password. Devolve cookie `session`. |
| POST | `/api/auth/logout` | 🔐 | Invalida sessão. Remove cookie. |
| POST | `/api/auth/totp/verify` | 🔐 | Verificar código TOTP após login (2FA). |
| POST | `/api/admin/totp/setup` | 👑 | Configurar TOTP 2FA para o utilizador corrente. |
| GET  | `/api/admin/me` | 🔐 | Dados do utilizador autenticado (sem password). |
| POST | `/api/admin/change-password` | 🔐 | Alterar password do utilizador corrente. |

---

## 2. Utilizadores Admin

| Método | Rota | Auth | Descrição |
|---|---|---|---|
| GET  | `/api/admin/users` | 👑 | Listar todos os utilizadores admin. |
| POST | `/api/admin/users` | 👑 | Criar novo utilizador admin. |
| GET  | `/api/admin/users/[id]` | 👑 | Detalhes de utilizador. |
| PATCH | `/api/admin/users/[id]` | 👑 | Actualizar utilizador (role, nome, email). |
| DELETE | `/api/admin/users/[id]` | 👑 | Desactivar utilizador. |

---

## 3. Dashboard e Estatísticas

| Método | Rota | Auth | Descrição |
|---|---|---|---|
| GET | `/api/admin/stats` | 📊 | KPIs globais da plataforma (ocupação, receita, etc.). |
| GET | `/api/search` | 🔐 | Pesquisa global (empresas, leads, faturas). |
| GET | `/api/timeline` | 🔐 | Timeline global de eventos recentes. |

---

## 4. Notificações

| Método | Rota | Auth | Descrição |
|---|---|---|---|
| GET  | `/api/notifications` | 🔐 | Listar notificações do utilizador (não lidas primeiro). |
| PATCH | `/api/notifications/[id]` | 🔐 | Marcar notificação como lida. |
| POST | `/api/notifications/read-all` | 🔐 | Marcar todas as notificações como lidas. |

---

## 5. Salas de Reunião (Legado)

| Método | Rota | Auth | Descrição |
|---|---|---|---|
| GET  | `/api/rooms` | 🔓 | Listar salas disponíveis (público). |
| POST | `/api/rooms` | 👑 | Criar nova sala. |
| GET  | `/api/rooms/[id]` | 🔓 | Detalhes de sala (público). |
| PATCH | `/api/rooms/[id]` | 👑 | Actualizar sala. |
| DELETE | `/api/rooms/[id]` | 👑 | Eliminar sala. |
| GET  | `/api/rooms/[id]/reservations` | 🔐 | Reservas de uma sala. |
| GET  | `/api/admin/room-settings` | 👑 | Configurações globais das salas. |
| PATCH | `/api/admin/room-settings` | 👑 | Actualizar configurações das salas. |
| GET  | `/api/admin/room-pricing` | 🔐 | Listar preços das salas. |
| POST | `/api/admin/room-pricing` | 👑 | Criar regra de preço. |
| PATCH | `/api/admin/room-pricing/[id]` | 👑 | Actualizar regra de preço. |
| DELETE | `/api/admin/room-pricing/[id]` | 👑 | Eliminar regra de preço. |
| GET  | `/api/salas/reports` | 💼 | Relatório de ocupação e receita de salas. |

---

## 6. Planos de Coworking

| Método | Rota | Auth | Descrição |
|---|---|---|---|
| GET  | `/api/plans` | 🔐 | Listar planos disponíveis. |
| POST | `/api/plans` | 👑 | Criar plano. |
| GET  | `/api/plans/[id]` | 🔐 | Detalhes de plano. |
| PATCH | `/api/plans/[id]` | 👑 | Actualizar plano. |
| DELETE | `/api/plans/[id]` | 👑 | Eliminar plano. |

---

## 7. Reservas de Sala (Legado)

| Método | Rota | Auth | Descrição |
|---|---|---|---|
| GET  | `/api/reservations` | 🔐 | Listar reservas (filtros: data, sala, estado). |
| POST | `/api/reservations` | 🔐 | Criar reserva de sala. |
| GET  | `/api/reservations/[id]` | 🔐 | Detalhes de reserva. |
| PATCH | `/api/reservations/[id]` | 🔐 | Actualizar reserva. |
| DELETE | `/api/reservations/[id]` | 🔐 | Cancelar reserva. |
| POST | `/api/reservations/[id]/receive-payment` | 💼 | Registar pagamento de reserva. |

---

## 8. Room Booking Leads

| Método | Rota | Auth | Descrição |
|---|---|---|---|
| GET  | `/api/room-booking-leads` | 🔐 | Listar leads de reserva de sala. |
| POST | `/api/room-booking-leads` | 🔓 | Criar lead de reserva (formulário público). |
| GET  | `/api/room-booking-leads/[id]` | 🔐 | Detalhes de lead de sala. |
| PATCH | `/api/room-booking-leads/[id]` | 🔐 | Actualizar lead de sala. |
| POST | `/api/room-booking-leads/[id]/convert` | 💼 | Converter lead em reserva. |
| POST | `/api/room-booking-leads/[id]/to-reservation` | 💼 | Converter lead em reserva (v2). |

---

## 9. Empresas (Legado)

| Método | Rota | Auth | Descrição |
|---|---|---|---|
| GET  | `/api/companies` | 🔐 | Listar empresas (paginado). |
| POST | `/api/companies` | 🤝 | Criar empresa. |
| GET  | `/api/companies/[id]` | 🔐 | Detalhes de empresa. |
| PATCH | `/api/companies/[id]` | 🤝 | Actualizar empresa. |
| DELETE | `/api/companies/[id]` | 👑 | Eliminar empresa. |
| GET  | `/api/companies/[id]/payments` | 💼 | Histórico de pagamentos da empresa. |
| GET  | `/api/companies/alerts` | 💼 | Alertas de empresas (pagamentos em atraso, etc.). |

---

## 10. Leads (Legado)

| Método | Rota | Auth | Descrição |
|---|---|---|---|
| GET  | `/api/leads` | 🔐 | Listar leads (filtros: estado, gestor). |
| POST | `/api/leads` | 🤝 | Criar lead. |
| GET  | `/api/leads/[id]` | 🔐 | Detalhes de lead. |
| PATCH | `/api/leads/[id]` | 🤝 | Actualizar lead. |
| DELETE | `/api/leads/[id]` | 👑 | Eliminar lead. |
| GET  | `/api/leads/export` | 💼 | Exportar leads em CSV. |
| GET  | `/api/leads/export-xlsx` | 💼 | Exportar leads em XLSX. |
| GET  | `/api/export-crm` | 💼 | Exportar CRM completo. |

---

## 11. Finanças Legado

| Método | Rota | Auth | Descrição |
|---|---|---|---|
| GET  | `/api/finance/summary` | 💼 | Resumo financeiro global. |
| GET  | `/api/finance/company/[id]` | 💼 | Resumo financeiro de empresa. |
| GET  | `/api/finance/report` | 💼 | Relatório financeiro (filtros: período). |
| GET  | `/api/finance/sala` | 💼 | Financeiro de salas de reunião. |
| GET  | `/api/invoices` | 💼 | Listar faturas (legado). |
| POST | `/api/invoices` | 💼 | Criar fatura (legado). |
| GET  | `/api/invoices/[id]` | 💼 | Detalhes de fatura (legado). |
| PATCH | `/api/invoices/[id]` | 💼 | Actualizar fatura (legado). |
| DELETE | `/api/invoices/[id]` | 💼 | Cancelar fatura (legado). |
| GET  | `/api/invoices/[id]/download` | 💼 | Download PDF da fatura (legado). |
| POST | `/api/invoices/[id]/receipt` | 💼 | Gerar recibo (legado). |
| GET  | `/api/payments` | 💼 | Listar pagamentos (legado). |
| POST | `/api/payments` | 💼 | Registar pagamento (legado). |
| GET  | `/api/payments/[id]` | 💼 | Detalhes de pagamento (legado). |
| PATCH | `/api/payments/[id]` | 💼 | Actualizar pagamento (legado). |
| POST | `/api/payments/generate-monthly` | 💼 | Gerar pagamentos mensais. |
| GET  | `/api/expenses` | 💼 | Listar despesas (legado). |
| POST | `/api/expenses` | 💼 | Criar despesa (legado). |
| PATCH | `/api/expenses/[id]` | 💼 | Actualizar despesa (legado). |
| DELETE | `/api/expenses/[id]` | 💼 | Eliminar despesa (legado). |

---

## 12. Colaboradores

| Método | Rota | Auth | Descrição |
|---|---|---|---|
| GET  | `/api/employees` | 🔐 | Listar colaboradores. |
| POST | `/api/employees` | 👑 | Criar colaborador. |
| GET  | `/api/employees/[id]` | 🔐 | Detalhes de colaborador. |
| PATCH | `/api/employees/[id]` | 👑 | Actualizar colaborador. |
| DELETE | `/api/employees/[id]` | 👑 | Desactivar colaborador. |

---

## 13. Upload e Eliminação

| Método | Rota | Auth | Descrição |
|---|---|---|---|
| POST | `/api/upload` | 🔐 | Upload de ficheiro para Cloudinary. |
| GET  | `/api/atividades` | 🔐 | Histórico de actividades do sistema. |
| GET  | `/api/delete-requests` | 👑 | Listar pedidos de eliminação RGPD. |
| POST | `/api/delete-requests` | 🔐 | Submeter pedido de eliminação. |
| PATCH | `/api/delete-requests/[id]` | 👑 | Processar pedido de eliminação. |

---

## 14. CRM — Empresas

| Método | Rota | Auth | Descrição |
|---|---|---|---|
| GET  | `/api/crm/companies` | 🔐 | Listar empresas CRM (paginado, filtros por stage/tag/gestor). |
| POST | `/api/crm/companies` | 🤝 | Criar empresa CRM com detecção de duplicados. |
| GET  | `/api/crm/companies/[id]` | 🔐 | Customer 360° (company + contacts + deals + tasks + timeline + finance). |
| PATCH | `/api/crm/companies/[id]` | 🤝 | Actualizar empresa. |
| DELETE | `/api/crm/companies/[id]` | 👑 | Soft-delete empresa. |
| GET  | `/api/crm/companies/check-duplicate` | 🔐 | Verificar duplicado por nome/NIF/email. |
| GET  | `/api/crm/companies/duplicates` | 🤝 | Listar pares de empresas com suspeita de duplicado. |
| POST | `/api/crm/companies/[id]/merge` | 👑 | Fundir empresa com outra (mantém a mais antiga). |

---

## 15. CRM — Timeline

| Método | Rota | Auth | Descrição |
|---|---|---|---|
| GET  | `/api/crm/companies/[id]/timeline` | 🔐 | Timeline cronológica de empresa (todos os eventos). |

---

## 16. CRM — Contactos

| Método | Rota | Auth | Descrição |
|---|---|---|---|
| GET  | `/api/crm/companies/[id]/contacts` | 🔐 | Listar contactos da empresa. |
| POST | `/api/crm/companies/[id]/contacts` | 🤝 | Criar contacto. |
| GET  | `/api/crm/companies/[id]/contacts/[contactId]` | 🔐 | Detalhes de contacto. |
| PUT  | `/api/crm/companies/[id]/contacts/[contactId]` | 🤝 | Actualizar contacto. |
| DELETE | `/api/crm/companies/[id]/contacts/[contactId]` | 🤝 | Eliminar contacto. |

---

## 17. CRM — Negócios (Deals)

| Método | Rota | Auth | Descrição |
|---|---|---|---|
| GET  | `/api/crm/companies/[id]/deals` | 🔐 | Listar negócios da empresa. |
| POST | `/api/crm/companies/[id]/deals` | 🤝 | Criar negócio. Valida transições de stage. |
| GET  | `/api/crm/companies/[id]/deals/[dealId]` | 🔐 | Detalhes de negócio. |
| PATCH | `/api/crm/companies/[id]/deals/[dealId]` | 🤝 | Actualizar negócio (stage, valor, responsável). |
| DELETE | `/api/crm/companies/[id]/deals/[dealId]` | 🤝 | Eliminar negócio. |

---

## 18. CRM — Actividades, Tarefas e Notas

| Método | Rota | Auth | Descrição |
|---|---|---|---|
| GET  | `/api/crm/companies/[id]/activities` | 🔐 | Listar actividades da empresa. |
| POST | `/api/crm/companies/[id]/activities` | 🤝 | Registar actividade (call, email, meeting, visit). |
| GET  | `/api/crm/companies/[id]/tasks` | 🔐 | Listar tarefas da empresa. |
| POST | `/api/crm/companies/[id]/tasks` | 🤝 | Criar tarefa com data de conclusão. |
| PATCH | `/api/crm/companies/[id]/tasks/[taskId]` | 🤝 | Actualizar/completar tarefa. |
| DELETE | `/api/crm/companies/[id]/tasks/[taskId]` | 🤝 | Eliminar tarefa. |
| GET  | `/api/crm/tasks/my` | 🔐 | Tarefas do utilizador autenticado (pendentes + vencidas). |
| GET  | `/api/crm/companies/[id]/notes` | 🔐 | Listar notas da empresa. |
| POST | `/api/crm/companies/[id]/notes` | 🤝 | Criar nota (privada ou pública). |
| PUT  | `/api/crm/companies/[id]/notes/[noteId]` | 🤝 | Actualizar nota. |
| DELETE | `/api/crm/companies/[id]/notes/[noteId]` | 🤝 | Eliminar nota. |

---

## 19. CRM — Tags

| Método | Rota | Auth | Descrição |
|---|---|---|---|
| GET  | `/api/crm/tags` | 🔐 | Listar todas as tags disponíveis. |
| POST | `/api/crm/tags` | 👑 | Criar tag (nome + cor). |
| PUT  | `/api/crm/tags/[tagId]` | 👑 | Actualizar tag. |
| DELETE | `/api/crm/tags/[tagId]` | 👑 | Eliminar tag. |
| GET  | `/api/crm/companies/[id]/tags` | 🔐 | Listar tags da empresa. |
| POST | `/api/crm/companies/[id]/tags/[tagId]` | 🤝 | Associar tag a empresa. |
| DELETE | `/api/crm/companies/[id]/tags/[tagId]` | 🤝 | Remover tag de empresa. |

---

## 20. CRM — Dashboard e Pipeline

| Método | Rota | Auth | Descrição |
|---|---|---|---|
| GET | `/api/crm/dashboard` | 🔐 | KPIs CRM: empresas por stage, deals activos, tarefas pendentes, actividade recente. |
| GET | `/api/crm/pipeline` | 🔐 | Vista Kanban: empresas agrupadas por stage com totais de MRR. |
| POST | `/api/crm/migrate-leads` | 👑 | Migrar leads históricos para estrutura CRM. |

---

## 21. ERP — Contratos

| Método | Rota | Auth | Descrição |
|---|---|---|---|
| GET  | `/api/erp/contracts` | 💼 | Listar contratos (filtros: estado, empresa, período). |
| POST | `/api/erp/contracts` | 💼 | Criar contrato de aluguer (DRAFT). |
| GET  | `/api/erp/contracts/[id]` | 💼 | Detalhes de contrato (inclui RentSchedules). |
| PATCH | `/api/erp/contracts/[id]` | 💼 | Actualizar contrato em DRAFT. |
| DELETE | `/api/erp/contracts/[id]` | 👑 | Eliminar contrato em DRAFT. |
| POST | `/api/erp/contracts/[id]/activate` | 💼 | Activar contrato → gera RentSchedules. |
| POST | `/api/erp/contracts/[id]/suspend` | 💼 | Suspender contrato ACTIVE. |
| POST | `/api/erp/contracts/[id]/terminate` | 💼 | Rescindir contrato (com data e motivo). |

---

## 22. ERP — Faturas

| Método | Rota | Auth | Descrição |
|---|---|---|---|
| GET  | `/api/erp/invoices` | 💼 | Listar faturas ERP (filtros: estado, empresa, período). |
| POST | `/api/erp/invoices` | 💼 | Criar fatura ERP (DRAFT) a partir de RentSchedule ou manual. |
| GET  | `/api/erp/invoices/[id]` | 💼 | Detalhes de fatura (inclui items, ledger entries). |
| PATCH | `/api/erp/invoices/[id]` | 💼 | Actualizar fatura em DRAFT. |
| POST | `/api/erp/invoices/[id]/issue` | 💼 | Emitir fatura (DRAFT → ISSUED) + lançamento ledger. |
| POST | `/api/erp/invoices/[id]/void` | 💼 | Anular fatura + lançamento de estorno. |
| POST | `/api/erp/invoices/[id]/send` | 💼 | Enviar fatura por email (PDF + Cloudinary). `runtime=nodejs` |
| POST | `/api/erp/invoices/[id]/remind` | 💼 | Enviar lembrete de pagamento. |

---

## 23. ERP — Pagamentos

| Método | Rota | Auth | Descrição |
|---|---|---|---|
| GET  | `/api/erp/payments` | 💼 | Listar pagamentos (filtros: estado, empresa, período). |
| POST | `/api/erp/payments` | 💼 | Registar pagamento (PENDING). |
| GET  | `/api/erp/payments/[id]` | 💼 | Detalhes de pagamento. |
| POST | `/api/erp/payments/[id]/confirm` | 💼 | Confirmar pagamento + ledger + CashMovement + recibo. |
| POST | `/api/erp/payments/[id]/reject` | 💼 | Rejeitar pagamento (com motivo). |
| POST | `/api/erp/payments/[id]/refund` | 💼 | Reembolsar pagamento CONFIRMED. |
| POST | `/api/erp/payments/[id]/receipt` | 💼 | Gerar e enviar recibo PDF. `runtime=nodejs` |

---

## 24. ERP — Despesas

| Método | Rota | Auth | Descrição |
|---|---|---|---|
| GET  | `/api/erp/expenses` | 💼 | Listar despesas (filtros: estado, CostCenter, categoria). |
| POST | `/api/erp/expenses` | 💼 | Criar despesa (PENDING). |
| GET  | `/api/erp/expenses/[id]` | 💼 | Detalhes de despesa. |
| PATCH | `/api/erp/expenses/[id]` | 💼 | Actualizar despesa em PENDING. |
| DELETE | `/api/erp/expenses/[id]` | 👑 | Eliminar despesa PENDING/REJECTED. |
| POST | `/api/erp/expenses/[id]/approve` | 💼 | Aprovar despesa (PENDING → APPROVED). |
| POST | `/api/erp/expenses/[id]/reject` | 💼 | Rejeitar despesa (com motivo). |
| POST | `/api/erp/expenses/[id]/pay` | 💼 | Pagar despesa + ledger + CashMovement. |
| POST | `/api/erp/expenses/[id]/cancel` | 💼 | Cancelar despesa. |

---

## 25. ERP — Fluxo de Caixa

| Método | Rota | Auth | Descrição |
|---|---|---|---|
| GET | `/api/erp/cashflow` | 💼 | Movimentos de caixa reais (não projectados). Filtros: período, tipo. |
| GET | `/api/erp/cashflow/projection` | 💼 | Projecção 30/60/90 dias com saldo acumulado. |
| GET | `/api/erp/cashflow/kpis` | 💼 | KPIs de caixa: saldo actual, entrada/saída do mês, runway. |
| POST | `/api/erp/cashflow/adjustment` | 💼 | Ajuste manual de saldo (com nota obrigatória). |

---

## 26. ERP — Alertas Financeiros

| Método | Rota | Auth | Descrição |
|---|---|---|---|
| GET  | `/api/erp/alerts` | 💼 | Listar alertas (filtros: tipo, estado, severidade). |
| POST | `/api/erp/alerts` | 💼 | Criar alerta manual. |
| GET  | `/api/erp/alerts/[id]` | 💼 | Detalhes de alerta. |
| PATCH | `/api/erp/alerts/[id]` | 💼 | Actualizar estado: ACKNOWLEDGED / SNOOZED / RESOLVED. |

---

## 27. ERP — Dashboard Financeiro

| Método | Rota | Auth | Descrição |
|---|---|---|---|
| GET | `/api/erp/dashboard` | 💼 | KPIs em tempo real: MRR, ARR, receita, recebido, inadimplência, churn, ticket médio, EBIT, saldo, projecção 90d. |

---

## 28. ERP — Relatórios

| Método | Rota | Auth | Descrição |
|---|---|---|---|
| GET | `/api/erp/reports/pnl` | 💼 | P&L mensal/trimestral + Trial Balance (from FinancialLedger). |
| GET | `/api/erp/reports/mrr` | 💼 | MRR Breakdown: novo, churn, net, total por mês. |
| GET | `/api/erp/reports/contracts` | 💼 | Resumo de contratos por estado + a expirar. |
| GET | `/api/erp/reports/delinquency` | 💼 | Relatório de inadimplência por empresa. |
| GET | `/api/erp/reports/cost-centers` | 💼 | Real vs. orçado por CostCenter com status (OK/WARNING/CRITICAL). |
| GET | `/api/erp/reports/aging` | 💼 | AR Aging: 0–30d / 31–60d / 61–90d / +90d. |
| GET | `/api/erp/reports/ap` | 💼 | Contas a pagar: despesas pendentes por vencimento. |
| GET | `/api/erp/reports/vat` | 💼 | IVA Angola: `?period=YYYY-MM&history=true&months=6`. |
| GET | `/api/erp/reports/reconciliation` | 💼 | Reconciliação bancária: `?period=YYYY-MM&bankAccount=BCS-MAIN`. |
| GET | `/api/erp/reports/export` | 💼 | Export XLSX/CSV: `?type=pnl\|aging\|mrr\|vat\|cost-centers\|delinquency&format=xlsx\|csv`. |

---

## 29. Cron Jobs (Autenticados por CRON_SECRET)

| Método | Rota | Auth | Periodicidade | Descrição |
|---|---|---|---|---|
| GET | `/api/cron/erp-daily` | Bearer `CRON_SECRET` | Diário 06h00 | Alertas: CONTRACT_EXPIRING, PAYMENT_OVERDUE, CONTRACT_EXPIRED, BUDGET_EXCEEDED. |
| GET | `/api/cron/erp-monthly-snapshot` | Bearer `CRON_SECRET` | `0 22 28-31 * *` | Snapshot mensal FinancialReportSnapshot (upsert por period+type). |

---

## 30. Sumário por Categoria

| Categoria | Endpoints | Auth mínimo |
|---|---|---|
| Autenticação | 6 | 🔓/🔐 |
| Utilizadores Admin | 5 | 👑 |
| Dashboard + Search | 3 | 🔐 |
| Notificações | 3 | 🔐 |
| Salas (legado) | 13 | 🔓/👑 |
| Planos | 5 | 🔐 |
| Reservas (legado) | 6 | 🔐/💼 |
| Room Booking Leads | 6 | 🔓/💼 |
| Empresas (legado) | 6 | 🔐/💼 |
| Leads (legado) | 8 | 🔐/💼 |
| Finanças (legado) | 21 | 💼 |
| Colaboradores | 5 | 🔐/👑 |
| Upload + Sistema | 5 | 🔐/👑 |
| CRM — Empresas | 8 | 🔐/🤝/👑 |
| CRM — Timeline | 1 | 🔐 |
| CRM — Contactos | 5 | 🔐/🤝 |
| CRM — Deals | 5 | 🔐/🤝 |
| CRM — Actividades/Tarefas/Notas | 11 | 🔐/🤝 |
| CRM — Tags | 7 | 🔐/🤝/👑 |
| CRM — Dashboard/Pipeline | 3 | 🔐/👑 |
| ERP — Contratos | 8 | 💼/👑 |
| ERP — Faturas | 8 | 💼 |
| ERP — Pagamentos | 7 | 💼 |
| ERP — Despesas | 9 | 💼/👑 |
| ERP — Cashflow | 4 | 💼 |
| ERP — Alertas | 4 | 💼 |
| ERP — Dashboard | 1 | 💼 |
| ERP — Relatórios | 10 | 💼 |
| Cron Jobs | 2 | CRON_SECRET |
| **TOTAL** | **123** | |

---

*VD Platform — API Reference v1.0.0 — 29 Julho 2026*
