# Product Vision — VD Platform

> **Documento:** 00-PV-001  
> **Volume:** 00 — Foundation  
> **Estado:** ✅ Aprovado  
> **Versão:** 1.0.0  
> **Data:** Julho 2026  
> **Proprietário:** Ernesto Pinto Luciano  

---

## 1. Declaração de Missão

> *Construir a plataforma de gestão empresarial mais completa e acessível para organizações africanas — unindo CRM, ERP, financeiro, coworking e comunicação numa única interface, com a robustez de um sistema enterprise e a agilidade de uma startup.*

---

## 2. Visão de Longo Prazo (5 anos)

O VD Platform será, em 2031, a plataforma de referência para:

- **Operadores de coworking** em Angola e PALOP
- **PMEs e startups** que precisam de CRM + ERP integrados
- **Escritórios de serviços profissionais** (advocacia, consultoria, contabilidade)
- **Espaços de eventos e formação** com reservas recorrentes
- **Grupos empresariais** com múltiplas unidades de negócio

A plataforma será comparável, em funcionalidade, a:

| Referência | O que adoptamos |
|---|---|
| **HubSpot** | CRM visual, pipeline de vendas, automações |
| **Salesforce** | RBAC granular, relatórios avançados, API robusta |
| **Odoo** | ERP integrado, módulos coesos, gestão financeira |
| **Zoho CRM** | Acessibilidade, personalização, workflows |
| **Shopify Admin** | UX intuitiva, painel de controlo executivo |
| **Microsoft Dynamics** | Auditoria, segurança enterprise, documentação |

**O diferencial** do VD Platform é ser construído para o contexto angolano e africano:
- Moeda AOA (Kwanza) como nativa, com suporte a múltiplas moedas
- Integração com sistemas de pagamento locais (Multicaixa, BCS, referências bancárias)
- Conformidade com a Lei Geral do Trabalho de Angola (Lei n.º 7/15)
- Documentação em Português (Angola) como idioma nativo
- Fuso horário Africa/Luanda por defeito
- Adaptável a outros contextos PALOP

---

## 3. Contexto e Origem

### 3.1 Caso de Uso Fundador: Azul Coworking

O VD Platform nasce a partir das necessidades operacionais reais do **Azul Coworking**:

**Entidade gestora:** VERSÃO DE NEGÓCIOS - COMÉRCIO GERAL E PRESTAÇÃO DE SERVIÇOS, LDA  
**NIF:** 5002174308  
**Localização:** Bairro Azul, Edifício 18, Luanda, Angola  
**Contactos:** 976 467 124 | geral@azulcowork.com | www.azulcowork.com  
**Banking:** BCS | IBAN: AO06007000000212870210113 | SWIFT: CDTSAOLU  

### 3.2 Problemas que a Plataforma Resolve

**Problema 1 — Fragmentação de dados**  
Actualmente, informação de clientes, contratos, pagamentos e reservas existe em sistemas separados (spreadsheets, papel, WhatsApp, email). O VD Platform unifica tudo.

**Problema 2 — Ausência de rastreabilidade financeira**  
Sem um ERP integrado, é impossível ter visibilidade em tempo real sobre receitas, despesas, saldos por cliente e projecções. O módulo financeiro resolve isso com faturas, recibos e notas de liquidação numeradas automaticamente.

**Problema 3 — Comunicação manual e reactiva**  
Lembretes de pagamento, confirmações de reserva e renovações de contrato são feitos manualmente. O VD Platform automatiza estes fluxos via email, WhatsApp e notificações internas.

**Problema 4 — Impossibilidade de escalar**  
Um sistema manual não suporta crescimento. A plataforma foi arquitectada para suportar múltiplas unidades de negócio, múltiplos utilizadores com permissões diferenciadas e milhares de registos.

---

## 4. Módulos da Plataforma

### 4.1 Mapa de Módulos

```
┌─────────────────────────────────────────────────────────────────┐
│                        VD PLATFORM                              │
├──────────────┬──────────────┬──────────────┬────────────────────┤
│     CRM      │    COWORK    │  FINANCEIRO  │    RESERVAS        │
│  ─────────   │  ─────────   │  ─────────   │  ─────────         │
│  Leads       │  Empresas    │  Faturas     │  Sala Reunião      │
│  Pipeline    │  Contratos   │  Pagamentos  │  Leads Sala        │
│  Conversão   │  Colaborad.  │  Despesas    │  Calendário        │
│  Actividades │  Espaços     │  Relatórios  │  Planos            │
│  Timeline    │  Planos      │  ERP         │  Preçário          │
├──────────────┴──────────────┴──────────────┴────────────────────┤
│              MÓDULOS TRANSVERSAIS                               │
├──────────────┬──────────────┬──────────────┬────────────────────┤
│  SEGURANÇA   │ COMUNICAÇÃO  │  DOCUMENTOS  │    DASHBOARD       │
│  ─────────   │  ─────────   │  ─────────   │  ─────────         │
│  RBAC        │  Email       │  Templates   │  Métricas          │
│  2FA TOTP    │  WhatsApp    │  Contratos   │  BI                │
│  Auditoria   │  Notif.      │  Recibos     │  Relatórios        │
│  Sessões     │  Campanhas   │  Propostas   │  Exec. View        │
├──────────────┴──────────────┴──────────────┴────────────────────┤
│              INFRAESTRUTURA                                     │
├──────────────┬──────────────┬──────────────┬────────────────────┤
│  PORTAL      │  API         │  AUTOMAÇÕES  │    EVENTOS         │
│  CLIENTE     │  PÚBLICA     │  ─────────   │  ─────────         │
│  ─────────   │  ─────────   │  Triggers    │  Event Bus         │
│  Self-serve  │  REST        │  Workflows   │  Domain Events     │
│  Facturas    │  Webhooks    │  Schedules   │  Audit Trail       │
│  Reservas    │  Docs        │  Templates   │  Timeline          │
└──────────────┴──────────────┴──────────────┴────────────────────┘
```

### 4.2 Descrição de Cada Módulo

#### CRM — Customer Relationship Management

**Propósito:** Capturar, qualificar e converter potenciais clientes em empresas activas.

Funcionalidades core:
- Landing page pública com formulários de geração de leads
- Pipeline visual com estados configuráveis (NOVO → CONTACTADO → QUALIFICADO → PROPOSTA → CONVERTIDO → PERDIDO)
- Timeline de actividades por lead
- Notas internas por lead
- Exportação CSV/XLSX
- Atribuição de leads a comerciais
- Alertas de leads sem resposta há X dias
- Métricas de conversão por fonte, período, comercial

#### COWORK — Gestão do Espaço de Coworking

**Propósito:** Gerir todas as empresas inquilinas, os seus contratos, colaboradores e utilização dos espaços.

Funcionalidades core:
- Cadastro completo de empresas (dados fiscais, contactos, sala atribuída)
- Gestão de contratos com datas de início/fim e renovação automática
- Alertas de contratos a expirar (60, 30, 15, 7 dias)
- Gestão de colaboradores por empresa
- Registo de serviços complementares consumidos
- Histórico financeiro por empresa
- Portal do cliente (self-service)

#### FINANCEIRO — ERP Financeiro

**Propósito:** Ser a fonte única de verdade financeira da organização.

Funcionalidades core:
- Geração automática de faturas mensais (FT-SALA-YYYY-NNNNNN)
- Registo de pagamentos com recibos (REC-YYYY-NNNNNN)
- Notas de liquidação (NL-YYYY-NNNNNN)
- Gestão de despesas operacionais por categoria
- Dashboard financeiro com receitas, despesas, saldo, projecções
- Relatórios mensais, trimestrais e anuais
- Histórico financeiro auditado por empresa
- Auditoria de todas as operações (FinancialAudit)
- Suporte a pagamento parcial e saldos em aberto
- Exportação para contabilidade externa

#### RESERVAS — Gestão de Sala de Reunião

**Propósito:** Optimizar a ocupação da sala de reunião e simplificar a experiência de reserva.

Funcionalidades core:
- Calendário de ocupação visual
- Múltiplos planos (1h, Meio Dia, Dia Inteiro, Fim de Semana)
- Leads de sala (pedidos de informação online)
- Conversão de leads em reservas
- Pagamento integrado (no dia, antecipado, faturado, isento)
- Coffee break opcional
- Confirmações automáticas por email/WhatsApp
- Relatórios de ocupação e receita por período
- Preçário configurável via admin

#### SEGURANÇA — Security & RBAC

**Propósito:** Garantir que cada utilizador acede apenas ao que lhe é permitido, com rastreabilidade total.

Funcionalidades core:
- Autenticação JWT em cookies httpOnly
- 2FA via TOTP (Google Authenticator)
- RBAC: ADMIN / COMERCIAL / FINANCEIRO / VIEWER
- Auditoria de todas as acções sensíveis
- Pedidos de eliminação de dados (RGPD / LGPD angolana)
- Gestão de sessões activas
- Rate limiting por IP
- Headers de segurança (CSP, HSTS, X-Frame-Options, etc.)

#### COMUNICAÇÃO — Central de Comunicação

**Propósito:** Centralizar toda a comunicação com clientes, eliminando canais dispersos.

Funcionalidades core:
- Email transaccional (Nodemailer / SMTP)
- Geração de links WhatsApp com mensagens pré-definidas
- Notificações internas com sistema de prioridades
- Histórico de comunicações por empresa/lead
- Templates de mensagens configuráveis
- Campanhas de email (futuro)

#### DOCUMENTOS — Gestão Documental

**Propósito:** Gerar, armazenar e rastrear todos os documentos do negócio.

Funcionalidades core:
- Geração de recibos em PDF (react-pdf-renderer + pdfkit)
- Templates de propostas comerciais (.docx)
- Templates de contratos de alocação
- Upload e gestão de documentos (Cloudinary)
- Histórico de documentos por empresa
- Assinatura electrónica (futuro)

#### DASHBOARD — Painel Executivo e BI

**Propósito:** Fornecer visibilidade total do negócio em tempo real.

Funcionalidades core:
- KPIs principais: receita, ocupação, leads, conversão
- Gráficos de tendência (recharts)
- Alertas automáticos (contratos a expirar, pagamentos em atraso)
- Relatórios exportáveis
- Vista executiva (resumo executivo diário)
- Business Intelligence progressivo

---

## 5. Personas e Utilizadores

### Persona 1 — Gestor / Administrador (Ernesto)

**Perfil:** Sócio-gerente, responsável por todas as decisões  
**Necessidade:** Visibilidade total do negócio, aprovação de operações sensíveis  
**Role:** ADMIN  
**Acesso:** Tudo, sem restrições  

### Persona 2 — Assistente Comercial (Teresa)

**Perfil:** Responsável pelo atendimento, gestão de leads, agendamentos  
**Necessidade:** CRM funcional, calendário de reservas, comunicação com clientes  
**Role:** COMERCIAL  
**Acesso:** CRM, Reservas, Comunicação, Dashboard básico. Sem acesso a configurações ou eliminações.  

### Persona 3 — Responsável Financeiro (futuro)

**Perfil:** Responsável pela tesouraria e contabilidade  
**Necessidade:** Faturas, pagamentos, relatórios financeiros, exportações  
**Role:** FINANCEIRO  
**Acesso:** Módulo financeiro completo, sem acesso a configurações de sistema ou dados de RH.  

### Persona 4 — Cliente Final (empresa inquilina)

**Perfil:** Empresa que aluga espaço ou reserva sala de reunião  
**Necessidade:** Ver as suas faturas, fazer reservas, consultar o seu contrato  
**Role:** CLIENT (futuro — Portal do Cliente)  
**Acesso:** Apenas os seus próprios dados.  

### Persona 5 — Visitante / Lead

**Perfil:** Empresa que descobre o Azul Coworking online  
**Necessidade:** Informação clara, formulário de contacto fácil  
**Role:** Público (sem autenticação)  
**Acesso:** Landing page pública e formulário de reserva/lead.  

---

## 6. Proposta de Valor Diferenciada

### 6.1 Para o Operador de Coworking

| Necessidade | Solução VD Platform |
|---|---|
| Saber quem paga e quem está em atraso | Dashboard financeiro em tempo real |
| Gerir contratos sem papelada | Contratos digitais com alertas automáticos |
| Saber a taxa de ocupação da sala | Calendário de reservas com relatórios |
| Comunicar com clientes rapidamente | WhatsApp + Email integrado |
| Ter histórico de tudo | Timeline auditada por empresa e lead |

### 6.2 Para a Equipa Operacional

| Necessidade | Solução VD Platform |
|---|---|
| Não perder leads | CRM com alertas de follow-up |
| Registar pagamentos rapidamente | Interface de registo em 3 cliques |
| Gerar recibos automaticamente | PDF automático com número sequencial |
| Saber o que fazer hoje | Dashboard com tasks e alertas |

### 6.3 Para o Cliente Final

| Necessidade | Solução VD Platform |
|---|---|
| Ver as suas facturas | Portal do cliente com histórico |
| Fazer uma reserva online | Formulário público integrado |
| Receber confirmação | Email + WhatsApp automático |
| Consultar o contrato | Documento acessível no portal |

---

## 7. Métricas de Sucesso do Produto

### 7.1 KPIs Operacionais (Azul Coworking)

| Métrica | Baseline Actual | Meta 6 meses | Meta 12 meses |
|---|---|---|---|
| Tempo para registar um pagamento | ~15 min (manual) | < 2 min | < 1 min |
| Contratos com alertas automáticos | 0% | 100% | 100% |
| Taxa de leads sem resposta > 48h | Desconhecida | < 10% | < 5% |
| Relatório financeiro mensal | 1-2 dias (manual) | Automático | Automático |
| Ocupação sala (visibilidade) | 0% (sem dados) | 100% | 100% |

### 7.2 KPIs de Qualidade de Software

| Métrica | Meta |
|---|---|
| Cobertura de testes | > 80% |
| Tempo de resposta API | < 300ms (p95) |
| Disponibilidade | > 99.5% |
| Documentação | 100% módulos documentados |
| ADR para cada decisão maior | 100% |

---

## 8. Posicionamento Competitivo

### 8.1 Por que não usar soluções existentes?

| Alternativa | Por que não adoptar |
|---|---|
| HubSpot | Caro para PMEs africanas, sem módulo de coworking, USD |
| Salesforce | Muito complexo, muito caro, sem localização Angola |
| Odoo | Complexidade de implementação elevada, custo de customização |
| Zoho CRM | Sem ERP integrado para coworking, USD |
| Excel/Sheets | Sem auditoria, sem automação, não escala, sem segurança |
| Soluções locais Angola | Inexistentes ou de qualidade insuficiente para enterprise |

### 8.2 Posição do VD Platform

O VD Platform ocupa o espaço entre as **soluções demasiado simples** (Excel, WhatsApp) e as **soluções demasiado complexas** (Salesforce, SAP), oferecendo:

- **Complexidade correcta** para o contexto angolano
- **Preço acessível** (SaaS com modelo por subscrição — futuro)
- **Localização nativa** (AOA, português, fuso Angola, leis locais)
- **Extensibilidade** (arquitectura preparada para crescer)
- **Qualidade enterprise** (auditoria, RBAC, segurança, documentação)

---

## 9. Roadmap de Alto Nível

### Fase 0 — Consolidação (Actual → Setembro 2026)
*Documentar, auditar e estabilizar o código existente*
- ✅ Arquitectura definida
- ✅ Documentação foundation criada
- 📋 Auditoria do código existente
- 📋 Testes unitários e de integração
- 📋 RBAC completo implementado

### Fase 1 — Produto Completo para Azul Coworking (Set → Dez 2026)
*Tornar o VD Platform totalmente operacional para o Azul Coworking*
- Portal do Cliente v1
- Automatizações básicas (alertas, lembretes)
- Gestão documental (propostas, contratos)
- Dashboard executivo completo
- API interna documentada

### Fase 2 — Multi-tenant v1 (Jan → Jun 2027)
*Tornar a plataforma utilizável por outros operadores de coworking*
- Arquitectura multi-tenant
- Onboarding de novos clientes
- Planos de subscrição
- Suporte multi-moeda
- API pública com autenticação OAuth

### Fase 3 — SaaS de Mercado (Jul 2027 → …)
*Expansão para outros sectores e geografias*
- Mobile app (iOS + Android)
- Integrações com ERPs externos
- BI avançado com ML
- Marketplace de módulos
- Expansão PALOP

---

## 10. Critérios de Aceitação do Produto

Um módulo só é considerado **completo e pronto para produção** quando:

- [ ] Todos os fluxos principais funcionam sem erros
- [ ] Existe documentação aprovada correspondente
- [ ] Todas as regras de negócio (Business Bible) estão implementadas
- [ ] Testes com cobertura > 80%
- [ ] RBAC implementado e testado
- [ ] Auditoria de operações sensíveis activa
- [ ] UX validada com o utilizador real
- [ ] Performance validada (< 300ms em operações normais)
- [ ] Security review realizado
- [ ] ADR criado para decisões arquitecturais do módulo

---

*VD Platform — Product Vision v1.0.0 — Julho 2026*  
*VERSÃO DE NEGÓCIOS - COMÉRCIO GERAL E PRESTAÇÃO DE SERVIÇOS, LDA*
