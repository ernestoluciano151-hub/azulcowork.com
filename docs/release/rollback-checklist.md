# Rollback Checklist — VD Platform v1.0

> **Versão:** 1.0.0-rc  
> **Data:** 30 Julho 2026  
> **Sprint:** RC-1  
> **Objectivo:** Reverter a produção para o estado anterior em < 15 minutos

---

## Critérios de Activação de Rollback

Activar rollback **imediatamente** se qualquer das seguintes condições ocorrer:

```
🔴 Login de admin impossível (auth quebrado)
🔴 Erro 500 em > 5% dos requests nos primeiros 30 minutos
🔴 Migrations falharam — base de dados inconsistente
🔴 Sentry reporta > 10 erros críticos em < 5 minutos
🔴 Dados financeiros corrompidos (valores errados em faturas/pagamentos)
🔴 Loop de redirect no portal ou admin
```

---

## Decisão de Rollback

Quem pode autorizar rollback: **Ernesto Pinto Luciano (Product Owner)** ou qualquer administrador técnico.

Tempo máximo para decidir após incidente crítico: **10 minutos**.

---

## Procedimento de Rollback

### Passo 1 — Rollback do Deploy Vercel (2–3 minutos)

```bash
# No painel Vercel:
# Deployments → seleccionar deployment anterior → "Promote to Production"
#
# OU via CLI (se CLI instalado):
vercel rollback [deployment-id] --scope [team-slug]
```

O deployment anterior é automaticamente promovido. O Next.js não tem estado — o rollback é instantâneo.

### Passo 2 — Verificar Estado Após Rollback (2 minutos)

```
□ Confirmar que o URL de produção responde (HTTP 200 em /)
□ Confirmar login de admin funciona
□ Confirmar que /admin/dashboard carrega
□ Confirmar que portal responde em /portal/login
```

### Passo 3 — Rollback de Migrations (apenas se necessário)

**ATENÇÃO:** Migrations Prisma não reversíveis automaticamente. Executar apenas se o Passo 1 não resolver.

```bash
# Identificar a migration anterior
DATABASE_URL="postgresql://..." npx prisma migrate status

# Opção A — Reverter migration específica (se tiver script de down)
# (VD Platform não tem scripts de down por defeito)

# Opção B — Restaurar backup da BD (preferido)
# Ver secção "Backup e Restore" em production-runbook.md
```

**Nota:** Se o Passo 1 (rollback Vercel) resolver o problema, o Passo 3 geralmente NÃO é necessário — as migrations são aditivas e o código anterior continua compatível com o schema mais recente na maioria dos casos.

### Passo 4 — Verificação Pós-Rollback (3 minutos)

```
□ Login admin funciona
□ TOTP 2FA funciona
□ Criação de reserva funciona
□ Dashboard ERP carrega (Contratos, Faturas)
□ Portal do cliente acessível
□ Sentry: sem novos erros críticos
□ Notificar Product Owner do estado
```

### Passo 5 — Comunicação (imediato após rollback)

```
□ Notificar equipa por WhatsApp/email: "Rollback executado — a investigar causa"
□ Registar incidente no Sentry (ou ficheiro de incidentes)
□ Abrir issue no repositório com: sintoma, timeline, causa provável
□ NÃO re-tentar deploy sem análise de causa raiz
```

---

## Rollback de Dados (Worst Case)

Se a migration corrompeu dados (ex: drop de coluna com dados importantes):

```
1. Suspender acesso ao sistema (manter página de manutenção)
2. Exportar estado actual da BD:
   DATABASE_URL="..." pg_dump -Fc -f backup_pos_incidente.dump DB_NAME
3. Restaurar backup mais recente pré-deploy:
   pg_restore -d DB_NAME --clean backup_pre_deploy.dump
4. Re-aplicar apenas as migrations seguras
5. Validar integridade dos dados financeiros
6. Re-activar acesso
```

**Tempo estimado:** 30–90 minutos dependendo do tamanho da BD.

---

## Contactos de Emergência

| Responsável | Contacto | Papel |
|---|---|---|
| Ernesto Pinto Luciano | versaodigitallda@gmail.com | Product Owner |
| Suporte Vercel | vercel.com/support | Infraestrutura |
| Suporte Neon | neon.tech/support | Base de dados |
| Suporte Sentry | sentry.io/support | Monitoring |

---

## Lições Aprendidas (Actualizar após incidentes)

| Data | Incidente | Causa | Resolução | Tempo |
|---|---|---|---|---|
| — | — | — | — | — |

---

*VD Platform — Rollback Checklist v1.0 — 30 Jul 2026*
