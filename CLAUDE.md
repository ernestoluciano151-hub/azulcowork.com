# CLAUDE.md — VD Platform

> **Leitura obrigatória antes de qualquer acção neste repositório.**  
> **Versão:** 2.1.0 — Julho 2026 (RC-1 GO — Estado OPERACIONAL)

---

## 🟢 Estado do Projecto: OPERACIONAL — PILOTO CONTROLADO EM CURSO

> **Tag:** v1.0.0-rc1 · **Aprovação GO:** Ernesto Pinto Luciano · **Data:** 30 Jul 2026  
> **Freeze de funcionalidades activo** — apenas correcções críticas durante o piloto  
> **Piloto:** 3–5 empresas reais · 14 dias · docs/pilot/

---

## Alterações durante o Piloto (excepções ao freeze — aprovadas directamente pelo PO)

> Freeze de funcionalidades activo (linha 11) permite apenas correcções críticas.
> As alterações abaixo foram pedidas directamente por Ernesto Pinto Luciano (PO) em
> 03 Ago 2026, tratadas como correcções de regras de negócio/UX críticas para o
> piloto em curso (facturação incorrecta e bloqueio de registo de leads).

| Data | Alteração | Ficheiros principais | Migração DB |
|---|---|---|---|
| 03 Ago 2026 | Facturação de sala de reunião: 15.000 Kz/h com arredondamento de 30 min (`roundBillableHours`) — substitui o matching de tiers com bug | `src/lib/pricing-service.ts`, `src/components/admin/ReservationModal.tsx` | Não |
| 03 Ago 2026 | "Taxa de Condomínio" — 9.500 Kz/mês, renovável, visível em Atividades para todas as empresas SALA_PRIVADA | `src/app/api/atividades/route.ts`, `src/app/admin/atividades/page.tsx` | Não |
| 03 Ago 2026 | Categoria de empresa (`CompanyCategory`: SALA_PRIVADA / SALA_REUNIAO) — leads de sala de reunião registam-se como empresa sem contrato/mensalidade; aparecem automaticamente nas reservas | `prisma/schema.prisma`, `src/app/api/companies/route.ts`, `src/app/api/room-booking-leads/[id]/convert/route.ts`, `src/components/admin/CompanyModal.tsx`, `src/app/admin/leads-salas/page.tsx` + filtros de exclusão em `atividades`, `companies/alerts`, `finance/summary`, `admin/dashboard` | **Sim** — `20260803175727_company_category` (aditiva: novo enum + coluna com `DEFAULT 'SALA_PRIVADA'`, sem alterar colunas existentes) |
| 03 Ago 2026 | Portal do Cliente: corrigido loop no magic link (fallback de `NEXT_PUBLIC_APP_URL` vazio a gerar redirects inválidos), botão "Link" a devolver o URL real em vez de alegar envio falso, envio opcional do link por email, mensagens de erro reais em vez de genéricas ao activar/desactivar utilizadores | `src/app/api/portal/auth/magic/route.ts`, `src/app/api/portal/auth/magic-link/route.ts`, `src/app/api/admin/portal/magic-link/route.ts`, `src/app/admin/portal/utilizadores/page.tsx` | Não |
| 03 Ago 2026 | Confirmação de pagamento da Taxa de Condomínio directamente em Atividades — gera fatura ERP (FT-SERV) + pagamento + recibo (REC) automaticamente, sincronizado com Faturas/Fluxo de Caixa; recibo gerado em PDF de imediato, envio por email fica ao critério do admin | `src/lib/condominio-service.ts` (novo), `src/app/api/atividades/condominio/route.ts` (novo), `src/app/api/atividades/route.ts`, `src/app/admin/atividades/page.tsx`, `src/lib/erp-communication-service.ts` (`sendReceipt` com `skipEmail`), `src/app/api/erp/payments/[id]/receipt/route.ts` | Não — reaproveita `ErpInvoice`/`ErpPayment` já existentes; idempotência por marcador `CONDOMINIO:YYYY-MM` em `ErpInvoice.notes` |
| 03 Ago 2026 | Corrigido input de data nativo (`<input type="date">`) que permitia digitação por segmento sem validação, produzindo datas corrompidas (ex.: ano "0266") em Nova Fatura/Nova Despesa — substituído por `SmartDatePicker` (máscara dd/mm/aaaa com clamping + calendário visual), valor mantém formato ISO `yyyy-MM-dd` sem alterar API/schema | `src/components/admin/SmartDatePicker.tsx` (novo), `src/app/admin/pagamentos/page.tsx` | Não |
| 03 Ago 2026 | Corrigido NIF errado (5417253208) no cabeçalho do PDF de Recibo de sala (`REC-SALA-...`) — não correspondia ao NIF real da empresa (5002174308), já correcto na Fatura (`invoice-pdf.tsx`), no Contrato e na Circular. Detectado por comparação com documentos oficiais fornecidos pelo PO | `src/lib/receipt-pdf.tsx` | Não |
| 04 Ago 2026 | Corrigida geração de PDF quebrada em produção ("Minified React error #31") ao emitir qualquer recibo/fatura/contrato/proposta — causa raiz: o webpack do Next.js empacotava `@react-pdf/renderer` (e dependências nativas/wasm como `yoga-layout`) junto com o `react` da aplicação, duplicando a instância vista pelo reconciliador interno do react-pdf. Corrigido listando estes pacotes em `serverExternalPackages`, forçando `require()` nativo em runtime Node em vez de reescrita pelo webpack. Diagnóstico confirmado por reprodução isolada fora do bundle (script Node standalone com o mesmo `receipt-pdf.tsx` — renderizou sem erro, confirmando que o problema é do bundling do Next e não dos dados/componente) | `next.config.js` | Não |
| 04 Ago 2026 | `Sentry.captureException` explícito nas rotas `invoices/[id]/receipt` e `invoices/[id]/download` — o `catch` local devolvia JSON 500 sem nunca propagar a excepção, por isso o Sentry (já configurado) nunca via estes erros; ficava só a mensagem minificada do React, sem stack trace | `src/app/api/invoices/[id]/receipt/route.ts`, `src/app/api/invoices/[id]/download/route.ts` | Não |
| 04 Ago 2026 | Reserva de sala via Portal do Cliente (`POST /api/portal/bookings`) calculava o preço com fórmula própria (`totalHours * pricePerHour`, sem arredondamento de 30 min nem fallback para 15.000 Kz/h) — divergia do motor `calcPrice`/`roundBillableHours` usado pelo painel admin (fixado em 03 Ago). Corrigido para reaproveitar o mesmo `calcPrice()` (SSoT único do cálculo); estimativa mostrada no formulário do portal (`/portal/reservas/nova`) também alinhada com a mesma regra de arredondamento, para nunca mostrar um valor diferente do que é realmente cobrado | `src/app/api/portal/bookings/route.ts`, `src/app/portal/reservas/nova/page.tsx` | Não |
| 04 Ago 2026 | Sentry nunca recebia nenhum evento em produção ("Waiting for this project's first error" mesmo com falhas reais repetidas) — causa raiz: `sentry.server.config.ts`/`sentry.edge.config.ts` existiam mas nunca eram importados por ninguém; `withSentryConfig` no `next.config.js` só cuida do build (sourcemaps), não chama `Sentry.init()` no App Router. Corrigido importando os configs a partir de `src/instrumentation.ts` (hook oficial do Next.js) + adicionado `onRequestError` para capturar também excepções não tratadas. Sem isto, todos os `Sentry.captureException()` já adicionados nas rotas de PDF eram no-ops silenciosos — só percebido ao confirmar no dashboard do Sentry que nunca tinha havido nenhum evento, apesar de falhas confirmadas | `src/instrumentation.ts` | Não |
| 04 Ago 2026 | Causa real do PDF quebrado ("React error #31") identificada via stack trace real do Sentry (só disponível depois da correcção acima): falha dentro de `@react-pdf/reconciler/lib/reconciler-23.js`, em produção a correr Node **v24.18.0** — versão muito recente, sem LTS. O `@react-pdf/reconciler` traz uma cópia própria e isolada do pacote `scheduler` presa a uma build canário (`0.25.0-rc-...`), separada da versão estável usada pelo resto da app; combinada com Node 24 (não testado pelo pacote), produz exactamente este erro. Corrigido fixando a versão do Node no `package.json` (`engines.node`) para `20.x` (LTS estável, amplamente testada com este stack) — Vercel lê este campo para escolher o runtime | `package.json` | Não |
| 05 Ago 2026 | PDF continuava quebrado após a correcção acima (Node 20.x confirmado pelo PO em deploy real) — o pin de Node não era a causa raiz. Investigação aprofundada da mensagem completa do erro no Sentry: "Objects are not valid as a React child (found: object with keys {$$typeof, type, key, ref, props})" — esta assinatura de chaves é exactamente a forma interna de um elemento React, ou seja, o objecto rejeitado É um elemento React genuíno, não um Decimal/Date. Isto acontece quando o elemento é criado por uma cópia de `react` diferente da que o `@react-pdf/reconciler` valida — confirmado como problema conhecido e não resolvido a montante em `diegomura/react-pdf` (issues #2940, #2994, #2966) especificamente em Route Handlers do Next.js 15 app router. A correcção anterior (`serverExternalPackages`) só listava `@react-pdf/renderer`, não `react`/`react-dom` — os nossos próprios ficheiros (`receipt-pdf.tsx`, `invoice-pdf.tsx`, `document-pdf-renderer.tsx`) continuavam a ser empacotados pelo webpack, que no grafo de Route Handlers pode resolver `react/jsx-runtime` sob uma condição diferente da usada pelo `require()` nativo do pacote externo, produzindo elementos com identidade `$$typeof` divergente. Corrigido acrescentando `"react"`, `"react-dom"` e `"scheduler"` a `serverExternalPackages`, forçando toda a árvore server-side (incluindo os nossos componentes) a usar a mesma cópia nativa de React | `next.config.js` | Não |
| 05 Ago 2026 | **REVERTIDO** — a correcção acima (externalizar `react`/`react-dom`/`scheduler`) partiu o build de produção por completo (deploy nem chegava a concluir): `Error: A React Element from an older version of React was rendered` ao pré-renderizar a própria página `/_not-found` do Next.js. Confirmado pelo PO via build logs do Vercel. Causa: externalizar `react`/`react-dom` a nível de projecto interfere com o mecanismo interno de RSC do Next (que depende de uma cópia bundled específica de React no boundary client/server), não é seguro fazê-lo globalmente. Revertido `serverExternalPackages` para a lista original (`@react-pdf/renderer`, `yoga-layout`, `fontkit`). Aproveitado o mesmo deploy para remover também o pin `engines.node: "20.x"` do `package.json` (Vercel avisou que Node 20.x fica deprecated para builds a partir de 2026-10-01 e que este pin estava a sobrepor-se às Project Settings, que já apontam para 24.x) — não havia motivo para o manter, já que a versão do Node se confirmou não ser a causa do bug do PDF. | `next.config.js`, `package.json` | Não |
| 05 Ago 2026 | Confirmado pelo PO que o erro do PDF **permaneceu** mesmo depois da reversão acima (ou seja, nunca foi resolvido por nenhum ajuste de `serverExternalPackages`/Node) — esgotadas as correcções de configuração. Isolada a geração de TODOS os PDFs (recibo/factura de download directo, factura/recibo ERP por email, proposta, contrato) num processo `node` filho, completamente fora do bundler/webpack do Next.js. Novo módulo `pdf-workers/` (fora de `src/`, nunca importado por nenhuma rota Next): `entry.tsx` reaproveita os MESMOS componentes existentes (`ReceiptDocument`, `InvoiceDocument`, `InvoiceDoc`/`ReceiptDoc` de `erp-pdf-service.tsx`, `ProposalPdfDocument`/`ContractPdfDocument` de `document-pdf-renderer.tsx` — todos agora exportados, sem duplicação de template) e `build.mjs` compila-o com esbuild em `pdf-workers/dist/entry.cjs` (`jsx: "transform"` → React.createElement clássico, NUNCA usa `react/jsx-runtime`; `packages: "external"` → `react`/`@react-pdf/renderer`/etc. resolvidos por `require()` nativo do Node a partir de `node_modules`, exactamente como nos testes manuais que confirmaram sempre funcionar fora do bundler do Next). `src/lib/pdf-worker-client.ts` invoca o worker via `child_process.spawn`, envia os dados por stdin (JSON) e recebe os bytes do PDF por stdout. `generateInvoicePdf`/`generateReceiptPdf` (erp-pdf-service.tsx) e `renderProposalPdf`/`renderContractPdf` (document-pdf-renderer.tsx) mantêm a mesma assinatura pública — só a implementação interna delega para o worker, `erp-communication-service.ts` e `document-generation-service.ts` não precisaram de alterações. `next.config.js` ganhou `outputFileTracingIncludes: { "/**": ["./pdf-workers/dist/**"] }` — sem isto o tracer de ficheiros do Vercel não detectaria o `child_process.spawn()` com caminho dinâmico e o worker falharia com ENOENT em produção apesar de funcionar em local. `npm run build`/`build:prod` correm `build:pdf-worker` (novo, via `esbuild`, novo devDependency) antes de `next build`. Testado localmente: os 6 tipos de documento geram PDFs válidos (`%PDF` magic bytes) correndo o worker compilado fora do Next | `pdf-workers/entry.tsx` (novo), `pdf-workers/build.mjs` (novo), `src/lib/pdf-worker-client.ts` (novo), `src/lib/erp-pdf-service.tsx`, `src/lib/document-pdf-renderer.tsx`, `src/app/api/invoices/[id]/receipt/route.ts`, `src/app/api/invoices/[id]/download/route.ts`, `next.config.js`, `package.json`, `.gitignore` | Não |

| 11 Ago 2026 | Confirmado pelo PO que a correcção do isolamento do PDF (05 Ago) resolveu o problema — o worker renderiza sem erro. Ao testar "Gerar Documento" (Contrato) surgiu um erro novo e não relacionado: `POST /api/admin/documents/generate` a falhar com "Erro interno ao gerar documento". Sentry (já a capturar graças à correcção de instrumentação) revelou a causa real: `Invalid Signature <hash-40-hex>. String to sign - 'overwrite=0&publi...'` do Cloudinary — a assinatura enviada tem o comprimento de SHA-1 (40 caracteres hex), mas a conta Cloudinary está configurada para exigir SHA-256; o SDK `cloudinary` assina com SHA-1 por omissão a menos que `signature_algorithm: "sha256"` seja explicitado. Nunca tinha sido detectado antes porque este era o único caminho (`document-generation-service.ts`) que não envolve o upload num `try/catch` que absorve o erro como aviso — os outros 4 pontos de upload Cloudinary (`erp-communication-service.ts`, `portal-documents-service.ts`, `portal-signed-url-service.ts`, `src/app/api/upload/route.ts`) tinham provavelmente o mesmo bug, silenciado. Corrigido acrescentando `signature_algorithm: "sha256"` a todas as 5 configurações `cloudinary.config()` do projecto. **Dívida técnica identificada, não corrigida agora:** 5 chamadas independentes a `cloudinary.config()` com os mesmos 3 env vars é uma violação de SSoT (regra 8) — deveria ser um único módulo `cloudinary-client.ts` partilhado; sinalizado para o backlog de refactoring, fora do âmbito desta correcção urgente | `src/lib/document-generation-service.ts`, `src/lib/erp-communication-service.ts`, `src/lib/portal-documents-service.ts`, `src/lib/portal-signed-url-service.ts`, `src/app/api/upload/route.ts` | Não |

| 11 Ago 2026 | Corrigido cálculo de meses de contrato (`calcContractMonths`, `src/lib/finance.ts`) reportado pelo PO com um caso real: empresa com `contractStart` 06/08/2026 mostrava "Período: 06/08 – 31/08" e "1 mês" no painel financeiro, como se o ciclo de facturação reiniciasse sempre no fim do mês calendárico em vez de andar 1 mês a partir da data real de início (06/08 → 06/09). Causa raiz: `differenceInCalendarMonths(end, start) + 1` assume que `start` é sempre dia 1 e `end` é sempre o último dia de um mês — válido só para contratos alinhados ao calendário (a maioria dos contratos legados), mas incorrecto para ciclos rolantes (ex.: empresas SALA_PRIVADA convertidas de leads de sala, cujo `contractStart` é a data real de conversão, não dia 1). Corrigido com uma fórmula baseada em meses inteiros decorridos (`differenceInMonths` + detecção de mês parcial), que dá o MESMO resultado para todos os contratos alinhados ao calendário (confirmado com os 5 casos de teste pré-existentes) e o resultado correcto para ciclos rolantes. **Nota:** esta correcção não altera dados já gravados — o `contractEnd` desta empresa específica (31/08/2026) continua fisicamente errado na BD e precisa de correcção manual via Editar Empresa (para 06/09/2026); não foi possível corrigir directamente por não haver acesso à BD de produção nesta sessão | `src/lib/finance.ts`, `src/__tests__/unit/finance.test.ts` | Não |
| 11 Ago 2026 | PO reportou recorrência: "Erro interno ao gerar documento" (Contrato, empresa GERSON E ANDERSON LDA) e "Cloudinary upload falhou: [object Object]" / PDF indisponível ao "Enviar recibo por email" em Atividades (Taxa de Condomínio, GERSON E ANDERSON LDA) — mesmo depois da correcção `signature_algorithm: sha256` (linha acima). Investigação: o commit com essa correcção (`c55ae1e`) já está em `main`/`origin/main` (confirmado via `git log`), portanto o código-fonte está correcto — falta confirmar se o Vercel já reimplantou a partir desse commit. Em paralelo, identificado e corrigido um bug real de diagnóstico: `err instanceof Error ? err.message : String(err)` em `erp-communication-service.ts` (2 ocorrências, upload de factura e de recibo) e em `api/admin/documents/generate/route.ts` — quando o SDK `cloudinary` rejeita com um objecto simples (não `instanceof Error`), `String(err)` produz sempre literalmente `"[object Object]"`, escondendo a mensagem real (ex.: "Invalid Signature...") de quem lê o aviso no ecrã de Atividades. Corrigido com `extractErrorMessage()` (tenta `.message` mesmo em objectos não-Error, com fallback `JSON.stringify`) — próxima ocorrência mostrará o erro Cloudinary real em vez de "[object Object]". **Acção pendente do PO:** confirmar no painel Vercel que o deploy activo corresponde ao commit `bce31b3` (ou posterior); se sim e o erro persistir, o próximo passo é ler o evento Sentry mais recente da rota `admin/documents/generate` para ver se é a mesma assinatura Cloudinary ou uma causa nova | `src/lib/erp-communication-service.ts`, `src/app/api/admin/documents/generate/route.ts` | Não |
| 11 Ago 2026 | PO reportou 3 problemas em simultâneo com screenshots: (1) com a correcção da linha acima já em produção, o aviso Cloudinary deixou de mostrar `[object Object]` e passou a mostrar a mensagem real: `Invalid Signature <hash-64-hex>. String to sign - 'folder=...&overwrite=1&public_id=REC-2026-000010&timestamp=...&unique_filename=0&use_filename=0'` — a assinatura tem agora 64 caracteres hex (SHA-256, confirma que `signature_algorithm: sha256` está a ser aplicado correctamente), mas o Cloudinary continua a rejeitar. Isto **invalida a hipótese original** (linha do dia 11 Ago sobre SHA-1 vs SHA-256) — o algoritmo já está correcto, logo a causa mais provável é `CLOUDINARY_API_SECRET` incorrecto/desactualizado no Vercel (ex.: chave regenerada na consola Cloudinary sem actualizar a env var, ou espaço/quebra de linha acidental ao colar). Sem acesso à consola Cloudinary nem ao Vercel nesta sessão, não foi possível confirmar directamente — **acção pendente do PO:** confirmar `CLOUDINARY_API_SECRET` no Vercel contra o valor exacto em Cloudinary Console → Settings → Security, sem espaços/aspas acidentais, e reimplantar. (2) "Enviar por email" (magic link do Portal e recibos) falha com `Invalid login: 535-5.7.8 Username and Password not accepted` — erro específico do Gmail SMTP em `email.ts`, `communication-service.ts` e `erp-email-service.ts` (todos usam `smtp.gmail.com:465` com `SMTP_USER`/`SMTP_PASS`). O PO confirmou já ter actualizado `SMTP_PASS` no Vercel, mas **actualizar uma env var no Vercel não reimplanta automaticamente as funções já em produção** — é necessário accionar um novo deploy para o valor novo entrar em vigor. Além disso, o Gmail exige obrigatoriamente uma "Password de Aplicação" de 16 caracteres (gerada em myaccount.google.com/apppasswords, requer Verificação em 2 Passos activa na conta) — a password normal da conta é sempre rejeitada com este mesmo erro 535-5.7.8. **Acção pendente do PO:** confirmar que `SMTP_PASS` é uma App Password (não a password normal), que `SMTP_USER` corresponde exactamente à conta Gmail que gerou essa App Password, e reimplantar no Vercel para o valor actualizado ter efeito. (3) Texto invisível (branco sobre branco) em todos os campos de formulário do Portal do Cliente (login, suporte, reservas, perfil) — causa raiz: `body { color: #F5F7FA }` em `globals.css` (pensado para o tema escuro do admin) é herdado por `input`/`textarea`/`select` via `color:inherit` do Tailwind preflight, tornando o texto quase branco sobre os cartões brancos (`bg-white`) do Portal. Corrigido com uma classe `.portal-light` aplicada no layout raiz do Portal (`src/app/portal/layout.tsx`) + regra CSS scoped em `globals.css` que repõe `color:#111827` em inputs/textareas/selects apenas dentro do Portal — sem tocar no tema escuro do admin | `src/app/portal/layout.tsx`, `src/styles/globals.css` | Não |

**Nota de risco:** a migração é puramente aditiva (novo enum + coluna com valor por omissão) — não altera, torna nula, nem remove qualquer coluna existente. Todas as leituras de `contractStart`/`contractEnd`/`rentAmount` continuam não-nulas (empresas SALA_REUNIAO recebem valores-placeholder preenchidos pela API, nunca `null`).

---

## Identidade e Papel

Neste projecto, Claude actua como **Arquiteto-Chefe do VD Platform**. A missão principal não é escrever código — é garantir que todas as decisões técnicas preservam a qualidade, consistência e visão de longo prazo do produto.

---

## Protocolo Obrigatório de Arranque

Antes de qualquer acção, executar obrigatoriamente:

```
1. Ler este ficheiro (CLAUDE.md)
2. Ler docs/README.md
3. Ler docs/00-foundation/architecture.md
4. Ler docs/claude-guide/README.md
5. Identificar módulo afectado → ler docs/modules/[módulo]/README.md
6. Consultar docs/business-bible/README.md (regras relevantes)
7. Consultar docs/adr/README.md (decisões arquitecturais)
8. Só então propor ou implementar
```

---

## Contexto do Projecto

**Produto:** VD Platform — Plataforma SaaS de gestão empresarial  
**Caso de uso actual:** Azul Coworking, Bairro Azul, Edifício 18, Luanda, Angola  
**Operador:** VERSÃO DE NEGÓCIOS - COMÉRCIO GERAL E PRESTAÇÃO DE SERVIÇOS, LDA  
**NIF:** 5002174308  
**Proprietário:** Ernesto Pinto Luciano  
**Stack:** Next.js 15 · TypeScript · Prisma · PostgreSQL · Tailwind · jose · Cloudinary  
**Idioma:** Português (Angola) · Moeda: AOA (Kz) · Fuso: Africa/Luanda  

---

## Regras Fundamentais

### 1. Ciclo obrigatório: Documentar → Implementar → Validar → Actualizar

A documentação deve reflectir a realidade do produto ou um plano formalmente aprovado.  
O ciclo é sempre este, sem excepções:

```
1. DOCUMENTAR   — escrever a proposta técnica antes de qualquer código
2. IMPLEMENTAR  — código como execução fiel da documentação aprovada
3. VALIDAR      — Quality Gate: testes, revisão, smoke tests
4. ACTUALIZAR   — sincronizar documentação com o estado real do sistema
```

### 2. Sem documentação especulativa

Não documentar funcionalidades ou arquitecturas que não estejam aprovadas ou planeadas para os próximos sprints. Cada documento deve reflectir:
- O estado actual do sistema implementado, **ou**
- Um plano formalmente aprovado pelo Product Owner para os próximos sprints.

Documentação sobre funcionalidades indefinidas, hipotéticas ou sem aprovação é proibida. Se uma ideia ainda não tem aprovação, vai para o Roadmap como `📋 Planeado` — não para documentação técnica.

### 3. Ordem de prioridade de risco

Quando existirem várias tarefas possíveis, a ordem é sempre:

```
1. Segurança          — vulnerabilidades, auth, RBAC, dados sensíveis
2. Integridade dados  — race conditions, transacções, consistência financeira
3. Estabilidade       — bugs críticos, regressões, build quebrado
4. Testes             — cobertura de módulos críticos
5. Performance        — queries, paginação, carga em memória
6. Novas features     — só após os pontos acima estarem saudáveis
```

### 4. Definition of Ready (DoR)

Nenhuma tarefa entra em desenvolvimento sem:

```
□ Requisitos definidos (o quê e porquê)
□ Regras de negócio identificadas (consultar Business Bible)
□ Impactos mapeados (quais módulos, tabelas e routes são afectados)
□ Critérios de aceitação escritos (como saber que está feito)
□ Plano de testes definido (unitários, integração, manual)
```

Se qualquer item estiver em falta, a tarefa volta para backlog até estar completa.

### 5. Definition of Done (DoD)

Uma tarefa só está concluída quando **todos** os seguintes critérios são verdadeiros:

```
□ Código implementado e revisto
□ Testes aprovados (npm test — zero falhas)
□ Documentação actualizada (ficheiros afectados em docs/)
□ ADR criado ou actualizado se houve decisão arquitectural significativa
□ Sem regressões (testes existentes continuam a passar)
□ Quality Gate aprovado (Gates 1 e 2 passam no CI)
□ Product Owner notificado se a tarefa for P0 ou afectar comportamento visível
```

### 6. Metodologia em 10 etapas (obrigatória para features)

```
1. Auditoria → 2. Arquitectura → 3. Modelo de Domínio → 4. Base de Dados
→ 5. APIs → 6. UX/UI → 7. Implementação → 8. Testes → 9. Documentação → 10. Validação
```

Nenhuma etapa pode ser omitida para novas features. Para refactoring (Fase P0), podem ser aplicadas as etapas relevantes (1, 7, 8, 9, 10).

### 7. Princípios invioláveis

- Clean Architecture · DDD · SSoT · SOLID · DRY · KISS
- Security by Design · Event-Driven · Repository Pattern
- RBAC · Auditoria obrigatória em operações financeiras

### 8. SSoT — Single Source of Truth

Cada dado tem exactamente um proprietário. Nunca duplicar. Outros módulos lêem via FK/include.

### 9. Transacções obrigatórias

Toda operação que modifica > 1 tabela DEVE usar `prisma.$transaction()`.

### 10. Eventos após persistência

Publicar eventos de domínio SOMENTE após a operação principal ter sido persistida com sucesso.

### 11. Uma Pull Request = Uma Tarefa

Cada item do backlog (RFT-NNN) é implementado de forma completamente isolada:

```
□ 1 commit lógico por alteração (scope claro no message)
□ 1 Pull Request por tarefa — nunca agrupar itens críticos
□ Testes associados à tarefa incluídos no mesmo PR
□ Documentação actualizada no mesmo PR
□ Revisão e aprovação antes de avançar para a próxima tarefa
```

Agrupar alterações críticas numa única PR aumenta o risco, dificulta a revisão e torna os problemas difíceis de isolar se algo correr mal.

### 12. 5 Perguntas Obrigatórias Pré-Implementação

Antes de tocar em qualquer item do Sprint P0 (e de qualquer tarefa futura), responder explicitamente a estas cinco perguntas:

```
1. Qual é o problema?
   → Descrever o bug/vulnerabilidade/dívida de forma precisa.

2. Qual é a causa raiz?
   → Identificar ONDE e PORQUÊ o problema existe no código actual.

3. Porque é que a solução proposta é a melhor?
   → Comparar com alternativas; justificar a escolha.

4. Que módulos serão afectados?
   → Listar ficheiros, tabelas, routes e componentes impactados.

5. Como validar que a alteração não introduziu regressões?
   → Definir os testes que serão escritos e o smoke test manual.
```

Se qualquer resposta estiver vaga ou incompleta, a tarefa volta para análise.

### 13. Regra Constitucional Anti-Duplicação

Nenhuma nova funcionalidade é aprovada se:
- Introduzir duplicação de dados (viola SSoT)
- Quebrar o Single Source of Truth de qualquer entidade
- Criar dependências circulares entre módulos

Quando existe mais do que uma forma de implementar, escolher sempre a que:
- Reduz a complexidade arquitectural
- Preserva a coerência do domínio
- Facilita a evolução futura da plataforma

### 14. Limite de Uma Tarefa por Dia — Divisão Automática

Nenhuma tarefa do backlog pode ultrapassar um dia de trabalho. Se uma tarefa crescer demasiado, Claude divide-a automaticamente em subtarefas com sufixo alfabético (ex.: RFT-004A, RFT-004B, RFT-004C), cada uma com:

```
□ Objectivo próprio e bem delimitado
□ Lista de ficheiros a modificar
□ Testes e critérios de aceitação específicos
□ 1 PR por subtarefa
```

A divisão é proposta antes da implementação e requer aprovação do Product Owner.

### 15. Quando Propor em vez de Implementar

Propor solução e aguardar aprovação quando:
- A mudança afecta o schema da base de dados
- A mudança afecta múltiplos módulos
- A mudança altera comportamento financeiro
- A mudança altera RBAC ou segurança
- A mudança introduz nova dependência
- A decisão é difícil de reverter
- Existe uma solução significativamente melhor que a solicitada

---

## Numeração de Documentos Financeiros

```
FT-SALA-YYYY-NNNNNN  → Faturas de sala de reunião
FT-CWORK-YYYY-NNNNNN → Faturas de coworking
FT-SERV-YYYY-NNNNNN  → Faturas de serviços avulsos (ex: Taxa de Condomínio)
REC-YYYY-NNNNNN      → Recibos de pagamento
NL-YYYY-NNNNNN       → Notas de Liquidação
RES-YYYY-NNNNNN      → Números de Reserva
```

---

## Ficheiros Críticos (ler antes de alterar)

| Ficheiro | Quando Ler |
|---|---|
| `prisma/schema.prisma` | SEMPRE, antes de qualquer trabalho |
| `src/middleware.ts` | Antes de alterar rotas ou auth |
| `src/lib/auth.ts` | Antes de alterar auth |
| `src/lib/finance-service.ts` | Antes de qualquer operação financeira |
| `src/lib/audit-service.ts` | Antes de adicionar novos eventos de auditoria |
| `src/lib/event-bus.ts` | Antes de publicar novos eventos |
| `src/lib/event-handlers.ts` | Antes de registar novos handlers |
| `src/lib/pricing-service.ts` | Antes de alterar preçário |
| `src/lib/bi-helpers.ts` | Antes de alterar lógica BI (helpers puros: monthKey, lastNMonths, occupancy) |
| `src/lib/validators.ts` | Antes de novos endpoints públicos |
| `src/lib/document-numbering.ts` | Antes de gerar qualquer número de documento |
| `next.config.js` | Antes de alterar CSP ou domínios externos |

---

## Dívidas Técnicas Críticas (Fase P0 — Em Resolução)

| ID | Dívida | Impacto | Sprint |
|---|---|---|---|
| DT-011 | JWT fallback secret | Crítico | P0-A ✅ |
| DT-012 | RBAC incompleto nas API Routes | Crítico | P0-A ✅ |
| DT-013 | TOCTOU no conflict check de reservas | Crítico | P0-B ✅ VOL04 |
| DT-014 | Numeração de documentos com race condition | Crítico | P0-B ✅ |
| DT-016 | TOTP 2FA sem integração no login | Crítico | P0-D ✅ |
| DT-017 | recordFinancialHistory fora de contexto tx | Crítico | P0-B ✅ VOL04 |
| DT-002 | Sem testes unitários | Crítico | P0-C ✅ |
| DT-001 | TypeScript ignoreBuildErrors | Alto | P0-D ✅ |
| DT-009 | Sem error monitoring (Sentry) | Alto | P0-D ✅ |
| DT-010 | Rate limiting incompleto | Alto | P0-D ✅ |
| DT-035 | Cron JSDoc fecha bloco com `*/5` — erros tsc em VOL03 cron routes | Médio | P0-B ✅ 29 Jul 2026 |
| DT-036 | `ignoreBuildErrors` reactivado (01 Ago) — 20+ routes com params síncrono Next 14; corrigir com codemod `next-async-request-api` e remover flag | Alto | 📋 Pós-piloto |

Ver inventário completo: `docs/audit/metrics-dashboard.md`

---

## Banking e Contactos Azul Coworking

```
Banco: BCS
IBAN: AO06007000000212870210113
SWIFT: CDTSAOLU
Telefone: 976 467 124
Email: geral@azulcowork.com
Website: www.azulcowork.com
Salas: www.azulcowork.com/salas
Endereço: Bairro Azul, Edifício 18, Luanda, Angola
```

---

## Volumes de Documentação

| Volume | Título | Estado |
|---|---|---|
| **00** | Foundation | ✅ **APROVADO** |
| **P0** | Estabilização da Plataforma | ✅ **APROVADO** — Em execução (Ago-Set 2026) |
| 01 | CRM | ✅ **CONCLUÍDO** — Sprint CRM-FE-7 (Jul 2026) |
| 02 | ERP Financeiro Integrado | ✅ **CONCLUÍDO** — Sprint ERP-9 (Jul 2026) |
| 03 | Portal do Cliente + Omnicanal | ✅ **CONCLUÍDO** — Beta interna pronta (Jul 2026) · docs/06-portal/ |
| 04 | Reservas — Sala de Reunião | ✅ **CONCLUÍDO** — Sprint VOL04-7 (29 Jul 2026) · docs/07-reservas/ |
| 05 | Segurança — Auditoria, Sessões, Admin UI | ✅ **CONCLUÍDO** — Sprint VOL05-4 (29 Jul 2026) · docs/08-seguranca/ |
| 06 | Dashboard Executivo & Business Intelligence | ✅ **CONCLUÍDO** — Sprint VOL06-4 (29 Jul 2026) · docs/09-dashboard/ |
| 07 | Comunicação Avançada | ✅ **CONCLUÍDO** — Sprint VOL07-4 (30 Jul 2026) · docs/10-comunicacao/ |
| 08 | Gestão Documental | ✅ **CONCLUÍDO** — Sprint VOL08-4 (30 Jul 2026) · docs/11-gestao-documental/ |
| 09 | Portal do Cliente (Frontend) | ✅ **CONCLUÍDO** — Sprint VOL09-5 (30 Jul 2026) · docs/12-portal-frontend/ |
| 10 | Automações: Email Portal + Faturação Mensal | ✅ **CONCLUÍDO** — Sprint VOL10-4 (30 Jul 2026) · docs/13-automacoes/ |
| 11 | Deployment & Infraestrutura de Produção | ✅ **CONCLUÍDO** — Sprint VOL11-4 (30 Jul 2026) · docs/14-deployment/ |
| 12 | ERP Admin UI + Correcções de Produção | ✅ **CONCLUÍDO** — Sprint VOL12-4 (30 Jul 2026) · src/app/admin/erp/ |
| 13+ | Ver docs/roadmap/README.md | 📋 Planeado |

---

## Quality Gate (obrigatório desde Set 2026)

Nenhum PR é fundido e nenhum deploy é feito sem passar o Quality Gate.  
Ver: `docs/p0-stabilization/quality-gate.md`

```
GATE 1 (pre-commit): lint + tsc + testes afectados
GATE 2 (pre-merge):  build + suite completa + cobertura ≥ 60% + checklist PR
GATE 3 (pre-deploy): smoke tests em staging + rollback planeado
```

---

## Governança

Ver: `docs/governance/README.md` — Enterprise Engineering Governance Framework  
Ver: `docs/adr/README.md` — Architecture Decision Log (todas as decisões cronologicamente)

---

## Painel de Métricas

Score actual: **58/100** (Julho 2026) → Target: **85/100** (Dezembro 2026)  
Ver: `docs/audit/metrics-dashboard.md` (actualizado quinzenalmente)

---

*VD Platform — CLAUDE.md v2.1.0 — Julho 2026*  
*Actualizar sempre que a arquitectura, processo ou governança evoluir*
