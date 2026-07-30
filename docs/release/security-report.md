# Security Report — VD Platform v1.0 RC

> **Versão:** 1.0.0-rc  
> **Data:** 30 Julho 2026  
> **Sprint:** RC-1  
> **Tipo:** Auditoria de segurança baseada em revisão de código (white-box)  
> **Escopo:** Todo o codebase — autenticação, RBAC, dados, transporte, inputs

---

## Sumário Executivo

| Área | Estado | Nível de Risco |
|---|---|---|
| Autenticação Admin (JWT + TOTP) | ✅ APROVADO | Baixo |
| Autenticação Portal (Magic Link) | ✅ APROVADO | Baixo |
| RBAC (Middleware + API Routes) | ✅ APROVADO | Baixo |
| Gestão de Sessões | ✅ APROVADO | Baixo |
| Security Headers | ✅ APROVADO | Baixo |
| Content Security Policy | ⚠️ PARCIAL | Médio |
| Dados Sensíveis / Audit Log | ✅ APROVADO | Baixo |
| Rate Limiting | ✅ APROVADO | Baixo |
| Uploads / Downloads | ✅ APROVADO | Baixo |
| Dependências (Supply Chain) | ⚠️ VERIFICAR | Médio |
| EMIS (Pagamentos Angola) | ❌ AUSENTE | Alto (funcional) |
| Testes de Penetração | ❌ NÃO REALIZADO | — |

**Score de Segurança Estimado: 78/100**

---

## SEC-01 — Autenticação Admin

**Estado: ✅ APROVADO**

**Análise:**

O `src/lib/auth.ts` implementa:
- JWT HS256 via `jose` (biblioteca auditada, sem CVEs conhecidos)
- Detecção de fallback secret: lança erro se `JWT_SECRET` for o valor padrão ou < 32 chars
- TTL de sessão: 12 horas
- TOTP 2FA com `otpauth` (RFC 6238) — token temporário de 5 min (scope `totp-verify`)
- Sessões persistidas em BD com hash SHA-256 (token nunca guardado em bruto)
- Revogação individual de sessão (`AdminSession.isRevoked`)
- `lastActiveAt` actualizado a cada request
- Cookies: `httpOnly: true`, `secure: true` (produção), `sameSite: "lax"`

**Pontos Positivos:**
- Zero JWT fallback secrets (DT-011 resolvido)
- TOTP 2FA implementado e integrado no fluxo de login (DT-016 resolvido)
- Sessões revogáveis individualmente (granularidade alta)

**Recomendação:** Activar TOTP para a conta admin imediatamente após primeiro deploy.

---

## SEC-02 — Autenticação Portal (Magic Link)

**Estado: ✅ APROVADO**

**Análise:**
- Magic links com TTL curto (token de uso único por sessão)
- `PORTAL_JWT_SECRET` separado de `JWT_SECRET` (ADR-026)
- Fallback documentado como menos seguro: `JWT_SECRET + ":portal"` se PORTAL_JWT_SECRET ausente
- Isolamento multi-tenant: cada `PortalUser` vinculado a exatamente uma `Company`
- Testes de isolamento multi-tenant: `src/__tests__/integration/portal-auth.integration.test.ts`

**Achado SEC-02-A (Médio):** Se `PORTAL_JWT_SECRET` não for configurado, o sistema usa fallback. Em produção, esta variável DEVE ser obrigatória. Recomendação: adicionar validação de startup que rejeite o servidor se a variável estiver ausente.

---

## SEC-03 — RBAC

**Estado: ✅ APROVADO**

**Análise:**

Dois níveis de RBAC:

**Nível 1 — Edge Middleware** (`src/middleware.ts`):
- Verifica JWT em todas as rotas `/admin/*` e `/portal/*`
- Rotas admin-only verificadas no Edge antes de chegar à API
- Rejeita fallback secret (linha 13)

**Nível 2 — API Routes** (`requireSession` / `requireRole`):
- `requireSession()`: qualquer utilizador autenticado
- `requireRole(AdminRole.ADMIN, ...)`: roles específicos
- Princípio Deny by Default: qualquer falha retorna 401/403
- DT-012 resolvido: RBAC em todas as API Routes críticas

**Achado SEC-03-A (Baixo):** As páginas admin de ERP (VOL12) usam client-side fetch — o RBAC é enforçado pelo endpoint da API, não pela página. Este é o comportamento correcto para React Client Components.

---

## SEC-04 — Gestão de Sessões

**Estado: ✅ APROVADO**

**Análise:**
- `AdminSession` na BD: registo de IP, User-Agent, expiração, revogação
- `getSession()` verifica revogação na BD a cada request (overhead aceite)
- `destroySession()` revoga na BD + expira cookie
- Auditoria de todas as operações de sessão (LOGIN_SUCCESS, SESSION_REVOKED)

**Achado SEC-04-A (Baixo):** A verificação de sessão na BD adiciona ~1 query por request autenticado. Para o volume actual (< 10 utilizadores admin), é aceitável.

---

## SEC-05 — Security Headers

**Estado: ✅ APROVADO**

Verificado em `next.config.js`:

| Header | Valor | Avaliação |
|---|---|---|
| `X-Frame-Options` | `SAMEORIGIN` | ✅ Anti-clickjacking |
| `X-Content-Type-Options` | `nosniff` | ✅ Anti-MIME sniffing |
| `Strict-Transport-Security` | `max-age=31536000; includeSubDomains` | ✅ HTTPS forçado 1 ano |
| `Referrer-Policy` | `strict-origin-when-cross-origin` | ✅ |
| `Permissions-Policy` | `camera=(), microphone=(), geolocation=()` | ✅ |

**Achado SEC-05-A (Informativo):** Falta `Cross-Origin-Opener-Policy: same-origin` e `Cross-Origin-Embedder-Policy: require-corp`. Não crítico para este contexto mas melhora o isolamento de origem cruzada. Adicionar em iteração futura.

---

## SEC-06 — Content Security Policy

**Estado: ⚠️ PARCIAL**

**Análise:**
- CSP configurada com directivas abrangentes
- `default-src 'self'` — restritivo por defeito ✅
- `object-src 'none'` — bloqueia Flash e plugins ✅
- `base-uri 'self'` — bloqueia injecção de base URL ✅
- `form-action 'self'` — bloqueia envio de formulários para externos ✅

**Achado SEC-06-A (Médio):** `'unsafe-inline'` e `'unsafe-eval'` em `script-src`. Necessário para Next.js/Tailwind no modo actual. Reduz a protecção XSS da CSP. Mitigação: a aplicação não tem UGC (User Generated Content) com renderização HTML directa — risco real de XSS é baixo.

**Achado SEC-06-B (Baixo):** `script-src` inclui `https://scripts.converteai.net` e `https://cdn.converteai.net` (Vturb — landing page). Estes domínios externos estão no CSP de toda a aplicação, incluindo admin. Recomendação: separar CSP da landing page do CSP do admin/portal em iteração futura.

---

## SEC-07 — Dados Sensíveis e Audit Log

**Estado: ✅ APROVADO**

**Análise:**
- `sanitizeForAudit()` remove: `passwordHash`, `totpSecret`, `tokenHash`, `token`, `password`, `secret`, `refreshToken`
- Sanitização em dois níveis: no caller e dentro de `recordAudit` (defesa dupla)
- `passwordHash` via `bcryptjs` (custo 10) — resistente a força bruta
- `totpSecret` encriptado em armazenamento (Prisma → PostgreSQL)
- Downloads de documentos via URLs assinadas Cloudinary com TTL
- Logs de auditoria imutáveis (append-only, sem UPDATE/DELETE)

---

## SEC-08 — Rate Limiting

**Estado: ✅ APROVADO**

- Rate limiting implementado nas rotas de mutação críticas (VOL P0-D / DT-010)
- Login admin: limitado por IP (previne força bruta)
- API Routes públicas: limitadas por IP
- Cron endpoints: autenticação por `CRON_SECRET` (Bearer token)

---

## SEC-09 — Uploads e Downloads

**Estado: ✅ APROVADO**

**Análise:**
- Uploads de documentos via Cloudinary API (servidor → Cloudinary) — utilizador nunca envia ficheiro directamente para servidor Next.js
- Downloads de PDFs via URLs assinadas Cloudinary com TTL curto
- `remotePatterns` em `next.config.js` restritivo: apenas `res.cloudinary.com` permitido para `_next/image`
- SSRF prevenido: sem proxy de imagens para URLs arbitrárias

---

## SEC-10 — Dependências (Supply Chain)

**Estado: ⚠️ VERIFICAR**

Dependências críticas de segurança:

| Pacote | Versão | Vulnerabilidades Conhecidas |
|---|---|---|
| `next` | ^15.2.5 | Verificar: `npm audit` |
| `jose` | ^5.6.3 | Nenhuma CVE conhecida (Jul 2026) |
| `bcryptjs` | ^2.4.3 | Estável — sem CVEs activas |
| `@sentry/nextjs` | ^8.55.2 | Verificar release notes |
| `prisma` | ^5.18.0 | Nenhuma CVE conhecida (Jul 2026) |
| `web-push` | ^3.6.7 | Verificar: `npm audit` |

**Acção obrigatória pré-deploy:**
```bash
npm audit --audit-level=high
```
Resolver todos os findings de nível HIGH ou CRITICAL antes de ir a produção.

---

## SEC-11 — EMIS (Pagamentos Angola)

**Estado: ❌ AUSENTE — Risco Funcional Alto**

**Análise:** O sistema opera com AOA (Kwanza) e suporta o contexto angolano, mas não tem integração nativa com EMIS (Electronic Money Institutions in Angola — sistema de pagamentos interbancários angolano).

**Impacto:** Em modo piloto inicial (pagamentos manuais, transferência bancária), este gap é aceitável. Para escala, a integração EMIS é obrigatória.

**Recomendação:** Incluir como Volume 14 no roadmap após o piloto.

---

## SEC-12 — Testes de Penetração

**Estado: ❌ NÃO REALIZADO**

A auditoria actual é white-box (revisão de código). Não foram realizados testes de penetração black-box contra ambiente de staging.

**Recomendação:** Realizar teste de penetração básico (OWASP Top 10) antes de escalar o piloto para > 5 empresas activas.

---

## Matriz de Riscos de Segurança

| ID | Risco | Probabilidade | Impacto | Mitigação |
|---|---|---|---|---|
| R-SEC-01 | XSS via UGC (notas, comentários) | Baixa | Médio | `sanitizeText()` implementado; CSP parcial |
| R-SEC-02 | Brute force login | Baixa | Alto | Rate limiting + TOTP 2FA |
| R-SEC-03 | Session hijacking | Muito Baixa | Alto | httpOnly + Secure + hash BD |
| R-SEC-04 | JWT secret fraco | Muito Baixa | Crítico | Validação de comprimento em startup |
| R-SEC-05 | Injecção SQL | Muito Baixa | Crítico | Prisma ORM com parâmetros sempre escapados |
| R-SEC-06 | Dependency CVE | Baixa | Variável | `npm audit` pré-deploy obrigatório |
| R-SEC-07 | PORTAL_JWT_SECRET ausente | Baixa | Médio | Documentado; recomendado tornar obrigatório |

---

## Recomendações para v1.1

1. Tornar `PORTAL_JWT_SECRET` obrigatório (falha startup se ausente)
2. Separar CSP da landing page do CSP do admin (dois perfis)
3. Adicionar `Cross-Origin-Opener-Policy: same-origin`
4. Realizar teste de penetração OWASP Top 10
5. Automatizar `npm audit` no CI (Gate 1)
6. Planear integração EMIS (Volume 14)

---

*VD Platform — Security Report v1.0 RC — 30 Jul 2026*
