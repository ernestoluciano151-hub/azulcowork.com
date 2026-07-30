# Relatório Semana 2 — VD Platform Piloto RC-1

> **Período:** Dias 8–14 do piloto  
> **Data de preenchimento:** _____/___/2026  
> **Autor:** [Nome]  
> **Este relatório serve de base para a decisão de lançamento público**

---

## 1. Sumário do Piloto Completo (Dias 1–14)

```
[Parágrafo de 3–5 frases resumindo o piloto: o que funcionou, o que falhou, 
o que surpreendeu, qual o estado de confiança para lançamento público]
```

---

## 2. Métricas Acumuladas — 14 Dias

### Utilização Total

| Métrica | Semana 1 | Semana 2 | Total | Meta estimada |
|---|---|---|---|---|
| Empresas activas | _____ | _____ | _____ / 5 | 5/5 |
| Sessões de portal únicas | _____ | _____ | _____ | > 20 |
| Logins via magic link | _____ | _____ | _____ | > 10 |
| Faturas geradas | _____ | _____ | _____ | > 5 |
| Faturas pagas | _____ | _____ | _____ | > 3 |
| Reservas realizadas | _____ | _____ | _____ | > 5 |
| Documentos gerados | _____ | _____ | _____ | > 5 |
| Tickets de suporte | _____ | _____ | _____ | — |
| Tempo médio resolução ticket | — | — | _____ h | < 24h |
| Notificações push entregues | _____ % | _____ % | _____ % | > 90% |

### Performance (14 dias)

| Métrica | Valor final | Target | Status |
|---|---|---|---|
| P95 latência /api/* | _____ ms | < 500ms | ☐ OK / ☐ Falhou |
| Taxa de erro global | _____ % | < 0.5% | ☐ OK / ☐ Falhou |
| Uptime | _____ % | ≥ 99.5% | ☐ OK / ☐ Falhou |
| Taxa de sucesso crons | _____ % | 100% | ☐ OK / ☐ Falhou |
| Issues P0/P1 total | _____ | 0 | ☐ OK / ☐ Falhou |

### Score de Qualidade (actualizar em `docs/audit/metrics-dashboard.md`)

```
Score inicial (Jul 2026): 58/100
Score pré-piloto (Jul 2026): 74/100
Score pós-piloto (estimado): _____/100
Target v1.1: 85/100
```

---

## 3. Estado Final por Empresa

| Empresa | Perfil | Dias activa | Utilizações | Issues | Satisfação final |
|---|---|---|---|---|---|
| A | Básico | _____ | _____ | _____ | ___/5 |
| B | Equipa | _____ | _____ | _____ | ___/5 |
| C | Reservas | _____ | _____ | _____ | ___/5 |
| D | Recorrente | _____ | _____ | _____ | ___/5 |
| E | Novo | _____ | _____ | _____ | ___/5 |

**Satisfação média:** _____ / 5

---

## 4. Bugs e Issues — Inventário Final

| ID | Título | Prioridade | Estado | Resolução |
|---|---|---|---|---|
| | | P0/P1/P2/P3 | Aberto/Fechado | |

**Totais:**
- P0 encontrados: _____ / resolvidos: _____
- P1 encontrados: _____ / resolvidos: _____
- P2 encontrados: _____ / resolvidos: _____
- P3/P4 encontrados: _____

---

## 5. Fluxos Críticos — Status Final

| Fluxo | Semana 1 | Semana 2 | Status final |
|---|---|---|---|
| Login admin + TOTP | ☐ OK/Falhou | ☐ OK/Falhou | ☐ VALIDADO |
| Login portal magic link | ☐ OK/Falhou | ☐ OK/Falhou | ☐ VALIDADO |
| Faturação mensal automática | — | ☐ OK/Falhou | ☐ VALIDADO |
| Reservas + conflict check | ☐ OK/Falhou | ☐ OK/Falhou | ☐ VALIDADO |
| Pagamento + recibo | ☐ OK/Falhou | ☐ OK/Falhou | ☐ VALIDADO |
| Geração PDF + Cloudinary | ☐ OK/Falhou | ☐ OK/Falhou | ☐ VALIDADO |
| Notificações push | ☐ OK/Falhou | ☐ OK/Falhou | ☐ VALIDADO |
| Audit log financeiro | ☐ OK/Falhou | ☐ OK/Falhou | ☐ VALIDADO |
| Suporte + SLA | ☐ OK/Falhou | ☐ OK/Falhou | ☐ VALIDADO |
| Rollback (testado?) | — | ☐ OK/Falhou | ☐ VALIDADO |

**Fluxos validados:** _____ / 10

---

## 6. Aprendizagens do Piloto

### O que funcionou melhor do esperado

```
[Ex: "Email de magic link com entrega < 30 segundos. Portal muito intuitivo para clientes não-técnicos."]
```

### O que precisa de melhorar antes do lançamento público

```
[Ex: "Formulário de criação de contratos ausente na UI força processo manual demorado."]
```

### O que foi subestimado

```
[Ex: "Tempo de onboarding por empresa: estimamos 20 min, levou 40 min em média."]
```

### Surpresas (positivas e negativas)

```
[Ex: "Clientes usaram o portal mais do que esperávamos — 3 logins por semana em média."]
```

---

## 7. Feedback de Utilizadores — Semana 2

### Top 3 feedbacks positivos

```
1. 
2. 
3. 
```

### Top 3 pedidos de melhoria

```
1. 
2. 
3. 
```

---

## 8. Decisão de Lançamento Público

### Critérios de GO para lançamento público

| Critério | Target | Resultado | Status |
|---|---|---|---|
| Uptime 14 dias | ≥ 99.5% | _____ % | ☐ GO / ☐ NO-GO |
| Taxa de erro | < 0.5% | _____ % | ☐ GO / ☐ NO-GO |
| Issues P0 resolvidos | 100% | _____ % | ☐ GO / ☐ NO-GO |
| Issues P1 resolvidos | ≥ 80% | _____ % | ☐ GO / ☐ NO-GO |
| Fluxos críticos validados | ≥ 9/10 | _____ /10 | ☐ GO / ☐ NO-GO |
| Satisfação utilizadores | ≥ 3.5/5 | _____ /5 | ☐ GO / ☐ NO-GO |
| Crons: taxa de sucesso | 100% | _____ % | ☐ GO / ☐ NO-GO |
| Faturação automática testada | Sim | ☐ Sim/Não | ☐ GO / ☐ NO-GO |

**Score GO/NO-GO:** _____ / 8 critérios atingidos

### Recomendação

☐ **🟢 GO — LANÇAMENTO PÚBLICO** — todos os critérios atingidos; avançar para v1.0.0 estável  
☐ **🟡 GO CONDICIONAL** — lançamento com restrições; corrigir _____ issues antes de escalar  
☐ **🔴 NO-GO — EXTENSÃO DO PILOTO** — resolver _____ antes de considerar lançamento público  

**Justificação:**

```
[Fundamentação da decisão]
```

---

## 9. Próximos Passos (pós-piloto)

```
☐ Publicar release v1.0.0 estável (remover tag rc)
☐ Onboarding de [N] empresas adicionais em Agosto
☐ Implementar KI-001 (PORTAL_JWT_SECRET obrigatório)
☐ Planear Volume 13 (E2E tests) e Volume 14 (EMIS)
☐ Actualizar score em docs/audit/metrics-dashboard.md
☐ Comunicar resultado ao Product Owner
```

---

*VD Platform — Relatório Semana 2 — Piloto RC-1 — Preencher no final do Dia 14*  
*"O piloto não é um teste. É o início do produto real."*
