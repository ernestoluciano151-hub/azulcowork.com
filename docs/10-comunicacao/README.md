# Volume 07 — Comunicação Avançada

> **Estado:** ✅ CONCLUÍDO — Sprint VOL07-4 (30 Julho 2026)  
> **Proposto em:** 29 Julho 2026 · **Concluído em:** 30 Julho 2026  
> **Arquiteto:** Claude (VD Platform)  
> **Pasta:** `docs/10-comunicacao/`  
> **Pasta de código:** `src/lib/`, `src/app/api/admin/email-templates/`, `src/app/api/communication/`, `src/app/admin/comunicacao/`  
> **ADR:** [ADR-037](../adr/ADR-037-communication-architecture.md)

---

## 0. Contexto e Justificação

Com os Volumes 01–06 concluídos, a plataforma envia emails em 7+ pontos diferentes do sistema — mas sem nenhum registo, sem templates editáveis e sem visibilidade para o operador. A comunicação existe mas é **invisible e frágil**:

| Problema actual | Impacto |
|---|---|
| Emails enviados sem log | Se um email falhar, não há como saber. Sem auditoria de comunicação. |
| Templates hardcoded em TypeScript | Mudar o texto de um email requer deploy. O operador não consegue personalizar. |
| WhatsApp apenas deep-link | O operador tem de copiar manualmente a mensagem e enviar. Não há automação real. |
| Crons de alertas dispersos | 5 crons independentes (portal-rent-due, portal-contract-expiring, portal-payment-overdue, reservations-close, erp-daily) sem coordenação nem log central. |
| Sem UI de comunicação | Não há forma de ver "que emails foram enviados esta semana" ou "quantas empresas foram alertadas". |

Este volume resolve estas lacunas **sem alterar a lógica de negócio existente** — apenas adiciona camadas de observabilidade, configurabilidade e automação.

---

## 1. Objectivos

```
1. CommunicationLog  — registo persistente de toda a comunicação enviada
2. EmailTemplate     — templates editáveis pelo admin, sem necessidade de deploy
3. Centro de Comunicação UI — /admin/comunicacao com histórico e re-envio
4. WhatsApp unificado — envio automático via API + fallback para deep-link
5. Cron consolidado  — /api/cron/communication-daily substituindo crons dispersos
```

**Fora de âmbito:**
- Campanhas de email em massa (newsletter, marketing) → VOL10 Automações
- SMS (Twilio SMS) → não prioritário no contexto Luanda/Angola
- Push notifications nativas (iOS/Android) → VOL futuro mobile

---

## 2. Regras de Negócio

| ID | Regra |
|---|---|
| COM-001 | Todo o email enviado pelo sistema DEVE gerar um registo em `CommunicationLog` |
| COM-002 | Um `CommunicationLog` com status FAILED é retentado automaticamente (máx. 3 tentativas) |
| COM-003 | Os templates de email têm variáveis delimitadas por `{{variavel}}` |
| COM-004 | Um template só pode ser eliminado se não tiver comunicações associadas |
| COM-005 | O operador pode re-enviar qualquer comunicação com status FAILED directamente da UI |
| COM-006 | WhatsApp automático requer configuração da variável de ambiente `WHATSAPP_API_URL` |
| COM-007 | Se `WHATSAPP_API_URL` não estiver configurada, o sistema gera deep-link em vez de enviar |
| COM-008 | Comunicações de tipo financeiro (fatura, recibo) só podem ser enviadas por ADMIN ou FINANCEIRO |
| COM-009 | O cron diário de comunicação corre às 08h00 (Africa/Luanda) via Vercel Cron |

---

## 3. Modelo de Domínio

### 3.1 Novos Modelos (Schema Prisma)

#### `CommunicationLog`

```prisma
model CommunicationLog {
  id           String    @id @default(cuid())
  type         CommType  // EMAIL | WHATSAPP | WHATSAPP_DEEPLINK
  channel      String    // transactional | alert | reminder | receipt
  templateSlug String?   // referência ao slug do template usado
  to           String    // email ou número de telefone
  subject      String?   // apenas para EMAIL
  body         String    // conteúdo enviado (HTML para email, texto para WA)
  status       CommStatus @default(PENDING)
  attempts     Int        @default(0)
  lastAttemptAt DateTime?
  sentAt       DateTime?
  errorMsg     String?

  // Contexto da entidade origem
  entityType   String?   // LEAD | COMPANY | RESERVATION | PAYMENT | INVOICE
  entityId     String?

  // Actor
  triggeredBy  String    @default("SYSTEM") // SYSTEM | admin ID
  adminId      String?

  createdAt    DateTime  @default(now())
  updatedAt    DateTime  @updatedAt

  @@index([status])
  @@index([type])
  @@index([entityType, entityId])
  @@index([createdAt])
  @@index([to])
}

enum CommType {
  EMAIL
  WHATSAPP
  WHATSAPP_DEEPLINK
}

enum CommStatus {
  PENDING
  SENT
  FAILED
  RETRYING
}
```

#### `EmailTemplate`

```prisma
model EmailTemplate {
  id          String    @id @default(cuid())
  slug        String    @unique  // ex: "reservation-confirmation", "invoice-sent"
  name        String             // nome legível pelo admin
  subject     String             // assunto do email (suporta {{variavel}})
  htmlBody    String    @db.Text // corpo HTML (suporta {{variavel}})
  variables   String[]           // lista de variáveis esperadas ex: ["clientName", "totalAmount"]
  category    String             // transactional | financial | alert
  isActive    Boolean   @default(true)
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt
}
```

**Total de novas tabelas:** 2 (`CommunicationLog`, `EmailTemplate`) + 2 enums (`CommType`, `CommStatus`)  
**Tabelas alteradas:** nenhuma  
**Modelos existentes afectados:** nenhum (adição pura)

---

## 4. Templates de Email a Migrar

| Slug | Origem actual | Variáveis |
|---|---|---|
| `lead-new-coworking` | `email.ts:sendNewLeadEmail` | firstName, lastName, email, whatsapp, scheduledDate, spaceType, planName |
| `lead-new-sala` | `email.ts:sendNewRoomLeadEmail` | firstName, lastName, email, whatsapp, planName, preferredDate, participants |
| `reservation-confirmation` | `email.ts:sendReservationConfirmationEmail` | clientName, eventName, planName, startDatetime, endDatetime, totalHours, totalAmount |
| `reservation-new-admin` | `email.ts:sendNewReservationAdminEmail` | clientName, eventName, planName, startDatetime, totalAmount, status |
| `invoice-sent` | `erp-email-service.ts:sendInvoiceEmail` | companyName, invoiceNumber, issueDate, dueDate, subtotal, vat, total |
| `payment-receipt` | `erp-email-service.ts:sendReceiptEmail` | companyName, invoiceNumber, amountPaid, method, receiptNumber |
| `payment-reminder` | `erp-email-service.ts:sendReminderEmail` | companyName, invoiceNumber, dueDate, total, daysUntilDue |
| `payment-overdue` | `erp-email-service.ts:sendOverdueEmail` | companyName, invoiceNumber, dueDate, total, daysOverdue |

**Total: 8 templates** a extrair do código para a base de dados.

---

## 5. Arquitectura de Serviços

```
                    ┌─────────────────────────────────────┐
                    │  communication-service.ts (NOVO)     │
                    │                                       │
                    │  sendEmail(slug, to, vars, context)  │
                    │  sendWhatsApp(phone, msg, context)   │
                    │  retryFailed(maxAttempts)            │
                    └──────┬────────────────┬─────────────┘
                           │                │
                    ┌──────▼──────┐  ┌──────▼──────────────┐
                    │  email.ts   │  │  whatsapp-service.ts │
                    │ (existente) │  │  (NOVO)              │
                    │ nodemailer  │  │  Z-API ou deep-link  │
                    └─────────────┘  └─────────────────────┘
                           │                │
                    ┌──────▼────────────────▼─────────────┐
                    │       CommunicationLog (BD)          │
                    │   registo automático de todos        │
                    │   os envios com status + retry       │
                    └─────────────────────────────────────┘
```

### Ficheiros de serviço novos

| Ficheiro | Responsabilidade |
|---|---|
| `src/lib/communication-service.ts` | Orquestrador central: busca template, interpola variáveis, envia, regista log |
| `src/lib/whatsapp-service.ts` | Envio via Z-API (se configurado) ou geração de deep-link |
| `src/lib/template-interpolator.ts` | Substitui `{{variavel}}` pelo valor, sanitiza HTML |

---

## 6. API Routes

### 6.1 Email Templates (ADMIN only)

| Método | Rota | Acção |
|---|---|---|
| GET | `/api/admin/email-templates` | Listar todos os templates |
| GET | `/api/admin/email-templates/[slug]` | Detalhe de um template |
| PATCH | `/api/admin/email-templates/[slug]` | Editar subject ou htmlBody |
| POST | `/api/admin/email-templates/[slug]/preview` | Pré-visualizar com dados de exemplo |

### 6.2 Communication Log (ADMIN + FINANCEIRO)

| Método | Rota | Acção |
|---|---|---|
| GET | `/api/communication?page=&type=&status=&entityId=` | Listar com filtros e paginação |
| GET | `/api/communication/[id]` | Detalhe de uma comunicação |
| POST | `/api/communication/[id]/retry` | Re-enviar manualmente (ADMIN only) |

### 6.3 Cron consolidado (substituição)

| Método | Rota | Acção |
|---|---|---|
| POST | `/api/cron/communication-daily` | Alertas diários: expiração de contratos + pagamentos em atraso + lembretes de reserva D-1 |

---

## 7. UI — Centro de Comunicação

### `/admin/comunicacao`

Página de histórico com:
- Tabela paginada com colunas: Tipo (badge), Para, Assunto, Estado (badge), Entidade, Data
- Filtros: Tipo (EMAIL/WHATSAPP), Estado (SENT/FAILED/PENDING), Período
- Botão "Re-enviar" em linhas com status FAILED
- Contador de falhas no topo (alerta visível)

### `/admin/configuracoes/email-templates`

Gestão de templates de email:
- Lista de templates com slug, nome, categoria e estado (activo/inactivo)
- Editor simples: subject + textarea htmlBody + lista de variáveis disponíveis
- Botão "Pré-visualizar" — renderiza o HTML com dados de exemplo
- Nota: apenas subject e htmlBody são editáveis; slug e variables são read-only

---

## 8. Backlog — 4 Sprints

### Sprint VOL07-1 — CommunicationLog + Serviço Central (3h)

| ID | Tarefa | Ficheiros |
|---|---|---|
| V07-001 | Schema Prisma: CommunicationLog + EmailTemplate + enums | `prisma/schema.prisma` |
| V07-002 | Migração Prisma + seed dos 8 templates | `prisma/migrations/` + `prisma/seed.ts` |
| V07-003 | `template-interpolator.ts` — substituição de `{{var}}` + sanitização | `src/lib/template-interpolator.ts` |
| V07-004 | `communication-service.ts` — orquestrador (busca template → envia → regista) | `src/lib/communication-service.ts` |
| V07-005 | Migrar `email.ts` para usar communication-service (logs automáticos) | `src/lib/email.ts` |
| V07-006 | Migrar `erp-email-service.ts` para usar communication-service | `src/lib/erp-email-service.ts` |

### Sprint VOL07-2 — WhatsApp + API Routes (2–3h)

| ID | Tarefa | Ficheiros |
|---|---|---|
| V07-007 | `whatsapp-service.ts` — Z-API (se configurado) + fallback deep-link + log | `src/lib/whatsapp-service.ts` |
| V07-008 | API: GET/PATCH `/api/admin/email-templates` + `[slug]` | `src/app/api/admin/email-templates/` |
| V07-009 | API: POST `/api/admin/email-templates/[slug]/preview` | `src/app/api/admin/email-templates/[slug]/preview/` |
| V07-010 | API: GET `/api/communication` (lista paginada com filtros) | `src/app/api/communication/route.ts` |
| V07-011 | API: GET `/api/communication/[id]` + POST `/api/communication/[id]/retry` | `src/app/api/communication/[id]/` |

### Sprint VOL07-3 — Centro de Comunicação UI (3h)

| ID | Tarefa | Ficheiros |
|---|---|---|
| V07-012 | Página `/admin/comunicacao` — tabela paginada + filtros | `src/app/admin/comunicacao/page.tsx` |
| V07-013 | Badge de falhas de comunicação no Dashboard (KPI card) | `src/app/admin/dashboard/page.tsx` |
| V07-014 | Página `/admin/configuracoes/email-templates` — lista + editor | `src/app/admin/configuracoes/email-templates/page.tsx` |
| V07-015 | Adicionar "Comunicação" na Sidebar + link "Config. Email" nas definições | `src/components/admin/Sidebar.tsx` |
| V07-016 | Cron consolidado: `/api/cron/communication-daily` | `src/app/api/cron/communication-daily/route.ts` |

### Sprint VOL07-4 — Testes + Docs + ADR (2h)

| ID | Tarefa | Ficheiros |
|---|---|---|
| V07-017 | Testes unitários: template-interpolator (variáveis, sanitização, erros) | `src/__tests__/unit/template-interpolator.test.ts` |
| V07-018 | Testes unitários: communication-service (mock email + mock BD) | `src/__tests__/unit/communication-service.test.ts` |
| V07-019 | ADR-037: Arquitectura de Comunicação (CommunicationLog + templates dinâmicos) | `docs/adr/ADR-037-communication-architecture.md` |
| V07-020 | Actualizar ADR index + CLAUDE.md + docs/README.md | `docs/adr/README.md`, `CLAUDE.md`, `docs/README.md` |

---

## 9. Ficheiros Afectados

| Ficheiro | Operação | Sprint |
|---|---|---|
| `prisma/schema.prisma` | EDIÇÃO — 2 novos modelos + 2 enums | VOL07-1 |
| `prisma/seed.ts` | EDIÇÃO — seed dos 8 templates | VOL07-1 |
| `src/lib/template-interpolator.ts` | NOVO | VOL07-1 |
| `src/lib/communication-service.ts` | NOVO | VOL07-1 |
| `src/lib/whatsapp-service.ts` | NOVO | VOL07-2 |
| `src/lib/email.ts` | EDIÇÃO — adicionar logging | VOL07-1 |
| `src/lib/erp-email-service.ts` | EDIÇÃO — adicionar logging | VOL07-1 |
| `src/app/api/admin/email-templates/route.ts` | NOVO | VOL07-2 |
| `src/app/api/admin/email-templates/[slug]/route.ts` | NOVO | VOL07-2 |
| `src/app/api/admin/email-templates/[slug]/preview/route.ts` | NOVO | VOL07-2 |
| `src/app/api/communication/route.ts` | NOVO | VOL07-2 |
| `src/app/api/communication/[id]/route.ts` | NOVO | VOL07-2 |
| `src/app/api/communication/[id]/retry/route.ts` | NOVO | VOL07-2 |
| `src/app/api/cron/communication-daily/route.ts` | NOVO | VOL07-3 |
| `src/app/admin/comunicacao/page.tsx` | NOVO | VOL07-3 |
| `src/app/admin/configuracoes/email-templates/page.tsx` | NOVO | VOL07-3 |
| `src/app/admin/dashboard/page.tsx` | EDIÇÃO — KPI card falhas | VOL07-3 |
| `src/components/admin/Sidebar.tsx` | EDIÇÃO — link Comunicação | VOL07-3 |
| `src/__tests__/unit/template-interpolator.test.ts` | NOVO | VOL07-4 |
| `src/__tests__/unit/communication-service.test.ts` | NOVO | VOL07-4 |
| `docs/adr/ADR-037-communication-architecture.md` | NOVO | VOL07-4 |

**Schema:** 2 novos modelos (`CommunicationLog`, `EmailTemplate`), 2 novos enums.  
**Migrações:** 1 migração Prisma necessária.

---

## 10. Dependências Novas

| Pacote | Versão | Justificação | Aprovação |
|---|---|---|---|
| `isomorphic-dompurify` | `^3.x` | Sanitização de HTML nos templates editáveis | ✅ Incluído |
| `axios` | (se não instalado) | Chamadas à Z-API WhatsApp | Opcional — só se WHATSAPP_API_URL configurado |

> Se `axios` já estiver instalado (verificar `package.json`), sem nova dependência.

---

## 11. Configuração de Ambiente

Novas variáveis de ambiente (opcionais — graceful degradation se ausentes):

```env
# WhatsApp via Z-API (opcional)
WHATSAPP_API_URL=https://api.z-api.io/instances/INSTANCE_ID/token/TOKEN
WHATSAPP_INSTANCE_ID=...
WHATSAPP_TOKEN=...

# Já existentes (obrigatórias para email)
SMTP_HOST=...
SMTP_PORT=...
SMTP_USER=...
SMTP_PASS=...
ADMIN_EMAIL=...
```

---

## 12. Critérios de Aceitação (DoD VOL07)

```
□ Modelo CommunicationLog na BD — todo email enviado gera registo
□ 8 templates migrados para EmailTemplate na BD (via seed)
□ Template interpolation funcional: {{variavel}} substituída correctamente
□ Admin consegue editar subject e htmlBody de qualquer template sem deploy
□ Pré-visualização de template funciona com dados de exemplo
□ /admin/comunicacao exibe histórico paginado com filtros
□ Re-envio manual de comunicações FAILED funciona
□ Badge de falhas visível no Dashboard (se > 0 falhas nas últimas 24h)
□ WhatsApp: se WHATSAPP_API_URL configurado, envia via API; senão, gera deep-link
□ CommunicationLog regista type=WHATSAPP_DEEPLINK quando usa fallback
□ /api/cron/communication-daily consolida alertas de expiração + pagamentos + reservas D-1
□ Testes: template-interpolator ≥ 10 assertions; communication-service ≥ 8 assertions
□ tsc --noEmit sem erros nos ficheiros novos
□ Quality Gate 1 e 2 passam
□ ADR-037 criado; CLAUDE.md e docs/README.md actualizados
```

---

## 13. Riscos e Mitigações

| Risco | Probabilidade | Mitigação |
|---|---|---|
| Templates HTML editáveis com XSS | Média | Sanitização com `isomorphic-dompurify` antes de render e antes de envio |
| Z-API WhatsApp não disponível em Luanda / instável | Média | Fallback automático para deep-link; graceful degradation documentada |
| Migração de email.ts quebra envios existentes | Baixa | Manter assinaturas das funções existentes; wrapping interno transparente |
| Seed de templates falha se já existirem registos | Baixa | `upsert` por slug em vez de `create` no seed |
| CommunicationLog cresce rapidamente em disco | Baixa | Índice em `createdAt`; cron de limpeza de logs > 180 dias (VOL07-4 bónus) |

---

## 14. Estado Final — DoD Checklist

| Critério | Estado |
|---|---|
| Schema Prisma: CommunicationLog + EmailTemplate | ✅ |
| Seed: 8 EmailTemplate (upsert idempotente) | ✅ |
| `template-interpolator.ts` (funções puras, testado) | ✅ |
| `communication-service.ts` (orquestrador central) | ✅ |
| `whatsapp-service.ts` (Z-API + deep-link) | ✅ |
| `email.ts` — logging fire-and-forget em 4 funções | ✅ |
| `erp-email-service.ts` — logging fire-and-forget em 4 funções | ✅ |
| API Routes: email-templates (GET list, GET slug, PATCH, POST preview) | ✅ |
| API Routes: communication (GET list, GET detail, POST retry) | ✅ |
| Cron: communication-daily (retry automático de emails FAILED) | ✅ |
| UI: /admin/comunicacao (histórico com filtros + retry manual) | ✅ |
| UI: /admin/configuracoes/email-templates (editor + pré-visualização) | ✅ |
| Sidebar: grupo "Comunicação" + 2 links | ✅ |
| Testes unitários: template-interpolator (17 assertions) | ✅ |
| Testes unitários: communication-service + whatsapp-service (8+ assertions) | ✅ |
| ADR-037 criado e indexado | ✅ |
| CLAUDE.md, docs/README.md actualizados | ✅ |
| Zero regressões nas funções de email existentes | ✅ |

---

## 15. Entregáveis VOL07

| Ficheiro | Tipo |
|---|---|
| `prisma/schema.prisma` | Schema: +2 modelos, +2 enums |
| `prisma/seed.js` | Seed: +8 EmailTemplate |
| `src/lib/template-interpolator.ts` | Novo serviço |
| `src/lib/communication-service.ts` | Novo serviço |
| `src/lib/whatsapp-service.ts` | Novo serviço |
| `src/lib/email.ts` | Editado: +logging |
| `src/lib/erp-email-service.ts` | Editado: +logging |
| `src/app/api/admin/email-templates/route.ts` | Nova route |
| `src/app/api/admin/email-templates/[slug]/route.ts` | Nova route |
| `src/app/api/admin/email-templates/[slug]/preview/route.ts` | Nova route |
| `src/app/api/communication/route.ts` | Nova route |
| `src/app/api/communication/[id]/route.ts` | Nova route |
| `src/app/api/communication/[id]/retry/route.ts` | Nova route |
| `src/app/api/cron/communication-daily/route.ts` | Nova route |
| `src/app/admin/comunicacao/page.tsx` | Nova página |
| `src/app/admin/configuracoes/email-templates/page.tsx` | Nova página |
| `src/components/admin/Sidebar.tsx` | Editado: +grupo Comunicação |
| `src/__tests__/unit/template-interpolator.test.ts` | Novos testes |
| `src/__tests__/unit/communication-service.test.ts` | Novos testes |
| `docs/adr/ADR-037-communication-architecture.md` | Novo ADR |

---

*VD Platform — Volume 07 — ✅ CONCLUÍDO — 30 Julho 2026*
