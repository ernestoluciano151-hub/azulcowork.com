# ADR-042 — ERP Admin UI + Correcções de Produção (VOL12)

> **Estado:** ✅ ACEITE  
> **Data:** 30 Julho 2026  
> **Contexto:** VOL12 — ERP Admin UI + Correcções de Produção  
> **Autor:** Claude (Arquiteto-Chefe VD Platform)

---

## Contexto

Após a conclusão de VOL11, foram identificados dois bloqueadores críticos de produção e um gap funcional major:

1. **`build:prod` errado** — `package.json` tinha `"next build"` mas `vercel.json` requer `prisma migrate deploy && next build`. As migrations nunca correriam em produção.
2. **`web-push` ausente** — A biblioteca de Web Push Notifications não estava em `package.json`, embora o `portal-omnichannel-service.ts` (VOL03) a usasse. Notificações push falhariam silenciosamente em produção.
3. **ERP sem frontend** — O VOL02 construiu 9 serviços e 40+ endpoints mas zero páginas admin. A equipa Azul Coworking não conseguia gerir contratos, faturas, despesas nem relatórios a partir do browser.

---

## Decisões

### D1 — `build:prod` = `prisma migrate deploy && next build`

**Decisão:** Corrigir o script `build:prod` em `package.json` para incluir `prisma migrate deploy` antes de `next build`.

**Justificação:** `prisma migrate deploy` é idempotente e seguro em produção — aplica apenas migrations pendentes, nunca regenera. É o padrão recomendado pelo Prisma para deploy em Vercel. Sem esta linha, cada deploy usava o schema anterior à migration mais recente.

**Alternativas rejeitadas:**
- Correr migrations manualmente antes de cada deploy — propenso a erro humano.
- `prisma db push` — não seguro em produção (pode perder dados).

### D2 — `web-push ^3.6.7` adicionado a `dependencies`

**Decisão:** Adicionar `web-push` e `@types/web-push` às dependências do projecto.

**Justificação:** O `portal-omnichannel-service.ts` já importava `web-push` para enviar notificações VAPID. A ausência do pacote causaria falha silenciosa no cron `portal-notifications-retry` em produção (o `import()` dinâmico falharia sem lançar erro em alguns ambientes).

### D3 — Páginas ERP como Client Components simples

**Decisão:** As 6 novas páginas ERP admin usam `"use client"` + `fetch()` para consumir as API routes existentes. Sem React Server Components, sem ORM directo nas páginas.

**Alternativas consideradas:**
- Server Components com Prisma directo — eliminaria a camada de fetch mas violaria a separação Clean Architecture (UI ≠ dados directamente).
- Servidor Action — adequado para formulários mas mais complexo para listagens paginadas.

**Justificação:** A Clean Architecture estabelecida (ADR-005) define que a UI consome services via API, não directamente. A consistência arquitectural supera o ganho marginal de performance dos Server Components nestas páginas admin.

### D4 — Sidebar organizada em grupos com separadores

**Decisão:** A `Sidebar.tsx` passa a incluir dois novos grupos: `erp` (ERP Financeiro) e `portal` (Portal Clientes), com separadores visuais e labels de secção.

**Justificação:** Com 6 novas entradas, uma lista plana tornaria a sidebar ilegível. A organização em grupos com separadores visuais é o padrão já estabelecido (grupos `documentos`, `comunicacao`, `seguranca`, `crm`).

---

## Páginas Criadas

| Página | Endpoints Consumidos | Funcionalidade |
|---|---|---|
| `/admin/erp/contratos` | `GET/POST /api/erp/contracts`, `POST /.../activate/suspend/terminate` | Lista + ciclo de vida de contratos |
| `/admin/erp/faturas` | `GET /api/erp/invoices`, `POST /.../issue/void/send` | Lista + emissão + envio + anulação |
| `/admin/erp/despesas` | `GET /api/erp/expenses`, `POST /.../approve/reject/pay/cancel` | Lista + ciclo de vida de despesas |
| `/admin/erp/fluxo-caixa` | `GET /api/erp/cashflow/kpis`, `/cashflow`, `/cashflow/projection` | KPIs + movimentos + projecção |
| `/admin/erp/relatorios` | `GET /api/erp/reports/vat`, `/reconciliation`, `/export` | Mapa IVA + reconciliação + export XLSX |
| `/admin/portal/utilizadores` | `GET/POST /api/admin/portal/users`, `PATCH /.../[id]`, `POST /magic-link` | Gestão de acessos ao portal |

---

## Consequências

**Positivas:**
- A equipa Azul Coworking tem acesso completo ao ERP a partir do browser
- Migrations automáticas em cada deploy Vercel (sem intervenção manual)
- Notificações push funcionais em produção

**Negativas (trade-offs):**
- As páginas ERP fazem fetch client-side — primeiro paint mostra loading state
- Sem formulário de criação de contratos na UI (requer UUID de empresa — adicionar em iteração futura)

---

## Ficheiros Modificados

| Ficheiro | Tipo | Acção |
|---|---|---|
| `package.json` | Config | `build:prod` corrigido; `web-push` + `@types/web-push` adicionados |
| `src/components/admin/Sidebar.tsx` | UI | Grupos `erp` + `portal` adicionados com 6 novos links |
| `src/app/admin/erp/contratos/page.tsx` | UI | Criado |
| `src/app/admin/erp/faturas/page.tsx` | UI | Criado |
| `src/app/admin/erp/despesas/page.tsx` | UI | Criado |
| `src/app/admin/erp/fluxo-caixa/page.tsx` | UI | Criado |
| `src/app/admin/erp/relatorios/page.tsx` | UI | Criado |
| `src/app/admin/portal/utilizadores/page.tsx` | UI | Criado |
| `src/__tests__/unit/erp-admin-ui.test.ts` | Testes | Criado — 7 verificações estruturais |

---

*VD Platform — ADR-042 — 30 Jul 2026*
