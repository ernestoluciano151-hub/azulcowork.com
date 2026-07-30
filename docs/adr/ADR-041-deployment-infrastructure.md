# ADR-041 — Deployment & Infraestrutura de Produção (VOL11)

> **Estado:** ✅ ACEITE  
> **Data:** 30 Julho 2026  
> **Contexto:** VOL11 — Deployment & Infraestrutura de Produção  
> **Autor:** Claude (Arquiteto-Chefe VD Platform)

---

## Contexto

Após a conclusão de VOL10, a plataforma tinha 11 endpoints de cron implementados e 28 variáveis de ambiente necessárias, mas:

1. `vercel.json` não tinha nenhum cron configurado → automações nunca corriam
2. `.env.example` documentava apenas 10 das 28 variáveis → deploys falhavam por configuração incompleta
3. `prisma/seed.js` não incluía 4 DocumentCounters e 3 EmailTemplates adicionados nos volumes anteriores → seed de produção incompleto

---

## Decisões

### D1 — `buildCommand` em `vercel.json`: `"npm run build:prod"`

**Decisão:** O `vercel.json` define `"buildCommand": "npm run build:prod"` que executa `prisma migrate deploy && next build`.

**Alternativas consideradas:**
- Deixar o build default da Vercel (`next build`) e executar migrations manualmente
- Usar Vercel `postInstall` hook

**Justificação:** Migrations automáticas no build garantem que cada deploy é sempre consistente com o schema em produção. Não há risco de deploy com schema desactualizado. `prisma migrate deploy` (não `dev`) é seguro em produção: apenas aplica migrations pendentes, nunca as regenera.

### D2 — Cron UTC = Africa/Luanda − 1h

**Decisão:** Todos os schedules Vercel Cron são definidos em UTC. Africa/Luanda (WAT) = UTC+1. Para executar às 07:00 WAT configura-se `0 6 * * *` UTC.

**Justificação:** Vercel Cron só aceita UTC. A conversão é simples e documentada em `vercel.json` inline nos comentários do README.

### D3 — Seed idempotente via `upsert`

**Decisão:** Todos os registos do `prisma/seed.js` usam `upsert` (ou `findFirst` + condicional). O seed pode ser re-executado em qualquer ambiente sem duplicar dados.

**Justificação:** Em produção, é comum precisar re-executar o seed após uma migração ou para repor dados de referência. Um seed destrutivo seria perigoso com dados reais presentes.

### D4 — `.env.example` como contrato de configuração

**Decisão:** `.env.example` é a SSoT de todas as variáveis de ambiente necessárias. Qualquer nova variável adicionada ao código deve ser simultaneamente documentada em `.env.example`.

**Justificação:** Sem esta regra, cada deploy de um novo ambiente (staging, produção secundária, dev de outro engenheiro) requer investigação arqueológica no código para descobrir quais variáveis são necessárias. O `.env.example` é o contrato.

**Enforcement:** O `CLAUDE.md` já define a regra. Adicionalmente, a auditoria de `.env.example` deve ser parte do checklist de PR (Gate 2).

---

## Consequências

- 11 crons activos em produção imediatamente após o próximo deploy
- Qualquer engenheiro pode configurar um ambiente de zero seguindo `.env.example`
- Seed de produção completo: todos os DocumentCounters e EmailTemplates presentes
- Migrations automáticas em cada deploy eliminam drift de schema

---

## Ficheiros Afectados

| Ficheiro | Alteração |
|---|---|
| `vercel.json` | Reescrito — 11 crons + buildCommand |
| `.env.example` | Reescrito — 28 variáveis em 11 secções |
| `prisma/seed.js` | 4 DocumentCounters + 3 EmailTemplates adicionados |
| `docs/14-deployment/migration.md` | Criado |
| `docs/14-deployment/README.md` | Criado |

---

*VD Platform — ADR-041 — 30 Jul 2026*
