# Volume 09 — Portal do Cliente (Frontend)

> **Documento:** VOL09-README  
> **Estado:** ✅ **CONCLUÍDO — Sprint VOL09-5 (30 Jul 2026)**  
> **Pasta:** `docs/12-portal-frontend/`  
> **Arquiteto:** Claude (Arquiteto-Chefe VD Platform)

---

## Contexto

O VOL03 implementou a totalidade do backend do Portal do Cliente:
40+ API routes, autenticação magic link, sessões, notificações, documentos, suporte, reservas.

O VOL09 implementa o **frontend** desse portal: as páginas Next.js que os clientes
acedem no browser, consumindo as APIs já existentes.

---

## Arquitectura

### Layout e Auth

```
src/
├── middleware.ts                        — protecção de rotas /portal/* (EdgeRuntime)
├── components/portal/
│   └── PortalLayout.tsx                 — layout partilhado + contexto auth
└── app/portal/
    ├── layout.tsx                       — metadata root
    ├── login/page.tsx                   — magic link + password
    ├── auth/magic/page.tsx              — callback do magic link
    ├── dashboard/page.tsx               — visão geral + KPIs
    ├── empresa/page.tsx                 — dados empresa + utilizadores
    ├── faturas/
    │   ├── page.tsx                     — lista paginada
    │   └── [id]/page.tsx                — detalhe + download PDF
    ├── pagamentos/page.tsx              — histórico + download recibos
    ├── contratos/page.tsx               — contratos activos e histórico
    ├── documentos/page.tsx              — repositório de docs partilhados
    ├── reservas/
    │   ├── page.tsx                     — lista + cancelar
    │   └── nova/page.tsx                — calendário + formulário
    ├── suporte/
    │   ├── page.tsx                     — lista de tickets
    │   ├── novo/page.tsx                — abrir ticket
    │   └── [id]/page.tsx                — conversa com o operador
    └── perfil/page.tsx                  — dados pessoais + preferências
```

### Decisões Arquitecturais

| Decisão | Escolha | Justificação |
|---|---|---|
| Middleware (Edge) | jwtVerify com `portal-session` cookie | Isolamento total de sessões admin/portal (ADR-026) |
| Auth pattern | `PortalAuthContext` + fetch `/api/portal/auth/me` | Reutiliza backend existente, sem código duplicado |
| Layout | `PortalLayout.tsx` como provider | Mesmo padrão do `AdminLayout` — consistência |
| UI design | Light theme, Tailwind | Clientes preferem interface limpa e familiar |
| Responsividade | Sidebar collapsible em mobile | Portal acedido em mobile por clientes |

---

## Fluxo de Autenticação

```
Cliente → /portal/login
  → digita email
  → POST /api/portal/auth/magic-link
  → recebe email com /portal/auth/magic?token=xxx
  → página redireciona para /api/portal/auth/magic?token=xxx
  → API valida, cria sessão, define cookie portal-session
  → redirect → /portal/dashboard
```

---

## Entregáveis

| Ficheiro | Tipo | Descrição |
|---|---|---|
| `src/middleware.ts` | Modificado | +Portal session protection |
| `src/components/portal/PortalLayout.tsx` | Criado | Layout + auth context |
| `src/app/portal/layout.tsx` | Criado | Root metadata |
| `src/app/portal/login/page.tsx` | Criado | Login (magic link + password) |
| `src/app/portal/auth/magic/page.tsx` | Criado | Callback magic link |
| `src/app/portal/dashboard/page.tsx` | Criado | Dashboard KPIs |
| `src/app/portal/empresa/page.tsx` | Criado | Dados empresa + utilizadores |
| `src/app/portal/faturas/page.tsx` | Criado | Lista faturas |
| `src/app/portal/faturas/[id]/page.tsx` | Criado | Detalhe + download fatura |
| `src/app/portal/pagamentos/page.tsx` | Criado | Histórico pagamentos + recibos |
| `src/app/portal/contratos/page.tsx` | Criado | Contratos |
| `src/app/portal/documentos/page.tsx` | Criado | Repositório documentos |
| `src/app/portal/reservas/page.tsx` | Criado | Lista reservas |
| `src/app/portal/reservas/nova/page.tsx` | Criado | Nova reserva com disponibilidade |
| `src/app/portal/suporte/page.tsx` | Criado | Lista tickets |
| `src/app/portal/suporte/novo/page.tsx` | Criado | Abrir ticket |
| `src/app/portal/suporte/[id]/page.tsx` | Criado | Conversa com operador |
| `src/app/portal/perfil/page.tsx` | Criado | Perfil + preferências |

**Total:** 18 ficheiros (1 modificado, 17 criados)

---

## DoD Checklist

```
✅ Middleware actualizado — /portal/* protegido (excepto /portal/login e /portal/auth/*)
✅ Login page — magic link + password, tratamento de erros, estado "link enviado"
✅ Magic link callback — redirect para API route que valida o token
✅ PortalLayout — auth context, sidebar, mobile hamburger
✅ Dashboard — KPIs, alertas, contrato activo, actividade recente
✅ Empresa — dados da empresa + lista de utilizadores + contacto Azul
✅ Faturas — lista paginada, filtro por estado, badge de atraso
✅ Fatura detalhe — items, totais, download PDF (URL assinada)
✅ Pagamentos — histórico + download de recibo
✅ Contratos — lista com estado e datas
✅ Documentos — repositório de docs partilhados + download
✅ Reservas — lista com cancelar + nova reserva com disponibilidade
✅ Suporte — lista de tickets com filtro + abrir ticket + conversa
✅ Perfil — dados read-only + preferências de notificação
✅ TypeScript: 0 erros em 18 ficheiros
✅ ADR-039 criado
✅ CLAUDE.md actualizado
✅ docs/README.md actualizado
```

---

## Sprint Log

| Sprint | Data | Conteúdo |
|---|---|---|
| VOL09-1 | 30 Jul 2026 | Middleware + Login + Auth + PortalLayout |
| VOL09-2 | 30 Jul 2026 | Dashboard + Empresa |
| VOL09-3 | 30 Jul 2026 | Faturas + Pagamentos + Contratos |
| VOL09-4 | 30 Jul 2026 | Documentos + Reservas + Suporte + Perfil |
| VOL09-5 | 30 Jul 2026 | TypeScript 0 erros + ADR-039 + DoD |

---

*VD Platform — VOL09 Portal do Cliente Frontend — 30 Jul 2026*
