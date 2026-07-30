# Configuração dos Acessos Administrativos — Piloto RC-1

> **Data:** 30 Jul 2026  
> **Responsável:** Ernesto Pinto Luciano  
> **Pré-requisito:** Deploy em produção concluído (`docs/release/deployment-checklist.md`)

---

## Contexto

Este documento descreve o processo de criação e activação dos acessos administrativos iniciais para o piloto controlado do VD Platform v1.0.0-rc1.

---

## Contas a Criar

| Utilizador | Papel Solicitado | Papel Criado | Motivo |
|---|---|---|---|
| Ernesto Luciano | SUPER_ADMIN | **ADMIN** | `SUPER_ADMIN` não existe na v1.0 — `ADMIN` é o papel máximo |
| Operações Azul Cowork | ADMIN | **ADMIN** | Conforme solicitado |

### Nota sobre o papel ADMIN

O enum `AdminRole` na v1.0 contém: `ADMIN`, `COMERCIAL`, `FINANCEIRO`, `VIEWER`.  
Não existe `SUPER_ADMIN`. O papel `ADMIN` tem acesso irrestrito a todos os módulos e funcionalidades da plataforma, incluindo gestão de utilizadores, ERP, reservas, auditoria, sessões e configurações. Functionally equivalente a um super-admin.

---

## Pré-requisitos Antes de Executar

```
□ DATABASE_URL de produção disponível no ambiente ou .env
□ Node.js ≥ 18 instalado na máquina onde o script corre
□ Dependências instaladas (npm install já executado)
□ Deploy em produção feito (migrations aplicadas via build:prod)
□ Terminal seguro e privado (não gravado, não partilhado)
```

---

## Execução do Script

### 1. Configurar emails (obrigatório antes de correr)

Editar `scripts/setup-pilot-admins.js` e substituir os emails:

```javascript
// Linha ~38
email: 'ernesto@azulcowork.com',       // ← SUBSTITUIR

// Linha ~44
email: 'operacoes@azulcowork.com',     // ← SUBSTITUIR
```

### 2. Executar

```bash
# Opção A — DATABASE_URL directo (produção Neon/Vercel)
DATABASE_URL="postgresql://..." node scripts/setup-pilot-admins.js

# Opção B — via ficheiro .env local com DATABASE_URL de produção
npx dotenv -e .env.production -- node scripts/setup-pilot-admins.js

# Opção C — via Vercel CLI (se conectado ao projecto)
vercel env pull .env.production.local
DATABASE_URL=$(grep DATABASE_URL .env.production.local | cut -d= -f2-) node scripts/setup-pilot-admins.js
```

### 3. Anotar credenciais

O script imprime as passwords **uma única vez** no terminal. Copiar imediatamente.  
Enviar por canal seguro: **WhatsApp, Signal ou entrega pessoal**.  
**Nunca por email, chat ou este canal.**

---

## O Que o Script FAZ e NÃO FAZ

| Comportamento | Estado |
|---|---|
| Gera password aleatória com `crypto.randomBytes` (20 chars, ~120 bits) | ✅ Faz |
| Aplica bcrypt com salt 12 antes de guardar | ✅ Faz |
| Imprime password uma única vez no terminal | ✅ Faz |
| Verifica se utilizador já existe (idempotente) | ✅ Faz |
| Cria com `role: ADMIN` e `active: true` | ✅ Faz |
| Armazena a password em texto simples em qualquer ficheiro | ❌ Não faz |
| Força troca de password no primeiro login | ❌ Não implementado em v1.0 |
| Activa TOTP 2FA automaticamente | ❌ Não implementado em v1.0 — opt-in manual |
| Envia credenciais por email/webhook | ❌ Não faz |

---

## Requisitos Solicitados vs. Capacidades da v1.0

| Requisito Solicitado | Estado na v1.0 | Procedimento |
|---|---|---|
| TOTP 2FA activo no 1.º login | Opt-in manual | Activar em `/admin/settings → Segurança` após 1.º login |
| Palavra-passe temporária com troca obrigatória | Não implementado | O operador comunica urgência verbalmente; utilizador muda em `/admin/settings → Conta` |
| Sessão administrativa auditada | ✅ Automático | Toda sessão é registada em `AdminSession` e `AuditLog` |
| Credenciais por canal seguro separado | Processo manual | Script imprime no terminal; operador transmite por WhatsApp/Signal |
| Papel SUPER_ADMIN | Não existe | Mapeado para `ADMIN` (papel máximo disponível) |

> Os itens "não implementados" (troca obrigatória, TOTP forçado) são candidatos para v1.1 ou Volume 13.  
> **Não alterar no piloto** — freeze de funcionalidades activo.

---

## Checklist do 1.º Login (por utilizador)

### Ernesto Luciano

```
□ Aceder a https://<domínio>/admin/login
□ Entrar com email + password recebida por canal seguro
□ Ir a /admin/settings → Segurança
□ Clicar em "Activar 2FA" → escanear QR code com Google Authenticator / Authy
□ Guardar os códigos de recuperação num gestor de passwords (ex: Bitwarden)
□ Confirmar código TOTP e activar
□ Ir a /admin/settings → Conta → alterar password
□ Fazer logout e re-login com nova password + TOTP
□ Confirmar acesso a todos os módulos (CRM, ERP, Reservas, Auditoria, etc.)
```

### Operações Azul Cowork

```
□ Aceder a https://<domínio>/admin/login
□ Entrar com email + password recebida por canal seguro
□ Ir a /admin/settings → Segurança → Activar TOTP 2FA
□ Guardar códigos de recuperação
□ Alterar password em /admin/settings → Conta
□ Confirmar acesso operacional (CRM, Contratos, Reservas)
```

---

## Validação Pós-Criação (Product Owner)

```
□ Login com TOTP funcional em ambas as contas
□ /admin/auditoria mostra eventos de login das duas contas
□ /admin/sessions mostra sessão activa de cada utilizador
□ Roles confirmados: ambos como ADMIN
□ Nenhuma password registada ou partilhada fora do canal seguro
□ Terminal fechado após cópia das credenciais
```

Só após esta validação iniciar o onboarding das empresas piloto.

---

## Conta de Seed (admin@versaodigital.ao)

O seed inicial (`prisma/seed.js`) criou uma conta `admin@versaodigital.ao` (ou `ADMIN_EMAIL`/`ADMIN_PASSWORD` do `.env`).

**Acção recomendada após criação das contas piloto:**

```bash
# Desactivar a conta de seed em produção
# (via /admin/users na UI, ou directamente via Prisma Studio)
# NÃO apagar — desactivar (active: false) para manter o histórico de auditoria
```

---

## Plano para v1.1 (Pós-Piloto)

Issues identificados para melhoria futura (não durante o piloto):

| Feature | Prioridade | Volume |
|---|---|---|
| Forçar troca de password no 1.º login | P2 | v1.1 |
| TOTP obrigatório para papel ADMIN | P2 | v1.1 |
| Email de boas-vindas com link de activação | P3 | v1.1 |

---

*VD Platform — Admin Setup — Piloto RC-1 — 30 Jul 2026*
