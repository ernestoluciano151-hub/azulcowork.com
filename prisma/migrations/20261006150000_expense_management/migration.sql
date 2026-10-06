-- Gestão de despesas: campos aditivos (sem alterar colunas existentes)
ALTER TABLE "Expense" ADD COLUMN IF NOT EXISTS "paidDate" TIMESTAMP(3);
ALTER TABLE "Expense" ADD COLUMN IF NOT EXISTS "paymentMethod" TEXT;
ALTER TABLE "Expense" ADD COLUMN IF NOT EXISTS "reference" TEXT;
ALTER TABLE "Expense" ADD COLUMN IF NOT EXISTS "createdBy" TEXT;
ALTER TABLE "Expense" ADD COLUMN IF NOT EXISTS "paidBy" TEXT;
ALTER TABLE "Expense" ADD COLUMN IF NOT EXISTS "cancelledAt" TIMESTAMP(3);
-- Despesas já pagas: a data de pagamento = data da despesa (comportamento anterior)
UPDATE "Expense" SET "paidDate" = "expenseDate" WHERE "status" = 'PAGO' AND "paidDate" IS NULL;
CREATE INDEX IF NOT EXISTS "Expense_status_paidDate_idx" ON "Expense"("status", "paidDate");
