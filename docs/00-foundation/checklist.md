# Checklists de Qualidade — VD Platform

> **Documento:** 00-CHECK-001  
> **Volume:** 00 — Foundation  
> **Estado:** ✅ Aprovado  
> **Data:** Julho 2026  

---

## Checklist 1 — Antes de Iniciar Qualquer Trabalho

```
CONTEXTO:
□ Li o CLAUDE.md na raiz do projecto
□ Li docs/claude-guide/README.md
□ Identifiquei o módulo e os ficheiros afectados
□ Li o README do módulo correspondente em docs/modules/
□ Consultei a Business Bible para as regras relevantes
□ Consultei os ADRs para restrições arquitecturais
□ Compreendo como a minha alteração afecta outros módulos

AUDITORIA:
□ Que tabelas vou tocar?
□ Que relações existem entre essas tabelas?
□ Que API Routes existem para este recurso?
□ Que eventos de domínio são relevantes?
□ Esta feature foi aprovada e documentada?
```

---

## Checklist 2 — Antes de Criar uma Migration Prisma

```
PLANEAMENTO:
□ A mudança de schema está documentada em domain-model.md?
□ A mudança pode corromper dados existentes?
□ É necessária uma migração de dados antes da mudança de schema?
□ Os índices necessários estão incluídos?
□ As cascade rules estão correctas?

IMPLEMENTAÇÃO:
□ O nome da migration é descritivo?
□ A migration foi testada em base de dados limpa?
□ A migration foi testada com dados existentes similares?
□ O seed.js foi actualizado se necessário?
□ O @prisma/client foi regenerado?

PÓS-MIGRATION:
□ domain-model.md foi actualizado?
□ Os tipos TypeScript estão correctos após regeneração?
□ As queries existentes continuam a funcionar?
```

---

## Checklist 3 — Antes de Submeter Código para Revisão

```
CÓDIGO:
□ Sem any TypeScript não justificado
□ Sem console.log de debug
□ Sem credenciais ou secrets no código
□ Sem TODO/FIXME sem resolução ou justificação
□ Funções > 50 linhas foram justificadas ou divididas
□ Ficheiros > 300 linhas foram justificados ou divididos

ARQUITECTURA:
□ Operações multi-tabela usam prisma.$transaction()
□ Eventos de domínio publicados APÓS persistência
□ Input validado no SERVIDOR (não apenas no cliente)
□ Autenticação verificada em endpoints protegidos
□ Rate limiting em endpoints públicos

NEGÓCIO:
□ Regras Business Bible respeitadas
□ SSoT preservado (sem duplicação de dados)
□ Numeração de documentos correcta (FT-, REC-, NL-, RES-)
□ Auditoria financeira activa para operações sensíveis
□ Cascade rules correctas (CASCADE, SET NULL, etc.)

SEGURANÇA:
□ Role do utilizador verificado antes de operações sensíveis
□ Sem exposição de dados sensíveis em respostas de erro
□ Sem IDOR (verificar que utilizador acede apenas aos seus dados)
□ CSP não violado (sem scripts externos não listados)
□ Uploads validam tipo e tamanho de ficheiro

TESTES:
□ Fluxo principal testado manualmente
□ Casos de erro testados (input inválido, sem auth, sem permissão)
□ Dados existentes não foram corrompidos
□ Testes unitários adicionados para lógica crítica
```

---

## Checklist 4 — Operação de Pagamento / Financeira

```
PRÉ-OPERAÇÃO:
□ A operação usa FinanceService (não lógica inline)?
□ A operação está dentro de prisma.$transaction()?
□ O utilizador tem role ADMIN ou FINANCEIRO?

DURANTE A OPERAÇÃO:
□ Invoice é encontrada ou criada (nunca duplicada)?
□ InvoicePayment é criado com os dados correctos?
□ totalAmount, balance, paidPercentage são recalculados?
□ Payment record é actualizado/criado?
□ Reservation.paymentStatus é actualizado?
□ LiquidationNote é criada (NL-YYYY-NNNNNN)?
□ FinancialHistory é registado (se company)?
□ Timeline entry é adicionada?
□ FinancialAudit entry é criada?

PÓS-OPERAÇÃO:
□ Evento de domínio é publicado?
□ Email/WhatsApp de confirmação é gerado?
□ Notificação interna é criada?
□ Os números gerados seguem o formato correcto?
```

---

## Checklist 5 — Nova Feature Completa

```
DOCUMENTAÇÃO:
□ Proposta técnica documentada e aprovada
□ domain-model.md actualizado se houve mudança de schema
□ Business Bible actualizada se houve nova regra de negócio
□ ADR criado se houve decisão arquitectural significativa
□ README do módulo actualizado
□ Roadmap actualizado se a feature era planedada

BASE DE DADOS:
□ Migration criada com nome descritivo
□ Índices adicionados
□ Cascade rules correctas
□ Testada em base de dados limpa e com dados

CÓDIGO:
□ Segue Clean Architecture (camada correcta)
□ Segue Single Source of Truth
□ Usa Event Bus para comunicação entre módulos
□ Sem duplicação de lógica (DRY)

TESTES:
□ Testes unitários para lógica de negócio crítica
□ Testes de integração para novos endpoints
□ Testes de regressão para funcionalidades afectadas
□ Todos os casos de erro cobertos

VALIDAÇÃO:
□ Todos os critérios de aceitação verificados
□ Product Owner validou a feature
□ Performance aceitável (< 300ms operações normais)
□ Zero erros de TypeScript (ou documentados)
□ Security review realizado
```

---

## Checklist 6 — Deploy para Produção

```
PRÉ-DEPLOY:
□ Build de produção sem erros: npm run build
□ Todas as variáveis de ambiente configuradas no Vercel
□ Database migrations executadas em produção
□ Backup da base de dados realizado antes de migrations perigosas

SEGURANÇA:
□ JWT_SECRET é um valor seguro e único para produção
□ DATABASE_URL aponta para produção (não para dev)
□ Cloudinary configurado para produção
□ SMTP configurado para produção
□ Rate limiting activo

PÓS-DEPLOY:
□ Fluxo principal testado em produção
□ Logs verificados no Vercel (sem erros críticos)
□ Notificações a funcionar
□ PDF generation a funcionar
□ Upload de ficheiros a funcionar
□ Email a funcionar

ROLLBACK:
□ Plano de rollback definido se algo correr mal
□ Como reverter a migration (se aplicável)?
□ Como restaurar o backup (se aplicável)?
```

---

## Checklist 7 — Revisão de Segurança

```
AUTENTICAÇÃO E AUTORIZAÇÃO:
□ Todos os endpoints protegidos verificam JWT no middleware
□ Endpoints sensíveis reverificam role na API Route
□ Não existe bypass de autenticação
□ Sessões têm expiração adequada (12h)

INPUT E OUTPUT:
□ Todo input do cliente é validado no servidor
□ Tipos são verificados (não apenas presença)
□ Tamanhos máximos definidos (strings, ficheiros)
□ Respostas de erro não expõem detalhes internos

DADOS:
□ Dados pessoais tratados de forma adequada (RGPD/LGPD)
□ Sem dados sensíveis em logs
□ Sem dados sensíveis em URLs (usar body/headers)
□ Uploads verificam tipo MIME e tamanho

INFRAESTRUTURA:
□ Variáveis de ambiente não expostas ao cliente
□ NEXT_PUBLIC_ apenas para dados verdadeiramente públicos
□ CSP configurado e adequado para os recursos usados
□ HTTPS forçado em produção (HSTS)
```

---

*VD Platform — Quality Checklists v1.0.0 — Julho 2026*
