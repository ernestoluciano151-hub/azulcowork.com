# ERP — Plano de Contas (Chart of Accounts)

> **Volume:** 02 — ERP  
> **Documento:** chart-of-accounts.md  
> **Estado:** 📝 Especificação — Sprint ERP-0  
> **Referência:** PGC Angola (Plano Geral de Contabilidade) adaptado  
> **Moeda:** AOA (Kz)

---

## 1. Estrutura do Plano

O plano de contas segue a estrutura do **PGC Angola** (Decreto Executivo n.º 82/01), adaptado às especificidades de um espaço de coworking. Cada conta tem um código numérico de 4 dígitos, sendo os primeiros 2 o grupo da classe.

```
Classe 1 — Disponibilidades e Investimentos Financeiros
Classe 2 — Terceiros (Clientes e Fornecedores)
Classe 3 — Existências (Stocks)
Classe 4 — Imobilizado
Classe 5 — Capital e Reservas
Classe 6 — Custos e Perdas
Classe 7 — Proveitos e Ganhos
Classe 8 — Resultados
Classe 9 — Contabilidade Analítica (Centros de Custo)
```

---

## 2. Contas Activas do Azul Coworking

### Classe 1 — Disponibilidades

| Código | Designação | Tipo |
|---|---|---|
| **1101** | Caixa — Sede Luanda | Activo |
| **1201** | BCS — Conta Corrente Principal | Activo |
| **1202** | BCS — Conta Poupança / Reserva | Activo |
| **1301** | Depósitos a Prazo | Activo |
| **1401** | Cauções Recebidas (clientes) | Passivo |
| **1402** | Cauções Pagas (imóvel) | Activo |

### Classe 2 — Terceiros

| Código | Designação | Tipo |
|---|---|---|
| **2111** | Clientes — Coworking | Activo (AR) |
| **2112** | Clientes — Salas de Reunião | Activo (AR) |
| **2113** | Clientes — Serviços Adicionais | Activo (AR) |
| **2121** | Clientes de Cobrança Duvidosa | Activo (AR) |
| **2211** | Fornecedores — Imóvel (Renda) | Passivo (AP) |
| **2212** | Fornecedores — Electricidade (ENDE) | Passivo (AP) |
| **2213** | Fornecedores — Água (EPAL) | Passivo (AP) |
| **2214** | Fornecedores — Internet / Telecom | Passivo (AP) |
| **2215** | Fornecedores — Limpeza | Passivo (AP) |
| **2216** | Fornecedores — Segurança | Passivo (AP) |
| **2217** | Fornecedores — Marketing | Passivo (AP) |
| **2218** | Fornecedores — TI (Servidores, Licenças) | Passivo (AP) |
| **2219** | Fornecedores — Outros | Passivo (AP) |
| **2311** | Estado — IVA a Pagar | Passivo |
| **2312** | Estado — IVA Dedutível | Activo |
| **2411** | Pessoal — Vencimentos a Pagar | Passivo |
| **2412** | Pessoal — Retenções na Fonte | Passivo |

### Classe 6 — Custos e Perdas (Despesas)

| Código | Designação | Centro de Custo |
|---|---|---|
| **6111** | Renda do Imóvel | OPERACIONAL |
| **6121** | Electricidade | OPERACIONAL |
| **6122** | Água | OPERACIONAL |
| **6123** | Internet e Telecom | OPERACIONAL |
| **6124** | Limpeza e Higiene | OPERACIONAL |
| **6125** | Segurança | OPERACIONAL |
| **6211** | Vencimentos e Salários | RH |
| **6212** | Encargos Sociais (INSS) | RH |
| **6213** | Subsídios e Benefícios | RH |
| **6311** | Marketing Digital | MARKETING |
| **6312** | Publicidade e Promoção | MARKETING |
| **6313** | Eventos e Networking | MARKETING |
| **6411** | Servidores e Cloud | TI |
| **6412** | Domínios e Certificados | TI |
| **6413** | Licenças de Software | TI |
| **6414** | Desenvolvimento de Software | TI |
| **6511** | Material de Escritório | ADMIN |
| **6512** | Seguros | ADMIN |
| **6513** | Serviços Jurídicos e Contabilidade | ADMIN |
| **6514** | Comunicações Gerais | ADMIN |
| **6611** | Manutenção e Reparações | OPERACIONAL |
| **6612** | Mobiliário e Equipamento | OPERACIONAL |
| **6711** | Perdas por Imparidade (clientes) | FINANCEIRO |
| **6811** | Juros e Encargos Financeiros | FINANCEIRO |

### Classe 7 — Proveitos e Ganhos (Receitas)

| Código | Designação | Tipo de Receita |
|---|---|---|
| **7111** | Mensalidades — Hot Desk | RECORRENTE |
| **7112** | Mensalidades — Dedicated Desk | RECORRENTE |
| **7113** | Mensalidades — Private Office | RECORRENTE |
| **7114** | Mensalidades — Virtual Office | RECORRENTE |
| **7115** | Taxa de Adesão (Onboarding) | ÚNICA |
| **7121** | Salas de Reunião — Hora | VARIÁVEL |
| **7122** | Salas de Reunião — Meio-dia | VARIÁVEL |
| **7123** | Salas de Reunião — Dia completo | VARIÁVEL |
| **7131** | Impressão e Digitalização | ADICIONAL |
| **7132** | Café e Bebidas | ADICIONAL |
| **7133** | Domiciliação Fiscal | ADICIONAL |
| **7134** | Endereço Comercial | ADICIONAL |
| **7141** | Eventos e Workshops | OCASIONAL |
| **7211** | Juros e Rendimentos Financeiros | FINANCEIRO |
| **7311** | Outros Proveitos Não Operacionais | OUTROS |

---

## 3. Mapeamento por Tipo de Documento

| Tipo de Fatura | Conta Débito (AR) | Conta Crédito (Receita) |
|---|---|---|
| FT-CWORK (mensalidade) | 2111 | 711x |
| FT-SALA (reserva) | 2112 | 712x |
| FT-SERV (serviços adicionais) | 2113 | 713x |

| Tipo de Pagamento | Conta Débito | Conta Crédito |
|---|---|---|
| Recepção pagamento cliente | 1201 (banco) | 2111/2112/2113 |
| Pagamento de despesa | 6xxx | 1201 (banco) |
| Caução recebida | 1201 | 1401 |
| Devolução caução | 1401 | 1201 |

---

## 4. Regras de Mapeamento Automático

O sistema deve mapear automaticamente o `accountCode` correcto em `InvoiceItem` e `FinancialLedger` com base em:

```typescript
// Regra de mapeamento:
if (item.source === "CONTRACT" && planType === "HOT_DESK")    → accountCode = "7111"
if (item.source === "CONTRACT" && planType === "DEDICATED")   → accountCode = "7112"
if (item.source === "CONTRACT" && planType === "PRIVATE")     → accountCode = "7113"
if (item.source === "CONTRACT" && planType === "VIRTUAL")     → accountCode = "7114"
if (item.source === "BOOKING")                                → accountCode = "712x" (por duração)
if (item.source === "SERVICE" && type === "PRINT")            → accountCode = "7131"
if (item.source === "SERVICE" && type === "COFFEE")           → accountCode = "7132"
```

---

## 5. Centros de Custo por Conta

```
OPERACIONAL  → 6111, 6121, 6122, 6123, 6124, 6125, 6611, 6612
RH           → 6211, 6212, 6213
MARKETING    → 6311, 6312, 6313
TI           → 6411, 6412, 6413, 6414
ADMIN        → 6511, 6512, 6513, 6514
FINANCEIRO   → 6711, 6811, 7211
```

---

## 6. IVA Angola

**Taxa:** 14% sobre o valor base (Lei n.º 17/19)

```
Valor base (s/IVA):  Kz 100.000
IVA 14%:             Kz  14.000
Total c/IVA:         Kz 114.000
```

**Contas IVA:**
- `2311` — IVA a Pagar ao Estado (IVA nas vendas)
- `2312` — IVA Dedutível (IVA nas compras com NIF válido)
- **IVA a entregar ao Estado** = 2311 − 2312

**Isenções aplicáveis ao coworking (verificar com contabilista):**
- Serviços educativos / formação profissional — isentos (art. 12.º, alínea f)
- Exportação de serviços — taxa zero

---

*VD Platform — ERP — Plano de Contas — Sprint ERP-0*
