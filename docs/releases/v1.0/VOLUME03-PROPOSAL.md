# Proposta Formal — Volume 03: Portal do Cliente + Comunicação Omnicanal

> **Documento:** VOL03-PROP-001  
> **Data:** 29 Julho 2026  
> **Estado:** 🟡 AGUARDA APROVAÇÃO DO PRODUCT OWNER  
> **Emitido por:** Claude (Arquiteto-Chefe VD Platform)  
> **Rule 15 CLAUDE.md:** Propor e aguardar aprovação quando a mudança afecta múltiplos módulos

---

## Contexto e Sequência Proposta

O Product Owner solicitou a seguinte sequência após o RC v1.0:

```
1. Fechar Release Candidate v1.0     ← RC v1.0 gerado (este release package)
2. Iniciar Volume 03 — Portal do Cliente
3. Implementar Comunicação Omnicanal
4. Publicar beta interna para empresas piloto
5. Recolher feedback operacional real
```

**O passo 1 está concluído.** Os passos 2–5 são descritos abaixo como proposta formal.

---

## ⚠️ Pré-condição Obrigatória

**O Volume 03 NÃO pode iniciar antes de:**

```
□ RC v1.0.0 aprovado pelo Product Owner
□ Smoke tests em produção realizados (PRODUCTION-CHECKLIST.md, SECÇÃO 7)
□ Primeiro contrato ERP real activo em produção
□ Primeiro ciclo de faturação ERP completado (fatura → pagamento → recibo)
□ Ernesto (PO) valida o ERP em produção com dados reais
```

**Justificação:** O Portal do Cliente consome as APIs de contratos, faturas e pagamentos do ERP.
Se o ERP não estiver validado em produção com dados reais, qualquer problema descoberto
no ERP durante o Volume 03 obrigará a alterar APIs já integradas no portal — criando dívida.
APIs maduras primeiro; portal depois. (Ver decisão estratégica no erp-roadmap.md)

---

## Passo 2 — Volume 03: Portal do Cliente

### O que é

Uma área autenticada em `/portal/*` onde os clientes (empresas do Azul Coworking)
acedem aos seus próprios dados: faturas, pagamentos, contrato actual, saldo em conta.

### Proposta de Sprints

| Sprint | Objectivo | Duração estimada |
|---|---|---|
| VOL03-0 | Especificação completa (10-step methodology) | 1 semana |
| VOL03-1 | Auth do portal (token separado do admin) + schema | 1 semana |
| VOL03-2 | Dashboard do cliente (contrato, saldo, próxima fatura) | 1 semana |
| VOL03-3 | Histórico de faturas + download de PDFs | 3 dias |
| VOL03-4 | Histórico de pagamentos + recibos | 3 dias |
| VOL03-5 | Perfil da empresa (dados + contactos) | 3 dias |

**Total estimado:** 5–6 semanas (Agosto–Setembro 2026)

### Questões Arquitecturais a Resolver (VOL03-0)

Antes de implementar, estas decisões devem ser tomadas e documentadas como ADRs:

1. **Autenticação do Portal:** JWT separado (diferente do admin)? Magic link por email? Credenciais criadas pelo admin?
2. **Escopo de dados:** O cliente vê dados do módulo legado (invoices) ou apenas ERP (ErpInvoice)?
3. **Multi-tenant:** Uma empresa → um utilizador portal, ou múltiplos contactos podem aceder?
4. **URL do portal:** `azulcowork.com/portal` ou subdomínio separado `portal.azulcowork.com`?
5. **Língua:** Português (Angola) apenas, ou multi-língua?

**Estas questões requerem decisão do PO antes de qualquer código.**

---

## Passo 3 — Comunicação Omnicanal

### O que é

Sistema de comunicação proactiva com clientes através de múltiplos canais:
email (já existe), WhatsApp Business API, SMS (via gateway Angola), notificações push no portal.

### Proposta de Sprints

| Sprint | Objectivo | Duração estimada |
|---|---|---|
| OMNI-0 | Especificação + escolha de providers | 1 semana |
| OMNI-1 | Canal Email v2 (templates melhorados + tracking de abertura) | 3 dias |
| OMNI-2 | Canal WhatsApp (WhatsApp Business API ou Twilio) | 1 semana |
| OMNI-3 | Canal SMS (gateway local Angola) | 3 dias |
| OMNI-4 | Notificações in-app no portal | 3 dias |
| OMNI-5 | Orquestrador Omnicanal (preferências por cliente) | 1 semana |

**Total estimado:** 4–5 semanas (Setembro–Outubro 2026)

### Questões a Resolver (OMNI-0)

1. **WhatsApp:** WhatsApp Business API (Meta) ou Twilio? Ambos têm custos recorrentes.
2. **SMS Angola:** Qual o provider/gateway SMS disponível em Angola com cobertura adequada?
3. **Opt-in/Opt-out:** Como gerir preferências de comunicação por cliente?
4. **Custo por mensagem:** Qual o budget disponível para APIs de messaging?
5. **Compliance Angola:** Existem regulações locais de comunicação comercial a cumprir?

**Estas questões requerem pesquisa de mercado Angola + decisão do PO.**

---

## Passo 4 — Beta Interna para Empresas Piloto

### O que é

Activar o portal para 3–5 empresas seleccionadas do Azul Coworking durante 4 semanas
antes de tornar disponível para todos os clientes.

### Critérios de Selecção das Empresas Piloto

```
□ Empresa com ≥ 3 meses de histórico no Azul Coworking
□ Contacto principal acessível (responde emails rapidamente)
□ Tolerância a bugs ocasionais (beta testers)
□ Diversidade: pequena empresa + média empresa
□ Recomendação: 3–5 empresas máximo (não sobrecarregar com feedback)
```

### O que o PO Precisa de Fazer (Claude não pode fazer isto)

```
□ Seleccionar as empresas piloto
□ Contactar as empresas e obter consentimento explícito para o beta
□ Criar credenciais de acesso ao portal para cada empresa
□ Agendar sessão de onboarding (30 min por empresa)
□ Definir canal de reporte de bugs (email, WhatsApp, formulário?)
□ Definir duração do beta (recomendado: 4 semanas)
```

**Nota:** Claude pode preparar os templates de email de convite para o beta,
o guia de onboarding para as empresas piloto e o formulário de feedback
quando esta fase estiver aprovada.

---

## Passo 5 — Recolha de Feedback Operacional

### O que é

Processo estruturado de recolha e análise de feedback das empresas piloto durante o beta.

### Instrumentos de Feedback (a preparar por Claude quando aprovado)

1. **Formulário de feedback semanal** (Google Forms ou similar)
2. **Session recording** (Hotjar ou FullStory no portal) — requer aprovação RGPD
3. **Entrevistas de utilizador** (30 min) — 1 por empresa piloto ao fim do beta
4. **Bug tracker simplificado** (GitHub Issues ou Notion)

### O que o PO Precisa de Fazer

```
□ Conduzir as entrevistas (Claude não tem acesso aos clientes)
□ Compilar feedback nos templates preparados por Claude
□ Priorizar bugs e melhorias para o sprint pós-beta
□ Decidir go/no-go para lançamento geral
```

---

## Decisão Solicitada ao Product Owner

Para que Claude possa iniciar a implementação do Volume 03, o PO deve:

```
□ 1. Aprovar o RC v1.0.0 (PRODUCTION-CHECKLIST.md, SECÇÃO 10)
□ 2. Confirmar que o ERP está validado em produção com dados reais
□ 3. Responder às questões arquitecturais do VOL03-0 (ver lista acima)
□ 4. Confirmar o budget/provider para Comunicação Omnicanal
□ 5. Dar autorização explícita para iniciar Volume 03

Mensagem de autorização sugerida:
"avança para Volume 03 — Portal do Cliente. Auth: [decisão]. URL: [decisão]. Omnicanal: [providers escolhidos]."
```

---

## Estimativa de Esforço Total (Passos 2–5)

| Fase | Duração | Target |
|---|---|---|
| Aprovar RC v1.0 + validar ERP em produção | 1–2 semanas | Ago 2026 |
| Volume 03: Portal do Cliente | 5–6 semanas | Ago–Set 2026 |
| Comunicação Omnicanal | 4–5 semanas | Set–Out 2026 |
| Beta interna (4 semanas) | 4 semanas | Out–Nov 2026 |
| Recolha e análise de feedback | 2 semanas | Nov 2026 |
| **Total** | **~18 semanas** | **Nov–Dez 2026** |

---

*VD Platform — Proposta Volume 03 v1.0 — 29 Julho 2026*  
*Aguarda aprovação: Ernesto Pinto Luciano (Product Owner)*
