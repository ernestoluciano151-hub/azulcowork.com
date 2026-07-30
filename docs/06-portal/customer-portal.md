# Portal do Cliente — Especificação Funcional

> **Volume:** 03 — Portal do Cliente  
> **Estado:** 📋 Especificação — aguarda aprovação PO  
> **URL base:** `/portal/*`  
> **Auth:** PortalSession (JWT separado do admin)

---

## 1. Autenticação do Portal

### 1.1 Fluxo de Login (Magic Link — opção recomendada)

```
1. Cliente acede a /portal/login
2. Introduz o email → clica "Enviar link de acesso"
3. Sistema verifica se PortalUser existe e está activo
4. Sistema gera PortalMagicLink (token 32 bytes, TTL 15 min)
5. Envia email via Resend com link: /portal/auth/magic?token=[TOKEN]
6. Cliente clica no link
7. Sistema valida token (não expirado, não usado)
8. Marca token como usado (isUsed = true)
9. Cria PortalSession → emite cookie portal-session (JWT 8h)
10. Redireciona para /portal/dashboard
```

**Segurança:**
- Token de uso único (segundo clique retorna erro amigável)
- Expiração: 15 minutos
- Rate limit: máximo 3 magic links por email por hora

### 1.2 Fluxo com Credenciais (alternativa)

```
1. Admin cria PortalUser com password temporária
2. Cliente recebe email com credenciais temporárias
3. No primeiro login → obrigado a alterar password
4. Password: mínimo 8 caracteres, 1 maiúscula, 1 número
5. Hash bcrypt com salt 12
```

### 1.3 Logout

- POST `/api/portal/auth/logout` → revoga PortalSession (isRevoked = true)
- Remove cookie portal-session
- Redireciona para /portal/login

---

## 2. Dashboard (`/portal/dashboard`)

Vista de resumo que o cliente vê ao fazer login.

### 2.1 Widgets do Dashboard

**Contrato Activo**
```
Plano: [nome do plano — ex: "Hot Desk Mensal"]
Posto: [número/identificação do posto]
Valor mensal: Kz XXX.XXX
Data de início: DD/MM/AAAA
Data de fim: DD/MM/AAAA (ou "Indeterminado")
Estado: ACTIVE | SUSPENDED
Dias até expiração: [N dias] (alerta visual se < 30 dias)
```

**Saldo Pendente**
```
Total em faturas por pagar: Kz XXX.XXX
Fatura mais antiga em aberto: FT-CWORK-YYYY-NNNNNN (N dias)
CTA: "Ver faturas" → /portal/faturas
```

**Próxima Renda**
```
Valor: Kz XXX.XXX
Data de vencimento: DD/MM/AAAA
Estado: PENDING / INVOICED / PAID
CTA: "Pagar" (se INVOICED com fatura aberta)
```

**Notificações Recentes** (últimas 5)
```
[ícone] [título] — [data relativa]
Ex: 🔔 Nova fatura disponível — há 2 horas
    ✅ Pagamento confirmado — ontem
    📄 Documento disponível — há 3 dias
```

**Actividade Recente** (últimas 5 acções)
```
[data] [descrição]
Ex: 29 Jul 2026 — Fatura FT-CWORK-2026-000042 emitida
    28 Jul 2026 — Pagamento de Kz 450.000 confirmado
    27 Jul 2026 — Reserva da Sala Azul confirmada (30 Jul, 14h–17h)
```

### 2.2 Alertas no Dashboard

Mostrar banner de alerta quando:
- Contrato expira em ≤ 30 dias → ⚠️ amarelo
- Contrato expira em ≤ 7 dias → 🔴 vermelho urgente
- Pagamento em atraso → 🔴 vermelho
- Saldo em aberto > Kz 1.000.000 → ⚠️ amarelo

---

## 3. Perfil da Empresa (`/portal/perfil`)

### 3.1 Dados Visíveis

```
Nome da empresa
NIF
Email principal
Telefone
Morada
Sector de actividade
Contacto principal (nome + cargo)
```

### 3.2 Edição (PORTAL_OWNER e PORTAL_ADMIN)

O cliente pode actualizar:
- Telefone de contacto
- Email de facturação (separado do email de login)
- Contacto principal

**Não editável pelo cliente:**
- Nome da empresa (requer pedido de alteração ao admin)
- NIF (requer pedido de alteração ao admin)
- Estado do contrato

---

## 4. Gestão de Utilizadores (`/portal/utilizadores`)

Disponível apenas para PORTAL_OWNER e PORTAL_ADMIN.

### 4.1 Lista de Utilizadores

```
[Nome] | [Email] | [Role] | [Estado] | [Último login]
João Silva | joao@empresa.co.ao | PORTAL_ADMIN | Activo | há 2 dias
Maria Santos | maria@empresa.co.ao | PORTAL_MEMBER | Activo | hoje
Carlos Lima | carlos@ext.co.ao | PORTAL_VIEWER | Pendente | nunca
```

### 4.2 Adicionar Utilizador

```
Campos: Nome* | Email* | Role* | Telefone (para WhatsApp)
Acção: Envia email de convite com magic link
Estado inicial: isConfirmed = false, isActive = true
```

### 4.3 Desactivar / Reactivar

- PORTAL_OWNER pode desactivar qualquer utilizador da empresa
- PORTAL_ADMIN pode desactivar PORTAL_MEMBER e PORTAL_VIEWER
- Desactivação revoga sessões activas imediatamente

---

## 5. Contratos (`/portal/contratos`)

### 5.1 Lista de Contratos

```
[Número] | [Plano] | [Início] | [Fim] | [Estado] | [Valor mensal]
CONT-2026-000001 | Hot Desk Mensal | 01/01/2026 | — | ACTIVE | Kz 150.000
CONT-2025-000003 | Sala Privada | 01/06/2025 | 31/12/2025 | TERMINATED | Kz 350.000
```

### 5.2 Detalhe do Contrato

```
Informação geral:
  Número, plano, posto, início, fim, valor, estado

Cláusulas principais (texto configurável pelo admin):
  [Ex: Aviso prévio de 30 dias para rescisão]

Parcelas (RentSchedules):
  Mês | Valor | Estado | Fatura | Pago em
  Jul 2026 | Kz 150.000 | INVOICED | FT-CWORK-2026-000042 | —
  Jun 2026 | Kz 150.000 | PAID | FT-CWORK-2026-000031 | 05/06/2026
  Mai 2026 | Kz 150.000 | PAID | FT-CWORK-2026-000019 | 08/05/2026

Documentos associados:
  Contrato assinado (PDF) — 01/01/2026
```

---

## 6. Faturas (`/portal/faturas`)

### 6.1 Lista de Faturas

```
Filtros: estado (ISSUED | SENT | PAID | OVERDUE | VOID), período

[Número] | [Data emissão] | [Vencimento] | [Valor] | [Estado] | [Acções]
FT-CWORK-2026-000042 | 01/07/2026 | 10/07/2026 | Kz 171.000 | OVERDUE | [Download] [Ver]
FT-CWORK-2026-000031 | 01/06/2026 | 10/06/2026 | Kz 171.000 | PAID    | [Download]
```

### 6.2 Detalhe da Fatura

```
Cabeçalho:
  AZUL COWORKING — NIF 5002174308
  FT-CWORK-2026-NNNNNN
  Emitida: DD/MM/AAAA | Vencimento: DD/MM/AAAA

Cliente:
  [Nome da empresa] — NIF XXXXXXXXX
  [Email de facturação]

Items:
  Descrição | Qtd | Preço unit. | Total
  Hot Desk Mensal — Julho 2026 | 1 | Kz 150.000 | Kz 150.000

  Subtotal: Kz 150.000
  IVA 14%:  Kz  21.000
  TOTAL:    Kz 171.000

Dados bancários:
  Banco: BCS
  IBAN: AO06007000000212870210113
  SWIFT: CDTSAOLU
  Referência: [número da fatura]

Botão: [Download PDF] → URL assinada 15 min
```

### 6.3 Download de PDF (BR-PORT-002)

```
1. Cliente clica em "Download PDF"
2. Sistema verifica que a fatura pertence à empresa do cliente (isolamento)
3. Gera URL assinada do Cloudinary com TTL 15 minutos
4. Cria PortalDocumentAccess (tipo: SIGNED_URL_GENERATED) — auditoria
5. Cria TimelineEntry na empresa
6. Devolve URL assinada → browser inicia download
7. URL expira ao fim de 15 minutos
```

---

## 7. Pagamentos (`/portal/pagamentos`)

### 7.1 Lista de Pagamentos

```
[Data] | [Método] | [Valor] | [Referência] | [Fatura] | [Recibo]
05/07/2026 | Transferência | Kz 171.000 | REF-2026-007 | FT-CWORK-...031 | [Download]
08/06/2026 | Multicaixa | Kz 171.000 | REF-2026-006 | FT-CWORK-...019 | [Download]
```

### 7.2 Recibo de Pagamento

- Download de PDF via URL assinada (mesmo mecanismo das faturas)
- Auditoria de download registada

### 7.3 Nota Importante

O portal **não processa pagamentos directamente** na v1 (sem payment gateway integrado).
Os pagamentos continuam a ser confirmados pelo staff após transferência bancária / Multicaixa.
O portal mostra o estado actualizado pelo sistema interno.

*Placeholder para v2: integração com gateway de pagamento (Multicaixa Express API, etc.)*

---

## 8. Reservas de Sala (`/portal/reservas`)

### 8.1 Lista de Reservas

```
Filtros: estado (CONFIRMED | PENDING | CANCELLED), período

[Data] | [Sala] | [Horário] | [Estado] | [Valor] | [Acções]
30/07/2026 | Sala Azul | 14h–17h | CONFIRMED | Kz 45.000 | [Cancelar]
02/08/2026 | Sala Verde | 09h–12h | PENDING | Kz 30.000 | [Cancelar]
```

### 8.2 Criar Reserva

```
Campos:
  Sala*: [dropdown com salas disponíveis]
  Data*: [date picker]
  Hora início*: [time picker]
  Hora fim*: [time picker]
  Participantes: [número]
  Notas: [texto livre]

Ao submeter:
  1. Verificar disponibilidade (conflict check — mesmo algoritmo do sistema legado)
  2. Calcular preço (pricing-service.ts)
  3. Criar Reservation com estado PENDING
  4. Notificar staff para confirmação
  5. Enviar confirmação ao cliente (email + in-app)
```

### 8.3 Cancelar Reserva

- Apenas disponível para reservas PENDING ou CONFIRMED com ≥ 24h de antecedência
- Reservas com < 24h não podem ser canceladas pelo portal (requer contacto com staff)
- Cancelamento gera notificação para o staff

---

## 9. Isolamento de Dados — Verificação em Cada Módulo

Em todos os módulos, a query principal DEVE incluir `companyId`:

```typescript
// ✅ Correcto
const invoices = await prisma.erpInvoice.findMany({
  where: { companyId: portalUser.companyId },
});

// ❌ NUNCA FAZER — vulnerabilidade de acesso cruzado
const invoice = await prisma.erpInvoice.findUnique({
  where: { id: params.id },
  // sem companyId → qualquer utilizador portal acede a qualquer fatura
});

// ✅ Forma segura de buscar por ID
const invoice = await prisma.erpInvoice.findFirst({
  where: {
    id: params.id,
    companyId: portalUser.companyId, // isolamento obrigatório
  },
});
```

---

*VD Platform — Customer Portal Spec — Volume 03 — 29 Julho 2026*
