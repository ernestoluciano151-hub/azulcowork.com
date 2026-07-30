# Technology Stack — VD Platform

> **Documento:** 00-STACK-001  
> **Volume:** 00 — Foundation  
> **Estado:** ✅ Aprovado  
> **Versão:** 1.0.0  
> **Data:** Julho 2026  

---

## 1. Visão Geral do Stack

O VD Platform utiliza um stack moderno, **full-stack TypeScript**, com escolhas tecnológicas justificadas por critérios de desempenho, segurança, escalabilidade e custo.

```
┌──────────────────────────────────────────────────────┐
│                  STACK TECNOLÓGICO                    │
├───────────────┬──────────────────────────────────────┤
│  Frontend     │  Next.js 15 (App Router + RSC)        │
│  Linguagem    │  TypeScript 5.x                       │
│  Estilos      │  Tailwind CSS 3.x                     │
│  Gráficos     │  Recharts 3.x                         │
│  Calendário   │  react-day-picker 8.x                 │
├───────────────┼──────────────────────────────────────┤
│  Backend      │  Next.js 15 (Route Handlers / API)    │
│  ORM          │  Prisma 5.x                           │
│  Auth         │  jose (JWT) + bcryptjs                │
│  PDF          │  @react-pdf/renderer + pdfkit         │
│  Excel        │  exceljs                              │
│  Email        │  Nodemailer                           │
├───────────────┼──────────────────────────────────────┤
│  Database     │  PostgreSQL (Supabase / Neon)         │
│  Dev local    │  SQLite → PostgreSQL (env switch)     │
├───────────────┼──────────────────────────────────────┤
│  Activos      │  Cloudinary (CDN + transformações)    │
│  Deployment   │  Vercel                               │
│  Runtime      │  Node.js 20 LTS                       │
├───────────────┼──────────────────────────────────────┤
│  Datas        │  date-fns 3.x                         │
│  Validação    │  Validação manual (→ Zod no futuro)   │
│  Rate Limit   │  Implementação custom (rateLimit.ts)  │
└───────────────┴──────────────────────────────────────┘
```

---

## 2. Decisões por Tecnologia

### 2.1 Next.js 15 com App Router

**Versão:** 15.2.x  
**ADR:** ADR-001

#### Por que Next.js?

| Critério | Next.js 15 | Alternativa (Remix) | Alternativa (SPA React) |
|---|---|---|---|
| SSR nativo | ✅ Excelente | ✅ Bom | ❌ Não |
| Server Components | ✅ Nativo | ⚠️ Parcial | ❌ Não |
| API Routes integradas | ✅ Sim | ✅ Sim | ❌ Não |
| SEO (landing page) | ✅ Excelente | ✅ Bom | ❌ Mau |
| Ecosistema | ✅ Enorme | 🟡 Médio | ✅ Grande |
| Vercel deployment | ✅ Nativo | 🟡 Bom | ✅ Bom |
| Curva de aprendizagem | 🟡 Média | 🟡 Média | ✅ Baixa |

**Veredicto:** Next.js 15 é a escolha correcta. O App Router com React Server Components permite reduzir drasticamente o JavaScript enviado ao cliente, melhorando a performance no contexto africano (largura de banda limitada).

#### Padrões de Uso

**Server Components (RSC)** — para todas as páginas admin que lêem dados:
```tsx
// ✅ CORRECTO — Server Component faz a query directamente
export default async function DashboardPage() {
  const companies = await prisma.company.findMany({ ... });
  return <Dashboard companies={companies} />;
}
```

**Client Components** — apenas quando necessário estado ou interactividade:
```tsx
// ✅ CORRECTO — client component apenas para interactividade
"use client";
export function LeadModal({ lead, onClose }) {
  const [loading, setLoading] = useState(false);
  // ...
}
```

**Route Handlers** — para operações de escrita e mutations:
```typescript
// src/app/api/leads/route.ts
export async function POST(req: Request) { ... }
export async function GET(req: Request) { ... }
```

---

### 2.2 TypeScript 5.x

**Por que TypeScript?**

TypeScript elimina toda uma categoria de bugs em runtime através de verificação de tipos em compile-time. Para um sistema financeiro onde um erro pode implicar valores errados em faturas, esta garantia é **obrigatória**.

**Configuração:**

O projecto usa `"strict": true` no `tsconfig.json`. Actualmente `ignoreBuildErrors: true` está activo em `next.config.js` — **isto deve ser removido** numa fase de maturidade do projecto após correcção de todos os erros de tipo.

**Roadmap TypeScript:**
- Fase 0 (actual): ignoreBuildErrors activo (dívida técnica a gerir)
- Fase 1: eliminar todos os `any` implícitos
- Fase 2: activar `strictNullChecks` em todos os módulos
- Fase 3: desactivar `ignoreBuildErrors`

---

### 2.3 Prisma 5.x

**ADR:** ADR-002

#### Por que Prisma?

| Critério | Prisma | Drizzle | TypeORM | SQL raw |
|---|---|---|---|---|
| Type safety | ✅ Total | ✅ Total | 🟡 Parcial | ❌ Nenhuma |
| Migrations | ✅ Excelente | 🟡 Básico | ✅ Bom | ❌ Manual |
| DX (Dev Experience) | ✅ Excelente | ✅ Bom | 🟡 Médio | ❌ Mau |
| Performance | 🟡 Bom | ✅ Excelente | 🟡 Bom | ✅ Máxima |
| Studio (GUI) | ✅ Incluído | ❌ Não | ❌ Não | ❌ Não |
| PostgreSQL support | ✅ Completo | ✅ Completo | ✅ Completo | ✅ Total |
| Maturidade | ✅ Alta | 🟡 Crescente | ✅ Alta | ✅ Total |

**Veredicto:** Prisma oferece o melhor equilíbrio entre segurança de tipos, DX e maturidade. A diferença de performance face ao Drizzle ou SQL raw não é relevante para a escala actual do projecto.

#### Convenções Prisma

```typescript
// ✅ Singleton para evitar múltiplas conexões (Next.js hot reload)
// src/lib/prisma.ts
const globalForPrisma = globalThis as { prisma?: PrismaClient };
export const prisma = globalForPrisma.prisma ?? new PrismaClient();
if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

// ✅ Sempre usar include explícito, nunca select * implícito
const company = await prisma.company.findUnique({
  where: { id },
  include: { payments: true, employees: true }
});

// ✅ Transacções para operações multi-tabela
await prisma.$transaction(async (tx) => { ... });
```

---

### 2.4 PostgreSQL via Supabase

**ADR:** ADR-002

**Produção:** Supabase (PostgreSQL gerido)  
**Desenvolvimento:** SQLite (via `file:./dev.db`) → migrar para PostgreSQL local ou Supabase dev

#### Por que PostgreSQL?

- ACID completo → crítico para operações financeiras
- Índices compostos, full-text search, JSON, arrays
- Supabase oferece backup automático, replica e REST API gratuitos
- Compatível 100% com Prisma

#### Variáveis de Ambiente

```bash
# Desenvolvimento local
DATABASE_URL="file:./dev.db"   # SQLite

# Produção
DATABASE_URL="postgresql://user:pass@host:5432/dbname?schema=public"
```

⚠️ **Alerta:** O schema usa `provider = "postgresql"`. Se usar SQLite em dev, alguns tipos (Float, DateTime) têm comportamentos ligeiramente diferentes. Recomenda-se usar PostgreSQL também em desenvolvimento.

---

### 2.5 Autenticação: jose + bcryptjs

**ADR:** ADR-004

- **jose:** Biblioteca JavaScript para JWT (sign, verify) sem dependências nativas → compatível com Vercel Edge Runtime
- **bcryptjs:** Hashing de passwords em JavaScript puro → sem dependências nativas

#### Alternativas Consideradas

| Alternativa | Porquê não adoptar |
|---|---|
| NextAuth.js / Auth.js | Demasiado opinionado para RBAC customizado; overhead de configuração |
| Clerk | SaaS externo, custo mensal, dados fora do controlo |
| Supabase Auth | Acoplaria a infra ao fornecedor; limitaria portabilidade |
| Passport.js | Ecosistema Node.js antigo, não optimizado para Edge |

**Veredicto:** Implementação própria com jose + bcryptjs dá controlo total sobre o fluxo de auth, suporta Edge Runtime, e é suficientemente simples para o RBAC do projecto.

---

### 2.6 Cloudinary

**Propósito:** Armazenamento e gestão de activos binários (logos, comprovativos, contratos, fotos).

#### Funcionalidades Usadas

- Upload de ficheiros via `src/app/api/upload/route.ts`
- Transformações automáticas (resize, format, quality)
- CDN global (distribui activos com baixa latência)
- URLs permanentes e versionadas

#### Alternativas

| Alternativa | Por que não adoptar |
|---|---|
| AWS S3 | Mais complexo de configurar, sem CDN nativa gratuita, sem transformações |
| Supabase Storage | Funcionalidade limitada de transformações, ainda em crescimento |
| Vercel Blob | Sem transformações de imagem, custo por GB mais elevado |

---

### 2.7 Nodemailer

**Propósito:** Envio de emails transaccionais (confirmações, lembretes, recibos).

**Configuração esperada:**
```bash
SMTP_HOST="smtp.gmail.com"
SMTP_PORT=465
SMTP_USER="geral@azulcowork.com"
SMTP_PASS="app-password"
```

**Evolução futura:** Migrar para **Resend** ou **SendGrid** para melhor deliverability, tracking de abertura e templates HTML.

---

### 2.8 PDF Generation

Dois mecanismos existem em paralelo:

| Biblioteca | Uso | Ficheiro |
|---|---|---|
| `@react-pdf/renderer` | PDFs com layout React (recibos) | `src/lib/receipt-pdf.tsx` |
| `pdfkit` | PDFs programáticos (faturas complexas) | `src/lib/invoice-pdf.tsx` |

**Recomendação:** Padronizar em `@react-pdf/renderer` para todos os novos documentos — React components são mais fáceis de manter e versionar. Registado como melhoria técnica.

---

### 2.9 ExcelJS

**Propósito:** Exportação de dados em formato XLSX (Excel).

Usado em:
- `src/app/api/leads/export-xlsx/route.ts` — exportação de leads
- Futuro: relatórios financeiros, listas de empresas

---

## 3. Dependências Completas

### 3.1 Produção

```json
{
  "@prisma/client": "^5.18.0",     // ORM
  "@react-pdf/renderer": "^4.5.1", // PDF via React
  "bcryptjs": "^2.4.3",            // Hash de passwords
  "cloudinary": "^2.10.0",         // Gestão de activos
  "date-fns": "^3.6.0",            // Manipulação de datas
  "exceljs": "^4.4.0",             // Export Excel
  "jose": "^5.6.3",                // JWT (Edge-safe)
  "next": "^15.2.5",               // Framework
  "nodemailer": "^9.0.1",          // Email
  "pdfkit": "^0.19.1",             // PDF programático
  "react": "^18.3.1",              // UI
  "react-day-picker": "^8.10.1",   // Calendário
  "react-dom": "^18.3.1",          // DOM React
  "recharts": "^3.9.0"             // Gráficos
}
```

### 3.2 Desenvolvimento

```json
{
  "@types/bcryptjs": "^2.4.6",
  "@types/node": "^20.14.0",
  "@types/nodemailer": "^8.0.1",
  "@types/react": "^18.3.0",
  "autoprefixer": "^10.4.19",
  "postcss": "^8.4.38",
  "prisma": "^5.18.0",
  "tailwindcss": "^3.4.4",
  "typescript": "^5.5.0"
}
```

---

## 4. Dependências Futuras Previstas

| Biblioteca | Propósito | Fase |
|---|---|---|
| `zod` | Validação de schema type-safe | Fase 1 |
| `@upstash/redis` | Event Bus multi-instância | Fase 2 |
| `resend` | Email transaccional robusto | Fase 1 |
| `sentry` | Error monitoring | Fase 1 |
| `vitest` | Testes unitários e integração | Fase 0 (urgente) |
| `@testing-library/react` | Testes de componentes | Fase 1 |
| `playwright` | Testes E2E | Fase 2 |
| `sharp` | Processamento de imagens no servidor | Fase 1 |
| `ioredis` | Cache e sessions | Fase 2 |

---

## 5. Variáveis de Ambiente

### 5.1 Obrigatórias (Produção)

| Variável | Descrição |
|---|---|
| `DATABASE_URL` | URL PostgreSQL (Supabase/Neon) |
| `JWT_SECRET` | Secret para assinar JWTs (mínimo 32 chars aleatórios) |
| `CLOUDINARY_CLOUD_NAME` | Nome da conta Cloudinary |
| `CLOUDINARY_API_KEY` | API Key Cloudinary |
| `CLOUDINARY_API_SECRET` | API Secret Cloudinary |

### 5.2 Opcionais / Email

| Variável | Descrição |
|---|---|
| `SMTP_HOST` | Servidor SMTP |
| `SMTP_PORT` | Porta SMTP (465 para SSL) |
| `SMTP_USER` | Utilizador SMTP |
| `SMTP_PASS` | Password SMTP / App Password |
| `SMTP_FROM` | Email de envio |
| `ADMIN_NOTIFY_EMAIL` | Email para notificações admin |

### 5.3 Públicas (NEXT_PUBLIC_)

| Variável | Descrição |
|---|---|
| `NEXT_PUBLIC_SITE_NAME` | Nome do site |
| `NEXT_PUBLIC_SITE_URL` | URL público do site |
| `NEXT_PUBLIC_VTURB_PLAYER_ID` | Player ID do VSL (Vturb) |
| `NEXT_PUBLIC_VTURB_SCRIPT_URL` | Script URL Vturb |

### 5.4 Setup Inicial

| Variável | Descrição |
|---|---|
| `ADMIN_EMAIL` | Email do admin inicial (seed) |
| `ADMIN_PASSWORD` | Password do admin inicial (seed) |

---

## 6. Análise de Riscos do Stack

| Risco | Probabilidade | Impacto | Mitigação |
|---|---|---|---|
| Breaking changes Next.js | Média | Alto | Pin exact version, test before upgrade |
| Limite Prisma com PostgreSQL features avançadas | Baixa | Médio | Raw queries disponíveis |
| Custo Cloudinary em escala | Média | Médio | Plano pago, monitorizar uso |
| Supabase outage | Baixa | Crítico | Backup diário, connection pooling |
| Event Bus perda de eventos (restart) | Alta (dev) / Baixa (prod) | Médio | Migrar para Redis em produção |
| TypeScript `ignoreBuildErrors` oculta bugs | Alta | Alto | Plano de remoção em Fase 1 |

---

*VD Platform — Technology Stack v1.0.0 — Julho 2026*
