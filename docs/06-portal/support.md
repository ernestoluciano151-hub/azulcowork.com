# Suporte ao Cliente — Volume 03 — Portal do Cliente

> **Volume:** 03 — Portal do Cliente  
> **Estado:** 📋 Especificação — aguarda aprovação PO  
> **SLA básico:** Primeira resposta em ≤ 48 horas úteis

---

## 1. Visão Geral

O módulo de suporte permite comunicação assíncrona entre clientes e staff do Azul Coworking,
com rastreabilidade completa e cumprimento de SLA.

**Não é um live chat.** É um sistema de tickets assíncrono (como email, mas organizado).

---

## 2. Categorias de Ticket

| Categoria | Exemplos de assuntos |
|---|---|
| `faturacao` | Dúvida em fatura, pedido de nota de crédito, erro de valor |
| `contrato` | Pedido de alteração, renovação, rescisão |
| `reservas` | Problema com reserva, cancelamento urgente |
| `tecnico` | WiFi, impressora, ar condicionado, acesso ao edifício |
| `outro` | Qualquer assunto não enquadrado acima |

---

## 3. Prioridades

| Prioridade | SLA primeira resposta | Exemplos |
|---|---|---|
| LOW | 72 horas úteis | Pedido de informação geral |
| NORMAL | 48 horas úteis | Dúvida em fatura, questão sobre contrato |
| HIGH | 24 horas úteis | Problema que impede uso do espaço |
| URGENT | 4 horas | Falha de acesso, urgência contractual |

---

## 4. Ciclo de Vida de um Ticket

```
OPEN         — Ticket aberto pelo cliente; aguarda primeira resposta do staff
IN_PROGRESS  — Staff está a trabalhar na resolução
WAITING      — Staff respondeu e aguarda informação adicional do cliente
RESOLVED     — Problema resolvido (staff marca como resolvido)
CLOSED       — Fechado sem resposta após 7 dias em WAITING, ou fechado manualmente
```

### Transições

```
OPEN → IN_PROGRESS (staff responde ou atribui a si)
IN_PROGRESS → WAITING (staff pede informação ao cliente)
IN_PROGRESS → RESOLVED (staff resolve)
WAITING → IN_PROGRESS (cliente responde)
WAITING → CLOSED (7 dias sem resposta do cliente — auto-close)
RESOLVED → CLOSED (3 dias sem interacção)
RESOLVED → OPEN (cliente responde após resolução → reabre)
CLOSED → OPEN (cliente reabre explicitamente, dentro de 30 dias)
```

---

## 5. Funcionalidades do Portal (Cliente)

### 5.1 Lista de Tickets

```
Filtros: estado (aberto / resolvido / todos)

[ST-2026-000001] [Dúvida em fatura Julho] [faturacao] [OPEN]  [há 2h]   [Ver]
[ST-2026-000002] [Problema WiFi sala 3]   [tecnico]  [RESOLVED][há 3 dias][Ver]
```

### 5.2 Criar Ticket

```
Assunto*:    [input — máx 120 caracteres]
Categoria*:  [dropdown]
Prioridade:  [dropdown — default: NORMAL]
Descrição*:  [textarea — mínimo 20 caracteres]
Anexos:      [upload — PDF/JPG/PNG/DOCX — máx 10 MB por ficheiro, máx 3 ficheiros]

[Enviar]
  → Gera número ST-2026-NNNNNN
  → SLA deadline = createdAt + SLA(priority)
  → Email ao cliente: "Ticket recebido — #ST-2026-000001"
  → Notificação in-app ao staff
```

### 5.3 Detalhe do Ticket

```
#ST-2026-000001 — Dúvida em fatura Julho 2026
Estado: OPEN | Categoria: Faturação | Prioridade: NORMAL

─── João Silva (cliente) — 29 Jul 2026, 14:30 ──────────────────
Boa tarde,
Tenho uma dúvida relativamente à fatura FT-CWORK-2026-000042.
O valor indicado (Kz 171.000) inclui serviços adicionais que
não reconheço...

[Anexo: fatura-julho.pdf] [Download]

─── Azul Coworking (staff) — 29 Jul 2026, 15:45 ──────────────
Boa tarde João,
Obrigado pelo contacto. O valor inclui...

─── Responder ──────────────────────────────────────────────────
[textarea]
[Anexos]
[Enviar resposta]
```

### 5.4 Notas Internas (só staff vê)

```
─── [Nota interna — Azul Coworking] — 29 Jul 2026, 16:00 ────────
Verificado com equipa financeira. Erro confirmado. Emitir NC.
[🔒 Nota interna — não visível ao cliente]
```

---

## 6. Funcionalidades do Admin Panel

- Lista de todos os tickets (todos os clientes)
- Filtros: estado, categoria, prioridade, empresa, responsável
- Atribuição a colaborador
- Alerta interno: tickets próximos de violar SLA (badge vermelho)
- Métricas: tempo médio de resposta, % dentro de SLA, tickets por categoria

---

## 7. Alerta de SLA

Quando um ticket está prestes a violar o SLA:

```
SLA = 48h (NORMAL)
  T + 24h: alerta interno (admin in-app) → "⚠️ Ticket #ST-001 — 24h restantes"
  T + 40h: alerta urgente → "🔴 Ticket #ST-001 — 8h restantes"
  T + 48h: SLA violado → registo de SLA breach + alerta ao gestor
```

---

## 8. Regras de Negócio

```
BR-PORT-SUP-001 — Numeração atómica: ST-YYYY-NNNNNN via DocumentCounter
BR-PORT-SUP-002 — Nota interna marcada com isInternal=true nunca aparece no portal do cliente
BR-PORT-SUP-003 — Ticket WAITING fechado automaticamente após 7 dias sem resposta do cliente
BR-PORT-SUP-004 — Ticket RESOLVED: cliente pode reabrir dentro de 30 dias (após isso → novo ticket)
BR-PORT-SUP-005 — Cada mensagem cria TimelineEntry na empresa
BR-PORT-SUP-006 — Attachments de suporte guardados em /azul-cowork/portal/support/[ticketId]/
BR-PORT-SUP-007 — PORTAL_VIEWER não pode criar nem ver tickets de suporte
BR-PORT-SUP-008 — SLA deadline calculado em horas úteis (Mon-Fri, 08h-18h WAT)
```

---

*VD Platform — Support Spec — Volume 03 — 29 Julho 2026*
