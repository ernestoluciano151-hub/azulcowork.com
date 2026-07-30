# ERP — Centros de Custo

> **Volume:** 02 — ERP  
> **Documento:** cost-centers.md  
> **Estado:** ✅ Implementado — Sprint ERP-4 (29 Jul 2026)

---

## 1. Visão

Os centros de custo são **dimensões analíticas** que permitem agrupar receitas e despesas por área operacional, facilitando a análise de rentabilidade por segmento.

**Decisão arquitectural (ADR-024):** A estrutura é **plana** (não hierárquica) no MVP. Hierarquias analíticas complexas são adiadas para uma fase futura.

---

## 2. Centros de Custo Definidos

| Código | Nome | Tipo | Descrição |
|---|---|---|---|
| `OPERACIONAL` | Operações | CUSTO | Renda, utilidades, limpeza, segurança, manutenção |
| `RH` | Recursos Humanos | CUSTO | Salários, encargos, benefícios |
| `MARKETING` | Marketing | CUSTO | Digital, publicidade, eventos |
| `TI` | Tecnologia | CUSTO | Servidores, domínios, licenças, desenvolvimento |
| `ADMIN` | Administração | CUSTO | Escritório, seguros, jurídico, comunicação |
| `FINANCEIRO` | Financeiro | MISTO | Juros, perdas, rendimentos financeiros |
| `COWORKING` | Coworking | RECEITA | Mensalidades de coworking |
| `SALAS` | Salas de Reunião | RECEITA | Receitas de reservas de salas |
| `SERVICOS` | Serviços Adicionais | RECEITA | Impressão, café, domiciliação, etc. |

---

## 3. Orçamento Mensal (MVP)

Cada centro de custo pode ter um `budget` mensal em AOA. O dashboard compara o real vs. orçado:

| Centro | Orçamento Mensal Estimado |
|---|---|
| OPERACIONAL | Kz 250.000 |
| RH | Kz 400.000 |
| MARKETING | Kz 80.000 |
| TI | Kz 60.000 |
| ADMIN | Kz 50.000 |
| FINANCEIRO | — |

**Nota:** Valores a confirmar pelo Product Owner com base na realidade operacional do Azul Coworking.

---

## 4. Análise de Rentabilidade

```
Receita total (COWORKING + SALAS + SERVICOS)
  − Custos directos (OPERACIONAL + RH)
  = Margem operacional bruta

  − Custos indirectos (MARKETING + TI + ADMIN)
  = Lucro operacional (EBIT)

  +/− Resultado financeiro (FINANCEIRO)
  = Lucro antes de impostos
```

---

## 5. Regras de Atribuição

### BR-CC-001 — Atribuição Obrigatória para Despesas
Toda `Expense` deve ter um `costCenterId`. O sistema sugere automaticamente com base na `ExpenseCategory.accountCode`.

### BR-CC-002 — Atribuição de Receitas
`InvoiceItem` herda o centro de custo do tipo de serviço:
- `accountCode` 711x → `COWORKING`
- `accountCode` 712x → `SALAS`
- `accountCode` 713x → `SERVICOS`

### BR-CC-003 — Ledger com CostCenter
Todo `FinancialLedger` de despesa deve referenciar o `costCenterId` correspondente.

---

## 6. Relatório por Centro de Custo

Disponível no dashboard financeiro para o período seleccionado:

```
Centro de Custo: OPERACIONAL
Período: Agosto 2026

Despesas:
  Renda imóvel         Kz 250.000   [6111]
  Electricidade        Kz  45.000   [6121]
  Água                 Kz  12.000   [6122]
  Internet             Kz  18.000   [6123]
  Limpeza              Kz  35.000   [6124]
  Segurança            Kz  40.000   [6125]
  ─────────────────────────────────────
  Total despesas       Kz 400.000

Orçado:                Kz 250.000
Variação:             +Kz 150.000  (+60%) ⚠ BUDGET_EXCEEDED
```

---

*VD Platform — ERP — Centros de Custo — Sprint ERP-0*
