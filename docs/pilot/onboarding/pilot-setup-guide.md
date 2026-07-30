# Guia de Onboarding — Piloto Controlado v1.0.0-rc1

> **Data:** 30 Julho 2026  
> **Sprint:** RC-1 Piloto  
> **Audiência:** Ernesto Pinto Luciano (operador) + Equipa Azul Coworking  
> **Duração estimada por empresa:** 20–30 minutos

---

## Visão Geral do Piloto

O piloto RC-1 valida o sistema com **3 a 5 empresas reais** do Azul Coworking durante **14 dias consecutivos**. O objectivo não é testar software — é aprender com utilização real e validar o modelo operacional.

**Perfis recomendados:**

| Empresa | Perfil | O que valida |
|---|---|---|
| **A** | 1–3 colaboradores, coworking básico | Fluxo simples — contrato + fatura mensal |
| **B** | 5–10 colaboradores, espaço dedicado | Volume + múltiplos utilizadores de portal |
| **C** | Utiliza sala de reuniões intensivamente | Reservas, pricing, pagamentos |
| **D** | Contrato mensal recorrente (já é cliente) | Migração de dados existentes + renovação |
| **E** | Cliente novo (onboarding completo) | Ciclo completo: lead → contrato → portal |

---

## Sequência de Onboarding por Empresa

Para cada empresa, executar nesta ordem:

### Passo 1 — Criar Empresa no CRM

```
/admin/crm → "+ Nova Empresa"
```

Campos a preencher:
- **Nome:** [Nome da empresa]
- **NIF:** [NIF angolano — 10 dígitos]
- **Email:** [email de contacto principal]
- **Telefone/WhatsApp:** [+244...]
- **Endereço:** [Luanda, Angola]
- **Tipo de Plano:** [INDIVIDUAL / EQUIPA / CORPORATIVO / SALA_PRIVADA]
- **Renda Mensal:** [valor em AOA]
- **Número de Membros:** [n]
- **Notas:** [observações relevantes]

### Passo 2 — Criar Contrato ERP

```
/admin/erp/contratos → clicar na empresa → criar contrato via API
```

**Via API (até formulário UI estar disponível — KI-006):**

```bash
curl -X POST https://app.azulcowork.com/api/erp/contracts \
  -H "Cookie: vd_admin_session=TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "companyId": "UUID_DA_EMPRESA",
    "planType": "CORPORATIVO",
    "startDate": "2026-08-01",
    "endDate": "2027-07-31",
    "monthlyRent": 150000,
    "deposit": 150000,
    "autoRenew": true,
    "notes": "Piloto RC-1"
  }'
```

Activar o contrato:
```bash
curl -X POST https://app.azulcowork.com/api/erp/contracts/CONTRACT_ID/activate \
  -H "Cookie: vd_admin_session=TOKEN"
```

### Passo 3 — Criar Utilizador de Portal

```
/admin/portal/utilizadores → "+ Novo Utilizador"
```

Campos:
- **Nome:** [Nome do responsável]
- **Email:** [email para magic link]
- **ID da Empresa:** [UUID obtido no Passo 1]
- **Papel:** OWNER (para o responsável principal)

O sistema envia automaticamente:
- Email de boas-vindas com instruções
- Link de primeiro acesso ao portal

### Passo 4 — Gerar Fatura Inicial

```
/admin/erp/faturas → "+ Emitir Fatura"
```

Ou via cron (automático no dia 1 do mês). Para o piloto, gerar manualmente:

```bash
curl -X POST https://app.azulcowork.com/api/erp/invoices \
  -H "Cookie: vd_admin_session=TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "contractId": "UUID_DO_CONTRATO",
    "type": "MONTHLY_RENT",
    "dueDate": "2026-08-10"
  }'
```

Emitir (passa de DRAFT para ISSUED):
```bash
curl -X POST https://app.azulcowork.com/api/erp/invoices/INVOICE_ID/issue \
  -H "Cookie: vd_admin_session=TOKEN"
```

Enviar por email:
```bash
curl -X POST https://app.azulcowork.com/api/erp/invoices/INVOICE_ID/send \
  -H "Cookie: vd_admin_session=TOKEN"
```

### Passo 5 — Criar Template de Documento

Usar templates existentes em `/admin/configuracoes/document-templates` ou criar:

```
/admin/configuracoes/document-templates → "+ Novo Template"
Tipo: PROPOSAL ou CONTRACT
Nome: "Proposta Coworking" / "Contrato de Coworking"
```

Gerar documento para a empresa:
```
/admin/crm/[id] → "Gerar Proposta" ou /admin/erp/contratos → "Gerar Contrato"
```

### Passo 6 — Confirmar Canal de Suporte

O canal de suporte está integrado no portal. Instruir o cliente a:

```
Portal → Suporte → "Novo Ticket"
```

A equipa Azul Coworking recebe o ticket em `/admin/comunicacao` e pode responder directamente.

---

## Perfis Detalhados das 5 Empresas

### Empresa A — Coworking Básico (1–3 colaboradores)

**Objectivo:** Validar o fluxo mais simples. Contrato básico, fatura mensal, acesso ao portal.

**Configuração:**
```
Plano:       INDIVIDUAL ou EQUIPA
Renda:       [valor real]
Membros:     1–3
Utilizadores portal: 1 (OWNER)
Reservas:    Nenhuma esperada
Documentos:  Contrato de Coworking
```

**Métricas específicas a observar:**
- Magic link chegou? Em quanto tempo?
- O cliente conseguiu aceder ao portal sem ajuda?
- A fatura está correcta (valor, IVA, numeração)?

---

### Empresa B — Espaço Dedicado (5–10 colaboradores)

**Objectivo:** Validar multi-utilizador de portal + volume de faturas.

**Configuração:**
```
Plano:       CORPORATIVO ou SALA_PRIVADA
Renda:       [valor real — tipicamente maior]
Membros:     5–10
Utilizadores portal: 2–3 (1 OWNER + 1–2 ADMIN)
Reservas:    Pode usar sala de reuniões
Documentos:  Contrato + Proposta
```

**Métricas específicas:**
- Múltiplos utilizadores conseguem aceder ao portal em paralelo?
- RBAC do portal funciona? (VIEWER não deve ver dados financeiros de outros)
- Notificações push chegam a múltiplos dispositivos?

---

### Empresa C — Utilizadora Intensiva de Sala

**Objectivo:** Validar sistema de reservas sob carga real.

**Configuração:**
```
Plano:       CORPORATIVO (com acesso a sala de reuniões)
Renda:       [valor real]
Utilizadores portal: 1–2
Reservas:    Mínimo 5 reservas durante o piloto
Documentos:  Recibo de reserva
```

**Métricas específicas:**
- Conflict check funciona? (tentar reservar slot já ocupado)
- Preço calculado correctamente para cada tipo de reserva?
- Recibo chega por email após pagamento?
- Cron reservations-close encerra reservas passadas?

---

### Empresa D — Cliente Recorrente (Migração)

**Objectivo:** Validar migração de dados existentes para o novo sistema.

**Configuração:**
```
Plano:       [plano actual]
Renda:       [renda actual — inserir valor histórico]
Histórico:   Registar pagamentos anteriores (últimos 3 meses)
Utilizadores portal: 1 (utilizador principal)
```

**Processo de migração:**
1. Criar empresa no CRM com dados reais
2. Criar contrato com `startDate` retroactiva (data real de início)
3. Criar faturas históricas em estado PAID para os últimos 3 meses
4. Registar pagamentos históricos

**Métricas específicas:**
- O histórico financeiro aparece correctamente no portal?
- O cliente reconhece os seus dados como corretos?
- A projecção de fluxo de caixa reflecte o histórico?

---

### Empresa E — Cliente Novo (Onboarding Completo)

**Objectivo:** Validar o ciclo completo desde o primeiro contacto.

**Configuração:**
```
Origem:      Lead capturado no site (landing page) ou referência
Plano:       A definir no processo de onboarding
Fluxo:       Lead → Reunião → Proposta → Contrato → Portal
```

**Processo:**
1. Criar Lead em `/admin/leads` (ou chegou do site)
2. Qualificar lead: mudar status para QUALIFICADO → PROPOSTA → FECHADO_GANHO
3. Converter lead em Company: botão "Converter" no Customer 360°
4. Criar contrato ERP para a nova empresa
5. Enviar proposta documental
6. Activar portal do cliente
7. Aguardar primeiro login do cliente no portal

**Métricas específicas:**
- Quanto tempo levou o ciclo completo lead → cliente activo?
- O cliente precisou de ajuda para aceder ao portal?
- A timeline da empresa mostra todos os eventos correctamente?

---

## Canal de Suporte Interno (Equipa Azul Coworking)

Durante o piloto, monitorizar activamente:

```
/admin/comunicacao         → Mensagens e comunicações
/admin/crm/tarefas         → Tarefas pendentes da equipa
/admin/auditoria           → Log de todas as operações
/admin/erp/contratos       → Estado dos contratos das 5 empresas
Sentry dashboard           → Erros em tempo real
```

**Rotina diária durante o piloto (15 min):**

```
08:30  Verificar Sentry — novos erros?
08:35  Verificar /admin/auditoria — operações da noite
08:40  Verificar tickets de suporte portal pendentes
08:45  Verificar crons executaram (Vercel Logs)
08:50  Registar observações no day-X-report.md
```

---

## Gestão de Incidentes Durante o Piloto

Se uma empresa reportar um problema:

```
1. Registar: empresa, hora, o que estava a fazer, mensagem de erro
2. Reproduzir: tentar replicar o problema internamente
3. Sentry: verificar se há stack trace associado
4. Decisão em 30 min:
   - Bug crítico (dados errados, login impossível) → correcção urgente + comunicar
   - Bug cosmético (UI) → registar em known-issues.md → corrigir em v1.1
   - Dúvida de utilização → responder via /admin/comunicacao
5. Registar no relatório semanal
```

---

## Comunicação com Clientes

Mensagem de introdução sugerida (adaptar):

> *Bem-vindo ao novo sistema de gestão Azul Coworking! A partir de agora, tem acesso a uma área exclusiva onde pode consultar faturas, contratos e fazer reservas de sala online.*
> 
> *Vai receber um email com o seu link de acesso pessoal. O acesso é seguro e sem necessidade de password.*
> 
> *Estamos em fase piloto e o seu feedback é muito valioso. Se encontrar qualquer problema, contacte-nos directamente pelo sistema de suporte integrado.*

---

*VD Platform — Pilot Setup Guide v1.0.0-rc1 — 30 Jul 2026*
