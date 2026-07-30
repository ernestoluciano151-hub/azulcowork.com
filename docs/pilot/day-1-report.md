# Relatório D+1 — VD Platform Piloto RC-1

> **Data:** _____/___/2026  
> **Sprint:** RC-1 Piloto — Dia 1  
> **Autor:** [Nome]  
> **Estado:** ☐ NORMAL / ☐ DEGRADADO / ☐ INCIDENTE

---

## 1. Deploy e Activação

| Item | Estado | Observações |
|---|---|---|
| Deploy Vercel concluído | ☐ ✅ / ☐ ❌ | |
| Migrations executadas sem erro | ☐ ✅ / ☐ ❌ | |
| Seed executado | ☐ ✅ / ☐ ❌ | |
| 11 crons activos | ☐ ✅ / ☐ ❌ | |
| Sentry a receber eventos | ☐ ✅ / ☐ ❌ | |
| TOTP 2FA activado (admin) | ☐ ✅ / ☐ ❌ | |
| Smoke test 15 passos | ☐ ✅ / ☐ ❌ | |
| Backup BD executado | ☐ ✅ / ☐ ❌ | |

---

## 2. Empresas Onboardadas

| Empresa | Perfil | Conta criada | Contrato activo | Utilizador portal | Magic link enviado | Portal acessado |
|---|---|---|---|---|---|---|
| A | Básico | ☐ | ☐ | ☐ | ☐ | ☐ |
| B | Equipa | ☐ | ☐ | ☐ | ☐ | ☐ |
| C | Reservas | ☐ | ☐ | ☐ | ☐ | ☐ |
| D | Recorrente | ☐ | ☐ | ☐ | ☐ | ☐ |
| E | Novo | ☐ | ☐ | ☐ | ☐ | ☐ |

**Empresas activas no final do D+1:** _____ / 5

---

## 3. Métricas de Baseline (Sentry D+1)

Registar valores observados:

| Métrica | Valor | Status |
|---|---|---|
| P50 latência /api/* | _____ ms | ☐ OK / ☐ Alto |
| P95 latência /api/* | _____ ms | ☐ OK / ☐ Alto |
| Taxa de erro global | _____ % | ☐ OK / ☐ Alto |
| Erros únicos (issues) | _____ | ☐ OK / ☐ Alto |
| Sessões portal activas | _____ | — |
| Magic links enviados | _____ | — |
| Magic links clicados | _____ | — |

**Target de referência:** latência P95 < 500ms, taxa de erro < 0.5%

---

## 4. Crons — Verificação D+1

| Cron | Hora execução | Estado | Erros |
|---|---|---|---|
| erp-daily | ___:___ WAT | ☐ OK / ☐ FALHOU | |
| communication-daily | ___:___ WAT | ☐ OK / ☐ FALHOU | |
| portal-rent-due | ___:___ WAT | ☐ OK / ☐ FALHOU | |
| portal-contract-expiring | ___:___ WAT | ☐ OK / ☐ FALHOU | |
| portal-payment-overdue | ___:___ WAT | ☐ OK / ☐ FALHOU | |
| portal-auto-close-tickets | ___:___ WAT | ☐ OK / ☐ FALHOU | |
| reservations-close | ___:___ WAT | ☐ OK / ☐ FALHOU | |
| portal-sla-check (x12) | A cada 2h | ☐ OK / ☐ FALHOU | |
| portal-notifications-retry (x288) | A cada 5min | ☐ OK / ☐ FALHOU | |

---

## 5. Incidentes D+1

| # | Hora | Empresa afectada | Descrição | Severidade | Estado |
|---|---|---|---|---|---|
| — | — | — | Nenhum incidente | — | — |

---

## 6. Feedback Inicial de Utilizadores

| Empresa | Utilizador | Feedback | Tipo |
|---|---|---|---|
| | | | ☐ Bug / ☐ UX / ☐ Positivo |
| | | | ☐ Bug / ☐ UX / ☐ Positivo |
| | | | ☐ Bug / ☐ UX / ☐ Positivo |

---

## 7. Acções Imediatas (Issues D+1)

| # | Issue | Prioridade | Responsável | Prazo |
|---|---|---|---|---|
| | | ☐ P0 / ☐ P1 / ☐ P2 | | |

---

## 8. Estado Geral D+1

**Decisão:**

☐ **CONTINUAR** — sistema estável, piloto avança normalmente  
☐ **MONITORIZAR** — incidentes menores, equipa em atenção  
☐ **ROLLBACK** — incidente crítico, activar `rollback-checklist.md`

**Notas:**

```
[Escrever observações livres aqui]
```

---

*VD Platform — Relatório D+1 — Piloto RC-1 — Preencher no final do dia 1 após deploy*
