# Leadgen CRM — Landing Page + VSL (Vturb) + Formulário + Mini CRM

Projeto completo em **Next.js 14 (App Router) + Tailwind CSS + Prisma**, pronto para produção.

## O que está incluído

- **Landing page** moderna e responsiva (`/`) com Hero, secção de VSL (Vturb) e formulário de captação.
- **Formulário** com Primeiro Nome, Último Nome, E-mail, WhatsApp e seletor de data (calendário `react-day-picker`), com proteção anti-spam (honeypot + limite de tempo + rate limit por IP).
- **Página de obrigado** (`/obrigado`) após o envio.
- **Mini CRM administrativo** (`/admin`) com login, dashboard (total de leads, leads do dia, da semana, próximos agendamentos) e gestão de leads (pesquisa, filtros por data/estado, ordenação por data agendada, edição, notas internas, exportação CSV, paginação).
- **Base de dados** via Prisma — funciona já com **SQLite** (zero configuração) e está pronta para **PostgreSQL/Supabase** em produção (basta trocar uma linha + a `DATABASE_URL`).
- **Autenticação** da área administrativa via sessão JWT em cookie `httpOnly`.

## Estrutura de pastas

```
leadgen-crm/
├─ prisma/
│  ├─ schema.prisma        # Modelos: Lead, Note, AdminUser
│  └─ seed.js               # Cria o utilizador admin inicial
├─ src/
│  ├─ app/
│  │  ├─ page.tsx           # Landing page
│  │  ├─ obrigado/page.tsx  # Página de obrigado
│  │  ├─ admin/
│  │  │  ├─ login/page.tsx
│  │  │  ├─ dashboard/page.tsx
│  │  │  └─ leads/page.tsx
│  │  └─ api/
│  │     ├─ leads/route.ts          # POST (público) + GET (admin)
│  │     ├─ leads/[id]/route.ts     # PATCH/DELETE (admin)
│  │     ├─ leads/export/route.ts   # Exportação CSV
│  │     └─ auth/login|logout       # Autenticação admin
│  ├─ components/           # Hero, VSL, LeadForm, componentes do admin
│  ├─ lib/                  # prisma, auth (JWT), rateLimit, validators
│  ├─ middleware.ts         # Protege todas as rotas /admin/*
│  └─ styles/globals.css
├─ .env.example
└─ package.json
```

## Como correr localmente

```bash
npm install
cp .env.example .env     # depois edite os valores
npx prisma db push       # cria a base de dados SQLite local
npm run db:seed          # cria o utilizador admin (usa ADMIN_EMAIL/ADMIN_PASSWORD do .env)
npm run dev
```

Aceda a:
- Landing page: `http://localhost:3000`
- Área administrativa: `http://localhost:3000/admin/login`

## Ligar o vídeo do Vturb

No `.env`, preencha:

```
NEXT_PUBLIC_VTURB_PLAYER_ID="o-seu-player-id"
NEXT_PUBLIC_VTURB_SCRIPT_URL="https://scripts.converteai.net/SUA-CONTA/players/SEU-PLAYER/player.js"
```

Estes valores vêm do painel do Vturb, na secção de cada player ("Embed code"). O componente `src/components/VSL.tsx` já gera a tag `<vturb-smartplayer>` e carrega o script automaticamente.

## Migrar de SQLite para PostgreSQL/Supabase (produção)

1. Em `prisma/schema.prisma`, troque:
   ```prisma
   datasource db {
     provider = "postgresql"
     url      = env("DATABASE_URL")
   }
   ```
2. No `.env` de produção, defina a `DATABASE_URL` do Supabase/Postgres (encontra-se em Project Settings → Database).
3. Corra `npx prisma db push` (ou `prisma migrate deploy` num pipeline de CI/CD).

## Segurança e proteção contra spam

- **Honeypot**: campo invisível que bots tendem a preencher — se preenchido, o pedido é silenciosamente ignorado.
- **Tempo mínimo de preenchimento**: submissões em menos de 1.5s são tratadas como suspeitas.
- **Rate limiting por IP**: máximo de 5 submissões por IP em 10 minutos (`src/lib/rateLimit.ts`). Para produção com múltiplas instâncias/servidores, troque o armazenamento em memória por Redis (ex.: Upstash), mantendo a mesma interface de funções.
- **Sessão de admin** assinada com JWT (`jose`) em cookie `httpOnly` + `secure` em produção, validada pelo `middleware.ts` em todas as rotas `/admin/*`.
- Validação de e-mail/WhatsApp e sanitização básica de texto no backend (nunca confiar apenas na validação do browser).

## Deploy

Recomendado: **Vercel** (Next.js nativo) + **Supabase** (Postgres). Passos:

1. Suba o repositório para o GitHub.
2. Crie um projeto Supabase, copie a `DATABASE_URL`.
3. Na Vercel, importe o repositório e defina as variáveis de ambiente do `.env.example`.
4. Após o primeiro deploy, corra `npx prisma db push` apontando para a base de produção (pode ser feito localmente uma vez, ou num passo de build).
5. Corra o seed do admin uma vez (`npm run db:seed` com as envs de produção) para criar o utilizador inicial.

## Próximos passos sugeridos

- Trocar o rate limit em memória por Redis caso o site receba muito tráfego e tenha múltiplas instâncias.
- Adicionar notificações automáticas (e-mail/WhatsApp) ao CRM quando um novo lead é criado (webhook).
- Adicionar mais administradores via uma página de gestão de utilizadores (atualmente o seed cria apenas um).
- Ligar um reCAPTCHA/hCaptcha como camada extra de proteção, se o spam persistir mesmo com o honeypot.
