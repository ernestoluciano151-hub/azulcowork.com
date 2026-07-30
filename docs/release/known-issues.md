# Known Issues — VD Platform v1.0 RC

> **Versão:** 1.0.0-rc  
> **Data:** 30 Julho 2026  
> **Sprint:** RC-1  
> **Política:** Freeze de funcionalidades. Apenas P0/P1 críticos corrigidos antes de GO.

---

## Legenda

| Prioridade | Descrição |
|---|---|
| 🔴 P0 — Bloqueador | Impede GO para produção |
| 🟠 P1 — Crítico | Corrigir antes de escalar para > 3 empresas |
| 🟡 P2 — Alto | Corrigir no próximo sprint (v1.1) |
| 🟢 P3 — Médio | Backlog para v1.2+ |
| ⚪ P4 — Baixo | Nice-to-have / cosmético |

---

## Issues Activos

### KI-001 — PORTAL_JWT_SECRET não é validada no startup

**Prioridade:** 🟠 P1  
**Componente:** Auth / Portal  
**Ficheiro:** `src/lib/auth.ts`, `src/middleware.ts`  
**Descrição:** Se `PORTAL_JWT_SECRET` não estiver configurada no Vercel, o sistema usa `JWT_SECRET + ":portal"` como fallback silencioso. Não há erro de startup — o problema só é detectado se o JWT_SECRET for comprometido.  
**Impacto:** Segurança degradada do portal se variável não configurada.  
**Mitigação actual:** `.env.example` documenta a variável; deployment checklist exige configuração.  
**Resolução planeada:** v1.1 — adicionar validação de startup em `src/lib/portal-auth-service.ts`.

---

### KI-002 — Sem integração EMIS (Pagamentos Angola)

**Prioridade:** 🟡 P2  
**Componente:** ERP / Pagamentos  
**Descrição:** O sistema documenta AOA como moeda e opera no contexto angolano, mas não tem integração nativa com EMIS (sistema interbancário angolano) nem com provedores de pagamento locais (referências multicaixa, TPA virtual).  
**Impacto:** Em modo piloto com pagamentos manuais (transferência bancária + confirmação manual), não é bloqueador. Para escala, é limitante.  
**Mitigação actual:** Pagamentos confirmados manualmente pela equipa Azul Coworking via `POST /api/erp/payments/[id]/confirm`.  
**Resolução planeada:** Volume 14 — Integração EMIS/Multicaixa.

---

### KI-003 — CSP com unsafe-inline e unsafe-eval

**Prioridade:** 🟡 P2  
**Componente:** Segurança / Headers  
**Ficheiro:** `next.config.js`  
**Descrição:** O `Content-Security-Policy` inclui `'unsafe-inline'` e `'unsafe-eval'` em `script-src`, necessários para Next.js e Tailwind. Reduz a protecção CSP contra XSS.  
**Impacto:** Baixo — a aplicação não tem UGC com renderização HTML directa. Risco de XSS reflectido mitigado pelo Prisma ORM (sem queries concatenadas).  
**Mitigação actual:** React escapa automaticamente interpolações JSX; Prisma usa queries parametrizadas.  
**Resolução planeada:** v1.2 — migrar para Next.js nonce-based CSP após remoção de inline scripts.

---

### KI-004 — Sem testes E2E (Playwright/Cypress)

**Prioridade:** 🟡 P2  
**Componente:** Qualidade / Testes  
**Descrição:** A suite de testes actual cobre unitários (42 ficheiros, ~128 testes) e integração simulada (2 ficheiros). Não existem testes E2E contra a aplicação real em staging.  
**Impacto:** Regressões de UI e fluxos de utilizador não são detectadas automaticamente.  
**Mitigação actual:** Smoke test manual descrito no deployment checklist (15 passos).  
**Resolução planeada:** v1.1 — adicionar Playwright com 5 fluxos críticos: login, reserva, fatura, portal magic link, audit.

---

### KI-005 — WhatsApp apenas como deep-link

**Prioridade:** 🟡 P2  
**Componente:** Comunicação / VOL07  
**Descrição:** A integração WhatsApp actual abre o WhatsApp Web via deep-link (`https://wa.me/+244...`). Não usa a WhatsApp Business API da Meta para envio automatizado de mensagens.  
**Impacto:** Mensagens WhatsApp requerem intervenção manual — não são automatizadas.  
**Mitigação actual:** Emails transaccionais automáticos cobrem todos os casos de uso críticos.  
**Resolução planeada:** Volume 15 — WhatsApp Business API real (requer aprovação Meta Business).

---

### KI-006 — Formulário de criação de contratos ausente na UI

**Prioridade:** 🟡 P2  
**Componente:** ERP Admin UI / VOL12  
**Ficheiro:** `src/app/admin/erp/contratos/page.tsx`  
**Descrição:** A página `/admin/erp/contratos` lista e gere o ciclo de vida de contratos mas não tem formulário de criação. Criar contratos requer conhecer o UUID da empresa — não é trivial para utilizadores não-técnicos.  
**Impacto:** Contratos criados via API directa ou SQL até haver UI de criação.  
**Mitigação actual:** Equipa técnica cria contratos na inauguração do piloto.  
**Resolução planeada:** v1.1 — adicionar modal de criação com autocomplete de empresa.

---

### KI-007 — Lighthouse não medido

**Prioridade:** 🟢 P3  
**Componente:** Performance  
**Descrição:** Métricas de Core Web Vitals (FCP, LCP, CLS, TBT) não foram medidas porque não há URL de produção ainda.  
**Impacto:** Sem baseline de performance documentado.  
**Resolução planeada:** Medir no D+1 após deploy. Registar em `performance-report.md`.

---

### KI-008 — Dupla configuração de email (SMTP + Resend)

**Prioridade:** 🟢 P3  
**Componente:** Emails / Automações  
**Descrição:** `.env.example` documenta tanto SMTP (Brevo, usado pelo sistema) como Resend (variáveis legadas). O código usa exclusivamente nodemailer via SMTP. A presença das variáveis Resend pode causar confusão operacional.  
**Impacto:** Cosmético — sem impacto funcional.  
**Resolução planeada:** v1.1 — remover variáveis Resend do `.env.example` ou documentar claramente como "não usadas".

---

### KI-009 — Paginação server-side ausente em listagens longas

**Prioridade:** 🟢 P3  
**Componente:** Performance / Admin UI  
**Descrição:** Listagens de contratos, faturas e despesas têm paginação client-side com fetch de 20 registos por página. Para volumes > 1000 registos (escala futura), a query sem índice adicional pode degradar.  
**Impacto:** Inexistente para piloto Azul Coworking (< 200 registos previstos em 12 meses).  
**Resolução planeada:** Volume 13 — paginação server-side com cursor.

---

### KI-010 — Sem backup automático fora do Neon

**Prioridade:** 🟢 P3  
**Componente:** Operações / Disaster Recovery  
**Descrição:** O Neon faz backups automáticos (PITR — Point In Time Recovery) mas não há backup exportado para armazenamento externo (S3, Cloudinary).  
**Impacto:** Em caso de encerramento do Neon, os dados só estão no painel Neon.  
**Mitigação actual:** Production runbook inclui procedimento de backup manual semanal.  
**Resolução planeada:** Volume 14 — cron de backup semanal para Cloudinary ou S3.

---

### KI-011 — Reconciliação bancária em JSON raw

**Prioridade:** ⚪ P4  
**Componente:** ERP Relatórios / Admin UI  
**Ficheiro:** `src/app/admin/erp/relatorios/page.tsx`  
**Descrição:** O separador "Reconciliação" exibe o JSON raw da API em vez de uma tabela formatada. Funcional mas não amigável.  
**Impacto:** Cosmético — os dados estão corretos.  
**Resolução planeada:** v1.1 — formatar em tabela com colunas Descrição / Valor / Data.

---

### KI-012 — Cross-Origin-Opener-Policy ausente

**Prioridade:** ⚪ P4  
**Componente:** Segurança / Headers  
**Ficheiro:** `next.config.js`  
**Descrição:** Headers `Cross-Origin-Opener-Policy` e `Cross-Origin-Embedder-Policy` não configurados. Não são obrigatórios para o modelo de ameaça actual.  
**Resolução planeada:** v1.2.

---

## Issues Resolvidos (pré-RC)

| ID | Descrição | Sprint |
|---|---|---|
| DT-011 | JWT fallback secret | P0-A |
| DT-012 | RBAC incompleto nas API Routes | P0-A |
| DT-013 | TOCTOU no conflict check de reservas | VOL04 |
| DT-014 | Numeração de documentos com race condition | P0-B |
| DT-016 | TOTP 2FA sem integração no login | P0-D |
| DT-017 | recordFinancialHistory fora de contexto tx | VOL04 |
| DT-002 | Sem testes unitários | P0-C |
| DT-001 | TypeScript ignoreBuildErrors | P0-D |
| DT-009 | Sem error monitoring (Sentry) | P0-D |
| DT-010 | Rate limiting incompleto | P0-D |
| DT-035 | Cron JSDoc fecha bloco com */5 | VOL03 fix |
| —      | build:prod sem prisma migrate deploy | VOL12 |
| —      | web-push ausente das dependências | VOL12 |

---

*VD Platform — Known Issues v1.0 RC — 30 Jul 2026*  
*Actualizar após cada incidente ou descoberta em produção*
