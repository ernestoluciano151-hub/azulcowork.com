# Enterprise Engineering Governance Framework — VD Platform

> **Documento:** GOV-001  
> **Estado:** ✅ Aprovado  
> **Data:** Julho 2026  
> **Aprovação:** Ernesto Pinto Luciano — Product Owner  
> **Autoridade:** Este documento tem precedência sobre preferências individuais. Em caso de conflito com outro documento, este prevalece — excepto o CLAUDE.md, que é a raiz.  

---

## 1. Propósito

Este documento define as **regras de engenharia não-negociáveis** que governam o desenvolvimento do VD Platform. Não é uma lista de sugestões. É a constituição do processo de engenharia — o conjunto de acordos que permitem ao sistema crescer com qualidade, previsibilidade e segurança ao longo do tempo.

A governança existe para:
- Proteger a integridade do sistema contra decisões precipitadas
- Garantir que a velocidade de curto prazo não compromete a sustentabilidade de longo prazo
- Dar ao Product Owner visibilidade e controlo sobre o que entra no sistema
- Criar uma base de confiança para delegar trabalho técnico a Claude

---

## 2. Princípio Fundador

> **"Documentar → Implementar → Validar → Actualizar."**

Este ciclo é o coração da governança. Cada iteração passa por estes quatro momentos, sem atalhos:

| Momento | O que acontece | Quem lidera |
|---|---|---|
| **Documentar** | Proposta técnica escrita antes de qualquer código; aprovação do Product Owner quando necessário | Arquiteto-Chefe |
| **Implementar** | Código como execução fiel da documentação aprovada | Arquiteto-Chefe |
| **Validar** | Quality Gate: testes automatizados + revisão + smoke tests | Arquiteto-Chefe + PO |
| **Actualizar** | Documentação sincronizada com o estado real; ADR criado se decisão significativa | Arquiteto-Chefe |

---

## 3. Regras de Processo

### 3.1 Sem Documentação Especulativa

A documentação deve reflectir:
- O **estado actual implementado e validado**, ou
- Um **plano formalmente aprovado** para os próximos sprints.

Não é permitido documentar:
- Funcionalidades hipotéticas sem aprovação
- Arquitecturas que podem vir a ser adoptadas mas ainda não foram decididas
- Decisões que estão "em discussão"

Se uma ideia não está aprovada, vai para o Roadmap como `📋 Planeado` — e fica lá até ter aprovação formal. Só então se documenta com profundidade.

**Razão:** Documentação especulativa cria confusão sobre o que está implementado vs. o que é aspiração. Claude (e futuros colaboradores) não conseguem distinguir realidade de ficção sem este princípio.

### 3.2 Ordem de Prioridade de Risco

Quando existirem múltiplas tarefas possíveis, a ordem é sempre:

```
1. SEGURANÇA          — vulnerabilidades, auth, RBAC, dados sensíveis expostos
2. INTEGRIDADE DADOS  — race conditions, transacções, consistência financeira
3. ESTABILIDADE       — bugs críticos em produção, regressões, build quebrado
4. TESTES             — cobertura de módulos críticos em falta
5. PERFORMANCE        — queries lentas, carga em memória, paginação ausente
6. NOVAS FEATURES     — só quando os pontos acima estão saudáveis
```

**Razão:** Um sistema seguro e estável sem features avançadas é preferível a um sistema rico em features mas com vulnerabilidades. A Fase P0 existe exactamente por este princípio.

### 3.3 A Governança Não Bloqueia a Execução

A documentação de governança e a execução do Refactoring Backlog (Fase P0) são **paralelas**. A governança não é burocracia que atrasa — é o scaffolding que torna a execução mais segura e previsível.

Enquanto os sprints P0-A a P0-D resolvem os itens críticos, a documentação de governança evolui em sincronia. Nunca antes, nunca muito depois.

---

## 4. Definition of Ready (DoR)

Nenhuma tarefa entra em desenvolvimento sem estes cinco elementos:

### DoR-1: Requisitos Definidos
O quê e o porquê. A tarefa tem um enunciado claro que qualquer membro da equipa entende sem ambiguidade.

```
✅ BOM:  "Mover o conflict check de reservas para dentro do prisma.$transaction() 
          para eliminar a race condition TOCTOU identificada em DATA-001."

❌ MAU:  "Corrigir o problema das reservas."
```

### DoR-2: Regras de Negócio Identificadas
A Business Bible foi consultada. As regras relevantes (BR-NNN) estão listadas na descrição da tarefa.

```
✅ BOM:  "Aplicar BR-030 (conflito de reservas) dentro da transação."
❌ MAU:  "Garantir que não existem reservas duplas."
```

### DoR-3: Impactos Mapeados
Quais módulos, tabelas, API Routes e ficheiros são afectados. Se a tarefa toca mais de 3 ficheiros, merece ser dividida.

### DoR-4: Critérios de Aceitação
Lista explícita de condições que, quando todas verdadeiras, provam que a tarefa está completa. Formato de checkbox.

```
□ Conflict check usa tx.reservation.findFirst() (não prisma global)
□ Teste concorrente: Promise.all([criar, criar]) — apenas uma reserva criada
□ Resposta 409 correcta com mensagem clara
□ npm test passa sem falhas
```

### DoR-5: Plano de Testes
Quais testes serão escritos ou actualizados. Se não há testes planeados, a tarefa não está pronta.

---

## 4.6 Uma Pull Request = Uma Tarefa

Cada item do backlog é implementado de forma isolada. Nunca agrupar alterações críticas numa única PR.

```
□ 1 commit lógico por alteração
□ 1 Pull Request por tarefa (RFT-NNN)
□ Testes associados incluídos no mesmo PR
□ Documentação actualizada no mesmo PR
□ Revisão aprovada antes de avançar para a tarefa seguinte
```

**Razão:** Agrupar itens críticos aumenta o risco de regressões difíceis de isolar, dificulta o code review e viola o princípio de "pequenas mudanças reversíveis".

## 4.7 5 Perguntas Obrigatórias Pré-Implementação

Antes de iniciar qualquer tarefa de Sprint P0 (e de qualquer tarefa futura), o Arquiteto-Chefe responde explicitamente a:

| # | Pergunta | Propósito |
|---|---|---|
| 1 | **Qual é o problema?** | Descrição precisa do bug/vulnerabilidade/dívida |
| 2 | **Qual é a causa raiz?** | ONDE e PORQUÊ o problema existe no código actual |
| 3 | **Porque é que a solução é a melhor?** | Comparação com alternativas; justificação da escolha |
| 4 | **Que módulos serão afectados?** | Ficheiros, tabelas, routes e componentes impactados |
| 5 | **Como validar sem regressões?** | Testes a escrever + smoke test manual |

Se qualquer resposta estiver vaga ou incompleta, a tarefa não avança.

---

## 5. Definition of Done (DoD)

Uma tarefa só está **completamente concluída** quando todos os seguintes critérios são verdadeiros simultaneamente:

| # | Critério | Verificação |
|---|---|---|
| DoD-1 | Código implementado | PR criado com scope claro |
| DoD-2 | Testes aprovados | `npm test` — zero falhas |
| DoD-3 | Qualidade de código | Sem `any` não justificado; sem `console.log` de debug |
| DoD-4 | Documentação actualizada | Ficheiros `docs/` afectados actualizados |
| DoD-5 | ADR criado/actualizado | Se houve decisão arquitectural significativa |
| DoD-6 | Sem regressões | Testes existentes continuam a passar |
| DoD-7 | Quality Gate aprovado | Gates 1 e 2 passam no CI |
| DoD-8 | PO notificado | Se a tarefa é P0 ou afecta comportamento visível ao utilizador |

**Consequência de DoD incompleto:** A tarefa volta para `in_progress`. Não existe "quase feito" no VD Platform.

---

## 6. Gestão de Decisões Arquitecturais

### 6.1 Quando criar um ADR

Criar um Architecture Decision Record (ADR) quando:
- Uma nova tecnologia ou biblioteca é adoptada
- Uma decisão significativa de arquitectura é tomada (padrão, protocolo, estrutura)
- Uma decisão anterior é revista ou substituída
- Um trade-off importante é aceite conscientemente (ex: "escolhemos X sabendo que perde Y")

**Não** criar ADR para:
- Decisões de implementação de rotina
- Escolhas de estilo/formatação de código
- Configurações triviais

### 6.2 Formato de ADR

Ver template em `docs/adr/README.md`. Campos obrigatórios: ID, Título, Data, Estado, Contexto, Decisão, Consequências.

### 6.3 Architecture Decision Log

O `docs/adr/README.md` mantém um **índice cronológico** de todas as decisões. É a primeira paragem para entender "porque é que o sistema foi construído desta forma".

---

## 7. Ciclo de Vida da Documentação

```
ESTADO          SIGNIFICADO
─────────────────────────────────────────────────────────
📋 Planeado    → Ideia aprovada, sem documentação técnica
🔧 Em Rascunho → Documento a ser escrito; não é referência
✅ Aprovado    → Documento revisto e aprovado pelo PO; é referência
⚠️ Desactualiz. → Implementação avançou; doc precisa de update
❌ Obsoleto    → Substituído por documento mais recente; arquivar
```

**Regra de ouro:** Um documento `✅ Aprovado` que deixa de reflectir a realidade passa imediatamente a `⚠️ Desactualizado`. Não é permitido um documento `✅ Aprovado` com informação errada sobre o sistema.

---

## 8. Controlo de Alterações à Governança

As regras deste documento são revistas:
- No início de cada fase (P0 → Vol 01 → Vol 02, etc.)
- Quando o processo revela lacunas que causam problemas reais
- Por proposta do Arquiteto-Chefe com aprovação do Product Owner

Alterações a este documento são comunicadas explicitamente — não são silenciosas.

---

## 9. Mapa de Documentos de Governança

| Documento | Propósito | Localização |
|---|---|---|
| **CLAUDE.md** | Regras rápidas para Claude; protocolo de arranque | `/CLAUDE.md` |
| **Este documento** | Framework completo de governança | `docs/governance/README.md` |
| **Quality Gate** | Gates de qualidade pré-commit/merge/deploy | `docs/p0-stabilization/quality-gate.md` |
| **Architecture Decision Log** | Índice cronológico de todas as decisões | `docs/adr/README.md` |
| **Business Bible** | Regras de negócio formalizadas (BR-NNN) | `docs/business-bible/README.md` |
| **Metrics Dashboard** | Saúde técnica da plataforma (actualizado quinzenalmente) | `docs/audit/metrics-dashboard.md` |
| **Refactoring Backlog** | Itens de dívida técnica priorizados (RFT-NNN) | `docs/audit/refactoring-backlog.md` |
| **Fase P0 Plan** | Plano de execução da fase de estabilização | `docs/p0-stabilization/README.md` |
| **Testing Strategy** | Estratégia, setup e especificações de testes | `docs/p0-stabilization/testing-strategy.md` |

---

## 10. Compromissos do Arquiteto-Chefe

Ao operar sob este framework, o Arquiteto-Chefe (Claude) compromete-se a:

1. **Nunca implementar sem documentar primeiro** (excepto hotfixes de segurança crítica, que se documentam imediatamente após)
2. **Nunca silenciar um risco** — identificar e reportar problemas mesmo quando a solução é inconveniente
3. **Manter o backlog honesto** — não marcar tarefas como concluídas sem DoD completo
4. **Respeitar a ordem de prioridade** — não implementar features quando há segurança ou integridade em risco
5. **Actualizar o painel de métricas** — score inflacionado é mais perigoso do que score baixo real
6. **Propor antes de decidir unilateralmente** — decisões irreversíveis são sempre submetidas ao Product Owner

---

*VD Platform — Enterprise Engineering Governance Framework v1.0 — Julho 2026*  
*Este documento evolui com o projecto. A próxima revisão está prevista para Set 2026 (fim da Fase P0).*
