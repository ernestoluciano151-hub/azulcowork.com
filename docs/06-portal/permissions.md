# Permissões do Portal — Volume 03

> **Volume:** 03 — Portal do Cliente  
> **Estado:** 📋 Especificação — aguarda aprovação PO  
> **ADR relacionado:** ADR-026 (Auth do Portal)

---

## 1. Filosofia RBAC do Portal

O sistema de permissões do portal é **completamente separado** do RBAC do painel admin.

- **Admin RBAC:** `AdminRole` (ADMIN | COMERCIAL | FINANCEIRO | VIEWER) — acesso ao painel interno
- **Portal RBAC:** `PortalRole` (PORTAL_OWNER | PORTAL_ADMIN | PORTAL_MEMBER | PORTAL_VIEWER) — acesso ao portal do cliente

Um `AdminUser` **nunca** usa o portal de cliente. Um `PortalUser` **nunca** acede ao painel admin.

A regra fundamental é o **isolamento por empresa**: toda query no portal inclui obrigatoriamente
`WHERE companyId = portalUser.companyId`. Esta condição é verificada na camada de serviço,
não apenas na camada de apresentação.

---

## 2. Roles do Portal

### PORTAL_OWNER (Proprietário)

Atribuído pelo admin ao activar o portal para uma empresa. Geralmente o CEO ou gestor principal.

**Características:**
- Único role que pode ser criado directamente pelo admin
- Pode gerir todos os utilizadores do portal da sua empresa
- Acesso total a todos os módulos do portal
- Recebe todos os alertas automáticos por omissão
- Máximo de 1 PORTAL_OWNER por empresa (pode ser transferido)

### PORTAL_ADMIN (Administrador)

Criado pelo PORTAL_OWNER para delegar gestão operacional.

**Características:**
- Pode criar/desactivar PORTAL_MEMBER e PORTAL_VIEWER
- Acesso total excepto gestão de conta e transferência de ownership
- Pode configurar preferências de notificação da empresa
- Máximo de 3 PORTAL_ADMIN por empresa

### PORTAL_MEMBER (Membro)

Colaborador da empresa com acesso operacional limitado.

**Características:**
- Pode ver contratos, faturas, pagamentos, reservas e documentos
- Pode criar reservas de sala
- Pode abrir e responder a tickets de suporte
- Não pode gerir utilizadores nem configurar notificações
- Sem limite de PORTAL_MEMBER por empresa

### PORTAL_VIEWER (Observador)

Acesso somente leitura. Adequado para contabilistas externos ou parceiros.

**Características:**
- Só pode consultar dados (sem criar/editar)
- Pode fazer download de faturas e recibos
- Não pode reservar salas nem abrir tickets
- Não pode ver dados de suporte
- Sem limite de PORTAL_VIEWER por empresa

---

## 3. Matrix de Acesso

| Módulo / Acção | PORTAL_OWNER | PORTAL_ADMIN | PORTAL_MEMBER | PORTAL_VIEWER |
|---|:---:|:---:|:---:|:---:|
| **Dashboard** | ✅ | ✅ | ✅ | ✅ |
| **Perfil da empresa** — ver | ✅ | ✅ | ✅ | ✅ |
| **Perfil da empresa** — editar | ✅ | ✅ | ❌ | ❌ |
| **Utilizadores** — ver lista | ✅ | ✅ | ❌ | ❌ |
| **Utilizadores** — criar/desactivar | ✅ | ✅¹ | ❌ | ❌ |
| **Utilizadores** — transferir ownership | ✅ | ❌ | ❌ | ❌ |
| **Contratos** — ver | ✅ | ✅ | ✅ | ✅ |
| **Faturas** — ver lista | ✅ | ✅ | ✅ | ✅ |
| **Faturas** — download PDF | ✅ | ✅ | ✅ | ✅ |
| **Pagamentos** — ver lista | ✅ | ✅ | ✅ | ✅ |
| **Pagamentos** — download recibo | ✅ | ✅ | ✅ | ✅ |
| **Reservas** — ver | ✅ | ✅ | ✅ | ✅ |
| **Reservas** — criar/cancelar | ✅ | ✅ | ✅ | ❌ |
| **Documentos** — ver lista | ✅ | ✅ | ✅ | ✅ |
| **Documentos** — download | ✅ | ✅ | ✅ | ✅ |
| **Documentos** — upload | ✅ | ✅ | ❌ | ❌ |
| **Notificações** — ver as próprias | ✅ | ✅ | ✅ | ✅ |
| **Notificações** — configurar empresa | ✅ | ✅ | ❌ | ❌ |
| **Suporte** — ver tickets da empresa | ✅ | ✅ | ✅ | ❌ |
| **Suporte** — criar ticket | ✅ | ✅ | ✅ | ❌ |
| **Suporte** — responder | ✅ | ✅ | ✅ | ❌ |

¹ PORTAL_ADMIN não pode criar outro PORTAL_ADMIN nem promover a PORTAL_OWNER.

---

## 4. Implementação Técnica

### 4.1 Middleware do Portal

```typescript
// src/middleware.ts — rota do portal
// Toda a rota /portal/* requer cookie `portal-session` válido
// Toda a rota /api/portal/* requer cookie `portal-session` válido

// Separação clara:
// /admin/* + /api/admin/* → middleware admin (AdminRole)
// /portal/* + /api/portal/* → middleware portal (PortalRole)
```

### 4.2 Helper requirePortalRole

```typescript
// src/lib/portal-auth.ts
export async function requirePortalSession(): Promise<{
  portalUser: PortalUser;
  company: Company;
} | { error: Response }>

export async function requirePortalRole(
  ...roles: PortalRole[]
): Promise<{
  portalUser: PortalUser;
  company: Company;
} | { error: Response }>

// Uso em route handler:
const result = await requirePortalRole(PortalRole.PORTAL_OWNER, PortalRole.PORTAL_ADMIN);
if ("error" in result) return result.error;
const { portalUser, company } = result;

// CRÍTICO: todas as queries subsequentes devem incluir:
// WHERE companyId = company.id
```

### 4.3 Verificação de Isolamento

Cada service do portal deve verificar o isolamento:

```typescript
// src/lib/portal-invoice-service.ts
export async function getPortalInvoices(companyId: string) {
  return prisma.erpInvoice.findMany({
    where: {
      companyId,  // ← OBRIGATÓRIO — nunca omitir
      status: { not: ErpInvoiceStatus.VOID },
    },
    orderBy: { issueDate: "desc" },
  });
}
// Se companyId for omitido → vulnerabilidade de acesso cruzado
```

### 4.4 Enum PortalRole (Prisma)

```prisma
enum PortalRole {
  PORTAL_OWNER
  PORTAL_ADMIN
  PORTAL_MEMBER
  PORTAL_VIEWER
}
```

---

## 5. Ciclo de Vida de um PortalUser

```
1. Admin activa portal para empresa → cria PortalUser com role PORTAL_OWNER
2. PORTAL_OWNER recebe email de boas-vindas com magic link (ou credenciais)
3. PORTAL_OWNER faz primeiro login → confirma dados da empresa
4. PORTAL_OWNER pode criar utilizadores adicionais (PORTAL_ADMIN, PORTAL_MEMBER, PORTAL_VIEWER)
5. Cada utilizador criado recebe email de convite
6. Utilizador confirmado → activo → pode fazer login

DESACTIVAÇÃO:
  PORTAL_OWNER desactiva utilizador → PortalUser.isActive = false → sessões revogadas
  Se empresa termina contrato → admin desactiva TODOS os PortalUsers da empresa
```

---

## 6. Regras de Segurança Adicionais

```
SEC-PORT-001 — Token de sessão portal: JWT HS256, expiração 8h, renovável (refresh token 30d)
SEC-PORT-002 — Magic link: token criptograficamente aleatório (32 bytes), TTL 15 min, uso único
SEC-PORT-003 — Máximo de 5 tentativas de login falhadas → bloqueio temporário de 15 min
SEC-PORT-004 — Sessões concorrentes: máximo de 3 sessões activas por PortalUser
SEC-PORT-005 — Toda acção de gestão de utilizadores gera AuditLog com actorId + targetUserId
SEC-PORT-006 — Revogação em massa: empresa suspensa → todas as sessões portal invalidadas
SEC-PORT-007 — PORTAL_VIEWER não recebe notificações de acção (apenas informativos opcionais)
```

---

*VD Platform — Portal Permissions — Volume 03 — 29 Julho 2026*
