# VD Platform — Documentação Oficial

> **Versão:** 0.1.0-foundation  
> **Estado:** Em elaboração — Volume 00 aprovado  
> **Arquiteto-Chefe:** Claude (Anthropic) em parceria com Ernesto Pinto Luciano  
> **Operador:** VERSÃO DE NEGÓCIOS - COMÉRCIO GERAL E PRESTAÇÃO DE SERVIÇOS, LDA  
> **NIF:** 5002174308  
> **Data de Início:** Julho 2026  
> **Idioma Oficial:** Português (Angola)  

---

## Declaração de Princípio

> *A documentação é a única fonte oficial de verdade deste projecto. O código é apenas a implementação de decisões previamente documentadas e aprovadas. Em caso de conflito entre o código existente e a documentação aprovada, a documentação prevalece e o código deve ser corrigido.*

---

## O que é o VD Platform?

O **VD Platform** é uma plataforma SaaS de gestão empresarial desenvolvida para servir organizações que necessitam de um sistema integrado, escalável e moderno de CRM, ERP, gestão financeira, operações de coworking, reservas, contratos e comunicação com clientes.

A plataforma nasce a partir da experiência operacional do **Azul Coworking** (Luanda, Angola), mas foi arquitectada desde a sua fundação para crescer além do caso de uso inicial e tornar-se um produto empresarial comparável a HubSpot, Salesforce, Odoo e Zoho CRM — adaptado ao contexto africano e com capacidade de expansão global.

---

## Índice Geral da Documentação

### Volume 00 — Foundation *(Este volume)*

| Documento | Descrição | Estado |
|---|---|---|
| [00-foundation/README.md](./00-foundation/README.md) | Visão geral do Volume 00 | ✅ |
| [00-foundation/product-vision.md](./00-foundation/product-vision.md) | Visão do produto, missão, proposta de valor | ✅ |
| [00-foundation/architecture.md](./00-foundation/architecture.md) | Arquitectura de sistema completa | ✅ |
| [00-foundation/domain-model.md](./00-foundation/domain-model.md) | Modelo de domínio DDD | ✅ |
| [00-foundation/technology-stack.md](./00-foundation/technology-stack.md) | Stack tecnológico justificado | ✅ |
| [00-foundation/principles.md](./00-foundation/principles.md) | Princípios de engenharia | ✅ |
| [00-foundation/development-methodology.md](./00-foundation/development-methodology.md) | Metodologia em 10 etapas | ✅ |
| [00-foundation/checklist.md](./00-foundation/checklist.md) | Checklists de qualidade | ✅ |
| [business-bible/README.md](./business-bible/README.md) | Regras de negócio (Business Bible) | ✅ |
| [claude-guide/README.md](./claude-guide/README.md) | Manual Claude Code | ✅ |
| [adr/README.md](./adr/README.md) | Architecture Decision Records | ✅ |
| [roadmap/README.md](./roadmap/README.md) | Roadmap faseado | ✅ |
| [glossary/README.md](./glossary/README.md) | Glossário de domínio | ✅ |

### Fase 0.5 — Auditoria Técnica Completa *(Julho 2026)*

| Documento | Descrição | Estado |
|---|---|---|
| [audit/technical-audit-report.md](./audit/technical-audit-report.md) | 30 findings (7 críticos, 9 altos, 8 médios, 6 baixos) | ✅ Concluído |
| [audit/system-health-report.md](./audit/system-health-report.md) | Score global: 58/100. Dashboard de saúde por módulo | ✅ Concluído |
| [audit/refactoring-backlog.md](./audit/refactoring-backlog.md) | 23 itens de refactoring priorizados (RFT-001 a RFT-023) | ✅ Concluído |
| [audit/metrics-dashboard.md](./audit/metrics-dashboard.md) | Painel permanente de métricas — actualizado quinzenalmente | ✅ Activo |

### Baseline Arquitectural *(26 Julho 2026 — Marco Zero)*

| Documento | Descrição | Estado |
|---|---|---|
| [architecture/baseline.md](./architecture/baseline.md) | Snapshot imutável da arquitectura pré-Sprint P0-A | ✅ Aprovado |

### Fase P0 — Estabilização da Plataforma *(Agosto–Setembro 2026)*

| Documento | Descrição | Estado |
|---|---|---|
| [p0-stabilization/README.md](./p0-stabilization/README.md) | Plano completo da Fase P0 — 4 sprints, 20 tasks | ✅ Aprovado |
| [p0-stabilization/quality-gate.md](./p0-stabilization/quality-gate.md) | Quality Gate obrigatório para todos os sprints futuros | ✅ Aprovado |
| [p0-stabilization/testing-strategy.md](./p0-stabilization/testing-strategy.md) | Estratégia de testes: Vitest, mocks, especificações completas | ✅ Aprovado |

### Fase 3 — Domínio de Negócio *(Após conclusão da Fase P0)*

> Documentos a criar após a estabilização técnica. Não são bloqueadores da Fase P0.

| Documento | Descrição | Estado |
|---|---|---|
| `domain/customer360.md` | Empresa como centro do sistema; ciclo de vida completo | 📋 Planeado |
| `domain/golden-rules.md` | Regras de negócio invioláveis (GR-001…) | 📋 Planeado |
| `domain/customer-journey.md` | Lead → Contacto → Empresa → Contrato → Renovação → Upsell | 📋 Planeado |
| `domain/business-event-catalog.md` | Catálogo completo de eventos: quem dispara, quem consome, impacto | 📋 Planeado |
| `domain/data-dictionary.md` | Dicionário de dados: tipo, validação, formato, regras por campo | 📋 Planeado |
| `domain/financial-source-of-truth.md` | Origem de cada número financeiro exibido no sistema | 📋 Planeado |
| `domain/crm.md` | Domínio CRM — entidades, regras, estados | 📋 Planeado |
| `domain/erp.md` | Domínio ERP — coworking, contratos, benefícios | 📋 Planeado |
| `domain/finance.md` | Domínio Financeiro — receitas, despesas, reconciliação | 📋 Planeado |
| `domain/reservation.md` | Domínio Reservas — disponibilidade, conflitos, preços | 📋 Planeado |
| `domain/communication.md` | Domínio Comunicação — email, notificações, histórico | 📋 Planeado |

### Volumes — Estado Actual

| Volume | Título | Pasta | Estado |
|---|---|---|---|
| Volume 01 | CRM — Gestão de Leads e Pipeline | docs/04-crm/ | ✅ **CONCLUÍDO** — Sprint CRM-FE-7 (Jul 2026) |
| Volume 02 | ERP Financeiro Integrado | docs/05-erp/ | ✅ **CONCLUÍDO** — Sprint ERP-9 (Jul 2026) |
| Volume 03 | Portal do Cliente + Omnicanal | docs/06-portal/ | ✅ **CONCLUÍDO** — Beta interna (Jul 2026) |
| Volume 04 | Reservas — Sala de Reunião | docs/07-reservas/ | ✅ **CONCLUÍDO** — Sprint VOL04-7 (29 Jul 2026) |
| Volume 05 | Segurança — Auditoria, Sessões, Admin UI | docs/08-seguranca/ | ✅ **CONCLUÍDO** — Sprint VOL05-4 (29 Jul 2026) |
| Volume 06 | Dashboard Executivo & Business Intelligence | docs/09-dashboard/ | ✅ **CONCLUÍDO** — Sprint VOL06-4 (29 Jul 2026) |
| Volume 07 | Comunicação Avançada | docs/10-comunicacao/ | ✅ **CONCLUÍDO** — Sprint VOL07-4 (30 Jul 2026) |
| Volume 08 | Gestão Documental | docs/11-gestao-documental/ | ✅ **CONCLUÍDO** — Sprint VOL08-4 (30 Jul 2026) |
| Volume 09 | Portal do Cliente (Frontend) | docs/12-portal-frontend/ | ✅ **CONCLUÍDO** — Sprint VOL09-5 (30 Jul 2026) |
| Volume 10 | Automações: Email Portal + Faturação Mensal | docs/13-automacoes/ | ✅ **CONCLUÍDO** — Sprint VOL10-4 (30 Jul 2026) |
| Volume 11 | Deployment & Infraestrutura de Produção | docs/14-deployment/ | ✅ **CONCLUÍDO** — Sprint VOL11-4 (30 Jul 2026) |
| Volume 12 | ERP Admin UI + Correcções de Produção | src/app/admin/erp/ | ✅ **CONCLUÍDO** — Sprint VOL12-4 (30 Jul 2026) |
| Volume 13 | API Pública & Webhooks | — | 📋 Planeado (Fase 2 — 2027) |
| Volume 13 | Testes — Estratégia e Cobertura | — | 📋 Planeado |

---

## Como Navegar esta Documentação

### Para Humanos

1. Comece pelo [00-foundation/product-vision.md](./00-foundation/product-vision.md) para entender o que estamos a construir.
2. Leia [00-foundation/architecture.md](./00-foundation/architecture.md) para compreender como está estruturado.
3. Consulte o [00-foundation/domain-model.md](./00-foundation/domain-model.md) antes de qualquer discussão sobre funcionalidades.
4. Antes de implementar qualquer coisa, consulte a [Business Bible](./business-bible/README.md).
5. Antes de tomar qualquer decisão arquitectural, consulte os [ADRs](./adr/README.md).

### Para Claude Code (IA)

> Leia [claude-guide/README.md](./claude-guide/README.md) **antes de qualquer acção** neste repositório.

```
FLUXO OBRIGATÓRIO PARA QUALQUER ALTERAÇÃO:
1. Ler CLAUDE.md (raiz do projecto)
2. Ler docs/claude-guide/README.md
3. Identificar o módulo afectado
4. Ler o README do módulo correspondente em docs/modules/
5. Consultar Business Bible para as regras de negócio relevantes
6. Consultar ADRs para restrições arquitecturais
7. Propor solução → aguardar aprovação → implementar
```

---

## Convenções de Documentação

### Nomenclatura de Ficheiros

```
docs/
├── 00-foundation/          # Volumes numerados com prefixo
├── business-bible/         # Regras de negócio
│   └── BR-NNN-nome.md      # BR = Business Rule, NNN = número sequencial
├── adr/                    # Decisões arquitecturais
│   └── ADR-NNN-titulo.md   # ADR = Architecture Decision Record
├── modules/                # Documentação por módulo
│   └── [modulo]/
│       ├── README.md
│       ├── checklist.md
│       ├── roadmap.md
│       └── diagrams/
└── claude-guide/           # Manual para Claude Code
```

### Estados dos Documentos

| Estado | Símbolo | Significado |
|---|---|---|
| Draft | 📝 | Em elaboração, não aprovado |
| Review | 🔍 | Pronto para revisão |
| Approved | ✅ | Aprovado, pode ser implementado |
| Deprecated | ⛔ | Substituído por versão mais recente |
| Planned | 📋 | Previsto mas não iniciado |

### Nível de Confidencialidade

Todos os documentos deste projecto são **CONFIDENCIAIS** e propriedade de VERSÃO DE NEGÓCIOS - COMÉRCIO GERAL E PRESTAÇÃO DE SERVIÇOS, LDA.

---

## Responsabilidades

| Papel | Responsabilidade |
|---|---|
| **Ernesto Pinto Luciano** | Product Owner, aprovação de volumes, decisões de negócio |
| **Claude (Arquiteto-Chefe)** | Arquitectura, documentação, revisão de código, ADRs |
| **Equipa de Desenvolvimento** | Implementação seguindo a documentação aprovada |

---

## Regra de Ouro

> **Nenhuma linha de código poderá ser escrita sem que exista documentação aprovada correspondente.**

> **Toda alteração ao código implica obrigatoriamente a actualização da documentação.**

> **A velocidade de desenvolvimento é sempre subordinada à qualidade da arquitectura.**

---

*VD Platform Documentation — © 2026 VERSÃO DE NEGÓCIOS - COMÉRCIO GERAL E PRESTAÇÃO DE SERVIÇOS, LDA. Todos os direitos reservados.*
