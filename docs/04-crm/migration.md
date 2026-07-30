# CRM — Plano de Migração

> **Versão:** 1.0.0-draft  
> **Volume:** 01 — CRM  
> **Estado:** 📝 Em elaboração  
> **Crítico:** Requer validação contra dados reais antes de aprovação

---

## 1. Estado Actual

O sistema actual tem uma tabela `Lead` com os seguintes campos relevantes:
- `id`, `name`, `email`, `phone`, `company` (string livre), `source`, `status`, `assignedToId`, `notes`, `createdAt`, `updatedAt`

O CRM Volume 01 introduz um modelo relacional completo onde `Company` substitui e expande o conceito de "lead".

---

## 2. Estratégia de Migração

**Abordagem:** Migração expansiva não-destrutiva.

1. Criar as novas tabelas (`companies`, `contacts`, `deals`, etc.) em paralelo com as existentes.
2. Migrar os dados existentes de `leads` para o novo modelo.
3. Manter a tabela `leads` em modo read-only durante o período de transição.
4. Após validação completa, marcar a tabela `leads` como deprecated (sem eliminação imediata).

**Princípio:** Zero downtime. A migração é executada em produção sem interrupção do serviço.

---

## 3. Regras de Mapeamento Lead → Company

| Campo Lead (actual) | Campo Company (novo) | Transformação |
|---|---|---|
| `lead.id` | — | Não migrado (novo `cuid()` para Company) |
| `lead.name` | `company.name` | Directo |
| `lead.company` | `company.name` | Se `lead.company` existir e diferir de `lead.name`, usar `lead.company` |
| `lead.email` | `contact.email` (contacto primário) | Criar Contact com `isPrimary: true` |
| `lead.phone` | `contact.phone` (contacto primário) | Idem |
| `lead.status` | `company.status` + `company.pipelineStage` | Ver tabela de mapeamento abaixo |
| `lead.assignedToId` | `company.assignedToId` + `deal.assignedToId` | Directo |
| `lead.notes` | `note.content` (nota inicial) | Criar Note com `authorId = assignedToId` |
| `lead.source` | `timelineEntry.metadata.source` | Na entrada LEAD_CAPTURED |
| `lead.createdAt` | `company.createdAt` + `timelineEntry.occurredAt` | Preservar timestamp original |

### Mapeamento de Status

| Status Lead (actual) | Status Company | Pipeline Stage |
|---|---|---|
| `NEW` | `PROSPECT` | `NEW_LEAD` |
| `CONTACTED` | `PROSPECT` | `CONTACTED` |
| `QUALIFIED` | `QUALIFIED` | `QUALIFIED` |
| `PROPOSAL` | `QUALIFIED` | `PROPOSAL_SENT` |
| `NEGOTIATION` | `NEGOTIATION` | `NEGOTIATION` |
| `WON` | `ACTIVE` | `WON` |
| `LOST` | `PROSPECT` | `LOST` |
| `INACTIVE` | `INACTIVE` | `LOST` |

---

## 4. Script de Migração

```typescript
// prisma/migrations/crm-migration/migrate-leads-to-companies.ts
// Executar com: npx ts-node prisma/migrations/crm-migration/migrate-leads-to-companies.ts

import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

async function migrateLeadsToCompanies() {
  const leads = await db.lead.findMany({ where: { deletedAt: null } });
  
  console.log(`Migrando ${leads.length} leads...`);
  let success = 0;
  let failed = 0;

  for (const lead of leads) {
    try {
      await db.$transaction(async (tx) => {
        // 1. Criar Company
        const company = await tx.company.create({
          data: {
            name:          lead.company || lead.name,
            email:         lead.email,
            phone:         lead.phone,
            status:        mapStatus(lead.status).companyStatus,
            pipelineStage: mapStatus(lead.status).pipelineStage,
            assignedToId:  lead.assignedToId,
            country:       "Angola",
            createdAt:     lead.createdAt,
            updatedAt:     lead.updatedAt,
          },
        });

        // 2. Criar Contact primário (se existir email ou phone)
        if (lead.email || lead.phone) {
          await tx.contact.create({
            data: {
              firstName:  extractFirstName(lead.name),
              lastName:   extractLastName(lead.name),
              email:      lead.email,
              phone:      lead.phone,
              role:       "OTHER",
              isPrimary:  true,
              companyId:  company.id,
              createdAt:  lead.createdAt,
            },
          });
        }

        // 3. Criar Deal se status avançado
        if (isAdvancedStatus(lead.status)) {
          await tx.deal.create({
            data: {
              companyId:   company.id,
              title:       `Oportunidade — ${company.name}`,
              stage:       mapDealStage(lead.status),
              assignedToId: lead.assignedToId,
              createdAt:   lead.createdAt,
            },
          });
        }

        // 4. Criar Nota se existir notes
        if (lead.notes?.trim()) {
          await tx.note.create({
            data: {
              companyId: company.id,
              content:   lead.notes,
              authorId:  lead.assignedToId || "system",
              createdAt: lead.createdAt,
            },
          });
        }

        // 5. Criar entrada inicial na Timeline
        await tx.timelineEntry.create({
          data: {
            companyId:  company.id,
            eventType:  "LEAD_CAPTURED",
            title:      "Lead migrado do sistema anterior",
            isSystem:   true,
            occurredAt: lead.createdAt,
            metadata:   {
              originalLeadId: lead.id,
              source:         lead.source || "MIGRATION",
              migratedAt:     new Date().toISOString(),
            },
          },
        });

        // 6. Marcar lead original como migrado
        await tx.lead.update({
          where: { id: lead.id },
          data:  { migratedToCompanyId: company.id },
        });

        success++;
      });
    } catch (err) {
      console.error(`Falha a migrar lead ${lead.id}:`, err);
      failed++;
    }
  }

  console.log(`✅ Migração concluída: ${success} sucesso, ${failed} falhas`);
}

migrateLeadsToCompanies()
  .catch(console.error)
  .finally(() => db.$disconnect());
```

---

## 5. Validação Pós-Migração

```bash
# Executar após migração para validar integridade
npx ts-node prisma/migrations/crm-migration/validate-migration.ts
```

```typescript
// Checks de validação:
async function validateMigration() {
  const totalLeads    = await db.lead.count({ where: { deletedAt: null } });
  const totalCompanies = await db.company.count({ where: { deletedAt: null } });
  const migratedLeads = await db.lead.count({ where: { migratedToCompanyId: { not: null } } });

  console.log(`Leads originais:      ${totalLeads}`);
  console.log(`Companies criadas:    ${totalCompanies}`);
  console.log(`Leads migrados:       ${migratedLeads}`);
  
  if (migratedLeads !== totalLeads) {
    console.error(`❌ ${totalLeads - migratedLeads} leads NÃO migrados!`);
    process.exit(1);
  }

  // Verificar orphans
  const orphanContacts  = await db.contact.count({ where: { company: null } });
  const orphanTimelines = await db.timelineEntry.count({ where: { company: null } });
  
  if (orphanContacts > 0)  console.error(`❌ ${orphanContacts} contacts sem empresa`);
  if (orphanTimelines > 0) console.error(`❌ ${orphanTimelines} timeline entries sem empresa`);
  
  if (orphanContacts === 0 && orphanTimelines === 0) {
    console.log("✅ Integridade referencial confirmada");
  }
}
```

---

## 6. Rollback Plan

Se a migração falhar ou detectar inconsistências:

1. **Parar** a migração imediatamente.
2. As novas tabelas (`companies`, `contacts`, etc.) podem ser **truncadas** sem perda de dados — os leads originais não foram modificados (apenas adicionada a coluna `migratedToCompanyId`).
3. **Reverter** a coluna `migratedToCompanyId` da tabela `leads`.
4. **Investigar** a causa das falhas no log de erros.
5. **Re-executar** após correcção.

O rollback é seguro porque:
- Os dados originais em `leads` nunca são modificados, apenas lidos.
- As novas tabelas são independentes e podem ser recriadas.
- O script é idempotente: detecta leads já migrados e salta-os.

---

## 7. Checklist Pré-Migração

```
□ Backup completo da base de dados executado e verificado
□ Script testado em ambiente de staging com dados reais anonimizados
□ Validação de integridade executada em staging: zero erros
□ Janela de manutenção comunicada (se aplicável)
□ Rollback plan revisto e aprovado pelo Product Owner
□ Sentry activo para capturar erros durante a migração
□ Aprovação formal do Product Owner dada
```

---

*VD Platform — CRM Migration Plan — v1.0.0-draft — 28 Julho 2026*  
*© 2026 VERSÃO DE NEGÓCIOS - COMÉRCIO GERAL E PRESTAÇÃO DE SERVIÇOS, LDA. Confidencial.*
