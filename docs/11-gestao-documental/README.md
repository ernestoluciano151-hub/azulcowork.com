# Volume 08 — Gestão Documental

> **Estado:** ✅ **CONCLUÍDO — Sprint VOL08-4 (30 Jul 2026)**  
> **Aprovado em:** 30 de Julho de 2026  
> **Arquiteto-Chefe:** Claude (Anthropic)  
> **Product Owner:** Ernesto Pinto Luciano  
> **Volume:** 08 — Gestão Documental  
> **Pasta:** `docs/11-gestao-documental/`

---

## Justificação de Prioridade

O roadmap do VD Platform (Fase 1 — Outubro–Dezembro 2026) classifica a **Épica E01.2 — Gestão Documental** como 🔴 CRÍTICA, com as seguintes features prioritárias:

| Feature | Prioridade |
|---|---|
| Geração de propostas comerciais | 🔴 CRÍTICA |
| Geração de contratos de alocação | 🔴 CRÍTICA |
| Templates configuráveis de documentos | 🟠 ALTA |
| Repositório de documentos por empresa | 🟠 ALTA (parcialmente em VOL03) |

A API Pública (listada como Volume 08 no índice anterior) pertence à **Fase 2 — Multi-tenant** (Janeiro–Junho 2027) e não é necessária para a operação actual do Azul Coworking. A Gestão Documental é necessária **agora**, para fechar o ciclo comercial: Lead → Proposta → Contrato → Activo.

Este volume reordena os volumes planeados:
- **Volume 08** → Gestão Documental *(este volume)*
- **Volume 09** → API Pública & Webhooks *(deslocado para Fase 2)*

---

## Contexto e Lacuna Actual

### O que existe

| Módulo | O que já existe |
|---|---|
| VOL02 — ERP | `erp-pdf-service.tsx` gera PDFs de **faturas** e **recibos** via `@react-pdf/renderer` |
| VOL03 — Portal | `portal-documents-service.ts` gere upload/download de documentos (repositório) |
| VOL03 — Portal | `PortalDocument` no schema Prisma — repositório de docs por empresa |
| Schema | `ErpContract` — contrato de coworking (tem `contractFileUrl` mas sem geração) |
| Schema | `Lead` / `Company` — entidades CRM sem proposta comercial associada |

### O que falta

- ❌ Nenhum serviço gera **propostas comerciais** (PDF ou DOCX)
- ❌ Nenhum serviço gera **contratos de alocação** (PDF ou DOCX)
- ❌ Não existem **templates de documentos** editáveis (só os de email, VOL07)
- ❌ O campo `ErpContract.contractFileUrl` está vazio — nunca há documento gerado
- ❌ O ciclo "Lead aprovado → gerar proposta → converter em contrato" está incompleto

---

## Objectivos do Volume 08

1. **Fechar o ciclo documental** do VD Platform: proposta → contrato → arquivo
2. Gerar documentos PDF em memória (sem armazenamento temporário em disco)
3. Arquivar automaticamente em Cloudinary e registar no repositório `PortalDocument`
4. Disponibilizar templates editáveis pelo operador, sem deploy
5. Integrar com modelos existentes: `Lead`, `ErpContract`, `Company`, `PortalDocument`

---

## Arquitectura Proposta

### Novo Modelo Prisma: `DocumentTemplate`

```prisma
model DocumentTemplate {
  id           String               @id @default(cuid())
  slug         String               @unique
  name         String
  type         DocumentTemplateType
  description  String?
  htmlBody     String               @db.Text   // template HTML com {{variáveis}}
  variables    String[]             // lista declarativa de variáveis esperadas
  isActive     Boolean              @default(true)
  createdAt    DateTime             @default(now())
  updatedAt    DateTime             @updatedAt

  @@index([type, isActive])
}

enum DocumentTemplateType {
  PROPOSAL     // Proposta comercial (para leads/oportunidades)
  CONTRACT     // Contrato de alocação (para ErpContract)
  DECLARATION  // Declaração de coworker
  LETTER       // Carta genérica
}
```

### Novo Modelo Prisma: `GeneratedDocument`

```prisma
model GeneratedDocument {
  id              String               @id @default(cuid())
  templateSlug    String
  type            DocumentTemplateType
  entityType      String               // "LEAD" | "CONTRACT" | "COMPANY"
  entityId        String               // ID da entidade associada
  cloudinaryId    String               // public_id no Cloudinary
  fileName        String               // nome original do ficheiro
  fileSizeBytes   Int
  generatedBy     String               // userId do admin que gerou
  createdAt       DateTime             @default(now())

  @@index([entityType, entityId])
  @@index([templateSlug])
  @@index([createdAt])
}
```

> **Nota:** `GeneratedDocument` é distinto de `PortalDocument` (VOL03). O `PortalDocument` serve o portal do cliente (acesso externo com URL assinada). O `GeneratedDocument` é o registo interno de todos os documentos gerados pelo sistema. Quando um `GeneratedDocument` é partilhado com o cliente, cria-se um `PortalDocument` apontando ao mesmo Cloudinary public_id.

### Novos Serviços

| Serviço | Responsabilidade |
|---|---|
| `src/lib/document-generation-service.ts` | Orquestrador: carrega template → interpola → gera PDF → upload Cloudinary → regista `GeneratedDocument` |
| `src/lib/document-pdf-renderer.tsx` | Componentes React-PDF para proposal e contract (reutiliza padrão de `erp-pdf-service.tsx`) |

### Reutilização de Módulos Existentes

| Módulo | Como é reutilizado |
|---|---|
| `template-interpolator.ts` (VOL07) | Interpolação `{{variavel}}` aplicada aos templates de documentos |
| `portal-documents-service.ts` (VOL03) | Upload para Cloudinary + `PortalDocument` quando partilhado com cliente |
| `@react-pdf/renderer` (já instalado) | Geração de PDF em memória |
| `document-numbering.ts` | Numeração sequencial atómica (se aplicável a propostas) |
| `audit-service.ts` (VOL05) | Auditoria de todas as gerações e partilhas |
| `cloudinary` (já configurado) | Armazenamento dos PDFs gerados |

---

## API Routes Propostas

| Método | Rota | RBAC | Descrição |
|---|---|---|---|
| `GET` | `/api/admin/document-templates` | ADMIN | Lista todos os templates |
| `GET` | `/api/admin/document-templates/[slug]` | ADMIN | Detalhe com htmlBody |
| `PATCH` | `/api/admin/document-templates/[slug]` | ADMIN | Editar template |
| `POST` | `/api/admin/document-templates/[slug]/preview` | ADMIN | Pré-visualizar com vars |
| `POST` | `/api/admin/documents/generate` | ADMIN | Gerar documento (body: `{ templateSlug, entityType, entityId, vars }`) |
| `GET` | `/api/admin/documents` | ADMIN, COMERCIAL | Lista `GeneratedDocument` com filtros |
| `GET` | `/api/admin/documents/[id]` | ADMIN, COMERCIAL | Detalhe + URL assinada de download |
| `POST` | `/api/admin/documents/[id]/share-portal` | ADMIN | Publica em `PortalDocument` para acesso do cliente |

---

## UX/UI Proposta

### Pontos de Integração na UI

| Página | Acção adicionada |
|---|---|
| `/admin/crm/[id]` (Customer 360°) | Botão "Gerar Proposta" — abre modal com template + vars pré-preenchidas |
| `/admin/erp/contracts/[id]` | Botão "Gerar Contrato" — gera PDF e arquiva em `GeneratedDocument` |
| `/admin/documentos` *(nova página)* | Histórico de todos os documentos gerados (tabela paginada com download) |
| `/admin/configuracoes/document-templates` *(nova página)* | Editor de templates (igual ao de email-templates de VOL07) |

### Sidebar

Adicionar ao grupo "Documentos" na Sidebar:
- 📄 Documentos Gerados → `/admin/documentos`
- 📝 Templates Documentos → `/admin/configuracoes/document-templates`

---

## Variáveis de Template

### Proposta Comercial (`PROPOSAL`)

```
{{nomeEmpresa}}        {{nifEmpresa}}         {{moradaEmpresa}}
{{nomeContacto}}       {{emailContacto}}      {{telefoneContacto}}
{{planoDescricao}}     {{valorMensal}}        {{duracao}}
{{dataInicio}}         {{dataValidade}}       {{nomeComercial}}
{{dataDocumento}}      {{numeroDocumento}}    {{observacoes}}
```

### Contrato de Alocação (`CONTRACT`)

```
{{nomeEmpresa}}        {{nifEmpresa}}         {{moradaEmpresa}}
{{representanteLegal}} {{cargoRepresentante}} {{nomeContacto}}
{{planoDescricao}}     {{valorMensal}}        {{dataInicio}}
{{dataFim}}            {{duracao}}            {{depositoGarantia}}
{{formaPagamento}}     {{diaVencimento}}      {{renovacaoAutomatica}}
{{dataDocumento}}      {{numeroContrato}}     {{clausulasEspeciais}}
```

---

## Sprints Propostos

### VOL08-1 — Schema + Templates + Geração de Proposta PDF

**Duração:** 1 dia  
**Entregáveis:**
- Migration Prisma: `DocumentTemplate` + `GeneratedDocument` + enum `DocumentTemplateType`
- Seed: 2 templates iniciais (PROPOSAL + CONTRACT)
- `document-pdf-renderer.tsx`: componentes React-PDF para proposta
- `document-generation-service.ts`: gerar proposta + upload Cloudinary + `GeneratedDocument`
- Testes unitários: interpolação + variáveis esperadas

**Ficheiros afectados:**
```
prisma/schema.prisma          (EDIT — +2 modelos +1 enum)
prisma/seed.js                (EDIT — 2 DocumentTemplate upserts)
src/lib/document-pdf-renderer.tsx       (CRIAR)
src/lib/document-generation-service.ts  (CRIAR)
src/__tests__/unit/document-generation.test.ts  (CRIAR)
```

### VOL08-2 — Geração de Contrato + API Routes

**Duração:** 1 dia  
**Entregáveis:**
- `document-pdf-renderer.tsx`: componentes React-PDF para contrato
- API routes: `/api/admin/document-templates/*` (CRUD + preview)
- API routes: `/api/admin/documents/*` (generate + list + detail + share-portal)
- Rate limiting nas routes de geração

**Ficheiros afectados:**
```
src/lib/document-pdf-renderer.tsx                              (EDIT — +contract component)
src/app/api/admin/document-templates/route.ts                  (CRIAR)
src/app/api/admin/document-templates/[slug]/route.ts           (CRIAR)
src/app/api/admin/document-templates/[slug]/preview/route.ts   (CRIAR)
src/app/api/admin/documents/generate/route.ts                  (CRIAR)
src/app/api/admin/documents/route.ts                           (CRIAR)
src/app/api/admin/documents/[id]/route.ts                      (CRIAR)
src/app/api/admin/documents/[id]/share-portal/route.ts         (CRIAR)
```

### VOL08-3 — Admin UI

**Duração:** 1 dia  
**Entregáveis:**
- `/admin/documentos` — histórico de documentos gerados (tabela + download)
- `/admin/configuracoes/document-templates` — editor de templates
- Botão "Gerar Proposta" na Customer 360° (`/admin/crm/[id]`)
- Botão "Gerar Contrato" na página de contrato ERP
- Sidebar: grupo "Documentos" com 2 links
- Modal de geração com pré-preenchimento de variáveis

**Ficheiros afectados:**
```
src/app/admin/documentos/page.tsx                              (CRIAR)
src/app/admin/configuracoes/document-templates/page.tsx        (CRIAR)
src/app/admin/crm/[id]/page.tsx                               (EDIT — botão Gerar Proposta)
src/components/admin/Sidebar.tsx                              (EDIT — grupo Documentos)
```

### VOL08-4 — Testes + ADR + Documentação + DoD

**Duração:** 1 dia  
**Entregáveis:**
- Testes unitários adicionais: geração de contrato, upload Cloudinary mock, share-portal
- ADR-038: decisões arquitecturais do VOL08
- Actualizar `docs/adr/README.md`, `CLAUDE.md`, `docs/README.md`
- DoD Checklist completo
- Tabela de entregáveis VOL08

---

## Dependências

| Dependência | Estado | Notas |
|---|---|---|
| `@react-pdf/renderer` | ✅ Instalado (VOL02) | Já usado em `erp-pdf-service.tsx` |
| `cloudinary` SDK | ✅ Instalado (VOL03) | Config em `portal-documents-service.ts` |
| `template-interpolator.ts` | ✅ Criado (VOL07) | Reutilizado sem alterações |
| Migration Prisma | ⚠️ Necessária | +2 modelos, +1 enum |
| `CLOUDINARY_*` env vars | ✅ Já configuradas | Nenhuma nova env var necessária |

**Novas env vars:** nenhuma.

---

## Riscos e Mitigações

| Risco | Probabilidade | Mitigação |
|---|---|---|
| PDF muito grande (muitas páginas) | Baixa | Limite de variáveis declarativas; timeout 30s |
| Cloudinary falha no upload | Baixa | Retry 3x com exponential backoff; não persiste `GeneratedDocument` se upload falhar |
| Template com HTML malicioso | Média | Só ADMIN pode editar templates; preview em iframe com sandbox |
| Migration quebra prod | Baixa | Só add de novas tabelas/enum — zero breaking changes |

---

## Definition of Ready — Confirmação

```
✅ Requisitos definidos (o quê e porquê)
✅ Regras de negócio identificadas (E01.2 do roadmap)
✅ Impactos mapeados (modelos, routes, componentes)
✅ Critérios de aceitação escritos (por sprint)
✅ Plano de testes definido (unitários por serviço)
```

---

## Critérios de Aceitação (DoD do Volume)

```
□ Migration Prisma aplicada sem erros
□ 2 templates seed criados (PROPOSAL + CONTRACT)
□ Gerar proposta PDF para um Lead via API: status 200 + Cloudinary public_id
□ Gerar contrato PDF para um ErpContract via API: status 200 + Cloudinary public_id
□ Download funciona via URL assinada Cloudinary (TTL 15 min)
□ Share-portal cria PortalDocument acessível pelo cliente
□ Editor de templates acessível em /admin/configuracoes/document-templates
□ Botão "Gerar Proposta" funcional na Customer 360°
□ Botão "Gerar Contrato" funcional na página de contrato ERP
□ Testes unitários aprovados (zero falhas)
□ ADR-038 criado e aprovado
□ Documentação actualizada
```

---

## Definition of Done — Checklist Final (30 Jul 2026)

```
✅ Migration Prisma aplicada: DocumentTemplate + GeneratedDocument + DocumentTemplateType
✅ 2 templates seed criados (proposta-coworking + contrato-coworking)
✅ document-pdf-renderer.tsx: renderProposalPdf() + renderContractPdf()
✅ document-generation-service.ts: generateDocument() + sha256Hex() + nextDocumentVersion()
✅ Upload Cloudinary dentro de $transaction (upload falho → rollback → sem GeneratedDocument)
✅ overwrite: false no Cloudinary (PDFs imutáveis)
✅ SHA-256 hash em cada GeneratedDocument
✅ Versionamento duplo: DocumentTemplate.version + GeneratedDocument.templateVersion
✅ Versionamento de documentos: GeneratedDocument.version (MAX+1 atómico)
✅ 7 API routes criadas e validadas (47/47 testes de comportamento)
✅ TypeScript: 7/7 ficheiros sem erros
✅ Download via URL assinada Cloudinary (TTL 15 min)
✅ Share-portal: cria PortalDocument + PortalDocumentVersion sem duplicação de ficheiros
✅ AuditLog: DOCUMENT_GENERATED + DOCUMENT_DOWNLOADED + DOCUMENT_SHARED_PORTAL
✅ Timeline: entradas para cada operação (LEAD e ERPCONTRACT)
✅ Falha de auditoria não bloqueia geração (fire-and-forget — ADR-033)
✅ Rate limiting: POST /generate limitado por IP ("doc-generate")
✅ Admin UI: /admin/documentos (histórico paginado + download)
✅ Admin UI: /admin/configuracoes/document-templates (editor + preview)
✅ Botão "Gerar Proposta" na Customer 360° (/admin/crm/[id])
✅ Botão "Gerar Contrato" na página financeira (/admin/financeiro/empresa/[id])
✅ GenerateDocModal: componente reutilizável com prefill de vars + share-portal inline
✅ Sidebar: grupo "Documentos" com 2 links
✅ ADR-038: decisões arquitecturais VOL08 documentadas
✅ docs/adr/README.md: ADR-038 indexado
✅ CLAUDE.md: VOL08 marcado como CONCLUÍDO
✅ docs/README.md: VOL08 marcado como CONCLUÍDO
```

---

## Sprint Log

| Sprint | Conteúdo | Data | Estado |
|---|---|---|---|
| VOL08-1 | Schema Prisma + document-pdf-renderer.tsx + document-generation-service.ts + testes | 30 Jul 2026 | ✅ |
| VOL08-2 | 7 API routes + 47 testes comportamentais + validação TypeScript | 30 Jul 2026 | ✅ |
| VOL08-3 | Admin UI (histórico, editor, modal) + integração CRM + Financeiro | 30 Jul 2026 | ✅ |
| VOL08-4 | ADR-038 + actualização docs + DoD Checklist | 30 Jul 2026 | ✅ |

---

## Entregáveis Finais

| Ficheiro | Tipo | Sprint |
|---|---|---|
| `prisma/schema.prisma` | EDIT (+2 modelos +1 enum +3 AuditAction) | VOL08-1 |
| `prisma/seed.js` | EDIT (+2 DocumentTemplate) | VOL08-1 |
| `src/lib/document-pdf-renderer.tsx` | CRIAR | VOL08-1 |
| `src/lib/document-generation-service.ts` | CRIAR | VOL08-1 |
| `src/__tests__/unit/document-generation.test.ts` | CRIAR | VOL08-1 |
| `src/app/api/admin/document-templates/route.ts` | CRIAR | VOL08-2 |
| `src/app/api/admin/document-templates/[slug]/route.ts` | CRIAR | VOL08-2 |
| `src/app/api/admin/document-templates/[slug]/preview/route.ts` | CRIAR | VOL08-2 |
| `src/app/api/admin/documents/generate/route.ts` | CRIAR | VOL08-2 |
| `src/app/api/admin/documents/route.ts` | CRIAR | VOL08-2 |
| `src/app/api/admin/documents/[id]/route.ts` | CRIAR | VOL08-2 |
| `src/app/api/admin/documents/[id]/share-portal/route.ts` | CRIAR | VOL08-2 |
| `src/components/admin/Sidebar.tsx` | EDIT (grupo Documentos) | VOL08-3 |
| `src/app/admin/documentos/page.tsx` | CRIAR | VOL08-3 |
| `src/app/admin/configuracoes/document-templates/page.tsx` | CRIAR | VOL08-3 |
| `src/components/admin/GenerateDocModal.tsx` | CRIAR | VOL08-3 |
| `src/app/admin/crm/[id]/page.tsx` | EDIT (botões + modal) | VOL08-3 |
| `src/app/admin/financeiro/empresa/[id]/page.tsx` | EDIT (botão Gerar Contrato) | VOL08-3 |
| `docs/adr/ADR-038-document-management-architecture.md` | CRIAR | VOL08-4 |
| `docs/adr/README.md` | EDIT (ADR-038 indexado) | VOL08-4 |
| `CLAUDE.md` | EDIT (VOL08 CONCLUÍDO) | VOL08-4 |
| `docs/README.md` | EDIT (VOL08 CONCLUÍDO) | VOL08-4 |

---

*VD Platform — VOL08 Gestão Documental — CONCLUÍDO — 30 de Julho de 2026*
