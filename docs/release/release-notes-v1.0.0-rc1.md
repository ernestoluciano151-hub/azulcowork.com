# Release Notes — VD Platform v1.0.0-rc1

> **Tag:** `v1.0.0-rc1`  
> **Data:** 30 Julho 2026  
> **Estado:** ✅ APROVADO PARA PILOTO CONTROLADO  
> **Aprovação PO:** Ernesto Pinto Luciano — 30 Jul 2026  
> **Produto:** VD Platform — Azul Cowork Enterprise  
> **Operador:** VERSÃO DE NEGÓCIOS - COMÉRCIO GERAL E PRESTAÇÃO DE SERVIÇOS, LDA  

---

## Sumário Executivo

O VD Platform v1.0.0-rc1 é a primeira versão de produção de uma plataforma SaaS de gestão empresarial construída de raiz para o Azul Coworking (Luanda, Angola). Desenvolvido entre Julho e Julho de 2026 em 12 volumes iterativos, o sistema está pronto para piloto controlado com clientes reais.

**Escala da entrega:** 135+ endpoints de API, 34 páginas admin, portal completo do cliente, 11 automações cron, 42 ficheiros de teste, ~100 documentos técnicos, 42 Architecture Decision Records.

---

## Novidades Neste Release

### VOL01 — CRM Empresarial (Sprint CRM-FE-7)

Sistema completo de gestão de relacionamento com clientes:

- **Pipeline Kanban** com 6 estágios: Lead → Contacto → Qualificado → Proposta → Negociação → Cliente
- **Customer 360°** — vista unificada de empresa: contactos, deals, actividades, tarefas, notas, timeline, financeiro
- **Duplicate Detection** — algoritmo de detecção de empresas duplicadas com sugestão de merge
- **CRM Dashboard** — métricas de conversão, pipeline por estágio, actividades do dia
- **Gestão de Tarefas** — tarefas atribuídas a comerciais com prioridade e prazo
- Lead migration: leads convertidos associados à empresa
- Export CSV de CRM para contabilidade

### VOL02 — ERP Financeiro Integrado (Sprint ERP-9)

Motor financeiro completo com IVA Angola (14% — Lei n.º 17/19):

- **Contratos de Coworking** com state machine formal: DRAFT → ACTIVE → SUSPENDED/TERMINATED
- **Faturação automática mensal** com numeração sequencial garantida (race-condition-free)
- **Gestão de pagamentos** com ledger imutável (append-only), recibos automáticos
- **Despesas** com ciclo de vida: PENDING → APPROVED → PAID/REJECTED, centros de custo
- **Fluxo de Caixa** com KPIs em tempo real e projecção a 6 meses
- **Relatórios fiscais**: Mapa IVA mensal (R-07), Reconciliação bancária (R-05), Export XLSX
- **Alertas automáticos**: contratos a expirar, faturas em atraso, orçamentos excedidos, saldo negativo
- Dashboard financeiro com snapshot mensal

### VOL03 — Portal do Cliente + Omnicanal (Beta Jul 2026)

Portal self-service completo para empresas cliente:

- **Autenticação por Magic Link** — sem passwords, sessão segura por email
- **Dashboard do cliente** — visão geral de contrato, saldo, próxima fatura
- **Faturas e pagamentos** — histórico completo, download de PDFs assinados
- **Contratos** — visualização e histórico de versões
- **Reservas** — criar e gerir reservas de sala directamente no portal
- **Documentos** — upload e download com controlo de versões
- **Suporte** — tickets de suporte com SLA automático
- **Notificações** — SSE em tempo real + Web Push (VAPID) para mobile
- **Gestão de utilizadores** — múltiplos utilizadores por empresa com RBAC (OWNER/ADMIN/MEMBER/VIEWER)

### VOL04 — Reservas de Sala de Reunião (Sprint VOL04-7)

Sistema de reservas com conflict check ACID:

- **Disponibilidade em tempo real** com timezone Africa/Luanda
- **Conflict check serializable** (DT-013 resolvido) — impossível criar reservas sobrepostas
- **State machine formal**: PENDING → CONFIRMED → COMPLETED/CANCELLED
- **Pricing engine** por tier (hora única, meia-dia, dia completo) com preços diferenciados
- **Encerramento automático** de reservas passadas via cron
- **Recibos automáticos** com numeração FT-SALA-YYYY-NNNNNN

### VOL05 — Segurança (Sprint VOL05-4)

Segurança de nível enterprise:

- **Audit Log imutável** com sanitização dupla de campos sensíveis
- **Sessões individuais revogáveis** — AdminSession na BD com IP + User-Agent
- **Histórico de logins** — IP e timestamp de cada acesso
- **TOTP 2FA** integrado no fluxo de login (DT-016 resolvido)
- **RBAC granular**: ADMIN, COMERCIAL, FINANCEIRO, VIEWER
- **Página de auditoria** em /admin/auditoria com filtros avançados

### VOL06 — Dashboard Executivo & BI (Sprint VOL06-4)

Inteligência de negócio para decisão executiva:

- **KPIs em tempo real**: ocupação, receita, reservas, contratos activos, tickets abertos
- **Gráficos Recharts**: receita por mês, ocupação por sala, pipeline CRM
- **Relatório PDF mensal** gerado automaticamente com `@react-pdf/renderer`
- **Snapshot mensal** (cron erp-monthly-snapshot) para comparação histórica

### VOL07 — Comunicação Avançada (Sprint VOL07-4)

Centro de comunicação omnicanal:

- **Templates de email** editáveis via admin (HTML com variáveis interpoladas)
- **Histórico de comunicações** por empresa com CommunicationLog
- **WhatsApp** — integração deep-link com mensagem pré-preenchida
- **Cron communication-daily** — seguimentos automáticos configuráveis

### VOL08 — Gestão Documental (Sprint VOL08-4)

Sistema de documentos com integridade garantida:

- **Templates de documentos** editáveis (Proposta Comercial, Contrato de Coworking, Recibo)
- **Geração de PDF** com `@react-pdf/renderer` + upload automático para Cloudinary
- **Fingerprint SHA-256** — integridade de cada documento
- **Versionamento duplo** — `versionMajor` e `versionMinor` por documento
- **Partilha com portal** — documentos partilhados ficam disponíveis no portal do cliente
- **Botões de geração** nas páginas Customer 360° e ERP Contratos

### VOL09 — Portal Frontend (Sprint VOL09-5)

Interface completa do portal do cliente:

- Dark/light theme adaptativo
- Roteamento protegido por JWT Portal via Edge Middleware
- 10+ páginas: dashboard, empresa, contratos, faturas, pagamentos, documentos, reservas, suporte, notificações, perfil
- Responsive para mobile e desktop

### VOL10 — Automações (Sprint VOL10-4)

Emails transaccionais e faturação automática:

- **Magic link** enviado por email com link de acesso único ao portal
- **Email de boas-vindas** ao criar utilizador de portal
- **Cron erp-invoice-generate** — gera faturas mensais para todos os contratos ACTIVE no dia 1

### VOL11 — Deployment & Infraestrutura (Sprint VOL11-4)

Infraestrutura de produção:

- **`build:prod`**: `prisma migrate deploy && next build` — migrations automáticas em cada deploy
- **11 crons configurados** em `vercel.json` com schedules UTC correctos (Africa/Luanda = UTC+1)
- **`.env.example`** como SSoT de 28 variáveis de ambiente
- **Seed idempotente** — seguro para re-executar em produção
- **Guia de migração PostgreSQL** (Neon recomendado)

### VOL12 — ERP Admin UI + Correcções de Produção (Sprint VOL12-4)

Correcções críticas e frontend ERP completo:

- **Fix crítico**: `build:prod` corrigido para incluir `prisma migrate deploy`
- **Fix crítico**: `web-push ^3.6.7` adicionado a `package.json`
- **6 páginas ERP admin**: Contratos, Faturas, Despesas, Fluxo de Caixa, Relatórios, Portal Utilizadores
- **Sidebar reorganizada** com grupos ERP e Portal

### Fase P0 — Estabilização (Sprints P0-A a P0-D)

Todas as dívidas técnicas críticas resolvidas:

| Dívida | Resolução |
|---|---|
| DT-011: JWT fallback secret | Detecção em startup — erro se valor padrão |
| DT-012: RBAC incompleto | `requireSession`/`requireRole` em todas as routes |
| DT-013: TOCTOU reservas | `$transaction` com isolation Serializable |
| DT-014: Race condition numeração | `DocumentCounter` com upsert atómico |
| DT-016: TOTP sem integração | TOTP integrado no fluxo de login |
| DT-017: recordFinancialHistory | Padrão post-commit fora de $transaction |
| DT-002: Sem testes | 42 ficheiros, ~128 testes, cobertura ≥ 60% |
| DT-001: TypeScript strict | `ignoreBuildErrors` removido — 0 erros tsc |
| DT-009: Sem error monitoring | Sentry configurado com source maps |
| DT-010: Rate limiting | Limitação por IP em routes críticas |
| DT-035: JSDoc cron error | Corrigido em 3 ficheiros VOL03 |

---

## Componentes Técnicos

### Stack

```
Framework:  Next.js 15 + TypeScript 5.5 (strict)
ORM:        Prisma 5.18 + PostgreSQL
Auth:       jose 5.6 (JWT HS256) + otpauth 9.5 (TOTP)
Email:      nodemailer 9 + SMTP (Brevo)
Files:      Cloudinary 2.10
PDF:        @react-pdf/renderer 4.5 + pdfkit 0.19
Charts:     recharts 3.9
Push:       web-push 3.6 (VAPID)
Monitoring: @sentry/nextjs 8.55
Tests:      vitest 4.1 + @vitest/coverage-v8
Deploy:     Vercel + Neon (PostgreSQL serverless)
```

### Dependências Adicionadas Neste Release

- `web-push ^3.6.7` — Web Push Notifications (VAPID)
- `@types/web-push ^3.6.4` — tipos TypeScript

### Scripts

```bash
npm run build:prod    # prisma migrate deploy && next build
npm run dev           # next dev
npm run test          # vitest run
npm run test:coverage # vitest run --coverage
npm run db:seed       # node prisma/seed.js
```

---

## API — Novos Endpoints

### VOL12 — Nenhum novo endpoint (UI consome endpoints VOL02 existentes)

Consultar `docs/05-erp/api.md` para a lista completa dos 40+ endpoints ERP.

---

## Breaking Changes

Nenhum breaking change neste release. Todas as alterações são aditivas.

---

## Bugs Corrigidos

| Bug | Componente | Impacto |
|---|---|---|
| `build:prod` não executava migrations | Infraestrutura | Crítico — DB desactualizada em produção |
| `web-push` ausente das dependências | Portal/Notificações | Crítico — notificações push falhavam silenciosamente |
| DT-035: JSDoc `*/5` fechava comentário | Cron routes VOL03 | Médio — erros tsc em CI |

---

## Issues Conhecidos

Ver `docs/release/known-issues.md` — 12 issues rastreados:
- 0 P0 (Bloqueadores)
- 1 P1 (PORTAL_JWT_SECRET não validada em startup)
- 5 P2 (EMIS, E2E tests, WhatsApp API, formulário contratos, CSP)
- 6 P3/P4 (cosmético / nice-to-have)

---

## Upgrade / Deploy

**Primeiro deploy (ambiente novo):**
```
1. Seguir docs/release/deployment-checklist.md (8 fases, 50+ itens)
2. npm run build:prod (migrations + build automáticos)
3. node prisma/seed.js (seed de dados referência)
4. Smoke test: docs/release/deployment-checklist.md → Fase 6
```

**Update de versão existente:**
```
1. Push para branch main no GitHub
2. Vercel detecta e executa npm run build:prod automaticamente
3. prisma migrate deploy aplica migrations pendentes
4. Zero downtime deploy (Vercel)
```

---

## Checksums

| Ficheiro | SHA-256 |
|---|---|
| `package.json` | Verificar com: `shasum -a 256 package.json` |
| `prisma/schema.prisma` | Verificar com: `shasum -a 256 prisma/schema.prisma` |
| `vercel.json` | Verificar com: `shasum -a 256 vercel.json` |

---

## Agradecimentos

**Product Owner:** Ernesto Pinto Luciano — visão, decisões e aprovações ao longo de 30 dias  
**Arquitectura:** Claude (Anthropic) — Arquiteto-Chefe VD Platform  
**Caso de uso:** Azul Coworking — Bairro Azul, Edifício 18, Luanda, Angola

---

*VD Platform v1.0.0-rc1 — Release Notes — 30 Jul 2026*  
*"Parar de construir e começar a aprender com utilização real."*
