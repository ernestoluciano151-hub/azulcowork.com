# Volume 05 — Segurança: Auditoria, Sessões e Admin UI

> **Documento:** VOL05-SPEC-001  
> **Estado:** ✅ CONCLUÍDO — Sprint VOL05-4 (29 Jul 2026)  
> **Data de Conclusão:** 29 Julho 2026  
> **Arquiteto-Chefe:** Claude  
> **Pasta:** `docs/08-seguranca/`  
> **Volume anterior:** VOL04 — Reservas (✅ CONCLUÍDO — 29 Jul 2026)

---

## 0. Entregáveis Concluídos (29 Jul 2026)

| Entregável | Sprint | Estado |
|---|---|---|
| `AuditLog` model + `AuditAction` enum (29 valores) no schema Prisma | VOL05-1 | ✅ |
| `src/lib/audit-service.ts` — `sanitizeForAudit`, `recordAudit`, `SYSTEM_ACTOR`, `UNKNOWN_ACTOR` | VOL05-1 | ✅ |
| Audit em login (LOGIN_SUCCESS / LOGIN_FAILED / LOGOUT) | VOL05-1 | ✅ |
| Audit em pagamentos (PAYMENT_CREATED) | VOL05-1 | ✅ |
| Audit em utilizadores admin (CREATED / UPDATED / DEACTIVATED / REACTIVATED / PASSWORD_CHANGED / DELETED) | VOL05-1 | ✅ |
| Audit em reservas (RESERVATION_CREATED / STATUS_CHANGED / UPDATED) | VOL05-1 | ✅ |
| `AdminSession` model — rastreamento com `tokenHash` SHA-256 + revogação | VOL05-2 | ✅ |
| `createSession` / `destroySession` / `getSession` — integração BD | VOL05-2 | ✅ |
| `GET /api/admin/sessions` + `DELETE /api/admin/sessions/[id]` | VOL05-2 | ✅ |
| `GET /api/admin/audit` — filtros + paginação | VOL05-3 | ✅ |
| `/admin/auditoria` — página UI de auditoria | VOL05-3 | ✅ |
| `/admin/settings` — fix `role: "USER"→"VIEWER"` + Sessions tab | VOL05-3 | ✅ |
| `audit-service.test.ts` — 11 casos de teste | VOL05-4 | ✅ |
| `admin-sessions.test.ts` — 9 casos de teste | VOL05-4 | ✅ |
| ADR-035 — Audit Log Post-Commit + AdminSession | VOL05-4 | ✅ |

---

## 1. Contexto e Motivação

### O que a Fase P0 entregou (já feito)

A Fase P0 estabeleceu a base de segurança da plataforma:

| Entregável | Sprint | Estado |
|---|---|---|
| JWT Secret obrigatório no arranque | P0-A | ✅ |
| `requireSession` + `requireRole` — 130 rotas protegidas | P0-A | ✅ |
| Enum `AdminRole` (ADMIN/COMERCIAL/FINANCEIRO/VIEWER) | P0-A | ✅ |
| TOTP 2FA — backend completo (login + setup endpoints) | P0-D | ✅ |
| Rate limiting em operações críticas | P0-D | ✅ |
| TypeScript strict, sem `ignoreBuildErrors` | P0-D | ✅ |

### O que falta (âmbito deste volume)

O que **não** foi feito e é necessário para operar a plataforma com segurança em produção:

| Gap | Impacto |
|---|---|
| **Sem Audit Log** — nenhum registo de quem fez o quê | GDPR, conformidade financeira, disputas |
| **Sem rastreamento de sessões admin** — não é possível ver/revogar sessões activas | Conta comprometida = sem forma de reagir |
| **TOTP sem UI** — backend pronto desde P0-D, mas o admin não consegue activar 2FA | Feature inacessível na prática |
| **Settings page com `role: "USER"`** — enum `AdminRole` existe mas a UI não foi actualizada | Utilizadores criados com role inválido |

---

## 2. Objectivos do Volume 05

| # | Objectivo | Critério de Sucesso |
|---|---|---|
| O1 | Audit Log completo e pesquisável | Toda operação financeira e de gestão de utilizadores registada |
| O2 | Admin Session Management | Admin consegue ver e revogar sessões activas |
| O3 | TOTP 2FA acessível via UI | Admin activa/desactiva 2FA em `/admin/settings` |
| O4 | Admin User Management hardened | Roles correctos na UI; criação/edição/desactivação funcionais |

---

## 3. Âmbito

### ✅ Incluído

- Modelo `AuditLog` no schema Prisma
- `audit-service.ts` — helper `recordAudit()` para registar acções
- Aplicação do Audit Log nas operações críticas: pagamentos, faturas, gestão de utilizadores, status de reservas, alterações de preçário
- Modelo `AdminSession` no schema Prisma (rastreamento de sessões activas)
- API de sessões: `GET /api/admin/sessions`, `DELETE /api/admin/sessions/[id]`
- Actualização do login flow para registar sessão
- UI: secção de sessões activas em `/admin/settings`
- UI: setup TOTP em `/admin/settings` (usa endpoints P0-D existentes)
- UI: correcção do selector de roles (ADMIN/COMERCIAL/FINANCEIRO/VIEWER)
- Testes unitários do `audit-service.ts`
- Documentação completa

### ❌ Não incluído

- API pública / webhooks (Vol 08)
- Dashboard BI avançado (Vol 06)
- Auditoria do lado do Portal do Cliente (VOL03 já tem TimelineEntry)
- Compliance GDPR formal (futuro)
- Alertas Sentry por eventos de segurança (configuração Sentry — após `npm install`)

---

## 4. Modelo de Domínio

### 4.1 AuditLog

```prisma
model AuditLog {
  id         String   @id @default(cuid())
  actorId    String                        // AdminUser.id ou "SYSTEM"
  actorRole  String                        // AdminRole ou "SYSTEM"
  actorEmail String                        // denormalizado — histórico permanece mesmo se user apagado
  action     AuditAction
  entity     String                        // "Reservation" | "Payment" | "Invoice" | "AdminUser" | ...
  entityId   String
  entityRef  String?                       // referência legível: número da reserva, fatura, etc.
  before     Json?                         // estado anterior (campos relevantes)
  after      Json?                         // estado posterior
  ipAddress  String?
  userAgent  String?
  metadata   Json?                         // contexto adicional livre
  createdAt  DateTime @default(now())

  @@index([actorId])
  @@index([entity, entityId])
  @@index([action])
  @@index([createdAt])
}

enum AuditAction {
  // Financeiro
  PAYMENT_CREATED
  PAYMENT_CONFIRMED
  PAYMENT_CANCELLED
  INVOICE_CREATED
  INVOICE_SENT
  INVOICE_CANCELLED
  // Reservas
  RESERVATION_CREATED
  RESERVATION_STATUS_CHANGED
  RESERVATION_CANCELLED
  // Utilizadores admin
  ADMIN_USER_CREATED
  ADMIN_USER_UPDATED
  ADMIN_USER_DEACTIVATED
  ADMIN_USER_REACTIVATED
  // Auth
  ADMIN_LOGIN_SUCCESS
  ADMIN_LOGIN_FAILED
  ADMIN_2FA_ENABLED
  ADMIN_2FA_DISABLED
  ADMIN_SESSION_REVOKED
  // Configurações
  ROOM_SETTINGS_UPDATED
  PRICING_UPDATED
  PLAN_CREATED
  PLAN_UPDATED
  PLAN_DELETED
}
```

### 4.2 AdminSession

```prisma
model AdminSession {
  id           String    @id @default(cuid())
  adminUserId  String
  tokenHash    String    @unique                // SHA-256 do JWT de sessão
  ipAddress    String?
  userAgent    String?
  lastActiveAt DateTime  @default(now())
  expiresAt    DateTime
  isRevoked    Boolean   @default(false)
  createdAt    DateTime  @default(now())

  adminUser    AdminUser @relation(fields: [adminUserId], references: [id])

  @@index([adminUserId])
  @@index([tokenHash])
}
```

### 4.3 Alterações a AdminUser

```prisma
model AdminUser {
  // ... campos existentes ...
  lastLoginAt  DateTime?
  lastLoginIp  String?
  sessions     AdminSession[]
}
```

---

## 5. Sprints

### VOL05-1 — Audit Log Foundation

**Duração:** 2 dias  
**Ficheiros afectados:**
- `prisma/schema.prisma` — novos models + enum `AuditAction`
- `prisma/migrations/` — migration `add_audit_log`
- `src/lib/audit-service.ts` — novo
- `src/app/api/erp/payments/route.ts` — adicionar `recordAudit`
- `src/app/api/erp/invoices/route.ts` — adicionar `recordAudit`
- `src/app/api/reservations/route.ts` — adicionar `recordAudit`
- `src/app/api/reservations/[id]/route.ts` — adicionar `recordAudit`
- `src/app/api/admin/users/route.ts` — adicionar `recordAudit`
- `src/app/api/admin/users/[id]/route.ts` — adicionar `recordAudit`
- `src/app/api/admin/room-settings/route.ts` — adicionar `recordAudit`
- `src/app/api/plans/route.ts` — adicionar `recordAudit`

**Interface do helper:**
```typescript
// src/lib/audit-service.ts
export async function recordAudit(
  prismaClient: PrismaClient | Prisma.TransactionClient,
  params: {
    actorId:    string;           // AdminUser.id ou "SYSTEM"
    actorRole:  string;
    actorEmail: string;
    action:     AuditAction;
    entity:     string;
    entityId:   string;
    entityRef?: string;
    before?:    Record<string, unknown>;
    after?:     Record<string, unknown>;
    ipAddress?: string;
    metadata?:  Record<string, unknown>;
  }
): Promise<void>
```

**Regra:** `recordAudit` é SEMPRE chamado FORA de `$transaction` e com `.catch(console.error)` — falha no audit nunca bloqueia a operação principal (mesma semântica que `recordFinancialHistory`, ADR-033).

**Critérios de aceitação:**
```
□ Migration criada e aplicada em dev
□ `recordAudit` testada em isolamento (unit tests)
□ Todos os pontos de aplicação listados acima registam audit event
□ `recordAudit` nunca lança excepção que bloqueie operação principal
□ Índices em [actorId], [entity+entityId], [createdAt]
```

---

### VOL05-2 — Admin Session Management

**Duração:** 2 dias  
**Ficheiros afectados:**
- `prisma/schema.prisma` — `AdminSession` + campos em `AdminUser`
- `prisma/migrations/` — migration `add_admin_sessions`
- `src/lib/auth.ts` — actualizar `createSession` e `getSession` para usar `AdminSession`
- `src/app/api/auth/login/route.ts` — registar sessão + `lastLoginAt/Ip`
- `src/app/api/admin/sessions/route.ts` — novo: `GET` (listar sessões activas do actor)
- `src/app/api/admin/sessions/[id]/route.ts` — novo: `DELETE` (revogar sessão)
- `src/app/api/auth/logout/route.ts` — marcar `AdminSession.isRevoked = true`

**Fluxo:**
```
Login bem-sucedido:
  → Criar AdminSession (tokenHash = SHA-256 do JWT, expiresAt = agora + 8h)
  → Actualizar AdminUser.lastLoginAt + lastLoginIp

GET /api/admin/sessions:
  → ADMIN only
  → Retorna sessões activas do próprio utilizador (is_revoked=false, expiresAt > now)

DELETE /api/admin/sessions/[id]:
  → ADMIN only
  → Marca sessão como revogada
  → Regista AuditAction.ADMIN_SESSION_REVOKED

Middleware (src/middleware.ts):
  → Verificar que AdminSession não está revogada (check adicional ao JWT)
```

**Critérios de aceitação:**
```
□ Cada login cria uma AdminSession
□ `GET /api/admin/sessions` retorna apenas sessões do próprio admin
□ `DELETE /api/admin/sessions/[id]` invalida o token imediatamente
□ Middleware rejeita tokens cujas sessões estejam revogadas
□ Logout marca sessão como revogada
□ Testes unitários: criar sessão, revogar, verificar middleware
```

---

### VOL05-3 — Admin UI Hardening

**Duração:** 2 dias  
**Ficheiros afectados:**
- `src/app/admin/settings/page.tsx` — correcções + novos tabs
- `src/app/admin/auditoria/page.tsx` — novo: audit log viewer
- `src/app/api/admin/audit/route.ts` — novo: `GET` com filtros + paginação

**Correcções na settings page:**
```typescript
// ANTES (incorrecto):
const [addForm, setAddForm] = useState({ ..., role: "USER" });

// DEPOIS (correcto):
const [addForm, setAddForm] = useState({ ..., role: "VIEWER" });

// Selector de roles actualizado:
const ROLES = ["ADMIN", "COMERCIAL", "FINANCEIRO", "VIEWER"] as const;
```

**Novas funcionalidades na settings page:**
- Tab "Sessões Activas" — lista de `AdminSession` com IP, data, botão de revogar
- Tab "Segurança 2FA" — estado actual do TOTP, QR code para activação, botão de desactivar
  - Usa endpoints existentes: `GET /api/admin/totp/setup`, `POST /api/admin/totp/setup`, `DELETE /api/admin/totp/setup`

**Nova página `/admin/auditoria`:**
- Tabela paginada de eventos do `AuditLog`
- Filtros: acção, entidade, actor, data (de/até)
- Detalhe expandível: campos `before`/`after`
- Restrita a `ADMIN` (via RBAC)

**API `/api/admin/audit`:**
```typescript
// GET /api/admin/audit?action=PAYMENT_CREATED&entity=Payment&from=2026-07-01&page=1&limit=50
// Requer: ADMIN
// Resposta: { data: AuditLog[], total: number, page: number, totalPages: number }
```

**Critérios de aceitação:**
```
□ Settings page: role selector mostra ADMIN/COMERCIAL/FINANCEIRO/VIEWER
□ Settings page: tab de sessões activas mostra e permite revogar
□ Settings page: tab 2FA permite activar/desactivar TOTP
□ /admin/auditoria: lista paginada com filtros funcionais
□ VIEWER não consegue aceder a /admin/auditoria (403)
□ AuditLog mostra before/after em detalhe
```

---

### VOL05-4 — Testes + Documentação + DoD

**Duração:** 1 dia  
**Ficheiros:**
- `src/__tests__/unit/audit-service.test.ts` — testes do helper
- `src/__tests__/unit/admin-sessions.test.ts` — testes de criação/revogação
- `docs/08-seguranca/api.md`
- `docs/08-seguranca/data-model.md`
- `docs/08-seguranca/audit-events.md` — catálogo completo de eventos de auditoria
- `docs/adr/ADR-035-audit-log-post-commit.md` — mesmo padrão de ADR-033
- `docs/adr/README.md` — actualizar índice
- `CLAUDE.md` — Volume 05 estado
- `docs/README.md` — Volume 05 estado

---

## 6. Definition of Done (DoD)

```
SCHEMA E BACKEND:
□ Migration add_audit_log aplicada sem erros
□ Migration add_admin_sessions aplicada sem erros
□ recordAudit() cobre: pagamentos, faturas, reservas, utilizadores, configurações
□ recordAudit() nunca bloqueia operação principal (.catch obrigatório)
□ AdminSession criada em cada login; revogada em logout
□ Middleware rejeita sessões revogadas

FRONTEND:
□ Settings page: role selector com valores correctos (ADMIN/COMERCIAL/FINANCEIRO/VIEWER)
□ Settings page: tab Sessões Activas funcional
□ Settings page: tab 2FA (TOTP setup) funcional
□ /admin/auditoria: listagem paginada + filtros
□ /admin/auditoria: restrita a ADMIN

QUALIDADE:
□ npm test — zero falhas (incluindo novos testes VOL05)
□ tsc --noEmit — zero erros em ficheiros VOL05
□ Audit events valiadados com node -e ou testes unitários

DOCUMENTAÇÃO:
□ docs/08-seguranca/README.md → ✅ CONCLUÍDO
□ api.md, data-model.md, audit-events.md actualizados
□ ADR-035 criado e indexado
□ CLAUDE.md e docs/README.md actualizados
```

---

## 7. Estimativa e Sequência

```
VOL05-1: Audit Log Foundation          → 2 dias   (schema + helper + aplicação)
VOL05-2: Admin Session Management      → 2 dias   (schema + API + middleware)
VOL05-3: Admin UI Hardening            → 2 dias   (settings + auditoria page)
VOL05-4: Testes + Docs + DoD           → 1 dia    (testes + docs + fechar)
─────────────────────────────────────────────────
Total estimado:                           7 dias
```

---

## 8. Riscos e Mitigação

| Risco | Probabilidade | Impacto | Mitigação |
|---|---|---|---|
| Migration `add_admin_sessions` quebra login existente | Médio | Alto | Testar em dev com dados reais; `lastLoginAt/Ip` são nullable |
| Middleware check de sessão adiciona latência | Baixo | Médio | Query por `tokenHash` com índice único — < 1ms |
| Audit log cresce rapidamente em volume | Baixo | Baixo | Índice em `createdAt`; política de retenção (90 dias) via cron — Vol 06+ |
| Settings page TOTP UI conflito com form existente | Baixo | Baixo | Tab separado; sem alteração aos campos existentes |

---

## 9. Dependências

| Dependência | Estado |
|---|---|
| `prisma.$transaction()` pattern (ADR-033) | ✅ Estabelecido |
| Endpoints TOTP P0-D (`/api/admin/totp/setup`) | ✅ Existente |
| `requireRole(["ADMIN"])` helper | ✅ Existente |
| `AdminRole` enum no schema | ✅ Existente |

---

## 10. Próximo Passo

**Aguarda aprovação do Product Owner (Ernesto Pinto Luciano)** para iniciar VOL05-1.

Após aprovação, o Arquiteto-Chefe inicia a implementação pela sequência VOL05-1 → VOL05-2 → VOL05-3 → VOL05-4.

---

*VD Platform — VOL05-SPEC-001 — Julho 2026*  
*Estado: PROPOSTA — Não implementar sem aprovação formal do PO*
