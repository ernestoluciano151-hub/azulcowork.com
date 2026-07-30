# ADR-039 — Arquitectura do Frontend do Portal do Cliente (VOL09)

> **Estado:** ✅ ACEITE  
> **Data:** 30 Julho 2026  
> **Contexto:** VOL09 — Portal do Cliente (Frontend)  
> **Autor:** Claude (Arquiteto-Chefe VD Platform)

---

## Contexto

O VOL03 implementou 40+ API routes para o Portal do Cliente mas deixou 0 páginas de frontend.
O VOL09 resolve este gap construindo o frontend completo que consome as APIs existentes.

Foram tomadas 5 decisões arquitecturais significativas.

---

## Decisão 1: Protecção de Rotas no Edge Middleware

**Problema:** Como proteger `/portal/*` sem ter acesso ao `portal-auth-service.ts` no Edge Runtime?

**Solução adoptada:** Actualizar `src/middleware.ts` para verificar o cookie `portal-session`
usando `jwtVerify` com a mesma derivação de segredo que o `portal-auth-service.ts`:
`PORTAL_JWT_SECRET ?? JWT_SECRET + ":portal"` (ADR-026).

**Alternativas consideradas:**
- Verificação apenas no lado do cliente → insegura (expõe páginas antes do JS carregar)
- Middleware separado para o portal → aumenta complexidade de deploy

**Resultado:** Rotas `/portal/*` são protegidas no Edge antes de qualquer chunk de JS ser servido.
Rotas excepcionadas: `/portal/login`, `/portal/auth/*`.

---

## Decisão 2: Contexto de Auth via `useContext` em vez de Cookies no Servidor

**Problema:** As páginas do portal são client components. Como partilhar dados do utilizador autenticado entre componentes sem re-fetch em cada um?

**Solução adoptada:** `PortalAuthContext` com `usePortalAuth()` hook.
O `PortalLayout` faz um único `fetch("/api/portal/auth/me")` e disponibiliza o utilizador via contexto React.

**Alternativas consideradas:**
- Server components com `cookies()` → requer refactoring da estrutura de layout; incompatível com navegação client-side fluida
- Props drilling → impraticável com árvore de 9+ páginas

**Resultado:** Fetch único por montagem do layout, zero prop drilling, padrão reutilizável.

---

## Decisão 3: Layout Partilhado vs. Route Groups

**Problema:** Todas as páginas autenticadas do portal precisam de sidebar + auth check.

**Solução adoptada:** Componente `PortalLayout.tsx` importado em cada página (mesmo padrão do `AdminLayout`).

**Alternativas consideradas:**
- Route group `(authenticated)/layout.tsx` → mais "Next.js way" mas adiciona complexidade de router; `PortalLayout` é mais explícito e segue o padrão já estabelecido no projecto

**Resultado:** Consistência total com o padrão admin. Zero magic de router para o PO entender.

---

## Decisão 4: Design — Light Theme para o Portal

**Problema:** A UI do admin usa dark sidebar (tons de slate escuro). O portal do cliente deve usar o mesmo design?

**Solução adoptada:** Light theme para o portal — fundo branco, sidebar branca com border, accento azul.

**Razão:** Clientes e colaboradores internos têm expectativas diferentes:
- Admin (interno): densidade de informação, acções múltiplas → dark/dense
- Portal (cliente externo): visibilidade imediata, confiança, familiaridade → light/clean

**Resultado:** Identidade visual Azul Coworking (azul) mantida; experiência adequada ao cliente externo.

---

## Decisão 5: Fluxo Magic Link — Página vs. API Route

**Problema:** O link de magic link pode apontar para `/portal/auth/magic?token=xxx` (página)
ou `/api/portal/auth/magic?token=xxx` (API route). Qual usar no email?

**Solução adoptada:** O email aponta para `/api/portal/auth/magic?token=xxx` (API route do VOL03).
A página `/portal/auth/magic/page.tsx` serve como fallback: se o utilizador aceder directamente,
redireciona para a API route.

**Razão:** A lógica de consumo do token e criação da sessão já existe na API route (VOL03).
Duplicar esta lógica numa server action seria violação do DRY e do SSoT.

**Resultado:** Zero duplicação. A página de callback é apenas um redirector visual.

---

## Impacto

| Módulo | Mudança |
|---|---|
| `src/middleware.ts` | Adicionada lógica de protecção portal |
| `src/components/portal/` | Nova pasta — 1 ficheiro |
| `src/app/portal/` | 17 ficheiros novos |
| APIs portal (VOL03) | Sem alterações |
| Schema Prisma | Sem alterações |

---

## Referências

- ADR-004 — Edge Runtime Isolation
- ADR-026 — Magic Link Authentication
- ADR-028 — Signed URL Downloads
- VOL03 — Portal do Cliente (Backend)

---

*VD Platform — ADR-039 — 30 Julho 2026*
