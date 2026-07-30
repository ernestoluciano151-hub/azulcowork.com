# Quality Gate — VD Platform

> **Documento:** P0-002  
> **Estado:** ✅ Aprovado  
> **Data de Entrada em Vigor:** Após conclusão da Fase P0  
> **Aplicação:** Obrigatório para todos os sprints, PRs e deploys a partir de Setembro 2026  
> **Autoridade:** Arquiteto-Chefe / Product Owner  

---

## 1. O Que é o Quality Gate

O **Quality Gate** é um conjunto de verificações automáticas e manuais que **qualquer alteração ao codebase deve passar** antes de ser integrada no ramo principal e antes de ser publicada em produção.

O Quality Gate é **não-negociável**. Não existe excepção de urgência, pressão de prazo ou "só desta vez". Se uma alteração não passa o gate, não avança. Se um prazo está em risco por causa do gate, o prazo é renegociado — não o gate.

> *"A velocidade sustentável é maior do que a velocidade de sprint com regressões."*

---

## 2. Três Pontos de Controlo

```
Código escrito
      │
      ▼
┌─────────────────────────────────┐
│   GATE 1: PRE-COMMIT            │  ← Automático (local)
│   - lint                        │
│   - type check                  │
│   - testes afectados            │
└─────────────────────────────────┘
      │ passa
      ▼
┌─────────────────────────────────┐
│   GATE 2: PRE-MERGE (PR)        │  ← Automático (CI) + Revisão
│   - build completo              │
│   - suite de testes completa    │
│   - cobertura mínima            │
│   - checklist de revisão        │
└─────────────────────────────────┘
      │ passa
      ▼
┌─────────────────────────────────┐
│   GATE 3: PRE-DEPLOY            │  ← Manual + Automático
│   - smoke tests em staging      │
│   - migração de dados validada  │
│   - rollback planeado           │
└─────────────────────────────────┘
      │ passa
      ▼
   Produção
```

---

## 3. Gate 1 — Pre-Commit

### 3.1 Verificações Automáticas (Husky + lint-staged)

```json
// package.json
"lint-staged": {
  "*.{ts,tsx}": [
    "eslint --fix",
    "prettier --write",
    "bash -c 'npx tsc --noEmit'"
  ]
}
```

### 3.2 Checklist Manual (antes de `git commit`)

```
□ O código que estou a commitar tem um propósito claro e único (Single Responsibility)
□ Não adicionei console.log de debug
□ Não hardcodei credenciais, segredos ou IPs
□ Operações multi-tabela usam prisma.$transaction()
□ Input do utilizador é validado no servidor
□ Sem any TypeScript não justificado
□ Se adicionei nova lógica de negócio → Business Bible consultada
□ Se alterei schema → migration criada com nome descritivo
```

### 3.3 Comandos a Correr Antes de Commit

```bash
npm run lint         # ESLint — zero warnings em ficheiros críticos
npx tsc --noEmit     # TypeScript — zero erros
npm test             # Vitest — zero falhas nos testes existentes
```

---

## 4. Gate 2 — Pre-Merge (Pull Request)

### 4.1 Verificações Automáticas (CI)

| Check | Comando | Requisito |
|---|---|---|
| Build de produção | `npm run build` | Sem erros |
| TypeScript | `npx tsc --noEmit` | Sem erros |
| ESLint | `npm run lint` | Sem erros |
| Testes | `npm test` | 100% pass |
| Cobertura | `npm run test:coverage` | ≥ 60% global |
| Cobertura módulos críticos | (ver thresholds) | ≥ thresholds definidos |

### 4.2 Thresholds de Cobertura por Módulo

| Módulo | Lines | Functions | Branches |
|---|---|---|---|
| `src/lib/pricing-service.ts` | 95% | 100% | 90% |
| `src/lib/finance-service.ts` | 70% | 75% | 65% |
| `src/lib/finance.ts` | 70% | 80% | 65% |
| `src/lib/document-numbering.ts` | 90% | 100% | 85% |
| `src/lib/validators.ts` | 100% | 100% | 100% |
| `src/lib/rateLimit.ts` | 80% | 100% | 75% |
| `src/lib/auth.ts` | 70% | 80% | 65% |
| **Global** | **60%** | **65%** | **55%** |

### 4.3 Checklist de Revisão de PR

O PR não pode ser aprovado sem este checklist preenchido pelo autor:

```markdown
## Checklist do PR

### Contexto
- [ ] Descrevi o propósito desta alteração no título do PR
- [ ] Liguei o PR ao item do backlog correspondente (RFT-NNN ou task do sprint)
- [ ] Descrevi o comportamento ANTES e DEPOIS

### Código
- [ ] Sem any TypeScript não justificado
- [ ] Sem console.log de debug
- [ ] Sem credenciais hardcoded
- [ ] Operações multi-tabela usam prisma.$transaction()
- [ ] Eventos publicados APÓS persistência
- [ ] Input do utilizador validado no servidor

### Segurança
- [ ] Role do utilizador verificada antes de operações sensíveis
- [ ] Sem exposição de dados sensíveis em respostas de erro
- [ ] Sem bypass de autenticação

### Base de Dados (se migration)
- [ ] Nome da migration é descritivo
- [ ] Migration testada em base de dados com dados
- [ ] Backup considerado se migration é destrutiva
- [ ] domain-model.md actualizado

### Regras de Negócio
- [ ] Business Bible consultada para regras afectadas
- [ ] Numeração de documentos usa nextDocumentNumber()
- [ ] SSoT preservado (sem duplicação de dados)

### Testes
- [ ] Testes adicionados ou actualizados para a lógica alterada
- [ ] Casos de erro testados
- [ ] npm test passa localmente
```

### 4.4 Critérios de Aprovação do PR

O PR pode ser fundido quando:
1. Todos os checks automáticos passam (verde no CI)
2. O checklist está preenchido e sem itens falhados
3. O Arquiteto-Chefe (ou designado) revisou e aprovou o código
4. Sem comentários de revisão em aberto ("requested changes")

---

## 5. Gate 3 — Pre-Deploy (Produção)

### 5.1 Verificações Automáticas

```bash
# Em ambiente de staging antes do deploy
npm run build         # Build completo sem erros
npm test              # Suite de testes completa
npm run test:coverage # Cobertura dentro dos thresholds
```

### 5.2 Smoke Tests Obrigatórios (Manual)

Executar em staging após deploy, antes de promover para produção:

```
AUTENTICAÇÃO:
□ Login com credenciais válidas → sessão criada
□ Login com credenciais inválidas → 401 (sem leak de informação)
□ Acesso a /admin/ sem sessão → redirect para login
□ Utilizador VIEWER não consegue DELETE /api/companies
□ Utilizador COMERCIAL não consegue /api/finance/*

RESERVAS:
□ Criar reserva com data disponível → sucesso
□ Criar reserva com data ocupada → 409 (conflito)
□ Criar duas reservas em simultâneo para a mesma data → apenas uma criada

FINANCEIRO:
□ Confirmar pagamento de reserva → Invoice + LiquidationNote criados
□ Número de documento gerado segue formato correcto
□ FinancialAudit entry criado

NOTIFICAÇÕES:
□ Email de confirmação enviado após reserva
□ Número de WhatsApp correcto no email

SENTRY:
□ Erro 500 intencionado aparece no dashboard Sentry dentro de 2 minutos
```

### 5.3 Checklist Pre-Deploy

```
ANTES DO DEPLOY:
□ Todas as variáveis de ambiente configuradas no Vercel (ver lista completa abaixo)
□ JWT_SECRET configurado e com valor seguro (≥ 32 caracteres)
□ DATABASE_URL aponta para produção
□ SENTRY_DSN configurado
□ Migrations de DB executadas em produção (npx prisma migrate deploy)
□ Backup da DB realizado antes de migrations destrutivas

DEPOIS DO DEPLOY:
□ Smoke tests executados (lista acima)
□ Logs Vercel verificados (sem erros 5xx inesperados)
□ Sentry confirma sem novos erros críticos nas primeiras 15 min
□ Métricas de performance normais (< 300ms para operações normais)

ROLLBACK PLAN:
□ Versão anterior do Vercel deployment identificada
□ Migration de rollback disponível se schema foi alterado
□ Product Owner informado do deploy e janela de monitorização
```

### 5.4 Variáveis de Ambiente Obrigatórias

| Variável | Obrigatória | Descrição |
|---|---|---|
| `DATABASE_URL` | ✅ | PostgreSQL em produção |
| `JWT_SECRET` | ✅ | Min. 32 chars, gerado com `openssl rand -base64 32` |
| `ADMIN_EMAIL` | ✅ | Email do admin para notificações |
| `SMTP_HOST` | ✅ | Servidor SMTP |
| `SMTP_PORT` | ✅ | Porta SMTP (465 para SSL) |
| `SMTP_USER` | ✅ | Utilizador SMTP |
| `SMTP_PASS` | ✅ | Senha SMTP |
| `CLOUDINARY_CLOUD_NAME` | ✅ | Para upload de ficheiros |
| `CLOUDINARY_API_KEY` | ✅ | |
| `CLOUDINARY_API_SECRET` | ✅ | |
| `SENTRY_DSN` | ✅ | Error monitoring (prod) |
| `NEXT_PUBLIC_SENTRY_DSN` | ✅ | Sentry client-side |
| `NEXT_PUBLIC_SITE_URL` | ✅ | URL base da plataforma |
| `NEXT_PUBLIC_VTURB_PLAYER_KEY` | ⚠️ Condicional | Se player de video activo |
| `UPSTASH_REDIS_REST_URL` | ⚠️ Fase 1 | Rate limiting multi-instância |
| `UPSTASH_REDIS_REST_TOKEN` | ⚠️ Fase 1 | |

---

## 6. Gates por Tipo de Alteração

### 6.1 Alteração de Schema Prisma

```
GATES ADICIONAIS:
□ A alteração está documentada em domain-model.md ANTES de implementar
□ Migration criada com nome descritivo (não "migration_1", "fix", etc.)
□ Migration testada em DB com dados reais similares à produção
□ Verificar: campos NOT NULL têm default ou são adicionados em duas fases
□ Verificar: CASCADE rules são intencionais
□ Verificar: indexes necessários foram adicionados
□ Backup da DB de produção ANTES de aplicar
□ Plano de rollback: migration de rollback existe e foi testada
□ Product Owner aprovou a alteração de schema explicitamente
```

### 6.2 Alteração de Lógica Financeira

```
GATES ADICIONAIS:
□ FinanceService é o único ponto de criação de Invoice/Payment/LiquidationNote
□ A operação usa prisma.$transaction()
□ FinancialAudit entry é criado
□ Numeração de documentos usa nextDocumentNumber()
□ Testes unitários cobrem o caminho financeiro alterado
□ Role FINANCEIRO ou ADMIN verificado no endpoint
□ IVA calculado correctamente: base = subtotal - desconto
□ Testado com pagamento parcial e pagamento total
```

### 6.3 Alteração de Autenticação/Segurança

```
GATES ADICIONAIS:
□ Qualquer alteração ao flow de auth é discutida e aprovada antes de implementar
□ Timing attacks considerados (respostas de tempo uniforme)
□ Rate limiting aplicado a novos endpoints públicos
□ JWT_SECRET nunca em código, sempre em variável de ambiente
□ Cookies httpOnly para tokens de sessão
□ Revisão de segurança manual obrigatória (ver checklist 7 em 00-foundation/checklist.md)
```

### 6.4 Novo Endpoint Público (sem autenticação)

```
GATES ADICIONAIS:
□ Rate limiting por IP implementado
□ Honeypot ou outro anti-bot implementado
□ Input sanitizado com sanitizeText()
□ Email/WhatsApp validados com isValidEmail/isValidWhatsapp
□ Sem dados sensíveis na resposta de erro
□ Documentado no Business Bible se implementa regra de negócio nova
```

---

## 7. O Que o Quality Gate NÃO é

Para evitar mal-entendidos sobre o âmbito do gate:

- **Não é uma lista de verificação de perfeccionismo** — código funcional com comentários incompletos pode passar o gate
- **Não bloqueia experimentação** — branches de experimentação não precisam de passar o gate; só o ramo principal precisa
- **Não requer 100% de cobertura** — os thresholds são mínimos, não máximos de obsessão
- **Não substitui julgamento de engenharia** — o gate é o mínimo necessário; decisões de arquitectura ainda requerem raciocínio crítico

---

## 8. Histórico de Versões do Quality Gate

| Versão | Data | Alteração |
|---|---|---|
| 1.0 | Julho 2026 | Versão inicial — Fase P0 |
| — | Set 2026 (previsto) | Adicionar Gate para módulo CRM após Vol 01 |
| — | Jan 2027 (previsto) | Adicionar Gate para multi-tenant após Fase 2 |

---

## 9. Responsabilidades

| Papel | Responsabilidade no Gate |
|---|---|
| **Desenvolvedor / Claude** | Executar Gates 1 e 2; preencher checklist do PR |
| **Arquiteto-Chefe** | Aprovar PRs de alta complexidade; manter este documento actualizado |
| **Product Owner (Ernesto)** | Aprovar migrations de DB; aprovar Gate 3 para deploys críticos; definir o que é "urgente o suficiente" para renegociar prazos |

---

*VD Platform — Quality Gate v1.0 — Julho 2026*  
*Próxima revisão: Setembro 2026 (fim da Fase P0)*
