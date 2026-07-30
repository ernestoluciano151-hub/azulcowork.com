# Relatório Semana 1 — VD Platform Piloto RC-1

> **Período:** Dias 1–7 do piloto  
> **Data de preenchimento:** _____/___/2026  
> **Autor:** [Nome]  
> **Estado:** ☐ VERDE — no track / ☐ AMARELO — atenção / ☐ VERMELHO — intervenção

---

## 1. Resumo Executivo

**Uma frase sobre o estado do piloto esta semana:**

```
[Ex: "Sistema estável, 4 de 5 empresas activas, 2 bugs cosméticos identificados, nenhum incidente crítico."]
```

---

## 2. Métricas Cumulativas (Dias 1–7)

### Utilização

| Métrica | Valor | Comparação D+1 |
|---|---|---|
| Empresas activas (portal) | _____ / 5 | — |
| Sessões de portal únicas | _____ | — |
| Logins via magic link | _____ | — |
| Faturas visualizadas | _____ | — |
| Documentos gerados | _____ | — |
| Documentos descarregados | _____ | — |
| Reservas realizadas | _____ | — |
| Tickets de suporte abertos | _____ | — |
| Tickets de suporte fechados | _____ | — |
| Notificações push enviadas | _____ | — |
| Notificações push entregues | _____ % | — |

### Financeiro

| Métrica | Valor |
|---|---|
| Faturas emitidas na semana | _____ |
| Valor total faturado (AOA) | Kz _____ |
| Pagamentos registados | _____ |
| Valor recebido (AOA) | Kz _____ |
| Despesas aprovadas | _____ |

### Performance (Sentry — semana 1)

| Métrica | Valor | Target | Status |
|---|---|---|---|
| P50 latência /api/* | _____ ms | < 200ms | ☐ OK / ☐ Alto |
| P95 latência /api/* | _____ ms | < 500ms | ☐ OK / ☐ Alto |
| Taxa de erro global | _____ % | < 0.5% | ☐ OK / ☐ Alto |
| Uptime estimado | _____ % | ≥ 99.5% | ☐ OK / ☐ Alto |
| Issues Sentry únicos | _____ | — | — |
| Issues P0/P1 | _____ | 0 | ☐ OK / ☐ Alerta |

---

## 3. Crons — Semana 1

| Cron | Execuções esperadas | Execuções OK | Falhas | Notas |
|---|---|---|---|---|
| erp-daily | 7 | _____ | _____ | |
| communication-daily | 7 | _____ | _____ | |
| portal-rent-due | 7 | _____ | _____ | |
| portal-contract-expiring | 7 | _____ | _____ | |
| portal-payment-overdue | 7 | _____ | _____ | |
| portal-auto-close-tickets | 7 | _____ | _____ | |
| reservations-close | 7 | _____ | _____ | |
| portal-sla-check | 84 | _____ | _____ | |
| portal-notifications-retry | 2016 | _____ | _____ | |

**Taxa de sucesso global dos crons:** _____ %

---

## 4. Estado por Empresa

| Empresa | Perfil | Activa | Logins | Issues | Satisfação |
|---|---|---|---|---|---|
| A | Básico | ☐ | _____ | _____ | ☐ ✅ / ☐ ⚠️ / ☐ ❌ |
| B | Equipa | ☐ | _____ | _____ | ☐ ✅ / ☐ ⚠️ / ☐ ❌ |
| C | Reservas | ☐ | _____ | _____ | ☐ ✅ / ☐ ⚠️ / ☐ ❌ |
| D | Recorrente | ☐ | _____ | _____ | ☐ ✅ / ☐ ⚠️ / ☐ ❌ |
| E | Novo | ☐ | _____ | _____ | ☐ ✅ / ☐ ⚠️ / ☐ ❌ |

---

## 5. Bugs e Issues Semana 1

| ID | Título | Empresa | Prioridade | Estado | Resolução |
|---|---|---|---|---|---|
| | | | ☐ P0/P1/P2/P3 | ☐ Aberto/Fechado | |

---

## 6. Feedback de Utilizadores

### Feedback Positivo

```
[Registar aqui o que os utilizadores referiram como positivo]
```

### Problemas Reportados

```
[Registar aqui problemas reportados pelos utilizadores]
```

### Sugestões de Melhoria

```
[Ideias e sugestões para versões futuras]
```

---

## 7. Fluxos Críticos Validados

| Fluxo | Testado | Resultado | Notas |
|---|---|---|---|
| Login admin + TOTP | ☐ | ☐ OK / ☐ Falhou | |
| Login portal via magic link | ☐ | ☐ OK / ☐ Falhou | |
| Criação de reserva (Empresa C) | ☐ | ☐ OK / ☐ Falhou | |
| Conflict check reserva | ☐ | ☐ OK / ☐ Falhou | |
| Fatura enviada por email | ☐ | ☐ OK / ☐ Falhou | |
| PDF de fatura descarregado | ☐ | ☐ OK / ☐ Falhou | |
| Ticket de suporte criado + respondido | ☐ | ☐ OK / ☐ Falhou | |
| Notificação push recebida | ☐ | ☐ OK / ☐ Falhou | |
| Revogação de sessão admin | ☐ | ☐ OK / ☐ Falhou | |
| Audit log de operações financeiras | ☐ | ☐ OK / ☐ Falhou | |

---

## 8. Ajustes Operacionais

Processos ou configurações ajustadas durante a semana 1:

```
[Ex: "Aumentado timeout de geração de PDF de 30s para 60s (configuração Vercel)"]
```

---

## 9. Decisão para Semana 2

☐ **CONTINUAR** sem alterações — sistema estável  
☐ **AJUSTAR** — correcções menores antes de semana 2  
☐ **PAUSAR** — incidente a resolver antes de continuar  
☐ **ROLLBACK** — situação crítica

**Notas para semana 2:**

```
[Prioridades e pontos de atenção]
```

---

*VD Platform — Relatório Semana 1 — Piloto RC-1 — Preencher no final do Dia 7*
