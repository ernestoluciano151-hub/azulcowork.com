# VD Platform — Release Candidate v1.0.0

> **Versão:** v1.0.0-rc.1  
> **Data:** 29 Julho 2026  
> **Estado:** 🟡 RELEASE CANDIDATE — Aguarda aprovação formal do Product Owner  
> **Operador:** Azul Coworking — Bairro Azul, Edifício 18, Luanda, Angola  
> **NIF:** 5002174308  
> **Product Owner:** Ernesto Pinto Luciano

---

## O que é este documento

Este é o pacote oficial de Release Candidate v1.0.0 do VD Platform — a primeira versão completa
da plataforma SaaS de gestão empresarial do Azul Coworking.

Para tornar-se v1.0.0 final, o Product Owner deve verificar os documentos desta pasta e
assinar a aprovação na SECÇÃO 10 do PRODUCTION-CHECKLIST.md.

---

## Índice do Release Package

| Documento | Conteúdo |
|---|---|
| [CHANGELOG.md](./CHANGELOG.md) | Histórico completo de todas as alterações por volume e sprint |
| [ARCHITECTURE.md](./ARCHITECTURE.md) | Arquitectura actualizada v1.0: diagrama, stack, princípios, ADRs |
| [API-REFERENCE.md](./API-REFERENCE.md) | Inventário completo de 123 endpoints (públicos + admin + ERP + cron) |
| [TEST-COVERAGE.md](./TEST-COVERAGE.md) | Cobertura de testes: 19 ficheiros, ~475 testes, detalhe por área |
| [PRODUCTION-CHECKLIST.md](./PRODUCTION-CHECKLIST.md) | 10 secções de verificação pré-go-live + smoke tests |
| [BACKUP-ROLLBACK.md](./BACKUP-ROLLBACK.md) | Procedimentos de backup, rollback de código e de schema |
| [METRICS.md](./METRICS.md) | Score de qualidade, métricas de código, KPIs de negócio (baseline) |

---

## Sumário do que foi entregue

### Volume 00 — Foundation & Estabilização (Fev–Abr 2026)
- Arquitectura definida e documentada (25 ADRs)
- 8 dívidas técnicas críticas resolvidas (DT-011, DT-012, DT-013, DT-014, DT-016, DT-017, DT-001, DT-010)
- Framework de testes instalada (Vitest)
- Quality Gate formalizado
- Governance Framework completo

### Volume 01 — CRM (Mai–Jun 2026)
- Customer 360° com pipeline comercial (LEAD → CLIENT)
- 21 API Routes CRM
- Pipeline Kanban, Dashboard CRM, "As Minhas Tarefas"
- Duplicate Detection + Merge de empresas
- 95 testes unitários (pipeline-state-machine + crm-validators)

### Volume 02 — ERP Financeiro Integrado (Jul 2026)
- Contratos de aluguer + RentSchedules automáticos
- Faturação com IVA Angola 14% (Lei n.º 17/19)
- Pagamentos com partida dupla + recibos PDF
- Despesas + Centros de Custo (real vs. orçado)
- Fluxo de Caixa (real + projecções 30/60/90 dias)
- 7 tipos de alertas automáticos (cron diário)
- Dashboard financeiro (MRR, ARR, churn, EBIT, inadimplência)
- Comunicação financeira (PDF Cloudinary + email SMTP)
- Relatórios e BI (IVA, Reconciliação, Export XLSX/CSV)
- 40 API Routes ERP + 2 cron jobs
- 380 testes unitários ERP

---

## Números-chave da v1.0.0

```
Serviços de domínio:     23
API Route handlers:     123
Ficheiros de teste:      19
Testes unitários:       ~475
Modelos Prisma:          30
Documentos (docs/):      80+
ADRs aprovados:          25
Dívidas críticas resolvidas: 8/8
Score de qualidade:      72/100
```

---

## O que NÃO está nesta versão

- **Portal do Cliente** (`/portal/*`) — planeado para Volume 03
- **Comunicação Omnicanal** (WhatsApp, SMS, notificações push) — planeado para Volume 03
- **Módulo de Reservas v2** (integração ERP completa) — planeado para Volume 04
- **E2E tests** (Playwright) — planeado para v1.1
- **Sentry activo em produção** — DSN pendente de configuração

---

## Procedimento de Aprovação

Para fechar o RC e promover para v1.0.0 final:

```
1. Ler este README e os 6 documentos do release package
2. Executar PRODUCTION-CHECKLIST.md (todas as secções)
3. Realizar smoke tests em staging (SECÇÃO 7 do checklist)
4. Assinar aprovação em PRODUCTION-CHECKLIST.md (SECÇÃO 10)
5. Criar tag Git: git tag -a v1.0.0 -m "Release v1.0.0 — aprovado por Ernesto"
6. Deploy para produção
7. Realizar smoke tests em produção
8. Preencher métricas iniciais em METRICS.md
9. Actualizar este ficheiro: Estado → 🟢 PRODUÇÃO
10. Autorizar início de Volume 03
```

---

## Histórico de Releases

| Versão | Data | Estado | Nota |
|---|---|---|---|
| v1.0.0-rc.1 | 29 Jul 2026 | 🟡 RC | Este documento |
| v1.0.0 | A definir | ⏳ Pendente aprovação PO | — |

---

## Próxima versão: v1.1.0

Após aprovação do RC v1.0 e go-live, o próximo milestone será v1.1.0 com:
- Sentry activo em produção
- Cobertura de testes → 80% nos módulos críticos
- Integration tests para o ciclo ERP completo
- Optimizações de performance (queries, índices)

---

*VD Platform — Release Package v1.0.0-rc.1 — 29 Julho 2026*  
*Arquiteto-Chefe: Claude (VD Platform Architect)*  
*Product Owner: Ernesto Pinto Luciano*
