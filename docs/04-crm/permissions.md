# CRM — Matriz de Permissões (RBAC)

> **Versão:** 1.0.0-draft  
> **Volume:** 01 — CRM  
> **Estado:** 📝 Em elaboração  
> **Dependências:** P0-A (RBAC implementado), [api.md](./api.md)

---

## 1. Roles Existentes

| Role | Descrição |
|---|---|
| `ADMIN` | Acesso total ao CRM e plataforma |
| `COMERCIAL` | Gestão do pipeline, leads, actividades |
| `FINANCEIRO` | Leitura do CRM (sem mutação) |
| `VIEWER` | Leitura apenas |

---

## 2. Matriz de Permissões

### Companies

| Acção | ADMIN | COMERCIAL | FINANCEIRO | VIEWER |
|---|:---:|:---:|:---:|:---:|
| Listar companies | ✅ | ✅ | ✅ | ✅ |
| Ver Customer 360° | ✅ | ✅ | ✅ | ✅ |
| Criar company | ✅ | ✅ | ❌ | ❌ |
| Editar company | ✅ | ✅ próprias | ❌ | ❌ |
| Eliminar company (soft) | ✅ | ❌ | ❌ | ❌ |
| Merge companies | ✅ | ❌ | ❌ | ❌ |
| Alterar assignedTo | ✅ | ❌ | ❌ | ❌ |

> "próprias" = companies onde `assignedToId === session.userId`

### Contacts

| Acção | ADMIN | COMERCIAL | FINANCEIRO | VIEWER |
|---|:---:|:---:|:---:|:---:|
| Ver contacts | ✅ | ✅ | ✅ | ✅ |
| Criar contact | ✅ | ✅ | ❌ | ❌ |
| Editar contact | ✅ | ✅ | ❌ | ❌ |
| Eliminar contact | ✅ | ✅ | ❌ | ❌ |
| Definir primary | ✅ | ✅ | ❌ | ❌ |

### Deals / Pipeline

| Acção | ADMIN | COMERCIAL | FINANCEIRO | VIEWER |
|---|:---:|:---:|:---:|:---:|
| Ver pipeline | ✅ | ✅ | ✅ | ✅ |
| Criar deal | ✅ | ✅ | ❌ | ❌ |
| Editar deal | ✅ | ✅ próprios | ❌ | ❌ |
| Marcar WON | ✅ | ✅ | ❌ | ❌ |
| Marcar LOST | ✅ | ✅ | ❌ | ❌ |
| Aprovar desconto > 10% | ✅ | ❌ | ❌ | ❌ |

### Activities

| Acção | ADMIN | COMERCIAL | FINANCEIRO | VIEWER |
|---|:---:|:---:|:---:|:---:|
| Ver activities | ✅ | ✅ | ✅ | ✅ |
| Registar activity | ✅ | ✅ | ❌ | ❌ |
| Editar activity | ✅ | ✅ próprias | ❌ | ❌ |

### Tasks

| Acção | ADMIN | COMERCIAL | FINANCEIRO | VIEWER |
|---|:---:|:---:|:---:|:---:|
| Ver tasks | ✅ | ✅ próprias | ❌ | ❌ |
| Ver todas as tasks | ✅ | ❌ | ❌ | ❌ |
| Criar task | ✅ | ✅ | ❌ | ❌ |
| Concluir task | ✅ | ✅ próprias | ❌ | ❌ |
| Reatribuir task | ✅ | ❌ | ❌ | ❌ |

### Notes

| Acção | ADMIN | COMERCIAL | FINANCEIRO | VIEWER |
|---|:---:|:---:|:---:|:---:|
| Ver notes | ✅ | ✅ | ✅ | ✅ |
| Criar note | ✅ | ✅ | ❌ | ❌ |
| Editar note | ✅ | ✅ próprias | ❌ | ❌ |
| Eliminar note | ✅ | ✅ próprias | ❌ | ❌ |

### Tags

| Acção | ADMIN | COMERCIAL | FINANCEIRO | VIEWER |
|---|:---:|:---:|:---:|:---:|
| Ver tags | ✅ | ✅ | ✅ | ✅ |
| Criar tag | ✅ | ✅ | ❌ | ❌ |
| Associar/remover tag | ✅ | ✅ | ❌ | ❌ |
| Eliminar tag global | ✅ | ❌ | ❌ | ❌ |

### Dashboard e Reports

| Acção | ADMIN | COMERCIAL | FINANCEIRO | VIEWER |
|---|:---:|:---:|:---:|:---:|
| Ver dashboard CRM | ✅ | ✅ | ✅ | ✅ |
| Exportar dados (CSV) | ✅ | ✅ | ✅ | ❌ |
| Ver AuditLog | ✅ | ❌ | ❌ | ❌ |

---

## 3. Implementação

Os checks de permissão são implementados via helper `requireRole()` (P0-A):

```typescript
// src/app/api/crm/companies/route.ts

export async function POST(req: NextRequest) {
  const session = await requireSession(req);
  requireRole(session, ["ADMIN", "COMERCIAL"]);  // lança 403 se falhar
  
  const body = await req.json();
  // ... lógica de negócio
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await requireSession(req);
  requireRole(session, ["ADMIN"]);  // só ADMIN pode eliminar
  // ...
}
```

---

## 4. Restrições de Visibilidade de Dados (futuro L3)

Na versão actual (L2), todos os utilizadores `COMERCIAL` vêem todas as companies.  
No Nível L3, será implementado **row-level filtering**: cada COMERCIAL só verá as companies onde `assignedToId === session.userId`, excepto quando o ADMIN lhes conceder visibilidade alargada.

Esta decisão está documentada em **ADR-020**.

---

*VD Platform — CRM Permissions — v1.0.0-draft — 28 Julho 2026*  
*© 2026 VERSÃO DE NEGÓCIOS - COMÉRCIO GERAL E PRESTAÇÃO DE SERVIÇOS, LDA. Confidencial.*
