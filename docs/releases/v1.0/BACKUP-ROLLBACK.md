# Backup e Rollback — VD Platform v1.0.0

> **Documento:** RC-OPS-001  
> **Data:** 29 Julho 2026  
> **Responsável operacional:** Ernesto Pinto Luciano  
> **Criticidade:** ALTA — procedimentos a executar antes de qualquer deploy em produção

---

## 1. Estratégia de Backup

### 1.1 Base de Dados (Neon PostgreSQL)

**Backup automático (Neon):**
- Neon mantém snapshots automáticos dos últimos 7 dias (plano gratuito) ou 30 dias (plano Pro)
- Point-in-time recovery disponível na consola Neon
- Verificar periodicidade: Neon Dashboard → Project → Backups

**Backup manual antes de cada deploy:**

```bash
# 1. Exportar schema actual
npx prisma db pull --schema=prisma/schema-backup-$(date +%Y%m%d).prisma

# 2. Dump completo da base de dados (executar localmente com DATABASE_URL)
pg_dump "$DATABASE_URL" \
  --no-owner \
  --no-acl \
  --format=custom \
  --file="backup-vdplatform-$(date +%Y%m%d-%H%M).dump"

# 3. Guardar ficheiro de backup em local seguro (ex: Google Drive, S3)
```

**Frequência mínima:**
- Antes de cada deploy em produção: backup manual obrigatório
- Diário: backup automático Neon
- Semanal: exportar dump para storage externo

### 1.2 Código (Vercel + Git)

- O Vercel mantém histórico de todos os deployments com possibilidade de re-deploy
- Git mantém histórico completo de commits
- **Antes de cada deploy:** criar tag Git com a versão

```bash
# Criar tag da release
git tag -a v1.0.0 -m "Release Candidate v1.0.0 — 29 Jul 2026"
git push origin v1.0.0

# Antes de iniciar desenvolvimento de nova feature
git tag -a v1.0.0-pre-vol03 -m "Snapshot antes de Volume 03"
git push origin v1.0.0-pre-vol03
```

### 1.3 Cloudinary (Ficheiros)

- PDFs de faturas e recibos estão em `/azul-cowork/erp/`
- Cloudinary mantém os ficheiros indefinidamente (não há expiração automática)
- Backup opcional: Cloudinary → Media Library → Download folder (ZIP)
- Para histórico, os `pdfUrl` ficam gravados na BD — Cloudinary é apenas storage

---

## 2. Procedimento de Rollback

### 2.1 Rollback de Código (sem alteração de schema)

Este é o cenário mais comum: bug introduzido por código, sem migração de BD.

```bash
# PASSO 1: Identificar a versão anterior no Vercel
# Vercel Dashboard → Project → Deployments → seleccionar build anterior

# PASSO 2: Re-deploy da versão anterior
# Vercel Dashboard → Deployment → "..." → "Redeploy"
# OU via CLI:
vercel rollback [deployment-url]

# PASSO 3: Verificar saúde após rollback
curl -s https://[dominio]/api/admin/me -H "Cookie: session=[token]" | jq .
# Esperado: 200 OK com dados do utilizador

# PASSO 4: Notificar equipa
# "Rollback para v[X.Y.Z] executado em [hora]. Motivo: [descrição do problema]"

# PASSO 5: Registar incidente
# Criar entry em docs/releases/incidents/YYYY-MM-DD-[descricao].md
```

**Tempo estimado:** 2–5 minutos

### 2.2 Rollback de Schema de Base de Dados

**ATENÇÃO:** Rollback de schema é complexo e pode resultar em perda de dados.
Executar APENAS se o deploy introduziu uma migração problemática.

**Pré-condição:** Backup manual feito antes do deploy (obrigatório).

```bash
# PASSO 1: Confirmar que existe backup recente
ls -la backup-vdplatform-*.dump
# Se não existir backup → NÃO executar rollback de schema; contactar Neon support

# PASSO 2: Reverter migration com Prisma
# (Só possível se a migration ainda não foi aplicada em produção
#  ou se o Prisma tem migration de reversão)
npx prisma migrate resolve --rolled-back [migration-name]

# PASSO 3: Se não for possível via Prisma, restaurar a partir do dump
pg_restore \
  --dbname="$DATABASE_URL" \
  --no-owner \
  --clean \
  --if-exists \
  backup-vdplatform-[YYYYMMDD-HHMM].dump

# PASSO 4: Verificar integridade após restore
npx prisma db pull
npx prisma validate

# PASSO 5: Re-deploy da versão de código compatível com o schema restaurado
vercel rollback [deployment-url-anterior]
```

**Tempo estimado:** 15–30 minutos  
**Risco:** ALTO — pode resultar em perda de dados inseridos entre o backup e o rollback

### 2.3 Rollback Parcial (Feature Flag)

Se o problema afecta apenas um módulo e o código é facilmente isolável:

```bash
# Opção 1: Reverter apenas o ficheiro problemático
git revert [commit-hash]
git push origin main
# Vercel auto-deploys em push para main

# Opção 2: Hotfix directo
git checkout -b hotfix/v1.0.1
# corrigir o problema
git commit -m "fix: [descrição do problema] — hotfix v1.0.1"
git push origin hotfix/v1.0.1
# Deploy manual do hotfix via Vercel
```

---

## 3. Procedimento de Deploy Seguro

```
PRÉ-DEPLOY:
  □ 1. Criar tag Git com versão actual: git tag -a v[X.Y.Z] -m "..."
  □ 2. Executar backup manual da BD
  □ 3. Confirmar que todos os testes passam: npm test
  □ 4. Confirmar build sem erros: npm run build
  □ 5. Smoke tests em staging realizados

DEPLOY:
  □ 6. Merge do PR para main (triggera auto-deploy no Vercel)
  □ 7. Aguardar deploy completo (Vercel Dashboard → Deployments)
  □ 8. Verificar que não há erros no Vercel build log

PÓS-DEPLOY:
  □ 9. Smoke tests em produção (SECÇÃO 7 do PRODUCTION-CHECKLIST.md)
  □ 10. Verificar Sentry: zero novos erros nos primeiros 15 minutos
  □ 11. Verificar logs de produção (Vercel → Functions → Logs)
  □ 12. Se problema detectado → ROLLBACK imediato (não tentar fix em produção)
```

---

## 4. Contactos de Emergência

```
Product Owner:    Ernesto Pinto Luciano
Email:            versaodigitallda@gmail.com
Empresa:          VERSÃO DE NEGÓCIOS - COMÉRCIO GERAL E PRESTAÇÃO DE SERVIÇOS, LDA

Suporte Neon:     https://console.neon.tech/support
Suporte Vercel:   https://vercel.com/help
Suporte Cloudinary: https://support.cloudinary.com
```

---

## 5. Registro de Incidents

Criar ficheiro `docs/releases/incidents/YYYY-MM-DD-[slug].md` para cada incidente
com o seguinte template:

```markdown
# Incidente — [YYYY-MM-DD]

**Severidade:** P0 / P1 / P2
**Estado:** ABERTO / RESOLVIDO
**Detectado:** [hora]
**Resolvido:** [hora]
**Duração:** [X minutos]

## Descrição
[O que aconteceu]

## Causa Raiz
[Porquê aconteceu]

## Impacto
[Quem foi afectado, o quê não funcionou]

## Acções de Remediação
1. [Acção tomada]
2. [Rollback executado]

## Acções Preventivas
[Como evitar no futuro]
```

---

*VD Platform — Backup & Rollback v1.0.0 — 29 Julho 2026*
