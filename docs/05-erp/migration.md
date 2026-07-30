# ERP — Plano de Migração

> **Volume:** 02 — ERP  
> **Estado:** 📝 Especificação — Sprint ERP-0

---

## 1. Estado Actual

O sistema actual tem entidades financeiras parcialmente implementadas:

| Entidade existente | Estado | Acção no ERP |
|---|---|---|
| `Invoice` (modelo simplificado) | ✅ Existe | Expandir com campos ERP |
| `Payment` (modelo simplificado) | ✅ Existe | Expandir com campos ERP |
| `RoomBooking` | ✅ Existe | Integrar → gerar Invoice automática |
| `DocumentCounter` | ✅ Existe | Reutilizar para FT-CWORK, FT-SALA, REC |
| `Company` | ✅ Existe | Adicionar relações Contract, Ledger |
| `Contract` | ❌ Não existe | Criar de raiz |
| `RentSchedule` | ❌ Não existe | Criar de raiz |
| `FinancialLedger` | ❌ Não existe | Criar de raiz |
| `Expense` / `ExpenseCategory` | ❌ Não existe | Criar de raiz |
| `CostCenter` | ❌ Não existe | Criar de raiz |
| `CashMovement` | ❌ Não existe | Criar de raiz |
| `FinancialAlert` | ❌ Não existe | Criar de raiz |
| `FinancialReportSnapshot` | ❌ Não existe | Criar de raiz |

---

## 2. Estratégia de Migração

### Fase 1 — Schema (Sprint ERP-1)

```sql
-- Novas tabelas (sem impacto em dados existentes):
CREATE TABLE "Contract" ...
CREATE TABLE "RentSchedule" ...
CREATE TABLE "FinancialLedger" ...
CREATE TABLE "ExpenseCategory" ...
CREATE TABLE "Expense" ...
CREATE TABLE "CostCenter" ...
CREATE TABLE "CashMovement" ...
CREATE TABLE "FinancialAlert" ...
CREATE TABLE "FinancialReportSnapshot" ...

-- Expandir tabelas existentes:
ALTER TABLE "Invoice" ADD COLUMN "contractId" TEXT;
ALTER TABLE "Invoice" ADD COLUMN "type" TEXT NOT NULL DEFAULT 'COWORKING';
ALTER TABLE "Invoice" ADD COLUMN "subtotal" FLOAT NOT NULL DEFAULT 0;
ALTER TABLE "Invoice" ADD COLUMN "taxRate" FLOAT NOT NULL DEFAULT 0.14;
ALTER TABLE "Invoice" ADD COLUMN "taxAmount" FLOAT NOT NULL DEFAULT 0;
ALTER TABLE "Invoice" ADD COLUMN "pdfUrl" TEXT;
ALTER TABLE "Invoice" ADD COLUMN "voidedAt" TIMESTAMP;
ALTER TABLE "Invoice" ADD COLUMN "voidedBy" TEXT;

ALTER TABLE "Payment" ADD COLUMN "method" TEXT NOT NULL DEFAULT 'BANK_TRANSFER';
ALTER TABLE "Payment" ADD COLUMN "reference" TEXT;
ALTER TABLE "Payment" ADD COLUMN "confirmedAt" TIMESTAMP;
ALTER TABLE "Payment" ADD COLUMN "confirmedBy" TEXT;
ALTER TABLE "Payment" ADD COLUMN "receiptUrl" TEXT;
ALTER TABLE "Payment" ADD COLUMN "receiptNumber" TEXT;

-- Adicionar relações a Company:
ALTER TABLE "Company" ADD COLUMN "billingEmail" TEXT;
```

**Regra:** Todas as colunas novas têm DEFAULT para não quebrar dados existentes.

---

### Fase 2 — Migração de Dados Históricos (Sprint ERP-1)

```
Script: scripts/migrate-financial-history.ts

1. Para cada Invoice existente:
   - Calcular subtotal = total / 1.14
   - Calcular taxAmount = total - subtotal
   - Definir type = 'COWORKING' (default)
   - Criar InvoiceItem correspondente

2. Para cada Payment existente:
   - Definir method = 'BANK_TRANSFER' (default conservador)
   - Criar CashMovement INFLOW com paidAt existente

3. Para cada Company com contractStatus = 'ACTIVE':
   - Criar Contract { planType=HOT_DESK (default), status=ACTIVE }
   - Criar RentSchedules a partir da data do último pagamento
   (dados a confirmar manualmente pela equipa)
```

**Modo dry-run:** `npm run migrate:financial --dry-run` — mostra o que seria migrado sem persistir.

---

### Fase 3 — Dados de Referência (Sprint ERP-1)

Seed obrigatório antes de operação:

```typescript
// Centros de custo
await prisma.costCenter.createMany({ data: [
  { code: "OPERACIONAL", name: "Operações", budget: 250000 },
  { code: "RH",          name: "Recursos Humanos", budget: 400000 },
  { code: "MARKETING",   name: "Marketing", budget: 80000 },
  { code: "TI",          name: "Tecnologia", budget: 60000 },
  { code: "ADMIN",       name: "Administração", budget: 50000 },
  { code: "FINANCEIRO",  name: "Financeiro" },
  { code: "COWORKING",   name: "Receita Coworking" },
  { code: "SALAS",       name: "Receita Salas" },
  { code: "SERVICOS",    name: "Receita Serviços" },
]});

// Categorias de despesa
await prisma.expenseCategory.createMany({ data: [
  { name: "Renda do Imóvel",     accountCode: "6111" },
  { name: "Electricidade",       accountCode: "6121" },
  { name: "Água",                accountCode: "6122" },
  { name: "Internet / Telecom",  accountCode: "6123" },
  { name: "Limpeza",             accountCode: "6124" },
  { name: "Segurança",           accountCode: "6125" },
  { name: "Salários",            accountCode: "6211" },
  { name: "INSS / Encargos",     accountCode: "6212" },
  { name: "Marketing Digital",   accountCode: "6311" },
  { name: "Servidores / Cloud",  accountCode: "6411" },
  { name: "Domínios",            accountCode: "6412" },
  { name: "Licenças Software",   accountCode: "6413" },
  { name: "Manutenção",          accountCode: "6611" },
  { name: "Outros",              accountCode: "6514" },
]});

// DocumentCounter — novos prefixos
await prisma.documentCounter.createMany({
  skipDuplicates: true,
  data: [
    { prefix: "REC",     year: 2026, counter: 0 },
    { prefix: "NL",      year: 2026, counter: 0 },
  ]
});
```

---

## 3. Rollback

Cada migration Prisma é reversível. Em caso de falha:

```bash
npx prisma migrate resolve --rolled-back [migration_name]
```

As novas colunas em tabelas existentes usam `DEFAULT` → sem risco de perda de dados ao fazer rollback (basta `ALTER TABLE ... DROP COLUMN`).

---

## 4. Validação Pós-Migração

```bash
npm run test:migration    # testa integridade dos dados migrados
npm run seed:erp          # seed de dados de referência
npm run smoke:erp         # smoke tests dos endpoints ERP
```

Critérios de aceitação:
- Zero invoices sem `subtotal` após migração
- Zero payments sem `method` após migração
- Todos os centros de custo presentes
- Todas as categorias de despesa presentes
- DocumentCounters ERP inicializados

---

*VD Platform — ERP — Migração — Sprint ERP-0*
