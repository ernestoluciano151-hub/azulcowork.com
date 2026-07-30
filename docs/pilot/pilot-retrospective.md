# Retrospectiva do Piloto — VD Platform RC-1

> **Período:** 14 dias de piloto controlado  
> **Data:** _____/___/2026  
> **Participantes:** [listar]  
> **Formato:** Retrospectiva técnica + executiva

---

## Preâmbulo

> *"Muitas startups falham porque continuam a desenvolver sem nunca operar com clientes reais. Chegámos ao ponto certo para parar de construir e começar a aprender com utilização real."*
> — Ernesto Pinto Luciano, Aprovação GO RC-1, 30 Jul 2026

Esta retrospectiva encerra o Sprint RC-1 e define o ponto de partida para a v1.0 estável e o crescimento do piloto.

---

## 1. O Que Construímos

**Em números:**

```
12 volumes de desenvolvimento
135+ endpoints de API
34 páginas admin
1 portal completo do cliente
11 automações cron
42 ficheiros de teste (~128 testes)
42 Architecture Decision Records
~100 documentos técnicos
28 variáveis de ambiente
5 empresas piloto
14 dias de operação real
```

**Em capacidade:**

O Azul Coworking passou de zero a uma plataforma capaz de gerir contratos, faturar automaticamente, receber pagamentos, gerir reservas, gerar documentos, comunicar com clientes e monitorizar o negócio em tempo real — tudo num único sistema integrado.

---

## 2. O Que Aprendemos com o Piloto

### 2.1 Utilização Real vs Expectativa

| Funcionalidade | Expectativa | Realidade | Diferença |
|---|---|---|---|
| Magic link — entrega | < 2 min | _____ min | _____ |
| Portal — adopção | 80% das empresas | _____ % | _____ |
| Reservas — volume | 5 no piloto | _____ | _____ |
| Suporte — tempo resposta | < 24h | _____ h | _____ |
| Notificações push | > 90% entrega | _____ % | _____ |

### 2.2 Fluxos que Surpreenderam Positivamente

```
1. [Descrever]
2. [Descrever]
3. [Descrever]
```

### 2.3 Fluxos que Precisam de Trabalho

```
1. [Descrever — ex: criação de contratos sem UI de formulário]
2. [Descrever]
3. [Descrever]
```

### 2.4 O Que os Clientes Usaram Mais

```
[Top 3 funcionalidades mais usadas pelos utilizadores do portal]
1. 
2. 
3. 
```

### 2.5 O Que os Clientes Não Usaram

```
[Funcionalidades disponíveis mas não adoptadas]
1. 
2. 
```

---

## 3. Análise Técnica

### 3.1 Estabilidade

```
Uptime médio 14 dias:     _____ %
Issues P0 encontrados:    _____
Issues P0 resolvidos:     _____
Rollbacks necessários:    _____
Incidentes críticos:      _____
```

### 3.2 Performance

```
P95 latência /api/* média: _____ ms
Crons — taxa de sucesso:   _____ %
Email — taxa de entrega:   _____ %
Push — taxa de entrega:    _____ %
```

### 3.3 Segurança

```
Tentativas de acesso não autorizado: _____
JWT inválidos detectados:            _____
Sessões revogadas:                   _____
Eventos de auditoria registados:     _____
```

### 3.4 Dívida Técnica Gerada no Piloto

| Issue | Prioridade | Volume/Sprint |
|---|---|---|
| | P1/P2/P3 | v1.1 / VOL13 |

---

## 4. Análise de Negócio

### 4.1 Valor Gerado no Piloto

```
Empresas gestidas: _____ / 5 activas
Faturas emitidas:  _____ (Kz _____)
Pagamentos recebidos: _____ (Kz _____)
Reservas processadas: _____
Documentos gerados: _____
Horas poupadas (estimativa): _____ h/semana vs processo manual anterior
```

### 4.2 ROI Estimado do Piloto

```
Tempo investido em desenvolvimento: ~30 dias
Custo estimado de operação mensal (Vercel + Neon + Cloudinary + email): USD _____ /mês
Valor gerado (tempo poupado): _____ h/mês × _____ USD/h = USD _____ /mês
```

### 4.3 Feedback Executivo

```
[Síntese do feedback de Ernesto Pinto Luciano sobre o piloto]
```

---

## 5. O Que Não Está Pronto Para Escala

| Item | Impacto | Plano |
|---|---|---|
| Sem integração EMIS | Pagamentos manuais | VOL14 |
| Sem testes E2E automatizados | Regressões manuais | VOL13 |
| WhatsApp deep-link apenas | Comunicação limitada | VOL15 |
| Formulário de criação de contratos | Onboarding manual | v1.1 |
| PORTAL_JWT_SECRET não obrigatório | Segurança degradada se não configurada | v1.1 |

---

## 6. Decisão Final do Piloto

### Scorecard

| Critério | Target | Resultado | Peso | Score |
|---|---|---|---|---|
| Uptime | ≥ 99.5% | _____ % | Alto | _____/3 |
| Taxa de erro | < 0.5% | _____ % | Alto | _____/3 |
| Satisfação utilizadores | ≥ 3.5/5 | _____ /5 | Alto | _____/3 |
| Fluxos críticos validados | 9/10 | _____ /10 | Médio | _____/2 |
| Crons estáveis | 100% | _____ % | Médio | _____/2 |
| Issues P0: 0 | 0 | _____ | Crítico | _____/3 |

**Score total:** _____ / 16

### Decisão

☐ **🟢 GO PARA LANÇAMENTO PÚBLICO** (score ≥ 13/16 + todos os P0 a zero)  
> O Azul Cowork Enterprise está pronto para receber novos clientes.  
> Próximo passo: publicar v1.0.0, planear onboarding de _____ novas empresas.

☐ **🟡 GO CONDICIONAL** (score 10–12/16 ou P1 abertos)  
> Corrigir: _____  
> Re-avaliar em _____ dias.

☐ **🔴 NO-GO — NOVA ITERAÇÃO** (score < 10/16 ou P0 aberto)  
> Motivo: _____  
> Plano: _____

---

## 7. Roadmap Pós-Piloto

### Imediato (v1.1 — próximas 2 semanas)

```
☐ Resolver KI-001 (PORTAL_JWT_SECRET obrigatório)
☐ Adicionar formulário de criação de contratos na UI
☐ Formatear tab "Reconciliação" em tabela
☐ Configurar npm audit no CI
☐ Documentar Lighthouse baseline
```

### Curto Prazo (Volume 13 — Agosto 2026)

```
☐ Testes E2E com Playwright (5 fluxos críticos)
☐ Melhoria de cobertura de testes (target: 80%)
☐ Optimizações de performance (N+1, bundle size)
```

### Médio Prazo (Volume 14 — Set/Out 2026)

```
☐ Integração EMIS / Multicaixa (Angola)
☐ Multi-tenant (segunda empresa Azul Coworking ou novo cliente SaaS)
☐ API pública (Volume 15 — webhooks para integrações)
```

---

## 8. Agradecimentos

**Às empresas piloto:** Por confiarem na plataforma antes de estar madura.

**À equipa Azul Coworking:** Por executar o onboarding e recolher feedback com rigor.

**Ao Product Owner (Ernesto Pinto Luciano):** Por ter a coragem de dizer "GO" no momento certo — e a sabedoria de saber quando parar de construir e começar a operar.

---

## 9. Assinatura de Encerramento do Piloto

| Papel | Nome | Data | Aprovação |
|---|---|---|---|
| Product Owner | Ernesto Pinto Luciano | _____/___/2026 | ☐ GO / ☐ NO-GO / ☐ Condicional |
| Arquiteto-Chefe | Claude (VD Platform) | _____/___/2026 | — |

---

```
Estado do Projecto após retrospectiva:
☐ OPERACIONAL — PILOTO CONCLUÍDO — LANÇAMENTO PÚBLICO APROVADO
☐ OPERACIONAL — PILOTO CONCLUÍDO — NOVA ITERAÇÃO NECESSÁRIA
```

---

*VD Platform — Retrospectiva do Piloto RC-1*  
*"O melhor software é o que aprende com quem o usa."*
