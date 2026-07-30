# ERP — Despesas (Accounts Payable)

> **Volume:** 02 — ERP  
> **Documento:** expenses.md  
> **Estado:** ✅ Implementado — Sprint ERP-4 (29 Jul 2026)

---

## 1. Categorias de Despesa

| Categoria | Código | Conta PGC | Recorrência típica |
|---|---|---|---|
| Renda do Imóvel | `RENT` | 6111 | Mensal |
| Electricidade (ENDE) | `ELECTRICITY` | 6121 | Mensal |
| Água (EPAL) | `WATER` | 6122 | Mensal |
| Internet / Telecom | `INTERNET` | 6123 | Mensal |
| Limpeza e Higiene | `CLEANING` | 6124 | Mensal |
| Segurança | `SECURITY` | 6125 | Mensal |
| Salários | `SALARIES` | 6211 | Mensal |
| Encargos Sociais (INSS) | `SOCIAL_CHARGES` | 6212 | Mensal |
| Subsídios / Benefícios | `BENEFITS` | 6213 | Mensal |
| Marketing Digital | `DIGITAL_MARKETING` | 6311 | Variável |
| Publicidade | `ADVERTISING` | 6312 | Variável |
| Eventos | `EVENTS` | 6313 | Ocasional |
| Servidores / Cloud | `SERVERS` | 6411 | Mensal |
| Domínios e Certificados | `DOMAINS` | 6412 | Anual |
| Licenças de Software | `SOFTWARE` | 6413 | Mensal/Anual |
| Desenvolvimento | `DEVELOPMENT` | 6414 | Variável |
| Material de Escritório | `OFFICE_SUPPLIES` | 6511 | Variável |
| Seguros | `INSURANCE` | 6512 | Anual |
| Serviços Jurídicos | `LEGAL` | 6513 | Variável |
| Manutenção | `MAINTENANCE` | 6611 | Variável |
| Outros | `OTHER` | 6514 | Variável |

---

## 2. Ciclo de Vida da Despesa

```
PENDING → APPROVED → PAID → (Ledger actualizado)
        → REJECTED
PENDING → CANCELLED (antes de aprovação)
```

**Regra de aprovação (BR-FIN-008):**
- Despesas ≤ Kz 50.000: aprovação automática (criadas directamente como `APPROVED`)
- Despesas > Kz 50.000: requerem aprovação explícita de `ADMIN`
- Despesas recorrentes já aprovadas: não necessitam re-aprovação mensal

---

## 3. Despesas Recorrentes

O sistema suporta registo de despesas recorrentes com geração automática mensal:

```json
{
  "categoryId": "RENT",
  "supplierName": "Proprietário Edifício 18",
  "description": "Renda mensal — Edifício 18, Bairro Azul",
  "amount": 450000,
  "recurrence": "MONTHLY",
  "dueDate": "2026-08-05"
}
```

**Cron mensal** (dia 1 de cada mês): gera automaticamente instâncias das despesas recorrentes aprovadas para o mês corrente, com `dueDate` calculada conforme o padrão da despesa original.

---

## 4. Despesas Estimadas (Orçamento)

Para o cálculo do fluxo de caixa projectado, o sistema mantém um orçamento mensal de despesas por centro de custo. As despesas reais são comparadas com o orçamento:

```
Variação (%) = (Real - Orçado) / Orçado × 100

> +15%  → FinancialAlert BUDGET_EXCEEDED (WARNING)
> +30%  → FinancialAlert BUDGET_EXCEEDED (CRITICAL)
```

---

## 5. Processo de Registo

```
ADMIN/FINANCEIRO:
1. POST /api/erp/expenses { categoryId, amount, dueDate, ... }
2. Se amount > 50.000 → status=PENDING (aguarda aprovação)
   Se amount ≤ 50.000 → status=APPROVED (auto-aprovado)
3. ADMIN aprova (se necessário): PATCH /api/erp/expenses/:id/approve
4. Registo do pagamento: PATCH /api/erp/expenses/:id/pay { paidAt, reference, receiptUrl }
5. Sistema (em $transaction):
   a. Expense.status = PAID
   b. Criar FinancialLedger: DEBIT 6xxx, CREDIT 1201
   c. Criar CashMovement: OUTFLOW
   d. Publicar erp.expense.paid
   e. Criar TimelineEntry (se associada a Company)
```

---

## 6. Despesas por Fornecedor

O sistema não mantém uma entidade `Supplier` no MVP — o nome do fornecedor é armazenado como string em `Expense.supplierName`. Análise por fornecedor é feita via query.

**Campos de fornecedor:**
- `supplierName` — nome da entidade
- `supplierNif` — NIF para efeitos de IVA dedutível

---

## 7. IVA Dedutível em Despesas

Despesas pagas a fornecedores com NIF válido podem ter IVA dedutível:

```
Conta débito:   6xxx (custo s/IVA)
Conta débito:   2312 (IVA dedutível)
Conta crédito:  1201 (banco — total pago)
```

O campo `Expense.supplierNif` activa o registo do IVA dedutível no Ledger.

---

*VD Platform — ERP — Despesas — Sprint ERP-0*
