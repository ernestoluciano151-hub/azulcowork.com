# ADR-037 — Arquitectura de Comunicação: Audit Log, Templates DB, WhatsApp Deep-Link (VOL07)

**Data:** 2026-07-30  
**Estado:** ✅ ACEITE  
**Volume:** VOL07 — Comunicação Avançada  
**Autor:** Arquiteto-Chefe VD Platform

---

## Contexto

Antes do VOL07, o VD Platform enviava emails via funções isoladas em `email.ts` e `erp-email-service.ts` sem qualquer registo persistente. As consecuências eram:

- Impossibilidade de verificar se um email foi de facto enviado
- Templates hardcoded em código — sem gestão pelo operador
- WhatsApp limitado a deep-link manual, sem registo
- Crons de alertas dispersos por vários ficheiros sem orquestração central

O VOL07 foi desenhado para resolver estas lacunas de forma incremental e backward-compatible.

---

## Decisões

### D1 — CommunicationLog como registo único de todas as comunicações

**Decisão:** Criar o modelo `CommunicationLog` no schema Prisma como SSoT (Single Source of Truth) de todas as comunicações (emails e WhatsApp).

**Alternativas consideradas:**
- A. Registar apenas em logs de servidor (stdout) → sem persistência, sem auditoria
- B. Tabela separada por tipo (EmailLog, WhatsAppLog) → duplicação de queries e lógica

**Escolha:** Modelo único com campo `type: CommType` (EMAIL | WHATSAPP | WHATSAPP_DEEPLINK). Índices em `status`, `type`, `entityType/entityId`, `createdAt`, `to`.

**Justificação:** SSoT reduz complexidade. Um único ponto para admins consultarem o histórico completo. Facilita retry automático e KPIs de comunicação.

### D2 — Logging fire-and-forget em email.ts e erp-email-service.ts

**Decisão:** Adicionar `void logEmail(...)` às funções existentes sem alterar as suas assinaturas públicas. Backward-compatible total.

**Alternativas consideradas:**
- A. Migrar todas as chamadas para `communication-service.ts` imediatamente → quebraria os callers existentes
- B. Logging síncrono → falha de BD bloquearia envio de email

**Escolha:** Fire-and-forget (`void logEmail(...)`) com try/catch interno. Um erro no log nunca bloqueia o envio.

**Consequências:** Possível perda de log em crash extremo, mas nunca perda de email. Aceitável para esta fase.

### D3 — EmailTemplate: templates editáveis armazenados em BD

**Decisão:** Criar modelo `EmailTemplate` com slug único, subject, htmlBody (`@db.Text`), variáveis declaradas, categoria e flag isActive.

**Alternativas consideradas:**
- A. Templates em ficheiros `.html` no filesystem → não editáveis em runtime
- B. Templates em variáveis de ambiente → sem versionamento nem UI de edição
- C. CMS externo (Sendgrid, Mailchimp) → dependência externa, custo, sem controlo

**Escolha:** BD relacional. O operador pode editar templates via UI sem deploy. O `communication-service.ts` carrega o template em runtime, interpola variáveis e envia.

**Consequências:** Seed obrigatório com 8 templates iniciais. Se BD indisponível → fallback para subject/html passados pelo caller (graceful degradation).

### D4 — Interpolação com `{{variavel}}` (duplas chaves)

**Decisão:** Usar `{{variavel}}` com espaços opcionais como delimitadores de variável, implementado em `template-interpolator.ts` (funções puras, zero dependências).

**Alternativas consideradas:**
- A. Mustache.js / Handlebars → dependência externa, features desnecessárias para este caso
- B. `${variavel}` (template literals JS) → confunde-se com código; não editável em HTML

**Escolha:** Implementação própria com regex `/\{\{\s*(\w+)\s*\}\}/g`. Zero dependências, totalmente testável.

**Consequências:** Limitado a substituição simples (sem condicionais, loops). Suficiente para os 8 templates actuais. Se forem necessários condicionais no futuro → ADR separado.

### D5 — WhatsApp: Z-API com fallback automático para deep-link

**Decisão:** `whatsapp-service.ts` tenta Z-API se `WHATSAPP_API_URL` + `WHATSAPP_API_TOKEN` configurados; caso contrário, gera URL `wa.me/` e regista em CommunicationLog com `type=WHATSAPP_DEEPLINK`.

**Alternativas consideradas:**
- A. Só Z-API → falha se não configurado; bloqueia desenvolvimento local
- B. Só deep-link → nunca envia automaticamente

**Escolha:** Detecção automática em runtime. Em ambos os modos, o envio é registado em CommunicationLog, permitindo auditoria completa.

---

## Ficheiros Afectados

| Ficheiro | Tipo | Motivo |
|---|---|---|
| `prisma/schema.prisma` | Editado | CommunicationLog + EmailTemplate + enums CommType/CommStatus |
| `prisma/seed.js` | Editado | 8 EmailTemplate records (upsert idempotente) |
| `src/lib/template-interpolator.ts` | Criado | Funções puras de interpolação {{var}} |
| `src/lib/communication-service.ts` | Criado | Orquestrador central: template → interpolação → envio → log |
| `src/lib/whatsapp-service.ts` | Criado | Z-API + deep-link fallback + log |
| `src/lib/email.ts` | Editado | Logging fire-and-forget em 4 funções |
| `src/lib/erp-email-service.ts` | Editado | Logging fire-and-forget em 4 funções |
| `src/app/api/admin/email-templates/route.ts` | Criado | GET list + PATCH edit |
| `src/app/api/admin/email-templates/[slug]/route.ts` | Criado | GET detalhe |
| `src/app/api/admin/email-templates/[slug]/preview/route.ts` | Criado | POST pré-visualização |
| `src/app/api/communication/route.ts` | Criado | GET histórico paginado |
| `src/app/api/communication/[id]/route.ts` | Criado | GET detalhe |
| `src/app/api/communication/[id]/retry/route.ts` | Criado | POST retry manual |
| `src/app/api/cron/communication-daily/route.ts` | Criado | Cron diário retry |
| `src/app/admin/comunicacao/page.tsx` | Criado | Centro de Comunicação UI |
| `src/app/admin/configuracoes/email-templates/page.tsx` | Criado | Gestão de templates |
| `src/components/admin/Sidebar.tsx` | Editado | Grupo "Comunicação" + 2 links |
| `src/__tests__/unit/template-interpolator.test.ts` | Criado | 17 assertions |
| `src/__tests__/unit/communication-service.test.ts` | Criado | 8+ assertions |

---

## Consequências

**Positivas:**
- Auditoria completa de toda a comunicação enviada (emails + WhatsApp)
- Templates editáveis em runtime sem deploy
- Retry automático de emails falhados (cron diário)
- Retry manual via UI para emails FAILED
- WhatsApp com fallback gracioso para deep-link
- Zero regressões nas funções de email existentes (assinaturas inalteradas)

**Negativas / Riscos:**
- Migração de BD necessária (`prisma migrate dev`) antes do deploy
- Templates na BD começam vazios — seed obrigatório
- Z-API requer configuração manual de WHATSAPP_API_URL e WHATSAPP_API_TOKEN
- HTML dos templates é editável livremente — sem sanitização server-side (risco de XSS nas pré-visualizações iframe, mitigado com `sandbox="allow-same-origin"`)

---

## Env Vars Novas

```
WHATSAPP_API_URL     # URL base da Z-API (ex: https://api.z-api.io/instances/xxx)
WHATSAPP_API_TOKEN   # Token de autenticação Z-API
```

---

*ADR-037 aprovado em 30 de Julho de 2026*
