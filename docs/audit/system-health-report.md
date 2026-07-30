# System Health Report — VD Platform

> **Documento:** AUDIT-002  
> **Fase:** 0.5 — Auditoria Técnica Completa  
> **Estado:** ✅ Concluído  
> **Data:** Julho 2026  
> **Referência:** AUDIT-001 (Technical Audit Report)  

---

## 1. Dashboard de Saúde Global

```
┌─────────────────────────────────────────────────────────────────────┐
│                    VD PLATFORM — SYSTEM HEALTH                      │
│                         Julho 2026                                  │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│   SCORE GLOBAL                         58 / 100   ⚠️  MODERADO     │
│                                                                     │
│   Funcionalidade    ██████████████████░░  88%   ✅ BOM             │
│   Segurança         ████████░░░░░░░░░░░░  42%   🔴 CRÍTICO         │
│   Qualidade Código  ████████████░░░░░░░░  58%   ⚠️  MODERADO      │
│   Performance       ██████████████░░░░░░  68%   ⚠️  MODERADO      │
│   Arquitectura      ████████████░░░░░░░░  61%   ⚠️  MODERADO      │
│   Cobertura Testes  ░░░░░░░░░░░░░░░░░░░░   0%   🔴 CRÍTICO         │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

**Interpretação:** O sistema é **funcionalmente capaz** para o uso actual (Azul Coworking), mas tem vulnerabilidades de segurança críticas e zero testes automatizados. Não é seguro adicionar novas funcionalidades sem antes resolver os itens críticos.

---

## 2. Saúde por Módulo

### 2.1 CRM (Leads e Empresas)

| Dimensão | Score | Notas |
|---|---|---|
| Funcionalidade | 85% | Pipeline de leads funcional; conversão para empresa implementada |
| Segurança | 50% | Auth OK; sem RBAC por role (COMERCIAL vs ADMIN) |
| Qualidade | 60% | `where: any` em leads/route.ts; sem Zod |
| Testes | 0% | Sem testes |
| **Score módulo** | **49%** | ⚠️ ATENÇÃO |

**Pontos fortes:**
- Pipeline completo: NOVO → EM_CONTACTO → AGENDADO → CONVERTIDO/PERDIDO
- Paginação implementada no endpoint de listagem
- Sanitização de input com `sanitizeText()`
- Rate limiting + honeypot no formulário público
- Exportação XLSX funcional

**Pontos fracos:**
- BR-004 (prevenção de duplicados por email) não implementado — mesmo email pode criar múltiplos leads
- Conversão Lead → Company sem validação de duplicado de empresa (mesmo NIF)
- `where: any` na query de leads perde type safety

---

### 2.2 Cowork (Empresas e Colaboradores)

| Dimensão | Score | Notas |
|---|---|---|
| Funcionalidade | 80% | CRUD completo; alertas de expiração ausentes |
| Segurança | 45% | DELETE de empresa sem verificação de role |
| Qualidade | 65% | `data: any` no PATCH; sem validação de NIF |
| Testes | 0% | Sem testes |
| **Score módulo** | **48%** | ⚠️ ATENÇÃO |

**Pontos fortes:**
- Gestão de empresas com contrato, plano, sala e colaboradores
- Timeline por empresa (registo histórico de eventos)
- Event Bus integrado (company.created, employee.created)

**Pontos fracos:**
- `DELETE /api/companies/[id]` sem verificação de role — qualquer utilizador autenticado pode eliminar
- BR-011 (alertas automáticos 60/30/15/7 dias antes de expiração) não implementado
- `contractStatus` actualizado manualmente, sem job automático
- `paymentFrequency` existe no schema mas sem lógica de geração automática de faturas mensais

---

### 2.3 Reservas (Sala de Reunião)

| Dimensão | Score | Notas |
|---|---|---|
| Funcionalidade | 78% | Fluxo principal funcional; conflito tem bug |
| Segurança | 50% | Auth OK; sem RBAC detalhado |
| Qualidade | 55% | Lógica financeira duplicada na route |
| Integridade | 40% | TOCTOU no conflict check; numeração com race condition |
| Testes | 0% | Sem testes |
| **Score módulo** | **45%** | 🔴 ATENÇÃO |

**Pontos fortes:**
- Múltiplas opções de pagamento (PAGAR_AGORA, PAGAR_NO_DIA, FACTURAR, ISENTO)
- Numeração RES-YYYY-NNNNNN implementada
- Integração com Event Bus
- Notificações WhatsApp e email automáticas
- Suporte a preço personalizado com aprovação

**Pontos fracos:**
- Conflict check FORA da transação → race condition (TOCTOU)
- Lógica financeira duplicada (violação DRY crítica)
- `financialNotes` aceite no body mas não existe no schema Prisma
- Preço "PAGAR_NO_DIA" cria Payment PENDENTE sem Invoice — fluxo de cobrança posterior incompleto

---

### 2.4 Financeiro

| Dimensão | Score | Notas |
|---|---|---|
| Funcionalidade | 82% | FinanceService robusto; 10 passos na tx |
| Segurança | 40% | Confirmação de pagamento sem verificação de role FINANCEIRO |
| Qualidade | 72% | FinanceService bem estruturado; finance.ts tem problemas |
| Integridade | 55% | recordFinancialHistory usa prisma global; mistura contextos |
| Testes | 0% | Sem testes para o módulo mais crítico |
| **Score módulo** | **50%** | ⚠️ ATENÇÃO |

**Pontos fortes:**
- `FinanceService.confirmPayment()` — 10 passos atómicos numa transação Prisma
- Auditoria financeira imutável (`FinancialAudit`)
- Suporte a pagamentos parciais
- Invoice com `paidPercentage`, `balance`, `amountPaid` recalculados
- Numeração FT-SALA-YYYY-NNNNNN e NL-YYYY-NNNNNN implementadas
- Nota de Liquidação gerada automaticamente

**Pontos fracos:**
- `recordFinancialHistory()` usa `prisma` global em vez de `tx` — runningBalance pode estar errado
- `getCompanyFinanceSummary()` mistura pagamentos de cowork e sala
- Sem verificação de role em `/api/finance/*` e `/api/invoices/*`
- `PricingService.calcPrice()` — halfDay a 3h (não 4h como pode ser esperado); deveria ser clarificado e documentado como decisão intencional

---

### 2.5 Segurança e Autenticação

| Dimensão | Score | Notas |
|---|---|---|
| Autenticação | 55% | JWT/bcrypt correcto; fallback secret e sem 2FA |
| Autorização (RBAC) | 30% | Só admin/users verifica role |
| Input Validation | 60% | Básica; sem Zod |
| Protecção Infra | 75% | Headers HTTP bons; rate limiting parcial |
| **Score módulo** | **55%** | ⚠️ ATENÇÃO → tendência 🔴 |

**Pontos fortes:**
- Headers HTTP de segurança configurados (HSTS, X-Frame-Options, CSP, Referrer-Policy)
- bcryptjs com factor 12
- Cookies httpOnly para sessão
- Anti-timing-attack no login
- Rate limiting no login e formulário público
- Honeypot + tempo mínimo de preenchimento

**Pontos fracos:**
- JWT fallback secret → comprometimento total se JWT_SECRET não estiver em produção
- TOTP existe no schema mas não está integrado no login
- RBAC só verificado em /api/admin/users
- CSRF não protegido
- `(admin as any).role || "ADMIN"` → fallback para role mais privilegiada

---

### 2.6 Qualidade de Código

| Métrica | Valor | Estado |
|---|---|---|
| TypeScript strict | Não (ignoreBuildErrors) | 🔴 |
| Cobertura de testes | 0% | 🔴 |
| Uso de `any` | 8+ ocorrências | 🟠 |
| Linting activo no build | Não (ignoreDuringBuilds) | 🟠 |
| Complexidade ciclomática | Média (algumas funções > 100 linhas) | 🟡 |
| Documentação JSDoc | Parcial | 🟡 |
| Duplicação de código | Presente (lógica financeira) | 🟠 |
| Dead code | 1 função identificada | 🟢 |

---

### 2.7 Infrastructure e Deployment

| Componente | Estado | Notas |
|---|---|---|
| Next.js 15 | ✅ Actualizado | 15.2.5 |
| Prisma 5.x | ✅ Actualizado | 5.18.0 |
| PostgreSQL (Supabase) | ✅ | Prod OK |
| SQLite em dev | ⚠️ | Difere de prod (DT-006) |
| Vercel deployment | ✅ | Configurado |
| Error monitoring | ❌ | Sem Sentry (DT-009) |
| Rate limiting multi-instância | ❌ | In-memory; não funciona em múltiplas instâncias |
| Event Bus persistente | ❌ | In-memory; sem Redis |
| Backups automáticos | ℹ️ | Responsabilidade do Supabase |

---

## 3. Inventário de Dívidas Técnicas (Estado Actual)

| ID | Dívida | Severidade | Fase Resolução | Estado |
|---|---|---|---|---|
| DT-001 | TypeScript ignoreBuildErrors | 🟠 Alto | Fase 1 | ❌ Pendente |
| DT-002 | Sem testes unitários | 🔴 Crítico | Fase 0 | ❌ Pendente |
| DT-003 | BR-030 conflitos de reserva (TOCTOU) | 🔴 Crítico | Fase 0 | ⚠️ Parcial (com bug) |
| DT-004 | Event Bus sem persistência | 🟡 Médio | Fase 2 | ❌ Pendente |
| DT-005 | Dois geradores de PDF | 🟢 Baixo | Fase 1 | ❌ Pendente |
| DT-006 | SQLite em dev ≠ PostgreSQL em prod | 🟡 Médio | Fase 0 | ❌ Pendente |
| DT-007 | Sem paginação em alguns endpoints | 🟡 Médio | Fase 1 | ⚠️ Parcial |
| DT-008 | Sem Zod para validação | 🟡 Médio | Fase 1 | ❌ Pendente |
| DT-009 | Sem error monitoring (Sentry) | 🟠 Alto | Fase 1 | ❌ Pendente |
| DT-010 | Rate limiting incompleto | 🟠 Alto | Fase 0 | ⚠️ Parcial |
| **DT-011 (novo)** | JWT fallback secret | 🔴 Crítico | Imediato | ❌ Pendente |
| **DT-012 (novo)** | RBAC incompleto nas API Routes | 🔴 Crítico | Fase 0 | ❌ Pendente |
| **DT-013 (novo)** | TOCTOU no conflict check (dentro de tx) | 🔴 Crítico | Fase 0 | ❌ Pendente |
| **DT-014 (novo)** | Numeração de documentos com race condition | 🔴 Crítico | Fase 0 | ❌ Pendente |
| **DT-015 (novo)** | Lógica financeira duplicada | 🟠 Alto | Fase 0 | ❌ Pendente |
| **DT-016 (novo)** | TOTP 2FA sem integração no login | 🔴 Crítico | Fase 0 | ❌ Pendente |
| **DT-017 (novo)** | recordFinancialHistory fora de contexto tx | 🔴 Crítico | Fase 0 | ❌ Pendente |
| **DT-018 (novo)** | AdminUser.role enum inconsistente | 🟠 Alto | Fase 0 | ❌ Pendente |
| **DT-019 (novo)** | Mistura contextos financeiros em summary | 🟠 Alto | Fase 0 | ❌ Pendente |
| **DT-020 (novo)** | WhatsApp/URL hardcoded errado em emails | 🟠 Alto | Imediato | ❌ Pendente |

---

## 4. Análise de Risco

### 4.1 Matriz de Risco

```
IMPACTO
  │
  │ Alto   │ DT-011  │ DT-012  DT-013  │
  │        │ DT-016  │ DT-014  DT-017  │
  │        │         │ DT-002           │
  │ Médio  │ DT-020  │ DT-015  DT-018  │
  │        │         │ DT-019  DT-010  │
  │ Baixo  │         │ DT-006  DT-007  │ DT-004  DT-005
  │        │         │ DT-008           │
  │────────┼─────────┼──────────────────┼──────────────
  │        │ Baixa   │ Média            │ Alta
  │                         PROBABILIDADE
```

### 4.2 Cenários de Risco Operacional

**Cenário 1 — Dupla Reserva (Probabilidade: Alta sob uso simultâneo)**  
Dois utilizadores criam reservas para o mesmo horário simultaneamente. Ambas passam no conflict check (TOCTOU) e ambas ficam confirmadas. O espaço físico fica double-booked. Impacto: perda de reputação, conflito com cliente.

**Cenário 2 — Escalação de Privilégios (Probabilidade: Médio se utilizador malicioso interno)**  
Um utilizador com role VIEWER ou COMERCIAL (quando roles estiverem configuradas) acede directamente a `DELETE /api/companies/[id]` via ferramenta de HTTP. Sem verificação de role na route, a operação é executada.

**Cenário 3 — JWT Secret Ausente em Novo Deploy (Probabilidade: Médio)**  
Um novo ambiente (staging, test) é criado sem definir `JWT_SECRET`. O sistema usa o fallback secret. Se o código-fonte foi exposto (GitHub, ex-colaborador), o secret é conhecido e podem ser forjados tokens de ADMIN.

**Cenário 4 — Duplicação de Número Fiscal (Probabilidade: Baixo no uso actual, Médio sob carga)**  
Duas criações de reservas em simultâneo geram o mesmo `FT-SALA-2026-000042`. O Prisma lança erro de UNIQUE constraint (visível nos logs) ou, se a constraint não existir, dois documentos com o mesmo número são emitidos — ilegal em Angola.

---

## 5. Indicadores de Qualidade por Ficheiro Crítico

| Ficheiro | Complexidade | Issues | Rating |
|---|---|---|---|
| `src/lib/finance-service.ts` | Alta | 1 (DT-017) | ⭐⭐⭐⭐ |
| `src/lib/event-bus.ts` | Média | 0 | ⭐⭐⭐⭐⭐ |
| `src/lib/event-handlers.ts` | Média | 1 (PERF-002) | ⭐⭐⭐⭐ |
| `src/lib/pricing-service.ts` | Média | 1 (threshold 3h não documentado) | ⭐⭐⭐⭐ |
| `src/lib/auth.ts` | Baixa | 1 (fallback secret) | ⭐⭐ |
| `src/lib/finance.ts` | Alta | 3 (DT-017, DT-019, dead code) | ⭐⭐ |
| `src/lib/timeline.ts` | Média | 2 (type permissivo, cast) | ⭐⭐⭐ |
| `src/lib/validators.ts` | Baixa | 1 (email regex simplista) | ⭐⭐⭐⭐ |
| `src/lib/rateLimit.ts` | Baixa | 1 (in-memory, multi-instância) | ⭐⭐⭐ |
| `src/lib/email.ts` | Baixa | 1 (dados hardcoded errados) | ⭐⭐⭐ |
| `src/middleware.ts` | Baixa | 1 (fallback secret) | ⭐⭐ |
| `src/app/api/reservations/route.ts` | Muito Alta | 3 (TOCTOU, DRY, any) | ⭐⭐ |
| `src/app/api/auth/login/route.ts` | Baixa | 2 (role cast, sem 2FA) | ⭐⭐ |
| `src/app/api/admin/users/route.ts` | Baixa | 1 (role enum) | ⭐⭐⭐ |
| `src/lib/invoice-pdf.tsx` | Média | 1 (formatKz duplicado) | ⭐⭐⭐⭐ |
| `next.config.js` | Baixa | 1 (ignoreBuildErrors) | ⭐⭐⭐ |
| `prisma/schema.prisma` | Alta | 0 (schema robusto) | ⭐⭐⭐⭐⭐ |

---

## 6. Pontos Fortes do Sistema

Apesar dos problemas identificados, o sistema tem uma base técnica sólida em várias áreas:

1. **Schema Prisma exemplar** — 20+ modelos com relações correctas, constraints adequadas, índices estratégicos e cascade rules bem pensadas.

2. **FinanceService.confirmPayment()** — A operação de confirmação de pagamento em 10 passos atómicos é o código de maior qualidade do sistema. Demonstra bom entendimento de integridade transaccional.

3. **Event Bus com tipagem forte** — `AppEventMap` tipado garante que publish/subscribe usam os mesmos tipos. A interface é compatível com Redis Pub/Sub para migração futura.

4. **Segurança no login** — Timing attack prevention com bcrypt dummy hash, rate limiting com janela deslizante, cookie httpOnly, JWT HS256.

5. **Documentos PDF profissionais** — `InvoiceDocument` em `@react-pdf/renderer` produz documentos com branding correcto, template dual (escritório/sala), e badge de estado colorido.

6. **Anti-bot no formulário público** — Combinação de rate limiting por IP, honeypot e threshold de tempo mínimo de preenchimento.

7. **Bootstrap e Event Handlers** — Padrão de registo único de handlers com flag `initialized` previne múltiplos registos.

---

## 7. Comparação com Standards de Mercado

| Área | VD Platform (actual) | Standard Mínimo Aceitável |
|---|---|---|
| Cobertura de testes | 0% | 60% para módulos críticos |
| Segurança RBAC | 5% das routes | 100% das routes |
| TypeScript strict | Não | Sim |
| Error monitoring | Não | Sim (Sentry ou equivalente) |
| Validação de schema | Manual | Zod ou equivalente |
| Rate limiting | Parcial (in-memory) | Redis + todos os endpoints públicos |
| 2FA para admin | Não funcional | Obrigatório para ADMIN |

---

## 8. Linha de Base para Medição de Progresso

Esta tabela serve como baseline para medir a evolução da saúde do sistema ao longo das próximas fases:

| Métrica | Baseline (Jul 2026) | Target Fase 0 (Set 2026) | Target Fase 1 (Dez 2026) |
|---|---|---|---|
| Score global | 58/100 | 72/100 | 85/100 |
| Findings críticos | 7 | 0 | 0 |
| Findings altos | 9 | 3 | 0 |
| Cobertura testes | 0% | 40% (módulos críticos) | 70% |
| Endpoints com RBAC | 5% | 100% | 100% |
| TypeScript sem erros | Não | Não | Sim |
| Error monitoring | Não | Não | Sim |

---

*VD Platform — System Health Report v1.0 — Julho 2026*  
*Próxima actualização: Setembro 2026 (fim da Fase 0)*
