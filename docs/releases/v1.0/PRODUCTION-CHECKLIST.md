# Checklist de Produção — VD Platform v1.0.0

> **Release Candidate:** v1.0.0-rc.1  
> **Data:** 29 Julho 2026  
> **Responsável:** Ernesto Pinto Luciano (Product Owner)  
> **Ambiente de produção:** Vercel + Neon PostgreSQL

---

## SECÇÃO 1 — Variáveis de Ambiente

Verificar que todas as variáveis estão configuradas no Vercel Dashboard → Settings → Environment Variables:

```
□ DATABASE_URL          = postgresql://[user]:[pass]@[host]/[db]?sslmode=require
□ JWT_SECRET            = [string aleatória ≥ 32 caracteres]
□ CLOUDINARY_CLOUD_NAME = [nome do cloud Cloudinary]
□ CLOUDINARY_API_KEY    = [chave API Cloudinary]
□ CLOUDINARY_API_SECRET = [secret Cloudinary]
□ SMTP_HOST             = [host SMTP — ex: smtp.gmail.com]
□ SMTP_PORT             = [porta — ex: 587]
□ SMTP_USER             = [email de envio]
□ SMTP_PASS             = [password/app-password]
□ SMTP_FROM             = Azul Coworking <geral@azulcowork.com>
□ CRON_SECRET           = [string aleatória ≥ 32 caracteres]
□ SENTRY_DSN            = [DSN do projecto Sentry — opcional mas recomendado]
□ NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME = [mesmo que CLOUDINARY_CLOUD_NAME]
```

**Critério:** Nenhuma variável obrigatória pode estar ausente ou com valor vazio.  
**Verificação:** `npm run build` em ambiente de staging deve completar sem erros.

---

## SECÇÃO 2 — Base de Dados

```
□ Migration `erp-volume02` aplicada (verificar via: npx prisma migrate status)
□ Migration `crm-schema` aplicada
□ Migration base aplicada (tabelas legado)
□ Seed de dados de referência executado:
  □ 9 CostCenters criados
  □ 22 ExpenseCategories criadas
  □ DocumentCounters criados (FT-CWORK, FT-SALA, REC, NL, RES)
□ AdminUser inicial criado (Ernesto Pinto Luciano, role: ADMIN)
□ Base de dados acessível a partir do ambiente Vercel (IP whitelist no Neon se necessário)
□ Connection pool configurado (Prisma Data Proxy ou PgBouncer para serverless)
□ Backup automático activado no Neon (mínimo: backup diário)
```

---

## SECÇÃO 3 — Build e Deploy

```
□ `npm run build` executa sem erros TypeScript
□ `npm test` → zero falhas (475 testes)
□ `npm run test:coverage` → cobertura ≥ 60% nos módulos críticos
□ Build gerado sem `ignoreBuildErrors: true` (está desactivado)
□ Bundle size verificado (Next.js bundle analyzer)
□ Nenhuma dependência com vulnerabilidade crítica (`npm audit`)
□ Deploy feito para ambiente de staging primeiro
□ Smoke tests em staging realizados (ver SECÇÃO 7)
□ Deploy para produção aprovado pelo PO
```

---

## SECÇÃO 4 — Segurança

```
□ JWT_SECRET tem ≥ 32 caracteres e não é o valor por omissão de desenvolvimento
□ CRON_SECRET tem ≥ 32 caracteres
□ Nenhuma credencial hardcoded no código (verificar com: git grep "secret\|password\|api_key" -- src/)
□ Rate limiting activo nas routes de mutação (verificar rateLimit.ts)
□ RBAC activo em todas as routes /api/admin/* e /api/erp/* (verificar com grep requireRole)
□ Cookie `httpOnly; Secure; SameSite=Strict` em produção (HTTPS obrigatório)
□ CSP configurada em next.config.js
□ HTTPS activo (Vercel activa por omissão com domínio personalizado)
□ TOTP 2FA configurado para utilizadores ADMIN e FINANCEIRO
□ Sentry activado com filtro de dados sensíveis (não registar JWT, passwords)
```

---

## SECÇÃO 5 — Cloudinary

```
□ Folder `/azul-cowork/erp/invoices/` existe e tem permissão de upload
□ Folder `/azul-cowork/erp/receipts/` existe e tem permissão de upload
□ Folder `/azul-cowork/images/` existe para upload de imagens
□ Upload preset configurado para uploads client-side (se usado)
□ Testar upload de PDF: POST /api/erp/invoices/[id]/send → pdfUrl deve ser devolvida
□ PDFs acessíveis via URL Cloudinary sem autenticação (resource_type: raw, acesso público)
```

---

## SECÇÃO 6 — Email (SMTP)

```
□ SMTP configurado e testado (enviar email de teste para geral@azulcowork.com)
□ Template de fatura renderiza correctamente (HTML responsivo)
□ Template de recibo renderiza correctamente
□ Template de lembrete renderiza correctamente
□ Template de overdue renderiza correctamente
□ Graceful degradation verificada: sem SMTP → operação continua + warning registado
□ FROM address verificada: "Azul Coworking <geral@azulcowork.com>"
□ SPF/DKIM/DMARC configurados no domínio azulcowork.com (anti-spam)
```

---

## SECÇÃO 7 — Smoke Tests de Produção

Executar manualmente após deploy, por esta ordem:

```
□ AUTENTICAÇÃO
  □ Login com admin@azulcowork.com → redireciona para /admin
  □ Login com password errada → 401
  □ Logout → cookie removido, redireciona para /login
  □ Acesso a /admin sem cookie → redireciona para /login

□ CRM
  □ GET /api/crm/companies → lista de empresas (pode estar vazia)
  □ POST /api/crm/companies → criar empresa de teste "Smoke Test Lda"
  □ GET /api/crm/companies/[id] → Customer 360° da empresa criada
  □ GET /api/crm/pipeline → Kanban (empresa no stage LEAD)
  □ GET /api/crm/dashboard → KPIs (sem erros 500)

□ ERP — Contratos
  □ POST /api/erp/contracts → criar contrato para "Smoke Test Lda"
  □ POST /api/erp/contracts/[id]/activate → activar contrato (gera RentSchedules)
  □ GET /api/erp/contracts/[id] → verificar RentSchedules gerados

□ ERP — Faturas
  □ POST /api/erp/invoices → criar fatura de teste (DRAFT)
  □ POST /api/erp/invoices/[id]/issue → emitir fatura (ISSUED)
  □ GET /api/erp/invoices/[id] → verificar número FT-CWORK-2026-000001
  □ POST /api/erp/invoices/[id]/send → enviar (PDF + email)

□ ERP — Pagamentos
  □ POST /api/erp/payments → registar pagamento
  □ POST /api/erp/payments/[id]/confirm → confirmar (gera REC-2026-000001)
  □ GET /api/erp/dashboard → MRR actualizado

□ ERP — Relatórios
  □ GET /api/erp/reports/pnl → P&L sem erros
  □ GET /api/erp/reports/vat?period=2026-07 → apuramento IVA
  □ GET /api/erp/reports/export?type=pnl&format=xlsx → download XLSX

□ CRON JOBS
  □ GET /api/cron/erp-daily (com header Authorization: Bearer ${CRON_SECRET}) → 200 OK
  □ GET /api/cron/erp-monthly-snapshot (com CRON_SECRET) → 200 OK
```

**Critério:** Todos os smoke tests devem retornar códigos 2xx sem erros 500.

---

## SECÇÃO 8 — Cron Jobs (Vercel Cron)

Configurar no `vercel.json`:

```json
{
  "crons": [
    {
      "path": "/api/cron/erp-daily",
      "schedule": "0 6 * * *"
    },
    {
      "path": "/api/cron/erp-monthly-snapshot",
      "schedule": "0 22 28-31 * *"
    }
  ]
}
```

```
□ vercel.json criado com as 2 entradas cron
□ CRON_SECRET configurado no Vercel (mesmo valor que .env)
□ Primeiro run manual do cron-daily verificado
□ Alertas gerados correctamente após run
```

---

## SECÇÃO 9 — Monitorização

```
□ Sentry activado com DSN de produção
□ Release tracking configurado no Sentry (v1.0.0)
□ Alertas Sentry para erros P0 (5xx em routes críticas)
□ Vercel Analytics activado (dashboard de performance)
□ Logs de produção verificados no Vercel Dashboard após primeiro deploy
□ Alerta de downtime configurado (ex: UptimeRobot para /api/admin/me)
```

---

## SECÇÃO 10 — Pós-Deploy

```
□ Primeiro contrato ERP criado manualmente para Azul Coworking
□ Primeira fatura ERP emitida e enviada
□ Primeiro pagamento confirmado e recibo gerado
□ Dashboard financeiro com dados reais verificado
□ Ernesto (PO) valida o sistema em produção
□ Equipa notificada do go-live
□ Data de go-live registada em docs/releases/v1.0/README.md
□ Métricas iniciais registadas em METRICS.md
```

---

## SECÇÃO 11 — Rollback (se necessário)

Ver procedimento detalhado em `BACKUP-ROLLBACK.md`.

```
□ Vercel → Deployments → seleccionar build anterior → Redeploy
□ Se schema DB alterado: executar rollback de migration (ver BACKUP-ROLLBACK.md)
□ Notificar equipa de rollback com motivo e ETA de fix
```

---

## Assinatura de Aprovação

```
□ Quality Gate 1 (lint + tsc + testes): APROVADO em __/__/2026
□ Quality Gate 2 (build + suite + cobertura): APROVADO em __/__/2026
□ Smoke tests em staging: APROVADO em __/__/2026
□ Product Owner (Ernesto Pinto Luciano): APROVADO em __/__/2026
□ Go-live autorizado: SIM / NÃO
```

---

*VD Platform — Production Checklist v1.0.0 — 29 Julho 2026*
