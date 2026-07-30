# Piloto Controlado RC-1 — VD Platform

> **Tag:** v1.0.0-rc1  
> **Aprovação GO:** Ernesto Pinto Luciano — 30 Jul 2026  
> **Duração:** 14 dias  
> **Estado:** 🟢 EM CURSO

---

## Objectivo

Validar a plataforma VD Platform em condições reais de produção com 3 a 5 empresas do Azul Coworking antes de qualquer lançamento público. O piloto não é um teste — é o início do produto real.

> *"Chegámos ao ponto certo para parar de construir e começar a aprender com utilização real."*  
> — Ernesto Pinto Luciano, 30 Jul 2026

---

## Regras do Piloto

```
🔒 Freeze de funcionalidades activo
✅ Apenas correcções críticas (P0/P1) aprovadas pelo PO
❌ Sem novas funcionalidades
❌ Sem alterações arquitecturais
❌ Sem novas dependências
```

---

## Estrutura das Empresas Piloto

| Empresa | Perfil | O que valida |
|---|---|---|
| **A** | 1–3 colaboradores | Fluxo básico — contrato + fatura + portal |
| **B** | 5–10 colaboradores | Multi-utilizador + volume |
| **C** | Reservas intensivas | Reservas, conflict check, recibos |
| **D** | Cliente recorrente | Migração + renovação |
| **E** | Cliente novo | Ciclo completo: lead → contrato → portal |

---

## Documentos do Piloto

| Documento | Descrição | Preencher quando |
|---|---|---|
| [admin-setup.md](./admin-setup.md) | Criação e activação dos acessos administrativos | Imediatamente após deploy |
| [onboarding/pilot-setup-guide.md](./onboarding/pilot-setup-guide.md) | Guia completo de onboarding por empresa | Após contas admin validadas |
| [monitoring/sentry-dashboards.md](./monitoring/sentry-dashboards.md) | Configuração dos 6 dashboards Sentry | Dia do deploy |
| [day-1-report.md](./day-1-report.md) | Validação deploy + baseline D+1 | Final do Dia 1 |
| [week-1-report.md](./week-1-report.md) | Métricas e estado Dias 1–7 | Final do Dia 7 |
| [week-2-report.md](./week-2-report.md) | Métricas + decisão de lançamento | Final do Dia 14 |
| [pilot-retrospective.md](./pilot-retrospective.md) | Retrospectiva completa + GO/NO-GO público | Pós piloto |

---

## Métricas de Sucesso (14 dias)

| KPI | Target |
|---|---|
| Uptime | ≥ 99.5% |
| Taxa de erro global | < 0.5% |
| Taxa de sucesso dos 11 crons | 100% |
| Empresas activas no portal | 4–5 / 5 |
| Satisfação utilizadores | ≥ 3.5 / 5 |
| Issues P0 | 0 |
| Fluxos críticos validados | ≥ 9 / 10 |

---

## Rotina Diária (15 min)

```
08:30  Sentry — novos erros?
08:35  /admin/auditoria — operações da noite
08:40  Tickets de suporte portal pendentes
08:45  Vercel Logs — crons executaram?
08:50  Registar observações no relatório semanal
```

---

## Escalada de Incidentes

| Severidade | Critério | Acção |
|---|---|---|
| 🔴 P0 | Login impossível, dados corrompidos | Rollback imediato |
| 🟠 P1 | Funcionalidade crítica inoperacional | Fix urgente < 4h |
| 🟡 P2 | Bug cosmético ou UX | Registar → corrigir em v1.1 |
| 🟢 P3 | Sugestão de melhoria | Backlog → Volume 13+ |

---

## Links Rápidos

- Deploy: `docs/release/deployment-checklist.md`
- Rollback: `docs/release/rollback-checklist.md`
- Runbook: `docs/release/production-runbook.md`
- Segurança: `docs/release/security-report.md`
- Issues: `docs/release/known-issues.md`

---

*VD Platform — Piloto RC-1 — 30 Jul 2026*  
*"O melhor software é o que aprende com quem o usa."*
