# CRM — UX Flows & Wireframes Funcionais

> **Versão:** 1.0.0-draft  
> **Volume:** 01 — CRM  
> **Estado:** 📝 Em elaboração  
> **Dependências:** [customer360.md](./customer360.md), [pipeline.md](./pipeline.md)

---

## 1. Princípios de UX do CRM

1. **Zero cliques desnecessários** — a acção mais comum a partir de qualquer ecrã deve estar a 1 clique.
2. **Contexto sempre visível** — o utilizador sabe sempre em que empresa está e em que stage se encontra.
3. **Feedback imediato** — toda mutação (criar, editar, mover) dá feedback visual antes do server round-trip.
4. **Teclado-first** — atalhos de teclado para as acções mais frequentes.
5. **Mobile-aware** — os ecrãs principais funcionam em tablet (768px+). Mobile não é prioridade no L2.

---

## 2. Arquitectura de Navegação

```
/admin
├── /admin/crm                        ← Dashboard CRM
├── /admin/crm/pipeline               ← Pipeline Kanban
├── /admin/crm/companies              ← Lista de empresas
│   ├── /admin/crm/companies/new      ← Criar empresa
│   └── /admin/crm/companies/[id]     ← Customer 360°
│       ├── /contacts                 ← Tab Contactos
│       ├── /deals                    ← Tab Deals
│       ├── /activities               ← Tab Actividades
│       ├── /tasks                    ← Tab Tarefas
│       ├── /notes                    ← Tab Notas
│       └── /timeline                 ← Tab Timeline
├── /admin/crm/tasks                  ← Minhas tarefas
└── /admin/crm/reports                ← Relatórios (futuro L3)
```

---

## 3. Fluxo 1 — Dashboard CRM

```
┌────────────────────────────────────────────────────────────────┐
│ CRM Dashboard                                    [+ Nova Empresa]│
├──────────────┬──────────────┬──────────────┬───────────────────┤
│ Pipeline     │ Facturado    │ Conversão    │ Tarefas Vencidas  │
│ 4.250.000 Kz │ 1.200.000 Kz│ 70.6%        │ 3 ⚠️              │
├──────────────┴──────────────┴──────────────┴───────────────────┤
│ PIPELINE POR STAGE                                              │
│ New Lead(3) → Contacted(7) → Qualified(4) → Proposal(2) → ... │
│ [barra visual com totais de valor por stage]                    │
├─────────────────────────────────┬──────────────────────────────┤
│ ACTIVIDADE RECENTE (últimas 24h)│ TAREFAS DE HOJE              │
│ ● Reunião — Empresa XYZ (João)  │ □ Follow-up — ABC Lda        │
│ ● Email — Empresa ABC (Ana)     │ □ Proposta — DEF Lda         │
│ ● Chamada — DEF Lda (Pedro)     │ ■ VENCIDA: GHI Lda ⚠️       │
├─────────────────────────────────┴──────────────────────────────┤
│ LEADS SEM CONTACTO (> 24h)                                     │
│ ► Empresa MNO · 3 dias sem contacto · [Contactar agora]        │
│ ► Empresa PQR · 1 dia sem contacto · [Contactar agora]         │
└────────────────────────────────────────────────────────────────┘
```

**Interacções:**
- Clicar num KPI → navega para a lista filtrada por esse critério
- Clicar numa empresa da lista → abre Customer 360°
- "Contactar agora" → abre modal de registo de Activity pré-preenchida
- "+ Nova Empresa" → abre modal de criação inline

---

## 4. Fluxo 2 — Pipeline Kanban

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ Pipeline CRM                     [Filtrar: Todos ▼] [João S. ▼] [+ Lead]  │
├───────────┬───────────┬───────────┬──────────────┬─────────────┬────────────┤
│ NEW LEAD  │ CONTACTED │ QUALIFIED │ PROPOSAL SENT│ NEGOTIATION │ WON / LOST │
│   3 · Kz  │   7 · Kz  │   4 · Kz  │    2 · Kz    │    1 · Kz   │  12 / 5   │
├───────────┼───────────┼───────────┼──────────────┼─────────────┼────────────┤
│ ┌───────┐ │ ┌───────┐ │ ┌───────┐ │ ┌──────────┐ │ ┌─────────┐ │            │
│ │Emp. A │ │ │Emp. D │ │ │Emp. G │ │ │Emp. J    │ │ │Emp. K   │ │            │
│ │João S.│ │ │Ana C. │ │ │Pedro M│ │ │Sofia L.  │ │ │Rui N.   │ │            │
│ │0d ··· │ │ │2d ··· │ │ │1d ··· │ │ │3d ······ │ │ │8d ····· │ │            │
│ │500Kz  │ │ │750Kz  │ │ │1.2MKz │ │ │900Kz     │ │ │2.5MKz   │ │            │
│ └───────┘ │ └───────┘ │ └───────┘ │ └──────────┘ │ └─────────┘ │            │
│ ┌───────┐ │ ┌───────┐ │           │              │             │            │
│ │Emp. B │ │ │Emp. E │ │           │              │             │            │
│ │Ana C. │ │ │Pedro M│ │           │              │             │            │
│ │1d ··· │ │ │5d ··· │ │           │              │             │            │
│ └───────┘ │ └───────┘ │           │              │             │            │
└───────────┴───────────┴───────────┴──────────────┴─────────────┴────────────┘
```

**Interacções:**
- **Drag & drop** de card entre colunas → muda `pipelineStage` (com validação de transições)
- **Clicar no card** → abre Customer 360° em painel lateral (slide-over)
- **Hover no card** → tooltip com último contacto e próxima tarefa
- **··· no card** → menu: Registar Actividade | Nova Tarefa | Ver Empresa | Mover para Lost
- **Filtros** → por responsável, por sector, por valor mínimo/máximo, por SLA (vencidos)

---

## 5. Fluxo 3 — Customer 360°

```
┌─────────────────────────────────────────────────────────────────┐
│ ← Voltar                   EMPRESA XYZ LDA           [···] [✏️]│
│ [Logo placeholder]  NIF: 5001234567 · Luanda · Tecnologia      │
│ Responsável: João Silva · Cliente desde: Mar 2025              │
│ [NEGOTIATION ▼]   [ACTIVE]                                     │
├──────────┬────────────┬──────────────┬──────────────────────────┤
│ Pipeline │ Facturado  │ Actividades  │ Tarefas                  │
│ 2.5M Kz  │ 450K Kz    │ 12 (30 dias) │ 3 abertas               │
├──────────┴────────────┴──────────────┴──────────────────────────┤
│ [Contactos] [Deals] [Actividades] [Tarefas] [Notas] [Timeline] │
├─────────────────────────────────────────────────────────────────┤
│  TAB: TIMELINE (default)                                        │
│                                                                  │
│  Hoje                                                           │
│  ● 14:30  Reunião de negociação — João Silva                    │
│            "Discutido desconto de 5%. Cliente pediu prazo."     │
│                                                                  │
│  Ontem                                                          │
│  ○ 09:15  Proposta enviada (PDF - 2.5M AOA)        [Ver doc]   │
│                                                                  │
│  23 Jul                                                         │
│  ● 16:00  Follow-up por email — João Silva                      │
│  ○ 11:00  Lead qualificado                                      │
│                                                                  │
│  15 Jul                                                         │
│  ○ 10:30  Lead capturado via formulário web                     │
│                                                                  │
│  [Carregar mais →]                                              │
├─────────────────────────────────────────────────────────────────┤
│ [+ Actividade]  [+ Tarefa]  [+ Nota]  [Agendar Follow-up]      │
└─────────────────────────────────────────────────────────────────┘
```

**Ícones na Timeline:**
- ● = acção manual (utilizador)
- ○ = evento de sistema
- 💰 = evento financeiro
- 📅 = reserva
- 🏢 = evento de coworking

**Quick Actions (barra inferior):**
- `+ Actividade` → modal de registo de chamada/email/reunião
- `+ Tarefa` → modal de criação de tarefa com prazo
- `+ Nota` → editor inline de nota
- `Agendar Follow-up` → date picker + responsável

---

## 6. Fluxo 4 — Criar Empresa (Modal)

```
┌─────────────────────────────────────┐
│ Nova Empresa                      ✕ │
├─────────────────────────────────────┤
│ Nome da empresa *                   │
│ [                                 ] │
│                                     │
│ NIF (opcional)                      │
│ [                                 ] │
│                                     │
│ Email principal                     │
│ [                                 ] │
│                                     │
│ Telefone                            │
│ [                                 ] │
│                                     │
│ Responsável                         │
│ [João Silva              ▼        ] │
│                                     │
│ Sector                              │
│ [Tecnologia              ▼        ] │
│                                     │
│ ⚠️ Possível duplicado detectado:    │
│ "Empresa XY Lda" (NIF similar)      │
│ [Ver empresa] [Continuar mesmo assim]│
│                                     │
│           [Cancelar] [Criar Empresa]│
└─────────────────────────────────────┘
```

---

## 7. Fluxo 5 — Registar Actividade

```
┌─────────────────────────────────────┐
│ Registar Actividade            ✕    │
├─────────────────────────────────────┤
│ Tipo *                              │
│ [📞 Chamada] [✉️ Email] [🤝 Reunião]│
│ [🖥️ Demo  ] [🚶 Visita] [Outro    ]│
│                                     │
│ Direcção                            │
│ [● Outbound] [○ Inbound]            │
│                                     │
│ Assunto *                           │
│ [                                 ] │
│                                     │
│ Resultado / Notas                   │
│ [                                 ] │
│ [                                 ] │
│                                     │
│ Contacto (opcional)                 │
│ [Ana Costa (Decisora)    ▼        ] │
│                                     │
│ Data / Hora                         │
│ [Hoje, 14:30             ▼        ] │
│                                     │
│ Próxima acção (opcional)            │
│ [Follow-up por email em 3 dias    ] │
│                                     │
│           [Cancelar] [Registar]     │
└─────────────────────────────────────┘
```

---

## 8. Fluxo 6 — Mover Deal (Pipeline)

```
┌─────────────────────────────────────┐
│ Mover para NEGOTIATION         ✕    │
├─────────────────────────────────────┤
│ Empresa: Empresa XYZ Lda            │
│ Deal: Plano Coworking Premium       │
│                                     │
│ Valor estimado *                    │
│ [2.500.000              ] AOA       │
│                                     │
│ Data prevista de fecho              │
│ [15 Agosto 2026          ]          │
│                                     │
│ Nota (opcional)                     │
│ [                                 ] │
│                                     │
│           [Cancelar] [Confirmar]    │
└─────────────────────────────────────┘
```

---

## 9. Fluxo 7 — Fechar Deal (WON/LOST)

### WON
```
┌─────────────────────────────────────┐
│ 🎉 Marcar como GANHO           ✕    │
├─────────────────────────────────────┤
│ Empresa: Empresa XYZ Lda            │
│                                     │
│ Valor final do negócio *            │
│ [2.500.000              ] AOA       │
│                                     │
│ Data de fecho *                     │
│ [Hoje, 28 Jul 2026       ]          │
│                                     │
│ Próximos passos                     │
│ [Enviar contrato e activar onboarding]│
│                                     │
│ ✅ A empresa será marcada ACTIVE    │
│ ✅ Contrato será criado             │
│ ✅ Equipa será notificada           │
│                                     │
│           [Cancelar] [Confirmar WON]│
└─────────────────────────────────────┘
```

### LOST
```
┌─────────────────────────────────────┐
│ Marcar como PERDIDO            ✕    │
├─────────────────────────────────────┤
│ Empresa: Empresa XYZ Lda            │
│                                     │
│ Motivo da perda *                   │
│ [○ Preço muito alto               ] │
│ [○ Escolheu concorrente           ] │
│ [○ Sem orçamento                  ] │
│ [○ Sem necessidade                ] │
│ [○ Timing errado                  ] │
│ [○ Sem resposta                   ] │
│ [● Outro: _______________________ ] │
│                                     │
│ Agendar re-engagement?              │
│ [○ Não   ● Sim, em: [3 meses ▼]  ] │
│                                     │
│           [Cancelar] [Confirmar LOST]│
└─────────────────────────────────────┘
```

---

## 10. Fluxo 8 — Minhas Tarefas

```
┌─────────────────────────────────────────────────────┐
│ Minhas Tarefas                          [+ Tarefa]  │
├──────────────┬──────────────┬───────────────────────┤
│ HOJE (3)     │ ESTA SEMANA  │ ATRASADAS (1)         │
├──────────────┴──────────────┴───────────────────────┤
│ ⚠️ ATRASADA — Ontem                                 │
│ ■ Follow-up urgente — Empresa GHI                   │
│   Empresa GHI · HIGH · [Concluir] [Ver empresa]     │
│                                                     │
│ HOJE                                                │
│ □ Follow-up proposta — Empresa ABC                  │
│   Empresa ABC · MEDIUM · Vence: 17:00               │
│   [Concluir] [Adiar] [Ver empresa]                  │
│                                                     │
│ □ Reunião de demo — Empresa DEF                     │
│   Empresa DEF · HIGH · Vence: 15:00                 │
│   [Concluir] [Adiar] [Ver empresa]                  │
│                                                     │
│ ESTA SEMANA                                         │
│ □ Enviar proposta — Empresa MNO                     │
│   Empresa MNO · HIGH · Vence: Sex, 31 Jul           │
└─────────────────────────────────────────────────────┘
```

---

## 11. Atalhos de Teclado (Quick Actions)

| Atalho | Acção |
|---|---|
| `N` | Nova empresa |
| `A` | Registar actividade (na empresa actual) |
| `T` | Nova tarefa |
| `/` | Pesquisa global |
| `P` | Ir para Pipeline |
| `D` | Ir para Dashboard |
| `Esc` | Fechar modal |

---

## 12. Estados de Loading e Empty States

### Empty State — Sem Leads
```
┌─────────────────────────────────┐
│          📋                     │
│   Nenhum lead no pipeline       │
│   Comece por adicionar a        │
│   primeira empresa.             │
│                                 │
│   [+ Adicionar Empresa]         │
└─────────────────────────────────┘
```

### Empty State — Timeline vazia
```
A timeline desta empresa ainda não tem entradas.
Registe a primeira actividade para começar a construir o historial.
```

### Loading State
- Skeleton loaders em todos os cards e listas (não spinners)
- Optimistic updates para drag & drop no Kanban

---

*VD Platform — CRM UX Flows — v1.0.0-draft — 28 Julho 2026*  
*© 2026 VERSÃO DE NEGÓCIOS - COMÉRCIO GERAL E PRESTAÇÃO DE SERVIÇOS, LDA. Confidencial.*
