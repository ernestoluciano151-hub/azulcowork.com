# UX Flows — Volume 03 — Portal do Cliente

> **Volume:** 03 — Portal do Cliente  
> **Estado:** 📋 Especificação — aguarda aprovação PO

---

## 1. Fluxo de Activação do Portal (Admin → Cliente)

```
ADMIN PANEL
│
├── Empresa → "Activar Portal do Cliente"
│   ├── Formulário: email do responsável, nome, telefone
│   ├── Sistema cria PortalUser (PORTAL_OWNER)
│   └── Sistema envia email de boas-vindas
│
EMAIL AO CLIENTE
│
├── "O seu portal do Azul Coworking está pronto"
│   ├── Botão: "Aceder ao portal" → /portal/auth/magic?token=[TOKEN]
│   └── Token válido por 15 minutos
│
PORTAL
│
├── Validação do token → sessão criada
├── /portal/dashboard (primeiro acesso)
│   ├── Tour guiado (opcional: tooltips nas secções)
│   └── Banner: "Complete o seu perfil"
│
└── Cliente começa a usar o portal
```

---

## 2. Fluxo de Login (Magic Link)

```
/portal/login
│
├── [Input: email]
├── [Botão: "Enviar link de acesso"]
│
│   Sistema:
│   ├── Verifica PortalUser existe e está activo
│   ├── Rate limit: máx 3 pedidos/hora por email
│   ├── Gera token (32 bytes aleatórios)
│   ├── Envia email via Resend
│   └── Mostra: "Verifique o seu email"
│
EMAIL
│
├── Link: /portal/auth/magic?token=[TOKEN]
│   (válido 15 min, uso único)
│
/portal/auth/magic?token=...
│
├── Token válido → cria sessão → /portal/dashboard
├── Token expirado → "O link expirou. Pedir novo link?" [Sim]
└── Token já usado → "Este link já foi utilizado. Pedir novo link?" [Sim]
```

---

## 3. Fluxo de Download de Fatura

```
/portal/faturas
│
├── Lista de faturas (filtros: estado, período)
│
├── [Clique em fatura] → /portal/faturas/[id]
│   │
│   ├── Detalhe da fatura (itens, totais, dados bancários)
│   │
│   └── [Botão: "Download PDF"]
│       │
│       Sistema:
│       ├── Verifica companyId (isolamento)
│       ├── Gera URL assinada Cloudinary (TTL 15 min)
│       ├── Regista PortalDocumentAccess
│       ├── Cria TimelineEntry ("Fatura descarregada por [Nome]")
│       └── Devolve URL → browser inicia download automático
│
└── ✅ PDF descarregado (FT-CWORK-2026-NNNNNN.pdf)
```

---

## 4. Fluxo de Criação de Reserva

```
/portal/reservas
│
├── Lista de reservas existentes
│
└── [Botão: "Nova Reserva"]
    │
    /portal/reservas/nova
    │
    ├── Passo 1: Escolher sala
    │   ├── Dropdown: Sala Azul | Sala Verde | Sala Amarela
    │   └── [Ver disponibilidade]
    │
    ├── Passo 2: Escolher data e horário
    │   ├── Calendar com dias disponíveis (cinza = indisponível)
    │   ├── Slots horários disponíveis
    │   └── Duração calculada automaticamente
    │
    ├── Passo 3: Confirmar
    │   ├── Resumo: sala, data, horário, duração
    │   ├── Valor estimado: Kz XXX.XXX
    │   └── [Confirmar Reserva]
    │
    Sistema:
    ├── Conflict check (atómico)
    ├── Cria Reservation (estado: PENDING)
    ├── Notifica staff (in-app + email)
    ├── Notifica cliente (email + in-app): "Reserva recebida"
    └── Redireciona para /portal/reservas/[id]
    │
    STAFF CONFIRMA (no painel admin)
    │
    └── Notificação ao cliente: "Reserva confirmada" (email + WhatsApp + in-app)
```

---

## 5. Fluxo de Abertura de Ticket de Suporte

```
/portal/suporte
│
├── Lista de tickets (abertos + fechados)
│
└── [Botão: "Novo Ticket"]
    │
    /portal/suporte/novo
    │
    ├── Assunto*: [input texto]
    ├── Categoria*: Faturação | Contrato | Reservas | Técnico | Outro
    ├── Prioridade: Normal | Alta | Urgente
    ├── Descrição*: [textarea]
    └── Anexos: [upload de ficheiros — PDF/JPEG/PNG até 10 MB]
        │
        [Enviar]
        │
        Sistema:
        ├── Gera número ST-2026-NNNNNN
        ├── Calcula SLA deadline (+ 48h)
        ├── Cria PortalSupportTicket (OPEN)
        ├── Notifica staff (in-app + email)
        └── Email ao cliente: "Ticket #ST-2026-000001 recebido"
        │
        /portal/suporte/[id]
        │
        ├── Histórico de mensagens (chat assíncrono)
        ├── Campo de resposta
        └── Estado do ticket: OPEN → IN_PROGRESS → WAITING → RESOLVED
```

---

## 6. Fluxo de Notificação Omnicanal

```
EVENTO GERADO (ex: fatura emitida)
│
├── Sistema cria PortalNotification (PENDING)
│
├── OmnichannelService determina canais activos para cada PortalUser da empresa:
│   ├── notifyEmail = true   → envia via Resend
│   ├── notifyWhatsapp = true → envia via Meta Cloud API
│   ├── notifyInApp = true   → envia via SSE (Server-Sent Events)
│   └── notifyPush = true    → envia via Web Push (VAPID)
│
├── Para cada canal:
│   ├── Tenta enviar → actualiza OmnichannelMessage
│   ├── Sucesso → status: SENT
│   └── Falha → regista erro, agenda re-tentativa (máx 3)
│       └── Após 3 falhas → status: FAILED + fallback para email
│
├── Quando cliente vê notificação in-app:
│   └── PATCH /api/portal/notifications/[id]/read → status: READ
│
└── TimelineEntry criada na empresa para cada notificação enviada
```

---

## 7. Wireframes Funcionais

### 7.1 Dashboard

```
┌────────────────────────────────────────────────────────────────────┐
│  🔵 AZUL COWORKING — Portal do Cliente          [👤 João Silva ▼]  │
├──────────┬─────────────────────────────────────────────────────────┤
│ Dashboard│  Bom dia, João! ☀️                          29 Jul 2026  │
│ Contratos│                                                          │
│ Faturas  │  ┌──────────────────┐  ┌──────────────────────────────┐ │
│ Pagament.│  │ CONTRATO ACTIVO  │  │     SALDO PENDENTE           │ │
│ Reservas │  │ Hot Desk Mensal  │  │     Kz 171.000               │ │
│ Document.│  │ Kz 150.000/mês   │  │     1 fatura em aberto       │ │
│ Notif.   │  │ Expira: 31/12/26 │  │  [Ver faturas →]             │ │
│ Suporte  │  └──────────────────┘  └──────────────────────────────┘ │
│          │                                                          │
│          │  ┌──────────────────┐  ┌──────────────────────────────┐ │
│          │  │ PRÓXIMA RENDA    │  │  NOTIFICAÇÕES                │ │
│          │  │ Kz 171.000       │  │  🔔 Nova fatura — há 2h      │ │
│          │  │ Vence: 10/08/26  │  │  ✅ Pagamento conf. — ontem  │ │
│          │  │ Estado: PENDING  │  │  📄 Documento — há 3 dias    │ │
│          │  └──────────────────┘  │  [Ver todas →]               │ │
│          │                        └──────────────────────────────┘ │
└──────────┴─────────────────────────────────────────────────────────┘
```

### 7.2 Lista de Faturas

```
┌────────────────────────────────────────────────────────────────────┐
│  Faturas                                [Filtro: Todas ▼] [Período]│
├────────────────────────────────────────────────────────────────────┤
│  Número              │ Emissão    │ Vencimento │ Valor    │ Estado  │
├──────────────────────┼────────────┼────────────┼──────────┼─────────┤
│  FT-CWORK-2026-000042│ 01/07/2026 │ 10/07/2026 │171.000Kz │🔴OVERDUE│
│  [Ver] [Download]    │            │            │          │         │
├──────────────────────┼────────────┼────────────┼──────────┼─────────┤
│  FT-CWORK-2026-000031│ 01/06/2026 │ 10/06/2026 │171.000Kz │✅ PAID  │
│  [Ver] [Download]    │            │            │          │         │
├──────────────────────┼────────────┼────────────┼──────────┼─────────┤
│  FT-CWORK-2026-000019│ 01/05/2026 │ 10/05/2026 │171.000Kz │✅ PAID  │
│  [Ver] [Download]    │            │            │          │         │
└────────────────────────────────────────────────────────────────────┘
```

### 7.3 Centro de Notificações

```
┌────────────────────────────────────────────────────────────────────┐
│  Notificações                         [Marcar tudo como lido]      │
├────────────────────────────────────────────────────────────────────┤
│  🔵 🔔 Nova fatura disponível                           há 2 horas │
│      FT-CWORK-2026-000042 · Kz 171.000 · Vence 10/07             │
│      [Ver fatura]                                                   │
├────────────────────────────────────────────────────────────────────┤
│  ⚪ ✅ Pagamento confirmado                                ontem    │
│      Kz 171.000 · Referência: REF-2026-006                         │
│      [Ver recibo]                                                   │
├────────────────────────────────────────────────────────────────────┤
│  ⚪ 📄 Documento disponível                              há 3 dias  │
│      Contrato de Coworking 2026 · Versão 2                         │
│      [Download]                                                     │
├────────────────────────────────────────────────────────────────────┤
│  ⚪ ⚠️ Contrato expira em 30 dias                         há 5 dias  │
│      CONT-2026-000001 · Hot Desk Mensal                            │
│      [Ver contrato] [Contactar staff]                              │
└────────────────────────────────────────────────────────────────────┘
```

---

## 8. Estados de Erro e Mensagens ao Utilizador

| Situação | Mensagem |
|---|---|
| Magic link expirado | "Este link expirou. Por favor solicite um novo link de acesso." |
| Magic link já usado | "Este link já foi utilizado. Por favor solicite um novo." |
| Sessão expirada | "A sua sessão expirou. Por favor faça login novamente." |
| Fatura não encontrada | "Não encontrámos esta fatura na sua conta." (404 silencioso — não revelar IDs) |
| Conflito de reserva | "Este horário já está reservado. Por favor escolha outro horário." |
| Rate limit magic link | "Já enviámos um link recentemente. Por favor aguarde alguns minutos." |
| Empresa suspensa | "A sua conta está temporariamente suspensa. Contacte-nos em geral@azulcowork.com" |

---

*VD Platform — UX Flows — Volume 03 — 29 Julho 2026*
