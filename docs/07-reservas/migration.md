# Plano de Migração e Riscos — Volume 04

> **Volume:** 04  
> **Estado:** 📋 Especificação — Aguarda aprovação PO  
> **Data:** 29 Julho 2026

---

## Sumário Executivo

**VOL04 não altera o schema Prisma.** Todas as mudanças são ao nível de:
- Lógica de negócio (API routes e serviços)
- Novos endpoints (availability admin, reports export, cron)
- Correcções de dívida técnica (DT-013, DT-017)
- Novos ficheiros de testes

**Risco de migração: BAIXO.** Não há migration Prisma neste volume.

---

## O que Muda por Sprint

### VOL04-1 — Hardening

| Ficheiro | Tipo de mudança | Risco | Rollback |
|---|---|---|---|
| `src/app/api/reservations/route.ts` | Adicionar Zod + mover `recordFinancialHistory` pós-tx | Médio | Reverter PR |
| `src/app/api/reservations/[id]/route.ts` | PATCH conflict check em $transaction serializable | Médio | Reverter PR |
| `src/lib/reservation-state-machine.ts` | Novo ficheiro (helper) | Baixo | Reverter PR |

**Impacto em dados existentes:** zero — mudanças apenas na lógica de validação.

**Impacto em UI existente:** zero — resposta das APIs mantém o mesmo contrato.

**Risco DT-013 fix:** O PATCH com horários actuais pode em teoria falhar em serializable
se houver contenção alta. Com volume de reservas do Azul Coworking (< 50/dia), o risco
de timeout por contenção é negligenciável.

**Risco DT-017 fix:** Mover `recordFinancialHistory` para fora da `$transaction` muda
a ordem de execução. Se a criação da reserva for bem-sucedida mas `recordFinancialHistory`
falhar, a reserva fica sem registo no financialHistory. Este comportamento é aceitável
dado que `recordFinancialHistory` é um efeito secundário não-crítico; a reserva e
documentos financeiros ficam íntegros.

---

### VOL04-2 — Política de cancelamento + cron + availability

| Ficheiro | Tipo de mudança | Risco |
|---|---|---|
| `src/lib/reservation-cancellation.ts` | Novo ficheiro (helper) | Baixo |
| `src/app/api/reservations/[id]/route.ts` | PATCH: validar cancelamento + retornar refundable | Baixo |
| `src/app/api/reservations/availability/route.ts` | Novo endpoint | Baixo |
| `src/app/api/cron/reservations-close/route.ts` | Novo endpoint cron | Baixo |

**Impacto em dados existentes:** zero.

**Nota sobre cron:** `CRON_SECRET` é obrigatório — sem ele o endpoint retorna 401.
Configurar no ambiente antes de activar o job externo.

---

### VOL04-3 — Pricing consolidation + MeetingPlan hardening

| Ficheiro | Tipo de mudança | Risco |
|---|---|---|
| `src/app/api/plans/route.ts` | Adicionar Zod + validação preços | Baixo |
| `src/app/api/plans/[id]/route.ts` | Soft-delete com verificação reservas futuras | Baixo |
| `src/app/api/admin/room-settings/route.ts` | Validação openTime < closeTime | Baixo |

---

### VOL04-4 e VOL04-5 — Testes

Apenas novos ficheiros em `src/__tests__/`. Sem impacto em produção.

---

### VOL04-6 — Documentação

Apenas ficheiros em `docs/07-reservas/`. Sem impacto em código.

---

## Verificação de Não-regressão

Antes de fundir qualquer PR de VOL04:

```bash
# 1. Build sem erros TypeScript
npm run build

# 2. Suite completa de testes (incluindo existentes)
npm test -- --run

# 3. Smoke test manual
# Criar reserva → confirmar → cancelar → verificar estado
# Criar reserva com sobreposição → deve retornar 409

# 4. Verificar PATCH de horário com sobreposição → 409
# 5. Verificar PATCH de status inválido → 422
```

---

## Variáveis de Ambiente Novas

| Variável | Obrigatória | Uso |
|---|---|---|
| `CRON_SECRET` | Sim (já existia no portal) | Autenticar `/api/cron/reservations-close` |

Sem novas variáveis de ambiente neste volume.

---

## Rollback

Dado que não há migration de base de dados, o rollback é simples:

```bash
# Reverter para commit anterior ao PR de VOL04-x
git revert [commit SHA]
# ou
git checkout [commit antes de VOL04-x] -- src/app/api/reservations/
```

Os dados em produção não são afectados por nenhuma mudança deste volume.

---

*VD Platform — Volume 04 — migration.md — 29 Julho 2026*  
*Especificação aguarda aprovação formal do Product Owner*
