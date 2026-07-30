# Centro de Comunicação Omnicanal — Volume 03

> **Volume:** 03 — Portal do Cliente  
> **Estado:** 📋 Especificação — aguarda aprovação PO  
> **ADR relacionado:** ADR-027 (Resend + Meta Cloud API + VAPID sem broker externo)

---

## 1. Visão Geral

O Centro de Comunicação Omnicanal garante que cada evento relevante chegue ao cliente
pelo canal que prefere, com rastreabilidade completa do ciclo de vida de cada mensagem.

```
EVENTO INTERNO
     ↓
OmnichannelService
     ↓
┌────────────────────────────────────────────┐
│  EMAIL      WHATSAPP    IN-APP    PUSH WEB │
│  (Resend)   (Meta API)  (SSE)    (VAPID)   │
└────────────────────────────────────────────┘
     ↓            ↓          ↓          ↓
OmnichannelMessage (audit trail — BD)
     ↓
PortalNotification (estado final: DELIVERED / READ / FAILED)
     ↓
TimelineEntry (empresa)
```

---

## 2. Canal 1 — Email (Resend)

### 2.1 Porquê Resend

- API moderna e simples (REST)
- Suporte nativo a templates React (`@react-email`)
- Webhook de entrega para rastreabilidade
- Fácil integração com domínio `azulcowork.com`
- Plano gratuito cobre até 3.000 emails/mês

**Diferença do nodemailer (existente):** o nodemailer é usado para comunicação financeira
interna (faturas ao cliente via SMTP configurado). O Resend é para comunicação do portal
(notificações transaccionais ao cliente com rastreabilidade de entrega).

### 2.2 Templates Email do Portal

| Template | Assunto | Trigger |
|---|---|---|
| `portal-welcome` | "O seu portal Azul Coworking está pronto" | Activação do portal |
| `portal-magic-link` | "O seu link de acesso — Azul Coworking" | Pedido de magic link |
| `portal-invoice-available` | "Nova fatura disponível — [número]" | Fatura emitida |
| `portal-payment-confirmed` | "Pagamento confirmado — [referência]" | Pagamento confirmado |
| `portal-payment-overdue` | "Pagamento em atraso — [número fatura]" | Alerta de atraso |
| `portal-rent-due` | "Renda a vencer em 7 dias" | D-7 antes do vencimento |
| `portal-contract-expiring` | "Contrato expira em [N] dias" | D-30, D-15, D-7 |
| `portal-booking-confirmed` | "Reserva confirmada — [sala] [data]" | Staff confirma reserva |
| `portal-document-available` | "Novo documento disponível" | Upload de documento |
| `portal-ticket-reply` | "Nova resposta no ticket [ST-XXXX]" | Staff responde ticket |
| `portal-user-invited` | "Convite para o portal Azul Coworking" | Novo utilizador criado |

### 2.3 Implementação

```typescript
// src/lib/portal-resend-service.ts
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function sendPortalEmail(opts: {
  to: string;
  template: string;
  data: Record<string, unknown>;
}): Promise<{ id: string } | { error: string }> {
  if (!process.env.RESEND_API_KEY) {
    console.warn("[Portal Email] RESEND_API_KEY não configurado — email não enviado");
    return { error: "SMTP_NOT_CONFIGURED" };
  }
  // ...
}
```

### 2.4 Variável de Ambiente Nova

```bash
RESEND_API_KEY=re_xxxxxxxxxxxx
```

---

## 3. Canal 2 — WhatsApp (Meta Business Cloud API)

### 3.1 Arquitectura

```
Sistema → Meta WhatsApp Business Cloud API (HTTPS REST)
          ↓
          Número WhatsApp Business do Azul Coworking
          ↓
          Telefone do cliente (número registado em PortalUser.phone)
```

### 3.2 Pré-requisitos (a configurar pelo PO)

```
□ Conta Meta Business Suite criada (business.facebook.com)
□ Número de telefone dedicado para o Azul Coworking
□ App Meta aprovada para WhatsApp Business API
□ Templates de mensagem aprovados pela Meta (obrigatório para mensagens proactivas)
□ WABA_ID (WhatsApp Business Account ID)
□ ACCESS_TOKEN (token permanente da API)
□ PHONE_NUMBER_ID (ID do número de telefone na Meta)
```

### 3.3 Regras da Meta para Templates

As mensagens **proactivas** (enviadas pelo negócio) devem usar templates pré-aprovados.
Templates são em português e submetidos para aprovação (48–72h).

| Template | Categoria | Conteúdo |
|---|---|---|
| `rent_due_reminder` | UTILITY | "Olá {{1}}, a sua renda de Kz {{2}} vence em {{3}} dias." |
| `invoice_available` | UTILITY | "Nova fatura {{1}} disponível no portal. Aceda em {{2}}" |
| `payment_confirmed` | UTILITY | "Pagamento de Kz {{1}} confirmado. Recibo: {{2}}" |
| `payment_overdue` | UTILITY | "Fatura {{1}} em atraso desde {{2}}. Por favor regularize." |
| `contract_expiring` | UTILITY | "O seu contrato expira em {{1}} dias. Contacte-nos." |
| `booking_confirmed` | UTILITY | "Reserva confirmada: {{1}} em {{2}} às {{3}}." |
| `document_available` | UTILITY | "Novo documento disponível no portal: {{1}}" |

### 3.4 Implementação

```typescript
// src/lib/portal-whatsapp-service.ts
export async function sendWhatsAppTemplate(opts: {
  phone: string;       // +244XXXXXXXXX
  template: string;    // nome do template aprovado
  params: string[];    // valores para os placeholders {{1}}, {{2}}, ...
  language?: string;   // "pt_BR" (português)
}): Promise<{ messageId: string } | { error: string }>
```

### 3.5 Variáveis de Ambiente

```bash
META_WABA_ID=
META_ACCESS_TOKEN=
META_PHONE_NUMBER_ID=
```

### 3.6 Graceful Degradation

Se WhatsApp não estiver configurado ou falhar:
1. Regista OmnichannelMessage com status FAILED
2. Tenta enviar email como fallback
3. Regista fallback no OmnichannelMessage.metadata

---

## 4. Canal 3 — In-App (Server-Sent Events)

### 4.1 Porquê SSE em vez de WebSocket

- SSE é unidireccional (servidor → cliente) — suficiente para notificações
- Sem necessidade de servidor WebSocket stateful
- Funciona perfeitamente em Vercel Edge/Serverless
- Reconexão automática pelo browser
- Suporte nativo em todos os browsers modernos

### 4.2 Endpoint SSE

```typescript
// GET /api/portal/notifications/stream
// Headers: Content-Type: text/event-stream
// Auth: portal-session cookie

// O browser mantém a conexão aberta
// O servidor envia eventos quando há notificações novas:

data: {"type":"NOTIFICATION","id":"xxx","title":"Nova fatura","actionUrl":"/portal/faturas/xxx"}

// Heartbeat a cada 30s para manter conexão:
: heartbeat
```

### 4.3 Implementação Frontend

```typescript
// src/app/portal/layout.tsx
const eventSource = new EventSource("/api/portal/notifications/stream");
eventSource.onmessage = (event) => {
  const notification = JSON.parse(event.data);
  // Actualizar badge de notificações
  // Mostrar toast no canto inferior direito
};
```

### 4.4 Comportamento

- Conexão SSE aberta quando cliente está no portal
- Quando evento é publicado → servidor envia para todos os SSE activos da empresa
- Se cliente não está online → notificação fica em PENDING na BD
- No próximo login → notificações PENDING são mostradas imediatamente
- Badge no ícone de sino mostra contagem de notificações não lidas

---

## 5. Canal 4 — Push Web (VAPID)

### 5.1 O que é Push Web

Notificações que aparecem no browser mesmo quando o cliente **não está** no portal.
Funciona em Chrome, Firefox, Edge (Safari tem suporte parcial).

### 5.2 Fluxo de Subscrição

```
1. Cliente está no portal
2. Browser solicita permissão: "Azul Coworking quer enviar notificações"
3. Cliente aceita → browser gera chave de subscrição
4. Frontend envia para: POST /api/portal/notifications/subscribe
5. Sistema guarda em PortalUser: pushEndpoint, pushP256dh, pushAuth
6. Sistema pode agora enviar push a qualquer momento
```

### 5.3 Implementação

```typescript
// src/lib/portal-push-service.ts
import webpush from "web-push";

webpush.setVapidDetails(
  "mailto:geral@azulcowork.com",
  process.env.VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!
);

export async function sendPushNotification(opts: {
  endpoint: string;
  p256dh: string;
  auth: string;
  payload: { title: string; body: string; url?: string };
}): Promise<void>
```

### 5.4 Variáveis de Ambiente

```bash
VAPID_PUBLIC_KEY=   # Gerado com: npx web-push generate-vapid-keys
VAPID_PRIVATE_KEY=  # Gerado com: npx web-push generate-vapid-keys
NEXT_PUBLIC_VAPID_PUBLIC_KEY=  # Mesmo que VAPID_PUBLIC_KEY (exposição ao frontend)
```

---

## 6. OmnichannelService — Orquestrador

```typescript
// src/lib/portal-omnichannel-service.ts

export interface OmnichannelEvent {
  companyId:    string;
  type:         PortalAlertType;
  title:        string;
  body:         string;
  actionUrl?:   string;
  // Referências opcionais
  invoiceId?:   string;
  contractId?:  string;
  documentId?:  string;
  bookingId?:   string;
}

export async function sendOmnichannelNotification(
  event: OmnichannelEvent
): Promise<void> {
  // 1. Buscar PortalUsers activos da empresa
  // 2. Para cada utilizador, verificar preferências
  // 3. Para cada canal activo: criar PortalNotification + OmnichannelMessage
  // 4. Enviar (graceful degradation se canal falha)
  // 5. Criar TimelineEntry na empresa
  // 6. Publicar evento de domínio: publish("portal.notification.sent")
}
```

---

## 7. Re-tentativas e Fallback

```
TENTATIVA 1: imediata
TENTATIVA 2: após 5 minutos (se TENTATIVA 1 falhou)
TENTATIVA 3: após 30 minutos (se TENTATIVA 2 falhou)

Se TENTATIVA 3 falhar:
  - OmnichannelMessage.status = FAILED
  - PortalNotification.status = FAILED
  - Se canal != EMAIL → fallback para email
  - Alerta interno (admin) se tipo PAYMENT_OVERDUE ou CONTRACT_EXPIRING
```

---

## 8. Dependências de Packages

```json
{
  "resend": "^3.x",           // Email transaccional
  "web-push": "^3.6.x",      // Push Web (VAPID)
  "@types/web-push": "^3.6.x"
  // WhatsApp: chamadas REST directas via fetch (sem SDK — API simples)
}
```

---

*VD Platform — Communication Center — Volume 03 — 29 Julho 2026*
