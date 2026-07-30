# Migração — Volume 03 — Portal do Cliente

> **Volume:** 03 — Portal do Cliente  
> **Estado:** 📋 Especificação — aguarda aprovação PO  
> **Migration name:** `portal-volume03`

---

## 1. O que muda no Schema

### Novos modelos (10)

```
PortalUser            — utilizador do portal
PortalSession         — sessões activas
PortalMagicLink       — tokens de magic link
PortalDocument        — documentos partilhados
PortalDocumentVersion — versões de documentos
PortalDocumentAccess  — auditoria de acessos
PortalNotification    — notificações com estado
OmnichannelMessage    — mensagens enviadas
PortalSupportTicket   — tickets de suporte
PortalSupportMessage  — mensagens nos tickets
```

### Novos enums (5)

```
PortalRole
NotificationStatus
OmnichannelType
SupportTicketStatus
PortalAlertType
```

### Alterações em modelos existentes

```
Company: adicionar relações PortalUser[], PortalDocument[], PortalSupportTicket[], OmnichannelMessage[]
DocumentCounter: adicionar entrada ST (Support Ticket)
```

---

## 2. Migration SQL (gerada pelo Prisma)

```bash
# Criar migration (não aplicar ainda)
npx prisma migrate dev --name portal-volume03 --create-only

# Verificar o SQL gerado
cat prisma/migrations/[timestamp]_portal-volume03/migration.sql

# Aplicar em staging primeiro
DATABASE_URL=$STAGING_URL npx prisma migrate deploy

# Após validação em staging, aplicar em produção
npx prisma migrate deploy
```

---

## 3. Seed de Dados Iniciais

Após a migration, executar seed com:

```typescript
// prisma/seed-portal.ts

// 1. Adicionar contador de suporte
await prisma.documentCounter.upsert({
  where: { prefix: "ST" },
  update: {},
  create: {
    prefix: "ST",
    year: new Date().getFullYear(),
    lastNumber: 0,
  },
});

// 2. Para cada empresa existente com contrato activo,
//    criar PortalUser PORTAL_OWNER se email estiver disponível
// (execução manual — requer decisão PO sobre quais empresas activar)
```

---

## 4. Plano de Activação Gradual

### Fase 1 — Activação Admin-Only (VOL03-1)

O portal está implementado mas não activado para nenhuma empresa.
O admin pode activar empresa por empresa via backoffice:

```
Admin Panel → Empresa → "Activar Portal do Cliente"
  → Cria PortalUser PORTAL_OWNER com email do contacto principal
  → Envia email de boas-vindas com magic link
  → Empresa aparece como "Portal Activo" no admin
```

### Fase 2 — Beta Interno (VOL03-11)

Activar para 3–5 empresas piloto seleccionadas pelo PO.
Recolher feedback durante 4 semanas.

### Fase 3 — Lançamento Geral

Após validação do beta, activar para todas as empresas com contrato activo.

---

## 5. Rollback da Migration

Se for necessário fazer rollback após aplicação:

```bash
# Reverter a última migration (só se nenhum dado novo foi inserido)
npx prisma migrate resolve --rolled-back portal-volume03

# Se dados já foram inseridos → NÃO fazer rollback de schema
# Em vez disso, criar migration de compensação
npx prisma migrate dev --name revert-portal-volume03
```

**Atenção:** A migration do portal apenas ADICIONA tabelas novas. Não altera tabelas existentes
(excepto adição de relações `@relation` que são virtuais no Prisma). O risco de rollback é baixo.

---

## 6. Checklist Pré-Migration Produção

```
□ Migration testada em ambiente de desenvolvimento (npx prisma migrate dev)
□ Migration testada em ambiente de staging
□ Backup da BD de produção feito (ver BACKUP-ROLLBACK.md)
□ Zero queries activas na BD durante a migration (janela de manutenção)
□ Seed de DocumentCounter executado
□ Verificação: npx prisma migrate status → "Database schema is up to date"
□ Smoke test: criar PortalUser de teste → fazer login → ver dashboard vazio
```

---

*VD Platform — Portal Migration — Volume 03 — 29 Julho 2026*
