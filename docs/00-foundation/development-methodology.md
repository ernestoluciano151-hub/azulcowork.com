# Metodologia de Desenvolvimento — VD Platform

> **Documento:** 00-METH-001  
> **Volume:** 00 — Foundation  
> **Estado:** ✅ Aprovado  
> **Versão:** 1.0.0  
> **Data:** Julho 2026  

---

## Declaração

> *Toda funcionalidade, toda correcção, toda melhoria seguirá obrigatoriamente as 10 etapas definidas neste documento. Nenhuma etapa pode ser omitida. A velocidade de desenvolvimento está sempre subordinada à qualidade do processo.*

---

## As 10 Etapas Obrigatórias

```
┌─────┐    ┌─────┐    ┌─────┐    ┌─────┐    ┌─────┐
│  1  │───►│  2  │───►│  3  │───►│  4  │───►│  5  │
│Audit│    │Arch │    │Model│    │ DB  │    │ API │
└─────┘    └─────┘    └─────┘    └─────┘    └─────┘
                                               │
                                               ▼
┌─────┐    ┌─────┐    ┌─────┐    ┌─────┐    ┌─────┐
│ 10  │◄───│  9  │◄───│  8  │◄───│  7  │◄───│  6  │
│Valid│    │Docs │    │Tests│    │Impl │    │ UX  │
└─────┘    └─────┘    └─────┘    └─────┘    └─────┘
```

---

## Etapa 1 — Auditoria

**Objetivo:** Compreender completamente o contexto antes de qualquer decisão.

### Perguntas Obrigatórias

1. O que existe actualmente neste módulo? (código, tabelas, APIs)
2. Que problemas existem no estado actual?
3. Que regras de negócio já estão implementadas (mesmo que não documentadas)?
4. Que módulos serão afectados pela mudança?
5. Que dados existentes podem ser comprometidos?
6. Que utilizadores serão afectados?
7. Existe documentação prévia relevante?

### Deliverables da Auditoria

- [ ] Lista de ficheiros relevantes mapeados
- [ ] Lista de tabelas e relações afectadas
- [ ] Lista de módulos com dependências
- [ ] Lista de riscos identificados
- [ ] Documento de auditoria (pode ser secção no ADR)

### Tempo Estimado

| Tamanho da Feature | Tempo de Auditoria |
|---|---|
| Bugfix simples | 15-30 minutos |
| Feature pequena (novo campo, nova validação) | 30-60 minutos |
| Feature média (novo endpoint, novo componente) | 1-2 horas |
| Feature grande (novo módulo, migração) | 1-2 dias |

---

## Etapa 2 — Arquitectura

**Objetivo:** Definir como a solução se encaixa na arquitectura existente.

### Questões Arquitecturais

1. Esta solução segue Clean Architecture? Onde se posiciona nas camadas?
2. Que Bounded Context é responsável?
3. Esta solução cria acoplamento indesejado?
4. Que eventos de domínio serão publicados?
5. Esta solução viola algum princípio SOLID, DRY, KISS?
6. A solução é escalável para 10x o volume actual?
7. Existe uma solução mais simples que resolva o problema?

### Deliverables Arquitecturais

- [ ] Diagrama de componentes (Mermaid) se relevante
- [ ] Identificação das camadas afectadas
- [ ] Eventos de domínio definidos
- [ ] ADR criado (se decisão significativa)

### Quando Criar um ADR

Criar um ADR obrigatoriamente quando:
- Escolher uma biblioteca nova
- Mudar um padrão existente
- Tomar uma decisão que afecte múltiplos módulos
- A decisão for difícil de reverter
- A decisão for não-óbvia e possa ser questionada no futuro

---

## Etapa 3 — Modelo de Domínio

**Objetivo:** Definir as entidades, value objects, eventos e regras de negócio antes de tocar no código.

### Questões de Domínio

1. Que entidades novas são necessárias?
2. Que campos novos são necessários em entidades existentes?
3. Quais são os invariantes de negócio desta feature?
4. Que estados novos existem? Que transições são válidas?
5. Que eventos de domínio são produzidos?
6. Que regras de negócio devem ser registadas na Business Bible?

### Deliverables do Modelo de Domínio

- [ ] `domain-model.md` actualizado (se novas entidades)
- [ ] Business Bible actualizada (se novas regras)
- [ ] Diagrama ER actualizado (se novas tabelas)
- [ ] Estados e transições documentados

---

## Etapa 4 — Base de Dados

**Objetivo:** Definir e implementar as alterações ao schema sem criar regressões.

### Processo de Migração Prisma

```bash
# 1. Alterar prisma/schema.prisma
# 2. Criar migration nomeada
npx prisma migrate dev --name descricao_da_mudanca

# 3. Verificar o SQL gerado em prisma/migrations/
# 4. Garantir que não há perda de dados

# 5. Actualizar seed.js se necessário
node prisma/seed.js
```

### Convenções de Migração

**Nome da migration:** `YYYYMMDDHHMMSS_descricao_snake_case`

**Campos obrigatórios em novas tabelas:**
```sql
"id"        TEXT NOT NULL PRIMARY KEY,  -- CUID via Prisma
"createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
"updatedAt" DATETIME NOT NULL           -- @updatedAt via Prisma
```

**Índices obrigatórios:**
- Todo campo FK
- Todo campo usado em `WHERE` frequentemente
- Todo campo usado em `ORDER BY`

### Checklist de Schema Change

- [ ] Nova migration criada com nome descritivo
- [ ] Migration testada em base de dados limpa
- [ ] Dados existentes não corrompidos
- [ ] Índices adicionados onde necessário
- [ ] `domain-model.md` actualizado
- [ ] Cascade rules verificadas

### Regras de Migração Segura

```sql
-- ✅ SEGURO — adicionar coluna nullable
ALTER TABLE "Lead" ADD COLUMN "company" TEXT;

-- ✅ SEGURO — adicionar coluna com default
ALTER TABLE "Lead" ADD COLUMN "source" TEXT DEFAULT 'landing-page';

-- ⚠️ PERIGOSO — adicionar coluna NOT NULL sem default
-- Vai falhar se existirem registos. Sempre usar default ou 2-step migration.

-- ❌ NUNCA — drop de coluna sem migração de dados
ALTER TABLE "Lead" DROP COLUMN "email";
-- Fazer backup e verificar dependências primeiro
```

---

## Etapa 5 — APIs

**Objetivo:** Definir os contratos das APIs antes da implementação.

### Contrato de API (API Contract)

Para cada endpoint novo, documentar:

```markdown
## POST /api/leads

**Auth:** Requerida (COMERCIAL+)  
**Rate Limit:** 10 req/min por IP  

**Request Body:**
{
  "firstName": string (obrigatório, min 2 chars)
  "lastName": string (obrigatório, min 2 chars)  
  "email": string (obrigatório, formato email)
  "whatsapp": string (obrigatório, com código país)
  "scheduledDate": string (ISO 8601)
}

**Respostas:**
- 201 Created: { id, firstName, ... }
- 400 Bad Request: { error: "Mensagem de validação" }
- 401 Unauthorized: redirect → /admin/login
- 403 Forbidden: { error: "Sem permissão" }
- 429 Too Many Requests: { error: "Rate limit excedido" }
- 500 Internal Server Error: { error: "Erro interno" }

**Side Effects:**
- Publica evento: lead.created
- Cria Timeline entry
- Cria Notification para admin
```

### Convenções de API

**Nomenclatura de rotas:**
```
GET    /api/[resource]           → listar
POST   /api/[resource]           → criar
GET    /api/[resource]/[id]      → obter um
PATCH  /api/[resource]/[id]      → actualizar parcialmente
DELETE /api/[resource]/[id]      → eliminar
POST   /api/[resource]/[id]/[action] → acção específica
```

**Respostas de sucesso:**
- `200 OK` — operação de leitura ou actualização
- `201 Created` — criação de novo recurso
- `204 No Content` — eliminação com sucesso

**Respostas de erro:**
```json
{ "error": "Mensagem humana descritiva do erro" }
```

---

## Etapa 6 — UX/UI

**Objetivo:** Definir a experiência do utilizador antes de codificar a interface.

### Processo de Design

1. **Esboço (Wireframe):** Esboço em papel ou ASCII art da interface
2. **Fluxo de utilizador:** Mapear os passos do utilizador
3. **Estados da UI:** Loading, Empty, Error, Success, Confirmation
4. **Acessibilidade:** Foco, contraste, keyboard navigation
5. **Mobile:** A interface funciona em mobile? (admin panel não precisa de ser mobile-first, mas deve ser usável)

### Padrões de UI Existentes

```
Paleta de cores:
  Primária:   #1F6FB2 (azul Azul Coworking)
  Fundo:      #0f172a (dark slate — admin)
  Texto:      #e2e8f0 (slate-200)
  Sucesso:    #10b981 (emerald-500)
  Aviso:      #f59e0b (amber-500)  
  Erro:       #ef4444 (red-500)
  Borda:      #334155 (slate-700)

Componentes padrão:
  Cards com bg-slate-800, border border-slate-700
  Botões primários: bg-blue-600 hover:bg-blue-500
  Botões de perigo: bg-red-600 hover:bg-red-500
  Inputs: bg-slate-700 border-slate-600 text-white
  Labels: text-slate-300 text-sm
  Tabelas: hover:bg-slate-700/50
```

### Checklist UX/UI

- [ ] Wireframe criado (mesmo que simples)
- [ ] Todos os estados de UI definidos (loading, empty, error)
- [ ] Feedback visual para acções do utilizador
- [ ] Confirmação para acções destrutivas
- [ ] Mensagens de erro claras e accionáveis
- [ ] Consistência com padrões visuais existentes

---

## Etapa 7 — Implementação

**Objetivo:** Escrever código que implementa exactamente o que foi definido nas etapas anteriores.

### Ordem de Implementação

```
1. Migração de base de dados (Etapa 4)
2. Tipos TypeScript (interfaces, enums)
3. Lógica de serviço (src/lib/)
4. API Routes (src/app/api/)
5. Componentes Server (src/app/admin/*/page.tsx)
6. Componentes Client (src/components/admin/)
7. Event handlers (src/lib/event-handlers.ts)
```

### Checklist de Implementação

- [ ] Código segue as convenções TypeScript do projecto
- [ ] Sem `any` implícito
- [ ] Operações multi-tabela usam `$transaction`
- [ ] Eventos de domínio publicados após persistência
- [ ] Input validado no servidor
- [ ] Autenticação verificada
- [ ] Rate limiting em endpoints públicos
- [ ] Sem `console.log` de debug
- [ ] Sem credenciais hardcoded

---

## Etapa 8 — Testes

**Objetivo:** Garantir que a implementação funciona correctamente e não quebra o que já existia.

### Tipos de Testes

**Testes Unitários** — testam uma função/serviço isoladamente:
```typescript
// Exemplo futuro com Vitest
describe("FinanceService.confirmPayment", () => {
  it("deve criar invoice quando não existe", async () => {
    const mockPrisma = createMockPrisma();
    const result = await confirmPayment(mockPrisma, { ... });
    expect(result.invoiceNumber).toMatch(/^FT-SALA-\d{4}-\d{6}$/);
  });
});
```

**Testes de Integração** — testam endpoint + base de dados:
```typescript
// Teste de API Route com base de dados de teste
it("POST /api/leads deve criar lead e publicar evento", async () => {
  const response = await fetch("/api/leads", {
    method: "POST",
    body: JSON.stringify({ firstName: "Ana", ... })
  });
  expect(response.status).toBe(201);
  // verificar evento publicado
});
```

**Testes E2E** — testam fluxo completo:
```typescript
// Playwright (Fase 1)
test("criar lead e converter em empresa", async ({ page }) => {
  await page.goto("/admin/leads");
  await page.click("[data-testid='create-lead']");
  // ...
});
```

### Prioridade de Testes

| Módulo | Prioridade | Razão |
|---|---|---|
| FinanceService | 🔴 Crítica | Operações financeiras irreversíveis |
| Auth / RBAC | 🔴 Crítica | Segurança |
| PricingService | 🔴 Crítica | Cálculos de preço |
| API Routes (financeiro) | 🟠 Alta | Integridade de dados |
| API Routes (CRM) | 🟡 Média | Importante mas não financeiro |
| Componentes UI | 🟢 Baixa | Visual, menos crítico |

### Checklist de Testes

- [ ] Testes unitários para lógica de negócio crítica
- [ ] Testes de integração para novos endpoints
- [ ] Testes de regressão para funcionalidades afectadas
- [ ] Casos de erro testados (input inválido, sem auth, sem permissão)
- [ ] Teste manual do fluxo principal

---

## Etapa 9 — Documentação

**Objetivo:** Garantir que toda a mudança está documentada antes de ser considerada completa.

### O Que Documentar

| Mudança | Documentação Obrigatória |
|---|---|
| Novo campo no schema | `domain-model.md` actualizado |
| Nova regra de negócio | Business Bible (`BR-NNN-modulo.md`) |
| Nova decisão arquitectural | ADR criado |
| Novo endpoint API | Contrato de API no docs do módulo |
| Novo componente significativo | Comentário JSDoc no componente |
| Comportamento alterado | CHANGELOG.md ou secção de notas na PR |

### Checklist de Documentação

- [ ] `domain-model.md` actualizado se houve mudança de schema
- [ ] Business Bible actualizada se houve nova regra de negócio
- [ ] ADR criado se houve decisão arquitectural significativa
- [ ] README do módulo actualizado se necessário
- [ ] Comentários no código para lógica não-óbvia
- [ ] Variáveis de ambiente documentadas em `.env.example`

---

## Etapa 10 — Validação

**Objetivo:** Confirmar que a implementação cumpre os critérios de aceitação definidos na Etapa 1.

### Checklist de Validação

**Funcional:**
- [ ] Todos os fluxos principais testados manualmente
- [ ] Todos os casos de erro testados
- [ ] Todos os critérios de aceitação verificados
- [ ] Comportamento com dados reais validado

**Técnico:**
- [ ] Sem erros de TypeScript (ou erros documentados e intencionais)
- [ ] Performance aceitável (< 300ms p95 para operações normais)
- [ ] Sem N+1 queries (verificar no Prisma query log)
- [ ] Sem memory leaks óbvios

**Segurança:**
- [ ] Checklist de segurança da Etapa 6 verificada
- [ ] Dados pessoais tratados correctamente
- [ ] Não expõe informação sensível em respostas de erro

**Documentação:**
- [ ] Toda a documentação actualizada
- [ ] CHANGELOG actualizado (se relevante)
- [ ] Aprovação do Product Owner (para features novas)

---

## Fluxo de Aprovação

```
Developer/Claude → Proposta técnica → Product Owner
                                           │
                              Aprovação? ──┤
                                           │
                              Sim ─────────┼──► Implementar (Etapas 4-10)
                              Não ─────────┘──► Rever proposta
```

**Para bugs críticos** (pagamento errado, dados perdidos, acesso indevido):
- Etapas 1-3 são feitas em paralelo com a implementação
- A velocidade de resolução justifica o processo paralelo, mas a documentação deve ser feita depois

**Para hotfixes de produção:**
- Corrigir → Deploy → Documentar (dentro de 24h)

---

## Estimativas de Tempo por Feature

| Tipo de Feature | Etapas 1-3 | Etapas 4-6 | Etapas 7-9 | Etapa 10 | Total Est. |
|---|---|---|---|---|---|
| Bugfix simples | 30 min | — | 30 min | 15 min | ~1h |
| Campo novo | 30 min | 30 min | 1h | 30 min | ~2.5h |
| Endpoint novo | 1h | 1h | 2h | 1h | ~5h |
| Módulo pequeno | 2h | 3h | 8h | 2h | ~15h |
| Módulo médio | 1 dia | 1 dia | 3 dias | 1 dia | ~6 dias |
| Módulo grande | 2-3 dias | 3 dias | 1-2 sem | 2 dias | 3-4 sem |

---

*VD Platform — Development Methodology v1.0.0 — Julho 2026*
