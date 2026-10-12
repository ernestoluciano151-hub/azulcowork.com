-- Ponte Despesa (CRM) → ErpExpense (livro de contas). Aditiva.
ALTER TABLE "Expense" ADD COLUMN IF NOT EXISTS "erpExpenseId" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "Expense_erpExpenseId_key" ON "Expense"("erpExpenseId");
