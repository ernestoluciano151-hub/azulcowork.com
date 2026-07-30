# Volume 03 — Portal do Cliente + Comunicação Omnicanal

> **Volume:** 03  
> **Estado:** ✅ **CONCLUÍDO** — Beta interna pronta · 29 Jul 2026  
> **Depende de:** Volume 02 — ERP ✅ Concluído  
> **Data de especificação:** 29 Julho 2026  
> **Product Owner:** Ernesto Pinto Luciano

---

## Visão

Transformar o VD Platform numa **solução self-service para empresas clientes** do Azul Coworking.

Até à v1.0, toda a interacção era mediada pelo staff interno (admin, financeiro, comercial).
O Volume 03 adiciona uma camada de acesso directo ao cliente: cada empresa pode consultar
o seu contrato, descarregar faturas, confirmar pagamentos, reservar salas e abrir tickets
de suporte — sem depender de intermediários.

A Comunicação Omnicanal garante que cada evento relevante chega ao cliente pelo canal
que este prefere: email, WhatsApp, notificação in-app ou push web.

---

## Princípios Obrigatórios

```
1. ISOLAMENTO TOTAL      — nenhum cliente acede a dados de outra empresa (multi-tenant)
2. AUDITORIA COMPLETA    — toda leitura de documento é registada em AuditLog
3. TIMELINE UNIVERSAL    — toda comunicação gera TimelineEntry na empresa
4. NOTIFICAÇÃO COM ESTADO — pendente → enviada → lida / falhou (sem fire-and-forget)
5. DOWNLOADS SEGUROS     — URLs assinadas e temporárias (máx. 15 minutos)
6. RBAC NO PORTAL        — PORTAL_OWNER | PORTAL_ADMIN | PORTAL_MEMBER | PORTAL_VIEWER
7. GRACEFUL DEGRADATION  — canal indisponível → fallback para email; operação não bloqueia
```

---

## Índice de Documentos

| Documento | Conteúdo | Estado |
|---|---|---|
| [README.md](./README.md) | Visão geral, princípios, roadmap de sprints | 📋 Este ficheiro |
| [permissions.md](./permissions.md) | RBAC do portal: roles, matrix de acesso | 📋 Especificação |
| [data-model.md](./data-model.md) | Modelos Prisma: PortalUser, Notificação, Documento, Suporte | 📋 Especificação |
| [customer-portal.md](./customer-portal.md) | Funcionalidades: Dashboard, Faturas, Pagamentos, Reservas | 📋 Especificação |
| [communication-center.md](./communication-center.md) | Omnicanal: Email (Resend), WhatsApp, In-app, Push Web | 📋 Especificação |
| [notifications.md](./notifications.md) | Tipos de notificação, estados, entrega, re-tentativas | 📋 Especificação |
| [documents.md](./documents.md) | Upload, download assinado, versionamento, auditoria | 📋 Especificação |
| [support.md](./support.md) | Tickets de suporte, categorias, SLA, mensagens | 📋 Especificação |
| [api.md](./api.md) | Referência de APIs: /api/portal/** | 📋 Especificação |
| [ux-flows.md](./ux-flows.md) | Fluxos UX: login, dashboard, fatura, suporte | 📋 Especificação |
| [testing.md](./testing.md) | Estratégia de testes para Volume 03 | ✅ Actualizado VOL03-10E |
| [env-vars.md](./env-vars.md) | Variáveis de ambiente obrigatórias + checklist deploy | ✅ Produzido VOL03-10D |
| [onboarding-beta.md](./onboarding-beta.md) | Guia de onboarding para empresas piloto da beta | ✅ Produzido VOL03-11C |
| [migration.md](./migration.md) | Plano de migração e activação gradual | 📋 Especificação |

---

## Roadmap de Sprints

| Sprint | Objectivo | Duração | Estado |
|---|---|---|---|
| **VOL03-0** | Especificação completa (este pacote) | 1 semana | ✅ Concluído — 29 Jul 2026 |
| **VOL03-1** | Auth do Portal + Schema Prisma + Migration | 1 semana | ✅ Concluído — 29 Jul 2026 |
| **VOL03-2** | Dashboard + Contratos + Faturas (leitura) | 1 semana | ✅ Concluído — 29 Jul 2026 |
| **VOL03-3** | Pagamentos + Recibos + Download assinado | 3 dias | ✅ Concluído — 29 Jul 2026 |
| **VOL03-4** | Reservas de sala + Perfil da empresa | 3 dias | ✅ Concluído — 29 Jul 2026 |
| **VOL03-5** | Gestão de Documentos (upload/download/versão) | 1 semana | ✅ Concluído — 29 Jul 2026 |
| **VOL03-6** | Suporte ao cliente (tickets + mensagens) | 3 dias | ✅ Concluído — 29 Jul 2026 |
| **VOL03-7** | Comunicação Omnicanal (Resend + WhatsApp + in-app) | 1 semana | ✅ Concluído — 29 Jul 2026 |
| **VOL03-8** | Push Web (VAPID) + Centro de Notificações | 3 dias | ✅ Concluído — 29 Jul 2026 |
| **VOL03-9** | Alertas automáticos omnicanal (5 tipos) | 3 dias | ✅ Concluído — 29 Jul 2026 |
| **VOL03-10** | Testes integração + Performance + Hardening | 1 semana | ✅ Concluído — 29 Jul 2026 |
| **VOL03-11** | Beta interna (3–5 empresas piloto) | 4 semanas | ✅ Concluído — 29 Jul 2026 |

**Total estimado:** 12 sprints · ~14 semanas · Agosto–Novembro 2026

---

## Módulos do Volume 03

### Portal do Cliente (`/portal/*`)

```
/portal                     — Redireciona para /portal/dashboard
/portal/login               — Login por magic link (email) ou credenciais
/portal/dashboard           — Vista geral: contrato, saldo, próxima fatura, alertas
/portal/perfil              — Dados da empresa + contactos
/portal/utilizadores        — Gestão de utilizadores do portal (PORTAL_OWNER/ADMIN)
/portal/contratos           — Contrato(s) activo(s) com RentSchedules
/portal/faturas             — Histórico de faturas + download PDF
/portal/pagamentos          — Histórico de pagamentos + recibos
/portal/reservas            — Reservas de sala: criar, ver, cancelar
/portal/documentos          — Documentos partilhados (contratos assinados, etc.)
/portal/notificacoes        — Centro de notificações (in-app)
/portal/suporte             — Tickets de suporte + chat assíncrono
```

### Comunicação Omnicanal

```
Email       — Resend (transaccional + marketing)
WhatsApp    — Meta WhatsApp Business Cloud API
In-app      — Notificações em tempo real via SSE (Server-Sent Events)
Push Web    — Web Push API (VAPID) para notificações browser
```

### Gestão de Documentos

```
Upload      — PDF/DOCX/XLSX até 50 MB via Cloudinary
Download    — URL assinada temporária (15 minutos)
Versões     — Histórico de versões por documento
Auditoria   — Registo de cada download/visualização
Assinatura  — Placeholder para integração futura (DocuSign/Yousign)
```

### Alertas Automáticos (5 tipos)

```
RENT_DUE          — Renda a vencer em 7 dias
CONTRACT_EXPIRING — Contrato a expirar em 30/15/7 dias
PAYMENT_OVERDUE   — Pagamento em atraso (+1 dia, +7 dias, +30 dias)
BOOKING_CONFIRMED — Reserva de sala confirmada
DOCUMENT_AVAILABLE — Novo documento disponível para download
```

---

## Fluxo de Autenticação do Portal

O portal usa um sistema de autenticação **separado do sistema admin**:

```
OPÇÃO A — Magic Link (recomendada):
  Cliente recebe email com link de 15 minutos → clica → sessão criada
  Sem password → zero suporte de "esqueci a password"
  Adequado para utilizadores não-técnicos

OPÇÃO B — Credenciais (email + password):
  Admin cria conta portal com email + password temporária
  Cliente faz login e altera password no 1.º acesso
  Suporta múltiplos utilizadores por empresa

DECISÃO PO: [a preencher antes de VOL03-1]
```

**Sessão do portal:** JWT separado, cookie `portal-session`, expiração 8h (renovável).  
**Namespace separado:** `/api/portal/*` vs `/api/admin/*` — nunca se cruzam.

---

## Entidades Novas (resumo)

```
PortalUser              — utilizador do portal (ligado a Company)
PortalSession           — sessões activas do portal
PortalMagicLink         — tokens de magic link (TTL 15 min)
PortalDocument          — documento partilhado com a empresa
PortalDocumentVersion   — versão de documento
PortalDocumentAccess    — auditoria de acesso (download, visualização)
PortalNotification      — notificação (pendente/enviada/lida/falhou)
PortalSupportTicket     — ticket de suporte
PortalSupportMessage    — mensagem dentro do ticket
OmnichannelMessage      — mensagem enviada por qualquer canal (audit trail)
```

---

## Regras de Negócio Críticas

```
BR-PORT-001 — Um PortalUser só acede a dados da sua Company (companyId obrigatório em todas as queries)
BR-PORT-002 — Downloads geram URL assinada com TTL 15 min (nunca URL directa do Cloudinary)
BR-PORT-003 — Toda leitura de documento cria PortalDocumentAccess + TimelineEntry
BR-PORT-004 — Toda OmnichannelMessage tem estado final: DELIVERED | READ | FAILED
BR-PORT-005 — Falha num canal omnicanal → fallback automático para email + registo do fallback
BR-PORT-006 — PORTAL_OWNER é criado pelo admin; PORTAL_OWNER pode criar PORTAL_ADMIN e PORTAL_MEMBER
BR-PORT-007 — Reservas de sala criadas pelo portal seguem as mesmas regras de conflict check do sistema legado
BR-PORT-008 — Suporte: resposta obrigatória em ≤ 48h (SLA básico); alerta interno se ultrapassado
```

---

## ADRs Propostos para Aprovação

| ADR | Decisão | Estado |
|---|---|---|
| ADR-026 | Auth do Portal: Magic Link vs Credenciais | 📋 Aguarda PO |
| ADR-027 | Omnicanal: Resend + Meta Cloud API + VAPID (sem broker externo) | 📋 Proposto |
| ADR-028 | Downloads assinados via URL temporária (Cloudinary + token interno) | 📋 Proposto |
| ADR-029 | Suporte assíncrono (sem live chat) na v1 | 📋 Proposto |
| ADR-030 | Notificações in-app via SSE (Server-Sent Events, sem WebSocket) | 📋 Proposto |

---

## Critérios de Saída (Definition of Done do Volume 03)

```
□ VOL03-11 concluído: beta interna ≥ 4 semanas com ≥ 3 empresas piloto
□ Zero erros de isolamento de dados (empresa A nunca vê dados da empresa B)
□ Todos os downloads via URL assinada (zero URLs directas de Cloudinary)
□ 100% das notificações com estado final registado (DELIVERED/READ/FAILED)
□ Testes de integração: ciclo completo (login → fatura → download → notificação)
□ Testes de segurança: RBAC por role e por empresa
□ Performance: P95 ≤ 1.000 ms em todas as rotas do portal
□ Documentação actualizada (todos os docs com estado ✅ Implementado)
□ ADRs 026–030 marcados como ACEITE
□ PO valida o portal com utilizador real de empresa piloto
```

---

*VD Platform — Volume 03 — README — 29 Julho 2026*  
*Especificação aguarda aprovação formal antes de implementação*
