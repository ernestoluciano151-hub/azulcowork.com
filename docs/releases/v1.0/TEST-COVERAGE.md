# Cobertura de Testes — VD Platform v1.0.0

> **Framework:** Vitest 4.1.10 + @vitest/coverage-v8  
> **Data:** 29 Julho 2026  
> **Total de ficheiros de teste:** 19  
> **Total de testes (it/test):** ~475  
> **Metodologia:** Testes unitários de lógica pura (sem mocks de BD nos ERP services)

---

## Sumário Executivo

| Métrica | Valor |
|---|---|
| Ficheiros de teste | 19 |
| Suites (describe blocks) | ~85 |
| Testes unitários totais | ~475 |
| Módulos cobertos | 15 |
| Cobertura estimada módulos críticos | ≥ 65% |
| Meta v1.1 | ≥ 80% |
| Zero falhas | ✅ (validados via node -e e Vitest) |

---

## Inventário de Ficheiros de Teste

### Infraestrutura e Segurança

| Ficheiro | Módulo coberto | Testes | O que valida |
|---|---|---|---|
| `validators.test.ts` | `src/lib/validators.ts` | ~20 | Validação de email, NIF, datas, strings vazias, comprimento |
| `rateLimit.test.ts` | `src/lib/rateLimit.ts` | ~12 | Limiar de pedidos por IP/rota, reset de janela |
| `event-bus.test.ts` | `src/lib/event-bus.ts` | ~19 | publish/subscribe, múltiplos handlers, erros isolados |
| `auth.test.ts` | `src/lib/auth.ts` | ~12 | requireSession (válido/expirado/ausente), requireRole (ADMIN/FINANCEIRO/VIEWER) |
| `auth-smoke.test.ts` | `src/lib/auth.ts` | 1 | Smoke test de importação do módulo auth |

### Core Financeiro (Legado)

| Ficheiro | Módulo coberto | Testes | O que valida |
|---|---|---|---|
| `finance.test.ts` | `src/lib/finance-service.ts` | ~22 | Cálculos de IVA, totais, descontos, arredondamento AOA |
| `document-numbering.test.ts` | `src/lib/document-numbering.ts` | ~8 | Formato FT-SALA-YYYY-NNNNNN, REC-YYYY-NNNNNN, NL-YYYY-NNNNNN |
| `pricing-service.test.ts` | `src/lib/pricing-service.ts` | ~28 | Preços por hora/período, multiplicadores, preços especiais |

### CRM

| Ficheiro | Módulo coberto | Testes | O que valida |
|---|---|---|---|
| `pipeline-state-machine.test.ts` | Pipeline State Machine | ~50 | Transições válidas (LEAD→PROSPECT→CLIENT), transições inválidas, LOST de qualquer stage |
| `crm-validators.test.ts` | CRM validators | ~45 | Validação de Company, Contact, Deal, Activity, Task, Note, Tag |

### ERP — Volume 02

| Ficheiro | Módulo coberto | Testes | O que valida |
|---|---|---|---|
| `erp-contract-service.test.ts` | `erp-contract-service.ts` | ~12 | Validação de contrato, datas, plano, empresa |
| `erp-billing-service.test.ts` | `erp-billing-service.ts` | 23 | IVA 14% (Lei 17/19), totais, arredondamento, BR-CONT-001 |
| `erp-payment-service.test.ts` | `erp-payment-service.ts` | ~16 | Métodos de pagamento, validação de valores, reembolso |
| `erp-expense-service.test.ts` | `erp-expense-service.ts` | ~34 | Ciclo de vida despesas, CostCenter, categoria, IVA input |
| `erp-cashflow-service.test.ts` | `erp-cashflow-service.ts` | ~23 | Projecções, saldo acumulado, runway, KPIs |
| `erp-alerts-service.test.ts` | `erp-alerts-service.ts` | ~38 | 7 tipos de alerta, severidade, ciclo de vida, thresholds |
| `erp-dashboard-service.test.ts` | `erp-dashboard-service.ts` | 37 | MRR/ARR, churn rate, ticket médio, gross margin, EBIT, partida dupla, CostCenter status |
| `erp-communication-service.test.ts` | `erp-email-service.ts` | 33 | fmtKz, fmtDate, cloudinaryFolder, 4 templates HTML, METHOD_LABELS |
| `erp-reports-service.test.ts` | VAT + Reconciliation + Export | 42 | IVA apuramento, DUE/CREDIT/ZERO, calcBase inverso, MISMATCH threshold, filenames XLSX/CSV |

---

## Detalhe por Área Funcional

### Área: Segurança e Auth
```
✅ JWT válido → sessão extraída correctamente
✅ JWT expirado → 401 Unauthorized
✅ Cookie ausente → 401 Unauthorized
✅ Role ADMIN → acesso permitido a rota ADMIN
✅ Role VIEWER → acesso negado a rota FINANCEIRO
✅ Rate limit: 10 pedidos → OK; 11.º pedido → 429 Too Many Requests
✅ Rate limit: janela reseta após expiração
```

### Área: Validações de Input
```
✅ Email válido: user@domain.com → OK
✅ Email inválido: user@domain → ERRO
✅ NIF Angola: 9 dígitos → OK
✅ NIF incompleto: 8 dígitos → ERRO
✅ String vazia → ERRO
✅ String com apenas espaços → ERRO
✅ Data futura quando obrigatório passado → ERRO
```

### Área: IVA Angola (14%)
```
✅ Base 1.000.000 Kz → IVA 140.000 Kz → Total 1.140.000 Kz
✅ Base 500.000 Kz → IVA 70.000 Kz → Total 570.000 Kz
✅ IVA 140.000 Kz → base inversa = 1.000.000 Kz
✅ vatBalance positivo → status DUE
✅ vatBalance negativo → status CREDIT
✅ vatBalance zero → status ZERO
✅ Arredondamento para inteiro (sem cêntimos em AOA)
```

### Área: Ledger (Partida Dupla)
```
✅ totalDebit === totalCredit em todos os lançamentos
✅ Fatura emitida → CREDIT 7111 (Proveitos)
✅ Pagamento confirmado → DEBIT 1201 + CREDIT 2111
✅ Despesa paga → DEBIT 6xxx + CREDIT 1201
✅ Fatura anulada → lançamento de estorno simétrico
```

### Área: Pipeline CRM
```
✅ LEAD → PROSPECT → QUALIFIED → PROPOSAL → NEGOTIATION → CLIENT (caminho feliz)
✅ Qualquer stage → LOST (permitido)
✅ LOST → qualquer stage (bloqueado)
✅ CLIENT → qualquer stage (bloqueado)
✅ Saltar stage (LEAD → CLIENT) → bloqueado
✅ Retroagir (NEGOTIATION → LEAD) → bloqueado
```

### Área: CostCenter
```
✅ actual/budget >= 1.30 → CRITICAL
✅ actual/budget >= 1.15 e < 1.30 → WARNING
✅ actual/budget < 1.15 → OK
✅ budget null ou 0 → NO_BUDGET
```

### Área: Reconciliação
```
✅ Discrepância 0 → OK
✅ Discrepância = 1.000 Kz → OK (igual ao threshold)
✅ Discrepância = 1.001 Kz → MISMATCH
✅ cmAmount = 0 mas sourceAmount > 0 → MISMATCH
✅ Todos OK → isBalanced = true
✅ Um MISMATCH → isBalanced = false
```

### Área: Export
```
✅ format=xlsx → Content-Type application/vnd.openxmlformats-officedocument.spreadsheetml.sheet
✅ format=csv → Content-Type text/csv; charset=utf-8
✅ filename com período → azul_cowork_pnl_2026-07.xlsx
✅ filename sem período → azul_cowork_aging.csv
✅ 6 tipos × 2 formatos → 12 combinações testadas
```

---

## Módulos SEM Cobertura (a cobrir em v1.1)

| Módulo | Prioridade | Razão |
|---|---|---|
| `erp-pdf-service.tsx` | Alta | Requer Node.js runtime; dificil testar em sandbox |
| `erp-communication-service.ts` (integração) | Alta | Requer mocks Cloudinary + SMTP |
| API Routes (integração) | Média | Requer test DB ou mocks completos |
| Frontend components | Baixa | Fora do scope de testes unitários v1.0 |
| `crm-service.ts` (integração) | Média | Requer mock Prisma completo |
| `erp-reconciliation-service.ts` (integração) | Média | Requer dados reais de CashMovement |

---

## Plano de Expansão de Cobertura (v1.1)

```
Fase 1 (Set 2026): Integration tests para ERP payment flow end-to-end
Fase 2 (Out 2026): API Route tests com Prisma test database
Fase 3 (Nov 2026): E2E tests com Playwright (login → contrato → fatura → pagamento)
Meta: ≥ 80% statement coverage em módulos críticos (billing, payments, ledger)
```

---

## Como Executar os Testes

```bash
# Suite completa
npm test

# Com relatório de cobertura
npm run test:coverage

# Ficheiro específico
npx vitest run src/__tests__/unit/erp-billing-service.test.ts

# Watch mode (desenvolvimento)
npx vitest watch

# Validação de lógica pura sem Vitest (sandbox)
node -e "/* inline test logic */"
```

---

## Quality Gate — Critérios de Aprovação

```
GATE 1 (pre-commit):
  □ npx tsc --noEmit → zero erros TypeScript
  □ npx eslint src/ → zero warnings críticos
  □ Testes afectados → zero falhas

GATE 2 (pre-merge):
  □ npm run build → build sem erros
  □ npm test → zero falhas em todos os 475 testes
  □ npm run test:coverage → ≥ 60% nos módulos críticos
  □ Checklist de PR preenchido
```

---

*VD Platform — Test Coverage v1.0.0 — 29 Julho 2026*
