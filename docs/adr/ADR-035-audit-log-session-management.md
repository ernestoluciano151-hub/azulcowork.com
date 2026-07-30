# ADR-035 — Audit Log e Session Management (VOL05)

**Data:** 29 Julho 2026  
**Estado:** APROVADO  
**Autores:** Equipa VOL05 (multi-agent review)  
**Impacto:** Alto — segurança, rastreabilidade, disponibilidade

---

## Contexto

O VD Platform carecia de rastreabilidade de operações críticas e de controlo de sessões com revogação individual. O Volume 05 introduz:

1. **AuditLog** — registo imutável de todas as operações de segurança, financeiras e de reservas
2. **AdminSession** — rastreamento de sessões com revogação sem rotação de JWT_SECRET

---

## Decisão 1: Post-Commit Audit (extensão de ADR-033)

### Decisão
`recordAudit()` é sempre chamado **após** o commit da operação principal, fora de qualquer `$transaction`. O caller DEVE encadear `.catch()`.

### Justificação
- Uma falha no registo de auditoria não deve bloquear a operação de negócio
- Consistente com o padrão já estabelecido em ADR-033 (`recordFinancialHistory`)
- Em caso de falha, o erro é registado via `console.error` e capturado pelo Sentry (DT-009)

### Alternativa rejeitada
Incluir `recordAudit` dentro da `$transaction` — rejeitado porque introduziria rollbacks de operações já concluídas por falhas de auditoria (efeito indesejado)

### Padrão canónico
```typescript
recordAudit({ actor, action: "PAYMENT_CREATED", entity: "Payment", entityId: p.id, ... })
  .catch(err => console.error("[Audit] PAYMENT_CREATED:", err));
```

---

## Decisão 2: Sanitização em dupla defesa

### Decisão
Campos sensíveis (`passwordHash`, `totpSecret`, `tokenHash`, `token`, `password`, `secret`, `refreshToken`) são removidos de `before`/`after`:

1. **Pelo caller** — usando `sanitizeForAudit()` exportada, ao construir os campos
2. **Internamente** — `recordAudit()` aplica `sanitizeForAudit()` como última linha de defesa

### Justificação
- Dupla defesa impede vazamento mesmo quando o caller esquece de sanitizar
- `sanitizeForAudit()` é exportada para uso explícito, tornando a intenção visível no código do caller

---

## Decisão 3: AdminSession — revogação sem rotação de JWT_SECRET

### Decisão
Cada sessão JWT é rastreada numa linha `AdminSession` na BD com `tokenHash = SHA-256(JWT)`. O `getSession()` verifica `isRevoked` e `expiresAt` antes de aceitar a sessão.

### Justificação
- Permite revogar sessões individuais sem invalidar todas as sessões simultâneas
- SHA-256 do JWT nunca expõe o token original se a BD for comprometida
- TTL de 12 horas limita a janela de risco

### Trade-off aceite (risco documentado)
- **Middleware Edge Runtime** não pode usar Prisma → middleware faz apenas verificação JWT (primeira linha de defesa). A verificação de revogação ocorre em `getSession()` nas API Routes.
- Uma sessão revogada ainda acede a **páginas** (sem dados) até o JWT expirar (max 12h). Todas as **mutações de dados** são protegidas via API Routes.
- Os JWTs actuais não têm `jti` (JWT ID) → correlação 1:1 JWT↔AdminSession usa tokenHash. Quando VOL05-2 for completado, jti pode ser adicionado para correlação mais explícita.

---

## Decisão 4: Política de retenção do AuditLog

### Decisão
- **Retenção activa:** 365 dias no schema principal
- **Arquivo:** trimestral, para tabela de arquivo (a implementar em VOL05-4 cron)
- **Eliminação:** nunca (potencial requisito legal em Angola)

### Justificação
- Requisitos de compliance angolano não estão completamente mapeados — errar para o lado da conservação
- Cron de arquivo em VOL05-4 move registos antigos para tabela `AuditLogArchive` (schema futuro)

---

## Modelos introduzidos

```
AuditLog      — registo imutável; sem FK para AdminUser (email denormalizado)
AdminSession  — rastreamento de sessões com isRevoked e expiresAt
AuditAction   — enum com 29 valores de acções auditáveis
```

---

## Ficheiros afectados

```
prisma/schema.prisma          — AuditAction enum + AuditLog + AdminSession
src/lib/audit-service.ts      — NEW: sanitizeForAudit, recordAudit, SYSTEM_ACTOR, UNKNOWN_ACTOR
src/lib/auth.ts               — createSession, destroySession, getSession actualizados
src/app/api/auth/login/       — LOGIN_SUCCESS, LOGIN_FAILED auditados
src/app/api/payments/         — PAYMENT_CREATED auditado
src/app/api/admin/users/      — ADMIN_USER_CREATED, UPDATED, DELETED auditados
src/app/api/reservations/     — RESERVATION_CREATED, STATUS_CHANGED auditados
src/app/api/admin/sessions/   — NEW: GET list + DELETE revoke
src/app/api/admin/audit/      — NEW: GET com filtros + paginação
src/app/admin/auditoria/      — NEW: UI de auditoria
src/app/admin/settings/       — PATCH: fix role USER→VIEWER + Sessions tab
```

---

## Testes

```
src/__tests__/unit/audit-service.test.ts  — 11 casos (sanitize, actors, recordAudit)
src/__tests__/unit/admin-sessions.test.ts — 9 casos (createSession, destroySession, getSession)
```

---

*ADR-035 — VD Platform — VOL05 Security & Audit — 29 Jul 2026*
