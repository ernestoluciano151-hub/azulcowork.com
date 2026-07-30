# Guia de Onboarding — Beta Portal do Cliente

> **Volume:** 03  
> **Estado:** ✅ Produzido em VOL03-11C — 29 Jul 2026  
> **Audiência:** Staff do Azul Coworking (quem onborda as empresas piloto)  
> **Duração estimada por empresa:** 15–30 minutos

---

## Visão Geral da Beta

A beta interna do Portal do Cliente decorre durante **4 semanas** com **3 a 5 empresas piloto** seleccionadas.

**Objectivos da beta:**
- Validar o fluxo de login e onboarding com utilizadores reais
- Detectar erros de UX, dados incorrectos ou funcionalidades em falta
- Medir adopção: logins, downloads, tickets de suporte
- Recolher feedback estruturado antes do lançamento geral

**Critérios de selecção das empresas piloto:**
- Clientes activos com contrato válido
- Nível de confiança: clientes satisfeitos, abertos a novidades
- Variedade: pelo menos 1 empresa individual + 1 empresa com múltiplos utilizadores
- Disponibilidade: aceitaram participar activamente e dar feedback

---

## Pré-requisitos Técnicos

Antes de iniciar o onboarding de qualquer empresa:

```
□ Variáveis de ambiente do portal configuradas (ver env-vars.md)
□ Migration Prisma aplicada (npx prisma migrate deploy)
□ Cron jobs activos e autenticados com CRON_SECRET
□ Email Resend a funcionar (enviar email de teste)
□ Smoke test /api/portal/auth/login → 200 ou 401 (não 500)
□ Dados da empresa correctos na BD (contrato activo, faturas geradas)
```

---

## Passo a Passo: Onboarding de uma Empresa

### Passo 1 — Verificar dados da empresa na BD

Antes de criar o acesso ao portal, verificar que a empresa tem:
- Contrato activo (status `ACTIVE`)
- Pelo menos 1 fatura no sistema
- Dados actualizados (NIF, endereço, contacto)

```
Admin → /admin/crm → [seleccionar empresa] → verificar dados
Admin → /admin/erp/contratos → verificar contrato activo
Admin → /admin/erp/faturas → verificar faturas
```

### Passo 2 — Criar PortalUser PORTAL_OWNER

No painel admin, criar o primeiro utilizador do portal:

```http
POST /api/admin/portal/users
Authorization: [cookie vd_admin_session]
Content-Type: application/json

{
  "companyId": "<company.id>",
  "name":      "Nome do Responsável",
  "email":     "responsavel@empresa.ao",
  "password":  null
}
```

Ou via interface (quando disponível): Admin → Gestão Portal → Nova Conta.

**Regra:** `password` omitido → o utilizador usa Magic Link no primeiro login (recomendado).

### Passo 3 — Gerar e enviar Magic Link

```http
POST /api/admin/portal/magic-link
Content-Type: application/json

{
  "portalUserId": "<portalUser.id>"
}
```

Resposta:
```json
{
  "magicLinkUrl": "https://azulcowork.com/portal/auth/magic?token=abc...",
  "expiresAt":    "2026-07-29T10:15:00.000Z",
  "ttlMinutes":   15
}
```

**Enviar o link ao cliente** pelo canal preferido (email, WhatsApp).

Template de email sugerido:

```
Assunto: O seu acesso ao Portal Azul Coworking está pronto

Olá [Nome],

O seu acesso ao Portal do Cliente do Azul Coworking foi criado.
Clique no link abaixo para entrar:

[MAGIC LINK]

Este link é válido durante 15 minutos. Após entrar,
poderá consultar os seus contratos, faturas e reservas.

Se o link expirar, solicite um novo em: https://azulcowork.com/portal/login

Qualquer dúvida, contacte-nos em geral@azulcowork.com ou 976 467 124.

Equipa Azul Coworking
```

### Passo 4 — Acompanhar o primeiro login

Verificar no dashboard de monitorização que o login foi bem-sucedido:

```http
GET /api/admin/portal/stats
```

Indicadores de sucesso:
- `users.confirmed` aumentou (+1)
- `sessions.loginsLast7days` aumentou
- `users.byRole.PORTAL_OWNER` = número esperado

### Passo 5 — Walkthrough com o cliente

Se possível, fazer um walkthrough de 15 minutos com o cliente:

```
1. Login com o magic link
2. Dashboard: mostrar o resumo do contrato e próxima fatura
3. Faturas: como descarregar PDF
4. Reservas: como criar uma reserva de sala
5. Documentos: como ver documentos partilhados
6. Suporte: como abrir um ticket
7. Notificações: explicar que receberá alertas automáticos
```

### Passo 6 — Adicionar utilizadores adicionais (opcional)

O PORTAL_OWNER pode adicionar utilizadores da própria empresa:

```
Portal → /portal/utilizadores → Adicionar utilizador
```

Roles disponíveis para criar dentro do portal:
- `PORTAL_ADMIN` — gestão completa (excl. ownership)
- `PORTAL_MEMBER` — acesso a todas as funções excepto gestão de utilizadores
- `PORTAL_VIEWER` — só leitura

---

## Monitorização Durante a Beta

### Dashboard de actividade

```http
GET /api/admin/portal/stats
```

Verificar semanalmente:
- Taxa de logins (empresas activas vs. registadas)
- Documentos descarregados
- Tickets de suporte abertos
- Taxa de entrega de notificações

### Métricas de sucesso (4 semanas)

| Métrica | Mínimo | Óptimo |
|---|---|---|
| Empresas com login confirmado | ≥ 3 | 5/5 |
| Logins por empresa (4 semanas) | ≥ 2 | ≥ 5 |
| Documentos descarregados | ≥ 1/empresa | ≥ 3/empresa |
| Tickets de suporte resolvidos | — | ≤ 3 dias |
| Bugs críticos reportados | 0 após semana 2 | — |
| Taxa de entrega de notificações | ≥ 90% | ≥ 98% |

---

## Recolha de Feedback

### Durante a beta

Enviar ao cliente no final da 2.ª semana:

```
Bom dia [Nome],

Passadas 2 semanas de acesso ao Portal do Cliente, gostaríamos de saber como está a correr.

Por favor responda a estas 3 perguntas:
1. O que funciona bem? (1-2 coisas)
2. O que é difícil ou confuso? (1-2 coisas)
3. O que está em falta?

Obrigado pela sua colaboração!
Equipa Azul Coworking
```

### Bugs e problemas

Reportar para o backlog com prioridade:
- **P0** — dados incorrectos (fatura errada, contrato errado), perda de dados
- **P1** — funcionalidade principal não funciona (login, download)
- **P2** — UX difícil, lento, confuso
- **P3** — melhorias e features novas

---

## Critérios de Saída da Beta → Lançamento Geral

```
□ ≥ 3 empresas piloto completaram onboarding sem ajuda do staff
□ Zero bugs P0 abertos
□ Zero bugs P1 abertos há mais de 7 dias
□ Taxa de entrega de notificações ≥ 95% na semana 4
□ Pelo menos 1 empresa gerou e pagou fatura processada no portal
□ Feedback recolhido de ≥ 2 empresas
□ Documentação actualizada com aprendizagens da beta
□ Product Owner validou o portal com utilizador real
```

---

## FAQ — Perguntas Frequentes da Beta

**P: O cliente não recebeu o magic link. O que fazer?**  
R: Gerar um novo link (`POST /api/admin/portal/magic-link`). Verificar também a pasta de spam. O domínio de envio deve estar verificado no Resend.

**P: O cliente tentou o link mas diz "link expirado".**  
R: O link TTL é de 15 minutos. Gerar um novo link e enviá-lo de imediato.

**P: O cliente não consegue ver os contratos/faturas.**  
R: Verificar que a empresa (`companyId`) no PortalUser corresponde à empresa correcta na BD. Verificar que o contrato tem status `ACTIVE` e a fatura tem `companyId` igual.

**P: O cliente reporta que recebe notificações em duplicado.**  
R: Verificar se `notifyInApp` e `notifyEmail` estão ambos activos. Os canais são independentes por design.

**P: O cliente pediu para alterar o email de login.**  
R: Via API admin: `PATCH /api/admin/portal/users/[id]`. Ou criar novo utilizador e transferir ownership.

**P: Como desactivar acesso de uma empresa que saiu?**  
R: `DELETE /api/admin/portal/users/[id]` para cada utilizador. Isto desactiva e revoga sessões sem apagar dados de auditoria.

---

*VD Platform — Volume 03 — onboarding-beta.md — 29 Julho 2026*  
*Azul Coworking, Bairro Azul, Edifício 18, Luanda, Angola*
